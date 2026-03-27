import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import { hashContent } from "../utils/content-hash.js";

export interface RawItem {
  externalId: string;
  payload: Record<string, unknown>;
  occurredAt?: Date;
}

export interface FetchResult {
  items: RawItem[];
  metadata?: Record<string, unknown>;
}

export interface NormalizedItem {
  external_id: string;
  source_key: string;
  source_item_type: string;
  payload_type: string;
  normalized_payload: Record<string, unknown>;
  content_hash: string;
  occurred_at: string | null;
}

export interface SyncResult {
  itemsFetched: number;
  itemsInserted: number;
  itemsUpdated: number;
}

export interface SourceDefinitionRow {
  id: string;
  source_key: string;
  source_family: string;
  display_name: string;
  config: Record<string, unknown>;
}

export abstract class BaseAdapter {
  constructor(
    protected sourceDefinition: SourceDefinitionRow,
    protected supabase: SupabaseClient,
    protected logger: Logger,
  ) {}

  abstract fetch(): Promise<FetchResult>;
  abstract normalize(raw: RawItem): NormalizedItem;

  async sync(): Promise<SyncResult> {
    const fetchResult = await this.fetch();
    // Per-item error isolation: one bad item should NOT crash the entire sync
    const items: NormalizedItem[] = [];
    let normalizeErrors = 0;
    for (const raw of fetchResult.items) {
      try {
        items.push(this.normalize(raw));
      } catch (err) {
        normalizeErrors++;
        if (normalizeErrors <= 3) {
          this.logger.warn(
            { externalId: raw.externalId, error: err instanceof Error ? err.message : String(err) },
            "normalize() failed for item, skipping",
          );
        }
      }
    }
    if (normalizeErrors > 3) {
      this.logger.warn({ normalizeErrors }, `${normalizeErrors} items failed to normalize (showing first 3)`);
    }

    this.logger.info(
      { sourceKey: this.sourceDefinition.source_key, fetched: items.length },
      "Fetched and normalized items",
    );

    const result = await this.upsertItems(items);
    return {
      itemsFetched: items.length,
      itemsInserted: result.itemsInserted,
      itemsUpdated: result.itemsUpdated,
    };
  }

  protected async upsertItems(items: NormalizedItem[]): Promise<{ itemsInserted: number; itemsUpdated: number }> {
    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      // Check for existing row
      const { data: existing } = await this.supabase
        .from("source_items")
        .select("id, content_hash")
        .eq("source_key", item.source_key)
        .eq("external_id", item.external_id)
        .maybeSingle();

      const existingRow = existing as { id: string; content_hash: string } | null;

      if (!existingRow) {
        // Insert new item
        const { error } = await this.supabase.from("source_items").insert({
          source_id: this.sourceDefinition.id,
          external_id: item.external_id,
          source_key: item.source_key,
          source_item_type: item.source_item_type,
          payload_type: item.payload_type,
          normalized_payload: item.normalized_payload,
          content_hash: item.content_hash,
          occurred_at: item.occurred_at,
          last_seen_at: new Date().toISOString(),
          is_active: true,
        });

        if (error) {
          this.logger.error({ error: error.message, externalId: item.external_id }, "Failed to insert item");
          continue;
        }
        inserted++;
      } else if (existingRow.content_hash !== item.content_hash) {
        // Content changed — update and create version
        const { error: versionError } = await this.supabase
          .from("source_item_versions")
          .insert({
            source_item_id: existingRow.id,
            content_hash: item.content_hash,
            normalized_payload: item.normalized_payload,
          });

        if (versionError) {
          this.logger.error({ error: versionError.message }, "Failed to insert version, skipping update");
          continue; // Don't update item if version write failed -- prevents orphaned versions
        }

        const { error: updateError } = await this.supabase
          .from("source_items")
          .update({
            normalized_payload: item.normalized_payload,
            content_hash: item.content_hash,
            occurred_at: item.occurred_at,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id);

        if (updateError) {
          this.logger.error({ error: updateError.message }, "Failed to update item");
          continue;
        }
        updated++;
      } else {
        // Content unchanged — just update last_seen_at
        await this.supabase
          .from("source_items")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existingRow.id);
      }
    }

    return { itemsInserted: inserted, itemsUpdated: updated };
  }

  protected hashPayload(data: Record<string, unknown>): string {
    return hashContent(data);
  }
}
