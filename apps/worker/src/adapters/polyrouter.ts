import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// PolyRouter: aggregates 7 prediction markets via one API
// Covers: Polymarket, Kalshi, Manifold, Limitless, ProphetX, Novig, SX.bet
// Base URL: https://api-v2.polyrouter.io
// Auth: X-API-Key header (free tier available)

const PLATFORMS = ["polymarket", "kalshi", "manifold", "limitless"];

export class PolyRouterAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };
    const apiKey = process.env.POLYROUTER_API_KEY ?? "";

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const items: RawItem[] = [];

    for (const platform of PLATFORMS) {
      try {
        const url = `${config.base_url}/markets?platform=${platform}&limit=50`;
        const response = await fetchWithRetry({ url, headers, logger: this.logger });
        const body = (await response.json()) as { markets?: PolyRouterMarket[] };
        const markets = body.markets ?? (Array.isArray(body) ? body as PolyRouterMarket[] : []);

        for (const m of markets) {
          const yesPrice = m.current_prices?.yes?.price ?? null;

          items.push({
            externalId: m.id ?? String(m.title).slice(0, 50),
            payload: {
              title: m.title,
              question: m.title,
              platform: m.platform ?? platform,
              probability: yesPrice,
              volume_24hr: m.volume_24h ?? 0,
              status: m.status,
              outcome_prices: yesPrice !== null ? [String(yesPrice)] : null,
              slug: m.id,
            },
          });
        }
      } catch (err) {
        this.logger.warn({ platform, err: String(err) }, "Failed to fetch PolyRouter platform");
      }
    }

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
        volume_24hr: p.volume_24hr,
        status: p.status,
        slug: p.slug,
      },
      content_hash: this.hashPayload({ id: raw.externalId, probability: String(p.probability) }),
      occurred_at: null,
    };
  }
}

interface PolyRouterMarket {
  id?: string;
  title: string;
  platform?: string;
  current_prices?: {
    yes?: { price: number };
    no?: { price: number };
  };
  volume_24h?: number;
  status?: string;
}
