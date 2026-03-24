import { NextResponse } from "next/server";
import { createSupabaseClient } from "@signal-map/db";
import { enqueue } from "@signal-map/queue";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient({ serviceRole: true });
  const enqueued: string[] = [];
  const skipped: string[] = [];
  const now = Date.now();
  const defaultCadenceMs = 3600 * 1000; // 1 hour default

  // Load topics that have accepted matches
  const { data: matchedTopics } = await supabase
    .from("source_item_topic_matches")
    .select("topic_id")
    .limit(1000);

  const topicIds = [
    ...new Set(
      ((matchedTopics ?? []) as Array<{ topic_id: string }>).map(
        (m) => m.topic_id,
      ),
    ),
  ];

  for (const topicId of topicIds) {
    // Check latest snapshot age
    const { data: latest } = await supabase
      .from("topic_latest_snapshot")
      .select("snapshot_id, updated_at")
      .eq("topic_id", topicId)
      .maybeSingle();

    const latestRow = latest as { snapshot_id: string; updated_at: string } | null;

    if (latestRow) {
      const age = now - new Date(latestRow.updated_at).getTime();
      if (age < defaultCadenceMs) {
        skipped.push(topicId);
        continue;
      }
    }

    // Enqueue snapshot generation
    try {
      await enqueue(supabase, {
        job_type: "snapshot_generation",
        payload: { topic_id: topicId },
        priority: 10,
      });
      enqueued.push(topicId);
    } catch {
      skipped.push(topicId);
    }
  }

  return NextResponse.json({
    enqueued_count: enqueued.length,
    skipped_count: skipped.length,
    timestamp: new Date().toISOString(),
  });
}
