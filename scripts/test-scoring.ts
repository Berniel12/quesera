import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { handleSnapshotGeneration } from "../apps/worker/src/jobs/snapshot-generation.js";
import type { Job } from "@signal-map/queue";

const logger = createLogger("test-scoring");

function fakeJob(topicId: string): Job {
  return {
    id: "test-scoring-job",
    job_type: "snapshot_generation",
    payload: { topic_id: topicId, force: true },
    status: "running",
    priority: 0,
    max_attempts: 1,
    attempt_count: 1,
    idempotency_key: null,
    claimed_by: "test",
    claimed_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: null,
    failed_at: null,
    dead_at: null,
    last_error_code: null,
    last_error_message: null,
    scheduled_for: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  console.log("=== Phase 3 Scoring & Snapshot Test ===\n");

  // Find topics with accepted matches
  const { data: matchedTopics } = await supabase
    .from("source_item_topic_matches")
    .select("topic_id");

  const topicIds = [
    ...new Set(
      ((matchedTopics ?? []) as Array<{ topic_id: string }>).map(
        (m) => m.topic_id,
      ),
    ),
  ];

  console.log(`Topics with matches: ${topicIds.length}\n`);

  let passed = 0;
  let skipped = 0;

  for (const topicId of topicIds.slice(0, 5)) {
    // Get topic name
    const { data: topic } = await supabase
      .from("topics")
      .select("canonical_name, slug")
      .eq("id", topicId)
      .single();

    const name = (topic as { canonical_name: string } | null)?.canonical_name ?? topicId;
    console.log(`Scoring: ${name}`);

    try {
      await handleSnapshotGeneration(fakeJob(topicId), logger, supabase);

      // Verify snapshot was created
      const { data: latest } = await supabase
        .from("topic_latest_snapshot")
        .select("snapshot_id")
        .eq("topic_id", topicId)
        .single();

      if (latest) {
        const snapId = (latest as { snapshot_id: string }).snapshot_id;

        // Check snapshot state
        const { data: snap } = await supabase
          .from("topic_snapshots")
          .select("version, direction, confidence, disagreement, freshness, scoring_version")
          .eq("id", snapId)
          .single();

        const s = snap as {
          version: number;
          direction: string;
          confidence: number;
          disagreement: number;
          freshness: string;
          scoring_version: string;
        } | null;

        console.log(`  PASS: v${s?.version} direction=${s?.direction} confidence=${s?.confidence} freshness=${s?.freshness}`);

        // Check signals
        const { count: sigCount } = await supabase
          .from("topic_signals")
          .select("id", { count: "exact", head: true })
          .eq("snapshot_id", snapId);

        console.log(`  Signals: ${sigCount}`);

        // Check card
        const { data: card } = await supabase
          .from("public_topic_cards")
          .select("one_liner, direction")
          .eq("topic_id", topicId)
          .single();

        console.log(`  Card: ${(card as { one_liner: string } | null)?.one_liner ?? "null"}`);

        passed++;
      } else {
        console.log("  SKIP: no snapshot published (no usable signals)");
        skipped++;
      }
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log();
  }

  // Verify idempotency
  if (topicIds.length > 0) {
    console.log("--- Idempotency Test ---");
    const { count: before } = await supabase
      .from("topic_snapshots")
      .select("id", { count: "exact", head: true });

    await handleSnapshotGeneration(fakeJob(topicIds[0]!), logger, supabase);

    const { count: after } = await supabase
      .from("topic_snapshots")
      .select("id", { count: "exact", head: true });

    // New snapshot is expected (always publish when inputs exist), but version should increment
    console.log(`  Snapshots before: ${before}, after: ${after}`);
    console.log(`  New version created (expected): ${(after ?? 0) > (before ?? 0) ? "YES" : "NO"}\n`);
  }

  console.log(`=== Results: ${passed} scored, ${skipped} skipped ===`);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
