// Cron job entry point: triggers source sync via the web API
// Gracefully handles DB downtime -- exits 0 on transient errors to prevent Render alerts
export {};
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://quesera-web.onrender.com";
const SECRET = process.env.CRON_SECRET ?? "";

async function main() {
  const url = `${APP_URL}/api/cron/sync?secret=${SECRET}`;
  console.log(`Triggering sync: ${APP_URL}/api/cron/sync`);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const body = await res.text();
    console.log(`Status: ${res.status}`, body.slice(0, 300));

    if (res.ok) {
      process.exit(0);
    } else if (res.status >= 500) {
      // Server error (DB down, etc.) -- exit 0 so Render doesn't alert
      console.log("Server returned 5xx -- likely transient, will retry next cycle");
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    // Network error, timeout, ECONNRESET -- transient, don't fail the cron
    console.log("Connection error (transient):", err instanceof Error ? err.message : String(err));
    process.exit(0);
  }
}

main();
