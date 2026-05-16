# SPLIT PULSE — Implementation Master Plan

> Battle-ready roadmap for a multi-session build. Source of truth for execution order, dependencies, and risks. Pair this with `/implementation-checkpoints/*.md` for per-task detail and `CURRENT_PROGRESS.md` for live state.

---

## 1. Project summary

**SPLIT PULSE** is a mobile-first PWA showing a live heat map of Split, Croatia, powered by **Location Instants** — short-lived, GPS-tagged posts (photo, text, question, help, event, etc.). Each Instant raises a zone's *Pulse Score*, changing its colour on the heat map in real time. Hackathon MVP focuses on **Technological Park** as the first live zone, expanding to 19 Split locations.

**One-liner:** *A live heat map of the city powered by GPS-based disappearing Instants.*

**Tech stack:** Next.js 14 (App Router) + Supabase (Postgres + PostGIS + Realtime + Auth + Storage) + Mapbox GL JS + Anthropic Claude Sonnet + Vercel.

---

## 2. Architecture map

```
┌──────────────────────────────────────────────────────────────────────┐
│                       MOBILE BROWSER (PWA)                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 App Router                                         │  │
│  │  ─────────────────                                             │  │
│  │  /map           Mapbox GL JS heatmap + markers + pulse rings   │  │
│  │  /instant/new   Camera-first capture / text input              │  │
│  │  /location/[s]  Bottom sheet with feed + AI summary            │  │
│  │  /login         Guest / Pulse name / Google                    │  │
│  │  /favorites     User favorites + collections                   │  │
│  │  /collection/[] Public shared collection                       │  │
│  │                                                                │  │
│  │  Providers: SupabaseProvider · MapProvider · RealtimeProvider  │  │
│  │  State:     Zustand (map filters, active sheet, post draft)    │  │
│  └─────────────────┬─────────────────────┬────────────────────────┘  │
│                    │ HTTPS               │ WebSocket (Realtime)      │
└────────────────────┼─────────────────────┼──────────────────────────┘
                     │                     │
        ┌────────────▼─────────────┐       │
        │  Next.js API routes      │       │
        │  (Vercel serverless)     │       │
        │  /api/instants           │       │
        │  /api/locations          │       │
        │  /api/ai/summary, /ask   │       │
        │  /api/auth/*             │       │
        │  /api/favorites          │       │
        │  /api/collections        │       │
        │  /api/share/card         │       │
        │  /api/og/[type]/[id]  ←── @vercel/og (Satori, edge)         │
        └────┬──────────────┬──────┘       │
             │              │              │
             │              │  Anthropic   │
             │              ▼  Claude API  │
             │      (Sonnet, server-side)  │
             │                             │
             ▼                             ▼
   ┌─────────────────────────────────────────────────┐
   │                  SUPABASE                       │
   │  ┌───────────────────────────────────────────┐  │
   │  │ Postgres + PostGIS + pg_trgm              │  │
   │  │  Tables: profiles, locations, instants,   │  │
   │  │    instant_reactions, ai_queries,         │  │
   │  │    favorites, favorite_collections        │  │
   │  │  View:   active_instants                  │  │
   │  │  RPCs:   calculate_pulse_score,           │  │
   │  │          find_nearest_zone,               │  │
   │  │          cleanup_expired_instants         │  │
   │  │  RLS:    per-table policies               │  │
   │  └───────────────────────────────────────────┘  │
   │  ┌──────────────┐  ┌──────────────┐  ┌───────┐  │
   │  │ Auth         │  │ Realtime     │  │Storage│  │
   │  │ (guest +     │  │ (Postgres    │  │(photo │  │
   │  │  Google)     │  │  Changes)    │  │ inst) │  │
   │  └──────────────┘  └──────────────┘  └───────┘  │
   └─────────────────────────────────────────────────┘
```

---

## 3. Tech stack (condensed)

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 14 App Router | SSR, API routes, mobile-first PWA |
| Language | TypeScript | strict mode |
| Styling | Tailwind CSS | + custom glassmorphism tokens (spec §20) |
| State | Zustand | client-side map/filter state |
| DB | Supabase Postgres + PostGIS | geography(POINT, 4326) for GPS |
| Realtime | Supabase Realtime | Postgres Changes channels |
| Auth | Supabase Auth | anonymous (guest) + Google OAuth |
| Storage | Supabase Storage | photo Instants, auto-resize transforms |
| Maps | Mapbox GL JS | heatmap layer + markers + pulse rings |
| AI | Anthropic Claude Sonnet | `claude-sonnet-4-5` via @anthropic-ai/sdk |
| Hosting | Vercel | region `fra1`, edge functions for OG images |
| OG images | @vercel/og (Satori) | dynamic share cards |
| Icons | lucide-react | 20px, stroke-width 1.5 |
| Fonts | DM Sans + JetBrains Mono | via Google Fonts |

---

## 4. Module dependency graph

```
┌──────────────────────────────────────────────────────────┐
│  01_foundation                                           │
│  Next.js scaffold, Tailwind, Supabase project,           │
│  schema SQL, RLS, seed locations, env vars               │
└──────────┬───────────────────────────────────────────────┘
           │ (everything depends on this)
           ▼
┌──────────────────────────────────────────────────────────┐
│  02_backend_core                                         │
│  API routes for instants, locations, AI summary/ask;     │
│  zone matching; server-side expiration                   │
└──────┬──────────────────────────────┬────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────────┐   ┌─────────────────────────────┐
│  03_realtime         │   │  05_auth_gamification        │
│  Supabase Realtime   │   │  Guest + Google login;       │
│  subscriptions,      │   │  profile bootstrap;          │
│  pulse recalc        │   │  streak/points DESIGN only   │
└──────────┬───────────┘   └──────────┬──────────────────┘
           │                          │
           ▼                          │
┌──────────────────────────────────────▼───────────────────┐
│  04_ui_dashboard                                         │
│  /map + heatmap + bottom sheet + post Instant + filters; │
│  glassmorphism components; Mapbox layer                  │
└──────────────────────────────────┬───────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────┐
│  06_favorites_sharing                                    │
│  Favorites + collections UI/API; share cards (@vercel/og)│
│  Web Share API; public /collection/[slug]                │
└──────────────────────────────────┬───────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────┐
│  07_testing                                              │
│  Manual demo script, RLS verification, edge cases        │
└──────────────────────────────────┬───────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────┐
│  08_deploy                                               │
│  Vercel project, env vars, domain, QR code, launch       │
└──────────────────────────────────────────────────────────┘
```

**Hard dependencies (cannot start without):**
- 02, 03, 05 require 01 (schema must exist)
- 04 requires 02 + 03 (needs APIs and realtime)
- 06 requires 04 (extends location panel with favorite button)
- 07 requires 04 + 06 (testing the integrated UX)
- 08 requires 07 (don't deploy broken)

**Parallelizable:**
- 02, 03, 05 can be built in parallel after 01
- AI summary work inside 02 can happen late (after instants API works)

---

## 5. MVP critical path (fastest demo)

If time is tight, this is the minimum sequence to reach a working hackathon demo:

```
1. 01_foundation — schema + seed tech-park zones        (HIGHEST priority)
2. 02_backend_core — POST /api/instants + GET locations
3. 04_ui_dashboard — render Mapbox + heatmap from seeded data
4. 03_realtime — subscribe to instants INSERT events
5. 04_ui_dashboard — post Instant flow (text-only, skip camera)
6. 02_backend_core — POST /api/ai/summary
7. 04_ui_dashboard — location bottom sheet + AI summary button
8. 08_deploy — Vercel + QR code
9. Demo
```

Skip if time-constrained: camera capture, Google OAuth, favorites, collections, share cards, streak logic.

---

## 6. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Mapbox token not provisioned in time | M | High (map won't render) | Pre-create free Mapbox account; fallback to Leaflet (spec §7.2) ready in branch |
| R2 | Supabase Realtime quota / throttling on free tier | L | M | Subscribe per visible zone only, not globally; debounce updates |
| R3 | Anthropic API key blocked / quota | L | M | Cache AI summaries 5 min per location; show static fallback text |
| R4 | PostGIS extension not enabled by default on Supabase project | L | High (blocks schema) | Run `CREATE EXTENSION` step first in checkpoint 01; verify before continuing |
| R5 | Mobile camera permissions denied | M | M | Always offer text fallback in Post Instant flow |
| R6 | Anonymous Supabase sessions interact badly with RLS | M | M | Spec uses `auth.uid() IS NOT NULL` — anon sessions DO have a uid; verify in checkpoint 05 |
| R7 | Geolocation API denied / inaccurate indoors | H | M | Allow manual zone pick from a list when GPS unavailable |
| R8 | Vercel build timeout for large geo data | L | L | All seeds run in Supabase SQL editor, not at build time |
| R9 | Realtime + heatmap layer redraw causes jank on low-end mobiles | M | M | Throttle GeoJSON source updates to 1/sec; use `setData` not full layer rebuild |
| R10 | Glassmorphism `backdrop-filter` performance on older Safari | L | L | Acceptable degradation; design tokens still render readable without blur |

---

## 7. Estimated implementation order (line-by-line)

```
[01] npx create-next-app@latest split-pulse --typescript --tailwind --app
[01] Configure Tailwind with design tokens from spec §20.2 / §20.4
[01] Install: @supabase/ssr @supabase/supabase-js mapbox-gl @anthropic-ai/sdk
              zustand lucide-react @vercel/og
[01] Create Supabase project, copy URL + anon key + service role key into .env.local
[01] Run schema.sql: extensions, profiles, locations, instants, instant_reactions,
                     ai_queries, favorites, favorite_collections
[01] Create active_instants view; calculate_pulse_score, find_nearest_zone,
                     cleanup_expired_instants RPCs
[01] Enable RLS + write policies on all tables
[01] Run seed.sql: 8 Tech Park zones + 19 Split locations + demo instants
[01] Build app shell: layout.tsx with SupabaseProvider, dark background, fonts

[02] /api/locations GET — list with pulse data
[02] /api/locations/[slug] GET — detail + active_instants
[02] /api/instants GET — filter by location_id, type, limit
[02] /api/instants POST — write with server-side expires_at calc + zone match
[02] /api/instants/[id] PATCH — mark resolved
[02] /api/instants/[id]/react POST — confirm | helpful | answer
[02] /api/ai/summary POST — Anthropic call + 5-min in-memory cache
[02] /api/ai/ask POST — same pattern, free-form question
[02] /api/locations/[slug]/pulse POST — trigger calculate_pulse_score RPC

[03] Enable Realtime on instants, locations, instant_reactions in dashboard
[03] RealtimeProvider client component with channel subscriptions
[03] Wire INSERT instants → add to map state
[03] Wire UPDATE locations → update heatmap layer
[03] Decide pulse recalc trigger: cron (Supabase scheduled function) every 2 min
                                  + on-write trigger after instant insert

[04] Install Mapbox token, create map container with center Split
[04] HeatMap component with heatmap layer from spec §7.1
[04] InstantMarker + PulseOverlay components
[04] BottomSheet primitive (draggable, glassmorphism)
[04] LocationPanel using BottomSheet
[04] AISummary lazy-load on panel open
[04] PostInstantButton FAB
[04] /instant/new screen: TypeSelector + CameraCapture + text input
[04] Filter pills above sheet (All / Crowd / Help / Event / Question)

[05] /api/auth/guest — supabase.auth.signInAnonymously()
[05] /api/auth/pulse-name — set profiles.pulse_name unique
[05] Google OAuth provider in Supabase dashboard
[05] /login UI: 3 buttons (Continue as guest / Pulse name / Google)
[05] Profile bootstrap trigger on auth.users insert → create profiles row
[05] DESIGN-ONLY: streak/points/helper-score rules table + SQL trigger sketch
                 (do NOT implement; mark TODO with rule reference)

[06] /api/favorites GET POST DELETE
[06] /api/collections GET POST PATCH DELETE
[06] /api/share/collection/[slug] GET (public read)
[06] FavoriteButton on LocationPanel
[06] /favorites page with collection grouping
[06] AddToCollection modal
[06] /api/og/location/[slug] dynamic OG image (spec §19.2)
[06] /api/og/collection/[slug] dynamic OG image
[06] utils/share.ts: Web Share API + clipboard fallback
[06] Share button on LocationPanel + InstantCard + collection
[06] generateMetadata() in route files for OG tags

[07] Run through demo script (see 07_testing.md)
[07] Test offline / geolocation denied paths
[07] Verify RLS prevents tampering
[07] Lighthouse mobile audit

[08] Connect repo to Vercel
[08] Set production env vars (Supabase keys, Anthropic key, Mapbox token)
[08] Configure region = fra1 in vercel.json
[08] Verify Supabase Storage public bucket for instant photos
[08] Generate QR pointing to https://splitpulse.vercel.app?zone=tech-park
[08] Smoke-test deployment on real mobile device
[08] Print QR for demo
```

---

## 8. Resolved conflicts between source docs

| # | Conflict | Resolution |
|---|---|---|
| 1 | Pulse Score formula | Use tech spec §3.4 (executable SQL). `location_clicks` from product doc is a future addition. |
| 2 | Tech Park zones | Seed **all 8** from project doc §11: Main Hall, Team Area, Pitch Area, Food Area, Entrance, Chill Zone, Help Zone, Networking Zone. |
| 3 | Split locations | Seed **all 19** from project doc §19. Tech spec's 9 is a strict subset. |
| 4 | Map library | **Mapbox GL JS**. Leaflet fallback only if Mapbox token is unavailable. |
| 5 | Payments | **Out of scope.** No checkpoint, no schema, no UI. |
| 6 | Streak / pulse points / helper score | **Design now, defer implementation.** Checkpoint 05 documents rules; columns exist; triggers are sketched but commented out. |
| 7 | `instants.type` default | Treat `'general'` as `'text'`. API normalizes input. |
| 8 | Anonymous Instants | Guests use Supabase anonymous auth (still has `auth.uid()`). `is_anonymous` is a display flag — hides `profile.pulse_name` in feed. |
| 9 | AI scope | MVP = summary + ask. "Where should I go now?" / city plan = stretch. |
| 10 | Tech-park `parent_id` in seeds | Use a CTE: `WITH parent AS (INSERT INTO locations ... RETURNING id) INSERT INTO locations ... SELECT ..., parent.id FROM parent`. |

---

## 9. How to use this plan

**For every work session:**

1. **Open `CURRENT_PROGRESS.md` first.** It tells you what's done, what's next, and the exact next task.
2. **Open the checkpoint file referenced by "Next exact task".** Each checkpoint is self-contained — file paths, task list, dependencies, verification.
3. **Mark items off the checkpoint's status checklist as you go.**
4. **Before stopping (even mid-task):** update `CURRENT_PROGRESS.md` with what you finished, what's in flight, and where to resume.
5. **If you discover something the plan missed:** add a row to the "Notes / discoveries" section of the relevant checkpoint *and* a line in `CURRENT_PROGRESS.md > Blockers` if it actually blocks.

**For a fresh model with zero context:**

- Read this file (you're reading it).
- Read `CURRENT_PROGRESS.md`.
- Read the checkpoint pointed to as "Next exact task".
- Read the two source docs (`SPLIT_PULSE_TECHNICAL_SPEC.md`, `split_pulse_project.md`) on demand when a checkpoint references a section.

**Do not** start a new checkpoint while another is partially complete unless `CURRENT_PROGRESS.md` explicitly says they're parallelizable.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| Instant | A short-lived GPS-tagged post (photo, text, question, etc.) |
| Pulse Score | Integer per location computed from recent Instants + reactions |
| Pulse Status | Derived from score: quiet · active · rising · trending · high_pulse · live_event |
| Zone | A `locations` row with a geofence (`center` + `radius_meters`) |
| Heat Map | Mapbox heatmap layer fed by active Instants weighted by type + recency |
| Streak | Daily count of "helpful actions" by a profile (post / confirm / answer / mark helpful) |
| Pulse Points | Total reward points earned (rules in checkpoint 05) |
| Helper Score | Subscore for question-answering and helpful reactions specifically |

---

*Last revised: 2026-05-16. Authored by Claude Opus 4.7 from `SPLIT_PULSE_TECHNICAL_SPEC.md` + `split_pulse_project.md`.*
