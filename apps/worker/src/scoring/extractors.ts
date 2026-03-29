import {
  SOURCE_FAMILY_WEIGHTS,
  POLITICAL_STATUS_ORDINALS,
  SEVERITY_ORDINALS,
} from "./types.js";

export interface ExtractedSignal {
  currentValue: number | null;
  signalTimestamp: Date;
  signalType: string;
  sourceName: string;
  externalId: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Source-family-specific numeric extraction from normalized_payload.
 * Deterministic, code-owned. No prose inference.
 */
export function extractNumericSignal(
  sourceFamily: string,
  sourceKey: string,
  normalizedPayload: Record<string, unknown>,
  externalId: string,
  occurredAt: string | null,
  lastSeenAt: string,
): ExtractedSignal | null {
  // Use lastSeenAt (sync time) for freshness computation.
  // occurredAt is useful for ordering observations but not for determining staleness —
  // weekly FRED data "occurred" days ago but was just freshly synced.
  const timestamp = new Date(lastSeenAt);

  switch (sourceFamily) {
    case "macro_official":
      return extractMacro(sourceKey, normalizedPayload, externalId, timestamp);
    case "political_official":
      return extractPolitical(sourceKey, normalizedPayload, externalId, timestamp);
    case "hazard_weather":
      return extractHazard(sourceKey, normalizedPayload, externalId, timestamp);
    case "crypto_market":
      return extractCrypto(normalizedPayload, externalId, timestamp);
    case "prediction_market":
      return extractPredictionMarket(normalizedPayload, externalId, timestamp);
    case "forecasting":
      return extractForecasting(normalizedPayload, externalId, timestamp);
    case "forecast_aggregator":
      return extractForecastAggregator(normalizedPayload, externalId, timestamp);
    case "sports_odds":
      return extractSportsOdds(normalizedPayload, externalId, timestamp);
    case "defi_signal":
      return extractDefi(normalizedPayload, externalId, timestamp);
    default:
      return null;
  }
}

export function getSignalWeight(sourceFamily: string): number {
  return SOURCE_FAMILY_WEIGHTS[sourceFamily] ?? 0.5;
}

function extractMacro(
  sourceKey: string,
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  const rawValue = payload.value;
  if (rawValue === null || rawValue === undefined) return null;

  const value = typeof rawValue === "number"
    ? rawValue
    : parseFloat(String(rawValue));

  if (isNaN(value)) return null;

  return {
    currentValue: value,
    signalTimestamp: timestamp,
    signalType: "macro_observation",
    sourceName: sourceKey,
    externalId,
    metadata: { series_id: payload.series_id, date: payload.date },
  };
}

function extractPolitical(
  sourceKey: string,
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  // For bills: use action status ordinal
  const actionText = String(payload.latest_action_text ?? "").toLowerCase();

  let ordinal: number | null = null;
  for (const [keyword, value] of Object.entries(POLITICAL_STATUS_ORDINALS)) {
    if (actionText.includes(keyword)) {
      ordinal = value;
      break;
    }
  }

  if (ordinal === null) {
    // Default: count as 1 (activity indicator)
    ordinal = 1;
  }

  return {
    currentValue: ordinal,
    signalTimestamp: timestamp,
    signalType: "political_event",
    sourceName: sourceKey,
    externalId,
    metadata: {
      title: payload.title,
      latest_action: payload.latest_action_text,
    },
  };
}

function extractHazard(
  sourceKey: string,
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  if (sourceKey === "usgs_earthquakes") {
    const magnitude = payload.magnitude;
    if (magnitude === null || magnitude === undefined) return null;
    const value = typeof magnitude === "number" ? magnitude : parseFloat(String(magnitude));
    if (isNaN(value)) return null;

    return {
      currentValue: value,
      signalTimestamp: timestamp,
      signalType: "earthquake_magnitude",
      sourceName: sourceKey,
      externalId,
      metadata: { place: payload.place, significance: payload.significance },
    };
  }

  if (sourceKey === "noaa_nws") {
    const severity = String(payload.severity ?? "");
    const ordinal = SEVERITY_ORDINALS[severity] ?? 0;
    if (ordinal === 0) return null;

    return {
      currentValue: ordinal,
      signalTimestamp: timestamp,
      signalType: "weather_severity",
      sourceName: sourceKey,
      externalId,
      metadata: {
        event_type: payload.event_type,
        headline: payload.headline,
      },
    };
  }

  if (sourceKey === "open_meteo") {
    const precip = payload.precip;
    if (precip === null || precip === undefined) return null;
    const value = typeof precip === "number" ? precip : parseFloat(String(precip));
    if (isNaN(value)) return null;

    return {
      currentValue: value,
      signalTimestamp: timestamp,
      signalType: "weather_precipitation",
      sourceName: sourceKey,
      externalId,
      metadata: {
        location_key: payload.location_key,
        temp_max: payload.temp_max,
      },
    };
  }

  return null;
}

function extractCrypto(
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  const price = payload.current_price;
  if (price === null || price === undefined) return null;

  const value = typeof price === "number" ? price : parseFloat(String(price));
  if (isNaN(value)) return null;

  return {
    currentValue: value,
    signalTimestamp: timestamp,
    signalType: "asset_price",
    sourceName: "coingecko",
    externalId,
    metadata: {
      coin_id: payload.coin_id,
      name: payload.name,
      symbol: payload.symbol,
      market_cap: payload.market_cap,
    },
  };
}

function extractPredictionMarket(
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  let yesProb: number | null = null;
  let sourceName = "polymarket";
  let question = payload.question ?? payload.slug ?? "";

  // Kalshi: uses yes_price (0-1 decimal dollar price = probability)
  if (payload.yes_price !== undefined && payload.yes_price !== null) {
    const price = parseFloat(String(payload.yes_price));
    if (!isNaN(price) && price > 0) {
      yesProb = price; // Kalshi prices are already 0-1 probabilities
      sourceName = "kalshi";
      question = payload.title ?? payload.question ?? "";
    }
  }

  // Polymarket: uses outcome_prices array
  if (yesProb === null) {
    const pricesRaw = payload.outcome_prices;
    if (typeof pricesRaw === "string") {
      try {
        const parsed = JSON.parse(pricesRaw) as unknown[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          yesProb = parseFloat(String(parsed[0]));
        }
      } catch { /* ignore parse errors */ }
    } else if (Array.isArray(pricesRaw) && pricesRaw.length > 0) {
      yesProb = parseFloat(String(pricesRaw[0]));
    }
  }

  // Manifold/PolyRouter: community_prediction or similar
  if (yesProb === null && payload.community_prediction !== undefined) {
    yesProb = parseFloat(String(payload.community_prediction));
    sourceName = String(payload.source ?? "manifold");
  }

  if (yesProb === null || isNaN(yesProb)) return null;

  return {
    currentValue: yesProb,
    signalTimestamp: timestamp,
    signalType: "market_probability",
    sourceName,
    externalId,
    metadata: {
      question,
      slug: payload.slug,
      volume_24hr: payload.volume_24hr,
      volume: payload.volume,
      series_ticker: payload.series_ticker,
    },
  };
}

function extractForecasting(
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  // Metaculus: community_prediction is already a 0-1 probability
  const pred = payload.community_prediction;
  if (pred === null || pred === undefined) return null;

  const prob = parseFloat(String(pred));
  if (isNaN(prob)) return null;

  return {
    currentValue: prob,
    signalTimestamp: timestamp,
    signalType: "forecast_probability",
    sourceName: "metaculus",
    externalId,
    metadata: {
      question: payload.title,
      question_id: payload.question_id,
      forecasters_count: payload.forecasters_count,
      url: payload.url,
    },
  };
}

function extractForecastAggregator(
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  // Metaforecast/similar: extract probability from outcome_prices
  const pricesRaw = payload.outcome_prices;
  let prob: number | null = null;

  if (Array.isArray(pricesRaw) && pricesRaw.length > 0) {
    prob = parseFloat(String(pricesRaw[0]));
  }

  if (prob === null || isNaN(prob)) return null;

  return {
    currentValue: prob,
    signalTimestamp: timestamp,
    signalType: "forecast_probability",
    sourceName: String(payload.platform ?? "metaforecast"),
    externalId,
    metadata: {
      question: payload.question,
      platform: payload.platform,
      quality: payload.quality,
      num_forecasters: payload.num_forecasters,
    },
  };
}

function extractSportsOdds(
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  // The Odds API: extract implied probability from outcomes
  const outcomes = payload.outcomes as Array<{ name: string; implied_probability: number }> | undefined;
  if (!outcomes || outcomes.length === 0) return null;

  // Use the home team probability (first outcome) as the signal value
  const firstOutcome = outcomes[0] as { name: string; implied_probability: number } | undefined;
  if (!firstOutcome) return null;
  const prob = firstOutcome.implied_probability;
  if (typeof prob !== "number" || isNaN(prob)) return null;

  return {
    currentValue: prob,
    signalTimestamp: timestamp,
    signalType: "odds_probability",
    sourceName: String(payload.bookmaker ?? "odds_api"),
    externalId,
    metadata: {
      sport_key: payload.sport_key,
      home_team: payload.home_team,
      away_team: payload.away_team,
      outcomes,
      bookmaker_count: payload.bookmaker_count,
    },
  };
}

function extractDefi(
  payload: Record<string, unknown>,
  externalId: string,
  timestamp: Date,
): ExtractedSignal | null {
  const tvl = payload.tvl;
  if (tvl === null || tvl === undefined) return null;

  const value = typeof tvl === "number" ? tvl : parseFloat(String(tvl));
  if (isNaN(value)) return null;

  return {
    currentValue: value,
    signalTimestamp: timestamp,
    signalType: "defi_tvl",
    sourceName: String(payload.name ?? "defillama"),
    externalId,
    metadata: {
      name: payload.name,
      symbol: payload.symbol,
      chain: payload.chain,
      change_1d: payload.change_1d,
      change_7d: payload.change_7d,
      category: payload.category,
    },
  };
}
