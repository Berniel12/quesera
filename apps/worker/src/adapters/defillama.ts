import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// DefiLlama: all DeFi protocols — TVL, yields, stablecoins across all chains
// No auth, very generous limits, excellent docs

export class DefiLlamaAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };

    // Fetch top protocols by TVL
    const url = `${config.base_url}/protocols`;
    const response = await fetchWithRetry({ url, logger: this.logger });
    const protocols = (await response.json()) as DefiProtocol[];

    // Take top 20 by TVL
    const items: RawItem[] = protocols.slice(0, 20).map((p) => ({
      externalId: p.slug ?? p.name,
      payload: {
        name: p.name,
        symbol: p.symbol,
        tvl: p.tvl,
        chain: p.chain,
        chains: p.chains,
        change_1h: p.change_1h,
        change_1d: p.change_1d,
        change_7d: p.change_7d,
        category: p.category,
        url: p.url,
      },
    }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "defillama",
      source_item_type: "defi_protocol",
      payload_type: "defillama_protocol_v1",
      normalized_payload: {
        name: p.name,
        symbol: p.symbol,
        tvl: p.tvl,
        chain: p.chain,
        change_1d: p.change_1d,
        change_7d: p.change_7d,
        category: p.category,
      },
      content_hash: this.hashPayload({ slug: raw.externalId, tvl: String(Math.round(Number(p.tvl) / 1e6)) }),
      occurred_at: null,
    };
  }
}

interface DefiProtocol {
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  chain: string;
  chains: string[];
  change_1h: number;
  change_1d: number;
  change_7d: number;
  category: string;
  url: string;
}
