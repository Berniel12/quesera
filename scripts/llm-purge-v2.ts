/**
 * LLM purge v2: process topic by topic (avoids massive batch queries).
 * For each topic, load its market matches, validate each with LLM, delete bad ones.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKeys = (process.env.GEMINI_API_KEYS ?? "").split(",").filter(Boolean);
const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";
if (!url || !key || geminiKeys.length === 0) { console.error("Missing env vars"); process.exit(1); }

let keyIdx = 0;

async function supaQuery(endpoint: string, retries = 3): Promise<unknown[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(`${url}/rest/v1/${endpoint}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (!resp.ok) { console.error(`Query error ${resp.status}: ${endpoint.slice(0, 60)}`); return []; }
      return await resp.json() as unknown[];
    } catch (err) {
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      console.error(`Query failed after ${retries} attempts: ${(err as Error).message?.slice(0, 60)}`);
      return [];
    }
  }
  return [];
}

async function supaDelete(endpoint: string) {
  await fetch(`${url}/rest/v1/${endpoint}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" } });
}

async function supaPost(endpoint: string, body: Record<string, unknown>) {
  await fetch(`${url}/rest/v1/${endpoint}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) });
}

async function llmCheck(signal: string, topic: string, category: string): Promise<boolean> {
  const apiKey = geminiKeys[keyIdx % geminiKeys.length];
  keyIdx++;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });
    const result = await model.generateContent(
      `Signal: "${signal.slice(0, 300)}"\nTopic: "${topic}" (${category})\n\nIs this signal actually about this topic? YES or NO only.\n- "Hurricanes vs Canadiens O/U" is hockey NOT hurricanes -> NO\n- "Wildland Firefighters Congressional Gold Medal Act" is about medals NOT gold prices -> NO\n- "Golden - HUNTR/X Billboard #1" is a song NOT gold prices -> NO\n- "Internal Revenue Code amendment" is US tax law NOT Premier League football -> NO\n- "Will Bukayo Saka be top scorer" is about a player NOT who wins the league -> NO\n- "Fed rate cut probability" IS about Federal Reserve rates -> YES\n- "Will Arsenal win Premier League" IS about Premier League -> YES`
    );
    const text = result.response.text().trim().toUpperCase();
    return text.startsWith("YES");
  } catch (err) {
    console.error(`  LLM err: ${(err as Error).message?.slice(0, 60)}`);
    return true; // permissive
  }
}

async function main() {
  const topics: Array<{ id: string; slug: string; canonical_name: string; category: string }> = await supaQuery(
    "topics?select=id,slug,canonical_name,category&status=eq.active&is_public=eq.true"
  );
  console.log(`${topics.length} topics to process\n`);

  let totalPurged = 0;
  let totalKept = 0;
  let totalSkipped = 0;
  const affectedTopics: string[] = [];

  for (const topic of topics) {
    // Get matches for this topic
    const matches: Array<{ id: string; source_item_id: string }> = await supaQuery(
      `source_item_topic_matches?select=id,source_item_id&topic_id=eq.${topic.id}&limit=100`
    );
    if (matches.length === 0) continue;

    // Get the source items (only market type)
    const itemIds = matches.map((m) => m.source_item_id);
    let purgedThisTopic = 0;

    for (const match of matches) {
      // Load individual item
      const items: Array<{ id: string; source_item_type: string; normalized_payload: Record<string, unknown> }> = await supaQuery(
        `source_items?select=id,source_item_type,normalized_payload&id=eq.${match.source_item_id}`
      );
      const item = items[0];
      if (!item || item.source_item_type !== "market") { totalSkipped++; continue; }

      const signalText = String(item.normalized_payload.question ?? item.normalized_payload.slug ?? "");
      if (signalText.length < 5) { totalSkipped++; continue; }

      const isRelevant = await llmCheck(signalText, topic.canonical_name, topic.category);

      if (!isRelevant) {
        console.log(`  PURGE: "${signalText.slice(0, 55)}" on ${topic.slug}`);
        await supaDelete(`source_item_topic_matches?id=eq.${match.id}`);
        totalPurged++;
        purgedThisTopic++;
      } else {
        totalKept++;
      }

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    if (purgedThisTopic > 0) {
      affectedTopics.push(topic.slug);
      // Re-enqueue snapshot
      await supaPost("job_queue", {
        job_type: "snapshot_generation",
        payload: { topic_id: topic.id, force: true },
        priority: 5, status: "pending", max_attempts: 3,
        idempotency_key: `purge-v2-${topic.slug}-${Date.now()}`,
      });
    }

    if ((totalPurged + totalKept) % 20 === 0 && (totalPurged + totalKept) > 0) {
      console.log(`  ... ${totalPurged + totalKept + totalSkipped} processed (${totalPurged} purged, ${totalKept} kept)`);
    }
  }

  console.log(`\nRESULTS:`);
  console.log(`  Purged: ${totalPurged}`);
  console.log(`  Kept: ${totalKept}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Affected topics: ${affectedTopics.length} (${affectedTopics.join(", ")})`);
}

main().catch(console.error);
