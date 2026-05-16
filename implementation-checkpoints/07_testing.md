# Checkpoint 07 — Testing

> Manual demo script + edge case checks + RLS verification + performance smoke test. No automated test suite (out of scope for hackathon MVP).

## Goal

Confirm the integrated app works for the hackathon demo. End state: a written, repeatable script proves every demo flow works; known failure modes are documented; a real mobile device passes Lighthouse mobile audit.

## Prerequisites

- ✅ Checkpoints 01–06 complete
- Two devices (phone + laptop, or two phones) for multi-user verification
- Optional: BrowserStack / Sauce Labs for cross-device check

## Status checklist

### Demo script execution (project doc §12)
- [ ] **Step 1 — QR:** scan demo QR code → app opens at `/map?focus=tech-park`
- [ ] **Step 2 — Heatmap:** Tech Park visible with red heatmap (seeded demo Instants)
- [ ] **Step 3 — Post Instant:** tap FAB → text Instant "Pitch presentations starting soon" → submit
- [ ] **Step 4 — Instant on map:** new Instant appears on map within 1s
- [ ] **Step 5 — Pulse update:** zone color intensifies; pulse_score increases (visible in panel)
- [ ] **Step 6 — Second device reaction:** second phone confirms/marks helpful → counter increments live
- [ ] **Step 7 — AI summary:** tap "Generate summary" → Claude returns 2-3 sentence summary
- [ ] **Step 8 — Show Split expansion:** zoom out → all 19 Split locations visible as markers

### Edge cases
- [ ] **Geolocation denied** — Post Instant flow offers manual zone picker
- [ ] **Offline** — `/map` shows last cached state; submit Instant fails gracefully with toast
- [ ] **Anonymous post** — toggle `is_anonymous=true` → InstantCard shows "Anonymous" instead of pulse_name
- [ ] **Anthropic timeout** — `/api/ai/summary` falls back to "AI summary unavailable, try again"
- [ ] **Mapbox token missing** — clear error message in console + visible fallback UI text
- [ ] **Expired Instant** — Instant past `expires_at` does not appear in `active_instants` view
- [ ] **Duplicate Pulse name** — registration returns 409 with clear message
- [ ] **Zone match miss** — Post Instant from outside any zone → returns "No zone matched" error

### RLS verification
- [ ] Sign in as user A, post Instant
- [ ] Sign in as user B → can read user A's Instant (via `active_instants` policy)
- [ ] User B tries `PATCH /api/instants/[A's id]` → 403 / 0 rows updated (policy enforces `auth.uid() = user_id`)
- [ ] Unauthenticated client tries `POST /api/instants` → 401
- [ ] Unauthenticated client tries `GET /api/favorites` → empty (RLS scoped to `auth.uid()`)
- [ ] Public collection (`is_public=true`) readable without auth
- [ ] Private collection NOT readable without auth

### Data integrity
- [ ] `SELECT count(*) FROM locations` = 28 (1 Tech Park + 8 sub-zones + 19 Split)
- [ ] After posting 5 Instants, `SELECT count(*) FROM active_instants` increased by 5
- [ ] Run `SELECT calculate_pulse_score(id) FROM locations WHERE slug='main-hall';` → matches `locations.pulse_score`
- [ ] `cleanup_expired_instants()` removes Instants older than 1h past expiry — manual test by inserting one with `expires_at = now() - '2h'`

### Performance
- [ ] Lighthouse mobile audit on `/map`: Performance ≥ 80, Accessibility ≥ 90, Best Practices ≥ 90
- [ ] Initial JS payload < 300KB gzipped (Mapbox is the heavy bit; lazy-load it)
- [ ] No layout shift when bottom sheet opens
- [ ] First Instant render after Realtime push < 500ms
- [ ] AI summary first byte < 3s (Anthropic streaming would help but not required)

### Cross-browser smoke
- [ ] iOS Safari (latest)
- [ ] Android Chrome (latest)
- [ ] Desktop Chrome (for judge laptop)
- [ ] Glassmorphism `backdrop-filter` renders on all — if Safari fails, accept degradation

## Files to create / edit

```
splitpulse-app/
└── docs/
    ├── demo-script.md                   # CREATE — step-by-step for demo day
    ├── known-issues.md                  # CREATE — any pre-recorded workarounds
    └── rls-test-results.md              # CREATE — snapshot of RLS checks
```

## Dependencies

- Two devices (or two browser profiles)
- Network connectivity (for realtime + Anthropic)

## Implementation notes

### Demo script template (write into `docs/demo-script.md`)

```
# SPLIT PULSE — Demo Script

## Setup (5 min before demo)
1. Verify deployment URL loads: https://splitpulse.vercel.app/map?focus=tech-park
2. Verify Supabase realtime is up: open dashboard → check "Connections" > 0
3. Verify Anthropic key valid: hit /api/ai/summary once, expect 200
4. Verify QR code printed and correct

## Demo (5 min total)
1. (15s) Open story. Show printed QR. "Scan this to join."
2. (30s) Open app on demo phone. Show heatmap. Tech Park is red.
3. (30s) Tap Tech Park → bottom sheet → show seeded Instants
4. (45s) Tap "Generate AI summary" → AI explains what's happening
5. (60s) Tap FAB → post live Instant "Pitch is starting now"
6. (15s) Instant appears on map; pulse intensifies. SAY: "Heat map is alive."
7. (45s) Co-presenter on second phone confirms Instant. Counter ticks live.
8. (30s) Zoom out → show Split-wide map: Riva, Bačvice, Marjan, etc. SAY: "Same model, whole city."
9. (30s) Close: "SPLIT PULSE — live heat map of the city, powered by GPS Instants."

## Recovery plan
- If realtime drops: refresh manually
- If AI fails: skip summary, narrate instead
- If GPS denied: use manual zone picker, frame as feature
```

### RLS test SQL (write into `docs/rls-test-results.md`)

```sql
-- As user A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<user-a-uuid>';
INSERT INTO instants (location_id, type, content, geo, expires_at)
VALUES ('<some-loc>', 'text', 'A posted', ST_SetSRID(ST_MakePoint(16.4636, 43.5148), 4326)::geography, now() + interval '1h');

-- As user B trying to update A's row
SET LOCAL request.jwt.claim.sub = '<user-b-uuid>';
UPDATE instants SET is_resolved = true WHERE content = 'A posted';
-- expect: 0 rows affected
```

### Performance debugging tips

- If FPS drops on heatmap update: increase `debounceRefresh` window to 2s
- If realtime latency > 2s: check Supabase project region matches Vercel region (`fra1` both)
- If TTFB high on `/map`: ensure server component doesn't await long-running RPC

## Verification

Tests pass = checklist complete. Failures get logged in `docs/known-issues.md` with workaround.

## Continuation note

If session ends mid-checkpoint:

- The demo script is the most important deliverable — make sure it exists even if other tests are skipped
- If 80%+ of checklist passes, the app is demo-ready
- **What's next after this:** start `08_deploy.md`

## References

- Project doc §12 (demo flow)
- Spec §16 (perf notes)
