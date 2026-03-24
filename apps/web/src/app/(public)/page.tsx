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

  // Filter: only show questions with alive topics (not dead/stale)
  const aliveQuestions = allQuestions.filter((q) =>
    q.freshness === "fresh" || q.freshness === "aging",
  );

  // Sort: movement first (up/down > stable > unknown), then location, then confidence
  aliveQuestions.sort((a, b) => {
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

      {/* Hero — daily briefing */}
      <section className="pt-10 pb-6 sm:pt-14 animate-slide-up">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 block animate-fade-in">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.05]">
          What do you want
          <br />
          <span className="text-muted-foreground">to know?</span>
        </h1>
      </section>

      {/* Search bar */}
      <section className="pb-10 animate-fade-in delay-200">
        <Link
          href="/search"
          className="flex h-14 items-center rounded-3xl px-6 text-base text-muted-foreground transition-shadow duration-300
            bg-card shadow-[0_10px_40px_rgba(11,19,38,0.04)] hover:shadow-[0_10px_40px_rgba(11,19,38,0.08)]
            dark:border dark:border-white/5 dark:hover:border-[#00DAF3]/20"
        >
          Search questions...
        </Link>
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
            <AnimateOnScroll key={q.topic_id} delay={i * 50}>
              <QuestionCard
                questionText={q.question_text}
                slug={q.slug}
                category={q.category}
                direction={q.direction}
                confidence={q.confidence}
                freshness={q.freshness}
                oneLiner={q.one_liner}
                snapshotPublishedAt={q.snapshot_published_at}
                variant="compact"
                staggerIndex={0}
              />
            </AnimateOnScroll>
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
