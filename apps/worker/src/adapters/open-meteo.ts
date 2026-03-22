import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

interface LocationConfig {
  key: string;
  lat: number;
  lon: number;
}

export class OpenMeteoAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      base_url: string;
      locations: LocationConfig[];
    };

    const items: RawItem[] = [];

    for (const loc of config.locations) {
      const url = `${config.base_url}/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=7`;

      const response = await fetchWithRetry({ url, logger: this.logger });
      const data = (await response.json()) as {
        daily: {
          time: string[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_sum: number[];
          weather_code: number[];
        };
      };

      const daily = data.daily;
      for (let i = 0; i < daily.time.length; i++) {
        const date = daily.time[i];
        if (!date) continue;
        items.push({
          externalId: `${loc.key}:${date}`,
          payload: {
            location_key: loc.key,
            latitude: loc.lat,
            longitude: loc.lon,
            date,
            temperature_2m_max: daily.temperature_2m_max[i],
            temperature_2m_min: daily.temperature_2m_min[i],
            precipitation_sum: daily.precipitation_sum[i],
            weather_code: daily.weather_code[i],
          },
          occurredAt: new Date(date),
        });
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const hashData = {
      location_key: String(p.location_key),
      date: String(p.date),
      temp_max: String(p.temperature_2m_max),
      precip: String(p.precipitation_sum),
    };

    return {
      external_id: raw.externalId,
      source_key: "open_meteo",
      source_item_type: "weather_forecast",
      payload_type: "open_meteo_forecast_v1",
      normalized_payload: {
        location_key: p.location_key,
        latitude: p.latitude,
        longitude: p.longitude,
        date: p.date,
        temp_max: p.temperature_2m_max,
        temp_min: p.temperature_2m_min,
        precip: p.precipitation_sum,
        weather_code: p.weather_code,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}
