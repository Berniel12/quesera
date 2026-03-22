import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DirectionBadge } from "@/components/direction-badge";
import { FreshnessBadge } from "@/components/freshness-badge";
import { ConfidenceBar } from "@/components/confidence-bar";
import { DisagreementIndicator } from "@/components/disagreement-indicator";
import { SignalList } from "@/components/signal-list";
import { FollowButton } from "@/components/follow-button";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("canonical_name, description")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_public", true)
    .single();

  if (!topic) return { title: "Topic Not Found" };
  const t = topic as { canonical_name: string; description: string | null };

  return {
    title: `${t.canonical_name} - QUESERA`,
    description: t.description ?? `Signal intelligence for ${t.canonical_name}`,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // 1. Load topic
  const { data: topic } = await supabase
    .from("topics")
    .select("id, canonical_name, slug, category, description")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_public", true)
    .single();

  if (!topic) notFound();
  const t = topic as {
    id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    description: string | null;
  };

  // 2. Load latest snapshot
  const { data: latestPointer } = await supabase
    .from("topic_latest_snapshot")
    .select("snapshot_id")
    .eq("topic_id", t.id)
    .single();

  const snapshotId = (latestPointer as { snapshot_id: string } | null)?.snapshot_id;

  interface SnapshotView {
    direction: string;
    confidence: number;
    disagreement: number;
    freshness: string;
    staleness_seconds: number | null;
    current_picture_text: string | null;
    what_changed_text: string | null;
    what_next_text: string | null;
    structured_data: Record<string, unknown>;
    published_at: string;
    version: number;
  }

  let snapshot: SnapshotView | null = null;

  if (snapshotId) {
    const { data: snapData } = await supabase
      .from("topic_snapshots")
      .select("direction, confidence, disagreement, freshness, staleness_seconds, current_picture_text, what_changed_text, what_next_text, structured_data, published_at, version")
      .eq("id", snapshotId)
      .single();

    snapshot = snapData as SnapshotView | null;
  }

  // 3. Load signals
  let signals: Array<{
    source_name: string;
    signal_type: string;
    current_value: number;
    delta: number | null;
    direction: string;
    freshness: string;
  }> = [];

  if (snapshotId) {
    const { data: sigData } = await supabase
      .from("topic_signals")
      .select("source_name, signal_type, current_value, delta, direction, freshness, weight")
      .eq("snapshot_id", snapshotId)
      .order("weight", { ascending: false })
      .limit(10);

    signals = (sigData ?? []) as typeof signals;
  }

  // 4. Load historical snapshots
  let history: Array<{
    version: number;
    direction: string;
    confidence: number;
    published_at: string;
    current_picture_text: string | null;
  }> = [];

  const { data: histData } = await supabase
    .from("topic_snapshots")
    .select("version, direction, confidence, published_at, current_picture_text")
    .eq("topic_id", t.id)
    .order("version", { ascending: false })
    .limit(10);

  history = (histData ?? []) as typeof history;

  // Check auth for follow button (no mutation, just display)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isFollowing = false;
  if (user) {
    const { data: follow } = await supabase
      .from("user_followed_topics")
      .select("topic_id")
      .eq("user_id", user.id)
      .eq("topic_id", t.id)
      .maybeSingle();
    isFollowing = follow !== null;
  }

  // Determine prose or fallback
  const hasProse = snapshot?.current_picture_text !== null && snapshot?.current_picture_text !== undefined;
  const structured = snapshot?.structured_data as {
    direction?: string;
    confidence?: number;
    signal_count?: number;
    top_signals?: Array<{ source_family: string; signal_type: string; current_value: number; delta: number | null; direction: string }>;
  } | null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Topic Hero */}
      <section className="mb-8">
        {t.category && (
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t.category}
          </span>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          {t.canonical_name}
        </h1>
        {t.description && (
          <p className="mt-2 text-muted-foreground">{t.description}</p>
        )}
      </section>

      {snapshot ? (
        <>
          {/* Outcome Hero */}
          <Card className="rounded-3xl border-border/40 mb-6">
            <CardContent className="p-8">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <DirectionBadge direction={snapshot.direction} size="lg" />
                <ConfidenceBar confidence={snapshot.confidence} />
                <FreshnessBadge freshness={snapshot.freshness} />
                <DisagreementIndicator disagreement={snapshot.disagreement} />
              </div>

              <p className="text-xl font-medium leading-relaxed">
                {hasProse
                  ? snapshot.current_picture_text
                  : `Direction: ${snapshot.direction}. Confidence: ${Math.round(snapshot.confidence * 100)}%. Based on ${structured?.signal_count ?? 0} signals.`}
              </p>
            </CardContent>
          </Card>

          {/* What Changed */}
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <Card className="rounded-3xl border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  What Changed
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-sm leading-relaxed">
                  {snapshot.what_changed_text ?? "No material changes detected in recent signals."}
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
                  {snapshot.what_next_text ?? "Continue monitoring current signal sources for changes."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Signals */}
          {signals.length > 0 && (
            <Card className="rounded-3xl border-border/40 mb-6">
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

          {/* Timeline */}
          {history.length > 1 && (
            <Card className="rounded-3xl border-border/40">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.map((h) => (
                    <div
                      key={h.version}
                      className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <DirectionBadge direction={h.direction} size="sm" />
                        <span className="text-sm">
                          {h.current_picture_text
                            ? h.current_picture_text.slice(0, 80) + (h.current_picture_text.length > 80 ? "..." : "")
                            : `v${h.version}`}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(h.published_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evidence + Follow */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <EvidenceDrawer topicId={t.id} />
            <FollowButton
              topicSlug={t.slug}
              isAuthenticated={user !== null}
              initialFollowing={isFollowing}
            />
          </div>
        </>
      ) : (
        <Card className="rounded-3xl border-border/40">
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
