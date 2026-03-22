"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Topic { id: string; canonical_name: string; slug: string; category: string | null; status: string; }
interface Candidate { id: string; suggested_name: string; suggested_slug: string; category: string | null; support_count: number; status: string; }

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tab, setTab] = useState<"active" | "candidates">("active");

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/admin/topics");
    const data = (await res.json()) as { topics: Topic[]; candidates: Candidate[] };
    setTopics(data.topics);
    setCandidates(data.candidates);
  }

  async function archiveTopic(id: string) {
    await fetch(`/api/admin/topics/${id}/archive`, { method: "POST" });
    load();
  }

  async function renameTopic(id: string) {
    const name = prompt("New canonical name:");
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    await fetch(`/api/admin/topics/${id}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonical_name: name, slug }),
    });
    load();
  }

  async function mergeTopic(id: string) {
    const targetId = prompt("Target topic ID to merge into:");
    if (!targetId) return;
    await fetch(`/api/admin/topics/${id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_topic_id: targetId }),
    });
    load();
  }

  async function promote(id: string, c: Candidate) {
    await fetch(`/api/admin/topics/candidates/${id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonical_name: c.suggested_name, slug: c.suggested_slug, category: c.category }),
    });
    load();
  }

  async function reject(id: string) {
    await fetch(`/api/admin/topics/candidates/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_notes: "Rejected from admin console" }),
    });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Topics</h1>

      <div className="flex gap-2 mb-6">
        <Button variant={tab === "active" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("active")}>
          Active ({topics.filter((t) => t.status === "active").length})
        </Button>
        <Button variant={tab === "candidates" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("candidates")}>
          Candidates ({candidates.length})
        </Button>
      </div>

      {tab === "active" && (
        <div className="space-y-2">
          {topics.filter((t) => t.status === "active").map((t) => (
            <Card key={t.id} className="rounded-2xl">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <span className="font-medium">{t.canonical_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{t.category} | /{t.slug}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => renameTopic(t.id)}>Rename</Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => mergeTopic(t.id)}>Merge</Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => archiveTopic(t.id)}>Archive</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "candidates" && (
        <div className="space-y-2">
          {candidates.map((c) => (
            <Card key={c.id} className="rounded-2xl">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <span className="font-medium">{c.suggested_name}</span>
                  <Badge variant="outline" className="ml-2 text-xs rounded-full">{c.status}</Badge>
                  <span className="text-xs text-muted-foreground ml-2">support: {c.support_count}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-full text-xs" onClick={() => promote(c.id, c)}>Promote</Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => reject(c.id)}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {candidates.length === 0 && <p className="text-muted-foreground text-center py-8">No pending candidates.</p>}
        </div>
      )}
    </div>
  );
}
