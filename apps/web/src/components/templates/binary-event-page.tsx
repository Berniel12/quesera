/**
 * Binary Event Template -- "Will X happen?"
 *
 * Emotional mode: TENSION. Two competing forces. Yes vs no. A catalyst could tip it.
 * Hero: Verdict headline + probability bar + case for/against.
 * Removes: competition leaderboard, threshold metrics.
 */

import { FollowButton } from "@/components/follow-button";
import { EvidenceWall } from "@/components/signal-card";
import { ConfidenceTimeline } from "@/components/confidence-timeline";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import { getAnswerState } from "@/lib/answer-state";
import { getTeamEntity } from "@/lib/team-entities";
import { selectLeadSignals, checkProseCoherence } from "@/lib/signal-selection";
import { SourceComparisonBlock } from "@/components/source-comparison";
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
 * Find the strongest market probability for the binary outcome.
 */
function findMarketProbability(signals: TemplateSignal[]): number | null {
  const market = signals.find((s) =>
    (s.source_family === "prediction_market" || s.source_family === "forecasting") &&
    (s.signal_type === "market_probability" || s.signal_type === "forecast_probability") &&
    s.current_value > 0.01 && s.current_value < 0.99,
  );
  return market ? Math.round(market.current_value * 100) : null;
}

export function BinaryEventTemplate({ props }: { props: TemplateProps }) {
  const {
    topic, question, contract, snapshot, prevSnapshot, signals, history,
    answerState, teamEntity, topicLogo, heroImage, oneLiner,
    catStyle: cat, evidencePreview, relatedQuestions, marketPlatforms,
    isAuthenticated, isFollowing,
  } = props;

  const sourceFamilies = [...new Set(signals.map((s) => s.source_family))];

  // Lead signal selection: only lead-eligible signals drive the probability bar
  const { lead: leadSignals } = selectLeadSignals(signals, contract.questionType, question.question_text);
  const marketProb = findMarketProbability(leadSignals);

  // Prose coherence: suppress if it contradicts the live verdict
  const heroState = { verdictLabel: answerState?.label };
  const proseCheck = checkProseCoherence(snapshot?.current_picture_text ?? null, "binary_event", heroState);
  const hasProse = proseCheck.safe && snapshot?.current_picture_text != null;
  const oneLinerCheck = checkProseCoherence(oneLiner, "binary_event", heroState);
  const safeOneLiner = oneLinerCheck.safe ? oneLiner : null;
  const pct = snapshot ? Math.round(snapshot.confidence * 100) : 0;

  // Change detection
  let changeText: string | null = null;
  if (snapshot && prevSnapshot) {
    if (snapshot.direction !== prevSnapshot.direction) {
      const prevAnswer = getAnswerState({ direction: prevSnapshot.direction, confidence: prevSnapshot.confidence, category: topic.category, disagreement: 0 });
      changeText = `Answer shifted from "${prevAnswer.label}" to "${answerState?.label}"`;
    } else {
      const confDelta = Math.abs(snapshot.confidence - prevSnapshot.confidence);
      if (confDelta > 0.1) changeText = `Confidence ${snapshot.confidence > prevSnapshot.confidence ? "increased" : "decreased"} since last update`;
    }
  }

  // Source consensus for "case" section
  const SOURCE_INFO: Record<string, { name: string }> = {
    prediction_market: { name: "Prediction Markets" },
    forecasting: { name: "Forecaster Consensus" },
    political_official: { name: "Congressional Records" },
    news_evidence: { name: "News Sources" },
    macro_official: { name: "Official Data" },
    crypto_market: { name: "Crypto Data" },
  };

  // Group signals by direction for "the case" section
  const forSignals = signals.filter((s) => s.direction === "up");
  const againstSignals = signals.filter((s) => s.direction === "down");
  const hasStrongTwoSided = forSignals.length >= 2 && againstSignals.length >= 2;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">

      {/* ── HERO: Verdict Card ── */}
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
          {(teamEntity?.logoUrl || topicLogo?.logoUrl) && (
            <div className={`flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl ${(teamEntity?.bgColor ?? topicLogo?.bgColor) as string} flex items-center justify-center mt-0.5`}>
              <img src={(teamEntity?.logoUrl ?? topicLogo?.logoUrl) as string} alt="" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">{question.question_text}</h1>
        </div>

        {/* VERDICT CARD */}
        {answerState && (
          <div className={`p-5 rounded-2xl bg-gradient-to-br ${cat.bg} border ${cat.border}`}>

            {/* Verdict headline -- huge and bold */}
            <span className={`text-4xl sm:text-5xl font-black ${answerState.colorClass} block leading-tight`}>{answerState.headline}</span>

            {/* Probability bar */}
            {marketProb !== null && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-border/30 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full animate-bar-fill"
                    style={{ width: `${marketProb}%` }}
                  />
                </div>
                <span className="text-sm font-bold font-mono text-foreground">{marketProb}%</span>
              </div>
            )}

            {/* Confidence -- only with enough signal diversity */}
            {pct > 0 && signals.length >= 3 && sourceFamilies.length >= 2 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Signal confidence: {pct}%</span>
              </div>
            )}

            {changeText && <p className="text-xs font-medium text-muted-foreground mt-2">{changeText}</p>}

            {/* Prose */}
            <p className="mt-4 text-sm leading-relaxed text-foreground/90">
              {hasProse ? snapshot?.current_picture_text : safeOneLiner ?? `We are tracking this question across multiple sources.`}
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
        )}
      </section>

      {/* ── SOURCE COMPARISON ── */}
      {snapshot?.synthesis_json && (
        <AnimateOnScroll>
          <SourceComparisonBlock comparison={snapshot.synthesis_json} accentClass={cat.accent} />
        </AnimateOnScroll>
      )}

      {/* ── THE CASE: For vs Against ── */}
      {(forSignals.length > 0 || againstSignals.length > 0) && (
        <AnimateOnScroll>
          <section className="mb-10">
            <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-3`}>
              {hasStrongTwoSided ? "The case" : "What signals say"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {forSignals.length > 0 && (
                <div className="p-4 rounded-2xl bg-positive/5 dark:bg-[#4EDEA3]/5 border border-positive/10 dark:border-[#4EDEA3]/10">
                  <h3 className="text-xs font-bold text-positive dark:text-[#4EDEA3] uppercase tracking-wide mb-2">
                    {hasStrongTwoSided ? "Case for yes" : "Strongest case"}
                  </h3>
                  <div className="space-y-2">
                    {forSignals.slice(0, 3).map((s, i) => {
                      const q = String((s.metadata as Record<string, unknown>)?.question ?? s.source_name);
                      const info = SOURCE_INFO[s.source_family];
                      return (
                        <div key={i} className="text-sm text-foreground/90">
                          <span className="font-medium">{info?.name ?? s.source_family}</span>
                          <span className="text-muted-foreground"> -- </span>
                          <span>{q.slice(0, 80)}</span>
                          {(s.signal_type === "market_probability" || s.signal_type === "forecast_probability") && (
                            <span className="text-xs font-bold text-positive dark:text-[#4EDEA3] ml-1">{Math.round(s.current_value * 100)}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {againstSignals.length > 0 && (
                <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                  <h3 className="text-xs font-bold text-destructive uppercase tracking-wide mb-2">
                    {hasStrongTwoSided ? "Case for no" : "Biggest blocker"}
                  </h3>
                  <div className="space-y-2">
                    {againstSignals.slice(0, 3).map((s, i) => {
                      const q = String((s.metadata as Record<string, unknown>)?.question ?? s.source_name);
                      const info = SOURCE_INFO[s.source_family];
                      return (
                        <div key={i} className="text-sm text-foreground/90">
                          <span className="font-medium">{info?.name ?? s.source_family}</span>
                          <span className="text-muted-foreground"> -- </span>
                          <span>{q.slice(0, 80)}</span>
                          {(s.signal_type === "market_probability" || s.signal_type === "forecast_probability") && (
                            <span className="text-xs font-bold text-destructive ml-1">{Math.round(s.current_value * 100)}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </AnimateOnScroll>
      )}

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

      {/* ── TOP SIGNALS ── */}
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

        {/* Timeline -- only if probability shifted recently */}
        {history.length >= 3 && (
          <AnimateOnScroll>
            <section>
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">How this answer has changed</h2>
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
