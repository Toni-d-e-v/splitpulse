# Checkpoint 02 — Backend Core

> All API routes (instants, locations, AI summary, AI ask). Defines the contract the frontend will consume. No UI work here.

## Goal

Implement the full set of Next.js route handlers under `app/api/`. Each route returns typed JSON, handles errors, and respects RLS. End state: every API in spec §5 returns 200 with valid data when called via `curl` or Postman.

## Prerequisites

- ✅ Checkpoint 01 complete (schema, seed, Supabase clients)

## Status checklist

- [ ] `GET /api/locations` — list all locations with pulse data
- [ ] `GET /api/locations/[slug]` — detail + `active_instants` joined + active user count
- [ ] `POST /api/locations/[slug]/pulse` — call `calculate_pulse_score()` RPC, return new score
- [ ] `GET /api/instants` — query params `location_id`, `type`, `limit` (default 50)
- [ ] `POST /api/instants` — body validation, expires_at calc, zone match via RPC, image upload to Storage if `image` present
- [ ] `PATCH /api/instants/[id]` — mark `is_resolved = true` (owner only)
- [ ] `POST /api/instants/[id]/react` — confirm | helpful | answer; updates counters
- [ ] `POST /api/ai/summary` — Anthropic call, 5-min in-memory cache keyed by `location_id`
- [ ] `POST /api/ai/ask` — free-form question, includes location context
- [ ] `POST /api/auth/guest` — `supabase.auth.signInAnonymously()`
- [ ] `POST /api/auth/pulse-name` — set `profiles.pulse_name` (unique check)
- [ ] Add shared error helper `lib/api/errors.ts` (returns `{ error, code }` JSON)
- [ ] Add zod schemas in `lib/api/schemas.ts` for request validation
- [ ] All routes use `lib/supabase/server.ts` client (cookie-aware)
- [ ] `POST /api/instants` and `/api/ai/*` are tested with `curl` (snippets below)

## Files to create / edit

```
splitpulse-app/
├── app/api/
│   ├── instants/
│   │   ├── route.ts                       # GET, POST
│   │   └── [id]/
│   │       ├── route.ts                   # PATCH
│   │       └── react/
│   │           └── route.ts               # POST
│   ├── locations/
│   │   ├── route.ts                       # GET
│   │   └── [slug]/
│   │       ├── route.ts                   # GET
│   │       └── pulse/
│   │           └── route.ts               # POST
│   ├── ai/
│   │   ├── summary/route.ts               # POST
│   │   └── ask/route.ts                   # POST
│   └── auth/
│       ├── guest/route.ts                 # POST
│       └── pulse-name/route.ts            # POST
├── lib/
│   ├── api/
│   │   ├── errors.ts                      # CREATE — error helper
│   │   ├── schemas.ts                     # CREATE — zod schemas
│   │   ├── expiration.ts                  # CREATE — EXPIRY_MAP + calcExpiresAt
│   │   └── ai-cache.ts                    # CREATE — Map-based 5-min cache
│   └── anthropic.ts                       # CREATE — Anthropic client singleton
```

## Dependencies

- **NPM (additional):** `zod` for validation
- **Existing:** `@anthropic-ai/sdk` (installed in 01)
- **Env vars used:** `SUPABASE_SERVICE_ROLE_KEY` (for `POST /api/instants` upload only), `ANTHROPIC_API_KEY`

## Implementation notes

### Server-side expiration (spec §5.1)

```ts
// lib/api/expiration.ts
const EXPIRY_MINUTES: Record<string, number> = {
  crowd: 60, event: 480, help: 120, question: 240,
  recommendation: 360, warning: 120,
  photo: 1440, text: 1440, general: 1440,
};
export const calcExpiresAt = (type: string): Date =>
  new Date(Date.now() + (EXPIRY_MINUTES[type] ?? 1440) * 60_000);
```

### Zone matching

If client doesn't supply `location_id`, call `find_nearest_zone` RPC:

```ts
const { data: zoneId } = await supabase.rpc('find_nearest_zone', { lat, lng });
if (!zoneId) return errorResponse('No zone matched. Post anywhere not yet supported.', 'NO_ZONE');
```

If no zone matches and lat/lng is far from all zones, **reject** for MVP (don't create orphan Instants). Future: allow free-form posting.

### POST /api/instants — full flow

1. Authenticate via cookie-aware Supabase client; reject if no `user.id`
2. Parse `multipart/form-data` if `image` present; else JSON
3. Validate with zod schema (`CreateInstantSchema`)
4. If `image`: upload to Supabase Storage bucket `instant-photos`, get public URL
5. Resolve `location_id` (use provided or `find_nearest_zone`)
6. Compute `expires_at` from type
7. Insert row, return joined Instant with location info
8. **Trigger pulse recalc** (fire-and-forget): `supabase.rpc('calculate_pulse_score', { loc_id })` — don't await

### AI summary cache (spec §16)

```ts
// lib/api/ai-cache.ts
const cache = new Map<string, { value: string; expiresAt: number }>();
export const getCached = (key: string) => {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  return null;
};
export const setCached = (key: string, value: string, ttlMs = 5 * 60_000) =>
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
```

Note: in-memory cache is per-Vercel-instance, not global. Acceptable for hackathon. Promote to Supabase table or Redis later.

### Anthropic call

Use latest stable model. Per master plan: `claude-sonnet-4-5` (replace `claude-sonnet-4-20250514` from spec — that ID may be stale).

```ts
// lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
export const MODEL_SUMMARY = 'claude-sonnet-4-5';
```

System prompt for `/api/ai/summary` (adapt spec §5.3):
```
You are the AI brain of SPLIT PULSE, a live city heat map app.
Summarize what is happening at a location based on recent Location Instants.
Be concise, useful, and real-time focused. Max 2-3 sentences.
Location: ${location.name} (${location.type})
Pulse status: ${location.pulse_status} (score: ${location.pulse_score})
Respond in the language of the majority of Instants (Croatian or English).
```

### `POST /api/ai/ask` (spec §5.3 implied)

Same pattern as `/api/ai/summary` but accepts a free-form `question` in body. Include the last 20 active Instants as context. Log to `ai_queries` table.

### Auth endpoints

```ts
// app/api/auth/guest/route.ts
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return errorResponse(error.message, 'AUTH_FAILED');
  return Response.json({ user: data.user });
}
```

```ts
// app/api/auth/pulse-name/route.ts
export async function POST(req: Request) {
  const supabase = await createClient();
  const { pulse_name } = await req.json();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse('Not authenticated', 'NO_AUTH', 401);
  // upsert into profiles
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, pulse_name });
  if (error?.code === '23505') return errorResponse('Pulse name taken', 'DUP_NAME', 409);
  return Response.json({ pulse_name });
}
```

### Profile bootstrap

Add a Supabase trigger (in `db/schema.sql` or a migration) so `auth.users` insert creates a `profiles` row:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## Verification

Run with `curl` after `npm run dev`:

```bash
# 1. List locations
curl http://localhost:3000/api/locations | jq

# 2. Get tech-park detail
curl http://localhost:3000/api/locations/tech-park | jq

# 3. Anonymous sign-in (set cookies for next calls)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/guest

# 4. Set pulse name
curl -b cookies.txt -X POST http://localhost:3000/api/auth/pulse-name \
  -H 'Content-Type: application/json' \
  -d '{"pulse_name": "tester1"}'

# 5. Post a text Instant
curl -b cookies.txt -X POST http://localhost:3000/api/instants \
  -H 'Content-Type: application/json' \
  -d '{"type":"text","content":"testing API","latitude":43.5148,"longitude":16.4636}' | jq

# 6. Trigger pulse recalc
curl -X POST http://localhost:3000/api/locations/main-hall/pulse | jq

# 7. AI summary
curl -X POST http://localhost:3000/api/ai/summary \
  -H 'Content-Type: application/json' \
  -d '{"location_id":"<main-hall-uuid>"}' | jq
```

Expected: all return 200 with sensible JSON.

## Continuation note

If session ends mid-checkpoint:

- Which routes are done is visible in the `app/api/` tree — `ls -R app/api/`
- Each route is independent; pick any unfinished one
- If `/api/instants POST` is broken, leave a stub returning 200 so frontend isn't blocked
- **What's next after this:** start `03_realtime.md` (Supabase Realtime subscriptions)

## References

- Spec §5 (all routes), §5.3 (AI), §5.4 (auth), §16 (caching note)
