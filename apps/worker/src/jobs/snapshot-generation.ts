import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@signal-map/queue";
import { enqueue } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { scoreTopic } from "../scoring/engine.js";
import { publishSnapshot } from "../scoring/publish.js";
import { detectChanges } from "../scoring/change-detection.js";
import { SCORING_VERSION } from "../scoring/types.js";

export async function handleSnapshotGeneration(
  job: Job,
  logger: Logger,
  supabase: SupabaseClient,
): Promise<void> {
  const payload = job.payload as { topic_id: string; force?: boolean };
  const topicId = payload.topic_id;
  const startTime = Date.now();

  if (!topicId) {
    throw new Error("topic_id is required in job payload");
  }

  // 1. Create run record
  const { data: runRow, error: runError } = await supabase
    .from("snapshot_generation_runs")
    .insert({
      topic_id: topicId,
      job_queue_id: job.id,
      scoring_version: SCORING_VERSION,
      status: "running",
    })
    .select("id")
    .single();

  if (runError) {
    logger.error({ error: runError.message }, "Failed to create run record");
  }
  const runId = (runRow as { id: string } | null)?.id ?? null;

  // 2. Load topic
  const { data: topic } = await supabase
    .from("topics")
    .select("id, canonical_name, slug, category")
    .eq("id", topicId)
    .eq("status", "active")
    .single();

  if (!topic) {
    await updateRunStatus(supabase, runId, "skipped", "Topic not found or inactive");
    return;
  }

  const topicRow = topic as {
    id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
  };

  // 3. Load prior snapshot
  const { data: latestPointer } = await supabase
    .from("topic_latest_snapshot")
    .select("snapshot_id")
    .eq("topic_id", topicId)
    .maybeSingle();

  const priorSnapshotId =
    (latestPointer as { snapshot_id: string } | null)?.snapshot_id ?? null;

  // 4. Run scoring
  const scoringResult = await scoreTopic(
    supabase,
    topicId,
    priorSnapshotId,
    logger,
  );

  if (!scoringResult) {
    await updateRunStatus(supabase, runId, "skipped", "No usable signals");
    logger.info(
      {
        topic_id: topicId,
        run_id: runId,
        signal_count: 0,
        usable_signal_count: 0,
        published: false,
        duration_ms: Date.now() - startTime,
      },
      "Snapshot generation skipped: no usable signals",
    );
    return;
  }

  // 5. Load prior snapshot state for change detection
  let priorState = null;
  if (priorSnapshotId) {
    const { data: prior } = await supabase
      .from("topic_snapshots")
      .select(
        "direction, confidence, disagreement, published_at, current_picture_text",
      )
      .eq("id", priorSnapshotId)
      .single();

    priorState = prior as {
      direction: string;
      confidence: number;
      disagreement: number;
      published_at: string;
      current_picture_text: string | null;
    } | null;
  }

  // 6. Change detection
  const changes = detectChanges(
    scoringResult.state,
    priorState
      ? {
          direction: priorState.direction as "up" | "down" | "stable" | "unknown",
          confidence: priorState.confidence,
          disagreement: priorState.disagreement,
          published_at: priorState.published_at,
          current_picture_text: priorState.current_picture_text,
        }
      : null,
  );

  // 7. Publish snapshot (5-step transaction)
  const published = await publishSnapshot(
    supabase,
    topicRow,
    scoringResult.state,
    scoringResult.signals,
  );

  // 8. Enqueue summarization if material change or first snapshot
  if (changes.shouldSummarize || payload.force) {
    await enqueue(supabase, {
      job_type: "summarization",
      payload: {
        topic_id: topicId,
        snapshot_id: published.id,
        prior_snapshot_id: priorSnapshotId,
      },
      priority: 1,
    });
  }

  // 8b. Enqueue notification_generation if material change (not first snapshot)
  if (priorSnapshotId && (changes.directionChanged || (changes.confidenceDelta ?? 0) >= 0.15)) {
    await enqueue(supabase, {
      job_type: "notification_generation",
      payload: {
        topic_id: topicId,
        snapshot_id: published.id,
        trigger_type: changes.directionChanged ? "direction_change" : "confidence_change",
      },
      priority: 2,
    });
  }

  // 8c. Re-synthesize oracle queries pointing to this topic (batch: one job per topic)
  if (changes.shouldSummarize || payload.force) {
    const { data: oracleRows } = await supabase
      .from("oracle_queries")
      .select("id")
      .eq("matched_topic_id", topicId)
      .eq("status", "answered");

    if (oracleRows && oracleRows.length > 0) {
      const oracleIds = (oracleRows as Array<{ id: string }>).map((r) => r.id);

      // Enqueue synthesis jobs FIRST -- before clearing verdicts
      // If enqueue fails, the old verdict stays visible (better than skeleton with no job)
      for (const row of oracleRows as Array<{ id: string }>) {
        await enqueue(supabase, {
          job_type: "oracle_synthesis",
          payload: {
            oracle_query_id: row.id,
            topic_id: topicId,
            snapshot_id: published.id,
          },
          priority: 2,
          idempotency_key: `oracle-resynth-${row.id}-${published.id}`,
        });
      }

      // Clear verdicts AFTER all jobs are enqueued (safe ordering)
      await supabase
        .from("oracle_queries")
        .update({ llm_verdict: null, source_signals: null, answer_snapshot_id: published.id, synthesis_failed_at: null })
        .in("id", oracleIds);

      logger.info(
        { topic_id: topicId, oracle_queries_count: oracleIds.length },
        "Re-synthesis enqueued for oracle queries",
      );
    }
  }

  // 9. Update run as completed
  await supabase
    .from("snapshot_generation_runs")
    .update({
      status: "completed",
      snapshot_id: published.id,
      prior_snapshot_id: priorSnapshotId,
      direction_changed: changes.directionChanged,
      confidence_delta: changes.confidenceDelta,
      summarization_triggered: changes.shouldSummarize,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId ?? "");

  logger.info(
    {
      topic_id: topicId,
      run_id: runId,
      signal_count: scoringResult.totalSignalCount,
      usable_signal_count: scoringResult.usableSignalCount,
      direction: scoringResult.state.direction,
      confidence: scoringResult.state.confidence,
      disagreement: scoringResult.state.disagreement,
      summarization_triggered: changes.shouldSummarize,
      published: true,
      duration_ms: Date.now() - startTime,
    },
    "Snapshot generation completed",
  );
}

async function updateRunStatus(
  supabase: SupabaseClient,
  runId: string | null,
  status: string,
  errorMessage?: string,
): Promise<void> {
  if (!runId) return;
  await supabase
    .from("snapshot_generation_runs")
    .update({
      status,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}
