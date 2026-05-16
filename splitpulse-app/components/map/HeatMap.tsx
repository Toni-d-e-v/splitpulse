"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Instant, Location } from "@/types";

interface Props {
  instants: Instant[];
  locations: Location[];
  focusSlug?: string | null;
  /** Increment to fly the map to the user's current GPS location. */
  flyToUserToken?: number | null;
  onZoneClick?: (slug: string) => void;
}

const TECHNOLOGY_CENTER: [number, number] = [16.4978, 43.52561];

/**
 * Mapbox heatmap + zone markers. Reads from the Zustand store at the call site;
 * this component only renders what it's handed.
 *
 * Adapted from spec §7.1.
 */
export default function HeatMap({
  instants,
  locations,
  focusSlug,
  flyToUserToken,
  onZoneClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userLocation = useGeolocation();
  const technologyCenter = useMemo(
    () => locations.find((l) => l.slug === "tech-park"),
    [locations],
  );
  const visibleLocations = useMemo(
    () =>
      locations.filter(
        (l) => !technologyCenter || l.parent_id !== technologyCenter.id,
      ),
    [locations, technologyCenter],
  );
  const locationInstantMeta = useMemo(() => {
    const childIdsByParent = new Map<string, string[]>();
    locations.forEach((location) => {
      if (!location.parent_id) return;
      childIdsByParent.set(location.parent_id, [
        ...(childIdsByParent.get(location.parent_id) ?? []),
        location.id,
      ]);
    });

    return new Map(
      visibleLocations.map((location) => {
        const relatedLocationIds = new Set([
          location.id,
          ...(childIdsByParent.get(location.id) ?? []),
        ]);
        const relatedInstants = instants
          .filter((instant) => relatedLocationIds.has(instant.location_id))
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
        return [
          location.id,
          {
            count: relatedInstants.length,
            latestImageUrl:
              relatedInstants.find((instant) => instant.image_url)?.image_url ??
              null,
          },
        ];
      }),
    );
  }, [instants, locations, visibleLocations]);

  // Init map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn(
        "[HeatMap] NEXT_PUBLIC_MAPBOX_TOKEN missing — map will not render.",
      );
      return;
    }
    mapboxgl.accessToken = token;
    // Silence telemetry CORS warnings — purely a privacy/noise concern.
    (mapboxgl as unknown as { setTelemetryEnabled?: (b: boolean) => void })
      .setTelemetryEnabled?.(false);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: TECHNOLOGY_CENTER,
      zoom: 16,
      attributionControl: false,
    });
    mapRef.current = map;
    requestAnimationFrame(() => map.resize());
    map.on("error", (e) => {
      console.error("[HeatMap] Mapbox error:", e?.error ?? e);
    });
    map.on("load", () => {
      map.resize();
      console.log("[HeatMap] Mapbox loaded ✓");
    });

    map.on("load", () => {
      map.addSource("instants", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("locations", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("user-location", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "pulse-heat",
        type: "heatmap",
        source: "instants",
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "weight"],
            0, 0,
            10, 1,
          ],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 1,
            15, 3,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,   "rgba(0,0,0,0)",
            0.2, "rgba(0,200,255,0.4)",
            0.4, "rgba(0,255,128,0.6)",
            0.6, "rgba(255,255,0,0.7)",
            0.8, "rgba(255,128,0,0.85)",
            1.0, "rgba(255,40,40,1)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 2,
            15, 30,
            18, 50,
          ],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 0.9,
            18, 0.7,
          ],
        },
      });

      map.addLayer({
        id: "location-dot",
        type: "circle",
        source: "locations",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "instantCount"],
            0, 7,
            1, 13,
            8, 19,
          ],
          "circle-color": [
            "case",
            [">", ["get", "instantCount"], 0], "#00d4ff",
            ["get", "color"],
          ],
          "circle-stroke-color": "rgba(255,255,255,0.9)",
          "circle-stroke-width": 2,
          "circle-opacity": 0.96,
          "circle-blur": 0,
        },
      });

      map.addLayer({
        id: "location-count",
        type: "symbol",
        source: "locations",
        filter: [">", ["get", "instantCount"], 0],
        layout: {
          "text-field": ["to-string", ["get", "instantCount"]],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#0a0a1a",
        },
      });

      map.addLayer({
        id: "location-label",
        type: "symbol",
        source: "locations",
        filter: ["==", ["get", "slug"], "tech-park"],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.8],
          "text-anchor": "top",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(10,10,26,0.85)",
          "text-halo-width": 2,
        },
      });

      map.addLayer({
        id: "user-accuracy",
        type: "circle",
        source: "user-location",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 6,
            16, ["min", 34, ["*", ["get", "accuracy"], 0.18]],
            19, ["min", 54, ["*", ["get", "accuracy"], 0.42]],
          ],
          "circle-color": "rgba(255,45,45,0.08)",
          "circle-stroke-color": "rgba(255,45,45,0.24)",
          "circle-stroke-width": 1,
        },
      });

      map.addLayer({
        id: "user-dot",
        type: "circle",
        source: "user-location",
        paint: {
          "circle-radius": 6,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#ff2d2d",
          "circle-stroke-width": 3,
          "circle-opacity": 1,
        },
      });

      map.on("click", "location-dot", (event) => {
        const feature = event.features?.[0];
        const slug = feature?.properties?.slug;
        if (typeof slug === "string") onZoneClick?.(slug);
      });
      map.on("mouseenter", "location-dot", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "location-dot", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onZoneClick]);

  // Push instants to heatmap source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const setData = () => {
      const src = map.getSource("instants") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: instants
          .filter((i) => typeof i.latitude === "number" && typeof i.longitude === "number")
          .map((i) => {
            return {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [i.longitude, i.latitude],
              },
              properties: {
                id: i.id,
                type: i.type,
                weight: 1 + (i.confirm_count ?? 0) * 0.5,
              },
            };
          }),
      });
    };

    if (map.isStyleLoaded()) setData();
    else map.once("load", setData);
  }, [instants]);

  // Push locations to Mapbox layers. Keep them in the map style, not DOM
  // markers, so pan/zoom projection stays correct.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const setData = () => {
      const src = map.getSource("locations") as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!src) return;

      src.setData({
        type: "FeatureCollection",
        features: visibleLocations
          .filter(
            (location) =>
              typeof location.latitude === "number" &&
              typeof location.longitude === "number",
          )
          .map((location) => {
            const meta = locationInstantMeta.get(location.id);
            const instantCount = meta?.count ?? 0;
            const isTechnologyCenter = location.slug === "tech-park";
            const color =
              isTechnologyCenter
                ? "#4a5568"
                : location.pulse_status === "high_pulse"
                  ? "#ff4444"
                  : location.pulse_status === "trending"
                    ? "#ffb800"
                    : location.pulse_status === "rising"
                      ? "#00e88f"
                      : location.pulse_status === "active"
                        ? "#00d4ff"
                        : "#4a5568";

            return {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [location.longitude, location.latitude],
              },
              properties: {
                id: location.id,
                slug: location.slug,
                name: location.name,
                instantCount,
                color,
              },
            };
          }),
      });
    };

    if (map.isStyleLoaded()) setData();
    else map.once("load", setData);
  }, [locationInstantMeta, visibleLocations]);

  // Focus a zone if requested.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusSlug) return;
    const zone = locations.find((l) => l.slug === focusSlug);
    if (
      zone &&
      typeof zone.latitude === "number" &&
      typeof zone.longitude === "number"
    ) {
      map.flyTo({
        center: [zone.longitude, zone.latitude],
        zoom: 16,
        duration: 1200,
      });
    }
  }, [focusSlug, locations]);

  // Show the user's live GPS position as soon as the map loads.
  useEffect(() => {
    const map = mapRef.current;
    const coords = userLocation.coords;
    if (!map || !coords) return;

    const setData = () => {
      const src = map.getSource("user-location") as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [coords.longitude, coords.latitude],
            },
            properties: {
              accuracy: Math.min(Math.max(coords.accuracy, 8), 120),
            },
          },
        ],
      });
    };

    if (map.isStyleLoaded()) setData();
    else map.once("load", setData);
  }, [userLocation.coords]);

  // Fly to the user's location when the parent bumps the token.
  useEffect(() => {
    const map = mapRef.current;
    const coords = userLocation.coords;
    if (!map || !coords || !flyToUserToken) return;
    map.flyTo({
      center: [coords.longitude, coords.latitude],
      zoom: 17,
      duration: 1100,
    });
  }, [flyToUserToken, userLocation.coords]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 h-full w-full"
      style={{ minHeight: "100dvh" }}
    />
  );
}
