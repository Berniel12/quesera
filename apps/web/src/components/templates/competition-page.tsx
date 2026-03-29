/**
 * Competition Template -- "Who will win X?"
 *
 * Emotional mode: A RACE. There's a leader, challengers, and gap drama.
 * Hero: Leader name + probability + top challenger + gap + race state.
 * Removes: market probability key metric, "Points toward yes" labels, confidence bar.
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
 * Extract a clean entity name from a prediction market question.
 * Tries multiple patterns beyond just "Will X win":
 *   - "Will X win..." -> X
 *   - "Will X have the best..." -> X
 *   - "Will X lead..." -> X
 *   - "X to win..." -> X
 *   - Fallback: first capitalized phrase before a verb
 * Returns null if the question doesn't look like a competition contender.
 */
/** Strip leading articles ("the", "a", "an") from entity names */
function stripArticle(name: string): string {
  return name.replace(/^(the|a|an)\s+/i, "");
}

function extractEntityName(question: string): string | null {
  // Pattern 1: "Will X win..."
  const winMatch = question.match(/^Will (.+?) win\b/i);
  if (winMatch) return stripArticle(winMatch[1].trim());

  // Pattern 2: "Will X have the best..."
  const bestMatch = question.match(/^Will (.+?) have the best\b/i);
  if (bestMatch) return stripArticle(bestMatch[1].trim());

  // Pattern 3: "Will X lead..." / "Will X be..."
  const leadMatch = question.match(/^Will (.+?) (?:lead|be the|dominate|finish)\b/i);
  if (leadMatch) return stripArticle(leadMatch[1].trim());

  // Pattern 4: "X to win..." (odds-style)
  const toWinMatch = question.match(/^(.+?) to win\b/i);
  if (toWinMatch) return stripArticle(toWinMatch[1].trim());

  // Pattern 5: Extract subject from "Will [subject] [verb]" generally
  const genericWill = question.match(/^Will (.+?) (?:win|beat|reach|hit|score|qualify|advance|place|rank)\b/i);
  if (genericWill) return stripArticle(genericWill[1].trim());

  return null;
}

/**
 * Extract ranked contenders from market signals.
 * Returns leader + challengers with percentages.
 * Uses broadened entity extraction that works for non-sports too.
 */
function extractRanking(signals: TemplateSignal[]): Array<{ name: string; pct: number }> {
  const contenders = signals
    .filter((s) => s.source_family === "prediction_market" || s.source_family === "forecasting" || s.source_family === "sports_odds")
    .map((s) => {
      const q = String((s.metadata as Record<string, unknown>)?.question ?? "");
      const extracted = extractEntityName(q);
      // Only include signals where we could extract a clean entity name.
      // Never show raw question text as a contender name.
      if (!extracted) return null;
      const pct = Math.round(s.current_value * 100);
      return { name: extracted, pct };
    })
    .filter((c): c is { name: string; pct: number } => c !== null && c.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  // Deduplicate
  const seen = new Set<string>();
  return contenders.filter((c) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Compute race state from leader/challenger probabilities.
 */
function getRaceState(leader: { pct: number }, challenger: { pct: number } | undefined): { label: string; color: string } {
  if (!challenger) return { label: "No challengers", color: "text-muted-foreground" };
  const gap = leader.pct - challenger.pct;
  if (leader.pct > 70) return { label: "Runaway favorite", color: "text-positive dark:text-[#4EDEA3]" };
  if (leader.pct > 50) return { label: "Clear favorite", color: "text-positive dark:text-[#4EDEA3]" };
  if (gap < 10) return { label: "Close race", color: "text-warning" };
  if (leader.pct < 30) return { label: "Wide open", color: "text-muted-foreground" };
  return { label: "Emerging favorite", color: "text-foreground" };
}

/**
 * Look up a logo for a contender name from the static CompetitionAnswer map.
 * Matches by fuzzy name containment (case-insensitive).
 * Returns logo URL and bg color, or null if no match.
 */
function findLogo(
  name: string,
  competitionAnswer: TemplateProps["competitionAnswer"],
): { logoUrl: string; bgColor: string } | null {
  if (!competitionAnswer) return null;
  const lower = name.toLowerCase();

  // Check favorite
  if (competitionAnswer.favorite.name.toLowerCase().includes(lower) ||
      lower.includes(competitionAnswer.favorite.name.toLowerCase())) {
    return { logoUrl: competitionAnswer.favorite.logoUrl, bgColor: competitionAnswer.favorite.bgColor };
  }

  // Check contenders
  for (const c of competitionAnswer.contenders) {
    if (c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())) {
      return { logoUrl: c.logoUrl, bgColor: c.bgColor };
    }
  }

  return null;
}

export function CompetitionTemplate({ props }: { props: TemplateProps }) {
  const {
    topic, question, contract, snapshot, signals, history,
    competitionAnswer, topicLogo, heroImage, oneLiner,
    catStyle: cat, evidencePreview, relatedQuestions, marketPlatforms,
    isAuthenticated, isFollowing,
  } = props;

  const sourceFamilies = [...new Set(signals.map((s) => s.source_family))];
  const platformNames = [...new Set(signals.map((s) => s.source_name))];
  const PLAT_DISPLAY: Record<string, string> = { polymarket: "Polymarket", kalshi: "Kalshi", metaculus: "Metaculus", fred: "FRED", bls: "BLS", coingecko: "CoinGecko", congress_gov: "Congress", the_odds_api: "Bookmakers", eia: "EIA", espn: "ESPN" };
  const platformLabel = platformNames.map((p) => PLAT_DISPLAY[p] ?? p).join(", ");

  // Lead signal selection: only lead-eligible signals drive the hero ranking
  const { lead: leadSignals } = selectLeadSignals(signals, contract.questionType, question.question_text);
  const ranking = extractRanking(leadSignals);
  const leader = ranking[0];
  const challenger = ranking[1];
  const raceState = leader ? getRaceState(leader, challenger) : null;

  // Prose coherence: suppress if it contradicts the live leader
  const heroState = { leaderName: leader?.name };
  const proseCheck = checkProseCoherence(snapshot?.current_picture_text ?? null, "competition", heroState);
  const hasProse = proseCheck.safe && snapshot?.current_picture_text != null;
  // Also check the one-liner fallback -- it can contain the same contradictory text
  const oneLinerCheck = checkProseCoherence(oneLiner, "competition", heroState);
  const safeOneLiner = oneLinerCheck.safe ? oneLiner : null;

  // Logo lookup: find logos for leader/challenger from the static map (decoration only)
  const leaderLogo = leader ? findLogo(leader.name, competitionAnswer) : null;
  const challengerLogo = challenger ? findLogo(challenger.name, competitionAnswer) : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">

      {/* ── HERO: Race Card ── */}
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
          {(competitionAnswer?.favorite.logoUrl || topicLogo?.logoUrl) && (
            <div className={`flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl ${(competitionAnswer?.favorite.bgColor ?? topicLogo?.bgColor) as string} flex items-center justify-center mt-0.5`}>
              <img src={(competitionAnswer?.favorite.logoUrl ?? topicLogo?.logoUrl) as string} alt="" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">{question.question_text}</h1>
        </div>

        {/* RACE CARD: Leader + Challenger + Gap */}
        <div className={`p-5 rounded-2xl bg-gradient-to-br ${cat.bg} border ${cat.border}`}>

          {/* Leader -- ALWAYS from live ranking. Static map only provides logo. */}
          {leader ? (
            <div className="flex items-center gap-4">
              {leaderLogo && (
                <div className={`flex-shrink-0 h-20 w-20 rounded-2xl ${leaderLogo.bgColor} flex items-center justify-center`}>
                  <img src={leaderLogo.logoUrl} alt={leader.name} className="h-14 w-14 object-contain" />
                </div>
              )}
              <div>
                <span className={`text-3xl sm:text-4xl font-black ${cat.accent} block leading-tight`}>{leader.name}</span>
                <span className="text-lg font-bold text-foreground/70">{leader.pct}%</span>
              </div>
            </div>
          ) : (
            /* No usable ranking -- show "Wide open" instead of a wrong static favorite */
            <div>
              <span className={`text-3xl sm:text-4xl font-black text-muted-foreground block leading-tight`}>Wide open</span>
              <span className="text-sm text-muted-foreground">No clear leader in available signals</span>
            </div>
          )}

          {/* Challenger + gap -- from live ranking */}
          {challenger && leader && (
            <div className="mt-4 pt-4 border-t border-border/10 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {challengerLogo && (
                  <div className={`flex-shrink-0 h-10 w-10 rounded-xl ${challengerLogo.bgColor} flex items-center justify-center`}>
                    <img src={challengerLogo.logoUrl} alt="" className="h-7 w-7 object-contain" />
                  </div>
                )}
                <div>
                  <span className="text-sm font-bold text-foreground">{challenger.name}</span>
                  <span className="text-sm text-foreground/60 ml-2">{challenger.pct}%</span>
                </div>
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                {leader.pct - challenger.pct}pp gap
              </span>
            </div>
          )}

          {/* Race state */}
          {raceState && (
            <div className="mt-3">
              <span className={`text-xs font-black uppercase tracking-widest ${raceState.color}`}>{raceState.label}</span>
            </div>
          )}

          {/* Prose -- suppressed if it contradicts the live leader */}
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            {hasProse
              ? snapshot?.current_picture_text
              : safeOneLiner ?? `Based on ${signals.length} signals across ${platformLabel}.`}
          </p>

          {/* Follow + signal count */}
          <div className="mt-4 flex items-center gap-3">
            <FollowButton topicSlug={topic.slug} isAuthenticated={isAuthenticated} initialFollowing={isFollowing} />
            {signals.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Based on {signals.length} signals across {platformLabel}
                {marketPlatforms.length > 0 && ` -- including ${marketPlatforms.map((p) => PLATFORM_DISPLAY[p] ?? p).join(", ")}`}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── GAP VISUALIZATION ── */}
      {leader && challenger && (
        <AnimateOnScroll>
          <section className="mb-10">
            <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cat.accent} mb-3`}>The gap</h2>
            <div className={`p-5 rounded-2xl bg-gradient-to-br ${cat.bg} border ${cat.border}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {(() => { const ll = findLogo(leader.name, competitionAnswer); return ll ? <div className={`h-10 w-10 rounded-xl ${ll.bgColor} flex items-center justify-center`}><img src={ll.logoUrl} alt="" className="h-7 w-7 object-contain" /></div> : null; })()}
                  <div>
                    <span className="text-lg font-black text-foreground">{leader.name}</span>
                    <span className={`text-sm font-bold ${cat.accent} ml-2`}>{leader.pct}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-3xl font-black font-mono ${raceState?.color ?? "text-foreground"}`}>
                    {leader.pct - challenger.pct > 0 ? "+" : ""}{leader.pct - challenger.pct}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block">pt lead</span>
                </div>
              </div>
              {/* Bar showing relative positions */}
              <div className="relative h-3 rounded-full bg-border/20 dark:bg-white/10 overflow-hidden mb-3">
                <div className={`absolute left-0 top-0 h-full rounded-full bg-current ${cat.accent}`} style={{ width: `${leader.pct}%` }} />
                <div className="absolute top-0 h-full rounded-full bg-muted-foreground/30" style={{ left: `${challenger.pct}%`, width: `${Math.max(leader.pct - challenger.pct, 1)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">{challenger.name} -- {challenger.pct}%</span>
                {ranking.length > 2 && <span className="text-muted-foreground/50">+{ranking.length - 2} more in the field</span>}
              </div>
            </div>
          </section>
        </AnimateOnScroll>
      )}

      {/* ── SOURCE COMPARISON ── */}
      {snapshot?.synthesis_json && (
        <AnimateOnScroll>
          <SourceComparisonBlock comparison={snapshot.synthesis_json} phrased={snapshot.synthesis_phrased} accentClass={cat.accent} />
        </AnimateOnScroll>
      )}

      {/* ── LEADERBOARD: Full ranked list ── */}
      {signals.length > 0 && (
        <AnimateOnScroll>
          <section className="mb-10">
            <EvidenceWall signals={signals} isCompetition={true} />
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

      {/* ── SUPPLEMENTARY: Evidence, Timeline, Related ── */}
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

        {/* Timeline -- only if leader position changed recently */}
        {history.length >= 3 && (
          <AnimateOnScroll>
            <section>
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">How this race has changed</h2>
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
