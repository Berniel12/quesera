// Matching thresholds
export const ACCEPT_THRESHOLD = 0.60;
export const CANDIDATE_THRESHOLD = 0.35;
export const TRIGRAM_MIN_FLOOR = 0.2;
export const TRIGRAM_TOP_N = 20;
export const BATCH_SIZE = 100;

// Composite score weights
export const WEIGHT_TRIGRAM = 0.5;
export const WEIGHT_ENTITY = 0.3;
export const WEIGHT_CATEGORY = 0.2;

// Category mapping: source_family -> topic category
export const SOURCE_FAMILY_CATEGORY_MAP: Record<string, string> = {
  macro_official: "macro",
  political_official: "politics",
  hazard_weather: "disasters",
};

// FRED series -> topic slug (deterministic bootstrap shortcut)
export const FRED_SERIES_TOPIC_MAP: Record<string, string> = {
  CPIAUCSL: "us-inflation-rate",
  UNRATE: "us-unemployment-rate",
  FEDFUNDS: "us-federal-reserve-interest-rates",
  MORTGAGE30US: "us-federal-reserve-interest-rates",
  DGS10: "us-federal-reserve-interest-rates",
};

// Allowed match_method values (code-constrained, not DB enum)
export const MATCH_METHODS = [
  "trigram",
  "entity_overlap",
  "composite",
  "seed_map",
] as const;
export type MatchMethod = (typeof MATCH_METHODS)[number];

// Allowed relationship_type values
export const RELATIONSHIP_TYPES = [
  "related",
  "parent",
  "child",
  "prerequisite",
] as const;

// Allowed candidate status values
export const CANDIDATE_STATUSES = [
  "pending",
  "promoted",
  "rejected",
  "merged",
] as const;

export interface MatchSignals {
  text: string;
  category: string | null;
  entities: string[];
}

export interface TopicMatch {
  topicId: string;
  topicSlug: string;
  trigramScore: number;
  entityScore: number;
  categoryMatch: number;
  compositeScore: number;
  matchMethod: MatchMethod;
}
