import { createClient } from "@/lib/supabase/server";
import { DirectionBadge } from "@/components/direction-badge";
import { FreshnessBadge } from "@/components/freshness-badge";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default async function LandingPage() {
  const supabase = await createClient();

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

  const heroCard = topicCards.find((c) => c.one_liner) ?? topicCards[0];
  const secondaryCards = topicCards.filter((c) => c !== heroCard).slice(0, 4);

  // Load all active topics for explore chips
  const { data: allTopics } = await supabase
    .from("topics")
    .select("canonical_name, slug, category")
    .eq("status", "active")
    .eq("is_public", true)
    .order("canonical_name")
    .limit(40);

  const topics = (allTopics ?? []) as Array<{
    canonical_name: string;
    slug: string;
    category: string | null;
  }>;

  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero — massive headline, live intelligence badge */}
      <section className="pt-10 pb-8 sm:pt-14">
        <div className="flex items-center gap-2 mb-6">
          <span className="h-2 w-2 rounded-full bg-positive animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Live Intelligence
          </span>
        </div>

        <h1 className="text-[2.75rem] leading-[1.1] font-bold tracking-tight text-navy sm:text-6xl">
          Know What's<br />Coming
        </h1>

        <p className="mt-5 text-base text-muted-foreground max-w-md leading-relaxed">
          Follow any subject through live signals — from
          Jerusalem to mortgage rates to the World Cup.
        </p>

        {/* Search — primary action */}
        <div className="mt-6 max-w-md">
          <Link
            href="/search"
            className="flex h-12 items-center rounded-2xl border border-border bg-card px-5 text-sm text-muted-foreground transition-all hover:border-navy/20 hover:shadow-sm"
          >
            Search any subject
          </Link>
        </div>
      </section>

      {/* Hero subject card — the product centerpiece */}
      {heroCard && (
        <section className="pb-6">
          <Link href={`/topics/${heroCard.slug}`}>
            <Card className="rounded-3xl border-0 bg-card shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-6 sm:p-8">
                {/* Category + freshness */}
                <div className="flex items-center justify-between mb-4">
                  {heroCard.category && (
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                      {heroCard.category}
                    </span>
                  )}
                  {heroCard.freshness && <FreshnessBadge freshness={heroCard.freshness} />}
                </div>

                {/* Subject name — large */}
                <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                  {heroCard.canonical_name}
                </h2>

                {/* One-liner intelligence summary */}
                {heroCard.one_liner && (
                  <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
                    {heroCard.one_liner}
                  </p>
                )}

                {/* Signal metrics row */}
                <div className="mt-5 pt-5 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {heroCard.direction && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Direction</p>
                          <DirectionBadge direction={heroCard.direction} size="md" />
                        </div>
                      )}
                      {heroCard.confidence !== null && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Confidence</p>
                          <p className="text-lg font-bold font-mono text-navy">{Math.round(heroCard.confidence * 100)}%</p>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">View signals →</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* Secondary cards — compact, informational */}
      {secondaryCards.length > 0 && (
        <section className="pb-8">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {secondaryCards.map((card) => (
              <Link key={card.topic_id} href={`/topics/${card.slug}`}>
                <Card className="rounded-2xl border-0 bg-card shadow-sm hover:shadow-md transition-all duration-200 h-full">
                  <CardContent className="p-4">
                    {card.category && (
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                        {card.category}
                      </span>
                    )}
                    <p className="font-bold text-sm text-navy mt-1">{card.canonical_name}</p>
                    {card.one_liner && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{card.one_liner}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {card.direction && <DirectionBadge direction={card.direction} size="sm" />}
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
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Explore what's moving
        </h2>
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, 30).map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-sm text-foreground transition-all hover:border-navy/30 hover:shadow-sm hover:bg-navy/5"
            >
              {t.canonical_name}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA — earned, after value */}
      <section className="py-12 text-center border-t border-border/40">
        <p className="text-sm text-muted-foreground mb-5">
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
