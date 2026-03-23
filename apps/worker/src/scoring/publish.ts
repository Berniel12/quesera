import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoredState, ScoredSignal } from "./types.js";
import { SCORING_VERSION } from "./types.js";

interface TopicRow {
  id: string;
  canonical_name: string;
  slug: string;
  category: string | null;
}

interface PublishedSnapshot {
  id: string;
  version: number;
}

/**
 * 5-step snapshot publication transaction (hard invariant).
 * All steps must succeed or snapshot must not become latest.
 * Realtime/invalidation emitted ONLY after all steps complete.
 */
export async function publishSnapshot(
  supabase: SupabaseClient,
  topic: TopicRow,
  state: ScoredState,
  signals: ScoredSignal[],
): Promise<PublishedSnapshot> {
  const now = new Date().toISOString();

  // Step 1: Get next version (per-topic monotonic)
  const { data: maxVersionRow } = await supabase
    .from("topic_snapshots")
    .select("version")
    .eq("topic_id", topic.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version =
    ((maxVersionRow as { version: number } | null)?.version ?? 0) + 1;

  // Step 2: INSERT immutable snapshot row (prose fields null)
  const { data: snapshot, error: snapError } = await supabase
    .from("topic_snapshots")
    .insert({
      topic_id: topic.id,
      version,
      direction: state.direction,
      confidence: state.confidence,
      disagreement: state.disagreement,
      freshness: state.freshness,
      staleness_seconds: state.stalenessSeconds,
      structured_data: state.structuredData,
      scoring_version: SCORING_VERSION,
      snapshot_at: now,
      published_at: now,
    })
    .select("id")
    .single();

  if (snapError || !snapshot) {
    throw new Error(
      `Failed to insert snapshot: ${snapError?.message ?? "no data"}`,
    );
  }

  const snapshotId = (snapshot as { id: string }).id;

  // Step 3: INSERT topic_signals (snapshot-bound, append-only)
  if (signals.length > 0) {
    const signalRows = signals.map((s) => ({
      topic_id: topic.id,
      snapshot_id: snapshotId,
      source_family: s.sourceFamily,
      source_name: s.sourceName,
      signal_type: s.signalType,
      current_value: s.currentValue,
      previous_value: s.previousValue,
      delta: s.delta,
      direction: s.direction,
      weight: s.weight,
      freshness: s.freshness,
      external_id: s.externalId,
      metadata: s.metadata,
    }));

    const { error: sigError } = await supabase
      .from("topic_signals")
      .insert(signalRows);

    if (sigError) {
      throw new Error(`Failed to insert signals: ${sigError.message}`);
    }
  }

  // Step 4: UPSERT topic_latest_snapshot pointer
  const { error: latestError } = await supabase
    .from("topic_latest_snapshot")
    .upsert({
      topic_id: topic.id,
      snapshot_id: snapshotId,
    });

  if (latestError) {
    throw new Error(
      `Failed to update latest pointer: ${latestError.message}`,
    );
  }

  // Step 5: UPSERT public_topic_cards (deterministic, no LLM dependency)
  const oneLiner = generateDeterministicOneLiner(state, signals);

  const { error: cardError } = await supabase
    .from("public_topic_cards")
    .upsert({
      topic_id: topic.id,
      canonical_name: topic.canonical_name,
      slug: topic.slug,
      category: topic.category,
      direction: state.direction,
      confidence: state.confidence,
      freshness: state.freshness,
      one_liner: oneLiner,
      snapshot_published_at: now,
    });

  if (cardError) {
    throw new Error(`Failed to update topic card: ${cardError.message}`);
  }

  return { id: snapshotId, version };
}

// ── Deterministic One-Liner Generation ──

/** Macro series labels for human-readable one-liners (FRED + BLS + EIA) */
const SERIES_LABELS: Record<string, string> = {
  MORTGAGE30US: "30-year fixed",
  CPIAUCSL: "CPI",
  UNRATE: "Unemployment",
  FEDFUNDS: "Fed funds rate",
  DGS10: "10-year Treasury",
  GDP: "GDP",
  CES0000000001: "Nonfarm payrolls",
  LNS14000000: "Unemployment rate",
  "CUSR0000SA0": "CPI-U",
  "CUUR0000SA0": "CPI-U (unadjusted)",
  "PET.RWTC.W": "WTI crude oil",
};

/** Period labels for macro series cadences */
const SERIES_PERIOD: Record<string, string> = {
  MORTGAGE30US: "from last week",
  DGS10: "from yesterday",
  FEDFUNDS: "from prior reading",
  CPIAUCSL: "from last month",
  UNRATE: "from last month",
  GDP: "from last quarter",
  CES0000000001: "from last month",
  LNS14000000: "from last month",
  "CUSR0000SA0": "from last month",
  "CUUR0000SA0": "from last month",
  "PET.RWTC.W": "from last week",
};

/**
 * Generate a meaningful deterministic one-liner from scored signals.
 * For macro_official sources with numeric values, produces something like:
 *   "30-year fixed at 6.65%, down 0.07% from last week."
 * Falls back to direction + confidence summary for other source families.
 */
function generateDeterministicOneLiner(
  state: ScoredState,
  signals: ScoredSignal[],
): string {
  // Find the primary signal (highest weight)
  const primary = signals
    .filter((s) => s.currentValue !== null && s.currentValue !== undefined)
    .sort((a, b) => b.weight - a.weight)[0];

  if (primary && primary.sourceFamily === "macro_official") {
    const seriesId = String(primary.metadata?.series_id ?? "");
    const label = SERIES_LABELS[seriesId] ?? seriesId;
    const value = Number(primary.currentValue);
    const delta = primary.delta !== null ? Number(primary.delta) : null;
    const period = SERIES_PERIOD[seriesId] ?? "from prior reading";

    // Format value based on typical range
    const valueStr = value > 10 ? value.toFixed(1) : value.toFixed(2);

    if (delta !== null && delta !== 0) {
      const deltaDir = delta > 0 ? "up" : "down";
      const deltaStr = Math.abs(delta) > 10
        ? Math.abs(delta).toFixed(1)
        : Math.abs(delta).toFixed(2);
      return `${label} at ${valueStr}%, ${deltaDir} ${deltaStr}% ${period}.`;
    }

    return `${label} at ${valueStr}%, unchanged ${period}.`;
  }

  // Crypto assets: price-based one-liner
  if (primary && primary.sourceFamily === "crypto_market") {
    const name = String(primary.metadata?.name ?? primary.metadata?.symbol ?? "Asset");
    const price = Number(primary.currentValue);
    const delta = primary.delta !== null ? Number(primary.delta) : null;

    const priceStr = price >= 1 ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `$${price.toFixed(4)}`;

    if (delta !== null && delta !== 0) {
      const pct = primary.previousValue ? ((delta / Number(primary.previousValue)) * 100) : 0;
      const deltaDir = delta > 0 ? "up" : "down";
      return `${name} at ${priceStr}, ${deltaDir} ${Math.abs(pct).toFixed(1)}% in 24h.`;
    }

    return `${name} at ${priceStr}, unchanged in 24h.`;
  }

  // Fallback: descriptive direction + confidence
  const dirLabel = state.direction === "up" ? "Rising" : state.direction === "down" ? "Falling" : "Stable";
  const confPct = Math.round(state.confidence * 100);
  return `${dirLabel}. ${confPct}% confidence based on ${signals.length} signal${signals.length === 1 ? "" : "s"}.`;
}
