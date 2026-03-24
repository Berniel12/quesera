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

export function SignalGroup({ familyKey, signals }: SignalGroupProps) {
  const config = FAMILY_CONFIG[familyKey] ?? DEFAULT_CONFIG;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {config.label}
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground/60">
          {signals.length} {signals.length === 1 ? "signal" : "signals"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {signals
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 5)
          .map((s, i) => (
            <SignalCard
              key={`${s.source_name}-${i}`}
              signal={s}
              className={i === 0 ? "" : `delay-${Math.min(i * 50, 300)}`}
            />
          ))}
        {signals.length > 5 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            and {signals.length - 5} more {signals.length - 5 === 1 ? "signal" : "signals"}
          </p>
        )}
      </div>
    </div>
  );
}
