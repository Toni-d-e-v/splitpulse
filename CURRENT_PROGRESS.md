# Current Progress

> Live state file. **READ THIS FIRST** at the start of every session. **UPDATE THIS** before stopping, even mid-task.

**Last updated:** 2026-05-16 (large build session — checkpoints 01–04 + parts of 05/08 complete)
**Last session:** Claude Opus 4.7 — installed Node 24 LTS, scaffolded Next.js 16 app, wrote 17 routes, full UI, Mapbox heatmap, Realtime, login. All builds clean (`npm run build` ✓ 0 warnings, 0 errors). Blocked on user provisioning Supabase + Mapbox + Anthropic.

---

## Completed

- [x] **Planning:** master plan, 8 checkpoints, progress tracker
- [x] **Checkpoint 01 — Foundation (code):**
  - Next.js 16 + Tailwind v4 scaffold at `splitpulse-app/` (stack drifted up from spec's Next 14 + Tailwind v3 — adapted via `@theme` CSS, documented in README)
  - Deps: `@supabase/ssr`, `@supabase/supabase-js`, `mapbox-gl`, `@anthropic-ai/sdk`, `zustand`, `lucide-react`, `@vercel/og`, `zod`
  - `app/globals.css` with full design tokens (glass, pulse statuses, instant types, animations)
  - DM Sans + JetBrains Mono via `next/font`
  - `app/layout.tsx`, `app/page.tsx` (redirect), `app/map/page.tsx` (SSR fetch + MapClient)
  - `lib/supabase/{client,server,service}.ts`
  - `types/index.ts` (Profile, Location, Instant, etc.)
  - `db/{schema,rls,seed,triggers-deferred}.sql`
- [x] **Checkpoint 02 — Backend Core:** all 9 API routes (locations × 3, instants × 3 + react, AI × 2, auth × 2) + supporting libs (errors, schemas, expiration, ai-cache, anthropic client) + `time-ago` formatter
- [x] **Checkpoint 03 — Realtime:** Zustand store, debouncer, channel factories, `RealtimeProvider` wired into root layout
- [x] **Checkpoint 04 — UI Dashboard:** GlassPanel, BottomSheet, PulseStatusBadge, AISummary, InstantCard, LocationPanel, HeatMap (Mapbox heatmap layer + zone markers + flyTo focus), MapClient (filter pills + FAB + panel orchestration), useGeolocation, PostInstantClient
- [x] **Checkpoint 05 — Auth (partial):** Login screen (Guest / Pulse name / Google), `/auth/callback` route, Supabase session-refresh `proxy.ts` (Next 16 renamed `middleware` → `proxy`), gamification design preserved in `db/triggers-deferred.sql`
- [x] **Checkpoint 08 — Deploy infra (config only):** `vercel.json` (region `fra1`, two cron jobs), `/api/cron/{recalc,cleanup}` with `CRON_SECRET` guard, project `README.md` with full setup steps

**Build verified:** 17 routes compile cleanly with `npm run build`.

---

## In progress

_(nothing — paused for user to provision external services)_

---

## Pending

- [ ] **Checkpoint 01 — external services:** create Supabase + Mapbox + Anthropic accounts, fill `.env.local`, run SQL files
- [ ] **Checkpoint 06 — Favorites & Sharing:** schema is already in `db/schema.sql`; need API routes + UI + `@vercel/og` share cards
- [ ] **Checkpoint 07 — Testing:** run demo script with two devices; smoke-test RLS
- [ ] **Checkpoint 08 — Deploy execution:** `vercel link` + `vercel --prod` + verify QR

---

## Blockers

- **2026-05-16 — External services not yet provisioned (USER ACTION)**
  Code compiles and is fully wired but cannot run end-to-end until:

  1. **Supabase project** → https://supabase.com
     - Region: `eu-central-1`
     - SQL Editor → run, in order:
       - `db/schema.sql`
       - `db/rls.sql`
       - `db/seed.sql`
     - Storage → create bucket `instant-photos` (public, 5 MB max, image MIME types)
     - Authentication → Providers → enable **Anonymous Sign-Ins** + **Google**
     - Authentication → URL Configuration → Site URL = `http://localhost:3000`, Redirect URLs include `http://localhost:3000/auth/callback`
     - Database → Replication → enable Realtime on `instants`, `locations`, `instant_reactions`
  2. **Mapbox** → https://mapbox.com → copy default public token
  3. **Anthropic** → https://console.anthropic.com → create API key
  4. `cp splitpulse-app/.env.local.example splitpulse-app/.env.local` → fill values
  5. `cd splitpulse-app && npm run dev` → open http://localhost:3000

  Workaround in the meantime: keep coding checkpoint 06 (favorites/sharing) — it doesn't need services to compile.

  Owner: user (services), next Claude session (checkpoint 06).

---

## Next exact task

**For the user (15 min):** complete the service provisioning checklist above. Then run `npm run dev` from `splitpulse-app/` and visit http://localhost:3000.

**For the next Claude session:** start `implementation-checkpoints/06_favorites_sharing.md`:
1. `app/api/favorites/{route.ts,[id]/route.ts}`
2. `app/api/collections/{route.ts,[id]/route.ts}`
3. `app/api/share/collection/[slug]/route.ts`
4. `app/api/og/location/[slug]/route.tsx` (use `@vercel/og`)
5. `components/favorites/{FavoriteButton,FavoritesList,CollectionCard,AddToCollection}.tsx`
6. `app/favorites/page.tsx`
7. `app/collection/[slug]/page.tsx` (public)
8. `lib/utils/share.ts` (Web Share API)

---

## Update protocol

**At the start of every session:**

1. Read this file.
2. Read the checkpoint file referenced in "Next exact task".
3. If a different model wrote the previous entry — also skim `IMPLEMENTATION_MASTER_PLAN.md` for context.

**At the end of every session (or before context-switching):**

1. Move completed checklist items in the relevant checkpoint file from `[ ]` to `[x]`.
2. Update this file:
   - Add a row to **Completed**.
   - Update **Next exact task** with the precise file/function/command to resume.
   - Add to **Blockers** if anything is stuck.

---

## Quick reference

| Want to... | Open |
|---|---|
| See the whole roadmap | `IMPLEMENTATION_MASTER_PLAN.md` |
| Know the next task | This file → "Next exact task" |
| Work on a specific layer | `implementation-checkpoints/0N_*.md` |
| Set up the app locally | `splitpulse-app/README.md` |
| Look up DB schema | `db/schema.sql` (canonical) or spec §3 |
| Look up design tokens | `splitpulse-app/app/globals.css` or spec §20 |
| Look up demo flow | `split_pulse_project.md` §12 |
