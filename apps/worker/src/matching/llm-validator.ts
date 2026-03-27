import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Logger } from "@signal-map/logger";
import { getGeminiKey, markGeminiKeyFailed } from "../utils/key-rotator.js";

/**
 * Ultra-cheap LLM validation: "Does this signal belong to this topic?"
 * Uses cheapest available Gemini model (~$0.00002 per call).
 * Returns true if the signal is relevant, false if it's contamination.
 *
 * Cost estimate: 2,000 signals/day * $0.00002 = $0.04/day
 * Set GEMINI_VALIDATOR_MODEL env var to override model.
 */

const VALIDATOR_MODEL = process.env.GEMINI_VALIDATOR_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

// Cache to avoid re-validating the same signal+topic pair
const validationCache = new Map<string, boolean>();
const MAX_CACHE_SIZE = 5000;

export async function validateSignalRelevance(
  signalText: string,
  topicName: string,
  topicCategory: string | null,
  logger: Logger,
): Promise<boolean> {
  // Skip validation for deterministic matches (FRED series, earthquakes, weather alerts)
  // These are always correct by construction
  if (!signalText || signalText.length < 10) return true;

  // Check cache
  const cacheKey = `${signalText.slice(0, 100)}::${topicName}`;
  const cached = validationCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let apiKey: string;
  try {
    apiKey = getGeminiKey();
  } catch {
    // No API key = skip validation (permissive fallback)
    return true;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: VALIDATOR_MODEL });

    const prompt = `Signal: "${signalText.slice(0, 300)}"
Topic: "${topicName}" (category: ${topicCategory ?? "general"})

Is this signal actually about this topic? Answer only YES or NO.
- "Hurricanes vs Canadiens O/U 6.5" is about HOCKEY, not hurricanes/weather → NO
- "Pope Francis Nobel Prize odds" is about the Pope, not Taylor Swift → NO
- "Will Bitcoin hit 150k by 2026" IS about Bitcoin price → YES
- "Fed rate cut probability June 2026" IS about Federal Reserve rates → YES`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().toUpperCase();
    const isRelevant = text.startsWith("YES");

    // Cache result
    if (validationCache.size >= MAX_CACHE_SIZE) {
      // Clear oldest half of cache
      const keys = [...validationCache.keys()];
      for (let i = 0; i < keys.length / 2; i++) {
        const k = keys[i];
        if (k !== undefined) validationCache.delete(k);
      }
    }
    validationCache.set(cacheKey, isRelevant);

    if (!isRelevant) {
      logger.info(
        { signalText: signalText.slice(0, 80), topicName, llmResponse: text.slice(0, 20) },
        "LLM rejected signal as irrelevant to topic",
      );
    }

    return isRelevant;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markGeminiKeyFailed(apiKey, logger);
    logger.warn({ error: msg }, "LLM validation failed, allowing match (permissive fallback)");
    // On LLM failure, allow the match (permissive -- better to show a questionable signal than block a good one)
    return true;
  }
}
