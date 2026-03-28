/**
 * Question-Wrapper Contract System
 *
 * Defines what a valid public prediction page IS.
 * A page goes live only if:
 *   - the question is valid (form + specificity + outcome clarity)
 *   - the page type is known (binary_event / threshold / competition)
 *   - the right signal families are present
 *   - the wrong signal families are excluded
 *   - the answer has a minimum coherent package
 */

// ── Types ──

export type QuestionType = "binary_event" | "threshold" | "competition";

export interface QuestionContract {
  questionType: QuestionType;
  primaryFamilies: string[];        // ANY of these drives the answer (OR)
  allowedFamilies: string[];        // what can appear on the page
  disallowedFamilies: string[];     // what MUST NEVER appear
  supportingOnlyFamilies: string[]; // can appear but never sufficient for publishing
  renderMode: "verdict" | "metric" | "leaderboard";
  filterResolved: boolean;          // remove expired / 99%+ markets
  filterZero: boolean;              // remove 0% markets
}

// ── Blueprint Definitions ──

const COMPETITION: QuestionContract = {
  questionType: "competition",
  primaryFamilies: ["prediction_market", "sports_odds"],
  allowedFamilies: ["prediction_market", "sports_odds", "news_evidence"],
  disallowedFamilies: ["political_official", "macro_official", "hazard_weather", "crypto_market", "defi_signal"],
  supportingOnlyFamilies: ["news_evidence"],
  renderMode: "leaderboard",
  filterResolved: true,
  filterZero: true,
};

const THRESHOLD: QuestionContract = {
  questionType: "threshold",
  primaryFamilies: ["macro_official", "crypto_market", "prediction_market"],
  allowedFamilies: ["prediction_market", "macro_official", "crypto_market", "forecasting", "news_evidence"],
  disallowedFamilies: ["sports_odds", "hazard_weather", "political_official"],
  supportingOnlyFamilies: ["news_evidence", "forecasting"],
  renderMode: "metric",
  filterResolved: true,
  filterZero: true,
};

const BINARY_EVENT: QuestionContract = {
  questionType: "binary_event",
  primaryFamilies: ["prediction_market", "forecasting"],
  allowedFamilies: ["prediction_market", "forecasting", "political_official", "news_evidence"],
  disallowedFamilies: ["sports_odds"],
  supportingOnlyFamilies: ["news_evidence", "political_official"],
  renderMode: "verdict",
  filterResolved: true,
  filterZero: true,
};

// ── Category Defaults ──

const CATEGORY_DEFAULT: Record<string, QuestionType> = {
  sports: "competition",
  macro: "threshold",
  crypto: "threshold",
  politics: "binary_event",
  geopolitics: "binary_event",
  tech: "binary_event",
  entertainment: "binary_event",
  disasters: "binary_event",
};

// ── Topic Overrides ──
// When the category default is wrong for a specific topic

const TOPIC_TYPE_OVERRIDE: Record<string, QuestionType> = {
  "ai-industry": "competition",
  "netflix-streaming-wars": "competition",
  "spotify-vs-apple-music": "competition",
};

// Topics where political_official IS a primary family (explicit policy questions)
const POLITICAL_PRIMARY_TOPICS = new Set([
  "us-congress-legislation", "us-debt-ceiling", "artificial-intelligence-policy",
  "us-trade-policy", "us-immigration-policy", "us-healthcare-policy",
]);

// Categories where crypto_market is allowed for binary_event
const CRYPTO_CATEGORIES = new Set(["crypto", "tech"]);

// ── Contract Derivation ──

/**
 * Derive question type from the question text using patterns.
 * This is the third priority (after explicit type and topic override).
 */
export function deriveQuestionType(questionText: string, category: string | null): QuestionType {
  const q = questionText.toLowerCase();
  if (/who will win|who is (likely|favored|projected)|who leads/.test(q)) return "competition";
  if (/will .+ (hit|reach|cross|exceed|break|surpass|settle) .+\d/.test(q)) return "threshold";
  if (/will .+ (keep|stay|remain) (above|below|at)/.test(q)) return "threshold";
  if (/will .+ (price|rate|index) .*(rise|fall|drop|change)/.test(q)) return "threshold";
  return CATEGORY_DEFAULT[category ?? ""] ?? "binary_event";
}

/**
 * Get the full contract for a question wrapper + topic.
 * Selection order: explicit type > topic override > question text derivation > category default
 */
export function getContract(
  wrapper: { question_text: string; question_type?: string | null },
  topic: { slug: string; category: string | null },
): QuestionContract {
  // 1. Explicit type on wrapper
  let questionType: QuestionType;
  if (wrapper.question_type && ["binary_event", "threshold", "competition"].includes(wrapper.question_type)) {
    questionType = wrapper.question_type as QuestionType;
  }
  // 2. Topic override
  else if (TOPIC_TYPE_OVERRIDE[topic.slug]) {
    questionType = TOPIC_TYPE_OVERRIDE[topic.slug];
  }
  // 3. Derive from question text
  else {
    questionType = deriveQuestionType(wrapper.question_text, topic.category);
  }

  // Get base contract
  const base = questionType === "competition" ? COMPETITION
    : questionType === "threshold" ? THRESHOLD
    : BINARY_EVENT;

  // Apply topic-specific overrides
  const contract = { ...base, questionType };

  // Allow crypto_market for crypto/tech binary events
  if (questionType === "binary_event" && CRYPTO_CATEGORIES.has(topic.category ?? "")) {
    contract.primaryFamilies = [...contract.primaryFamilies, "crypto_market"];
    contract.allowedFamilies = [...contract.allowedFamilies, "crypto_market"];
    contract.disallowedFamilies = contract.disallowedFamilies.filter((f) => f !== "crypto_market");
  }

  // Allow political_official as primary for explicit policy topics
  if (questionType === "binary_event" && POLITICAL_PRIMARY_TOPICS.has(topic.slug)) {
    contract.primaryFamilies = [...contract.primaryFamilies, "political_official"];
    contract.supportingOnlyFamilies = contract.supportingOnlyFamilies.filter((f) => f !== "political_official");
  }

  return contract;
}

/**
 * Get a provisional contract for matching time (wrapper may not exist yet).
 * Uses topic override or category default.
 */
export function getProvisionalContract(
  topic: { slug: string; category: string | null },
): QuestionContract {
  const questionType = TOPIC_TYPE_OVERRIDE[topic.slug]
    ?? CATEGORY_DEFAULT[topic.category ?? ""]
    ?? "binary_event";

  const base = questionType === "competition" ? COMPETITION
    : questionType === "threshold" ? THRESHOLD
    : BINARY_EVENT;

  const contract = { ...base, questionType };

  // Same overrides as full contract
  if (CRYPTO_CATEGORIES.has(topic.category ?? "")) {
    contract.primaryFamilies = [...contract.primaryFamilies, "crypto_market"];
    contract.allowedFamilies = [...contract.allowedFamilies, "crypto_market"];
    contract.disallowedFamilies = contract.disallowedFamilies.filter((f) => f !== "crypto_market");
  }
  if (POLITICAL_PRIMARY_TOPICS.has(topic.slug)) {
    contract.primaryFamilies = [...contract.primaryFamilies, "political_official"];
    contract.supportingOnlyFamilies = contract.supportingOnlyFamilies.filter((f) => f !== "political_official");
  }

  return contract;
}

// ── Signal Filtering ──

interface SignalLike {
  source_family: string;
  current_value: number;
  metadata?: Record<string, unknown> | null;
}

/**
 * Filter signals according to the contract.
 * Removes disallowed families, resolved markets, and zero-probability noise.
 */
export function filterSignalsByContract<T extends SignalLike>(
  signals: T[],
  contract: QuestionContract,
): T[] {
  return signals.filter((s) => {
    // Disallowed family -> always remove
    if (contract.disallowedFamilies.includes(s.source_family)) return false;

    // Only keep allowed families
    if (!contract.allowedFamilies.includes(s.source_family)) return false;

    // Filter resolved markets (99%+ = already happened)
    if (contract.filterResolved && s.current_value >= 0.99) return false;

    // Filter zero probability markets (no information)
    if (contract.filterZero && s.source_family === "prediction_market" && s.current_value <= 0.001) return false;

    return true;
  });
}

// ── Question Validity ──

/**
 * Validate whether a question text is a valid prediction question.
 * Three checks: form, specificity, outcome clarity.
 */
export function validateQuestion(text: string): { valid: boolean; reason?: string } {
  const q = text.toLowerCase();

  // A. Form
  if (!q.endsWith("?")) return { valid: false, reason: "not a question" };
  if (!/^(will |who |can |is |are |does |could )/.test(q)) return { valid: false, reason: "not prediction-framed" };
  if (q.length < 20 || q.length > 200) return { valid: false, reason: "length out of range" };

  // B. Specificity -- needs a time horizon OR a specific actor
  const hasHorizon = /\b(202\d|this (year|season|month|quarter)|by (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|in \d{4})\b/i.test(q);
  const hasActor = /[A-Z][a-z]+ [A-Z]|[A-Z]{2,}|[$]\d|%/.test(text);
  if (!hasHorizon && !hasActor) return { valid: false, reason: "too vague -- needs a time horizon or specific actor" };

  // C. Outcome clarity -- question must imply a concrete, interpretable outcome
  const hasOutcome = /\b(win|hit|reach|cross|pass|cut|rise|fall|drop|release|announce|break|launch|sign|ban|approve|collapse|invade|default|keep|stay|change|going)\b/i.test(q);
  const isVagueOutcome = /\b(do something|make a move|surprise|shock|change everything|be huge)\b/i.test(q);
  if (!hasOutcome || isVagueOutcome) return { valid: false, reason: "no clear outcome" };

  return { valid: true };
}

// ── Publication Gate ──

/**
 * Check if a question page has enough coherent signal support to be published.
 * If this returns false, the page should show "gathering data" instead.
 */
export function isPublishable<T extends SignalLike>(
  wrapper: { question_text: string; question_type?: string | null },
  topic: { slug: string; category: string | null },
  signals: T[],
): boolean {
  const contract = getContract(wrapper, topic);

  // 1. Filter signals by contract
  const clean = filterSignalsByContract(signals, contract);

  // 2. Must have at least one primary family signal
  const hasPrimary = clean.some((s) => contract.primaryFamilies.includes(s.source_family));
  if (!hasPrimary) return false;

  // 3. Supporting-only families can never make a page publishable alone
  const nonSupporting = clean.filter((s) => !contract.supportingOnlyFamilies.includes(s.source_family));
  if (nonSupporting.length === 0) return false;

  // Question validity is checked at intake/admin time, not render time.
  // At render time, if a wrapper exists and has signals, it's publishable.

  return true;
}
