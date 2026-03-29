/**
 * Layer B: Constrained LLM Phrasing for Source Comparison
 *
 * Takes the deterministic synthesis_json (Layer A) and produces
 * 4 phrased sections in human language. The LLM NEVER decides
 * agreement/disagreement -- it only phrases what Layer A computed.
 *
 * Whitelisted to approved pages only. Falls back to deterministic
 * rendering if validation fails.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Logger } from "@signal-map/logger";
import { getGeminiKey, markGeminiKeyFailed } from "../utils/key-rotator.js";
import type { SourceComparison } from "./synthesis.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

// ── Whitelist: only these topic slugs get Layer B phrasing ──────────────
// Do NOT add pages without verified trustworthy Layer A synthesis.

const LAYER_B_WHITELIST = new Set([
  "us-federal-reserve-interest-rates",
  "global-recession-risk",
  "israel-palestine-conflict",
  "us-trade-policy",
  "formula-1-2026",
  "nba-season-2025-26",
  "champions-league",
  "premier-league",
  "ai-industry",
  "us-stock-market",
]);

export function isLayerBEnabled(topicSlug: string): boolean {
  return LAYER_B_WHITELIST.has(topicSlug);
}

// ── Phrased synthesis output ───────────────────────────────────────────

export interface PhrasedSynthesis {
  markets: string;
  grounding: string | null;
  tension: string;
  bottom_line: string;
}

// ── Generic filler phrases that must be rejected ───────────────────────

const BANNED_PHRASES = [
  "it remains to be seen",
  "time will tell",
  "the situation remains fluid",
  "developments are ongoing",
  "only time will tell",
  "the outlook is uncertain",
  "things could change",
  "stay tuned",
  "watch this space",
  "the jury is still out",
];

// ── Validation ─────────────────────────────────────────────────────────

function validatePhrasedSynthesis(
  phrased: PhrasedSynthesis,
  comparison: SourceComparison,
  questionText: string,
  questionType?: string,
): { valid: boolean; reason: string | null } {
  // 1. Markets section must name at least one platform
  const platformNames = comparison.platformBreakdown.map((p) => p.platform.toLowerCase());
  const marketsLower = phrased.markets.toLowerCase();
  const namesPlatform = platformNames.some((p) =>
    marketsLower.includes(p) ||
    marketsLower.includes("polymarket") ||
    marketsLower.includes("kalshi") ||
    marketsLower.includes("metaculus"),
  );
  if (!namesPlatform) {
    return { valid: false, reason: "Markets section does not name any platform" };
  }

  // 2. Markets section must contain at least one number
  if (!/\d/.test(phrased.markets)) {
    return { valid: false, reason: "Markets section contains no numbers" };
  }

  // 3. Grounding section must name a source or be null/empty
  if (phrased.grounding && phrased.grounding.length > 0) {
    if (!/\d/.test(phrased.grounding)) {
      return { valid: false, reason: "Grounding section contains no numbers" };
    }
  }

  // 4. Tension must reflect deterministic agreementState
  const tensionLower = phrased.tension.toLowerCase();
  if (comparison.agreementState === "consensus") {
    // Must not claim disagreement
    if (tensionLower.includes("split") || tensionLower.includes("disagree") || tensionLower.includes("diverge")) {
      return { valid: false, reason: "Tension claims disagreement but agreementState is consensus" };
    }
  }
  if (comparison.agreementState === "sharp_divergence") {
    // Must not claim agreement
    if (tensionLower.includes("agree") || tensionLower.includes("aligned") || tensionLower.includes("consensus")) {
      return { valid: false, reason: "Tension claims agreement but agreementState is sharp_divergence" };
    }
  }

  // 5. Bottom line must contain at least one number
  if (!/\d/.test(phrased.bottom_line)) {
    return { valid: false, reason: "Bottom line contains no numbers" };
  }

  // 6. Bottom line max 120 chars
  if (phrased.bottom_line.length > 120) {
    return { valid: false, reason: "Bottom line too long (>120 chars)" };
  }

  // 7. No banned filler phrases in any section
  const allText = `${phrased.markets} ${phrased.grounding ?? ""} ${phrased.tension} ${phrased.bottom_line}`.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (allText.includes(phrase)) {
      return { valid: false, reason: `Contains banned filler phrase: "${phrase}"` };
    }
  }

  // 8. Bottom line must NOT be generic/interchangeable
  const bottomLower = phrased.bottom_line.toLowerCase();
  const GENERIC_BOTTOM_LINE_PATTERNS = [
    "probabilities range from",
    "probabilities for this outcome",
    "predictions vary between",
    "market estimates range",
    "spread indicates",
    "outlooks vary",
    "divergence across",
    "variance in their outlook",
    "the analyzed platforms",
    "across the 2 platforms",
    "across platforms",
    "significant volatility across",
  ];
  for (const pattern of GENERIC_BOTTOM_LINE_PATTERNS) {
    if (bottomLower.includes(pattern)) {
      return { valid: false, reason: `Bottom line is generic boilerplate: contains "${pattern}"` };
    }
  }

  // 9. Bottom line must reference the question subject (not just numbers)
  const questionWords = questionText.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
  const subjectWords = questionWords.filter((w: string) =>
    !["will", "does", "have", "this", "that", "what", "when", "where", "year", "2026", "2027", "keep", "break", "come"].includes(w),
  );
  const mentionsSubject = subjectWords.some((w: string) => bottomLower.includes(w));
  if (!mentionsSubject) {
    return { valid: false, reason: "Bottom line does not mention the question subject" };
  }

  // 10. Competition-specific validation: reject placeholder entity references
  const isCompetition = questionText.toLowerCase().includes("who will win");
  if (isCompetition) {
    const COMPETITION_PLACEHOLDERS = [
      "the winner",
      "the outcome",
      "the prediction",
      "this market",
      "the result",
      "the field",
    ];
    for (const placeholder of COMPETITION_PLACEHOLDERS) {
      // Only reject if placeholder is used WITHOUT a concrete anchor
      const hasConcreteAnchor =
        (comparison.competitionLeader && bottomLower.includes(comparison.competitionLeader.name.toLowerCase())) ||
        bottomLower.includes("league") ||
        bottomLower.includes("championship") ||
        bottomLower.includes("title") ||
        bottomLower.includes("trophy") ||
        bottomLower.includes("race") ||
        bottomLower.includes("cup") ||
        bottomLower.includes("nba") ||
        bottomLower.includes("f1") ||
        bottomLower.includes("premier") ||
        bottomLower.includes("champions") ||
        bottomLower.includes("formula");
      if (bottomLower.includes(placeholder) && !hasConcreteAnchor) {
        return { valid: false, reason: `Competition bottom line uses placeholder "${placeholder}" without naming the competition or a contender` };
      }
    }

    // Competition bottom lines must also classify the market shape
    const classifiesShape =
      bottomLower.includes("settled") ||
      bottomLower.includes("contested") ||
      bottomLower.includes("split") ||
      bottomLower.includes("fragmented") ||
      bottomLower.includes("clear favorite") ||
      bottomLower.includes("wide open") ||
      bottomLower.includes("narrow") ||
      bottomLower.includes("dominant") ||
      bottomLower.includes("one-sided") ||
      bottomLower.includes("consensus");
    if (!classifiesShape) {
      return { valid: false, reason: "Competition bottom line must classify the market shape (settled, contested, split, clear favorite, etc.)" };
    }
  }

  // 11. All bottom lines: reject pure range restatements even if they mention the subject
  const RANGE_RESTATEMENT_PATTERNS = [
    /priced between \d+% and \d+%/,
    /ranging from \d+% to \d+%/,
    /valued? between \d+% and \d+%/,
    /currently value the outcome/,
    /prediction markets currently/,
  ];
  for (const pattern of RANGE_RESTATEMENT_PATTERNS) {
    if (pattern.test(bottomLower)) {
      return { valid: false, reason: "Bottom line is a range restatement, not a takeaway" };
    }
  }

  // 12. Template-specific validation
  if (questionType === "binary_event") {
    // Geopolitics binary: must not invent diplomatic analysis
    const SPECULATIVE_PATTERNS = [
      "retail traders expect",
      "institutional traders distrust",
      "investors are reacting to",
      "diplomatic sources suggest",
      "according to insiders",
      "behind the scenes",
    ];
    for (const pattern of SPECULATIVE_PATTERNS) {
      if (allText.includes(pattern)) {
        return { valid: false, reason: `Binary event contains speculative analysis: "${pattern}"` };
      }
    }
  }

  if (questionType === "threshold") {
    // Threshold: grounding section must name a metric if grounding data exists
    if (comparison.primaryGroundingMetric && phrased.grounding) {
      const groundingLower = phrased.grounding.toLowerCase();
      const metricName = comparison.primaryGroundingMetric.name.toLowerCase();
      if (!groundingLower.includes(metricName) && !groundingLower.includes(comparison.primaryGroundingMetric.source)) {
        return { valid: false, reason: "Threshold grounding section does not name the primary metric" };
      }
    }
  }

  return { valid: true, reason: null };
}

// ── LLM Phrasing ──────────────────────────────────────────────────────

export async function phraseSynthesis(
  comparison: SourceComparison,
  questionText: string,
  topicSlug: string,
  logger: Logger,
  questionType?: string,
): Promise<PhrasedSynthesis | null> {
  if (!isLayerBEnabled(topicSlug)) return null;

  let apiKey: string;
  try {
    apiKey = getGeminiKey();
  } catch {
    logger.warn("No Gemini API keys configured, skipping Layer B phrasing");
    return null;
  }

  // Build structured input from comparison (NEVER raw signals)
  const platformLines = comparison.platformBreakdown.map((p) => {
    const pct = Math.round(p.avgProbability * 100);
    return `- ${p.platform}: ${pct}% (${p.signalCount} signals)`;
  }).join("\n");

  // Competition context for the prompt
  const isCompQuestion = questionText.toLowerCase().includes("who will win");
  const competitionContext = isCompQuestion && comparison.competitionLeader
    ? `\nCOMPETITION CONTEXT:\n- Leader: ${comparison.competitionLeader.name} (${comparison.competitionLeader.pct}%)\n${comparison.competitionChallenger ? `- Challenger: ${comparison.competitionChallenger.name} (${comparison.competitionChallenger.pct}%)` : ""}\n${comparison.competitionGapPp !== null ? `- Gap: ${comparison.competitionGapPp}pp` : ""}\nIMPORTANT: For competition questions, the bottom_line MUST name the competition (e.g., "NBA title", "F1 championship", "Premier League") AND classify the market shape (settled, contested, split, wide open, clear favorite). Do NOT use generic placeholders like "the winner" or "the outcome".`
    : "";

  const groundingLine = comparison.primaryGroundingMetric
    ? `${comparison.primaryGroundingMetric.name}: ${comparison.primaryGroundingMetric.formatted}${comparison.primaryGroundingMetric.deltaFormatted ? ` (${comparison.primaryGroundingMetric.deltaFormatted})` : ""}`
    : "No grounding data available";

  const agreementLine = {
    consensus: "Markets agree (spread: " + (comparison.predictiveSpreadPp ?? 0) + "pp)",
    mild_divergence: "Markets slightly diverge (spread: " + (comparison.predictiveSpreadPp ?? 0) + "pp)",
    sharp_divergence: "Markets sharply disagree (spread: " + (comparison.predictiveSpreadPp ?? 0) + "pp)",
    insufficient_data: "Only one platform -- insufficient data for comparison",
  }[comparison.agreementState];

  const groundingAlignLine = {
    supports: "Official data supports the market lean",
    contradicts: "Official data contradicts the market lean",
    neutral: "Official data is neutral",
  }[comparison.groundingAlignment ?? "neutral"];

  const prompt = `You are writing a sharp, specific expert take on the prediction question:
"${questionText}"

COMPUTED DATA (do not reinterpret -- phrase it):

PLATFORMS:
${platformLines}

GROUNDING DATA:
${groundingLine}

COMPUTED AGREEMENT: ${agreementLine}
COMPUTED GROUNDING ALIGNMENT: ${groundingAlignLine}
COMPARISON CONFIDENCE: ${comparison.comparisonConfidence}${competitionContext}

Write exactly 4 sections as JSON.

{
  "markets": "Name each platform with its number. Then say what the COMPARISON pattern means for THIS specific question. Not 'platforms diverge' -- say what the divergence implies about the prediction. Max 200 chars.",

  "grounding": "Name the official metric and value. Say whether it supports or undermines the market view on THIS question. If no grounding data, return null. Max 200 chars.",

  "tension": "State whether the market view on THIS question is settled, contested, split, or aligned. Describe the practical implication of the spread for someone following this question. Max 150 chars.",

  "bottom_line": "One sentence a smart friend would say about THIS specific prediction. Must mention the question subject by name (e.g., 'Fed rates', 'Arsenal', 'ceasefire'). Must state whether the view is settled or contested. Must contain a number. Max 100 chars."
}

STRICT RULES:
- The bottom_line MUST mention the specific subject of the question (team name, policy, person, metric)
- The bottom_line MUST NOT be interchangeable with another question. It should fail if you could paste it onto a different question and it still makes sense.
- Do NOT just restate the spread as your analysis. "Probabilities range from X to Y" is not insight.
- Do NOT say "significant divergence" or "notable gap" without saying what that means for this prediction.
- Do NOT describe the topic generally or give background.
- Do NOT say "it remains to be seen", "time will tell", "outlooks vary", or any filler.
- Do NOT decide agreement/disagreement yourself -- use the COMPUTED values.
- If computed agreement says "consensus", your tension MUST reflect agreement.
- If computed agreement says "sharp_divergence", your tension MUST reflect disagreement.
- Every non-null section must contain at least one number.
- You may describe the comparison PATTERN (settled, contested, split, one-sided) but you may NOT invent causes or explanations for WHY platforms disagree.
- The current year is 2026. Do NOT reference 2024 or 2025 events as current.
- Respond with valid JSON only, no markdown fences.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed: PhrasedSynthesis;
    try {
      const cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned) as PhrasedSynthesis;
    } catch {
      logger.error({ topicSlug, rawText: text.slice(0, 300) }, "Layer B: invalid JSON from Gemini");
      return null;
    }

    // Normalize
    if (typeof parsed.markets !== "string") return null;
    if (typeof parsed.tension !== "string") return null;
    if (typeof parsed.bottom_line !== "string") return null;
    if (parsed.grounding !== null && typeof parsed.grounding !== "string") {
      parsed.grounding = null;
    }

    // Truncate
    parsed.markets = parsed.markets.slice(0, 200);
    if (parsed.grounding) parsed.grounding = parsed.grounding.slice(0, 200);
    parsed.tension = parsed.tension.slice(0, 150);
    parsed.bottom_line = parsed.bottom_line.slice(0, 120);

    // Validate against deterministic comparison
    const validation = validatePhrasedSynthesis(parsed, comparison, questionText, questionType);
    if (!validation.valid) {
      logger.warn(
        { topicSlug, reason: validation.reason },
        "Layer B: phrased synthesis failed validation, falling back to deterministic",
      );
      return null;
    }

    logger.info({ topicSlug }, "Layer B: phrased synthesis passed validation");
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markGeminiKeyFailed(apiKey, logger);
    logger.error({ topicSlug, error: msg }, "Layer B: Gemini API call failed");
    return null;
  }
}
