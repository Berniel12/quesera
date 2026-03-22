import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

const logger = createLogger("test-fec");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: source } = await supabase
    .from("source_definitions")
    .select("id, source_key, source_family, display_name, config")
    .eq("source_key", "fec")
    .single();

  if (!source) {
    console.error("FEC source not found");
    process.exit(1);
  }

  console.log("Testing FEC adapter...");
  const adapter = getAdapter("fec", source as SourceDefinitionRow, supabase, logger);
  const result = await adapter.sync();

  console.log(`  fetched: ${result.itemsFetched}`);
  console.log(`  inserted: ${result.itemsInserted}`);

  console.log(`\n=== FEC: ${result.itemsFetched > 0 ? "PASS" : "FAIL"} ===`);
}

main().catch((err) => {
  console.error("FEC test failed:", err.message);
  process.exit(1);
});
