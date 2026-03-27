/**
 * Purge bad signal matches from the database.
 * Finds sports-bet signals matched to non-sports topics and removes them.
 * Then re-enqueues snapshot generation for affected topics.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function query(endpoint: string) {
  const resp = await fetch(`${url}/rest/v1/${endpoint}`, { headers });
  return resp.json();
}

async function del(endpoint: string) {
  const resp = await fetch(`${url}/rest/v1/${endpoint}`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } });
  return resp.status;
}

async function post(endpoint: string, body: Record<string, unknown>) {
  await fetch(`${url}/rest/v1/${endpoint}`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(body) });
}

const SPORTS_BET_RE = /\bvs\.?\s|\bspread[:\s]|\bo\/u\s|\bover[\s/-]under\b|\bmoneyline\b|\bparlay\b|\bpoint spread\b|\btotal points\b|\bgame \d/i;

const SPORTS_CATEGORIES = new Set(["sports"]);

async function main() {
  console.log("Loading topics...");
  const topics: Array<{ id: string; slug: string; category: string | null }> = await query(
    "topics?select=id,slug,category&status=eq.active"
  );
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const nonSportsTopicIds = topics.filter((t) => !SPORTS_CATEGORIES.has(t.category ?? "")).map((t) => t.id);

  console.log(`${topics.length} topics (${nonSportsTopicIds.length} non-sports)`);

  // Load all matches for non-sports topics from prediction markets
  console.log("Loading matches for non-sports topics...");
  let purged = 0;
  const affectedTopicIds = new Set<string>();

  // Process in batches
  for (let i = 0; i < nonSportsTopicIds.length; i += 3) {
    const batch = nonSportsTopicIds.slice(i, i + 3);
    const idsStr = batch.join(",");

    const matches: Array<{ id: string; source_item_id: string; topic_id: string }> = await query(
      `source_item_topic_matches?select=id,source_item_id,topic_id&topic_id=in.(${idsStr})&limit=500`
    );

    if (matches.length === 0) continue;

    // Load the source items for these matches
    const itemIds = [...new Set(matches.map((m) => m.source_item_id))];
    const itemIdsStr = itemIds.join(",");

    // Load items in smaller batches to avoid header overflow
    const allItems: Array<{ id: string; source_key: string; source_item_type: string | null; normalized_payload: Record<string, unknown> }> = [];
    for (let j = 0; j < itemIds.length; j += 5) {
      const itemBatch = itemIds.slice(j, j + 5);
      const batchItems = await query(
        `source_items?select=id,source_key,source_item_type,normalized_payload&id=in.(${itemBatch.join(",")})`
      );
      allItems.push(...batchItems);
    }
    const items = allItems;

    const itemMap = new Map(items.map((it) => [it.id, it]));

    for (const match of matches) {
      const item = itemMap.get(match.source_item_id);
      if (!item) continue;

      // Only check market-type items
      if (item.source_item_type !== "market") continue;

      const slug = String(item.normalized_payload.slug ?? "").toLowerCase();
      const question = String(item.normalized_payload.question ?? "").toLowerCase();
      const text = `${slug} ${question}`;

      // Check if this looks like a sports bet
      if (SPORTS_BET_RE.test(text)) {
        const topic = topicMap.get(match.topic_id);
        console.log(`  PURGE: "${question.slice(0, 60)}..." matched to ${topic?.slug} (${topic?.category})`);
        await del(`source_item_topic_matches?id=eq.${match.id}`);
        affectedTopicIds.add(match.topic_id);
        purged++;
      }

      // Also check: if the slug contains "vs" and has team-name patterns, it's likely sports
      if (slug.includes("-vs-") && !SPORTS_CATEGORIES.has(topicMap.get(match.topic_id)?.category ?? "")) {
        const topic = topicMap.get(match.topic_id);
        console.log(`  PURGE (vs): "${slug.slice(0, 60)}" matched to ${topic?.slug} (${topic?.category})`);
        await del(`source_item_topic_matches?id=eq.${match.id}`);
        affectedTopicIds.add(match.topic_id);
        purged++;
      }
    }
  }

  console.log(`\nPurged ${purged} bad matches across ${affectedTopicIds.size} topics`);

  // Re-enqueue snapshot generation for affected topics
  if (affectedTopicIds.size > 0) {
    console.log("Re-enqueuing snapshot generation...");
    for (const topicId of affectedTopicIds) {
      const topic = topicMap.get(topicId);
      await post("job_queue", {
        job_type: "snapshot_generation",
        payload: { topic_id: topicId, force: true },
        priority: 5,
        status: "pending",
        max_attempts: 3,
        idempotency_key: `purge-regen-${topic?.slug}-${Date.now()}`,
      });
      console.log(`  Enqueued snapshot for ${topic?.slug}`);
    }
  }

  console.log("Done.");
}

main().catch(console.error);
