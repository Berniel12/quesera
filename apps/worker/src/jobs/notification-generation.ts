import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { sendAlertEmail } from "../email/send.js";

// Sensitivity matching: which trigger types qualify for each level
const SENSITIVITY_TRIGGERS: Record<string, string[]> = {
  all: ["direction_change", "confidence_change"],
  balanced: ["direction_change", "confidence_change"],
  high_impact: ["direction_change"],
};

export async function handleNotificationGeneration(
  job: Job,
  logger: Logger,
  supabase: SupabaseClient,
): Promise<void> {
  const payload = job.payload as {
    topic_id: string;
    snapshot_id: string;
    trigger_type: string;
  };
  const startTime = Date.now();
  let sentCount = 0;
  let skippedCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;

  // 1. Load topic + snapshot (public-safe data only)
  const { data: topic } = await supabase
    .from("topics")
    .select("canonical_name, slug")
    .eq("id", payload.topic_id)
    .single();

  if (!topic) {
    logger.warn({ topicId: payload.topic_id }, "Topic not found for notification");
    return;
  }

  const t = topic as { canonical_name: string; slug: string };

  const { data: snapshot } = await supabase
    .from("topic_snapshots")
    .select("direction, confidence, current_picture_text, what_changed_text")
    .eq("id", payload.snapshot_id)
    .single();

  if (!snapshot) {
    logger.warn({ snapshotId: payload.snapshot_id }, "Snapshot not found");
    return;
  }

  const snap = snapshot as {
    direction: string;
    confidence: number;
    current_picture_text: string | null;
    what_changed_text: string | null;
  };

  // 2. Load followers
  const { data: followers } = await supabase
    .from("user_followed_topics")
    .select("user_id")
    .eq("topic_id", payload.topic_id);

  if (!followers || followers.length === 0) {
    logger.info({ topicId: payload.topic_id }, "No followers to notify");
    return;
  }

  // 3. Process each follower
  for (const f of followers as Array<{ user_id: string }>) {
    // a. Check global mute + email enabled
    const { data: prefs } = await supabase
      .from("user_notification_preferences")
      .select("global_mute, email_enabled, alert_sensitivity")
      .eq("user_id", f.user_id)
      .maybeSingle();

    const userPrefs = prefs as {
      global_mute: boolean;
      email_enabled: boolean;
      alert_sensitivity: string;
    } | null;

    if (userPrefs?.global_mute) { skippedCount++; continue; }
    if (userPrefs && !userPrefs.email_enabled) { skippedCount++; continue; }

    // b. Check topic-specific alert settings
    const { data: alertRow } = await supabase
      .from("alerts")
      .select("sensitivity, is_muted")
      .eq("user_id", f.user_id)
      .eq("topic_id", payload.topic_id)
      .maybeSingle();

    const topicAlert = alertRow as { sensitivity: string; is_muted: boolean } | null;

    if (topicAlert?.is_muted) { skippedCount++; continue; }

    // c. Resolve effective sensitivity
    const sensitivity = topicAlert?.sensitivity ?? userPrefs?.alert_sensitivity ?? "balanced";
    const allowedTriggers = SENSITIVITY_TRIGGERS[sensitivity] ?? ["direction_change", "confidence_change"];

    if (!allowedTriggers.includes(payload.trigger_type)) {
      skippedCount++;
      continue;
    }

    // d. Dedupe: check existing notification for this user+snapshot+channel
    const { data: existing } = await supabase
      .from("notification_events")
      .select("id")
      .eq("user_id", f.user_id)
      .eq("snapshot_id", payload.snapshot_id)
      .eq("channel", "email")
      .neq("delivery_status", "failed")
      .maybeSingle();

    if (existing) { dedupedCount++; continue; }

    // e. Create notification event (pending)
    const { data: event } = await supabase
      .from("notification_events")
      .insert({
        user_id: f.user_id,
        topic_id: payload.topic_id,
        snapshot_id: payload.snapshot_id,
        trigger_type: payload.trigger_type,
        channel: "email",
        delivery_status: "pending",
      })
      .select("id")
      .single();

    const eventId = (event as { id: string } | null)?.id;

    // f. Get user email
    const { data: authUser } = await supabase.auth.admin.getUserById(f.user_id);
    const email = authUser?.user?.email;

    if (!email) {
      if (eventId) {
        await supabase
          .from("notification_events")
          .update({ delivery_status: "failed", delivery_error: "No email address" })
          .eq("id", eventId);
      }
      failedCount++;
      continue;
    }

    // g. Send email
    const success = await sendAlertEmail(
      {
        to: email,
        topicName: t.canonical_name,
        topicSlug: t.slug,
        direction: snap.direction,
        currentPicture: snap.current_picture_text,
        whatChanged: snap.what_changed_text,
      },
      logger,
    );

    // h. Update delivery status
    if (eventId) {
      await supabase
        .from("notification_events")
        .update({
          delivery_status: success ? "sent" : "failed",
          sent_at: success ? new Date().toISOString() : null,
          delivery_error: success ? null : "Send failed",
        })
        .eq("id", eventId);
    }

    if (success) sentCount++;
    else failedCount++;
  }

  logger.info(
    {
      topic_id: payload.topic_id,
      snapshot_id: payload.snapshot_id,
      eligible_users: (followers as Array<unknown>).length,
      sent_count: sentCount,
      skipped_count: skippedCount,
      deduped_count: dedupedCount,
      failed_count: failedCount,
      duration_ms: Date.now() - startTime,
    },
    "Notification generation completed",
  );
}
