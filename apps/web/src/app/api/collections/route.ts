import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: List user's collections
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("collections")
    .select("id, title, description, is_public, slug, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ collections: data ?? [] });
}

// POST: Create collection
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { title: string; description?: string };

  const { data, error } = await supabase
    .from("collections")
    .insert({
      user_id: user.id,
      title: body.title,
      description: body.description ?? null,
    })
    .select("id, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, collection: data });
}
