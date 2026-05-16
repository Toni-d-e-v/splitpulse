"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import type { InstantType, Location } from "@/types";

const POSTABLE_TYPES: InstantType[] = [
  "photo",
  "text",
  "crowd",
  "question",
  "help",
  "event",
  "recommendation",
  "warning",
];

const POST_RADIUS_METERS = 100;

interface Props {
  locations: Location[];
  initialLocationSlug: string | null;
}

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

export function PostInstantClient({ locations, initialLocationSlug }: Props) {
  const router = useRouter();
  const geo = useGeolocation();

  const [type, setType] = useState<InstantType>("photo");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nearbyLocations = useMemo(() => {
    if (!geo.coords) return [];
    return locations
      .map((location) => ({
        location,
        distance: distanceMeters(geo.coords!, location),
      }))
      .filter((item) => item.distance <= POST_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);
  }, [geo.coords, locations]);

  const requestedNearbyLocation = nearbyLocations.find(
    ({ location }) => location.slug === initialLocationSlug,
  );
  const selectedLocation =
    nearbyLocations.find(({ location }) => location.id === selectedLocationId)
      ?.location ??
    requestedNearbyLocation?.location ??
    nearbyLocations[0]?.location ??
    null;

  const imagePreviewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : null),
    [image],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!geo.coords) {
      setError(geo.error ?? "Waiting for GPS - try again in a sec.");
      return;
    }
    if (!selectedLocation) {
      setError(`You can post only within ${POST_RADIUS_METERS}m of a location.`);
      return;
    }
    if (!content && !image) {
      setError("Add a photo or a quick caption.");
      return;
    }

    setSubmitting(true);

    try {
      // Ensure we have a session — fall back to guest sign-in.
      await fetch("/api/auth/guest", { method: "POST" });

      const fd = new FormData();
      fd.append("type", type);
      if (content) fd.append("content", content);
      fd.append("latitude", String(geo.coords.latitude));
      fd.append("longitude", String(geo.coords.longitude));
      fd.append("location_id", selectedLocation.id);
      if (image) fd.append("image", image);

      const r = await fetch("/api/instants", { method: "POST", body: fd });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Failed to post");

      router.push("/map");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            Live now
          </p>
          <h1 className="text-2xl font-bold leading-tight">New Instant</h1>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-[var(--text-secondary)]"
        >
          Cancel
        </button>
      </header>

      {/* Camera capture (native mobile) */}
      <label className="relative block aspect-[9/12] cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] text-center shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
        {imagePreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreviewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--accent-primary)] text-3xl text-[var(--text-inverse)]">
              📷
            </span>
            <span className="text-lg font-bold">Capture what is happening</span>
            <span className="max-w-56 text-sm text-[var(--text-secondary)]">
              Quick photo first. Caption is optional.
            </span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/45 px-3 py-2 text-sm font-semibold text-white backdrop-blur">
          {image ? image.name : "Tap to open camera"}
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setImage(file);
            if (file) setType("photo");
          }}
        />
      </label>

      {/* Text input */}
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 280))}
          placeholder="Add a quick caption or context..."
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-base outline-none focus:border-[var(--accent-primary)]"
        />
        <div className="mt-1 text-right text-xs text-[var(--text-tertiary)]">
          {content.length}/280
        </div>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-4 gap-2">
        {POSTABLE_TYPES.map((t) => {
          const meta = INSTANT_TYPE_META[t];
          const active = type === t;
          return (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`rounded-xl px-2 py-3 text-xs font-medium transition ${
                active
                  ? "bg-white/20 text-white"
                  : "bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/10"
              }`}
            >
              <div className="text-lg">{meta.icon}</div>
              <div className="mt-1">{meta.label}</div>
            </button>
          );
        })}
      </div>

      {/* GPS status */}
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]">
        <span className="min-w-0 truncate">
          {geo.loading && "Locating..."}
          {geo.error && `GPS: ${geo.error}`}
          {geo.coords &&
            `📍 ${geo.coords.latitude.toFixed(5)}, ${geo.coords.longitude.toFixed(5)} (±${Math.round(geo.coords.accuracy)}m)`}
        </span>
        {!geo.coords && (
          <button
            type="button"
            onClick={() => geo.request()}
            disabled={geo.loading}
            className="shrink-0 rounded-full bg-[var(--accent-primary)] px-3 py-1 text-[11px] font-bold text-[var(--text-inverse)] disabled:opacity-60"
          >
            {geo.loading ? "Retrying…" : "Enable GPS"}
          </button>
        )}
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Posting zone
        </h2>
        {!geo.coords && (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Waiting for GPS to find nearby locations.
          </p>
        )}
        {geo.coords && nearbyLocations.length === 0 && (
          <p className="mt-2 text-sm text-red-300">
            You are not within {POST_RADIUS_METERS}m of any location. You can
            view the map, but you cannot post an Instant here.
          </p>
        )}
        {nearbyLocations.length > 0 && (
          <div className="mt-2 space-y-2">
            {nearbyLocations.map(({ location, distance }) => {
              const active = selectedLocation?.id === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedLocationId(location.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-[var(--accent-primary)] text-[var(--text-inverse)]"
                      : "bg-white/[0.05] text-[var(--text-secondary)] hover:bg-white/10"
                  }`}
                >
                  <span className="font-semibold">{location.name}</span>
                  <span className="ml-2 text-xs opacity-75">
                    {Math.round(distance)}m
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !geo.coords || !selectedLocation}
        className="w-full rounded-full bg-[var(--accent-primary)] py-3 font-bold text-[var(--text-inverse)] disabled:opacity-50"
      >
        {submitting ? "Posting…" : "⚡ Post Instant"}
      </button>
    </form>
  );
}
