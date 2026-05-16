import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";

/**
 * POST /api/auth/guest — anonymous Supabase session.
 * Requires "Allow anonymous sign-ins" enabled in Supabase Auth settings.
 */
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) return errorResponse(error.message, "INTERNAL");

  return Response.json({ user: data.user });
}
