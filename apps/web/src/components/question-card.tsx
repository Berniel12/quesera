import Link from "next/link";
import { getAnswerState } from "@/lib/answer-state";
import { getTeamEntity } from "@/lib/team-entities";

// Strong category colors — visible, not subtle
const CAT_COLOR: Record<string, { dot: string; bg: string; border: string; text: string; fill: string }> = {
  macro:         { dot: "bg-blue-500",    bg: "dark:from-blue-500/20 dark:to-blue-500/5 from-blue-50 to-white",       border: "border-blue-500/30",    text: "text-blue-600 dark:text-blue-400",    fill: "bg-blue-500 dark:bg-blue-400" },
  crypto:        { dot: "bg-amber-500",   bg: "dark:from-amber-500/20 dark:to-amber-500/5 from-amber-50 to-white",     border: "border-amber-500/30",   text: "text-amber-600 dark:text-amber-400",  fill: "bg-amber-500 dark:bg-amber-400" },
  politics:      { dot: "bg-indigo-500",  bg: "dark:from-indigo-500/20 dark:to-indigo-500/5 from-indigo-50 to-white",   border: "border-indigo-500/30",  text: "text-indigo-600 dark:text-indigo-400", fill: "bg-indigo-500 dark:bg-indigo-400" },
  geopolitics:   { dot: "bg-red-500",     bg: "dark:from-red-500/20 dark:to-red-500/5 from-red-50 to-white",           border: "border-red-500/30",     text: "text-red-600 dark:text-red-400",      fill: "bg-red-500 dark:bg-red-400" },
  sports:        { dot: "bg-emerald-500", bg: "dark:from-emerald-500/20 dark:to-emerald-500/5 from-emerald-50 to-white", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", fill: "bg-emerald-500 dark:bg-emerald-400" },
  disasters:     { dot: "bg-orange-500",  bg: "dark:from-orange-500/25 dark:to-orange-500/5 from-orange-50 to-white",   border: "border-orange-500/40",  text: "text-orange-600 dark:text-orange-400", fill: "bg-orange-500 dark:bg-orange-400" },
  tech:          { dot: "bg-violet-500",  bg: "dark:from-violet-500/20 dark:to-violet-500/5 from-violet-50 to-white",   border: "border-violet-500/30",  text: "text-violet-600 dark:text-violet-400", fill: "bg-violet-500 dark:bg-violet-400" },
  entertainment: { dot: "bg-pink-500",    bg: "dark:from-pink-500/20 dark:to-pink-500/5 from-pink-50 to-white",         border: "border-pink-500/30",    text: "text-pink-600 dark:text-pink-400",    fill: "bg-pink-500 dark:bg-pink-400" },
};
const DEFAULT_CAT = { dot: "bg-muted-foreground", bg: "from-muted/20 to-transparent", border: "border-border", text: "text-muted-foreground", fill: "bg-muted-foreground" };

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
  return `${Math.floor(hours / 24)}d ago`;
}

type CardStyle = "gauge" | "bignum" | "arrow" | "alert" | "bar" | "pill" | "split" | "meter" | "spotlight" | "ticker";

function getCardStyle(slug: string, category: string | null, direction: string | null): CardStyle {
  if ((category === "disasters" || category === "geopolitics") && direction === "up") return "alert";
  if (direction === "up" || direction === "down") return "arrow";
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  const styles: CardStyle[] = ["gauge", "bignum", "bar", "pill", "split", "meter", "spotlight", "ticker"];
  return styles[Math.abs(hash) % styles.length];
}

export function QuestionCard({
  questionText, slug, category, direction, confidence, freshness,
  oneLiner, snapshotPublishedAt, variant = "hero", staggerIndex = 0,
}: QuestionCardProps) {
  const answerState = direction && confidence !== null
    ? getAnswerState({ direction, confidence, category, disagreement: 0 }) : null;
  const pct = confidence !== null ? Math.round(confidence * 100) : 0;
  const c = category ? (CAT_COLOR[category] ?? DEFAULT_CAT) : DEFAULT_CAT;
  const ts = snapshotPublishedAt ? timeAgo(snapshotPublishedAt) : "";
  const team = getTeamEntity(questionText);

  // ════════════════════════════════════════════
  // HERO — large editorial card
  // ════════════════════════════════════════════
  if (variant === "hero") {
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`group relative overflow-hidden rounded-2xl animate-card-enter bg-gradient-to-br ${c.bg} bg-card card-shadow-rich border-t-2 ${c.border} dark:border dark:border-white/5 dark:border-t-2 hover-lift`}>
          {team && (
            <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-30 transition-opacity">
              <img src={team.logoUrl} alt={team.name} className="h-16 w-16 object-contain" loading="lazy" />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-3">
              {team && (
                <div className={`h-6 w-6 rounded-md ${team.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <img src={team.logoUrl} alt={team.name} className="h-4 w-4 object-contain" />
                </div>
              )}
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${c.text}`}>{category ?? "Signal"}</span>
              {ts && <span className="text-[10px] text-muted-foreground/50 ml-auto">{ts}</span>}
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground mb-4">{questionText}</h2>
            {answerState && (
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-2xl sm:text-3xl font-black ${answerState.colorClass}`}>{answerState.headline}</span>
                {confidence !== null && (
                  <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                    <div className="h-2 flex-1 rounded-full bg-border/40 dark:bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${c.fill} animate-bar-fill`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {oneLiner && <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">{oneLiner}</p>}
          </div>
        </div>
      </Link>
    );
  }

  // ════════════════════════════════════════════
  // COMPACT VARIANTS
  // ════════════════════════════════════════════
  const delay = staggerIndex * 120;
  const style = getCardStyle(slug, category, direction);
  const base = "group rounded-2xl animate-card-enter h-full hover-lift-sm";
  const dark = "dark:border dark:border-white/5";

  // ── GAUGE — large SVG donut ring ──
  if (style === "gauge") {
    const r = 40, circ = 2 * Math.PI * r;
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} p-5 bg-card card-shadow-rich ${dark} border-t-2 ${c.border}`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="flex items-center gap-5">
            <div className="flex-shrink-0 relative h-20 w-20">
              <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                <circle cx="50" cy="50" r={r} fill="none" strokeWidth="5" className="stroke-border/20 dark:stroke-white/10" />
                <circle cx="50" cy="50" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * circ} ${circ}`} className={`${c.fill.replace("bg-", "stroke-")}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black font-mono text-foreground">{pct}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
              <p className="font-semibold text-base text-foreground leading-snug mt-0.5 mb-1.5">{questionText}</p>
              {answerState && <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>}
              {ts && <p className="text-[10px] text-muted-foreground/50 mt-1">{ts}</p>}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── BIGNUM — bold number in colored panel ──
  if (style === "bignum") {
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} bg-card card-shadow-rich ${dark} overflow-hidden`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="flex items-stretch min-h-[120px]">
            <div className={`flex-shrink-0 w-24 sm:w-28 flex flex-col items-center justify-center bg-gradient-to-b ${c.bg} border-r ${c.border}`}>
              <span className={`text-4xl font-black font-mono ${c.text}`}>{pct}</span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1">confidence</span>
            </div>
            <div className="flex-1 min-w-0 p-5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
              <p className="font-semibold text-base text-foreground leading-snug mt-0.5 mb-2">{questionText}</p>
              {answerState && <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>}
              {oneLiner && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{oneLiner}</p>}
              {ts && <p className="text-[10px] text-muted-foreground/50 mt-2">{ts}</p>}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── ARROW — direction indicator with colored accent ──
  if (style === "arrow") {
    const isUp = direction === "up";
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} p-5 bg-gradient-to-br ${c.bg} bg-card card-shadow-rich ${dark} border-l-[3px] ${c.border}`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${isUp ? "bg-emerald-500/10 dark:bg-emerald-400/15" : "bg-red-500/10 dark:bg-red-400/15"}`}>
              <svg viewBox="0 0 24 24" className={`h-6 w-6 ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isUp ? <path d="M7 17L17 7M17 7H7M17 7V17" /> : <path d="M7 7L17 17M17 17H7M17 17V7" />}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
                <span className={`text-[10px] font-bold ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>Moving {isUp ? "up" : "down"}</span>
              </div>
              <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
              {answerState && <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>}
              {oneLiner && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{oneLiner}</p>}
              {ts && <p className="text-[10px] text-muted-foreground/50 mt-2">{ts}</p>}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── ALERT — bold red warning ──
  if (style === "alert") {
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} bg-red-500/[0.05] dark:bg-red-500/[0.12] border-2 border-red-500/20 dark:border-red-400/30 card-shadow-rich overflow-hidden`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="bg-red-500/10 dark:bg-red-400/20 px-5 py-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400 animate-pulse-live" />
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-[0.12em]">{category} -- elevated</span>
            {ts && <span className="text-[10px] text-red-500/50 ml-auto">{ts}</span>}
          </div>
          <div className="p-5">
            <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
            {answerState && <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>}
            {oneLiner && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{oneLiner}</p>}
          </div>
        </div>
      </Link>
    );
  }

  // ── BAR — full-width animated confidence bar ──
  if (style === "bar") {
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} p-5 bg-card card-shadow-rich ${dark} border-t-2 ${c.border}`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
            {ts && <span className="text-[10px] text-muted-foreground/50 ml-auto">{ts}</span>}
          </div>
          <p className="font-semibold text-base text-foreground leading-snug mb-3">{questionText}</p>
          {answerState && <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>}
          <div className="mt-3">
            <div className="h-2.5 w-full rounded-full bg-border/30 dark:bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full ${c.fill} animate-bar-fill`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground/40">0%</span>
              <span className={`text-xs font-bold font-mono ${c.text}`}>{pct}%</span>
              <span className="text-[9px] text-muted-foreground/40">100%</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── PILL — verdict as colored pill badge ──
  if (style === "pill") {
    const pillClass = answerState?.colorClass.includes("destructive") ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : answerState?.colorClass.includes("positive") ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : `${c.fill}/10 ${c.text}`;
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} p-5 bg-card card-shadow-rich ${dark} border-t-2 ${c.border}`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
          </div>
          <p className="font-semibold text-base text-foreground leading-snug mb-3">{questionText}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {answerState && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${pillClass}`}>{answerState.headline}</span>
            )}
            {confidence !== null && <span className={`text-[11px] font-mono font-bold ${c.text}`}>{pct}%</span>}
            {ts && <span className="text-[10px] text-muted-foreground/50 ml-auto">{ts}</span>}
          </div>
        </div>
      </Link>
    );
  }

  // ── SPLIT — two-tone verdict / question ──
  if (style === "split") {
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} bg-card card-shadow-rich ${dark} overflow-hidden`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="flex flex-col sm:flex-row min-h-[120px]">
            <div className={`sm:w-2/5 p-5 flex flex-col justify-center bg-gradient-to-br ${c.bg}`}>
              {answerState && <span className={`text-xl sm:text-2xl font-black ${answerState.colorClass} leading-tight`}>{answerState.headline}</span>}
              {confidence !== null && <span className={`text-xs font-mono mt-1 ${c.text}`}>{pct}% confidence</span>}
            </div>
            <div className="flex-1 p-5 border-t sm:border-t-0 sm:border-l border-border/20 dark:border-white/5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
              <p className="font-semibold text-base text-foreground leading-snug mt-0.5 mb-1.5">{questionText}</p>
              {oneLiner && <p className="text-xs text-muted-foreground line-clamp-2">{oneLiner}</p>}
              {ts && <p className="text-[10px] text-muted-foreground/50 mt-2">{ts}</p>}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── METER — horizontal thermometer-style ──
  if (style === "meter") {
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} p-5 bg-card card-shadow-rich ${dark}`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
            {ts && <span className="text-[10px] text-muted-foreground/50 ml-auto">{ts}</span>}
          </div>
          <p className="font-semibold text-base text-foreground leading-snug mb-2">{questionText}</p>
          {answerState && <span className={`text-sm font-bold ${answerState.colorClass}`}>{answerState.label}</span>}
          {/* Thermometer meter */}
          <div className="mt-3 relative h-6 rounded-full bg-border/20 dark:bg-white/5 overflow-hidden">
            <div className={`h-full rounded-full ${c.fill} animate-bar-fill relative`} style={{ width: `${pct}%` }}>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">{pct}%</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── SPOTLIGHT — verdict dominates ──
  if (style === "spotlight") {
    return (
      <Link href={`/topics/${slug}`}>
        <div className={`${base} p-5 bg-gradient-to-br ${c.bg} bg-card card-shadow-rich ${dark} border-t-2 ${c.border}`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
          {answerState && <span className={`text-2xl font-black ${answerState.colorClass} leading-none mb-2 block`}>{answerState.headline}</span>}
          <p className="font-semibold text-sm text-foreground leading-snug mb-2">{questionText}</p>
          <div className="flex items-center gap-3">
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{category}</span>
            {confidence !== null && <span className={`text-[10px] font-mono font-bold ${c.text}`}>{pct}%</span>}
            {ts && <span className="text-[10px] text-muted-foreground/50 ml-auto">{ts}</span>}
          </div>
        </div>
      </Link>
    );
  }

  // ── TICKER — compact row ──
  return (
    <Link href={`/topics/${slug}`}>
      <div className={`${base} bg-card card-shadow-rich ${dark} overflow-hidden border-l-[3px] ${c.border}`} style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
        <div className="flex items-center p-4 gap-4">
          {team ? (
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${team.bgColor}`}>
              <img src={team.logoUrl} alt={team.name} className="h-6 w-6 object-contain" loading="lazy" />
            </div>
          ) : (
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-gradient-to-br ${c.bg}`}>
              <span className={`text-sm font-black font-mono ${c.text}`}>{pct}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground leading-snug truncate">{questionText}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`h-1 w-1 rounded-full ${c.dot}`} />
              <span className={`text-[10px] uppercase tracking-wider ${c.text}`}>{category}</span>
              {answerState && <span className={`text-[11px] font-bold ${answerState.colorClass}`}>{answerState.label}</span>}
            </div>
          </div>
          {ts && <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{ts}</span>}
        </div>
      </div>
    </Link>
  );
}
