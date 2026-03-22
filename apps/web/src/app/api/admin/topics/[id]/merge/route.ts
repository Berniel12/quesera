import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, auditLog, AdminAuthError } from "@/lib/admin/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);
    const body = (await req.json()) as { target_topic_id: string };

    const { data: source } = await supabase.from("topics").select("canonical_name, slug").eq("id", id).single();
    if (!source) return NextResponse.json({ error: "Source topic not found" }, { status: 404 });

    const src = source as { canonical_name: string; slug: string };

    // Mark source as merged
    await supabase.from("topics").update({ status: "merged" }).eq("id", id);

    // Add old slug as alias on target for search continuity
    await supabase.from("topic_aliases").upsert(
      { topic_id: body.target_topic_id, alias: src.slug },
      { onConflict: "topic_id,alias", ignoreDuplicates: true },
    );

    await auditLog(supabase, userId, "merge_topic", "topic", id, { status: "active", slug: src.slug }, { status: "merged", merged_into: body.target_topic_id });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.statusCode });
    throw e;
  }
}
