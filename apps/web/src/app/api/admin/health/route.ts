import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, AdminAuthError } from "@/lib/admin/audit";

export async function GET() {
  const supabase = await createClient();
  try {
    await requireAdmin(supabase);
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }

  // Source freshness counts
  const { data: healthRows } = await supabase.from("source_health").select("freshness");
  const sources = { fresh: 0, aging: 0, stale: 0, dead: 0 };
  for (const h of (healthRows ?? []) as Array<{ freshness: string }>) {
    const key = h.freshness as keyof typeof sources;
    if (key in sources) sources[key]++;
  }

  // Job counts by status
  const jobs = { pending: 0, running: 0, failed: 0, dead: 0 };
  for (const status of ["pending", "running", "failed", "dead"] as const) {
    const { count } = await supabase.from("job_queue").select("id", { count: "exact", head: true }).eq("status", status);
    jobs[status] = count ?? 0;
  }

  // Recent audit
  const { data: recentAudit } = await supabase
    .from("admin_audit_logs")
    .select("action, entity_type, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // Snapshot generation stats (last 24h)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: snapshotsCompleted } = await supabase
    .from("snapshot_generation_runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("created_at", dayAgo);
  const { count: snapshotsFailed } = await supabase
    .from("snapshot_generation_runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", dayAgo);

  // Active versions
  const { data: versions } = await supabase
    .from("version_registry")
    .select("component, version, is_active")
    .eq("is_active", true);

  return NextResponse.json({
    sources,
    jobs,
    snapshots_24h: { completed: snapshotsCompleted ?? 0, failed: snapshotsFailed ?? 0 },
    recent_audit: recentAudit ?? [],
    active_versions: versions ?? [],
  });
}
