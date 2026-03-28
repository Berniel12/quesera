-- Add quality_tier to questions table for homepage curation and distribution control
-- A = flagship/homepage-worthy, B = published/useful, C = honest but thin, D = draft/internal
ALTER TABLE questions ADD COLUMN IF NOT EXISTS quality_tier TEXT DEFAULT 'B'
  CHECK (quality_tier IN ('A', 'B', 'C', 'D'));

-- Update RLS: quality_tier is readable by public (already covered by existing select policy)
-- No new policy needed -- existing "published questions are public" policy covers this column

COMMENT ON COLUMN questions.quality_tier IS 'Page quality tier: A=flagship, B=published, C=thin, D=draft';
