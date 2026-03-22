import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class RssAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      feeds: Array<{ url: string; name: string; category: string }>;
    };

    const items: RawItem[] = [];

    for (const feed of config.feeds) {
      try {
        const response = await fetchWithRetry({
          url: feed.url,
          headers: {
            "User-Agent": "QUESERA/1.0 RSS Reader",
            Accept: "application/rss+xml, application/xml, text/xml",
          },
          logger: this.logger,
          maxRetries: 1,
        });

        const xml = await response.text();

        // Simple XML parsing for RSS <item> elements
        const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];

        for (const itemXml of itemMatches.slice(0, 20)) {
          const title = extractTag(itemXml, "title");
          const link = extractTag(itemXml, "link");
          const pubDate = extractTag(itemXml, "pubDate");
          const description = extractTag(itemXml, "description")?.slice(0, 500);

          if (!title || !link) continue;

          items.push({
            externalId: link,
            payload: {
              title: cleanHtml(title),
              description: description ? cleanHtml(description) : null,
              link,
              pub_date: pubDate,
              feed_name: feed.name,
              feed_category: feed.category,
            },
            occurredAt: pubDate ? new Date(pubDate) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn(
          { feed: feed.name, error: err instanceof Error ? err.message : String(err) },
          "RSS feed fetch failed, skipping",
        );
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      link: String(p.link),
      pub_date: String(p.pub_date),
    };

    return {
      external_id: raw.externalId,
      source_key: "rss",
      source_item_type: "article",
      payload_type: "rss_article_v1",
      normalized_payload: {
        title: p.title,
        description: p.description,
        url: p.link,
        published_at: p.pub_date,
        feed_name: p.feed_name,
        feed_category: p.feed_category,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
    ?? xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function cleanHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
