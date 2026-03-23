import Link from "next/link";
import { getAnswerState } from "@/lib/answer-state";

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
  if (direction === "down" && (category === "disasters" || category === "geopolitics")) return "bg-positive";
  if (category === "crypto") return "bg-warning";
  if (category === "disasters" || category === "geopolitics") return "bg-destructive";
  return "bg-positive";
}

function getBarColor(answerColorClass: string): string {
  if (answerColorClass.includes("destructive")) return "bg-destructive";
  if (answerColorClass.includes("warning")) return "bg-warning";
  return "bg-navy";
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return "High Confidence";
  if (confidence >= 0.5) return "Med Confidence";
  return "Low Confidence";
}

function getStatusIndicator(direction: string | null, category: string | null): { icon: string; label: string } {
  if (direction === "up" && (category === "disasters" || category === "geopolitics")) {
    return { icon: "\u26A0", label: "Elevated Alert" };
  }
  if (direction === "up") return { icon: "\u2197", label: "Trending Up" };
  if (direction === "down") return { icon: "\u2198", label: "Trending Down" };
  if (direction === "stable") return { icon: "\u2194", label: "Neutral Shift" };
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
  const barColor = answerState ? getBarColor(answerState.colorClass) : "bg-navy";
  const confLabelColor = answerState?.colorClass ?? "text-navy";
  const status = getStatusIndicator(direction, category);
  const isFresh = freshness === "fresh";

  const answerBorderColor = answerState?.colorClass.includes("destructive")
    ? "border-destructive"
    : answerState?.colorClass.includes("warning")
      ? "border-warning"
      : "border-navy";

  const answerBgColor = answerState?.colorClass.includes("destructive")
    ? "bg-destructive/5"
    : answerState?.colorClass.includes("warning")
      ? "bg-warning/5"
      : "bg-navy/[0.03]";

  if (variant === "hero") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className={`group bg-white rounded-3xl p-8 shadow-[0_20px_60px_rgba(11,19,38,0.04)] hover-lift animate-card-enter ${isFresh ? "animate-glow-breathe" : ""}`}
          style={{ contain: "layout style" }}
        >
          {/* 1. Category pill — delay-100 */}
          <div className="flex justify-between items-start mb-6 animate-fade-in delay-100" style={{ opacity: 0 }}>
            <div className="flex items-center gap-2 bg-secondary/10 px-3 py-1.5 rounded-full">
              <span className="relative h-2 w-2 flex-shrink-0">
                <span className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-live`} />
                <span className={`relative block h-2 w-2 rounded-full ${dotColor}`} />
              </span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {category ?? "Signal"}
              </span>
            </div>
            {snapshotPublishedAt && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {timeAgo(snapshotPublishedAt)}
              </span>
            )}
          </div>

          {/* 2. Question text — delay-200 */}
          <h2
            className="text-2xl sm:text-3xl font-semibold leading-snug text-navy mb-4 animate-slide-up delay-200"
            style={{ opacity: 0 }}
          >
            {questionText}
          </h2>

          {/* 3. Confidence bar — delay-400 (GPU: scaleX, not width) */}
          {confidence !== null && (
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full animate-bar-fill delay-400`}
                  style={{ transform: "scaleX(0)", transformOrigin: "left" }}
                />
              </div>
              {/* 4. Confidence number — delay-600 */}
              <span
                className={`text-sm font-bold ${confLabelColor} whitespace-nowrap animate-number-reveal delay-600`}
                style={{ opacity: 0 }}
              >
                {pct}% Confidence
              </span>
            </div>
          )}

          {/* 5. Answer block — delay-700 (slides from left) */}
          {answerState && oneLiner && (
            <div
              className={`${answerBgColor} rounded-2xl p-6 border-l-4 ${answerBorderColor} animate-answer-reveal delay-700`}
              style={{ opacity: 0 }}
            >
              <p className="text-muted-foreground leading-relaxed">
                <span className={`font-bold ${answerState.colorClass}`}>
                  {answerState.label}.
                </span>{" "}
                {oneLiner}
              </p>
            </div>
          )}

          {/* 6. Status row — delay-800 (last to appear) */}
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
              <span className={`flex items-center gap-1.5 text-sm font-bold ${answerState.colorClass}`}>
                <span>{status.icon}</span>
                {status.label}
              </span>
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
        className="group bg-white rounded-2xl p-5 shadow-[0_10px_40px_rgba(11,19,38,0.03)] hover-lift-sm animate-card-enter h-full"
        style={{ contain: "layout style", animationDelay: `${compactDelay}ms`, opacity: 0 }}
      >
        {/* Category pill */}
        <div className="flex items-center gap-2 mb-3">
          <span className="relative h-1.5 w-1.5 flex-shrink-0">
            <span className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-live`} />
            <span className={`relative block h-1.5 w-1.5 rounded-full ${dotColor}`} />
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {category ?? "Signal"}
          </span>
        </div>

        {/* Question */}
        <p className="font-semibold text-sm text-navy leading-snug mb-3">
          {questionText}
        </p>

        {/* Confidence bar (GPU: scaleX) */}
        {confidence !== null && (
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-0.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full animate-bar-fill`}
                style={{ transform: "scaleX(0)", transformOrigin: "left", animationDelay: `${compactDelay + 200}ms` }}
              />
            </div>
            <span className={`text-[11px] font-bold ${confLabelColor} whitespace-nowrap`}>
              {getConfidenceLabel(confidence)}
            </span>
          </div>
        )}

        {/* Answer state */}
        {answerState && (
          <p className={`text-xs font-bold ${answerState.colorClass}`}>
            {answerState.label}
          </p>
        )}

        {oneLiner && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
            {oneLiner}
          </p>
        )}
      </div>
    </Link>
  );
}
