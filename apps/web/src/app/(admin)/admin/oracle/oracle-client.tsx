"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface OracleQuery {
  id: string;
  question_text: string;
  question_slug: string;
  matched_topic_id: string | null;
  matched_topic_name: string | null;
  status: string;
  llm_verdict: string | null;
  asked_count: number;
  subscriber_count: number;
  created_at: string;
}

type TabFilter = "all" | "answered" | "insufficient_data";

export default function OracleClient() {
  const [queries, setQueries] = useState<OracleQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQueries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/oracle");
      if (!res.ok) return;
      const data = await res.json() as { queries: OracleQuery[] };
      setQueries(data.queries);
    } catch {
      // Retry on next manual refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchQueries(); }, [fetchQueries]);

  const filtered = tab === "all" ? queries : queries.filter((q) => q.status === tab);

  async function handleRetrigger(queryId: string) {
    setActionLoading(queryId);
    try {
      await fetch(`/api/admin/oracle/${queryId}/retrigger`, { method: "POST" });
      await fetchQueries();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading oracle queries...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Oracle Queries</h1>
        <span className="text-sm text-muted-foreground">{queries.length} total</span>
      </div>

      {/* Tab filters */}
      <div className="flex gap-2 mb-4">
        {(["all", "answered", "insufficient_data"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "All" : t === "answered" ? "Answered" : "Unanswered"}
            <span className="ml-1.5 opacity-60">
              {t === "all" ? queries.length : queries.filter((q) => q.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Query table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Question</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Topic</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Asked</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Subs</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((q) => (
              <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <a
                    href={`/ask/${q.question_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {q.question_text}
                  </a>
                  {q.llm_verdict && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {q.llm_verdict}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={q.status === "answered" ? "default" : "secondary"}>
                    {q.status === "answered" ? "Answered" : "Pending"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {q.matched_topic_name ?? "--"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {q.asked_count}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {q.subscriber_count}
                </td>
                <td className="px-4 py-3 text-right">
                  {q.status === "insufficient_data" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetrigger(q.id)}
                      disabled={actionLoading === q.id}
                    >
                      {actionLoading === q.id ? "..." : "Retry match"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No oracle queries yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
