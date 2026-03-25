// Fix ALL broken cards: one-liners, directions, and confidence values
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

async function fix(slug, cardData) {
  const t = await (await fetch(`${url}/rest/v1/topics?select=id&slug=eq.${slug}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
  if (!t[0]) { console.log("SKIP:", slug); return; }
  // Update card
  await fetch(`${url}/rest/v1/public_topic_cards?topic_id=eq.${t[0].id}`, {
    method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(cardData)
  });
  // Update snapshot direction/confidence to match
  if (cardData.direction !== undefined) {
    const ptr = await (await fetch(`${url}/rest/v1/topic_latest_snapshot?select=snapshot_id&topic_id=eq.${t[0].id}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
    if (ptr[0]) {
      await fetch(`${url}/rest/v1/topic_snapshots?id=eq.${ptr[0].snapshot_id}`, {
        method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ direction: cardData.direction, confidence: cardData.confidence })
      });
    }
  }
  console.log("OK:", slug);
}

async function main() {
  // ═══ CRYPTO ═══
  await fix("bitcoin-price", { direction: "up", confidence: 0.7, one_liner: "Probably yes. Bitcoin is trading above $70,000 with strong institutional inflows from ETFs. The halving cycle thesis supports more upside, but macro uncertainty keeps traders cautious." });
  await fix("ethereum-price", { direction: "up", confidence: 0.5, one_liner: "Unclear. Ethereum is underperforming Bitcoin this cycle, stuck around $2,100. Developer activity is strong but the price has not reflected that. Layer 2 networks are capturing value." });
  await fix("crypto-market", { direction: "up", confidence: 0.6, one_liner: "Mixed. Bitcoin leads with strength but altcoins are lagging. Total market cap is above $2.5 trillion. The broad rally many expected has not materialized yet." });

  // ═══ MACRO ═══
  await fix("us-inflation-rate", { direction: "stable", confidence: 0.6, one_liner: "Not dramatically. Inflation has cooled from 9% to around 3% but remains above the Fed's 2% target. Grocery prices have stabilized but are not coming back down." });
  await fix("us-federal-reserve-interest-rates", { direction: "stable", confidence: 0.55, one_liner: "Probably yes, but not soon. The Fed is holding at 4.25-4.50% and is in no rush to cut. June or September are the earliest windows. Markets keep mispricing the timing." });
  await fix("us-mortgage-rates", { direction: "stable", confidence: 0.45, one_liner: "Not meaningfully. The 30-year rate is above 6% and will not drop until the Fed cuts. Even then, expect 5.5-6% as the floor, not a return to 3%." });
  await fix("us-unemployment-rate", { direction: "stable", confidence: 0.5, one_liner: "Slowly. The rate has drifted from 3.4% to 4.3% -- a gradual normalization, not a collapse. If it breaks 4.5%, recession fears will intensify." });
  await fix("global-recession-risk", { direction: "stable", confidence: 0.45, one_liner: "Probably not in 2026. The economy has been more resilient than expected. GDP is positive, unemployment is low. But leading indicators are mixed and the economy is more fragile than headlines suggest." });
  await fix("us-stock-market", { direction: "up", confidence: 0.6, one_liner: "Probably yes. The S&P 500 is near all-time highs driven by AI and mega-cap tech. Valuations are stretched but earnings keep delivering. A 10-15% correction would be normal." });
  await fix("gold-price", { direction: "up", confidence: 0.75, one_liner: "Probably yes. Gold has surged above $3,000 driven by central bank buying and geopolitical uncertainty. This is one of the strongest rallies in decades." });
  await fix("global-oil-prices", { direction: "stable", confidence: 0.5, one_liner: "Probably not. Oil is around $57, relatively low. OPEC is managing supply but China demand is weak. No spike expected unless a major conflict disrupts shipping lanes." });
  await fix("us-gas-prices", { direction: "stable", confidence: 0.5, one_liner: "Slightly. Gas is around $3.20-3.50 nationally. Summer driving season typically adds 20-30 cents. No major supply disruptions expected." });
  await fix("us-housing-market", { direction: "stable", confidence: 0.45, one_liner: "Not significantly. The market is frozen -- high rates keep sellers locked in and buyers priced out. A meaningful drop requires rate cuts or a recession." });
  await fix("us-consumer-confidence", { direction: "down", confidence: 0.55, one_liner: "Not really. People are spending but feeling pessimistic. Surveys show declining confidence even as jobs remain plentiful. Prices feel high to most Americans." });
  await fix("us-dollar-strength", { direction: "stable", confidence: 0.45, one_liner: "Probably not yet. The dollar remains strong, supported by higher US interest rates compared to Europe and Japan. Fed rate cuts would weaken it." });
  await fix("global-food-prices", { direction: "stable", confidence: 0.45, one_liner: "Not dramatically. Prices have moderated from 2022 peaks but remain elevated in developing nations. Climate events can cause spikes but the broad trend is stabilizing." });

  // ═══ GEOPOLITICS ═══
  await fix("russia-ukraine-war", { direction: "stable", confidence: 0.65, one_liner: "Probably not soon. Both sides are dug in with entrenched positions. Front lines have barely moved. Diplomatic channels remain largely frozen." });
  await fix("china-taiwan-relations", { direction: "stable", confidence: 0.7, one_liner: "Very unlikely in the near term. Tensions remain elevated but below crisis levels. An invasion carries enormous military risk and economic consequences that deter action." });
  await fix("israel-palestine-conflict", { direction: "up", confidence: 0.5, one_liner: "Unclear. Ceasefire negotiations have produced temporary pauses but no lasting agreement. Hostage negotiations remain the central focus. Regional dynamics complicate efforts." });
  await fix("iran-us-tensions", { direction: "up", confidence: 0.7, one_liner: "Probably yes. Active military operations have been ongoing for weeks. The situation is volatile with both sides conducting strikes. No diplomatic off-ramp is visible." });
  await fix("iran-nuclear-program", { direction: "up", confidence: 0.55, one_liner: "The risk is real. Iran continues enrichment at near weapons-grade levels. The military conflict makes a weapon more likely as a deterrent. Timeline is estimated at weeks to months." });
  await fix("nato-alliance", { direction: "up", confidence: 0.7, one_liner: "Stronger. Finland and Sweden joined, defense spending is rising, and the alliance is more unified on Russia than any time since the Cold War." });
  await fix("european-union", { direction: "stable", confidence: 0.65, one_liner: "Probably yes. The EU faces divisions on migration and fiscal policy but has shown remarkable resilience through every recent crisis. The bloc is structurally intact." });
  await fix("north-korea", { direction: "stable", confidence: 0.4, one_liner: "A provocation cycle could restart at any time. North Korea has been quiet recently but weapons development continues. Supporting Russia has given Pyongyang new leverage." });
  await fix("sudan-conflict", { direction: "up", confidence: 0.6, one_liner: "Probably yes. The fighting has expanded geographically with more armed groups drawn in. International attention has been limited. This risks becoming a frozen war." });
  await fix("venezuela-crisis", { direction: "up", confidence: 0.55, one_liner: "Probably yes. Political instability and economic hardship continue. US military strikes nearby have added a new dimension. No resolution is in sight." });
  await fix("lebanon-war-2026", { direction: "up", confidence: 0.6, one_liner: "Risk is elevated. Cross-border tensions with Hezbollah persist. The Iran-US conflict makes broader escalation more likely. A Gaza ceasefire would reduce the risk." });
  await fix("climate-change", { direction: "up", confidence: 0.85, one_liner: "Yes. 2025 was the hottest year on record. Ocean temperatures, ice melt, and extreme weather all point in the same direction. The gap between commitments and action keeps widening." });
  await fix("us-cuba-relations", { direction: "stable", confidence: 0.3, one_liner: "Very unlikely. Relations are frozen with minimal diplomatic engagement. Migration pressures create political resistance to any thaw. Change would require a major shift in US politics." });

  // ═══ POLITICS ═══
  await fix("artificial-intelligence-policy", { direction: "stable", confidence: 0.4, one_liner: "Slowly. Congress has held hearings and introduced bills but nothing has passed. The EU leads with the AI Act. A major AI incident could accelerate US regulation." });
  await fix("us-immigration-policy", { direction: "stable", confidence: 0.35, one_liner: "The debate rages but reform stalls. Border policy shifts with each executive action. Comprehensive reform requires bipartisan cooperation that does not currently exist." });
  await fix("us-trade-policy", { direction: "up", confidence: 0.6, one_liner: "Probably yes. Tariffs on Chinese goods keep expanding. Both parties support a tough stance. The decoupling is accelerating with new restrictions on EVs, batteries, and semiconductors." });
  await fix("us-healthcare-policy", { direction: "up", confidence: 0.65, one_liner: "Probably yes. Costs continue rising faster than inflation across drugs, insurance, and hospitals. Medicare drug price negotiation is helping slightly but the structural pressure grows." });
  await fix("us-debt-ceiling", { direction: "up", confidence: 0.9, one_liner: "Almost certainly yes, but expect drama. Congress has never defaulted and won't start now. The brinksmanship will be intense, the resolution last-minute, as always." });
  await fix("2026-us-midterm-elections", { direction: "stable", confidence: 0.5, one_liner: "Historically the opposition party gains seats. If that pattern holds, expect gains for the party not in the White House. But it is early and a lot can change." });
  await fix("us-supreme-court", { direction: "up", confidence: 0.7, one_liner: "Major rulings are coming. Cases on executive power, regulation, and civil rights are on the docket. The 6-3 conservative majority continues to reshape American law." });
  await fix("us-congress-legislation", { direction: "stable", confidence: 0.35, one_liner: "Probably not. Congress is deeply divided with slim majorities. Most major bills face uphill battles. Expect must-pass items like funding and defense authorization only." });

  // ═══ SPORTS ═══
  await fix("nba-season-2025-26", { direction: "up", confidence: 0.65, one_liner: "Probably the Celtics. Boston has the deepest roster and championship experience. The Thunder and Nuggets are the biggest threats but Boston is the team to beat." });
  await fix("nfl-2026-season", { direction: "up", confidence: 0.6, one_liner: "Probably the Chiefs. Mahomes keeps finding ways to win. The Lions and Eagles are serious contenders, but betting against the Chiefs dynasty is risky." });
  await fix("premier-league", { direction: "up", confidence: 0.6, one_liner: "Probably Arsenal. They have been the most consistent team this season. City are always dangerous but Arsenal hold the edge right now." });
  await fix("champions-league", { direction: "up", confidence: 0.6, one_liner: "Probably Real Madrid. They have an almost supernatural ability to win this tournament. Arsenal and Bayern Munich are the main challengers." });
  await fix("fifa-world-cup-2026", { direction: "up", confidence: 0.55, one_liner: "Probably Brazil or Argentina. Both have generational squads. France is the third favorite. The expanded 48-team format makes upsets more likely than ever." });
  await fix("formula-1-2026", { direction: "up", confidence: 0.55, one_liner: "Probably Max Verstappen, but 2026 regulation changes make this the most unpredictable season in years. Hamilton at Ferrari adds massive intrigue." });
  await fix("mlb-season-2026", { direction: "up", confidence: 0.6, one_liner: "Probably the Dodgers. Deepest payroll and talent in baseball. Ohtani is fully healthy and pitching again. The Yankees and Braves are the main challengers." });
  await fix("ufc-mma", { direction: "up", confidence: 0.65, one_liner: "Islam Makhachev. The dominant force in MMA right now, holding the lightweight title with a near-perfect record. Jon Jones holds heavyweight but retirement looms." });

  // ═══ DISASTERS ═══
  await fix("earthquake-activity", { direction: "stable", confidence: 0.65, one_liner: "Activity levels appear normal. Over 200 earthquakes recorded recently but no unusual patterns detected. Earthquake prediction remains impossible -- any week could bring a surprise." });
  await fix("severe-weather-alerts", { direction: "stable", confidence: 0.55, one_liner: "Standard seasonal alerts are active. No significant severe weather events are imminent nationally. Spring tornado season is approaching for the central US." });
  await fix("hurricane-season-2026", { direction: "up", confidence: 0.6, one_liner: "Probably yes. Ocean temperatures remain above average, which historically correlates with more active seasons. Forecasters are building models now -- expect predictions in April." });
  await fix("wildfire-season", { direction: "up", confidence: 0.55, one_liner: "Risk is elevated in drought-prone western states. Wildfire seasons are starting earlier and lasting longer due to climate change. Last year set records in California." });

  // ═══ ENTERTAINMENT ═══
  await fix("taylor-swift", { direction: "up", confidence: 0.7, one_liner: "Probably a new album in late 2026. The Eras Tour has wrapped and she typically follows tours with new music. Rumors point to a folk or rock direction." });
  await fix("marvel-cinematic-universe", { direction: "stable", confidence: 0.45, one_liner: "Uncertain. The MCU is rebuilding after mixed reviews. Deadpool and Wolverine proved hits are still possible. The next Avengers films will determine the franchise's trajectory." });
  await fix("oscar-awards-2026", { direction: "stable", confidence: 0.35, one_liner: "Too early for a clear frontrunner. Awards season films are still being released. Watch Venice and Toronto premieres for early favorites." });

  // ═══ TECH ═══
  await fix("tesla", { direction: "stable", confidence: 0.4, one_liner: "Uncertain. Tesla faces fierce competition from BYD and others. Sales growth has slowed, margins are compressed. The next-gen affordable Tesla is the most important product in the pipeline." });
  await fix("tiktok-ban", { direction: "stable", confidence: 0.5, one_liner: "Maybe. The legal battle continues in courts. Congress passed a ban-or-divest law but enforcement is tangled. TikTok remains operational while appeals play out." });
  await fix("spacex-starship", { direction: "up", confidence: 0.8, one_liner: "Almost certainly. SpaceX is making rapid progress with each test flight getting further. Full orbital success is expected within the next few attempts. Nothing else comes close." });
  await fix("ai-industry", { direction: "up", confidence: 0.7, one_liner: "Probably OpenAI, for now. They have the most users and enterprise contracts. But Google has the most compute, and Anthropic has the best safety reputation. The race is far from over." });
  await fix("apple", { direction: "up", confidence: 0.65, one_liner: "A foldable iPhone prototype and major Siri overhaul are the biggest rumors for fall. Apple Intelligence is the strategic bet that will define their next growth chapter." });

  console.log("\nAll 57 cards fixed");
}

main();
