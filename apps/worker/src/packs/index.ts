/**
 * Source Pack Registry
 *
 * Defines required source coverage per question family.
 * Two-layer model:
 *   - Predictive spine: market-style APIs that drive the probability
 *   - Strengthening layer: official/context APIs that ground the prediction
 *
 * A question can only be homepage-featured if it passes its pack's requirements.
 */

export type QuestionType = "binary_event" | "threshold" | "competition";

export interface SourcePack {
  /** Unique pack identifier */
  id: string;
  /** Which question template types this pack serves */
  questionTypes: QuestionType[];
  /** Which topic categories it applies to */
  categories: string[];
  /** Market-style families that drive the probabilistic read */
  predictiveSpine: string[];
  /** Official/context families that ground the prediction */
  strengtheningLayer: string[];
  /** Minimum distinct predictive families or platforms needed */
  minPredictiveSources: number;
  /** Minimum total signal count (baseline floor, not a quality measure) */
  minTotalSignals: number;
  /** Whether at least 1 strengthening source is required */
  requireStrengthening: boolean;
  /** Whether binary event extra gate applies (need strengthening OR 2+ platforms) */
  requirePlatformDiversity: boolean;
}

// ── Pack definitions ────────────────────────────────────────────────────

/**
 * Competition Sports Pack
 * Core: Polymarket + The Odds API (bookmakers)
 * Strengthening: ESPN, football-data.org (future)
 */
const COMPETITION_SPORTS: SourcePack = {
  id: "competition_sports",
  questionTypes: ["competition"],
  categories: ["sports", "entertainment"],
  predictiveSpine: ["prediction_market", "sports_odds"],
  strengtheningLayer: ["sports_official", "sports_signal", "news_evidence"],
  minPredictiveSources: 2,
  minTotalSignals: 4,
  requireStrengthening: false,
  requirePlatformDiversity: false,
};

/**
 * Threshold Macro Pack
 * Core: Polymarket + Kalshi + Metaculus (predictions), CoinGecko (crypto price)
 * Strengthening: FRED, BLS (must have official data to ground)
 */
const THRESHOLD_MACRO: SourcePack = {
  id: "threshold_macro",
  questionTypes: ["threshold"],
  categories: ["macro", "crypto"],
  predictiveSpine: ["prediction_market", "forecasting", "crypto_market"],
  strengtheningLayer: ["macro_official"],
  minPredictiveSources: 1,
  minTotalSignals: 3,
  requireStrengthening: true,
  requirePlatformDiversity: false,
};

/**
 * Binary Event General Pack
 * Core: Polymarket + Kalshi + Metaculus
 * Strengthening: Congress.gov, FRED, news
 * Extra gate: need strengthening OR 2+ distinct prediction platforms
 */
const BINARY_EVENT_GENERAL: SourcePack = {
  id: "binary_event_general",
  questionTypes: ["binary_event"],
  categories: [
    "geopolitics", "politics", "tech", "entertainment",
    "disasters", "macro", "crypto",
  ],
  predictiveSpine: ["prediction_market", "forecasting"],
  strengtheningLayer: ["political_official", "macro_official", "news_evidence", "hazard_weather"],
  minPredictiveSources: 1,
  minTotalSignals: 3,
  requireStrengthening: false,
  requirePlatformDiversity: true,
};

// ── Registry ────────────────────────────────────────────────────────────

export const SOURCE_PACKS: SourcePack[] = [
  COMPETITION_SPORTS,
  THRESHOLD_MACRO,
  BINARY_EVENT_GENERAL,
];

// ── Human-readable source family names ──────────────────────────────────

export const FAMILY_DISPLAY: Record<string, string> = {
  macro_official: "official data",
  crypto_market: "crypto data",
  prediction_market: "prediction markets",
  sports_odds: "bookmakers",
  forecasting: "forecasters",
  forecast_aggregator: "forecasters",
  political_official: "congressional records",
  news_evidence: "news sources",
  hazard_weather: "weather services",
  sports_official: "sports data",
  sports_signal: "sports data",
  defi_signal: "DeFi data",
};
