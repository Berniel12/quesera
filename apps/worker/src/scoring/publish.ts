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
  // Preserve hand-written one-liners: only overwrite if existing is a generic template
  const computedOneLiner = generateDeterministicOneLiner(state, signals, topic.canonical_name);

  const GENERIC_PREFIXES = [
    "We're watching", "We're gathering", "We are tracking",
    "Following industry", "Monitoring international", "Watching trends",
    "Tracking odds", "Early signals", "Signals are",
    "Markets see this as unlikely — just 0%",
    "Markets are pricing this at 100%",
  ];

  const { data: existingCard } = await supabase
    .from("public_topic_cards")
    .select("one_liner")
    .eq("topic_id", topic.id)
    .maybeSingle();

  const existingOneLiner = (existingCard as { one_liner: string | null } | null)?.one_liner;
  const existingIsGeneric = !existingOneLiner || existingOneLiner.length < 40 ||
    GENERIC_PREFIXES.some((p) => existingOneLiner.startsWith(p));

  const oneLiner = existingIsGeneric ? computedOneLiner : existingOneLiner;

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
// These must read like a smart friend answering a question, NOT like a data report.
// The one-liner IS the product for 80% of users. They scan it and leave.

/** Human-readable context for macro data series */
const MACRO_CONTEXT: Record<string, { name: string; unit: string; context: string }> = {
  MORTGAGE30US: { name: "mortgage rates", unit: "%", context: "The 30-year fixed rate" },
  CPIAUCSL: { name: "consumer prices", unit: "", context: "The consumer price index" },
  UNRATE: { name: "unemployment", unit: "%", context: "The unemployment rate" },
  FEDFUNDS: { name: "the Fed rate", unit: "%", context: "The federal funds rate" },
  DGS10: { name: "Treasury yields", unit: "%", context: "The 10-year Treasury yield" },
  GDP: { name: "economic growth", unit: "", context: "GDP" },
  CES0000000001: { name: "job creation", unit: "", context: "Nonfarm payrolls" },
  LNS14000000: { name: "unemployment", unit: "%", context: "The unemployment rate" },
  "CUSR0000SA0": { name: "consumer prices", unit: "", context: "The consumer price index" },
  "CUUR0000SA0": { name: "consumer prices", unit: "", context: "The consumer price index" },
  "PET.RWTC.W": { name: "oil prices", unit: "", context: "Crude oil" },
};

function generateDeterministicOneLiner(
  state: ScoredState,
  signals: ScoredSignal[],
  topicName: string = "",
): string {
  const primary = signals
    .filter((s) => s.currentValue !== null && s.currentValue !== undefined)
    .sort((a, b) => b.weight - a.weight)[0];

  const signalCount = signals.length;
  const dir = state.direction;

  // ── Macro official: translate data into plain language ──
  if (primary && primary.sourceFamily === "macro_official") {
    const seriesId = String(primary.metadata?.series_id ?? "");
    const ctx = MACRO_CONTEXT[seriesId];
    const value = Number(primary.currentValue);
    const delta = primary.delta !== null ? Number(primary.delta) : null;

    if (ctx) {
      const valueStr = ctx.unit === "%" ? `${value > 10 ? value.toFixed(1) : value.toFixed(2)}%` : value.toLocaleString("en-US");

      if (delta !== null && Math.abs(delta) > 0.01) {
        const movement = delta > 0 ? "edged higher" : "moved lower";
        return `${ctx.context} is at ${valueStr} and has ${movement} recently. ${signalCount > 1 ? `Tracking ${signalCount} data points.` : ""}`.trim();
      }
      return `${ctx.context} is holding at ${valueStr} with no significant movement. Conditions appear stable for now.`;
    }
  }

  // ── Crypto: price + momentum ──
  if (primary && primary.sourceFamily === "crypto_market") {
    const name = String(primary.metadata?.name ?? "This asset");
    const price = Number(primary.currentValue);
    const priceStr = price >= 1 ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${price.toFixed(4)}`;

    if (dir === "up") return `${name} is trading at ${priceStr} and showing upward momentum. Market sentiment is leaning positive.`;
    if (dir === "down") return `${name} is at ${priceStr} and under pressure. Sellers are currently in control.`;
    return `${name} is trading around ${priceStr}. No clear direction right now — the market is in wait-and-see mode.`;
  }

  // ── Prediction markets: probability as outlook ──
  if (primary && (primary.sourceFamily === "prediction_market" || primary.sourceFamily === "forecast_aggregator")) {
    const prob = Number(primary.currentValue);
    const pct = Math.round(prob * 100);
    const question = String(primary.metadata?.question ?? "");

    if (pct >= 70) return `Markets are pricing this at ${pct}% likely. The consensus is leaning strongly toward yes.`;
    if (pct >= 50) return `Trading at ${pct}% probability. Slight lean toward yes, but far from certain.`;
    if (pct >= 30) return `Only ${pct}% probability in prediction markets. The consensus leans toward no.`;
    return `Markets see this as unlikely — just ${pct}% probability. Very few are betting on it.`;
  }

  // ── Sports odds: implied probability ──
  if (primary && primary.sourceFamily === "sports_odds") {
    const prob = Number(primary.currentValue);
    const pct = Math.round(prob * 100);
    if (pct >= 60) return `Bookmakers give this a ${pct}% chance. The odds are clearly in favor.`;
    if (pct >= 40) return `Bookmakers see this as a toss-up — roughly ${pct}% implied probability.`;
    return `The betting odds suggest this is unlikely at ${pct}%. The field is wide open.`;
  }

  // ── Hazard/weather: situation description ──
  if (primary && primary.sourceFamily === "hazard_weather") {
    if (primary.signalType === "earthquake_magnitude") {
      const mag = Number(primary.currentValue);
      if (mag >= 5) return `A significant earthquake (M${mag.toFixed(1)}) was recently recorded. Elevated seismic activity this week.`;
      if (signalCount > 50) return `${signalCount} earthquakes recorded recently. Activity levels appear normal — no unusual patterns detected.`;
      return `Moderate seismic activity this week with ${signalCount} events recorded. Nothing out of the ordinary.`;
    }
    if (primary.signalType === "weather_severity") {
      const severity = Number(primary.currentValue);
      if (severity >= 3) return `Severe weather alerts are active. Conditions may be dangerous in affected areas.`;
      return `Weather alerts are active but conditions are manageable. Stay informed if you're in an affected area.`;
    }
  }

  // ── Political/legislative: action description ──
  if (primary && primary.sourceFamily === "political_official") {
    if (signalCount >= 3) return `Multiple legislative actions detected recently. Congress is actively working on this issue.`;
    return `Limited legislative activity right now. This issue is not seeing much movement in Congress.`;
  }

  // ── DeFi: TVL as market health ──
  if (primary && primary.sourceFamily === "defi_signal") {
    const tvl = Number(primary.currentValue);
    const tvlStr = tvl >= 1e9 ? `$${(tvl / 1e9).toFixed(1)}B` : `$${(tvl / 1e6).toFixed(0)}M`;
    return `Total value locked is at ${tvlStr}. ${dir === "up" ? "Capital is flowing in — a positive signal." : dir === "down" ? "Capital is flowing out — a cautious signal." : "Holding steady for now."}`;
  }

  // ── Universal fallback: topic-aware, not generic ──
  const topicLabel = topicName ? topicName.toLowerCase() : "this topic";
  if (dir === "up") return `Signals are pointing upward on ${topicLabel}. Multiple indicators suggest positive momentum.`;
  if (dir === "down") return `Signals are trending downward on ${topicLabel}. The data suggests a negative direction.`;
  if (signalCount > 10) return `Tracking ${signalCount} data points on ${topicLabel}. The picture is stable with no significant movement.`;
  if (signalCount > 0) return `Early signals are coming in on ${topicLabel} but no clear trend has emerged yet.`;
  return `We're watching ${topicLabel} across multiple sources. No strong signals yet, but we're tracking this.`;
}
