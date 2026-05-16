import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";
import { PulseNameSchema } from "@/lib/api/schemas";

/**
 * POST /api/auth/pulse-name — set the current user's pulse_name.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Not authenticated", "NO_AUTH");

  const body = await req.json().catch(() => null);
  const parsed = PulseNameSchema.safeParse(body);
  if (!parsed.success)
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join("; "),
      "INVALID_INPUT",
    );

  // Profile row is bootstrapped by the on_auth_user_created trigger, so an
  // UPDATE is sufficient — keeps us aligned with the "Users update own
  // profile" RLS policy. Fall back to insert via service role if the row
  // is somehow missing.
  let { error } = await supabase
    .from("profiles")
    .update({ pulse_name: parsed.data.pulse_name })
    .eq("id", user.id);

  if (!error) {
    return Response.json({ pulse_name: parsed.data.pulse_name });
  }

  if (error.code === "23505")
    return errorResponse("Pulse name already taken", "DUP_NAME");

  if (error.code === "PGRST116") {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const service = createServiceClient();
    const { error: insertError } = await service
      .from("profiles")
      .insert({ id: user.id, pulse_name: parsed.data.pulse_name });
    if (insertError?.code === "23505")
      return errorResponse("Pulse name already taken", "DUP_NAME");
    if (insertError) return errorResponse(insertError.message, "INTERNAL");
    return Response.json({ pulse_name: parsed.data.pulse_name });
  }

  return errorResponse(error.message, "INTERNAL");
}
