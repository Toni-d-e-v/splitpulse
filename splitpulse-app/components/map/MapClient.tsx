"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Heart,
  List,
  LogOut,
  Map,
  MapPin,
  Search,
  User,
  X,
} from "lucide-react";
import { useMapStore } from "@/stores/mapStore";
import { LocationPanel } from "@/components/location/LocationPanel";
import { InstantStoryViewer } from "@/components/instant/InstantStoryViewer";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Instant, Location } from "@/types";

const HeatMap = dynamic(() => import("@/components/map/HeatMap"), {
  ssr: false,
  loading: () => <MapLoadingShimmer />,
});

type AppTab = "map" | "objects" | "favorites" | "profile";

const TAB_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Map }> = [
  { id: "map", label: "Map", icon: Map },
  { id: "objects", label: "Objects", icon: List },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "profile", label: "Profile", icon: User },
];

interface Props {
  initialLocations: Location[];
  initialInstants: Instant[];
  focusSlug: string | null;
  pulseName: string | null;
  userInitial: string;
}

function MapLoadingShimmer() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative h-32 w-32">
        <span className="absolute inset-0 rounded-full bg-[var(--accent-primary)]/30 pulse-ring" />
        <span
          className="absolute inset-0 rounded-full bg-[var(--accent-primary)]/40 pulse-ring"
          style={{ animationDelay: "0.6s" }}
        />
        <span
          className="absolute inset-0 rounded-full bg-[var(--accent-primary)]/40 pulse-ring"
          style={{ animationDelay: "1.2s" }}
        />
        <span className="absolute inset-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_24px_var(--accent-primary)]" />
      </div>
    </div>
  );
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function matchesSearch(location: Location, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    location.name,
    location.type,
    location.slug,
    ...(location.tags ?? []),
  ].some((value) => value.toLowerCase().includes(normalized));
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function MapClient({
  initialLocations,
  initialInstants,
  focusSlug,
  pulseName,
  userInitial,
}: Props) {
  const {
    instants,
    locations,
    activeLocationId,
    setInstants,
    setLocations,
    setActiveLocation,
  } = useMapStore();
  const geo = useGeolocation();

  useEffect(() => {
    setLocations(initialLocations);
    setInstants(initialInstants);
  }, [initialLocations, initialInstants, setLocations, setInstants]);

  const [activeTab, setActiveTab] = useState<AppTab>("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSlug, setActiveSlug] = useState<string | null>(focusSlug ?? null);
  const [panelOpen, setPanelOpen] = useState<boolean>(Boolean(focusSlug));
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyInstantId, setStoryInstantId] = useState<string | null>(null);
  const [favoriteLocationIds, setFavoriteLocationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem("splitpulse:favorites");
    return stored ? (JSON.parse(stored) as string[]) : [];
  });

  const toggleFavorite = (locationId: string) => {
    setFavoriteLocationIds((current) => {
      const next = current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId];
      window.localStorage.setItem("splitpulse:favorites", JSON.stringify(next));
      return next;
    });
  };

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(locations.map((location) => location.type).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    return ["all", ...values];
  }, [locations]);

  const categoryLocations = useMemo(
    () =>
      locations.filter((location) => {
        const matchesCategory =
          activeCategory === "all" || location.type === activeCategory;
        return matchesCategory;
      }),
    [activeCategory, locations],
  );

  const mapLocations = useMemo(
    () =>
      categoryLocations.filter((location) =>
        matchesSearch(location, searchQuery),
      ),
    [categoryLocations, searchQuery],
  );

  const instantsForStory = useMemo(() => {
    if (!activeSlug) return [];
    const activeLocation = locations.find(
      (location) => location.slug === activeSlug,
    );
    if (!activeLocation) return [];
    const relatedLocationIds = new Set([
      activeLocation.id,
      ...locations
        .filter((location) => location.parent_id === activeLocation.id)
        .map((location) => location.id),
    ]);
    return instants.filter((instant) =>
      relatedLocationIds.has(instant.location_id),
    );
  }, [activeSlug, instants, locations]);

  const openTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    };
  }, []);

  const openLocation = useCallback(
    (slug: string) => {
      setActiveSlug(slug);
      const loc = locations.find((l) => l.slug === slug);
      if (loc) setActiveLocation(loc.id);

      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }

      setPanelOpen((wasOpen) => {
        if (wasOpen) return true;
        openTimerRef.current = window.setTimeout(() => {
          setPanelOpen(true);
          openTimerRef.current = null;
        }, 900);
        return false;
      });
    },
    [locations, setActiveLocation],
  );

  const openStory = (instantId: string) => {
    setStoryInstantId(instantId);
    setStoryOpen(true);
  };

  return (
    <>
      {activeTab === "map" && (
        <TopSearchBar
          value={searchQuery}
          locations={mapLocations.slice(0, 6)}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery("")}
          onAskAi={async (query) => {
            const response = await fetch("/api/ai/find-object", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query }),
            });
            const json = (await response.json()) as {
              slug?: string;
              reason?: string;
              error?: string;
            };
            if (!response.ok || !json.slug) {
              throw new Error(json.error ?? "No object found.");
            }
            const match = locations.find(
              (location) => location.slug === json.slug,
            );
            if (!match) throw new Error("Matched object is not available.");
            setSearchQuery(match.name);
            openLocation(match.slug);
            return json.reason ?? `Found ${match.name}`;
          }}
          onSelect={(location) => {
            openLocation(location.slug);
          }}
        />
      )}

      {activeTab === "map" && (
        <HeatMap
          instants={instants}
          locations={mapLocations}
          focusSlug={activeSlug ?? focusSlug}
          onZoneClick={openLocation}
        />
      )}

      {activeTab === "objects" && (
        <ObjectsListView
          locations={categoryLocations}
          instants={instants}
          coords={geo.coords}
          onSelect={(location) => openLocation(location.slug)}
        />
      )}

      {activeTab === "favorites" && (
        <FavoritesView
          locations={locations.filter((location) =>
            favoriteLocationIds.includes(location.id),
          )}
          onSelect={(location) => openLocation(location.slug)}
        />
      )}

      {activeTab === "profile" && (
        <ProfileView pulseName={pulseName} userInitial={userInitial} />
      )}

      {(activeTab === "map" || activeTab === "objects") && (
        <ObjectCategoryStrip
          categories={categories}
          activeCategory={activeCategory}
          onChange={setActiveCategory}
        />
      )}

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      <LocationPanel
        slug={activeSlug}
        open={panelOpen}
        favoriteLocationIds={favoriteLocationIds}
        onToggleFavorite={toggleFavorite}
        onOpenInstant={openStory}
        onClose={() => {
          setPanelOpen(false);
          setActiveLocation(null);
        }}
      />
      <InstantStoryViewer
        instants={instantsForStory}
        locations={locations}
        initialInstantId={storyInstantId}
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
      />
      <span hidden>{activeLocationId}</span>
    </>
  );
}

function TopSearchBar({
  value,
  locations,
  onChange,
  onClear,
  onAskAi,
  onSelect,
}: {
  value: string;
  locations: Location[];
  onChange: (value: string) => void;
  onClear: () => void;
  onAskAi: (query: string) => Promise<string>;
  onSelect: (location: Location) => void;
}) {
  const showResults = value.trim().length > 0;
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const askAi = async () => {
    if (value.trim().length < 2 || aiLoading) return;
    setAiLoading(true);
    setAiMessage(null);
    try {
      const message = await onAskAi(value.trim());
      setAiMessage(message);
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "No object found.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="absolute left-3 right-3 top-[max(12px,env(safe-area-inset-top))] z-50">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/55 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <Search className="h-5 w-5 shrink-0 text-white/55" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search places"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/45"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={askAi}
          disabled={value.trim().length < 2 || aiLoading}
          className="grid h-8 min-w-8 place-items-center rounded-full bg-[var(--accent-primary)] text-[var(--text-inverse)] disabled:opacity-40"
          aria-label="Ask AI to find object"
        >
          <Bot className="h-4 w-4" />
        </button>
      </div>

      {showResults && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/75 p-1 backdrop-blur-xl">
          {aiMessage && (
            <div className="mb-1 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70">
              {aiMessage}
            </div>
          )}
          <button
            type="button"
            onClick={askAi}
            disabled={aiLoading}
            className="mb-1 flex w-full items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-left text-sm font-bold text-[var(--text-inverse)] disabled:opacity-60"
          >
            <Bot className="h-4 w-4" />
            {aiLoading ? "Finding..." : `Ask AI: "${value.trim()}"`}
          </button>
          {locations.length === 0 ? (
            <div className="px-3 py-3 text-sm text-white/55">
              No objects found.
            </div>
          ) : (
            locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => onSelect(location)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-white transition hover:bg-white/10"
              >
                <MapPin className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {location.name}
                  </span>
                  <span className="text-xs text-white/50">
                    {titleCase(location.type)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ObjectCategoryStrip({
  categories,
  activeCategory,
  onChange,
}: {
  categories: string[];
  activeCategory: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="absolute bottom-[calc(78px+env(safe-area-inset-bottom))] left-0 right-0 z-40 overflow-hidden">
      <div className="flex gap-2 overflow-x-auto px-3 pb-2">
        {categories.map((category) => {
          const active = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onChange(category)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                active
                  ? "border-white/30 bg-white text-[var(--text-inverse)]"
                  : "border-white/10 bg-black/45 text-white/70 backdrop-blur"
              }`}
            >
              {category === "all" ? "All" : titleCase(category)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/70 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="grid grid-cols-4 gap-1">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition ${
                active ? "bg-white/12 text-white" : "text-white/50"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ObjectsListView({
  locations,
  instants,
  coords,
  onSelect,
}: {
  locations: Location[];
  instants: Instant[];
  coords: { latitude: number; longitude: number; accuracy: number } | null;
  onSelect: (location: Location) => void;
}) {
  const sortedLocations = [...locations].sort((a, b) => {
    if (coords) {
      return distanceMeters(coords, a) - distanceMeters(coords, b);
    }
    if (b.pulse_score !== a.pulse_score) return b.pulse_score - a.pulse_score;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="absolute inset-0 z-20 overflow-y-auto bg-deep px-3 pb-40 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="space-y-2">
        {sortedLocations.map((location) => {
          const count = instants.filter(
            (instant) => instant.location_id === location.id,
          ).length;
          const distance = coords ? distanceMeters(coords, location) : null;
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelect(location)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-white">
                    {location.name}
                  </h2>
                  <p className="mt-1 text-xs text-white/50">
                    {titleCase(location.type)}
                    {location.tags.length > 0
                      ? ` · ${location.tags.slice(0, 2).join(", ")}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white/70">
                  {count} live
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                <span>
                  {distance === null
                    ? `Pulse ${location.pulse_score}`
                    : `${Math.round(distance)}m away`}
                </span>
                <span>{titleCase(location.pulse_status)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FavoritesView({
  locations,
  onSelect,
}: {
  locations: Location[];
  onSelect: (location: Location) => void;
}) {
  if (locations.length > 0) {
    return (
      <section className="absolute inset-0 z-20 overflow-y-auto bg-deep px-3 pb-40 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="space-y-2">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelect(location)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left"
            >
              <span>
                <span className="block text-base font-bold text-white">
                  {location.name}
                </span>
                <span className="text-xs text-white/50">
                  {titleCase(location.type)} · Pulse {location.pulse_score}
                </span>
              </span>
              <Heart className="h-5 w-5 fill-white text-white" />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="absolute inset-0 z-20 flex bg-deep px-5 pb-40 pt-[max(24px,env(safe-area-inset-top))]">
      <div className="m-auto max-w-sm text-center">
        <Heart className="mx-auto h-10 w-10 text-white/35" />
        <h2 className="mt-4 text-xl font-bold text-white">Favorites</h2>
        <p className="mt-2 text-sm leading-snug text-white/55">
          Saved objects will appear here. For now, use the map or object list to
          inspect live places.
        </p>
      </div>
    </section>
  );
}

function ProfileView({
  pulseName,
  userInitial,
}: {
  pulseName: string | null;
  userInitial: string;
}) {
  const router = useRouter();
  const geo = useGeolocation();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("…");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(json?.error ?? "Logout failed");
      }
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
      setSigningOut(false);
    }
  };

  return (
    <section className="absolute inset-0 z-20 bg-deep px-5 pb-40 pt-[max(24px,env(safe-area-inset-top))]">
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/12 text-lg font-bold text-white">
            {pulseName ? pulseName[0]?.toUpperCase() : userInitial.toUpperCase()}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              Profile
            </p>
            <h2 className="text-xl font-bold text-white">
              {pulseName ? `@${pulseName}` : "Guest"}
            </h2>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-black/25 p-3">
            <p className="text-lg font-bold text-white">0</p>
            <p className="text-xs text-white/45">Favorites</p>
          </div>
          <div className="rounded-2xl bg-black/25 p-3">
            <p className="text-lg font-bold text-white">Live</p>
            <p className="text-xs text-white/45">Map access</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/70">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
          GPS diagnostics
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono break-all">
          <dt className="text-white/45">origin</dt>
          <dd>{origin}</dd>
          <dt className="text-white/45">isSecure</dt>
          <dd className={geo.isSecure ? "text-emerald-300" : "text-red-300"}>
            {String(geo.isSecure)}
          </dd>
          <dt className="text-white/45">permission</dt>
          <dd>{geo.permission}</dd>
          <dt className="text-white/45">loading</dt>
          <dd>{String(geo.loading)}</dd>
          <dt className="text-white/45">coords</dt>
          <dd>
            {geo.coords
              ? `${geo.coords.latitude.toFixed(5)}, ${geo.coords.longitude.toFixed(5)} (±${Math.round(geo.coords.accuracy)}m)`
              : "—"}
          </dd>
          <dt className="text-white/45">error</dt>
          <dd className={geo.error ? "text-red-300" : ""}>{geo.error ?? "—"}</dd>
        </dl>
        <button
          type="button"
          onClick={() => geo.request()}
          className="mt-3 w-full rounded-xl bg-[var(--accent-primary)] py-2 text-xs font-bold text-[var(--text-inverse)]"
        >
          {geo.loading ? "Retrying…" : "Re-request GPS"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition active:scale-[0.99] disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out..." : "Logout"}
      </button>

      {error && (
        <p className="mt-2 text-center text-xs text-red-300/80">{error}</p>
      )}
    </section>
  );
}
