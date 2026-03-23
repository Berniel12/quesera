import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAnswerState } from "@/lib/answer-state";
import { DirectionBadge } from "@/components/direction-badge";
import { FreshnessBadge } from "@/components/freshness-badge";
import { ConfidenceBar } from "@/components/confidence-bar";
import { DisagreementIndicator } from "@/components/disagreement-indicator";
import { SignalList } from "@/components/signal-list";
import { ConfidenceTimeline } from "@/components/confidence-timeline";
import { FollowButton } from "@/components/follow-button";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("id, canonical_name, description")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_public", true)
    .single();

  if (!topic) return { title: "Not Found" };
  const t = topic as { id: string; canonical_name: string; description: string | null };

  // Use question text for title when available
  const { data: wrappers } = await supabase
    .from("question_wrappers")
    .select("question_text")
    .eq("topic_id", t.id)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .limit(1);

  const questionText = (wrappers as Array<{ question_text: string }> | null)?.[0]?.question_text;
  const title = questionText ?? t.canonical_name;

  return {
    title: `${title} - QUESERA`,
    description: t.description ?? `Live signal intelligence for ${t.canonical_name}`,
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

  // 2. Load question wrappers for this topic
  const { data: wrapperData } = await supabase
    .from("question_wrappers")
    .select("question_text, is_featured, sort_order")
    .eq("topic_id", t.id)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(5);

  const wrappers = (wrapperData ?? []) as Array<{ question_text: string; is_featured: boolean; sort_order: number }>;
  const primaryQuestion = wrappers[0]?.question_text ?? null;

  // 3. Load latest snapshot
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

  // 4. Load signals
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

  // 5. Load history
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

  // 6. Check auth for follow button
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

  // Compute answer state
  const answerState = snapshot
    ? getAnswerState({
        direction: snapshot.direction,
        confidence: snapshot.confidence,
        category: t.category,
        disagreement: snapshot.disagreement,
      })
    : null;

  const hasProse = snapshot?.current_picture_text !== null && snapshot?.current_picture_text !== undefined;
  const structured = snapshot?.structured_data as {
    direction?: string;
    confidence?: number;
    signal_count?: number;
  } | null;

  // Headline: question text or canonical name
  const headline = primaryQuestion ?? t.canonical_name;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">

      {/* Question Hero */}
      <section className="mb-8 animate-slide-up">
        {t.category && (
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t.category}
          </span>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl leading-tight">
          {headline}
        </h1>

        {/* Answer state — the emotional hook */}
        {answerState && (
          <div className="mt-3 animate-fade-in delay-75">
            <span className={`text-xl sm:text-2xl font-semibold ${answerState.colorClass}`}>
              {answerState.label}
            </span>
            {answerState.intensity === "strong" && snapshot && (
              <span className="ml-3 text-sm text-muted-foreground font-mono">
                {Math.round(snapshot.confidence * 100)}% confidence
              </span>
            )}
          </div>
        )}

        {/* Subject name as subtle breadcrumb (when question is primary) */}
        {primaryQuestion && (
          <p className="mt-2 text-xs text-muted-foreground">
            Tracking: {t.canonical_name}
          </p>
        )}
      </section>

      {snapshot ? (
        <>
          {/* Signal Vitals */}
          <div className="flex flex-wrap items-center gap-3 mb-6 animate-slide-up delay-75">
            <DirectionBadge direction={snapshot.direction} size="md" />
            <ConfidenceBar confidence={snapshot.confidence} />
            <FreshnessBadge freshness={snapshot.freshness} />
            <DisagreementIndicator disagreement={snapshot.disagreement} />
          </div>

          {/* Current Picture */}
          <Card className="rounded-3xl border-border/40 mb-6 animate-scale-in delay-150">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Current Picture
              </h2>
              <p className="text-base sm:text-lg leading-relaxed text-foreground">
                {hasProse
                  ? snapshot.current_picture_text
                  : `Direction: ${snapshot.direction}. Confidence: ${Math.round(snapshot.confidence * 100)}%. Based on ${structured?.signal_count ?? 0} signals.`}
              </p>
            </CardContent>
          </Card>

          {/* What Changed / What to Watch */}
          <AnimateOnScroll>
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
          </AnimateOnScroll>

          {/* Top Signals */}
          {signals.length > 0 && (
            <AnimateOnScroll>
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
            </AnimateOnScroll>
          )}

          {/* Confidence Timeline */}
          {history.length >= 2 && (
            <AnimateOnScroll>
              <Card className="rounded-3xl border-border/40 mb-6">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    How This Answer Has Changed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ConfidenceTimeline history={history} />
                </CardContent>
              </Card>
            </AnimateOnScroll>
          )}

          {/* Other question framings */}
          {wrappers.length > 1 && (
            <AnimateOnScroll>
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  People also ask
                </h3>
                <div className="flex flex-wrap gap-2">
                  {wrappers.slice(1).map((w) => (
                    <span
                      key={w.question_text}
                      className="rounded-2xl border border-border/60 bg-card px-4 py-2 text-sm text-navy font-medium"
                    >
                      {w.question_text}
                    </span>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
          )}

          {/* Follow + Evidence */}
          <AnimateOnScroll>
            <div className="mt-4 flex items-center justify-center gap-4 pb-8">
              <EvidenceDrawer topicId={t.id} />
              <FollowButton
                topicSlug={t.slug}
                isAuthenticated={user !== null}
                initialFollowing={isFollowing}
              />
            </div>
          </AnimateOnScroll>
        </>
      ) : (
        <Card className="rounded-3xl border-border/40 animate-fade-in">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium text-navy mb-2">We&apos;re building this answer</p>
            <p className="text-sm text-muted-foreground">
              Signal analysis is being prepared. Check back shortly for a living answer.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
