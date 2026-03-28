// Rich signal card — shows metadata context, not just raw numbers
// Each source family gets semantic labels extracted from metadata

const HUMAN_SOURCE_NAMES: Record<string, string> = {
  fred: "Federal Reserve Data",
  bls: "Labor Statistics",
  eia: "Energy Data",
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  metaculus: "Metaculus",
  manifold: "Manifold Markets",
  coingecko: "CoinGecko",
  usgs_earthquakes: "US Geological Survey",
  noaa_nws: "Weather Service",
  congress_gov: "US Congress",
  polyrouter: "Market Consensus",
  the_odds_api: "Bookmaker Odds",
  metaforecast: "Forecaster Consensus",
  espn: "ESPN",
  defillama: "DeFi Llama",
};

interface SignalData {
  source_name: string;
  source_family: string;
  signal_type: string;
  current_value: number;
  previous_value: number | null;
  delta: number | null;
  direction: string;
  freshness: string;
  weight: number;
  metadata: Record<string, unknown> | null;
}

interface SignalCardProps {
  signal: SignalData;
  className?: string;
}

// Source family display config — colored dots, no emojis
const FAMILY_CONFIG: Record<string, { label: string; dotColor: string; accentClass: string; darkAccent: string }> = {
  macro_official: { label: "Official Data", dotColor: "bg-navy dark:bg-[#00DAF3]", accentClass: "border-navy/20", darkAccent: "dark:border-[#00DAF3]/20" },
  political_official: { label: "Legislative", dotColor: "bg-navy dark:bg-[#00DAF3]", accentClass: "border-navy/20", darkAccent: "dark:border-[#00DAF3]/20" },
  prediction_market: { label: "Market Signal", dotColor: "bg-positive dark:bg-[#4EDEA3]", accentClass: "border-positive/20", darkAccent: "dark:border-[#4EDEA3]/20" },
  forecasting: { label: "Forecast", dotColor: "bg-warning", accentClass: "border-warning/20", darkAccent: "dark:border-warning/20" },
  hazard_weather: { label: "Hazard Alert", dotColor: "bg-destructive", accentClass: "border-destructive/20", darkAccent: "dark:border-destructive/20" },
  crypto_market: { label: "Crypto Data", dotColor: "bg-warning dark:bg-[#00DAF3]", accentClass: "border-warning/20", darkAccent: "dark:border-[#00DAF3]/20" },
  news_evidence: { label: "News", dotColor: "bg-navy dark:bg-[#00DAF3]", accentClass: "border-navy/20", darkAccent: "dark:border-[#00DAF3]/20" },
  sports_odds: { label: "Bookmaker Odds", dotColor: "bg-emerald-500 dark:bg-emerald-400", accentClass: "border-emerald-500/20", darkAccent: "dark:border-emerald-400/20" },
  defi_signal: { label: "DeFi Data", dotColor: "bg-violet-500 dark:bg-violet-400", accentClass: "border-violet-500/20", darkAccent: "dark:border-violet-400/20" },
  humanitarian_conflict: { label: "Humanitarian", dotColor: "bg-red-500 dark:bg-red-400", accentClass: "border-red-500/20", darkAccent: "dark:border-red-400/20" },
  reference_entity: { label: "Reference", dotColor: "bg-muted-foreground", accentClass: "border-navy/20", darkAccent: "dark:border-[#00DAF3]/20" },
};

const DEFAULT_CONFIG = { label: "Signal", dotColor: "bg-muted-foreground", accentClass: "border-navy/20", darkAccent: "dark:border-[#00DAF3]/20" };

// Series labels for macro data
const SERIES_LABELS: Record<string, string> = {
  MORTGAGE30US: "30-Year Fixed Mortgage",
  CPIAUCSL: "Consumer Price Index",
  UNRATE: "Unemployment Rate",
  FEDFUNDS: "Federal Funds Rate",
  DGS10: "10-Year Treasury",
  GDP: "Gross Domestic Product",
  CES0000000001: "Nonfarm Payrolls",
  LNS14000000: "Unemployment Rate",
  "CUSR0000SA0": "CPI-U (Seasonally Adjusted)",
  "CUUR0000SA0": "CPI-U (Unadjusted)",
  "PET.RWTC.W": "WTI Crude Oil",
};

function formatValue(value: number, signalType: string, sourceFamily: string): string {
  if (signalType === "market_probability" || signalType === "forecast_probability") {
    return `${(value * 100).toFixed(0)}% Yes`;
  }
  if (signalType === "asset_price") {
    return value >= 1 ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `$${value.toFixed(4)}`;
  }
  if (sourceFamily === "macro_official") {
    return value > 1000 ? value.toLocaleString("en-US") : `${value.toFixed(1)}%`;
  }
  if (signalType === "earthquake_magnitude") {
    return `M${value.toFixed(1)}`;
  }
  if (signalType === "weather_severity") {
    const levels = ["", "Minor", "Moderate", "Severe", "Extreme"];
    return levels[Math.min(Math.round(value), 4)] ?? `Level ${value}`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDelta(delta: number, signalType: string): string {
  const sign = delta > 0 ? "+" : "";
  if (signalType === "market_probability" || signalType === "forecast_probability") {
    return `${sign}${(delta * 100).toFixed(1)}pp`;
  }
  if (signalType === "asset_price") {
    return `${sign}$${Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return `${sign}${delta.toFixed(2)}`;
}

function getSemanticLabel(signal: SignalData): string {
  const meta = signal.metadata ?? {};

  if (signal.source_family === "prediction_market") {
    return String(meta.question ?? meta.slug ?? signal.source_name);
  }
  if (signal.source_family === "crypto_market") {
    const name = String(meta.name ?? "");
    const symbol = String(meta.symbol ?? "").toUpperCase();
    return name ? `${name} (${symbol})` : signal.source_name;
  }
  if (signal.source_family === "macro_official") {
    const seriesId = String(meta.series_id ?? "");
    return SERIES_LABELS[seriesId] ?? seriesId ?? signal.source_name;
  }
  if (signal.source_family === "political_official") {
    return String(meta.title ?? signal.source_name).slice(0, 80);
  }
  if (signal.source_family === "hazard_weather") {
    const place = String(meta.place ?? meta.headline ?? "");
    const eventType = String(meta.event_type ?? "");
    return place ? `${eventType ? eventType + " — " : ""}${place}`.slice(0, 80) : signal.source_name;
  }
  return signal.source_name;
}

function getSubtext(signal: SignalData): string | null {
  const meta = signal.metadata ?? {};

  if (signal.source_family === "prediction_market") {
    const vol = meta.volume_24hr;
    if (typeof vol === "number") {
      return `Volume: $${vol >= 1000 ? `${(vol / 1000).toFixed(0)}K` : vol.toFixed(0)} (24h)`;
    }
  }
  if (signal.source_family === "crypto_market") {
    const mc = meta.market_cap;
    if (typeof mc === "number") {
      const tier = mc >= 1e11 ? "Large Cap" : mc >= 1e9 ? "Mid Cap" : "Small Cap";
      return `Market cap: $${(mc / 1e9).toFixed(1)}B (${tier})`;
    }
  }
  if (signal.source_family === "political_official") {
    const action = meta.latest_action;
    return action ? String(action).slice(0, 100) : null;
  }
  if (signal.source_family === "hazard_weather") {
    const sig = meta.significance;
    if (typeof sig === "number") return `Significance: ${sig}`;
  }
  return null;
}

// Translate raw value into human meaning — what does this number tell us?
function getSignalMeaning(signal: SignalData): string | null {
  const v = signal.current_value;
  const delta = signal.delta;

  if (signal.signal_type === "market_probability" || signal.signal_type === "forecast_probability") {
    const pct = Math.round(v * 100);
    if (pct >= 70) return `${pct}% of forecasters think yes`;
    if (pct >= 50) return `Slight lean toward yes at ${pct}%`;
    if (pct >= 30) return `Leaning no at ${pct}%`;
    return `Only ${pct}% think yes — unlikely`;
  }

  if (signal.signal_type === "asset_price") {
    if (delta !== null && Math.abs(delta) > 0) {
      const pct = signal.previous_value ? ((delta / Number(signal.previous_value)) * 100).toFixed(1) : "?";
      return delta > 0 ? `Up ${pct}% recently` : `Down ${Math.abs(Number(pct))}% recently`;
    }
    return "Holding steady";
  }

  if (signal.signal_type === "earthquake_magnitude") {
    if (v >= 6) return "Major event — significant potential for damage";
    if (v >= 5) return "Moderate event — noticeable shaking likely";
    if (v >= 4) return "Light event — felt but unlikely to cause damage";
    return "Minor event — barely noticeable";
  }

  if (signal.signal_type === "weather_severity") {
    const levels = ["", "Minor conditions", "Moderate conditions", "Severe — take precautions", "Extreme — stay alert"];
    return levels[Math.min(Math.round(v), 4)] ?? null;
  }

  if (signal.source_family === "macro_official") {
    if (delta !== null && Math.abs(delta) > 0.01) {
      return delta > 0 ? "Edged higher recently" : "Moved lower recently";
    }
    return "Holding steady — no significant change";
  }

  return null;
}

export function SignalCard({ signal, className }: SignalCardProps) {
  const config = FAMILY_CONFIG[signal.source_family] ?? DEFAULT_CONFIG;
  const semanticLabel = getSemanticLabel(signal);
  const subtext = getSubtext(signal);
  const meaning = getSignalMeaning(signal);
  const formattedValue = formatValue(signal.current_value, signal.signal_type, signal.source_family);
  const formattedDelta = signal.delta !== null ? formatDelta(signal.delta, signal.signal_type) : null;

  const deltaColor = signal.direction === "up" ? "text-positive dark:text-[#4EDEA3]"
    : signal.direction === "down" ? "text-destructive"
    : "text-muted-foreground";

  const isHighWeight = signal.weight >= 0.7;

  return (
    <div className={`rounded-2xl p-4 border-l-[3px] ${config.accentClass} ${config.darkAccent}
      bg-card card-shadow-rich
      dark:border dark:border-white/5 dark:border-l-[3px]
      animate-fade-in ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Source label */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${config.dotColor}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {HUMAN_SOURCE_NAMES[signal.source_name] ?? signal.source_name}
            </span>
          </div>

          {/* Semantic label */}
          <p className={`${isHighWeight ? "text-sm font-semibold" : "text-xs font-medium"} text-foreground leading-snug`}>
            {semanticLabel}
          </p>

          {/* Signal meaning — what this number tells us */}
          {meaning && (
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">{meaning}</p>
          )}

          {/* Subtext (metadata context) */}
          {subtext && !meaning && (
            <p className="text-[11px] text-muted-foreground mt-1">{subtext}</p>
          )}
        </div>

        {/* Value + delta — visually prominent */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span className={`${isHighWeight ? "text-xl" : "text-base"} font-black font-mono text-foreground dark:text-primary`}>
            {formattedValue}
          </span>
          {formattedDelta && (
            <span className={`text-xs font-mono font-bold mt-0.5 ${deltaColor}`}>
              {formattedDelta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Grouped signal section
interface SignalGroupProps {
  familyKey: string;
  signals: SignalData[];
}

function getFamilySummary(familyKey: string, signals: SignalData[]): string | null {
  if (familyKey === "prediction_market" || familyKey === "forecast_aggregator") {
    const probSignals = signals.filter((s) => s.signal_type === "market_probability" || s.signal_type === "forecast_probability");
    if (probSignals.length > 0) {
      const avg = probSignals.reduce((sum, s) => sum + s.current_value, 0) / probSignals.length;
      return `${probSignals.length} ${probSignals.length === 1 ? "market" : "markets"} tracked, consensus at ${Math.round(avg * 100)}%`;
    }
  }
  if (familyKey === "macro_official") {
    const dirs = signals.map((s) => s.direction);
    const allStable = dirs.every((d) => d === "stable");
    return allStable
      ? `${signals.length} indicators tracked, all holding steady`
      : `${signals.length} indicators tracked, some showing movement`;
  }
  if (familyKey === "hazard_weather") {
    if (signals[0]?.signal_type === "earthquake_magnitude") {
      const strongest = Math.max(...signals.map((s) => s.current_value));
      return `${signals.length} earthquakes recorded, strongest M${strongest.toFixed(1)}`;
    }
    return `${signals.length} weather alerts active`;
  }
  if (familyKey === "crypto_market") {
    return `${signals.length} ${signals.length === 1 ? "asset" : "assets"} tracked`;
  }
  return null;
}

export function SignalGroup({ familyKey, signals }: SignalGroupProps) {
  const config = FAMILY_CONFIG[familyKey] ?? DEFAULT_CONFIG;

  // Filter out uninformative signals (0% probability markets = no information)
  const isMarket = familyKey === "prediction_market" || familyKey === "forecasting";
  const filtered = isMarket
    ? signals.filter((s) => s.current_value > 0.001)
    : signals;
  // If ALL signals are 0%, show original list rather than a blank section
  const meaningful = filtered.length > 0 ? filtered : signals;

  // Sort: markets by probability descending (most informative first), others by weight
  const sorted = isMarket
    ? [...meaningful].sort((a, b) => b.current_value - a.current_value)
    : [...meaningful].sort((a, b) => b.weight - a.weight);

  const summary = getFamilySummary(familyKey, sorted);

  // Soft cap: show top 5 for markets (quality over quantity), 8 for hazard
  const isHazardDump = familyKey === "hazard_weather" && sorted.length > 8;
  const cap = isMarket ? 5 : isHazardDump ? 8 : sorted.length;
  const displaySignals = sorted.slice(0, cap);
  const hiddenCount = sorted.length - displaySignals.length;
  const filteredCount = filtered.length > 0 ? signals.length - filtered.length : 0;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {config.label}
        </h3>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">{signals.length} {signals.length === 1 ? "signal" : "signals"}</span>
      </div>
      {summary && (
        <p className="text-xs text-muted-foreground mb-3 ml-4">{summary}</p>
      )}
      <div className="flex flex-col gap-2">
        {displaySignals.map((s, i) => (
          <SignalCard
            key={`${s.source_name}-${i}`}
            signal={s}
            className={i === 0 ? "" : `delay-${Math.min(i * 50, 300)}`}
          />
        ))}
        {(hiddenCount > 0 || filteredCount > 0) && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {hiddenCount > 0 && `${hiddenCount} more ${hiddenCount === 1 ? "signal" : "signals"}`}
            {hiddenCount > 0 && filteredCount > 0 && " | "}
            {filteredCount > 0 && `${filteredCount} low-probability markets hidden`}
          </p>
        )}
      </div>
    </div>
  );
}

// ── COMPETITION LEADERBOARD ──
// For "who will win?" topics: ranked list instead of individual signal cards

/**
 * Extract a clean entity name from a prediction market question.
 * Handles sports ("Will X win"), tech ("Will X have the best"), and other patterns.
 * Returns null if the question doesn't match any competition pattern.
 */
/** Strip leading articles ("the", "a", "an") from entity names */
function stripArticle(name: string): string {
  return name.replace(/^(the|a|an)\s+/i, "");
}

function extractCompetitionEntity(question: string): string | null {
  // "Will X win..."
  const winMatch = question.match(/^Will (.+?) win\b/i);
  if (winMatch) return stripArticle(winMatch[1].trim());

  // "Will X have the best..."
  const bestMatch = question.match(/^Will (.+?) have the best\b/i);
  if (bestMatch) return stripArticle(bestMatch[1].trim());

  // "Will X lead..." / "Will X be the..."
  const leadMatch = question.match(/^Will (.+?) (?:lead|be the|dominate|finish)\b/i);
  if (leadMatch) return stripArticle(leadMatch[1].trim());

  // "X to win..." (odds-style)
  const toWinMatch = question.match(/^(.+?) to win\b/i);
  if (toWinMatch) return stripArticle(toWinMatch[1].trim());

  // Generic "Will [subject] [verb]"
  const genericWill = question.match(/^Will (.+?) (?:beat|reach|hit|score|qualify|advance|place|rank)\b/i);
  if (genericWill) return stripArticle(genericWill[1].trim());

  return null;
}

function CompetitionLeaderboard({ signals }: { signals: SignalData[] }) {
  // Extract contenders from market signals, ranked by probability
  const contenders = signals
    .filter((s) => s.source_family === "prediction_market" || s.source_family === "forecasting")
    .map((s) => {
      const q = String((s.metadata as Record<string, unknown>)?.question ?? "");
      const name = extractCompetitionEntity(q);
      // Skip signals where we can't extract a clean entity name
      if (!name) return null;
      const pct = Math.round(s.current_value * 100);
      return { name, pct, question: q };
    })
    .filter((c): c is { name: string; pct: number; question: string } => c !== null && c.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  // Deduplicate by name (in case multiple markets for same contender)
  const seen = new Set<string>();
  const unique = contenders.filter((c) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-positive dark:bg-[#4EDEA3]" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Market Rankings
        </h3>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">{signals.length} markets tracked</span>
      </div>
      <div className="space-y-1">
        {unique.slice(0, 10).map((c, i) => (
          <div
            key={c.name}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-card border border-border/30"
          >
            <span className="text-sm font-black text-muted-foreground w-6 tabular-nums">{i + 1}.</span>
            <span className="text-sm font-semibold flex-1">{c.name}</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-border/30 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${c.pct}%` }} />
              </div>
              <span className="text-sm font-bold font-mono tabular-nums w-10 text-right">{c.pct}%</span>
            </div>
          </div>
        ))}
        {unique.length > 10 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            and {unique.length - 10} more contenders
          </p>
        )}
      </div>
    </div>
  );
}

// ── EVIDENCE WALL ──
// The star of the page. All signals, always visible, grouped by source.

interface EvidenceWallProps {
  signals: SignalData[];
  isCompetition?: boolean;
}

export function EvidenceWall({ signals, isCompetition }: EvidenceWallProps) {
  // Group by source family
  const byFamily = new Map<string, SignalData[]>();
  for (const s of signals) {
    const fam = s.source_family ?? "unknown";
    const arr = byFamily.get(fam) ?? [];
    arr.push(s);
    byFamily.set(fam, arr);
  }

  const totalSignals = signals.length;
  const totalSources = byFamily.size;

  if (totalSignals === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No signals available yet. We are gathering data from prediction markets and other sources.</p>
      </div>
    );
  }

  // For competition topics: show a ranked leaderboard for market signals
  const marketFamilies = ["prediction_market", "forecasting"];
  const nonMarketFamilies = [...byFamily.entries()].filter(([k]) => !marketFamilies.includes(k));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          What the signals say
        </h2>
        <span className="text-xs text-muted-foreground">
          {totalSignals} {totalSignals === 1 ? "signal" : "signals"} from {totalSources} {totalSources === 1 ? "source" : "sources"}
        </span>
      </div>
      {isCompetition ? (
        <>
          <CompetitionLeaderboard signals={signals} />
          {nonMarketFamilies.map(([familyKey, familySignals]) => (
            <SignalGroup key={familyKey} familyKey={familyKey} signals={familySignals} />
          ))}
        </>
      ) : (
        [...byFamily.entries()].map(([familyKey, familySignals]) => (
          <SignalGroup key={familyKey} familyKey={familyKey} signals={familySignals} />
        ))
      )}
    </div>
  );
}
