"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Crosshair,
  Flame,
  Heart,
  List,
  LogOut,
  Map as MapIcon,
  MapPin,
  Search,
  User,
  X,
} from "lucide-react";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import { useMapStore } from "@/stores/mapStore";
import { LocationPanel } from "@/components/location/LocationPanel";
import { InstantStoryViewer } from "@/components/instant/InstantStoryViewer";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Instant, Location } from "@/types";

const HeatMap = dynamic(() => import("@/components/map/HeatMap"), {
  ssr: false,
  loading: () => <MapLoadingShimmer />,
});

type AppTab = "map" | "objects" | "trending" | "profile";

const TAB_ITEMS: Array<{ id: AppTab; label: string; icon: typeof MapIcon }> = [
  { id: "map", label: "Map", icon: MapIcon },
  { id: "objects", label: "Objects", icon: List },
  { id: "trending", label: "Trending", icon: Flame },
  { id: "profile", label: "Profile", icon: User },
];

interface Props {
  initialLocations: Location[];
  initialInstants: Instant[];
  focusSlug: string | null;
  pulseName: string | null;
  userInitial: string;
  memberSince: string | null;
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
  memberSince,
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
  const [flyToUserToken, setFlyToUserToken] = useState<number | null>(null);
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
        <UserChip
          pulseName={pulseName}
          userInitial={userInitial}
          onClick={() => setActiveTab("profile")}
        />
      )}

      {activeTab === "map" && (
        <TopSearchBar
          value={searchQuery}
          locations={mapLocations.slice(0, 6)}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery("")}
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
          flyToUserToken={flyToUserToken}
          onZoneClick={openLocation}
        />
      )}

      {activeTab === "map" && (
        <MyLocationFab
          isReady={Boolean(geo.coords)}
          loading={geo.loading}
          onClick={() => {
            if (!geo.coords) {
              geo.request();
              return;
            }
            setFlyToUserToken(Date.now());
          }}
        />
      )}

      {activeTab === "objects" && (
        <ObjectsListView
          locations={categoryLocations}
          instants={instants}
          coords={geo.coords}
          favoriteLocationIds={favoriteLocationIds}
          onToggleFavorite={toggleFavorite}
          onSelect={(location) => openLocation(location.slug)}
        />
      )}

      {activeTab === "trending" && (
        <TrendingView
          instants={instants}
          locations={locations}
          onSelectInstant={(slug, instantId) => {
            setActiveTab("map");
            openLocation(slug);
            // Let the map fly and the location panel slide up first,
            // then open the story focused on the chosen Instant.
            window.setTimeout(() => openStory(instantId), 1100);
          }}
        />
      )}

      {activeTab === "profile" && (
        <ProfileView
          pulseName={pulseName}
          userInitial={userInitial}
          memberSince={memberSince}
          favoritesCount={favoriteLocationIds.length}
          objectsCount={locations.length}
          liveInstantsCount={instants.length}
        />
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
  onSelect,
}: {
  value: string;
  locations: Location[];
  onChange: (value: string) => void;
  onClear: () => void;
  onSelect: (location: Location) => void;
}) {
  const router = useRouter();
  const showResults = value.trim().length > 0;

  const openChat = () => {
    const q = value.trim();
    router.push(q ? `/chat?q=${encodeURIComponent(q)}` : "/chat");
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
          onClick={openChat}
          className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent-primary)] px-3 text-xs font-bold text-[var(--text-inverse)]"
          aria-label="Ask Pulse AI"
        >
          <Bot className="h-4 w-4" />
          Ask AI
        </button>
      </div>

      {showResults && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/75 p-1 backdrop-blur-xl">
          <button
            type="button"
            onClick={openChat}
            className="mb-1 flex w-full items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-left text-sm font-bold text-[var(--text-inverse)]"
          >
            <Bot className="h-4 w-4" />
            <span className="min-w-0 truncate">
              Ask Pulse AI: &ldquo;{value.trim()}&rdquo;
            </span>
          </button>
          {locations.length === 0 ? (
            <div className="px-3 py-3 text-sm text-white/55">
              No direct match. Ask Pulse AI to find it.
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

const PULSE_DOT: Record<string, string> = {
  high_pulse: "#ff4444",
  trending: "#ffb800",
  rising: "#00e88f",
  active: "#00d4ff",
  live_event: "#c840ff",
  quiet: "#4a5568",
};

function ObjectsListView({
  locations,
  instants,
  coords,
  favoriteLocationIds,
  onToggleFavorite,
  onSelect,
}: {
  locations: Location[];
  instants: Instant[];
  coords: { latitude: number; longitude: number; accuracy: number } | null;
  favoriteLocationIds: string[];
  onToggleFavorite: (locationId: string) => void;
  onSelect: (location: Location) => void;
}) {
  const [filter, setFilter] = useState<"all" | "favorites">("all");

  const filteredLocations =
    filter === "favorites"
      ? locations.filter((location) => favoriteLocationIds.includes(location.id))
      : locations;

  const sortedLocations = [...filteredLocations].sort((a, b) => {
    if (coords) {
      return distanceMeters(coords, a) - distanceMeters(coords, b);
    }
    if (b.pulse_score !== a.pulse_score) return b.pulse_score - a.pulse_score;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="absolute inset-0 z-20 overflow-y-auto bg-deep px-3 pb-40 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="mb-3 px-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
          {filter === "favorites"
            ? "Saved"
            : coords
              ? "Nearby first"
              : "By pulse"}
        </p>
        <h2 className="text-xl font-bold text-white">
          {sortedLocations.length}
          {" "}
          {filter === "favorites" ? "favorite" : "object"}
          {sortedLocations.length === 1 ? "" : "s"}
        </h2>
      </div>

      <div className="mb-3 flex gap-2 px-2">
        <SegmentedButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
          icon={<List className="h-3.5 w-3.5" />}
        >
          All
        </SegmentedButton>
        <SegmentedButton
          active={filter === "favorites"}
          onClick={() => setFilter("favorites")}
          icon={
            <Heart
              className={`h-3.5 w-3.5 ${filter === "favorites" ? "fill-current" : ""}`}
            />
          }
        >
          Favorites
          {favoriteLocationIds.length > 0 && (
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === "favorites" ? "bg-black/15" : "bg-white/15"}`}
            >
              {favoriteLocationIds.length}
            </span>
          )}
        </SegmentedButton>
      </div>
      <div className="space-y-2">
        {sortedLocations.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-6 text-center text-sm text-white/55">
            {filter === "favorites"
              ? "No favorites yet. Tap the heart on any object to save it."
              : "No objects in this category."}
          </p>
        )}
        {sortedLocations.map((location) => {
          const count = instants.filter(
            (instant) => instant.location_id === location.id,
          ).length;
          const distance = coords ? distanceMeters(coords, location) : null;
          const isFavorite = favoriteLocationIds.includes(location.id);
          const dot = PULSE_DOT[location.pulse_status] ?? PULSE_DOT.quiet;
          return (
            <div
              key={location.id}
              className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition active:scale-[0.99]"
            >
              <button
                type="button"
                onClick={() => onSelect(location)}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: dot,
                          boxShadow: `0 0 8px ${dot}`,
                        }}
                      />
                      <h3 className="truncate text-base font-bold text-white">
                        {location.name}
                      </h3>
                    </div>
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
              <button
                type="button"
                aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(location.id);
                }}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                  isFavorite
                    ? "bg-white text-[var(--text-inverse)]"
                    : "bg-white/[0.06] text-white/75 hover:bg-white/[0.12]"
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
                />
                {isFavorite ? "Saved" : "Save"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SegmentedButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-white text-[var(--text-inverse)]"
          : "border border-white/10 bg-white/[0.04] text-white/65"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function timeAgoCompact(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function expiresInCompact(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function TrendingView({
  instants,
  locations,
  onSelectInstant,
}: {
  instants: Instant[];
  locations: Location[];
  onSelectInstant: (locationSlug: string, instantId: string) => void;
}) {
  const locationsById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  // Tick once a minute so the expires-in label re-renders.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((current) => current + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const trending = useMemo(
    () =>
      [...instants].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [instants],
  );

  return (
    <section className="absolute inset-0 z-20 overflow-y-auto bg-deep px-3 pb-40 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="mb-3 px-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
          Latest Instants
        </p>
        <h2 className="text-xl font-bold text-white">
          Trending
        </h2>
        <p className="mt-1 text-xs text-white/45">
          Every Instant lives 24h. Tap one to open it on the map.
        </p>
      </div>

      {trending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-10 text-center">
          <Flame className="mx-auto h-8 w-8 text-white/35" />
          <p className="mt-3 text-sm font-semibold text-white/70">
            Nothing trending right now
          </p>
          <p className="mt-1 text-xs text-white/45">
            Be the first — post an Instant to light up the map.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {trending.map((instant) => {
            const location = locationsById.get(instant.location_id);
            const meta = INSTANT_TYPE_META[instant.type];
            const author = instant.is_anonymous
              ? "Anonymous"
              : instant.profile?.pulse_name
                ? `@${instant.profile.pulse_name}`
                : "@pulse";
            return (
              <button
                key={instant.id}
                type="button"
                onClick={() => {
                  if (location) onSelectInstant(location.slug, instant.id);
                }}
                className="flex w-full items-stretch gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-left transition active:scale-[0.99]"
              >
                {instant.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={instant.image_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-2xl">
                    {meta.icon}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col justify-between">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/55">
                      <span aria-hidden>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-bold leading-snug text-white">
                      {instant.content?.trim() || meta.label}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/55">
                    <span className="min-w-0 truncate">
                      {author}
                      {location ? ` · ${location.name}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold text-white/70">
                      {timeAgoCompact(instant.created_at)} ·{" "}
                      <span className="text-[var(--accent-primary)]">
                        {expiresInCompact(instant.expires_at)} left
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MyLocationFab({
  isReady,
  loading,
  onClick,
}: {
  isReady: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Center map on my location"
      className="absolute bottom-[calc(78px+env(safe-area-inset-bottom)+58px)] right-3 z-40 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-black/70 text-white shadow-[0_10px_28px_rgba(0,0,0,0.5)] backdrop-blur-xl transition active:scale-95"
    >
      <Crosshair
        className={`h-5 w-5 ${isReady ? "text-[var(--accent-primary)]" : loading ? "text-white/55" : "text-white/75"}`}
      />
    </button>
  );
}

function UserChip({
  pulseName,
  userInitial,
  onClick,
}: {
  pulseName: string | null;
  userInitial: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-[calc(max(12px,env(safe-area-inset-top))+58px)] z-50 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-white backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition active:scale-[0.98]"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-bold text-black">
        {pulseName ? pulseName[0]?.toUpperCase() : userInitial.toUpperCase()}
      </span>
      <span className="max-w-32 truncate">
        {pulseName ? `@${pulseName}` : "Guest"}
      </span>
    </button>
  );
}

function formatMemberSince(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function ProfileView({
  pulseName,
  userInitial,
  memberSince,
  favoritesCount,
  objectsCount,
  liveInstantsCount,
}: {
  pulseName: string | null;
  userInitial: string;
  memberSince: string | null;
  favoritesCount: number;
  objectsCount: number;
  liveInstantsCount: number;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <section className="absolute inset-0 z-20 overflow-y-auto bg-deep px-5 pb-40 pt-[max(24px,env(safe-area-inset-top))]">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white text-4xl font-bold text-black">
          {pulseName ? pulseName[0]?.toUpperCase() : userInitial.toUpperCase()}
        </div>
        <h2 className="mt-4 text-2xl font-bold text-white">
          {pulseName ? `@${pulseName}` : "Guest"}
        </h2>
        <p className="mt-1 text-xs text-white/45">
          Member since {formatMemberSince(memberSince)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ProfileStat label="Favorites" value={favoritesCount} />
        <ProfileStat label="Objects" value={objectsCount} />
        <ProfileStat label="Live now" value={liveInstantsCount} />
      </div>

      <ProfileSection title="Account">
        <ProfileRow
          label="Pulse name"
          value={pulseName ? `@${pulseName}` : "—"}
        />
        <ProfileRow label="Member since" value={formatMemberSince(memberSince)} />
        <ProfileRow label="Session" value="Anonymous · No password" />
      </ProfileSection>

      <button
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition active:scale-[0.99] disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Logout"}
      </button>

      {error && (
        <p className="mt-2 text-center text-xs text-red-300/80">{error}</p>
      )}
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">
        {label}
      </p>
    </div>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="px-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
        {title}
      </p>
      <div className="mt-2 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        {children}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-white/55">{label}</span>
      <span className="min-w-0 truncate font-semibold text-white">{value}</span>
    </div>
  );
}
