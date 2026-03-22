import type { ScoredSignal } from "./types.js";

/**
 * Compute confidence: deterministic heuristic, not statistically calibrated.
 * Derived from freshness, source-family weight, signal count, match score.
 * Component inputs fixed in Phase 3 — do not add ad hoc features.
 */
export function computeConfidence(signals: ScoredSignal[]): number {
  if (signals.length === 0) return 0;

  // Base from signal count (logarithmic)
  const countBase = Math.min(1.0, 0.3 + 0.2 * Math.log(signals.length));

  // Weighted freshness factor
  let freshnessSum = 0;
  let weightSum = 0;
  for (const s of signals) {
    const freshnessFactor =
      s.freshness === "fresh"
        ? 1.0
        : s.freshness === "aging"
          ? 0.7
          : s.freshness === "stale"
            ? 0.4
            : 0.1;

    freshnessSum += freshnessFactor * s.weight;
    weightSum += s.weight;
  }

  const avgFreshness = weightSum > 0 ? freshnessSum / weightSum : 0;

  // Combine
  const confidence = countBase * 0.5 + avgFreshness * 0.5;
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Compute disagreement across generated signals for the current snapshot.
 * Weighted standard deviation of signal directions (up=1, stable=0, down=-1).
 *
 * 0 or 1 usable signals → disagreement = 0.
 * Signals with null delta or unknown direction are excluded.
 */
export function computeDisagreement(signals: ScoredSignal[]): number {
  // Only include signals with valid directional contribution
  const directional = signals.filter(
    (s) => s.delta !== null && s.direction !== "unknown",
  );

  if (directional.length <= 1) return 0;

  const directionValues: Record<string, number> = {
    up: 1,
    stable: 0,
    down: -1,
  };

  // Weighted mean
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of directional) {
    const dv = directionValues[s.direction] ?? 0;
    weightedSum += dv * s.weight;
    totalWeight += s.weight;
  }

  if (totalWeight === 0) return 0;
  const weightedMean = weightedSum / totalWeight;

  // Weighted variance
  let varianceSum = 0;
  for (const s of directional) {
    const dv = directionValues[s.direction] ?? 0;
    const diff = dv - weightedMean;
    varianceSum += s.weight * diff * diff;
  }

  const weightedVariance = varianceSum / totalWeight;
  // Normalize: max possible variance is 1 (all spread between -1 and 1)
  return Math.max(0, Math.min(1, Math.sqrt(weightedVariance)));
}
