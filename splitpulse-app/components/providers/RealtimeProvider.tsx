"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMapStore } from "@/stores/mapStore";
import {
  subscribeInstantsInsert,
  subscribeLocationPulse,
} from "@/lib/realtime/channels";

/**
 * Mounts global Realtime subscriptions for Instants and Location pulse updates.
 * Place inside RootLayout's <body> so it's active everywhere.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const addInstant = useMapStore((s) => s.addInstant);
  const updateInstant = useMapStore((s) => s.updateInstant);
  const upsertLocation = useMapStore((s) => s.upsertLocation);

  useEffect(() => {
    const supabase = createClient();

    const instantsChannel = subscribeInstantsInsert(supabase, (row) => {
      // Dedup by id; updates fall through to updateInstant.
      addInstant(row);
      updateInstant(row);
    });

    const pulseChannel = subscribeLocationPulse(supabase, (row) => {
      upsertLocation(row);
    });

    return () => {
      supabase.removeChannel(instantsChannel);
      supabase.removeChannel(pulseChannel);
    };
  }, [addInstant, updateInstant, upsertLocation]);

  return <>{children}</>;
}
