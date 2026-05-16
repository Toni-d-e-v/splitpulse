import type { SupabaseClient } from "@supabase/supabase-js";
import type { Instant } from "@/types";

/**
 * The active_instants view doesn't embed the author profile, so we
 * batch-fetch profiles for the unique user_ids and stitch them onto
 * each instant. Returns a new array; the input is not mutated.
 */
export async function attachProfiles(
  supabase: SupabaseClient,
  instants: Instant[],
): Promise<Instant[]> {
  const userIds = Array.from(
    new Set(
      instants
        .map((instant) => instant.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (userIds.length === 0) return instants;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, pulse_name, avatar_url")
    .in("id", userIds);

  const byId = new Map<string, { pulse_name: string | null; avatar_url: string | null }>(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      {
        pulse_name: profile.pulse_name as string | null,
        avatar_url: profile.avatar_url as string | null,
      },
    ]),
  );

  return instants.map((instant) => ({
    ...instant,
    profile: instant.user_id ? byId.get(instant.user_id) ?? undefined : undefined,
  }));
}
