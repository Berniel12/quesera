import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInferredLocation, getTopicSuggestionsForLocation } from "@/lib/geo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  const supabase = await createClient();

  // Search canonical names via ilike (trigram similarity requires RPC; ilike uses GIN index)
  const { data: nameMatches } = await supabase
    .from("topics")
    .select("id, slug, canonical_name, category")
    .eq("status", "active")
    .eq("is_public", true)
    .ilike("canonical_name", `%${normalized}%`)
    .limit(50);

  // Search aliases via ilike
  const { data: aliasMatches } = await supabase
    .from("topic_aliases")
    .select("topic_id, alias")
    .ilike("alias", `%${normalized}%`)
    .limit(50);

  // Merge results, dedup by topic_id, keep highest relevance
  const topicScores = new Map<
    string,
    { id: string; slug: string; canonical_name: string; category: string | null; score: number }
  >();

  // Score canonical name matches higher
  for (const t of (nameMatches ?? []) as Array<{
    id: string;
    slug: string;
    canonical_name: string;
    category: string | null;
  }>) {
    const nameNorm = t.canonical_name.toLowerCase();
    const score = nameNorm === normalized ? 1.0 : nameNorm.includes(normalized) ? 0.8 : 0.5;
    const existing = topicScores.get(t.id);
    if (!existing || score > existing.score) {
      topicScores.set(t.id, {
        id: t.id,
        slug: t.slug,
        canonical_name: t.canonical_name,
        category: t.category,
        score,
      });
    }
  }

  // Add alias matches (slightly lower score, only if topic is public+active)
  if (aliasMatches) {
    const aliasTopicIds = (aliasMatches as Array<{ topic_id: string; alias: string }>)
      .map((a) => a.topic_id);

    if (aliasTopicIds.length > 0) {
      const { data: aliasTopics } = await supabase
        .from("topics")
        .select("id, slug, canonical_name, category")
        .in("id", aliasTopicIds)
        .eq("status", "active")
        .eq("is_public", true);

      for (const t of (aliasTopics ?? []) as Array<{
        id: string;
        slug: string;
        canonical_name: string;
        category: string | null;
      }>) {
        const score = 0.6; // alias match base score
        const existing = topicScores.get(t.id);
        if (!existing || score > existing.score) {
          topicScores.set(t.id, {
            id: t.id,
            slug: t.slug,
            canonical_name: t.canonical_name,
            category: t.category,
            score,
          });
        }
      }
    }
  }

  // Location relevance bias — additive, deterministic, not a separate ranking system
  const reqHeaders = new Headers(request.headers);
  const inferred = getInferredLocation(reqHeaders);
  const locationSlugs = new Set(
    getTopicSuggestionsForLocation({
      country: inferred.country,
      region: inferred.region,
      city: null,
      source: inferred.country ? "inferred" : "none",
      isConfirmed: false,
    }),
  );

  if (locationSlugs.size > 0) {
    for (const [id, entry] of topicScores) {
      if (locationSlugs.has(entry.slug)) {
        topicScores.set(id, { ...entry, score: entry.score + 0.15 });
      }
    }
  }

  // Sort: score DESC, canonical_name ASC (tiebreaker)
  const sorted = Array.from(topicScores.values())
    .sort((a, b) => b.score - a.score || a.canonical_name.localeCompare(b.canonical_name))
    .slice(0, 50);

  // Enrich with signal data from public_topic_cards
  const resultIds = sorted.map((r) => r.id);
  const cardMap = new Map<
    string,
    { one_liner: string | null; direction: string | null; confidence: number | null; freshness: string | null }
  >();

  if (resultIds.length > 0) {
    const { data: cards } = await supabase
      .from("public_topic_cards")
      .select("topic_id, one_liner, direction, confidence, freshness")
      .in("topic_id", resultIds);

    for (const c of (cards ?? []) as Array<{
      topic_id: string;
      one_liner: string | null;
      direction: string | null;
      confidence: number | null;
      freshness: string | null;
    }>) {
      cardMap.set(c.topic_id, {
        one_liner: c.one_liner,
        direction: c.direction,
        confidence: c.confidence,
        freshness: c.freshness,
      });
    }
  }

  const results = sorted.map((r) => {
    const card = cardMap.get(r.id);
    return {
      ...r,
      one_liner: card?.one_liner ?? null,
      direction: card?.direction ?? null,
      confidence: card?.confidence ?? null,
      freshness: card?.freshness ?? null,
    };
  });

  return NextResponse.json({ results });
}
