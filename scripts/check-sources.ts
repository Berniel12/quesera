import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data } = await s
    .from("source_definitions")
    .select("source_key, cadence_seconds, scoring_eligible");
  console.log("Sources:", JSON.stringify(data, null, 2));

  const { data: health } = await s
    .from("source_health")
    .select("source_id, freshness");
  console.log("Health rows:", health?.length);
}

main().catch(console.error);
