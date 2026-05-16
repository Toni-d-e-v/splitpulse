import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";

/**
 * POST /api/locations/[slug]/pulse — trigger pulse recalculation, return new score.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const supabase = await createClient();

  const { data: location, error: locErr } = await supabase
    .from("locations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (locErr || !location) return errorResponse("Location not found", "NOT_FOUND");

  const { data: score, error } = await supabase.rpc("calculate_pulse_score", {
    loc_id: location.id,
  });

  if (error) return errorResponse(error.message, "INTERNAL");

  return Response.json({ slug, score });
}
