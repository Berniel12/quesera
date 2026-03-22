import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopicCard } from "@/components/topic-card";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Only public collections are visible
  const { data: collection } = await supabase
    .from("collections")
    .select("id, title, description")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!collection) notFound();
  const col = collection as { id: string; title: string; description: string | null };

  // Load collection topics
  const { data: collTopics } = await supabase
    .from("collection_topics")
    .select("topic_id, sort_order")
    .eq("collection_id", col.id)
    .order("sort_order", { ascending: true });

  const topicIds = ((collTopics ?? []) as Array<{ topic_id: string }>).map((ct) => ct.topic_id);

  let topicCards: Array<{
    topic_id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    direction: string | null;
    confidence: number | null;
    freshness: string | null;
    one_liner: string | null;
  }> = [];

  if (topicIds.length > 0) {
    const { data: cards } = await supabase
      .from("public_topic_cards")
      .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner")
      .in("topic_id", topicIds);

    topicCards = (cards ?? []) as typeof topicCards;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-navy mb-2">
        {col.title}
      </h1>
      {col.description && (
        <p className="text-muted-foreground mb-8">{col.description}</p>
      )}

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
          This collection has no topics yet.
        </p>
      )}
    </div>
  );
}
