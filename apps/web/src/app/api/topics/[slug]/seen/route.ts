import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
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

  // Resolve topic + latest snapshot
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

  const { data: latest } = await supabase
    .from("topic_latest_snapshot")
    .select("snapshot_id")
    .eq("topic_id", topicId)
    .maybeSingle();

  if (!latest) {
    return NextResponse.json({ error: "No snapshot" }, { status: 404 });
  }

  const snapshotId = (latest as { snapshot_id: string }).snapshot_id;

  await supabase
    .from("user_topic_seen_snapshots")
    .upsert(
      {
        user_id: user.id,
        topic_id: topicId,
        last_seen_snapshot_id: snapshotId,
      },
      { onConflict: "user_id,topic_id" },
    );

  return NextResponse.json({ ok: true, lastSeenSnapshotId: snapshotId });
}
