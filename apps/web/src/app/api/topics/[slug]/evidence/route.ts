import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();

  // Resolve topic
  const { data: topic } = await supabase
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_public", true)
    .single();

  if (!topic) {
    return NextResponse.json({ items: [] }, { status: 404 });
  }

  const topicId = (topic as { id: string }).id;

  // Get matched source items for this topic
  const { data: matches } = await supabase
    .from("source_item_topic_matches")
    .select("source_item_id")
    .eq("topic_id", topicId)
    .limit(50);

  if (!matches || matches.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const itemIds = (matches as Array<{ source_item_id: string }>).map(
    (m) => m.source_item_id,
  );

  const { data: items } = await supabase
    .from("source_items")
    .select("id, source_key, source_item_type, external_id, normalized_payload, occurred_at")
    .in("id", itemIds)
    .eq("is_active", true)
    .order("occurred_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ items: items ?? [] });
}
