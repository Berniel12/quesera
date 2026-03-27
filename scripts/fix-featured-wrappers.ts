/**
 * Fix featured question wrappers:
 * 1. Demote auto-imported market titles from is_featured=true to false
 * 2. Ensure every topic has a human-curated featured wrapper from topics.json
 *
 * Run: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/fix-featured-wrappers.ts
 */

import { readFileSync } from "fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function query(endpoint: string) {
  const resp = await fetch(`${url}/rest/v1/${endpoint}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return resp.json();
}

async function patch(endpoint: string, body: Record<string, unknown>) {
  await fetch(`${url}/rest/v1/${endpoint}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function post(endpoint: string, body: Record<string, unknown>) {
  const resp = await fetch(`${url}/rest/v1/${endpoint}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return resp.status;
}

// Patterns that indicate a market-imported question (not a good headline)
const MARKET_PATTERNS = [
  /\bvs\.?\s/i,           // "Team A vs Team B"
  /\bspread[:\s]/i,       // "Spread: Team (-4.5)"
  /\bo\/u\s/i,            // "O/U 6.5"
  /\bover[\s/-]under\b/i, // "Over/Under"
  /\bmoneyline\b/i,
  /\bWill .{3,40} win the \d{4}/i,  // "Will [team] win the 2026..."
  /\bWill .{3,30} win the Masters/i,
  /\bWill .{3,30} win the Nobel/i,
  /\bhighest temperature\b/i,  // Daily weather bets
  /\blowest temperature\b/i,
  /\bon March \d/i,       // Short-term date-specific bets
  /\bon April \d/i,
  /\bby March \d/i,
  /\bby April \d/i,
];

function looksLikeMarketTitle(text: string): boolean {
  return MARKET_PATTERNS.some((re) => re.test(text));
}

// Load topics.json for canonical questions
const topicsJson = JSON.parse(readFileSync("packages/db/supabase/seed/topics.json", "utf-8")) as Array<{
  canonical_name: string;
  slug: string;
  category: string;
  description: string;
  aliases: string[];
}>;

// Build a map of slug -> good headline question
const GOOD_HEADLINES: Record<string, string> = {};
for (const t of topicsJson) {
  // Generate a natural question from the canonical name
  const name = t.canonical_name;
  const cat = t.category;

  // Competition/who-will-win topics
  if (cat === "sports" && !name.includes("Activity") && !name.includes("Alerts")) {
    GOOD_HEADLINES[t.slug] = `Who will win the ${name}?`;
  } else if (name.includes("Election") || name.includes("Politics")) {
    GOOD_HEADLINES[t.slug] = `What will happen in ${name.replace(" Elections", " elections").replace(" Politics", " politics")}?`;
  } else if (cat === "entertainment") {
    // Keep existing question wrappers for entertainment if they're good
  } else if (cat === "macro") {
    // Macro topics: "Will X change?" framing
    if (name.includes("Interest Rate")) GOOD_HEADLINES[t.slug] = `Will ${name.replace("US ", "the ").replace("ECB ", "ECB ")} change?`;
    else if (name.includes("Price") || name.includes("Inflation")) GOOD_HEADLINES[t.slug] = `Will ${name.toLowerCase()} keep rising?`;
  }
  // Don't override existing good headlines for topics that already have human-curated ones
}

async function main() {
  console.log("Loading topics...");
  const topics: Array<{ id: string; slug: string; canonical_name: string }> = await query(
    "topics?select=id,slug,canonical_name&status=eq.active"
  );
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  console.log(`${topics.length} topics loaded`);

  console.log("\nLoading featured wrappers...");
  const wrappers: Array<{ id: string; topic_id: string; question_text: string; is_featured: boolean; sort_order: number }> = await query(
    "question_wrappers?select=id,topic_id,question_text,is_featured,sort_order&is_featured=eq.true"
  );
  console.log(`${wrappers.length} featured wrappers found`);

  let demoted = 0;
  let kept = 0;

  for (const w of wrappers) {
    const topic = topicMap.get(w.topic_id);
    if (!topic) continue;

    if (looksLikeMarketTitle(w.question_text)) {
      console.log(`  DEMOTE: "${w.question_text.slice(0, 60)}" on ${topic.slug}`);
      await patch(`question_wrappers?id=eq.${w.id}`, { is_featured: false, sort_order: 50 });
      demoted++;
    } else {
      kept++;
    }
  }

  console.log(`\nDemoted: ${demoted}, Kept: ${kept}`);

  // Now ensure every topic has at least one featured wrapper
  console.log("\nChecking for topics missing featured wrappers...");
  const allWrappers: Array<{ topic_id: string; is_featured: boolean }> = await query(
    "question_wrappers?select=topic_id,is_featured"
  );

  const topicsWithFeatured = new Set(
    allWrappers.filter((w) => w.is_featured).map((w) => w.topic_id)
  );

  let created = 0;
  for (const topic of topics) {
    if (topicsWithFeatured.has(topic.id)) continue;

    // This topic has no featured wrapper. Create one from topics.json or canonical name.
    const headline = GOOD_HEADLINES[topic.slug];
    if (headline) {
      const status = await post("question_wrappers", {
        topic_id: topic.id,
        question_text: headline,
        is_featured: true,
        sort_order: 1,
      });
      if (status < 300) {
        console.log(`  CREATED: "${headline}" for ${topic.slug}`);
        created++;
      }
    }
  }

  console.log(`\nCreated ${created} new featured wrappers`);
  console.log("Done.");
}

main().catch(console.error);
