import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@signal-map/logger";
import { getAdapter } from "../apps/worker/src/adapters/registry.js";
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await s.from("source_definitions").select("id, source_key, source_family, display_name, config").eq("source_key", "eia").single();
  if (!data) { console.log("Not found"); return; }
  const a = getAdapter("eia", data as any, s, createLogger("test"));
  const r = await a.sync();
  console.log("EIA: fetched=" + r.itemsFetched + " inserted=" + r.itemsInserted);
}
main().catch(e => console.error("EIA failed:", e.message));
