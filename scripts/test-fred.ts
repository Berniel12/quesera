import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

const logger = createLogger("test-fred");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: source } = await supabase
    .from("source_definitions")
    .select("id, source_key, source_family, display_name, config")
    .eq("source_key", "fred")
    .single();

  if (!source) {
    console.error("FRED source not found");
    process.exit(1);
  }

  const def = source as SourceDefinitionRow;
  console.log("Testing FRED adapter...");

  const adapter = getAdapter("fred", def, supabase, logger);
  const result = await adapter.sync();

  console.log(`  fetched: ${result.itemsFetched}`);
  console.log(`  inserted: ${result.itemsInserted}`);
  console.log(`  updated: ${result.itemsUpdated}`);

  // Show a sample
  const { data: items } = await supabase
    .from("source_items")
    .select("external_id, normalized_payload")
    .eq("source_key", "fred")
    .limit(3);

  console.log("\nSample items:");
  for (const item of (items ?? []) as Array<{ external_id: string; normalized_payload: Record<string, unknown> }>) {
    const p = item.normalized_payload;
    console.log(`  ${p.series_id}: ${p.date} = ${p.value}`);
  }

  console.log(`\n=== FRED: ${result.itemsFetched > 0 ? "PASS" : "FAIL"} ===`);
}

main().catch((err) => {
  console.error("FRED test failed:", err);
  process.exit(1);
});
