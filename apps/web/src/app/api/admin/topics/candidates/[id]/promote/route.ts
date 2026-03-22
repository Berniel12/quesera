import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";
import { enqueue } from "@signal-map/queue";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);
    const body = (await req.json()) as { canonical_name: string; slug: string; category?: string };

    // Create new topic
    const { data: topic, error: topicErr } = await supabase
      .from("topics")
      .insert({
        canonical_name: body.canonical_name,
        slug: body.slug,
        category: body.category ?? null,
        status: "active",
        is_public: true,
      })
      .select("id")
      .single();

    if (topicErr) return NextResponse.json({ error: topicErr.message }, { status: 400 });

    const topicId = (topic as { id: string }).id;

    // Update candidate
    await supabase.from("topic_candidates").update({
      status: "promoted",
      promoted_topic_id: topicId,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    // Enqueue snapshot generation
    await enqueue(supabase, { job_type: "snapshot_generation", payload: { topic_id: topicId }, priority: 2 });

    await auditLog(supabase, userId, "promote_candidate", "topic_candidate", id, { status: "pending" }, { status: "promoted", topic_id: topicId });

    return NextResponse.json({ ok: true, topic_id: topicId });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
