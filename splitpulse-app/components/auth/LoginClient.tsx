"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/map";

  const [pulseName, setPulseName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    router.push(next);
    router.refresh();
  };

  const guest = async () => {
    setError(null);
    setLoading("guest");
    try {
      const r = await fetch("/api/auth/guest", { method: "POST" });
      if (!r.ok)
        throw new Error((await r.json()).error ?? "Guest sign-in failed");
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(null);
    }
  };

  const setName = async () => {
    const name = pulseName.trim().replace(/^@/, "");
    if (!name) return;
    setError(null);
    setLoading("name");
    try {
      await fetch("/api/auth/guest", { method: "POST" });
      const r = await fetch("/api/auth/pulse-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pulse_name: name }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Pulse name failed");
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(null);
    }
  };

  const google = async () => {
    setError(null);
    setLoading("google");
    try {
      const supabase = createClient();
      const { data, error: gErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (gErr) throw new Error(gErr.message);
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(null);
    }
  };

  return (
    <div className="relative w-full max-w-sm">
      {/* Ambient glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-12 -z-10 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.18),transparent_60%)] blur-2xl"
      />

      <div className="glass-panel-heavy p-7 space-y-5">
        <header className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full bg-[var(--pulse-high)]"
              style={{ boxShadow: "0 0 16px var(--pulse-high)" }}
            />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-tertiary)]">
              Split · Live
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-none">
            SPLIT
            <span className="ml-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--pulse-rising)] bg-clip-text text-transparent">
              PULSE
            </span>
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-snug">
            A live heat map of the city
            <br />
            powered by GPS Instants.
          </p>
        </header>

        <button
          onClick={guest}
          disabled={loading !== null}
          className="w-full rounded-2xl bg-[var(--accent-primary)] py-3 text-sm font-bold text-[var(--text-inverse)] shadow-[0_0_24px_rgba(0,212,255,0.35)] transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading === "guest" ? "Connecting…" : "⚡ Continue as Guest"}
        </button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
          <span className="h-px flex-1 bg-white/10" />
          or pick a name
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
              @
            </span>
            <input
              value={pulseName}
              onChange={(e) => setPulseName(e.target.value.replace(/^@/, ""))}
              placeholder="petar"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-7 pr-3 text-sm outline-none transition focus:border-[var(--accent-primary)] focus:bg-white/[0.07]"
              onKeyDown={(e) => e.key === "Enter" && setName()}
            />
          </div>
          <button
            onClick={setName}
            disabled={loading !== null || !pulseName.trim()}
            className="rounded-2xl bg-white/10 px-5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-40"
          >
            {loading === "name" ? "…" : "Go"}
          </button>
        </div>

        <button
          onClick={google}
          disabled={loading !== null}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-sm font-medium text-[var(--text-primary)] transition hover:bg-white/[0.08] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              fill="#fff"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
            />
            <path
              fill="#fff"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              opacity="0.85"
            />
            <path
              fill="#fff"
              d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
              opacity="0.7"
            />
            <path
              fill="#fff"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
              opacity="0.6"
            />
          </svg>
          {loading === "google" ? "Opening…" : "Continue with Google"}
        </button>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-snug text-red-300">
            {error}
          </div>
        )}

        <p className="text-center text-[10px] text-[var(--text-tertiary)]">
          By continuing you agree this is a hackathon demo.
        </p>
      </div>
    </div>
  );
}
