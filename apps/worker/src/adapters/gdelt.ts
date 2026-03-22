import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class GdeltAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      base_url: string;
      queries: string[];
    };

    const items: RawItem[] = [];

    for (const query of config.queries) {
      // GDELT v2 API — correct path is /api/v2/doc/doc
      const url = `${config.base_url}/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=25&sort=DateDesc&format=json`;

      try {
        const response = await fetchWithRetry({
          url,
          headers: { "User-Agent": "QUESERA/1.0" },
          logger: this.logger,
          retryDelayMs: 5000, // GDELT requires 5s between requests
          maxRetries: 2,
        });
        const data = (await response.json()) as {
          articles?: GdeltArticle[];
        };

        for (const article of data.articles ?? []) {
          items.push({
            externalId: article.url,
            payload: {
              title: article.title,
              url: article.url,
              source: article.domain,
              language: article.language,
              source_country: article.sourcecountry,
              seendate: article.seendate,
            },
            occurredAt: article.seendate ? parseGdeltDate(article.seendate) : undefined,
          });
        }

        // GDELT rate limit: 1 request per 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (err) {
        this.logger.warn(
          { query, error: err instanceof Error ? err.message : String(err) },
          "GDELT query failed, skipping",
        );
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      url: String(p.url),
      seendate: String(p.seendate),
    };

    return {
      external_id: raw.externalId,
      source_key: "gdelt",
      source_item_type: "event",
      payload_type: "gdelt_article_v1",
      normalized_payload: {
        title: p.title,
        url: p.url,
        source: p.source,
        language: p.language,
        source_country: p.source_country,
        seen_date: p.seendate,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

function parseGdeltDate(dateStr: string): Date {
  // GDELT dates: "20260322T120000Z"
  if (dateStr.length >= 15) {
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    const h = dateStr.slice(9, 11);
    const min = dateStr.slice(11, 13);
    return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`);
  }
  return new Date(dateStr);
}

interface GdeltArticle {
  title: string;
  url: string;
  domain: string;
  language: string;
  sourcecountry: string;
  seendate: string;
}
