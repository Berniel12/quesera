import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import { extractMatchSignals, getSeedMapMatches } from "./extractors.js";
import { preprocessText, generateSlug } from "./preprocessing.js";
import { trigramSearch } from "./scorers/trigram.js";
import { batchLoadTopicEntityData, scoreFromPreloaded } from "./scorers/entity.js";
import { compositeScore } from "./scorers/composite.js";
import {
  ACCEPT_THRESHOLD,
  CANDIDATE_THRESHOLD,
  type TopicMatch,
} from "./types.js";
import { validateSignalRelevance } from "./llm-validator.js";

interface SourceItem {
  id: string;
  source_key: string;
  source_item_type: string | null;
  normalized_payload: Record<string, unknown>;
}

interface SourceDefinition {
  source_family: string;
}

interface MatchResult {
  matchedCount: number;
  candidateCount: number;
  discardedCount: number;
  topScores: number[];
}

/**
 * Match a single source item against seeded topics.
 * Deterministic: trigram + entity overlap + category boost.
 */
export async function matchSourceItem(
  item: SourceItem,
  sourceDef: SourceDefinition,
  supabase: SupabaseClient,
  logger: Logger,
): Promise<MatchResult> {
  const result: MatchResult = {
    matchedCount: 0,
    candidateCount: 0,
    discardedCount: 0,
    topScores: [],
  };

  // Skip reference entities
  if (item.source_item_type === "entity") {
    return result;
  }

  // 1. Check seed_map shortcut (supports multi-topic matching)
  const seedMapEntries = getSeedMapMatches(item);
  if (seedMapEntries) {
    for (const entry of seedMapEntries) {
      const { data: topic } = await supabase
        .from("topics")
        .select("id, canonical_name, category")
        .eq("slug", entry.slug)
        .eq("status", "active")
        .single();

      if (topic) {
        const t = topic as { id: string; canonical_name: string; category: string | null };

        // LLM validation for prediction market items (cheap check: does this signal belong here?)
        // Skip for deterministic matches (FRED, earthquakes, weather) -- these are correct by construction
        if (item.source_item_type === "market") {
          const signalText = String(item.normalized_payload.question ?? item.normalized_payload.slug ?? "");
          const isRelevant = await validateSignalRelevance(signalText, t.canonical_name, t.category, logger);
          if (!isRelevant) {
            result.discardedCount++;
            continue; // LLM says this signal doesn't belong -- skip it
          }
        }

        await insertMatch(supabase, item.id, t.id, "seed_map", entry.confidence, {
          seed_map_slug: entry.slug,
          series_id: item.normalized_payload.series_id,
        });
        result.matchedCount++;
        result.topScores.push(entry.confidence);
      }
    }
    if (result.matchedCount > 0) return result;
    // If ALL seed-map entries were LLM-rejected for a market item, don't fall through
    // to composite path -- the LLM already judged this signal irrelevant
    if (item.source_item_type === "market" && result.discardedCount > 0) return result;
  }

  // 2. Extract signals
  const signals = extractMatchSignals(item, sourceDef);
  if (!signals.text || preprocessText(signals.text).length < 2) {
    result.discardedCount++;
    return result;
  }

  // 3. Trigram search (uses RPC with fallback to ilike)
  const trigramResults = await trigramSearch(supabase, signals.text, signals.category);

  if (trigramResults.length === 0) {
    result.discardedCount++;
    return result;
  }

  // 4. Batch-load entity data and categories for all trigram candidates (avoids N+1)
  const candidateTopicIds = trigramResults.map((tr) => tr.topicId);
  const entityDataMap = await batchLoadTopicEntityData(supabase, candidateTopicIds);

  const { data: topicCategories } = await supabase
    .from("topics")
    .select("id, category, canonical_name")
    .in("id", candidateTopicIds);

  const categoryMap = new Map<string, string | null>();
  const nameMap = new Map<string, string>();
  for (const t of (topicCategories ?? []) as Array<{ id: string; category: string | null; canonical_name: string }>) {
    categoryMap.set(t.id, t.category);
    nameMap.set(t.id, t.canonical_name);
  }

  // 5. Score each candidate topic
  const matches: TopicMatch[] = [];

  for (const tr of trigramResults) {
    const entityData = entityDataMap.get(tr.topicId);
    const entScore = entityData
      ? scoreFromPreloaded(entityData, signals.entities)
      : 0;

    const topicCategory = categoryMap.get(tr.topicId) ?? null;
    const catMatch = signals.category !== null && topicCategory === signals.category;
    const composite = compositeScore(tr.score, entScore, catMatch);

    matches.push({
      topicId: tr.topicId,
      topicSlug: tr.topicSlug,
      trigramScore: tr.score,
      entityScore: entScore,
      categoryMatch: catMatch ? 1.0 : 0.0,
      compositeScore: composite,
      matchMethod: "composite",
    });
  }

  // Sort by composite score desc
  matches.sort((a, b) => b.compositeScore - a.compositeScore);

  // 6. Apply thresholds
  for (const match of matches) {
    result.topScores.push(match.compositeScore);

    if (match.compositeScore >= ACCEPT_THRESHOLD) {
      // LLM validation for prediction market items on the composite path too
      if (item.source_item_type === "market") {
        const signalText = String(item.normalized_payload.question ?? item.normalized_payload.slug ?? "");
        const topicName = nameMap.get(match.topicId) ?? match.topicSlug.replace(/-/g, " ");
        const topicCat = categoryMap.get(match.topicId) ?? null;
        const isRelevant = await validateSignalRelevance(signalText, topicName, topicCat, logger);
        if (!isRelevant) {
          result.discardedCount++;
          continue;
        }
      }

      await insertMatch(supabase, item.id, match.topicId, match.matchMethod, match.compositeScore, {
        trigram_score: match.trigramScore,
        entity_score: match.entityScore,
        category_match: match.categoryMatch,
      });
      result.matchedCount++;
    } else if (match.compositeScore >= CANDIDATE_THRESHOLD) {
      await upsertCandidate(supabase, item, match, signals.category);
      result.candidateCount++;
    } else {
      result.discardedCount++;
    }
  }

  return result;
}

/**
 * Insert accepted match with ON CONFLICT DO NOTHING (immutable, idempotent).
 */
async function insertMatch(
  supabase: SupabaseClient,
  sourceItemId: string,
  topicId: string,
  matchMethod: string,
  matchScore: number,
  metadata: Record<string, unknown>,
): Promise<void> {
  await supabase.from("source_item_topic_matches").upsert(
    {
      source_item_id: sourceItemId,
      topic_id: topicId,
      match_method: matchMethod,
      match_score: matchScore,
      match_metadata: metadata,
    },
    { onConflict: "source_item_id,topic_id", ignoreDuplicates: true },
  );
}

/**
 * Create or update a pending candidate (idempotent via suggested_slug + pending).
 */
async function upsertCandidate(
  supabase: SupabaseClient,
  item: SourceItem,
  match: TopicMatch,
  category: string | null,
): Promise<void> {
  const slug = generateSlug(match.topicSlug);

  const { data: existing } = await supabase
    .from("topic_candidates")
    .select("id, source_item_ids")
    .eq("suggested_slug", slug)
    .eq("status", "pending")
    .maybeSingle();

  const existingRow = existing as {
    id: string;
    source_item_ids: string[];
  } | null;

  if (existingRow) {
    const ids = new Set(existingRow.source_item_ids);
    ids.add(item.id);
    const deduped = Array.from(ids);

    await supabase
      .from("topic_candidates")
      .update({
        source_item_ids: deduped,
        support_count: deduped.length,
        match_scores: {
          best_trigram: match.trigramScore,
          entity_overlap: match.entityScore,
          composite: match.compositeScore,
          triggering_item_type: item.source_item_type,
        },
      })
      .eq("id", existingRow.id);
  } else {
    await supabase.from("topic_candidates").insert({
      suggested_name: match.topicSlug.replace(/-/g, " "),
      suggested_slug: slug,
      category,
      source_item_ids: [item.id],
      support_count: 1,
      match_scores: {
        best_trigram: match.trigramScore,
        entity_overlap: match.entityScore,
        composite: match.compositeScore,
        triggering_item_type: item.source_item_type,
      },
    });
  }
}
