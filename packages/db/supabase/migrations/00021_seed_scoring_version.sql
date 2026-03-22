insert into version_registry (component, version, is_active, metadata) values
  ('scoring_engine', 'v1.0.0', true, '{
    "source_family_weights": {
      "macro_official": 0.8,
      "political_official": 0.7,
      "hazard_weather": 0.9
    },
    "direction_threshold": 0.01,
    "confidence_change_threshold": 0.15,
    "disagreement_change_threshold": 0.15,
    "max_summary_age_hours": 168,
    "freshness_buckets_hours": {
      "fresh": 1,
      "aging": 6,
      "stale": 24
    }
  }'::jsonb);
