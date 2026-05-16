import Link from "next/link";

interface Props {
  pulseName: string | null;
  userInitial: string;
}

export function MapHeader({ pulseName, userInitial }: Props) {
  return (
    <header className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-3 px-4 py-2.5 glass-panel-heavy rounded-2xl">
      <div className="flex items-center gap-2.5">
        <span
          className="relative inline-flex h-2 w-2"
          aria-hidden
        >
          <span className="absolute inset-0 rounded-full bg-[var(--pulse-high)] pulse-ring" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--pulse-high)]" />
        </span>
        <span className="text-sm font-bold tracking-tight">
          SPLIT
          <span className="ml-1 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--pulse-rising)] bg-clip-text text-transparent">
            PULSE
          </span>
        </span>
      </div>

      <Link
        href="/login"
        aria-label="Profile"
        className="grid h-9 min-w-9 px-2 place-items-center rounded-full bg-white/10 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-white/20"
      >
        {pulseName ? `@${pulseName}` : userInitial.toUpperCase()}
      </Link>
    </header>
  );
}
