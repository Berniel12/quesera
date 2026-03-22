-- Quick-win expansion sources
insert into source_definitions (source_key, source_family, display_name, role_types, auth_model, cadence_seconds, license_class, risk_level, scoring_eligible, evidence_eligible, config) values
  ('coingecko', 'macro_official', 'CoinGecko', '{signal}', 'public', 300, 'open', 'low', true, false,
   '{"base_url": "https://api.coingecko.com/api/v3", "coins": ["bitcoin", "ethereum", "solana", "ripple", "cardano", "dogecoin", "polkadot", "chainlink", "avalanche-2", "uniswap"]}'::jsonb),
  ('disease_sh', 'reference_entity', 'Disease.sh Health Data', '{reference,evidence}', 'public', 86400, 'open', 'low', false, true,
   '{"base_url": "https://disease.sh", "countries": ["US", "UK", "Israel", "Germany", "France", "Japan", "China", "India", "Brazil"]}'::jsonb),
  ('exchange_rates', 'macro_official', 'Exchange Rates API', '{signal,reference}', 'public', 86400, 'open', 'low', true, false,
   '{"base_url": "https://open.er-api.com/v6", "base_currency": "USD", "targets": ["EUR", "GBP", "JPY", "CNY", "ILS", "CAD", "AUD", "CHF", "INR", "BRL", "MXN", "KRW", "TRY", "ZAR", "RUB"]}'::jsonb),
  ('thesportsdb', 'reference_entity', 'TheSportsDB', '{evidence}', 'public', 3600, 'open', 'low', false, true,
   '{"base_url": "https://www.thesportsdb.com/api/v1/json/3", "leagues": ["4328", "4387", "4391", "4380", "4424"]}'::jsonb),
  ('eurostat', 'macro_official', 'Eurostat', '{reference}', 'public', 86400, 'open', 'low', false, false,
   '{"base_url": "https://ec.europa.eu/eurostat", "datasets": [{"code": "prc_hicp_manr", "name": "EU Inflation"}, {"code": "une_rt_m", "name": "EU Unemployment"}]}'::jsonb),
  ('imf', 'macro_official', 'International Monetary Fund', '{reference}', 'public', 86400, 'open', 'low', false, false,
   '{"base_url": "https://dataservices.imf.org", "indicators": [{"code": "NGDP_RPCH", "name": "Real GDP Growth"}, {"code": "PCPIPCH", "name": "Inflation Rate"}], "countries": ["US", "GB", "DE", "JP", "CN", "IL"]}'::jsonb);

-- Add more RSS feeds to existing RSS source
update source_definitions
set config = '{
  "feeds": [
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "name": "BBC World", "category": "geopolitics"},
    {"url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "name": "NYT World", "category": "geopolitics"},
    {"url": "https://feeds.reuters.com/reuters/topNews", "name": "Reuters Top", "category": "general"},
    {"url": "https://www.aljazeera.com/xml/rss/all.xml", "name": "Al Jazeera", "category": "geopolitics"},
    {"url": "https://www.theguardian.com/world/rss", "name": "The Guardian World", "category": "geopolitics"},
    {"url": "https://feeds.npr.org/1001/rss.xml", "name": "NPR News", "category": "general"},
    {"url": "https://www.who.int/rss-feeds/news-english.xml", "name": "WHO News", "category": "health"},
    {"url": "https://news.un.org/feed/subscribe/en/news/all/rss.xml", "name": "UN News", "category": "geopolitics"}
  ]
}'::jsonb
where source_key = 'rss';

-- Create health rows for new sources
insert into source_health (source_id, freshness)
select id, 'stale' from source_definitions
where source_key in ('coingecko', 'disease_sh', 'exchange_rates', 'thesportsdb', 'eurostat', 'imf');
