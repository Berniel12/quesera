/**
 * Deterministic Source-Comparison Engine
 *
 * Computes structured comparison between prediction market platforms
 * and grounding/strengthening data sources. No LLM involved.
 *
 * This is Layer A of the synthesis system:
 * - Layer A: deterministic comparison (this file)
 * - Layer B: constrained LLM phrasing (deferred)
 */

import type { ScoredSignal } from "./types.js";
import type { SourcePack, QuestionType } from "../packs/index.js";
import { FAMILY_DISPLAY } from "../packs/index.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface PlatformBreakdown {
  platform: string;
  displayName: string;
  avgProbability: number;
  signalCount: number;
  topQuestion: string;
}

export interface GroundingMetric {
  source: string;
  name: string;
  value: number;
  formatted: string;
  delta: number | null;
  deltaFormatted: string | null;
}

export interface SourceComparison {
  predictivePlatforms: string[];
  strengtheningFamilies: string[];

  predictiveAvgProbability: number | null;
  predictiveMinProbability: number | null;
  predictiveMaxProbability: number | null;
  predictiveSpreadPp: number | null;

  platformBreakdown: PlatformBreakdown[];

  primaryGroundingMetric: GroundingMetric | null;
  groundingAlignment: "supports" | "neutral" | "contradicts" | null;
  groundingInterpretation: "supports_yes" | "supports_no" | "neutral" | null;

  agreementState: "consensus" | "mild_divergence" | "sharp_divergence" | "insufficient_data";

  competitionLeader: { name: string; pct: number; source: string } | null;
  competitionChallenger: { name: string; pct: number; source: string } | null;
  competitionGapPp: number | null;

  comparisonConfidence: "high" | "medium" | "low";
  leadPlatform: string | null;

  mostRecentSignal: string;
  freshnessDescription: string;
}

// ── Grounding direction model ──────────────────────────────────────────
// Per-topic: what does "metric going up" mean for the question answer?

type MetricDirectionMeaning = "up_means_yes" | "up_means_no" | "ambiguous";

const GROUNDING_DIRECTION: Record<string, MetricDirectionMeaning> = {
  "us-federal-reserve-interest-rates": "up_means_no",
  "bitcoin-price": "up_means_yes",
  "us-inflation-rate": "up_means_yes",
  "global-recession-risk": "up_means_yes",
  "us-stock-market": "up_means_yes",
  "global-oil-prices": "up_means_yes",
  "crypto-market": "up_means_yes",
  "us-mortgage-rates": "up_means_no",
  "us-unemployment-rate": "up_means_yes",
  "us-housing-market": "up_means_no",
};

// ── Metric formatting helpers ──────────────────────────────────────────

const METRIC_NAMES: Record<string, string> = {
  FEDFUNDS: "Federal Funds Rate",
  MORTGAGE30US: "30-Year Mortgage Rate",
  DGS10: "10-Year Treasury Yield",
  CPIAUCSL: "Consumer Price Index",
  UNRATE: "Unemployment Rate",
  GDP: "GDP Growth",
};

function formatMetric(value: number, sourceFamily: string): string {
  if (sourceFamily === "crypto_market") {
    return value >= 1
      ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `$${value.toFixed(4)}`;
  }
  if (sourceFamily === "macro_official") {
    return value > 100 ? value.toLocaleString("en-US") : `${value.toFixed(2)}%`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDelta(delta: number, sourceFamily: string): string {
  const sign = delta > 0 ? "+" : "";
  if (sourceFamily === "crypto_market") {
    return `${sign}$${Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (sourceFamily === "macro_official") {
    return `${sign}${delta.toFixed(2)}`;
  }
  return `${sign}${delta.toFixed(2)}`;
}

// ── Main computation ───────────────────────────────────────────────────

export function computeSourceComparison(
  signals: ScoredSignal[],
  pack: SourcePack,
  questionType: QuestionType,
  topicSlug: string,
  direction: string,
): SourceComparison {
  // Group signals by source_name (platform)
  const byPlatform = new Map<string, ScoredSignal[]>();
  for (const s of signals) {
    const list = byPlatform.get(s.sourceName) ?? [];
    list.push(s);
    byPlatform.set(s.sourceName, list);
  }

  // Identify predictive vs strengthening signals
  const predictiveSignals = signals.filter((s) =>
    pack.predictiveSpine.includes(s.sourceFamily),
  );
  const strengtheningSignals = signals.filter((s) =>
    pack.strengtheningLayer.includes(s.sourceFamily),
  );

  // Predictive platforms
  const predictivePlatforms = [
    ...new Set(predictiveSignals.map((s) => s.sourceName)),
  ];
  const strengtheningFamilies = [
    ...new Set(strengtheningSignals.map((s) => s.sourceFamily)),
  ];

  // Per-platform probability breakdown
  const platformBreakdown: PlatformBreakdown[] = [];
  for (const platform of predictivePlatforms) {
    const platSignals = predictiveSignals.filter(
      (s) => s.sourceName === platform,
    );
    const probSignals = platSignals.filter(
      (s) =>
        s.signalType === "market_probability" ||
        s.signalType === "forecast_probability",
    );

    if (probSignals.length === 0) continue;

    const avg =
      probSignals.reduce((sum, s) => sum + s.currentValue, 0) /
      probSignals.length;

    // topQuestion: highest-weight lead-eligible signal
    const topSig = probSignals
      .filter(
        (s) => s.currentValue > 0.02 && s.currentValue < 0.98,
      )
      .sort((a, b) => b.weight - a.weight)[0];

    platformBreakdown.push({
      platform,
      displayName: FAMILY_DISPLAY[platform] ?? platform,
      avgProbability: avg,
      signalCount: platSignals.length,
      topQuestion: String(topSig?.metadata?.question ?? ""),
    });
  }

  // Predictive consensus metrics
  const platformProbs = platformBreakdown.map((p) => p.avgProbability);
  const predictiveAvg =
    platformProbs.length > 0
      ? platformProbs.reduce((a, b) => a + b, 0) / platformProbs.length
      : null;
  const predictiveMin =
    platformProbs.length > 0 ? Math.min(...platformProbs) : null;
  const predictiveMax =
    platformProbs.length > 0 ? Math.max(...platformProbs) : null;
  const spreadPp =
    predictiveMin !== null && predictiveMax !== null
      ? Math.round((predictiveMax - predictiveMin) * 100)
      : null;

  // Agreement state
  let agreementState: SourceComparison["agreementState"] = "insufficient_data";
  if (spreadPp !== null && predictivePlatforms.length >= 2) {
    if (spreadPp <= 5) agreementState = "consensus";
    else if (spreadPp <= 15) agreementState = "mild_divergence";
    else agreementState = "sharp_divergence";
  }

  // Primary grounding metric
  let primaryGroundingMetric: GroundingMetric | null = null;
  const groundingSig = strengtheningSignals
    .filter((s) => s.currentValue !== null)
    .sort((a, b) => b.weight - a.weight)[0];

  if (groundingSig) {
    const seriesId = String(groundingSig.metadata?.series_id ?? "");
    const metricName =
      METRIC_NAMES[seriesId] ??
      String(groundingSig.metadata?.name ?? groundingSig.sourceName);

    primaryGroundingMetric = {
      source: groundingSig.sourceName,
      name: metricName,
      value: groundingSig.currentValue,
      formatted: formatMetric(
        groundingSig.currentValue,
        groundingSig.sourceFamily,
      ),
      delta: groundingSig.delta,
      deltaFormatted:
        groundingSig.delta !== null && Math.abs(groundingSig.delta) > 0.001
          ? formatDelta(groundingSig.delta, groundingSig.sourceFamily)
          : null,
    };
  }

  // Grounding alignment (question-aware)
  const groundingInterpretation = computeGroundingInterpretation(
    topicSlug,
    groundingSig?.delta ?? null,
    predictiveAvg,
  );

  let groundingAlignment: SourceComparison["groundingAlignment"] = null;
  if (groundingInterpretation === "supports_yes" || groundingInterpretation === "supports_no") {
    // Check if grounding agrees with market direction
    const marketSaysYes = (predictiveAvg ?? 0) > 0.5;
    const groundingSupportsYes = groundingInterpretation === "supports_yes";
    groundingAlignment = marketSaysYes === groundingSupportsYes ? "supports" : "contradicts";
  } else if (groundingInterpretation === "neutral") {
    groundingAlignment = "neutral";
  }

  // Competition-specific
  let competitionLeader: SourceComparison["competitionLeader"] = null;
  let competitionChallenger: SourceComparison["competitionChallenger"] = null;
  let competitionGapPp: number | null = null;

  if (questionType === "competition" && platformBreakdown.length > 0) {
    // Use the existing extractCompetitionRanking logic concept
    // but from platform breakdown data
    const sorted = [...platformBreakdown].sort(
      (a, b) => b.avgProbability - a.avgProbability,
    );
    if (sorted[0]) {
      competitionLeader = {
        name: sorted[0].topQuestion,
        pct: Math.round(sorted[0].avgProbability * 100),
        source: sorted[0].platform,
      };
    }
    if (sorted[1]) {
      competitionChallenger = {
        name: sorted[1].topQuestion,
        pct: Math.round(sorted[1].avgProbability * 100),
        source: sorted[1].platform,
      };
      competitionGapPp = competitionLeader
        ? competitionLeader.pct - Math.round(sorted[1].avgProbability * 100)
        : null;
    }
  }

  // Comparison confidence
  let comparisonConfidence: SourceComparison["comparisonConfidence"] = "low";
  const hasTwoPlusPlatforms = predictivePlatforms.length >= 2;
  const hasStrengthening = strengtheningFamilies.length > 0;
  const hasFreshSignals = signals.some((s) => s.freshness === "fresh");
  if (hasTwoPlusPlatforms && hasStrengthening && hasFreshSignals) {
    comparisonConfidence = "high";
  } else if (hasTwoPlusPlatforms || (hasStrengthening && hasFreshSignals)) {
    comparisonConfidence = "medium";
  }

  // Lead platform
  const leadPlatform =
    platformBreakdown.length > 0
      ? platformBreakdown.sort((a, b) => b.signalCount - a.signalCount)[0]
          ?.platform ?? null
      : null;

  // Freshness
  const timestamps = signals
    .map((s) => s.signalTimestamp.getTime())
    .filter((t) => !isNaN(t));
  const mostRecent = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();
  const allFresh = signals.every((s) => s.freshness === "fresh");
  const someStale = signals.some(
    (s) => s.freshness === "stale" || s.freshness === "dead",
  );
  const freshnessDescription = allFresh
    ? "All signals fresh"
    : someStale
      ? "Some signals are aging"
      : "Signals are recent";

  return {
    predictivePlatforms,
    strengtheningFamilies,
    predictiveAvgProbability: predictiveAvg,
    predictiveMinProbability: predictiveMin,
    predictiveMaxProbability: predictiveMax,
    predictiveSpreadPp: spreadPp,
    platformBreakdown,
    primaryGroundingMetric,
    groundingAlignment,
    groundingInterpretation,
    agreementState,
    competitionLeader,
    competitionChallenger,
    competitionGapPp,
    comparisonConfidence,
    leadPlatform,
    mostRecentSignal: mostRecent,
    freshnessDescription,
  };
}

// ── Grounding interpretation (question-aware) ──────────────────────────

function computeGroundingInterpretation(
  topicSlug: string,
  groundingDelta: number | null,
  marketProbability: number | null,
): "supports_yes" | "supports_no" | "neutral" | null {
  if (groundingDelta === null || marketProbability === null) return null;
  if (Math.abs(groundingDelta) < 0.001) return "neutral";

  const meaning = GROUNDING_DIRECTION[topicSlug] ?? "ambiguous";
  if (meaning === "ambiguous") return "neutral";

  const groundingSaysYes =
    (meaning === "up_means_yes" && groundingDelta > 0) ||
    (meaning === "up_means_no" && groundingDelta < 0);

  return groundingSaysYes ? "supports_yes" : "supports_no";
}

// ── Expert line from comparison ────────────────────────────────────────

const PLATFORM_DISPLAY: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  metaculus: "Metaculus",
  manifold: "Manifold",
  coingecko: "CoinGecko",
  fred: "FRED",
  bls: "BLS",
  congress_gov: "Congress",
};

export function expertLineFromComparison(
  c: SourceComparison,
): string | null {
  if (c.predictivePlatforms.length < 2 || c.predictiveAvgProbability === null) {
    return null;
  }

  const pct = Math.round(c.predictiveAvgProbability * 100);

  if (c.agreementState === "consensus") {
    const platforms = c.predictivePlatforms
      .map((p) => PLATFORM_DISPLAY[p] ?? p)
      .join(" and ");
    const grounding =
      c.groundingAlignment === "supports"
        ? " Official data confirms."
        : c.groundingAlignment === "contradicts"
          ? " Official data disagrees."
          : "";
    return `${platforms} agree at ~${pct}%.${grounding}`;
  }

  if (c.agreementState === "sharp_divergence" && c.platformBreakdown.length >= 2) {
    const sorted = [...c.platformBreakdown].sort(
      (a, b) => b.avgProbability - a.avgProbability,
    );
    const high = sorted[0];
    const low = sorted[sorted.length - 1];
    if (high && low) {
      return `${PLATFORM_DISPLAY[high.platform] ?? high.platform} says ${Math.round(high.avgProbability * 100)}%, ${PLATFORM_DISPLAY[low.platform] ?? low.platform} says ${Math.round(low.avgProbability * 100)}%.`;
    }
  }

  if (c.agreementState === "mild_divergence") {
    const platforms = c.predictivePlatforms
      .map((p) => PLATFORM_DISPLAY[p] ?? p)
      .join(" and ");
    return `${platforms} lean the same way at ~${pct}%, with some spread.`;
  }

  return null;
}
