import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import { QuestionCard } from "@/components/question-card";
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

export default async function LandingPage() {
  const supabase = await createClient();

  // Location inference for feed ordering
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

  // Load question wrappers joined to published topic cards
  const { data: rawQuestions } = await supabase
    .from("question_wrappers")
    .select(`
      question_text,
      display_context,
      is_featured,
      sort_order,
      topics!inner (
        id,
        slug,
        category,
        status,
        is_public
      )
    `)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true });

  // Load published topic cards for enrichment
  const { data: allCards } = await supabase
    .from("public_topic_cards")
    .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner, snapshot_published_at")
    .order("snapshot_published_at", { ascending: false });

  const cards = (allCards ?? []) as Array<{
    topic_id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    direction: string | null;
    confidence: number | null;
    freshness: string | null;
    one_liner: string | null;
    snapshot_published_at: string | null;
  }>;

  const cardByTopicId = new Map(cards.map((c) => [c.topic_id, c]));

  // Build enriched question feed — only questions with published snapshots
  const seenSlugs = new Set<string>();
  const allQuestions: QuestionWithCard[] = [];

  for (const raw of rawQuestions ?? []) {
    const r = raw as unknown as {
      question_text: string;
      display_context: string | null;
      is_featured: boolean;
      sort_order: number;
      topics: Array<{ id: string; slug: string; category: string | null; status: string; is_public: boolean }> | { id: string; slug: string; category: string | null; status: string; is_public: boolean };
    };
    const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics;
    if (!topic || topic.status !== "active" || !topic.is_public) continue;

    const card = cardByTopicId.get(topic.id);
    if (!card) continue; // No snapshot = no display

    // Dedupe by slug (one question per topic in the feed)
    if (seenSlugs.has(topic.slug)) continue;
    seenSlugs.add(topic.slug);

    allQuestions.push({
      question_text: r.question_text,
      slug: topic.slug,
      category: topic.category,
      direction: card.direction,
      confidence: card.confidence,
      freshness: card.freshness,
      one_liner: card.one_liner,
      snapshot_published_at: card.snapshot_published_at,
      topic_id: topic.id,
    });
  }

  // Show all questions with snapshots — fresh first, then stale
  // Don't hide stale cards — a stale answer is better than no answer
  const aliveQuestions = allQuestions;

  // Sort: fresh/aging first, then movement, then location, then confidence
  aliveQuestions.sort((a, b) => {
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

  // Rotate hero question — changes each page load, picks from top candidates
  const heroPool = aliveQuestions.slice(0, Math.min(5, aliveQuestions.length));
  const heroIndex = heroPool.length > 0 ? Math.floor(Math.random() * heroPool.length) : 0;
  const heroQ = heroPool[heroIndex];
  const feedQuestions = aliveQuestions.filter((q) => q !== heroQ);

  return (
    <div className="mx-auto max-w-3xl px-6 dark:horizon-glow">

      {/* Compact header — get to content fast */}
      <section className="pt-6 pb-3 sm:pt-8 animate-slide-up">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground block">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight mt-1">
              Today&apos;s questions
            </h1>
          </div>
          <Link
            href="/search"
            className="flex h-10 items-center rounded-full px-5 text-sm text-muted-foreground
              bg-card border border-border/50 hover:border-border transition-colors
              dark:border-white/10 dark:hover:border-[#00DAF3]/30 flex-shrink-0"
          >
            Search
          </Link>
        </div>
      </section>

      {/* Empty state when no alive questions */}
      {aliveQuestions.length === 0 && (
        <section className="pb-8 text-center py-12 animate-fade-in">
          <p className="text-lg text-muted-foreground">We&apos;re updating our signals. Check back in a few hours.</p>
        </section>
      )}

      {/* Hero question card — the one big answer */}
      {heroQ && (
        <section className="pb-8">
          <QuestionCard
            questionText={heroQ.question_text}
            slug={heroQ.slug}
            category={heroQ.category}
            direction={heroQ.direction}
            confidence={heroQ.confidence}
            freshness={heroQ.freshness}
            oneLiner={heroQ.one_liner}
            snapshotPublishedAt={heroQ.snapshot_published_at}
            variant="hero"
          />
        </section>
      )}

      {/* Question feed — vertical stack of cards */}
      {feedQuestions.length > 0 && (
        <section className="flex flex-col gap-4 pb-8">
          {feedQuestions.map((q, i) => (
            <QuestionCard
              key={q.topic_id}
              questionText={q.question_text}
              slug={q.slug}
              category={q.category}
              direction={q.direction}
              confidence={q.confidence}
              freshness={q.freshness}
              oneLiner={q.one_liner}
              snapshotPublishedAt={q.snapshot_published_at}
              variant="compact"
              staggerIndex={i}
            />
          ))}
        </section>
      )}

      {/* CTA */}
      <AnimateOnScroll animation="animate-fade-in">
        <section className="py-12 text-center">
          <p className="text-muted-foreground mb-6">
            Follow the questions you care about.
            <br />
            We keep watching them for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/onboarding" className="inline-flex h-12 items-center justify-center rounded-full bg-navy dark:bg-[#00DAF3] px-8 text-sm font-medium text-white dark:text-[#00171B] hover-lift">
              Pick your questions
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-full bg-card dark:border dark:border-white/10 px-8 text-sm font-medium text-navy dark:text-foreground hover-lift-sm">
              Sign in
            </Link>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  );
}
