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

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, pulse_name: parsed.data.pulse_name });

  if (error?.code === "23505")
    return errorResponse("Pulse name already taken", "DUP_NAME");
  if (error) return errorResponse(error.message, "INTERNAL");

  return Response.json({ pulse_name: parsed.data.pulse_name });
}
