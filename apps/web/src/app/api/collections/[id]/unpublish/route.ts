import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
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

  // Delete publication row
  await supabase
    .from("public_collection_publications")
    .delete()
    .eq("collection_id", id);

  // Set collections.is_public = false
  await supabase
    .from("collections")
    .update({ is_public: false })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
