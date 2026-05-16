import type { Instant } from "@/types";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import { timeAgo } from "@/lib/instant/timeAgo";

interface Props {
  instant: Instant;
  locationName?: string;
}

export function InstantCard({ instant, locationName }: Props) {
  const meta = INSTANT_TYPE_META[instant.type];
  const author = instant.is_anonymous
    ? "Anonymous"
    : (instant.profile?.pulse_name ?? "@guest");

  return (
    <article className="instant-card instant-enter overflow-hidden p-0" data-type={instant.type}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[13px] bg-white/[0.04]">
        {instant.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={instant.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-4 text-center"
            style={{
              background:
                "radial-gradient(circle at 45% 30%, rgba(0,212,255,0.22), transparent 45%), rgba(255,255,255,0.04)",
            }}
          >
            <p className="line-clamp-5 text-sm font-semibold leading-snug text-[var(--text-primary)]">
              {instant.content ?? meta.label}
            </p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
        <header className="absolute left-2 right-2 top-2 flex items-center justify-between text-[10px] text-white/80">
          <span className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 backdrop-blur">
          <span aria-hidden>{meta.icon}</span>
            <span className="uppercase tracking-wider">{meta.label}</span>
        </span>
          <time className="rounded-full bg-black/35 px-2 py-1 backdrop-blur" dateTime={instant.created_at}>
            {timeAgo(instant.created_at)}
          </time>
        </header>
        {instant.image_url && instant.content && (
          <p className="absolute bottom-2 left-2 right-2 line-clamp-2 text-xs font-semibold leading-tight text-white">
            {instant.content}
          </p>
        )}
      </div>

      <footer className="flex items-center justify-between px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
        <span>{author}{locationName ? ` · ${locationName}` : ""}</span>
        <span className="flex items-center gap-3">
          {instant.confirm_count > 0 && <span>✓ {instant.confirm_count}</span>}
          {instant.helpful_count > 0 && <span>💡 {instant.helpful_count}</span>}
        </span>
      </footer>
    </article>
  );
}
