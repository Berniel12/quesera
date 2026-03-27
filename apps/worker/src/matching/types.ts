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
    { slug: "us-gas-prices", confidence: 0.7 },           // crude drives gas prices
    { slug: "us-inflation-rate", confidence: 0.5 },
    { slug: "global-recession-risk", confidence: 0.4 },
  ],

  // Gold & dollar
  GOLDAMGBD228NLBM: [{ slug: "gold-price", confidence: 1.0 }],
  DTWEXBGS: [{ slug: "us-dollar-strength", confidence: 1.0 }],

  // Housing
  CSUSHPISA: [{ slug: "us-housing-market", confidence: 1.0 }],
  MSPUS: [{ slug: "us-housing-market", confidence: 0.8 }],

  // Stock market
  SP500: [{ slug: "us-stock-market", confidence: 1.0 }],

  // Gas prices
  GASREGW: [{ slug: "us-gas-prices", confidence: 1.0 }],

  // Consumer confidence
  UMCSENT: [{ slug: "us-consumer-confidence", confidence: 1.0 }],

  // Global food prices
  PFOODINDEXM: [{ slug: "global-food-prices", confidence: 0.9 }],

  // ── EIA series (same macro_series_observation type as FRED) ──
  "ELEC.PRICE.US-ALL.M": [{ slug: "us-inflation-rate", confidence: 0.6 }],
  "PET.RWTC.D": [{ slug: "global-oil-prices", confidence: 1.0 }],
  "PET.EMM_EPMR_PTE_NUS_DPG.W": [{ slug: "us-gas-prices", confidence: 0.9 }],
  "NG.RNGWHHD.D": [{ slug: "global-oil-prices", confidence: 0.7 }],
};

// CoinGecko coin_id -> topic slugs (deterministic seed map)
// All major coins also feed the crypto-market rollup topic
export const COINGECKO_SEED_MAP: Record<string, SeedMapEntry[]> = {
  bitcoin: [
    { slug: "bitcoin-price", confidence: 1.0 },
    { slug: "crypto-market", confidence: 0.8 },
  ],
  ethereum: [
    { slug: "ethereum-price", confidence: 1.0 },
    { slug: "crypto-market", confidence: 0.8 },
  ],
  // Additional coins feed the crypto-market rollup
  solana: [{ slug: "crypto-market", confidence: 0.7 }],
  cardano: [{ slug: "crypto-market", confidence: 0.6 }],
  dogecoin: [{ slug: "crypto-market", confidence: 0.6 }],
  "avalanche-2": [{ slug: "crypto-market", confidence: 0.5 }],
  chainlink: [{ slug: "crypto-market", confidence: 0.5 }],
  polkadot: [{ slug: "crypto-market", confidence: 0.5 }],
  uniswap: [{ slug: "crypto-market", confidence: 0.5 }],
  ripple: [{ slug: "crypto-market", confidence: 0.6 }],
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

  // Geopolitics
  { pattern: "iran-ceasefire", entries: [{ slug: "iran-us-tensions", confidence: 0.8 }] },
  { pattern: "us-iran", entries: [{ slug: "iran-us-tensions", confidence: 0.8 }] },
  { pattern: "iran-regime", entries: [{ slug: "iran-us-tensions", confidence: 0.7 }] },
  { pattern: "iran-nuclear", entries: [{ slug: "iran-nuclear-program", confidence: 0.9 }] },
  { pattern: "israel-lebanon", entries: [{ slug: "lebanon-war-2026", confidence: 0.8 }] },
  { pattern: "israel-ground-offensive", entries: [{ slug: "israel-palestine-conflict", confidence: 0.8 }] },
  { pattern: "israel-ceasefire", entries: [{ slug: "israel-palestine-conflict", confidence: 0.8 }] },
  { pattern: "gaza", entries: [{ slug: "israel-palestine-conflict", confidence: 0.8 }] },
  { pattern: "ukraine-ceasefire", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },
  { pattern: "russia-ukraine", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },
  { pattern: "nato", entries: [{ slug: "nato-alliance", confidence: 0.7 }] },
  { pattern: "north-korea", entries: [{ slug: "north-korea", confidence: 0.8 }] },
  { pattern: "china-taiwan", entries: [{ slug: "china-taiwan-relations", confidence: 0.9 }] },
  { pattern: "taiwan-invasion", entries: [{ slug: "china-taiwan-relations", confidence: 0.9 }] },
  { pattern: "sudan", entries: [{ slug: "sudan-conflict", confidence: 0.7 }] },
  { pattern: "venezuela", entries: [{ slug: "venezuela-crisis", confidence: 0.7 }] },

  // Tech
  { pattern: "tiktok-ban", entries: [{ slug: "tiktok-ban", confidence: 0.9 }] },
  { pattern: "tiktok", entries: [{ slug: "tiktok-ban", confidence: 0.7 }] },
  { pattern: "tesla-stock", entries: [{ slug: "tesla", confidence: 0.8 }] },
  { pattern: "tesla", entries: [{ slug: "tesla", confidence: 0.6 }] },
  { pattern: "spacex", entries: [{ slug: "spacex-starship", confidence: 0.8 }] },
  { pattern: "starship", entries: [{ slug: "spacex-starship", confidence: 0.9 }] },
  { pattern: "apple", entries: [{ slug: "apple", confidence: 0.5 }] },
  { pattern: "openai", entries: [{ slug: "ai-industry", confidence: 0.8 }] },
  { pattern: "gpt", entries: [{ slug: "ai-industry", confidence: 0.7 }] },

  // US politics
  { pattern: "midterm", entries: [{ slug: "2026-us-midterm-elections", confidence: 0.9 }] },
  { pattern: "congress", entries: [{ slug: "us-congress-legislation", confidence: 0.6 }] },
  { pattern: "supreme-court", entries: [{ slug: "us-supreme-court", confidence: 0.8 }] },
  { pattern: "debt-ceiling", entries: [{ slug: "us-debt-ceiling", confidence: 0.9 }] },
  { pattern: "immigration", entries: [{ slug: "us-immigration-policy", confidence: 0.8 }] },

  // Entertainment
  { pattern: "oscar", entries: [{ slug: "oscar-awards-2026", confidence: 0.9 }] },
  { pattern: "academy-award", entries: [{ slug: "oscar-awards-2026", confidence: 0.9 }] },
  { pattern: "taylor-swift", entries: [{ slug: "taylor-swift", confidence: 0.9 }] },
  { pattern: "marvel", entries: [{ slug: "marvel-cinematic-universe", confidence: 0.8 }] },
  { pattern: "grammy", entries: [{ slug: "grammy-awards-2026", confidence: 0.9 }] },
  { pattern: "eurovision", entries: [{ slug: "eurovision-2026", confidence: 0.9 }] },
  { pattern: "netflix", entries: [{ slug: "netflix-streaming-wars", confidence: 0.7 }] },
  { pattern: "gta-6", entries: [{ slug: "gta-6", confidence: 0.9 }] },
  { pattern: "gta-vi", entries: [{ slug: "gta-6", confidence: 0.9 }] },
  { pattern: "beyonce", entries: [{ slug: "beyonce", confidence: 0.9 }] },
  { pattern: "k-pop", entries: [{ slug: "k-pop", confidence: 0.8 }] },
  { pattern: "bts", entries: [{ slug: "k-pop", confidence: 0.7 }] },
  { pattern: "blackpink", entries: [{ slug: "k-pop", confidence: 0.7 }] },
  { pattern: "bollywood", entries: [{ slug: "bollywood", confidence: 0.8 }] },
  { pattern: "star-wars", entries: [{ slug: "star-wars", confidence: 0.9 }] },
  { pattern: "mandalorian", entries: [{ slug: "star-wars", confidence: 0.8 }] },
  { pattern: "house-of-the-dragon", entries: [{ slug: "game-of-thrones-spinoffs", confidence: 0.9 }] },
  { pattern: "game-of-thrones", entries: [{ slug: "game-of-thrones-spinoffs", confidence: 0.8 }] },
  { pattern: "spotify", entries: [{ slug: "spotify-vs-apple-music", confidence: 0.7 }] },

  // International sports
  { pattern: "la-liga", entries: [{ slug: "la-liga", confidence: 0.9 }] },
  { pattern: "bundesliga", entries: [{ slug: "bundesliga", confidence: 0.9 }] },
  { pattern: "ipl", entries: [{ slug: "ipl-cricket", confidence: 0.9 }] },
  { pattern: "cricket", entries: [{ slug: "cricket-world-cup", confidence: 0.7 }] },
  { pattern: "rugby", entries: [{ slug: "rugby-world-cup", confidence: 0.7 }] },
  { pattern: "wimbledon", entries: [{ slug: "tennis-grand-slams", confidence: 0.9 }] },
  { pattern: "us-open-tennis", entries: [{ slug: "tennis-grand-slams", confidence: 0.9 }] },
  { pattern: "french-open", entries: [{ slug: "tennis-grand-slams", confidence: 0.9 }] },
  { pattern: "olympics", entries: [{ slug: "olympics-2028", confidence: 0.8 }] },
  { pattern: "tour-de-france", entries: [{ slug: "tour-de-france", confidence: 0.9 }] },

  // Non-US economics
  { pattern: "ecb", entries: [{ slug: "ecb-interest-rates", confidence: 0.8 }] },
  { pattern: "european-central-bank", entries: [{ slug: "ecb-interest-rates", confidence: 0.9 }] },
  { pattern: "uk-inflation", entries: [{ slug: "uk-inflation", confidence: 0.9 }] },
  { pattern: "bank-of-england", entries: [{ slug: "uk-inflation", confidence: 0.7 }] },
  { pattern: "china-gdp", entries: [{ slug: "china-gdp-growth", confidence: 0.9 }] },
  { pattern: "yen", entries: [{ slug: "japan-economy", confidence: 0.7 }] },
  { pattern: "rupee", entries: [{ slug: "india-economy", confidence: 0.7 }] },
  { pattern: "euro-dollar", entries: [{ slug: "euro-exchange-rate", confidence: 0.8 }] },

  // Non-US politics
  { pattern: "uk-election", entries: [{ slug: "uk-elections", confidence: 0.9 }] },
  { pattern: "india-election", entries: [{ slug: "india-elections", confidence: 0.9 }] },
  { pattern: "modi", entries: [{ slug: "india-elections", confidence: 0.7 }] },
  { pattern: "brazil-election", entries: [{ slug: "brazil-politics", confidence: 0.8 }] },
  { pattern: "lula", entries: [{ slug: "brazil-politics", confidence: 0.7 }] },
  { pattern: "macron", entries: [{ slug: "france-elections", confidence: 0.7 }] },
  { pattern: "france-election", entries: [{ slug: "france-elections", confidence: 0.9 }] },

  // Macro extras
  { pattern: "gold-price", entries: [{ slug: "gold-price", confidence: 0.9 }] },
  { pattern: "dollar", entries: [{ slug: "us-dollar-strength", confidence: 0.6 }] },
  { pattern: "oil-price", entries: [{ slug: "global-oil-prices", confidence: 0.8 }] },
  { pattern: "housing", entries: [{ slug: "us-housing-market", confidence: 0.7 }] },
  { pattern: "stock-market", entries: [{ slug: "us-stock-market", confidence: 0.7 }] },
  { pattern: "sp500", entries: [{ slug: "us-stock-market", confidence: 0.8 }] },
  { pattern: "s-p-500", entries: [{ slug: "us-stock-market", confidence: 0.8 }] },
  { pattern: "gas-price", entries: [{ slug: "us-gas-prices", confidence: 0.8 }] },
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
  { pattern: "hurricane season", entries: [{ slug: "hurricane-season-2026", confidence: 0.9 }] },
  { pattern: "hurricane landfall", entries: [{ slug: "hurricane-season-2026", confidence: 0.8 }] },
  { pattern: "tropical storm", entries: [{ slug: "hurricane-season-2026", confidence: 0.7 }] },
  { pattern: "atlantic hurricane", entries: [{ slug: "hurricane-season-2026", confidence: 0.9 }] },
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
  { pattern: "israel lebanon", entries: [{ slug: "lebanon-war-2026", confidence: 0.8 }] },
  { pattern: "netanyahu", entries: [{ slug: "israel-palestine-conflict", confidence: 0.6 }] },
  { pattern: "ukraine ceasefire", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },
  { pattern: "russia ukraine", entries: [{ slug: "russia-ukraine-war", confidence: 0.8 }] },

  // Sports
  { pattern: "premier league", entries: [{ slug: "premier-league", confidence: 0.8 }] },
  { pattern: "nba finals", entries: [{ slug: "nba-season-2025-26", confidence: 0.9 }] },
  { pattern: "nba champion", entries: [{ slug: "nba-season-2025-26", confidence: 0.9 }] },
  { pattern: "world cup", entries: [{ slug: "fifa-world-cup-2026", confidence: 0.9 }] },
  { pattern: "champions league", entries: [{ slug: "champions-league", confidence: 0.8 }] },
  { pattern: "super bowl", entries: [{ slug: "nfl-2026-season", confidence: 0.9 }] },
  { pattern: "nfl", entries: [{ slug: "nfl-2026-season", confidence: 0.6 }] },
  { pattern: "world series", entries: [{ slug: "mlb-season-2026", confidence: 0.8 }] },
  { pattern: "ufc ", entries: [{ slug: "ufc-mma", confidence: 0.8 }] },
  { pattern: "formula 1", entries: [{ slug: "formula-1-2026", confidence: 0.8 }] },

  // Fed/macro
  { pattern: "fed decrease interest", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.9 }] },
  { pattern: "fed cut", entries: [{ slug: "us-federal-reserve-interest-rates", confidence: 0.8 }] },
  { pattern: "gold price", entries: [{ slug: "gold-price", confidence: 0.8 }] },
  { pattern: "oil price", entries: [{ slug: "global-oil-prices", confidence: 0.8 }] },
  { pattern: "gas price", entries: [{ slug: "us-gas-prices", confidence: 0.7 }] },
  { pattern: "stock market", entries: [{ slug: "us-stock-market", confidence: 0.7 }] },
  { pattern: "s&p 500", entries: [{ slug: "us-stock-market", confidence: 0.8 }] },
  { pattern: "housing market", entries: [{ slug: "us-housing-market", confidence: 0.8 }] },
  { pattern: "home price", entries: [{ slug: "us-housing-market", confidence: 0.7 }] },
  { pattern: "food price", entries: [{ slug: "global-food-prices", confidence: 0.7 }] },
  { pattern: "dollar strength", entries: [{ slug: "us-dollar-strength", confidence: 0.8 }] },

  // Geopolitics
  { pattern: "china taiwan", entries: [{ slug: "china-taiwan-relations", confidence: 0.9 }] },
  { pattern: "north korea", entries: [{ slug: "north-korea", confidence: 0.8 }] },
  { pattern: "sudan", entries: [{ slug: "sudan-conflict", confidence: 0.7 }] },
  { pattern: "venezuela", entries: [{ slug: "venezuela-crisis", confidence: 0.7 }] },
  { pattern: "nato", entries: [{ slug: "nato-alliance", confidence: 0.7 }] },
  { pattern: "european union", entries: [{ slug: "european-union", confidence: 0.6 }] },
  { pattern: "lebanon", entries: [{ slug: "lebanon-war-2026", confidence: 0.7 }] },
  { pattern: "hezbollah", entries: [{ slug: "lebanon-war-2026", confidence: 0.8 }] },
  { pattern: "cuba", entries: [{ slug: "us-cuba-relations", confidence: 0.6 }] },
  { pattern: "climate change", entries: [{ slug: "climate-change", confidence: 0.7 }] },
  { pattern: "global warming", entries: [{ slug: "climate-change", confidence: 0.7 }] },

  // Tech
  { pattern: "tiktok ban", entries: [{ slug: "tiktok-ban", confidence: 0.9 }] },
  { pattern: "tiktok", entries: [{ slug: "tiktok-ban", confidence: 0.6 }] },
  { pattern: "tesla", entries: [{ slug: "tesla", confidence: 0.6 }] },
  { pattern: "spacex", entries: [{ slug: "spacex-starship", confidence: 0.7 }] },
  { pattern: "starship", entries: [{ slug: "spacex-starship", confidence: 0.8 }] },
  { pattern: "openai", entries: [{ slug: "ai-industry", confidence: 0.8 }] },
  { pattern: "apple ", entries: [{ slug: "apple", confidence: 0.5 }] },

  // Entertainment
  { pattern: "oscar", entries: [{ slug: "oscar-awards-2026", confidence: 0.9 }] },
  { pattern: "taylor swift", entries: [{ slug: "taylor-swift", confidence: 0.9 }] },
  { pattern: "marvel", entries: [{ slug: "marvel-cinematic-universe", confidence: 0.8 }] },
  { pattern: "grammy", entries: [{ slug: "grammy-awards-2026", confidence: 0.9 }] },
  { pattern: "eurovision", entries: [{ slug: "eurovision-2026", confidence: 0.9 }] },
  { pattern: "gta 6", entries: [{ slug: "gta-6", confidence: 0.9 }] },
  { pattern: "grand theft auto", entries: [{ slug: "gta-6", confidence: 0.9 }] },
  { pattern: "beyonce", entries: [{ slug: "beyonce", confidence: 0.9 }] },
  { pattern: "k-pop", entries: [{ slug: "k-pop", confidence: 0.8 }] },
  { pattern: "bts ", entries: [{ slug: "k-pop", confidence: 0.7 }] },
  { pattern: "blackpink", entries: [{ slug: "k-pop", confidence: 0.7 }] },
  { pattern: "bollywood", entries: [{ slug: "bollywood", confidence: 0.8 }] },
  { pattern: "star wars", entries: [{ slug: "star-wars", confidence: 0.9 }] },
  { pattern: "house of the dragon", entries: [{ slug: "game-of-thrones-spinoffs", confidence: 0.9 }] },
  { pattern: "netflix", entries: [{ slug: "netflix-streaming-wars", confidence: 0.7 }] },
  { pattern: "streaming war", entries: [{ slug: "netflix-streaming-wars", confidence: 0.8 }] },
  { pattern: "spotify", entries: [{ slug: "spotify-vs-apple-music", confidence: 0.7 }] },
  { pattern: "video game", entries: [{ slug: "video-game-industry", confidence: 0.7 }] },

  // International sports
  { pattern: "la liga", entries: [{ slug: "la-liga", confidence: 0.9 }] },
  { pattern: "bundesliga", entries: [{ slug: "bundesliga", confidence: 0.9 }] },
  { pattern: "ipl", entries: [{ slug: "ipl-cricket", confidence: 0.9 }] },
  { pattern: "cricket world cup", entries: [{ slug: "cricket-world-cup", confidence: 0.9 }] },
  { pattern: "wimbledon", entries: [{ slug: "tennis-grand-slams", confidence: 0.9 }] },
  { pattern: "olympics", entries: [{ slug: "olympics-2028", confidence: 0.8 }] },
  { pattern: "tour de france", entries: [{ slug: "tour-de-france", confidence: 0.9 }] },
  { pattern: "rugby world cup", entries: [{ slug: "rugby-world-cup", confidence: 0.9 }] },

  // Non-US economics
  { pattern: "ecb", entries: [{ slug: "ecb-interest-rates", confidence: 0.8 }] },
  { pattern: "bank of england", entries: [{ slug: "uk-inflation", confidence: 0.7 }] },
  { pattern: "china gdp", entries: [{ slug: "china-gdp-growth", confidence: 0.9 }] },
  { pattern: "india economy", entries: [{ slug: "india-economy", confidence: 0.8 }] },

  // Non-US politics
  { pattern: "uk election", entries: [{ slug: "uk-elections", confidence: 0.9 }] },
  { pattern: "india election", entries: [{ slug: "india-elections", confidence: 0.9 }] },
  { pattern: "modi", entries: [{ slug: "india-elections", confidence: 0.7 }] },
  { pattern: "macron", entries: [{ slug: "france-elections", confidence: 0.7 }] },
  { pattern: "lula", entries: [{ slug: "brazil-politics", confidence: 0.7 }] },

  // US politics
  { pattern: "midterm", entries: [{ slug: "2026-us-midterm-elections", confidence: 0.9 }] },
  { pattern: "supreme court", entries: [{ slug: "us-supreme-court", confidence: 0.8 }] },
  { pattern: "debt ceiling", entries: [{ slug: "us-debt-ceiling", confidence: 0.9 }] },
  { pattern: "healthcare", entries: [{ slug: "us-healthcare-policy", confidence: 0.6 }] },
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
  { pattern: "healthcare", entries: [{ slug: "us-healthcare-policy", confidence: 0.8 }] },
  { pattern: "health insurance", entries: [{ slug: "us-healthcare-policy", confidence: 0.7 }] },
  { pattern: "medicare", entries: [{ slug: "us-healthcare-policy", confidence: 0.8 }] },
  { pattern: "medicaid", entries: [{ slug: "us-healthcare-policy", confidence: 0.8 }] },
  { pattern: "climate", entries: [{ slug: "climate-change", confidence: 0.7 }] },
  { pattern: "environment", entries: [{ slug: "climate-change", confidence: 0.5 }] },
  { pattern: "tiktok", entries: [{ slug: "tiktok-ban", confidence: 0.9 }] },
  { pattern: "social media", entries: [{ slug: "tiktok-ban", confidence: 0.5 }] },
  { pattern: "cuba", entries: [{ slug: "us-cuba-relations", confidence: 0.8 }] },
  { pattern: "iran", entries: [{ slug: "iran-nuclear-program", confidence: 0.6 }] },
  { pattern: "supreme court", entries: [{ slug: "us-supreme-court", confidence: 0.9 }] },
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
