# SPLIT PULSE — Technical Specification

> Implementation blueprint for Claude Code. Stack: Next.js 14 (App Router) + Supabase + Vercel.

---

## 1. Project Overview

**SPLIT PULSE** is a live city heat map powered by GPS-based disappearing Location Instants. Users open the app, see where the city is active, post quick Instants tied to GPS, and watch the heat map change in real time.

**MVP scope:** Hackathon demo focused on Technological Park, Split as the first live zone.

**One-liner:** *A live heat map of the city powered by GPS-based disappearing Instants.*

---

## 2. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 14** (App Router) | SSR, API routes, mobile-first PWA |
| Database | **Supabase** (PostgreSQL + Realtime) | Auth, DB, realtime subscriptions, Row Level Security |
| Auth | **Supabase Auth** | Guest sessions, Google OAuth, anonymous/pulse-name login |
| Maps | **Mapbox GL JS** or **Leaflet + OpenStreetMap** | Heat map layer, markers, interactive map |
| Realtime | **Supabase Realtime** (Postgres Changes) | Live Instant feed, pulse score updates |
| AI | **Anthropic API** (Claude Sonnet) | Location summaries, "what's happening here" queries |
| Hosting | **Vercel** | Zero-config Next.js deployment |
| Storage | **Supabase Storage** | Photo Instant images |
| Styling | **Tailwind CSS** | Rapid mobile-first UI |
| State | **Zustand** or React Context | Client-side map/filter state |

---

## 3. Database Schema (Supabase / PostgreSQL)

### 3.1 Enable Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "postgis";          -- geo queries
CREATE EXTENSION IF NOT EXISTS "pg_trgm";           -- text search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";         -- uuid generation
```

### 3.2 Tables

#### `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pulse_name TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  streak_count INT DEFAULT 0,
  streak_last_date DATE,
  pulse_points INT DEFAULT 0,
  helper_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `locations`

Pre-seeded zones (Technological Park sub-zones + Split locations).

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'zone',          -- 'zone' | 'venue' | 'area' | 'beach' | 'landmark'
  tags TEXT[] DEFAULT '{}',                    -- e.g. {'coffee','walk','tourists'}
  center GEOGRAPHY(POINT, 4326) NOT NULL,      -- PostGIS point
  radius_meters INT DEFAULT 200,               -- geofence radius
  parent_id UUID REFERENCES locations(id),     -- e.g. "Main Hall" → parent "Technological Park"
  pulse_score INT DEFAULT 0,
  pulse_status TEXT DEFAULT 'quiet',           -- quiet | active | rising | trending | high_pulse | live_event
  is_event_zone BOOLEAN DEFAULT false,
  event_name TEXT,
  event_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_locations_center ON locations USING GIST(center);
CREATE INDEX idx_locations_slug ON locations(slug);
CREATE INDEX idx_locations_pulse_status ON locations(pulse_status);
```

#### `instants`

Core content table — each row is one Location Instant.

```sql
CREATE TABLE instants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),        -- nullable for guest
  location_id UUID REFERENCES locations(id) NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',         -- photo | text | crowd | question | help | event | recommendation | warning
  content TEXT,                                 -- text body (max 280 chars)
  image_url TEXT,                               -- Supabase Storage path
  geo GEOGRAPHY(POINT, 4326) NOT NULL,          -- exact post location
  expires_at TIMESTAMPTZ NOT NULL,              -- auto-calculated based on type
  is_resolved BOOLEAN DEFAULT false,            -- for questions/help
  confirm_count INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_instants_location ON instants(location_id);
CREATE INDEX idx_instants_geo ON instants USING GIST(geo);
CREATE INDEX idx_instants_expires ON instants(expires_at);
CREATE INDEX idx_instants_type ON instants(type);
CREATE INDEX idx_instants_created ON instants(created_at DESC);
```

#### `instant_reactions`

Confirmations, helpful marks, answers.

```sql
CREATE TABLE instant_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instant_id UUID REFERENCES instants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,                           -- 'confirm' | 'helpful' | 'answer'
  content TEXT,                                 -- answer text if type = 'answer'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instant_id, user_id, type)             -- one reaction per type per user
);
```

#### `ai_queries`

Log of AI summary requests per location.

```sql
CREATE TABLE ai_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  location_id UUID REFERENCES locations(id),
  query TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Views

#### `active_instants` — only non-expired Instants

```sql
CREATE OR REPLACE VIEW active_instants AS
SELECT * FROM instants
WHERE expires_at > now()
  AND is_resolved = false
ORDER BY created_at DESC;
```

### 3.4 RPC Functions

#### Pulse Score Calculation

```sql
CREATE OR REPLACE FUNCTION calculate_pulse_score(loc_id UUID)
RETURNS INT AS $$
DECLARE
  score INT;
BEGIN
  SELECT
    COALESCE(COUNT(DISTINCT i.user_id), 0)                                        -- active_sessions
    + COALESCE(COUNT(i.id) FILTER (WHERE i.created_at > now() - interval '30 min'), 0) * 4  -- instants_last_30_min
    + COALESCE(SUM(i.confirm_count) FILTER (WHERE i.created_at > now() - interval '30 min'), 0) * 5
    + COALESCE(COUNT(i.id) FILTER (WHERE i.type = 'question' AND i.created_at > now() - interval '30 min'), 0) * 3
    + COALESCE((SELECT COUNT(*) FROM instant_reactions r JOIN instants i2 ON r.instant_id = i2.id WHERE i2.location_id = loc_id AND r.type = 'answer' AND r.created_at > now() - interval '30 min'), 0) * 4
    + COALESCE(COUNT(i.id) FILTER (WHERE i.type = 'question' AND i.is_resolved = true AND i.created_at > now() - interval '60 min'), 0) * 6
    + COALESCE((SELECT COUNT(*) FROM ai_queries q WHERE q.location_id = loc_id AND q.created_at > now() - interval '30 min'), 0) * 2
  INTO score
  FROM instants i
  WHERE i.location_id = loc_id
    AND i.expires_at > now();

  -- Update location
  UPDATE locations SET
    pulse_score = score,
    pulse_status = CASE
      WHEN score >= 100 THEN 'high_pulse'
      WHEN score >= 61 THEN 'trending'
      WHEN score >= 31 THEN 'rising'
      WHEN score >= 11 THEN 'active'
      ELSE 'quiet'
    END,
    updated_at = now()  -- not in schema above, add if needed
  WHERE id = loc_id;

  RETURN score;
END;
$$ LANGUAGE plpgsql;
```

#### Expire Old Instants (cron or edge function)

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_instants()
RETURNS void AS $$
BEGIN
  DELETE FROM instants WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Supabase Realtime Setup

Enable Realtime on these tables in Supabase Dashboard → Database → Replication:

- `instants` — INSERT, UPDATE, DELETE
- `locations` — UPDATE (pulse_score / pulse_status changes)
- `instant_reactions` — INSERT

Client subscribes to channels:

```typescript
// Subscribe to new Instants
supabase
  .channel('instants-feed')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'instants',
  }, (payload) => {
    addInstantToMap(payload.new);
  })
  .subscribe();

// Subscribe to location pulse updates
supabase
  .channel('pulse-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'locations',
    filter: 'pulse_status=neq.quiet',
  }, (payload) => {
    updateHeatMap(payload.new);
  })
  .subscribe();
```

---

## 5. API Routes (Next.js App Router)

All under `app/api/`.

### 5.1 Instants

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/instants` | Fetch active instants (query: `location_id`, `type`, `limit`) |
| `POST` | `/api/instants` | Create new Instant |
| `PATCH` | `/api/instants/[id]` | Mark as resolved |
| `POST` | `/api/instants/[id]/react` | Confirm / helpful / answer |

#### `POST /api/instants` — Request Body

```typescript
interface CreateInstantRequest {
  type: 'photo' | 'text' | 'crowd' | 'question' | 'help' | 'event' | 'recommendation' | 'warning';
  content?: string;         // max 280 chars
  image?: File;             // photo instant
  latitude: number;
  longitude: number;
  location_id?: string;     // auto-resolved if not provided
  is_anonymous?: boolean;
}
```

#### Expiration Logic (server-side)

```typescript
const EXPIRY_MAP: Record<string, number> = {
  crowd: 60,            // minutes
  event: 480,           // 8 hours (or event end)
  help: 120,
  question: 240,
  recommendation: 360,
  warning: 120,
  photo: 1440,          // 24 hours
  text: 1440,
};
```

### 5.2 Locations

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/locations` | All locations with pulse scores |
| `GET` | `/api/locations/[slug]` | Location detail + active instants + AI summary |
| `POST` | `/api/locations/[slug]/pulse` | Trigger pulse recalculation |

### 5.3 AI Summary

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/ai/summary` | Generate AI summary for a location |
| `POST` | `/api/ai/ask` | Ask a question about a location ("What's happening here?") |

#### AI Summary Implementation

```typescript
// app/api/ai/summary/route.ts
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  const { location_id } = await req.json();

  // Fetch active instants for location
  const { data: instants } = await supabase
    .from('active_instants')
    .select('*')
    .eq('location_id', location_id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch location info
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('id', location_id)
    .single();

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: `You are the AI brain of SPLIT PULSE, a live city heat map app. 
Summarize what is happening at a location based on recent Location Instants. 
Be concise, useful, and real-time focused. Max 2-3 sentences.
Location: ${location.name} (${location.type})
Pulse status: ${location.pulse_status} (score: ${location.pulse_score})`,
    messages: [{
      role: 'user',
      content: `Summarize these recent Instants:\n${instants.map(
        (i: any) => `[${i.type}] ${i.content} (${timeAgo(i.created_at)})`
      ).join('\n')}`
    }]
  });

  return Response.json({ summary: message.content[0].text });
}
```

### 5.4 Auth

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/guest` | Create anonymous session |
| `POST` | `/api/auth/pulse-name` | Set pulse name for session |

---

## 6. Frontend Architecture

### 6.1 Route Structure

```
app/
├── layout.tsx                    # Root layout, Supabase provider, fonts
├── page.tsx                      # Landing / QR redirect → /map
├── map/
│   ├── page.tsx                  # Main heat map view (core screen)
│   └── layout.tsx                # Map layout with bottom sheet support
├── instant/
│   └── new/
│       └── page.tsx              # Post Instant flow (camera/text)
├── location/
│   └── [slug]/
│       └── page.tsx              # Location detail panel
├── login/
│   └── page.tsx                  # Guest / Pulse name / Google
├── api/
│   ├── instants/
│   ├── locations/
│   ├── ai/
│   └── auth/
└── components/
    ├── map/
    │   ├── HeatMap.tsx            # Mapbox/Leaflet heat layer
    │   ├── InstantMarker.tsx      # Individual instant on map
    │   ├── LocationCluster.tsx    # Grouped instants per zone
    │   └── PulseOverlay.tsx       # Animated pulse rings
    ├── instant/
    │   ├── InstantCard.tsx        # Instant display card
    │   ├── InstantFeed.tsx        # Scrollable instant list
    │   ├── PostInstantButton.tsx  # Floating "Instant" button
    │   ├── CameraCapture.tsx      # Camera-first capture
    │   └── TypeSelector.tsx       # Instant type picker
    ├── location/
    │   ├── LocationPanel.tsx      # Bottom sheet location detail
    │   ├── PulseStatus.tsx        # Status badge (quiet/active/trending...)
    │   └── AISummary.tsx          # AI summary component
    ├── ui/
    │   ├── BottomSheet.tsx        # Draggable bottom sheet
    │   ├── FloatingButton.tsx
    │   └── Badge.tsx
    └── providers/
        ├── SupabaseProvider.tsx
        ├── MapProvider.tsx
        └── RealtimeProvider.tsx
```

### 6.2 Core Screen: Heat Map (`/map`)

This is the main view. User sees it immediately after opening the app.

```
┌─────────────────────────────────┐
│  SPLIT PULSE          [profile] │  ← minimal header
│─────────────────────────────────│
│                                 │
│         ┌───────────┐           │
│         │  HEAT MAP │           │
│         │           │           │
│    ●    │  zones    │    ●      │  ← colored zones
│         │  markers  │           │
│         │  pulses   │           │
│         └───────────┘           │
│              ●                  │
│                                 │
│   [filter: all | crowd | help]  │  ← horizontal scroll filters
│─────────────────────────────────│
│  ┌─ Bottom Sheet ─────────────┐ │
│  │ 📍 Technological Park       │ │  ← draggable
│  │ 🔥 High Pulse • 12 Instants│ │
│  │ Latest: "Pitch starting..."│ │
│  └─────────────────────────────┘ │
│                                 │
│        [ ⚡ INSTANT ]           │  ← big floating button
└─────────────────────────────────┘
```

### 6.3 Post Instant Flow

1. User taps **⚡ INSTANT** button
2. Full-screen modal opens
3. Two options: **Camera** (default) or **Text**
4. If camera: capture photo → add optional caption
5. If text: type short message (280 char max)
6. Select type (auto-suggested based on content)
7. GPS auto-detected → matched to nearest zone
8. Submit → appears on map in real time
9. Modal closes, map updates

### 6.4 Location Panel (Bottom Sheet)

Opens when user taps a zone on the map.

Content:
- Location name + pulse status badge
- Pulse score + active user count
- Latest Instants feed (scrollable)
- AI Summary (lazy-loaded)
- Action buttons: Post Instant, Ask Here, Navigate
- Follow Location toggle

---

## 7. Heat Map Implementation

### 7.1 Mapbox GL JS Approach (recommended)

```typescript
// components/map/HeatMap.tsx
import mapboxgl from 'mapbox-gl';

const heatmapLayer: mapboxgl.HeatmapLayer = {
  id: 'pulse-heat',
  type: 'heatmap',
  source: 'instants',
  paint: {
    // Weight by pulse contribution
    'heatmap-weight': [
      'interpolate', ['linear'], ['get', 'weight'],
      0, 0,
      10, 1,
    ],
    // Intensity by zoom
    'heatmap-intensity': [
      'interpolate', ['linear'], ['zoom'],
      0, 1,
      15, 3,
    ],
    // Color ramp: quiet → high pulse
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(0,0,0,0)',
      0.2, 'rgba(0,200,255,0.4)',     // quiet - cool blue
      0.4, 'rgba(0,255,128,0.6)',     // active - green
      0.6, 'rgba(255,255,0,0.7)',     // rising - yellow
      0.8, 'rgba(255,128,0,0.85)',    // trending - orange
      1.0, 'rgba(255,40,40,1)',       // high pulse - red
    ],
    'heatmap-radius': [
      'interpolate', ['linear'], ['zoom'],
      0, 2,
      15, 30,
    ],
  },
};
```

### 7.2 Leaflet Fallback (simpler, no API key)

```typescript
import L from 'leaflet';
import 'leaflet.heat';

const heat = L.heatLayer(
  instants.map(i => [i.lat, i.lng, i.weight]),
  {
    radius: 35,
    blur: 25,
    maxZoom: 17,
    gradient: {
      0.2: '#00c8ff',
      0.4: '#00ff80',
      0.6: '#ffff00',
      0.8: '#ff8000',
      1.0: '#ff2828',
    },
  }
).addTo(map);
```

### 7.3 GeoJSON Data Source

```typescript
// Refresh every 30 seconds or via Realtime subscription
const geoData: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: instants.map(instant => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [instant.longitude, instant.latitude],
    },
    properties: {
      id: instant.id,
      type: instant.type,
      weight: getWeight(instant),  // based on type, confirms, recency
      created_at: instant.created_at,
    },
  })),
};
```

---

## 8. Geolocation & Zone Matching

### 8.1 Client-Side Geolocation

```typescript
function useGeolocation() {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      setPosition,
      console.error,
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return position;
}
```

### 8.2 Server-Side Zone Matching (PostGIS)

```sql
-- Find nearest location zone for a GPS point
CREATE OR REPLACE FUNCTION find_nearest_zone(lat FLOAT, lng FLOAT)
RETURNS UUID AS $$
  SELECT id FROM locations
  WHERE ST_DWithin(
    center,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  ORDER BY ST_Distance(
    center,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  )
  LIMIT 1;
$$ LANGUAGE sql;
```

---

## 9. Seed Data

### 9.1 Technological Park Zones

```sql
INSERT INTO locations (name, slug, type, tags, center, radius_meters, parent_id) VALUES
  ('Technological Park', 'tech-park', 'venue', '{"tech","hackathon","events"}',
   ST_SetSRID(ST_MakePoint(16.4636, 43.5147), 4326)::geography, 300, NULL),
  ('Main Hall', 'main-hall', 'zone', '{"presentations","main"}',
   ST_SetSRID(ST_MakePoint(16.4636, 43.5148), 4326)::geography, 50, '<tech-park-uuid>'),
  ('Team Area', 'team-area', 'zone', '{"work","teams"}',
   ST_SetSRID(ST_MakePoint(16.4638, 43.5146), 4326)::geography, 40, '<tech-park-uuid>'),
  ('Pitch Area', 'pitch-area', 'zone', '{"pitch","demo"}',
   ST_SetSRID(ST_MakePoint(16.4634, 43.5149), 4326)::geography, 30, '<tech-park-uuid>'),
  ('Food Area', 'food-area', 'zone', '{"food","drinks"}',
   ST_SetSRID(ST_MakePoint(16.4640, 43.5145), 4326)::geography, 30, '<tech-park-uuid>'),
  ('Chill Zone', 'chill-zone', 'zone', '{"rest","chill"}',
   ST_SetSRID(ST_MakePoint(16.4632, 43.5144), 4326)::geography, 30, '<tech-park-uuid>');
```

### 9.2 Split Locations

```sql
INSERT INTO locations (name, slug, type, tags, center, radius_meters) VALUES
  ('Riva', 'riva', 'area', '{"walk","coffee","tourists","events"}',
   ST_SetSRID(ST_MakePoint(16.4401, 43.5069), 4326)::geography, 400),
  ('Bačvice', 'bacvice', 'beach', '{"beach","nightlife","sport"}',
   ST_SetSRID(ST_MakePoint(16.4500, 43.5020), 4326)::geography, 300),
  ('Matejuška', 'matejuska', 'area', '{"sunset","local","drinks"}',
   ST_SetSRID(ST_MakePoint(16.4340, 43.5060), 4326)::geography, 150),
  ('Marjan', 'marjan', 'area', '{"nature","sport","viewpoints"}',
   ST_SetSRID(ST_MakePoint(16.4150, 43.5100), 4326)::geography, 1000),
  ('Dioklecijanova palača', 'diocletians-palace', 'landmark', '{"culture","tourism","restaurants"}',
   ST_SetSRID(ST_MakePoint(16.4405, 43.5081), 4326)::geography, 250),
  ('Žnjan', 'znjan', 'beach', '{"beach","recreation","family"}',
   ST_SetSRID(ST_MakePoint(16.4780, 43.4990), 4326)::geography, 400),
  ('Poljud', 'poljud', 'venue', '{"sports","concerts","events"}',
   ST_SetSRID(ST_MakePoint(16.4280, 43.5210), 4326)::geography, 300),
  ('Peristil', 'peristil', 'landmark', '{"sightseeing","events","history"}',
   ST_SetSRID(ST_MakePoint(16.4408, 43.5083), 4326)::geography, 100),
  ('FESB / Kampus', 'fesb-kampus', 'area', '{"students","study","events"}',
   ST_SetSRID(ST_MakePoint(16.4680, 43.5130), 4326)::geography, 300);
```

### 9.3 Demo Instants (for hackathon testing)

```sql
INSERT INTO instants (type, content, location_id, geo, expires_at) VALUES
  ('event', 'Pitch počinje za 10 min u Main Hallu.', '<main-hall-uuid>',
   ST_SetSRID(ST_MakePoint(16.4636, 43.5148), 4326)::geography, now() + interval '2 hours'),
  ('crowd', 'Najviše ljudi je trenutno u Team Area.', '<team-area-uuid>',
   ST_SetSRID(ST_MakePoint(16.4638, 43.5146), 4326)::geography, now() + interval '1 hour'),
  ('help', 'Treba nam netko za testirati login flow.', '<team-area-uuid>',
   ST_SetSRID(ST_MakePoint(16.4638, 43.5146), 4326)::geography, now() + interval '2 hours'),
  ('question', 'Ima li netko USB-C punjač?', '<main-hall-uuid>',
   ST_SetSRID(ST_MakePoint(16.4636, 43.5148), 4326)::geography, now() + interval '4 hours'),
  ('text', 'Food area je otvoren.', '<food-area-uuid>',
   ST_SetSRID(ST_MakePoint(16.4640, 43.5145), 4326)::geography, now() + interval '24 hours');
```

---

## 10. Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # server-side only

NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...         # if using Mapbox
ANTHROPIC_API_KEY=sk-ant-...               # server-side only

NEXT_PUBLIC_APP_URL=https://splitpulse.vercel.app
```

---

## 11. Key TypeScript Types

```typescript
// types/index.ts

export type PulseStatus = 'quiet' | 'active' | 'rising' | 'trending' | 'high_pulse' | 'live_event';

export type InstantType = 'photo' | 'text' | 'crowd' | 'question' | 'help' | 'event' | 'recommendation' | 'warning';

export type ReactionType = 'confirm' | 'helpful' | 'answer';

export interface Location {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  tags: string[];
  latitude: number;
  longitude: number;
  radius_meters: number;
  parent_id: string | null;
  pulse_score: number;
  pulse_status: PulseStatus;
  is_event_zone: boolean;
  event_name: string | null;
  event_ends_at: string | null;
}

export interface Instant {
  id: string;
  user_id: string | null;
  location_id: string;
  type: InstantType;
  content: string | null;
  image_url: string | null;
  latitude: number;
  longitude: number;
  expires_at: string;
  is_resolved: boolean;
  confirm_count: number;
  helpful_count: number;
  is_anonymous: boolean;
  created_at: string;
  // joined
  location?: Location;
  profile?: { pulse_name: string; avatar_url: string | null };
}

export interface LocationDetail extends Location {
  active_instants: Instant[];
  ai_summary: string | null;
  active_users_count: number;
}
```

---

## 12. Supabase Row Level Security (RLS)

```sql
-- Instants: anyone can read active, authenticated can insert
ALTER TABLE instants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active instants"
  ON instants FOR SELECT USING (expires_at > now());

CREATE POLICY "Authenticated users can create instants"
  ON instants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own instants"
  ON instants FOR UPDATE USING (auth.uid() = user_id);

-- Locations: anyone can read
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read locations"
  ON locations FOR SELECT USING (true);

-- Reactions: anyone can read, authenticated can insert
ALTER TABLE instant_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions"
  ON instant_reactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can react"
  ON instant_reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

---

## 13. Implementation Order (Hackathon Priority)

### Phase 1: Foundation (first 2-3 hours)
1. `npx create-next-app@latest split-pulse --typescript --tailwind --app`
2. Set up Supabase project + run schema SQL
3. Seed locations (Technological Park zones + Split locations)
4. Supabase Auth (guest login + pulse name)
5. Basic map rendering with location markers

### Phase 2: Core Loop (next 3-4 hours)
6. Post Instant flow (text first, camera later)
7. Instants appearing on map in real time (Supabase Realtime)
8. Heat map layer based on Instant density
9. Location panel (bottom sheet) with instant feed
10. Pulse Score calculation + status badge

### Phase 3: Polish (next 2-3 hours)
11. AI Summary integration (Anthropic API)
12. Instant type filters
13. Confirm / helpful reactions
14. Camera capture for photo Instants
15. QR code generation for demo entry point

### Phase 4: Demo Prep (final hour)
16. Seed demo Instants for Technological Park
17. Test full flow: QR → map → post → pulse update
18. Polish mobile UI, animations, loading states

---

## 14. Deployment

```bash
# Vercel (recommended)
vercel --prod

# Or manual
npm run build
npm start
```

Vercel config (`vercel.json`):
```json
{
  "framework": "nextjs",
  "regions": ["fra1"],
  "env": {
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
    "ANTHROPIC_API_KEY": "@anthropic-api-key"
  }
}
```

---

## 15. QR Code Entry Point

Generate QR that points to `https://splitpulse.vercel.app?zone=tech-park`.

App reads `zone` query param → centers map on that zone → prompts guest login → shows heat map.

```typescript
// app/page.tsx
export default function Landing({ searchParams }: { searchParams: { zone?: string } }) {
  const zone = searchParams.zone;
  redirect(zone ? `/map?focus=${zone}` : '/map');
}
```

---

## 16. Performance Notes

- **Map tiles:** Lazy-load, only render visible area
- **Instants:** Paginate (limit 50 per zone), only fetch active
- **Realtime:** Subscribe per visible zone, not globally
- **AI summaries:** Cache 5 min per location, don't re-generate on every view
- **Images:** Supabase Storage with auto-resize transforms (max 800px width)
- **Bundle:** Dynamic import map library (`next/dynamic` with `ssr: false`)

---

## 17. File Naming Conventions

```
kebab-case for files:    heat-map.tsx, post-instant.tsx
PascalCase for components: HeatMap, PostInstant
camelCase for functions:   calculatePulseScore, findNearestZone
snake_case for DB:         pulse_score, created_at
```

---

## 18. Favorites & Collections

### 18.1 Database Schema

#### `favorites`

```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE NOT NULL,
  note TEXT,                                    -- personal note ("sunset spot", "best coffee")
  collection_id UUID REFERENCES favorite_collections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, location_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
```

#### `favorite_collections`

```sql
CREATE TABLE favorite_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                           -- "My Split Night Out", "Sunset List"
  emoji TEXT DEFAULT '📍',                       -- collection icon
  is_public BOOLEAN DEFAULT false,              -- shareable if true
  share_slug TEXT UNIQUE,                       -- e.g. "petar-sunset-list" for public URL
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_collections_user ON favorite_collections(user_id);
CREATE INDEX idx_collections_slug ON favorite_collections(share_slug);
```

#### RLS

```sql
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own favorites" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);

ALTER TABLE favorite_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own collections" ON favorite_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public collections readable" ON favorite_collections FOR SELECT USING (is_public = true);
CREATE POLICY "Users manage own collections" ON favorite_collections FOR ALL USING (auth.uid() = user_id);
```

### 18.2 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/favorites` | List user's favorites (with location pulse data) |
| `POST` | `/api/favorites` | Add favorite |
| `DELETE` | `/api/favorites/[id]` | Remove favorite |
| `GET` | `/api/collections` | List user's collections |
| `POST` | `/api/collections` | Create collection |
| `PATCH` | `/api/collections/[id]` | Update collection (name, emoji, public) |
| `DELETE` | `/api/collections/[id]` | Delete collection |
| `GET` | `/api/share/collection/[slug]` | Public collection view |

### 18.3 TypeScript Types

```typescript
export interface Favorite {
  id: string;
  location_id: string;
  note: string | null;
  collection_id: string | null;
  created_at: string;
  location?: Location;       // joined with current pulse data
}

export interface FavoriteCollection {
  id: string;
  name: string;
  emoji: string;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  favorites?: Favorite[];    // joined
}
```

### 18.4 Frontend

```
app/
├── favorites/
│   └── page.tsx                  # My favorites + collections
├── collection/
│   └── [slug]/
│       └── page.tsx              # Public shared collection view
components/
├── favorites/
│   ├── FavoriteButton.tsx        # Heart toggle on location panel
│   ├── FavoritesList.tsx         # All favorites with pulse status
│   ├── CollectionCard.tsx        # Collection preview card
│   └── AddToCollection.tsx       # Modal to pick/create collection
```

---

## 19. Social Sharing

### 19.1 Share API Route

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/share/card` | Generate share card image (OG image) |
| `GET` | `/api/og/[type]/[id]` | Dynamic OG image for location/instant/collection |

### 19.2 Share Card Generation

Use `@vercel/og` (Satori) for dynamic OG images at the edge:

```typescript
// app/api/og/location/[slug]/route.tsx
import { ImageResponse } from '@vercel/og';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const location = await getLocationBySlug(params.slug);

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%)',
        width: '100%',
        height: '100%',
        padding: '48px',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ color: '#ffffff80', fontSize: 20 }}>SPLIT PULSE</div>
        <div style={{ color: '#fff', fontSize: 48, marginTop: 24 }}>
          {location.name} is {location.pulse_status} 🔥
        </div>
        <div style={{ color: '#ffffff90', fontSize: 24, marginTop: 16 }}>
          {location.pulse_score} pulse • {location.active_instants_count} instants
        </div>
        <div style={{ color: '#00d4ff', fontSize: 20, marginTop: 'auto' }}>
          splitpulse.app/{location.slug}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

### 19.3 Client-Side Share

```typescript
// utils/share.ts
export async function shareContent(data: {
  title: string;
  text: string;
  url: string;
}) {
  // Web Share API (mobile native share sheet)
  if (navigator.share) {
    await navigator.share(data);
    return;
  }
  // Fallback: copy link
  await navigator.clipboard.writeText(data.url);
}
```

### 19.4 Share Targets

For MVP web app:
- Web Share API (native mobile share sheet — covers Instagram, WhatsApp, etc.)
- Copy link fallback
- Share button on: Location panel, Instant card, Favorite collection, Streak badge

### 19.5 Dynamic OG Meta Tags

```typescript
// app/location/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const location = await getLocationBySlug(params.slug);
  return {
    title: `${location.name} — SPLIT PULSE`,
    description: `${location.name} is ${location.pulse_status}. See what's happening now.`,
    openGraph: {
      images: [`/api/og/location/${params.slug}`],
    },
  };
}
```

---

## 20. Design System — Glassmorphism + Simplicity

### 20.1 Design Philosophy

> **Glass over dark. Simple. Breathable. Alive.**

SPLIT PULSE uses a dark-mode-first glassmorphism aesthetic. Every surface is a frosted glass panel floating over a deep gradient background. The map is always visible beneath the UI. Minimal chrome, maximum clarity.

**Core principles:**
- Dark base, glass surfaces, vibrant pulse accents
- Every panel is translucent — the map bleeds through
- Typography does the heavy lifting, not decoration
- Animations are smooth and purposeful, never flashy
- Mobile-first, thumb-friendly, one-hand operable

### 20.2 Color Tokens

```css
:root {
  /* ── Base ── */
  --bg-deep:            #0a0a1a;              /* app background behind map */
  --bg-surface:         rgba(255, 255, 255, 0.06);  /* glass panel fill */
  --bg-surface-hover:   rgba(255, 255, 255, 0.10);
  --bg-surface-active:  rgba(255, 255, 255, 0.14);

  /* ── Glass ── */
  --glass-bg:           rgba(15, 15, 35, 0.65);     /* primary glass */
  --glass-bg-heavy:     rgba(10, 10, 30, 0.80);     /* bottom sheets, modals */
  --glass-border:       rgba(255, 255, 255, 0.08);
  --glass-border-light: rgba(255, 255, 255, 0.12);
  --glass-blur:         20px;
  --glass-blur-heavy:   30px;

  /* ── Text ── */
  --text-primary:       #ffffffee;
  --text-secondary:     #ffffff80;
  --text-tertiary:      #ffffff50;
  --text-inverse:       #0a0a1a;

  /* ── Pulse Status Colors ── */
  --pulse-quiet:        #4a5568;               /* gray */
  --pulse-active:       #00d4ff;               /* cyan */
  --pulse-rising:       #00e88f;               /* green */
  --pulse-trending:     #ffb800;               /* amber */
  --pulse-high:         #ff4444;               /* red */
  --pulse-live-event:   #c840ff;               /* purple */

  /* ── Accent ── */
  --accent-primary:     #00d4ff;               /* main CTA, links */
  --accent-glow:        rgba(0, 212, 255, 0.25);

  /* ── Instant Type Colors ── */
  --instant-photo:      #00d4ff;
  --instant-text:       #ffffff80;
  --instant-crowd:      #ffb800;
  --instant-question:   #c840ff;
  --instant-help:       #ff6b6b;
  --instant-event:      #00e88f;
  --instant-recommend:  #ff9f43;
  --instant-warning:    #ff4444;

  /* ── Spacing Scale ── */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  32px;
  --space-2xl: 48px;

  /* ── Radius ── */
  --radius-sm:  8px;
  --radius-md:  14px;
  --radius-lg:  20px;
  --radius-xl:  28px;
  --radius-full: 9999px;

  /* ── Shadows ── */
  --shadow-glass:  0 8px 32px rgba(0, 0, 0, 0.3);
  --shadow-glow:   0 0 20px var(--accent-glow);
  --shadow-pulse:  0 0 40px rgba(255, 68, 68, 0.3); /* for high-pulse elements */
}
```

### 20.3 Typography

```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-body:  'DM Sans', -apple-system, sans-serif;
  --font-mono:  'JetBrains Mono', monospace;

  /* Type scale */
  --text-xs:    0.75rem;    /* 12px — captions, timestamps */
  --text-sm:    0.875rem;   /* 14px — secondary text */
  --text-base:  1rem;       /* 16px — body */
  --text-lg:    1.125rem;   /* 18px — card titles */
  --text-xl:    1.5rem;     /* 24px — section headers */
  --text-2xl:   2rem;       /* 32px — page titles */
  --text-3xl:   2.5rem;     /* 40px — hero numbers (pulse score) */

  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --tracking-tight: -0.02em;
}
```

### 20.4 Glass Panel Component

The foundational UI primitive. Every card, sheet, modal, and overlay uses this.

```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass);
}

.glass-panel-heavy {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur-heavy));
  -webkit-backdrop-filter: blur(var(--glass-blur-heavy));
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
}
```

**Tailwind utility classes (tailwind.config.ts):**

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        deep: '#0a0a1a',
        pulse: {
          quiet: '#4a5568',
          active: '#00d4ff',
          rising: '#00e88f',
          trending: '#ffb800',
          high: '#ff4444',
          live: '#c840ff',
        },
        accent: '#00d4ff',
      },
      backdropBlur: {
        glass: '20px',
        'glass-heavy': '30px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        glow: '0 0 20px rgba(0, 212, 255, 0.25)',
        pulse: '0 0 40px rgba(255, 68, 68, 0.3)',
      },
      borderRadius: {
        glass: '20px',
      },
      fontFamily: {
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

### 20.5 Component Styling Reference

#### Bottom Sheet (Location Panel)

```
┌────────────────────────────────────┐
│          ── drag handle ──         │  ← 40×4px white/20% rounded pill
│                                    │
│  📍 Technological Park       ❤️   │  ← text-xl, favorite button
│  🔥 High Pulse · 12 Instants      │  ← pulse badge + count
│                                    │
│  ┌──────────────────────────────┐  │
│  │  AI Summary                  │  │  ← inner glass-panel, lighter bg
│  │  "Most activity around..."   │  │
│  └──────────────────────────────┘  │
│                                    │
│  Latest Instants                   │
│  ┌──────────────────────────────┐  │
│  │ ⚡ "Pitch starting soon"     │  │  ← instant card, glass surface
│  │   Main Hall · 2m ago · ✓ 4  │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ ❓ "Ima li netko punjač?"    │  │
│  │   Team Area · 8m ago        │  │
│  └──────────────────────────────┘  │
│                                    │
│  [ ⚡ Post Instant ]  [ 🤖 Ask ] │  ← accent buttons
│  [   🔗 Share   ]  [ 🧭 Navigate]│
└────────────────────────────────────┘
```

Styling: `glass-panel-heavy`, border-top: `glass-border-light`, 
drag handle centered, content padding `var(--space-lg)`.

#### Instant Card

```css
.instant-card {
  background: var(--bg-surface);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  transition: background 0.2s ease;
}
.instant-card:active {
  background: var(--bg-surface-active);
}
/* Left accent bar by type */
.instant-card[data-type="event"]   { border-left: 3px solid var(--instant-event); }
.instant-card[data-type="crowd"]   { border-left: 3px solid var(--instant-crowd); }
.instant-card[data-type="question"]{ border-left: 3px solid var(--instant-question); }
.instant-card[data-type="help"]    { border-left: 3px solid var(--instant-help); }
.instant-card[data-type="warning"] { border-left: 3px solid var(--instant-warning); }
```

#### Pulse Status Badge

```css
.pulse-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pulse-badge[data-status="quiet"]     { background: rgba(74,85,104,0.3);  color: #8896a8; }
.pulse-badge[data-status="active"]    { background: rgba(0,212,255,0.15); color: #00d4ff; }
.pulse-badge[data-status="rising"]    { background: rgba(0,232,143,0.15); color: #00e88f; }
.pulse-badge[data-status="trending"]  { background: rgba(255,184,0,0.15); color: #ffb800; }
.pulse-badge[data-status="high_pulse"]{ background: rgba(255,68,68,0.2);  color: #ff4444;
                                        box-shadow: var(--shadow-pulse); }
.pulse-badge[data-status="live_event"]{ background: rgba(200,64,255,0.2); color: #c840ff; }
```

#### Floating Instant Button

```css
.instant-fab {
  position: fixed;
  bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-full);
  padding: 14px 28px;
  font-size: var(--text-base);
  font-weight: 700;
  box-shadow: var(--shadow-glow), var(--shadow-glass);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  z-index: 50;
}
.instant-fab:active {
  transform: translateX(-50%) scale(0.95);
}
```

#### Share Card (for OG / export)

```css
.share-card {
  width: 1200px; height: 630px;           /* OG image size */
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0d1b2a 100%);
  border: 1px solid rgba(255,255,255,0.06);
  padding: 48px;
  display: flex;
  flex-direction: column;
  font-family: 'DM Sans', sans-serif;
  color: white;
}
```

### 20.6 Animations

```css
/* Pulse ring animation on active locations */
@keyframes pulse-ring {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
.pulse-ring {
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

/* Fade-in for new Instants appearing on map */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.instant-enter {
  animation: fade-up 0.3s ease-out;
}

/* Bottom sheet slide */
@keyframes slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.sheet-enter {
  animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Glow throb for trending badges */
@keyframes glow-throb {
  0%, 100% { box-shadow: 0 0 12px rgba(255,184,0,0.2); }
  50%      { box-shadow: 0 0 24px rgba(255,184,0,0.45); }
}
.badge-trending {
  animation: glow-throb 2s ease-in-out infinite;
}
```

### 20.7 Map Overlay Styling

The map is the background. All UI floats above it as glass panels.

```
┌───────────────────────────────────────┐
│ ┌─glass header──────────────────────┐ │
│ │ SPLIT PULSE              [@user]  │ │  ← thin glass bar, 48px
│ └───────────────────────────────────┘ │
│                                       │
│            ╔═══════════╗              │
│            ║  MAP +    ║              │
│            ║  HEATMAP  ║              │  ← full-bleed map
│       ●    ║  LAYER    ║     ●       │
│            ║           ║              │
│            ╚═══════════╝              │
│                                       │
│ ┌─glass filter bar──────────────────┐ │
│ │ All  Crowd  Help  Event  Question │ │  ← horizontal scroll pills
│ └───────────────────────────────────┘ │
│                                       │
│ ┌─glass bottom sheet────────────────┐ │
│ │ ── handle ──                      │ │  ← draggable, peek + full
│ │ 📍 Location Name        ❤️  🔗   │ │
│ │ 🔥 Trending · 8 Instants         │ │
│ │ ...                               │ │
│ └───────────────────────────────────┘ │
│                                       │
│           [ ⚡ INSTANT ]              │  ← accent FAB
└───────────────────────────────────────┘
```

### 20.8 Dark Mode Only

SPLIT PULSE is dark-mode only. No light theme toggle. The dark background is essential for:
- Heat map color visibility
- Glassmorphism contrast
- Map readability at night
- Consistent brand feel
- Reduced visual noise

### 20.9 Mobile-First Breakpoints

```css
/* Mobile first — default styles are mobile */
/* sm: 640px — not used (mobile-only app) */
/* md: 768px — tablet adjustments if needed */
/* lg: 1024px — desktop (optional, not priority) */

/* Safe area for notch/island phones */
.app-shell {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 20.10 Icon System

Use **Lucide React** icons (already available in the React artifact environment). Consistent 20px size, `stroke-width: 1.5`, color inherits from parent.

Key icons:
- `MapPin` — location marker
- `Zap` — Instant / pulse
- `Heart` — favorite
- `Share2` — share
- `MessageCircle` — question
- `AlertTriangle` — warning
- `Camera` — photo instant
- `Navigation` — navigate
- `Flame` — trending/streak
- `Search` — search
- `User` — profile
- `X` — close

---

*This document is the single source of truth for implementing SPLIT PULSE. Follow the schema, API structure, component hierarchy, and design system exactly. When in doubt, refer to the Implementation Order (Section 13) for priority.*
