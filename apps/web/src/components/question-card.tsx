import Link from "next/link";
import { getAnswerState } from "@/lib/answer-state";
import { ProbabilityGauge } from "@/components/probability-gauge";

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

function getCategoryDotColor(category: string | null, direction: string | null): string {
  if (direction === "up" && (category === "disasters" || category === "geopolitics")) return "bg-destructive";
  if (category === "crypto") return "bg-warning dark:bg-[#00DAF3]";
  if (category === "disasters" || category === "geopolitics") return "bg-destructive";
  return "bg-positive dark:bg-[#4EDEA3]";
}

function getStatusIndicator(direction: string | null, category: string | null): { icon: string; label: string } {
  if (direction === "up" && (category === "disasters" || category === "geopolitics")) {
    return { icon: "\u26A0", label: "Elevated Alert" };
  }
  if (direction === "up") return { icon: "\u2197", label: "Trending Up" };
  if (direction === "down") return { icon: "\u2198", label: "Trending Down" };
  if (direction === "stable") return { icon: "\u2192", label: "Neutral Shift" };
  return { icon: "\u2022", label: "Monitoring" };
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
  const dotColor = getCategoryDotColor(category, direction);
  const status = getStatusIndicator(direction, category);
  const isFresh = freshness === "fresh";

  const answerBorderColor = answerState?.colorClass.includes("destructive")
    ? "border-destructive"
    : answerState?.colorClass.includes("warning")
      ? "border-warning dark:border-[#00DAF3]"
      : "border-navy dark:border-[#00DAF3]";

  const answerBgColor = answerState?.colorClass.includes("destructive")
    ? "bg-destructive/5 dark:bg-destructive/10"
    : answerState?.colorClass.includes("warning")
      ? "bg-warning/5 dark:bg-[#00DAF3]/10"
      : "bg-navy/[0.03] dark:bg-[#00DAF3]/10";

  if (variant === "hero") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className={`group relative overflow-hidden rounded-[2rem] animate-card-enter
            bg-white dark:glass-panel
            editorial-shadow dark:shadow-none
            dark:border dark:border-white/5
            hover-lift ${isFresh ? "animate-glow-breathe" : ""}`}
          style={{ contain: "layout style" }}
        >
          {/* Dark mode: horizon glow overlay */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -z-10 hidden dark:block" />

          <div className="flex flex-col md:flex-row gap-6 p-8 md:p-10">
            {/* Left: question + answer */}
            <div className="flex-1 min-w-0">
              {/* Category pill */}
              <div className="flex items-center gap-2 mb-6 animate-fade-in delay-100" style={{ opacity: 0 }}>
                <span className="relative h-2 w-2 flex-shrink-0">
                  <span className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-live`} />
                  <span className={`relative block h-2 w-2 rounded-full ${dotColor}`} />
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  {category ?? "Signal"}
                </span>
              </div>

              {/* Question — editorial scale */}
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground mb-6 animate-slide-up delay-200"
                style={{ opacity: 0 }}
              >
                {questionText}
              </h2>

              {/* Confidence bar */}
              {confidence !== null && (
                <div className="flex items-center gap-4 mb-8 animate-fade-in delay-400" style={{ opacity: 0 }}>
                  <div className="flex-1 h-1.5 bg-secondary dark:bg-[#2D3449] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground dark:bg-primary rounded-full animate-bar-fill dark:neon-bar"
                      style={{ transform: "scaleX(0)", transformOrigin: "left" }}
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground dark:text-primary whitespace-nowrap animate-number-reveal delay-600" style={{ opacity: 0 }}>
                    {pct}% Confidence
                  </span>
                </div>
              )}

              {/* Answer block */}
              {answerState && oneLiner && (
                <div
                  className={`${answerBgColor} rounded-2xl p-6 border-l-4 ${answerBorderColor} animate-answer-reveal delay-700`}
                  style={{ opacity: 0 }}
                >
                  <p className="text-muted-foreground dark:text-[#C6C6CD] leading-relaxed">
                    <span className="font-bold text-foreground dark:text-primary">
                      {answerState.label}.
                    </span>{" "}
                    {oneLiner}
                  </p>
                </div>
              )}

              {/* Status row */}
              <div
                className="mt-6 flex items-center justify-between animate-status-fade delay-800"
                style={{ opacity: 0 }}
              >
                {snapshotPublishedAt && (
                  <span className="text-xs text-muted-foreground">
                    Updated {timeAgo(snapshotPublishedAt)}
                  </span>
                )}
                {answerState && (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-foreground dark:text-primary">
                    <span>{status.icon}</span>
                    {status.label}
                  </span>
                )}
              </div>
            </div>

            {/* Right: probability gauge (desktop) */}
            {confidence !== null && answerState && (
              <div className="hidden md:flex flex-shrink-0 items-center justify-center">
                <ProbabilityGauge
                  confidence={confidence}
                  label={answerState.label}
                  size="lg"
                />
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ── Compact variant ──
  const compactDelay = staggerIndex * 150;

  return (
    <Link href={`/topics/${slug}`}>
      <div
        className="group rounded-2xl p-6 animate-card-enter h-full
          bg-white dark:glass-panel
          editorial-shadow dark:shadow-none
          dark:border dark:border-white/5
          hover-lift-sm"
        style={{ contain: "layout style", animationDelay: `${compactDelay}ms`, opacity: 0 }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Category */}
            <div className="flex items-center gap-2 mb-2">
              <span className="relative h-1.5 w-1.5 flex-shrink-0">
                <span className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-live`} />
                <span className={`relative block h-1.5 w-1.5 rounded-full ${dotColor}`} />
              </span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                {category ?? "Signal"}
              </span>
            </div>

            {/* Question */}
            <p className="font-semibold text-base text-foreground leading-snug mb-3">
              {questionText}
            </p>

            {/* Answer state */}
            {answerState && (
              <p className="text-sm font-bold text-foreground dark:text-primary">
                {answerState.label}
              </p>
            )}

            {oneLiner && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {oneLiner}
              </p>
            )}
          </div>

          {/* Mini gauge */}
          {confidence !== null && answerState && (
            <div className="flex-shrink-0 pt-1">
              <ProbabilityGauge
                confidence={confidence}
                label=""
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
