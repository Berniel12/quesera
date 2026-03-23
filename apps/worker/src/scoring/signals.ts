import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import {
  extractNumericSignal,
  getSignalWeight,
} from "./extractors.js";
import type { ScoredSignal, SignalDirection } from "./types.js";
import { computeFreshnessForSignal } from "./freshness.js";

interface PriorSignal {
  source_family: string;
  external_id: string | null;
  current_value: number | null;
}

/**
 * Aggregate all scoring-eligible matches for a topic into scored signals.
 * Signals are append-only, snapshot-bound, created fresh for each snapshot.
 */
export async function aggregateSignals(
  supabase: SupabaseClient,
  topicId: string,
  priorSnapshotId: string | null,
  logger: Logger,
): Promise<ScoredSignal[]> {
  // Load accepted matches joined with source items and definitions
  const { data: matches } = await supabase
    .from("source_item_topic_matches")
    .select("source_item_id, match_score")
    .eq("topic_id", topicId);

  if (!matches || matches.length === 0) return [];

  const sourceItemIds = (matches as Array<{ source_item_id: string }>).map(
    (m) => m.source_item_id,
  );

  // Batch load source items + definitions
  const { data: items } = await supabase
    .from("source_items")
    .select(
      "id, source_id, source_key, external_id, normalized_payload, occurred_at, last_seen_at, is_active",
    )
    .in("id", sourceItemIds)
    .eq("is_active", true);

  if (!items || items.length === 0) return [];

  // Get source definitions for family/eligibility
  const sourceIds = [
    ...new Set(
      (items as Array<{ source_id: string }>).map((i) => i.source_id),
    ),
  ];
  const { data: defs } = await supabase
    .from("source_definitions")
    .select("id, source_family, scoring_eligible")
    .in("id", sourceIds)
    .eq("scoring_eligible", true);

  const defMap = new Map<string, { source_family: string }>();
  for (const d of (defs ?? []) as Array<{
    id: string;
    source_family: string;
  }>) {
    defMap.set(d.id, { source_family: d.source_family });
  }

  // Load prior signals for comparison
  const priorSignalMap = new Map<string, PriorSignal>();
  if (priorSnapshotId) {
    const { data: priorSignals } = await supabase
      .from("topic_signals")
      .select("source_family, external_id, current_value")
      .eq("snapshot_id", priorSnapshotId);

    for (const ps of (priorSignals ?? []) as PriorSignal[]) {
      const key = `${ps.source_family}:${ps.external_id ?? ""}`;
      priorSignalMap.set(key, ps);
    }
  }

  // Group items by series for intra-batch delta computation
  // For structured numeric sources (FRED), we can compute direction from
  // the two most recent observations of the same series within the matched items.
  const typedItems = items as Array<{
    id: string;
    source_id: string;
    source_key: string;
    external_id: string;
    normalized_payload: Record<string, unknown>;
    occurred_at: string | null;
    last_seen_at: string;
  }>;

  const seriesGroups = new Map<string, typeof typedItems>();
  for (const item of typedItems) {
    const seriesId = String(item.normalized_payload.series_id ?? "");
    if (seriesId) {
      const group = seriesGroups.get(seriesId) ?? [];
      group.push(item);
      seriesGroups.set(seriesId, group);
    }
  }

  // Sort each series group by occurred_at descending to find latest + prior
  for (const [, group] of seriesGroups) {
    group.sort((a, b) => {
      const dateA = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
      const dateB = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
      return dateB - dateA;
    });
  }

  // Build intra-batch prior value map: series_id → prior observation value
  const batchPriorMap = new Map<string, number>();
  for (const [seriesId, group] of seriesGroups) {
    if (group.length >= 2) {
      const priorItem = group[1]; // second most recent
      if (priorItem) {
        const rawVal = priorItem.normalized_payload.value;
        const val = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal ?? ""));
        if (!isNaN(val)) batchPriorMap.set(seriesId, val);
      }
    }
  }

  // Extract and score signals — only use the MOST RECENT observation per series
  const signals: ScoredSignal[] = [];
  let skippedCount = 0;
  const processedSeries = new Set<string>();

  for (const item of typedItems) {
    const def = defMap.get(item.source_id);
    if (!def) continue;

    // For macro series, only process the most recent observation per series
    const seriesId = String(item.normalized_payload.series_id ?? "");
    if (seriesId && processedSeries.has(seriesId)) continue;
    if (seriesId) processedSeries.add(seriesId);

    const extracted = extractNumericSignal(
      def.source_family,
      item.source_key,
      item.normalized_payload,
      item.external_id,
      item.occurred_at,
      item.last_seen_at,
    );

    if (!extracted || extracted.currentValue === null) {
      skippedCount++;
      continue;
    }

    // Determine previous value: prefer prior snapshot, fall back to intra-batch
    const priorKey = `${def.source_family}:${item.external_id}`;
    const priorFromSnapshot = priorSignalMap.get(priorKey);
    let previousValue = priorFromSnapshot?.current_value ?? null;

    // Intra-batch fallback for first snapshot or missing prior
    if (previousValue === null && seriesId) {
      previousValue = batchPriorMap.get(seriesId) ?? null;
    }

    const delta =
      previousValue !== null ? extracted.currentValue - previousValue : null;

    // Determine direction from delta
    let direction: SignalDirection = "unknown";
    if (delta !== null) {
      if (delta > 0) direction = "up";
      else if (delta < 0) direction = "down";
      else direction = "stable";
    }

    signals.push({
      sourceFamily: def.source_family,
      sourceName: extracted.sourceName,
      signalType: extracted.signalType,
      currentValue: extracted.currentValue,
      previousValue,
      delta,
      direction,
      weight: getSignalWeight(def.source_family),
      freshness: computeFreshnessForSignal(extracted.signalTimestamp),
      externalId: extracted.externalId,
      signalTimestamp: extracted.signalTimestamp,
      metadata: extracted.metadata,
    });
  }

  if (skippedCount > 0) {
    logger.info(
      { topicId, skippedCount, totalItems: items.length },
      "Skipped non-numeric items during signal extraction",
    );
  }

  return signals;
}
