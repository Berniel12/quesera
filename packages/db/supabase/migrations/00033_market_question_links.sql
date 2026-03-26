-- Thin provenance table: tracks where question wrappers originated from prediction markets
-- One wrapper can link to multiple platforms (same question on Polymarket AND Kalshi)

CREATE TABLE market_question_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wrapper_id UUID NOT NULL REFERENCES question_wrappers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  source_item_id UUID REFERENCES source_items(id),
  external_id TEXT NOT NULL,
  platform_url TEXT,
  original_question TEXT NOT NULL,
  last_probability NUMERIC(5,4),
  last_volume NUMERIC,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wrapper_id, platform, external_id)
);

CREATE INDEX idx_mql_wrapper ON market_question_links(wrapper_id);
CREATE INDEX idx_mql_platform ON market_question_links(platform);

ALTER TABLE market_question_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read market question links"
  ON market_question_links FOR SELECT USING (true);
