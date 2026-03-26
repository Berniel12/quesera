import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseClient } from "@signal-map/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";
import { enqueue } from "@signal-map/queue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  let actorId: string;
  try {
    const result = await requireAdmin(supabase);
    actorId = result.userId;
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }

  // Use service role for writes
  const serviceClient = createSupabaseClient({ serviceRole: true });

  // Load the oracle query
  const { data: query } = await db(serviceClient)
    .from("oracle_queries")
    .select("id, question_text, matched_topic_id, status")
    .eq("id", id)
    .single();

  if (!query) {
    return NextResponse.json({ error: "Oracle query not found" }, { status: 404 });
  }

  const q = query as { id: string; question_text: string; matched_topic_id: string | null; status: string };

  // If no matched topic, try re-matching
  if (!q.matched_topic_id) {
    const normalized = q.question_text.toLowerCase().trim().replace(/\s+/g, " ");

    const { data: nameMatches } = await serviceClient
      .from("topics")
      .select("id, slug, canonical_name")
      .eq("status", "active")
      .eq("is_public", true)
      .ilike("canonical_name", `%${normalized}%`)
      .limit(5);

    if (nameMatches && nameMatches.length > 0) {
      const match = (nameMatches as Array<{ id: string }>)[0];
      await db(serviceClient)
        .from("oracle_queries")
        .update({ matched_topic_id: match.id, status: "answered", synthesis_failed_at: null })
        .eq("id", id);

      // Get latest snapshot and enqueue synthesis
      const { data: ptr } = await serviceClient
        .from("topic_latest_snapshot")
        .select("snapshot_id")
        .eq("topic_id", match.id)
        .maybeSingle();

      const snapshotId = (ptr as { snapshot_id: string } | null)?.snapshot_id;
      if (snapshotId) {
        await db(serviceClient)
          .from("oracle_queries")
          .update({ answer_snapshot_id: snapshotId })
          .eq("id", id);

        await enqueue(serviceClient, {
          job_type: "oracle_synthesis",
          payload: { oracle_query_id: id, topic_id: match.id, snapshot_id: snapshotId },
          priority: 1,
          idempotency_key: `oracle-admin-retry-${id}`,
        });
      }
    }
  } else {
    // Has matched topic -- just re-enqueue synthesis
    const { data: ptr } = await serviceClient
      .from("topic_latest_snapshot")
      .select("snapshot_id")
      .eq("topic_id", q.matched_topic_id)
      .maybeSingle();

    const snapshotId = (ptr as { snapshot_id: string } | null)?.snapshot_id;
    if (snapshotId) {
      await db(serviceClient)
        .from("oracle_queries")
        .update({ llm_verdict: null, synthesis_failed_at: null, answer_snapshot_id: snapshotId })
        .eq("id", id);

      await enqueue(serviceClient, {
        job_type: "oracle_synthesis",
        payload: { oracle_query_id: id, topic_id: q.matched_topic_id, snapshot_id: snapshotId },
        priority: 1,
        idempotency_key: `oracle-admin-retry-${id}`,
      });
    }
  }

  await auditLog(serviceClient, actorId, "retrigger_oracle_synthesis", "oracle_query", id, null, null);

  return NextResponse.json({ ok: true });
}
