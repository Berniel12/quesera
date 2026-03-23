import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// PolyRouter: aggregates 7 prediction markets via one API
// Covers: Polymarket, Kalshi, Manifold, Limitless, ProphetX, Novig, SX.bet
// No auth required (open beta)

export class PolyRouterAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };
    const url = `${config.base_url}/markets?limit=100&sort=volume&order=desc`;
    const response = await fetchWithRetry({ url, logger: this.logger });
    const data = (await response.json()) as PolyRouterMarket[];

    const items: RawItem[] = (Array.isArray(data) ? data : []).map((m) => ({
      externalId: m.id ?? m.slug ?? String(m.title).slice(0, 50),
      payload: {
        title: m.title,
        question: m.title,
        platform: m.platform,
        probability: m.probability,
        volume: m.volume,
        liquidity: m.liquidity,
        close_date: m.close_date,
        category: m.category,
        url: m.url,
        slug: m.slug,
        outcome_prices: m.probability != null ? [String(m.probability)] : null,
      },
      occurredAt: m.close_date ? new Date(m.close_date) : undefined,
    }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "polyrouter",
      source_item_type: "market",
      payload_type: "polyrouter_market_v1",
      normalized_payload: {
        question: p.title,
        platform: p.platform,
        outcome_prices: p.outcome_prices,
        volume_24hr: p.volume,
        liquidity: p.liquidity,
        category: p.category,
        url: p.url,
        slug: p.slug,
      },
      content_hash: this.hashPayload({ id: raw.externalId, probability: String(p.probability) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface PolyRouterMarket {
  id?: string;
  slug?: string;
  title: string;
  platform: string;
  probability: number | null;
  volume: number;
  liquidity: number;
  close_date?: string;
  category?: string;
  url?: string;
}
