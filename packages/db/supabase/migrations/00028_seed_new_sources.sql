-- Prediction markets
insert into source_definitions (source_key, source_family, display_name, role_types, auth_model, cadence_seconds, license_class, risk_level, scoring_eligible, evidence_eligible, config) values
  ('polymarket', 'prediction_market', 'Polymarket', '{signal}', 'public', 300, 'open', 'low', true, false,
   '{"base_url": "https://gamma-api.polymarket.com", "min_volume": 1000}'::jsonb),
  ('kalshi', 'prediction_market', 'Kalshi', '{signal}', 'api_key', 300, 'commercial_ok', 'low', true, false,
   '{"base_url": "https://api.elections.kalshi.com/trade-api/v2"}'::jsonb),
  ('metaculus', 'forecasting', 'Metaculus', '{signal}', 'public', 3600, 'open', 'low', true, false,
   '{"base_url": "https://www.metaculus.com/api2"}'::jsonb),
  ('manifold', 'prediction_market', 'Manifold Markets', '{signal}', 'public', 3600, 'open', 'low', false, false,
   '{"base_url": "https://api.manifold.markets/v0"}'::jsonb);

-- Evidence / news
insert into source_definitions (source_key, source_family, display_name, role_types, auth_model, cadence_seconds, license_class, risk_level, scoring_eligible, evidence_eligible, config) values
  ('newsapi', 'news_evidence', 'NewsAPI', '{evidence}', 'api_key', 900, 'commercial_ok', 'low', false, true,
   '{"base_url": "https://newsapi.org/v2", "queries": ["inflation economy", "geopolitics conflict", "elections politics", "earthquake disaster", "climate change"]}'::jsonb),
  ('rss', 'news_evidence', 'RSS Aggregator', '{evidence}', 'public', 900, 'open', 'low', false, true,
   '{"feeds": [{"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "name": "BBC World", "category": "geopolitics"}, {"url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "name": "NYT World", "category": "geopolitics"}, {"url": "https://feeds.reuters.com/reuters/topNews", "name": "Reuters Top", "category": "general"}, {"url": "https://www.aljazeera.com/xml/rss/all.xml", "name": "Al Jazeera", "category": "geopolitics"}]}'::jsonb),
  ('reliefweb', 'humanitarian_conflict', 'ReliefWeb', '{evidence}', 'public', 3600, 'open', 'low', false, true,
   '{"base_url": "https://api.reliefweb.int/v1"}'::jsonb),
  ('gdelt', 'humanitarian_conflict', 'GDELT Project', '{evidence}', 'public', 900, 'open', 'medium', false, true,
   '{"base_url": "https://api.gdeltproject.org", "queries": ["conflict war", "protest unrest", "disaster", "election", "economy inflation"]}'::jsonb);

-- Macro expansion
insert into source_definitions (source_key, source_family, display_name, role_types, auth_model, cadence_seconds, license_class, risk_level, scoring_eligible, evidence_eligible, config) values
  ('bls', 'macro_official', 'Bureau of Labor Statistics', '{signal,reference}', 'public', 86400, 'open', 'low', true, false,
   '{"base_url": "https://api.bls.gov", "series_ids": ["LNS14000000", "CES0000000001", "CUSR0000SA0", "CUUR0000SA0"]}'::jsonb),
  ('eia', 'macro_official', 'Energy Information Administration', '{signal,reference}', 'api_key', 86400, 'open', 'low', true, false,
   '{"base_url": "https://api.eia.gov", "series_ids": ["PET.RWTC.W", "NG.RNGWHHD.W", "ELEC.PRICE.US-ALL.M"]}'::jsonb),
  ('world_bank', 'macro_official', 'World Bank', '{reference}', 'public', 86400, 'open', 'low', false, false,
   '{"base_url": "https://api.worldbank.org", "indicators": [{"code": "NY.GDP.MKTP.CD", "name": "GDP"}, {"code": "FP.CPI.TOTL.ZG", "name": "Inflation"}, {"code": "SL.UEM.TOTL.ZS", "name": "Unemployment"}], "countries": ["US", "GB", "DE", "JP", "CN", "IL"]}'::jsonb);

-- Create health rows for new sources
insert into source_health (source_id, freshness)
select id, 'stale' from source_definitions
where source_key in ('polymarket', 'kalshi', 'metaculus', 'manifold', 'newsapi', 'rss', 'reliefweb', 'gdelt', 'bls', 'eia', 'world_bank');
