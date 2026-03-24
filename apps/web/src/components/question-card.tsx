import Link from "next/link";
import { getAnswerState } from "@/lib/answer-state";

// Category dot colors
const CATEGORY_DOT: Record<string, string> = {
  macro: "bg-navy dark:bg-[#00DAF3]",
  crypto: "bg-[#00DAF3]",
  politics: "bg-slate-500 dark:bg-[#00DAF3]",
  geopolitics: "bg-destructive",
  sports: "bg-positive dark:bg-[#4EDEA3]",
  disasters: "bg-warning",
  tech: "bg-violet-500 dark:bg-violet-400",
  entertainment: "bg-pink-500 dark:bg-pink-400",
};

// Category gradient accent for card backgrounds
const CATEGORY_BG: Record<string, string> = {
  macro: "from-navy/[0.04] to-transparent dark:from-[#00DAF3]/[0.08] dark:to-transparent",
  crypto: "from-[#00DAF3]/[0.06] to-transparent dark:from-[#00DAF3]/[0.12] dark:to-transparent",
  politics: "from-slate-500/[0.04] to-transparent dark:from-[#00DAF3]/[0.06] dark:to-transparent",
  geopolitics: "from-destructive/[0.04] to-transparent dark:from-destructive/[0.08] dark:to-transparent",
  sports: "from-positive/[0.04] to-transparent dark:from-[#4EDEA3]/[0.08] dark:to-transparent",
  disasters: "from-warning/[0.06] to-transparent dark:from-warning/[0.10] dark:to-transparent",
  tech: "from-violet-500/[0.04] to-transparent dark:from-violet-400/[0.08] dark:to-transparent",
  entertainment: "from-pink-500/[0.04] to-transparent dark:from-pink-400/[0.08] dark:to-transparent",
};

interface QuestionCardProps {
  questionText: string;
  slug: string;
  category: string | null;
  direction: string | null;
  confidence: number | null;
  freshness: string | null;
  oneLiner: string | null;
  snapshotPublishedAt: string | null;
  variant?: "hero" | "compact";
  staggerIndex?: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type CardStyle = "gauge" | "bignum" | "arrow" | "alert" | "minimal" | "pill" | "split" | "meter" | "spotlight" | "ticker";

// Pick a card style — deterministic variety, every card looks different
function getCardStyle(slug: string, category: string | null, confidence: number | null, direction: string | null): CardStyle {
  // Forced styles for specific data shapes
  if ((category === "disasters" || category === "geopolitics") && direction === "up") return "alert";
  if (direction === "up" || direction === "down") return "arrow";

  // Hash-based variety for everything else — 8 remaining styles
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  const styles: CardStyle[] = ["gauge", "bignum", "minimal", "pill", "split", "meter", "spotlight", "ticker"];
  return styles[Math.abs(hash) % styles.length];
}

export function QuestionCard({
  questionText,
  slug,
  category,
  direction,
  confidence,
  freshness,
  oneLiner,
  snapshotPublishedAt,
  variant = "hero",
  staggerIndex = 0,
}: QuestionCardProps) {
  const answerState = direction && confidence !== null
    ? getAnswerState({ direction, confidence, category, disagreement: 0 })
    : null;

  const pct = confidence !== null ? Math.round(confidence * 100) : 0;
  const dotColor = category ? (CATEGORY_DOT[category] ?? "bg-muted-foreground") : "bg-muted-foreground";
  const catBg = category ? (CATEGORY_BG[category] ?? "") : "";
  const isFresh = freshness === "fresh";

  const answerBorderColor = answerState?.colorClass.includes("destructive")
    ? "border-destructive"
    : answerState?.colorClass.includes("positive")
      ? "border-positive dark:border-[#4EDEA3]"
      : answerState?.colorClass.includes("muted")
        ? "border-muted-foreground/30"
        : "border-navy dark:border-[#00DAF3]";

  // ── Hero variant — large, editorial ──
  if (variant === "hero") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className={`group relative overflow-hidden rounded-[2rem] animate-card-enter
            bg-gradient-to-br ${catBg} bg-card
            card-shadow-rich
            dark:border dark:border-white/5
            hover-lift ${isFresh ? "animate-glow-breathe" : ""}`}
          style={{ contain: "layout style" }}
        >
          <div className="relative z-10 p-8 md:p-10">
            {/* Category */}
            <div className="flex items-center gap-2 mb-4">
              <span className="relative h-2 w-2 flex-shrink-0">
                <span className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-live`} />
                <span className={`relative block h-2 w-2 rounded-full ${dotColor}`} />
              </span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                {category ?? "Signal"}
              </span>
              {snapshotPublishedAt && (
                <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshotPublishedAt)}</span>
              )}
            </div>

            {/* Question */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground mb-5">
              {questionText}
            </h2>

            {/* Verdict + confidence bar */}
            {answerState && (
              <div className="flex items-center gap-4 mb-4">
                <span className={`text-2xl sm:text-3xl font-black ${answerState.colorClass}`}>{answerState.label}</span>
                {confidence !== null && (
                  <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                    <div className="h-2 flex-1 rounded-full bg-border/50 dark:bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${answerState.colorClass.includes("destructive") ? "bg-destructive" : answerState.colorClass.includes("positive") ? "bg-positive dark:bg-[#4EDEA3]" : "bg-muted-foreground/40"} animate-bar-fill`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold font-mono text-muted-foreground">{pct}%</span>
                  </div>
                )}
              </div>
            )}

            {/* One-liner */}
            {oneLiner && (
              <p className="text-muted-foreground dark:text-[#C6C6CD] leading-relaxed max-w-xl">
                {oneLiner}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ── Compact variants — each card looks different ──
  const compactDelay = staggerIndex * 120;
  const cardStyle = getCardStyle(slug, category, confidence, direction);

  // ═══════════════════════════════════════════════════
  // GAUGE style — big circular confidence meter
  // ═══════════════════════════════════════════════════
  if (cardStyle === "gauge") {
    const circumference = 2 * Math.PI * 40;
    const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;

    return (
      <Link href={`/topics/${slug}`}>
        <div
          className="group rounded-2xl p-5 animate-card-enter h-full bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm"
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          <div className="flex items-center gap-5">
            {/* Gauge */}
            <div className="flex-shrink-0 relative h-20 w-20">
              <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" className="stroke-border/30 dark:stroke-white/10" />
                <circle
                  cx="50" cy="50" r="40" fill="none" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  className={answerState?.colorClass.includes("destructive") ? "stroke-destructive" : answerState?.colorClass.includes("positive") ? "stroke-positive dark:stroke-[#4EDEA3]" : "stroke-muted-foreground/40"}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black font-mono text-foreground dark:text-primary">{pct}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-wider">conf</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
              </div>
              <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
              {answerState && (
                <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>
              )}
              {snapshotPublishedAt && (
                <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(snapshotPublishedAt)}</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // BIGNUM style — large confidence number dominates
  // ═══════════════════════════════════════════════════
  if (cardStyle === "bignum") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className={`group rounded-2xl animate-card-enter h-full bg-gradient-to-br ${catBg} bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm overflow-hidden`}
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          <div className="flex items-stretch">
            {/* Big number block */}
            <div className="flex-shrink-0 w-24 sm:w-28 flex flex-col items-center justify-center bg-foreground/[0.03] dark:bg-white/[0.04] border-r border-border/30 dark:border-white/5">
              <span className="text-3xl sm:text-4xl font-black font-mono text-foreground dark:text-primary">{pct}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">confidence</span>
            </div>

            <div className="flex-1 min-w-0 p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
              </div>
              <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
              {answerState && (
                <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>
              )}
              {oneLiner && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{oneLiner}</p>
              )}
              {snapshotPublishedAt && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">{timeAgo(snapshotPublishedAt)}</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // ARROW style — prominent direction indicator
  // ═══════════════════════════════════════════════════
  if (cardStyle === "arrow") {
    const isUp = direction === "up";
    const arrowColor = answerState?.colorClass.includes("destructive")
      ? "text-destructive"
      : answerState?.colorClass.includes("positive")
        ? "text-positive dark:text-[#4EDEA3]"
        : "text-foreground";

    return (
      <Link href={`/topics/${slug}`}>
        <div
          className={`group rounded-2xl p-5 animate-card-enter h-full bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm border-l-[3px] ${answerBorderColor}`}
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          <div className="flex items-start gap-4">
            {/* Direction arrow */}
            <div className={`flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${isUp ? "bg-positive/10 dark:bg-[#4EDEA3]/10" : "bg-destructive/10"}`}>
              <svg viewBox="0 0 24 24" className={`h-6 w-6 ${arrowColor}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isUp ? <path d="M7 17L17 7M17 7H7M17 7V17" /> : <path d="M7 7L17 17M17 17H7M17 17V7" />}
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
                <span className={`text-[10px] font-bold ${arrowColor}`}>Moving {isUp ? "up" : "down"}</span>
              </div>
              <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
              {answerState && (
                <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>
              )}
              {oneLiner && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{oneLiner}</p>
              )}
              {snapshotPublishedAt && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">{timeAgo(snapshotPublishedAt)}</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // ALERT style — bold warning treatment
  // ═══════════════════════════════════════════════════
  if (cardStyle === "alert") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className="group rounded-2xl animate-card-enter h-full bg-destructive/[0.04] dark:bg-destructive/[0.08] border border-destructive/20 dark:border-destructive/30 card-shadow-rich hover-lift-sm overflow-hidden"
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          {/* Alert top bar */}
          <div className="bg-destructive/10 dark:bg-destructive/20 px-5 py-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse-live" />
            <span className="text-[10px] font-bold text-destructive uppercase tracking-[0.12em]">{category ?? "Alert"}</span>
            {snapshotPublishedAt && (
              <span className="text-[10px] text-destructive/60 ml-auto">{timeAgo(snapshotPublishedAt)}</span>
            )}
          </div>
          <div className="p-5">
            <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
            {answerState && (
              <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>
            )}
            {oneLiner && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{oneLiner}</p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // PILL style — compact verdict pill + question
  // ═══════════════════════════════════════════════════
  if (cardStyle === "pill") {
    const pillBg = answerState?.colorClass.includes("destructive") ? "bg-destructive/10 text-destructive"
      : answerState?.colorClass.includes("positive") ? "bg-positive/10 text-positive dark:bg-[#4EDEA3]/10 dark:text-[#4EDEA3]"
      : "bg-muted text-muted-foreground";

    return (
      <Link href={`/topics/${slug}`}>
        <div
          className="group rounded-2xl p-5 animate-card-enter h-full bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm"
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
          </div>
          <p className="font-semibold text-base text-foreground leading-snug mb-3">{questionText}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {answerState && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${pillBg}`}>
                {answerState.label}
              </span>
            )}
            {confidence !== null && (
              <span className="text-[11px] font-mono font-bold text-muted-foreground">{pct}% confidence</span>
            )}
            {snapshotPublishedAt && (
              <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshotPublishedAt)}</span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // SPLIT style — two-tone split card (verdict | question)
  // ═══════════════════════════════════════════════════
  if (cardStyle === "split") {
    const splitBg = answerState?.colorClass.includes("destructive") ? "bg-destructive/[0.06] dark:bg-destructive/[0.12]"
      : answerState?.colorClass.includes("positive") ? "bg-positive/[0.06] dark:bg-[#4EDEA3]/[0.12]"
      : "bg-muted/50 dark:bg-white/[0.04]";

    return (
      <Link href={`/topics/${slug}`}>
        <div
          className="group rounded-2xl animate-card-enter h-full bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm overflow-hidden"
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          <div className="flex flex-col sm:flex-row">
            {/* Verdict side */}
            <div className={`${splitBg} sm:w-1/3 p-5 flex flex-col justify-center items-center sm:items-start`}>
              {answerState && (
                <span className={`text-xl sm:text-2xl font-black ${answerState.colorClass} leading-tight`}>{answerState.label}</span>
              )}
              {confidence !== null && (
                <span className="text-xs font-mono text-muted-foreground mt-1">{pct}%</span>
              )}
            </div>
            {/* Question side */}
            <div className="flex-1 p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
              </div>
              <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
              {oneLiner && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{oneLiner}</p>
              )}
              {snapshotPublishedAt && (
                <p className="text-[10px] text-muted-foreground/50 mt-2">{timeAgo(snapshotPublishedAt)}</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // METER style — horizontal bar meter dominates
  // ═══════════════════════════════════════════════════
  if (cardStyle === "meter") {
    const meterColor = answerState?.colorClass.includes("destructive") ? "bg-destructive"
      : answerState?.colorClass.includes("positive") ? "bg-positive dark:bg-[#4EDEA3]"
      : "bg-navy dark:bg-[#00DAF3]";

    return (
      <Link href={`/topics/${slug}`}>
        <div
          className="group rounded-2xl p-5 animate-card-enter h-full bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm"
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
            {snapshotPublishedAt && (
              <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshotPublishedAt)}</span>
            )}
          </div>
          <p className="font-semibold text-base text-foreground leading-snug mb-3">{questionText}</p>

          {/* Big meter */}
          <div className="mb-3">
            <div className="h-3 w-full rounded-full bg-border/30 dark:bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full ${meterColor} animate-bar-fill`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground/60">0%</span>
              <span className="text-xs font-bold font-mono text-foreground">{pct}%</span>
              <span className="text-[9px] text-muted-foreground/60">100%</span>
            </div>
          </div>

          {answerState && (
            <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>
          )}
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // SPOTLIGHT style — verdict as hero, question secondary
  // ═══════════════════════════════════════════════════
  if (cardStyle === "spotlight") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className={`group rounded-2xl p-5 animate-card-enter h-full bg-gradient-to-br ${catBg} bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm`}
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          {/* Giant verdict */}
          {answerState && (
            <div className="mb-3">
              <span className={`text-2xl font-black ${answerState.colorClass} leading-none`}>{answerState.label}</span>
            </div>
          )}
          <p className="font-semibold text-sm text-foreground leading-snug mb-2">{questionText}</p>
          <div className="flex items-center gap-3">
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
            {confidence !== null && (
              <span className="text-[10px] font-mono font-bold text-muted-foreground">{pct}%</span>
            )}
            {snapshotPublishedAt && (
              <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshotPublishedAt)}</span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // TICKER style — compact inline like a stock ticker
  // ═══════════════════════════════════════════════════
  if (cardStyle === "ticker") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className="group rounded-2xl animate-card-enter h-full bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm overflow-hidden"
          style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
        >
          <div className="flex items-center p-4 gap-4">
            {/* Confidence circle */}
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${answerState?.colorClass.includes("destructive") ? "bg-destructive/10" : answerState?.colorClass.includes("positive") ? "bg-positive/10 dark:bg-[#4EDEA3]/10" : "bg-muted"}`}>
              <span className="text-sm font-black font-mono text-foreground">{pct}</span>
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground leading-snug truncate">{questionText}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`h-1 w-1 rounded-full ${dotColor}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{category}</span>
                {answerState && (
                  <span className={`text-[11px] font-bold ${answerState.colorClass}`}>{answerState.label}</span>
                )}
              </div>
            </div>
            {/* Timestamp */}
            {snapshotPublishedAt && (
              <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{timeAgo(snapshotPublishedAt)}</span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ═══════════════════════════════════════════════════
  // MINIMAL style — clean, text-first with confidence bar
  // ═══════════════════════════════════════════════════
  return (
    <Link href={`/topics/${slug}`}>
      <div
        className="group rounded-2xl p-5 animate-card-enter h-full bg-card card-shadow-rich dark:border dark:border-white/5 hover-lift-sm"
        style={{ animationDelay: `${compactDelay}ms`, opacity: 0 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{category ?? "Signal"}</span>
          {snapshotPublishedAt && (
            <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(snapshotPublishedAt)}</span>
          )}
        </div>

        <p className="font-semibold text-base text-foreground leading-snug mb-3">{questionText}</p>

        {answerState && (
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>
          </div>
        )}

        {/* Horizontal confidence bar */}
        {confidence !== null && (
          <div className="flex items-center gap-2 mt-3">
            <div className="h-1.5 flex-1 rounded-full bg-border/40 dark:bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${answerState?.colorClass.includes("destructive") ? "bg-destructive" : answerState?.colorClass.includes("positive") ? "bg-positive dark:bg-[#4EDEA3]" : "bg-muted-foreground/30"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold font-mono text-muted-foreground w-7 text-right">{pct}%</span>
          </div>
        )}

        {oneLiner && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{oneLiner}</p>
        )}
      </div>
    </Link>
  );
}
