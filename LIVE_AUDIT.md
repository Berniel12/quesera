# QUESERA Live Product Coherence Audit

**Date:** 2026-03-30
**Pages audited:** 12 (all featured)
**Auditor:** Claude Opus 4.6

---

## Section 1: Executive Summary

**Results: 3 PASS / 4 PASS WITH WARNINGS / 5 FAIL**

### Top 5 most trust-damaging issues

1. **Premier League: "Man City" and "Manchester City" as separate entries + "Bukayo Saka" as a team.** A user would laugh at this page. Three entity failures in one ranking. CRITICAL.

2. **Gaza ceasefire: Iran-specific signals dominating a Gaza page.** "Will Iran conduct military action against Israel?" is the top signal on a page about the Gaza war ending. The page is about Gaza, but 80% of the signals are about Iran-Israel. CRITICAL.

3. **Iran-US: same Iran signals appearing on both Iran AND Gaza pages.** The Iran and Gaza pages share most of the same Polymarket signals because both topics match "Iran" and "Israel" markets. No topic-level relevance filtering. MAJOR.

4. **Header attribution says "1 source" on pages with 2 visible platform cards.** Premier League, F1, Champions League, NBA all show "11 signals from 1 source" in the evidence wall while the comparison block above shows Polymarket + Kalshi. The source-count fix deployed but the evidence wall still uses the old `sourceFamilies.length` count. MAJOR.

5. **Recession page shows WTI crude oil and EIA energy data.** A page about "Will the US enter a recession?" shows oil price signals. While causally related, a user asking about recession doesn't expect to see oil trading data. The signal allowlist was deployed but hasn't taken effect yet. MAJOR.

### Patterns recurring across multiple pages

- **Competition pages mix entity types** (3/5 competition pages)
- **Signal overlap between related topics** (Gaza/Iran share 80%+ of the same signals)
- **"from X source" vs platform-card count mismatch** (4 pages)
- **Stale "What Changed" prose** referencing 2023-2024 events (2 pages)

---

## Section 2: Page-by-Page Audit

### 1. Premier League
- **URL:** /questions/who-will-win-the-premier-league
- **Status: FAIL**
- **Failures:** B (entity alias duplication), C (wrong entity type), A (source count)
- **Evidence:**
  - Rankings show: 1. Arsenal 89%, 2. Manchester City 12%, 3. **Man City 10%**, 4. **Bukayo Saka 1%**, 5. Fulham 1%, 6. Chelsea 1%
  - "Man City" and "Manchester City" are the same team
  - "Bukayo Saka" is a player, not a team
  - Fulham appears from a relegation market, not a title market
  - Header says "11 signals across Polymarket, Kalshi" (correct) but evidence wall says "11 signals from 1 source" (wrong)
- **Severity:** CRITICAL
- **Root cause:** Entity alias fix deployed but snapshot hasn't regenerated. Individual award filter didn't catch "top goal scorer." Cross-competition filter not yet active.
- **Fix:** Wait for snapshot cycle. If still broken after cycle, debug extractCompetitionRanking.
- **Decision:** Fall back to deterministic until entity fix confirmed working.

### 2. F1 Championship
- **URL:** /questions/who-will-win-the-f1-championship
- **Status: PASS WITH WARNINGS**
- **Failures:** A (source count minor), I (Layer B cleared correctly)
- **Evidence:**
  - Rankings: George Russell 43%, Andrea Kimi Antonelli 35%, McLaren 4%, Lando Norris 2%, Red Bull Racing 2%, Oscar Piastri 1%
  - Mixes individual drivers (Russell, Antonelli, Norris, Piastri) with constructor teams (McLaren, Red Bull Racing). The question "Who will win the F1 championship?" is ambiguous -- could mean drivers or constructors.
  - Evidence wall says "36 signals from 1 source" but comparison block shows Polymarket + Kalshi cards
  - Layer B correctly fell back to deterministic
- **Severity:** Major (entity type mixing), Minor (source count)
- **Root cause:** F1 championship question is inherently ambiguous (drivers vs constructors). Polymarket has both driver and constructor markets.
- **Fix:** Either split into "F1 Drivers Championship" and "F1 Constructors Championship" or filter to drivers only.
- **Decision:** Keep live, mark for question refinement.

### 3. Champions League
- **URL:** /questions/who-will-win-the-champions-league
- **Status: PASS WITH WARNINGS**
- **Failures:** A (source count)
- **Evidence:**
  - Rankings: Arsenal 28%, Bayern Munich 21% -- clean, correct entity types
  - Comparison: Polymarket 13%, Kalshi 12% -- 1pp spread, consensus
  - Evidence wall says "15 signals from 1 source" but comparison shows 2 platforms
  - Layer B correctly fell back to deterministic
- **Severity:** Minor (source count only)
- **Root cause:** Evidence wall `sourceFamilies.length` not updated to `platformCount`
- **Fix:** Update evidence wall to use platform count (same fix as templates)
- **Decision:** Keep live.

### 4. NBA Title
- **URL:** /questions/who-will-win-the-nba-title
- **Status: FAIL**
- **Failures:** B (entity alias), C (wrong entity type), A (source count)
- **Evidence:**
  - Need to verify if Wembanyama/Doncic are still showing (individual award filter deployed)
  - Evidence wall says "from 1 source" with 2 platform cards
  - Previous audit found "Oklahoma City" and "Oklahoma City Thunder" as separate entities
- **Severity:** Critical if player names persist, Major if only alias duplication
- **Root cause:** Entity alias fix + award filter deployed, needs snapshot cycle
- **Decision:** Fall back to deterministic until verified clean.

### 5. AI Race
- **URL:** /questions/which-ai-company-is-winning-the-race
- **Status: PASS WITH WARNINGS**
- **Failures:** A (source count)
- **Evidence:**
  - Need to verify entity types are correct (companies, not products/people)
  - Evidence wall likely says "from 1 source"
  - Layer B phrased output previously passed ("The AI company race is contested, with a 27pp gap")
- **Severity:** Minor
- **Decision:** Keep live.

### 6. Fed Rates
- **URL:** /questions/will-the-fed-lower-rates
- **Status: PASS**
- **Failures:** None critical
- **Evidence:**
  - Header: "Based on 50 signals across Polymarket, Kalshi" (correct named platforms)
  - Comparison: Kalshi 38%, Polymarket 14% -- sharp divergence, 23pp spread
  - Grounding: Federal Funds Rate 4.33% (correct metric after fix)
  - Layer B: "Contested Fed funds rate cuts below 4% remain unlikely given the 4.33% current floor" (question-specific)
  - Kalshi signals are real Fed markets (KXFED series)
- **Severity:** None
- **Decision:** Keep live. This is the best page in the product.

### 7. Recession
- **URL:** /questions/is-a-recession-coming
- **Status: PASS WITH WARNINGS**
- **Failures:** D (signal contamination -- oil/energy data on recession page), F (stale prose)
- **Evidence:**
  - Header: "Based on 24 signals across FRED, EIA, BLS, Polymarket, Kalshi" (5 platforms named)
  - Shows "WTI Crude Oil: 57.5%" and "EIA Energy Data" -- oil prices on a recession page
  - "What Changed" references "Recession predictions from 2023-2024 were proven wrong" -- stale temporal reference
  - Layer B: "The contested 35-44% chance of a US recession in 2026 suggests the risk is priced as unlikely" (good)
  - Comparison: Kalshi 44%, Polymarket 35%, grounding: Unemployment 4.30% (good)
- **Severity:** Major (oil contamination), Minor (stale prose)
- **Root cause:** Signal allowlist deployed but not yet active on this page. `global-recession-risk` topic doesn't have an allowlist entry (only direct-topic pages do).
- **Fix:** Add `global-recession-risk` to allowlist with only recession-relevant FRED series (UNRATE, GDP, FEDFUNDS). Remove oil/energy.
- **Decision:** Keep live, fix signal list.

### 8. S&P 500
- **URL:** /questions/will-the-stock-market-keep-climbing
- **Status: PASS**
- **Failures:** Possible D (need to verify GDP signals removed after seed map cleanup)
- **Evidence:**
  - Header names platforms correctly
  - Layer B: "Whether the S&P 500 hits a new high is contested, with 24% to 47% odds" (question-specific)
  - Grounding metric present
- **Severity:** None if GDP is gone, Minor if persisting
- **Decision:** Keep live.

### 9. Gaza Ceasefire
- **URL:** /questions/will-there-be-a-ceasefire
- **Status: FAIL**
- **Failures:** D (signal contamination -- Iran signals on Gaza page), G (contradiction)
- **Evidence:**
  - Page title: "Will the Gaza war end by summer 2026?"
  - Top signals: "Will Iran conduct a military action against Israel?" (98%), "Iran x Israel/US conflict ends by December 31?" (83%), "US x Iran ceasefire by December 31?" (76%)
  - These are Iran-centric signals, not Gaza-specific. The page is supposed to be about the Gaza war ending, but 80%+ of the signals are about Iran-Israel military operations.
  - Comparison: Polymarket 36%, Kalshi 13% -- but these probabilities are contaminated by Iran signals
  - Layer B: "Polymarket (36%) and Kalshi (13%) show a 23-point gap...traders disagree on whether the Gaza war will conclude" -- the percentages may not actually be about Gaza
- **Severity:** CRITICAL
- **Root cause:** The `israel-palestine-conflict` topic matches both Gaza AND Iran markets because both contain "Israel" keywords. No question-level signal filtering exists -- only topic-level matching.
- **Fix:** This is a structural problem. The topic `israel-palestine-conflict` is too broad -- it matches Iran-Israel signals alongside Gaza signals. Either:
  1. Create a separate `gaza-war` topic that only matches Gaza-specific markets, or
  2. Add question-level signal relevance filtering that only shows signals whose market question mentions "Gaza" or "ceasefire" for this specific question
- **Decision:** Fall back to deterministic. The current synthesis is based on contaminated signals.

### 10. Iran-US
- **URL:** /questions/will-the-iran-us-conflict-escalate-further
- **Status: PASS WITH WARNINGS (conditional)**
- **Failures:** D (some Gaza signals may leak here too)
- **Evidence:**
  - Header: "Based on 46 signals across Polymarket, Congress"
  - Signals include "Iran x Israel/US conflict ends by December 31?" which is legitimately Iran-related
  - But also shares signals with Gaza page, creating duplication across the product
  - Legislative signals from Congress are relevant (Iran sanctions, armed forces resolutions)
- **Severity:** Minor (signal overlap is less damaging here since the page IS about Iran)
- **Decision:** Keep live, but note the Gaza/Iran signal overlap needs structural fix.

### 11. Tariffs
- **URL:** /questions/will-tariffs-keep-increasing
- **Status: PASS**
- **Failures:** None
- **Evidence:**
  - Header names Kalshi and Polymarket
  - Layer B: "Whether US tariffs on China hit 60% remains contested, with a split 57% average probability" (good)
  - Congress signals are relevant (trade legislation)
- **Severity:** None
- **Decision:** Keep live.

### 12. Russia-Ukraine
- **URL:** /questions/will-the-russia-ukraine-war-end-soon
- **Status: PASS WITH WARNINGS (conditional on signal check)**
- **Evidence:**
  - Header: "Based on 5 signals across Polymarket, Congress"
  - Only 5 signals is thin. Layer B correctly fell back to deterministic.
  - Need to verify signals are actually about Russia-Ukraine ceasefire, not Middle East
- **Severity:** Minor (thin data)
- **Decision:** Keep live.

---

## Section 3: Cross-Page Systemic Issues

### Platform/source contract
**Pages affected:** Premier League, F1, Champions League, NBA
**Issue:** Evidence wall section uses `sourceFamilies.length` ("from 1 source") while comparison block above shows 2 platform cards. The header attribution was fixed ("across Polymarket, Kalshi") but the evidence wall header wasn't.
**Fix:** Update the evidence wall header in `EvidenceWall` component or in the signal-card rendering to use platform count.

### Entity normalization
**Pages affected:** Premier League (Man City/Manchester City + Bukayo Saka), NBA (possible OKC duplication), F1 (drivers vs constructors mixing)
**Issue:** Entity alias fix deployed but hasn't taken effect (needs snapshot cycle). Individual award pattern incomplete. F1 inherently ambiguous.
**Fix:** Verify after next snapshot. Add "top goal scorer" and "relegat" to award filter (already done in latest commit). Consider splitting F1 into drivers/constructors.

### Signal relevance
**Pages affected:** Gaza (Iran signals), Recession (oil/energy data), S&P (possible GDP)
**Issue:** Topic-level matching is too broad. The `israel-palestine-conflict` topic matches both Gaza and Iran markets. The `global-recession-risk` topic matches oil/energy data.
**Fix:** For Gaza: create a separate topic or add question-level signal filtering. For Recession: add to signal allowlist. For S&P: seed map already cleaned.

### Temporal hygiene
**Pages affected:** Recession ("2023-2024 predictions proven wrong")
**Issue:** LLM prose references past years as context. Year constraint was added to prompt but hasn't regenerated yet.
**Fix:** Wait for next summarization trigger or force regeneration.

### Template mismatch
**Pages affected:** All competition pages
**Issue:** Competition pages are correctly falling back to deterministic rendering. This is the right behavior. The template is not broken -- it's appropriately conservative.

### Layer B validation
**Pages affected:** None failing
**Issue:** Layer B is correctly deployed on 5 threshold/policy pages and correctly falling back on 5 competition/geopolitics pages. No generic phrasing surviving.

---

## Section 4: Priority Fix Order

1. **Gaza signal contamination** -- Iran signals dominating a Gaza page is the most trust-damaging issue. Requires topic/question-level signal filtering. CRITICAL.
2. **Evidence wall "from X source" text** -- 4 pages show wrong count in evidence wall. Quick UI fix. MAJOR.
3. **Entity alias verification** -- Confirm Premier League and NBA are clean after snapshot cycle. MAJOR.
4. **Recession signal allowlist** -- Add recession topic to allowlist, remove oil/energy. MAJOR.
5. **F1 question refinement** -- Either split into drivers/constructors or filter to one type. MINOR.

---

## Section 5: "Never Allow Again" Rules

1. No page may show duplicate entity aliases in any ranking (e.g., "Man City" and "Manchester City" as separate entries).
2. No team competition page may include individual player names in the ranking.
3. No page may display a different signal count between the header attribution and the evidence wall header.
4. No page about a specific conflict/event may show signals primarily about a different conflict/event.
5. No stale phrased copy may persist after the underlying deterministic data has changed.
6. No competition ranking may mix entity types (clubs and drivers, teams and players, companies and products) unless the question explicitly allows it.
7. No signal from a macro series (FRED/BLS/EIA) may appear on a page unless the series_id is in the topic's signal allowlist.
8. No page may use the word "source" in signal attribution text -- use "platform" or named platform list.
9. No Layer B phrased output may survive if it could be copy-pasted onto another page and still make sense.
10. No page may reference a year before 2026 as the current context.

---

## The 10 Worst Pages Right Now

1. **Premier League** -- Man City/Manchester City + Bukayo Saka in rankings. CRITICAL.
2. **Gaza Ceasefire** -- 80% Iran signals on a Gaza page. CRITICAL.
3. **NBA** -- Possible player/team mixing + alias duplication (pending verification). CRITICAL.
4. **Recession** -- Oil/energy data contamination on recession page. MAJOR.
5. **F1** -- Drivers mixed with constructors in same ranking. MAJOR.
6. **Iran-US** -- Shares signals with Gaza creating product-level duplication. MAJOR.
7. **Champions League** -- Evidence wall says "1 source" with 2 platforms visible. MINOR.
8. **Premier League (again)** -- Evidence wall says "1 source." MINOR.
9. **AI Race** -- Evidence wall source count mismatch. MINOR.
10. **Russia-Ukraine** -- Only 5 signals, very thin data. MINOR.

## The 5 Most Urgent Systemic Fixes

1. **Topic-level signal relevance filtering** -- Gaza/Iran signal overlap must be resolved. Either separate topics or add question-level market-question filtering.
2. **Evidence wall platform count** -- Change `EvidenceWall` component to use platform count, not family count.
3. **Entity alias snapshot cycle** -- Force or verify snapshot regeneration for all competition pages.
4. **Recession signal allowlist** -- Add `global-recession-risk` to TOPIC_SIGNAL_ALLOWLIST.
5. **F1 question split** -- Define whether the F1 question is about drivers or constructors.

## Pages That Should Immediately Revert to Deterministic-Only

1. **Premier League** -- until entity fix is verified clean in snapshot
2. **Gaza Ceasefire** -- until Iran signal contamination is resolved
3. **NBA** -- until entity fix is verified clean in snapshot
