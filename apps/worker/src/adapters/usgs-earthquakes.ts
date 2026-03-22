import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class UsgsEarthquakesAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      feed_url: string;
      min_magnitude?: number;
    };

    const url = `${config.feed_url}/all_day.geojson`;
    const response = await fetchWithRetry({ url, logger: this.logger });
    const data = (await response.json()) as {
      features: Array<{
        id: string;
        properties: Record<string, unknown>;
        geometry: { coordinates: number[] };
      }>;
    };

    const minMag = config.min_magnitude ?? 2.5;
    const items: RawItem[] = data.features
      .filter((f) => (f.properties.mag as number) >= minMag)
      .map((feature) => ({
        externalId: feature.id,
        payload: {
          ...feature.properties,
          coordinates: feature.geometry.coordinates,
        },
        occurredAt: feature.properties.time
          ? new Date(feature.properties.time as number)
          : undefined,
      }));

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      event_id: raw.externalId,
      magnitude: String(p.mag),
      updated: String(p.updated),
    };

    return {
      external_id: raw.externalId,
      source_key: "usgs_earthquakes",
      source_item_type: "earthquake",
      payload_type: "usgs_earthquake_v1",
      normalized_payload: {
        event_id: raw.externalId,
        magnitude: p.mag,
        place: p.place,
        coordinates: p.coordinates,
        depth: (p.coordinates as number[])?.[2],
        time: p.time,
        tsunami_flag: p.tsunami,
        felt_count: p.felt,
        significance: p.sig,
        alert_level: p.alert,
        status: p.status,
        type: p.type,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
