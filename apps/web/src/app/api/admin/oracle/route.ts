import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, AdminAuthError } from "@/lib/admin/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

export async function GET() {
  const supabase = await createClient();
  try { await requireAdmin(supabase); } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }

  // Load oracle queries with subscriber counts and matched topic names
  const { data: rawQueries } = await db(supabase)
    .from("oracle_queries")
    .select("id, question_text, question_slug, matched_topic_id, status, llm_verdict, asked_count, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const queries = (rawQueries ?? []) as Array<{
    id: string;
    question_text: string;
    question_slug: string;
    matched_topic_id: string | null;
    status: string;
    llm_verdict: string | null;
    asked_count: number;
    created_at: string;
  }>;

  // Batch-load topic names
  const topicIds = queries.map((q) => q.matched_topic_id).filter(Boolean) as string[];
  const topicMap = new Map<string, string>();
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from("topics")
      .select("id, canonical_name")
      .in("id", topicIds);

    for (const t of (topics ?? []) as Array<{ id: string; canonical_name: string }>) {
      topicMap.set(t.id, t.canonical_name);
    }
  }

  // Batch-load subscriber counts
  const queryIds = queries.map((q) => q.id);
  const subCounts = new Map<string, number>();
  if (queryIds.length > 0) {
    const { data: subs } = await db(supabase)
      .from("oracle_query_subscribers")
      .select("query_id");

    for (const s of (subs ?? []) as Array<{ query_id: string }>) {
      subCounts.set(s.query_id, (subCounts.get(s.query_id) ?? 0) + 1);
    }
  }

  const enriched = queries.map((q) => ({
    ...q,
    matched_topic_name: q.matched_topic_id ? topicMap.get(q.matched_topic_id) ?? null : null,
    subscriber_count: subCounts.get(q.id) ?? 0,
  }));

  return NextResponse.json({ queries: enriched });
}
