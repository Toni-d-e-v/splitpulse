import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { errorResponse } from "@/lib/api/errors";
import { CreateInstantSchema } from "@/lib/api/schemas";
import { calcExpiresAt } from "@/lib/api/expiration";
import { randomUUID } from "node:crypto";
import type { Location } from "@/types";

const POST_RADIUS_METERS = 100;

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

/**
 * GET /api/instants
 * Query: location_id?, type?, limit? (default 50, max 200)
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const locationId = url.searchParams.get("location_id");
  const type = url.searchParams.get("type");
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );

  let query = supabase
    .from("active_instants")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (locationId) query = query.eq("location_id", locationId);
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, "INTERNAL");

  return Response.json({ instants: data ?? [] });
}

/**
 * POST /api/instants
 * Body: JSON OR multipart/form-data (when `image` is present).
 * Auth: required (anonymous Supabase sessions accepted).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return errorResponse("Not authenticated", "NO_AUTH");

  const contentType = req.headers.get("content-type") ?? "";
  let parsed:
    | {
        type: string;
        content?: string;
        latitude: number;
        longitude: number;
        location_id?: string;
        is_anonymous?: boolean;
      }
    | null = null;
  let imageBuffer: ArrayBuffer | null = null;
  let imageMime = "image/jpeg";

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    parsed = {
      type: String(fd.get("type") ?? "text"),
      content: fd.get("content") ? String(fd.get("content")) : undefined,
      latitude: Number(fd.get("latitude")),
      longitude: Number(fd.get("longitude")),
      location_id: fd.get("location_id")
        ? String(fd.get("location_id"))
        : undefined,
      is_anonymous: fd.get("is_anonymous") === "true",
    };
    const img = fd.get("image");
    if (img instanceof File && img.size > 0) {
      imageBuffer = await img.arrayBuffer();
      imageMime = img.type || "image/jpeg";
    }
  } else {
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("Invalid JSON", "INVALID_INPUT");
    parsed = body;
  }

  const validation = CreateInstantSchema.safeParse(parsed);
  if (!validation.success) {
    return errorResponse(
      validation.error.issues.map((i) => i.message).join("; "),
      "INVALID_INPUT",
    );
  }
  const input = validation.data;
  if (!input.content && !imageBuffer) {
    return errorResponse("Add a photo or a quick caption.", "INVALID_INPUT");
  }

  // Resolve and validate zone from submitted GPS. Posting is only allowed
  // within a tight live radius; the map can be viewed from anywhere.
  let locationId = input.location_id;
  let matchedLocation: Location | null = null;

  if (!locationId) {
    const { data: locations, error: locationsErr } = await supabase
      .from("locations_view")
      .select("*");
    if (locationsErr) return errorResponse(locationsErr.message, "INTERNAL");

    const nearest = ((locations ?? []) as Location[])
      .map((location) => ({
        location,
        distance: distanceMeters(input, location),
      }))
      .filter((item) => item.distance <= POST_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nearest)
      return errorResponse(
        `You can post only within ${POST_RADIUS_METERS}m of a location.`,
        "NO_ZONE",
      );
    matchedLocation = nearest.location;
    locationId = matchedLocation.id;
  } else {
    const { data: location, error: locationErr } = await supabase
      .from("locations_view")
      .select("*")
      .eq("id", locationId)
      .single();
    if (locationErr || !location) {
      return errorResponse("Location not found", "NOT_FOUND");
    }
    matchedLocation = location as Location;
    const distance = distanceMeters(input, matchedLocation);
    if (distance > POST_RADIUS_METERS) {
      return errorResponse(
        `You are ${Math.round(distance)}m from ${matchedLocation.name}. Posting is allowed only within ${POST_RADIUS_METERS}m.`,
        "NO_ZONE",
      );
    }
  }

  // Upload image if present (service client bypasses RLS on storage).
  let imageUrl: string | null = null;
  if (imageBuffer) {
    const ext = imageMime.split("/")[1] ?? "jpg";
    const path = `${user.id}/${Date.now()}-${randomUUID()}.${ext}`;
    const service = createServiceClient();
    const { error: upErr } = await service.storage
      .from("instant-photos")
      .upload(path, imageBuffer, { contentType: imageMime, upsert: false });
    if (upErr) return errorResponse(upErr.message, "INTERNAL");
    const { data: pub } = service.storage
      .from("instant-photos")
      .getPublicUrl(path);
    imageUrl = pub.publicUrl;
  }

  const expiresAt = calcExpiresAt(input.type);

  // Insert via raw SQL fragment for GEOGRAPHY column.
  const { data: row, error: insErr } = await supabase
    .from("instants")
    .insert({
      user_id: user.id,
      location_id: locationId,
      type: input.type,
      content: input.content ?? null,
      image_url: imageUrl,
      // Supabase accepts WKT for GEOGRAPHY columns.
      geo: `SRID=4326;POINT(${input.longitude} ${input.latitude})`,
      expires_at: expiresAt.toISOString(),
      is_anonymous: input.is_anonymous ?? false,
    })
    .select("*")
    .single();

  if (insErr) return errorResponse(insErr.message, "INTERNAL");

  // Fire-and-forget pulse recalc.
  void supabase
    .rpc("calculate_pulse_score", { loc_id: locationId })
    .then(() => undefined);

  return Response.json(
    { instant: { ...row, latitude: input.latitude, longitude: input.longitude } },
    { status: 201 },
  );
}
