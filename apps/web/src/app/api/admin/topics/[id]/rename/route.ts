import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);
    const body = (await req.json()) as { canonical_name: string; slug: string };

    const { data: old } = await supabase.from("topics").select("canonical_name, slug").eq("id", id).single();
    if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await supabase.from("topics").update({ canonical_name: body.canonical_name, slug: body.slug }).eq("id", id);
    await auditLog(supabase, userId, "rename_topic", "topic", id, old as Record<string, unknown>, body);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
