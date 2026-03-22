import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

const logger = createLogger("test-adapters");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Load all source definitions
  const { data: sources } = await supabase
    .from("source_definitions")
    .select("id, source_key, source_family, display_name, config")
    .eq("is_active", true);

  if (!sources || sources.length === 0) {
    console.error("No source definitions found");
    process.exit(1);
  }

  // Determine which adapters to test (skip those needing missing API keys)
  const skipIfNoKey: Record<string, string> = {
    fred: "FRED_API_KEY",
    congress_gov: "CONGRESS_GOV_API_KEY",
  };

  let passed = 0;
  let skipped = 0;
  let failed = 0;

  for (const source of sources) {
    const src = source as SourceDefinitionRow;
    const envVar = skipIfNoKey[src.source_key];

    if (envVar && !process.env[envVar]) {
      console.log(`  SKIP: ${src.source_key} (${envVar} not set)`);
      skipped++;
      continue;
    }

    console.log(`\nTesting: ${src.source_key} (${src.display_name})`);

    try {
      const adapter = getAdapter(src.source_key, src, supabase, logger);
      const result = await adapter.sync();

      console.log(`  PASS: fetched=${result.itemsFetched} inserted=${result.itemsInserted} updated=${result.itemsUpdated}`);

      // Verify items are in the database
      const { data: items, error } = await supabase
        .from("source_items")
        .select("id")
        .eq("source_key", src.source_key)
        .limit(1);

      if (error || !items || items.length === 0) {
        console.log(`  WARN: No items found in source_items after sync`);
      } else {
        console.log(`  DB: items present in source_items`);
      }

      passed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  }

  // Test idempotency — run USGS again
  console.log("\nIdempotency test: re-syncing usgs_earthquakes...");
  const usgsDef = (sources as SourceDefinitionRow[]).find(
    (s) => s.source_key === "usgs_earthquakes",
  );
  if (usgsDef) {
    const adapter = getAdapter("usgs_earthquakes", usgsDef, supabase, logger);
    const result = await adapter.sync();
    console.log(
      `  Dedup: fetched=${result.itemsFetched} inserted=${result.itemsInserted} updated=${result.itemsUpdated}`,
    );
    if (result.itemsInserted === 0) {
      console.log("  PASS: Idempotent (0 new inserts on re-sync)");
    } else {
      console.log("  INFO: Some new items appeared between syncs");
    }
  }

  // Check source_health
  console.log("\nSource health check:");
  const { data: health } = await supabase
    .from("source_health")
    .select("source_id, freshness, last_success_at, consecutive_failures");

  for (const h of (health ?? []) as Array<{
    source_id: string;
    freshness: string;
    last_success_at: string | null;
    consecutive_failures: number;
  }>) {
    const src = (sources as SourceDefinitionRow[]).find(
      (s) => s.id === h.source_id,
    );
    console.log(
      `  ${src?.source_key ?? h.source_id}: freshness=${h.freshness} failures=${h.consecutive_failures} last_success=${h.last_success_at ? "yes" : "no"}`,
    );
  }

  console.log(`\n=== Results: ${passed} passed, ${skipped} skipped, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
