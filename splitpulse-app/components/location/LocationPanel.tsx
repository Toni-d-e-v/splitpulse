"use client";

import { useEffect, useState } from "react";
import { Heart, MapPin, Navigation, Share2, Zap } from "lucide-react";
import type { LocationDetail } from "@/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PulseStatusBadge } from "@/components/location/PulseStatus";
import { useGeolocation } from "@/hooks/useGeolocation";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import { timeAgo } from "@/lib/instant/timeAgo";

interface Props {
  slug: string | null;
  open: boolean;
  favoriteLocationIds?: string[];
  onToggleFavorite?: (locationId: string) => void;
  onOpenInstant: (instantId: string) => void;
  onClose: () => void;
}

const POST_RADIUS_METERS = 100;
type LiveInstant = LocationDetail["active_instants"][number];

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

export function LocationPanel({
  slug,
  open,
  favoriteLocationIds = [],
  onToggleFavorite,
  onOpenInstant,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const geo = useGeolocation();

  useEffect(() => {
    if (!open || !slug) return;
    setDetail((current) => (current?.slug === slug ? current : null));

    let cancelled = false;

    fetch(`/api/locations/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDetail(d as LocationDetail);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  const matchesActiveSlug = detail?.slug === slug;
  const loading = Boolean(open && slug && !matchesActiveSlug);
  const showDetail = Boolean(detail && matchesActiveSlug);
  const distanceFromLocation =
    detail && geo.coords ? distanceMeters(geo.coords, detail) : null;
  const canPost =
    distanceFromLocation !== null && distanceFromLocation <= POST_RADIUS_METERS;
  const isFavorite = detail ? favoriteLocationIds.includes(detail.id) : false;
  const distanceLabel =
    distanceFromLocation === null
      ? "GPS pending"
      : `${Math.round(distanceFromLocation)}m away`;

  return (
    <BottomSheet open={open} onClose={onClose}>
      {loading && (
        <div className="py-8 text-center text-[var(--text-tertiary)]">
          Loading...
        </div>
      )}

      {showDetail && detail && (
        <div className="space-y-4">
          <header className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
                  Object
                </p>
                <h2 className="mt-1 text-2xl font-bold leading-tight text-white">
                  {detail.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                    {detail.type}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                    <MapPin className="h-3 w-3" />
                    {distanceLabel}
                  </span>
                </div>
              </div>
              <button
                aria-label="Favorite"
                onClick={() => onToggleFavorite?.(detail.id)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition ${
                  isFavorite
                    ? "border-white/20 bg-white text-[var(--text-inverse)]"
                    : "border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12]"
                }`}
              >
                <Heart
                  className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`}
                />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric label="Pulse" value={String(detail.pulse_score)} />
              <Metric label="Live" value={String(detail.active_instants.length)} />
              <Metric label="Active" value={String(detail.active_users_count)} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <PulseStatusBadge
                status={detail.pulse_status}
                score={detail.pulse_score}
              />
              {detail.tags.length > 0 && (
                <div className="flex min-w-0 gap-1 overflow-hidden">
                  {detail.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="truncate rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-white/55"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {canPost ? (
              <a
                href={`/instant/new?location=${detail.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] py-3 text-center font-bold text-[var(--text-inverse)]"
              >
                <Zap className="h-4 w-4" />
                Post Instant
              </a>
            ) : distanceFromLocation === null ? (
              <button
                type="button"
                onClick={() => geo.request()}
                disabled={geo.loading || !geo.isSecure}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] py-3 text-center font-bold text-[var(--text-inverse)] disabled:opacity-60"
              >
                <Navigation className="h-4 w-4" />
                {!geo.isSecure
                  ? "HTTPS required"
                  : geo.permission === "denied"
                    ? "GPS blocked"
                    : geo.loading
                      ? "Locating…"
                      : "Enable GPS"}
              </button>
            ) : (
              <button
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.04] py-3 text-center font-bold text-[var(--text-tertiary)]"
              >
                <Navigation className="h-4 w-4" />
                {`${Math.round(distanceFromLocation)}m away`}
              </button>
            )}
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 font-semibold text-white/80">
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>

          <LiveInstantsSection
            instants={detail.active_instants}
            onOpenInstant={onOpenInstant}
          />
        </div>
      )}
    </BottomSheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.055] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function LiveInstantsSection({
  instants,
  onOpenInstant,
}: {
  instants: LiveInstant[];
  onOpenInstant: (instantId: string) => void;
}) {
  const latest = instants[0];
  const rest = instants.slice(1, 7);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Live Instants
          </h3>
          <p className="mt-1 text-xs text-white/45">
            {instants.length > 0
              ? `${instants.length} active right now`
              : "Nothing active at this object"}
          </p>
        </div>
        {latest && (
          <button
            type="button"
            onClick={() => onOpenInstant(latest.id)}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-inverse)]"
          >
            Open instants
          </button>
        )}
      </div>

      {!latest ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white/65">
            No live Instants here right now.
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Be physically nearby to post what is happening.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <LiveInstantHero instant={latest} onOpenInstant={onOpenInstant} />
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {rest.map((instant) => (
                <LiveInstantTile
                  key={instant.id}
                  instant={instant}
                  onOpenInstant={onOpenInstant}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LiveInstantHero({
  instant,
  onOpenInstant,
}: {
  instant: LiveInstant;
  onOpenInstant: (instantId: string) => void;
}) {
  const meta = INSTANT_TYPE_META[instant.type];
  const author = instant.is_anonymous
    ? "Anonymous"
    : (instant.profile?.pulse_name ?? "@guest");

  return (
    <button
      type="button"
      onClick={() => onOpenInstant(instant.id)}
      className="group relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] text-left"
    >
      <div className="relative aspect-[16/10] min-h-48 overflow-hidden">
        {instant.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={instant.image_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <TextInstantBackdrop content={instant.content ?? meta.label} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/25" />
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/85 backdrop-blur">
            <span aria-hidden>{meta.icon}</span>
            <span className="truncate">{meta.label}</span>
          </span>
          <time
            className="shrink-0 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur"
            dateTime={instant.created_at}
          >
            {timeAgo(instant.created_at)}
          </time>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Latest from {author}
          </p>
          <p className="mt-1 line-clamp-2 text-lg font-bold leading-tight text-white">
            {instant.content || meta.label}
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-white/70">
            {instant.confirm_count > 0 && <span>{instant.confirm_count} confirmations</span>}
            {instant.helpful_count > 0 && <span>{instant.helpful_count} helpful</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function LiveInstantTile({
  instant,
  onOpenInstant,
}: {
  instant: LiveInstant;
  onOpenInstant: (instantId: string) => void;
}) {
  const meta = INSTANT_TYPE_META[instant.type];

  return (
    <button
      type="button"
      onClick={() => onOpenInstant(instant.id)}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] text-left"
    >
      <div className="relative aspect-square overflow-hidden">
        {instant.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={instant.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <TextInstantBackdrop content={instant.content ?? meta.label} compact />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15" />
        <div className="absolute bottom-2 left-2 right-2">
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-white/75">
            <span className="truncate">
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </span>
            <time className="shrink-0" dateTime={instant.created_at}>
              {timeAgo(instant.created_at)}
            </time>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-bold leading-tight text-white">
            {instant.content || meta.label}
          </p>
        </div>
      </div>
    </button>
  );
}

function TextInstantBackdrop({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.22),transparent_32%),linear-gradient(135deg,rgba(32,33,36,0.95),rgba(10,10,12,0.96))] p-4 text-center">
      <p
        className={`font-bold leading-tight text-white ${
          compact ? "line-clamp-4 text-xs" : "line-clamp-5 text-xl"
        }`}
      >
        {content}
      </p>
    </div>
  );
}
