/**
 * Comprehensive LLM purge: validate ALL existing market matches.
 * Uses the same Gemini Flash-Lite validator as the matching engine.
 * Any match the LLM says is irrelevant gets deleted.
 *
 * Run: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEYS=... npx tsx scripts/llm-purge-all-matches.ts
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKeys = (process.env.GEMINI_API_KEYS ?? "").split(",").filter(Boolean);
if (!url || !key) { console.error("Missing SUPABASE env vars"); process.exit(1); }
if (geminiKeys.length === 0) { console.error("Missing GEMINI_API_KEYS"); process.exit(1); }

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
let keyIndex = 0;

async function query(endpoint: string) {
  const resp = await fetch(`${url}/rest/v1/${endpoint}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!resp.ok) throw new Error(`Query failed: ${resp.status} ${endpoint.slice(0, 80)}`);
  return resp.json();
}

async function del(endpoint: string) {
  await fetch(`${url}/rest/v1/${endpoint}`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } });
}

async function post(endpoint: string, body: Record<string, unknown>) {
  await fetch(`${url}/rest/v1/${endpoint}`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(body) });
}

async function llmValidate(signalText: string, topicName: string, topicCategory: string): Promise<boolean> {
  const apiKey = geminiKeys[keyIndex % geminiKeys.length];
  keyIndex++;

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `Signal: "${signalText.slice(0, 300)}"
Topic: "${topicName}" (category: ${topicCategory})

Is this signal actually about this topic? Answer only YES or NO.
- "Hurricanes vs Canadiens O/U 6.5" is about HOCKEY, not hurricanes/weather -> NO
- "Pope Francis Nobel Prize odds" is about the Pope, not Taylor Swift -> NO
- "Will the highest temperature in Madrid be 25C on March 26?" is a DAILY WEATHER BET, not climate policy -> NO
- "Will Taylor Pendrith win the Masters?" is about a GOLFER named Taylor, not Taylor Swift -> NO
- "Fed rate cut probability June 2026" IS about Federal Reserve rates -> YES
- "Will Bitcoin hit 150k by 2026" IS about Bitcoin price -> YES
- "Iran x Israel/US conflict ends by May 15?" IS about Iran-US tensions -> YES`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().toUpperCase();
    return text.startsWith("YES");
  } catch (err) {
    console.error(`  LLM error: ${err instanceof Error ? err.message : String(err)}`);
    return true; // permissive fallback for purge -- keep match if we can't validate
    // Note: for a stricter purge, change to `return false` to delete on uncertainty
  }
}

async function main() {
  console.log("Loading topics...");
  const topics: Array<{ id: string; slug: string; canonical_name: string; category: string }> = await query(
    "topics?select=id,slug,canonical_name,category&status=eq.active"
  );
  const topicMap = new Map(topics.map(t => [t.id, t]));
  console.log(`${topics.length} topics loaded`);

  // Load all market-type source items that have matches
  console.log("Loading market matches...");
  const allMatches: Array<{ id: string; source_item_id: string; topic_id: string }> = [];

  // Process topics in batches to avoid header overflow
  for (let i = 0; i < topics.length; i += 5) {
    const batch = topics.slice(i, i + 5);
    const ids = batch.map(t => t.id).join(",");
    const matches = await query(
      `source_item_topic_matches?select=id,source_item_id,topic_id&topic_id=in.(${ids})&limit=500`
    );
    allMatches.push(...matches);
  }
  console.log(`${allMatches.length} total matches to evaluate`);

  // Load source items for these matches (only market type)
  const uniqueItemIds = [...new Set(allMatches.map(m => m.source_item_id))];
  const itemMap = new Map<string, { question: string; slug: string; source_item_type: string }>();

  for (let i = 0; i < uniqueItemIds.length; i += 5) {
    const batch = uniqueItemIds.slice(i, i + 5);
    const items = await query(
      `source_items?select=id,source_item_type,normalized_payload&id=in.(${batch.join(",")})`
    );
    for (const item of items as Array<{ id: string; source_item_type: string; normalized_payload: Record<string, unknown> }>) {
      if (item.source_item_type === "market") {
        itemMap.set(item.id, {
          question: String(item.normalized_payload.question ?? item.normalized_payload.slug ?? ""),
          slug: String(item.normalized_payload.slug ?? ""),
          source_item_type: item.source_item_type,
        });
      }
    }
  }
  console.log(`${itemMap.size} market items to validate\n`);

  let purged = 0;
  let kept = 0;
  let skipped = 0;
  const affectedTopicIds = new Set<string>();

  for (const match of allMatches) {
    const item = itemMap.get(match.source_item_id);
    if (!item) { skipped++; continue; } // Not a market item

    const topic = topicMap.get(match.topic_id);
    if (!topic) { skipped++; continue; }

    const signalText = item.question || item.slug;
    if (!signalText || signalText.length < 5) { skipped++; continue; }

    const isRelevant = await llmValidate(signalText, topic.canonical_name, topic.category);

    if (!isRelevant) {
      console.log(`  PURGE: "${signalText.slice(0, 60)}" on ${topic.slug}`);
      await del(`source_item_topic_matches?id=eq.${match.id}`);
      affectedTopicIds.add(match.topic_id);
      purged++;
    } else {
      kept++;
    }

    // Rate limit: delay between LLM calls to avoid 429s
    if ((purged + kept) % 5 === 0) {
      process.stdout.write(`  Progress: ${purged + kept + skipped}/${allMatches.length} (${purged} purged, ${kept} kept)\r`);
      await new Promise(r => setTimeout(r, 1000)); // 1s between batches of 5
    }
  }

  console.log(`\n\nRESULTS:`);
  console.log(`  Evaluated: ${purged + kept}`);
  console.log(`  Purged:    ${purged}`);
  console.log(`  Kept:      ${kept}`);
  console.log(`  Skipped:   ${skipped} (non-market items)`);
  console.log(`  Affected topics: ${affectedTopicIds.size}`);

  // Re-enqueue snapshots for affected topics
  if (affectedTopicIds.size > 0) {
    console.log("\nRe-enqueuing snapshots...");
    for (const topicId of affectedTopicIds) {
      const topic = topicMap.get(topicId);
      await post("job_queue", {
        job_type: "snapshot_generation",
        payload: { topic_id: topicId, force: true },
        priority: 5,
        status: "pending",
        max_attempts: 3,
        idempotency_key: `llm-purge-regen-${topic?.slug}-${Date.now()}`,
      });
    }
    console.log(`  Enqueued ${affectedTopicIds.size} snapshot jobs`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
