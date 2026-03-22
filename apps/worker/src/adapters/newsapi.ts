import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class NewsApiAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const apiKey = process.env.NEWSAPI_KEY;
    if (!apiKey) throw new Error("NEWSAPI_KEY is not set");

    const config = this.sourceDefinition.config as {
      base_url: string;
      queries: string[];
    };

    const items: RawItem[] = [];

    for (const query of config.queries) {
      const url = `${config.base_url}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
      const response = await fetchWithRetry({ url, logger: this.logger });
      const data = (await response.json()) as {
        articles: NewsApiArticle[];
      };

      for (const article of data.articles ?? []) {
        if (!article.title || article.title === "[Removed]") continue;

        items.push({
          externalId: article.url,
          payload: {
            title: article.title,
            description: article.description,
            source_name: article.source?.name,
            author: article.author,
            url: article.url,
            url_to_image: article.urlToImage,
            published_at: article.publishedAt,
            content: article.content?.slice(0, 500),
          },
          occurredAt: article.publishedAt ? new Date(article.publishedAt) : undefined,
        });
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      url: String(p.url),
      published_at: String(p.published_at),
    };

    return {
      external_id: raw.externalId,
      source_key: "newsapi",
      source_item_type: "article",
      payload_type: "newsapi_article_v1",
      normalized_payload: {
        title: p.title,
        description: p.description,
        source_name: p.source_name,
        author: p.author,
        url: p.url,
        image_url: p.url_to_image,
        published_at: p.published_at,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface NewsApiArticle {
  title: string;
  description: string;
  source?: { name: string };
  author: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  content: string;
}
