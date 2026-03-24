import { NextResponse } from "next/server";
import { createSupabaseClient } from "@signal-map/db";
import { enqueue } from "@signal-map/queue";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient({ serviceRole: true });

  const { data: sources, error: sourcesError } = await supabase
    .from("source_definitions")
    .select("id, source_key, cadence_seconds")
    .eq("is_active", true);

  if (sourcesError || !sources) {
    return NextResponse.json(
      { error: "Failed to load sources" },
      { status: 500 },
    );
  }

  // Check queue depth -- don't flood if already backed up
  const { data: pendingCount } = await supabase
    .from("job_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("job_type", "source_sync");

  const queueDepth = (pendingCount as unknown as number) ?? 0;
  if (typeof queueDepth === "number" && queueDepth > 50) {
    return NextResponse.json({
      enqueued: [],
      skipped: ["queue_backed_up"],
      queueDepth,
      timestamp: new Date().toISOString(),
    });
  }

  const enqueued: string[] = [];
  const skipped: string[] = [];
  const now = new Date();

  for (const source of sources) {
    const src = source as {
      id: string;
      source_key: string;
      cadence_seconds: number;
    };

    const { data: health } = await supabase
      .from("source_health")
      .select("last_success_at")
      .eq("source_id", src.id)
      .single();

    const lastSuccess = (health as { last_success_at: string | null } | null)
      ?.last_success_at;
    const cadenceMs = src.cadence_seconds * 1000;
    const elapsed = lastSuccess
      ? now.getTime() - new Date(lastSuccess).getTime()
      : Infinity;

    if (elapsed < cadenceMs) {
      skipped.push(src.source_key);
      continue;
    }

    const timeWindow = Math.floor(now.getTime() / cadenceMs);
    const idempotencyKey = `source_sync:${src.source_key}:${timeWindow}`;

    try {
      await enqueue(supabase, {
        job_type: "source_sync",
        payload: { source_id: src.id },
        priority: src.cadence_seconds <= 600 ? 2 : 1,
        idempotency_key: idempotencyKey,
      });
      enqueued.push(src.source_key);
    } catch {
      skipped.push(src.source_key);
    }
  }

  return NextResponse.json({
    enqueued,
    skipped,
    timestamp: now.toISOString(),
  });
}
