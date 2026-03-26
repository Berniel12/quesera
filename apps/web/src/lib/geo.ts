import { getCountryDisplayName } from "./countries";

// ── Types ──

export interface InferredLocation {
  country: string | null;
  region: string | null;
  source: "header" | "ip-lookup" | "none";
}

export interface EffectiveLocation {
  country: string | null;
  region: string | null;
  city: string | null;
  source: "user-profile" | "onboarding-local" | "inferred" | "none";
  isConfirmed: boolean;
}

export interface UserLocationPrefs {
  country?: string | null;
  region?: string | null;
  city?: string | null;
}

// ── Location Resolution ──

/** Read inferred location from middleware-set response headers */
export function getInferredLocation(headers: Headers): InferredLocation {
  const country = headers.get("x-quesera-country");
  const region = headers.get("x-quesera-region");

  if (country) {
    return { country: country.toUpperCase(), region: region ?? null, source: "header" };
  }

  return { country: null, region: null, source: "none" };
}

/** Resolve effective location using the truth hierarchy */
export function getEffectiveLocation(
  headers: Headers,
  userPrefs: UserLocationPrefs | null,
): EffectiveLocation {
  // Priority 1-2: Explicit user profile location
  if (userPrefs?.country) {
    return {
      country: userPrefs.country,
      region: userPrefs.region ?? null,
      city: userPrefs.city ?? null,
      source: "user-profile",
      isConfirmed: true,
    };
  }

  // Priority 4: Inferred from IP/headers
  const inferred = getInferredLocation(headers);
  if (inferred.country) {
    return {
      country: inferred.country,
      region: inferred.region,
      city: null,
      source: "inferred",
      isConfirmed: false,
    };
  }

  // Priority 5: Global mode
  return { country: null, region: null, city: null, source: "none", isConfirmed: false };
}

// ── Display Helpers ──

/** Build display string for location. Falls back to country-only when region looks low-quality. */
export function getLocationDisplayText(loc: EffectiveLocation): string | null {
  if (!loc.country) return null;

  const countryName = getCountryDisplayName(loc.country);
  if (!countryName) return null;

  if (loc.city) {
    return `${loc.city}, ${countryName}`;
  }

  // Only show region if it looks reasonable (not raw codes, not too short)
  if (loc.region && loc.region.length > 2 && !/^\d+$/.test(loc.region)) {
    return loc.region;
  }

  return countryName;
}

// ── Country-to-Lane Boost Mappings (code-owned, deterministic) ──

/** Boosted category lanes per country. Boosted lanes move to the top; unboosted order is stable. */
export const COUNTRY_LANE_BOOSTS: Record<string, string[]> = {
  IL: ["geopolitics", "politics", "disasters"],
  US: ["politics", "macro", "sports"],
  GB: ["politics", "sports", "macro"],
  DE: ["macro", "sports", "geopolitics"],
  FR: ["politics", "sports", "macro"],
  CA: ["politics", "macro", "sports"],
  AU: ["sports", "macro", "disasters"],
  IN: ["sports", "entertainment", "macro"],
  BR: ["sports", "macro", "politics"],
  JP: ["tech", "macro", "entertainment"],
  KR: ["entertainment", "tech", "geopolitics"],
  SA: ["geopolitics", "macro", "politics"],
  AE: ["macro", "geopolitics", "crypto"],
  TR: ["geopolitics", "politics", "macro"],
  UA: ["geopolitics", "politics", "disasters"],
  ES: ["sports", "macro", "politics"],
  IT: ["sports", "macro", "geopolitics"],
  MX: ["sports", "macro", "politics"],
  NG: ["sports", "entertainment", "macro"],
  PH: ["entertainment", "sports", "geopolitics"],
  EG: ["geopolitics", "sports", "macro"],
  SE: ["sports", "tech", "macro"],
  NL: ["sports", "macro", "tech"],
  AR: ["sports", "macro", "entertainment"],
};

// ── Country-to-Topic Suggestion Mappings (code-owned, deterministic) ──

/** Suggested topic slugs per country. Must reference real existing seeded topics only. */
export const COUNTRY_TOPIC_SUGGESTIONS: Record<string, string[]> = {
  IL: ["israel-palestine-conflict", "iran-us-tensions", "lebanon-war-2026"],
  US: [
    "2026-us-midterm-elections", "us-federal-reserve-interest-rates",
    "us-inflation-rate", "hurricane-season-2026", "us-gas-prices",
  ],
  GB: ["premier-league", "champions-league", "uk-elections", "uk-inflation"],
  DE: ["bundesliga", "european-union", "ecb-interest-rates"],
  FR: ["champions-league", "france-elections", "ecb-interest-rates"],
  CA: ["us-federal-reserve-interest-rates", "climate-change"],
  AU: ["earthquake-activity", "climate-change", "cricket-world-cup"],
  UA: ["russia-ukraine-war", "nato-alliance"],
  TR: ["nato-alliance", "iran-us-tensions", "champions-league"],
  SA: ["global-oil-prices", "iran-us-tensions"],
  AE: ["global-oil-prices", "bitcoin-price"],
  IN: ["ipl-cricket", "india-economy", "india-elections", "bollywood", "cricket-world-cup"],
  BR: ["fifa-world-cup-2026", "brazil-politics", "la-liga"],
  JP: ["japan-economy", "ai-industry", "china-taiwan-relations"],
  KR: ["k-pop", "north-korea", "ai-industry"],
  ES: ["la-liga", "champions-league", "ecb-interest-rates"],
  IT: ["champions-league", "ecb-interest-rates"],
  MX: ["fifa-world-cup-2026", "la-liga"],
  NG: ["champions-league", "fifa-world-cup-2026"],
  PH: ["k-pop", "china-taiwan-relations"],
  EG: ["champions-league", "sudan-conflict"],
  SE: ["eurovision-2026", "ecb-interest-rates"],
  NL: ["champions-league", "ecb-interest-rates"],
  AR: ["la-liga", "fifa-world-cup-2026"],
};

/** US state-level refinements, merged with country suggestions */
export const US_STATE_TOPIC_SUGGESTIONS: Record<string, string[]> = {
  California: ["earthquake-activity", "wildfire-season"],
  Florida: ["hurricane-season-2026", "severe-weather-alerts"],
  Texas: ["us-gas-prices", "severe-weather-alerts"],
  "New York": ["us-stock-market", "us-housing-market"],
  Illinois: ["us-housing-market"],
  Washington: ["ai-industry", "us-trade-policy"],
};

/** Get all suggested topic slugs for a location, deduplicated */
export function getTopicSuggestionsForLocation(loc: EffectiveLocation): string[] {
  const slugs = new Set<string>();

  if (loc.country) {
    const countrySuggestions = COUNTRY_TOPIC_SUGGESTIONS[loc.country];
    if (countrySuggestions) {
      for (const s of countrySuggestions) slugs.add(s);
    }
  }

  if (loc.country === "US" && loc.region) {
    const stateSuggestions = US_STATE_TOPIC_SUGGESTIONS[loc.region];
    if (stateSuggestions) {
      for (const s of stateSuggestions) slugs.add(s);
    }
  }

  return Array.from(slugs);
}

/** Reorder category lanes based on country boosts. Unboosted lanes keep their original order. */
export function reorderLanes<T extends { key: string }>(
  lanes: T[],
  country: string | null,
): T[] {
  if (!country) return lanes;

  const boosts = COUNTRY_LANE_BOOSTS[country];
  if (!boosts || boosts.length === 0) return lanes;

  const boostedSet = new Set(boosts);
  const boosted: T[] = [];
  const rest: T[] = [];

  // Preserve boost order for boosted lanes
  for (const boostKey of boosts) {
    const lane = lanes.find((l) => l.key === boostKey);
    if (lane) boosted.push(lane);
  }

  // Preserve original order for non-boosted lanes
  for (const lane of lanes) {
    if (!boostedSet.has(lane.key)) rest.push(lane);
  }

  return [...boosted, ...rest];
}
