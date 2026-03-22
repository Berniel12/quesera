import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { handleSummarization } from "../apps/worker/src/jobs/summarization.js";
import type { Job } from "@signal-map/queue";

const logger = createLogger("test-summarize");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Find the latest snapshot for a topic
  const { data: latest } = await supabase
    .from("topic_latest_snapshot")
    .select("topic_id, snapshot_id")
    .limit(1)
    .single();

  if (!latest) {
    console.log("No snapshots found. Run scoring first.");
    return;
  }

  const { topic_id, snapshot_id } = latest as {
    topic_id: string;
    snapshot_id: string;
  };

  const { data: topic } = await supabase
    .from("topics")
    .select("canonical_name")
    .eq("id", topic_id)
    .single();

  const name = (topic as { canonical_name: string } | null)?.canonical_name ?? "?";
  console.log(`Testing summarization for: ${name}\n`);

  const fakeJob: Job = {
    id: "test-summarize-job",
    job_type: "summarization",
    payload: { topic_id, snapshot_id },
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

  await handleSummarization(fakeJob, logger, supabase);

  // Check if prose was written
  const { data: snap } = await supabase
    .from("topic_snapshots")
    .select(
      "current_picture_text, what_changed_text, what_next_text, model_name",
    )
    .eq("id", snapshot_id)
    .single();

  const s = snap as {
    current_picture_text: string | null;
    what_changed_text: string | null;
    what_next_text: string | null;
    model_name: string | null;
  } | null;

  console.log("\n--- Snapshot Prose ---");
  console.log(`Current picture: ${s?.current_picture_text ?? "(null)"}`);
  console.log(`What changed:    ${s?.what_changed_text ?? "(null)"}`);
  console.log(`What next:       ${s?.what_next_text ?? "(null)"}`);
  console.log(`Model:           ${s?.model_name ?? "(null)"}`);

  // Check card refresh
  const { data: card } = await supabase
    .from("public_topic_cards")
    .select("one_liner")
    .eq("topic_id", topic_id)
    .single();

  console.log(`Card one_liner:  ${(card as { one_liner: string } | null)?.one_liner ?? "(null)"}`);

  const success = s?.current_picture_text !== null;
  console.log(`\n=== Summarization: ${success ? "PASS" : "FAIL (structured fallback)"} ===`);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
