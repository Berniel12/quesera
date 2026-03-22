import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

const logger = createLogger("test-new-adapters");

const SKIP_IF_NO_KEY: Record<string, string> = {
  kalshi: "KALSHI_API_KEY",
  newsapi: "NEWSAPI_KEY",
  eia: "EIA_API_KEY",
};

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const newSources = [
    "polymarket", "kalshi", "metaculus", "manifold",
    "newsapi", "rss", "reliefweb", "gdelt",
    "bls", "eia", "world_bank",
  ];

  console.log("=== Testing 11 New Adapters ===\n");
  let passed = 0;
  let skipped = 0;
  let failed = 0;

  for (const sourceKey of newSources) {
    const envVar = SKIP_IF_NO_KEY[sourceKey];
    if (envVar && !process.env[envVar]) {
      console.log(`SKIP: ${sourceKey} (${envVar} not set)`);
      skipped++;
      continue;
    }

    const { data: source } = await supabase
      .from("source_definitions")
      .select("id, source_key, source_family, display_name, config")
      .eq("source_key", sourceKey)
      .single();

    if (!source) {
      console.log(`SKIP: ${sourceKey} (not in DB)`);
      skipped++;
      continue;
    }

    console.log(`Testing: ${sourceKey} (${(source as SourceDefinitionRow).display_name})...`);

    try {
      const adapter = getAdapter(sourceKey, source as SourceDefinitionRow, supabase, logger);
      const result = await adapter.sync();
      console.log(`  PASS: fetched=${result.itemsFetched} inserted=${result.itemsInserted}`);
      passed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL: ${msg.slice(0, 120)}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${skipped} skipped, ${failed} failed ===`);
  console.log(`Total adapters: ${passed + skipped + failed + 7} (7 existing + ${passed + skipped + failed} new)`);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
