// Cron job entry point: triggers source sync via the web API
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://quesera-web.onrender.com";
const SECRET = process.env.CRON_SECRET ?? "";

async function main() {
  const url = `${APP_URL}/api/cron/sync?secret=${SECRET}`;
  console.log(`Triggering sync: ${APP_URL}/api/cron/sync`);
  const res = await fetch(url);
  const body = await res.text();
  console.log(`Status: ${res.status}`, body.slice(0, 200));
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Cron sync failed:", err);
  process.exit(1);
});
