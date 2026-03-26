import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAnswerState } from "@/lib/answer-state";
import { getTeamEntity, getCompetitionAnswer, isCompetitionQuestion } from "@/lib/team-entities";
import Link from "next/link";
import {
  getInferredLocation,
  getTopicSuggestionsForLocation,
  type EffectiveLocation,
} from "@/lib/geo";

interface QuestionWithCard {
  question_text: string;
  slug: string;
  category: string | null;
  direction: string | null;
  confidence: number | null;
  freshness: string | null;
  one_liner: string | null;
  snapshot_published_at: string | null;
  topic_id: string;
}

// Category colors for bento cards
const CAT_ACCENT: Record<string, { label: string; border: string; text: string; glow: string; bg: string }> = {
  macro:         { label: "Finance",       border: "border-blue-500/30",    text: "text-blue-400",    glow: "shadow-[0_0_12px_rgba(59,130,246,0.4)]",  bg: "from-blue-500/15 to-blue-500/5" },
  crypto:        { label: "Crypto",        border: "border-amber-500/30",   text: "text-amber-400",   glow: "shadow-[0_0_12px_rgba(245,158,11,0.4)]",  bg: "from-amber-500/15 to-amber-500/5" },
  politics:      { label: "Politics",      border: "border-indigo-500/30",  text: "text-indigo-400",  glow: "shadow-[0_0_12px_rgba(99,102,241,0.4)]",  bg: "from-indigo-500/15 to-indigo-500/5" },
  geopolitics:   { label: "Geopolitics",   border: "border-red-500/30",     text: "text-red-400",     glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]",   bg: "from-red-500/15 to-red-500/5" },
  sports:        { label: "Sports",        border: "border-emerald-500/30", text: "text-emerald-400", glow: "shadow-[0_0_12px_rgba(16,185,129,0.4)]",  bg: "from-emerald-500/15 to-emerald-500/5" },
  disasters:     { label: "Weather",       border: "border-orange-500/30",  text: "text-orange-400",  glow: "shadow-[0_0_12px_rgba(249,115,22,0.4)]",  bg: "from-orange-500/15 to-orange-500/5" },
  tech:          { label: "Tech",          border: "border-violet-500/30",  text: "text-violet-400",  glow: "shadow-[0_0_12px_rgba(139,92,246,0.4)]",  bg: "from-violet-500/15 to-violet-500/5" },
  entertainment: { label: "Entertainment", border: "border-pink-500/30",    text: "text-pink-400",    glow: "shadow-[0_0_12px_rgba(236,72,153,0.4)]",  bg: "from-pink-500/15 to-pink-500/5" },
};
const DEFAULT_ACCENT = { label: "Signal", border: "border-white/10", text: "text-muted-foreground", glow: "", bg: "from-white/5 to-transparent" };

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Curated photos by category (user-selected Unsplash)
// Curated photo pools — 4-6 per category for variety
const CATEGORY_PHOTOS: Record<string, string[]> = {
  crypto: [
    "https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1640340434855-6084b1f4901c?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=70&auto=format",
  ],
  sports: [
    "https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1461896836934-bd45ba8fcb39?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=70&auto=format",
  ],
  macro: [
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1604594849809-dfedbc827105?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=70&auto=format",
  ],
  disasters: [
    "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1509803874385-db7c23652552?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1559060017-445fb9722f2a?w=800&q=70&auto=format",
  ],
  geopolitics: [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&q=70&auto=format",
  ],
  tech: [
    "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=70&auto=format",
  ],
  politics: [
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1575320181282-9afab399332c?w=800&q=70&auto=format",
  ],
  entertainment: [
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=70&auto=format",
    "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=800&q=70&auto=format",
  ],
};

function getCatPhoto(category: string | null, slug: string): string | null {
  if (!category) return null;
  const pool = CATEGORY_PHOTOS[category];
  if (!pool) return null;
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

export default async function LandingPage() {
  const supabase = await createClient();

  const reqHeaders = await headers();
  const inferred = getInferredLocation(reqHeaders);
  const effectiveLocation: EffectiveLocation = {
    country: inferred.country,
    region: inferred.region,
    city: null,
    source: inferred.country ? "inferred" : "none",
    isConfirmed: false,
  };
  const suggestedSlugs = new Set(getTopicSuggestionsForLocation(effectiveLocation));

  const { data: rawQuestions } = await supabase
    .from("question_wrappers")
    .select(`question_text, display_context, is_featured, sort_order,
      topics!inner (id, slug, category, status, is_public)`)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true });

  const { data: allCards } = await supabase
    .from("public_topic_cards")
    .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner, snapshot_published_at")
    .order("snapshot_published_at", { ascending: false });

  const cards = (allCards ?? []) as Array<{
    topic_id: string; canonical_name: string; slug: string; category: string | null;
    direction: string | null; confidence: number | null; freshness: string | null;
    one_liner: string | null; snapshot_published_at: string | null;
  }>;
  const cardByTopicId = new Map(cards.map((c) => [c.topic_id, c]));

  const seenSlugs = new Set<string>();
  const allQuestions: QuestionWithCard[] = [];

  for (const raw of rawQuestions ?? []) {
    const r = raw as unknown as {
      question_text: string; display_context: string | null; is_featured: boolean; sort_order: number;
      topics: Array<{ id: string; slug: string; category: string | null; status: string; is_public: boolean }> | { id: string; slug: string; category: string | null; status: string; is_public: boolean };
    };
    const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics;
    if (!topic || topic.status !== "active" || !topic.is_public) continue;
    const card = cardByTopicId.get(topic.id);
    if (!card) continue;
    if (seenSlugs.has(topic.slug)) continue;
    seenSlugs.add(topic.slug);
    allQuestions.push({
      question_text: r.question_text, slug: topic.slug, category: topic.category,
      direction: card.direction, confidence: card.confidence, freshness: card.freshness,
      one_liner: card.one_liner, snapshot_published_at: card.snapshot_published_at, topic_id: topic.id,
    });
  }

  allQuestions.sort((a, b) => {
    const aFresh = (a.freshness === "fresh" || a.freshness === "aging") ? 1 : 0;
    const bFresh = (b.freshness === "fresh" || b.freshness === "aging") ? 1 : 0;
    if (bFresh !== aFresh) return bFresh - aFresh;
    const aMoving = (a.direction === "up" || a.direction === "down") ? 1 : 0;
    const bMoving = (b.direction === "up" || b.direction === "down") ? 1 : 0;
    if (bMoving !== aMoving) return bMoving - aMoving;
    const aRelevant = suggestedSlugs.has(a.slug) ? 1 : 0;
    const bRelevant = suggestedSlugs.has(b.slug) ? 1 : 0;
    if (bRelevant !== aRelevant) return bRelevant - aRelevant;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  // Randomize which questions appear on each page load
  // Shuffle using Fisher-Yates, seeded by current minute (changes every minute)
  const shuffled = [...allQuestions];
  const seed = Math.floor(Date.now() / 60000); // changes every minute
  let rng = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    const j = rng % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Pick hero from top-confidence questions (not random — should be interesting)
  const heroPool = allQuestions.filter((q) => q.confidence !== null && q.confidence > 0.3);
  const heroIndex = heroPool.length > 0 ? Math.abs(seed) % heroPool.length : 0;
  const heroQ = heroPool[heroIndex] ?? allQuestions[0];

  // Rest of feed: shuffled, deduplicated, excluding hero topic
  const heroTopicId = heroQ?.topic_id ?? "";
  const heroSlug = heroQ?.slug ?? "";
  const seenFeedSlugs = new Set([heroSlug]);
  const feed: QuestionWithCard[] = [];
  for (const q of shuffled) {
    if (q.topic_id === heroTopicId || q.slug === heroSlug) continue;
    if (seenFeedSlugs.has(q.slug)) continue;
    seenFeedSlugs.add(q.slug);
    feed.push(q);
  }

  // Split feed: first item goes to hero side card, rest to bento grid
  const featured = feed.slice(1, 3);   // Two featured cards (skip [0], it's in hero side)
  const grid = feed.slice(3, 11);      // Bento grid cards (up to 8)
  const rest = feed.slice(11, 31);     // Ticker rows (up to 20 more)

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 dark:horizon-glow">

      {/* ── HERO SECTION ── */}
      {heroQ && (() => {
        const a = CAT_ACCENT[heroQ.category ?? ""] ?? DEFAULT_ACCENT;
        const pct = heroQ.confidence !== null ? Math.round(heroQ.confidence * 100) : 0;
        const ans = heroQ.direction && heroQ.confidence !== null
          ? getAnswerState({ direction: heroQ.direction, confidence: heroQ.confidence, category: heroQ.category, disagreement: 0 }) : null;

        const heroPhoto = getCatPhoto(heroQ.category, heroQ.slug);
        const heroComp = isCompetitionQuestion(heroQ.question_text) ? getCompetitionAnswer(heroQ.slug) : null;
        const heroTeam = heroComp ? null : getTeamEntity(heroQ.question_text);
        return (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 pb-8 animate-slide-up">
            {/* Main hero */}
            <Link href={`/topics/${heroQ.slug}`} className="lg:col-span-8">
              <div className="relative overflow-hidden rounded-[2rem] p-8 sm:p-10 min-h-[320px] sm:min-h-[400px] flex flex-col justify-end
                bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 group hover-lift">
                {/* Background photo */}
                {heroPhoto && (
                  <div className="absolute inset-0 z-0">
                    <img src={heroPhoto} alt="" className="w-full h-full object-cover opacity-20 dark:opacity-25 dark:brightness-50 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" loading="eager" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card dark:from-[#131B2E] via-card/70 dark:via-[#131B2E]/70 to-card/30 dark:to-[#131B2E]/30" />
                  </div>
                )}
                {/* Favorite team logo watermark */}
                {(heroComp?.favorite.logoUrl || heroTeam?.logoUrl) && (
                  <div className="absolute top-6 right-6 z-[1] opacity-30 group-hover:opacity-50 transition-opacity">
                    <img src={(heroComp?.favorite.logoUrl ?? heroTeam?.logoUrl) as string} alt="" className="h-20 w-20 sm:h-28 sm:w-28 object-contain drop-shadow-lg" loading="eager" />
                  </div>
                )}
                {/* Glow */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 blur-[120px] hidden dark:block z-0" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-2 w-2 rounded-full bg-positive dark:bg-[#4EDEA3] animate-pulse-live" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-positive dark:text-[#4EDEA3]">Live Projection</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1] tracking-tight mb-6">
                    {heroQ.question_text}
                  </h1>

                  {/* Competition answer: show team as the answer */}
                  {heroComp ? (
                    <div>
                      <div className="flex items-center gap-4 mb-3">
                        {heroComp.favorite.logoUrl && (
                          <div className={`flex-shrink-0 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl ${heroComp.favorite.bgColor} flex items-center justify-center`}>
                            <img src={heroComp.favorite.logoUrl} alt={heroComp.favorite.name} className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
                          </div>
                        )}
                        <div>
                          <span className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground dark:text-primary block leading-none">{heroComp.favorite.name}</span>
                          <span className="text-[10px] uppercase tracking-widest mt-1 font-bold text-muted-foreground">Projected favorite</span>
                        </div>
                      </div>
                      {heroComp.contenders.length > 0 && (
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Also in the mix</span>
                          {heroComp.contenders.map((c) => (
                            <div key={c.shortName} className="flex items-center gap-1.5">
                              {c.logoUrl && <img src={c.logoUrl} alt={c.name} className="h-5 w-5 object-contain" loading="lazy" />}
                              <span className="text-xs font-bold text-muted-foreground">{c.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-4 items-end">
                      {heroTeam && (
                        <div className={`flex-shrink-0 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl ${heroTeam.bgColor} flex items-center justify-center mb-2`}>
                          <img src={heroTeam.logoUrl} alt={heroTeam.name} className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-foreground dark:text-primary">{pct}%</span>
                        <span className="text-[10px] uppercase tracking-widest mt-1 font-bold text-muted-foreground">
                          {ans?.label ?? "Tracking"}
                        </span>
                      </div>
                      <div className="flex-1 h-2 mb-4 rounded-full overflow-hidden bg-border/30 dark:bg-white/10">
                        <div className={`h-full bg-primary animate-bar-fill`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>

            {/* Second question card -- different question, not a repeat */}
            {feed[0] && (() => {
              const q2 = feed[0];
              const a2 = CAT_ACCENT[q2.category ?? ""] ?? DEFAULT_ACCENT;
              const pct2 = q2.confidence !== null ? Math.round(q2.confidence * 100) : 0;
              const ans2 = q2.direction && q2.confidence !== null
                ? getAnswerState({ direction: q2.direction, confidence: q2.confidence, category: q2.category, disagreement: 0 }) : null;
              const comp2 = isCompetitionQuestion(q2.question_text) ? getCompetitionAnswer(q2.slug) : null;
              const team2 = comp2 ? null : getTeamEntity(q2.question_text);
              return (
                <Link href={`/topics/${q2.slug}`} className="lg:col-span-4">
                  <div className={`h-full rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden
                    bg-gradient-to-br ${a2.bg} bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 hover-lift-sm`}>
                    {(comp2?.favorite.logoUrl || team2?.logoUrl) && (
                      <div className="absolute top-4 right-4 opacity-20">
                        <img src={(comp2?.favorite.logoUrl ?? team2?.logoUrl) as string} alt="" className="h-16 w-16 object-contain" loading="lazy" />
                      </div>
                    )}
                    <div className="relative z-10">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${a2.text} block mb-3`}>{a2.label}</span>
                      <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-tight mb-3">{q2.question_text}</h2>
                    </div>
                    <div className="relative z-10">
                      {comp2 ? (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {comp2.favorite.logoUrl && <img src={comp2.favorite.logoUrl} alt={comp2.favorite.name} className="h-7 w-7 object-contain" />}
                            <span className={`text-xl font-black ${a2.text}`}>{comp2.favorite.name}</span>
                          </div>
                          {comp2.contenders.length > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              {comp2.contenders.slice(0, 2).map((c) => (
                                <div key={c.shortName} className="flex items-center gap-1">
                                  {c.logoUrl && <img src={c.logoUrl} alt={c.name} className="h-4 w-4 object-contain opacity-60" loading="lazy" />}
                                  <span className="text-[10px] text-muted-foreground font-medium">{c.shortName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {ans2 && <span className={`text-xl font-black ${ans2.colorClass} block mb-1`}>{ans2.label}</span>}
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-border/30 dark:bg-white/10 overflow-hidden">
                          <div className={`h-full rounded-full bg-current ${a2.text} animate-bar-fill`} style={{ width: `${pct2}%` }} />
                        </div>
                        <span className={`text-xs font-bold font-mono ${a2.text}`}>{pct2}%</span>
                      </div>
                      {q2.snapshot_published_at && (
                        <span className="text-[10px] text-muted-foreground/50 mt-2 block">{timeAgo(q2.snapshot_published_at)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })()}
          </section>
        );
      })()}

      {/* ── ORACLE SEARCH BAR ── */}
      <div className="pb-6 animate-fade-in delay-300">
        <form action="/ask" className="relative max-w-lg mx-auto">
          <input
            type="search"
            name="q"
            aria-label="Ask QUESERA"
            placeholder="Have a question? Ask QUESERA..."
            className="w-full px-4 py-3 rounded-xl bg-card/60 border border-border/40 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </form>
      </div>

      {/* ── BENTO GRID ── */}
      {feed.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-12 gap-5 pb-8">

          {/* Two featured cards — asymmetric */}
          {featured[0] && (() => {
            const q = featured[0];
            const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
            const photo = getCatPhoto(q.category, q.slug);
            const ans = q.direction && q.confidence !== null
              ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0 }) : null;
            const pct = q.confidence !== null ? Math.round(q.confidence * 100) : 0;
            return (
              <Link href={`/topics/${q.slug}`} className="md:col-span-7 group">
                <div className="h-full relative overflow-hidden rounded-[2rem] p-8 min-h-[260px] flex flex-col justify-between
                  bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 hover-lift-sm animate-card-enter">
                  {/* Background photo */}
                  {photo && (
                    <div className="absolute inset-0 z-0">
                      <img src={photo} alt="" className="w-full h-full object-cover opacity-15 dark:opacity-20 dark:brightness-50 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-card dark:from-[#131B2E] via-card/80 dark:via-[#131B2E]/80 to-transparent" />
                    </div>
                  )}
                  <div className="relative z-10">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${a.text}`}>{a.label}</span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight mb-4">{q.question_text}</h3>
                    <div className="flex justify-between items-end">
                      <div>
                        {ans && <span className={`text-sm font-bold ${ans.colorClass}`}>{ans.label}</span>}
                        {q.snapshot_published_at && <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgo(q.snapshot_published_at)}</p>}
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${a.text}`}>{pct}%</span>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Confidence</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })()}

          {featured[1] && (() => {
            const q = featured[1];
            const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
            const ans = q.direction && q.confidence !== null
              ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0 }) : null;
            const pct = q.confidence !== null ? Math.round(q.confidence * 100) : 0;
            return (
              <Link href={`/topics/${q.slug}`} className="md:col-span-5 group">
                <div className={`h-full rounded-[2rem] p-8 flex flex-col justify-between
                  bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 hover-lift-sm animate-card-enter`}
                  style={{ animationDelay: "100ms", opacity: 0 }}>
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${a.text} mb-4 block`}>{a.label}</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight mb-6">{q.question_text}</h3>
                  </div>
                  {/* Progress bars */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className={`${a.text} font-bold`}>{ans?.label ?? "Tracking"}</span>
                      <span className={`${a.text} font-bold`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/20 dark:bg-white/10 overflow-hidden">
                      <div className={`h-full bg-current ${a.text} animate-bar-fill`} style={{ width: `${pct}%` }} />
                    </div>
                    {q.one_liner && <p className="text-xs text-muted-foreground leading-relaxed mt-2">{q.one_liner}</p>}
                    {q.snapshot_published_at && <p className="text-[10px] text-muted-foreground/50 mt-2">{timeAgo(q.snapshot_published_at)}</p>}
                  </div>
                </div>
              </Link>
            );
          })()}

          {/* Bento grid — mixed sizes */}
          {grid.map((q, i) => {
            const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
            const ans = q.direction && q.confidence !== null
              ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0 }) : null;
            const pct = q.confidence !== null ? Math.round(q.confidence * 100) : 0;
            const photo = getCatPhoto(q.category, q.slug);
            const comp = isCompetitionQuestion(q.question_text) ? getCompetitionAnswer(q.slug) : null;
            const team = comp ? null : getTeamEntity(q.question_text);

            // Alternate card sizes: 4-8, 8-4, 4-4-4, etc.
            const span = i % 3 === 0 ? "md:col-span-4" : i % 3 === 1 ? "md:col-span-8" : "md:col-span-4";
            const isWide = span.includes("8");

            return (
              <Link key={q.topic_id} href={`/topics/${q.slug}`} className={`${span} group`}>
                <div
                  className={`h-full rounded-[2rem] p-6 flex ${isWide ? "flex-row items-center gap-6" : "flex-col justify-between"} min-h-[160px]
                    bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 hover-lift-sm animate-card-enter
                    relative overflow-hidden`}
                  style={{ animationDelay: `${(i + 2) * 80}ms`, opacity: 0 }}
                >
                  {/* Background photo on all cards */}
                  {photo && (
                    <div className="absolute inset-0 z-0">
                      <img src={photo} alt="" className={`w-full h-full object-cover ${isWide ? "opacity-15 dark:opacity-20" : "opacity-10 dark:opacity-15"} dark:brightness-50 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700`} loading="lazy" />
                      <div className={`absolute inset-0 ${isWide
                        ? "bg-gradient-to-r from-card dark:from-[#131B2E] via-card/85 dark:via-[#131B2E]/85 to-card/50 dark:to-[#131B2E]/50"
                        : "bg-gradient-to-t from-card dark:from-[#131B2E] via-card/80 dark:via-[#131B2E]/80 to-card/40 dark:to-[#131B2E]/40"
                      }`} />
                    </div>
                  )}
                  {/* Team logo watermark */}
                  {team && !photo && (
                    <div className="absolute top-4 right-4 z-[1] opacity-15">
                      <img src={team.logoUrl} alt={team.name} className="h-16 w-16 object-contain" loading="lazy" />
                    </div>
                  )}

                  <div className={`${isWide ? "flex-1" : ""} relative z-10`}>
                    <div className="flex items-center gap-2 mb-2">
                      {(comp?.favorite.logoUrl || team?.logoUrl) && (
                        <div className={`h-6 w-6 rounded-md ${(comp?.favorite.bgColor ?? team?.bgColor) as string} flex items-center justify-center flex-shrink-0`}>
                          <img src={(comp?.favorite.logoUrl ?? team?.logoUrl) as string} alt="" className="h-4 w-4 object-contain" />
                        </div>
                      )}
                      <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${a.text}`}>{a.label}</span>
                    </div>
                    <h3 className={`${isWide ? "text-xl sm:text-2xl" : "text-lg"} font-bold text-foreground tracking-tight leading-tight mb-2`}>{q.question_text}</h3>
                    {comp ? (
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black ${a.text}`}>{comp.favorite.name}</span>
                        {comp.contenders.slice(0, 2).map((c) => (
                          <span key={c.shortName} className="text-[10px] text-muted-foreground">{c.shortName}</span>
                        ))}
                      </div>
                    ) : (
                      ans && <span className={`text-sm font-bold ${ans.colorClass}`}>{ans.label}</span>
                    )}
                    {q.snapshot_published_at && <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgo(q.snapshot_published_at)}</p>}
                  </div>

                  {/* Visual element -- show team logo for competition, % for others */}
                  <div className={`${isWide ? "flex-shrink-0 text-right" : "mt-4"} relative z-10`}>
                    {comp?.favorite.logoUrl ? (
                      <img src={comp.favorite.logoUrl} alt={comp.favorite.name} className={`${isWide ? "h-14 w-14" : "h-12 w-12"} object-contain mx-auto`} loading="lazy" />
                    ) : (
                      <>
                        <span className={`${isWide ? "text-4xl" : "text-3xl"} font-black font-mono ${a.text}`}>{pct}%</span>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Confidence</p>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Remaining compact cards as ticker rows */}
          {rest.length > 0 && (
            <div className="md:col-span-12 rounded-[2rem] p-6 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 animate-card-enter"
              style={{ animationDelay: "600ms", opacity: 0 }}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">More questions</h3>
              <div className="divide-y divide-border/20 dark:divide-white/5">
                {rest.map((q) => {
                  const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
                  const ans = q.direction && q.confidence !== null
                    ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0 }) : null;
                  const pct = q.confidence !== null ? Math.round(q.confidence * 100) : 0;
                  const tickerComp = isCompetitionQuestion(q.question_text) ? getCompetitionAnswer(q.slug) : null;
                  const tickerTeam = tickerComp ? null : getTeamEntity(q.question_text);
                  const tickerLogo = tickerComp?.favorite.logoUrl ?? tickerTeam?.logoUrl;
                  const tickerBg = tickerComp?.favorite.bgColor ?? tickerTeam?.bgColor;
                  return (
                    <Link key={q.topic_id} href={`/topics/${q.slug}`} className="flex items-center gap-4 py-3 group hover:bg-muted/30 dark:hover:bg-white/5 -mx-3 px-3 rounded-xl transition-colors">
                      {tickerLogo ? (
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${tickerBg}`}>
                          <img src={tickerLogo} alt="" className="h-6 w-6 object-contain" loading="lazy" />
                        </div>
                      ) : (
                        <span className={`text-lg font-black font-mono w-10 text-center ${a.text}`}>{pct}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{q.question_text}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] uppercase tracking-wider ${a.text} font-bold`}>{a.label}</span>
                          {tickerComp
                            ? <span className={`text-[10px] font-bold ${a.text}`}>{tickerComp.favorite.name}</span>
                            : ans && <span className={`text-[10px] font-bold ${ans.colorClass}`}>{ans.label}</span>
                          }
                        </div>
                      </div>
                      {q.snapshot_published_at && <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{timeAgo(q.snapshot_published_at)}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-12 text-center animate-fade-in">
        <p className="text-muted-foreground mb-6">
          Follow the questions you care about. We keep watching them for you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/onboarding" className="inline-flex h-12 items-center justify-center rounded-full bg-foreground dark:bg-primary px-8 text-sm font-medium text-background dark:text-[#00171B] hover-lift">
            Pick your questions
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-full bg-card dark:border dark:border-white/10 px-8 text-sm font-medium text-foreground hover-lift-sm">
            Sign in
          </Link>
        </div>
      </section>

      {/* Empty state */}
      {allQuestions.length === 0 && (
        <section className="text-center py-20 animate-fade-in">
          <p className="text-lg text-muted-foreground">We are updating our signals. Check back in a few hours.</p>
        </section>
      )}
    </div>
  );
}
