import type { ScoredState, ChangeResult, SignalDirection } from "./types.js";
import {
  CONFIDENCE_CHANGE_THRESHOLD,
  DISAGREEMENT_CHANGE_THRESHOLD,
  MAX_SUMMARY_AGE_HOURS,
} from "./types.js";

interface PriorSnapshot {
  direction: SignalDirection;
  confidence: number;
  disagreement: number;
  published_at: string;
  current_picture_text: string | null;
}

/**
 * Compare current scored state vs prior snapshot.
 * Always publish when usable inputs exist.
 * Summarize on material change or first snapshot.
 */
export function detectChanges(
  current: ScoredState,
  prior: PriorSnapshot | null,
): ChangeResult {
  // First snapshot always publishes and triggers summarization
  if (!prior) {
    return {
      shouldPublish: true,
      shouldSummarize: true,
      directionChanged: false,
      confidenceDelta: null,
      disagreementDelta: null,
    };
  }

  const directionChanged = current.direction !== prior.direction;
  const confidenceDelta = Math.abs(current.confidence - prior.confidence);
  const disagreementDelta = Math.abs(
    current.disagreement - prior.disagreement,
  );

  // Check time since last summarization
  const lastSummaryTime = prior.current_picture_text
    ? new Date(prior.published_at).getTime()
    : 0;
  const hoursSinceLastSummary =
    (Date.now() - lastSummaryTime) / (1000 * 60 * 60);

  const shouldSummarize =
    directionChanged ||
    confidenceDelta >= CONFIDENCE_CHANGE_THRESHOLD ||
    disagreementDelta >= DISAGREEMENT_CHANGE_THRESHOLD ||
    hoursSinceLastSummary >= MAX_SUMMARY_AGE_HOURS;

  return {
    shouldPublish: true, // Always publish when usable inputs exist
    shouldSummarize,
    directionChanged,
    confidenceDelta,
    disagreementDelta,
  };
}
