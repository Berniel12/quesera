import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import {
  summarizeTopic,
  applySummarizationToSnapshot,
} from "../scoring/summarize.js";
import type { ScoredSignal, SignalDirection, FreshnessStatus } from "../scoring/types.js";

export async function handleSummarization(
  job: Job,
  logger: Logger,
  supabase: SupabaseClient,
): Promise<void> {
  const payload = job.payload as {
    topic_id: string;
    snapshot_id: string;
    prior_snapshot_id?: string;
  };
  const startTime = Date.now();

  // 1. Load topic
  const { data: topic } = await supabase
    .from("topics")
    .select("canonical_name")
    .eq("id", payload.topic_id)
    .single();

  if (!topic) {
    logger.warn({ topicId: payload.topic_id }, "Topic not found for summarization");
    return;
  }

  const topicName = (topic as { canonical_name: string }).canonical_name;

  // 2. Load snapshot
  const { data: snapshot } = await supabase
    .from("topic_snapshots")
    .select("direction, confidence, disagreement")
    .eq("id", payload.snapshot_id)
    .single();

  if (!snapshot) {
    logger.warn(
      { snapshotId: payload.snapshot_id },
      "Snapshot not found for summarization",
    );
    return;
  }

  const snap = snapshot as {
    direction: string;
    confidence: number;
    disagreement: number;
  };

  // 3. Load top signals for this snapshot
  const { data: signalRows } = await supabase
    .from("topic_signals")
    .select("*")
    .eq("snapshot_id", payload.snapshot_id)
    .order("weight", { ascending: false })
    .limit(10);

  const signals: ScoredSignal[] = (
    (signalRows ?? []) as Array<{
      source_family: string;
      source_name: string;
      signal_type: string;
      current_value: number;
      previous_value: number | null;
      delta: number | null;
      direction: string;
      weight: number;
      freshness: string;
      external_id: string | null;
      created_at: string;
      metadata: Record<string, unknown>;
    }>
  ).map((s) => ({
    sourceFamily: s.source_family,
    sourceName: s.source_name,
    signalType: s.signal_type,
    currentValue: s.current_value,
    previousValue: s.previous_value,
    delta: s.delta,
    direction: s.direction as SignalDirection,
    weight: s.weight,
    freshness: s.freshness as FreshnessStatus,
    externalId: s.external_id,
    signalTimestamp: new Date(s.created_at),
    metadata: s.metadata,
  }));

  // 4. Load prior snapshot for context (passed from snapshot-generation)
  let priorDirection: string | undefined;
  let priorConfidence: number | undefined;

  if (payload.prior_snapshot_id) {
    const { data: prior } = await supabase
      .from("topic_snapshots")
      .select("direction, confidence")
      .eq("id", payload.prior_snapshot_id)
      .single();

    if (prior) {
      const p = prior as { direction: string; confidence: number };
      priorDirection = p.direction;
      priorConfidence = p.confidence;
    }
  }

  // 5. Call Gemini
  const prose = await summarizeTopic(
    {
      topicName,
      direction: snap.direction,
      confidence: snap.confidence,
      disagreement: snap.disagreement,
      signals,
      priorDirection,
      priorConfidence,
    },
    logger,
  );

  const success = prose !== null;

  if (prose) {
    // 6. Apply prose to snapshot + refresh card
    await applySummarizationToSnapshot(
      supabase,
      payload.snapshot_id,
      payload.topic_id,
      prose,
      logger,
    );
  }

  logger.info(
    {
      topic_id: payload.topic_id,
      snapshot_id: payload.snapshot_id,
      summarization_success: success,
      model_name: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      duration_ms: Date.now() - startTime,
    },
    "Summarization completed",
  );
}
