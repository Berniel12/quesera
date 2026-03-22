import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, AdminAuthError } from "@/lib/admin/audit";

export async function GET(request: Request) {
  const supabase = await createClient();
  try { await requireAdmin(supabase); } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("job_queue")
    .select("id, job_type, status, priority, attempt_count, max_attempts, last_error_code, last_error_message, scheduled_for, claimed_at, completed_at, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data } = await query;

  return NextResponse.json({ jobs: data ?? [], page, limit });
}
