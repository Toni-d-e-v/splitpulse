# Checkpoint 08 — Deploy

> Vercel production deployment, env vars, Supabase Storage bucket, QR code generation, launch checklist.

## Goal

Ship the app live. End state: `https://splitpulse.vercel.app/map?focus=tech-park` loads on real mobile devices; printed QR code drives users to the live URL; AI summaries work; Realtime updates work; photo uploads work.

## Prerequisites

- ✅ Checkpoints 01–07 complete
- Vercel account (free tier OK)
- Vercel CLI installed (`npm i -g vercel`) — optional, dashboard works too
- Domain plan: use default `splitpulse.vercel.app` for hackathon (custom domain post-event)

## Status checklist

### Vercel project setup
- [ ] Connect git repo to Vercel (or use `vercel --prod` deploy)
- [ ] Set framework preset to "Next.js" (auto-detected)
- [ ] Set region to `fra1` (closest to Split)
- [ ] Add `vercel.json` (config below)

### Environment variables (Vercel dashboard → Settings → Environment Variables)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — Production + Preview
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Production + Preview
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Production only (sensitive)
- [ ] `NEXT_PUBLIC_MAPBOX_TOKEN` — Production + Preview
- [ ] `ANTHROPIC_API_KEY` — Production only (sensitive)
- [ ] `NEXT_PUBLIC_APP_URL=https://splitpulse.vercel.app` — Production
- [ ] `NEXT_PUBLIC_APP_URL=$VERCEL_URL` — Preview

### Supabase production setup
- [ ] Create Storage bucket `instant-photos`, public read, max file size 5MB
- [ ] Storage transform: max width 800px (Supabase image transformations)
- [ ] Add Vercel deployment URL to Supabase Auth → URL Configuration → Site URL
- [ ] Add `https://splitpulse.vercel.app/auth/callback` to Redirect URLs
- [ ] Update Google OAuth redirect URI in Google Cloud Console to match

### Cron jobs
- [ ] In Supabase, verify `pg_cron` jobs from checkpoint 03 are active (`SELECT * FROM cron.job;`)
- [ ] OR add Vercel cron in `vercel.json` calling protected `/api/cron/recalc`
- [ ] OR add Vercel cron calling `/api/cron/cleanup` (for `cleanup_expired_instants`)

### Production verification
- [ ] First deploy succeeds (`vercel --prod` or git push)
- [ ] Open `https://splitpulse.vercel.app` — redirects to `/map`
- [ ] Open from real mobile device — heatmap renders, GPS prompt works
- [ ] Post text Instant → appears on map
- [ ] Post photo Instant → uploads to Storage → renders in feed
- [ ] AI summary works
- [ ] Sign in with Google works
- [ ] Realtime works between two real devices

### QR code
- [ ] Generate QR pointing to `https://splitpulse.vercel.app?zone=tech-park`
- [ ] Use https://qrcode-generator.com or `qrencode` CLI
- [ ] Embed Pulse-themed background (optional polish)
- [ ] Print at A5 size minimum
- [ ] Backup: QR also printed on demo phone wallpaper / slide

### Launch
- [ ] Smoke test deployment one final time, 1h before demo
- [ ] Have backup network (mobile hotspot) ready
- [ ] Have demo script (`docs/demo-script.md`) printed

## Files to create / edit

```
splitpulse-app/
├── vercel.json                              # CREATE
├── app/api/cron/
│   ├── recalc/route.ts                      # CREATE (if not using pg_cron)
│   └── cleanup/route.ts                     # CREATE (if not using pg_cron)
└── public/
    └── qr.png                               # CREATE — printable QR
```

## Dependencies

- Vercel account
- Supabase production project (can be same as dev for hackathon)
- Anthropic production API key (different from dev recommended; OK to share for hackathon)

## Implementation notes

### `vercel.json`

```json
{
  "framework": "nextjs",
  "regions": ["fra1"],
  "crons": [
    { "path": "/api/cron/recalc",  "schedule": "*/2 * * * *" },
    { "path": "/api/cron/cleanup", "schedule": "0 * * * *" }
  ]
}
```

### Protected cron endpoints

If using Vercel cron (not pg_cron), Vercel sends a header `Authorization: Bearer <CRON_SECRET>`. Verify:

```ts
// app/api/cron/recalc/route.ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response('Unauthorized', { status: 401 });

  const supabase = createServiceClient(); // uses SUPABASE_SERVICE_ROLE_KEY
  const { data: zones } = await supabase
    .from('locations')
    .select('id')
    .neq('pulse_status', 'quiet');

  await Promise.all(zones.map(z => supabase.rpc('calculate_pulse_score', { loc_id: z.id })));
  return Response.json({ updated: zones.length });
}
```

Add `CRON_SECRET` to Vercel env vars (random 32-byte hex).

### Service-role client

Don't use the SSR cookie client for cron / background work — it has no auth context. Add:

```ts
// lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js';
export const createServiceClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
```

### Storage bucket setup

```sql
-- In Supabase SQL editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('instant-photos', 'instant-photos', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/heic']);

-- Public read policy
CREATE POLICY "Public read instant photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'instant-photos');

-- Authenticated insert
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'instant-photos' AND auth.uid() IS NOT NULL);
```

### Image upload pattern (from API route)

```ts
const filename = `${user.id}/${Date.now()}-${crypto.randomUUID()}.jpg`;
const { error: upErr } = await supabase.storage
  .from('instant-photos')
  .upload(filename, imageFile, { contentType: 'image/jpeg' });
const { data: { publicUrl } } = supabase.storage
  .from('instant-photos')
  .getPublicUrl(filename, { transform: { width: 800, resize: 'contain' } });
```

### QR generation

```bash
# Quickest path
brew install qrencode  # or apt-get install qrencode
qrencode -o public/qr.png -s 12 -m 4 'https://splitpulse.vercel.app?zone=tech-park'
```

Or use https://qrcode-generator.com for a styled QR with colors matching the brand (`#00d4ff` on `#0a0a1a`).

### Custom domain (post-hackathon)

Vercel → Domains → add `splitpulse.app`. Update Supabase auth redirect, Google OAuth redirect, env `NEXT_PUBLIC_APP_URL`. Skip for hackathon.

## Verification

1. `curl -I https://splitpulse.vercel.app` → 200 / 308 to `/map`
2. From mobile device on cellular (not WiFi): post Instant → succeeds
3. From two devices: realtime works across them
4. AI summary returns within 5s
5. OG image URL renders correctly: `curl -o /tmp/og.png https://splitpulse.vercel.app/api/og/location/tech-park && open /tmp/og.png`
6. QR scan on iPhone Camera app → opens Safari to deployed URL
7. Vercel dashboard → Functions → no error spikes

## Continuation note

If session ends mid-checkpoint:

- **If build fails on Vercel:** check Build Logs; missing env var is the #1 cause
- **If Supabase auth redirect mismatch:** verify Site URL + Redirect URLs include both `localhost:3000` (dev) and Vercel URL (prod)
- **If pg_cron unavailable:** fall back to Vercel cron (already in `vercel.json` template)
- **If hit deploy at demo time:** keep `git revert` ready — better to demo last known good build than a broken latest

## References

- Spec §10 (env vars), §14 (deployment), §15 (QR code), §16 (perf), §17 (file naming)
- Vercel docs: https://vercel.com/docs/cron-jobs
- Supabase docs: https://supabase.com/docs/guides/storage
