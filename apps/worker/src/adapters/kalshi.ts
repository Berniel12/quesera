import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// Kalshi: regulated US event contracts
// Public market data works without auth. Auth only needed for trading.
//
// TWO fetch strategies:
// 1. SERIES MARKETS: Known series tickers (KXFED, KXCPI, KXNBA, etc.)
//    These are high-value recurring markets that the events endpoint doesn't return.
// 2. EVENTS: One-off prediction events (who will be Pope, AGI timeline, etc.)
//    Filtered to non-sports categories.

// Known series tickers with their topic mappings
// These are the core Kalshi data -- high-volume, regularly traded markets
const KALSHI_SERIES = [
  // Macro/Economics
  { ticker: "KXFED", category: "Economics" },
  { ticker: "KXCPI", category: "Economics" },
  { ticker: "KXGDP", category: "Economics" },
  { ticker: "KXBTC", category: "Crypto" },
  { ticker: "KXWTI", category: "Economics" },
  { ticker: "KXMORTGAGERATE", category: "Economics" },
  // Sports competitions
  { ticker: "KXNBA", category: "Sports" },
  { ticker: "KXUCL", category: "Sports" },
  { ticker: "KXF1", category: "Sports" },
  { ticker: "KXLALIGA", category: "Sports" },
  { ticker: "KXPREMIERLEAGUE", category: "Sports" },
  { ticker: "KXNFL", category: "Sports" },
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
    const seenTickers = new Set<string>();

    // Strategy 1: Fetch known series markets (Fed, CPI, GDP, NBA, F1, etc.)
    for (const series of KALSHI_SERIES) {
      try {
        const url = `${config.base_url}/markets?limit=100&status=open&series_ticker=${series.ticker}`;
        const response = await fetchWithRetry({ url, headers, logger: this.logger });
        const data = (await response.json()) as { markets: KalshiMarket[] };

        for (const market of data.markets) {
          if (seenTickers.has(market.ticker)) continue;
          seenTickers.add(market.ticker);

          const yesPrice = market.yes_bid_dollars ?? 0;
          const lastPrice = market.last_price_dollars ?? 0;

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
              category: series.category,
              event_ticker: market.event_ticker ?? "",
              event_title: "",
              close_time: market.close_time,
              status: market.status,
              question: market.title,
              series_ticker: series.ticker,
            },
            occurredAt: market.close_time ? new Date(market.close_time) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn({ series: series.ticker, err }, "Failed to fetch Kalshi series");
      }
    }

    // Strategy 2: Fetch events (one-off predictions, non-sports)
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      try {
        let url = `${config.base_url}/events?limit=100&status=open&with_nested_markets=true`;
        if (cursor) url += `&cursor=${cursor}`;

        const response = await fetchWithRetry({ url, headers, logger: this.logger });
        const data = (await response.json()) as {
          events: KalshiEvent[];
          cursor?: string;
        };

        for (const event of data.events) {
          if (event.category === "Sports") continue;

          for (const market of event.markets ?? []) {
            if (seenTickers.has(market.ticker)) continue;
            seenTickers.add(market.ticker);

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
                series_ticker: "",
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

    this.logger.info({ count: items.length, series: KALSHI_SERIES.length }, "Kalshi: fetched markets");
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
        series_ticker: p.series_ticker,
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
  event_ticker?: string;
  close_time: string;
  status: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category?: string;
  markets?: KalshiMarket[];
}
