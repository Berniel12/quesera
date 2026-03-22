import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@signal-map/queue";
import { enqueue } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { getAdapter } from "../adapters/registry.js";
import type { SourceDefinitionRow, SyncResult } from "../adapters/base.js";

export async function handleSourceSync(
  job: Job,
  logger: Logger,
  supabase: SupabaseClient,
): Promise<void> {
  const payload = job.payload as { source_id: string };
  const sourceId = payload.source_id;

  if (!sourceId) {
    throw new Error("source_id is required in job payload");
  }

  // 1. Load source definition
  const { data: sourceDef, error: loadError } = await supabase
    .from("source_definitions")
    .select("id, source_key, source_family, display_name, config")
    .eq("id", sourceId)
    .single();

  if (loadError || !sourceDef) {
    throw new Error(`Source definition not found: ${sourceId}`);
  }

  const definition = sourceDef as SourceDefinitionRow;

  // 2. Create sync job record
  const { data: syncJob, error: syncError } = await supabase
    .from("source_sync_jobs")
    .insert({
      source_id: sourceId,
      job_queue_id: job.id,
      status: "running",
    })
    .select("id")
    .single();

  if (syncError) {
    logger.error({ error: syncError.message }, "Failed to create sync job record");
  }

  const syncJobId = (syncJob as { id: string } | null)?.id;

  // 3. Instantiate adapter
  const adapter = getAdapter(definition.source_key, definition, supabase, logger);

  try {
    // 4. Run sync
    const result = await adapter.sync();

    // 5. Update sync job as success
    if (syncJobId) {
      await completeSyncJob(supabase, syncJobId, result);
    }

    // 6. Update source health
    await updateSourceHealth(supabase, sourceId, {
      success: true,
      itemCount: result.itemsFetched,
    });

    logger.info(
      {
        sourceKey: definition.source_key,
        fetched: result.itemsFetched,
        inserted: result.itemsInserted,
        updated: result.itemsUpdated,
      },
      "Source sync completed",
    );

    // Enqueue topic matching only when items actually changed
    if (result.itemsInserted > 0 || result.itemsUpdated > 0) {
      await enqueue(supabase, {
        job_type: "topic_matching",
        payload: { source_id: sourceId },
        priority: 1,
      });
      logger.info({ sourceKey: definition.source_key }, "Enqueued topic_matching job");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // 7. Update sync job as failed
    if (syncJobId) {
      await failSyncJob(supabase, syncJobId, errorMessage);
    }

    // 8. Update source health
    await updateSourceHealth(supabase, sourceId, {
      success: false,
      errorMessage,
    });

    throw err;
  }
}

async function completeSyncJob(
  supabase: SupabaseClient,
  syncJobId: string,
  result: SyncResult,
): Promise<void> {
  await supabase
    .from("source_sync_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      items_fetched: result.itemsFetched,
      items_inserted: result.itemsInserted,
      items_updated: result.itemsUpdated,
    })
    .eq("id", syncJobId);
}

async function failSyncJob(
  supabase: SupabaseClient,
  syncJobId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from("source_sync_jobs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", syncJobId);
}

interface HealthUpdate {
  success: boolean;
  itemCount?: number;
  errorMessage?: string;
}

async function updateSourceHealth(
  supabase: SupabaseClient,
  sourceId: string,
  update: HealthUpdate,
): Promise<void> {
  if (update.success) {
    await supabase
      .from("source_health")
      .update({
        last_success_at: new Date().toISOString(),
        consecutive_failures: 0,
        last_item_count: update.itemCount ?? 0,
        freshness: "fresh",
      })
      .eq("source_id", sourceId);
  } else {
    // Get current failure count
    const { data: current } = await supabase
      .from("source_health")
      .select("consecutive_failures")
      .eq("source_id", sourceId)
      .single();

    const failures =
      ((current as { consecutive_failures: number } | null)?.consecutive_failures ?? 0) + 1;

    let freshness: string = "fresh";
    if (failures >= 10) {
      freshness = "dead";
    } else if (failures >= 3) {
      freshness = "stale";
    } else {
      freshness = "aging";
    }

    await supabase
      .from("source_health")
      .update({
        last_failure_at: new Date().toISOString(),
        consecutive_failures: failures,
        last_error_message: update.errorMessage ?? null,
        freshness,
      })
      .eq("source_id", sourceId);
  }
}
