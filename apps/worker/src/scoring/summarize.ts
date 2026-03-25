import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import { getGeminiKey, markGeminiKeyFailed } from "../utils/key-rotator.js";
import type { ScoredSignal } from "./types.js";

const MAX_PROSE_LENGTH = 800;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

// Human-readable source names for the prompt
const SOURCE_NAMES: Record<string, string> = {
  fred: "Federal Reserve data",
  bls: "Bureau of Labor Statistics",
  eia: "Energy Information Administration",
  polymarket: "Polymarket (prediction market)",
  kalshi: "Kalshi (prediction market)",
  metaculus: "Metaculus (forecasting platform)",
  manifold: "Manifold Markets",
  coingecko: "CoinGecko (crypto exchange data)",
  usgs_earthquakes: "US Geological Survey",
  noaa_nws: "National Weather Service",
  congress_gov: "US Congress records",
  the_odds_api: "Sports bookmakers",
  defillama: "DeFi Llama (on-chain data)",
  newsapi: "News outlets",
  rss: "News feeds",
  gdelt: "Global event monitoring",
};

interface SummarizationInput {
  topicName: string;
  questionText: string;
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
 * Generate rich, multi-source LLM prose for a published snapshot.
 * Produces connected-dots analysis referencing specific signal sources.
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

  // Group signals by source family for the prompt
  const byFamily = new Map<string, ScoredSignal[]>();
  for (const s of input.signals.slice(0, 15)) {
    const fam = s.sourceFamily ?? "unknown";
    const arr = byFamily.get(fam) ?? [];
    arr.push(s);
    byFamily.set(fam, arr);
  }

  const signalBlocks = [...byFamily.entries()].map(([family, sigs]) => {
    const sourceName = SOURCE_NAMES[sigs[0]?.sourceName ?? ""] ?? family;
    const lines = sigs.slice(0, 5).map((s) => {
      const val = s.currentValue !== null ? String(s.currentValue) : "N/A";
      const delta = s.delta !== null ? ` (change: ${s.delta > 0 ? "+" : ""}${s.delta})` : "";
      return `  ${s.signalType}: ${val}${delta}`;
    });
    return `${sourceName} (${sigs.length} signals):\n${lines.join("\n")}`;
  }).join("\n\n");

  const sourceCount = byFamily.size;
  const signalCount = input.signals.length;

  const priorContext = input.priorDirection !== undefined
    ? `Previously the outlook was "${input.priorDirection}" with ${Math.round((input.priorConfidence ?? 0) * 100)}% confidence.`
    : "";

  const prompt = `You are a senior analyst writing a briefing about the question: "${input.questionText ?? input.topicName}"

Your job is to explain the current situation like a smart, knowledgeable friend -- connecting signals from ${sourceCount} different source types into a coherent picture. Reference specific sources by name. Explain where they agree and where they diverge.

DATA FROM ${signalCount} SIGNALS ACROSS ${sourceCount} SOURCES:

${signalBlocks}

OVERALL: Direction is "${input.direction}", confidence ${Math.round(input.confidence * 100)}%, disagreement ${Math.round(input.disagreement * 100)}%.
${priorContext}

Write a JSON response with three fields:

{
  "current_picture": "A 3-5 sentence explanation of the current situation. Start with the bottom line answer. Then explain what the key signals show and why. Reference at least 2 specific sources by name. Connect the dots -- explain how different signals tell the same or different stories.",

  "what_changed": "2-3 sentences about what shifted recently. Reference specific data points that moved. If nothing meaningful changed, say so and explain what staying flat means in this context.",

  "what_next": "2-3 sentences about what to watch. Name specific indicators, dates, or events that would change the picture. Be specific -- not 'watch for developments' but 'watch the next Fed meeting on June 12' or 'if unemployment breaks above 4.5%, the recession narrative takes over'."
}

RULES:
- Write like a smart friend explaining over coffee, not a financial report
- 400-700 characters per field (about 3-5 sentences each)
- Always reference specific source names (Federal Reserve data, Polymarket, CoinGecko, etc.)
- Connect signals: "Prediction markets show X, while government data shows Y -- together this suggests Z"
- No raw indicator codes (say "the unemployment rate" not "UNRATE")
- No jargon without explanation
- Be opinionated -- pick a side based on the data
- If sources disagree, explain the disagreement honestly
- Respond with valid JSON only, no markdown fences
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed: SummarizationOutput;
    try {
      const cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned) as SummarizationOutput;
    } catch {
      logger.error(
        { topicName: input.topicName, rawText: text.slice(0, 500) },
        "Invalid JSON from Gemini, falling back",
      );
      return null;
    }

    if (
      typeof parsed.current_picture !== "string" ||
      typeof parsed.what_changed !== "string" ||
      typeof parsed.what_next !== "string"
    ) {
      logger.error({ topicName: input.topicName }, "Missing required fields in Gemini response");
      return null;
    }

    return {
      current_picture: parsed.current_picture.slice(0, MAX_PROSE_LENGTH),
      what_changed: parsed.what_changed.slice(0, MAX_PROSE_LENGTH),
      what_next: parsed.what_next.slice(0, MAX_PROSE_LENGTH),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markGeminiKeyFailed(apiKey, logger);
    logger.error({ topicName: input.topicName, error: msg }, "Gemini API call failed");
    return null;
  }
}

/**
 * Update snapshot prose fields. Preserves hand-written one-liners.
 */
export async function applySummarizationToSnapshot(
  supabase: SupabaseClient,
  snapshotId: string,
  topicId: string,
  prose: SummarizationOutput,
  logger: Logger,
): Promise<void> {
  const { error: snapError } = await supabase
    .from("topic_snapshots")
    .update({
      current_picture_text: prose.current_picture,
      what_changed_text: prose.what_changed,
      what_next_text: prose.what_next,
      summarization_version: "v2.0.0",
      model_name: GEMINI_MODEL,
    })
    .eq("id", snapshotId);

  if (snapError) {
    logger.error({ snapshotId, error: snapError.message }, "Failed to update snapshot prose");
    return;
  }

  // Only update one_liner if existing is generic/short
  const GENERIC_PREFIXES = [
    "We're watching", "We're gathering", "We are tracking",
    "Following industry", "Monitoring international", "Watching trends",
    "Tracking odds", "Early signals", "Signals are",
    "Markets see this as unlikely \u2014 just 0%",
    "Markets are pricing this at 100%",
  ];

  const { data: existingCard } = await supabase
    .from("public_topic_cards")
    .select("one_liner")
    .eq("topic_id", topicId)
    .maybeSingle();

  const existing = (existingCard as { one_liner: string | null } | null)?.one_liner;
  const isGeneric = !existing || existing.length < 40 ||
    GENERIC_PREFIXES.some((p) => existing.startsWith(p));

  if (isGeneric) {
    const { error: cardError } = await supabase
      .from("public_topic_cards")
      .update({ one_liner: prose.current_picture.slice(0, 200) })
      .eq("topic_id", topicId);

    if (cardError) {
      logger.error({ topicId, error: cardError.message }, "Failed to refresh topic card one_liner");
    }
  }
}
