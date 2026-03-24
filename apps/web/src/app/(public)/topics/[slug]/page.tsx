import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAnswerState } from "@/lib/answer-state";
import { SignalGroup } from "@/components/signal-card";
import { ConfidenceTimeline } from "@/components/confidence-timeline";
import { FollowButton } from "@/components/follow-button";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import Link from "next/link";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

const SOURCE_LABELS: Record<string, string> = {
  fred: "Federal Reserve Economic Data", bls: "Bureau of Labor Statistics",
  eia: "Energy Information Administration", polymarket: "Polymarket",
  kalshi: "Kalshi", metaculus: "Metaculus", manifold: "Manifold Markets",
  coingecko: "CoinGecko", usgs_earthquakes: "US Geological Survey",
  noaa_nws: "National Weather Service", congress_gov: "US Congress",
  polyrouter: "Prediction Markets", the_odds_api: "Bookmaker Consensus",
  metaforecast: "Forecaster Consensus", espn: "ESPN", defillama: "DeFi Llama",
};

// Category visual config
const CAT_STYLE: Record<string, { accent: string; border: string; bg: string }> = {
  macro:         { accent: "text-blue-600 dark:text-blue-400",    border: "border-blue-500/20",    bg: "from-blue-500/5 to-transparent dark:from-blue-500/10 dark:to-transparent" },
  crypto:        { accent: "text-amber-600 dark:text-amber-400",  border: "border-amber-500/20",   bg: "from-amber-500/5 to-transparent dark:from-amber-500/10 dark:to-transparent" },
  politics:      { accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20", bg: "from-indigo-500/5 to-transparent dark:from-indigo-500/10 dark:to-transparent" },
  geopolitics:   { accent: "text-red-600 dark:text-red-400",      border: "border-red-500/20",     bg: "from-red-500/5 to-transparent dark:from-red-500/10 dark:to-transparent" },
  sports:        { accent: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", bg: "from-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:to-transparent" },
  disasters:     { accent: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20",  bg: "from-orange-500/5 to-transparent dark:from-orange-500/10 dark:to-transparent" },
  tech:          { accent: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20",  bg: "from-violet-500/5 to-transparent dark:from-violet-500/10 dark:to-transparent" },
  entertainment: { accent: "text-pink-600 dark:text-pink-400",    border: "border-pink-500/20",    bg: "from-pink-500/5 to-transparent dark:from-pink-500/10 dark:to-transparent" },
};
const DEFAULT_STYLE = { accent: "text-muted-foreground", border: "border-border/20", bg: "from-muted/10 to-transparent" };

function formatKeyMetric(signal: { source_family: string; signal_type: string; current_value: number; metadata: Record<string, unknown> | null }): { value: string; label: string; context: string } | null {
  if (signal.source_family === "macro_official") {
    const v = signal.current_value;
    const seriesId = String(signal.metadata?.series_id ?? "");
    const info: Record<string, { label: string; context: string }> = {
      MORTGAGE30US: { label: "30-year fixed mortgage rate", context: "This is the benchmark rate most homebuyers pay. Changes here directly affect monthly payments." },
      FEDFUNDS: { label: "Federal funds rate", context: "The rate banks charge each other overnight. It influences everything from savings accounts to mortgage rates." },
      UNRATE: { label: "Unemployment rate", context: "The percentage of people actively looking for work who can't find it. A key indicator of economic health." },
      CPIAUCSL: { label: "Consumer price index", context: "Measures the average change in prices consumers pay. When this rises, your groceries and gas cost more." },
      DGS10: { label: "10-year Treasury yield", context: "The return on a 10-year government bond. It's a barometer for investor confidence in the economy." },
      GDP: { label: "GDP (billions)", context: "The total value of everything produced in the US. Two consecutive quarters of decline signals a recession." },
      "PET.RWTC.W": { label: "Crude oil price per barrel", context: "The global benchmark for oil. Spikes here show up at the gas pump within days." },
      SP500: { label: "S&P 500", context: "Tracks the 500 largest US companies. It's the single best measure of how the stock market is doing." },
      GOLDAMGBD228NLBM: { label: "Gold price (per troy oz)", context: "Gold tends to rise when investors are nervous. It's a classic safe-haven asset." },
      GASREGW: { label: "Regular gas price (per gallon)", context: "The national average price at the pump. This is what most Americans pay to fill up." },
      UMCSENT: { label: "Consumer confidence index", context: "Measures how optimistic people feel about the economy. When it drops, spending usually follows." },
    };
    const entry = info[seriesId];
    if (!entry) return null;
    return { value: v > 100 ? v.toLocaleString("en-US") : `${v.toFixed(2)}%`, label: entry.label, context: entry.context };
  }
  if (signal.source_family === "crypto_market") {
    const price = signal.current_value;
    const name = String(signal.metadata?.name ?? "This asset");
    return {
      value: price >= 1 ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${price.toFixed(4)}`,
      label: name,
      context: `Current trading price across major exchanges. This updates continuously as markets move.`,
    };
  }
  if (signal.signal_type === "market_probability" || signal.signal_type === "forecast_probability") {
    const pct = Math.round(signal.current_value * 100);
    return { value: `${pct}%`, label: "Market probability", context: `This is what prediction markets think. ${pct}% of bets are on "yes." Real money is behind this number.` };
  }
  if (signal.signal_type === "earthquake_magnitude") {
    return { value: `M${signal.current_value.toFixed(1)}`, label: "Strongest recent earthquake", context: "Magnitude measures energy released. Each whole number is about 32x more energy than the one below it." };
  }
  return null;
}

function timeAgo(dateStr: string): string {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("id, canonical_name, description").eq("slug", slug).eq("status", "active").eq("is_public", true).single();
  if (!topic) return { title: "Not Found" };
  const t = topic as { id: string; canonical_name: string; description: string | null };
  const { data: wrappers } = await supabase.from("question_wrappers").select("question_text").eq("topic_id", t.id).eq("is_featured", true).order("sort_order", { ascending: true }).limit(1);
  const questionText = (wrappers as Array<{ question_text: string }> | null)?.[0]?.question_text;
  return { title: `${questionText ?? t.canonical_name} - QUESERA`, description: t.description ?? `Live signal intelligence for ${t.canonical_name}` };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase.from("topics").select("id, canonical_name, slug, category, description").eq("slug", slug).eq("status", "active").eq("is_public", true).single();
  if (!topic) notFound();
  const t = topic as { id: string; canonical_name: string; slug: string; category: string | null; description: string | null };
  const cat = t.category ? (CAT_STYLE[t.category] ?? DEFAULT_STYLE) : DEFAULT_STYLE;

  const { data: wrapperData } = await supabase.from("question_wrappers").select("question_text, is_featured, sort_order").eq("topic_id", t.id).order("is_featured", { ascending: false }).order("sort_order", { ascending: true }).limit(5);
  const wrappers = (wrapperData ?? []) as Array<{ question_text: string; is_featured: boolean; sort_order: number }>;
  const headline = wrappers[0]?.question_text ?? t.canonical_name;

  const { data: latestPointer } = await supabase.from("topic_latest_snapshot").select("snapshot_id").eq("topic_id", t.id).single();
  const snapshotId = (latestPointer as { snapshot_id: string } | null)?.snapshot_id;

  interface SnapshotView {
    direction: string; confidence: number; disagreement: number; freshness: string;
    staleness_seconds: number | null; current_picture_text: string | null;
    what_changed_text: string | null; what_next_text: string | null;
    structured_data: Record<string, unknown>; published_at: string; version: number;
  }
  let snapshot: SnapshotView | null = null;
  if (snapshotId) {
    const { data: snapData } = await supabase.from("topic_snapshots").select("direction, confidence, disagreement, freshness, staleness_seconds, current_picture_text, what_changed_text, what_next_text, structured_data, published_at, version").eq("id", snapshotId).single();
    snapshot = snapData as SnapshotView | null;
  }

  let prevSnapshot: { direction: string; confidence: number } | null = null;
  const { data: prevArr } = await supabase.from("topic_snapshots").select("direction, confidence").eq("topic_id", t.id).order("version", { ascending: false }).range(1, 1).limit(1);
  if (prevArr && prevArr.length > 0) prevSnapshot = prevArr[0] as { direction: string; confidence: number };

  let signals: Array<{ source_name: string; source_family: string; signal_type: string; current_value: number; previous_value: number | null; delta: number | null; direction: string; freshness: string; weight: number; metadata: Record<string, unknown> | null }> = [];
  if (snapshotId) {
    const { data: sigData } = await supabase.from("topic_signals").select("source_name, source_family, signal_type, current_value, previous_value, delta, direction, freshness, weight, metadata").eq("snapshot_id", snapshotId).order("weight", { ascending: false }).limit(20);
    signals = (sigData ?? []) as typeof signals;
  }

  const { data: histData } = await supabase.from("topic_snapshots").select("version, direction, confidence, published_at, current_picture_text").eq("topic_id", t.id).order("version", { ascending: false }).limit(10);
  const history = (histData ?? []) as Array<{ version: number; direction: string; confidence: number; published_at: string; current_picture_text: string | null }>;

  let relatedQuestions: Array<{ question_text: string; slug: string; direction: string | null; confidence: number | null }> = [];
  if (t.category) {
    const { data: related } = await supabase.from("question_wrappers").select("question_text, topics!inner(slug, category, status, is_public)").eq("is_featured", true).neq("topic_id", t.id).order("sort_order", { ascending: true }).limit(20);
    const { data: relatedCards } = await supabase.from("public_topic_cards").select("slug, direction, confidence, freshness");
    const cardMap = new Map((relatedCards ?? []).map((c: { slug: string; direction: string | null; confidence: number | null; freshness: string | null }) => [c.slug, c]));
    for (const r of related ?? []) {
      const rt = r as unknown as { question_text: string; topics: Array<{ slug: string; category: string | null; status: string; is_public: boolean }> | { slug: string; category: string | null; status: string; is_public: boolean } };
      const rtopic = Array.isArray(rt.topics) ? rt.topics[0] : rt.topics;
      if (!rtopic || rtopic.category !== t.category || rtopic.status !== "active" || !rtopic.is_public) continue;
      const card = cardMap.get(rtopic.slug);
      if (!card) continue;
      relatedQuestions.push({ question_text: rt.question_text, slug: rtopic.slug, direction: card.direction, confidence: card.confidence });
      if (relatedQuestions.length >= 4) break;
    }
  }

  let evidencePreview: Array<{ title: string; source: string; date: string }> = [];
  if (t.id) {
    const { data: evidence } = await supabase.from("source_item_topic_matches").select("source_items!inner(source_key, normalized_payload, last_seen_at)").eq("topic_id", t.id).order("match_score", { ascending: false }).limit(5);
    for (const e of evidence ?? []) {
      const ei = e as unknown as { source_items: { source_key: string; normalized_payload: Record<string, unknown>; last_seen_at: string } };
      const item = Array.isArray(ei.source_items) ? ei.source_items[0] : ei.source_items;
      if (!item) continue;
      const payload = item.normalized_payload;
      const title = String(payload.title ?? payload.question ?? payload.headline ?? payload.name ?? "");
      if (!title) continue;
      const age = item.last_seen_at ? Math.round((Date.now() - new Date(item.last_seen_at).getTime()) / 3600000) : null;
      evidencePreview.push({ title: title.slice(0, 120), source: SOURCE_LABELS[item.source_key] ?? item.source_key, date: age !== null ? (age < 1 ? "Just now" : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`) : "" });
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  let isFollowing = false;
  if (user) {
    const { data: follow } = await supabase.from("user_followed_topics").select("topic_id").eq("user_id", user.id).eq("topic_id", t.id).maybeSingle();
    isFollowing = follow !== null;
  }

  const { data: publicCard } = await supabase.from("public_topic_cards").select("one_liner").eq("topic_id", t.id).maybeSingle();
  const oneLiner = (publicCard as { one_liner: string | null } | null)?.one_liner ?? null;

  const answerState = snapshot ? getAnswerState({ direction: snapshot.direction, confidence: snapshot.confidence, category: t.category, disagreement: snapshot.disagreement }) : null;
  const hasProse = snapshot?.current_picture_text != null;
  const primarySignal = signals[0];
  const keyMetric = primarySignal ? formatKeyMetric(primarySignal) : null;
  const pct = snapshot ? Math.round(snapshot.confidence * 100) : 0;
  const sourceFamilies = [...new Set(signals.map((s) => s.source_family))];

  let changeText: string | null = null;
  if (snapshot && prevSnapshot) {
    if (snapshot.direction !== prevSnapshot.direction) {
      const prevAnswer = getAnswerState({ direction: prevSnapshot.direction, confidence: prevSnapshot.confidence, category: t.category, disagreement: 0 });
      changeText = `Answer shifted from "${prevAnswer.label}" to "${answerState?.label}"`;
    } else {
      const confDelta = Math.abs(snapshot.confidence - prevSnapshot.confidence);
      if (confDelta > 0.1) changeText = `Confidence ${snapshot.confidence > prevSnapshot.confidence ? "increased" : "decreased"} since last update`;
    }
  }

  let timelineNarrative: string | null = null;
  if (history.length >= 2) {
    const recent = history.slice(0, 5);
    const allSame = recent.every((h) => h.direction === recent[0].direction);
    timelineNarrative = allSame
      ? `The answer has been consistent for the last ${recent.length} updates.`
      : `The outlook has shifted between updates recently.`;
  }

  const metricBg = t.category ? (CAT_STYLE[t.category]?.bg ?? DEFAULT_STYLE.bg) : DEFAULT_STYLE.bg;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">

      {/* ════════════════════════════════════════════
          THE ANSWER — above the fold, always
          ════════════════════════════════════════════ */}
      <section className="mb-8 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <span className={`h-2 w-2 rounded-full ${cat.accent.replace("text-", "bg-")}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent}`}>{t.category ?? "Signal"}</span>
          {snapshot?.published_at && (
            <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshot.published_at)}</span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">{headline}</h1>

        {t.description && (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{t.description}</p>
        )}

        {/* Big verdict + confidence gauge */}
        {answerState && (
          <div className={`mt-5 p-5 rounded-2xl bg-gradient-to-br ${metricBg} border ${cat.border} animate-fade-in delay-75`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className={`text-2xl sm:text-3xl font-black ${answerState.colorClass} block`}>{answerState.label}</span>
                {changeText && <p className="text-xs font-medium text-muted-foreground mt-1">{changeText}</p>}
              </div>
              {/* Confidence gauge */}
              <div className="flex-shrink-0 relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" className="stroke-border/20 dark:stroke-white/10" />
                  <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * 88} 88`}
                    className={`${cat.accent.replace("text-", "stroke-")}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black font-mono text-foreground">{pct}%</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <FollowButton topicSlug={t.slug} isAuthenticated={user !== null} initialFollowing={isFollowing} />
              {signals.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Based on {signals.length} signals from {sourceFamilies.length} {sourceFamilies.length === 1 ? "source" : "sources"}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {snapshot ? (
        <>
          {/* ════════════════════════════════════════════
              THE EXPLANATION — like a friend walking you through it
              ════════════════════════════════════════════ */}
          <section className="mb-8 animate-fade-in delay-150">
            <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-3`}>The short version</h2>
            <div className="rounded-2xl p-5 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5">
              <p className="text-base leading-relaxed text-foreground">
                {hasProse
                  ? snapshot.current_picture_text
                  : oneLiner ?? `We're tracking this question across multiple sources. The data so far points to "${answerState?.label ?? "developing"}." We'll update this as new signals come in.`}
              </p>
            </div>
          </section>

          {/* ════════════════════════════════════════════
              KEY NUMBER — the one metric that matters most
              ════════════════════════════════════════════ */}
          {keyMetric && (
            <AnimateOnScroll>
              <section className="mb-8">
                <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-3`}>Key number</h2>
                <div className={`rounded-2xl p-5 border ${cat.border} bg-gradient-to-br ${metricBg}`}>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground dark:text-primary metric-glow">{keyMetric.value}</span>
                    <span className="text-sm font-medium text-foreground">{keyMetric.label}</span>
                  </div>
                  {primarySignal && primarySignal.delta !== null && Math.abs(primarySignal.delta) > 0.001 && (
                    <p className={`text-xs font-semibold mt-1 ${primarySignal.delta > 0 ? "text-positive dark:text-[#4EDEA3]" : "text-destructive"}`}>
                      {primarySignal.delta > 0 ? "+" : ""}{primarySignal.delta.toFixed(2)} since last update
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{keyMetric.context}</p>
                </div>
              </section>
            </AnimateOnScroll>
          )}

          {/* ════════════════════════════════════════════
              WHAT CHANGED + WHAT TO WATCH — the briefing cards
              ════════════════════════════════════════════ */}
          {(snapshot.what_changed_text || snapshot.what_next_text) && (
            <AnimateOnScroll>
              <section className="mb-8 grid gap-4 sm:grid-cols-2">
                {snapshot.what_changed_text && (
                  <div className="rounded-2xl p-5 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5">
                    <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-2`}>What changed</h3>
                    <p className="text-sm leading-relaxed text-foreground">{snapshot.what_changed_text}</p>
                  </div>
                )}
                {snapshot.what_next_text && (
                  <div className="rounded-2xl p-5 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5">
                    <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-2`}>What to watch</h3>
                    <p className="text-sm leading-relaxed text-foreground">{snapshot.what_next_text}</p>
                  </div>
                )}
              </section>
            </AnimateOnScroll>
          )}

          {/* ════════════════════════════════════════════
              THE SIGNALS — where the answer comes from
              ════════════════════════════════════════════ */}
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
                <section className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent}`}>Where this comes from</h2>
                    <span className="text-[10px] text-muted-foreground/50">{signals.length} signals, {sourceFamilies.length} {sourceFamilies.length === 1 ? "source type" : "source types"}</span>
                  </div>
                  {sortedKeys.map((key) => (
                    <SignalGroup key={key} familyKey={key} signals={grouped.get(key) ?? []} />
                  ))}
                </section>
              </AnimateOnScroll>
            );
          })()}

          {/* ════════════════════════════════════════════
              EVIDENCE — recent news and data points
              ════════════════════════════════════════════ */}
          {evidencePreview.length > 0 && (
            <AnimateOnScroll>
              <section className="mb-8">
                <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-3`}>Recent evidence</h2>
                <div className="space-y-2">
                  {evidencePreview.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card dark:bg-[#131B2E] dark:border dark:border-white/5">
                      <span className={`h-1.5 w-1.5 rounded-full mt-2 flex-shrink-0 ${cat.accent.replace("text-", "bg-")}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground leading-snug">{ev.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{ev.source}{ev.date ? ` -- ${ev.date}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <EvidenceDrawer topicId={t.id} />
                </div>
              </section>
            </AnimateOnScroll>
          )}

          {/* ════════════════════════════════════════════
              TIMELINE — how the answer has evolved
              ════════════════════════════════════════════ */}
          {history.length >= 2 && (
            <AnimateOnScroll>
              <section className="mb-8">
                <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-3`}>How this answer has changed</h2>
                <div className="rounded-2xl p-5 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5">
                  <ConfidenceTimeline history={history} />
                  {timelineNarrative && (
                    <p className="text-xs text-muted-foreground mt-3">{timelineNarrative}</p>
                  )}
                </div>
              </section>
            </AnimateOnScroll>
          )}

          {/* ════════════════════════════════════════════
              SPARSE TOPIC — gathering data notice
              ════════════════════════════════════════════ */}
          {signals.length === 0 && !hasProse && (
            <section className="mb-8 p-6 rounded-2xl bg-gradient-to-br ${metricBg} border ${cat.border} text-center animate-fade-in">
              <p className="text-sm font-medium text-foreground mb-2">We are building a full picture on this question</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed mb-4">
                Our system is connecting to prediction markets, official data sources, and news feeds to build a comprehensive analysis.
                When the signals are strong enough, you will see the full breakdown here -- sources, evidence, and a confidence timeline.
              </p>
              <FollowButton topicSlug={t.slug} isAuthenticated={user !== null} initialFollowing={isFollowing} />
            </section>
          )}

          {/* ════════════════════════════════════════════
              RELATED QUESTIONS — what else to explore
              ════════════════════════════════════════════ */}
          {relatedQuestions.length > 0 && (
            <AnimateOnScroll>
              <section className="mb-8">
                <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-4`}>People also wondering</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatedQuestions.map((rq) => {
                    const rqState = rq.direction && rq.confidence !== null
                      ? getAnswerState({ direction: rq.direction, confidence: rq.confidence, category: t.category, disagreement: 0 }) : null;
                    return (
                      <Link key={rq.slug} href={`/topics/${rq.slug}`}>
                        <div className="p-4 rounded-2xl bg-card dark:bg-[#131B2E] dark:border dark:border-white/5 hover-lift-sm">
                          <p className="text-sm font-semibold text-foreground leading-snug">{rq.question_text}</p>
                          {rqState && <p className={`text-xs font-bold mt-1.5 ${rqState.colorClass}`}>{rqState.label}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </AnimateOnScroll>
          )}

          {/* ════════════════════════════════════════════
              CTA — ask your own question
              ════════════════════════════════════════════ */}
          <section className="mb-8 p-6 rounded-2xl bg-card dark:bg-[#131B2E] dark:border dark:border-white/5 text-center">
            <p className="text-sm font-medium text-foreground mb-3">Have a different question about this topic?</p>
            <Link href="/search" className="inline-flex h-10 items-center rounded-full bg-secondary dark:bg-[#222A3E] px-6 text-sm text-foreground hover:bg-secondary/80 transition-colors">
              Ask a question
            </Link>
          </section>
        </>
      ) : (
        <div className="rounded-2xl p-8 bg-card dark:bg-[#131B2E] dark:border dark:border-white/5 text-center animate-fade-in">
          <p className="text-lg font-medium text-foreground mb-2">We are building this answer</p>
          <p className="text-sm text-muted-foreground mb-4">Signal analysis is being prepared. Check back shortly for a living answer.</p>
          <FollowButton topicSlug={t.slug} isAuthenticated={user !== null} initialFollowing={isFollowing} />
        </div>
      )}
    </div>
  );
}
