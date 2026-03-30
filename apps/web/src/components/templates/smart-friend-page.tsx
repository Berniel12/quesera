/**
 * Smart Friend Template
 *
 * The legibility-first page template for featured questions.
 * Designed for normal people who got this link via text message.
 *
 * Structure:
 *   1. Full-bleed answer (THE hero moment -- not a card)
 *   2. Three evidence cards (markets, data, what changed)
 *   3. Email capture
 *   4. Cross-links to other featured questions
 *
 * 640px max-width centered column. Mobile-first at 375px.
 * Uses DESIGN.md tokens: #0B1326 bg, #DBE2FD text, #00DAF3 accent.
 */

import { FollowButton } from "@/components/follow-button";
import { EmailCapture } from "@/components/email-capture";
import Link from "next/link";
import type { TemplateProps } from "./types";

const PLATFORM_DISPLAY: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  metaculus: "Metaculus",
  manifold: "Manifold",
  the_odds_api: "Bookmakers",
};

const CAT_LABEL: Record<string, string> = {
  macro: "Finance",
  crypto: "Crypto",
  politics: "Politics",
  geopolitics: "Geopolitics",
  sports: "Sports",
  tech: "Tech",
  entertainment: "Entertainment",
  disasters: "Weather",
};

function timeAgo(dateStr: string): string {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function DirectionIndicator({ direction, delta }: { direction: string; delta: string | null }) {
  if (direction === "up") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-positive dark:text-[#4EDEA3]">
        <span className="text-sm">&#9650;</span>
        <span>{delta ?? "Trending up"}</span>
      </div>
    );
  }
  if (direction === "down") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-warning dark:text-[#FF9500]">
        <span className="text-sm">&#9660;</span>
        <span>{delta ?? "Trending down"}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 inline-block" />
      <span>Holding steady</span>
    </div>
  );
}

export function SmartFriendTemplate({ props }: { props: TemplateProps }) {
  const {
    topic, question, snapshot, signals, oneLiner,
    catStyle: cat, relatedQuestions,
    isAuthenticated, isFollowing,
  } = props;

  const comparison = snapshot?.synthesis_json ?? null;
  const platformBreakdown = comparison?.platformBreakdown ?? [];
  const groundingMetric = comparison?.primaryGroundingMetric ?? null;
  const whatChanged = snapshot?.what_changed_text ?? null;
  const publishedAt = snapshot?.published_at ?? null;

  // Build the answer sentence from one_liner or expert_line
  const answerSentence = oneLiner ?? "We are gathering signals on this question.";

  // Direction delta description
  const avgProb = comparison?.predictiveAvgProbability;
  const spreadPp = comparison?.predictiveSpreadPp;
  const directionDelta = avgProb !== null && avgProb !== undefined && spreadPp !== null && spreadPp !== undefined
    ? `${Math.round(spreadPp)}pp spread across platforms`
    : null;

  // Category label
  const catLabel = CAT_LABEL[topic.category ?? ""] ?? "Signal";

  // Platform count for attribution
  const platformNames = [...new Set(signals.map((s) => s.source_name))];
  const platformLabel = platformNames
    .map((p) => PLATFORM_DISPLAY[p] ?? p)
    .filter((_, i) => i < 4)
    .join(", ");

  // Key probability number for the hero
  const keyPct = avgProb !== null && avgProb !== undefined ? Math.round(avgProb * 100) : null;

  return (
    <div className="mx-auto max-w-[640px] px-4 sm:px-6 py-6">

      {/* ── Hero banner with gradient ── */}
      <div className={`-mx-4 sm:-mx-6 -mt-6 mb-6 px-6 sm:px-8 pt-10 pb-8 bg-gradient-to-b ${cat.bg}`}>
        <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${cat.accent}`}>
          {catLabel}
        </span>
        <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight mt-2 mb-4">
          {question.question_text}
        </h1>

        {/* Big probability number + answer sentence */}
        <div className="flex items-start gap-4">
          {keyPct !== null && (
            <div className="flex-shrink-0">
              <span className={`text-[48px] sm:text-[56px] font-black leading-none tabular-nums ${cat.accent}`}>
                {keyPct}
              </span>
              <span className={`text-lg font-bold ${cat.accent}`}>%</span>
            </div>
          )}
          <div className="pt-2 flex-1 min-w-0">
            <p className="text-sm sm:text-base leading-relaxed text-foreground/80">
              {answerSentence}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <DirectionIndicator direction={snapshot?.direction ?? "stable"} delta={directionDelta} />
              {publishedAt && (
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo(publishedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <FollowButton
            topicSlug={topic.slug}
            isAuthenticated={isAuthenticated}
            initialFollowing={isFollowing}
          />
          {platformLabel && (
            <span className="text-[11px] text-muted-foreground/70">
              Based on {signals.length} signals across {platformLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── Card 1: What markets say ── */}
      {platformBreakdown.length > 0 && (
        <div className="bg-card border border-border/30 rounded-xl p-4 mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            What markets say
          </h3>
          <div className="space-y-3">
            {platformBreakdown.map((p) => {
              const pct = Math.round(p.avgProbability * 100);
              return (
                <div key={p.platform}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium">
                      {PLATFORM_DISPLAY[p.platform] ?? p.platform}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-[#00DAF3]">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-secondary dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#00DAF3] dark:bg-[#00DAF3] bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Card 2: What the data says ── */}
      {groundingMetric && (
        <div className="bg-card border border-border/30 rounded-xl p-4 mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            What the data says
          </h3>
          <div className="text-[28px] font-bold tabular-nums leading-none">
            {groundingMetric.formatted}
          </div>
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
            {groundingMetric.name}.
            {groundingMetric.deltaFormatted
              ? ` Moved ${groundingMetric.deltaFormatted} recently.`
              : " Holding steady."}
          </p>
        </div>
      )}

      {/* ── Card 3: What changed ── */}
      <div className="bg-card border border-border/30 rounded-xl p-4 mb-8">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          What changed this week
        </h3>
        {whatChanged ? (
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {whatChanged}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
            No significant changes this week.
          </p>
        )}
      </div>

      {/* ── Email capture ── */}
      <EmailCapture questionSlug={question.slug} />

      {/* ── Cross-links ── */}
      {relatedQuestions.length > 0 && (
        <div className="mt-8 mb-12">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            People also wondering
          </h3>
          <div className="space-y-2">
            {relatedQuestions.map((rq) => (
              <Link
                key={rq.slug}
                href={`/questions/${rq.slug}`}
                className="block p-3 bg-card border border-border/30 rounded-lg hover:border-border/50 transition-colors"
              >
                <span className="text-[13px] font-medium">{rq.question_text}</span>
                {rq.confidence !== null && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {rq.direction === "up" ? "Leaning yes" : rq.direction === "down" ? "Leaning no" : "Mixed signals"}{" "}
                    at {Math.round(rq.confidence * 100)}%
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
