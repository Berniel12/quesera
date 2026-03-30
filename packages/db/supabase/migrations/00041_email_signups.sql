-- Email capture for question pages (v1: collect-only, no automated sends)
CREATE TABLE IF NOT EXISTS email_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  question_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate signups per question
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_signups_unique
  ON email_signups (email, question_slug);

-- Allow anonymous inserts (public pages, no auth required)
ALTER TABLE email_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON email_signups
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
