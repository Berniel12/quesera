import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import { aggregateSignals } from "./signals.js";
import { computeDirection } from "./direction.js";
import { computeConfidence, computeDisagreement } from "./confidence.js";
import { computeTopicFreshness } from "./freshness.js";
import { SCORING_VERSION } from "./types.js";
import type { ScoredState, ScoredSignal } from "./types.js";

export interface ScoringResult {
  state: ScoredState;
  signals: ScoredSignal[];
  usableSignalCount: number;
  totalSignalCount: number;
}

/**
 * Run the deterministic scoring engine for a topic.
 * Returns null if no usable signals exist (topic should be skipped).
 */
export async function scoreTopic(
  supabase: SupabaseClient,
  topicId: string,
  priorSnapshotId: string | null,
  logger: Logger,
): Promise<ScoringResult | null> {
  const signals = await aggregateSignals(
    supabase,
    topicId,
    priorSnapshotId,
    logger,
  );

  if (signals.length === 0) {
    logger.info({ topicId }, "No usable signals for scoring");
    return null;
  }

  // Quality gate: reject if ALL signals come from 1-2 prediction market questions
  // (likely contamination -- e.g., 4 hockey bets on a hurricane topic)
  const marketSignals = signals.filter((s) => s.sourceFamily === "prediction_market");
  if (marketSignals.length > 0 && marketSignals.length === signals.length) {
    const uniqueQuestions = new Set(
      marketSignals.map((s) => String(s.metadata["question"] ?? ""))
    );
    if (uniqueQuestions.size <= 2) {
      logger.warn(
        { topicId, signalCount: signals.length, uniqueQuestions: uniqueQuestions.size },
        "All signals from 1-2 market questions -- likely contamination, skipping snapshot",
      );
      return null;
    }
  }

  const direction = computeDirection(signals);
  const confidence = computeConfidence(signals);
  const disagreement = computeDisagreement(signals);
  const { freshness, stalenessSeconds } = computeTopicFreshness(signals);

  // Build structured_data: compact, deterministic, fallback source of truth
  const topSignals = signals
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map((s) => ({
      source_family: s.sourceFamily,
      signal_type: s.signalType,
      current_value: s.currentValue,
      delta: s.delta,
      direction: s.direction,
    }));

  const state: ScoredState = {
    direction,
    confidence: Math.round(confidence * 10000) / 10000,
    disagreement: Math.round(disagreement * 10000) / 10000,
    freshness,
    stalenessSeconds,
    structuredData: {
      direction,
      confidence: Math.round(confidence * 10000) / 10000,
      disagreement: Math.round(disagreement * 10000) / 10000,
      freshness,
      staleness_seconds: stalenessSeconds,
      signal_count: signals.length,
      top_signals: topSignals,
      scoring_version: SCORING_VERSION,
    },
  };

  return {
    state,
    signals,
    usableSignalCount: signals.length,
    totalSignalCount: signals.length,
  };
}
