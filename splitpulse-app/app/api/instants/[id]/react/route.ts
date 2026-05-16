import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";
import { ReactionSchema } from "@/lib/api/schemas";

/**
 * POST /api/instants/[id]/react — confirm | helpful | answer.
 * Trigger `on_reaction_inserted` bumps confirm_count/helpful_count on the parent Instant.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: instantId } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Not authenticated", "NO_AUTH");

  const body = await req.json().catch(() => null);
  const parsed = ReactionSchema.safeParse(body);
  if (!parsed.success)
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join("; "),
      "INVALID_INPUT",
    );

  const { data, error } = await supabase
    .from("instant_reactions")
    .insert({
      instant_id: instantId,
      user_id: user.id,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
    })
    .select("*")
    .single();

  // 23505 = unique violation (already reacted with this type)
  if (error?.code === "23505")
    return errorResponse("Already reacted", "FORBIDDEN", 409);
  if (error) return errorResponse(error.message, "INTERNAL");

  // If this is an answer to a question, optionally mark the question resolved.
  if (parsed.data.type === "answer") {
    void supabase
      .from("instants")
      .update({ is_resolved: true })
      .eq("id", instantId)
      .eq("type", "question")
      .then(() => undefined);
  }

  return Response.json({ reaction: data }, { status: 201 });
}
