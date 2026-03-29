import type { SourceComparison } from "@/components/templates/types";

const PLATFORM_NAMES: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  metaculus: "Metaculus",
  manifold: "Manifold",
  coingecko: "CoinGecko",
  fred: "FRED",
  bls: "BLS",
  eia: "EIA",
  congress_gov: "Congress",
  the_odds_api: "Bookmakers",
};

interface SourceComparisonBlockProps {
  comparison: SourceComparison;
  accentClass: string;
}

export function SourceComparisonBlock({ comparison, accentClass }: SourceComparisonBlockProps) {
  if (comparison.platformBreakdown.length < 2 && !comparison.primaryGroundingMetric) {
    return null;
  }

  return (
    <section className="mb-10 animate-fade-in">
      <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${accentClass} mb-3`}>
        What the sources say
      </h2>
      <div className="rounded-2xl bg-card dark:bg-[#131B2E] card-shadow-rich dark:border dark:border-white/5 p-5 space-y-4">

        {/* Platform breakdown */}
        {comparison.platformBreakdown.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Prediction markets</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {comparison.platformBreakdown.map((p) => (
                <div key={p.platform} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 dark:bg-white/5">
                  <div>
                    <span className="text-sm font-bold text-foreground">{PLATFORM_NAMES[p.platform] ?? p.platform}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{p.signalCount} signals</span>
                  </div>
                  <span className="text-lg font-black font-mono text-primary">{Math.round(p.avgProbability * 100)}%</span>
                </div>
              ))}
            </div>
            {comparison.predictiveSpreadPp !== null && comparison.predictiveSpreadPp > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Spread: {comparison.predictiveSpreadPp} percentage points between platforms
              </p>
            )}
          </div>
        )}

        {/* Grounding metric */}
        {comparison.primaryGroundingMetric && (
          <div>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2">Official data</h3>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 dark:bg-white/5">
              <div>
                <span className="text-sm font-bold text-foreground">{comparison.primaryGroundingMetric.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2">({comparison.primaryGroundingMetric.source})</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black font-mono text-foreground">{comparison.primaryGroundingMetric.formatted}</span>
                {comparison.primaryGroundingMetric.deltaFormatted && (
                  <span className={`text-xs font-bold ml-2 ${
                    (comparison.primaryGroundingMetric.delta ?? 0) > 0 ? "text-positive dark:text-[#4EDEA3]" : "text-destructive"
                  }`}>
                    {comparison.primaryGroundingMetric.deltaFormatted}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Agreement + grounding alignment */}
        <div className="pt-3 border-t border-border/10 dark:border-white/5 space-y-1">
          {comparison.agreementState === "consensus" && (
            <p className="text-sm text-foreground">Markets are broadly aligned.</p>
          )}
          {comparison.agreementState === "mild_divergence" && (
            <p className="text-sm text-foreground">Markets lean the same way, but not tightly.</p>
          )}
          {comparison.agreementState === "sharp_divergence" && (
            <p className="text-sm font-semibold text-warning">Markets are split.</p>
          )}
          {comparison.agreementState === "insufficient_data" && comparison.comparisonConfidence === "low" && (
            <p className="text-sm text-muted-foreground">Early signal -- limited data so far.</p>
          )}

          {comparison.groundingAlignment === "supports" && (
            <p className="text-sm text-positive dark:text-[#4EDEA3]">Official data backs the market lean.</p>
          )}
          {comparison.groundingAlignment === "contradicts" && (
            <p className="text-sm text-destructive">Official data points the other way.</p>
          )}
          {comparison.groundingAlignment === "neutral" && comparison.primaryGroundingMetric && (
            <p className="text-sm text-muted-foreground">Official data is neutral -- no clear signal either way.</p>
          )}
        </div>
      </div>
    </section>
  );
}
