/**
 * Compact relative time, English/Croatian-aware ("now", "5m ago", "2h ago", "3d ago").
 */
export function timeAgo(iso: string | Date, locale: "en" | "hr" = "en"): string {
  const ts = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));

  if (diffSec < 30) return locale === "hr" ? "sada" : "now";

  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;

  const d = Math.floor(hr / 24);
  return `${d}d`;
}
