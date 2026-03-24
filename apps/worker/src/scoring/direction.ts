import type { ScoredSignal, SignalDirection } from "./types.js";
import { DIRECTION_THRESHOLD } from "./types.js";

/**
 * Compute topic direction from weighted signal deltas.
 * Only signals with non-null delta participate.
 * Extractors normalize deltas into comparable bounded ranges.
 */
export function computeDirection(signals: ScoredSignal[]): SignalDirection {
  const directional = signals.filter((s) => s.delta !== null);

  if (directional.length === 0) {
    return "unknown";
  }

  // For probability-based signals (prediction markets, forecasts):
  // If the absolute probability is very low (< 10%), the answer is "no"
  // regardless of which direction the probability moved.
  const probSignals = directional.filter(
    (s) => s.signalType === "market_probability" || s.signalType === "forecast_probability" || s.signalType === "odds_probability",
  );
  if (probSignals.length > 0 && probSignals.length === directional.length) {
    // All signals are probability-based
    const avgProb = probSignals.reduce((sum, s) => sum + (s.currentValue ?? 0), 0) / probSignals.length;
    if (avgProb < 0.1) return "stable"; // < 10% = very unlikely, not "up"
    if (avgProb > 0.9) return "up";     // > 90% = very likely
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const s of directional) {
    const delta = s.delta as number;
    const normalizedDelta =
      s.previousValue !== null && s.previousValue !== 0
        ? delta / Math.abs(s.previousValue)
        : delta;

    weightedSum += normalizedDelta * s.weight;
    totalWeight += s.weight;
  }

  if (totalWeight === 0) return "unknown";

  const netDirection = weightedSum / totalWeight;

  if (netDirection > DIRECTION_THRESHOLD) return "up";
  if (netDirection < -DIRECTION_THRESHOLD) return "down";
  return "stable";
}
