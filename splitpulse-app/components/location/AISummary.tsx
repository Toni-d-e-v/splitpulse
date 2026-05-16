"use client";

import { useState } from "react";

export function AISummary({ locationId }: { locationId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: locationId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Summary failed");
      setSummary(json.summary as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (summary) {
    return (
      <div className="glass-panel mt-3 p-4 text-sm leading-snug text-[var(--text-primary)]">
        <div className="mb-1 text-xs uppercase tracking-wider text-[var(--text-tertiary)]">
          AI Summary
        </div>
        {summary}
      </div>
    );
  }

  return (
    <button
      onClick={fetchSummary}
      disabled={loading}
      className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-[var(--accent-primary)] hover:bg-white/[0.08] disabled:opacity-50"
    >
      {loading ? "Generating…" : error ? `Retry — ${error}` : "🤖 Generate AI summary"}
    </button>
  );
}
