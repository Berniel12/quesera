import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class WikidataAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as {
      base_url: string;
      seed_entities: string[];
    };

    const items: RawItem[] = [];

    // Batch entities in groups of 50
    const batchSize = 50;
    for (let i = 0; i < config.seed_entities.length; i += batchSize) {
      const batch = config.seed_entities.slice(i, i + batchSize);
      const ids = batch.join("|");
      const url = `${config.base_url}?action=wbgetentities&ids=${ids}&format=json&props=labels|aliases|descriptions|claims&languages=en`;

      const response = await fetchWithRetry({ url, logger: this.logger });
      const data = (await response.json()) as {
        entities: Record<string, WikidataEntity>;
      };

      for (const [qid, entity] of Object.entries(data.entities)) {
        if (entity.missing !== undefined) continue;

        // Extract claims: P31 (instance_of), P17 (country), P625 (coordinates)
        const claims = entity.claims ?? {};
        const instanceOf = extractClaimValues(claims, "P31");
        const country = extractClaimValues(claims, "P17");
        const coordinates = extractCoordinates(claims, "P625");

        items.push({
          externalId: qid,
          payload: {
            qid,
            labels: entity.labels,
            aliases: entity.aliases,
            descriptions: entity.descriptions,
            claims: { instance_of: instanceOf, country, coordinates },
            modified: entity.modified,
          },
        });
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    const labels = p.labels as Record<string, { value: string }> | undefined;
    const aliases = p.aliases as Record<string, Array<{ value: string }>> | undefined;
    const descriptions = p.descriptions as Record<string, { value: string }> | undefined;

    const hashData = {
      qid: String(p.qid),
      modified: String(p.modified),
    };

    return {
      external_id: raw.externalId,
      source_key: "wikidata",
      source_item_type: "entity",
      payload_type: "wikidata_entity_v1",
      normalized_payload: {
        qid: p.qid,
        label: labels?.en?.value ?? null,
        description: descriptions?.en?.value ?? null,
        aliases: aliases?.en?.map((a) => a.value) ?? [],
        instance_of: (p.claims as Record<string, unknown>)?.instance_of ?? [],
        country: (p.claims as Record<string, unknown>)?.country ?? [],
        coordinates: (p.claims as Record<string, unknown>)?.coordinates ?? null,
        modified: p.modified,
      },
      content_hash: this.hashPayload(hashData),
      occurred_at: null,
    };
  }
}

interface WikidataEntity {
  missing?: number;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, WikidataClaim[]>;
  modified?: string;
}

interface WikidataClaim {
  mainsnak?: {
    datavalue?: {
      value: unknown;
      type: string;
    };
  };
}

function extractClaimValues(
  claims: Record<string, WikidataClaim[]>,
  property: string,
): string[] {
  const propClaims = claims[property];
  if (!propClaims) return [];

  return propClaims
    .map((claim) => {
      const val = claim.mainsnak?.datavalue?.value;
      if (typeof val === "object" && val !== null && "id" in val) {
        return (val as { id: string }).id;
      }
      return null;
    })
    .filter((v): v is string => v !== null);
}

function extractCoordinates(
  claims: Record<string, WikidataClaim[]>,
  property: string,
): { latitude: number; longitude: number } | null {
  const propClaims = claims[property];
  if (!propClaims || propClaims.length === 0) return null;

  const val = propClaims[0]?.mainsnak?.datavalue?.value;
  if (
    typeof val === "object" &&
    val !== null &&
    "latitude" in val &&
    "longitude" in val
  ) {
    const coord = val as { latitude: number; longitude: number };
    return { latitude: coord.latitude, longitude: coord.longitude };
  }
  return null;
}
