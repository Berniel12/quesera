import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class ReliefWebAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };

    // ReliefWeb API requires proper User-Agent and prefers POST for complex queries
    const url = `${config.base_url}/reports?appname=quesera&limit=50`;
    const response = await fetchWithRetry({
      url,
      headers: {
        "User-Agent": "QUESERA Signal Intelligence (contact@quesera.app)",
        Accept: "application/json",
      },
      logger: this.logger,
    });

    const data = (await response.json()) as {
      data?: Array<{ id: string; fields?: ReliefWebReport }>;
    };

    const items: RawItem[] = (data.data ?? [])
      .filter((item) => item.fields?.title)
      .map((item) => ({
        externalId: String(item.id),
        payload: {
          title: item.fields?.title,
          date: item.fields?.date?.original,
          countries: item.fields?.country?.map((c: { name: string }) => c.name) ?? [],
          sources: item.fields?.source?.map((s: { name: string }) => s.name) ?? [],
          disaster_types: item.fields?.disaster_type?.map((d: { name: string }) => d.name) ?? [],
          url: item.fields?.url_alias ? `https://reliefweb.int${item.fields.url_alias}` : null,
        },
        occurredAt: item.fields?.date?.original ? new Date(item.fields.date.original) : undefined,
      }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      id: raw.externalId,
      date: String(p.date),
    };

    return {
      external_id: raw.externalId,
      source_key: "reliefweb",
      source_item_type: "report",
      payload_type: "reliefweb_report_v1",
      normalized_payload: {
        title: p.title,
        date: p.date,
        countries: p.countries,
        sources: p.sources,
        disaster_types: p.disaster_types,
        url: p.url,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface ReliefWebReport {
  title?: string;
  date?: { original: string };
  country?: Array<{ name: string }>;
  source?: Array<{ name: string }>;
  disaster_type?: Array<{ name: string }>;
  url_alias?: string;
}
