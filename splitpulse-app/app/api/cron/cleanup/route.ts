import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/cleanup — delete Instants past their expiry + 1h.
 * Triggered hourly by Vercel Cron (see vercel.json).
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const supabase = createServiceClient();
  const { error } = await supabase.rpc("cleanup_expired_instants");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
