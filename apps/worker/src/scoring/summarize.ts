import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import { getGeminiKey, markGeminiKeyFailed } from "../utils/key-rotator.js";
import type { ScoredSignal } from "./types.js";

const MAX_PROSE_LENGTH = 800;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

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

  // Extract market probability for context if prediction markets are among signals
  const marketSignals = input.signals.filter((s) => s.sourceFamily === "prediction_market" || s.sourceFamily === "forecasting");
  const marketContext = marketSignals.length > 0
    ? `\nMARKET/FORECAST SIGNAL: ${marketSignals.map((s) => {
        const name = SOURCE_NAMES[s.sourceName] ?? s.sourceName;
        const pct = s.currentValue !== null ? `${Math.round(s.currentValue * 100)}%` : "unknown";
        return `${name} says ${pct} yes`;
      }).join(", ")}.`
    : "";

  const prompt = `You are writing about the prediction question: "${input.questionText ?? input.topicName}"

Your job: explain the full picture like a sharp, opinionated friend who has done the research. Not a data analyst. Not a chatbot. A person who reads the signals, connects the dots, and tells you what they actually think.
${marketContext}

DATA FROM ${signalCount} SIGNALS ACROSS ${sourceCount} SOURCES:

${signalBlocks}

OVERALL: Direction is "${input.direction}", confidence ${Math.round(input.confidence * 100)}%, disagreement ${Math.round(input.disagreement * 100)}%.
${priorContext}

THE SYSTEM VERDICT: Based on the data, the system labeled this "${input.direction}" with ${Math.round(input.confidence * 100)}% confidence.
Your prose MUST be coherent with this verdict. If the verdict says "stable" or "down", do NOT write prose that says "tensions are escalating" or "momentum is building." If you genuinely disagree with the verdict based on the data, explicitly say so: "Despite the stable signals, the underlying dynamics suggest..."

Write a JSON response with three fields:

{
  "current_picture": "Start with your bold answer using the EXACT framing of the question. If the question asks 'Will X happen?' answer 'Yes, because...' or 'No, because...'. Never answer with a generic topic summary. Reference at least 2 specific signals by source name and number. If you only have signals from 1 source, say so explicitly.",

  "what_changed": "What moved recently? Name the specific data point, the direction, and the number. If nothing moved, explain what the stasis means for the prediction -- not just 'things are unchanged' but WHY unchanged matters.",

  "what_next": "Name specific dates, events, or thresholds that will resolve this question. Not 'watch for developments' but 'the June 11 FOMC meeting is the next decision point' or 'if Polymarket breaks above 80%, the market has decided'. Give the reader a calendar marker."
}

RULES:
- Be bold. Pick a side. Say what you think the answer is.
- Write like a smart friend at a dinner party, not a financial report
- 400-700 characters per field
- Always name your sources (Polymarket, Federal Reserve data, CoinGecko, bookmakers, etc.)
- When prediction markets have a probability, lead with it: "Markets put this at 72%..."
- Connect different signals: "Markets say X, but the official data tells a different story..."
- No hedge words like "it remains to be seen" or "time will tell"
- The current year is 2026. Do NOT reference 2024 or 2025 events as current. All predictions and context must be framed in 2026.
- No indicator codes (say "unemployment rate" not "UNRATE")
- No emojis
- ALWAYS include geographic specificity: say "US", "Atlantic", "European", etc. Never say "this hurricane season" without saying where.
- ALWAYS include specific numbers and thresholds: say "above the 14-storm historical average" not "above average". Say "3.2% CPI" not "inflation cooling".
- ALWAYS cite the specific data source for every claim: "Polymarket at 73%" not "markets say likely"
- If you only have 1-2 signals, acknowledge the limited data: "Based on early Polymarket data only -- more sources needed for a complete picture"
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
