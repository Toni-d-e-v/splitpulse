# Checkpoint 03 — Realtime

> Supabase Realtime subscriptions + automatic pulse recalculation. Makes the map "live".

## Goal

Wire client-side subscriptions to `instants`, `locations`, and `instant_reactions`. When a new Instant lands in the DB, the map updates without a refresh. When pulse status changes, the heatmap re-tints the zone. End state: open `/map` in two browsers → post Instant in browser A → browser B sees it appear within 1s.

## Prerequisites

- ✅ Checkpoint 01 (schema, seed)
- ✅ Checkpoint 02 (at least `POST /api/instants` so subscriptions have something to fire)

## Status checklist

- [ ] In Supabase Dashboard → Database → Replication: enable Realtime on `instants`, `locations`, `instant_reactions`
- [ ] Create `components/providers/RealtimeProvider.tsx`
- [ ] Subscribe to `instants` INSERT — dispatch to Zustand store
- [ ] Subscribe to `instants` UPDATE — handle resolved/reaction counter changes
- [ ] Subscribe to `instants` DELETE — for expired cleanup signal
- [ ] Subscribe to `locations` UPDATE with filter `pulse_status=neq.quiet` — update map state
- [ ] Subscribe to `instant_reactions` INSERT — bump local counters optimistically
- [ ] Wire RealtimeProvider into `app/layout.tsx` (inside SupabaseProvider)
- [ ] Create `stores/mapStore.ts` (Zustand) with `instants[]`, `locations[]`, mutation helpers
- [ ] Implement automatic pulse recalc trigger (choose: cron OR post-write)
- [ ] If cron: create Supabase scheduled function calling `calculate_pulse_score` for active zones every 2 min
- [ ] If post-write: trigger after instant insert (already fire-and-forget'd in 02; verify works)
- [ ] Schedule `cleanup_expired_instants()` to run every hour via Supabase cron
- [ ] Decide & implement: when does the client refetch GeoJSON for the heatmap layer? (debounce 1s after any INSERT)

## Files to create / edit

```
splitpulse-app/
├── components/
│   └── providers/
│       └── RealtimeProvider.tsx           # CREATE
├── stores/
│   └── mapStore.ts                        # CREATE — Zustand
├── lib/
│   └── realtime/
│       ├── channels.ts                    # CREATE — channel factories
│       └── debounce.ts                    # CREATE — heatmap refresh debouncer
└── app/layout.tsx                         # EDIT — add RealtimeProvider
```

## Dependencies

- ✅ `@supabase/supabase-js` (from 01)
- ✅ `zustand` (from 01)
- Supabase Realtime quotas: free tier = 200 concurrent connections, 2 messages/sec/client. Acceptable for demo.

## Implementation notes

### Channel subscription pattern (spec §4)

```ts
// lib/realtime/channels.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export const instantsChannel = (supabase: SupabaseClient, onInsert: (row: any) => void) =>
  supabase
    .channel('instants-feed')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'instants' },
      (payload) => onInsert(payload.new))
    .subscribe();

export const locationPulseChannel = (supabase: SupabaseClient, onUpdate: (row: any) => void) =>
  supabase
    .channel('pulse-updates')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'locations', filter: 'pulse_status=neq.quiet' },
      (payload) => onUpdate(payload.new))
    .subscribe();
```

### Zustand store

```ts
// stores/mapStore.ts
import { create } from 'zustand';
import type { Instant, Location } from '@/types';

interface MapState {
  instants: Instant[];
  locations: Location[];
  filter: string | null;          // active type filter
  activeLocationId: string | null;
  addInstant: (i: Instant) => void;
  updateInstant: (i: Partial<Instant> & { id: string }) => void;
  removeInstant: (id: string) => void;
  upsertLocation: (l: Location) => void;
  setFilter: (f: string | null) => void;
  setActiveLocation: (id: string | null) => void;
}
export const useMapStore = create<MapState>((set) => ({
  instants: [], locations: [], filter: null, activeLocationId: null,
  addInstant: (i) => set((s) => ({ instants: [i, ...s.instants] })),
  updateInstant: (i) => set((s) => ({ instants: s.instants.map(x => x.id === i.id ? { ...x, ...i } : x) })),
  removeInstant: (id) => set((s) => ({ instants: s.instants.filter(x => x.id !== id) })),
  upsertLocation: (l) => set((s) => ({
    locations: s.locations.some(x => x.id === l.id)
      ? s.locations.map(x => x.id === l.id ? l : x)
      : [...s.locations, l],
  })),
  setFilter: (f) => set({ filter: f }),
  setActiveLocation: (id) => set({ activeLocationId: id }),
}));
```

### RealtimeProvider

```tsx
'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMapStore } from '@/stores/mapStore';
import { instantsChannel, locationPulseChannel } from '@/lib/realtime/channels';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { addInstant, upsertLocation } = useMapStore();
  useEffect(() => {
    const supabase = createClient();
    const a = instantsChannel(supabase, addInstant);
    const b = locationPulseChannel(supabase, upsertLocation);
    return () => { supabase.removeChannel(a); supabase.removeChannel(b); };
  }, []);
  return <>{children}</>;
}
```

### Pulse recalculation strategy

**Choice (recommended): hybrid**

1. **Post-write trigger** — already fire-and-forget'd in `POST /api/instants`. Instant feedback, but only updates the zone of the new Instant.
2. **Scheduled function** — every 2 minutes, recalculate all zones that have any active Instants. Catches decay (Instants expiring lower the score even with no new posts).

```sql
-- Supabase: Database → Functions → Cron (or pg_cron extension)
SELECT cron.schedule(
  'recalc-active-pulse',
  '*/2 * * * *',
  $$ SELECT calculate_pulse_score(id)
     FROM locations
     WHERE EXISTS (SELECT 1 FROM active_instants ai WHERE ai.location_id = locations.id); $$
);

SELECT cron.schedule(
  'cleanup-expired',
  '0 * * * *',
  $$ SELECT cleanup_expired_instants(); $$
);
```

If `pg_cron` not available, run via Vercel cron in `vercel.json` calling a protected `/api/cron/recalc` route (added in checkpoint 08).

### Heatmap GeoJSON refresh debouncing

Mapbox heatmap layer reads from a GeoJSON source. Avoid replacing source on every single INSERT — batch updates:

```ts
// lib/realtime/debounce.ts
let timer: ReturnType<typeof setTimeout> | null = null;
export const debounceRefresh = (fn: () => void, ms = 1000) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(fn, ms);
};
```

Use in `HeatMap.tsx` (checkpoint 04): on any change to `instants[]`, call `debounceRefresh(() => map.getSource('instants').setData(geoJson))`.

### Subscription scope

Spec §16: "Subscribe per visible zone, not globally." For MVP, global is fine (demo has <100 Instants/min). Add per-zone filtering in checkpoint 04 if performance shows it's needed.

## Verification

1. Open two browser tabs at `/map`
2. In tab A, post an Instant (use `/instant/new` UI or `curl`)
3. **Within 1s**, tab B's `useMapStore.getState().instants` should contain the new row (check via React DevTools or temporary `console.log`)
4. Wait 2 min → in Supabase Table editor, the parent zone's `pulse_score` should have changed (verifies cron)
5. Verify the channel subscription closes on unmount: navigate away from `/map` and back; only one active channel per name

## Continuation note

If session ends mid-checkpoint:

- **If Realtime not enabled in dashboard:** subscriptions silently no-op. Always check the Replication settings first.
- **If channels duplicate:** ensure `useEffect` cleanup actually runs `removeChannel`
- **What's next after this:** start `04_ui_dashboard.md` — the map can now consume realtime updates

## References

- Spec §4 (Realtime setup), §16 (perf notes)
