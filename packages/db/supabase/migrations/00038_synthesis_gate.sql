-- Source pack synthesis gate columns on public_topic_cards
--
-- These columns enable the homepage to filter to synthesis-ready questions only.
-- Populated by the worker during snapshot publication.

ALTER TABLE public_topic_cards
  ADD COLUMN IF NOT EXISTS source_family_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_families text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signal_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synthesis_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expert_line text;

-- Live competition data (replaces stale static maps)
ALTER TABLE public_topic_cards
  ADD COLUMN IF NOT EXISTS competition_leader text,
  ADD COLUMN IF NOT EXISTS competition_leader_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS competition_challenger text,
  ADD COLUMN IF NOT EXISTS competition_gap numeric(5,2);

-- Index for homepage query filtering
CREATE INDEX IF NOT EXISTS idx_public_topic_cards_synthesis_ready
  ON public_topic_cards (synthesis_ready)
  WHERE synthesis_ready = true;
