import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class FecAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const apiKey = process.env.FEC_API_KEY ?? "DEMO_KEY";

    const config = this.sourceDefinition.config as { base_url: string };
    const items: RawItem[] = [];

    // Fetch recent filings
    const url = `${config.base_url}/filings/?api_key=${apiKey}&per_page=100&sort=-receipt_date`;

    const response = await fetchWithRetry({ url, logger: this.logger });
    const data = (await response.json()) as {
      results: Array<FecFiling>;
    };

    for (const filing of data.results) {
      items.push({
        externalId: String(filing.filing_id),
        payload: {
          filing_id: filing.filing_id,
          committee_id: filing.committee_id,
          committee_name: filing.committee_name,
          form_type: filing.form_type,
          receipt_date: filing.receipt_date,
          coverage_start_date: filing.coverage_start_date,
          coverage_end_date: filing.coverage_end_date,
          total_receipts: filing.total_receipts,
          total_disbursements: filing.total_disbursements,
          amendment_indicator: filing.amendment_indicator,
          report_type: filing.report_type,
        },
        occurredAt: filing.receipt_date
          ? new Date(filing.receipt_date)
          : undefined,
      });
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      filing_id: String(p.filing_id),
      amendment_indicator: String(p.amendment_indicator),
    };

    return {
      external_id: raw.externalId,
      source_key: "fec",
      source_item_type: "filing",
      payload_type: "fec_filing_v1",
      normalized_payload: {
        filing_id: p.filing_id,
        committee_id: p.committee_id,
        committee_name: p.committee_name,
        form_type: p.form_type,
        receipt_date: p.receipt_date,
        coverage_start_date: p.coverage_start_date,
        coverage_end_date: p.coverage_end_date,
        total_receipts: p.total_receipts,
        total_disbursements: p.total_disbursements,
        amendment_indicator: p.amendment_indicator,
        report_type: p.report_type,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface FecFiling {
  filing_id: number;
  committee_id: string;
  committee_name: string;
  form_type: string;
  receipt_date: string;
  coverage_start_date: string;
  coverage_end_date: string;
  total_receipts: number;
  total_disbursements: number;
  amendment_indicator: string;
  report_type: string;
}
