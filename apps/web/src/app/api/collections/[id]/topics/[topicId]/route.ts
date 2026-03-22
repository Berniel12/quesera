import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE: Remove topic from collection (idempotent)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; topicId: string }> },
) {
  const { id, topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: col } = await supabase
    .from("collections")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent delete
  await supabase
    .from("collection_topics")
    .delete()
    .eq("collection_id", id)
    .eq("topic_id", topicId);

  return NextResponse.json({ ok: true });
}
