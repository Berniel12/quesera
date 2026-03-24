import Link from "next/link";
import { getAnswerState } from "@/lib/answer-state";

// Abstract, diverse, beautiful imagery — each card looks unique
// NOT literal category photos. Atmospheric, editorial, varied.
const CARD_IMAGE_POOL: string[] = [
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=600&q=70&auto=format", // abstract blue gradient
  "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&q=70&auto=format", // marble texture pink
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&q=70&auto=format", // colorful gradient
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=70&auto=format", // abstract 3D shapes
  "https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=600&q=70&auto=format", // purple abstract waves
  "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=70&auto=format", // geometric abstract
  "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=600&q=70&auto=format", // abstract liquid art
  "https://images.unsplash.com/photo-1614851099175-e5b30eb6f696?w=600&q=70&auto=format", // 3D abstract blobs
  "https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?w=600&q=70&auto=format", // paint swirls
  "https://images.unsplash.com/photo-1604076913837-52ab5f7c1ac2?w=600&q=70&auto=format", // dark abstract texture
  "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=600&q=70&auto=format", // neon blue abstract
  "https://images.unsplash.com/photo-1567359781514-3b964e2b04d6?w=600&q=70&auto=format", // warm gradient
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=70&auto=format", // abstract architecture
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=70&auto=format", // abstract mesh gradient
  "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=600&q=70&auto=format", // watercolor abstract
  "https://images.unsplash.com/photo-1633186223985-73bd2ce6e868?w=600&q=70&auto=format", // 3D abstract dark
];

// Pick unique image per card from abstract pool — each card looks different
function getCardImage(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  return CARD_IMAGE_POOL[Math.abs(hash) % CARD_IMAGE_POOL.length];
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
  const heroImage = getCardImage(slug);

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
  const compactImage = getCardImage(slug);

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
