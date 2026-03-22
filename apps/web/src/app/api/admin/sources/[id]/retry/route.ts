import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";
import { enqueue } from "@signal-map/queue";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);

    const jobId = await enqueue(supabase, {
      job_type: "source_sync",
      payload: { source_id: id },
      priority: 3,
    });

    await auditLog(supabase, userId, "backfill_source", "source_definition", id, null, null, { job_id: jobId });
    return NextResponse.json({ ok: true, job_id: jobId });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
