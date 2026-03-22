import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopicCard } from "@/components/topic-card";
import { DashboardTopicCard } from "@/components/dashboard-topic-card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Load followed topics
  const { data: follows } = await supabase
    .from("user_followed_topics")
    .select("topic_id")
    .eq("user_id", user.id);

  const followedTopicIds = ((follows ?? []) as Array<{ topic_id: string }>).map(
    (f) => f.topic_id,
  );

  // Load topic cards + seen snapshots for followed topics
  interface FollowedCard {
    topic_id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    direction: string | null;
    confidence: number | null;
    freshness: string | null;
    one_liner: string | null;
  }

  let followedCards: FollowedCard[] = [];
  const seenMap = new Map<string, string>(); // topic_id -> last_seen_snapshot_id
  const latestMap = new Map<string, { snapshot_id: string; direction: string }>(); // topic_id -> latest

  if (followedTopicIds.length > 0) {
    const { data: cards } = await supabase
      .from("public_topic_cards")
      .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner")
      .in("topic_id", followedTopicIds);

    followedCards = (cards ?? []) as FollowedCard[];

    // Load seen snapshots
    const { data: seenRows } = await supabase
      .from("user_topic_seen_snapshots")
      .select("topic_id, last_seen_snapshot_id")
      .eq("user_id", user.id)
      .in("topic_id", followedTopicIds);

    for (const s of (seenRows ?? []) as Array<{ topic_id: string; last_seen_snapshot_id: string }>) {
      seenMap.set(s.topic_id, s.last_seen_snapshot_id);
    }

    // Load latest snapshot pointers
    const { data: latestRows } = await supabase
      .from("topic_latest_snapshot")
      .select("topic_id, snapshot_id")
      .in("topic_id", followedTopicIds);

    for (const l of (latestRows ?? []) as Array<{ topic_id: string; snapshot_id: string }>) {
      // Get direction from the card data
      const card = followedCards.find((c) => c.topic_id === l.topic_id);
      latestMap.set(l.topic_id, {
        snapshot_id: l.snapshot_id,
        direction: card?.direction ?? "unknown",
      });
    }
  }

  // Load trending for empty state
  let trendingCards: FollowedCard[] = [];
  if (followedCards.length === 0) {
    const { data: trending } = await supabase
      .from("public_topic_cards")
      .select("topic_id, canonical_name, slug, category, direction, confidence, freshness, one_liner, snapshot_published_at")
      .order("snapshot_published_at", { ascending: false })
      .limit(6);

    trendingCards = (trending ?? []) as FollowedCard[];
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight text-navy mb-6">
        Your Topics
      </h1>

      {followedCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {followedCards.map((card) => {
            const seenSnapId = seenMap.get(card.topic_id);
            const latest = latestMap.get(card.topic_id);
            const hasChanges = Boolean(
              latest && seenSnapId && latest.snapshot_id !== seenSnapId,
            );

            return (
              <DashboardTopicCard
                key={card.topic_id}
                slug={card.slug}
                canonicalName={card.canonical_name}
                category={card.category}
                direction={card.direction}
                confidence={card.confidence}
                freshness={card.freshness}
                oneLiner={card.one_liner}
                hasChanges={hasChanges}
                currentDirection={card.direction ?? undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-lg text-muted-foreground mb-8">
            Follow topics to build your personal dashboard.
          </p>

          {trendingCards.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
                Suggested Topics
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trendingCards.map((card) => (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
