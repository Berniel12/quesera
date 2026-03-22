import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class NoaaNwsAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };
    const url = `${config.base_url}/alerts/active?status=actual&message_type=alert`;

    const response = await fetchWithRetry({
      url,
      headers: {
        "User-Agent": "(SignalMap, contact@signalmap.app)",
        Accept: "application/geo+json",
      },
      logger: this.logger,
    });

    const data = (await response.json()) as {
      features: Array<{
        id: string;
        properties: Record<string, unknown>;
      }>;
    };

    const items: RawItem[] = data.features.map((feature) => ({
      externalId: feature.id,
      payload: feature.properties,
      occurredAt: feature.properties.onset
        ? new Date(feature.properties.onset as string)
        : undefined,
    }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      alert_id: raw.externalId,
      status: String(p.status),
      expires: String(p.expires),
    };

    return {
      external_id: raw.externalId,
      source_key: "noaa_nws",
      source_item_type: "weather_alert",
      payload_type: "nws_alert_v1",
      normalized_payload: {
        alert_id: raw.externalId,
        event_type: p.event,
        severity: p.severity,
        urgency: p.urgency,
        certainty: p.certainty,
        headline: p.headline,
        description: p.description,
        instruction: p.instruction,
        affected_zones: p.affectedZones,
        area_desc: p.areaDesc,
        onset: p.onset,
        expires: p.expires,
        sender_name: p.senderName,
        category: p.category,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
