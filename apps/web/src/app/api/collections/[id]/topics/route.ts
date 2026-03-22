import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: Add topic to collection (idempotent)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const body = (await request.json()) as { topic_id: string };

  // Idempotent: upsert with ignore duplicates
  await supabase
    .from("collection_topics")
    .upsert(
      { collection_id: id, topic_id: body.topic_id },
      { onConflict: "collection_id,topic_id", ignoreDuplicates: true },
    );

  return NextResponse.json({ ok: true });
}
