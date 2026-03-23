import type { MatchSignals, SeedMapEntry } from "./types.js";
import { SOURCE_FAMILY_CATEGORY_MAP, FRED_SERIES_SEED_MAP, COINGECKO_SEED_MAP, USGS_TOPIC_SLUG, POLYMARKET_SLUG_RULES, MANIFOLD_QUESTION_RULES, CONGRESS_TITLE_RULES } from "./types.js";

interface SourceItem {
  source_item_type: string | null;
  source_key: string;
  normalized_payload: Record<string, unknown>;
}

interface SourceDefinition {
  source_family: string;
}

/**
 * Extract matchable signals from a source item's normalized payload.
 * Works only from stored data — never refetches upstream APIs.
 */
export function extractMatchSignals(
  item: SourceItem,
  sourceDef: SourceDefinition,
): MatchSignals {
  const category = SOURCE_FAMILY_CATEGORY_MAP[sourceDef.source_family] ?? null;
  const p = item.normalized_payload;

  switch (item.source_item_type) {
    case "bill":
      return {
        text: String(p.title ?? ""),
        category,
        entities: extractEntitiesFromText(String(p.title ?? "")),
      };

    case "macro_series_observation":
      return {
        text: FRED_SERIES_DESCRIPTIONS[String(p.series_id)] ?? String(p.series_id ?? ""),
        category,
        entities: [],
      };

    case "earthquake":
      return {
        text: String(p.place ?? ""),
        category,
        entities: extractEntitiesFromPlace(String(p.place ?? "")),
      };

    case "weather_alert":
      return {
        text: `${p.event_type ?? ""} ${p.area_desc ?? ""}`.trim(),
        category,
        entities: extractEntitiesFromText(String(p.area_desc ?? "")),
      };

    case "weather_forecast":
      return {
        text: String(p.location_key ?? ""),
        category,
        entities: [],
      };

    case "entity":
      // Currently unreachable: engine.ts skips entity items before extraction.
      // Kept for completeness if skip logic changes.
      return {
        text: String(p.label ?? ""),
        category: null,
        entities: (p.aliases as string[]) ?? [],
      };

    case "filing":
      return {
        text: String(p.committee_name ?? ""),
        category,
        entities: [],
      };

    default:
      return { text: "", category, entities: [] };
  }
}

/**
 * Check if a source item has deterministic seed_map matches.
 * Returns all matching entries (multi-topic matching is intentional for shared causal signals).
 * Returns null if no seed map match.
 */
export function getSeedMapMatches(item: SourceItem): SeedMapEntry[] | null {
  // FRED macro series: exact series_id match
  if (item.source_item_type === "macro_series_observation") {
    const seriesId = String(item.normalized_payload.series_id ?? "");
    const entries = FRED_SERIES_SEED_MAP[seriesId];
    return entries && entries.length > 0 ? entries : null;
  }

  // CoinGecko crypto prices: exact coin_id match
  if (item.source_item_type === "crypto_price") {
    const coinId = String(item.normalized_payload.coin_id ?? "");
    const entries = COINGECKO_SEED_MAP[coinId];
    return entries && entries.length > 0 ? entries : null;
  }

  // USGS earthquakes: all items → earthquake-activity
  if (item.source_item_type === "earthquake") {
    return [{ slug: USGS_TOPIC_SLUG, confidence: 1.0 }];
  }

  // NOAA weather alerts: all items → severe-weather-alerts
  if (item.source_item_type === "weather_alert") {
    return [{ slug: "severe-weather-alerts", confidence: 1.0 }];
  }

  // Prediction market items: keyword matching on slug or question text
  if (item.source_item_type === "market") {
    // Try Polymarket slug-based matching first
    const slug = String(item.normalized_payload.slug ?? "").toLowerCase();
    if (slug) {
      for (const rule of POLYMARKET_SLUG_RULES) {
        if (slug.includes(rule.pattern)) {
          return rule.entries;
        }
      }
    }

    // Try Manifold/generic question-text matching
    const question = String(item.normalized_payload.question ?? "").toLowerCase();
    if (question) {
      for (const rule of MANIFOLD_QUESTION_RULES) {
        if (question.includes(rule.pattern)) {
          return rule.entries;
        }
      }
    }
  }

  // Congress.gov bills: title keyword matching (policy-specific only)
  if (item.source_item_type === "bill") {
    const title = String(item.normalized_payload.title ?? "").toLowerCase();
    if (title) {
      for (const rule of CONGRESS_TITLE_RULES) {
        if (title.includes(rule.pattern)) {
          return rule.entries;
        }
      }
    }
  }

  return null;
}

// Human-readable names for FRED series (for trigram matching)
const FRED_SERIES_DESCRIPTIONS: Record<string, string> = {
  CPIAUCSL: "Consumer Price Index CPI Inflation",
  UNRATE: "Unemployment Rate Jobs",
  FEDFUNDS: "Federal Funds Rate Interest Rate",
  MORTGAGE30US: "30-Year Mortgage Rate",
  GDP: "Gross Domestic Product GDP",
  DGS10: "10-Year Treasury Yield Interest Rate",
};

function extractEntitiesFromText(text: string): string[] {
  // Simple extraction: split on common separators, keep multi-word tokens
  const words = text.split(/[,;()]/).map((s) => s.trim()).filter(Boolean);
  return words.filter((w) => w.length > 2);
}

function extractEntitiesFromPlace(place: string): string[] {
  // USGS place strings like "20 km E of Fukushima, Japan"
  const parts = place.split(",").map((s) => s.trim());
  const entities: string[] = [];
  for (const part of parts) {
    // Extract location name after "of" if present
    const ofMatch = part.match(/of\s+(.+)/i);
    if (ofMatch?.[1]) {
      entities.push(ofMatch[1]);
    } else if (!part.match(/^\d/)) {
      entities.push(part);
    }
  }
  return entities;
}
