import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);

    const { data: source } = await supabase.from("source_definitions").select("is_active").eq("id", id).single();
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const current = (source as { is_active: boolean }).is_active;
    const newState = !current;

    await supabase.from("source_definitions").update({ is_active: newState }).eq("id", id);

    const action = newState ? "enable_source" : "disable_source";
    await auditLog(supabase, userId, action, "source_definition", id, { is_active: current }, { is_active: newState });

    return NextResponse.json({ ok: true, is_active: newState });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
