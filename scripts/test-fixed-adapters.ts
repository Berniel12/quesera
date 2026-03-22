import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

const logger = createLogger("test-fixed");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const fixedSources = ["bls", "rss", "gdelt", "reliefweb"];
  // Metaculus skipped — requires API token now

  console.log("=== Testing Fixed Adapters ===\n");

  for (const sourceKey of fixedSources) {
    const { data: source } = await supabase
      .from("source_definitions")
      .select("id, source_key, source_family, display_name, config")
      .eq("source_key", sourceKey)
      .single();

    if (!source) { console.log(`SKIP: ${sourceKey} (not in DB)`); continue; }

    console.log(`Testing: ${sourceKey}...`);
    try {
      const adapter = getAdapter(sourceKey, source as SourceDefinitionRow, supabase, logger);
      const result = await adapter.sync();
      console.log(`  ${result.itemsFetched > 0 ? "PASS" : "WARN"}: fetched=${result.itemsFetched} inserted=${result.itemsInserted}`);
    } catch (err) {
      console.log(`  FAIL: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`);
    }
  }

  console.log("\nNote: Metaculus requires API token — register at metaculus.com");
}

main().catch((err) => { console.error(err); process.exit(1); });
