import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class CoinGeckoAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string; coins: string[] };

    const ids = config.coins.join(",");
    const url = `${config.base_url}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&sparkline=false&price_change_percentage=24h,7d`;

    const response = await fetchWithRetry({
      url,
      headers: { Accept: "application/json" },
      logger: this.logger,
    });
    const data = (await response.json()) as CoinData[];

    const items: RawItem[] = data.map((c) => ({
      externalId: c.id,
      payload: {
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        current_price: c.current_price,
        market_cap: c.market_cap,
        total_volume: c.total_volume,
        price_change_24h: c.price_change_percentage_24h,
        price_change_7d: c.price_change_percentage_7d_in_currency,
        high_24h: c.high_24h,
        low_24h: c.low_24h,
        image: c.image,
        last_updated: c.last_updated,
      },
      occurredAt: c.last_updated ? new Date(c.last_updated) : undefined,
    }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "coingecko",
      source_item_type: "crypto_price",
      payload_type: "coingecko_market_v1",
      normalized_payload: {
        coin_id: p.id, symbol: p.symbol, name: p.name,
        current_price: p.current_price, market_cap: p.market_cap,
        volume_24h: p.total_volume, price_change_24h: p.price_change_24h,
        price_change_7d: p.price_change_7d, high_24h: p.high_24h, low_24h: p.low_24h,
      },
      content_hash: this.hashPayload({ id: String(p.id), price: String(p.current_price) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface CoinData {
  id: string; symbol: string; name: string; current_price: number;
  market_cap: number; total_volume: number; price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number; high_24h: number; low_24h: number;
  image: string; last_updated: string;
}
