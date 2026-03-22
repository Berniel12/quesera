import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, AdminAuthError } from "@/lib/admin/audit";

export async function GET() {
  const supabase = await createClient();
  try { await requireAdmin(supabase); } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }

  const { data: topics } = await supabase
    .from("topics")
    .select("id, canonical_name, slug, category, status, is_seeded, created_at")
    .order("canonical_name");

  const { data: candidates } = await supabase
    .from("topic_candidates")
    .select("id, suggested_name, suggested_slug, category, support_count, status, match_scores, created_at")
    .in("status", ["pending", "requested"])
    .order("support_count", { ascending: false });

  return NextResponse.json({ topics: topics ?? [], candidates: candidates ?? [] });
}
