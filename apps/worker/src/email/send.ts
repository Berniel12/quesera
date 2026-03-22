import { Resend } from "resend";
import type { Logger } from "@signal-map/logger";

const APP_URL = process.env.APP_URL ?? "https://quesera.app";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface AlertEmailInput {
  to: string;
  topicName: string;
  topicSlug: string;
  direction: string;
  currentPicture: string | null;
  whatChanged: string | null;
}

interface DigestEmailInput {
  to: string;
  topics: Array<{
    name: string;
    slug: string;
    direction: string;
    oneLiner: string | null;
  }>;
  frequency: "daily" | "weekly";
}

export async function sendAlertEmail(
  input: AlertEmailInput,
  logger: Logger,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    logger.warn("RESEND_API_KEY not set, skipping email");
    return false;
  }

  try {
    await resend.emails.send({
      from: "QUESERA <alerts@quesera.app>",
      to: input.to,
      subject: `QUESERA: ${input.topicName} shifted to ${input.direction}`,
      html: buildAlertHtml(input),
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ to: input.to, error: msg }, "Failed to send alert email");
    return false;
  }
}

export async function sendDigestEmail(
  input: DigestEmailInput,
  logger: Logger,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    logger.warn("RESEND_API_KEY not set, skipping digest");
    return false;
  }

  try {
    const label = input.frequency === "weekly" ? "weekly" : "daily";
    await resend.emails.send({
      from: "QUESERA <digest@quesera.app>",
      to: input.to,
      subject: `QUESERA: Your ${label} signal update`,
      html: buildDigestHtml(input),
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ to: input.to, error: msg }, "Failed to send digest email");
    return false;
  }
}

function buildAlertHtml(input: AlertEmailInput): string {
  const topicUrl = `${APP_URL}/topics/${input.topicSlug}`;
  const name = escapeHtml(input.topicName);
  const picture = input.currentPicture
    ? escapeHtml(input.currentPicture)
    : `Direction shifted to ${escapeHtml(input.direction)}.`;
  const changed = input.whatChanged ? escapeHtml(input.whatChanged) : null;

  return `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 14px; font-weight: 700; color: #0B1326;">QUESERA</span>
      </div>
      <h1 style="font-size: 24px; font-weight: 700; color: #0B1326; margin: 0 0 16px;">${name}</h1>
      <p style="font-size: 16px; color: #0B1326; margin: 0 0 12px;">${picture}</p>
      ${changed ? `<p style="font-size: 14px; color: #8E8E93; margin: 0 0 24px;">${changed}</p>` : ""}
      <a href="${topicUrl}" style="display: inline-block; background: #0B1326; color: #FAF9F6; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 500;">
        View Topic
      </a>
      <p style="font-size: 12px; color: #8E8E93; margin-top: 32px;">
        Manage your alerts at ${APP_URL}/dashboard/settings
      </p>
    </div>
  `;
}

function buildDigestHtml(input: DigestEmailInput): string {
  const topicRows = input.topics
    .map((t) => {
      const name = escapeHtml(t.name);
      const oneLiner = t.oneLiner ? escapeHtml(t.oneLiner) : null;
      return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #E5E5EA;">
          <a href="${APP_URL}/topics/${t.slug}" style="color: #0B1326; text-decoration: none; font-weight: 600;">${name}</a>
          <span style="font-size: 12px; color: #8E8E93; margin-left: 8px;">${escapeHtml(t.direction)}</span>
          ${oneLiner ? `<p style="font-size: 13px; color: #8E8E93; margin: 4px 0 0;">${oneLiner}</p>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  return `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 14px; font-weight: 700; color: #0B1326;">QUESERA</span>
      </div>
      <h1 style="font-size: 20px; font-weight: 700; color: #0B1326; margin: 0 0 24px;">
        Your ${escapeHtml(input.frequency)} signal update
      </h1>
      <table style="width: 100%; border-collapse: collapse;">${topicRows}</table>
      <p style="font-size: 12px; color: #8E8E93; margin-top: 32px;">
        Manage your digest at ${APP_URL}/dashboard/settings
      </p>
    </div>
  `;
}
