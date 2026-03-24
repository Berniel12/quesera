import { NextResponse } from "next/server";
import { createSupabaseClient } from "@signal-map/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Helper to bypass strict table typing for tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

/**
 * Auto-discover trending Polymarket questions and create topics for them.
 * Runs hourly. Fetches top markets by volume, skips ones we already track,
 * creates new topics + question wrappers for the rest.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient({ serviceRole: true });

  // 1. Fetch top trending Polymarket markets
  const polyResponse = await fetch(
    "https://gamma-api.polymarket.com/markets?limit=50&active=true&closed=false&order=volume24hr&ascending=false",
  );
  if (!polyResponse.ok) {
    return NextResponse.json({ error: "Failed to fetch Polymarket" }, { status: 502 });
  }

  const markets = (await polyResponse.json()) as Array<{
    id: number;
    conditionId?: string;
    questionID?: string;
    question: string;
    slug: string;
    volume24hr: number;
    liquidityNum?: number;
    outcomePrices: string;
    endDateIso?: string;
    endDate?: string;
    image?: string;
    featured?: boolean;
  }>;

  // Filter: only markets with real volume
  const trending = markets.filter((m) => m.volume24hr >= 5000);

  // 2. Load existing topic slugs to avoid duplicates
  const { data: existingTopics } = await supabase
    .from("topics")
    .select("slug");
  const existingSlugs = new Set(
    (existingTopics ?? []).map((t: { slug: string }) => t.slug),
  );

  // 3. Load existing question wrappers to check for duplicate questions
  const { data: existingWrappers } = await db(supabase)
    .from("question_wrappers")
    .select("question_text");
  const existingQuestions = new Set(
    (existingWrappers ?? []).map((w: { question_text: string }) =>
      w.question_text.toLowerCase().trim(),
    ),
  );

  const created: string[] = [];
  const skipped: string[] = [];

  for (const market of trending) {
    const question = market.question.trim();
    if (!question || question.length < 10) {
      skipped.push("too-short");
      continue;
    }

    // Skip if we already have this exact question
    if (existingQuestions.has(question.toLowerCase())) {
      skipped.push(question.slice(0, 40));
      continue;
    }

    // Generate slug from question
    const slug = question
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80)
      .replace(/-+$/, "");

    if (existingSlugs.has(slug)) {
      skipped.push(slug);
      continue;
    }

    // Guess category from Polymarket question text
    const category = guessCategory(question);

    // 4. Create the topic
    const { data: newTopic, error: topicError } = await supabase
      .from("topics")
      .insert({
        canonical_name: question.slice(0, 120),
        slug,
        category,
        description: `Trending on Polymarket with $${Math.round(market.volume24hr).toLocaleString()} in 24h volume.`,
        status: "active",
        is_public: true,
      })
      .select("id")
      .single();

    if (topicError || !newTopic) {
      skipped.push(`err:${slug}`);
      continue;
    }

    const topicId = (newTopic as { id: string }).id;

    // 5. Create question wrapper
    await db(supabase).from("question_wrappers").insert({
      topic_id: topicId,
      question_text: question.endsWith("?") ? question : `${question}?`,
      is_featured: true,
      sort_order: 1,
    });

    // 6. Create source item match so the topic gets scored
    // Find the polymarket source item for this market
    const externalId =
      market.conditionId ?? market.questionID ?? String(market.id);
    const { data: sourceItem } = await supabase
      .from("source_items")
      .select("id")
      .eq("source_key", "polymarket")
      .eq("external_id", externalId)
      .maybeSingle();

    if (sourceItem) {
      await db(supabase).from("source_item_topic_matches").insert({
        source_item_id: (sourceItem as { id: string }).id,
        topic_id: topicId,
        match_score: 0.9,
        match_method: "seed_map",
      });
    }

    existingSlugs.add(slug);
    existingQuestions.add(question.toLowerCase());
    created.push(question.slice(0, 60));

    // Cap at 10 new topics per run to avoid flooding
    if (created.length >= 10) break;
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    newQuestions: created,
    timestamp: new Date().toISOString(),
  });
}

function guessCategory(question: string): string {
  const q = question.toLowerCase();
  if (/bitcoin|ethereum|crypto|btc|eth|defi|token/i.test(q)) return "crypto";
  if (/stock|market|s&p|dow|nasdaq|recession|gdp|inflation|rate|mortgage|oil|gold|gas|dollar/i.test(q)) return "macro";
  if (/election|congress|senate|president|vote|midterm|supreme court|legislation|law/i.test(q)) return "politics";
  if (/war|ceasefire|invasion|conflict|nato|nuclear|sanctions|iran|ukraine|russia|china|taiwan|israel/i.test(q)) return "geopolitics";
  if (/nba|nfl|fifa|world cup|premier league|champion|ufc|f1|formula|mlb|super bowl|tennis|olympics/i.test(q)) return "sports";
  if (/hurricane|earthquake|wildfire|flood|storm|weather|tornado|tsunami|drought/i.test(q)) return "disasters";
  if (/ai |artificial intelligence|openai|gpt|robot|machine learning|tesla|spacex|apple|tiktok|google/i.test(q)) return "tech";
  if (/oscar|grammy|taylor|movie|film|album|concert|netflix|disney|marvel/i.test(q)) return "entertainment";
  return "politics"; // default fallback
}
