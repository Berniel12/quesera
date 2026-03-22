import { createClient } from "@/lib/supabase/server";
import { TopicCard } from "@/components/topic-card";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const supabase = await createClient();

  const { data: cards } = await supabase
    .from("public_topic_cards")
    .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner, snapshot_published_at")
    .eq("category", category)
    .order("snapshot_published_at", { ascending: false });

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
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-navy capitalize mb-8">
        {category}
      </h1>

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
          No topics in this category yet.
        </p>
      )}
    </div>
  );
}
