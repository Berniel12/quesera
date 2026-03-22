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
  const oneLiner = `Direction: ${state.direction}, Confidence: ${Math.round(state.confidence * 100)}%`;

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
