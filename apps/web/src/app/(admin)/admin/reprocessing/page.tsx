"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ReprocessingRequest {
  id: string;
  scope_type: string;
  status: string;
  jobs_enqueued_count: number;
  dry_run: boolean;
  request_notes: string | null;
  created_at: string;
}

export default function AdminReprocessingPage() {
  const [requests, setRequests] = useState<ReprocessingRequest[]>([]);
  const [scopeType, setScopeType] = useState("topic");
  const [scopeId, setScopeId] = useState("");
  const [triggers, setTriggers] = useState({ snapshot: true, summarization: false, matching: false });
  const [dryRun, setDryRun] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/admin/reprocessing");
    const data = (await res.json()) as { requests: ReprocessingRequest[] };
    setRequests(data.requests);
  }

  async function submit() {
    setSubmitting(true);
    const body: Record<string, unknown> = {
      scope_type: scopeType,
      trigger_snapshot_generation: triggers.snapshot,
      trigger_summarization: triggers.summarization,
      trigger_topic_matching: triggers.matching,
      dry_run: dryRun,
      request_notes: notes || undefined,
    };
    if (scopeType === "topic") body.topic_id = scopeId;
    if (scopeType === "source") body.source_id = scopeId;

    await fetch("/api/admin/reprocessing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    setScopeId("");
    setNotes("");
    load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Reprocessing</h1>

      <Card className="rounded-2xl mb-8">
        <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">New Request</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-sm block mb-1">Scope</span>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <option value="topic">Topic</option>
              <option value="source">Source</option>
            </select>
          </div>
          <Input value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder={`${scopeType} ID (UUID)`} className="rounded-full" />
          <div className="flex gap-4">
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={triggers.snapshot} onChange={(e) => setTriggers({...triggers, snapshot: e.target.checked})} /> Snapshot</label>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={triggers.summarization} onChange={(e) => setTriggers({...triggers, summarization: e.target.checked})} /> Summarization</label>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={triggers.matching} onChange={(e) => setTriggers({...triggers, matching: e.target.checked})} /> Matching</label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> Dry run</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="rounded-full" />
          <Button onClick={submit} disabled={submitting || !scopeId} className="rounded-full">{submitting ? "Submitting..." : "Create Request"}</Button>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-4">Recent Requests</h2>
      <div className="space-y-2">
        {requests.map((r) => (
          <Card key={r.id} className="rounded-2xl">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <span className="font-medium text-sm">{r.scope_type}</span>
                <Badge variant="outline" className="ml-2 text-xs rounded-full">{r.status}</Badge>
                {r.dry_run && <Badge variant="outline" className="ml-1 text-xs rounded-full bg-yellow-50">Dry Run</Badge>}
                <span className="text-xs text-muted-foreground ml-2">{r.jobs_enqueued_count} jobs</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
            </CardContent>
          </Card>
        ))}
        {requests.length === 0 && <p className="text-muted-foreground text-center py-8">No reprocessing requests yet.</p>}
      </div>
    </div>
  );
}
