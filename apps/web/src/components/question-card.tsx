import Link from "next/link";
import { getAnswerState } from "@/lib/answer-state";
import { ProbabilityGauge } from "@/components/probability-gauge";

// Category accent colors for top stripe
const CATEGORY_ACCENT: Record<string, string> = {
  macro: "from-navy/80 to-navy/20 dark:from-[#00DAF3]/60 dark:to-[#00DAF3]/10",
  crypto: "from-[#00DAF3]/80 to-[#00DAF3]/20 dark:from-[#00DAF3]/60 dark:to-transparent",
  politics: "from-slate-600/60 to-slate-600/10 dark:from-[#00DAF3]/40 dark:to-transparent",
  geopolitics: "from-destructive/60 to-destructive/10 dark:from-destructive/40 dark:to-transparent",
  sports: "from-positive/60 to-positive/10 dark:from-[#4EDEA3]/40 dark:to-transparent",
  disasters: "from-warning/60 to-warning/10 dark:from-warning/40 dark:to-transparent",
  tech: "from-violet-600/60 to-violet-600/10 dark:from-violet-400/40 dark:to-transparent",
  entertainment: "from-pink-500/60 to-pink-500/10 dark:from-pink-400/40 dark:to-transparent",
};

// Category → visual imagery (Unsplash static URLs, free tier)
const CATEGORY_IMAGES: Record<string, string> = {
  macro: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=60&auto=format", // stock market charts
  crypto: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=60&auto=format", // bitcoin/crypto
  politics: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&q=60&auto=format", // capitol building
  geopolitics: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=60&auto=format", // globe/world
  sports: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60&auto=format", // stadium
  disasters: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&q=60&auto=format", // storm/weather
  tech: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=60&auto=format", // technology/circuits
  entertainment: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=60&auto=format", // concert/entertainment
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
            bg-card
            editorial-shadow dark:shadow-none
            dark:border dark:border-white/5
            hover-lift ${isFresh ? "animate-glow-breathe" : ""}`}
          style={{ contain: "layout style" }}
        >
          {/* Category accent stripe at top */}
          {category && CATEGORY_ACCENT[category] && (
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${CATEGORY_ACCENT[category]}`} />
          )}

          {/* Background image overlay */}
          {category && CATEGORY_IMAGES[category] && (
            <div className="absolute inset-0 z-0">
              <img
                src={CATEGORY_IMAGES[category]}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-[0.15] dark:opacity-30 grayscale dark:brightness-[0.4] dark:mix-blend-overlay"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/60 dark:from-card dark:via-card/80 dark:to-card/40" />
            </div>
          )}

          {/* Dark mode: glow accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] hidden dark:block" />

          <div className="relative z-10 flex flex-col md:flex-row gap-6 p-8 md:p-10">
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

            </div>
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
          bg-card
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

            {/* Answer state — colored by sentiment */}
            {answerState && (
              <p className={`text-sm font-bold ${answerState.colorClass}`}>
                {answerState.label}
              </p>
            )}

            {oneLiner && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {oneLiner}
              </p>
            )}

            {snapshotPublishedAt && (
              <p className="text-[10px] text-muted-foreground/70 mt-2">
                Updated {timeAgo(snapshotPublishedAt)}
              </p>
            )}
          </div>

        </div>
      </div>
    </Link>
  );
}
