import { createClient } from "@/lib/supabase/server";
import { DirectionBadge } from "@/components/direction-badge";
import { ConfidenceBar } from "@/components/confidence-bar";
import { FreshnessBadge } from "@/components/freshness-badge";
import { TopicCard } from "@/components/topic-card";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default async function LandingPage() {
  const supabase = await createClient();

  // Load all topic cards with published snapshots
  const { data: cards } = await supabase
    .from("public_topic_cards")
    .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner, snapshot_published_at")
    .order("snapshot_published_at", { ascending: false })
    .limit(12);

  const topicCards = (cards ?? []) as Array<{
    topic_id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    direction: string | null;
    confidence: number | null;
    freshness: string | null;
    one_liner: string | null;
  }>;

  // Pick the first card with a one_liner as the hero
  const heroCard = topicCards.find((c) => c.one_liner) ?? topicCards[0];
  const secondaryCards = topicCards.filter((c) => c !== heroCard).slice(0, 5);

  // Load all active topics for the "explore" section
  const { data: allTopics } = await supabase
    .from("topics")
    .select("canonical_name, slug, category")
    .eq("status", "active")
    .eq("is_public", true)
    .order("canonical_name")
    .limit(50);

  const topics = (allTopics ?? []) as Array<{
    canonical_name: string;
    slug: string;
    category: string | null;
  }>;

  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero — tight, sharp, product-first */}
      <section className="pt-12 pb-8 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl max-w-lg">
          See where the story is heading.
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-md">
          Follow any subject through live signals.
          From mortgage rates to Jerusalem to the World Cup.
        </p>

        {/* Search — main action, right under headline */}
        <div className="mt-6 max-w-md">
          <Link
            href="/search"
            className="flex h-12 items-center rounded-full border border-border bg-card px-5 text-sm text-muted-foreground transition-all hover:border-navy/20 hover:shadow-sm"
          >
            Search any subject
          </Link>
        </div>
      </section>

      {/* Hero subject card — show the product immediately */}
      {heroCard && (
        <section className="pb-6">
          <Link href={`/topics/${heroCard.slug}`}>
            <Card className="rounded-3xl border-border/40 bg-card hover:shadow-md transition-all duration-300 overflow-hidden">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-3">
                  {heroCard.category && (
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {heroCard.category}
                    </span>
                  )}
                  {heroCard.freshness && <FreshnessBadge freshness={heroCard.freshness} />}
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                  {heroCard.canonical_name}
                </h2>
                {heroCard.one_liner && (
                  <p className="mt-2 text-base text-muted-foreground leading-relaxed max-w-xl">
                    {heroCard.one_liner}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-4">
                  {heroCard.direction && <DirectionBadge direction={heroCard.direction} size="lg" />}
                  {heroCard.confidence !== null && <ConfidenceBar confidence={heroCard.confidence} />}
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* Secondary live cards — compact row */}
      {secondaryCards.length > 0 && (
        <section className="pb-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {secondaryCards.map((card) => (
              <Link key={card.topic_id} href={`/topics/${card.slug}`}>
                <Card className="rounded-2xl border-border/40 hover:shadow-sm transition-all duration-200 h-full">
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm text-navy">{card.canonical_name}</p>
                    {card.one_liner && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.one_liner}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {card.direction && <DirectionBadge direction={card.direction} size="sm" />}
                      {card.freshness && <FreshnessBadge freshness={card.freshness} />}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explore — subject chips */}
      <section className="pb-6">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Explore what's moving
        </h2>
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, 30).map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5"
            >
              {t.canonical_name}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA — only after showing value */}
      <section className="py-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Track the subjects that shape your life.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/onboarding" className="inline-flex h-11 items-center rounded-full bg-navy px-8 text-sm font-medium text-white transition-colors hover:bg-navy/90">
            Build Your Feed
          </Link>
          <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-navy/20 px-8 text-sm font-medium text-navy transition-colors hover:bg-navy/5">
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
