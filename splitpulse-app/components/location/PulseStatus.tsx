import type { PulseStatus as Status } from "@/types";

const LABELS: Record<Status, string> = {
  quiet: "Quiet",
  active: "Active",
  rising: "Rising",
  trending: "Trending",
  high_pulse: "High Pulse",
  live_event: "Live Event",
};

const ICONS: Record<Status, string> = {
  quiet: "·",
  active: "◉",
  rising: "↑",
  trending: "🔥",
  high_pulse: "🔥",
  live_event: "✦",
};

export function PulseStatusBadge({
  status,
  score,
  className = "",
}: {
  status: Status;
  score?: number;
  className?: string;
}) {
  return (
    <span
      className={`pulse-badge ${status === "trending" ? "badge-trending" : ""} ${className}`}
      data-status={status}
    >
      <span aria-hidden>{ICONS[status]}</span>
      {LABELS[status]}
      {typeof score === "number" && ` · ${score}`}
    </span>
  );
}
