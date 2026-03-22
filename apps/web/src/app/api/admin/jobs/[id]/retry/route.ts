import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);

    // Load original job
    const { data: job } = await supabase.from("job_queue").select("job_type, payload, status, max_attempts, last_error_message").eq("id", id).single();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const j = job as { job_type: string; payload: Record<string, unknown>; status: string; max_attempts: number; last_error_message: string | null };

    // Only retry failed/dead
    if (j.status !== "failed" && j.status !== "dead") {
      return NextResponse.json({ error: `Cannot retry job with status '${j.status}'. Only failed/dead jobs can be retried.` }, { status: 400 });
    }

    // Guard: prevent retrying already-superseded jobs
    if (j.last_error_message?.startsWith("Superseded by")) {
      return NextResponse.json({ error: "This job was already retried. Check the superseding job instead." }, { status: 400 });
    }

    // Create new job
    const { data: newJob } = await supabase
      .from("job_queue")
      .insert({
        job_type: j.job_type,
        payload: j.payload,
        max_attempts: j.max_attempts,
        priority: 3,
      })
      .select("id")
      .single();

    const newId = (newJob as { id: string } | null)?.id;

    // Mark original as dead with superseded note
    await supabase.from("job_queue").update({
      status: "dead",
      dead_at: new Date().toISOString(),
      last_error_message: `Superseded by ${newId}`,
    }).eq("id", id);

    await auditLog(supabase, userId, "retry_job", "job_queue", newId ?? id, { original_id: id, original_error: j.last_error_message }, { new_job_id: newId });

    return NextResponse.json({ ok: true, new_job_id: newId });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
