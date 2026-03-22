import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import { getGeminiKey, markGeminiKeyFailed } from "../utils/key-rotator.js";
import type { ScoredSignal } from "./types.js";

const MAX_PROSE_LENGTH = 200;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

interface SummarizationInput {
  topicName: string;
  direction: string;
  confidence: number;
  disagreement: number;
  signals: ScoredSignal[];
  priorDirection?: string;
  priorConfidence?: number;
}

interface SummarizationOutput {
  current_picture: string;
  what_changed: string;
  what_next: string;
}

/**
 * Generate LLM prose for a published snapshot.
 * On failure: returns null (structured fallback).
 * On success: returns validated, length-enforced prose.
 */
export async function summarizeTopic(
  input: SummarizationInput,
  logger: Logger,
): Promise<SummarizationOutput | null> {
  let apiKey: string;
  try {
    apiKey = getGeminiKey();
  } catch {
    logger.warn("No Gemini API keys configured, skipping summarization");
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const signalsList = input.signals
    .slice(0, 10)
    .map(
      (s) =>
        `- ${s.sourceName}: ${s.signalType} = ${s.currentValue}${s.delta !== null ? ` (delta: ${s.delta > 0 ? "+" : ""}${s.delta})` : ""} [${s.direction}]`,
    )
    .join("\n");

  const priorContext =
    input.priorDirection !== undefined
      ? `\nPrevious: direction was ${input.priorDirection}, confidence was ${Math.round((input.priorConfidence ?? 0) * 100)}%`
      : "";

  const prompt = `You are summarizing "${input.topicName}" for a public signal intelligence dashboard.

Current signals:
${signalsList}

Direction: ${input.direction} | Confidence: ${Math.round(input.confidence * 100)}% | Disagreement: ${Math.round(input.disagreement * 100)}%
${priorContext}

Respond with valid JSON only:
{"current_picture": "...", "what_changed": "...", "what_next": "..."}

Rules: max 150 chars each. Factual, concise, plain language. No speculation.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSON validation
    let parsed: SummarizationOutput;
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned) as SummarizationOutput;
    } catch {
      logger.error(
        { topicName: input.topicName, rawText: text.slice(0, 500) },
        "Invalid JSON from Gemini, falling back",
      );
      return null;
    }

    // Validate required fields
    if (
      typeof parsed.current_picture !== "string" ||
      typeof parsed.what_changed !== "string" ||
      typeof parsed.what_next !== "string"
    ) {
      logger.error(
        { topicName: input.topicName },
        "Missing required fields in Gemini response",
      );
      return null;
    }

    // Server-side length enforcement
    return {
      current_picture: parsed.current_picture.slice(0, MAX_PROSE_LENGTH),
      what_changed: parsed.what_changed.slice(0, MAX_PROSE_LENGTH),
      what_next: parsed.what_next.slice(0, MAX_PROSE_LENGTH),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Mark key as failed for rotation cooldown
    markGeminiKeyFailed(apiKey, logger);
    logger.error(
      { topicName: input.topicName, error: msg },
      "Gemini API call failed, falling back to structured",
    );
    return null;
  }
}

/**
 * Update snapshot prose fields + refresh public_topic_cards.one_liner.
 * This is the one allowed mutable update on otherwise immutable snapshots.
 */
export async function applySummarizationToSnapshot(
  supabase: SupabaseClient,
  snapshotId: string,
  topicId: string,
  prose: SummarizationOutput,
  logger: Logger,
): Promise<void> {
  // Update snapshot prose fields (atomic)
  const { error: snapError } = await supabase
    .from("topic_snapshots")
    .update({
      current_picture_text: prose.current_picture,
      what_changed_text: prose.what_changed,
      what_next_text: prose.what_next,
      summarization_version: "v1.0.0",
      model_name: GEMINI_MODEL,
    })
    .eq("id", snapshotId);

  if (snapError) {
    logger.error(
      { snapshotId, error: snapError.message },
      "Failed to update snapshot prose",
    );
    return;
  }

  // Refresh public_topic_cards.one_liner (additive update)
  const { error: cardError } = await supabase
    .from("public_topic_cards")
    .update({ one_liner: prose.current_picture })
    .eq("topic_id", topicId);

  if (cardError) {
    logger.error(
      { topicId, error: cardError.message },
      "Failed to refresh topic card one_liner",
    );
  }
}
