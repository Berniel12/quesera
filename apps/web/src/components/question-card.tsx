import Link from "next/link";
import { getAnswerState } from "@/lib/answer-state";

// Multiple images per category — rotated by slug hash for variety
const CATEGORY_IMAGE_POOL: Record<string, string[]> = {
  macro: [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=70&auto=format", // trading floor charts
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=900&q=70&auto=format", // dollar bills
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=900&q=70&auto=format", // stock ticker
    "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=900&q=70&auto=format", // financial district
  ],
  crypto: [
    "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=900&q=70&auto=format", // bitcoin gold
    "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=900&q=70&auto=format", // ethereum
    "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=900&q=70&auto=format", // crypto coins
    "https://images.unsplash.com/photo-1640340434855-6084b1f4901c?w=900&q=70&auto=format", // blockchain concept
  ],
  politics: [
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=900&q=70&auto=format", // capitol building
    "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=900&q=70&auto=format", // american flag
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=900&q=70&auto=format", // white house
    "https://images.unsplash.com/photo-1575320181282-9afab399332c?w=900&q=70&auto=format", // voting
  ],
  geopolitics: [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=70&auto=format", // earth from space
    "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=900&q=70&auto=format", // world map
    "https://images.unsplash.com/photo-1589519160732-57fc498494f8?w=900&q=70&auto=format", // UN flags
    "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=900&q=70&auto=format", // globe
  ],
  sports: [
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900&q=70&auto=format", // stadium lights
    "https://images.unsplash.com/photo-1461896836934-bd45ba8fcb39?w=900&q=70&auto=format", // basketball
    "https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=900&q=70&auto=format", // soccer
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=900&q=70&auto=format", // athlete
  ],
  disasters: [
    "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=900&q=70&auto=format", // storm clouds
    "https://images.unsplash.com/photo-1559060017-445fb9722f2a?w=900&q=70&auto=format", // wildfire
    "https://images.unsplash.com/photo-1509803874385-db7c23652552?w=900&q=70&auto=format", // lightning
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=900&q=70&auto=format", // dramatic sky
  ],
  tech: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&q=70&auto=format", // circuits
    "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=900&q=70&auto=format", // AI concept
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=900&q=70&auto=format", // laptop code
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&q=70&auto=format", // cybersecurity
  ],
  entertainment: [
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=70&auto=format", // concert lights
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=70&auto=format", // live performance
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=900&q=70&auto=format", // stage
    "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=900&q=70&auto=format", // cinema
  ],
};

// Pick image from pool based on slug for consistent variety
function getCategoryImage(category: string | null, slug: string): string | null {
  if (!category) return null;
  const pool = CATEGORY_IMAGE_POOL[category];
  if (!pool || pool.length === 0) return null;
  // Simple hash from slug to pick consistent image
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

// Category accent stripe color
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

// Category gradient class for card background tint
const CATEGORY_GRADIENT: Record<string, string> = {
  macro: "cat-gradient-macro",
  crypto: "cat-gradient-crypto",
  politics: "cat-gradient-politics",
  geopolitics: "cat-gradient-geopolitics",
  sports: "cat-gradient-sports",
  disasters: "cat-gradient-disasters",
  tech: "cat-gradient-tech",
  entertainment: "cat-gradient-entertainment",
};

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

// Category border for compact cards
const CATEGORY_BORDER: Record<string, string> = {
  macro: "border-l-navy dark:border-l-[#00DAF3]",
  crypto: "border-l-[#00DAF3]",
  politics: "border-l-slate-500 dark:border-l-[#00DAF3]",
  geopolitics: "border-l-destructive",
  sports: "border-l-positive dark:border-l-[#4EDEA3]",
  disasters: "border-l-warning",
  tech: "border-l-violet-500 dark:border-l-violet-400",
  entertainment: "border-l-pink-500 dark:border-l-pink-400",
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

function getStatusIndicator(direction: string | null, category: string | null): { icon: string; label: string } {
  if (direction === "up" && (category === "disasters" || category === "geopolitics")) {
    return { icon: "\u26A0", label: "Elevated" };
  }
  if (direction === "up") return { icon: "\u2197", label: "Trending Up" };
  if (direction === "down") return { icon: "\u2198", label: "Trending Down" };
  if (direction === "stable") return { icon: "\u2192", label: "Stable" };
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

  const dotColor = category ? (CATEGORY_DOT[category] ?? "bg-muted-foreground") : "bg-muted-foreground";
  const status = getStatusIndicator(direction, category);
  const isFresh = freshness === "fresh";
  const catGradient = category ? (CATEGORY_GRADIENT[category] ?? "") : "";
  const catBorder = category ? (CATEGORY_BORDER[category] ?? "") : "";
  const heroImage = getCategoryImage(category, slug);

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

  // ── Hero variant — large, image-rich, dramatic ──
  if (variant === "hero") {
    return (
      <Link href={`/topics/${slug}`}>
        <div
          className={`group relative overflow-hidden rounded-[2rem] animate-card-enter
            bg-card
            card-shadow-rich
            dark:border dark:border-white/5
            hover-lift ${isFresh ? "animate-glow-breathe" : ""}`}
          style={{ contain: "layout style" }}
        >
          {/* Category accent stripe */}
          {category && CATEGORY_ACCENT[category] && (
            <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${CATEGORY_ACCENT[category]} z-20`} />
          )}

          {/* Full-bleed background image — visible and atmospheric */}
          {heroImage && (
            <div className="absolute inset-0 z-0">
              <img
                src={heroImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-25 dark:brightness-[0.5]"
                loading="lazy"
              />
              {/* Gradient overlay: strong on left (text), fading on right (image shows through) */}
              <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/50 dark:from-card dark:via-card/80 dark:to-card/30" />
              {/* Bottom fade for clean text */}
              <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
            </div>
          )}

          {/* Dark mode: glow accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 blur-[120px] hidden dark:block z-0" />

          <div className="relative z-10 p-8 md:p-10 min-h-[280px] flex flex-col justify-end">
            {/* Category pill + status */}
            <div className="flex items-center gap-3 mb-4 animate-fade-in delay-100" style={{ opacity: 0 }}>
              <span className="relative h-2 w-2 flex-shrink-0">
                <span className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-live`} />
                <span className={`relative block h-2 w-2 rounded-full ${dotColor}`} />
              </span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                {category ?? "Signal"}
              </span>
              {direction && direction !== "stable" && direction !== "unknown" && (
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                  {status.icon} {status.label}
                </span>
              )}
              {snapshotPublishedAt && (
                <span className="text-[10px] text-muted-foreground/50 ml-auto">
                  {timeAgo(snapshotPublishedAt)}
                </span>
              )}
            </div>

            {/* Question — editorial scale */}
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground mb-5 animate-slide-up delay-200"
              style={{ opacity: 0 }}
            >
              {questionText}
            </h2>

            {/* Answer block with strong visual treatment */}
            {answerState && oneLiner && (
              <div
                className={`${answerBgColor} rounded-2xl p-5 border-l-4 ${answerBorderColor} backdrop-blur-sm animate-answer-reveal delay-700`}
                style={{ opacity: 0 }}
              >
                <p className="text-muted-foreground dark:text-[#C6C6CD] leading-relaxed">
                  <span className="font-bold text-foreground dark:text-primary text-lg">
                    {answerState.label}.
                  </span>{" "}
                  {oneLiner}
                </p>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // ── Compact variant — rich with image thumbnail, category accent, confidence ring ──
  const compactDelay = staggerIndex * 150;
  const compactImage = getCategoryImage(category, slug);

  return (
    <Link href={`/topics/${slug}`}>
      <div
        className={`group relative overflow-hidden rounded-2xl animate-card-enter h-full
          bg-card ${catGradient}
          card-shadow-rich
          dark:border dark:border-white/5
          hover-lift-sm`}
        style={{ contain: "layout style", animationDelay: `${compactDelay}ms`, opacity: 0 }}
      >
        {/* Subtle left accent border */}
        {catBorder && (
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${catBorder.replace("border-l-", "bg-")}`} />
        )}

        <div className="flex items-stretch">
          {/* Image thumbnail on right — visible and beautiful */}
          {compactImage && (
            <div className="hidden sm:block relative w-28 flex-shrink-0 overflow-hidden">
              <img
                src={compactImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40 group-hover:opacity-80 dark:group-hover:opacity-60 transition-opacity duration-500 group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-card via-card/40 to-transparent" />
            </div>
          )}

          <div className="flex-1 min-w-0 p-5 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              {/* Category + status row */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="relative h-1.5 w-1.5 flex-shrink-0">
                  <span className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-live`} />
                  <span className={`relative block h-1.5 w-1.5 rounded-full ${dotColor}`} />
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  {category ?? "Signal"}
                </span>
                {direction && direction !== "stable" && direction !== "unknown" && (
                  <span className="text-[10px] font-medium text-muted-foreground/70">
                    {status.icon}
                  </span>
                )}
              </div>

              {/* Question */}
              <p className="font-semibold text-base text-foreground leading-snug mb-3">
                {questionText}
              </p>

              {/* Answer state — colored, bold */}
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
                <p className="text-[10px] text-muted-foreground/60 mt-2.5">
                  Updated {timeAgo(snapshotPublishedAt)}
                </p>
              )}
            </div>

            {/* Confidence ring */}
            {confidence !== null && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-1">
                <div className="relative h-12 w-12 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-border dark:text-white/10" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.round(confidence * 94)} 94`}
                      className={answerState?.colorClass.includes("destructive") ? "text-destructive" : answerState?.colorClass.includes("warning") ? "text-warning dark:text-[#00DAF3]" : "text-navy dark:text-[#00DAF3]"}
                      style={{ stroke: "currentColor" }}
                    />
                  </svg>
                  <span className="absolute text-[11px] font-bold font-mono text-foreground dark:text-primary">
                    {Math.round(confidence * 100)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
