import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";

/**
 * POST /api/auth/logout — clear the current Supabase session cookie.
 */
export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) return errorResponse(error.message, "INTERNAL");

  return Response.json({ ok: true });
}
