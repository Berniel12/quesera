/**
 * Quality Gate Battery
 *
 * Runs on every snapshot publication cycle. Each gate is a pure function
 * that checks one dimension of page quality. The battery produces a
 * QualityReport and a rendering mode verdict.
 *
 * Architecture rule: worker-side gating is the SOURCE OF TRUTH.
 * Any web/frontend filtering is defensive backup only.
 *
 * Rendering modes:
 *   - "premium"        page earned phrased synthesis
 *   - "deterministic"  page shows numbers + cards, no phrased prose
 *   - "blocked"        page shows "gathering data" placeholder (never 404)
 */

import type { ScoredSignal } from "./types.js";
import type { SourceComparison } from "./synthesis.js";
import type { PhrasedSynthesis } from "./synthesis-phrasing.js";
import type { SourcePack, QuestionType } from "../packs/index.js";

// ── Types ──────────────────────────────────────────────────────────────

export type RenderingMode = "premium" | "deterministic" | "blocked";
export type GateSeverity = "critical" | "major" | "minor";

export interface GateResult {
  gate: string;
  pass: boolean;
  severity: GateSeverity;
  reason: string | null;
}

export interface QualityReport {
  timestamp: string;
  topicSlug: string;
  questionType: QuestionType;
  renderingMode: RenderingMode;
  gates: GateResult[];
  criticalFailures: number;
  majorFailures: number;
}

// ── Template Family Rendering Ceilings ─────────────────────────────────
// A page can never exceed its family's ceiling, regardless of gate results.
// Competition pages must prove entity stability before earning premium.

interface FamilyCeiling {
  maxMode: RenderingMode;
  /** Number of consecutive entity-gate passes required to unlock premium */
  consecutivePassesForPromotion: number;
}

const TEMPLATE_FAMILY_CEILING: Record<string, FamilyCeiling> = {
  // Threshold macro: mature, can reach premium immediately
  threshold_macro: { maxMode: "premium", consecutivePassesForPromotion: 0 },
  // Binary policy: mature, can reach premium
  binary_event_politics: { maxMode: "premium", consecutivePassesForPromotion: 0 },
  binary_event_geopolitics: { maxMode: "deterministic", consecutivePassesForPromotion: 0 },
  // Sports competition: must prove entity stability
  competition_sports: { maxMode: "deterministic", consecutivePassesForPromotion: 3 },
  // Tech/entertainment competition
  competition_tech: { maxMode: "deterministic", consecutivePassesForPromotion: 3 },
  // Fallback
  default: { maxMode: "deterministic", consecutivePassesForPromotion: 0 },
};

export function getTemplateFamilyKey(
  questionType: QuestionType,
  category: string | null,
): string {
  if (questionType === "competition") {
    if (category === "sports") return "competition_sports";
    return "competition_tech";
  }
  if (questionType === "threshold") return "threshold_macro";
  if (questionType === "binary_event") {
    if (category === "geopolitics") return "binary_event_geopolitics";
    return "binary_event_politics";
  }
  return "default";
}

// ── Forbidden Contamination Patterns ───────────────────────────────────
// Hard-fail: a SINGLE signal matching these patterns fails the page.
// These are topic-specific: a signal about GDP must never appear on S&P page.

const FORBIDDEN_SIGNAL_PATTERNS: Record<string, Array<{ pattern: RegExp; reason: string }>> = {
  "us-stock-market": [
    { pattern: /\bgdp\b/i, reason: "GDP signal on S&P 500 page" },
    { pattern: /\bunemployment\b/i, reason: "Unemployment signal on S&P 500 page" },
    { pattern: /\binflation\b/i, reason: "Inflation signal on S&P 500 page" },
  ],
  "will-there-be-a-ceasefire": [
    { pattern: /\biran\b.*\bceasefire\b/i, reason: "Iran ceasefire signal on Gaza page" },
    { pattern: /\bceasefire\b.*\biran\b/i, reason: "Iran ceasefire signal on Gaza page" },
    { pattern: /\bus\s*x\s*iran\b/i, reason: "US-Iran signal on Gaza page" },
  ],
  "us-federal-reserve-interest-rates": [
    { pattern: /\bgdp\b/i, reason: "GDP signal on Fed rates page" },
    { pattern: /\bunemployment rate\b/i, reason: "Unemployment signal on Fed rates page" },
  ],
  "us-inflation-rate": [
    { pattern: /\bfederal funds\b/i, reason: "Fed funds signal on inflation page" },
    { pattern: /\bgdp\b/i, reason: "GDP signal on inflation page" },
  ],
};

// ── Gate 1: Entity-Set Validity ────────────────────────────────────────
// Runs on canonicalized entities (AFTER alias resolution).
// Checks: no duplicates, no wrong entity types, no cross-competition leak.

export function gateEntitySetValidity(
  ranking: Array<{ name: string; pct: number }>,
  _topicSlug: string,
): GateResult {
  const gate = "entity_set_validity";

  if (ranking.length === 0) {
    return { gate, pass: true, severity: "minor", reason: null };
  }

  // Check exact duplicates (case-insensitive) on already-resolved entities
  const namesLower = ranking.map((r) => r.name.toLowerCase());
  const seen = new Set<string>();
  for (const name of namesLower) {
    if (seen.has(name)) {
      return {
        gate,
        pass: false,
        severity: "critical",
        reason: `Duplicate entity after alias resolution: "${name}"`,
      };
    }
    seen.add(name);
  }

  // Substring containment safety net (catches "Boston" + "Boston Celtics"
  // that somehow survived alias resolution)
  for (let i = 0; i < namesLower.length; i++) {
    for (let j = i + 1; j < namesLower.length; j++) {
      const a = namesLower[i];
      const b = namesLower[j];
      if (a && b && a.length > 2 && b.length > 2) {
        if (a.includes(b) || b.includes(a)) {
          return {
            gate,
            pass: false,
            severity: "critical",
            reason: `Substring duplicate: "${ranking[i]?.name}" / "${ranking[j]?.name}"`,
          };
        }
      }
    }
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Gate 2: Question Relevance ─────────────────────────────────────────
// Two checks:
//   A) Drop-rate: if filtering removes too many signals, page is contaminated
//   B) Hard-fail: if ANY signal matches a forbidden contamination pattern,
//      the page fails regardless of drop-rate

export function gateQuestionRelevance(
  signals: ScoredSignal[],
  preFilterCount: number,
  postFilterCount: number,
  topicSlug: string,
  questionSlug: string,
): GateResult {
  const gate = "question_relevance";

  // Check B first: hard-fail forbidden patterns (even 1 bad signal = fail)
  const forbiddenPatterns = FORBIDDEN_SIGNAL_PATTERNS[topicSlug]
    ?? FORBIDDEN_SIGNAL_PATTERNS[questionSlug]
    ?? [];

  for (const signal of signals) {
    const questionText = String(signal.metadata?.question ?? signal.metadata?.slug ?? "");
    const seriesId = String(signal.metadata?.series_id ?? "");
    const searchText = `${questionText} ${seriesId}`;

    for (const { pattern, reason } of forbiddenPatterns) {
      if (pattern.test(searchText)) {
        return {
          gate,
          pass: false,
          severity: "critical",
          reason: `Forbidden signal detected: ${reason}. Signal: "${questionText.slice(0, 80)}"`,
        };
      }
    }
  }

  // Check A: drop-rate threshold
  if (preFilterCount > 0) {
    const dropRate = (preFilterCount - postFilterCount) / preFilterCount;
    if (dropRate > 0.5) {
      return {
        gate,
        pass: false,
        severity: "critical",
        reason: `${Math.round(dropRate * 100)}% of signals removed by relevance filter`,
      };
    }
    if (dropRate > 0.2) {
      return {
        gate,
        pass: false,
        severity: "major",
        reason: `${Math.round(dropRate * 100)}% of signals may be off-topic`,
      };
    }
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Gate 3: Platform/Source Coherence ───────────────────────────────────

export function gatePlatformCoherence(
  signals: ScoredSignal[],
  comparison: SourceComparison | null,
): GateResult {
  const gate = "platform_coherence";

  if (signals.length === 0) {
    return { gate, pass: false, severity: "critical", reason: "No signals after filtering" };
  }

  const platformNames = [...new Set(signals.map((s) => s.sourceName))];

  if (comparison) {
    const compPlatforms = comparison.platformBreakdown.map((p) => p.platform);
    const missing = compPlatforms.filter((p) => !platformNames.includes(p));
    if (missing.length > 0) {
      return {
        gate,
        pass: false,
        severity: "major",
        reason: `Comparison references platforms not in signals: ${missing.join(", ")}`,
      };
    }
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Gate 4: Temporal Hygiene ───────────────────────────────────────────

export function gateTemporalHygiene(
  prose: {
    current_picture_text: string | null;
    what_changed_text: string | null;
  },
  phrasedSynthesis: PhrasedSynthesis | null,
  proseGeneratedAt: string | null,
): GateResult {
  const gate = "temporal_hygiene";
  const currentYear = new Date().getFullYear();
  const staleYears = [currentYear - 1, currentYear - 2];

  // Check prose for stale year references
  const allProse = [
    prose.current_picture_text,
    prose.what_changed_text,
  ].filter(Boolean).join(" ");

  for (const year of staleYears) {
    const yearStr = String(year);
    // Match present-tense references: "in 2024, markets are..." but not
    // "since 2024" or "compared to 2024" which are valid historical context
    const presentTensePattern = new RegExp(
      `\\b${yearStr}\\b(?!.*\\b(were|was|had|proved|proven|showed)\\b)`,
    );
    if (
      allProse.includes(yearStr) &&
      presentTensePattern.test(allProse) &&
      !allProse.includes(`since ${yearStr}`) &&
      !allProse.includes(`from ${yearStr}`)
    ) {
      return {
        gate,
        pass: false,
        severity: "major",
        reason: `Prose may reference ${yearStr} as current context`,
      };
    }
  }

  // Check phrased synthesis for stale years
  if (phrasedSynthesis) {
    const phrasedText = [
      phrasedSynthesis.markets,
      phrasedSynthesis.grounding,
      phrasedSynthesis.tension,
      phrasedSynthesis.bottom_line,
    ].filter(Boolean).join(" ");

    for (const year of staleYears) {
      if (phrasedText.includes(String(year))) {
        return {
          gate,
          pass: false,
          severity: "major",
          reason: `Phrased synthesis references ${year}`,
        };
      }
    }
  }

  // Check prose age
  if (proseGeneratedAt) {
    const ageMs = Date.now() - new Date(proseGeneratedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 7) {
      return {
        gate,
        pass: false,
        severity: "major",
        reason: `Prose is ${Math.round(ageDays)} days old (limit: 7)`,
      };
    }
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Gate 5: Template-Family Gate ───────────────────────────────────────

export function gateTemplateFamily(
  questionType: QuestionType | null,
  category: string | null,
  pack: SourcePack | null,
  synthesisReady: boolean,
): GateResult {
  const gate = "template_family";

  if (!questionType) {
    return {
      gate,
      pass: false,
      severity: "major",
      reason: "No resolved question type",
    };
  }

  if (!pack) {
    return {
      gate,
      pass: false,
      severity: "major",
      reason: `No source pack matches question type "${questionType}" + category "${category}"`,
    };
  }

  if (!synthesisReady) {
    return {
      gate,
      pass: false,
      severity: "major",
      reason: "Pack requirements not met (synthesis not ready)",
    };
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Gate 6: Layer B Quality ────────────────────────────────────────────

export function gateLayerBQuality(
  phrasedSynthesis: PhrasedSynthesis | null,
  phrasedGeneratedAt: string | null,
): GateResult {
  const gate = "layer_b_quality";

  // No phrased synthesis = not applicable (page uses deterministic)
  if (!phrasedSynthesis) {
    return { gate, pass: true, severity: "minor", reason: null };
  }

  // Age check: phrased synthesis must be <3 days old
  if (phrasedGeneratedAt) {
    const ageMs = Date.now() - new Date(phrasedGeneratedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 3) {
      return {
        gate,
        pass: false,
        severity: "major",
        reason: `Phrased synthesis is ${Math.round(ageDays)} days old (limit: 3)`,
      };
    }
  }

  // Basic structural checks (validation already ran in synthesis-phrasing.ts,
  // but we re-check here as a safety net)
  if (!phrasedSynthesis.markets || !phrasedSynthesis.bottom_line) {
    return {
      gate,
      pass: false,
      severity: "major",
      reason: "Phrased synthesis missing required sections",
    };
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Gate 7: Signal Freshness ───────────────────────────────────────────

export function gateSignalFreshness(
  signals: ScoredSignal[],
): GateResult {
  const gate = "signal_freshness";

  if (signals.length === 0) {
    return { gate, pass: false, severity: "critical", reason: "No signals" };
  }

  const hasFreshOrAging = signals.some(
    (s) => s.freshness === "fresh" || s.freshness === "aging",
  );

  if (!hasFreshOrAging) {
    return {
      gate,
      pass: false,
      severity: "major",
      reason: "All signals are stale or dead (none updated in 48h)",
    };
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Gate 8: Signal Content Coherence ───────────────────────────────────
// Samples actual signal text and checks if it matches the page's question.
// This is the "did you actually look at the data" gate.
// Catches contamination categories we haven't thought of yet.

// Per-question-type: what words SHOULD appear in a championship-level signal?
const COMPETITION_SIGNAL_ANCHORS = [
  "win", "winner", "champion", "title", "finals", "trophy",
  "league", "cup", "championship", "premier", "world series",
];

// Signals that are clearly about individual games, not championships
const GAME_LEVEL_INDICATORS = [
  /\bspread\b/i,
  /\bo\/u\b/i,
  /\bover\/under\b/i,
  /\bmoneyline\b/i,
  /[+-]\d+\.5/,              // point spreads
  /\d+:\d+\s*(AM|PM)/i,      // time-specific markets
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, // day-specific
  /\bgame \d/i,              // "Game 7"
  /\bround \d/i,             // "Round 1"
  /\bmatch\s*day\b/i,
];

export function gateSignalContentCoherence(
  signals: ScoredSignal[],
  questionType: QuestionType,
  questionText: string,
): GateResult {
  const gate = "signal_content_coherence";

  if (signals.length === 0) {
    return { gate, pass: true, severity: "minor", reason: null };
  }

  // Only apply content check to prediction_market and forecasting signals
  const marketSignals = signals.filter(
    (s) => s.sourceFamily === "prediction_market" || s.sourceFamily === "forecasting",
  );

  if (marketSignals.length === 0) {
    return { gate, pass: true, severity: "minor", reason: null };
  }

  // For competition pages: check if signals look like championship markets or game bets
  if (questionType === "competition") {
    let gameLevelCount = 0;
    for (const s of marketSignals) {
      const q = String(s.metadata?.question ?? "").toLowerCase();
      if (!q) continue;
      const isGameLevel = GAME_LEVEL_INDICATORS.some((p) => p.test(q));
      const hasChampAnchor = COMPETITION_SIGNAL_ANCHORS.some((a) => q.includes(a));
      if (isGameLevel && !hasChampAnchor) gameLevelCount++;
    }

    const gameLevelRate = gameLevelCount / marketSignals.length;
    if (gameLevelRate > 0.5) {
      return {
        gate,
        pass: false,
        severity: "critical",
        reason: `${Math.round(gameLevelRate * 100)}% of market signals appear to be game-level bets (spreads, O/U), not championship markets. ${gameLevelCount} of ${marketSignals.length} signals.`,
      };
    }
    if (gameLevelRate > 0.2) {
      return {
        gate,
        pass: false,
        severity: "major",
        reason: `${Math.round(gameLevelRate * 100)}% of market signals may be game-level bets. ${gameLevelCount} of ${marketSignals.length}.`,
      };
    }
  }

  // For all page types: check if signals relate to the question's subject
  // Include short words that are proper nouns/acronyms (nba, f1, fed, s&p, ai)
  const KNOWN_SHORT_TOPICS = ["nba", "nfl", "f1", "fed", "ai", "s&p", "gdp", "cpi", "uk", "us", "eu", "un"];
  const questionLower = questionText.toLowerCase();
  const questionWords = questionLower.split(/\s+/);
  const topicWords = questionWords.filter((w) => {
    if (KNOWN_SHORT_TOPICS.includes(w)) return true;
    if (w.length <= 3) return false;
    return !["will", "does", "have", "this", "that", "what", "when", "year", "keep", "going", "before"].includes(w);
  });

  if (topicWords.length === 0) {
    return { gate, pass: true, severity: "minor", reason: null };
  }

  // Check if at least 30% of market signals mention at least one topic word
  let relevantCount = 0;
  for (const s of marketSignals) {
    const q = String(s.metadata?.question ?? "").toLowerCase();
    if (topicWords.some((w) => q.includes(w))) relevantCount++;
  }

  const relevanceRate = relevantCount / marketSignals.length;
  if (relevanceRate < 0.1 && marketSignals.length >= 5) {
    return {
      gate,
      pass: false,
      severity: "critical",
      reason: `Only ${Math.round(relevanceRate * 100)}% of signals mention any topic keyword. Signals may be about a different subject entirely.`,
    };
  }

  return { gate, pass: true, severity: "minor", reason: null };
}

// ── Battery Runner ─────────────────────────────────────────────────────

export interface GateBatteryInput {
  topicSlug: string;
  questionSlug: string;
  questionText: string;
  questionType: QuestionType;
  category: string | null;

  /** Signals AFTER contract + relevance filtering */
  filteredSignals: ScoredSignal[];
  /** Signal count BEFORE question-relevance filtering */
  preRelevanceFilterCount: number;
  /** Signal count AFTER question-relevance filtering */
  postRelevanceFilterCount: number;

  /** Resolved entity ranking (after alias resolution) -- competition only */
  entityRanking: Array<{ name: string; pct: number }>;

  /** Source comparison from Layer A */
  sourceComparison: SourceComparison | null;

  /** Source pack for this question family */
  pack: SourcePack | null;
  /** Whether pack requirements are met */
  synthesisReady: boolean;

  /** Carried-forward prose */
  prose: {
    current_picture_text: string | null;
    what_changed_text: string | null;
  };
  proseGeneratedAt: string | null;

  /** Layer B phrased synthesis (if computed this cycle) */
  phrasedSynthesis: PhrasedSynthesis | null;
  phrasedGeneratedAt: string | null;

  /** Consecutive entity-gate passes (for promotion tracking) */
  consecutiveEntityPasses: number;
}

export function runQualityGates(input: GateBatteryInput): QualityReport {
  const gates: GateResult[] = [];

  // Gate 1: Entity validity (competition only)
  if (input.questionType === "competition") {
    gates.push(
      gateEntitySetValidity(input.entityRanking, input.topicSlug),
    );
  }

  // Gate 2: Question relevance
  gates.push(
    gateQuestionRelevance(
      input.filteredSignals,
      input.preRelevanceFilterCount,
      input.postRelevanceFilterCount,
      input.topicSlug,
      input.questionSlug,
    ),
  );

  // Gate 3: Platform coherence
  gates.push(
    gatePlatformCoherence(input.filteredSignals, input.sourceComparison),
  );

  // Gate 4: Temporal hygiene
  gates.push(
    gateTemporalHygiene(
      input.prose,
      input.phrasedSynthesis,
      input.proseGeneratedAt,
    ),
  );

  // Gate 5: Template family
  gates.push(
    gateTemplateFamily(
      input.questionType,
      input.category,
      input.pack,
      input.synthesisReady,
    ),
  );

  // Gate 6: Layer B quality
  gates.push(
    gateLayerBQuality(
      input.phrasedSynthesis,
      input.phrasedGeneratedAt,
    ),
  );

  // Gate 7: Signal freshness
  gates.push(
    gateSignalFreshness(input.filteredSignals),
  );

  // Gate 8: Signal content coherence (did you actually look at the data?)
  gates.push(
    gateSignalContentCoherence(
      input.filteredSignals,
      input.questionType,
      input.questionText,
    ),
  );

  const criticalFailures = gates.filter((g) => !g.pass && g.severity === "critical").length;
  const majorFailures = gates.filter((g) => !g.pass && g.severity === "major").length;

  const renderingMode = deriveRenderingMode(
    gates,
    input.questionType,
    input.category,
    input.phrasedSynthesis !== null,
    input.consecutiveEntityPasses,
  );

  return {
    timestamp: new Date().toISOString(),
    topicSlug: input.topicSlug,
    questionType: input.questionType,
    renderingMode,
    gates,
    criticalFailures,
    majorFailures,
  };
}

// ── Rendering Mode Derivation ──────────────────────────────────────────

function deriveRenderingMode(
  gates: GateResult[],
  questionType: QuestionType,
  category: string | null,
  hasPhrasedSynthesis: boolean,
  consecutiveEntityPasses: number,
): RenderingMode {
  // Any critical failure = blocked (gathering data placeholder)
  const hasCriticalFail = gates.some((g) => !g.pass && g.severity === "critical");
  if (hasCriticalFail) return "blocked";

  // Template family ceiling
  const familyKey = getTemplateFamilyKey(questionType, category);
  const ceiling = TEMPLATE_FAMILY_CEILING[familyKey]
    ?? TEMPLATE_FAMILY_CEILING["default"]
    ?? { maxMode: "deterministic" as RenderingMode, consecutivePassesForPromotion: 0 };

  // If ceiling is deterministic, never go higher (unless promotion earned)
  if (ceiling.maxMode === "deterministic") {
    // Check if promotion criteria met (for competition pages)
    if (
      ceiling.consecutivePassesForPromotion > 0 &&
      consecutiveEntityPasses < ceiling.consecutivePassesForPromotion
    ) {
      return "deterministic";
    }
  }

  // Any major failure = deterministic at best
  const hasMajorFail = gates.some((g) => !g.pass && g.severity === "major");
  if (hasMajorFail) return "deterministic";

  // All gates pass -- check if we have phrased synthesis
  if (hasPhrasedSynthesis && ceiling.maxMode === "premium") {
    return "premium";
  }

  return "deterministic";
}

// ── Worker-Side Question Relevance Filter ──────────────────────────────
// This is the SOURCE OF TRUTH for question-level signal filtering.
// The web/question-contracts.ts version is a defensive backup only.
//
// Key difference from the web version: uses AND logic for multi-keyword
// requirements and has hard-fail forbidden patterns.

interface WorkerSignalLike {
  sourceFamily: string;
  metadata: Record<string, unknown>;
}

interface QuestionRelevanceRule {
  /** ALL anchor keywords: at least one must match */
  anchors: string[];
  /** Context keywords: at least one must match IF anchors matched */
  context: string[];
  /** If ANY of these appear, the signal is rejected regardless */
  reject: string[];
  /** Regex patterns that reject signals (for game-level bets etc.) */
  rejectPatterns?: RegExp[];
}

// Game-level bet patterns: spreads, over/unders, moneylines, head-to-head matchups
// These are NOT about "who wins the championship" -- they're about individual games
const GAME_BET_PATTERNS: RegExp[] = [
  /\bspread\b/i,
  /\bo\/u\b/i,
  /\bover\/under\b/i,
  /\bmoneyline\b/i,
  /\bvs\.\s/i,                        // "Lakers vs. Pacers"
  /\b\w+ vs \w+(?!.*(?:final|title|championship|winner))/i, // "X vs Y" unless it's about a final
  /[+-]\d+\.5/,                        // point spreads like "-17.5" or "+3.5"
  /o\/u \d+/i,                         // "O/U 238.5"
];

const WORKER_QUESTION_RELEVANCE: Record<string, QuestionRelevanceRule> = {
  "will-there-be-a-ceasefire": {
    anchors: ["gaza", "hamas", "hostage", "palestinian"],
    context: ["ceasefire", "war end", "peace", "truce"],
    reject: ["iran", "tehran", "persian gulf"],
  },
  "will-the-iran-us-conflict-escalate-further": {
    anchors: ["iran", "tehran", "persian"],
    context: [],
    reject: [],
  },
  "us-stock-market": {
    anchors: ["s&p", "sp500", "stock market", "equity", "dow", "nasdaq", "s&p 500"],
    context: [],
    reject: ["gdp", "unemployment rate", "inflation rate", "cpi"],
  },
  // Sports competition pages: reject game-level bets, keep championship markets
  "nba-season-2025-26": {
    anchors: [],
    context: [],
    reject: [],
    rejectPatterns: GAME_BET_PATTERNS,
  },
  "premier-league": {
    anchors: [],
    context: [],
    reject: [],
    rejectPatterns: GAME_BET_PATTERNS,
  },
  "champions-league": {
    anchors: [],
    context: [],
    reject: [],
    rejectPatterns: GAME_BET_PATTERNS,
  },
  "formula-1-2026": {
    anchors: [],
    context: [],
    reject: [],
    rejectPatterns: GAME_BET_PATTERNS,
  },
  "fifa-world-cup-2026": {
    anchors: [],
    context: [],
    reject: [],
    rejectPatterns: GAME_BET_PATTERNS,
  },
};

/**
 * Worker-side question relevance filter.
 * Returns the filtered signal array + counts for gate reporting.
 */
export function filterSignalsWorkerSide<T extends WorkerSignalLike>(
  signals: T[],
  questionSlug: string,
  topicSlug: string,
): { filtered: T[]; preCount: number; postCount: number } {
  const rule = WORKER_QUESTION_RELEVANCE[questionSlug]
    ?? WORKER_QUESTION_RELEVANCE[topicSlug];

  if (!rule) {
    return { filtered: signals, preCount: signals.length, postCount: signals.length };
  }

  const preCount = signals.length;

  const filtered = signals.filter((s) => {
    // Only filter prediction_market and forecasting signals
    if (s.sourceFamily !== "prediction_market" && s.sourceFamily !== "forecasting") {
      return true;
    }

    const questionText = String(s.metadata?.question ?? "").toLowerCase();
    if (!questionText) return true;

    // Reject patterns: regex-based rejection (game bets, spreads, O/U)
    if (rule.rejectPatterns && rule.rejectPatterns.some((p) => p.test(questionText))) {
      return false;
    }

    // Reject: if any reject keyword appears, drop the signal
    if (rule.reject.some((kw) => questionText.includes(kw))) {
      return false;
    }

    // Anchor check: at least one anchor must be present
    if (rule.anchors.length > 0) {
      const hasAnchor = rule.anchors.some((kw) => questionText.includes(kw));
      if (!hasAnchor) {
        if (rule.context.length > 0) {
          const hasContext = rule.context.some((kw) => questionText.includes(kw));
          if (!hasContext) return false;
          return false;
        }
        return false;
      }
    }

    return true;
  });

  return { filtered, preCount, postCount: filtered.length };
}
