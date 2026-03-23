import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DirectionBadge } from "@/components/direction-badge";
import { FreshnessBadge } from "@/components/freshness-badge";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import { LocationStrip } from "@/components/location-strip";
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

export default async function LandingPage() {
  const supabase = await createClient();

  // Location inference — soft relevance hint
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

  // Section label for regional suggestions
  const regionSectionLabel = effectiveLocation.region && effectiveLocation.region.length > 2
    ? `Relevant to ${effectiveLocation.region}`
    : effectiveLocation.country
      ? `Relevant to ${getCountryDisplayName(effectiveLocation.country) ?? effectiveLocation.country}`
      : null;

  // Load ALL published topic cards
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

  // Pick hero card — the one with the best one-liner
  const heroCard = cards.find((c) => c.one_liner && c.one_liner.length > 30) ?? cards[0];

  // Group topics by category for lanes
  const cardsByCategory = new Map<string, typeof cards>();
  const topicsByCategory = new Map<string, typeof topics>();

  for (const card of cards) {
    if (!card.category) continue;
    const existing = cardsByCategory.get(card.category) ?? [];
    existing.push(card);
    cardsByCategory.set(card.category, existing);
  }

  for (const topic of topics) {
    if (!topic.category) continue;
    const existing = topicsByCategory.get(topic.category) ?? [];
    existing.push(topic);
    topicsByCategory.set(topic.category, existing);
  }

  // Time formatting
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
      {/* Compact hero — headline + search, not dominating */}
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
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Know What&apos;s Coming
          </h1>
        </div>
        <Link
          href="/search"
          className="flex h-11 items-center rounded-2xl border border-border bg-card px-5 text-sm text-muted-foreground transition-all hover:border-navy/20 hover:shadow-sm sm:w-64"
        >
          Search any subject
        </Link>
      </section>

      {/* Hero subject card */}
      {heroCard && (
        <section className="pb-8 animate-slide-up delay-75">
          <Link href={`/topics/${heroCard.slug}`}>
            <Card className="rounded-3xl border-0 bg-card shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-300">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {heroCard.category && (
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                        {heroCard.category}
                      </span>
                    )}
                    {heroCard.snapshot_published_at && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {timeAgo(heroCard.snapshot_published_at)}
                      </span>
                    )}
                  </div>
                  {heroCard.freshness && <FreshnessBadge freshness={heroCard.freshness} />}
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                  {heroCard.canonical_name}
                </h2>
                {heroCard.one_liner && (
                  <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed max-w-xl">
                    {heroCard.one_liner}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
                  {heroCard.direction && <DirectionBadge direction={heroCard.direction} size="md" />}
                  {heroCard.confidence !== null && (
                    <span className="font-mono text-sm font-bold text-navy">
                      {Math.round(heroCard.confidence * 100)}% confidence
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">View signals</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* Location strip — subtle, non-intrusive */}
      <LocationStrip displayText={locationDisplay} isConfirmed={effectiveLocation.isConfirmed} />

      {/* Popular now — the issues people are actively searching */}
      <section className="pb-6 animate-fade-in delay-150">
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">
          Popular now
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { q: "Are mortgage rates going up or down?", slug: "us-mortgage-rates" },
            { q: "Is the Middle East conflict escalating further?", slug: "iran-us-tensions" },
            { q: "Will the Fed cut rates this summer?", slug: "us-federal-reserve-interest-rates" },
            { q: "Where is Bitcoin heading next?", slug: "bitcoin-price" },
            { q: "Who is becoming the World Cup favorite?", slug: "fifa-world-cup-2026" },
            { q: "Is the China-Taiwan standoff intensifying?", slug: "china-taiwan-relations" },
          ].map((item, i) => (
            <Link
              key={item.q}
              href={`/topics/${item.slug}`}
              className={`rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm text-navy font-medium transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5 hover:-translate-y-px active:scale-[0.98] animate-fade-in ${i === 0 ? "" : i === 1 ? "delay-75" : i === 2 ? "delay-150" : i === 3 ? "delay-225" : i === 4 ? "delay-300" : "delay-375"}`}
            >
              {item.q}
            </Link>
          ))}
        </div>
      </section>

      {/* What's worrying people — anxieties and risks */}
      <AnimateOnScroll>
        <section className="pb-6">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">
            What&apos;s worrying people
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              { q: "Is a recession becoming more likely?", slug: "global-recession-risk" },
              { q: "Are grocery prices still rising?", slug: "us-inflation-rate" },
              { q: "Will gas prices hit a new all-time high?", slug: "us-gas-prices" },
              { q: "Is housing getting easier or harder?", slug: "us-housing-market" },
              { q: "Is a broader regional war becoming likely?", slug: "iran-us-tensions" },
              { q: "Are oil prices headed higher?", slug: "global-oil-prices" },
            ].map((item) => (
              <Link
                key={item.q}
                href={`/topics/${item.slug}`}
                className="rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm text-navy font-medium transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5 hover:-translate-y-px active:scale-[0.98]"
              >
                {item.q}
              </Link>
            ))}
          </div>
        </section>
      </AnimateOnScroll>

      {/* What's changing fast — momentum shifts people are watching */}
      <AnimateOnScroll>
        <section className="pb-8">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">
            What&apos;s changing fast
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              { q: "Will Israel invade Iran on the ground?", slug: "iran-us-tensions" },
              { q: "Is the Israel-Palestine conflict escalating?", slug: "israel-palestine-conflict" },
              { q: "Will Zelenskyy and Putin actually meet?", slug: "russia-ukraine-war" },
              { q: "Will the US attack Cuba?", slug: "us-cuba-relations" },
              { q: "What is changing in the Israel-Palestine conflict?", slug: "israel-palestine-conflict" },
              { q: "Who's winning the NBA playoffs?", slug: "nba-season-2025-26" },
            ].map((item) => (
              <Link
                key={item.q}
                href={`/topics/${item.slug}`}
                className="rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm text-navy font-medium transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5 hover:-translate-y-px active:scale-[0.98]"
              >
                {item.q}
              </Link>
            ))}
          </div>
        </section>
      </AnimateOnScroll>

      {/* Regional suggestions — shown only when location is available */}
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

      {/* Category lanes — the live subject newspaper */}
      {orderedLanes.map((lane) => {
        const laneCards = cardsByCategory.get(lane.key) ?? [];
        const laneTopics = topicsByCategory.get(lane.key) ?? [];

        // Skip empty lanes
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

              {/* Cards with snapshot data */}
              {laneCards.length > 0 && (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-3">
                  {laneCards.slice(0, 3).map((card) => (
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

      {/* CTA — after showing all the content */}
      <AnimateOnScroll animation="animate-fade-in">
        <section className="py-10 text-center border-t border-border/40">
          <p className="text-sm text-muted-foreground mb-4">
            Follow subjects, not sources. Build your personal signal feed.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/onboarding" className="inline-flex h-11 items-center rounded-full bg-navy px-8 text-sm font-medium text-white transition-all hover:bg-navy/90 active:scale-[0.98]">
              Build Your Feed
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
