import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// Metaforecast: aggregates 8 prediction/forecasting platforms via one API
// Covers: Metaculus, Manifold, GJOpen, INFER, Polymarket, PredictIt, Smarkets, Hypermind

export class MetaforecastAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };
    const url = `${config.base_url}/api/v1/questions?limit=200&orderBy=qualityindicators.stars&desc=true`;
    const response = await fetchWithRetry({ url, logger: this.logger });
    const data = (await response.json()) as MetaforecastQuestion[];

    const items: RawItem[] = data.map((q) => ({
      externalId: q.id ?? q.url,
      payload: {
        title: q.title,
        url: q.url,
        platform: q.platform?.label ?? q.platform?.id ?? "unknown",
        probability: q.options?.[0]?.probability ?? null,
        quality: q.qualityindicators?.stars ?? null,
        num_forecasters: q.qualityindicators?.numforecasters ?? null,
        description: q.description?.slice(0, 500) ?? null,
      },
      occurredAt: q.timestamp ? new Date(q.timestamp) : undefined,
    }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "metaforecast",
      source_item_type: "market",
      payload_type: "metaforecast_question_v1",
      normalized_payload: {
        question: p.title,
        platform: p.platform,
        outcome_prices: p.probability !== null ? [String(p.probability)] : null,
        quality: p.quality,
        num_forecasters: p.num_forecasters,
        url: p.url,
      },
      content_hash: this.hashPayload({ id: raw.externalId, probability: String(p.probability) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface MetaforecastQuestion {
  id: string;
  title: string;
  url: string;
  description?: string;
  platform?: { id: string; label: string };
  options?: Array<{ name: string; probability: number }>;
  qualityindicators?: { stars: number; numforecasters: number };
  timestamp?: string;
}
