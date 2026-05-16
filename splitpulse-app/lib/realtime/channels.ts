import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Instant, Location } from "@/types";

export const subscribeInstantsInsert = (
  supabase: SupabaseClient,
  onInsert: (row: Instant) => void,
): RealtimeChannel =>
  supabase
    .channel("instants-feed")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "instants" },
      (payload) => onInsert(payload.new as Instant),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "instants" },
      (payload) => onInsert(payload.new as Instant),
    )
    .subscribe();

export const subscribeLocationPulse = (
  supabase: SupabaseClient,
  onUpdate: (row: Location) => void,
): RealtimeChannel =>
  supabase
    .channel("pulse-updates")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "locations" },
      (payload) => onUpdate(payload.new as Location),
    )
    .subscribe();
