import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectionBadge } from "@/components/direction-badge";
import { ConfidenceBar } from "@/components/confidence-bar";
import { FreshnessBadge } from "@/components/freshness-badge";
import { SignalList } from "@/components/signal-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Load topic
  const { data: topic } = await supabase
    .from("topics")
    .select("id, canonical_name, slug, category, description")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!topic) notFound();
  const t = topic as {
    id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    description: string | null;
  };

  // Load latest snapshot
  const { data: latestPointer } = await supabase
    .from("topic_latest_snapshot")
    .select("snapshot_id")
    .eq("topic_id", t.id)
    .single();

  const snapshotId = (latestPointer as { snapshot_id: string } | null)?.snapshot_id;

  interface SnapshotView {
    id: string;
    direction: string;
    confidence: number;
    disagreement: number;
    freshness: string;
    current_picture_text: string | null;
    what_changed_text: string | null;
    what_next_text: string | null;
    structured_data: Record<string, unknown>;
  }

  let snapshot: SnapshotView | null = null;

  if (snapshotId) {
    const { data } = await supabase
      .from("topic_snapshots")
      .select("id, direction, confidence, disagreement, freshness, current_picture_text, what_changed_text, what_next_text, structured_data")
      .eq("id", snapshotId)
      .single();
    snapshot = data as SnapshotView | null;
  }

  // Load signals
  let signals: Array<{
    source_name: string;
    signal_type: string;
    current_value: number;
    delta: number | null;
    direction: string;
    freshness: string;
  }> = [];

  if (snapshotId) {
    const { data } = await supabase
      .from("topic_signals")
      .select("source_name, signal_type, current_value, delta, direction, freshness, weight")
      .eq("snapshot_id", snapshotId)
      .order("weight", { ascending: false })
      .limit(10);
    signals = (data ?? []) as typeof signals;
  }

  // Since-last-visit delta
  let sinceLastVisit: {
    hasChanges: boolean;
    priorDirection?: string;
    priorConfidence?: number;
  } = { hasChanges: false };

  const { data: seen } = await supabase
    .from("user_topic_seen_snapshots")
    .select("last_seen_snapshot_id")
    .eq("user_id", user.id)
    .eq("topic_id", t.id)
    .maybeSingle();

  const seenSnapId = (seen as { last_seen_snapshot_id: string } | null)?.last_seen_snapshot_id;

  if (seenSnapId && snapshotId && seenSnapId !== snapshotId) {
    const { data: priorSnap } = await supabase
      .from("topic_snapshots")
      .select("direction, confidence")
      .eq("id", seenSnapId)
      .single();

    if (priorSnap) {
      const p = priorSnap as { direction: string; confidence: number };
      sinceLastVisit = {
        hasChanges: true,
        priorDirection: p.direction,
        priorConfidence: p.confidence,
      };
    }
  }

  // Update seen snapshot (after page data loads successfully)
  if (snapshotId) {
    await supabase
      .from("user_topic_seen_snapshots")
      .upsert({
        user_id: user.id,
        topic_id: t.id,
        last_seen_snapshot_id: snapshotId,
      });
  }

  const snap = snapshot;

  return (
    <div className="max-w-4xl">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {t.category}
      </span>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy">
        {t.canonical_name}
      </h1>

      {snap ? (
        <>
          {sinceLastVisit.hasChanges && (
            <Card className="rounded-3xl border-warning/30 bg-warning/5 mt-6">
              <CardContent className="p-6">
                <h2 className="text-sm font-medium text-warning uppercase tracking-wide mb-2">
                  Since Your Last Visit
                </h2>
                <p className="text-sm">
                  Direction shifted from{" "}
                  <span className="font-medium">{sinceLastVisit.priorDirection}</span>{" "}
                  to <span className="font-medium">{snap.direction}</span>.
                  Confidence moved from{" "}
                  <span className="font-mono">{Math.round((sinceLastVisit.priorConfidence ?? 0) * 100)}%</span>{" "}
                  to <span className="font-mono">{Math.round(snap.confidence * 100)}%</span>.
                </p>
              </CardContent>
            </Card>
          )}
          <Card className="rounded-3xl border-border/40 mt-6 mb-6">
            <CardContent className="p-8">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <DirectionBadge direction={snap.direction} size="lg" />
                <ConfidenceBar confidence={snap.confidence} />
                <FreshnessBadge freshness={snap.freshness} />
              </div>
              <p className="text-xl font-medium leading-relaxed">
                {snap.current_picture_text ?? `Direction: ${snap.direction}. Confidence: ${Math.round(snap.confidence * 100)}%.`}
              </p>
            </CardContent>
          </Card>

          {/* What Changed / What Next */}
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <Card className="rounded-3xl border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  What Changed
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-sm leading-relaxed">
                  {snap.what_changed_text ?? "No material changes detected in recent signals."}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  What to Watch
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-sm leading-relaxed">
                  {snap.what_next_text ?? "Continue monitoring current signal sources for changes."}
                </p>
              </CardContent>
            </Card>
          </div>

          {signals.length > 0 && (
            <Card className="rounded-3xl border-border/40">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Top Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SignalList signals={signals} />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="rounded-3xl border-border/40 mt-6">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Signal analysis is being prepared for this topic. Check back shortly.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
