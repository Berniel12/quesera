import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class CongressGovAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const apiKey = process.env.CONGRESS_GOV_API_KEY;
    if (!apiKey) {
      throw new Error("CONGRESS_GOV_API_KEY is not set");
    }

    const config = this.sourceDefinition.config as { base_url: string };
    const items: RawItem[] = [];

    // Use last sync time for fromDateTime, fall back to 24 hours ago
    const { data: health } = await this.supabase
      .from("source_health")
      .select("last_success_at")
      .eq("source_id", this.sourceDefinition.id)
      .single();

    const lastSuccess = (health as { last_success_at: string | null } | null)?.last_success_at;
    const fromDateTime = lastSuccess
      ? new Date(lastSuccess).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore && offset < 500) {
      const url = `${config.base_url}/bill?api_key=${apiKey}&limit=${limit}&offset=${offset}&sort=updateDate+desc&fromDateTime=${encodeURIComponent(fromDateTime)}&format=json`;

      const response = await fetchWithRetry({
        url,
        logger: this.logger,
        retryDelayMs: 2000, // Congress.gov is sensitive to rate
      });
      const data = (await response.json()) as {
        bills: Array<CongressBill>;
        pagination: { count: number };
      };

      for (const bill of data.bills) {
        items.push({
          externalId: `${bill.congress}-${bill.type}-${bill.number}`,
          payload: {
            congress: bill.congress,
            type: bill.type,
            number: bill.number,
            title: bill.title,
            latest_action_date: bill.latestAction?.actionDate,
            latest_action_text: bill.latestAction?.text,
            update_date: bill.updateDate,
            origin_chamber: bill.originChamber,
            url: bill.url,
          },
          occurredAt: bill.latestAction?.actionDate
            ? new Date(bill.latestAction.actionDate)
            : undefined,
        });
      }

      hasMore = data.bills.length === limit;
      offset += limit;
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      bill_id: raw.externalId,
      latest_action_date: String(p.latest_action_date),
      latest_action_text: String(p.latest_action_text),
    };

    return {
      external_id: raw.externalId,
      source_key: "congress_gov",
      source_item_type: "bill",
      payload_type: "congress_bill_v1",
      normalized_payload: {
        bill_id: raw.externalId,
        congress: p.congress,
        type: p.type,
        number: p.number,
        title: p.title,
        latest_action_date: p.latest_action_date,
        latest_action_text: p.latest_action_text,
        update_date: p.update_date,
        origin_chamber: p.origin_chamber,
        url: p.url,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  latestAction?: { actionDate: string; text: string };
  updateDate: string;
  originChamber: string;
  url: string;
}
