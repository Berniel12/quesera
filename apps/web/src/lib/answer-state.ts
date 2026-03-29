// Maps signal data to bold, entertaining verdicts.
// Three fields:
//   `label`       — canonical: "Probably yes" (for data/API consistency)
//   `headline`    — category-flavored: "Lock it in" (displayed huge on detail pages)
//   `cardVerdict` — template-aware, richer: used on homepage cards (never repetitive)
//
// The cardVerdict is selected by questionType + direction + confidence,
// so competition / threshold / binary_event cards each feel emotionally distinct.

import type { QuestionType } from "./question-contracts";

interface AnswerStateInput {
  direction: string;
  confidence: number;
  category: string | null;
  disagreement: number;
  questionType?: QuestionType;
}

export interface AnswerState {
  label: string;
  headline: string;
  cardVerdict: string;
  colorClass: string;
  intensity: "strong" | "moderate" | "weak";
}

const INVERTED_CATEGORIES = new Set(["disasters", "geopolitics"]);

// Category-specific verdict headlines -- the fun, shareable version
const HEADLINES: Record<string, { up: string; down: string; stable: string; unknown: string }> = {
  sports:        { up: "Lock it in",          down: "Don't bet on it",       stable: "Still wide open",    unknown: "Still wide open" },
  crypto:        { up: "To the moon",         down: "Not this cycle",        stable: "Not yet",            unknown: "Hard to say" },
  entertainment: { up: "Count on it",         down: "Don't hold your breath", stable: "Not yet",           unknown: "Drama incoming" },
  geopolitics:   { up: "Brace yourself",      down: "Cooler heads prevail",  stable: "Uneasy calm",        unknown: "Situation developing" },
  disasters:     { up: "Brace yourself",      down: "All clear for now",     stable: "All clear for now",   unknown: "Situation developing" },
  macro:         { up: "Probably yes",         down: "Probably not",          stable: "Holding steady",     unknown: "Hard to say" },
  politics:      { up: "Probably yes",         down: "Probably not",          stable: "Probably not",       unknown: "Hard to say" },
  tech:          { up: "Probably yes",         down: "Probably not",          stable: "Probably not",       unknown: "Hard to say" },
};

const DEFAULT_HEADLINES = { up: "Probably yes", down: "Probably not", stable: "Probably not", unknown: "Hard to say" };

function getHeadline(direction: string, category: string | null): string {
  const map = (category ? HEADLINES[category] : undefined) ?? DEFAULT_HEADLINES;
  if (direction === "up") return map.up;
  if (direction === "down") return map.down;
  if (direction === "stable") return map.stable;
  return map.unknown;
}

function getDirectionColor(direction: string, category: string | null): string {
  const inverted = category !== null && INVERTED_CATEGORIES.has(category);
  if (direction === "up") return inverted ? "text-destructive" : "text-positive dark:text-[#4EDEA3]";
  if (direction === "down") return inverted ? "text-positive dark:text-[#4EDEA3]" : "text-destructive";
  return "text-foreground";
}

// ── Template-aware card verdicts ──────────────────────────────────────
// These are wider and richer than labels/headlines.
// Each template type gets its own vocabulary so cards never feel samey.

interface VerdictTable {
  strongUp: string;
  moderateUp: string;
  weakUp: string;
  strongDown: string;
  moderateDown: string;
  weakDown: string;
  stable: string;
  unknown: string;
}

const COMPETITION_VERDICTS: VerdictTable = {
  strongUp:     "Runaway favorite",
  moderateUp:   "Leading the pack",
  weakUp:       "Slight edge",
  strongDown:   "Falling behind",
  moderateDown: "Losing grip",
  weakDown:     "Fading contender",
  stable:       "Too close to call",
  unknown:      "Wide open",
};

const THRESHOLD_VERDICTS: VerdictTable = {
  strongUp:     "On track",
  moderateUp:   "Gaining ground",
  weakUp:       "Early momentum",
  strongDown:   "Moving away",
  moderateDown: "Off course",
  weakDown:     "Long way to go",
  stable:       "Stalled",
  unknown:      "Waiting for data",
};

const BINARY_VERDICTS: VerdictTable = {
  strongUp:     "Looking likely",
  moderateUp:   "Leaning yes",
  weakUp:       "Possible",
  strongDown:   "Not happening",
  moderateDown: "Leaning no",
  weakDown:     "Don't rule it out",
  stable:       "Quiet for now",
  unknown:      "Waiting for signal",
};

const VERDICT_TABLES: Record<string, VerdictTable> = {
  competition:  COMPETITION_VERDICTS,
  threshold:    THRESHOLD_VERDICTS,
  binary_event: BINARY_VERDICTS,
};

function getCardVerdict(
  direction: string,
  confidence: number,
  questionType: QuestionType | undefined,
): string {
  const table = (questionType ? VERDICT_TABLES[questionType] : undefined) ?? BINARY_VERDICTS;

  if (direction === "unknown") return table.unknown;
  if (direction === "stable") return table.stable;

  // Map direction + confidence intensity to the right phrase
  if (direction === "up") {
    if (confidence >= 0.6) return table.strongUp;
    if (confidence >= 0.35) return table.moderateUp;
    return table.weakUp;
  }
  // direction === "down"
  if (confidence >= 0.6) return table.strongDown;
  if (confidence >= 0.35) return table.moderateDown;
  return table.weakDown;
}

// ── Main entry point ──────────────────────────────────────────────────

export function getAnswerState(input: AnswerStateInput): AnswerState {
  const { direction, confidence, category, questionType } = input;
  const colorClass = getDirectionColor(direction, category);
  const headline = getHeadline(direction, category);
  const cardVerdict = getCardVerdict(direction, confidence, questionType);

  // No signals / 0 confidence edge case
  if (confidence === 0 && direction === "unknown") {
    return { label: "No active markets", headline: "No active markets", cardVerdict: "No active markets", colorClass: "text-muted-foreground", intensity: "weak" };
  }

  // HIGH confidence (>= 0.6)
  if (confidence >= 0.6) {
    if (direction === "up") return { label: "Probably yes", headline, cardVerdict, colorClass, intensity: "strong" };
    if (direction === "down") return { label: "Probably not", headline, cardVerdict, colorClass, intensity: "strong" };
    return { label: "Probably not", headline, cardVerdict, colorClass: "text-foreground", intensity: "strong" };
  }

  // MODERATE confidence (0.35 - 0.6)
  if (confidence >= 0.35) {
    if (direction === "up") return { label: "Probably yes", headline, cardVerdict, colorClass, intensity: "moderate" };
    if (direction === "down") return { label: "Probably not", headline, cardVerdict, colorClass, intensity: "moderate" };
    if (direction === "stable") return { label: "Probably not", headline, cardVerdict, colorClass: "text-foreground", intensity: "moderate" };
    return { label: "Hard to say", headline, cardVerdict, colorClass: "text-muted-foreground", intensity: "moderate" };
  }

  // LOW confidence (< 0.35)
  if (direction === "up") return { label: "Probably yes", headline, cardVerdict, colorClass, intensity: "weak" };
  if (direction === "down") return { label: "Probably not", headline, cardVerdict, colorClass: "text-destructive", intensity: "weak" };
  if (direction === "stable") return { label: "Probably not", headline, cardVerdict, colorClass: "text-foreground", intensity: "weak" };

  // Unknown direction -- label stays canonical, headline is category-flavored
  return { label: "Hard to say", headline, cardVerdict, colorClass: category === "disasters" || category === "geopolitics" ? "text-warning" : category === "sports" ? "text-foreground" : "text-muted-foreground", intensity: "weak" };
}
