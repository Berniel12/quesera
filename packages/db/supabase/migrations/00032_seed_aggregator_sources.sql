-- Seed 5 aggregator source definitions
-- These give the highest coverage-to-effort ratio

insert into source_definitions (source_key, source_family, display_name, role_types, auth_model, cadence_seconds, license_class, risk_level, scoring_eligible, evidence_eligible, is_active, config)
values
  ('metaforecast', 'forecast_aggregator', 'Metaforecast', '{signal}', 'public', 3600, 'open', 'low', true, false, true,
   '{"base_url": "https://metaforecast.org"}'),
  ('polyrouter', 'prediction_market', 'PolyRouter', '{signal}', 'public', 300, 'open', 'medium', true, false, true,
   '{"base_url": "https://api.polyrouter.com"}'),
  ('the_odds_api', 'sports_odds', 'The Odds API', '{signal}', 'api_key', 1800, 'commercial_ok', 'low', true, false, true,
   '{"base_url": "https://api.the-odds-api.com/v4"}'),
  ('espn', 'sports_signal', 'ESPN', '{signal,evidence}', 'public', 900, 'open', 'medium', false, true, true,
   '{"base_url": "https://site.api.espn.com/apis/site/v2/sports"}'),
  ('defillama', 'defi_signal', 'DefiLlama', '{signal}', 'public', 3600, 'open', 'low', true, false, true,
   '{"base_url": "https://api.llama.fi"}')
on conflict (source_key) do nothing;
