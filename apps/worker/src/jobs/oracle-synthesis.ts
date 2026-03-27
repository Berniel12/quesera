import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { getGeminiKey, markGeminiKeyFailed } from "../utils/key-rotator.js";

const MAX_VERDICT_LENGTH = 600;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

const SOURCE_NAMES: Record<string, string> = {
  fred: "Federal Reserve data", bls: "Bureau of Labor Statistics",
  eia: "Energy Information Administration", polymarket: "Polymarket",
  kalshi: "Kalshi", metaculus: "Metaculus", manifold: "Manifold Markets",
  coingecko: "CoinGecko", usgs_earthquakes: "US Geological Survey",
  noaa_nws: "National Weather Service", congress_gov: "US Congress",
  the_odds_api: "Sports bookmakers", defillama: "DeFi Llama",
  newsapi: "News outlets", rss: "News feeds", gdelt: "Global event monitoring",
};

interface OracleSynthesisPayload {
  oracle_query_id: string;
  topic_id: string;
  snapshot_id: string;
}

/**
 * Synthesize an oracle verdict for a user-asked question.
 * Loads the matched topic's snapshot + signals, calls Gemini,
 * and writes the verdict back to oracle_queries.
 */
export async function handleOracleSynthesis(
  job: Job,
  logger: Logger,
  supabase: SupabaseClient,
): Promise<void> {
  const payload = job.payload as unknown as OracleSynthesisPayload;
  const { oracle_query_id, topic_id, snapshot_id } = payload;

  // 1. Load the oracle query
  const { data: query } = await supabase
    .from("oracle_queries")
    .select("id, question_text, question_slug")
    .eq("id", oracle_query_id)
    .single();

  if (!query) {
    logger.warn({ oracle_query_id }, "Oracle query not found");
    return;
  }

  const q = query as { id: string; question_text: string; question_slug: string };

  // 2. Load snapshot state
  const { data: snapshot } = await supabase
    .from("topic_snapshots")
    .select("direction, confidence, disagreement, what_next_text")
    .eq("id", snapshot_id)
    .single();

  if (!snapshot) {
    logger.warn({ snapshot_id }, "Snapshot not found for oracle synthesis");
    await markSynthesisFailed(supabase, oracle_query_id);
    return;
  }

  const snap = snapshot as {
    direction: string;
    confidence: number;
    disagreement: number;
    what_next_text: string | null;
  };

  // 3. Load topic signals from this snapshot
  const { data: signals } = await supabase
    .from("topic_signals")
    .select("source_family, source_name, signal_type, current_value, delta, direction, weight, metadata")
    .eq("snapshot_id", snapshot_id)
    .order("weight", { ascending: false })
    .limit(15);

  const sigRows = (signals ?? []) as Array<{
    source_family: string;
    source_name: string;
    signal_type: string;
    current_value: number | null;
    delta: number | null;
    direction: string | null;
    weight: number;
    metadata: Record<string, unknown> | null;
  }>;

  // 4. Load topic name
  const { data: topic } = await supabase
    .from("topics")
    .select("canonical_name")
    .eq("id", topic_id)
    .single();

  const topicName = (topic as { canonical_name: string } | null)?.canonical_name ?? "this topic";

  // 5. Build signal context for the prompt
  const byFamily = new Map<string, typeof sigRows>();
  for (const s of sigRows) {
    const fam = s.source_family;
    const arr = byFamily.get(fam) ?? [];
    arr.push(s);
    byFamily.set(fam, arr);
  }

  const signalBlocks = [...byFamily.entries()].map(([family, sigs]) => {
    const sourceName = SOURCE_NAMES[sigs[0]?.source_name ?? ""] ?? family;
    const lines = sigs.slice(0, 5).map((s) => {
      const val = s.current_value !== null ? String(s.current_value) : "N/A";
      const delta = s.delta !== null ? ` (change: ${s.delta > 0 ? "+" : ""}${s.delta})` : "";
      return `  ${s.signal_type}: ${val}${delta}`;
    });
    return `${sourceName} (${sigs.length} signals):\n${lines.join("\n")}`;
  }).join("\n\n");

  // Market probability context
  const marketSignals = sigRows.filter((s) =>
    s.source_family === "prediction_market" || s.source_family === "forecasting",
  );
  const marketContext = marketSignals.length > 0
    ? `\nMARKET/FORECAST SIGNAL: ${marketSignals.map((s) => {
        const name = SOURCE_NAMES[s.source_name] ?? s.source_name;
        const pct = s.current_value !== null ? `${Math.round(s.current_value * 100)}%` : "unknown";
        return `${name} says ${pct} yes`;
      }).join(", ")}.`
    : "";

  // 6. Call Gemini
  let apiKey: string;
  try {
    apiKey = getGeminiKey();
  } catch {
    logger.warn("No Gemini API keys configured, marking synthesis failed");
    await markSynthesisFailed(supabase, oracle_query_id);
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `A user asked: "${q.question_text}"

This maps to the topic "${topicName}".
${marketContext}

DATA FROM ${sigRows.length} SIGNALS ACROSS ${byFamily.size} SOURCES:

${signalBlocks}

OVERALL: Direction is "${snap.direction}", confidence ${Math.round(snap.confidence * 100)}%, disagreement ${Math.round(snap.disagreement * 100)}%.

Write a JSON response:

{
  "verdict": "Answer the user's question directly in 2-4 sentences. Lead with the probability if markets have one. Be bold -- pick a side. Reference specific sources by name. No hedging.",
  "source_signals": [
    {"source": "Source Name", "value": "What this source says", "probability": 72, "direction": "up", "confidence": "High liquidity", "updated_at": "2026-03-26T00:00:00Z"}
  ]
}

RULES:
- Answer the QUESTION directly, not the topic generally
- Lead with market probability if available: "Markets put this at X%..."
- 200-500 characters for verdict
- 2-6 source_signals entries, one per source that contributed data
- probability field is optional (only include for prediction markets/forecasters, as integer 0-100)
- direction field is optional ("up", "down", "stable")
- Write like a smart friend, not a financial report
- No hedge words, no "it remains to be seen"
- No emojis
- Valid JSON only, no markdown fences
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed: { verdict: string; source_signals: Array<Record<string, unknown>> };
    try {
      const cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned) as typeof parsed;
    } catch {
      logger.error(
        { oracle_query_id, rawText: text.slice(0, 500) },
        "Invalid JSON from Gemini for oracle synthesis",
      );
      await markSynthesisFailed(supabase, oracle_query_id);
      return;
    }

    if (typeof parsed.verdict !== "string" || !Array.isArray(parsed.source_signals)) {
      logger.error({ oracle_query_id }, "Missing required fields in Gemini oracle response");
      await markSynthesisFailed(supabase, oracle_query_id);
      return;
    }

    // 7. Write verdict back to oracle_queries
    const { error: updateError } = await supabase
      .from("oracle_queries")
      .update({
        llm_verdict: parsed.verdict.slice(0, MAX_VERDICT_LENGTH),
        source_signals: parsed.source_signals,
        status: "answered",
      })
      .eq("id", oracle_query_id);

    if (updateError) {
      logger.error({ oracle_query_id, error: updateError.message }, "Failed to write oracle verdict");
      return;
    }

    logger.info(
      { oracle_query_id, topic_id, verdict_length: parsed.verdict.length, signal_count: parsed.source_signals.length },
      "Oracle synthesis completed",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markGeminiKeyFailed(apiKey, logger);
    logger.error({ oracle_query_id, error: msg }, "Gemini API call failed for oracle synthesis");
    await markSynthesisFailed(supabase, oracle_query_id);
  }
}

async function markSynthesisFailed(
  supabase: SupabaseClient,
  oracleQueryId: string,
): Promise<void> {
  await supabase
    .from("oracle_queries")
    .update({ synthesis_failed_at: new Date().toISOString() })
    .eq("id", oracleQueryId);
}
