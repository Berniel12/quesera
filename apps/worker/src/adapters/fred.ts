import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class FredAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      throw new Error("FRED_API_KEY is not set");
    }

    const config = this.sourceDefinition.config as {
      base_url: string;
      seed_series: string[];
    };

    const items: RawItem[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const seriesId of config.seed_series) {
      try {
        const url = `${config.base_url}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=10`;

        const response = await fetchWithRetry({ url, logger: this.logger });
        const data = (await response.json()) as {
          observations: Array<{
            date: string;
            value: string;
            realtime_start: string;
            realtime_end: string;
          }>;
        };

        for (const obs of data.observations) {
          if (obs.value === ".") continue; // FRED uses "." for missing data

          items.push({
            externalId: `${seriesId}:${obs.date}`,
            payload: {
              series_id: seriesId,
              date: obs.date,
              value: obs.value,
              realtime_start: obs.realtime_start,
              realtime_end: obs.realtime_end,
            },
            occurredAt: new Date(obs.date),
          });
        }
        succeeded++;
      } catch (err) {
        // One bad series should NOT kill the entire FRED fetch
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn({ seriesId, error: msg }, `FRED series ${seriesId} failed, skipping`);
        failed++;
      }
    }

    this.logger.info({ succeeded, failed, totalItems: items.length }, "FRED fetch complete");
    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      series_id: String(p.series_id),
      date: String(p.date),
      value: String(p.value),
    };

    return {
      external_id: raw.externalId,
      source_key: "fred",
      source_item_type: "macro_series_observation",
      payload_type: "fred_observation_v1",
      normalized_payload: {
        series_id: p.series_id,
        date: p.date,
        value: parseFloat(p.value as string),
        realtime_start: p.realtime_start,
        realtime_end: p.realtime_end,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
