"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Job { id: string; job_type: string; status: string; attempt_count: number; max_attempts: number; last_error_message: string | null; created_at: string; }

const statusColor: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800",
  claimed: "bg-yellow-100 text-yellow-800",
  running: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  dead: "bg-gray-100 text-gray-800",
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => { load(); }, [filter]);

  async function load() {
    const url = filter ? `/api/admin/jobs?status=${filter}` : "/api/admin/jobs";
    const res = await fetch(url);
    const data = (await res.json()) as { jobs: Job[] };
    setJobs(data.jobs);
  }

  async function retry(id: string) {
    await fetch(`/api/admin/jobs/${id}/retry`, { method: "POST" });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Job Queue</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {["", "pending", "running", "failed", "dead"].map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} className="rounded-full text-xs" onClick={() => setFilter(s)}>
            {s || "All"}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {jobs.map((j) => (
          <Card key={j.id} className="rounded-2xl">
            <CardContent className="p-4 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{j.job_type}</span>
                  <Badge variant="outline" className={`text-xs rounded-full ${statusColor[j.status] ?? ""}`}>
                    {j.status}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{j.attempt_count}/{j.max_attempts}</span>
                </div>
                {j.last_error_message && (
                  <p className="text-xs text-destructive mt-1 truncate max-w-lg">{j.last_error_message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{new Date(j.created_at).toLocaleString()}</p>
              </div>
              {(j.status === "failed" || j.status === "dead") && (
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => retry(j.id)}>
                  Retry
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {jobs.length === 0 && <p className="text-muted-foreground text-center py-8">No jobs matching filter.</p>}
      </div>
    </div>
  );
}
