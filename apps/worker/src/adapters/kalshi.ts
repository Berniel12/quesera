import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class KalshiAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const apiKey = process.env.KALSHI_API_KEY;
    const config = this.sourceDefinition.config as { base_url: string };

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const items: RawItem[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 5; page++) {
      let url = `${config.base_url}/markets?limit=100&status=open`;
      if (cursor) url += `&cursor=${cursor}`;

      const response = await fetchWithRetry({ url, headers, logger: this.logger });
      const data = (await response.json()) as {
        markets: KalshiMarket[];
        cursor?: string;
      };

      for (const market of data.markets) {
        items.push({
          externalId: market.ticker,
          payload: {
            ticker: market.ticker,
            title: market.title,
            subtitle: market.subtitle,
            yes_price: market.yes_bid,
            no_price: market.no_bid,
            volume: market.volume,
            open_interest: market.open_interest,
            category: market.category,
            close_time: market.close_time,
            status: market.status,
          },
          occurredAt: market.close_time ? new Date(market.close_time) : undefined,
        });
      }

      cursor = data.cursor ?? null;
      if (!cursor || data.markets.length < 100) break;
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      ticker: String(p.ticker),
      yes_price: String(p.yes_price),
      no_price: String(p.no_price),
    };

    return {
      external_id: raw.externalId,
      source_key: "kalshi",
      source_item_type: "market",
      payload_type: "kalshi_market_v1",
      normalized_payload: {
        ticker: p.ticker,
        title: p.title,
        subtitle: p.subtitle,
        yes_price: p.yes_price,
        no_price: p.no_price,
        volume: p.volume,
        open_interest: p.open_interest,
        category: p.category,
        close_time: p.close_time,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle: string;
  yes_bid: number;
  no_bid: number;
  volume: number;
  open_interest: number;
  category: string;
  close_time: string;
  status: string;
}
