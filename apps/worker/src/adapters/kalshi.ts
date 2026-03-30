import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// Kalshi: regulated US event contracts
// Public market data works without auth. Auth only needed for trading.
//
// Strategy: DISCOVER series dynamically from the Kalshi API, then fetch
// open markets for each discovered series. This replaces the old approach
// of hard-coding ~12 series tickers and missing thousands of markets.
//
// We fetch series by CATEGORY, keeping only the categories relevant to
// our question pages. Sports parlays (KXMVE prefix) are filtered out.

// Categories to discover series from. These cover our question pages.
// Kalshi has ~9000 series. We fetch the categories that matter.
const KALSHI_CATEGORIES = [
  "Economics",
  "Financials",
  "Politics",
  "Elections",
  "World",
  "Crypto",
  "Science and Technology",
  "Climate and Weather",
  "Sports",
  "Companies",
];

// Series prefixes to SKIP (noise, not useful for question pages)
const SKIP_PREFIXES = [
  "KXMVE",       // Multi-event sports parlays (thousands of daily game bets)
  "KXSTOCKX",    // StockX sneaker/collectible prices
  "KXRT",        // Rotten Tomatoes scores
  "KXMC",        // Metacritic scores
  "KXMADDOW",    // TV mention tracking
  "KXRANKLISTSTOCK", // StockX brand rankings
];

// Series prefixes to ALWAYS include (high-value, even if volume is low)
const PRIORITY_PREFIXES = [
  "KXFED", "KXCPI", "KXGDP", "KXBTC", "KXWTI", "KXMORTGAGE",
  "KXINX", "INX", "NASDAQ", "KXNASDAQ",
  "KXIRAN", "KXOFAC", "KXUSAIRAN", "KXIAEA", "KXVISIT",
  "KXZELENSKY", "KXPUTIN",
  "KXNBA", "KXUCL", "KXF1", "KXLALIGA", "KXPREMIER", "KXNFL",
  "KXAGICO", "KXOAIANTH",
];

interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
}

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

    // Step 1: Discover series by category
    const discoveredSeries: KalshiSeries[] = [];
    for (const category of KALSHI_CATEGORIES) {
      try {
        const url = `${config.base_url}/series?limit=1000&category=${encodeURIComponent(category)}`;
        const response = await fetchWithRetry({ url, headers, logger: this.logger });
        const data = (await response.json()) as { series: KalshiSeries[] };

        for (const s of data.series ?? []) {
          // Skip noise prefixes
          if (SKIP_PREFIXES.some((p) => s.ticker.startsWith(p))) continue;
          discoveredSeries.push(s);
        }
      } catch (err) {
        this.logger.warn({ category, err }, "Failed to discover Kalshi series for category");
      }
    }

    // Deduplicate (a series might appear in multiple categories)
    const seriesMap = new Map<string, KalshiSeries>();
    for (const s of discoveredSeries) {
      if (!seriesMap.has(s.ticker)) seriesMap.set(s.ticker, s);
    }

    // Prioritize: fetch priority series first, then the rest
    const prioritySeries: KalshiSeries[] = [];
    const otherSeries: KalshiSeries[] = [];
    for (const s of seriesMap.values()) {
      if (PRIORITY_PREFIXES.some((p) => s.ticker.startsWith(p))) {
        prioritySeries.push(s);
      } else {
        otherSeries.push(s);
      }
    }

    // Cap NON-PRIORITY series to fetch markets for (avoid hitting rate limits)
    // Priority series always included regardless of cap.
    const MAX_OTHER_SERIES = 100;
    const seriesToFetch = [
      ...prioritySeries,
      ...otherSeries.slice(0, MAX_OTHER_SERIES),
    ];

    this.logger.info(
      {
        discovered: seriesMap.size,
        priority: prioritySeries.length,
        fetching: seriesToFetch.length,
        skipped: seriesMap.size - seriesToFetch.length,
      },
      "Kalshi: discovered series from API",
    );

    // Step 2: Fetch open markets for each series
    const items: RawItem[] = [];
    const seenTickers = new Set<string>();

    for (const series of seriesToFetch) {
      try {
        const url = `${config.base_url}/markets?limit=100&status=open&series_ticker=${series.ticker}`;
        const response = await fetchWithRetry({ url, headers, logger: this.logger });
        const data = (await response.json()) as { markets: KalshiMarket[] };

        for (const market of data.markets ?? []) {
          if (seenTickers.has(market.ticker)) continue;
          seenTickers.add(market.ticker);

          const yesPrice = Number(market.yes_bid_dollars) || 0;
          const lastPrice = Number(market.last_price_dollars) || 0;

          items.push({
            externalId: market.ticker,
            payload: {
              ticker: market.ticker,
              title: market.title,
              subtitle: market.yes_sub_title ?? "",
              yes_price: yesPrice,
              no_price: Number(market.no_bid_dollars) || 0,
              last_price: lastPrice,
              volume: Number(market.volume_fp) || 0,
              open_interest: Number(market.open_interest_fp) || 0,
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
        this.logger.warn({ series: series.ticker, err }, "Failed to fetch Kalshi series markets");
      }
    }

    this.logger.info(
      { totalMarkets: items.length, seriesFetched: seriesToFetch.length },
      "Kalshi: fetched markets from discovered series",
    );
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
