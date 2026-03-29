-- Structured source comparison: deterministic synthesis object
-- Computed by the worker from multi-source signal data.
-- Powers the "What the sources say" comparison block on detail pages.

ALTER TABLE topic_snapshots
  ADD COLUMN IF NOT EXISTS synthesis_json jsonb;

ALTER TABLE public_topic_cards
  ADD COLUMN IF NOT EXISTS synthesis_json jsonb;
