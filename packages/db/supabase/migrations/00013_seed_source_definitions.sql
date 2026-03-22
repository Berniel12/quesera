insert into source_definitions (source_key, source_family, display_name, role_types, auth_model, cadence_seconds, license_class, risk_level, scoring_eligible, evidence_eligible, config) values
  ('fred', 'macro_official', 'Federal Reserve Economic Data', '{signal,reference}', 'api_key', 86400, 'open', 'low', true, false,
   '{"base_url": "https://api.stlouisfed.org/fred", "seed_series": ["CPIAUCSL", "UNRATE", "MORTGAGE30US", "GDP", "FEDFUNDS", "DGS10"]}'::jsonb),
  ('congress_gov', 'political_official', 'Congress.gov', '{signal,reference}', 'api_key', 3600, 'open', 'low', true, false,
   '{"base_url": "https://api.congress.gov/v3"}'::jsonb),
  ('fec', 'political_official', 'Federal Election Commission', '{signal,reference}', 'api_key', 86400, 'open', 'low', true, false,
   '{"base_url": "https://api.fec.gov/v1"}'::jsonb),
  ('usgs_earthquakes', 'hazard_weather', 'USGS Earthquake Hazards', '{signal}', 'public', 600, 'open', 'low', true, false,
   '{"feed_url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary", "min_magnitude": 2.5}'::jsonb),
  ('noaa_nws', 'hazard_weather', 'NOAA National Weather Service', '{signal}', 'public', 600, 'open', 'low', true, false,
   '{"base_url": "https://api.weather.gov"}'::jsonb),
  ('open_meteo', 'hazard_weather', 'Open-Meteo Weather', '{signal}', 'public', 3600, 'open', 'low', false, false,
   '{"base_url": "https://api.open-meteo.com/v1", "locations": [{"key": "nyc", "lat": 40.7128, "lon": -74.006}, {"key": "la", "lat": 34.0522, "lon": -118.2437}, {"key": "chicago", "lat": 41.8781, "lon": -87.6298}, {"key": "houston", "lat": 29.7604, "lon": -95.3698}, {"key": "miami", "lat": 25.7617, "lon": -80.1918}]}'::jsonb),
  ('wikidata', 'reference_entity', 'Wikidata', '{reference}', 'public', 86400, 'open', 'low', false, false,
   '{"base_url": "https://www.wikidata.org/w/api.php", "seed_entities": ["Q30", "Q159", "Q148", "Q17", "Q668", "Q801", "Q884"]}'::jsonb);

-- Create corresponding source_health rows
insert into source_health (source_id, freshness)
select id, 'stale' from source_definitions;
