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
import Link from "next/link";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

// Human-readable source names
const SOURCE_LABELS: Record<string, string> = {
  fred: "Federal Reserve Economic Data",
  bls: "Bureau of Labor Statistics",
  eia: "Energy Information Administration",
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  metaculus: "Metaculus",
  manifold: "Manifold Markets",
  coingecko: "CoinGecko",
  usgs_earthquakes: "US Geological Survey",
  noaa_nws: "National Weather Service",
  congress_gov: "US Congress",
  polyrouter: "Prediction Markets",
  the_odds_api: "Bookmaker Consensus",
  metaforecast: "Forecaster Consensus",
  espn: "ESPN",
  defillama: "DeFi Llama",
};

// No hero images on question pages — answer-first design
// The answer IS the visual. No decorative stock photos.

// Category accent colors for key metric background
const CATEGORY_METRIC_BG: Record<string, string> = {
  macro: "from-navy/5 to-navy/[0.02] dark:from-[#00DAF3]/10 dark:to-[#00DAF3]/[0.03]",
  crypto: "from-[#00DAF3]/8 to-[#00DAF3]/[0.02] dark:from-[#00DAF3]/15 dark:to-[#00DAF3]/[0.03]",
  politics: "from-slate-500/5 to-slate-500/[0.01] dark:from-[#00DAF3]/10 dark:to-[#00DAF3]/[0.02]",
  geopolitics: "from-destructive/5 to-destructive/[0.01] dark:from-destructive/10 dark:to-destructive/[0.02]",
  sports: "from-positive/5 to-positive/[0.01] dark:from-[#4EDEA3]/10 dark:to-[#4EDEA3]/[0.02]",
  disasters: "from-warning/5 to-warning/[0.01] dark:from-warning/10 dark:to-warning/[0.02]",
  tech: "from-violet-500/5 to-violet-500/[0.01] dark:from-violet-400/10 dark:to-violet-400/[0.02]",
  entertainment: "from-pink-500/5 to-pink-500/[0.01] dark:from-pink-400/10 dark:to-pink-400/[0.02]",
};

function formatKeyMetric(signal: { source_family: string; signal_type: string; current_value: number; metadata: Record<string, unknown> | null }): { value: string; label: string } | null {
  if (signal.source_family === "macro_official") {
    const v = signal.current_value;
    const seriesId = String(signal.metadata?.series_id ?? "");
    const labels: Record<string, string> = {
      MORTGAGE30US: "30-year fixed mortgage rate",
      FEDFUNDS: "Federal funds rate",
      UNRATE: "Unemployment rate",
      CPIAUCSL: "Consumer price index",
      DGS10: "10-year Treasury yield",
      GDP: "GDP (billions)",
      "PET.RWTC.W": "Crude oil price per barrel",
    };
    const label = labels[seriesId] ?? String(signal.metadata?.series_id ?? "Key indicator");
    return { value: v > 100 ? v.toLocaleString("en-US") : `${v.toFixed(2)}%`, label };
  }
  if (signal.source_family === "crypto_market") {
    const price = signal.current_value;
    return { value: price >= 1 ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${price.toFixed(4)}`, label: String(signal.metadata?.name ?? "Price") };
  }
  if (signal.signal_type === "market_probability" || signal.signal_type === "forecast_probability" || signal.signal_type === "odds_probability") {
    return { value: `${Math.round(signal.current_value * 100)}%`, label: "Market probability" };
  }
  if (signal.signal_type === "earthquake_magnitude") {
    return { value: `M${signal.current_value.toFixed(1)}`, label: "Strongest recent earthquake" };
  }
  return null;
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

  const { data: wrappers } = await supabase
    .from("question_wrappers")
    .select("question_text")
    .eq("topic_id", t.id)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .limit(1);

  const questionText = (wrappers as Array<{ question_text: string }> | null)?.[0]?.question_text;
  return {
    title: `${questionText ?? t.canonical_name} - QUESERA`,
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
  const t = topic as { id: string; canonical_name: string; slug: string; category: string | null; description: string | null };

  // 2. Load question wrappers
  const { data: wrapperData } = await supabase
    .from("question_wrappers")
    .select("question_text, is_featured, sort_order")
    .eq("topic_id", t.id)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(5);

  const wrappers = (wrapperData ?? []) as Array<{ question_text: string; is_featured: boolean; sort_order: number }>;
  const primaryQuestion = wrappers[0]?.question_text ?? null;
  const headline = primaryQuestion ?? t.canonical_name;

  // 3. Load latest snapshot
  const { data: latestPointer } = await supabase
    .from("topic_latest_snapshot")
    .select("snapshot_id")
    .eq("topic_id", t.id)
    .single();

  const snapshotId = (latestPointer as { snapshot_id: string } | null)?.snapshot_id;

  interface SnapshotView {
    direction: string; confidence: number; disagreement: number; freshness: string;
    staleness_seconds: number | null; current_picture_text: string | null;
    what_changed_text: string | null; what_next_text: string | null;
    structured_data: Record<string, unknown>; published_at: string; version: number;
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

  // 4. Load previous snapshot for "what changed" delta
  let prevSnapshot: { direction: string; confidence: number } | null = null;
  const { data: prevArr } = await supabase
    .from("topic_snapshots")
    .select("direction, confidence")
    .eq("topic_id", t.id)
    .order("version", { ascending: false })
    .range(1, 1)
    .limit(1);
  if (prevArr && prevArr.length > 0) {
    const p = prevArr[0] as { direction: string; confidence: number };
    prevSnapshot = p;
  }

  // 5. Load signals
  let signals: Array<{
    source_name: string; source_family: string; signal_type: string;
    current_value: number; previous_value: number | null; delta: number | null;
    direction: string; freshness: string; weight: number; metadata: Record<string, unknown> | null;
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

  // 6. Load history
  const { data: histData } = await supabase
    .from("topic_snapshots")
    .select("version, direction, confidence, published_at, current_picture_text")
    .eq("topic_id", t.id)
    .order("version", { ascending: false })
    .limit(10);
  const history = (histData ?? []) as Array<{ version: number; direction: string; confidence: number; published_at: string; current_picture_text: string | null }>;

  // 7. Load related questions (same category, different topic)
  let relatedQuestions: Array<{ question_text: string; slug: string; direction: string | null; confidence: number | null }> = [];
  if (t.category) {
    const { data: related } = await supabase
      .from("question_wrappers")
      .select("question_text, topics!inner(slug, category, status, is_public)")
      .eq("is_featured", true)
      .neq("topic_id", t.id)
      .order("sort_order", { ascending: true })
      .limit(20);

    const { data: relatedCards } = await supabase
      .from("public_topic_cards")
      .select("slug, direction, confidence, freshness");
    const cardMap = new Map((relatedCards ?? []).map((c: { slug: string; direction: string | null; confidence: number | null; freshness: string | null }) => [c.slug, c]));

    for (const r of related ?? []) {
      const rt = r as unknown as { question_text: string; topics: Array<{ slug: string; category: string | null; status: string; is_public: boolean }> | { slug: string; category: string | null; status: string; is_public: boolean } };
      const rtopic = Array.isArray(rt.topics) ? rt.topics[0] : rt.topics;
      if (!rtopic || rtopic.category !== t.category || rtopic.status !== "active" || !rtopic.is_public) continue;
      const card = cardMap.get(rtopic.slug);
      if (!card || card.freshness === "dead" || card.freshness === "stale") continue;
      relatedQuestions.push({
        question_text: rt.question_text,
        slug: rtopic.slug,
        direction: card.direction,
        confidence: card.confidence,
      });
      if (relatedQuestions.length >= 4) break;
    }
  }

  // 8. Load evidence preview (2-3 items)
  let evidencePreview: Array<{ title: string; source: string; date: string }> = [];
  if (t.id) {
    const { data: evidence } = await supabase
      .from("source_item_topic_matches")
      .select("source_items!inner(source_key, normalized_payload, last_seen_at)")
      .eq("topic_id", t.id)
      .order("match_score", { ascending: false })
      .limit(3);

    for (const e of evidence ?? []) {
      const ei = e as unknown as { source_items: { source_key: string; normalized_payload: Record<string, unknown>; last_seen_at: string } };
      const item = Array.isArray(ei.source_items) ? ei.source_items[0] : ei.source_items;
      if (!item) continue;
      const payload = item.normalized_payload;
      const title = String(payload.title ?? payload.question ?? payload.headline ?? payload.name ?? "");
      if (!title) continue;
      const age = item.last_seen_at ? Math.round((Date.now() - new Date(item.last_seen_at).getTime()) / 3600000) : null;
      evidencePreview.push({
        title: title.slice(0, 100),
        source: SOURCE_LABELS[item.source_key] ?? item.source_key,
        date: age !== null ? (age < 1 ? "Just now" : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`) : "",
      });
    }
  }

  // 9. Auth for follow button
  const { data: { user } } = await supabase.auth.getUser();
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
  const answerState = snapshot ? getAnswerState({ direction: snapshot.direction, confidence: snapshot.confidence, category: t.category, disagreement: snapshot.disagreement }) : null;
  const hasProse = snapshot?.current_picture_text != null;

  // Key metric from primary signal
  const primarySignal = signals[0];
  const keyMetric = primarySignal ? formatKeyMetric(primarySignal) : null;

  // What changed delta
  let changeText: string | null = null;
  if (snapshot && prevSnapshot) {
    if (snapshot.direction !== prevSnapshot.direction) {
      const prevAnswer = getAnswerState({ direction: prevSnapshot.direction, confidence: prevSnapshot.confidence, category: t.category, disagreement: 0 });
      changeText = `Answer shifted from "${prevAnswer.label}" to "${answerState?.label}"`;
    } else {
      const confDelta = Math.abs(snapshot.confidence - prevSnapshot.confidence);
      if (confDelta > 0.1) {
        changeText = `Confidence ${snapshot.confidence > prevSnapshot.confidence ? "increased" : "decreased"} since last update`;
      }
    }
  }

  // Timeline narrative
  let timelineNarrative: string | null = null;
  if (history.length >= 2) {
    const recent = history.slice(0, 5);
    const allSame = recent.every((h) => h.direction === recent[0].direction);
    if (allSame) {
      timelineNarrative = `The answer has been consistent for the last ${recent.length} updates.`;
    } else {
      timelineNarrative = `The outlook has shifted between updates recently.`;
    }
  }

  const metricBg = t.category ? (CATEGORY_METRIC_BG[t.category] ?? "from-muted to-transparent dark:from-primary/10 dark:to-transparent") : "from-muted to-transparent";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">

      {/* ── ANSWER FIRST: Question + Verdict + Follow — no hero image bloat ── */}
      <section className="mb-6 pt-2 animate-slide-up">
        {t.category && (
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.category}</span>
        )}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl leading-tight">{headline}</h1>
        {t.description && (
          <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
        )}

        {answerState && (
          <div className="mt-4 flex items-center gap-4 flex-wrap animate-fade-in delay-75">
            <span className={`text-3xl sm:text-4xl font-black ${answerState.colorClass}`}>{answerState.label}</span>
            <FollowButton topicSlug={t.slug} isAuthenticated={user !== null} initialFollowing={isFollowing} />
          </div>
        )}

        {/* One-sentence explanation right under the verdict */}
        {hasProse && snapshot?.current_picture_text && (
          <p className="mt-3 text-base text-foreground leading-relaxed animate-fade-in delay-150">
            {snapshot.current_picture_text}
          </p>
        )}

        {/* What changed delta */}
        {changeText && (
          <p className="mt-2 text-sm font-medium text-muted-foreground animate-fade-in delay-200">{changeText}</p>
        )}
        {!changeText && snapshot && (
          <p className="mt-2 text-xs text-muted-foreground/60 animate-fade-in delay-200">No change since last update</p>
        )}

        {snapshot?.published_at && (
          <p className="text-xs text-muted-foreground/60 mt-1">
            Updated {(() => {
              const mins = Math.round((Date.now() - new Date(snapshot.published_at).getTime()) / 60000);
              if (mins < 60) return `${mins} minutes ago`;
              const hours = Math.round(mins / 60);
              if (hours < 24) return `${hours} hours ago`;
              return `${Math.round(hours / 24)} days ago`;
            })()}
          </p>
        )}
      </section>

      {snapshot ? (
        <>
          {/* ── KEY METRIC — with context ── */}
          {keyMetric && (
            <div className="mb-6 animate-scale-in delay-150">
              <div className={`flex items-center gap-4 py-4 px-5 rounded-2xl bg-gradient-to-br ${metricBg} border border-border/30 dark:border-white/5`}>
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground dark:text-primary metric-glow">{keyMetric.value}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{keyMetric.label}</span>
                  {primarySignal && primarySignal.delta !== null && Math.abs(primarySignal.delta) > 0.001 && (
                    <span className={`text-xs font-semibold ${primarySignal.delta > 0 ? "text-positive dark:text-[#4EDEA3]" : "text-destructive"}`}>
                      {primarySignal.delta > 0 ? "+" : "-"}{Math.abs(primarySignal.delta).toFixed(2)} since last update
                    </span>
                  )}
                  {primarySignal && (primarySignal.delta === null || Math.abs(primarySignal.delta) <= 0.001) && (
                    <span className="text-xs text-muted-foreground">Holding steady</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Section divider ── */}
          <div className="section-line mb-6" />

          {/* ── WHAT CHANGED / WHAT TO WATCH — only if LLM prose exists ── */}
          {(snapshot.what_changed_text || snapshot.what_next_text) && (
            <AnimateOnScroll>
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                {snapshot.what_changed_text && (
                  <Card className="rounded-2xl border-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">What Changed</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-5">
                      <p className="text-sm leading-relaxed text-foreground">{snapshot.what_changed_text}</p>
                    </CardContent>
                  </Card>
                )}
                {snapshot.what_next_text && (
                  <Card className="rounded-2xl border-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">What to Watch</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-5">
                      <p className="text-sm leading-relaxed text-foreground">{snapshot.what_next_text}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </AnimateOnScroll>
          )}

          {/* ── WHY WE THINK THIS — Signals ── */}
          {signals.length > 0 && (() => {
            const grouped = new Map<string, typeof signals>();
            for (const s of signals) {
              const key = s.source_family ?? "unknown";
              const existing = grouped.get(key) ?? [];
              existing.push(s);
              grouped.set(key, existing);
            }
            const ORDER = ["prediction_market", "macro_official", "crypto_market", "forecasting", "political_official", "hazard_weather", "news_evidence", "sports_odds", "defi_signal"];
            const sortedKeys = [...grouped.keys()].sort((a, b) => {
              const ai = ORDER.indexOf(a); const bi = ORDER.indexOf(b);
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });
            return (
              <AnimateOnScroll>
                <div className="section-line mb-6" />
                <div className="mb-6">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">What the data shows</h2>
                  {sortedKeys.map((key) => (
                    <SignalGroup key={key} familyKey={key} signals={grouped.get(key) ?? []} />
                  ))}
                </div>
              </AnimateOnScroll>
            );
          })()}

          {/* ── EVIDENCE PREVIEW ── */}
          {evidencePreview.length > 0 && (
            <AnimateOnScroll>
              <div className="mb-6">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Recent evidence</h2>
                <div className="space-y-2">
                  {evidencePreview.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card dark:border dark:border-white/5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-[#00DAF3] mt-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground leading-snug">{ev.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{ev.source}{ev.date ? ` \u00b7 ${ev.date}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <EvidenceDrawer topicId={t.id} />
                </div>
              </div>
            </AnimateOnScroll>
          )}

          {/* ── CONFIDENCE TIMELINE ── */}
          {history.length >= 2 && (
            <AnimateOnScroll>
              <Card className="rounded-3xl border-border/40 mb-6">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">How this answer has changed</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConfidenceTimeline history={history} />
                  {timelineNarrative && (
                    <p className="text-xs text-muted-foreground mt-3">{timelineNarrative}</p>
                  )}
                </CardContent>
              </Card>
            </AnimateOnScroll>
          )}

          {/* ── PEOPLE ALSO WONDERING ── */}
          {relatedQuestions.length > 0 && (
            <AnimateOnScroll>
              <div className="section-line mb-6" />
              <div className="mb-8">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">People also wondering</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatedQuestions.map((rq) => {
                    const rqState = rq.direction && rq.confidence !== null
                      ? getAnswerState({ direction: rq.direction, confidence: rq.confidence, category: t.category, disagreement: 0 })
                      : null;
                    return (
                      <Link key={rq.slug} href={`/topics/${rq.slug}`}>
                        <div className="p-4 rounded-2xl bg-card dark:border dark:border-white/5 hover-lift-sm">
                          <p className="text-sm font-semibold text-foreground leading-snug">{rq.question_text}</p>
                          {rqState && (
                            <p className={`text-xs font-bold mt-1.5 ${rqState.colorClass}`}>{rqState.label}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </AnimateOnScroll>
          )}

          {/* ── ASK A FOLLOW-UP ── */}
          <AnimateOnScroll>
            <div className="mb-8 p-6 rounded-2xl bg-card dark:border dark:border-white/5 text-center">
              <p className="text-sm font-medium text-foreground mb-3">Have a different question about this topic?</p>
              <Link
                href={`/search`}
                className="inline-flex h-10 items-center rounded-full bg-secondary dark:bg-[#222A3E] px-6 text-sm text-foreground hover:bg-secondary/80 transition-colors"
              >
                Ask a question
              </Link>
            </div>
          </AnimateOnScroll>
        </>
      ) : (
        <Card className="rounded-3xl border-border/40 animate-fade-in">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium text-foreground mb-2">We&apos;re building this answer</p>
            <p className="text-sm text-muted-foreground">Signal analysis is being prepared. Check back shortly for a living answer.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
