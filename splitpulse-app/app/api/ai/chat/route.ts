import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";
import { anthropic, extractText, MODEL_HAIKU } from "@/lib/anthropic";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2_000),
});

const ChatSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

interface Candidate {
  name: string;
  slug: string;
  type: string;
  tags: string[];
  pulse_score: number;
  pulse_status: string;
}

/**
 * POST /api/ai/chat
 * Body: { messages: [{ role, content }, ...] }
 * Returns: { reply: string, slug: string | null }
 *
 * Multi-turn assistant for Split Pulse. Aware of the current location
 * roster. If the assistant identifies a single object the user is asking
 * about, it surfaces its slug so the client can flyTo it on the map.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues.map((issue) => issue.message).join("; "),
      "INVALID_INPUT",
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("locations_view")
    .select("name, slug, type, tags, pulse_score, pulse_status")
    .limit(80);

  const candidates = (data ?? []) as Candidate[];
  const roster = candidates
    .map(
      (c) =>
        `- ${c.slug}: ${c.name} (${c.type}; tags: ${c.tags.join(", ") || "none"}; pulse: ${c.pulse_score}, ${c.pulse_status})`,
    )
    .join("\n");

  try {
    const msg = await anthropic().messages.create({
      model: MODEL_HAIKU,
      max_tokens: 500,
      system: `You are the PULSE assistant — a concise, helpful guide to Split, Croatia, focused on the live objects below.

Roster (slug → name):
${roster || "(empty)"}

Rules:
- Answer the user's question directly. Keep replies under 4 short sentences.
- Match the user's language (Croatian or English).
- If the user asks where to go or about a specific place, end your reply with a single line of compact JSON like {"slug":"riva"} (or {"slug":null} if no single object fits). Do NOT wrap in code fences. The slug must come from the roster.`,
      messages: parsed.data.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = extractText(msg) || "";

    // Extract trailing JSON {"slug":"..."} if present.
    let slug: string | null = null;
    let reply = text.trim();
    const match = reply.match(/\{\s*"slug"\s*:\s*("([^"]*)"|null)\s*\}\s*$/);
    if (match) {
      slug = match[2] ?? null;
      reply = reply.slice(0, match.index).trim();
      if (slug && !candidates.some((c) => c.slug === slug)) {
        slug = null;
      }
    }

    return Response.json({ reply: reply || "No reply.", slug });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic error";
    return errorResponse(msg, "UPSTREAM_ERROR");
  }
}
