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
  the_odds_api: "Bookmaker Consensus", espn: "ESPN", defillama: "DeFi Llama",
};

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

const SOURCE_INFO: Record<string, { name: string; desc: string }> = {
  prediction_market: { name: "Prediction Markets", desc: "Real-money bets from Polymarket and Kalshi. People put money where their mouth is." },
  macro_official: { name: "Official Economic Data", desc: "Government statistics from the Federal Reserve, BLS, and other agencies." },
  crypto_market: { name: "Crypto Exchange Data", desc: "Live prices and volume from major exchanges via CoinGecko." },
  forecasting: { name: "Forecaster Consensus", desc: "Aggregated predictions from Metaculus and other platforms." },
  political_official: { name: "Congressional Records", desc: "Bills, votes, and legislative activity from Congress.gov." },
  hazard_weather: { name: "Weather & Geological Data", desc: "Official alerts from NOAA, NWS, and USGS." },
  news_evidence: { name: "News Sources", desc: "Recent reporting from major news outlets." },
  sports_odds: { name: "Sports Bookmakers", desc: "Odds from major sportsbooks." },
  defi_signal: { name: "DeFi On-Chain Data", desc: "Protocol metrics from DeFi Llama." },
};

function formatKeyMetric(signal: { source_family: string; signal_type: string; current_value: number; metadata: Record<string, unknown> | null }): { value: string; label: string; context: string } | null {
  if (signal.source_family === "macro_official") {
    const v = signal.current_value;
    const seriesId = String(signal.metadata?.series_id ?? "");
    const info: Record<string, { label: string; context: string }> = {
      MORTGAGE30US: { label: "30-year fixed mortgage rate", context: "The benchmark rate most homebuyers pay." },
      FEDFUNDS: { label: "Federal funds rate", context: "Influences everything from savings accounts to mortgage rates." },
      UNRATE: { label: "Unemployment rate", context: "Key indicator of economic health." },
      CPIAUCSL: { label: "Consumer price index", context: "When this rises, your groceries and gas cost more." },
      DGS10: { label: "10-year Treasury yield", context: "A barometer for investor confidence." },
      GDP: { label: "GDP (billions)", context: "Two consecutive quarters of decline signals a recession." },
      "PET.RWTC.W": { label: "Crude oil price per barrel", context: "Spikes here show up at the gas pump within days." },
      SP500: { label: "S&P 500", context: "The single best measure of how the stock market is doing." },
      GOLDAMGBD228NLBM: { label: "Gold price (per troy oz)", context: "Gold tends to rise when investors are nervous." },
      GASREGW: { label: "Regular gas price (per gallon)", context: "National average price at the pump." },
      UMCSENT: { label: "Consumer confidence index", context: "When it drops, spending usually follows." },
    };
    const entry = info[seriesId];
    if (!entry) return null;
    return { value: v > 100 ? v.toLocaleString("en-US") : `${v.toFixed(2)}%`, label: entry.label, context: entry.context };
  }
  if (signal.source_family === "crypto_market") {
    const price = signal.current_value;
    return { value: price >= 1 ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${price.toFixed(4)}`, label: String(signal.metadata?.name ?? "Price"), context: "Current trading price across major exchanges." };
  }
  if (signal.signal_type === "market_probability" || signal.signal_type === "forecast_probability") {
    const pct = Math.round(signal.current_value * 100);
    return { value: `${pct}%`, label: "Market probability", context: `Real money is behind this number.` };
  }
  if (signal.signal_type === "earthquake_magnitude") {
    return { value: `M${signal.current_value.toFixed(1)}`, label: "Strongest recent earthquake", context: "Each whole number is about 32x more energy." };
  }
  return null;
}

function timeAgo(dateStr: string): string {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function getFamilyDirection(sigs: Array<{ direction: string }>): { label: string; color: string } {
  const ups = sigs.filter((s) => s.direction === "up").length;
  const downs = sigs.filter((s) => s.direction === "down").length;
  const stables = sigs.filter((s) => s.direction === "stable").length;
  if (ups > downs && ups > stables) return { label: "Points toward yes", color: "text-positive dark:text-[#4EDEA3]" };
  if (downs > ups && downs > stables) return { label: "Points toward no", color: "text-destructive" };
  if (stables >= ups && stables >= downs) return { label: "Holding steady", color: "text-muted-foreground" };
  return { label: "Mixed signals", color: "text-warning" };
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

  interface SnapshotView { direction: string; confidence: number; disagreement: number; freshness: string; staleness_seconds: number | null; current_picture_text: string | null; what_changed_text: string | null; what_next_text: string | null; structured_data: Record<string, unknown>; published_at: string; version: number; }
  let snapshot: SnapshotView | null = null;
  if (snapshotId) { const { data } = await supabase.from("topic_snapshots").select("direction, confidence, disagreement, freshness, staleness_seconds, current_picture_text, what_changed_text, what_next_text, structured_data, published_at, version").eq("id", snapshotId).single(); snapshot = data as SnapshotView | null; }

  let prevSnapshot: { direction: string; confidence: number } | null = null;
  const { data: prevArr } = await supabase.from("topic_snapshots").select("direction, confidence").eq("topic_id", t.id).order("version", { ascending: false }).range(1, 1).limit(1);
  if (prevArr && prevArr.length > 0) prevSnapshot = prevArr[0] as { direction: string; confidence: number };

  let signals: Array<{ source_name: string; source_family: string; signal_type: string; current_value: number; previous_value: number | null; delta: number | null; direction: string; freshness: string; weight: number; metadata: Record<string, unknown> | null }> = [];
  if (snapshotId) { const { data } = await supabase.from("topic_signals").select("source_name, source_family, signal_type, current_value, previous_value, delta, direction, freshness, weight, metadata").eq("snapshot_id", snapshotId).order("weight", { ascending: false }).limit(20); signals = (data ?? []) as typeof signals; }

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
  if (user) { const { data: follow } = await supabase.from("user_followed_topics").select("topic_id").eq("user_id", user.id).eq("topic_id", t.id).maybeSingle(); isFollowing = follow !== null; }

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
    timelineNarrative = allSame ? `The answer has been consistent for the last ${recent.length} updates.` : `The outlook has shifted between updates recently.`;
  }

  const metricBg = t.category ? (CAT_STYLE[t.category]?.bg ?? DEFAULT_STYLE.bg) : DEFAULT_STYLE.bg;

  // Group signals by family for the intelligence briefing
  const grouped = new Map<string, typeof signals>();
  for (const s of signals) { const key = s.source_family ?? "unknown"; const arr = grouped.get(key) ?? []; arr.push(s); grouped.set(key, arr); }
  const ORDER = ["prediction_market", "macro_official", "crypto_market", "forecasting", "political_official", "hazard_weather", "news_evidence", "sports_odds", "defi_signal"];
  const sortedFamilies = [...grouped.keys()].sort((a, b) => { const ai = ORDER.indexOf(a); const bi = ORDER.indexOf(b); return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi); });
  const familyDirections = sortedFamilies.map((k) => ({ key: k, ...getFamilyDirection(grouped.get(k) ?? []) }));
  const allAgree = familyDirections.length > 1 && familyDirections.every((d) => d.label === familyDirections[0].label);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">

      {/* ================================================================
          TIER 1: THE ANSWER -- above the fold, one cohesive block
          Question + verdict + prose explanation + follow
          ================================================================ */}
      <section className="mb-10 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <span className={`h-2 w-2 rounded-full ${cat.accent.replace("text-", "bg-")}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent}`}>{t.category ?? "Signal"}</span>
          {snapshot?.published_at && <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshot.published_at)}</span>}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">{headline}</h1>

        {/* Verdict card with gauge */}
        {answerState && (
          <div className={`mt-5 p-5 rounded-2xl bg-gradient-to-br ${metricBg} border ${cat.border}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className={`text-2xl sm:text-3xl font-black ${answerState.colorClass} block`}>{answerState.label}</span>
                {changeText && <p className="text-xs font-medium text-muted-foreground mt-1">{changeText}</p>}
              </div>
              <div className="flex-shrink-0 relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" className="stroke-border/20 dark:stroke-white/10" />
                  <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 88} 88`} className={`${cat.accent.replace("text-", "stroke-")}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black font-mono text-foreground">{pct}%</span>
                </div>
              </div>
            </div>

            {/* Prose explanation -- part of the verdict, not a separate section */}
            <p className="mt-4 text-sm leading-relaxed text-foreground/90">
              {hasProse
                ? snapshot?.current_picture_text
                : oneLiner ?? `We are tracking this question across multiple sources.`}
            </p>

            <div className="mt-4 flex items-center gap-3">
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
          {/* ================================================================
              TIER 2: INTELLIGENCE BRIEFING -- one card, the full "why"
              Key metric + sources + what changed + what to watch
              ================================================================ */}
          {(signals.length > 0 || snapshot.what_changed_text || snapshot.what_next_text) && (
            <AnimateOnScroll>
              <section className="mb-10">
                <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-3`}>Intelligence Briefing</h2>
                <div className="rounded-2xl bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 overflow-hidden">

                  {/* Key metric -- compact row at top */}
                  {keyMetric && (
                    <div className={`flex items-center gap-4 p-5 border-b border-border/10 dark:border-white/5 bg-gradient-to-r ${metricBg}`}>
                      <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground dark:text-primary">{keyMetric.value}</span>
                      <div>
                        <span className="text-sm font-medium text-foreground block">{keyMetric.label}</span>
                        {primarySignal && primarySignal.delta !== null && Math.abs(primarySignal.delta) > 0.001 && (
                          <span className={`text-xs font-semibold ${primarySignal.delta > 0 ? "text-positive dark:text-[#4EDEA3]" : "text-destructive"}`}>
                            {primarySignal.delta > 0 ? "+" : ""}{primarySignal.delta.toFixed(2)} since last update
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground block mt-0.5">{keyMetric.context}</span>
                      </div>
                    </div>
                  )}

                  {/* Source consensus -- what each source says */}
                  {sortedFamilies.length > 0 && (
                    <div className="p-5 border-b border-border/10 dark:border-white/5">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">What the sources say</h3>
                      <p className="text-[11px] text-muted-foreground mb-4">
                        {sortedFamilies.length} {sortedFamilies.length === 1 ? "source type" : "independent source types"}
                        {allAgree && familyDirections.length > 1 ? ` -- all agree: ${familyDirections[0].label.toLowerCase()}` : sortedFamilies.length > 1 ? " -- showing different perspectives" : ""}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {familyDirections.map((fd) => {
                          const info = SOURCE_INFO[fd.key] ?? { name: fd.key, desc: "" };
                          const count = (grouped.get(fd.key) ?? []).length;
                          return (
                            <div key={fd.key} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 dark:bg-white/[0.03]">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-foreground">{info.name}</span>
                                  <span className={`text-[10px] font-bold flex-shrink-0 ${fd.color}`}>{fd.label}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{info.desc}</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{count} {count === 1 ? "signal" : "signals"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* What changed + what to watch -- compact bottom row */}
                  {(snapshot.what_changed_text || snapshot.what_next_text) && (
                    <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/10 dark:divide-white/5">
                      {snapshot.what_changed_text && (
                        <div className="p-5">
                          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">What changed</h3>
                          <p className="text-sm leading-relaxed text-foreground">{snapshot.what_changed_text}</p>
                        </div>
                      )}
                      {snapshot.what_next_text && (
                        <div className="p-5">
                          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">What to watch</h3>
                          <p className="text-sm leading-relaxed text-foreground">{snapshot.what_next_text}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Detailed signal data -- collapsed */}
                {signals.length > 0 && (
                  <details className="group mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                      <span>View raw signal data ({signals.length} signals)</span>
                      <svg className="h-3 w-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2l4 4-4 4" /></svg>
                    </summary>
                    <div className="mt-3">
                      {sortedFamilies.map((key) => (
                        <SignalGroup key={key} familyKey={key} signals={grouped.get(key) ?? []} />
                      ))}
                    </div>
                  </details>
                )}
              </section>
            </AnimateOnScroll>
          )}

          {/* Gathering data notice for sparse topics */}
          {signals.length === 0 && !hasProse && (
            <section className="mb-10 p-6 rounded-2xl bg-muted/30 dark:bg-white/[0.03] border border-border/20 dark:border-white/5 text-center">
              <p className="text-sm font-medium text-foreground mb-2">We are building a full picture on this question</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed mb-4">
                Our system is connecting to prediction markets, official data, and news feeds. When the signals are strong enough, you will see the full breakdown here.
              </p>
              <FollowButton topicSlug={t.slug} isAuthenticated={user !== null} initialFollowing={isFollowing} />
            </section>
          )}

          {/* ================================================================
              TIER 3: THE DETAILS -- supplementary, lighter visual weight
              Evidence, timeline, related questions
              ================================================================ */}
          <div className="mt-4 space-y-8 opacity-90">

            {/* Evidence */}
            {evidencePreview.length > 0 && (
              <AnimateOnScroll>
                <section>
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Recent evidence</h2>
                  <div className="space-y-1.5">
                    {evidencePreview.map((ev, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 dark:bg-white/[0.02]">
                        <span className={`h-1.5 w-1.5 rounded-full mt-2 flex-shrink-0 ${cat.accent.replace("text-", "bg-")}`} />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground leading-snug">{ev.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{ev.source}{ev.date ? ` -- ${ev.date}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3"><EvidenceDrawer topicId={t.id} /></div>
                </section>
              </AnimateOnScroll>
            )}

            {/* Timeline */}
            {history.length >= 2 && (
              <AnimateOnScroll>
                <section>
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">How this answer has changed</h2>
                  <div className="rounded-2xl p-5 bg-muted/20 dark:bg-white/[0.02]">
                    <ConfidenceTimeline history={history} />
                    {timelineNarrative && <p className="text-xs text-muted-foreground mt-3">{timelineNarrative}</p>}
                  </div>
                </section>
              </AnimateOnScroll>
            )}

            {/* Related questions */}
            {relatedQuestions.length > 0 && (
              <AnimateOnScroll>
                <section>
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">People also wondering</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {relatedQuestions.map((rq) => {
                      const rqState = rq.direction && rq.confidence !== null ? getAnswerState({ direction: rq.direction, confidence: rq.confidence, category: t.category, disagreement: 0 }) : null;
                      return (
                        <Link key={rq.slug} href={`/topics/${rq.slug}`}>
                          <div className="p-4 rounded-xl bg-muted/20 dark:bg-white/[0.02] hover:bg-muted/40 dark:hover:bg-white/[0.04] transition-colors">
                            <p className="text-sm font-semibold text-foreground leading-snug">{rq.question_text}</p>
                            {rqState && <p className={`text-xs font-bold mt-1 ${rqState.colorClass}`}>{rqState.label}</p>}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              </AnimateOnScroll>
            )}

            {/* Ask CTA */}
            <section className="p-5 rounded-2xl bg-muted/20 dark:bg-white/[0.02] text-center">
              <p className="text-sm font-medium text-foreground mb-3">Have a different question about this topic?</p>
              <Link href="/search" className="inline-flex h-9 items-center rounded-full bg-secondary dark:bg-[#222A3E] px-5 text-sm text-foreground hover:bg-secondary/80 transition-colors">
                Ask a question
              </Link>
            </section>
          </div>
        </>
      ) : (
        <div className="rounded-2xl p-8 bg-card dark:bg-[#131B2E] dark:border dark:border-white/5 text-center">
          <p className="text-lg font-medium text-foreground mb-2">We are building this answer</p>
          <p className="text-sm text-muted-foreground mb-4">Signal analysis is being prepared.</p>
          <FollowButton topicSlug={t.slug} isAuthenticated={user !== null} initialFollowing={isFollowing} />
        </div>
      )}
    </div>
  );
}
