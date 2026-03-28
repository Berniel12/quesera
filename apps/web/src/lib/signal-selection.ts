/**
 * Lead Signal Eligibility + Prose Coherence
 *
 * Classifies filtered signals into lead-eligible vs supporting.
 * Lead signals drive the hero. Supporting signals appear in the evidence wall.
 * Also checks whether prose contradicts the live hero state.
 *
 * This is a render-time content-quality layer, not a backend engine.
 */

import type { QuestionType } from "@/lib/question-contracts";

interface SignalLike {
  source_family: string;
  signal_type: string;
  current_value: number;
  metadata?: Record<string, unknown> | null;
}

// ── Lead Signal Selection ──

/**
 * Classify signals into lead-eligible and supporting.
 * Lead signals can drive the hero. Supporting signals appear in the evidence wall.
 * All signals stay on the page -- this only affects which ones get the spotlight.
 */
export function selectLeadSignals<T extends SignalLike>(
  signals: T[],
  questionType: QuestionType,
  questionText: string,
): { lead: T[]; supporting: T[] } {
  const lead: T[] = [];
  const supporting: T[] = [];

  for (const s of signals) {
    if (isLeadEligible(s, questionType, questionText)) {
      lead.push(s);
    } else {
      supporting.push(s);
    }
  }

  return { lead, supporting };
}

/**
 * Check if a single signal is eligible to drive the hero.
 * A signal passes contract filtering first (family, resolved, zero, micro-interval).
 * This further checks: is it GOOD ENOUGH to be the headline signal?
 */
function isLeadEligible(
  signal: SignalLike,
  questionType: QuestionType,
  questionText: string,
): boolean {
  const meta = signal.metadata ?? {};
  const marketQuestion = String(meta.question ?? meta.slug ?? "");

  // ── Competition: must have extractable entity + not too narrow ──
  if (questionType === "competition") {
    // Only market-like families can lead a competition
    if (!["prediction_market", "forecasting", "sports_odds"].includes(signal.source_family)) {
      return false;
    }
    // Must be a probability-type signal
    if (signal.signal_type !== "market_probability" && signal.signal_type !== "forecast_probability") {
      // Sports odds get a pass -- they're direct competition signals
      if (signal.source_family !== "sports_odds") return false;
    }
    // Must have a market question we can extract an entity from
    if (!marketQuestion) return false;
    if (!hasExtractableEntity(marketQuestion)) return false;
    // Must not be a narrow time-boxed sub-question for a broad competition
    if (isNarrowForQuestion(marketQuestion, questionText)) return false;
    return true;
  }

  // ── Threshold: official data leads, market probability supports ──
  if (questionType === "threshold") {
    // Official data and crypto market signals are always lead-eligible
    if (signal.source_family === "macro_official" || signal.source_family === "crypto_market") {
      return true;
    }
    // Prediction markets can lead only if they directly ask about the threshold
    if (signal.source_family === "prediction_market" || signal.source_family === "forecasting") {
      if (signal.signal_type !== "market_probability" && signal.signal_type !== "forecast_probability") {
        return false;
      }
      // Must not be a narrow sub-question (e.g., "no change at April meeting")
      if (isNarrowForQuestion(marketQuestion, questionText)) return false;
      return true;
    }
    return false;
  }

  // ── Binary Event: must directly answer the yes/no question ──
  if (questionType === "binary_event") {
    // Only probability signals can lead
    if (signal.signal_type !== "market_probability" && signal.signal_type !== "forecast_probability") {
      return false;
    }
    // Must be a real probability (not noise)
    if (signal.current_value < 0.02 || signal.current_value > 0.98) return false;
    // Must not be a narrow sub-question
    if (isNarrowForQuestion(marketQuestion, questionText)) return false;
    return true;
  }

  return false;
}

// ── Entity Extraction Check ──

/**
 * Check if a market question has an extractable entity name.
 * Same patterns as extractEntityName() in competition-page.tsx.
 */
function hasExtractableEntity(question: string): boolean {
  return /^Will (.+?) win\b/i.test(question) ||
    /^Will (.+?) have the best\b/i.test(question) ||
    /^Will (.+?) (?:lead|be the|dominate|finish)\b/i.test(question) ||
    /^(.+?) to win\b/i.test(question) ||
    /^Will (.+?) (?:beat|reach|hit|score|qualify|advance|place|rank)\b/i.test(question);
}

// ── Narrow Scope Detection ──

// Months for date detection
const MONTH_PATTERN = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;

/**
 * Check if a market question is materially narrower than the public question.
 *
 * A market is narrow relative to the question when:
 * - It mentions a specific short-dated deadline that's much tighter than the question's horizon
 * - It asks about a sub-outcome (e.g., "at the April meeting" for "Will the Fed cut rates this year?")
 * - It asks about a specific event on a specific date when the question is open-ended
 *
 * NOT a fixed 30-day rule -- compares market scope to question scope.
 */
function isNarrowForQuestion(marketQuestion: string, publicQuestion: string): boolean {
  const mqLower = marketQuestion.toLowerCase();
  const pqLower = publicQuestion.toLowerCase();

  // If the public question itself has a narrow scope (specific month/date), the market is fine
  const publicHasMonth = MONTH_PATTERN.test(pqLower);
  const publicHasYear = /\b(202\d|this year|this season)\b/i.test(pqLower);

  // Check if market question mentions a specific meeting/event date
  const hasSpecificEvent = /\b(after the|at the|before the|following the)\b.{0,30}\b(meeting|session|vote|summit|hearing)\b/i.test(mqLower);

  // Check if market question has "by [month]" or "in [month]" or "on [date]"
  const hasMonthDeadline = /\b(by|in|at the end of|on)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(mqLower);

  // Check if market mentions a specific day ("March 24", "on the 15th")
  const hasDaySpecificity = /\b(march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/i.test(mqLower) ||
    /\bon\s+(the\s+)?\d{1,2}(st|nd|rd|th)\b/i.test(mqLower);

  // If the public question is year-scoped or season-scoped and the market has a specific month + day, it's narrow
  if ((publicHasYear || !publicHasMonth) && hasDaySpecificity) return true;

  // If the public question is year/season scoped and the market asks about a specific event/meeting, it's narrow
  if ((publicHasYear || !publicHasMonth) && hasSpecificEvent) return true;

  // If the public question is open-ended (no time horizon at all) and the market
  // has a specific month deadline, the market is too narrow to lead
  const publicIsOpenEnded = !publicHasYear && !publicHasMonth;
  if (publicIsOpenEnded && hasMonthDeadline) return true;

  // If the public question has a year scope and the market specifies a particular event, it's narrow
  if (publicHasYear && hasSpecificEvent) return true;

  return false;
}

// ── Prose Coherence ──

export interface ProseCheck {
  safe: boolean;
  reason?: "leader_mismatch" | "polarity_mismatch";
}

/**
 * Check if prose contradicts the live hero state.
 * Only flags strong contradictions. Mild mismatches are left alone.
 *
 * Returns { safe: true } if prose is okay to display.
 * Returns { safe: false, reason } if prose should be suppressed.
 */
export function checkProseCoherence(
  prose: string | null,
  questionType: QuestionType,
  heroState: {
    leaderName?: string;       // competition: live leader name
    verdictLabel?: string;     // binary: "Probably yes" | "Probably not"
  },
): ProseCheck {
  if (!prose) return { safe: true };

  const proseLC = prose.toLowerCase();

  // ── Competition: check if prose names a different leader ──
  if (questionType === "competition" && heroState.leaderName) {
    const heroLC = heroState.leaderName.toLowerCase();

    // Look for prose patterns that name a favorite
    const favoritePatterns = [
      /probably\s+(\w[\w\s]*?)(?:\.|,|$)/i,
      /(\w[\w\s]*?)\s+(?:leads?|is the favorite|is ahead|is projected|is favored)/i,
      /favorite[:\s]+(\w[\w\s]*?)(?:\.|,|$)/i,
    ];

    for (const pattern of favoritePatterns) {
      const match = prose.match(pattern);
      if (match) {
        const proseEntity = match[1].trim().toLowerCase();
        // If prose names a specific entity and it's NOT the hero leader, that's a contradiction
        // Be conservative: only flag if the prose entity is a real name (>2 chars) and doesn't contain the hero name
        if (proseEntity.length > 2 && !proseEntity.includes(heroLC) && !heroLC.includes(proseEntity)) {
          return { safe: false, reason: "leader_mismatch" };
        }
      }
    }
  }

  // ── Binary Event: check if prose polarity contradicts verdict ──
  if (questionType === "binary_event" && heroState.verdictLabel) {
    const isVerdictPositive = heroState.verdictLabel === "Probably yes";
    const isVerdictNegative = heroState.verdictLabel === "Probably not";

    // Strong negative markers in prose
    const proseNegative = /\b(unlikely|improbable|no sign|no indication|not expected|remains distant|far from|very low probability)\b/i.test(prose);
    // Strong positive markers in prose
    const prosePositive = /\b(likely|expected to|on track|poised to|almost certain|high probability|increasingly likely)\b/i.test(prose);

    if (isVerdictPositive && proseNegative && !prosePositive) {
      return { safe: false, reason: "polarity_mismatch" };
    }
    if (isVerdictNegative && prosePositive && !proseNegative) {
      return { safe: false, reason: "polarity_mismatch" };
    }
  }

  return { safe: true };
}
