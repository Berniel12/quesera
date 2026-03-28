/**
 * Migrate featured question_wrappers into the new questions table.
 * Each featured wrapper becomes a published question pointing to its topic.
 * question_type is derived using the contract system's deriveQuestionType().
 *
 * Run: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-wrappers-to-questions.ts
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function query(endpoint: string) {
  const resp = await fetch(`${url}/rest/v1/${endpoint}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!resp.ok) { console.error(`Query error ${resp.status}: ${endpoint.slice(0, 80)}`); return []; }
  return resp.json();
}

async function post(endpoint: string, body: Record<string, unknown>) {
  const resp = await fetch(`${url}/rest/v1/${endpoint}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    return null;
  }
  const data = await resp.json();
  return Array.isArray(data) ? data[0] : data;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Simplified deriveQuestionType (matches question-contracts.ts logic)
function deriveQuestionType(questionText: string, category: string | null): string {
  const q = questionText.toLowerCase();
  if (/who will win|who is (likely|favored|projected)|who leads/.test(q)) return "competition";
  if (/will .+ (hit|reach|cross|exceed|break|surpass|settle) .+\d/.test(q)) return "threshold";
  if (/will .+ (keep|stay|remain) (above|below|at)/.test(q)) return "threshold";
  if (/will .+ (price|rate|index) .*(rise|fall|drop|change)/.test(q)) return "threshold";
  // Category defaults
  const catDefaults: Record<string, string> = {
    sports: "competition", macro: "threshold", crypto: "threshold",
    politics: "binary_event", geopolitics: "binary_event", tech: "binary_event",
    entertainment: "binary_event", disasters: "binary_event",
  };
  return catDefaults[category ?? ""] ?? "binary_event";
}

async function main() {
  console.log("Loading featured wrappers...");
  const wrappers: Array<{
    id: string; topic_id: string; question_text: string;
    is_featured: boolean; sort_order: number;
  }> = await query(
    "question_wrappers?select=id,topic_id,question_text,is_featured,sort_order&is_featured=eq.true&order=sort_order.asc"
  );
  console.log(`${wrappers.length} featured wrappers found`);

  // Load topics for category info
  const topics: Array<{ id: string; slug: string; category: string | null }> = await query(
    "topics?select=id,slug,category&status=eq.active"
  );
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  // Track slugs to prevent duplicates
  const seenSlugs = new Set<string>();
  const seenTopics = new Set<string>();
  let created = 0;
  let skipped = 0;

  for (const w of wrappers) {
    const topic = topicMap.get(w.topic_id);
    if (!topic) { skipped++; continue; }

    // Deduplicate: one question per primary topic
    if (seenTopics.has(w.topic_id)) { skipped++; continue; }

    let slug = slugify(w.question_text);
    if (!slug || slug.length < 3) { skipped++; continue; }

    // Handle slug collision
    if (seenSlugs.has(slug)) {
      slug = `${slug}-${topic.slug.slice(0, 10)}`;
    }
    if (seenSlugs.has(slug)) { skipped++; continue; }

    const questionType = deriveQuestionType(w.question_text, topic.category);

    const result = await post("questions", {
      question_text: w.question_text,
      slug,
      question_type: questionType,
      status: "published",
      category: topic.category,
      primary_topic_id: w.topic_id,
      is_featured: true,
      sort_order: w.sort_order,
      migrated_from_wrapper_id: w.id,
    });

    if (result) {
      seenSlugs.add(slug);
      seenTopics.add(w.topic_id);
      console.log(`  OK: "${w.question_text.slice(0, 50)}" -> /questions/${slug} (${questionType})`);
      created++;
    } else {
      console.log(`  SKIP: "${w.question_text.slice(0, 50)}" (insert failed -- duplicate slug?)`);
      skipped++;
    }
  }

  console.log(`\nMigrated: ${created} questions created, ${skipped} skipped`);
}

main().catch(console.error);
