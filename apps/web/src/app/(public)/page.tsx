import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnswerState } from "@/lib/answer-state";
import { getWhyLine } from "@/lib/why-line";
import { getTeamEntity, getCompetitionAnswer, getTopicLogo, findLogoByEntityName } from "@/lib/team-entities";
import { deriveQuestionType } from "@/lib/question-contracts";
import type { QuestionType } from "@/lib/question-contracts";
import Link from "next/link";
import { BriefingStrip, buildBriefingItems } from "@/components/briefing-strip";
import { SurpriseCard, findBiggestSplit } from "@/components/surprise-card";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }
import {
  getInferredLocation,
  getTopicSuggestionsForLocation,
  type EffectiveLocation,
} from "@/lib/geo";

interface QuestionWithCard {
  question_text: string;
  slug: string;
  href: string;              // full route path: /questions/slug or /topics/slug
  category: string | null;
  question_type: QuestionType;  // competition, threshold, or binary_event
  topic_slug: string;        // the underlying topic slug (for CompetitionAnswer lookup)
  direction: string | null;
  confidence: number | null;
  freshness: string | null;
  one_liner: string | null;
  snapshot_published_at: string | null;
  topic_id: string;
  // Synthesis gate fields
  synthesis_ready: boolean;
  expert_line: string | null;
  source_families: string[];
  // Live competition data
  competition_leader: string | null;
  competition_leader_pct: number | null;
  competition_challenger: string | null;
  competition_gap: number | null;
}

// Source family display names for pills
const FAMILY_PILL: Record<string, string> = {
  macro_official: "Official Data",
  crypto_market: "Crypto",
  prediction_market: "Markets",
  sports_odds: "Bookmakers",
  forecasting: "Forecasts",
  forecast_aggregator: "Forecasts",
  political_official: "Congress",
  news_evidence: "News",
  hazard_weather: "Weather",
  sports_official: "Sports Data",
  sports_signal: "Sports",
  defi_signal: "DeFi",
};

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

/**
 * Get the competition display for a card.
 * Prefers LIVE leader data from card columns (populated by worker from signals).
 * Looks up logo by the LIVE leader name so logo always matches the displayed team.
 */
function getCompetitionDisplay(q: QuestionWithCard): { comp: ReturnType<typeof getCompetitionAnswer>; label: string } {
  const comp = getCompetitionAnswer(q.topic_slug);
  if (!comp) return { comp: null, label: q.competition_leader ?? "Race underway" };

  // If live leader matches the static favorite, use as-is
  if (q.competition_leader) {
    const leaderLower = q.competition_leader.toLowerCase();
    // Check if live leader is one of the contenders -- if so, reorder so their logo shows
    const matchedContender = comp.contenders.find(
      (c) => leaderLower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(leaderLower),
    );
    if (matchedContender) {
      // Swap: put matched contender as favorite so logo renders correctly
      return {
        comp: {
          favorite: matchedContender,
          contenders: [comp.favorite, ...comp.contenders.filter((c) => c !== matchedContender)],
        },
        label: q.competition_leader,
      };
    }
    // Live leader matches static favorite (or not found in contenders)
    return { comp, label: q.competition_leader };
  }

  return { comp, label: comp.favorite.name };
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

  // Question-first: load from questions table (product layer)
  // Fall back to question_wrappers if questions table is empty (migration not yet run)
  const { data: questionRows, error: questionsError } = await db(supabase)
    .from("questions")
    .select("id, question_text, slug, category, question_type, primary_topic_id, sort_order")
    .eq("status", "published")
    .eq("is_featured", true)
    .order("sort_order", { ascending: true });

  // Log for debugging -- remove after confirming questions path works
  if (questionsError) {
    console.error("[HOMEPAGE] questions query error:", questionsError.message);
  }

  const useQuestions = Array.isArray(questionRows) && questionRows.length > 0;

  // Legacy fallback: if no questions exist yet, use wrappers
  const { data: rawQuestions } = useQuestions ? { data: null } : await supabase
    .from("question_wrappers")
    .select(`question_text, display_context, is_featured, sort_order,
      topics!inner (id, slug, category, status, is_public)`)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true });

  // Load core card data (always available)
  // Filter out blocked pages -- quality gates determined these shouldn't render
  const { data: allCards } = await supabase
    .from("public_topic_cards")
    .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner, snapshot_published_at, rendering_mode")
    .neq("rendering_mode", "blocked")
    .order("snapshot_published_at", { ascending: false });

  // Try loading synthesis columns (graceful -- returns empty if migration not yet applied)
  let synthMap = new Map<string, {
    synthesis_ready: boolean | null; expert_line: string | null; source_families: string[] | null;
    competition_leader: string | null; competition_leader_pct: number | null;
    competition_challenger: string | null; competition_gap: number | null;
    synthesis_json: Record<string, unknown> | null;
  }>();
  try {
    const { data: synthData } = await supabase
      .from("public_topic_cards")
      .select("topic_id, synthesis_ready, expert_line, source_families, competition_leader, competition_leader_pct, competition_challenger, competition_gap, synthesis_json");
    if (synthData) {
      synthMap = new Map((synthData as Array<Record<string, unknown>>).map((c) => [
        c.topic_id as string,
        {
          synthesis_ready: (c.synthesis_ready as boolean | null) ?? null,
          expert_line: (c.expert_line as string | null) ?? null,
          source_families: (c.source_families as string[] | null) ?? null,
          competition_leader: (c.competition_leader as string | null) ?? null,
          competition_leader_pct: (c.competition_leader_pct as number | null) ?? null,
          competition_challenger: (c.competition_challenger as string | null) ?? null,
          competition_gap: (c.competition_gap as number | null) ?? null,
          synthesis_json: (c.synthesis_json as Record<string, unknown> | null) ?? null,
        },
      ]));
    }
  } catch {
    // Synthesis columns not yet available -- proceed without them
  }

  const cards = (allCards ?? []) as Array<{
    topic_id: string; canonical_name: string; slug: string; category: string | null;
    direction: string | null; confidence: number | null; freshness: string | null;
    one_liner: string | null; snapshot_published_at: string | null;
  }>;

  // Synthesis gate rollout: only enforce when enough cards have been populated
  const synthReadyCount = [...synthMap.values()].filter((c) => c.synthesis_ready === true).length;
  const enforceSynthesisGate = synthReadyCount >= 5;
  const cardByTopicId = new Map(cards.map((c) => [c.topic_id, c]));

  const seenSlugs = new Set<string>();
  const allQuestions: QuestionWithCard[] = [];

  if (useQuestions) {
    // Question-first path: questions table -> topic cards
    for (const q of (questionRows as Array<{ id: string; question_text: string; slug: string; category: string | null; question_type: string | null; primary_topic_id: string; sort_order: number }>) ?? []) {
      const card = cardByTopicId.get(q.primary_topic_id);
      if (!card) continue;
      if (seenSlugs.has(q.slug)) continue;
      if (card.freshness === "dead" || card.confidence === 0) continue;
      const synth = synthMap.get(q.primary_topic_id);
      if (enforceSynthesisGate && synth?.synthesis_ready !== true) continue; // SYNTHESIS GATE
      seenSlugs.add(q.slug);
      // Derive question type: explicit DB value > topic override > text derivation
      const qt: QuestionType = (q.question_type && ["binary_event", "threshold", "competition"].includes(q.question_type))
        ? q.question_type as QuestionType
        : deriveQuestionType(q.question_text, q.category);
      allQuestions.push({
        question_text: q.question_text, slug: q.slug, href: `/questions/${q.slug}`,
        category: q.category, question_type: qt, topic_slug: card.slug,
        direction: card.direction, confidence: card.confidence,
        freshness: card.freshness, one_liner: card.one_liner,
        snapshot_published_at: card.snapshot_published_at, topic_id: q.primary_topic_id,
        synthesis_ready: synth?.synthesis_ready ?? false,
        expert_line: synth?.expert_line ?? null,
        source_families: synth?.source_families ?? [],
        competition_leader: synth?.competition_leader ?? null,
        competition_leader_pct: synth?.competition_leader_pct ?? null,
        competition_challenger: synth?.competition_challenger ?? null,
        competition_gap: synth?.competition_gap ?? null,
      });
    }
  } else {
    // Legacy path: question_wrappers -> topics -> cards
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
      if (card.freshness === "dead" || card.confidence === 0) continue;
      const synthLegacy = synthMap.get(topic.id);
      if (enforceSynthesisGate && synthLegacy?.synthesis_ready !== true) continue; // SYNTHESIS GATE
      seenSlugs.add(topic.slug);
      allQuestions.push({
        question_text: r.question_text, slug: topic.slug, href: `/topics/${topic.slug}`,
        category: topic.category, question_type: deriveQuestionType(r.question_text, topic.category),
        topic_slug: topic.slug, direction: card.direction, confidence: card.confidence,
        freshness: card.freshness, one_liner: card.one_liner,
        snapshot_published_at: card.snapshot_published_at, topic_id: topic.id,
        synthesis_ready: synthLegacy?.synthesis_ready ?? false,
        expert_line: synthLegacy?.expert_line ?? null,
        source_families: synthLegacy?.source_families ?? [],
        competition_leader: synthLegacy?.competition_leader ?? null,
        competition_leader_pct: synthLegacy?.competition_leader_pct ?? null,
        competition_challenger: synthLegacy?.competition_challenger ?? null,
        competition_gap: synthLegacy?.competition_gap ?? null,
      });
    }
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

  // ── Micro-rule: no card without a clear takeaway ──
  // If a card cannot produce one human-readable sentence, it should not appear.
  const filteredQuestions = allQuestions.filter((q) => {
    // Competition cards need a leader name
    if (q.question_type === "competition") return !!q.competition_leader;
    // Non-competition cards need expert_line or one_liner
    return !!(q.expert_line || q.one_liner);
  });
  // Replace allQuestions reference for downstream use
  const displayQuestions = filteredQuestions.length >= 4 ? filteredQuestions : allQuestions;

  // ── Tension scoring ──
  // Ranks questions by how interesting they are RIGHT NOW.
  // Higher tension = better hero candidate + "What Moved" surface.
  function tensionScore(q: QuestionWithCard): number {
    let score = 0;
    // Fresh + moving questions are the most interesting
    if (q.freshness === "fresh") score += 30;
    else if (q.freshness === "aging") score += 15;
    // Active direction signals tension
    if (q.direction === "up" || q.direction === "down") score += 20;
    // Moderate confidence is more dramatic than very high or very low
    const conf = q.confidence ?? 0;
    if (conf >= 0.35 && conf <= 0.65) score += 15; // contested zone
    else if (conf > 0.65) score += 8;
    else if (conf > 0) score += 5;
    // Recency bonus: fresher snapshots get more weight
    if (q.snapshot_published_at) {
      const hoursAgo = (Date.now() - new Date(q.snapshot_published_at).getTime()) / 3600000;
      if (hoursAgo < 1) score += 20;
      else if (hoursAgo < 6) score += 12;
      else if (hoursAgo < 24) score += 6;
    }
    // Geo-relevance bonus
    if (suggestedSlugs.has(q.slug)) score += 5;
    return score;
  }

  // Score all questions for tension
  const scored = displayQuestions.map((q) => ({ q, tension: tensionScore(q) }));
  scored.sort((a, b) => b.tension - a.tension);

  // Hero: highest-tension question, with rotation among top 3 to avoid staleness
  const seed = Math.floor(Date.now() / 300000); // rotates every 5 minutes
  const heroPool = scored.slice(0, Math.min(3, scored.length));
  const heroQ = heroPool.length > 0 ? heroPool[Math.abs(seed) % heroPool.length].q : displayQuestions[0];

  // "What Moved" candidates: questions that genuinely changed recently
  // Must have active direction AND a recent snapshot (< 24h) to avoid showing stale "movement"
  const movedQuestions = scored
    .filter((s) => {
      if (s.q.topic_id === heroQ?.topic_id) return false;
      if (s.q.direction !== "up" && s.q.direction !== "down") return false;
      if (s.q.freshness === "stale" || s.q.freshness === "dead") return false;
      // Must have been published in the last 24 hours to count as "moved"
      if (s.q.snapshot_published_at) {
        const ageH = (Date.now() - new Date(s.q.snapshot_published_at).getTime()) / 3600000;
        if (ageH > 24) return false;
      }
      return true;
    })
    .slice(0, 4)
    .map((s) => s.q);

  // Remaining feed: sorted by tension, deduplicated, excluding hero
  const heroTopicId = heroQ?.topic_id ?? "";
  const heroSlug = heroQ?.slug ?? "";
  const movedSlugs = new Set(movedQuestions.map((q) => q.slug));
  const seenFeedSlugs = new Set([heroSlug, ...movedSlugs]);
  const feed: QuestionWithCard[] = [];
  for (const { q } of scored) {
    if (q.topic_id === heroTopicId || q.slug === heroSlug) continue;
    if (seenFeedSlugs.has(q.slug)) continue;
    seenFeedSlugs.add(q.slug);
    feed.push(q);
  }

  // Split feed into template-grouped lanes
  // feed[0] goes to hero side card
  const laneSource = feed.slice(1);
  const competitions: QuestionWithCard[] = [];
  const thresholds: QuestionWithCard[] = [];
  const binaryEvents: QuestionWithCard[] = [];
  for (const q of laneSource) {
    if (q.question_type === "competition") competitions.push(q);
    else if (q.question_type === "threshold") thresholds.push(q);
    else binaryEvents.push(q);
  }

  // Each lane gets up to 4 items; overflow goes to ticker
  const raceCards = competitions.slice(0, 4);
  const countdownCards = thresholds.slice(0, 4);
  const tippingCards = binaryEvents.slice(0, 4);

  // Ticker: everything not in a lane
  const laneSlugs = new Set([...raceCards, ...countdownCards, ...tippingCards].map((q) => q.slug));
  const rest = laneSource.filter((q) => !laneSlugs.has(q.slug)).slice(0, 20);

  // Briefing strip: what changed recently (prefers structured deltas)
  const briefingItems = buildBriefingItems(
    displayQuestions.map((q) => ({
      slug: q.slug,
      question_text: q.question_text,
      direction: q.direction,
      expert_line: q.expert_line,
      one_liner: q.one_liner,
      snapshot_published_at: q.snapshot_published_at,
      competition_leader: q.competition_leader,
      competition_leader_pct: q.competition_leader_pct,
      confidence: q.confidence,
    })),
  );

  // Surprise card: biggest market split
  const surpriseData = findBiggestSplit(
    displayQuestions.map((q) => ({
      slug: q.slug,
      question_text: q.question_text,
      synthesis_json: synthMap.get(q.topic_id)?.synthesis_json ?? null,
    })),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 dark:horizon-glow">

      {/* ── HERO SECTION ── */}
      {heroQ && (() => {
        const a = CAT_ACCENT[heroQ.category ?? ""] ?? DEFAULT_ACCENT;
        const pct = heroQ.confidence !== null ? Math.round(heroQ.confidence * 100) : 0;
        const ans = heroQ.direction && heroQ.confidence !== null
          ? getAnswerState({ direction: heroQ.direction, confidence: heroQ.confidence, category: heroQ.category, disagreement: 0, questionType: heroQ.question_type }) : null;

        const heroPhoto = getCatPhoto(heroQ.category, heroQ.slug);
        const isComp = heroQ.question_type === "competition";
        const { comp: heroComp, label: heroCompLabel } = isComp ? getCompetitionDisplay(heroQ) : { comp: null, label: "" };
        const heroTeam = heroComp ? null : getTeamEntity(heroQ.question_text);
        return (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 pb-8 animate-slide-up">
            {/* Main hero */}
            <Link href={heroQ.href} className="lg:col-span-8">
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
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-positive dark:text-[#4EDEA3]">Live</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1] tracking-tight mb-6">
                    {heroQ.question_text}
                  </h1>

                  {/* Competition answer: show team/leader as the answer */}
                  {isComp ? (
                    <div>
                      <div className="flex items-center gap-4 mb-3">
                        {heroComp?.favorite.logoUrl && (
                          <div className={`flex-shrink-0 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl ${heroComp.favorite.bgColor} flex items-center justify-center`}>
                            <img src={heroComp.favorite.logoUrl} alt={heroComp.favorite.name} className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
                          </div>
                        )}
                        <div>
                          <span className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground dark:text-primary block leading-none">{heroCompLabel}</span>
                          <span className="text-[10px] uppercase tracking-widest mt-1 font-bold text-muted-foreground">{heroComp ? "Projected favorite" : ""}</span>
                        </div>
                      </div>
                      {heroComp && heroComp.contenders.length > 0 && (
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
                        <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground dark:text-primary">
                          {ans?.headline ?? ans?.label ?? "Tracking"}
                        </span>
                      </div>
                      <div className="flex-1 mb-4 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full overflow-hidden bg-border/30 dark:bg-white/10">
                          <div className={`h-full bg-primary animate-bar-fill`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono font-bold text-muted-foreground tabular-nums">{pct}%</span>
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
                ? getAnswerState({ direction: q2.direction, confidence: q2.confidence, category: q2.category, disagreement: 0, questionType: q2.question_type }) : null;
              const isComp2 = q2.question_type === "competition";
              const { comp: comp2, label: compLabel2 } = isComp2 ? getCompetitionDisplay(q2) : { comp: null, label: "" };
              const team2 = comp2 ? null : getTeamEntity(q2.question_text);
              const whyLine2 = getWhyLine({ questionType: q2.question_type, direction: q2.direction, confidence: q2.confidence, freshness: q2.freshness, snapshotPublishedAt: q2.snapshot_published_at, leaderName: compLabel2 || null });
              return (
                <Link href={q2.href} className="lg:col-span-4">
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
                      {isComp2 ? (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {comp2?.favorite.logoUrl && <img src={comp2.favorite.logoUrl} alt={comp2.favorite.name} className="h-7 w-7 object-contain" />}
                            <span className={`text-xl font-black ${a2.text}`}>{compLabel2}</span>
                          </div>
                          {comp2 && comp2.contenders.length > 0 && (
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
                          {ans2 && <span className={`text-xl font-black ${ans2.colorClass} block mb-1`}>{ans2.cardVerdict}</span>}
                        </>
                      )}
                      {whyLine2 && <p className="text-[11px] text-muted-foreground leading-snug mt-1">{whyLine2}</p>}
                      <div className="flex items-center gap-2 mt-2">
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

      {/* ── SURPRISE CARD: biggest market split ── */}
      <SurpriseCard data={surpriseData} />

      {/* ── BRIEFING STRIP: what changed ── */}
      <BriefingStrip items={briefingItems} />

      {/* ── LANES ── */}

      {/* Hot Races — competition questions with logos and contenders */}
      {raceCards.length > 0 && (
        <section className="pb-8 animate-fade-in">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-4">Hot races</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {raceCards.map((q, i) => {
              const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
              const { comp, label: compLabel } = getCompetitionDisplay(q);
              const team = comp ? null : getTeamEntity(q.question_text);
              const raceWhyLine = getWhyLine({ questionType: q.question_type, direction: q.direction, confidence: q.confidence, freshness: q.freshness, snapshotPublishedAt: q.snapshot_published_at, leaderName: compLabel || null });
              const ans = q.direction && q.confidence !== null
                ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0, questionType: q.question_type }) : null;
              return (
                <Link key={q.topic_id} href={q.href} className="group">
                  <div className="h-full rounded-2xl p-5 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 hover-lift-sm animate-card-enter relative overflow-hidden"
                    style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}>
                    {/* Leader logo watermark */}
                    {(comp?.favorite.logoUrl || team?.logoUrl) && (
                      <div className="absolute top-3 right-3 opacity-15 group-hover:opacity-25 transition-opacity">
                        <img src={(comp?.favorite.logoUrl ?? team?.logoUrl) as string} alt="" className="h-14 w-14 object-contain" loading="lazy" />
                      </div>
                    )}
                    <div className="relative z-10">
                      <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${a.text} block mb-2`}>{a.label}</span>
                      <h3 className="text-base font-bold text-foreground leading-snug mb-3 pr-12">{q.question_text}</h3>
                      <div className="flex items-center gap-2 mb-1">
                        {comp?.favorite.logoUrl && (
                          <div className={`h-7 w-7 rounded-lg ${comp.favorite.bgColor} flex items-center justify-center flex-shrink-0`}>
                            <img src={comp.favorite.logoUrl} alt={comp.favorite.name} className="h-5 w-5 object-contain" />
                          </div>
                        )}
                        <span className={`text-sm font-black ${a.text}`}>{compLabel}</span>
                      </div>
                      {comp && comp.contenders.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">vs</span>
                          {comp.contenders.slice(0, 2).map((c) => (
                            <div key={c.shortName} className="flex items-center gap-1">
                              {c.logoUrl && <img src={c.logoUrl} alt={c.name} className="h-4 w-4 object-contain opacity-60" loading="lazy" />}
                              <span className="text-[10px] text-muted-foreground font-medium">{c.shortName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {q.expert_line
                        ? <p className="text-[11px] text-muted-foreground leading-snug">{q.expert_line}</p>
                        : raceWhyLine && <p className="text-[11px] text-muted-foreground leading-snug">{raceWhyLine}</p>
                      }
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1">
                          {q.source_families.slice(0, 3).map((f) => (
                            <span key={f} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground/70">{FAMILY_PILL[f] ?? f}</span>
                          ))}
                        </div>
                        {q.snapshot_published_at && <span className="text-[9px] text-muted-foreground/50">{timeAgo(q.snapshot_published_at)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Countdowns — threshold questions with progress toward target */}
      {countdownCards.length >= 2 && (
        <section className="pb-8 animate-fade-in">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-4">Countdowns</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {countdownCards.map((q, i) => {
              const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
              const ans = q.direction && q.confidence !== null
                ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0, questionType: q.question_type }) : null;
              const team = getTeamEntity(q.question_text);
              const topicLogo = getTopicLogo(q.topic_slug);
              const cardLogo = team ? { logoUrl: team.logoUrl, bgColor: team.bgColor } : topicLogo;
              // Use question-specific one-liner instead of generic verdict
              const cardDescription = q.expert_line ?? q.one_liner ?? ans?.cardVerdict ?? "Tracking";
              return (
                <Link key={q.topic_id} href={q.href} className="group">
                  <div className="h-full rounded-2xl p-5 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 hover-lift-sm animate-card-enter relative overflow-hidden"
                    style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}>
                    {cardLogo && (
                      <div className="absolute top-3 right-3 opacity-15 group-hover:opacity-25 transition-opacity">
                        <img src={cardLogo.logoUrl} alt="" className="h-12 w-12 object-contain" loading="lazy" />
                      </div>
                    )}
                    <div className="relative z-10">
                      <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${a.text} block mb-2`}>{a.label}</span>
                      <h3 className="text-base font-bold text-foreground leading-snug mb-3 pr-10">{q.question_text}</h3>
                      <span className={`text-sm font-bold ${ans?.colorClass ?? "text-foreground"} block mb-2`}>{ans?.cardVerdict ?? "Tracking"}</span>
                      <p className="text-[11px] text-muted-foreground leading-snug">{cardDescription}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1">
                          {q.source_families.slice(0, 3).map((f) => (
                            <span key={f} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground/70">{FAMILY_PILL[f] ?? f}</span>
                          ))}
                        </div>
                        {q.snapshot_published_at && <span className="text-[9px] text-muted-foreground/50">{timeAgo(q.snapshot_published_at)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Tipping Points — binary event questions with tension */}
      {tippingCards.length >= 2 && (
        <section className="pb-8 animate-fade-in">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 mb-4">Tipping points</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tippingCards.map((q, i) => {
              const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
              const ans = q.direction && q.confidence !== null
                ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0, questionType: q.question_type }) : null;
              const team = getTeamEntity(q.question_text);
              const tipTopicLogo = getTopicLogo(q.topic_slug);
              const tipCardLogo = team ? { logoUrl: team.logoUrl, bgColor: team.bgColor } : tipTopicLogo;
              // Use question-specific one-liner instead of generic verdict
              const cardDescription = q.expert_line ?? q.one_liner ?? ans?.cardVerdict ?? "Tracking";
              return (
                <Link key={q.topic_id} href={q.href} className="group">
                  <div className="h-full rounded-2xl p-5 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 hover-lift-sm animate-card-enter relative overflow-hidden"
                    style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}>
                    {tipCardLogo && (
                      <div className="absolute top-3 right-3 opacity-15 group-hover:opacity-25 transition-opacity">
                        <img src={tipCardLogo.logoUrl} alt="" className="h-12 w-12 object-contain" loading="lazy" />
                      </div>
                    )}
                    <div className="relative z-10">
                      <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${a.text} block mb-2`}>{a.label}</span>
                      <h3 className="text-base font-bold text-foreground leading-snug mb-3">{q.question_text}</h3>
                      <span className={`text-sm font-bold ${ans?.colorClass ?? "text-foreground"} block mb-1`}>{ans?.cardVerdict ?? "Tracking"}</span>
                      <p className="text-[11px] text-muted-foreground leading-snug">{cardDescription}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1">
                          {q.source_families.slice(0, 3).map((f) => (
                            <span key={f} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground/70">{FAMILY_PILL[f] ?? f}</span>
                          ))}
                        </div>
                        {q.snapshot_published_at && <span className="text-[9px] text-muted-foreground/50">{timeAgo(q.snapshot_published_at)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* More questions — ticker for overflow */}
      {rest.length > 0 && (
        <section className="pb-8 animate-fade-in">
          <div className="rounded-2xl p-6 bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">More questions</h3>
            <div className="divide-y divide-border/20 dark:divide-white/5">
              {rest.map((q) => {
                const a = CAT_ACCENT[q.category ?? ""] ?? DEFAULT_ACCENT;
                const ans = q.direction && q.confidence !== null
                  ? getAnswerState({ direction: q.direction, confidence: q.confidence, category: q.category, disagreement: 0, questionType: q.question_type }) : null;
                const pct = q.confidence !== null ? Math.round(q.confidence * 100) : 0;
                const isTickerComp = q.question_type === "competition";
                const { comp: tickerComp, label: tickerCompLabel } = isTickerComp ? getCompetitionDisplay(q) : { comp: null, label: "" };
                const tickerTeam = tickerComp ? null : getTeamEntity(q.question_text);
                const tickerLogo = tickerComp?.favorite.logoUrl ?? tickerTeam?.logoUrl;
                const tickerBg = tickerComp?.favorite.bgColor ?? tickerTeam?.bgColor;
                const tickerWhyLine = getWhyLine({ questionType: q.question_type, direction: q.direction, confidence: q.confidence, freshness: q.freshness, snapshotPublishedAt: q.snapshot_published_at, leaderName: tickerCompLabel || null });
                return (
                  <Link key={q.topic_id} href={q.href} className="flex items-center gap-4 py-3 group hover:bg-muted/30 dark:hover:bg-white/5 -mx-3 px-3 rounded-xl transition-colors">
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
                        {isTickerComp
                          ? <span className={`text-[10px] font-bold ${a.text}`}>{tickerCompLabel}</span>
                          : ans && <span className={`text-[10px] font-bold ${ans.colorClass}`}>{ans.cardVerdict}</span>
                        }
                        {tickerWhyLine && <span className="text-[10px] text-muted-foreground">-- {tickerWhyLine}</span>}
                      </div>
                    </div>
                    {q.snapshot_published_at && <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{timeAgo(q.snapshot_published_at)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-12 text-center animate-fade-in">
        <p className="text-muted-foreground mb-6">
          Live predictions. Real signals. See what changes next.
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
      {displayQuestions.length === 0 && (
        <section className="text-center py-20 animate-fade-in">
          <p className="text-lg text-muted-foreground">We are updating our signals. Check back in a few hours.</p>
        </section>
      )}
    </div>
  );
}
