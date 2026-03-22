import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Source health
  const { data: healthRows } = await supabase.from("source_health").select("freshness");
  const sources = { fresh: 0, aging: 0, stale: 0, dead: 0 };
  for (const h of (healthRows ?? []) as Array<{ freshness: string }>) {
    const key = h.freshness as keyof typeof sources;
    if (key in sources) sources[key]++;
  }

  // Job counts
  const jobs: Record<string, number> = {};
  for (const status of ["pending", "running", "failed", "dead"]) {
    const { count } = await supabase.from("job_queue").select("id", { count: "exact", head: true }).eq("status", status);
    jobs[status] = count ?? 0;
  }

  // Recent audit
  const { data: audit } = await supabase
    .from("admin_audit_logs")
    .select("action, entity_type, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // Versions
  const { data: versions } = await supabase
    .from("version_registry")
    .select("component, version, is_active")
    .eq("is_active", true);

  const navItems = [
    { href: "/admin/sources", label: "Sources" },
    { href: "/admin/topics", label: "Topics" },
    { href: "/admin/jobs", label: "Jobs" },
    { href: "/admin/reprocessing", label: "Reprocessing" },
    { href: "/admin/audit", label: "Audit Log" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Admin Dashboard</h1>

      <div className="flex flex-wrap gap-2 mb-8">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-secondary">
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="rounded-2xl"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Sources Fresh</p>
          <p className="text-2xl font-bold">{sources.fresh}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Sources Stale/Dead</p>
          <p className="text-2xl font-bold">{sources.stale + sources.dead}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Jobs Pending</p>
          <p className="text-2xl font-bold">{jobs.pending}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Jobs Failed/Dead</p>
          <p className="text-2xl font-bold">{(jobs.failed ?? 0) + (jobs.dead ?? 0)}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Active Versions</CardTitle></CardHeader>
          <CardContent>
            {((versions ?? []) as Array<{ component: string; version: string }>).map((v) => (
              <div key={v.component} className="flex justify-between py-1 text-sm">
                <span>{v.component}</span>
                <span className="font-mono text-muted-foreground">{v.version}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Recent Audit</CardTitle></CardHeader>
          <CardContent>
            {((audit ?? []) as Array<{ action: string; entity_type: string; created_at: string }>).map((a, i) => (
              <div key={i} className="flex justify-between py-1 text-sm">
                <span>{a.action} ({a.entity_type})</span>
                <span className="font-mono text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {(audit ?? []).length === 0 && <p className="text-sm text-muted-foreground">No audit entries yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
