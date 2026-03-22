import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { handleSourceSync } from "../apps/worker/src/jobs/source-sync.js";
import type { Job } from "@signal-map/queue";

const logger = createLogger("test-pipeline");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Get USGS source definition
  const { data: usgs } = await supabase
    .from("source_definitions")
    .select("id")
    .eq("source_key", "usgs_earthquakes")
    .single();

  if (!usgs) {
    console.error("USGS source not found");
    process.exit(1);
  }

  const sourceId = (usgs as { id: string }).id;

  // Simulate a job
  const fakeJob: Job = {
    id: "test-job-id",
    job_type: "source_sync",
    payload: { source_id: sourceId },
    status: "running",
    priority: 0,
    max_attempts: 3,
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

  console.log("Running source_sync handler for USGS...");
  await handleSourceSync(fakeJob, logger, supabase);

  // Verify source_health updated
  const { data: health } = await supabase
    .from("source_health")
    .select("freshness, last_success_at, consecutive_failures, last_item_count")
    .eq("source_id", sourceId)
    .single();

  const h = health as {
    freshness: string;
    last_success_at: string;
    consecutive_failures: number;
    last_item_count: number;
  } | null;

  console.log("\nSource health after sync:");
  console.log(`  freshness: ${h?.freshness}`);
  console.log(`  last_success_at: ${h?.last_success_at}`);
  console.log(`  consecutive_failures: ${h?.consecutive_failures}`);
  console.log(`  last_item_count: ${h?.last_item_count}`);

  // Verify sync job record
  const { data: syncJobs } = await supabase
    .from("source_sync_jobs")
    .select("status, items_fetched, items_inserted, items_updated")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false })
    .limit(1);

  const sj = (syncJobs as Array<{
    status: string;
    items_fetched: number;
    items_inserted: number;
    items_updated: number;
  }> | null)?.[0];

  console.log("\nSync job record:");
  console.log(`  status: ${sj?.status}`);
  console.log(`  items_fetched: ${sj?.items_fetched}`);
  console.log(`  items_inserted: ${sj?.items_inserted}`);
  console.log(`  items_updated: ${sj?.items_updated}`);

  const allGood =
    h?.freshness === "fresh" &&
    h.consecutive_failures === 0 &&
    sj?.status === "completed";

  console.log(`\n=== Pipeline test: ${allGood ? "PASS" : "FAIL"} ===`);
  process.exit(allGood ? 0 : 1);
}

main().catch((err) => {
  console.error("Pipeline test crashed:", err);
  process.exit(1);
});
