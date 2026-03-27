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

// ── Matching helpers ──

/** Escape regex special chars in a pattern string */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary match instead of substring.
 * "hurricane" matches "hurricane-season" but NOT "hurricanes-vs-canadiens".
 * Treats hyphens as word boundaries (common in slugs).
 */
function matchesPattern(text: string, pattern: string): boolean {
  // For patterns with trailing space (e.g. "f1 "), trim and use word boundary
  const trimmed = pattern.trimEnd();
  const escaped = escapeRegex(trimmed);
  // Use \b for word boundaries; also treat hyphens as boundaries for slugs
  const re = new RegExp(`(?:^|[\\s\\-_/])${escaped}(?:$|[\\s\\-_/])`, "i");
  return re.test(text);
}

/** Detect sports bets by characteristic patterns in question/slug text */
const SPORTS_BET_PATTERN = /\bvs\.?\s|\bspread[:\s]|\bo\/u\s|\bover[\s/-]under\b|\bmoneyline\b|\bparlay\b|\bpoint spread\b|\btotal points\b|\bgame \d/i;

/** Sports topic slugs -- used to allow sports bets to match sports topics only */
const SPORTS_SLUGS = new Set([
  "nba-season-2025-26", "nfl-2026-season", "premier-league", "champions-league",
  "fifa-world-cup-2026", "mlb-season-2026", "formula-1-2026", "ufc-mma",
  "la-liga", "bundesliga", "ipl-cricket", "cricket-world-cup", "rugby-world-cup",
  "tennis-grand-slams", "olympics-2028", "tour-de-france",
]);

function isSportsSlug(slug: string): boolean {
  return SPORTS_SLUGS.has(slug);
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

    case "sports_odds":
      return {
        text: `${p.sport_key ?? ""} ${p.home_team ?? ""} ${p.away_team ?? ""}`.trim(),
        category: "sports",
        entities: [String(p.home_team ?? ""), String(p.away_team ?? "")].filter(Boolean),
      };

    case "sports_event":
      return {
        text: `${p.league ?? ""} ${p.name ?? p.headline ?? ""}`.trim(),
        category: "sports",
        entities: extractEntitiesFromText(String(p.name ?? p.headline ?? "")),
      };

    case "article":
      return {
        text: `${p.title ?? p.headline ?? ""} ${p.description ?? ""}`.trim().slice(0, 500),
        category,
        entities: extractEntitiesFromText(String(p.title ?? p.headline ?? "")),
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

  // Sports odds: map sport_key to topic
  if (item.source_item_type === "sports_odds") {
    const sportKey = String(item.normalized_payload.sport_key ?? "").toLowerCase();
    const SPORT_KEY_MAP: Record<string, SeedMapEntry[]> = {
      "soccer_epl": [{ slug: "premier-league", confidence: 0.9 }],
      "soccer_uefa_champs_league": [{ slug: "champions-league", confidence: 0.9 }],
      "soccer_spain_la_liga": [{ slug: "la-liga", confidence: 0.9 }],
      "soccer_germany_bundesliga": [{ slug: "bundesliga", confidence: 0.9 }],
      "soccer_fifa_world_cup": [{ slug: "fifa-world-cup-2026", confidence: 0.9 }],
      "americanfootball_nfl": [{ slug: "nfl-2026-season", confidence: 0.9 }],
      "basketball_nba": [{ slug: "nba-season-2025-26", confidence: 0.9 }],
      "baseball_mlb": [{ slug: "mlb-season-2026", confidence: 0.9 }],
      "mma_mixed_martial_arts": [{ slug: "ufc-mma", confidence: 0.9 }],
      "cricket_ipl": [{ slug: "ipl-cricket", confidence: 0.9 }],
      "rugbyleague_nrl": [{ slug: "rugby-world-cup", confidence: 0.7 }],
      "tennis_atp_french_open": [{ slug: "tennis-grand-slams", confidence: 0.9 }],
      "tennis_atp_wimbledon": [{ slug: "tennis-grand-slams", confidence: 0.9 }],
      "tennis_atp_us_open": [{ slug: "tennis-grand-slams", confidence: 0.9 }],
      "tennis_atp_aus_open": [{ slug: "tennis-grand-slams", confidence: 0.9 }],
      "motorsport_formula_one": [{ slug: "formula-1-2026", confidence: 0.9 }],
    };
    const entries = SPORT_KEY_MAP[sportKey];
    if (entries) return entries;
    // Unknown sport -- fall through to trigram matching
  }

  // ESPN sports events: map league to topic
  if (item.source_item_type === "sports_event") {
    const league = String(item.normalized_payload.league ?? "").toLowerCase();
    const LEAGUE_MAP: Record<string, SeedMapEntry[]> = {
      "nfl": [{ slug: "nfl-2026-season", confidence: 0.9 }],
      "nba": [{ slug: "nba-season-2025-26", confidence: 0.9 }],
      "mlb": [{ slug: "mlb-season-2026", confidence: 0.9 }],
      "nhl": [], // No NHL topic -- skip
      "epl": [{ slug: "premier-league", confidence: 0.9 }],
    };
    const entries = LEAGUE_MAP[league];
    if (entries && entries.length > 0) return entries;
    if (entries && entries.length === 0) return null; // explicitly skip (e.g., NHL)
  }

  // Prediction market items: keyword matching on slug or question text
  if (item.source_item_type === "market") {
    const slug = String(item.normalized_payload.slug ?? "").toLowerCase();
    const question = String(item.normalized_payload.question ?? "").toLowerCase();
    const text = `${slug} ${question}`;

    // Sports bet exclusion: if this looks like a sports bet, only match to sports topics
    const isSportsBet = SPORTS_BET_PATTERN.test(text);

    // Try Polymarket slug-based matching first (word-boundary, not substring)
    if (slug) {
      for (const rule of POLYMARKET_SLUG_RULES) {
        if (matchesPattern(slug, rule.pattern)) {
          // If it's a sports bet, only allow matches to sports topics
          if (isSportsBet) {
            const sportsEntries = rule.entries.filter((e) => isSportsSlug(e.slug));
            if (sportsEntries.length > 0) return sportsEntries;
            continue; // skip this rule -- sports bet matching non-sports topic
          }
          return rule.entries;
        }
      }
    }

    // Try Manifold/generic question-text matching (word-boundary)
    if (question) {
      for (const rule of MANIFOLD_QUESTION_RULES) {
        if (matchesPattern(question, rule.pattern)) {
          if (isSportsBet) {
            const sportsEntries = rule.entries.filter((e) => isSportsSlug(e.slug));
            if (sportsEntries.length > 0) return sportsEntries;
            continue;
          }
          return rule.entries;
        }
      }
    }
  }

  // Congress.gov bills: title keyword matching (word-boundary)
  if (item.source_item_type === "bill") {
    const title = String(item.normalized_payload.title ?? "").toLowerCase();
    if (title) {
      for (const rule of CONGRESS_TITLE_RULES) {
        if (matchesPattern(title, rule.pattern)) {
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
