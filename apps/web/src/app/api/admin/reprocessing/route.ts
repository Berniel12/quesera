import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";
import { enqueue } from "@signal-map/queue";

export async function GET() {
  const supabase = await createClient();
  try { await requireAdmin(supabase); } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }

  const { data } = await supabase
    .from("reprocessing_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);
    const body = (await req.json()) as {
      scope_type: string;
      topic_id?: string;
      source_id?: string;
      time_window_start?: string;
      time_window_end?: string;
      trigger_snapshot_generation?: boolean;
      trigger_summarization?: boolean;
      trigger_topic_matching?: boolean;
      request_notes?: string;
      dry_run?: boolean;
    };

    // Validate scope
    if (body.scope_type === "topic" && !body.topic_id) return NextResponse.json({ error: "topic_id required" }, { status: 400 });
    if (body.scope_type === "source" && !body.source_id) return NextResponse.json({ error: "source_id required" }, { status: 400 });
    if (body.scope_type === "time_window" && (!body.time_window_start || !body.time_window_end)) return NextResponse.json({ error: "time window required" }, { status: 400 });

    // At least one trigger
    if (!body.trigger_snapshot_generation && !body.trigger_summarization && !body.trigger_topic_matching) {
      return NextResponse.json({ error: "At least one trigger required" }, { status: 400 });
    }

    // Create request
    const { data: request, error: reqErr } = await supabase
      .from("reprocessing_requests")
      .insert({
        scope_type: body.scope_type,
        topic_id: body.topic_id ?? null,
        source_id: body.source_id ?? null,
        time_window_start: body.time_window_start ?? null,
        time_window_end: body.time_window_end ?? null,
        trigger_snapshot_generation: body.trigger_snapshot_generation ?? false,
        trigger_summarization: body.trigger_summarization ?? false,
        trigger_topic_matching: body.trigger_topic_matching ?? false,
        requested_by: userId,
        request_notes: body.request_notes ?? null,
        dry_run: body.dry_run ?? false,
      })
      .select("id")
      .single();

    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 400 });

    const requestId = (request as { id: string }).id;
    let jobsEnqueued = 0;

    // Enqueue jobs (skip for dry run)
    if (!body.dry_run) {
      if (body.scope_type === "topic" && body.topic_id) {
        if (body.trigger_snapshot_generation) {
          await enqueue(supabase, { job_type: "snapshot_generation", payload: { topic_id: body.topic_id }, priority: 2 });
          jobsEnqueued++;
        }
        if (body.trigger_summarization) {
          await enqueue(supabase, { job_type: "summarization", payload: { topic_id: body.topic_id }, priority: 2 });
          jobsEnqueued++;
        }
      }

      if (body.scope_type === "source" && body.source_id) {
        if (body.trigger_topic_matching) {
          await enqueue(supabase, { job_type: "topic_matching", payload: { source_id: body.source_id }, priority: 2 });
          jobsEnqueued++;
        }
      }

      await supabase.from("reprocessing_requests").update({ jobs_enqueued_count: jobsEnqueued, status: "running", started_at: new Date().toISOString() }).eq("id", requestId);
    }

    await auditLog(supabase, userId, "reprocess_request", "reprocessing_request", requestId, null, { scope_type: body.scope_type, dry_run: body.dry_run, jobs_enqueued: jobsEnqueued });

    return NextResponse.json({ ok: true, reprocessing_request_id: requestId, jobs_enqueued: jobsEnqueued });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
