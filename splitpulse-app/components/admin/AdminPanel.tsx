"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Clock,
  Lock,
  MessageSquareReply,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type { Instant, InstantType, Location } from "@/types";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import { timeAgo } from "@/lib/instant/timeAgo";

interface Props {
  instants: Instant[];
  locations: Location[];
}

const ALL_TYPES: InstantType[] = [
  "photo",
  "text",
  "crowd",
  "question",
  "help",
  "event",
  "recommendation",
  "warning",
];

type StatusFilter = "all" | "active" | "expired" | "resolved";

export function AdminPanel({ instants: initialInstants, locations }: Props) {
  const router = useRouter();
  const [instants, setInstants] = useState<Instant[]>(initialInstants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    content: string;
    type: InstantType;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    locations[0]?.id ?? null,
  );

  const now = Date.now();

  const locationsById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return instants.filter((instant) => {
      if (statusFilter === "resolved" && !instant.is_resolved) return false;
      if (
        statusFilter === "active" &&
        (instant.is_resolved || new Date(instant.expires_at).getTime() <= now)
      )
        return false;
      if (
        statusFilter === "expired" &&
        new Date(instant.expires_at).getTime() > now
      )
        return false;

      if (!term) return true;
      const haystack = [
        instant.content ?? "",
        locationsById.get(instant.location_id)?.name ?? "",
        instant.type,
        instant.id,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [instants, search, statusFilter, now, locationsById]);

  const instantsByLocation = useMemo(() => {
    const grouped = new Map<string, Instant[]>();
    for (const instant of instants) {
      const list = grouped.get(instant.location_id) ?? [];
      list.push(instant);
      grouped.set(instant.location_id, list);
    }
    return grouped;
  }, [instants]);

  const selectedLocation = selectedLocationId
    ? locationsById.get(selectedLocationId) ?? null
    : null;
  const selectedLocationInstants = selectedLocationId
    ? instantsByLocation.get(selectedLocationId) ?? []
    : [];

  function startEdit(instant: Instant) {
    setEditingId(instant.id);
    setEditDraft({ content: instant.content ?? "", type: instant.type });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function patchInstant(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/instants/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Failed");
      const updated = json.instant as Record<string, unknown>;
      setInstants((current) =>
        current.map((instant) =>
          instant.id === id
            ? {
                ...instant,
                content: (updated.content as string | null) ?? null,
                type: updated.type as InstantType,
                is_resolved: Boolean(updated.is_resolved),
                is_anonymous: Boolean(updated.is_anonymous),
                expires_at: updated.expires_at as string,
                image_url: (updated.image_url as string | null) ?? null,
              }
            : instant,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingId(null);
    }
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    await patchInstant(id, {
      content: editDraft.content.trim() || null,
      type: editDraft.type,
    });
    setEditingId(null);
    setEditDraft(null);
  }

  async function deleteInstant(id: string) {
    if (!confirm("Delete this Instant? This cannot be undone.")) return;
    setSavingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/instants/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const json = await r.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to delete");
      }
      setInstants((current) => current.filter((instant) => instant.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingId(null);
    }
  }

  async function extendExpiry(id: string, hours: number) {
    const newExpiry = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await patchInstant(id, { expires_at: newExpiry });
  }

  return (
    <div className="min-h-dvh bg-[#0a0a1a] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-primary)] text-[var(--text-inverse)]">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight">
                PULSE Admin
              </h1>
              <p className="text-[11px] text-white/50">
                Hackathon mode · no auth · service-role writes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>{instants.length} Instants</span>
            <span className="text-white/20">·</span>
            <span>{locations.length} Locations</span>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="ml-3 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0 border-r border-white/10 px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Instants</h2>
              <p className="text-xs text-white/50">
                Edit content, change type, resolve, extend expiry or delete.
              </p>
            </div>
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by content, location, type, id…"
                className="w-full rounded-full border border-white/10 bg-white/[0.05] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30 focus:bg-white/[0.08]"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", "active", "expired", "resolved"] as StatusFilter[]).map(
              (status) => {
                const active = statusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                      active
                        ? "bg-white text-black"
                        : "border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10"
                    }`}
                  >
                    {status}
                  </button>
                );
              },
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {filtered.length === 0 && (
              <li className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
                No Instants match the current filter.
              </li>
            )}
            {filtered.map((instant) => {
              const meta = INSTANT_TYPE_META[instant.type];
              const location = locationsById.get(instant.location_id);
              const expiresAt = new Date(instant.expires_at).getTime();
              const expired = expiresAt <= now;
              const isEditing = editingId === instant.id;
              const isSaving = savingId === instant.id;
              return (
                <li
                  key={instant.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.05]">
                      {instant.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={instant.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="grid h-full w-full place-items-center text-2xl"
                          style={{ background: meta.color }}
                        >
                          {meta.icon}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-bold uppercase tracking-wider">
                          {meta.icon} {meta.label}
                        </span>
                        {location && (
                          <span className="truncate">· {location.name}</span>
                        )}
                        <span>· {timeAgo(instant.created_at)}</span>
                        {instant.is_resolved && (
                          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-bold text-emerald-300">
                            Resolved
                          </span>
                        )}
                        {expired && !instant.is_resolved && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 font-bold text-white/60">
                            Expired
                          </span>
                        )}
                        {instant.is_anonymous && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/55">
                            anon
                          </span>
                        )}
                      </div>

                      {isEditing && editDraft ? (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_TYPES.map((t) => {
                              const m = INSTANT_TYPE_META[t];
                              const active = editDraft.type === t;
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() =>
                                    setEditDraft({ ...editDraft, type: t })
                                  }
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                    active
                                      ? "bg-white text-black"
                                      : "border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10"
                                  }`}
                                >
                                  {m.icon} {m.label}
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            value={editDraft.content}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                content: e.target.value.slice(0, 280),
                              })
                            }
                            rows={3}
                            placeholder="Caption (optional)"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => saveEdit(instant.id)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-[var(--text-inverse)] transition disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/10"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1.5 line-clamp-3 text-sm text-white/85">
                          {instant.content || (
                            <span className="text-white/40">
                              (no caption — photo-only)
                            </span>
                          )}
                        </p>
                      )}

                      {!isEditing && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => startEdit(instant)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              patchInstant(instant.id, {
                                is_resolved: !instant.is_resolved,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" />
                            {instant.is_resolved ? "Unresolve" : "Resolve"}
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => extendExpiry(instant.id, 24)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            <Clock className="h-3 w-3" /> +24h
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => deleteInstant(instant.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                          <span className="ml-auto text-[10px] text-white/35">
                            #{instant.id.slice(0, 8)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="bg-black/30 px-5 py-5 lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:overflow-y-auto">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/55">
            <Building2 className="h-4 w-4" />
            Owner simulator
          </div>
          <p className="mt-1 text-[11px] leading-snug text-white/45">
            Preview how object owners will manage their location feed. Reply &
            moderation tools are coming soon — for now this just shows the
            owner&rsquo;s view.
          </p>

          <div className="mt-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              Object
            </label>
            <select
              value={selectedLocationId ?? ""}
              onChange={(e) => setSelectedLocationId(e.target.value || null)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
            >
              {locations.length === 0 && <option value="">No locations</option>}
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          {selectedLocation && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedLocation.name}
                  </h3>
                  <p className="text-[11px] capitalize text-white/55">
                    {selectedLocation.type} ·{" "}
                    <span className="capitalize">
                      {selectedLocation.pulse_status.replace("_", " ")}
                    </span>{" "}
                    · pulse {selectedLocation.pulse_score}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/65">
                  Owner view
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/55">
                  <Lock className="h-3 w-3" />
                  Coming soon
                </div>
                <p className="mt-1 text-[11px] leading-snug text-white/55">
                  Owners će moći uređivati Instante za svoje objekte i
                  odgovarati u realnom vremenu. Trenutno je ovo samo
                  simulacija — odgovori se još ne spremaju.
                </p>
              </div>

              <ul className="mt-3 space-y-2">
                {selectedLocationInstants.length === 0 && (
                  <li className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/40">
                    No Instants yet for this object.
                  </li>
                )}
                {selectedLocationInstants.slice(0, 25).map((instant) => (
                  <OwnerInstantRow key={instant.id} instant={instant} />
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function OwnerInstantRow({ instant }: { instant: Instant }) {
  const meta = INSTANT_TYPE_META[instant.type];
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <li className="rounded-xl border border-white/10 bg-black/40 p-2.5">
      <div className="flex items-start gap-2.5">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
          {instant.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={instant.image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="grid h-full w-full place-items-center text-base"
              style={{ background: meta.color }}
            >
              {meta.icon}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <span className="font-bold uppercase tracking-wider">
              {meta.label}
            </span>
            <span>· {timeAgo(instant.created_at)}</span>
            {instant.is_resolved && (
              <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                Resolved
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/85">
            {instant.content || (
              <span className="text-white/40">(photo-only)</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/[0.04] p-1.5">
        <MessageSquareReply className="ml-1 h-3.5 w-3.5 shrink-0 text-white/40" />
        <input
          value={reply}
          onChange={(e) => {
            setReply(e.target.value);
            setSent(false);
          }}
          placeholder="Reply as owner (preview)…"
          className="min-w-0 flex-1 bg-transparent px-1 py-1 text-xs text-white outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => {
            if (!reply.trim()) return;
            setSent(true);
            setReply("");
          }}
          className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/65 transition hover:bg-white/15"
          title="Owner replies will be saved once this ships"
        >
          <Send className="h-3 w-3" />
          Send
        </button>
      </div>
      {sent && (
        <p className="mt-1 text-[10px] text-white/45">
          Saved locally — owner reply API not live yet.
        </p>
      )}
    </li>
  );
}
