import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

// Category accent colors (from DESIGN.md)
const CAT_ACCENT: Record<string, { label: string; text: string; border: string }> = {
  macro:       { label: "Finance",      text: "text-blue-400",    border: "border-blue-500/30" },
  crypto:      { label: "Crypto",       text: "text-amber-400",   border: "border-amber-500/30" },
  politics:    { label: "Politics",     text: "text-indigo-400",  border: "border-indigo-500/30" },
  geopolitics: { label: "Geopolitics",  text: "text-red-400",     border: "border-red-500/30" },
  sports:      { label: "Sports",       text: "text-emerald-400", border: "border-emerald-500/30" },
  tech:        { label: "Tech",         text: "text-violet-400",  border: "border-violet-500/30" },
  entertainment: { label: "Entertainment", text: "text-pink-400", border: "border-pink-500/30" },
  disasters:   { label: "Weather",      text: "text-orange-400",  border: "border-orange-500/30" },
};
const DEFAULT_ACCENT = { label: "Signal", text: "text-muted-foreground", border: "border-border/30" };

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface FeaturedCard {
  questionText: string;
  slug: string;
  category: string | null;
  direction: string | null;
  confidence: number | null;
  oneLiner: string | null;
  expertLine: string | null;
  publishedAt: string | null;
  platformCount: number;
  renderingMode: string | null;
}

export default async function HomePage() {
  const supabase = await createClient();

  // Load featured questions with their card data
  const { data: questionRows } = await db(supabase)
    .from("questions")
    .select("question_text, slug, category, primary_topic_id, sort_order")
    .eq("status", "published")
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .limit(8);

  const questions = (questionRows ?? []) as Array<{
    question_text: string;
    slug: string;
    category: string | null;
    primary_topic_id: string;
    sort_order: number;
  }>;

  // Load card data for these topics
  const topicIds = questions.map((q) => q.primary_topic_id).filter(Boolean);
  const { data: cardRows } = topicIds.length > 0
    ? await db(supabase)
        .from("public_topic_cards")
        .select("topic_id, direction, confidence, one_liner, expert_line, snapshot_published_at, platform_count, rendering_mode")
        .in("topic_id", topicIds)
    : { data: [] };

  const cardMap = new Map(
    ((cardRows ?? []) as Array<{
      topic_id: string;
      direction: string | null;
      confidence: number | null;
      one_liner: string | null;
      expert_line: string | null;
      snapshot_published_at: string | null;
      platform_count: number;
      rendering_mode: string | null;
    }>).map((c) => [c.topic_id, c]),
  );

  // Build featured cards (skip blocked pages)
  const cards: FeaturedCard[] = questions
    .map((q) => {
      const card = cardMap.get(q.primary_topic_id);
      if (!card) return null;
      if (card.rendering_mode === "blocked") return null;
      return {
        questionText: q.question_text,
        slug: q.slug,
        category: q.category,
        direction: card.direction,
        confidence: card.confidence,
        oneLiner: card.one_liner,
        expertLine: card.expert_line,
        publishedAt: card.snapshot_published_at,
        platformCount: card.platform_count ?? 0,
        renderingMode: card.rendering_mode,
      };
    })
    .filter((c): c is FeaturedCard => c !== null);

  return (
    <div className="mx-auto max-w-[640px] px-4 sm:px-6 py-8">
      {/* ── Header ── */}
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          What is the world saying?
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Prediction markets, official data, and forecasters. Synthesized into answers.
        </p>
      </header>

      {/* ── Featured cards ── */}
      {cards.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">We are setting up. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const accent = CAT_ACCENT[card.category ?? ""] ?? DEFAULT_ACCENT;
            const pct = card.confidence !== null ? Math.round(card.confidence * 100) : null;
            const description = card.expertLine ?? card.oneLiner ?? null;

            return (
              <Link
                key={card.slug}
                href={`/questions/${card.slug}`}
                className={`block p-4 sm:p-5 rounded-xl bg-card border ${accent.border} hover:border-border/60 transition-colors`}
              >
                {/* Category + time */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${accent.text}`}>
                    {accent.label}
                  </span>
                  {card.publishedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(card.publishedAt)}
                    </span>
                  )}
                </div>

                {/* Question text */}
                <h2 className="text-base sm:text-lg font-semibold leading-snug mb-2">
                  {card.questionText}
                </h2>

                {/* Key number + bar */}
                {pct !== null && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        {card.direction === "up" ? "Leaning yes" : card.direction === "down" ? "Leaning no" : "Mixed signals"}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-[#00DAF3]">
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#00DAF3]/70"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Description */}
                {description && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                    {description}
                  </p>
                )}

                {/* Platform count */}
                {card.platformCount > 0 && (
                  <div className="mt-2 text-[10px] text-muted-foreground/60">
                    {card.platformCount} {card.platformCount === 1 ? "platform" : "platforms"}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="mt-12 pt-6 border-t border-border/20 text-center">
        <p className="text-xs text-muted-foreground">
          QUESERA -- Que Sera, Sera
        </p>
      </footer>
    </div>
  );
}
