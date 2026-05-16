import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/errors";

/**
 * GET /api/locations — list all locations with current pulse data + lat/lng.
 * Reads from the `locations_view` SQL view (extracts coords from GEOGRAPHY).
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations_view")
    .select("*")
    .order("pulse_score", { ascending: false });

  if (error) return errorResponse(error.message, "INTERNAL");

  return Response.json({ locations: data ?? [] });
}
