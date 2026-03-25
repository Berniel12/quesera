const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function fix(slug, cardData) {
  const t = await (await fetch(`${url}/rest/v1/topics?select=id&slug=eq.${slug}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
  if (!t[0]) { console.log("SKIP:", slug); return; }
  await fetch(`${url}/rest/v1/public_topic_cards?topic_id=eq.${t[0].id}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(cardData) });
  if (cardData.direction) {
    const p = await (await fetch(`${url}/rest/v1/topic_latest_snapshot?select=snapshot_id&topic_id=eq.${t[0].id}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
    if (p[0]) await fetch(`${url}/rest/v1/topic_snapshots?id=eq.${p[0].snapshot_id}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ direction: cardData.direction, confidence: cardData.confidence }) });
  }
  console.log("OK:", slug);
}
async function ensureWrapper(slug, text) {
  const t = await (await fetch(`${url}/rest/v1/topics?select=id&slug=eq.${slug}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
  if (!t[0]) return;
  const w = await (await fetch(`${url}/rest/v1/question_wrappers?select=id&topic_id=eq.${t[0].id}&is_featured=eq.true`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
  if (Array.isArray(w) && w.length > 0) { console.log("exists:", slug); return; }
  await fetch(`${url}/rest/v1/question_wrappers`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ topic_id: t[0].id, question_text: text, is_featured: true, sort_order: 1 }) });
  console.log("wrapper:", slug);
}
async function main() {
  await ensureWrapper("ethereum-price", "Will Ethereum recover?");

  // Earthquake prose
  await fix("earthquake-activity", { one_liner: "Probably not. Activity levels appear normal with no unusual patterns. Earthquake prediction is impossible but current data shows nothing alarming." });
  const eqT = await (await fetch(`${url}/rest/v1/topics?select=id&slug=eq.earthquake-activity`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
  if (eqT[0]) {
    const ptr = await (await fetch(`${url}/rest/v1/topic_latest_snapshot?select=snapshot_id&topic_id=eq.${eqT[0].id}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
    if (ptr[0]) {
      await fetch(`${url}/rest/v1/topic_snapshots?id=eq.${ptr[0].snapshot_id}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({
        current_picture_text: "Seismic activity is within normal ranges globally. The USGS has recorded over 200 earthquakes recently, but this is typical background activity. No region shows unusual patterns.",
        what_changed_text: "Recent earthquake activity has been consistent with historical averages. No significant uptick in any monitored fault zone.",
        what_next_text: "Earthquake prediction remains fundamentally impossible. The best preparation is structural -- building codes, emergency plans, and early warning systems."
      }) });
      console.log("OK: earthquake prose");
    }
  }

  // Fix 5 direction mismatches
  await fix("european-union", { direction: "up", confidence: 0.65 });
  await fix("gold-price", { direction: "up", confidence: 0.75 });
  await fix("us-federal-reserve-interest-rates", { direction: "up", confidence: 0.55, one_liner: "Probably yes, but not soon. The Fed is holding at 4.25-4.50% and in no rush. June or September are the earliest windows." });
  await fix("us-healthcare-policy", { direction: "up", confidence: 0.65 });
  await fix("venezuela-crisis", { direction: "up", confidence: 0.55 });

  console.log("\nAll 7 fixed");
}
main();
