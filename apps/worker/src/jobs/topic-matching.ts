import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@signal-map/queue";
import { enqueue } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { matchSourceItem } from "../matching/engine.js";
import { BATCH_SIZE } from "../matching/types.js";

export async function handleTopicMatching(
  job: Job,
  logger: Logger,
  supabase: SupabaseClient,
): Promise<void> {
  const payload = job.payload as {
    source_id: string;
    source_item_ids?: string[];
  };

  const startTime = Date.now();
  let processedCount = 0;
  let matchedCount = 0;
  let candidateCount = 0;
  let discardedCount = 0;
  const topScores: number[] = [];

  // Load source definition for category mapping
  const { data: sourceDef } = await supabase
    .from("source_definitions")
    .select("source_family")
    .eq("id", payload.source_id)
    .single();

  if (!sourceDef) {
    throw new Error(`Source definition not found: ${payload.source_id}`);
  }

  const sourceFamily = (sourceDef as { source_family: string }).source_family;

  // Load source items to process
  let items: Array<{
    id: string;
    source_key: string;
    source_item_type: string | null;
    normalized_payload: Record<string, unknown>;
  }>;

  if (payload.source_item_ids && payload.source_item_ids.length > 0) {
    const { data } = await supabase
      .from("source_items")
      .select("id, source_key, source_item_type, normalized_payload")
      .in("id", payload.source_item_ids)
      .limit(BATCH_SIZE);

    items = (data ?? []) as typeof items;
  } else {
    // Bounded window: items changed within cadence * 2
    const { data: sourceConfig } = await supabase
      .from("source_definitions")
      .select("cadence_seconds")
      .eq("id", payload.source_id)
      .single();

    const cadence = (sourceConfig as { cadence_seconds: number } | null)?.cadence_seconds ?? 3600;
    const windowMs = cadence * 2 * 1000;
    const since = new Date(Date.now() - windowMs).toISOString();

    const { data } = await supabase
      .from("source_items")
      .select("id, source_key, source_item_type, normalized_payload")
      .eq("source_id", payload.source_id)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(BATCH_SIZE);

    items = (data ?? []) as typeof items;
  }

  if (items.length === 0) {
    logger.info({ sourceId: payload.source_id }, "No items to match");
    return;
  }

  // Process each item incrementally
  for (const item of items) {
    try {
      const result = await matchSourceItem(
        item,
        { source_family: sourceFamily },
        supabase,
        logger,
      );

      processedCount++;
      matchedCount += result.matchedCount;
      candidateCount += result.candidateCount;
      discardedCount += result.discardedCount;
      topScores.push(...result.topScores);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { sourceItemId: item.id, error: msg },
        "Item matching failed, skipping",
      );
    }
  }

  // Check if more items remain beyond batch limit
  if (items.length === BATCH_SIZE) {
    await enqueue(supabase, {
      job_type: "topic_matching",
      payload: { source_id: payload.source_id },
      priority: 1,
    });
    logger.info("Enqueued follow-up topic_matching job for remaining items");
  }

  // Log batch metrics
  const avgTopScore =
    topScores.length > 0
      ? topScores.reduce((a, b) => a + b, 0) / topScores.length
      : 0;

  logger.info(
    {
      source_id: payload.source_id,
      source_family: sourceFamily,
      processed_count: processedCount,
      matched_count: matchedCount,
      candidate_count: candidateCount,
      discarded_count: discardedCount,
      avg_top_score: Math.round(avgTopScore * 100) / 100,
      batch_duration_ms: Date.now() - startTime,
    },
    "Topic matching batch completed",
  );

  // Enqueue snapshot_generation for topics that received new matches
  if (matchedCount > 0) {
    // Find distinct topics that got new matches in this batch
    const matchedTopicIds = new Set<string>();
    const { data: recentMatches } = await supabase
      .from("source_item_topic_matches")
      .select("topic_id")
      .in(
        "source_item_id",
        items.map((i) => i.id),
      );

    for (const m of (recentMatches ?? []) as Array<{ topic_id: string }>) {
      matchedTopicIds.add(m.topic_id);
    }

    for (const topicId of matchedTopicIds) {
      await enqueue(supabase, {
        job_type: "snapshot_generation",
        payload: { topic_id: topicId },
        priority: 1,
      });
    }

    if (matchedTopicIds.size > 0) {
      logger.info(
        { topicCount: matchedTopicIds.size },
        "Enqueued snapshot_generation for matched topics",
      );
    }
  }
}
