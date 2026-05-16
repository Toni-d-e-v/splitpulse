import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";

/**
 * PATCH /api/instants/[id] — mark as resolved.
 * Auth: owner only (enforced by RLS UPDATE policy).
 */
export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Not authenticated", "NO_AUTH");

  const { data, error } = await supabase
    .from("instants")
    .update({ is_resolved: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return errorResponse(error.message, "INTERNAL");
  if (!data) return errorResponse("Not found or not owner", "FORBIDDEN");

  return Response.json({ instant: data });
}
