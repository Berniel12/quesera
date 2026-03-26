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

  // 4. Topic matching (web-side: ilike on canonical_name + aliases)
  const normalized = rawQuestion.toLowerCase().trim().replace(/\s+/g, " ");

  // Try canonical name match
  const { data: nameMatches } = await supabase
    .from("topics")
    .select("id, slug, canonical_name, category")
    .eq("status", "active")
    .eq("is_public", true)
    .ilike("canonical_name", `%${normalized}%`)
    .limit(10);

  // Try alias match
  const { data: aliasMatches } = await supabase
    .from("topic_aliases")
    .select("topic_id, alias")
    .ilike("alias", `%${normalized}%`)
    .limit(10);

  // Score and pick best match
  let bestMatch: { id: string; slug: string; canonical_name: string; category: string | null } | null = null;
  let bestScore = 0;

  for (const t of (nameMatches ?? []) as Array<{ id: string; slug: string; canonical_name: string; category: string | null }>) {
    const nameNorm = t.canonical_name.toLowerCase();
    const score = nameNorm === normalized ? 1.0 : nameNorm.includes(normalized) ? 0.8 : normalized.includes(nameNorm) ? 0.7 : 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = t;
    }
  }

  // Check alias matches if no strong name match
  if (bestScore < 0.7 && aliasMatches && aliasMatches.length > 0) {
    const aliasTopicIds = (aliasMatches as Array<{ topic_id: string }>).map((a) => a.topic_id);
    const { data: aliasTopics } = await supabase
      .from("topics")
      .select("id, slug, canonical_name, category")
      .in("id", aliasTopicIds)
      .eq("status", "active")
      .eq("is_public", true);

    for (const t of (aliasTopics ?? []) as Array<{ id: string; slug: string; canonical_name: string; category: string | null }>) {
      if (0.6 > bestScore) {
        bestScore = 0.6;
        bestMatch = t;
      }
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
