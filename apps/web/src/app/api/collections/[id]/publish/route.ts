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

  // Verify ownership + load collection
  const { data: col } = await supabase
    .from("collections")
    .select("id, title, description, slug")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const c = col as { id: string; title: string; description: string | null; slug: string | null };

  // Generate slug from title
  const slug = c.slug ?? c.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

  // Check slug uniqueness (different collection with same slug)
  const { data: existing } = await supabase
    .from("public_collection_publications")
    .select("collection_id")
    .eq("slug", slug)
    .neq("collection_id", id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Slug "${slug}" is already taken by another collection` },
      { status: 409 },
    );
  }

  // Load topics in collection
  const { data: topics } = await supabase
    .from("collection_topics")
    .select("topic_id")
    .eq("collection_id", id);

  const topicIds = ((topics ?? []) as Array<{ topic_id: string }>).map((t) => t.topic_id);

  // Upsert publication row (one per collection)
  const { error: pubError } = await supabase
    .from("public_collection_publications")
    .upsert(
      {
        collection_id: id,
        slug,
        title: c.title,
        description: c.description,
        topic_ids: topicIds,
      },
      { onConflict: "collection_id" },
    );

  if (pubError) {
    return NextResponse.json({ error: pubError.message }, { status: 400 });
  }

  // Set collections.is_public + slug
  await supabase
    .from("collections")
    .update({ is_public: true, slug })
    .eq("id", id);

  return NextResponse.json({ ok: true, slug });
}
