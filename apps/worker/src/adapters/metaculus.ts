import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class MetaculusAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };
    const apiToken = process.env.METACULUS_API_TOKEN;

    const headers: Record<string, string> = {
      "User-Agent": "QUESERA/1.0",
    };
    if (apiToken) {
      headers["Authorization"] = `Token ${apiToken}`;
    }

    const items: RawItem[] = [];
    let offset = 0;
    const limit = 100;

    for (let page = 0; page < 3; page++) {
      const url = `${config.base_url}/questions/?limit=${limit}&offset=${offset}&status=open&order_by=-activity&type=forecast`;
      const response = await fetchWithRetry({ url, headers, logger: this.logger });
      const data = (await response.json()) as {
        results: MetaculusQuestion[];
      };

      for (const q of data.results) {
        items.push({
          externalId: String(q.id),
          payload: {
            id: q.id,
            title: q.title,
            community_prediction: q.community_prediction?.full?.q2,
            forecasters_count: q.forecasters_count,
            close_time: q.close_time,
            resolve_time: q.resolve_time,
            url: q.url,
            category: q.group?.slug,
          },
          occurredAt: q.close_time ? new Date(q.close_time) : undefined,
        });
      }

      if (data.results.length < limit) break;
      offset += limit;
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      id: String(p.id),
      community_prediction: String(p.community_prediction),
    };

    return {
      external_id: raw.externalId,
      source_key: "metaculus",
      source_item_type: "question",
      payload_type: "metaculus_question_v1",
      normalized_payload: {
        question_id: p.id,
        title: p.title,
        community_prediction: p.community_prediction,
        forecasters_count: p.forecasters_count,
        close_time: p.close_time,
        resolve_time: p.resolve_time,
        url: p.url,
        category: p.category,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface MetaculusQuestion {
  id: number;
  title: string;
  community_prediction?: { full?: { q2?: number } };
  forecasters_count: number;
  close_time: string;
  resolve_time: string;
  url: string;
  group?: { slug: string };
}
