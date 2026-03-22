import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
import type { SourceDefinitionRow } from "../apps/worker/src/adapters/base.js";

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const logger = createLogger("test-bls");
  const { data } = await s.from("source_definitions").select("id, source_key, source_family, display_name, config").eq("source_key", "bls").single();
  if (!data) { console.log("BLS not found"); return; }
  const a = getAdapter("bls", data as SourceDefinitionRow, s, logger);
  const r = await a.sync();
  console.log(`BLS: fetched=${r.itemsFetched} inserted=${r.itemsInserted}`);
}
main().catch((e) => console.error("BLS failed:", e.message));
