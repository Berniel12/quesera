/**
 * Why-line generator for homepage cards.
 *
 * Produces a short contextual phrase that sits below the card verdict,
 * turning each card from a static label into a mini-story.
 *
 * Separated from answer-state.ts because why-lines depend on per-template
 * card context (competition gap, threshold distance, snapshot age) that
 * the verdict system should not own.
 *
 * For Pass 1, works WITHOUT delta columns by using data already on
 * public_topic_cards: freshness, snapshot_published_at, confidence, direction.
 */

import type { QuestionType } from "./question-contracts";

export interface WhyLineInput {
  questionType: QuestionType;
  direction: string | null;
  confidence: number | null;
  freshness: string | null;
  snapshotPublishedAt: string | null;
  /** Optional: confidence change from previous snapshot (positive = strengthened) */
  delta?: number | null;
  /** Optional: competition leader's margin over second place in percentage points */
  competitionGap?: number | null;
  /** Optional: distance to threshold target as a ratio (0 = at target, 1 = 100% away) */
  thresholdDistance?: number | null;
  /** Optional: name of the current competition leader */
  leaderName?: string | null;
}

/**
 * Generate a contextual "why line" for a homepage card.
 * Returns null if no meaningful why-line can be produced.
 */
export function getWhyLine(input: WhyLineInput): string | null {
  const {
    questionType,
    direction,
    confidence,
    freshness,
    snapshotPublishedAt,
    delta,
    competitionGap,
    thresholdDistance,
    leaderName,
  } = input;

  // If we have explicit delta data, that's the strongest why-line
  if (delta !== undefined && delta !== null && Math.abs(delta) > 0.02) {
    const pts = Math.round(Math.abs(delta) * 100);
    if (delta > 0) {
      return questionType === "competition"
        ? `Gap widened by ${pts} pts`
        : `Up ${pts} pts recently`;
    }
    return questionType === "competition"
      ? `Gap narrowed by ${pts} pts`
      : `Down ${pts} pts recently`;
  }

  // Template-specific why-lines from available context
  switch (questionType) {
    case "competition":
      return getCompetitionWhyLine(direction, confidence, competitionGap, leaderName);
    case "threshold":
      return getThresholdWhyLine(direction, confidence, thresholdDistance);
    case "binary_event":
      return getBinaryWhyLine(direction, confidence, freshness, snapshotPublishedAt);
  }
}

function getCompetitionWhyLine(
  direction: string | null,
  confidence: number | null,
  gap: number | null | undefined,
  leaderName: string | null | undefined,
): string | null {
  // If we know the gap, that's the most dramatic info
  if (gap !== undefined && gap !== null) {
    if (gap < 3) return "Razor-thin margin";
    if (gap < 8) return `Leading by ${Math.round(gap)} pts`;
    if (gap < 20) return `Comfortable lead -- ${Math.round(gap)} pts`;
    return `Dominant -- ${Math.round(gap)} pt lead`;
  }

  // Derive from confidence + direction
  const conf = confidence ?? 0;
  if (conf >= 0.7) return leaderName ? `${leaderName} firmly in front` : "Clear favorite emerging";
  if (conf >= 0.5) return "Front-runner, but pressure building";
  if (conf >= 0.35) return "Several contenders in the mix";
  if (direction === "stable") return "No clear favorite yet";
  return "Race still forming";
}

function getThresholdWhyLine(
  direction: string | null,
  confidence: number | null,
  distance: number | null | undefined,
): string | null {
  // If we know the distance to target
  if (distance !== undefined && distance !== null) {
    const pct = Math.round(Math.abs(distance) * 100);
    if (distance <= 0) return "Target reached";
    if (pct <= 5) return `Just ${pct}% away`;
    if (pct <= 15) return `${pct}% below target`;
    if (pct <= 30) return `Still ${pct}% to go`;
    return `${pct}% away -- long road ahead`;
  }

  // Derive from confidence + direction
  const conf = confidence ?? 0;
  if (direction === "up" && conf >= 0.6) return "Momentum building toward target";
  if (direction === "up" && conf >= 0.35) return "Edging closer";
  if (direction === "down" && conf >= 0.6) return "Pulling further from target";
  if (direction === "down") return "Drifting away";
  if (direction === "stable") {
    // Vary the "stable" phrase by confidence level to avoid repetition
    if (conf >= 0.7) return "Locked in range, waiting for catalyst";
    if (conf >= 0.6) return "Holding near current level";
    if (conf >= 0.5) return "Flat -- no movement yet";
    if (conf >= 0.35) return "Treading water";
    return "Sideways, watching for a break";
  }
  return "Tracking the distance";
}

function getBinaryWhyLine(
  direction: string | null,
  confidence: number | null,
  freshness: string | null,
  snapshotPublishedAt: string | null,
): string | null {
  const conf = confidence ?? 0;

  // Content-based phrases first -- these are more interesting than "Just updated"

  // High confidence, strong direction
  if (conf >= 0.7) {
    if (direction === "up") return "Strong consensus across markets";
    if (direction === "down") return "Markets firmly against";
  }

  // High-moderate confidence
  if (conf >= 0.6) {
    if (direction === "up") return "Markets tilting yes";
    if (direction === "down") return "Markets tilting no";
    if (direction === "stable") return "High confidence, but no clear direction";
  }

  // Moderate confidence
  if (conf >= 0.5) {
    if (direction === "up") return "Slight lean toward yes";
    if (direction === "down") return "Slight lean toward no";
    if (direction === "stable") return "Evenly split";
  }

  // Contested zone
  if (conf >= 0.35 && conf < 0.5) {
    if (direction === "up") return "Slight lean, but contested";
    if (direction === "down") return "Leaning no, but uncertain";
    return "Forecasters divided";
  }

  // Low confidence with direction
  if (conf < 0.35 && conf > 0) {
    if (direction === "up") return "Faint signal, could shift";
    if (direction === "down") return "Weak signal, watch for change";
    return "Signals mixed";
  }

  // Freshness-based fallback (only when content-based phrases don't apply)
  if (freshness === "fresh" && snapshotPublishedAt) {
    const minutesAgo = Math.floor((Date.now() - new Date(snapshotPublishedAt).getTime()) / 60000);
    if (minutesAgo < 30) return "Just updated";
  }

  // Stale data
  if (freshness === "stale" || freshness === "aging") {
    return "Awaiting new data";
  }

  return null;
}
