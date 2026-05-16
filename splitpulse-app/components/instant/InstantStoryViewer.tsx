"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type { Instant, Location } from "@/types";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import { timeAgo } from "@/lib/instant/timeAgo";

interface Props {
  instants: Instant[];
  locations: Location[];
  initialInstantId: string | null;
  open: boolean;
  onClose: () => void;
}

export function InstantStoryViewer({
  instants,
  locations,
  initialInstantId,
  open,
  onClose,
}: Props) {
  const sortedInstants = useMemo(
    () =>
      [...instants].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [instants],
  );
  const initialIndex = Math.max(
    0,
    sortedInstants.findIndex((instant) => instant.id === initialInstantId),
  );
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const index = Math.min(
    manualIndex ?? initialIndex,
    Math.max(0, sortedInstants.length - 1),
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft")
        setManualIndex((value) => Math.max(0, (value ?? initialIndex) - 1));
      if (event.key === "ArrowRight")
        setManualIndex((value) =>
          Math.min(sortedInstants.length - 1, (value ?? initialIndex) + 1),
        );
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [initialIndex, onClose, open, sortedInstants.length]);

  if (!open || sortedInstants.length === 0) return null;

  const instant = sortedInstants[index];
  const meta = INSTANT_TYPE_META[instant.type];
  const location = locations.find((item) => item.id === instant.location_id);
  const authorName = instant.profile?.pulse_name;
  const author = instant.is_anonymous
    ? "Anonymous"
    : authorName
      ? `@${authorName}`
      : "@pulse";
  const previousDisabled = index === 0;
  const nextDisabled = index === sortedInstants.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-black text-white"
    >
      <div className="mx-auto flex h-dvh max-w-md flex-col">
        <div className="flex gap-1 px-3 pt-[max(12px,env(safe-area-inset-top))]">
          {sortedInstants.map((item, itemIndex) => (
            <span
              key={item.id}
              className={`h-1 flex-1 rounded-full ${
                itemIndex <= index ? "bg-white" : "bg-white/25"
              }`}
            />
          ))}
        </div>

        <header className="absolute left-0 right-0 top-0 z-20 mx-auto flex max-w-md items-center justify-between px-4 pt-8">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-base"
                style={{ background: meta.color }}
              >
                {meta.icon}
              </span>
              <span className="truncate">{author}</span>
              <span className="text-white/50">·</span>
              <time className="text-white/70" dateTime={instant.created_at}>
                {timeAgo(instant.created_at)}
              </time>
            </div>
            {location && (
              <div className="mt-1 flex items-center gap-1 text-xs text-white/70">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{location.name}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {instant.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={instant.image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center px-8 text-center"
              style={{
                background:
                  "radial-gradient(circle at 50% 35%, rgba(0,212,255,0.22), transparent 42%), #0a0a1a",
              }}
            >
              <p className="text-2xl font-semibold leading-tight">
                {instant.content ?? meta.label}
              </p>
            </div>
          )}

          <button
            type="button"
            aria-label="Previous instant"
            disabled={previousDisabled}
            onClick={() => setManualIndex(Math.max(0, index - 1))}
            className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-0"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next instant"
            disabled={nextDisabled}
            onClick={() =>
              setManualIndex(Math.min(sortedInstants.length - 1, index + 1))
            }
            className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-0"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {instant.image_url && instant.content && (
            <div className="absolute bottom-[calc(24px+env(safe-area-inset-bottom))] left-4 right-4 rounded-2xl bg-black/45 p-3 text-sm leading-snug backdrop-blur">
              {instant.content}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
