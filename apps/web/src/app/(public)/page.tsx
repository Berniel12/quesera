import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DirectionBadge } from "@/components/direction-badge";
import { FreshnessBadge } from "@/components/freshness-badge";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import { LocationStrip } from "@/components/location-strip";
import { QuestionCard } from "@/components/question-card";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  getInferredLocation,
  getLocationDisplayText,
  getTopicSuggestionsForLocation,
  reorderLanes,
  type EffectiveLocation,
} from "@/lib/geo";
import { getCountryDisplayName } from "@/lib/countries";

// Category lanes with display labels
const CATEGORY_LANES = [
  { key: "geopolitics", label: "World & Conflicts" },
  { key: "macro", label: "Money & Daily Life" },
  { key: "politics", label: "Politics" },
  { key: "sports", label: "Sports" },
  { key: "crypto", label: "Crypto" },
  { key: "tech", label: "Tech & AI" },
  { key: "entertainment", label: "Entertainment" },
  { key: "disasters", label: "Weather & Safety" },
];

interface QuestionWithCard {
  question_text: string;
  display_context: string | null;
  is_featured: boolean;
  sort_order: number;
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

  // Location inference
  const reqHeaders = await headers();
  const inferred = getInferredLocation(reqHeaders);
  const effectiveLocation: EffectiveLocation = {
    country: inferred.country,
    region: inferred.region,
    city: null,
    source: inferred.country ? "inferred" : "none",
    isConfirmed: false,
  };
  const locationDisplay = getLocationDisplayText(effectiveLocation);
  const suggestedSlugs = getTopicSuggestionsForLocation(effectiveLocation);
  const orderedLanes = reorderLanes(CATEGORY_LANES, inferred.country);

  const regionSectionLabel = effectiveLocation.region && effectiveLocation.region.length > 2
    ? `Relevant to ${effectiveLocation.region}`
    : effectiveLocation.country
      ? `Relevant to ${getCountryDisplayName(effectiveLocation.country) ?? effectiveLocation.country}`
      : null;

  // Load question wrappers joined to published topic cards (INNER JOIN — no snapshot = no display)
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
    .order("sort_order", { ascending: true });

  // Load published topic cards separately for enrichment
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

  // Build enriched questions: only include those whose topic has a published card
  const questions: QuestionWithCard[] = [];
  for (const raw of rawQuestions ?? []) {
    const r = raw as unknown as {
      question_text: string;
      display_context: string | null;
      is_featured: boolean;
      sort_order: number;
      topics: Array<{ id: string; slug: string; category: string | null; status: string; is_public: boolean }> | { id: string; slug: string; category: string | null; status: string; is_public: boolean };
    };
    // Supabase joins may return array or object depending on cardinality
    const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics;
    if (!topic || topic.status !== "active" || !topic.is_public) continue;
    const card = cardByTopicId.get(topic.id);
    if (!card) continue; // No published snapshot = no display (honesty rule)
    questions.push({
      question_text: r.question_text,
      display_context: r.display_context,
      is_featured: r.is_featured,
      sort_order: r.sort_order,
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

  // Group questions by display_context
  const popular = questions.filter((q) => q.display_context === "popular" && q.is_featured);
  const worrying = questions.filter((q) => q.display_context === "worrying" && q.is_featured);
  const changing = questions.filter((q) => q.display_context === "changing" && q.is_featured);

  // Pick hero: best featured question with a strong one-liner
  const heroQ = popular.find((q) => q.one_liner && q.one_liner.length > 30) ?? popular[0] ?? questions[0];

  // Group cards by category for lanes
  const cardsByCategory = new Map<string, typeof cards>();
  for (const card of cards) {
    if (!card.category) continue;
    const existing = cardsByCategory.get(card.category) ?? [];
    existing.push(card);
    cardsByCategory.set(card.category, existing);
  }

  // Load all active topics for lanes without snapshots
  const { data: allTopics } = await supabase
    .from("topics")
    .select("id, canonical_name, slug, category")
    .eq("status", "active")
    .eq("is_public", true)
    .order("canonical_name")
    .limit(100);

  const topics = (allTopics ?? []) as Array<{
    id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
  }>;

  const topicsByCategory = new Map<string, typeof topics>();
  for (const topic of topics) {
    if (!topic.category) continue;
    const existing = topicsByCategory.get(topic.category) ?? [];
    existing.push(topic);
    topicsByCategory.set(topic.category, existing);
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

  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero — question-first */}
      <section className="pt-8 pb-6 sm:pt-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-slide-up">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="relative h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-positive animate-pulse-live" />
              <span className="relative block h-2 w-2 rounded-full bg-positive" />
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Live Intelligence
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl leading-tight">
            What do you want to know about the future?
          </h1>
        </div>
        <Link
          href="/search"
          className="flex h-11 items-center rounded-2xl border border-border bg-card px-5 text-sm text-muted-foreground transition-all hover:border-navy/20 hover:shadow-sm sm:w-64"
        >
          Ask any question
        </Link>
      </section>

      {/* Hero question card */}
      {heroQ && (
        <section className="pb-8 animate-slide-up delay-75">
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

      {/* Location strip */}
      <LocationStrip displayText={locationDisplay} isConfirmed={effectiveLocation.isConfirmed} />

      {/* Popular now — database-backed questions */}
      {popular.length > 0 && (
        <section className="pb-6 animate-fade-in delay-150">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">
            Popular now
          </h2>
          <div className="flex flex-wrap gap-2">
            {popular.map((q, i) => (
              <Link
                key={q.question_text}
                href={`/topics/${q.slug}`}
                className={`rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm text-navy font-medium transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5 hover:-translate-y-px active:scale-[0.98] animate-fade-in ${i === 0 ? "" : i === 1 ? "delay-75" : i === 2 ? "delay-150" : i === 3 ? "delay-225" : i === 4 ? "delay-300" : "delay-375"}`}
              >
                {q.question_text}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* What's worrying people — database-backed */}
      {worrying.length > 0 && (
        <AnimateOnScroll>
          <section className="pb-6">
            <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">
              What&apos;s worrying people
            </h2>
            <div className="flex flex-wrap gap-2">
              {worrying.map((q) => (
                <Link
                  key={q.question_text}
                  href={`/topics/${q.slug}`}
                  className="rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm text-navy font-medium transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5 hover:-translate-y-px active:scale-[0.98]"
                >
                  {q.question_text}
                </Link>
              ))}
            </div>
          </section>
        </AnimateOnScroll>
      )}

      {/* What's changing fast — database-backed */}
      {changing.length > 0 && (
        <AnimateOnScroll>
          <section className="pb-8">
            <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">
              What&apos;s changing fast
            </h2>
            <div className="flex flex-wrap gap-2">
              {changing.map((q) => (
                <Link
                  key={q.question_text}
                  href={`/topics/${q.slug}`}
                  className="rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm text-navy font-medium transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5 hover:-translate-y-px active:scale-[0.98]"
                >
                  {q.question_text}
                </Link>
              ))}
            </div>
          </section>
        </AnimateOnScroll>
      )}

      {/* Regional suggestions */}
      {regionSectionLabel && suggestedSlugs.length > 0 && (() => {
        const suggestedCards = cards.filter((c) => suggestedSlugs.includes(c.slug));
        const suggestedTopics = topics.filter((t) => suggestedSlugs.includes(t.slug) && !suggestedCards.some((c) => c.slug === t.slug));
        if (suggestedCards.length === 0 && suggestedTopics.length === 0) return null;
        return (
          <AnimateOnScroll>
            <section className="pb-8">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">
                {regionSectionLabel}
              </h2>
              {suggestedCards.length > 0 && (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-3">
                  {suggestedCards.slice(0, 3).map((card) => (
                    <Link key={card.topic_id} href={`/topics/${card.slug}`}>
                      <Card className="rounded-2xl border-0 bg-card shadow-sm hover:shadow-md hover:-translate-y-px active:scale-[0.98] transition-all duration-200 h-full">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            {card.direction && <DirectionBadge direction={card.direction} size="sm" />}
                            {card.snapshot_published_at && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {timeAgo(card.snapshot_published_at)}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-sm text-navy">{card.canonical_name}</p>
                          {card.one_liner && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {card.one_liner}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
              {suggestedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTopics.slice(0, 6).map((t) => (
                    <Link
                      key={t.slug}
                      href={`/topics/${t.slug}`}
                      className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-foreground transition-all hover:border-navy/30 hover:shadow-sm hover:-translate-y-px active:scale-[0.98]"
                    >
                      {t.canonical_name}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </AnimateOnScroll>
        );
      })()}

      {/* Category lanes */}
      {orderedLanes.map((lane) => {
        const laneCards = cardsByCategory.get(lane.key) ?? [];
        const laneTopics = topicsByCategory.get(lane.key) ?? [];
        // Get questions for this category
        const laneQuestions = questions.filter((q) => q.category === lane.key);

        if (laneCards.length === 0 && laneTopics.length === 0) return null;

        return (
          <AnimateOnScroll key={lane.key}>
            <section className="pb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
                  {lane.label}
                </h2>
                <Link
                  href={`/categories/${lane.key}`}
                  className="text-[11px] text-muted-foreground hover:text-navy transition-colors"
                >
                  View all
                </Link>
              </div>

              {/* Cards with snapshot data — engaging question cards */}
              {laneCards.length > 0 && (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-3">
                  {laneCards.slice(0, 3).map((card) => {
                    const cardQuestion = laneQuestions.find((q) => q.topic_id === card.topic_id);
                    return (
                      <QuestionCard
                        key={card.topic_id}
                        questionText={cardQuestion ? cardQuestion.question_text : card.canonical_name}
                        slug={card.slug}
                        category={card.category}
                        direction={card.direction}
                        confidence={card.confidence}
                        freshness={card.freshness}
                        oneLiner={card.one_liner}
                        snapshotPublishedAt={card.snapshot_published_at}
                        variant="compact"
                      />
                    );
                  })}
                </div>
              )}

              {/* Topics without snapshots — shown as chips */}
              {laneTopics.length > laneCards.length && (
                <div className="flex flex-wrap gap-1.5">
                  {laneTopics
                    .filter((t) => !laneCards.some((c) => c.slug === t.slug))
                    .slice(0, 8)
                    .map((t) => (
                      <Link
                        key={t.slug}
                        href={`/topics/${t.slug}`}
                        className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-foreground transition-all hover:border-navy/30 hover:shadow-sm hover:-translate-y-px active:scale-[0.98]"
                      >
                        {t.canonical_name}
                      </Link>
                    ))}
                </div>
              )}
            </section>
          </AnimateOnScroll>
        );
      })}

      {/* CTA */}
      <AnimateOnScroll animation="animate-fade-in">
        <section className="py-10 text-center border-t border-border/40">
          <p className="text-sm text-muted-foreground mb-4">
            Follow the questions you care about. We keep watching them for you.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/onboarding" className="inline-flex h-11 items-center rounded-full bg-navy px-8 text-sm font-medium text-white transition-all hover:bg-navy/90 active:scale-[0.98]">
              Pick Your Questions
            </Link>
            <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-navy/20 px-8 text-sm font-medium text-navy transition-all hover:bg-navy/5 active:scale-[0.98]">
              Sign In
            </Link>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  );
}
