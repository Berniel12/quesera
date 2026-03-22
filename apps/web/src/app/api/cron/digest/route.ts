import { NextResponse } from "next/server";
import { createSupabaseClient } from "@signal-map/db";
import { Resend } from "resend";

const APP_URL = process.env.APP_URL ?? "https://quesera.app";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const frequency = (searchParams.get("frequency") ?? "daily") as "daily" | "weekly";

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient({ serviceRole: true });
  let usersProcessed = 0;
  let digestsSent = 0;
  let noChangeSkipped = 0;
  let failedCount = 0;

  const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  // Load users with matching digest frequency
  const { data: prefs } = await supabase
    .from("user_notification_preferences")
    .select("user_id")
    .eq("digest_frequency", frequency)
    .eq("email_enabled", true)
    .eq("global_mute", false);

  for (const p of (prefs ?? []) as Array<{ user_id: string }>) {
    usersProcessed++;

    // Last digest timestamp
    const { data: lastDigest } = await supabase
      .from("notification_events")
      .select("created_at")
      .eq("user_id", p.user_id)
      .eq("trigger_type", `digest_${frequency}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const windowMs = frequency === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const since = (lastDigest as { created_at: string } | null)?.created_at
      ?? new Date(Date.now() - windowMs).toISOString();

    // Followed topics with updated snapshots
    const { data: follows } = await supabase
      .from("user_followed_topics")
      .select("topic_id")
      .eq("user_id", p.user_id);

    if (!follows || follows.length === 0) { noChangeSkipped++; continue; }

    const topicIds = (follows as Array<{ topic_id: string }>).map((f) => f.topic_id);
    const { data: updated } = await supabase
      .from("topic_latest_snapshot")
      .select("topic_id")
      .in("topic_id", topicIds)
      .gt("updated_at", since);

    if (!updated || updated.length === 0) { noChangeSkipped++; continue; }

    // Load topic details for email content
    const changedIds = (updated as Array<{ topic_id: string }>).map((u) => u.topic_id);
    const { data: cards } = await supabase
      .from("public_topic_cards")
      .select("canonical_name, slug, direction, one_liner")
      .in("topic_id", changedIds);

    const topics = ((cards ?? []) as Array<{
      canonical_name: string;
      slug: string;
      direction: string | null;
      one_liner: string | null;
    }>).map((c) => ({
      name: escapeHtml(c.canonical_name),
      slug: c.slug,
      direction: c.direction ?? "unknown",
      oneLiner: c.one_liner ? escapeHtml(c.one_liner) : null,
    }));

    if (topics.length === 0) { noChangeSkipped++; continue; }

    // Get user email
    const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id);
    const email = authUser?.user?.email;
    if (!email) { failedCount++; continue; }

    // Create notification event
    const { data: event } = await supabase
      .from("notification_events")
      .insert({
        user_id: p.user_id,
        trigger_type: `digest_${frequency}`,
        channel: "email",
        delivery_status: "pending",
      })
      .select("id")
      .single();

    const eventId = (event as { id: string } | null)?.id;

    // Send digest email
    let sent = false;
    if (resend) {
      try {
        const label = frequency === "weekly" ? "weekly" : "daily";
        const topicRows = topics.map((t) =>
          `<tr><td style="padding:12px 0;border-bottom:1px solid #E5E5EA;">
            <a href="${APP_URL}/topics/${t.slug}" style="color:#0B1326;text-decoration:none;font-weight:600;">${t.name}</a>
            <span style="font-size:12px;color:#8E8E93;margin-left:8px;">${t.direction}</span>
            ${t.oneLiner ? `<p style="font-size:13px;color:#8E8E93;margin:4px 0 0;">${t.oneLiner}</p>` : ""}
          </td></tr>`,
        ).join("");

        await resend.emails.send({
          from: "QUESERA <digest@quesera.app>",
          to: email,
          subject: `QUESERA: Your ${label} signal update`,
          html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
            <div style="margin-bottom:24px;"><span style="font-size:14px;font-weight:700;color:#0B1326;">QUESERA</span></div>
            <h1 style="font-size:20px;font-weight:700;color:#0B1326;margin:0 0 24px;">Your ${label} signal update</h1>
            <table style="width:100%;border-collapse:collapse;">${topicRows}</table>
            <p style="font-size:12px;color:#8E8E93;margin-top:32px;">Manage your digest at ${APP_URL}/dashboard/settings</p>
          </div>`,
        });
        sent = true;
      } catch {
        sent = false;
      }
    }

    // Update delivery status
    if (eventId) {
      await supabase
        .from("notification_events")
        .update({
          delivery_status: sent ? "sent" : "failed",
          sent_at: sent ? new Date().toISOString() : null,
          delivery_error: sent ? null : "Send failed or no API key",
        })
        .eq("id", eventId);
    }

    if (sent) digestsSent++;
    else failedCount++;
  }

  return NextResponse.json({
    frequency,
    users_processed: usersProcessed,
    digests_sent: digestsSent,
    no_change_skipped: noChangeSkipped,
    failed_count: failedCount,
    timestamp: new Date().toISOString(),
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
