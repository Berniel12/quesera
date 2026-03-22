import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class ExchangeRatesAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string; base_currency: string; targets: string[] };

    const url = `${config.base_url}/latest/${config.base_currency}`;
    const response = await fetchWithRetry({ url, logger: this.logger });
    const data = (await response.json()) as { conversion_rates: Record<string, number>; time_last_update_utc: string };

    const items: RawItem[] = config.targets
      .filter((t) => data.conversion_rates[t] !== undefined)
      .map((t) => ({
        externalId: `${config.base_currency}/${t}`,
        payload: { base: config.base_currency, target: t, rate: data.conversion_rates[t], updated: data.time_last_update_utc },
        occurredAt: data.time_last_update_utc ? new Date(data.time_last_update_utc) : undefined,
      }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "exchange_rates",
      source_item_type: "exchange_rate",
      payload_type: "exchange_rate_v1",
      normalized_payload: { base: p.base, target: p.target, rate: p.rate },
      content_hash: this.hashPayload({ pair: raw.externalId, rate: String(p.rate) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
