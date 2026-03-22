import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, AdminAuthError } from "@/lib/admin/audit";

export async function GET() {
  const supabase = await createClient();
  try { await requireAdmin(supabase); } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }

  const { data } = await supabase
    .from("source_definitions")
    .select("id, source_key, source_family, display_name, is_active, cadence_seconds, scoring_eligible")
    .order("source_key");

  // Join health data
  const sourceIds = ((data ?? []) as Array<{ id: string }>).map((s) => s.id);
  const { data: health } = await supabase
    .from("source_health")
    .select("source_id, freshness, last_success_at, last_failure_at, consecutive_failures, last_error_message, last_item_count")
    .in("source_id", sourceIds);

  const healthMap = new Map<string, Record<string, unknown>>();
  for (const h of (health ?? []) as Array<Record<string, unknown>>) {
    healthMap.set(h.source_id as string, h);
  }

  const sources = ((data ?? []) as Array<Record<string, unknown>>).map((s) => ({
    ...s,
    health: healthMap.get(s.id as string) ?? null,
  }));

  return NextResponse.json({ sources });
}
