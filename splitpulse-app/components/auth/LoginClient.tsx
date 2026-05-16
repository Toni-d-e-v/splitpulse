"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/map";

  const [pulseName, setPulseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = pulseName.trim().replace(/^@/, "");
    if (!name) {
      setError("Pulse name is required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const guestRes = await fetch("/api/auth/guest", { method: "POST" });
      if (!guestRes.ok) {
        const json = (await guestRes.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(json?.error ?? "Guest sign-in failed");
      }

      const nameRes = await fetch("/api/auth/pulse-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pulse_name: name }),
      });
      if (!nameRes.ok) {
        const json = (await nameRes.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(json?.error ?? "Pulse name failed");
      }

      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <header className="mb-6">
        <h1 className="text-3xl font-bold leading-none tracking-tight text-white">
          Pulse
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Pick a name to enter.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="rounded-3xl border border-white/10 bg-black/40 p-5"
      >
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
            Pulse name
          </span>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-white/40">
              @
            </span>
            <input
              value={pulseName}
              onChange={(e) => setPulseName(e.target.value.replace(/^@/, ""))}
              placeholder="petar"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-9 pr-3 text-base font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-white/30 focus:border-white/30 focus:bg-white/[0.07]"
            />
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            Required. Anonymous session anchored to this name.
          </p>
        </label>

        <button
          type="submit"
          disabled={loading || !pulseName.trim()}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-white py-3 text-sm font-bold text-black transition active:scale-[0.98] disabled:bg-white/10 disabled:text-white/40"
        >
          {loading ? "Entering…" : "Enter"}
        </button>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-snug text-red-300">
            {error}
          </div>
        )}
      </form>

      <p className="mt-4 text-center text-[10px] uppercase tracking-[0.24em] text-white/35">
        Hackathon demo · No password, no email
      </p>
    </div>
  );
}
