import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

const logger = createLogger("test-congress");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: source } = await supabase
    .from("source_definitions")
    .select("id, source_key, source_family, display_name, config")
    .eq("source_key", "congress_gov")
    .single();

  if (!source) {
    console.error("Congress.gov source not found");
    process.exit(1);
  }

  console.log("Testing Congress.gov adapter...");
  const adapter = getAdapter("congress_gov", source as SourceDefinitionRow, supabase, logger);
  const result = await adapter.sync();

  console.log(`  fetched: ${result.itemsFetched}`);
  console.log(`  inserted: ${result.itemsInserted}`);
  console.log(`  updated: ${result.itemsUpdated}`);

  const { data: items } = await supabase
    .from("source_items")
    .select("external_id, normalized_payload")
    .eq("source_key", "congress_gov")
    .limit(3);

  console.log("\nSample bills:");
  for (const item of (items ?? []) as Array<{ external_id: string; normalized_payload: Record<string, unknown> }>) {
    const p = item.normalized_payload;
    console.log(`  ${p.bill_id}: ${(p.title as string ?? "").slice(0, 80)}`);
  }

  console.log(`\n=== Congress.gov: ${result.itemsFetched > 0 ? "PASS" : "FAIL"} ===`);
}

main().catch((err) => {
  console.error("Congress.gov test failed:", err);
  process.exit(1);
});
