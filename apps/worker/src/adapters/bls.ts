import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class BlsAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      base_url: string;
      series_ids: string[];
    };

    const items: RawItem[] = [];

    // BLS v1 public API — GET per series (no key needed)
    for (const seriesId of config.series_ids) {
      const url = `${config.base_url}/publicAPI/v1/timeseries/data/${seriesId}`;
      try {
        const res = await fetchWithRetry({
          url,
          headers: { "User-Agent": "QUESERA/1.0" },
          logger: this.logger,
        });
        const data = (await res.json()) as {
          Results?: { series?: Array<{ seriesID: string; data: BlsObservation[] }> };
        };

        const series = data.Results?.series?.[0];
        if (!series) continue;

        for (const obs of series.data.slice(0, 12)) {
          // Period format: M01-M12 for monthly, Q01-Q04 for quarterly, A01 for annual
          let occurredAt: Date | undefined;
          if (obs.period.startsWith("M")) {
            const month = obs.period.slice(1).padStart(2, "0");
            occurredAt = new Date(`${obs.year}-${month}-01`);
          } else {
            occurredAt = new Date(`${obs.year}-01-01`);
          }
          if (isNaN(occurredAt.getTime())) occurredAt = undefined;

          items.push({
            externalId: `${seriesId}:${obs.year}-${obs.period}`,
            payload: {
              series_id: seriesId,
              year: obs.year,
              period: obs.period,
              period_name: obs.periodName,
              value: obs.value,
            },
            occurredAt,
          });
        }
      } catch (err) {
        this.logger.warn({ seriesId, error: err instanceof Error ? err.message : String(err) }, "BLS series fetch failed");
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      series_id: String(p.series_id),
      year: String(p.year),
      period: String(p.period),
      value: String(p.value),
    };

    return {
      external_id: raw.externalId,
      source_key: "bls",
      source_item_type: "macro_series_observation",
      payload_type: "bls_observation_v1",
      normalized_payload: {
        series_id: p.series_id,
        year: p.year,
        period: p.period,
        period_name: p.period_name,
        value: parseFloat(String(p.value)),
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface BlsObservation {
  year: string;
  period: string;
  periodName: string;
  value: string;
  footnotes: Array<{ text: string }>;
}
