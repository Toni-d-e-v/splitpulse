# Checkpoint 01 — Foundation

> Project scaffold, Supabase schema, seed data, design system tokens. Nothing else works until this is done.

## Goal

Stand up a deployable Next.js + Supabase shell with the full schema, seeded locations (8 Tech Park zones + 19 Split locations), RLS policies, and design tokens in place. End state: `npm run dev` shows a dark glass app shell at `/map` that can read seeded locations from Supabase.

## Prerequisites

- None. This is the first checkpoint.
- You will need: Supabase account, Mapbox account (free tier), Anthropic API key.

## Status checklist

- [ ] `npx create-next-app@latest split-pulse --typescript --tailwind --app` in `/home/toni/Documents/splitpulse/app/` (or `splitpulse-app/` — keep adjacent to source docs)
- [ ] Install deps: `@supabase/ssr @supabase/supabase-js mapbox-gl @anthropic-ai/sdk zustand lucide-react @vercel/og`
- [ ] Install dev deps: `@types/mapbox-gl`
- [ ] Configure `tailwind.config.ts` with design tokens (spec §20.4)
- [ ] Create `app/globals.css` with CSS variables for colors/spacing/radius/shadows (spec §20.2)
- [ ] Add Google Fonts (DM Sans + JetBrains Mono) via `next/font/google` in `app/layout.tsx`
- [ ] Create Supabase project (region: `eu-central-1`)
- [ ] Populate `.env.local` (template below)
- [ ] Run **schema.sql** in Supabase SQL editor: extensions, tables, indexes, view, RPCs
- [ ] Run **rls.sql**: enable RLS + write policies for all tables
- [ ] Run **seed.sql**: 8 Tech Park zones (with parent) + 19 Split locations + 5 demo instants
- [ ] Verify: `SELECT count(*) FROM locations` returns 27
- [ ] Create `lib/supabase/client.ts` and `lib/supabase/server.ts` (SSR-safe clients)
- [ ] Create `app/layout.tsx` with dark background, fonts, SupabaseProvider
- [ ] Create `app/page.tsx` redirect to `/map`
- [ ] Create `app/map/page.tsx` skeleton (just a glass header + empty container)
- [ ] Smoke test: `npm run dev` → load `/map` → no errors → header visible

## Files to create / edit

```
/home/toni/Documents/splitpulse/
├── splitpulse-app/                              # the Next.js project
│   ├── .env.local                              # CREATE — see template
│   ├── tailwind.config.ts                      # EDIT — design tokens
│   ├── app/
│   │   ├── layout.tsx                          # EDIT — fonts + provider
│   │   ├── globals.css                         # EDIT — CSS variables
│   │   ├── page.tsx                            # EDIT — redirect to /map
│   │   └── map/page.tsx                        # CREATE — skeleton
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts                       # CREATE — browser client
│   │       └── server.ts                       # CREATE — SSR client
│   ├── types/
│   │   └── index.ts                            # CREATE — Location, Instant, etc. (spec §11)
│   └── components/
│       └── providers/
│           └── SupabaseProvider.tsx            # CREATE — context wrapper
└── db/
    ├── schema.sql                              # CREATE — full schema
    ├── rls.sql                                 # CREATE — policies
    └── seed.sql                                # CREATE — locations + demo
```

## Dependencies

- **External services:** Supabase project (project URL, anon key, service role key), Mapbox account (`NEXT_PUBLIC_MAPBOX_TOKEN`), Anthropic key (`ANTHROPIC_API_KEY`).
- **NPM:** `@supabase/ssr`, `@supabase/supabase-js`, `mapbox-gl`, `@anthropic-ai/sdk`, `zustand`, `lucide-react`, `@vercel/og`.
- **Postgres extensions:** `postgis`, `pg_trgm`, `uuid-ossp` — enabled via `CREATE EXTENSION`.

### `.env.local` template

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Implementation notes

### Schema SQL (paste into Supabase SQL editor)

Source: spec §3.1–§3.4. Run in order:
1. `CREATE EXTENSION IF NOT EXISTS "postgis";` (and `pg_trgm`, `uuid-ossp`)
2. `profiles`, `locations`, `instants`, `instant_reactions`, `ai_queries`, `favorites`, `favorite_collections`
3. All GIST + btree indexes
4. `active_instants` view
5. RPCs: `calculate_pulse_score(loc_id UUID)`, `find_nearest_zone(lat FLOAT, lng FLOAT)`, `cleanup_expired_instants()`

**Gotcha:** Default for `instants.type` is `'general'` in spec but `'general'` isn't in the API type union. Change default to `'text'` OR keep `'general'` and normalize in API layer (see master plan conflict #7).

### RLS SQL

Source: spec §12 + §18.1. Enable RLS on every public table. Key policies:
- `instants`: read where `expires_at > now()`, insert if `auth.uid() IS NOT NULL`, update own
- `locations`: public read
- `instant_reactions`: public read, authed insert
- `favorites` / `favorite_collections`: owner-only, except `is_public = true` collections

### Seed SQL

**Tech Park** (8 zones): use a CTE so child zones can reference parent UUID:

```sql
WITH parent AS (
  INSERT INTO locations (name, slug, type, tags, center, radius_meters, is_event_zone)
  VALUES ('Technological Park', 'tech-park', 'venue',
          '{"tech","hackathon","events"}',
          ST_SetSRID(ST_MakePoint(16.4636, 43.5147), 4326)::geography, 300, true)
  RETURNING id
)
INSERT INTO locations (name, slug, type, tags, center, radius_meters, parent_id)
SELECT * FROM (VALUES
  ('Main Hall',       'main-hall',       'zone', '{"presentations","main"}', ST_SetSRID(ST_MakePoint(16.4636, 43.5148), 4326)::geography, 50,  (SELECT id FROM parent)),
  ('Team Area',       'team-area',       'zone', '{"work","teams"}',         ST_SetSRID(ST_MakePoint(16.4638, 43.5146), 4326)::geography, 40,  (SELECT id FROM parent)),
  ('Pitch Area',      'pitch-area',      'zone', '{"pitch","demo"}',         ST_SetSRID(ST_MakePoint(16.4634, 43.5149), 4326)::geography, 30,  (SELECT id FROM parent)),
  ('Food Area',       'food-area',       'zone', '{"food","drinks"}',        ST_SetSRID(ST_MakePoint(16.4640, 43.5145), 4326)::geography, 30,  (SELECT id FROM parent)),
  ('Entrance',        'entrance',        'zone', '{"entry"}',                ST_SetSRID(ST_MakePoint(16.4635, 43.5150), 4326)::geography, 25,  (SELECT id FROM parent)),
  ('Chill Zone',      'chill-zone',      'zone', '{"rest","chill"}',         ST_SetSRID(ST_MakePoint(16.4632, 43.5144), 4326)::geography, 30,  (SELECT id FROM parent)),
  ('Help Zone',       'help-zone',       'zone', '{"help","support"}',       ST_SetSRID(ST_MakePoint(16.4639, 43.5147), 4326)::geography, 25,  (SELECT id FROM parent)),
  ('Networking Zone', 'networking-zone', 'zone', '{"networking","feedback"}',ST_SetSRID(ST_MakePoint(16.4637, 43.5145), 4326)::geography, 30,  (SELECT id FROM parent))
) AS t(name, slug, type, tags, center, radius_meters, parent_id);
```

**Split** (19 locations): from project doc §19. List: Riva, Dioklecijanova palača, Peristil, Pjaca, Prokurative, Matejuška, Zapadna obala, Marjan, Sustipan, Poljud, Spinut, Bačvice, Firule, Žnjan, Trstenik, Meje, Varoš, FESB / Kampus, HNK Split. Use coordinates from spec §9.2 where available; estimate others.

**Demo Instants** (spec §9.3): 5 instants seeded into Main Hall / Team Area / Food Area for the demo.

### Supabase client setup

Use `@supabase/ssr` (not deprecated `auth-helpers`). Pattern:

```ts
// lib/supabase/client.ts — browser
import { createBrowserClient } from '@supabase/ssr';
export const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

```ts
// lib/supabase/server.ts — server components / route handlers
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({name, value, options}) => cookieStore.set(name, value, options)),
    }}
  );
};
```

### Tailwind tokens

Copy spec §20.4 `tailwind.config.ts` verbatim. Verify `colors.pulse.*` and `backdropBlur.glass` are accessible as `bg-pulse-trending`, `backdrop-blur-glass`, etc.

### TypeScript types

Copy spec §11 verbatim into `types/index.ts`. Export `PulseStatus`, `InstantType`, `ReactionType`, `Location`, `Instant`, `LocationDetail`. Add `Favorite`, `FavoriteCollection` from spec §18.3.

## Verification

1. `cd splitpulse-app && npm run dev` — no compile errors
2. Open `http://localhost:3000` — redirects to `/map`
3. `/map` renders dark background with "SPLIT PULSE" header (glass pill)
4. In Supabase SQL editor: `SELECT count(*) FROM locations;` → **27** (1 parent + 8 children + 19 split = 28 actually — recount; expect 28 if Tech Park counted as venue, else 27)
5. `SELECT count(*) FROM instants WHERE expires_at > now();` → **5** (demo seed)
6. Open Network tab — no failed Supabase requests
7. Run `SELECT calculate_pulse_score(id) FROM locations WHERE slug = 'main-hall';` — returns an integer

## Continuation note

If session ends mid-checkpoint:

- **If schema partially run:** check Supabase SQL editor history; pick up at next CREATE TABLE
- **If seed partially run:** `TRUNCATE locations CASCADE; TRUNCATE instants CASCADE;` then re-run seed (idempotent slugs make verification easy)
- **If npm install failed:** delete `node_modules` + `package-lock.json`, retry
- **What's next after this:** start `02_backend_core.md` — the schema/seed it depends on now exists

## References

- Spec §2 (stack), §3 (schema), §9 (seed), §11 (types), §12 (RLS), §20.2/§20.4 (design tokens)
- Project doc §11 (Tech Park zones), §19 (Split locations)
