import { NextResponse } from "next/server";
import { createSupabaseClient } from "@signal-map/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

// Staged enablement: start with Polymarket, add others as verified
const ENABLED_PLATFORMS = ["polymarket"] as const;
// const ENABLED_PLATFORMS = ["polymarket", "kalshi", "metaculus"] as const;

// Volume/activity thresholds per platform
const PLATFORM_THRESHOLDS: Record<string, { minVolume: number; volumeField: string; questionField: string; probabilityField: string; urlTemplate: (p: Record<string, unknown>) => string }> = {
  polymarket: {
    minVolume: 5000,
    volumeField: "volume_24hr",
    questionField: "question",
    probabilityField: "outcome_prices",
    urlTemplate: (p) => `https://polymarket.com/event/${String(p.slug ?? "")}`,
  },
  kalshi: {
    minVolume: 2000,
    volumeField: "volume",
    questionField: "title",
    probabilityField: "yes_price",
    urlTemplate: (p) => `https://kalshi.com/markets/${String(p.ticker ?? "")}`,
  },
  metaculus: {
    minVolume: 50, // forecasters_count, not USD
    volumeField: "forecasters_count",
    questionField: "title",
    probabilityField: "community_prediction",
    urlTemplate: (p) => String(p.url ?? `https://metaculus.com/questions/${String(p.question_id ?? "")}/`),
  },
};

/**
 * Discover prediction questions from market/forecast platforms.
 * Maps them to existing alive topics only. Creates question wrappers + provenance links.
 * Does NOT auto-create topics.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient({ serviceRole: true });

  // 1. Load candidate source items from enabled platforms
  const candidates = await loadCandidates(supabase);

  // 2. Load existing wrappers for dedup
  const { data: existingWrappers } = await db(supabase)
    .from("question_wrappers")
    .select("id, question_text, topic_id");
  const existingQuestionTexts = new Set(
    (existingWrappers ?? []).map((w: { question_text: string }) => w.question_text.toLowerCase().trim()),
  );

  // 3. Load alive topics: have a fresh snapshot with real signals
  const aliveTopics = await loadAliveTopics(supabase);

  // Pre-load aliases and topic names for matching (avoid N+1 queries in the loop)
  const aliveIds = aliveTopics.map((t) => t.topicId);
  const { data: allAliases } = aliveIds.length > 0
    ? await supabase.from("topic_aliases").select("topic_id, alias").in("topic_id", aliveIds)
    : { data: [] };
  const { data: allTopicNames } = aliveIds.length > 0
    ? await supabase.from("topics").select("id, canonical_name").in("id", aliveIds)
    : { data: [] };
  const aliasArr = (allAliases ?? []) as Array<{ topic_id: string; alias: string }>;
  const topicNameArr = (allTopicNames ?? []) as Array<{ id: string; canonical_name: string }>;

  const imported: string[] = [];
  const rejected: Array<{ question: string; reason: string }> = [];

  for (const candidate of candidates) {
    const question = candidate.question.trim();

    // --- Quality filters ---
    if (!question || question.length < 15) {
      rejected.push({ question: question.slice(0, 40), reason: "too-short" });
      continue;
    }
    if (isMicroBet(question)) {
      rejected.push({ question: question.slice(0, 40), reason: "micro-bet" });
      continue;
    }
    if (isMarketMechanic(question)) {
      rejected.push({ question: question.slice(0, 40), reason: "market-mechanic" });
      continue;
    }
    if (!isFutureOriented(question)) {
      rejected.push({ question: question.slice(0, 40), reason: "not-prediction" });
      continue;
    }

    // --- Dedup: exact match against existing wrappers ---
    const cleanedQuestion = cleanQuestionText(question);
    if (existingQuestionTexts.has(cleanedQuestion.toLowerCase())) {
      // Already have this wrapper -- but maybe add a platform link if new platform
      await maybeAddPlatformLink(supabase, existingWrappers ?? [], candidate);
      rejected.push({ question: question.slice(0, 40), reason: "already-exists" });
      continue;
    }

    // --- Map to existing alive topic via trigram search ---
    const matchedTopic = await matchToAliveTopic(supabase, question, aliveTopics, aliasArr, topicNameArr);
    if (!matchedTopic) {
      rejected.push({ question: question.slice(0, 40), reason: "no-alive-topic" });
      continue;
    }

    // --- Publication gate: topic must have signals beyond this market ---
    if (matchedTopic.signalCount < 1) {
      rejected.push({ question: question.slice(0, 40), reason: "no-signals" });
      continue;
    }

    // --- Create wrapper + provenance ---
    const displayQuestion = cleanedQuestion.endsWith("?") ? cleanedQuestion : `${cleanedQuestion}?`;

    const { data: wrapper, error: wrapperErr } = await db(supabase)
      .from("question_wrappers")
      .insert({
        topic_id: matchedTopic.topicId,
        question_text: displayQuestion,
        is_featured: true,
        sort_order: 10, // lower priority than hand-curated (sort_order: 1)
      })
      .select("id")
      .single();

    if (wrapperErr || !wrapper) {
      // Unique-constraint violation (23505) means another run already imported this -- treat as exists
      if (wrapperErr?.code === "23505") {
        await maybeAddPlatformLink(supabase, existingWrappers ?? [], candidate);
        rejected.push({ question: question.slice(0, 40), reason: "already-exists" });
      } else {
        rejected.push({ question: question.slice(0, 40), reason: `wrapper-err: ${wrapperErr?.message ?? "unknown"}` });
      }
      continue;
    }

    // Create provenance link
    await db(supabase).from("market_question_links").insert({
      wrapper_id: (wrapper as { id: string }).id,
      platform: candidate.platform,
      source_item_id: candidate.sourceItemId,
      external_id: candidate.externalId,
      platform_url: candidate.platformUrl,
      original_question: question,
      last_probability: candidate.probability,
      last_volume: candidate.volume,
    });

    // Also create source_item_topic_match if it doesn't exist
    if (candidate.sourceItemId) {
      await db(supabase).from("source_item_topic_matches").upsert({
        source_item_id: candidate.sourceItemId,
        topic_id: matchedTopic.topicId,
        match_score: 0.85,
        match_method: "market_discover",
      }, { onConflict: "source_item_id,topic_id" });
    }

    existingQuestionTexts.add(cleanedQuestion.toLowerCase());
    imported.push(`[${candidate.platform}] ${displayQuestion.slice(0, 60)}`);

    // Cap at 15 new wrappers per run
    if (imported.length >= 15) break;
  }

  return NextResponse.json({
    imported: imported.length,
    rejected: rejected.length,
    platforms: ENABLED_PLATFORMS,
    newQuestions: imported,
    rejectionReasons: Object.entries(
      rejected.reduce<Record<string, number>>((acc, r) => { acc[r.reason] = (acc[r.reason] ?? 0) + 1; return acc; }, {}),
    ),
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Candidate loading: reads source_items from enabled platforms
// ---------------------------------------------------------------------------

interface MarketCandidate {
  platform: string;
  sourceItemId: string;
  externalId: string;
  question: string;
  volume: number;
  probability: number | null;
  platformUrl: string;
}

async function loadCandidates(supabase: SupabaseClient): Promise<MarketCandidate[]> {
  const candidates: MarketCandidate[] = [];

  for (const platform of ENABLED_PLATFORMS) {
    const config = PLATFORM_THRESHOLDS[platform];
    if (!config) continue;

    const { data: items } = await supabase
      .from("source_items")
      .select("id, external_id, normalized_payload")
      .eq("source_key", platform)
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false })
      .limit(200);

    for (const item of items ?? []) {
      const payload = (item as { id: string; external_id: string; normalized_payload: Record<string, unknown> }).normalized_payload;
      const question = String(payload[config.questionField] ?? "");
      const volume = Number(payload[config.volumeField] ?? 0);

      if (!question || volume < config.minVolume) continue;

      let probability: number | null = null;
      if (platform === "polymarket") {
        try {
          const prices = JSON.parse(String(payload.outcome_prices ?? "[]")) as string[];
          probability = prices[0] ? parseFloat(prices[0]) : null;
        } catch { /* skip */ }
      } else if (platform === "kalshi") {
        const yesPrice = Number(payload.yes_price ?? 0);
        probability = yesPrice > 0 ? yesPrice / 100 : null; // Kalshi prices are in cents
      } else if (platform === "metaculus") {
        const cp = Number(payload.community_prediction ?? 0);
        probability = cp > 0 ? cp : null;
      }

      candidates.push({
        platform,
        sourceItemId: (item as { id: string }).id,
        externalId: (item as { external_id: string }).external_id,
        question,
        volume,
        probability,
        platformUrl: config.urlTemplate(payload),
      });
    }
  }

  // Sort by volume descending (normalized: Polymarket in USD, Metaculus by forecaster count)
  candidates.sort((a, b) => b.volume - a.volume);

  return candidates;
}

// ---------------------------------------------------------------------------
// Alive topics: have a fresh snapshot with at least 1 signal
// ---------------------------------------------------------------------------

interface AliveTopic {
  topicId: string;
  slug: string;
  category: string | null;
  signalCount: number;
}

async function loadAliveTopics(supabase: SupabaseClient): Promise<AliveTopic[]> {
  // Get topics with a latest snapshot
  const { data: pointers } = await supabase
    .from("topic_latest_snapshot")
    .select("topic_id, snapshot_id");

  if (!pointers || pointers.length === 0) return [];

  const snapshotIds = (pointers as Array<{ topic_id: string; snapshot_id: string }>).map((p) => p.snapshot_id);
  const topicIdToSnapshotId = new Map(
    (pointers as Array<{ topic_id: string; snapshot_id: string }>).map((p) => [p.topic_id, p.snapshot_id]),
  );

  // Check freshness: snapshot published within last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: freshSnapshots } = await supabase
    .from("topic_snapshots")
    .select("id, topic_id, freshness")
    .in("id", snapshotIds)
    .gte("published_at", sevenDaysAgo);

  const freshTopicIds = new Set(
    (freshSnapshots ?? []).map((s: { topic_id: string }) => s.topic_id),
  );

  // Load topics with their info
  const { data: topics } = await supabase
    .from("topics")
    .select("id, slug, category")
    .eq("status", "active")
    .eq("is_public", true);

  // Count signals per snapshot
  const freshSnapshotIds = (freshSnapshots ?? []).map((s: { id: string }) => s.id);
  let signalCounts: Array<{ snapshot_id: string }> | null = null;
  if (freshSnapshotIds.length > 0) {
    const { data } = await db(supabase)
      .from("topic_signals")
      .select("snapshot_id")
      .in("snapshot_id", freshSnapshotIds);
    signalCounts = data as Array<{ snapshot_id: string }> | null;
  }

  const signalCountBySnapshot = new Map<string, number>();
  for (const s of signalCounts ?? []) {
    const sid = (s as { snapshot_id: string }).snapshot_id;
    signalCountBySnapshot.set(sid, (signalCountBySnapshot.get(sid) ?? 0) + 1);
  }

  const alive: AliveTopic[] = [];
  for (const topic of topics ?? []) {
    const t = topic as { id: string; slug: string; category: string | null };
    if (!freshTopicIds.has(t.id)) continue;
    const snapshotId = topicIdToSnapshotId.get(t.id);
    const signals = snapshotId ? (signalCountBySnapshot.get(snapshotId) ?? 0) : 0;
    alive.push({ topicId: t.id, slug: t.slug, category: t.category, signalCount: signals });
  }

  return alive;
}

// ---------------------------------------------------------------------------
// Topic matching: trigram search against alive topics
// ---------------------------------------------------------------------------

async function matchToAliveTopic(
  supabase: SupabaseClient,
  question: string,
  aliveTopics: AliveTopic[],
  aliases: Array<{ topic_id: string; alias: string }>,
  topicNames: Array<{ id: string; canonical_name: string }>,
): Promise<AliveTopic | null> {
  if (aliveTopics.length === 0) return null;

  // Strategy 1: Trigram RPC (works when question phrasing is close to topic name/alias)
  const { data: trigramMatches } = await db(supabase).rpc("trigram_search_topics", {
    search_text: question,
    min_similarity: 0.15,
    max_results: 10,
  });

  for (const match of trigramMatches ?? []) {
    const m = match as { topic_id: string; topic_slug: string; similarity_score: number };
    if (m.similarity_score < 0.25) continue;
    const alive = aliveTopics.find((t) => t.topicId === m.topic_id);
    if (alive) return alive;
  }

  // Strategy 2: Keyword-alias matching (handles "Will the Fed cut rates?" -> alias "Fed Rates")
  if (aliases.length === 0) return null;

  const qLower = question.toLowerCase();
  let bestMatch: AliveTopic | null = null;
  let bestScore = 0;

  for (const alias of aliases) {
    const aliasLower = alias.alias.toLowerCase();
    // Check if the alias appears in the question (word-boundary aware for short aliases)
    const aliasInQuestion = aliasLower.length <= 3
      ? new RegExp(`\\b${aliasLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(question)
      : qLower.includes(aliasLower);
    if (aliasInQuestion) {
      // Score by alias length (longer = more specific = better match)
      const score = aliasLower.length;
      if (score > bestScore) {
        const alive = aliveTopics.find((t) => t.topicId === alias.topic_id);
        if (alive) {
          bestMatch = alive;
          bestScore = score;
        }
      }
    }
  }

  // Also check canonical names
  for (const t of topicNames) {
    const nameLower = t.canonical_name.toLowerCase();
    const words = nameLower.split(/\s+/).filter((w) => w.length > 3);
    const matchingWords = words.filter((w) => qLower.includes(w));
    const score = matchingWords.length * 4;
    if (score > bestScore) {
      const alive = aliveTopics.find((at) => at.topicId === t.id);
      if (alive) {
        bestMatch = alive;
        bestScore = score;
      }
    }
  }

  return bestScore >= 3 ? bestMatch : null;
}

// ---------------------------------------------------------------------------
// Platform link: add additional platform link to existing wrapper
// ---------------------------------------------------------------------------

async function maybeAddPlatformLink(
  supabase: SupabaseClient,
  existingWrappers: Array<{ id: string; question_text: string; topic_id: string }>,
  candidate: MarketCandidate,
): Promise<void> {
  // Find the matching wrapper
  const cleanQ = cleanQuestionText(candidate.question).toLowerCase();
  const wrapper = existingWrappers.find(
    (w) => w.question_text.toLowerCase().trim() === cleanQ ||
           w.question_text.toLowerCase().trim() === `${cleanQ}?`,
  );
  if (!wrapper) return;

  // Upsert platform link (might already exist). Errors are non-fatal -- provenance is best-effort.
  const { error: linkErr } = await db(supabase).from("market_question_links").upsert({
    wrapper_id: wrapper.id,
    platform: candidate.platform,
    source_item_id: candidate.sourceItemId,
    external_id: candidate.externalId,
    platform_url: candidate.platformUrl,
    original_question: candidate.question,
    last_probability: candidate.probability,
    last_volume: candidate.volume,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "wrapper_id,platform,external_id" });
  if (linkErr) {
    // Non-fatal: provenance is best-effort. Log for debugging but don't fail the run.
    console.warn(`market_question_links upsert failed for wrapper ${wrapper.id}: ${linkErr.message}`);
  }
}

// ---------------------------------------------------------------------------
// Question text cleanup: deterministic, no LLM
// ---------------------------------------------------------------------------

function cleanQuestionText(raw: string): string {
  let q = raw.trim();

  // Strip Polymarket resolution mechanics
  q = q.replace(/\s*\(as measured by.*?\)/gi, "");
  q = q.replace(/\s*on or before\s+/gi, " by ");
  q = q.replace(/\s*at the closing date.*$/gi, "");
  q = q.replace(/\s*according to.*$/gi, "");

  // Simplify price language (handles multi-word names like "Crude Oil")
  q = q.replace(/Will the price of (.+?) exceed \$?([\d,]+)/gi, "Will $1 hit $$2");
  q = q.replace(/Will the price of (.+?) fall below \$?([\d,]+)/gi, "Will $1 drop below $$2");

  // Simplify Fed language
  q = q.replace(/Will the Federal Reserve (decrease|increase) the federal funds rate at the (\w+ \d{4}) FOMC meeting/gi,
    (_, action, date) => `Will the Fed ${action === "decrease" ? "cut" : "raise"} rates in ${date}`);

  // Clean up double spaces
  q = q.replace(/\s+/g, " ").trim();

  return q;
}

// ---------------------------------------------------------------------------
// Quality filter helpers
// ---------------------------------------------------------------------------

const MICRO_BET_PATTERNS = [
  /will .+ price .+ in the next (5|15|30) minutes/i,
  /daily close/i,
  /above \$[\d,.]+ at \d+:\d+ (AM|PM)/i,
  /intraday/i,
  /end of day/i,
  /tonight/i,
  /\b(5m|15m|30m|1h)\b/i,
];

function isMicroBet(question: string): boolean {
  return MICRO_BET_PATTERNS.some((p) => p.test(question));
}

function isMarketMechanic(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes("market cap") && q.includes("by close") ||
    q.includes("trading volume") && q.includes("exceed") ||
    /resolve (yes|no)/i.test(q) ||
    /resolution (source|criteria)/i.test(q);
}

function isFutureOriented(question: string): boolean {
  const q = question.toLowerCase();
  // Must contain a future signal: "will", "by [date]", "before", "this year", etc.
  const futurePatterns = [
    /^will /,
    /\bby (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|end of|year)/i,
    /\bbefore /,
    /\bthis (year|summer|winter|spring|fall)/,
    /\bin (20\d{2}|the next)/,
    /\bover the next/,
    /\bgoing (to|above|below|over|under)\b/,
    /\blikely to /,
    /\bexpected to /,
    /\b(reach|hit|exceed|surpass|break|drop below|fall below|dip to|settle at)\b/,
    /\bwin (the|a)\b/,
    /\bbe (confirmed|elected|appointed|nominated)\b/,
  ];
  return futurePatterns.some((p) => p.test(q));
}

