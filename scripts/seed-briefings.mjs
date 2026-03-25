// One-time script: seed rich briefings for all topics
// Run: node scripts/seed-briefings.mjs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function q(table, select, params) {
  let u = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (params) u += `&${params}`;
  return (await fetch(u, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) })).json();
}

const BRIEFINGS = {
  "bitcoin-price": {
    current: "Bitcoin is trading around $70,000 after a strong rally earlier this year. The market is in a consolidation phase -- not crashing, not surging, just digesting the gains. Institutional interest remains high with Bitcoin ETFs seeing steady inflows. The halving cycle thesis suggests more upside, but macro uncertainty (Fed policy, geopolitics) is keeping traders cautious.",
    changed: "Bitcoin briefly touched new highs above $73,000 before pulling back. Trading volume has stabilized. The ETF narrative that drove the initial rally has matured -- it is no longer a catalyst, just a steady bid.",
    next: "Watch the Federal Reserve rate decision timeline. Rate cuts would likely push Bitcoin higher. Also monitor ETF flow data weekly -- sustained outflows would be a warning sign."
  },
  "ethereum-price": {
    current: "Ethereum is trading around $2,100, underperforming Bitcoin this cycle. The transition to proof-of-stake is complete but Layer 2 networks are capturing value that used to go to ETH. Developer activity remains strong but the price has not reflected that.",
    changed: "Ethereum has been range-bound while Bitcoin made new highs. The ETH/BTC ratio has weakened. Ethereum ETF approval expectations shifted the narrative briefly but did not produce a sustained rally.",
    next: "The key question is whether Ethereum can recapture the narrative. Watch for the Dencun upgrade impact on L2 fees and monitor the ETH/BTC ratio."
  },
  "crypto-market": {
    current: "The crypto market is in a mixed state. Bitcoin leads with strength, but altcoins are lagging. Total market cap has stabilized above $2.5 trillion. Meme coins and AI tokens have grabbed attention but the fundamentals-driven rally many expected has not materialized across the board.",
    changed: "Market leadership has narrowed to Bitcoin and a few large caps. The altcoin season that many predicted has not arrived. DeFi TVL is stable but not growing dramatically.",
    next: "Watch for a rotation from Bitcoin into altcoins -- this typically happens later in bull cycles. Ethereum performance will be the bellwether."
  },
  "us-inflation-rate": {
    current: "Inflation has cooled significantly from its 2022 peak of 9% but remains sticky above the Fed target of 2%. The CPI is around 3%, driven by persistent shelter costs and services inflation. Grocery prices have largely stabilized but are not coming back down.",
    changed: "The pace of disinflation has slowed. Month-over-month readings have been uneven. The market narrative has shifted from 'inflation is beaten' to 'the last mile is the hardest.'",
    next: "Watch the shelter component -- it is the largest driver of remaining inflation. Also monitor energy prices, which could reignite headline inflation if oil spikes."
  },
  "us-federal-reserve-interest-rates": {
    current: "The Federal Reserve has held rates at 4.25-4.50% for several months. The Fed is in no rush to cut, preferring to wait for clear evidence that inflation is sustainably declining. Markets have repeatedly mispriced the timing of cuts.",
    changed: "Expectations for 2026 rate cuts have been pushed back multiple times. The dot plot suggests 1-2 cuts this year, but the market has swung between expecting zero and three.",
    next: "The June and September FOMC meetings are the most likely windows for a first cut. Watch employment data -- if unemployment rises significantly, the Fed may cut even without perfect inflation data."
  },
  "us-mortgage-rates": {
    current: "The 30-year fixed mortgage rate is above 6%, keeping the housing market frozen. Buyers are priced out, sellers refuse to list because they are locked into sub-4% rates, and transaction volume is at multi-decade lows.",
    changed: "Rates have fluctuated between 6% and 7% but have not meaningfully declined. The brief dip below 6.5% in late 2025 brought a surge of applications, showing massive pent-up demand.",
    next: "Rates will not meaningfully decline until the Fed cuts. Even then, expect 5.5-6% as the floor. Watch the 10-year Treasury yield -- it is the best leading indicator for mortgage rate direction."
  },
  "us-unemployment-rate": {
    current: "The unemployment rate sits at 4.3%, historically low but slightly above the 2023 lows of 3.4%. The labor market is cooling but not collapsing. Job openings have declined, hiring has slowed, but layoffs remain contained.",
    changed: "The rate has drifted up from 3.4% to 4.3% over 18 months. This is a gradual normalization, not a cliff.",
    next: "Monthly jobs reports are the most important data release. If unemployment breaks above 4.5%, recession fears will intensify. Watch initial jobless claims weekly."
  },
  "global-recession-risk": {
    current: "The US economy has been more resilient than almost anyone expected. GDP growth is positive, consumer spending is solid, and unemployment is low. However, leading indicators are mixed -- manufacturing is weak, credit conditions are tightening, and consumer confidence is declining.",
    changed: "Recession predictions from 2023-2024 were proven wrong. The economy absorbed aggressive rate hikes without breaking. But the lagged effects of tight monetary policy may still be working through the system.",
    next: "Watch the yield curve, consumer spending growth, and bank lending standards. A recession is not the base case for 2026, but the economy is more fragile than the headline numbers suggest."
  },
  "us-stock-market": {
    current: "The S&P 500 is near all-time highs, driven primarily by mega-cap tech stocks and the AI narrative. Market breadth is narrow -- a handful of companies account for most of the gains. Valuations are stretched by historical standards.",
    changed: "The market has shrugged off geopolitical risks, inflation concerns, and rate uncertainty. AI enthusiasm has been the dominant force. Earnings have mostly met expectations.",
    next: "Watch for earnings revisions -- if AI spending does not translate to revenue growth, the bubble narrative takes over. A correction of 10-15% would be normal and healthy."
  },
  "gold-price": {
    current: "Gold has surged above $3,000 per ounce, driven by central bank buying, geopolitical uncertainty, and inflation hedging. This is one of the strongest gold rallies in decades.",
    changed: "Central bank purchases have hit record levels. De-dollarization trends and geopolitical instability are structural drivers.",
    next: "Gold tends to do well when real interest rates fall -- so Fed cuts would be bullish. Watch central bank buying data monthly."
  },
  "global-oil-prices": {
    current: "Crude oil is trading around $57 per barrel, relatively low by recent standards. OPEC is managing production cuts to support prices, but demand growth from China has been disappointing.",
    changed: "Oil fell from $90+ in late 2023 to the current range. OPEC production discipline has prevented a crash.",
    next: "Watch OPEC meetings, China economic data, and Middle East shipping lane disruptions. The Iran-US conflict is the biggest upside risk to oil prices."
  },
  "us-gas-prices": {
    current: "Gas prices are near seasonal averages, around $3.20-3.50 per gallon nationally. Refinery capacity is adequate and crude oil prices are moderate.",
    changed: "Prices have been stable compared to the volatility of 2022-2023.",
    next: "Summer driving season typically pushes prices up 20-30 cents. Watch crude oil prices and refinery outages."
  },
  "us-housing-market": {
    current: "The housing market is in a deep freeze. Prices are stable because nobody is selling -- existing homeowners are locked into low rates and refuse to trade up to 6%+ mortgages.",
    changed: "Inventory remains near historic lows. Some Sun Belt markets that overheated are seeing price declines.",
    next: "The unlock happens when rates drop below 5.5%. Until then, expect continued low volume and sticky prices."
  },
  "us-consumer-confidence": {
    current: "Consumer confidence is sending mixed signals. People are spending but they are not happy about it. Surveys show pessimism about the future even as current spending remains solid.",
    changed: "Confidence has drifted lower over the past year despite strong job numbers. Consumers feel squeezed by prices even as incomes grow.",
    next: "Watch for the gap to close -- either spending catches down to sentiment (recession signal) or sentiment catches up to spending."
  },
  "us-dollar-strength": {
    current: "The US dollar remains strong relative to most currencies, supported by higher interest rates compared to Europe and Japan.",
    changed: "The dollar has been resilient despite expectations of Fed cuts. As long as US rates stay higher than peers, the dollar has a floor.",
    next: "Fed rate cuts would weaken the dollar. Watch the ECB and BOJ policy decisions."
  },
  "global-food-prices": {
    current: "Global food prices have moderated from their 2022 peaks but remain 20-30% above pre-pandemic levels in many developing nations.",
    changed: "The Ukraine war disruption to grain markets has largely been absorbed. Trade routes have adapted.",
    next: "Watch El Nino patterns, India export policies, and Ukraine Black Sea grain shipments."
  },
  "fifa-world-cup-2026": {
    current: "The 2026 FIFA World Cup in the US, Canada, and Mexico is on track. Qualification is ongoing. Brazil, Argentina, and France are the betting favorites. The expanded 48-team format makes this the most open tournament in history.",
    changed: "Host nation preparations are proceeding. The expanded format means more upsets are possible.",
    next: "Watch remaining qualification matches and the draw. Squad depth will matter more than ever."
  },
  "nba-season-2025-26": {
    current: "The NBA season is deep into the regular season with playoff positioning in play. The Celtics are the defending champions. The Thunder and Nuggets lead the West.",
    changed: "Mid-season trades have reshaped several contenders. The playoff picture is becoming clearer with 8-10 teams having realistic championship hopes.",
    next: "Watch the trade deadline impact. Home court advantage in the playoffs is significant. Star player health will decide the championship."
  },
  "nfl-2026-season": {
    current: "The NFL offseason is in full swing. The Chiefs are looking for a three-peat with Mahomes. The Lions, Eagles, and Bills are the main challengers.",
    changed: "Key free agent signings are reshaping rosters. The draft will be the next major event.",
    next: "Watch the NFL Draft and remaining free agency moves. Training camp injuries in August will be the first real test."
  },
  "premier-league": {
    current: "The Premier League title race is between Arsenal and Manchester City. Arsenal have been the more consistent side this season. Liverpool are fading slightly.",
    changed: "Arsenal have maintained their lead through difficult fixtures. City started slow but have found form.",
    next: "Watch the head-to-head matches and Champions League fatigue. The final 10 games come down to squad depth and nerve."
  },
  "champions-league": {
    current: "The Champions League knockout rounds are underway. Real Madrid are the defending champions and perennial favorites. Arsenal, Bayern, and Barcelona are the main challengers.",
    changed: "The new league format produced unexpected results. Some traditional powers had to fight for qualification.",
    next: "Watch the quarterfinal draws. Home and away legs produce drama. Never count Real Madrid out."
  },
  "mlb-season-2026": {
    current: "Spring training is underway. The Dodgers are the overwhelming favorites after massive offseason spending. The Yankees and Braves are the main challengers.",
    changed: "Shohei Ohtani is fully healthy and pitching again, making the Dodgers even more dangerous.",
    next: "Pitching health is everything in baseball. Watch for injuries and the trade deadline in July."
  },
  "formula-1-2026": {
    current: "The 2026 F1 season brings the biggest regulation change in a decade. New power units and aerodynamic rules could reshuffle the competitive order.",
    changed: "Lewis Hamilton moved to Ferrari, creating massive intrigue. The new regulations aim to reduce the performance gap.",
    next: "Pre-season testing will be the first real indicator. Regulation changes often produce surprise winners."
  },
  "ufc-mma": {
    current: "Islam Makhachev dominates lightweight. Jon Jones holds the heavyweight belt but retirement rumors persist. The middleweight and welterweight divisions are particularly competitive.",
    changed: "Several high-profile fights have reshaped divisional rankings. New contenders are emerging.",
    next: "Watch upcoming title fights and pay-per-view cards. The next mega-fight booking will drive the narrative."
  },
  "russia-ukraine-war": {
    current: "The war continues with entrenched positions on both sides. Russia holds occupied territory. Ukraine is conducting defensive operations while maintaining pressure through drone warfare.",
    changed: "The front lines have barely moved in months. Both sides are experiencing attrition. Western military aid continues but fatigue is growing.",
    next: "Watch for diplomatic signals from either side. The US election cycle affects aid dynamics. A ceasefire would be the most significant development."
  },
  "china-taiwan-relations": {
    current: "Tensions remain elevated but below crisis levels. China continues military exercises near Taiwan. The US maintains strategic ambiguity while strengthening defense ties.",
    changed: "Chinese military activity has become more frequent but also more routine. Diplomatic contacts between the US and China have resumed.",
    next: "Watch for any change in Chinese military posture, US arms sales to Taiwan, and semiconductor supply chain developments."
  },
  "israel-palestine-conflict": {
    current: "The conflict continues with active military operations in Gaza. Ceasefire negotiations have produced temporary pauses but no lasting agreement. Humanitarian conditions are severe.",
    changed: "The scope of military operations has narrowed but not ended. Hostage negotiations remain the central diplomatic focus.",
    next: "Watch for ceasefire breakthrough signals, hostage deal progress, and any escalation with Hezbollah or Iran."
  },
  "iran-us-tensions": {
    current: "Active military operations between Iran and the US have been ongoing for several weeks. The situation is volatile with both sides conducting strikes.",
    changed: "The conflict escalated from proxy-level tensions to direct military engagement. This represents a major shift in the decades-long standoff.",
    next: "Watch for ceasefire signals, back-channel diplomacy, or escalation to nuclear sites. Oil prices are a proxy for market assessment of escalation risk."
  },
  "iran-nuclear-program": {
    current: "Iran continues uranium enrichment at levels close to weapons-grade. International inspectors have limited access. The JCPOA nuclear deal is effectively dead.",
    changed: "The Iran-US military conflict has complicated nuclear diplomacy. The timeline from current enrichment to a weapon is estimated at weeks to months.",
    next: "Watch IAEA inspection reports, enrichment level announcements, and any diplomatic signals about a new nuclear framework."
  },
  "nato-alliance": {
    current: "NATO is arguably stronger than at any point since the Cold War. Finland and Sweden joined, defense spending is rising across Europe, and the alliance is more unified on Russia.",
    changed: "European defense spending has increased dramatically since 2022. The alliance has shifted from a defensive posture to active deterrence.",
    next: "Watch for US election impact on NATO commitment and European defense industry development."
  },
  "european-union": {
    current: "The EU faces internal divisions on migration, fiscal policy, and defense spending. However, the bloc remains structurally intact and has shown resilience through recent crises.",
    changed: "The EU has become more assertive on tech regulation, trade policy, and defense. Far-right parties have gained but not broken the mainstream.",
    next: "Watch European Parliament dynamics, EU-China trade tensions, and defense spending coordination."
  },
  "north-korea": {
    current: "North Korea has been relatively quiet on provocations recently but weapons development continues. Diplomatic channels remain mostly closed.",
    changed: "North Korea shifted focus to supporting Russia with ammunition supplies, gaining new leverage and revenue.",
    next: "Watch for missile tests, nuclear test signals, and changes in the Russia-North Korea relationship."
  },
  "sudan-conflict": {
    current: "The humanitarian crisis in Sudan is one of the worst in the world. Fighting between the SAF and RSF has displaced millions. International attention has been limited.",
    changed: "The conflict has expanded geographically, drawing in more armed groups. Aid delivery is severely restricted.",
    next: "Watch for ceasefire negotiations, regional mediation efforts, and humanitarian access updates."
  },
  "venezuela-crisis": {
    current: "Political instability continues. The opposition claims electoral fraud while Maduro retains power. Economic conditions have stabilized slightly but remain dire.",
    changed: "Recent US military strikes near Venezuela have added a new dimension. The opposition is energized but lacks institutional power.",
    next: "Watch for international diplomatic responses, oil export changes, and migration patterns."
  },
  "climate-change": {
    current: "Global temperatures continue to break records. 2025 was the hottest year on record. Extreme weather events are increasing in frequency and severity. The gap between climate commitments and actual emissions reductions continues to widen.",
    changed: "The pace of warming has accelerated beyond many model projections. Renewable energy adoption is accelerating but not fast enough.",
    next: "Watch for COP summit outcomes, major economy emissions data, and extreme weather events that shift public opinion."
  },
  "us-cuba-relations": {
    current: "Relations remain frozen. Sanctions are in place, diplomatic engagement is minimal. Cuba faces a severe economic crisis.",
    changed: "The brief thaw under Obama has fully reversed. Cuba migration has surged, creating political pressure against engagement.",
    next: "Change would require a significant shift in US domestic politics or a Cuban political transition."
  },
  "lebanon-war-2026": {
    current: "The situation in Lebanon remains fragile. Cross-border tensions between Israel and Hezbollah persist. Lebanon economic crisis continues.",
    changed: "The Gaza conflict has kept tensions elevated along the border. Hezbollah has expanded involvement.",
    next: "Watch for escalation triggers. The Iran-US conflict trajectory directly affects Hezbollah calculations."
  },
  "artificial-intelligence-policy": {
    current: "AI regulation is being debated globally but moving slowly. The EU AI Act is the most comprehensive framework. The US has taken a lighter-touch approach.",
    changed: "Congress has held multiple hearings on AI safety, deepfakes, and job displacement. Several bills introduced but none passed.",
    next: "Watch for federal AI legislation, state-level regulations, and any AI-caused incident that could accelerate regulation."
  },
  "us-immigration-policy": {
    current: "Immigration remains the most politically charged issue. Border encounters fluctuate with policy changes. Comprehensive reform remains elusive.",
    changed: "Executive actions have shifted border policy multiple times. Asylum processing and parole programs create a shifting landscape.",
    next: "Watch Supreme Court immigration decisions, executive actions, and midterm campaign dynamics."
  },
  "us-trade-policy": {
    current: "Tariffs remain elevated, particularly on Chinese goods. The trade war has evolved into broader economic competition. Both parties support a tough stance on China.",
    changed: "New tariffs on Chinese EVs, batteries, and semiconductors have expanded the conflict. China has responded with export controls on critical minerals.",
    next: "Watch for tariff escalation signals, WTO rulings, and supply chain disruption events."
  },
  "us-healthcare-policy": {
    current: "Healthcare costs continue to rise faster than inflation. Drug prices, insurance premiums, and hospital costs are all climbing.",
    changed: "Medicare drug price negotiation is beginning to take effect. A few high-cost drugs now have negotiated prices.",
    next: "Watch for drug pricing updates and insurance premium announcements. An aging population means spending will only increase."
  },
  "us-debt-ceiling": {
    current: "The debt ceiling debate is approaching again. The Treasury is using extraordinary measures. Congress will eventually raise it, but not without drama.",
    changed: "The 2023 crisis was resolved but the new ceiling will be reached with the same brinksmanship expected.",
    next: "Watch the Treasury X-date and Congressional negotiations. Default remains extremely unlikely but uncertainty itself is disruptive."
  },
  "2026-us-midterm-elections": {
    current: "Both parties are gearing up. Historically, the party in the White House loses seats. Early polls are unreliable this far out but show competitive races.",
    changed: "Candidate recruitment and fundraising are underway. Redistricting in several states will affect House races.",
    next: "Watch primary elections, fundraising totals, and generic ballot polls. The economy and presidential approval are the strongest predictors."
  },
  "us-supreme-court": {
    current: "The Supreme Court has several major cases covering executive power, federal regulation, and civil rights. The 6-3 conservative majority continues to reshape American law.",
    changed: "Recent decisions on affirmative action, student loans, and regulatory power have had sweeping impact. Ethics controversies have fueled reform calls.",
    next: "Watch for decisions on social media regulation, administrative law, and the term ending in June with the most significant opinions released last."
  },
  "us-congress-legislation": {
    current: "Congress remains deeply divided with slim majorities. Major legislation is nearly impossible without bipartisan support. Most activity focuses on must-pass items.",
    changed: "Government shutdown threats have become routine. Both parties use must-pass bills as leverage.",
    next: "Watch for funding deadlines, defense authorization, and any bipartisan openings on AI regulation or immigration."
  },
  "taylor-swift": {
    current: "Taylor Swift continues to be the dominant cultural force in music. The Eras Tour was the highest-grossing tour in history. She has redefined the artist-fan relationship.",
    changed: "The Eras Tour wrapped, leaving a massive cultural footprint. Her influence extends beyond music into politics, fashion, and economics.",
    next: "A new album is expected in late 2026. Watch for single releases and any political endorsements ahead of the midterms."
  },
  "marvel-cinematic-universe": {
    current: "The MCU is in a rebuilding phase. Box office returns have declined from the Endgame peak. However, Deadpool and Wolverine proved the franchise can still produce hits.",
    changed: "Marvel has reduced release volume and refocused on quality. The next Avengers films are in development with clearer direction.",
    next: "Watch for Avengers: Secret Wars announcements. The X-Men integration is the biggest opportunity."
  },
  "oscar-awards-2026": {
    current: "Awards season is in its early stages with fall film festivals generating buzz. No clear Best Picture frontrunner has emerged.",
    changed: "The Oscars have expanded to include more genre films and international cinema. Streaming platforms compete alongside traditional studios.",
    next: "Watch Venice, Toronto, and Telluride festival premieres. Best Picture often comes down to what the industry wants to say about itself."
  },
  "tesla": {
    current: "Tesla faces its toughest competitive landscape ever. BYD has overtaken Tesla in global sales. Price cuts have protected volume but compressed margins.",
    changed: "Full Self-Driving has improved but remains far from the promised robotaxi vision. Competition from Chinese EVs is intensifying.",
    next: "Watch quarterly delivery numbers, margin trends, and robotaxi timeline updates. The next-gen affordable Tesla is the most important product."
  },
  "tiktok-ban": {
    current: "The ban-or-divest law passed Congress but enforcement is tangled in legal challenges. TikTok remains operational while courts review.",
    changed: "Multiple court rulings have created a complex legal landscape. TikTok continues to grow its US user base.",
    next: "Watch for Supreme Court action, DOJ enforcement decisions, and any buyer emergence for TikTok US operations."
  },
  "spacex-starship": {
    current: "Starship development continues at a rapid pace with iterative test flights. Each launch gets further. The vehicle is central to NASA Artemis moon landing plans.",
    changed: "Recent flights have achieved stage separation and booster catch attempts. The heat shield is improving but re-entry remains challenging.",
    next: "Watch for successful re-entry, orbital insertion, and payload deployment. Full operational status is likely within 2-3 more test flights."
  },
  "ai-industry": {
    current: "The AI industry is in intense competition. OpenAI leads in consumer mindshare, Google has the most compute, Anthropic focuses on safety, Meta pushes open-source. Revenue still lags investment.",
    changed: "Model capabilities are improving rapidly. The gap between models is narrowing. AI agents and coding assistants are the most promising revenue opportunity.",
    next: "Watch for next-gen model announcements, enterprise revenue numbers, and any major AI incident. The question is shifting from 'does AI work?' to 'who captures the value?'"
  },
  "apple": {
    current: "Apple continues its core strategy: premium hardware, growing services, careful AI integration. Apple Intelligence is the biggest bet this cycle.",
    changed: "iPhone 17 Air launched. M5 MacBooks shipped. Apple Intelligence features are rolling out gradually. Services revenue hit new records.",
    next: "Watch for the fall lineup (rumored foldable prototype), WWDC announcements, and Apple Intelligence adoption metrics."
  },
  "hurricane-season-2026": {
    current: "Forecasters are building models for the 2026 Atlantic hurricane season. Ocean temperatures remain above average, correlating with more active seasons.",
    changed: "The 2025 season was above average. Warm sea surface temperatures have become structural due to climate change.",
    next: "Watch for NOAA seasonal forecasts in April-May. Sea surface temperature trends in the tropical Atlantic are the strongest predictor."
  },
  "severe-weather-alerts": {
    current: "Weather alert activity is at normal seasonal levels. Standard advisories are active. No significant severe weather events are imminent nationally.",
    changed: "Climate change is making extreme events more frequent on a trend basis but individual weeks vary normally.",
    next: "Spring tornado season is approaching. Watch NWS advisories for your area."
  },
  "wildfire-season": {
    current: "Wildfire risk varies by region. Western states with drought conditions face elevated risk. Last year set new records in California and Oregon.",
    changed: "Wildfire seasons are starting earlier and lasting longer due to climate change.",
    next: "Watch for drought conditions in the West, wind events, and early-season fires indicating a bad year."
  },
};

async function main() {
  const topics = await q("topics", "id,slug", "status=eq.active&is_public=eq.true");
  const slugToId = new Map(topics.map(t => [t.slug, t.id]));
  let updated = 0;

  for (const [slug, briefing] of Object.entries(BRIEFINGS)) {
    const topicId = slugToId.get(slug);
    if (!topicId) { console.log("Skip:", slug); continue; }

    const ptr = await q("topic_latest_snapshot", "snapshot_id", `topic_id=eq.${topicId}`);
    if (!ptr[0]) { console.log("No snapshot:", slug); continue; }

    const r = await fetch(`${url}/rest/v1/topic_snapshots?id=eq.${ptr[0].snapshot_id}`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        current_picture_text: briefing.current,
        what_changed_text: briefing.changed,
        what_next_text: briefing.next,
      })
    });
    if (r.ok) { updated++; console.log("OK:", slug); }
    else console.log("Failed:", slug, r.status);
  }

  console.log(`\nUpdated ${updated} topic briefings`);
}

main();
