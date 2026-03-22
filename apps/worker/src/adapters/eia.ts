import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class EiaAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) throw new Error("EIA_API_KEY is not set");

    const config = this.sourceDefinition.config as {
      base_url: string;
      series_ids: string[];
    };

    const items: RawItem[] = [];

    for (const seriesId of config.series_ids) {
      const url = `${config.base_url}/v2/seriesid/${seriesId}?api_key=${apiKey}&data[]=value&sort[0][column]=period&sort[0][direction]=desc&length=12`;
      try {
        const response = await fetchWithRetry({ url, logger: this.logger });
        const data = (await response.json()) as {
          response?: { data?: EiaObservation[] };
        };

        for (const obs of data.response?.data ?? []) {
          items.push({
            externalId: `${seriesId}:${obs.period}`,
            payload: {
              series_id: seriesId,
              period: obs.period,
              value: obs.value,
              units: obs.unit,
            },
            occurredAt: obs.period ? new Date(obs.period) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn({ seriesId, error: err instanceof Error ? err.message : String(err) }, "EIA series fetch failed");
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      series_id: String(p.series_id),
      period: String(p.period),
      value: String(p.value),
    };

    return {
      external_id: raw.externalId,
      source_key: "eia",
      source_item_type: "macro_series_observation",
      payload_type: "eia_observation_v1",
      normalized_payload: {
        series_id: p.series_id,
        period: p.period,
        value: typeof p.value === "number" ? p.value : parseFloat(String(p.value)),
        units: p.units,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface EiaObservation {
  period: string;
  value: number;
  unit: string;
}
