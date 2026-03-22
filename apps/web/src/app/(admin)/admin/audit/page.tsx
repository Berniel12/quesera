"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { load(); }, [actionFilter, page]);

  async function load() {
    let url = `/api/admin/audit?page=${page}`;
    if (actionFilter) url += `&action=${actionFilter}`;
    const res = await fetch(url);
    const data = (await res.json()) as { audit_logs: AuditEntry[] };
    setEntries(data.audit_logs);
  }

  const actions = ["retry_job", "backfill_source", "enable_source", "disable_source", "rename_topic", "archive_topic", "merge_topic", "promote_candidate", "reject_candidate", "reprocess_request"];

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Audit Log</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant={actionFilter === "" ? "default" : "outline"} className="rounded-full text-xs" onClick={() => { setActionFilter(""); setPage(1); }}>All</Button>
        {actions.map((a) => (
          <Button key={a} variant={actionFilter === a ? "default" : "outline"} className="rounded-full text-xs" onClick={() => { setActionFilter(a); setPage(1); }}>
            {a.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {entries.map((e) => (
          <Card key={e.id} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium text-sm">{e.action.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground ml-2">{e.entity_type}</span>
                  {e.entity_id && <span className="font-mono text-xs text-muted-foreground ml-1">{e.entity_id.slice(0, 8)}...</span>}
                </div>
                <span className="font-mono text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              {(e.old_value || e.new_value) && (
                <div className="mt-2 text-xs font-mono text-muted-foreground">
                  {e.old_value && <div>old: {JSON.stringify(e.old_value).slice(0, 100)}</div>}
                  {e.new_value && <div>new: {JSON.stringify(e.new_value).slice(0, 100)}</div>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && <p className="text-muted-foreground text-center py-8">No audit entries.</p>}
      </div>

      <div className="flex justify-center gap-2 mt-6">
        <Button variant="outline" className="rounded-full text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground py-2">Page {page}</span>
        <Button variant="outline" className="rounded-full text-xs" onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
