# SPLIT PULSE

> Live heat map of the city powered by GPS-based disappearing Instants.
> Next.js 16 (App Router) · Supabase (Postgres + PostGIS + Realtime + Auth + Storage) · Mapbox GL JS · Anthropic Claude.

For the full product and engineering spec see `../SPLIT_PULSE_TECHNICAL_SPEC.md`, `../split_pulse_project.md`, and the per-task roadmap in `../implementation-checkpoints/`.

---

## Setup

### 1. Supabase project

1. Sign up at https://supabase.com → **New project** (region: `eu-central-1`).
2. SQL Editor → run, **in order**:
   - `../db/schema.sql`
   - `../db/rls.sql`
   - `../db/seed.sql`
3. Storage → create bucket `instant-photos`:
   - Public bucket
   - Max file size 5 MB
   - Allowed MIME types: `image/jpeg, image/png, image/webp, image/heic`
4. Authentication → Providers:
   - Enable **Anonymous Sign-Ins** (required for guest flow)
   - Enable **Google** (paste Google OAuth Client ID + Secret)
5. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` (and your Vercel URL later)
   - Redirect URLs: include `http://localhost:3000/auth/callback` and `https://your-domain.vercel.app/auth/callback`
6. Database → Replication → enable Realtime on tables: `instants`, `locations`, `instant_reactions`.

### 2. Mapbox

1. Sign up at https://mapbox.com → copy default public token.
2. The free tier covers ~50k map loads/month — plenty for the demo.

### 3. Anthropic

1. https://console.anthropic.com → create API key.

### 4. Environment

```bash
cp .env.local.example .env.local
# fill in the values
```

### 5. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 → redirects to `/map`.

---

## Project layout

```
splitpulse-app/
├── app/
│   ├── layout.tsx                # Root layout (fonts, RealtimeProvider)
│   ├── page.tsx                  # / → redirect to /map
│   ├── map/page.tsx              # Main heat-map screen (server-rendered)
│   ├── instant/new/page.tsx      # Post Instant flow
│   ├── login/page.tsx            # Guest / Pulse name / Google
│   ├── auth/callback/route.ts    # OAuth exchange
│   └── api/
│       ├── locations/...         # GET, GET [slug], POST [slug]/pulse
│       ├── instants/...          # GET, POST, PATCH [id], POST [id]/react
│       ├── ai/{summary,ask}/...  # Anthropic-powered routes
│       ├── auth/{guest,pulse-name}/...
│       └── cron/{recalc,cleanup}/...
├── components/
│   ├── ui/                       # GlassPanel, BottomSheet
│   ├── map/                      # HeatMap (Mapbox), MapClient wrapper
│   ├── location/                 # PulseStatus, AISummary, LocationPanel
│   ├── instant/                  # InstantCard, PostInstantClient
│   ├── auth/                     # LoginClient
│   └── providers/                # RealtimeProvider
├── lib/
│   ├── supabase/{client,server,service}.ts
│   ├── api/{errors,schemas,expiration,ai-cache}.ts
│   ├── instant/{typeMeta,timeAgo}.ts
│   ├── realtime/{channels,debounce}.ts
│   └── anthropic.ts
├── hooks/useGeolocation.ts
├── stores/mapStore.ts            # Zustand
├── types/index.ts                # All DB-shaped types
├── middleware.ts                 # Session refresh
├── vercel.json                   # Region + cron config
└── ../db/                        # SQL files (apply via Supabase SQL editor)
```

---

## Deploy

```bash
# Connect to Vercel (first time only):
npx vercel link

# Push to production:
npx vercel --prod
```

In Vercel dashboard → Environment Variables, set:

| Variable | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ (sensitive) | – |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✓ | ✓ |
| `ANTHROPIC_API_KEY` | ✓ (sensitive) | – |
| `NEXT_PUBLIC_APP_URL` | `https://splitpulse.vercel.app` | `$VERCEL_URL` |
| `CRON_SECRET` | random 32-byte hex | – |

Add the Vercel deployment URL to Supabase Auth → URL Configuration → Site URL and Redirect URLs (`/auth/callback`).

---

## Demo flow

1. Generate QR pointing at `https://your-domain.vercel.app?zone=tech-park`.
2. Scan → app opens, centers on Tech Park.
3. Tap a zone → bottom sheet → "Generate AI summary".
4. Tap ⚡ INSTANT → post a text Instant → returns to map → Instant appears live.
5. From a second device, react ✓ → counter updates in real time.

See `../implementation-checkpoints/07_testing.md` for the full demo script.

---

## Architecture notes

- **Tailwind v4** — design tokens via `@theme` in `app/globals.css` (not a `tailwind.config.ts` file). Spec was written for Tailwind v3 conventions; the migration is captured in tokens.
- **Next.js 16 route handlers** — `params` is `Promise<{...}>`; always `await ctx.params`.
- **Anonymous auth** — Supabase anonymous sessions DO have `auth.uid()`. RLS `auth.uid() IS NOT NULL` lets guests post.
- **Realtime** — global subscription scope; for scale, switch to per-zone channels (spec §16).
- **AI cache** — in-memory per Vercel instance, 5-min TTL (spec §16).
- **Pulse recalc** — fire-and-forget after each Instant insert + Vercel Cron every 2 min via `/api/cron/recalc`.

---

## Roadmap

What's done in this scaffold (vs. checkpoints):
- ✅ 01 Foundation (code; DB needs to be run by you)
- ✅ 02 Backend Core
- ✅ 03 Realtime
- ✅ 04 UI Dashboard
- 🟡 05 Auth (guest + name + Google + middleware + callback done; gamification design lives in `db/triggers-deferred.sql`)
- ⏳ 06 Favorites & Sharing (schema in place; UI/API not yet built)
- ⏳ 07 Testing (script in `../implementation-checkpoints/07_testing.md`)
- 🟡 08 Deploy (`vercel.json` + cron routes ready; user runs `vercel --prod`)

State of resumable progress: see `../CURRENT_PROGRESS.md`.
