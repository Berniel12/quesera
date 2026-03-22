import type { ScoredSignal, FreshnessStatus } from "./types.js";
import { FRESHNESS_BUCKETS } from "./types.js";

/**
 * Compute topic-level freshness from the most recent usable signal timestamp.
 * Not snapshot creation time, not ingestion time.
 */
export function computeTopicFreshness(
  signals: ScoredSignal[],
): { freshness: FreshnessStatus; stalenessSeconds: number | null } {
  if (signals.length === 0) {
    return { freshness: "unknown", stalenessSeconds: null };
  }

  const now = Date.now();
  let mostRecent = 0;

  for (const s of signals) {
    const ts = s.signalTimestamp.getTime();
    if (ts > mostRecent) {
      mostRecent = ts;
    }
  }

  if (mostRecent === 0) {
    return { freshness: "unknown", stalenessSeconds: null };
  }

  const ageHours = (now - mostRecent) / (1000 * 60 * 60);
  const stalenessSeconds = Math.round((now - mostRecent) / 1000);

  let freshness: FreshnessStatus;
  if (ageHours < FRESHNESS_BUCKETS.fresh) {
    freshness = "fresh";
  } else if (ageHours < FRESHNESS_BUCKETS.aging) {
    freshness = "aging";
  } else if (ageHours < FRESHNESS_BUCKETS.stale) {
    freshness = "stale";
  } else {
    freshness = "dead";
  }

  return { freshness, stalenessSeconds };
}

/**
 * Compute freshness for an individual signal.
 */
export function computeFreshnessForSignal(timestamp: Date): FreshnessStatus {
  const ageHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);

  if (ageHours < FRESHNESS_BUCKETS.fresh) return "fresh";
  if (ageHours < FRESHNESS_BUCKETS.aging) return "aging";
  if (ageHours < FRESHNESS_BUCKETS.stale) return "stale";
  return "dead";
}
