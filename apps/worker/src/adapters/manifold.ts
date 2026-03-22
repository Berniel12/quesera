import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class ManifoldAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };

    const url = `${config.base_url}/search-markets?sort=liquidity&filter=open&limit=100`;
    const response = await fetchWithRetry({ url, logger: this.logger });
    const data = (await response.json()) as ManifoldMarket[];

    const items: RawItem[] = data.map((m) => ({
      externalId: m.id,
      payload: {
        id: m.id,
        question: m.question,
        probability: m.probability,
        totalLiquidity: m.totalLiquidity,
        volume24Hours: m.volume24Hours,
        creatorName: m.creatorName,
        url: m.url,
        closeTime: m.closeTime,
        mechanism: m.mechanism,
        outcomeType: m.outcomeType,
      },
      occurredAt: m.closeTime ? new Date(m.closeTime) : undefined,
    }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      id: String(p.id),
      probability: String(p.probability),
    };

    return {
      external_id: raw.externalId,
      source_key: "manifold",
      source_item_type: "market",
      payload_type: "manifold_market_v1",
      normalized_payload: {
        market_id: p.id,
        question: p.question,
        probability: p.probability,
        total_liquidity: p.totalLiquidity,
        volume_24h: p.volume24Hours,
        creator: p.creatorName,
        url: p.url,
        close_time: p.closeTime,
        mechanism: p.mechanism,
        outcome_type: p.outcomeType,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface ManifoldMarket {
  id: string;
  question: string;
  probability: number;
  totalLiquidity: number;
  volume24Hours: number;
  creatorName: string;
  url: string;
  closeTime: number;
  mechanism: string;
  outcomeType: string;
}
