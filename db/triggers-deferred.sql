-- ──────────────────────────────────────────────────────────────────
-- SPLIT PULSE — Gamification triggers (DEFERRED)
-- Source: implementation-checkpoints/05_auth_gamification.md
--
-- Do NOT run unless implementing gamification phase.
-- Project doc §17 explicitly says streak is NOT a core feature.
-- ──────────────────────────────────────────────────────────────────

/*
CREATE OR REPLACE FUNCTION public.bump_pulse_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trg_instants_bump
  AFTER INSERT ON instants
  FOR EACH ROW EXECUTE FUNCTION bump_pulse_points();

CREATE TRIGGER trg_reactions_bump
  AFTER INSERT ON instant_reactions
  FOR EACH ROW EXECUTE FUNCTION bump_pulse_points();
*/
