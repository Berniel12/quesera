import { createClient } from "@/lib/supabase/server";
import { TopicCard } from "@/components/topic-card";
import Link from "next/link";

// Concrete example subjects to spark imagination — no auth needed to explore
const EXAMPLE_SUBJECTS = [
  { label: "Will the Fed cut rates this summer?", slug: "us-federal-reserve-interest-rates" },
  { label: "Is Iran headed for war with the US?", slug: "iran-us-tensions" },
  { label: "Where is Bitcoin going?", slug: "bitcoin-price" },
  { label: "Who will win the World Cup 2026?", slug: "fifa-world-cup-2026" },
  { label: "Will there be a global recession?",  slug: "global-recession-risk" },
  { label: "What is happening in Lebanon?", slug: "lebanon-war-2026" },
  { label: "Is the housing market crashing?", slug: "us-housing-market" },
  { label: "What is TikTok's future in the US?", slug: "tiktok-ban" },
];

export default async function LandingPage() {
  const supabase = await createClient();

  const { data: cards } = await supabase
    .from("public_topic_cards")
    .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner, snapshot_published_at")
    .order("snapshot_published_at", { ascending: false })
    .limit(12);

  const { data: categoryRows } = await supabase
    .from("topics")
    .select("category")
    .eq("status", "active")
    .eq("is_public", true)
    .not("category", "is", null);

  const categories = [
    ...new Set(
      ((categoryRows ?? []) as Array<{ category: string | null }>)
        .map((r) => r.category)
        .filter((c): c is string => c !== null),
    ),
  ];

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

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="py-16 sm:py-20 text-center">
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-navy" />
        <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          QUESERA
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
          See where the signals point on any subject you care about.
          Markets, conflicts, elections, sports, crypto — all in one place.
        </p>
        <div className="mt-8 mx-auto max-w-lg">
          <Link
            href="/search"
            className="flex h-12 items-center rounded-full border border-border bg-card px-6 text-muted-foreground transition-all hover:border-navy/20 hover:shadow-sm"
          >
            Search any subject...
          </Link>
        </div>
        <div className="mt-4 flex gap-3 justify-center flex-wrap">
          <Link href="/onboarding" className="inline-flex h-11 items-center rounded-full bg-navy px-8 text-sm font-medium text-white transition-colors hover:bg-navy/90">
            Build Your Feed
          </Link>
          <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-navy/20 px-8 text-sm font-medium text-navy transition-colors hover:bg-navy/5">
            Sign In
          </Link>
        </div>
      </section>

      {/* Concrete examples — spark imagination */}
      <section className="pb-12">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-center mb-6">
          People are asking
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_SUBJECTS.map((ex) => (
            <Link
              key={ex.slug}
              href={`/topics/${ex.slug}`}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-all hover:border-navy/30 hover:shadow-sm"
            >
              {ex.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="pb-8">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/categories/${cat}`}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground capitalize"
              >
                {cat}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest Signals */}
      <section className="pb-20">
        <h2 className="text-lg font-semibold tracking-tight mb-6">
          Latest Signals
        </h2>
        {topicCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topicCards.map((card) => (
              <TopicCard
                key={card.topic_id}
                slug={card.slug}
                canonicalName={card.canonical_name}
                category={card.category}
                direction={card.direction}
                confidence={card.confidence}
                freshness={card.freshness}
                oneLiner={card.one_liner}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            Signals are being processed. Check back shortly.
          </p>
        )}
      </section>
    </div>
  );
}
