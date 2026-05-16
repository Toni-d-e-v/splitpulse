import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";
import { anthropic, extractText, MODEL_HAIKU } from "@/lib/anthropic";

const FindObjectSchema = z.object({
  query: z.string().min(2).max(280),
});

interface Candidate {
  name: string;
  slug: string;
  type: string;
  tags: string[];
  pulse_score: number;
  pulse_status: string;
}

function fallbackMatch(query: string, candidates: Candidate[]) {
  const normalized = query.toLowerCase();
  return (
    candidates.find((candidate) =>
      [
        candidate.name,
        candidate.slug,
        candidate.type,
        ...candidate.tags,
      ].some((value) => value.toLowerCase().includes(normalized)),
    ) ?? candidates[0] ?? null
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = FindObjectSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues.map((issue) => issue.message).join("; "),
      "INVALID_INPUT",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations_view")
    .select("name, slug, type, tags, pulse_score, pulse_status")
    .limit(80);

  if (error) return errorResponse(error.message, "INTERNAL");

  const candidates = (data ?? []) as Candidate[];
  if (candidates.length === 0) {
    return errorResponse("No objects available.", "NOT_FOUND");
  }

  try {
    const msg = await anthropic().messages.create({
      model: MODEL_HAIKU,
      max_tokens: 160,
      system: `You help users find one object/place in SPLIT PULSE.
Return only compact JSON: {"slug":"...", "reason":"..."}.
Pick exactly one slug from the provided candidates. Prefer direct name/tag/type matches, then semantically relevant places, then higher pulse_score.
Reason must be short and in the user's language.`,
      messages: [
        {
          role: "user",
          content: `Query: ${parsed.data.query}

Candidates:
${candidates
  .map(
    (candidate) =>
      `- ${candidate.slug}: ${candidate.name} (${candidate.type}; tags: ${candidate.tags.join(", ") || "none"}; pulse: ${candidate.pulse_score}, ${candidate.pulse_status})`,
  )
  .join("\n")}`,
        },
      ],
    });

    const text = extractText(msg);
    const json = JSON.parse(text) as { slug?: string; reason?: string };
    const match =
      candidates.find((candidate) => candidate.slug === json.slug) ??
      fallbackMatch(parsed.data.query, candidates);

    if (!match) return errorResponse("No object matched.", "NOT_FOUND");
    return Response.json({
      slug: match.slug,
      reason: json.reason ?? `Best match: ${match.name}`,
    });
  } catch {
    const match = fallbackMatch(parsed.data.query, candidates);
    if (!match) return errorResponse("No object matched.", "NOT_FOUND");
    return Response.json({
      slug: match.slug,
      reason: `Best local match: ${match.name}`,
    });
  }
}
