import { NextResponse } from "next/server";
import { createSupabaseClient } from "@signal-map/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueue } from "@signal-map/queue";
import { slugify } from "@/lib/slug";
import { createHash } from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

const MAX_QUESTION_LENGTH = 500;
const RATE_LIMIT_PER_MINUTE = 5;

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(request: Request) {
  const supabase = createSupabaseClient({ serviceRole: true });

  // 1. Parse + validate input
  let body: { question: string };
  try {
    body = await request.json() as { question: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawQuestion = (body.question ?? "").trim();
  if (!rawQuestion || rawQuestion.length === 0) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }
  if (rawQuestion.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question must be under ${MAX_QUESTION_LENGTH} characters` },
      { status: 400 },
    );
  }

  // 2. Rate limit (persistent, per-IP, per-minute window)
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);

  const { data: rateRow } = await db(supabase)
    .from("oracle_rate_limits")
    .select("request_count")
    .eq("ip_hash", ipHash)
    .gte("window_start", new Date(Date.now() - 60_000).toISOString())
    .order("window_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentCount = (rateRow as { request_count: number } | null)?.request_count ?? 0;
  if (currentCount >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json(
      { error: "Slow down -- try again in a minute" },
      { status: 429 },
    );
  }

  // Upsert rate limit counter
  await db(supabase).rpc("increment_rate_limit", { p_ip_hash: ipHash }).then(
    () => {},
    () => {
      // Fallback: direct upsert if RPC doesn't exist yet
      return db(supabase)
        .from("oracle_rate_limits")
        .upsert(
          { ip_hash: ipHash, window_start: new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString(), request_count: currentCount + 1 },
          { onConflict: "ip_hash,window_start" },
        );
    },
  );

  // 3. Generate slug + check for existing query (dedup)
  const slug = slugify(rawQuestion);
  if (!slug) {
    return NextResponse.json({ error: "Could not generate a valid URL from that question" }, { status: 400 });
  }

  const { data: existing } = await db(supabase)
    .from("oracle_queries")
    .select("id, question_slug")
    .eq("question_slug", slug)
    .maybeSingle();

  if (existing) {
    // Exact slug match -- increment demand counter, return existing
    // Atomic increment
    await db(supabase).rpc("increment_asked_count", { p_slug: slug }).then(
      () => {},
      () => { /* RPC not available, skip -- non-critical */ },
    );

    return NextResponse.json({ slug, existing: true });
  }

  // 4. Topic matching (web-side: keyword extraction + ilike on canonical_name + aliases)
  const STOP_WORDS = new Set([
    "will", "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "shall", "should", "would", "could",
    "may", "might", "must", "can", "to", "of", "in", "for", "on", "with", "at",
    "by", "from", "as", "into", "about", "between", "through", "during", "before",
    "after", "above", "below", "and", "but", "or", "nor", "not", "so", "yet",
    "this", "that", "these", "those", "it", "its", "i", "we", "they", "he", "she",
    "what", "which", "who", "whom", "how", "when", "where", "why",
    "there", "here", "than", "then", "if", "because", "while", "until",
    "ever", "going", "get", "go", "happen", "next", "much", "many", "more",
  ]);

  const normalized = rawQuestion.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  const keywords = normalized.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Load all active public topics for keyword scoring
  const { data: allTopics } = await supabase
    .from("topics")
    .select("id, slug, canonical_name, category")
    .eq("status", "active")
    .eq("is_public", true);

  // Load all aliases
  const { data: allAliases } = await supabase
    .from("topic_aliases")
    .select("topic_id, alias");

  // Build alias lookup
  const aliasesByTopic = new Map<string, string[]>();
  for (const a of (allAliases ?? []) as Array<{ topic_id: string; alias: string }>) {
    const arr = aliasesByTopic.get(a.topic_id) ?? [];
    arr.push(a.alias.toLowerCase());
    aliasesByTopic.set(a.topic_id, arr);
  }

  // Score each topic by keyword overlap
  let bestMatch: { id: string; slug: string; canonical_name: string; category: string | null } | null = null;
  let bestScore = 0;

  for (const t of (allTopics ?? []) as Array<{ id: string; slug: string; canonical_name: string; category: string | null }>) {
    const nameWords = t.canonical_name.toLowerCase().split(/[\s-]+/);
    const aliases = aliasesByTopic.get(t.id) ?? [];
    const allText = [...nameWords, ...aliases.flatMap((a) => a.split(/[\s-]+/))].join(" ");

    // Count how many keywords appear in the topic name + aliases
    let matchCount = 0;
    for (const kw of keywords) {
      if (allText.includes(kw)) matchCount++;
    }

    // Score: fraction of keywords matched (minimum 1 match for short questions, 2 for longer)
    const minMatches = keywords.length <= 3 ? 1 : 2;
    if (matchCount >= minMatches && keywords.length > 0) {
      const score = matchCount / keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = t;
      }
    }

    // Also check: does the full question contain the canonical name?
    const nameNorm = t.canonical_name.toLowerCase();
    if (normalized.includes(nameNorm) && 0.8 > bestScore) {
      bestScore = 0.8;
      bestMatch = t;
    }
  }

  // 5. Insert oracle query
  const matchedTopic = bestMatch && bestScore >= 0.5 ? bestMatch : null;
  const status = matchedTopic ? "answered" : "insufficient_data";

  const { data: inserted, error: insertError } = await db(supabase)
    .from("oracle_queries")
    .insert({
      question_text: rawQuestion,
      question_slug: slug,
      matched_topic_id: matchedTopic?.id ?? null,
      status,
    })
    .select("id")
    .single();

  if (insertError) {
    // Slug collision (unique constraint) -- add numeric suffix
    if (insertError.code === "23505") {
      const suffixedSlug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const { error: retryError } = await db(supabase)
        .from("oracle_queries")
        .insert({
          question_text: rawQuestion,
          question_slug: suffixedSlug,
          matched_topic_id: matchedTopic?.id ?? null,
          status,
        })
        .select("id")
        .single();

      if (retryError) {
        return NextResponse.json({ error: "Something broke -- try again" }, { status: 500 });
      }
      return NextResponse.json({ slug: suffixedSlug, existing: false });
    }
    return NextResponse.json({ error: "Something broke -- try again" }, { status: 500 });
  }

  // 6. Enqueue synthesis if we found a matching topic
  if (matchedTopic && inserted) {
    const queryId = (inserted as { id: string }).id;

    // Get the latest snapshot for this topic
    const { data: latestPtr } = await supabase
      .from("topic_latest_snapshot")
      .select("snapshot_id")
      .eq("topic_id", matchedTopic.id)
      .maybeSingle();

    const snapshotId = (latestPtr as { snapshot_id: string } | null)?.snapshot_id;

    if (snapshotId) {
      await db(supabase)
        .from("oracle_queries")
        .update({ answer_snapshot_id: snapshotId })
        .eq("id", queryId);

      await enqueue(supabase, {
        job_type: "oracle_synthesis",
        payload: {
          oracle_query_id: queryId,
          topic_id: matchedTopic.id,
          snapshot_id: snapshotId,
        },
        priority: 1,
        idempotency_key: `oracle-synth-${queryId}`,
      });
    } else {
      // Topic exists but has no snapshot -- treat as insufficient data
      await db(supabase)
        .from("oracle_queries")
        .update({ status: "insufficient_data", matched_topic_id: null })
        .eq("id", queryId);
    }
  }

  return NextResponse.json({ slug, existing: false });
}
