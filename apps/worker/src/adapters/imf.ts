import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class ImfAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string; indicators: Array<{ code: string; name: string }>; countries: string[] };
    const items: RawItem[] = [];

    for (const ind of config.indicators) {
      const countries = config.countries.join("+");
      const url = `${config.base_url}/CompactData/IFS/A.${countries}.${ind.code}?startPeriod=2020&endPeriod=2026`;

      try {
        const res = await fetchWithRetry({ url, headers: { Accept: "application/json" }, logger: this.logger, maxRetries: 1 });
        const data = (await res.json()) as { CompactData?: { DataSet?: { Series?: Array<{ Obs?: Array<{ "@TIME_PERIOD": string; "@OBS_VALUE": string }>; "@REF_AREA": string }> } } };

        for (const series of data.CompactData?.DataSet?.Series ?? []) {
          const country = series["@REF_AREA"];
          for (const obs of series.Obs ?? []) {
            items.push({
              externalId: `${ind.code}:${country}:${obs["@TIME_PERIOD"]}`,
              payload: { indicator: ind.code, indicator_name: ind.name, country, period: obs["@TIME_PERIOD"], value: parseFloat(obs["@OBS_VALUE"]) },
              occurredAt: new Date(`${obs["@TIME_PERIOD"]}-01-01`),
            });
          }
        }
      } catch (err) {
        this.logger.warn({ indicator: ind.code, error: err instanceof Error ? err.message : String(err) }, "IMF fetch failed");
      }
    }
    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "imf",
      source_item_type: "economic_indicator",
      payload_type: "imf_indicator_v1",
      normalized_payload: { indicator: p.indicator, indicator_name: p.indicator_name, country: p.country, period: p.period, value: p.value },
      content_hash: this.hashPayload({ ind: String(p.indicator), country: String(p.country), period: String(p.period), value: String(p.value) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
