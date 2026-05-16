import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/recalc — recompute pulse score for all non-quiet zones.
 * Triggered every 2 min by Vercel Cron (see vercel.json).
 * Protected by Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const supabase = createServiceClient();
  const { data: zones, error } = await supabase
    .from("locations")
    .select("id")
    .neq("pulse_status", "quiet");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  let count = 0;
  for (const z of zones ?? []) {
    await supabase.rpc("calculate_pulse_score", { loc_id: z.id });
    count++;
  }

  return Response.json({ updated: count });
}
