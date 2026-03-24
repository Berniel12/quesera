// Cron job entry point: triggers snapshot generation via the web API
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://quesera-web.onrender.com";
const SECRET = process.env.CRON_SECRET ?? "";

async function main() {
  const url = `${APP_URL}/api/cron/snapshots?secret=${SECRET}`;
  console.log(`Triggering snapshots: ${APP_URL}/api/cron/snapshots`);
  const res = await fetch(url);
  const body = await res.text();
  console.log(`Status: ${res.status}`, body.slice(0, 200));
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Cron snapshots failed:", err);
  process.exit(1);
});
