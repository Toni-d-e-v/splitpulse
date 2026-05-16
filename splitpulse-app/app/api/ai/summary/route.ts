import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";
import { AISummarySchema } from "@/lib/api/schemas";
import { getCached, setCached } from "@/lib/api/ai-cache";
import { anthropic, MODEL_SONNET, extractText } from "@/lib/anthropic";
import { timeAgo } from "@/lib/instant/timeAgo";

/**
 * POST /api/ai/summary
 * Body: { location_id: uuid }
 * 5-min cache per location.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = AISummarySchema.safeParse(body);
  if (!parsed.success)
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join("; "),
      "INVALID_INPUT",
    );

  const { location_id } = parsed.data;
  const cacheKey = `summary:${location_id}`;
  const cached = getCached(cacheKey);
  if (cached) return Response.json({ summary: cached, cached: true });

  const supabase = await createClient();

  const { data: location, error: locErr } = await supabase
    .from("locations_view")
    .select("name, type, pulse_status, pulse_score")
    .eq("id", location_id)
    .single();

  if (locErr || !location)
    return errorResponse("Location not found", "NOT_FOUND");

  const { data: instants } = await supabase
    .from("active_instants")
    .select("type, content, created_at, confirm_count")
    .eq("location_id", location_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!instants || instants.length === 0) {
    const empty = `${location.name} is currently quiet. No recent Instants.`;
    setCached(cacheKey, empty);
    return Response.json({ summary: empty, cached: false });
  }

  const formatted = instants
    .map(
      (i) =>
        `[${i.type}${i.confirm_count ? ` ·${i.confirm_count}✓` : ""}] ${
          i.content ?? "(no text)"
        } (${timeAgo(i.created_at)})`,
    )
    .join("\n");

  try {
    const msg = await anthropic().messages.create({
      model: MODEL_SONNET,
      max_tokens: 300,
      system: `You are the AI brain of SPLIT PULSE, a live city heat map app.
Summarize what is happening at a location based on recent Location Instants.
Be concise, useful, and real-time focused. Max 2-3 sentences.
Location: ${location.name} (${location.type})
Pulse status: ${location.pulse_status} (score: ${location.pulse_score})
Respond in the language of the majority of Instants (Croatian or English).`,
      messages: [
        {
          role: "user",
          content: `Summarize these recent Instants:\n${formatted}`,
        },
      ],
    });

    const summary = extractText(msg) || "Summary unavailable.";
    setCached(cacheKey, summary);

    // Log query (best-effort; ignore errors).
    void supabase
      .from("ai_queries")
      .insert({ location_id, query: "summary", response: summary })
      .then(() => undefined);

    return Response.json({ summary, cached: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic error";
    return errorResponse(msg, "UPSTREAM_ERROR");
  }
}
