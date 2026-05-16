import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";
import { attachProfiles } from "@/lib/instant/attachProfiles";
import type { Instant } from "@/types";

/**
 * GET /api/locations/[slug] — detail + active instants (no AI summary; fetch separately).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const supabase = await createClient();

  const { data: location, error } = await supabase
    .from("locations_view")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !location) return errorResponse("Location not found", "NOT_FOUND");

  const { data: instants } = await supabase
    .from("active_instants")
    .select("*")
    .eq("location_id", location.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const instantsWithProfiles = await attachProfiles(
    supabase,
    (instants ?? []) as Instant[],
  );

  // Active distinct users in this zone in last 30 min (rough heuristic).
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: activeUsers } = await supabase
    .from("instants")
    .select("user_id")
    .eq("location_id", location.id)
    .gte("created_at", since)
    .not("user_id", "is", null);

  const activeUserSet = new Set((activeUsers ?? []).map((r) => r.user_id));

  return Response.json({
    ...location,
    active_instants: instantsWithProfiles,
    active_users_count: activeUserSet.size,
  });
}
