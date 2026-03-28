/**
 * Threshold Template -- "Will X cross Y?"
 *
 * Emotional mode: A COUNTDOWN. Current level vs target, distance between them.
 * Hero: Current metric (BIG) + target + distance + direction.
 * Removes: competition leaderboard, generic verdict labels.
 */

import { FollowButton } from "@/components/follow-button";
import { EvidenceWall } from "@/components/signal-card";
import { ConfidenceTimeline } from "@/components/confidence-timeline";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import { getAnswerState } from "@/lib/answer-state";
import { getTeamEntity } from "@/lib/team-entities";
import { selectLeadSignals, checkProseCoherence } from "@/lib/signal-selection";
import Link from "next/link";
import type { TemplateProps, TemplateSignal } from "./types";

const PLATFORM_DISPLAY: Record<string, string> = {
  polymarket: "Polymarket", kalshi: "Kalshi", metaculus: "Metaculus", manifold: "Manifold",
};

function timeAgo(dateStr: string): string {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Extract a numeric target from the question text.
 * e.g., "Will gold hit $5,500 by June?" -> { value: 5500, formatted: "$5,500" }
 */
function extractTarget(questionText: string): { value: number; formatted: string } | null {
  // Match dollar amounts: $100k, $5,500, $100,000
  const dollarMatch = questionText.match(/\$([0-9,]+(?:\.\d+)?)\s*([kKmMbB])?/);
  if (dollarMatch) {
    const raw = parseFloat(dollarMatch[1].replace(/,/g, ""));
    const multiplier = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9 }[dollarMatch[2] ?? ""] ?? 1;
    const value = raw * multiplier;
    const formatted = `$${value >= 1e9 ? `${(value / 1e9).toFixed(1)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1000 ? value.toLocaleString("en-US") : value.toString()}`;
    return { value, formatted };
  }

  // Match percentages: 4%, 2.5%
  const pctMatch = questionText.match(/(\d+(?:\.\d+)?)%/);
  if (pctMatch) {
    const value = parseFloat(pctMatch[1]);
    return { value, formatted: `${value}%` };
  }

  return null;
}

/**
 * Find the primary metric signal (macro_official or crypto_market with highest weight).
 */
function findPrimaryMetric(signals: TemplateSignal[]): TemplateSignal | null {
  return signals.find((s) => s.source_family === "macro_official" || s.source_family === "crypto_market") ?? null;
}

/**
 * Format the current metric value for display.
 */
function formatMetricValue(signal: TemplateSignal): string {
  if (signal.source_family === "crypto_market") {
    const price = signal.current_value;
    return price >= 1 ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${price.toFixed(4)}`;
  }
  if (signal.source_family === "macro_official") {
    const v = signal.current_value;
    return v > 100 ? v.toLocaleString("en-US") : `${v.toFixed(2)}%`;
  }
  return signal.current_value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Compute distance to target.
 */
function getDistance(current: number, target: number): { pct: string; label: string; direction: "above" | "below" | "at" } {
  if (Math.abs(current - target) / target < 0.005) return { pct: "0%", label: "At target", direction: "at" };
  const diff = ((target - current) / current) * 100;
  if (diff > 0) return { pct: `${Math.abs(diff).toFixed(0)}%`, label: `${Math.abs(diff).toFixed(0)}% below target`, direction: "below" };
  return { pct: `${Math.abs(diff).toFixed(0)}%`, label: `${Math.abs(diff).toFixed(0)}% above target`, direction: "above" };
}

/**
 * Find the market probability signal for this threshold.
 */
function findMarketProbability(signals: TemplateSignal[]): number | null {
  const market = signals.find((s) =>
    (s.source_family === "prediction_market" || s.source_family === "forecasting") &&
    (s.signal_type === "market_probability" || s.signal_type === "forecast_probability") &&
    s.current_value > 0.01 && s.current_value < 0.99,
  );
  return market ? Math.round(market.current_value * 100) : null;
}

export function ThresholdTemplate({ props }: { props: TemplateProps }) {
  const {
    topic, question, contract, snapshot, signals, history,
    topicLogo, heroImage, oneLiner,
    catStyle: cat, evidencePreview, relatedQuestions, marketPlatforms,
    isAuthenticated, isFollowing,
  } = props;

  const sourceFamilies = [...new Set(signals.map((s) => s.source_family))];

  // Lead signal selection: official data leads, market probability supports
  const { lead: leadSignals } = selectLeadSignals(signals, contract.questionType, question.question_text);
  const primaryMetric = findPrimaryMetric(leadSignals.length > 0 ? leadSignals : signals);
  const target = extractTarget(question.question_text);
  const metricValue = primaryMetric ? formatMetricValue(primaryMetric) : null;
  const distance = primaryMetric && target ? getDistance(primaryMetric.current_value, target.value) : null;
  const marketProb = findMarketProbability(leadSignals.length > 0 ? leadSignals : signals);

  // Prose coherence check (threshold pages rarely contradict, but check anyway)
  const proseCheck = checkProseCoherence(snapshot?.current_picture_text ?? null, "threshold", {});
  const hasProse = proseCheck.safe && snapshot?.current_picture_text != null;
  const oneLinerCheck = checkProseCoherence(oneLiner, "threshold", {});
  const safeOneLiner = oneLinerCheck.safe ? oneLiner : null;

  // Key drivers: top 2-3 most impactful signals (primary family first)
  const keyDrivers = signals.slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">

      {/* ── HERO: Metric Card ── */}
      <section className="mb-10 animate-slide-up">
        {heroImage && (
          <div className="relative -mx-6 mb-6 rounded-2xl overflow-hidden">
            <div className="relative h-48 sm:h-64">
              <img src={heroImage} alt="" className="w-full h-full object-cover opacity-30 dark:opacity-20 dark:brightness-50 grayscale" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
            </div>
          </div>
        )}

        {/* Category + timestamp */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`h-2 w-2 rounded-full ${cat.accent.replace("text-", "bg-")}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent}`}>{topic.category ?? "Signal"}</span>
          {snapshot?.published_at && <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshot.published_at)}</span>}
        </div>

        {/* Question headline with logo */}
        <div className="flex items-start gap-4 mb-6">
          {topicLogo?.logoUrl && (
            <div className={`flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl ${topicLogo.bgColor} flex items-center justify-center mt-0.5`}>
              <img src={topicLogo.logoUrl} alt="" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">{question.question_text}</h1>
        </div>

        {/* METRIC CARD */}
        <div className={`p-5 rounded-2xl bg-gradient-to-br ${cat.bg} border ${cat.border}`}>

          {/* Current value -- THE big number */}
          {metricValue ? (
            <div className="flex items-end gap-4 flex-wrap">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-foreground dark:text-primary leading-none">{metricValue}</span>
              {target && distance && (
                <div className="pb-1">
                  <span className="text-sm font-bold text-muted-foreground block">Target: {target.formatted}</span>
                  <span className={`text-xs font-bold ${distance.direction === "above" ? "text-positive dark:text-[#4EDEA3]" : distance.direction === "at" ? "text-positive dark:text-[#4EDEA3]" : "text-foreground/70"}`}>
                    {distance.label}
                  </span>
                </div>
              )}
            </div>
          ) : target ? (
            <div>
              <span className="text-sm font-bold text-muted-foreground block">Target: {target.formatted}</span>
            </div>
          ) : null}

          {/* Delta from primary metric */}
          {primaryMetric && primaryMetric.delta !== null && Math.abs(primaryMetric.delta) > 0.001 && (
            <div className="mt-2">
              <span className={`text-sm font-bold ${primaryMetric.delta > 0 ? "text-positive dark:text-[#4EDEA3]" : "text-destructive"}`}>
                {primaryMetric.delta > 0 ? "+" : ""}{primaryMetric.source_family === "crypto_market" ? `$${Math.abs(primaryMetric.delta).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : primaryMetric.delta.toFixed(2)} since last update
              </span>
            </div>
          )}

          {/* Market probability */}
          {marketProb !== null && (
            <div className="mt-3">
              <span className="text-sm text-foreground">
                Markets say <span className="font-bold">{marketProb}%</span> chance of reaching the target
              </span>
            </div>
          )}

          {/* Prose */}
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            {hasProse ? snapshot?.current_picture_text : safeOneLiner ?? `We are tracking this metric across multiple sources.`}
          </p>

          {/* Follow + signal count */}
          <div className="mt-4 flex items-center gap-3">
            <FollowButton topicSlug={topic.slug} isAuthenticated={isAuthenticated} initialFollowing={isFollowing} />
            {signals.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Based on {signals.length} signals from {sourceFamilies.length} {sourceFamilies.length === 1 ? "source" : "sources"}
                {marketPlatforms.length > 0 && ` -- including ${marketPlatforms.map((p) => PLATFORM_DISPLAY[p] ?? p).join(", ")}`}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── WHAT CHANGED + WHAT TO WATCH ── */}
      {snapshot && (snapshot.what_changed_text || snapshot.what_next_text) && (
        <AnimateOnScroll>
          <section className="mb-10">
            <div className="rounded-2xl bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 overflow-hidden">
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
            </div>
          </section>
        </AnimateOnScroll>
      )}

      {/* ── EVIDENCE WALL: All signals ── */}
      {signals.length > 0 && (
        <AnimateOnScroll>
          <section className="mb-10">
            <EvidenceWall signals={signals} isCompetition={false} />
          </section>
        </AnimateOnScroll>
      )}

      {/* ── SUPPLEMENTARY ── */}
      <div className="space-y-8 opacity-90">

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
              <div className="mt-3"><EvidenceDrawer topicId={topic.id} /></div>
            </section>
          </AnimateOnScroll>
        )}

        {/* Timeline -- useful for threshold tracking */}
        {history.length >= 2 && (
          <AnimateOnScroll>
            <section>
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">How this metric has moved</h2>
              <div className="rounded-2xl p-5 bg-muted/20 dark:bg-white/[0.02]">
                <ConfidenceTimeline history={history} />
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
                  const rqState = rq.direction && rq.confidence !== null ? getAnswerState({ direction: rq.direction, confidence: rq.confidence, category: topic.category, disagreement: 0 }) : null;
                  const rqTeam = getTeamEntity(rq.question_text);
                  return (
                    <Link key={rq.slug} href={`/questions/${rq.slug}`}>
                      <div className="p-4 rounded-xl bg-muted/20 dark:bg-white/[0.02] hover:bg-muted/40 dark:hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-start gap-3">
                          {rqTeam && (
                            <div className={`flex-shrink-0 h-8 w-8 rounded-lg ${rqTeam.bgColor} flex items-center justify-center`}>
                              <img src={rqTeam.logoUrl} alt={rqTeam.name} className="h-5 w-5 object-contain" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-snug">{rq.question_text}</p>
                            {rqState && <p className={`text-xs font-bold mt-1 ${rqState.colorClass}`}>{rqState.headline}</p>}
                          </div>
                        </div>
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
    </div>
  );
}
