"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Source {
  id: string;
  source_key: string;
  display_name: string;
  source_family: string;
  is_active: boolean;
  cadence_seconds: number;
  scoring_eligible: boolean;
  health: {
    freshness: string;
    last_success_at: string | null;
    consecutive_failures: number;
    last_error_message: string | null;
  } | null;
}

const freshnessColor: Record<string, string> = {
  fresh: "bg-green-100 text-green-800",
  aging: "bg-yellow-100 text-yellow-800",
  stale: "bg-orange-100 text-orange-800",
  dead: "bg-red-100 text-red-800",
};

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/admin/sources");
    const data = (await res.json()) as { sources: Source[] };
    setSources(data.sources);
  }

  async function retry(id: string) {
    await fetch(`/api/admin/sources/${id}/retry`, { method: "POST" });
    load();
  }

  async function toggle(id: string) {
    await fetch(`/api/admin/sources/${id}/toggle`, { method: "POST" });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Sources</h1>
      <div className="space-y-3">
        {sources.map((s) => (
          <Card key={s.id} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.display_name}</span>
                    <Badge variant="outline" className={`text-xs rounded-full ${freshnessColor[s.health?.freshness ?? ""] ?? ""}`}>
                      {s.health?.freshness ?? "unknown"}
                    </Badge>
                    {!s.is_active && <Badge variant="outline" className="text-xs rounded-full bg-gray-100">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.source_family} | {Math.round(s.cadence_seconds / 60)}m cadence
                    {s.health?.consecutive_failures ? ` | ${s.health.consecutive_failures} failures` : ""}
                  </p>
                  {s.health?.last_error_message && (
                    <p className="text-xs text-destructive mt-1 truncate max-w-md">{s.health.last_error_message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => retry(s.id)}>Retry</Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => toggle(s.id)}>
                    {s.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
