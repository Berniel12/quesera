import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class EurostatAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string; datasets: Array<{ code: string; name: string }> };
    const items: RawItem[] = [];

    for (const ds of config.datasets) {
      try {
        const url = `${config.base_url}/wdds/rest/data/v2.1/json/en/${ds.code}?lastTimePeriod=5`;
        const res = await fetchWithRetry({ url, logger: this.logger, maxRetries: 1 });
        const data = (await res.json()) as { value?: Record<string, number>; dimension?: { time?: { category?: { index?: Record<string, number>; label?: Record<string, string> } } } };

        const times = data.dimension?.time?.category?.label ?? {};
        const values = data.value ?? {};

        for (const [idx, val] of Object.entries(values)) {
          const timeKeys = Object.keys(times);
          const timeIdx = parseInt(idx, 10) % timeKeys.length;
          const period = timeKeys[timeIdx] ?? idx;

          items.push({
            externalId: `${ds.code}:${period}`,
            payload: { dataset: ds.code, dataset_name: ds.name, period, value: val },
            occurredAt: period ? new Date(`${period}-01`) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn({ dataset: ds.code, error: err instanceof Error ? err.message : String(err) }, "Eurostat fetch failed");
      }
    }
    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "eurostat",
      source_item_type: "economic_indicator",
      payload_type: "eurostat_indicator_v1",
      normalized_payload: { dataset: p.dataset, dataset_name: p.dataset_name, period: p.period, value: p.value },
      content_hash: this.hashPayload({ ds: String(p.dataset), period: String(p.period), value: String(p.value) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
