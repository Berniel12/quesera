import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);
    const body = (await req.json()) as { review_notes?: string };

    await supabase.from("topic_candidates").update({
      status: "rejected",
      review_notes: body.review_notes ?? null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    await auditLog(supabase, userId, "reject_candidate", "topic_candidate", id, { status: "pending" }, { status: "rejected", review_notes: body.review_notes });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
