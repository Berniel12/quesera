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

  return { valid: true, reason: null };
}

// ── LLM Phrasing ──────────────────────────────────────────────────────

export async function phraseSynthesis(
  comparison: SourceComparison,
  questionText: string,
  topicSlug: string,
  logger: Logger,
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

  const prompt = `You are phrasing a structured source comparison for the prediction question:
"${questionText}"

COMPUTED DATA (do not reinterpret -- phrase it):

PLATFORMS:
${platformLines}

GROUNDING DATA:
${groundingLine}

COMPUTED AGREEMENT: ${agreementLine}
COMPUTED GROUNDING ALIGNMENT: ${groundingAlignLine}
COMPARISON CONFIDENCE: ${comparison.comparisonConfidence}

Write exactly 4 sections as JSON. Each section MUST:
- Reference specific platform names (Polymarket, Kalshi, Metaculus) and their numbers
- Contain at least one number
- Be concise and direct
- Not describe the topic generally or give background

{
  "markets": "What do prediction markets say? Name each platform and its percentage. Note if they agree or diverge. Max 200 chars.",
  "grounding": "What does official/context data say? Name the metric and value. If no grounding data, return null. Max 200 chars.",
  "tension": "Phrase the computed agreement state. If markets agree, say so. If they diverge, name the gap. Do NOT manufacture disagreement if the computed state is consensus. Max 150 chars.",
  "bottom_line": "One sentence synthesizing everything. Must contain a number. Max 100 chars."
}

STRICT RULES:
- Do NOT describe the topic or give background
- Do NOT say "it remains to be seen" or "time will tell" or any filler
- Do NOT restate the question
- Do NOT decide agreement/disagreement yourself -- use the COMPUTED values
- If computed agreement says "consensus", your tension MUST reflect agreement
- If computed agreement says "sharp_divergence", your tension MUST reflect disagreement
- Every non-null section must contain at least one number
- Respond with valid JSON only, no markdown fences`;

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
    const validation = validatePhrasedSynthesis(parsed, comparison);
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
