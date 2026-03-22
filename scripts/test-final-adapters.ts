import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

const logger = createLogger("test-final");

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const key of ["eia", "metaculus"]) {
    const { data } = await s.from("source_definitions").select("id, source_key, source_family, display_name, config").eq("source_key", key).single();
    if (!data) { console.log(`${key}: not found`); continue; }

    console.log(`Testing ${key}...`);
    try {
      const a = getAdapter(key, data as SourceDefinitionRow, s, logger);
      const r = await a.sync();
      console.log(`  ${key}: fetched=${r.itemsFetched} inserted=${r.itemsInserted}`);
    } catch (err) {
      console.log(`  ${key} FAIL: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`);
    }
  }
}
main().catch((e) => console.error(e));
