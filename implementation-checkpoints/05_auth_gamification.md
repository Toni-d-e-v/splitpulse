# Checkpoint 05 — Auth & Gamification

> Login flow (guest, Pulse name, Google). Streak + pulse points + helper score logic **designed** in this file but only implemented if MVP time permits — both source docs flag streak as non-core.

## Goal

Replace the bare-bones `/api/auth/guest` from checkpoint 02 with a full login UX. Bootstrap profiles automatically. Document — and stub — the gamification rules so a future session can implement them without re-deriving the design.

End state: user opens app → sees three buttons (Continue as guest / Pick a Pulse name / Sign in with Google) → can pick any flow → ends up with a `profiles` row and stays signed in across reloads.

## Prerequisites

- ✅ Checkpoint 01 (`profiles` table exists; `handle_new_user` trigger creates rows)
- ✅ Checkpoint 02 (`/api/auth/guest`, `/api/auth/pulse-name` stubs)

## Status checklist

### Auth UX
- [ ] `app/login/page.tsx` — three-button glass card
- [ ] Continue as Guest → calls `/api/auth/guest` → redirects to `/map`
- [ ] Create Pulse Name → text input + check uniqueness → calls `/api/auth/pulse-name` → redirects
- [ ] Sign in with Google → triggers `supabase.auth.signInWithOAuth({ provider: 'google' })`
- [ ] Configure Google OAuth in Supabase dashboard (Client ID + Secret, redirect URI = `https://splitpulse.vercel.app/auth/callback`)
- [ ] `app/auth/callback/route.ts` — exchanges code for session, redirects to `/map`
- [ ] Profile dropdown in header: pulse_name + streak + sign out

### Session middleware
- [ ] `middleware.ts` — refreshes auth session on every request (Supabase SSR pattern)
- [ ] Public routes: `/`, `/login`, `/auth/callback`, `/collection/[slug]`, `/api/og/*`
- [ ] Protected: everything else redirects to `/login` if no session

### Profile bootstrap verification
- [ ] Sign up flow creates `profiles` row (trigger from 01) — verify in dashboard
- [ ] First-time Google user is asked to pick a Pulse name

### Gamification — design only
- [ ] Create `docs/gamification.md` (or section in this checkpoint) with rules
- [ ] Sketch SQL trigger (commented out / in a `db/triggers-deferred.sql` file)
- [ ] Add `TODO: gamification` comments at hook points in API routes

## Files to create / edit

```
splitpulse-app/
├── app/
│   ├── login/page.tsx                    # CREATE
│   └── auth/callback/route.ts            # CREATE — OAuth exchange
├── middleware.ts                          # CREATE — session refresh
├── components/
│   └── auth/{LoginCard,ProfileDropdown}.tsx  # CREATE
└── db/triggers-deferred.sql               # CREATE — gamification triggers (commented)
docs/gamification.md                       # CREATE — rules + worked examples
```

## Dependencies

- ✅ `@supabase/ssr` (from 01)
- Google OAuth credentials (Google Cloud Console → OAuth consent screen + Credentials)
- For Google in dev: add `http://localhost:3000/auth/callback` as authorized redirect URI

## Implementation notes

### Supabase SSR middleware (essential)

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs) => {
          cs.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );
  await supabase.auth.getUser();      // refresh session token
  return res;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/og).*)'],
};
```

### OAuth callback route

```ts
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${url.origin}/map`);
}
```

### Profile bootstrap (already in 01 via trigger)

If new user has no `pulse_name`, header prompts them to set one. Don't block the map view — let them browse anonymously.

---

## Gamification design (DEFERRED IMPLEMENTATION)

### Rules

| Action | +Pulse Points | +Helper Score | Counts toward streak? |
|---|---|---|---|
| Post Instant | +5 | 0 | yes |
| Post helpful/question/help Instant | +5 | +2 | yes |
| Confirm someone's Instant | +1 | +1 | yes |
| Mark helpful | +1 | +1 | yes |
| Answer a Question Instant | +3 | +3 | yes |
| Question Instant gets resolved (you posted answer) | +5 | +5 | n/a |
| AI summary request | +0 | 0 | no |
| Daily login | +2 | 0 | no |

### Streak logic

- A user "keeps the streak" any day they performed at least 1 streak-eligible action
- Streak resets to 0 if a day passes with no action
- Stored on `profiles.streak_count` + `profiles.streak_last_date`

### SQL trigger sketch (`db/triggers-deferred.sql`)

```sql
-- DEFERRED: do not run until gamification implementation phase
/*
CREATE OR REPLACE FUNCTION public.bump_pulse_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  UPDATE profiles
  SET pulse_points = pulse_points + CASE
        WHEN TG_TABLE_NAME = 'instants' THEN 5
        WHEN TG_TABLE_NAME = 'instant_reactions' AND NEW.type = 'answer' THEN 3
        WHEN TG_TABLE_NAME = 'instant_reactions' THEN 1
        ELSE 0
      END,
      helper_score = helper_score + CASE
        WHEN TG_TABLE_NAME = 'instants' AND NEW.type IN ('help','question') THEN 2
        WHEN TG_TABLE_NAME = 'instant_reactions' AND NEW.type = 'answer' THEN 3
        WHEN TG_TABLE_NAME = 'instant_reactions' AND NEW.type = 'helpful' THEN 1
        ELSE 0
      END,
      streak_count = CASE
        WHEN streak_last_date = CURRENT_DATE THEN streak_count
        WHEN streak_last_date = CURRENT_DATE - 1 THEN streak_count + 1
        ELSE 1
      END,
      streak_last_date = CURRENT_DATE,
      updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_instants_bump AFTER INSERT ON instants
  FOR EACH ROW EXECUTE PROCEDURE bump_pulse_points();
CREATE TRIGGER trg_reactions_bump AFTER INSERT ON instant_reactions
  FOR EACH ROW EXECUTE PROCEDURE bump_pulse_points();
*/
```

### UI hooks (also deferred)

- Streak badge in profile dropdown: `🔥 5-day streak`
- Toast on streak increase: "🔥 You kept your streak alive by helping people nearby."
- Pulse Points shown on profile (not on map — would distract)

### Why deferred

Both source docs (project doc §17, master plan §6) explicitly state streak is **not core**. Heat map + Instants must work first. Implement gamification only after checkpoints 06–08 are stable.

## Verification

1. Click "Continue as Guest" → redirected to `/map`, anonymous session cookie present
2. Reload page → still signed in (middleware refreshed session)
3. Click "Pick a Pulse name" → enter @petar → 200; reuse @petar → 409 conflict
4. Click "Sign in with Google" → Google consent → redirected to `/map` → `profiles` row exists with email metadata
5. Sign out from profile dropdown → back to `/login`

## Continuation note

If session ends mid-checkpoint:

- **If Google OAuth fails:** verify redirect URI matches both Supabase config and Google Cloud Console exactly
- **If middleware breaks all routes:** check matcher pattern; temporarily comment middleware to confirm app works
- Gamification rules are documented here even if not implemented — preserve this file
- **What's next after this:** start `06_favorites_sharing.md`

## References

- Spec §5.4 (auth routes), §11 (profile type)
- Project doc §15 (login), §16 (streak), §17 (streak not core)
- Supabase docs: https://supabase.com/docs/guides/auth/server-side/nextjs (SSR pattern)
