import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";
import { AIAskSchema } from "@/lib/api/schemas";
import { anthropic, MODEL_HAIKU, extractText } from "@/lib/anthropic";
import { timeAgo } from "@/lib/instant/timeAgo";

/**
 * POST /api/ai/ask
 * Body: { location_id: uuid, question: string }
 * Not cached — questions are unique.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = AIAskSchema.safeParse(body);
  if (!parsed.success)
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join("; "),
      "INVALID_INPUT",
    );

  const { location_id, question } = parsed.data;
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

  const formatted = (instants ?? [])
    .map(
      (i) =>
        `[${i.type}${i.confirm_count ? ` ·${i.confirm_count}✓` : ""}] ${
          i.content ?? "(no text)"
        } (${timeAgo(i.created_at)})`,
    )
    .join("\n");

  try {
    const msg = await anthropic().messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      system: `You are the AI brain of SPLIT PULSE, a live city heat map app.
Answer the user's question about a location based on recent Location Instants.
Be concise and direct. If the data doesn't answer, say so honestly. Max 3-4 sentences.
Location: ${location.name} (${location.type})
Pulse status: ${location.pulse_status} (score: ${location.pulse_score})
Respond in the language of the question (Croatian or English).`,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nRecent Instants:\n${formatted || "(none)"}`,
        },
      ],
    });

    const answer = extractText(msg) || "No answer available.";

    void supabase
      .from("ai_queries")
      .insert({ location_id, query: question, response: answer })
      .then(() => undefined);

    return Response.json({ answer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic error";
    return errorResponse(msg, "UPSTREAM_ERROR");
  }
}
