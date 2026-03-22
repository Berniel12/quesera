import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class WorldBankAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      base_url: string;
      indicators: Array<{ code: string; name: string }>;
      countries: string[];
    };

    const items: RawItem[] = [];
    const currentYear = new Date().getFullYear();

    for (const indicator of config.indicators) {
      const countriesStr = config.countries.join(";");
      const url = `${config.base_url}/v2/country/${countriesStr}/indicator/${indicator.code}?format=json&date=${currentYear - 5}:${currentYear}&per_page=100`;

      try {
        const response = await fetchWithRetry({ url, logger: this.logger });
        const data = (await response.json()) as [unknown, WorldBankObservation[]];

        const observations = data[1] ?? [];

        for (const obs of observations) {
          if (obs.value === null) continue;

          items.push({
            externalId: `${indicator.code}:${obs.countryiso3code}:${obs.date}`,
            payload: {
              indicator_code: indicator.code,
              indicator_name: indicator.name,
              country: obs.country?.value,
              country_code: obs.countryiso3code,
              year: obs.date,
              value: obs.value,
            },
            occurredAt: new Date(`${obs.date}-01-01`),
          });
        }
      } catch (err) {
        this.logger.warn({ indicator: indicator.code, error: err instanceof Error ? err.message : String(err) }, "World Bank fetch failed");
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      indicator: String(p.indicator_code),
      country: String(p.country_code),
      year: String(p.year),
      value: String(p.value),
    };

    return {
      external_id: raw.externalId,
      source_key: "world_bank",
      source_item_type: "development_indicator",
      payload_type: "world_bank_indicator_v1",
      normalized_payload: {
        indicator_code: p.indicator_code,
        indicator_name: p.indicator_name,
        country: p.country,
        country_code: p.country_code,
        year: p.year,
        value: p.value,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface WorldBankObservation {
  country?: { value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
  indicator?: { value: string };
}
