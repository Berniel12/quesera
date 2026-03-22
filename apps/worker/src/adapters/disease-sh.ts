import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class DiseaseShAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string; countries: string[] };
    const items: RawItem[] = [];

    // Global stats
    const globalUrl = `${config.base_url}/v3/covid-19/all`;
    try {
      const res = await fetchWithRetry({ url: globalUrl, logger: this.logger });
      const g = (await res.json()) as Record<string, unknown>;
      items.push({
        externalId: "global",
        payload: { scope: "global", cases: g.cases, deaths: g.deaths, recovered: g.recovered, active: g.active, updated: g.updated },
        occurredAt: g.updated ? new Date(g.updated as number) : undefined,
      });
    } catch { /* skip */ }

    // Per-country
    for (const country of config.countries) {
      try {
        const url = `${config.base_url}/v3/covid-19/countries/${country}`;
        const res = await fetchWithRetry({ url, logger: this.logger, maxRetries: 1 });
        const c = (await res.json()) as Record<string, unknown>;
        items.push({
          externalId: `country:${country}`,
          payload: { scope: country, cases: c.cases, deaths: c.deaths, recovered: c.recovered, active: c.active, todayCases: c.todayCases, todayDeaths: c.todayDeaths, updated: c.updated },
          occurredAt: c.updated ? new Date(c.updated as number) : undefined,
        });
      } catch { /* skip */ }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "disease_sh",
      source_item_type: "health_stats",
      payload_type: "disease_sh_v1",
      normalized_payload: { scope: p.scope, cases: p.cases, deaths: p.deaths, recovered: p.recovered, active: p.active, today_cases: p.todayCases, today_deaths: p.todayDeaths },
      content_hash: this.hashPayload({ scope: String(p.scope), cases: String(p.cases), deaths: String(p.deaths) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
