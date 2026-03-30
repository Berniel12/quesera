/**
 * BriefingStrip -- "Since yesterday" change summary
 *
 * Renders 3-5 bullets of real changes across featured questions.
 * Hidden entirely if nothing changed. Replaces the old "What Moved" lane.
 */

import Link from "next/link";

interface BriefingItem {
  slug: string;
  questionText: string;
  changeLine: string;
  direction: string;
}

interface BriefingStripProps {
  items: BriefingItem[];
}

export function BriefingStrip({ items }: BriefingStripProps) {
  if (items.length === 0) return null;

  return (
    <section className="pb-6 animate-fade-in">
      <div className="rounded-2xl p-5 bg-card dark:bg-[#131B2E] border border-border/20 dark:border-white/5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          What changed
        </h2>
        <div className="space-y-2.5">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={`/questions/${item.slug}`}
              className="flex items-start gap-2.5 group"
            >
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                item.direction === "up" ? "bg-positive dark:bg-[#4EDEA3]" :
                item.direction === "down" ? "bg-destructive" : "bg-muted-foreground"
              }`} />
              <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors leading-snug">
                {item.changeLine}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Build briefing items from featured card data.
 * Called in the homepage server component.
 *
 * Prefers structured deltas (direction + competition leader changes)
 * over static prose (expert_line, one_liner). Structured deltas feel
 * more like "what changed" than a general description.
 */
export function buildBriefingItems(
  cards: Array<{
    slug: string;
    question_text: string;
    direction: string | null;
    expert_line: string | null;
    one_liner: string | null;
    snapshot_published_at: string | null;
    competition_leader: string | null;
    competition_leader_pct: number | null;
    confidence: number | null;
  }>,
): BriefingItem[] {
  const items: BriefingItem[] = [];

  for (const card of cards) {
    if (!card.snapshot_published_at) continue;

    // Must be from the last 48 hours
    const ageH = (Date.now() - new Date(card.snapshot_published_at).getTime()) / 3600000;
    if (ageH > 48) continue;

    // Build change line -- prefer structured delta over static prose
    let changeLine: string | null = null;

    // Competition cards: "[Leader] leads [question] at [pct]%"
    if (card.competition_leader && card.competition_leader_pct) {
      const pct = Math.round(card.competition_leader_pct);
      changeLine = `${card.competition_leader} leads at ${pct}% -- ${card.question_text.replace("Who will win the ", "").replace("?", "")}`;
    }
    // Cards with active direction: construct from direction + confidence
    else if (card.direction === "up" || card.direction === "down") {
      const pct = card.confidence !== null ? Math.round(card.confidence * 100) : null;
      const verb = card.direction === "up" ? "trending up" : "trending down";
      changeLine = pct !== null
        ? `${card.question_text.replace("?", "")} -- ${verb} at ${pct}% signal strength`
        : `${card.question_text.replace("?", "")} -- ${verb}`;
    }
    // Fallback: expert_line or one_liner (static prose)
    else if (card.expert_line) {
      changeLine = card.expert_line;
    }

    if (!changeLine) continue;

    items.push({
      slug: card.slug,
      questionText: card.question_text,
      changeLine,
      direction: card.direction ?? "stable",
    });
  }

  return items.slice(0, 5);
}
