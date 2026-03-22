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

  let weightedSum = 0;
  let totalWeight = 0;

  for (const s of directional) {
    const delta = s.delta as number; // safe: filtered to non-null above
    // Normalize delta as percentage change from previous value
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
