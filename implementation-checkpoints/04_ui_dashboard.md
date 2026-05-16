# Checkpoint 04 — UI Dashboard

> The main `/map` screen, location bottom sheet, post Instant flow, and all glassmorphism components. The visible product.

## Goal

Build the production UI. End state: open `/map` on a mobile browser → see the heatmap with Tech Park lit up → tap a zone → bottom sheet opens with Instants + AI summary button → tap FAB → post a text Instant → see it appear on the map.

## Prerequisites

- ✅ Checkpoint 01 (design tokens, types, app shell)
- ✅ Checkpoint 02 (`/api/instants`, `/api/locations`, `/api/ai/summary`)
- ✅ Checkpoint 03 (Zustand store, RealtimeProvider) — strongly recommended; without it map won't update live

## Status checklist

### Map screen
- [ ] `app/map/page.tsx` — server-fetches initial `locations` + `active_instants`, hydrates Zustand
- [ ] Wrap map in `next/dynamic({ ssr: false })` — Mapbox is client-only
- [ ] `components/map/HeatMap.tsx` — Mapbox container with heatmap layer (spec §7.1)
- [ ] `components/map/InstantMarker.tsx` — individual Instant dot (small, type-colored)
- [ ] `components/map/PulseOverlay.tsx` — animated pulse rings on `high_pulse` zones (spec §20.6)
- [ ] Glass header bar at top (logo + profile button)
- [ ] Horizontal scroll filter pills above bottom sheet (All / Crowd / Help / Event / Question / Warning)
- [ ] `instant-fab` floating button (spec §20.5)

### Bottom sheet & location panel
- [ ] `components/ui/BottomSheet.tsx` — draggable, two states (peek 120px / full 80vh)
- [ ] `components/location/LocationPanel.tsx` — uses BottomSheet, shows location detail
- [ ] `components/location/PulseStatus.tsx` — colored badge (spec §20.5)
- [ ] `components/location/AISummary.tsx` — lazy-loads `/api/ai/summary` on demand
- [ ] `components/instant/InstantCard.tsx` — single Instant card with left accent bar (spec §20.5)
- [ ] `components/instant/InstantFeed.tsx` — scrollable list inside LocationPanel
- [ ] Action button row: Post Instant · Ask Here · Share · Navigate

### Post Instant flow
- [ ] `app/instant/new/page.tsx` — full-screen modal route
- [ ] `components/instant/TypeSelector.tsx` — pill grid of 8 types
- [ ] `components/instant/CameraCapture.tsx` — uses `<input type="file" accept="image/*" capture="environment">` for MVP simplicity (no MediaStream API needed)
- [ ] Text input with 280-char counter
- [ ] GPS fetch with `useGeolocation()` hook
- [ ] Submit calls `POST /api/instants`, optimistically adds to store, navigates back to `/map`
- [ ] Loading + error states

### Hooks & utilities
- [ ] `hooks/useGeolocation.ts` (spec §8.1)
- [ ] `hooks/useDistanceFromZone.ts` — for "you are here" indicator
- [ ] `lib/instant/typeMeta.ts` — type → label/icon/color map
- [ ] `lib/instant/timeAgo.ts` — "2m ago" formatter (Croatian + English)

### UI primitives
- [ ] `components/ui/GlassPanel.tsx` — base glass surface wrapper
- [ ] `components/ui/FloatingButton.tsx`
- [ ] `components/ui/Badge.tsx`

## Files to create / edit

```
splitpulse-app/
├── app/
│   ├── map/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   └── instant/new/page.tsx
├── components/
│   ├── map/{HeatMap,InstantMarker,LocationCluster,PulseOverlay}.tsx
│   ├── instant/{InstantCard,InstantFeed,PostInstantButton,CameraCapture,TypeSelector}.tsx
│   ├── location/{LocationPanel,PulseStatus,AISummary}.tsx
│   ├── ui/{BottomSheet,FloatingButton,Badge,GlassPanel}.tsx
│   └── providers/MapProvider.tsx
├── hooks/{useGeolocation,useDistanceFromZone}.ts
└── lib/instant/{typeMeta,timeAgo}.ts
```

## Dependencies

- ✅ `mapbox-gl` (from 01)
- ✅ `lucide-react` (from 01)
- ✅ `zustand` (from 03)
- No new packages needed

## Implementation notes

### Map center & default zoom

Center Split: `[16.4401, 43.5069]` (Riva coordinates). Default zoom: `13`. If `?focus=tech-park` query param, recenter on Tech Park and zoom to `16`.

### Mapbox dynamic import

```tsx
// app/map/page.tsx
import dynamic from 'next/dynamic';
const HeatMap = dynamic(() => import('@/components/map/HeatMap'), { ssr: false });
```

### Heatmap layer config

Copy spec §7.1 verbatim. The data source is GeoJSON built from `useMapStore` state:

```ts
const geoJson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: instants.map(i => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [i.longitude, i.latitude] },
    properties: { id: i.id, type: i.type, weight: getWeight(i) },
  })),
};
```

`getWeight(instant)`: base `1` + `2` if has confirms + recency multiplier (decays with `(60 - minutesOld) / 60`).

### Bottom sheet behavior

Two snap points: 120px (peek) and 80vh (full). Drag handle 40×4px white/20%. Use `framer-motion` if available (not in deps yet — add if needed) or pure CSS transform with pointer events. Hackathon-acceptable: no drag, two states toggled by tap.

### Filter pills

```tsx
const types = ['all', 'crowd', 'help', 'event', 'question', 'warning'];
```

Filter applies client-side to `instants` and to the GeoJSON source.

### AI Summary component

```tsx
const [summary, setSummary] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const fetchSummary = async () => {
  setLoading(true);
  const r = await fetch('/api/ai/summary', {
    method: 'POST',
    body: JSON.stringify({ location_id: location.id }),
  });
  const { summary } = await r.json();
  setSummary(summary);
  setLoading(false);
};
```

Show "Generate summary" button initially, then summary text once fetched. Cache result for the session per location.

### Camera capture — MVP shortcut

Use plain file input with `capture` attribute. This opens the native camera on mobile. No MediaStream API, no permissions modal:

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={(e) => handleFile(e.target.files?.[0])}
/>
```

Read image as base64 or upload directly via `FormData` to `/api/instants`.

### Post Instant submit

```ts
const onSubmit = async () => {
  // optimistic: add a placeholder to store
  const tempId = `tmp-${Date.now()}`;
  addInstant({ id: tempId, ...draft, created_at: new Date().toISOString() });

  const fd = new FormData();
  fd.append('type', draft.type);
  fd.append('content', draft.content);
  fd.append('latitude', String(position.coords.latitude));
  fd.append('longitude', String(position.coords.longitude));
  if (draft.image) fd.append('image', draft.image);

  const r = await fetch('/api/instants', { method: 'POST', body: fd });
  if (r.ok) {
    const real = await r.json();
    removeInstant(tempId);
    addInstant(real);  // realtime channel would also push this; idempotent add handles dedup
    router.push('/map');
  } else {
    removeInstant(tempId);
    toast.error('Failed to post');
  }
};
```

Note: realtime will also emit INSERT for the same row. Dedupe in `addInstant` by `id`.

### Glass styling reference

Apply via Tailwind utility classes derived from `tailwind.config.ts` (set up in 01):

```tsx
<div className="rounded-glass bg-white/[0.06] backdrop-blur-glass border border-white/[0.08] shadow-glass p-4">
  ...
</div>
```

## Verification

1. `/map` loads on mobile Chrome → dark UI, Mapbox renders, heatmap blobs visible over Tech Park
2. Tap a Tech Park zone → bottom sheet opens with seeded demo Instants
3. Tap "Generate AI summary" → Anthropic-generated summary appears
4. Tap ⚡ INSTANT FAB → `/instant/new` opens
5. Type text Instant, submit → returns to `/map`, new Instant visible on map within 1s
6. Open second device → see the same Instant via Realtime
7. Filter pills work (filter by type narrows GeoJSON)
8. Lighthouse mobile audit: Performance ≥ 80, Accessibility ≥ 90

## Continuation note

If session ends mid-checkpoint:

- **If Mapbox doesn't render:** check `NEXT_PUBLIC_MAPBOX_TOKEN`, check `mapbox-gl/dist/mapbox-gl.css` is imported in `globals.css` or layout
- **If heatmap shows nothing:** verify `getSource('instants')` exists before `setData`; check `geoJson.features.length > 0`
- **If bottom sheet missing:** start with a static modal — drag is nice-to-have
- **What's next after this:** start `05_auth_gamification.md` (real Google login, profile UX)

## References

- Spec §6 (frontend arch), §7 (heatmap), §8 (geolocation), §20 (entire design system)
- Project doc §6 (camera-first flow), §13 (location panel)
