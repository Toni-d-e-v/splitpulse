"use client";

import { Camera, MapPin } from "lucide-react";
import type { Instant, Location } from "@/types";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import { timeAgo } from "@/lib/instant/timeAgo";

interface Props {
  instants: Instant[];
  locations: Location[];
  onOpenInstant: (instantId: string) => void;
}

export function InstantPreviewTray({
  instants,
  locations,
  onOpenInstant,
}: Props) {
  const sortedInstants = [...instants]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 12);

  if (sortedInstants.length === 0) {
    return (
      <div className="pointer-events-none absolute bottom-28 left-3 right-3 z-30">
        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-center text-xs text-white/60 backdrop-blur">
          No live Instants nearby yet.
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-24 left-0 right-0 z-30 overflow-hidden">
      <div className="flex gap-3 overflow-x-auto px-3 pb-2">
        {sortedInstants.map((instant) => {
          const meta = INSTANT_TYPE_META[instant.type];
          const location = locations.find((item) => item.id === instant.location_id);
          return (
            <button
              key={instant.id}
              type="button"
              onClick={() => onOpenInstant(instant.id)}
              className="relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-left shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
            >
              {instant.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={instant.image_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at 45% 30%, rgba(0,212,255,0.28), transparent 44%), rgba(255,255,255,0.06)",
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20" />
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                {instant.image_url ? <Camera className="h-3 w-3" /> : meta.icon}
                {meta.label}
              </div>
              <div className="absolute bottom-2 left-2 right-2">
                <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">
                  {instant.content ?? "Live moment"}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{location?.name ?? "Split"}</span>
                  <span>·</span>
                  <span>{timeAgo(instant.created_at)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
