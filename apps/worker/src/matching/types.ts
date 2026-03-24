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
  forecast_aggregator: "geopolitics",
  sports_odds: "sports",
  defi_signal: "crypto",
  sports_signal: "sports",
};

// FRED series -> topic slugs with confidence (deterministic seed map)
// Multi-topic matching is intentional for shared causal signals (e.g., DGS10 affects both mortgage rates and fed rates)
export interface SeedMapEntry {
  slug: string;
  confidence: number;
}

// Macro series seed map — covers FRED, BLS, and EIA series (all use macro_series_observation type)
// Cross-topic mappings: the same data feeds multiple topics where causally relevant
export const FRED_SERIES_SEED_MAP: Record<string, SeedMapEntry[]> = {
  // FRED series — with cross-topic mappings
  CPIAUCSL: [
    { slug: "us-inflation-rate", confidence: 1.0 },
    { slug: "global-recession-risk", confidence: 0.6 },  // inflation is a recession indicator
  ],
  UNRATE: [
    { slug: "us-unemployment-rate", confidence: 1.0 },
    { slug: "global-recession-risk", confidence: 0.7 },  // rising unemployment signals recession
  ],
  MORTGAGE30US: [{ slug: "us-mortgage-rates", confidence: 1.0 }],
  DGS10: [
    { slug: "us-mortgage-rates", confidence: 0.8 },
    { slug: "us-federal-reserve-interest-rates", confidence: 0.9 },
    { slug: "global-recession-risk", confidence: 0.7 },  // yield curve is recession predictor
  ],
  FEDFUNDS: [
    { slug: "us-federal-reserve-interest-rates", confidence: 1.0 },
    { slug: "us-mortgage-rates", confidence: 0.7 },
    { slug: "global-recession-risk", confidence: 0.6 },  // rate policy affects recession risk
  ],
  GDP: [
    { slug: "global-recession-risk", confidence: 0.9 },
    { slug: "us-unemployment-rate", confidence: 0.6 },   // GDP growth correlates with employment
  ],

  // BLS series — with cross-topic mappings
  CES0000000001: [
    { slug: "us-unemployment-rate", confidence: 0.9 },
    { slug: "global-recession-risk", confidence: 0.5 },  // payroll changes signal economic health
  ],
  LNS14000000: [
    { slug: "us-unemployment-rate", confidence: 1.0 },
    { slug: "global-recession-risk", confidence: 0.7 },
  ],
  "CUSR0000SA0": [
    { slug: "us-inflation-rate", confidence: 1.0 },
    { slug: "global-recession-risk", confidence: 0.5 },
  ],
  "CUUR0000SA0": [{ slug: "us-inflation-rate", confidence: 0.9 }],

  // EIA series
  "PET.RWTC.W": [
    { slug: "global-oil-prices", confidence: 1.0 },
    { slug: "us-inflation-rate", confidence: 0.5 },      // oil prices drive inflation
    { slug: "global-recession-risk", confidence: 0.4 },   // oil shocks can trigger recessions
  ],
};

// CoinGecko coin_id -> topic slugs (deterministic seed map)
export const COINGECKO_SEED_MAP: Record<string, SeedMapEntry[]> = {
  bitcoin: [{ slug: "bitcoin-price", confidence: 1.0 }],
  ethereum: [{ slug: "ethereum-price", confidence: 1.0 }],
};

// USGS: all earthquake items → earthquake-activity topic
export const USGS_TOPIC_SLUG = "earthquake-activity";

// Polymarket slug/question keyword → topic mappings
// These match on both slug AND question text (the matching function checks both)
// Conservative: exact patterns only, no broad political/person-name hacks
export const POLYMARKET_SLUG_RULES: Array<{ pattern: string; entries: SeedMapEntry[] }> = [
  // Sports
  { pattern: "world-cup", entries: [{ slug: "fifa-world-cup-2026", confidence: 0.9 }] },
  { pattern: "fifa-world-cup", entries: [{ slug: "fifa-world-cup-2026", confidence: 0.9 }] },
  { pattern: "f1-drivers", entries: [{ slug: "formula-1-2026", confidence: 0.9 }] },
  { pattern: "premier-league", entries: [{ slug: "premier-league", confidence: 0.9 }] },
  { pattern: "champions-league", entries: [{ slug: "champions-league", confidence: 0.9 }] },
  { pattern: "nba", entries: [{ slug: "nba-season-2025-26", confidence: 0.9 }] },
  { pattern: "nfl", entries: [{ slug: "nfl-2026-season", confidence: 0.9 }] },

  // Crypto (price predictions, not 5-minute micro-bets)
  { pattern: "bitcoin-150", entries: [{ slug: "bitcoin-price", confidence: 0.9 }] },
  { pattern: "bitcoin-100", entries: [{ slug: "bitcoin-price", confidence: 0.9 }] },
  { pattern: "bitcoin-price", entries: [{ slug: "bitcoin-price", confidence: 0.9 }] },
  { pattern: "ethereum-price", entries: [{ slug: "ethereum-price", confidence: 0.9 }] },

  // Macro/Fed
  { pattern: "fed-rate", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.8 }] },
  { pattern: "interest-rate", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.8 }] },
  { pattern: "fed-decrease", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.8 }] },
  { pattern: "recession", entries: [{ slug: "global-recession-risk", confidence: 0.8 }] },

  // Geopolitics (specific patterns, not broad person names)
  { pattern: "iran-ceasefire", entries: [{ slug: "iran-us-tensions", confidence: 0.8 }] },
  { pattern: "us-iran", entries: [{ slug: "iran-us-tensions", confidence: 0.8 }] },
  { pattern: "iran-regime", entries: [{ slug: "iran-us-tensions", confidence: 0.7 }] },
  { pattern: "israel-lebanon", entries: [{ slug: "israel-palestine-conflict", confidence: 0.7 }] },
  { pattern: "israel-ground-offensive", entries: [{ slug: "israel-palestine-conflict", confidence: 0.8 }] },
  { pattern: "ukraine-ceasefire", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },
  { pattern: "russia-ukraine", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },
];

// Manifold Markets question keyword → topic mappings
// Reuses similar patterns as Polymarket but matches on normalized_payload.question
export const MANIFOLD_QUESTION_RULES: Array<{ pattern: string; entries: SeedMapEntry[] }> = [
  { pattern: "world cup", entries: [{ slug: "fifa-world-cup-2026", confidence: 0.8 }] },
  { pattern: "bitcoin", entries: [{ slug: "bitcoin-price", confidence: 0.7 }] },
  { pattern: "ethereum", entries: [{ slug: "ethereum-price", confidence: 0.7 }] },
  { pattern: "fed rate", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.7 }] },
  { pattern: "interest rate", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.6 }] },
  { pattern: "recession", entries: [{ slug: "global-recession-risk", confidence: 0.8 }] },
  { pattern: "mortgage", entries: [{ slug: "us-mortgage-rates", confidence: 0.7 }] },
  { pattern: "inflation", entries: [{ slug: "us-inflation-rate", confidence: 0.7 }] },
  { pattern: "unemployment", entries: [{ slug: "us-unemployment-rate", confidence: 0.7 }] },
  { pattern: "earthquake", entries: [{ slug: "earthquake-activity", confidence: 0.7 }] },
  { pattern: "hurricane", entries: [{ slug: "severe-weather-alerts", confidence: 0.7 }] },
  { pattern: "tariff", entries: [{ slug: "us-trade-policy", confidence: 0.7 }] },
  { pattern: "ai regulation", entries: [{ slug: "artificial-intelligence-policy", confidence: 0.8 }] },
  { pattern: "artificial intelligence", entries: [{ slug: "artificial-intelligence-policy", confidence: 0.7 }] },
  { pattern: "formula 1", entries: [{ slug: "formula-1-2026", confidence: 0.8 }] },
  { pattern: "f1 ", entries: [{ slug: "formula-1-2026", confidence: 0.7 }] },

  // Geopolitics (question-text matching for Polymarket + Manifold)
  { pattern: "iran ceasefire", entries: [{ slug: "iran-us-tensions", confidence: 0.8 }] },
  { pattern: "iran regime", entries: [{ slug: "iran-us-tensions", confidence: 0.7 }] },
  { pattern: "us forces enter iran", entries: [{ slug: "iran-us-tensions", confidence: 0.9 }] },
  { pattern: "israel launch", entries: [{ slug: "israel-palestine-conflict", confidence: 0.8 }] },
  { pattern: "israel lebanon", entries: [{ slug: "israel-palestine-conflict", confidence: 0.7 }] },
  { pattern: "netanyahu", entries: [{ slug: "israel-palestine-conflict", confidence: 0.6 }] },
  { pattern: "ukraine ceasefire", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },
  { pattern: "russia ukraine", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },

  // Sports (question-text)
  { pattern: "premier league", entries: [{ slug: "premier-league", confidence: 0.8 }] },
  { pattern: "nba finals", entries: [{ slug: "nba-season-2025-26", confidence: 0.9 }] },
  { pattern: "world cup", entries: [{ slug: "fifa-world-cup-2026", confidence: 0.9 }] },

  // Fed/macro (question-text)
  { pattern: "fed decrease interest", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.9 }] },
  { pattern: "fed cut", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.8 }] },
];

// Congress.gov title keyword → topic mappings (conservative, policy-specific only)
export const CONGRESS_TITLE_RULES: Array<{ pattern: string; entries: SeedMapEntry[] }> = [
  { pattern: "artificial intelligence", entries: [{ slug: "artificial-intelligence-policy", confidence: 0.9 }] },
  { pattern: "tariff", entries: [{ slug: "us-trade-policy", confidence: 0.9 }] },
  { pattern: "trade", entries: [{ slug: "us-trade-policy", confidence: 0.7 }] },
  { pattern: "immigration", entries: [{ slug: "us-immigration-policy", confidence: 0.9 }] },
  { pattern: "border security", entries: [{ slug: "us-immigration-policy", confidence: 0.8 }] },
  { pattern: "debt ceiling", entries: [{ slug: "us-debt-ceiling", confidence: 1.0 }] },
  { pattern: "debt limit", entries: [{ slug: "us-debt-ceiling", confidence: 1.0 }] },
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
