import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// Kalshi: regulated US event contracts
// Public market data works without auth. Auth only needed for trading.
// Uses the EVENTS endpoint (not markets) to get real prediction events
// and skip the 300k+ sports prop bet noise.

// Categories to fetch -- skip Sports (all props/combos)
const KALSHI_CATEGORIES = [
  "Economics",
  "Politics",
  "Elections",
  "Climate and Weather",
  "Science and Technology",
  "Financials",
  "Companies",
  "World",
  "Health",
  "Entertainment",
  "Social",
  "Transportation",
];

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

    // Fetch events with nested markets (real predictions, not sports props)
    for (let page = 0; page < 10; page++) {
      let url = `${config.base_url}/events?limit=100&status=open&with_nested_markets=true`;
      if (cursor) url += `&cursor=${cursor}`;

      try {
        const response = await fetchWithRetry({ url, headers, logger: this.logger });
        const data = (await response.json()) as {
          events: KalshiEvent[];
          cursor?: string;
        };

        for (const event of data.events) {
          // Skip sports category (all props/combos, no real predictions)
          if (event.category === "Sports") continue;

          for (const market of event.markets ?? []) {
            // Skip markets with no real pricing
            const yesPrice = market.yes_bid_dollars ?? 0;
            const lastPrice = market.last_price_dollars ?? 0;
            if (yesPrice === 0 && lastPrice === 0) continue;

            items.push({
              externalId: market.ticker,
              payload: {
                ticker: market.ticker,
                title: market.title,
                subtitle: market.yes_sub_title ?? "",
                yes_price: yesPrice,
                no_price: market.no_bid_dollars ?? 0,
                last_price: lastPrice,
                volume: market.volume_fp ?? 0,
                open_interest: market.open_interest_fp ?? 0,
                category: event.category ?? "",
                event_ticker: event.event_ticker ?? "",
                event_title: event.title ?? "",
                close_time: market.close_time,
                status: market.status,
                question: market.title,
              },
              occurredAt: market.close_time ? new Date(market.close_time) : undefined,
            });
          }
        }

        cursor = data.cursor ?? null;
        if (!cursor || data.events.length < 100) break;
      } catch (err) {
        this.logger.warn({ page, err }, "Failed to fetch Kalshi events");
        break;
      }
    }

    this.logger.info({ count: items.length }, "Kalshi: fetched non-sports prediction markets");
    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      ticker: String(p.ticker),
      yes_price: String(p.yes_price),
      last_price: String(p.last_price),
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
        last_price: p.last_price,
        volume: p.volume,
        open_interest: p.open_interest,
        category: p.category,
        event_ticker: p.event_ticker,
        event_title: p.event_title,
        close_time: p.close_time,
        question: p.question ?? p.title,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface KalshiMarket {
  ticker: string;
  title: string;
  yes_sub_title?: string;
  yes_bid_dollars?: number;
  no_bid_dollars?: number;
  last_price_dollars?: number;
  volume_fp?: number;
  open_interest_fp?: number;
  close_time: string;
  status: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category?: string;
  markets?: KalshiMarket[];
}
