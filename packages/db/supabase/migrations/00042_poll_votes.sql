-- Quick poll votes: one-tap Yes/No predictions per question
-- Cookie-based for anonymous users, user_id for authenticated.
-- Powers the "My Calls" page and per-question vote results.

CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_slug text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('yes', 'no')),
  voter_id text NOT NULL,           -- cookie-based anonymous ID or user_id
  user_id uuid,                     -- null for anonymous, set for authenticated
  confidence_at_vote numeric(5,4),  -- market confidence when they voted (for tracking accuracy)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One vote per person per question
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique
  ON poll_votes (question_slug, voter_id);

-- Quick lookups for vote counts per question
CREATE INDEX IF NOT EXISTS idx_poll_votes_question
  ON poll_votes (question_slug);

-- Quick lookups for "My Calls" page
CREATE INDEX IF NOT EXISTS idx_poll_votes_voter
  ON poll_votes (voter_id);

-- RLS: anyone can vote, anyone can read aggregates
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can vote" ON poll_votes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read votes" ON poll_votes
  FOR SELECT TO anon, authenticated
  USING (true);
