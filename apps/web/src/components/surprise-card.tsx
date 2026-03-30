/**
 * SurpriseCard -- "Biggest market split right now"
 *
 * Highlights the question where prediction platforms disagree most.
 * Sharp, opinionated copy designed to be screenshot-worthy.
 * Hidden if no page has meaningful spread (> 10pp).
 */

import Link from "next/link";

interface SurpriseData {
  slug: string;
  questionText: string;
  spreadPp: number;
  platform1: { name: string; pct: number };
  platform2: { name: string; pct: number };
  agreementState: string;
}

interface SurpriseCardProps {
  data: SurpriseData | null;
}

const PLATFORM_NAMES: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  metaculus: "Metaculus",
  manifold: "Manifold",
};

export function SurpriseCard({ data }: SurpriseCardProps) {
  if (!data || data.spreadPp < 10) return null;

  const editorialLine = data.spreadPp >= 25
    ? "That is a wide gap. These platforms are reading the situation very differently."
    : data.spreadPp >= 15
      ? "A meaningful disagreement. Worth watching which side moves."
      : "Not yet settled. Platforms see this differently.";

  return (
    <section className="pb-6 animate-fade-in">
      <Link href={`/questions/${data.slug}`}>
        <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-amber-500/10 via-card dark:via-[#131B2E] to-card dark:to-[#131B2E] border border-amber-500/20 dark:border-amber-500/10 hover:border-amber-500/30 transition-colors group">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Biggest market split
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-foreground leading-snug mb-4 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {data.questionText}
          </h3>

          <div className="flex items-center gap-4 sm:gap-6 mb-3">
            <div className="flex-1">
              <span className="text-xs text-muted-foreground block mb-1">
                {PLATFORM_NAMES[data.platform1.name] ?? data.platform1.name}
              </span>
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-foreground">
                {data.platform1.pct}%
              </span>
            </div>
            <div className="text-muted-foreground/40 text-xs font-bold">vs</div>
            <div className="flex-1 text-right">
              <span className="text-xs text-muted-foreground block mb-1">
                {PLATFORM_NAMES[data.platform2.name] ?? data.platform2.name}
              </span>
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-foreground">
                {data.platform2.pct}%
              </span>
            </div>
          </div>

          <p className="text-sm text-amber-700 dark:text-amber-300/80 font-medium">
            {data.spreadPp}pp gap. {editorialLine}
          </p>
        </div>
      </Link>
    </section>
  );
}

/**
 * Find the biggest market split from featured card data.
 * Called in the homepage server component.
 */
export function findBiggestSplit(
  cards: Array<{
    slug: string;
    question_text: string;
    synthesis_json: Record<string, unknown> | null;
  }>,
): SurpriseData | null {
  let best: SurpriseData | null = null;
  let bestSpread = 0;

  for (const card of cards) {
    const synth = card.synthesis_json;
    if (!synth) continue;

    const spreadPp = Number(synth.predictiveSpreadPp ?? 0);
    if (spreadPp <= bestSpread) continue;

    const breakdown = synth.platformBreakdown as Array<{
      platform: string;
      avgProbability: number;
    }> | undefined;

    if (!breakdown || breakdown.length < 2) continue;

    const sorted = [...breakdown].sort((a, b) => b.avgProbability - a.avgProbability);
    const p1 = sorted[0];
    const p2 = sorted[sorted.length - 1];
    if (!p1 || !p2) continue;

    best = {
      slug: card.slug,
      questionText: card.question_text,
      spreadPp,
      platform1: { name: p1.platform, pct: Math.round(p1.avgProbability * 100) },
      platform2: { name: p2.platform, pct: Math.round(p2.avgProbability * 100) },
      agreementState: String(synth.agreementState ?? ""),
    };
    bestSpread = spreadPp;
  }

  return best;
}
