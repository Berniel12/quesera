-- Publication quality gate: rendering mode + quality report
--
-- rendering_mode determines what template variant the frontend renders:
--   "premium"       -- phrased synthesis (Layer B) shown
--   "deterministic" -- numbers + cards only, no phrased prose
--   "blocked"       -- gathering-data placeholder (never 404)
--
-- quality_report stores the structured gate battery results per snapshot.
-- Used for debugging, metrics, and admin dashboard.
--
-- consecutive_entity_passes tracks how many cycles in a row the entity
-- gate has passed for competition pages (promotion criteria).

ALTER TABLE public_topic_cards
  ADD COLUMN IF NOT EXISTS rendering_mode text NOT NULL DEFAULT 'deterministic',
  ADD COLUMN IF NOT EXISTS quality_report jsonb,
  ADD COLUMN IF NOT EXISTS consecutive_entity_passes integer NOT NULL DEFAULT 0;

-- Also store rendering_mode on snapshots for historical tracking
ALTER TABLE topic_snapshots
  ADD COLUMN IF NOT EXISTS rendering_mode text,
  ADD COLUMN IF NOT EXISTS quality_report jsonb;

-- prose_generated_at tracks when LLM prose was last generated
-- (distinct from published_at which tracks snapshot creation)
ALTER TABLE topic_snapshots
  ADD COLUMN IF NOT EXISTS prose_generated_at timestamptz;

-- synthesis_phrased stores Layer B output on both cards and snapshots
ALTER TABLE public_topic_cards
  ADD COLUMN IF NOT EXISTS synthesis_phrased jsonb;

ALTER TABLE topic_snapshots
  ADD COLUMN IF NOT EXISTS synthesis_phrased jsonb;

-- platform_count and platform_names for canonical display contract
ALTER TABLE public_topic_cards
  ADD COLUMN IF NOT EXISTS platform_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_names text[] NOT NULL DEFAULT '{}';

-- Index for homepage queries to filter by rendering mode
CREATE INDEX IF NOT EXISTS idx_public_topic_cards_rendering_mode
  ON public_topic_cards (rendering_mode)
  WHERE rendering_mode != 'blocked';
