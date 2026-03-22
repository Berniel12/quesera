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

  // Extract and score signals
  const signals: ScoredSignal[] = [];
  let skippedCount = 0;

  for (const item of items as Array<{
    id: string;
    source_id: string;
    source_key: string;
    external_id: string;
    normalized_payload: Record<string, unknown>;
    occurred_at: string | null;
    last_seen_at: string;
  }>) {
    const def = defMap.get(item.source_id);
    if (!def) continue;

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

    // Align with prior signal
    const priorKey = `${def.source_family}:${item.external_id}`;
    const prior = priorSignalMap.get(priorKey);
    const previousValue = prior?.current_value ?? null;
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
