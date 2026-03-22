import type { SupabaseClient } from "@supabase/supabase-js";
import { preprocessText } from "../preprocessing.js";

/**
 * Preloaded topic data for entity scoring.
 * Batch-loaded once per matching run to avoid N+1 queries.
 */
export interface TopicEntityData {
  topicId: string;
  terms: Set<string>;
}

/**
 * Batch-load aliases, canonical names, and entity_refs for a set of topic IDs.
 * Call once per batch, then use scoreFromPreloaded() per item.
 */
export async function batchLoadTopicEntityData(
  supabase: SupabaseClient,
  topicIds: string[],
): Promise<Map<string, TopicEntityData>> {
  const result = new Map<string, TopicEntityData>();

  if (topicIds.length === 0) return result;

  // Batch load topics
  const { data: topics } = await supabase
    .from("topics")
    .select("id, canonical_name, entity_refs")
    .in("id", topicIds);

  // Batch load aliases for all topic IDs
  const { data: aliases } = await supabase
    .from("topic_aliases")
    .select("topic_id, alias")
    .in("topic_id", topicIds);

  // Build term sets per topic
  for (const t of (topics ?? []) as Array<{
    id: string;
    canonical_name: string;
    entity_refs: unknown;
  }>) {
    const terms = new Set<string>();
    terms.add(preprocessText(t.canonical_name));

    if (Array.isArray(t.entity_refs)) {
      for (const ref of t.entity_refs) {
        if (typeof ref === "string") {
          terms.add(preprocessText(ref));
        }
      }
    }

    result.set(t.id, { topicId: t.id, terms });
  }

  // Add aliases to their respective topic term sets
  for (const a of (aliases ?? []) as Array<{ topic_id: string; alias: string }>) {
    const entry = result.get(a.topic_id);
    if (entry) {
      entry.terms.add(preprocessText(a.alias));
    }
  }

  return result;
}

/**
 * Score entity overlap using preloaded topic data.
 * Uses substring containment (deliberately broader than strict Jaccard)
 * for better matching of partial entity names like "Japan" in "Fukushima, Japan".
 */
export function scoreFromPreloaded(
  topicData: TopicEntityData,
  extractedEntities: string[],
): number {
  if (extractedEntities.length === 0 || topicData.terms.size === 0) {
    return 0;
  }

  const sourceTerms = new Set(
    extractedEntities.map((e) => preprocessText(e)).filter(Boolean),
  );

  if (sourceTerms.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const term of sourceTerms) {
    for (const topicTerm of topicData.terms) {
      if (topicTerm.includes(term) || term.includes(topicTerm)) {
        intersection++;
        break;
      }
    }
  }

  const union = sourceTerms.size + topicData.terms.size - intersection;
  return union > 0 ? intersection / union : 0;
}
