export const SCORING_VERSION = "v1.0.0";

// Source family weights for signal scoring
export const SOURCE_FAMILY_WEIGHTS: Record<string, number> = {
  macro_official: 0.8,
  political_official: 0.7,
  hazard_weather: 0.9,
  crypto_market: 0.8,
  prediction_market: 0.7,
  forecast_aggregator: 0.7,
  sports_odds: 0.75,
  defi_signal: 0.6,
  sports_signal: 0.5,
};

// Direction threshold (relative to normalized scale)
export const DIRECTION_THRESHOLD = 0.01;

// Change detection thresholds for summarization trigger
export const CONFIDENCE_CHANGE_THRESHOLD = 0.15;
export const DISAGREEMENT_CHANGE_THRESHOLD = 0.15;
export const MAX_SUMMARY_AGE_HOURS = 168; // 7 days

// Freshness buckets (hours since last signal update)
export const FRESHNESS_BUCKETS = {
  fresh: 1,
  aging: 6,
  stale: 24,
} as const;

// Political status ordinals (code-owned, deterministic)
export const POLITICAL_STATUS_ORDINALS: Record<string, number> = {
  introduced: 1,
  referred: 2,
  reported: 3,
  passed_one: 4,
  passed_both: 5,
  signed: 6,
  vetoed: -1,
};

// NWS severity ordinals
export const SEVERITY_ORDINALS: Record<string, number> = {
  Minor: 1,
  Moderate: 2,
  Severe: 3,
  Extreme: 4,
};

export type SignalDirection = "up" | "down" | "stable" | "unknown";
export type FreshnessStatus = "fresh" | "aging" | "stale" | "dead" | "unknown";

export interface ScoredSignal {
  sourceFamily: string;
  sourceName: string;
  signalType: string;
  currentValue: number;
  previousValue: number | null;
  delta: number | null;
  direction: SignalDirection;
  weight: number;
  freshness: FreshnessStatus;
  externalId: string | null;
  signalTimestamp: Date;
  metadata: Record<string, unknown>;
}

export interface ScoredState {
  direction: SignalDirection;
  confidence: number;
  disagreement: number;
  freshness: FreshnessStatus;
  stalenessSeconds: number | null;
  structuredData: Record<string, unknown>;
}

export interface ChangeResult {
  shouldPublish: boolean;
  shouldSummarize: boolean;
  directionChanged: boolean;
  confidenceDelta: number | null;
  disagreementDelta: number | null;
}

// Snapshot generation run statuses (code-constrained)
export const RUN_STATUSES = ["running", "completed", "failed", "skipped"] as const;
