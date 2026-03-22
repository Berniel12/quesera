import type { SupabaseClient } from "@supabase/supabase-js";
import { TRIGRAM_MIN_FLOOR, TRIGRAM_TOP_N } from "../types.js";
import { preprocessText } from "../preprocessing.js";

export interface TrigramResult {
  topicId: string;
  topicSlug: string;
  score: number;
}

/**
 * Search topics by trigram similarity against canonical names and aliases.
 * Returns top N topics above the minimum floor, deduped by topic_id (highest score wins).
 * Ties broken by canonical_name ASC.
 */
export async function trigramSearch(
  supabase: SupabaseClient,
  text: string,
  category: string | null,
): Promise<TrigramResult[]> {
  const normalized = preprocessText(text);
  if (!normalized || normalized.length < 2) {
    return [];
  }

  // Query topics by canonical name similarity
  let query = supabase.rpc("trigram_search_topics", {
    search_text: normalized,
    min_similarity: TRIGRAM_MIN_FLOOR,
    max_results: TRIGRAM_TOP_N * 2, // fetch extra to allow dedup
  });

  if (category) {
    query = query.eq("topic_category", category);
  }

  const { data, error } = await query;

  if (error) {
    // Fall back to basic ilike if RPC not available
    return fallbackSearch(supabase, normalized, category);
  }

  const results = (data ?? []) as Array<{
    topic_id: string;
    topic_slug: string;
    similarity_score: number;
  }>;

  // Dedup by topic_id, keep highest score, sort by score desc then name asc
  const deduped = new Map<string, TrigramResult>();
  for (const r of results) {
    const existing = deduped.get(r.topic_id);
    if (!existing || r.similarity_score > existing.score) {
      deduped.set(r.topic_id, {
        topicId: r.topic_id,
        topicSlug: r.topic_slug,
        score: r.similarity_score,
      });
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.score - a.score || a.topicSlug.localeCompare(b.topicSlug))
    .slice(0, TRIGRAM_TOP_N);
}

/**
 * Fallback to basic ilike search if the trigram RPC is not available.
 */
async function fallbackSearch(
  supabase: SupabaseClient,
  text: string,
  category: string | null,
): Promise<TrigramResult[]> {
  let query = supabase
    .from("topics")
    .select("id, slug, canonical_name")
    .eq("status", "active")
    .eq("is_public", true)
    .ilike("canonical_name", `%${text}%`)
    .limit(TRIGRAM_TOP_N);

  if (category) {
    query = query.eq("category", category);
  }

  const { data } = await query;

  return (data ?? []).map((t) => {
    const topic = t as { id: string; slug: string; canonical_name: string };
    return {
      topicId: topic.id,
      topicSlug: topic.slug,
      score: 0.5, // default score for ilike fallback
    };
  });
}
