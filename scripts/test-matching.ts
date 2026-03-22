import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { handleTopicMatching } from "../apps/worker/src/jobs/topic-matching.js";
import type { Job } from "@signal-map/queue";

const logger = createLogger("test-matching");

function fakeJob(sourceId: string): Job {
  return {
    id: "test-matching-job",
    job_type: "topic_matching",
    payload: { source_id: sourceId },
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

  const { data: sources } = await supabase
    .from("source_definitions")
    .select("id, source_key")
    .eq("is_active", true);

  console.log("=== Topic Matching Test ===\n");

  for (const source of (sources ?? []) as Array<{ id: string; source_key: string }>) {
    if (source.source_key === "wikidata") {
      console.log(`SKIP: ${source.source_key} (reference only)`);
      continue;
    }

    const { count } = await supabase
      .from("source_items")
      .select("id", { count: "exact", head: true })
      .eq("source_key", source.source_key);

    if (!count || count === 0) {
      console.log(`SKIP: ${source.source_key} (no items)`);
      continue;
    }

    console.log(`Matching: ${source.source_key} (${count} items)...`);
    try {
      await handleTopicMatching(fakeJob(source.id), logger, supabase);
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Check results
  console.log("\n--- Results ---\n");

  const { count: matchCount } = await supabase
    .from("source_item_topic_matches")
    .select("id", { count: "exact", head: true });

  console.log(`Total accepted matches: ${matchCount}`);

  const { data: sampleMatches } = await supabase
    .from("source_item_topic_matches")
    .select("match_method, match_score, topic_id")
    .order("match_score", { ascending: false })
    .limit(10);

  for (const m of (sampleMatches ?? []) as Array<{ match_method: string; match_score: number; topic_id: string }>) {
    const { data: topic } = await supabase.from("topics").select("canonical_name").eq("id", m.topic_id).single();
    console.log(`  ${(topic as { canonical_name: string } | null)?.canonical_name} (${m.match_method}, score=${m.match_score})`);
  }

  const { count: candidateCount } = await supabase
    .from("topic_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  console.log(`\nPending candidates: ${candidateCount}`);

  // Idempotency: re-run FRED
  console.log("\n--- Idempotency ---");
  const fredSrc = (sources ?? []).find((s) => (s as { source_key: string }).source_key === "fred") as { id: string } | undefined;
  if (fredSrc) {
    const { count: before } = await supabase.from("source_item_topic_matches").select("id", { count: "exact", head: true });
    await handleTopicMatching(fakeJob(fredSrc.id), logger, supabase);
    const { count: after } = await supabase.from("source_item_topic_matches").select("id", { count: "exact", head: true });
    console.log(`  Before: ${before}, After: ${after}, Idempotent: ${before === after ? "PASS" : "FAIL"}`);
  }

  console.log("\n=== Done ===");
}

main().catch((err) => { console.error(err); process.exit(1); });
