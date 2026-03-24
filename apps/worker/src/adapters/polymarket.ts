import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class PolymarketAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      base_url: string;
      min_volume?: number;
    };

    const items: RawItem[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore && offset < 500) {
      const url = `${config.base_url}/markets?limit=${limit}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;
      const response = await fetchWithRetry({ url, logger: this.logger });
      const data = (await response.json()) as Array<PolymarketMarket>;

      const minVolume = config.min_volume ?? 1000;

      for (const market of data) {
        if ((market.volume24hr ?? 0) < minVolume) continue;

        items.push({
          externalId: market.conditionId ?? market.questionID ?? String(market.id),
          payload: {
            question: market.question,
            description: market.description,
            outcomes: market.outcomes,
            outcome_prices: market.outcomePrices,
            volume_24hr: market.volume24hr,
            liquidity: market.liquidityNum ?? market.liquidity,
            end_date: market.endDateIso ?? market.endDate,
            slug: market.slug,
            active: market.active,
            image: market.image,
            featured: market.featured,
            last_trade_price: market.lastTradePrice,
            one_day_price_change: market.oneDayPriceChange,
          },
          occurredAt: market.endDateIso ? new Date(market.endDateIso) : undefined,
        });
      }

      hasMore = data.length === limit;
      offset += limit;
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      market_id: raw.externalId,
      outcome_prices: String(p.outcome_prices),
    };

    return {
      external_id: raw.externalId,
      source_key: "polymarket",
      source_item_type: "market",
      payload_type: "polymarket_market_v1",
      normalized_payload: {
        market_id: raw.externalId,
        question: p.question,
        outcomes: p.outcomes,
        outcome_prices: p.outcome_prices,
        volume_24hr: p.volume_24hr,
        liquidity: p.liquidity,
        end_date: p.end_date,
        category: p.category,
        slug: p.slug,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface PolymarketMarket {
  id: number;
  conditionId?: string;
  questionID?: string;
  question: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volume24hr: number;
  liquidity: number;
  liquidityNum?: number;
  endDate: string;
  endDateIso?: string;
  slug: string;
  active: boolean;
  image?: string;
  featured?: boolean;
  lastTradePrice?: number;
  oneDayPriceChange?: number;
}
