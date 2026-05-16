"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

type PermissionStatus = "granted" | "denied" | "prompt" | "unknown";

interface State {
  coords: Coords | null;
  error: string | null;
  loading: boolean;
  permission: PermissionStatus;
  isSecure: boolean;
}

export interface UseGeolocationResult extends State {
  request: () => void;
}

function detectSecureContext() {
  if (typeof window === "undefined") return true;
  if (window.isSecureContext) return true;
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function useGeolocation(): UseGeolocationResult {
  const [state, setState] = useState<State>({
    coords: null,
    error: null,
    loading: true,
    permission: "unknown",
    isSecure: true,
  });
  const watchIdRef = useRef<number | null>(null);

  const refreshPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) {
      return;
    }
    try {
      const status = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      setState((current) => ({
        ...current,
        permission: status.state as PermissionStatus,
      }));
      status.onchange = () => {
        setState((current) => ({
          ...current,
          permission: status.state as PermissionStatus,
        }));
      };
    } catch {
      // Permissions API not available for geolocation in this browser.
    }
  }, []);

  const startWatch = useCallback(() => {
    const isSecure = detectSecureContext();

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        coords: null,
        error: "Geolocation not supported by this browser",
        loading: false,
        permission: "unknown",
        isSecure,
      });
      return;
    }

    if (!isSecure) {
      setState({
        coords: null,
        error:
          "Geolocation needs HTTPS. Open the site over https:// (e.g. tunnel) — http:// on a LAN IP is blocked.",
        loading: false,
        permission: "denied",
        isSecure: false,
      });
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
      isSecure: true,
    }));

    const onSuccess = (pos: GeolocationPosition) =>
      setState((current) => ({
        ...current,
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        },
        error: null,
        loading: false,
        permission: "granted",
        isSecure: true,
      }));

    const onError = (err: GeolocationPositionError) => {
      const denied = err.code === err.PERMISSION_DENIED;
      setState((current) => {
        if (current.coords) {
          return { ...current, error: err.message ?? "Geolocation error" };
        }
        return {
          ...current,
          coords: null,
          error: err.message ?? "Geolocation error",
          loading: false,
          permission: denied ? "denied" : current.permission,
        };
      });
    };

    // Desktop browsers (no GPS hardware) often fail enableHighAccuracy=true.
    // Try low-accuracy first; if it succeeds, upgrade to high-accuracy.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccess(pos);
        navigator.geolocation.getCurrentPosition(onSuccess, () => {}, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
      },
      onError,
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 30000,
    });

    refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    startWatch();
    return () => {
      if (watchIdRef.current !== null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatch]);

  return { ...state, request: startWatch };
}
