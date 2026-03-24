import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAnswerState } from "@/lib/answer-state";
import { SignalGroup } from "@/components/signal-card";
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

  // 4. Load signals (with metadata for rich display)
  let signals: Array<{
    source_name: string;
    source_family: string;
    signal_type: string;
    current_value: number;
    previous_value: number | null;
    delta: number | null;
    direction: string;
    freshness: string;
    weight: number;
    metadata: Record<string, unknown> | null;
  }> = [];

  if (snapshotId) {
    const { data: sigData } = await supabase
      .from("topic_signals")
      .select("source_name, source_family, signal_type, current_value, previous_value, delta, direction, freshness, weight, metadata")
      .eq("snapshot_id", snapshotId)
      .order("weight", { ascending: false })
      .limit(20);

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

  // Category images for visual header
  const CATEGORY_IMAGES: Record<string, string> = {
    macro: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=60&auto=format",
    crypto: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&q=60&auto=format",
    politics: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200&q=60&auto=format",
    geopolitics: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=60&auto=format",
    sports: "https://images.unsplash.com/photo-1461896836934-bd45ba416857?w=1200&q=60&auto=format",
    disasters: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=1200&q=60&auto=format",
    tech: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=60&auto=format",
    entertainment: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=60&auto=format",
  };
  const categoryImage = t.category ? CATEGORY_IMAGES[t.category] : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">

      {/* Category visual banner */}
      {categoryImage && (
        <div className="relative -mx-6 -mt-8 mb-8 h-32 sm:h-48 overflow-hidden rounded-b-3xl animate-fade-in">
          <img
            src={categoryImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover grayscale dark:brightness-[0.3]"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
        </div>
      )}

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

        {/* Answer state */}
        {answerState && (
          <div className="mt-3 animate-fade-in delay-75">
            <span className={`text-xl sm:text-2xl font-semibold ${answerState.colorClass}`}>
              {answerState.label}
            </span>
          </div>
        )}

      </section>

      {snapshot ? (
        <>
          {/* Current Picture — answer first, no system metrics */}
          <Card className="rounded-3xl border-border/40 mb-6 animate-scale-in delay-150">
            <CardContent className="p-6 sm:p-8">
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

          {/* Signal Intelligence — grouped by source family */}
          {signals.length > 0 && (() => {
            const grouped = new Map<string, typeof signals>();
            for (const s of signals) {
              const key = s.source_family ?? "unknown";
              const existing = grouped.get(key) ?? [];
              existing.push(s);
              grouped.set(key, existing);
            }
            // Order: prediction_market first, then macro, then others
            const ORDER = ["prediction_market", "macro_official", "crypto_market", "forecasting", "political_official", "hazard_weather", "news_evidence"];
            const sortedKeys = [...grouped.keys()].sort((a, b) => {
              const ai = ORDER.indexOf(a);
              const bi = ORDER.indexOf(b);
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });

            return (
              <AnimateOnScroll>
                <div className="mb-6">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">
                    Why we think this
                  </h2>
                  {sortedKeys.map((key) => (
                    <SignalGroup key={key} familyKey={key} signals={grouped.get(key) ?? []} />
                  ))}
                </div>
              </AnimateOnScroll>
            );
          })()}

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
