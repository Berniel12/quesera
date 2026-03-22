import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { action: string };
  const action = body.action;

  // Resolve topic ID from slug
  const { data: topic } = await supabase
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const topicId = (topic as { id: string }).id;

  if (action === "follow") {
    // Insert follow (idempotent)
    await supabase
      .from("user_followed_topics")
      .upsert(
        { user_id: user.id, topic_id: topicId },
        { onConflict: "user_id,topic_id", ignoreDuplicates: true },
      );

    // Insert seen snapshot with current latest
    const { data: latest } = await supabase
      .from("topic_latest_snapshot")
      .select("snapshot_id")
      .eq("topic_id", topicId)
      .maybeSingle();

    if (latest) {
      const snapId = (latest as { snapshot_id: string }).snapshot_id;
      await supabase
        .from("user_topic_seen_snapshots")
        .upsert(
          {
            user_id: user.id,
            topic_id: topicId,
            last_seen_snapshot_id: snapId,
          },
          { onConflict: "user_id,topic_id" },
        );
    }

    return NextResponse.json({ ok: true, following: true });
  }

  if (action === "unfollow") {
    await supabase
      .from("user_followed_topics")
      .delete()
      .eq("user_id", user.id)
      .eq("topic_id", topicId);

    await supabase
      .from("user_topic_seen_snapshots")
      .delete()
      .eq("user_id", user.id)
      .eq("topic_id", topicId);

    return NextResponse.json({ ok: true, following: false });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
