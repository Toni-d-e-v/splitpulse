import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";

/**
 * POST /api/auth/guest — anonymous Supabase session.
 *
 * Idempotent: if the caller already has a session, return that user
 * instead of minting a new anonymous identity. Otherwise we'd lose the
 * user's pulse_name + history on every Instant post.
 *
 * Requires "Allow anonymous sign-ins" enabled in Supabase Auth settings.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (existing) {
    return Response.json({ user: existing, reused: true });
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return errorResponse(error.message, "INTERNAL");

  return Response.json({ user: data.user, reused: false });
}
