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
  crypto_market: "crypto",
};

// FRED series -> topic slugs with confidence (deterministic seed map)
// Multi-topic matching is intentional for shared causal signals (e.g., DGS10 affects both mortgage rates and fed rates)
export interface SeedMapEntry {
  slug: string;
  confidence: number;
}

// Macro series seed map — covers FRED, BLS, and EIA series (all use macro_series_observation type)
export const FRED_SERIES_SEED_MAP: Record<string, SeedMapEntry[]> = {
  // FRED series
  CPIAUCSL: [{ slug: "us-inflation-rate", confidence: 1.0 }],
  UNRATE: [{ slug: "us-unemployment-rate", confidence: 1.0 }],
  MORTGAGE30US: [{ slug: "us-mortgage-rates", confidence: 1.0 }],
  DGS10: [
    { slug: "us-mortgage-rates", confidence: 0.8 },
    { slug: "us-federal-reserve-interest-rates", confidence: 0.9 },
  ],
  FEDFUNDS: [
    { slug: "us-federal-reserve-interest-rates", confidence: 1.0 },
    { slug: "us-mortgage-rates", confidence: 0.7 },
  ],
  GDP: [{ slug: "global-recession-risk", confidence: 0.9 }],

  // BLS series
  CES0000000001: [{ slug: "us-unemployment-rate", confidence: 0.9 }],   // Total nonfarm payrolls
  LNS14000000: [{ slug: "us-unemployment-rate", confidence: 1.0 }],     // Unemployment rate
  "CUSR0000SA0": [{ slug: "us-inflation-rate", confidence: 1.0 }],      // CPI-U seasonally adjusted
  "CUUR0000SA0": [{ slug: "us-inflation-rate", confidence: 0.9 }],      // CPI-U unadjusted

  // EIA series
  "PET.RWTC.W": [{ slug: "global-oil-prices", confidence: 1.0 }],      // WTI crude oil weekly
};

// CoinGecko coin_id -> topic slugs (deterministic seed map)
export const COINGECKO_SEED_MAP: Record<string, SeedMapEntry[]> = {
  bitcoin: [{ slug: "bitcoin-price", confidence: 1.0 }],
  ethereum: [{ slug: "ethereum-price", confidence: 1.0 }],
};

// USGS: all earthquake items → earthquake-activity topic
export const USGS_TOPIC_SLUG = "earthquake-activity";

// Polymarket slug keyword → topic mappings (conservative, explicit patterns only)
export const POLYMARKET_SLUG_RULES: Array<{ pattern: string; entries: SeedMapEntry[] }> = [
  { pattern: "world-cup", entries: [{ slug: "fifa-world-cup-2026", confidence: 0.9 }] },
  { pattern: "f1-drivers", entries: [{ slug: "formula-1-2026", confidence: 0.9 }] },
  { pattern: "bitcoin-price", entries: [{ slug: "bitcoin-price", confidence: 0.9 }] },
  { pattern: "ethereum-price", entries: [{ slug: "ethereum-price", confidence: 0.9 }] },
  { pattern: "fed-rate", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.8 }] },
  { pattern: "interest-rate-cut", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.8 }] },
  { pattern: "recession", entries: [{ slug: "global-recession-risk", confidence: 0.8 }] },
  { pattern: "iran", entries: [{ slug: "iran-us-tensions", confidence: 0.7 }] },
  { pattern: "premier-league", entries: [{ slug: "premier-league", confidence: 0.9 }] },
  { pattern: "champions-league", entries: [{ slug: "champions-league", confidence: 0.9 }] },
  { pattern: "nba", entries: [{ slug: "nba-season-2025-26", confidence: 0.9 }] },
  { pattern: "nfl", entries: [{ slug: "nfl-2026-season", confidence: 0.9 }] },
];

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
