# Checkpoint 06 — Favorites & Social Sharing

> Favorites + collections + public collection pages + share cards (`@vercel/og`) + Web Share API. The viral-loop layer.

## Goal

Users can save locations, group them into collections, mark collections public, and share a link that opens a beautiful OG-image preview. End state: tap heart on a location → it's in `/favorites`; create "My Sunset Spots" collection, mark public → share link generates correct OG image showing the list.

## Prerequisites

- ✅ Checkpoint 01 (`favorites`, `favorite_collections` tables already in schema)
- ✅ Checkpoint 02 (location API routes exist)
- ✅ Checkpoint 04 (LocationPanel exists; we'll add a FavoriteButton to it)
- ✅ Checkpoint 05 (auth — favorites are owner-scoped)

## Status checklist

### API routes
- [ ] `GET  /api/favorites` — list user's favorites + joined location pulse data
- [ ] `POST /api/favorites` — add favorite (body: `location_id`, optional `note`, `collection_id`)
- [ ] `DELETE /api/favorites/[id]` — remove
- [ ] `GET  /api/collections` — list user's collections + favorite counts
- [ ] `POST /api/collections` — create (`name`, `emoji`, `is_public`)
- [ ] `PATCH /api/collections/[id]` — rename / change emoji / toggle public / generate `share_slug`
- [ ] `DELETE /api/collections/[id]`
- [ ] `GET  /api/share/collection/[slug]` — public read (RLS allows when `is_public = true`)

### UI
- [ ] `components/favorites/FavoriteButton.tsx` — heart toggle on LocationPanel
- [ ] `app/favorites/page.tsx` — grouped by collection + uncategorized
- [ ] `components/favorites/FavoritesList.tsx`
- [ ] `components/favorites/CollectionCard.tsx`
- [ ] `components/favorites/AddToCollection.tsx` — modal: pick existing or create new
- [ ] `app/collection/[slug]/page.tsx` — public shared collection view (works unauthenticated)

### Share infrastructure
- [ ] `app/api/og/location/[slug]/route.tsx` — dynamic OG image (spec §19.2)
- [ ] `app/api/og/collection/[slug]/route.tsx` — collection share card
- [ ] `app/api/og/instant/[id]/route.tsx` — Instant share card (project doc share examples)
- [ ] `lib/utils/share.ts` — Web Share API + clipboard fallback (spec §19.3)
- [ ] Share button on: LocationPanel, InstantCard, FavoriteCollection page
- [ ] `generateMetadata()` in `app/location/[slug]/page.tsx`, `app/collection/[slug]/page.tsx`, `app/map/page.tsx`

## Files to create / edit

```
splitpulse-app/
├── app/
│   ├── favorites/page.tsx                          # CREATE
│   ├── collection/[slug]/page.tsx                  # CREATE — public
│   └── api/
│       ├── favorites/
│       │   ├── route.ts                            # GET, POST
│       │   └── [id]/route.ts                       # DELETE
│       ├── collections/
│       │   ├── route.ts                            # GET, POST
│       │   └── [id]/route.ts                       # PATCH, DELETE
│       ├── share/collection/[slug]/route.ts        # GET (public)
│       └── og/
│           ├── location/[slug]/route.tsx
│           ├── collection/[slug]/route.tsx
│           └── instant/[id]/route.tsx
├── components/favorites/{FavoriteButton,FavoritesList,CollectionCard,AddToCollection}.tsx
├── components/ui/ShareButton.tsx                   # CREATE — wraps utils/share
└── lib/utils/share.ts                              # CREATE
```

## Dependencies

- ✅ `@vercel/og` (from 01)
- ✅ All Supabase setup
- No new packages

## Implementation notes

### Share slug generation

When user toggles a collection public, generate a slug like `petar-sunset-spots-a3f9`:

```ts
function generateShareSlug(name: string, userName: string): string {
  const base = `${slugify(userName)}-${slugify(name)}`;
  const suffix = randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}
```

Persist on `favorite_collections.share_slug`. Index already exists per spec §18.1.

### OG image — location card (spec §19.2)

```tsx
// app/api/og/location/[slug]/route.tsx
import { ImageResponse } from '@vercel/og';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: location } = await supabase
    .from('locations')
    .select('name, pulse_status, pulse_score')
    .eq('slug', slug)
    .single();

  if (!location) return new Response('Not found', { status: 404 });

  const { count } = await supabase
    .from('active_instants')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', location.id);

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0d1b2a 100%)',
        width: '100%', height: '100%', padding: 48,
        fontFamily: 'DM Sans, sans-serif', color: 'white',
      }}>
        <div style={{ color: '#ffffff80', fontSize: 20 }}>SPLIT PULSE</div>
        <div style={{ color: '#fff', fontSize: 64, marginTop: 24, lineHeight: 1.2 }}>
          {location.name} is {location.pulse_status} 🔥
        </div>
        <div style={{ color: '#ffffff90', fontSize: 28, marginTop: 16 }}>
          {location.pulse_score} pulse · {count} instants
        </div>
        <div style={{ color: '#00d4ff', fontSize: 22, marginTop: 'auto' }}>
          splitpulse.app/location/{slug}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

### Collection OG card (project doc "share card za favorite listu")

Layout: emoji header + collection name + numbered list of favorites (top 5).

### Share helper

```ts
// lib/utils/share.ts
export async function shareContent({ title, text, url }: { title: string; text: string; url: string }) {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try { await navigator.share({ title, text, url }); return; } catch {}
  }
  await navigator.clipboard.writeText(url);
  // caller should toast "Link copied"
}
```

### FavoriteButton optimistic UI

```tsx
const toggle = async () => {
  const wasFavorite = isFavorite;
  setOptimistic(!wasFavorite);
  const method = wasFavorite ? 'DELETE' : 'POST';
  const url = wasFavorite ? `/api/favorites/${favoriteId}` : '/api/favorites';
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ location_id: location.id }) : undefined,
  });
  if (!r.ok) setOptimistic(wasFavorite);  // rollback
};
```

### Public collection page

Anyone (even unauthenticated) can view `/collection/[slug]` if `is_public = true`. The RLS policy from spec §18.1 already supports this. Don't require login on this route — drive sign-up via a "Sign up to save" CTA.

### `generateMetadata` for sharing

```ts
// app/location/[slug]/page.tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  return {
    title: `${location.name} — SPLIT PULSE`,
    description: `${location.name} is ${location.pulse_status}. See what's happening now.`,
    openGraph: { images: [`/api/og/location/${slug}`] },
    twitter: { card: 'summary_large_image', images: [`/api/og/location/${slug}`] },
  };
}
```

## Verification

1. On LocationPanel, tap heart → check `/api/favorites` returns the new row
2. Go to `/favorites` → location appears with current pulse data
3. Create a collection "Sunset Spots" with 🌅, add 3 locations
4. Toggle public → `share_slug` populated → open `/collection/sunset-spots-xxxx` in incognito → page loads
5. Paste collection URL in iMessage / Slack → OG image renders correctly
6. Tap share button on a location → mobile native share sheet appears (Web Share API)
7. RLS test: sign out, try `GET /api/favorites` → 401 / empty list

## Continuation note

If session ends mid-checkpoint:

- **If OG image returns 500:** the `runtime = 'edge'` requirement means no Node-only APIs in that route
- **If favorites don't show up:** double-check RLS policies from spec §18.1 are applied (run `\d+ favorites` in Supabase SQL editor)
- **What's next after this:** start `07_testing.md`

## References

- Spec §18 (favorites schema + API), §19 (sharing, OG images)
- Project doc "Favorites + Social Sharing" section + viral loop examples
