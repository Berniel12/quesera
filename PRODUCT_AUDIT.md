# QUESERA Full Product Audit: Every Question Page and Card

**Date:** 2026-03-28
**Auditor:** Claude Opus 4.6
**Scope:** Every live public question page on quesera-web.onrender.com (32 pages)
**Standard:** If a page is not a real synthesis, it has not earned the right to be in the app.

## 1. Audit Method

I crawled every live public question page on quesera-web.onrender.com (32 pages total). For each page I checked:
- Signal count and source family count (from "Based on X signals from Y sources")
- Which platforms are cited (Polymarket, CoinGecko, FRED, etc.)
- Whether the signals are semantically correct for the question
- Whether "What Changed" and "What to Watch" sections exist and are meaningful
- Whether competition rankings contain entity contamination (players as teams, wrong matches)
- Whether the page feels like synthesis or just a styled source mirror
- Whether the page delivers more value than going to the source directly

Standards:
- **Keep**: 2+ source families, correct signals, real synthesis, page earns its place
- **Fix**: Has potential but needs specific improvements (more sources, better prose, entity fixes)
- **Hide**: Single-source thin, or gathering/empty -- should not be public
- **Remove**: Wrong signals, semantically broken, actively misleading

---

## 2. Global Findings

### Is the product mostly real synthesis or mostly dressed-up source display?

**Mostly dressed-up source display.** 23 of 32 pages (72%) have only 1 source family. The remaining 9 multi-source pages mostly have just Polymarket + one FRED series or Polymarket + CoinGecko. True multi-source synthesis with actual disagreement or agreement analysis exists on zero pages.

### Is the homepage premium or diluted?

**Heavily diluted.** The homepage shows all 32 pages including 5 that are completely empty ("gathering"), 10 that are single-source thin, and 2 that have wrong signals. Only 9 pages have 2+ source families, and even those are thin syntheses.

### What is the single biggest weakness?

**Source diversity.** Almost every page is a Polymarket mirror. The matching engine connects Polymarket questions to topics but rarely connects FRED, CoinGecko, or other sources. When it does, the synthesis doesn't explicitly name the agreement or disagreement between sources.

### What is the second biggest weakness?

**Entity contamination in competitions.** The NBA page shows "Victor Wembanyama" and "Luka Doncic" as championship contenders (those are MVP market questions leaking in). The Tennis page shows "Victoria Mboko" as the #1 tennis player in the world. The F1 page shows "McLaren" (a team) mixed with individual drivers. The ranking extraction is not filtering by question relevance.

### What is the third biggest weakness?

**Generic LLM prose pretending to be synthesis.** Pages like Taylor Swift, Apple, Tesla, and UFC have prose that reads like Wikipedia summaries with no connection to the actual signals. The prose exists to fill space, not to synthesize signal data.

---

## 3. Homepage Card Audit

The homepage currently shows 32 cards across the hero, lanes, and ticker. The experience feels padded -- too many cards diluting the signal.

| Card | Cat | Synth (1-10) | Signal (1-10) | Copy (1-10) | Click (1-10) | Verdict |
|------|-----|-------------|--------------|-------------|-------------|---------|
| Fed rates | macro | 6 | 7 | 6 | 7 | **Keep** |
| Bitcoin $100k | crypto | 5 | 6 | 6 | 7 | **Keep** |
| Iran-US war | geo | 5 | 6 | 5 | 7 | **Keep** |
| Gaza ceasefire | geo | 5 | 6 | 5 | 7 | **Keep** |
| Russia-Ukraine | geo | 4 | 5 | 5 | 6 | **Keep** |
| Recession | macro | 5 | 6 | 5 | 6 | **Keep** |
| S&P 500 ATH | macro | 3 | 4 | 4 | 5 | **Fix** |
| Tariffs | politics | 5 | 5 | 5 | 5 | **Keep** |
| Iran nuclear | geo | 3 | 4 | 4 | 5 | **Fix** |
| World Cup | sports | 3 | 5 | 4 | 7 | **Fix** |
| F1 | sports | 2 | 4 | 4 | 6 | **Fix** |
| NBA | sports | 2 | 3 | 3 | 6 | **Fix** |
| Champions League | sports | 2 | 4 | 4 | 6 | **Fix** |
| Premier League | sports | 2 | 3 | 3 | 5 | **Fix** |
| AI race | tech | 2 | 3 | 4 | 6 | **Fix** |
| Tennis | sports | 1 | 2 | 2 | 4 | **Remove** |
| Crypto market | crypto | 2 | 3 | 3 | 4 | **Fix** |
| SpaceX | tech | 2 | 3 | 4 | 5 | **Hide** |
| Steve Hilton | politics | 2 | 3 | 3 | 3 | **Hide** |
| Taylor Swift | ent | 0 | 0 | 2 | 4 | **Remove** |
| UFC | sports | 1 | 2 | 3 | 4 | **Hide** |
| Apple foldable | tech | 1 | 2 | 3 | 4 | **Hide** |
| Tesla stock | tech | 1 | 1 | 3 | 3 | **Remove** |
| Dollar | macro | 1 | 1 | 3 | 3 | **Hide** |
| Groceries | macro | 2 | 2 | 4 | 4 | **Hide** |
| Food prices | macro | 1 | 1 | 3 | 3 | **Hide** |
| Home prices | macro | 1 | 1 | 3 | 3 | **Hide** |
| Mortgages | macro | 1 | 1 | 3 | 3 | **Hide** |
| Unemployment | macro | 2 | 2 | 4 | 4 | **Hide** |
| Consumer conf | macro | 1 | 1 | 3 | 2 | **Hide** |
| Venezuela | geo | 1 | 2 | 3 | 3 | **Hide** |
| Lebanon | geo | 1 | 1 | 2 | 3 | **Hide** |
| Gas prices | macro | 1 | 1 | 3 | 3 | **Hide** |
| Sudan | geo | 0 | 0 | 0 | 0 | **Remove** |
| China-Taiwan | geo | 0 | 0 | 0 | 0 | **Remove** |
| North Korea | geo | 0 | 0 | 0 | 0 | **Remove** |
| TikTok | tech | 0 | 0 | 0 | 0 | **Remove** |
| Best Picture | ent | 0 | 0 | 0 | 0 | **Remove** |
| MCU | ent | 0 | 0 | 0 | 0 | **Remove** |
| Oil prices | macro | 0 | 0 | 0 | 0 | **Remove** |

### Worst homepage offenders

**Taylor Swift**: 2 signals, both WRONG. "Will Pope Leo XIV win the Nobel Peace Prize" and "Will Taylor Pendrith win the Masters" -- neither has anything to do with Taylor Swift's album. Actively embarrassing.

**Tennis Grand Slams**: Shows "Victoria Mboko" as the #1 contender at 8%. An obscure junior player. The ranking is pulled from tangential Polymarket questions that happened to match the word "tennis."

**NBA title**: Shows "Victor Wembanyama" at #3 and "Luka Doncic" at #4 in the championship race. These are individual players from MVP markets, not teams. Entity contamination.

**F1 championship**: Shows "McLaren" (a team) alongside individual drivers. Mixing entity types in the same ranking.

---

## 4. Full Page-by-Page Audit

### Will the Fed funds rate fall below 4% this year?
- URL: /questions/will-the-fed-lower-rates
- Template: threshold | Sources: 14 signals, 2 families (Polymarket + FRED)
- **Verdict: Keep (closest to flagship)**
- Scores: Q:8 Sig:7 Div:5 Synth:6 Hero:7 Copy:6 Pay:6 Ret:6 Des:6 Trust:7
- Working: Real metric ($4.42 vs $4.00 target), distance meter, market probability, FRED data
- Weak: Prose is generic macro commentary, not sharp synthesis of market vs FRED disagreement
- Best page in the product. Still not a true synthesis.

### Will Bitcoin hit $100k this year?
- URL: /questions/will-bitcoin-keep-going-up
- Template: threshold | Sources: 5 signals, 2 families (CoinGecko + Polymarket)
- **Verdict: Keep**
- Scores: Q:8 Sig:6 Div:5 Synth:5 Hero:7 Copy:5 Pay:6 Ret:6 Des:6 Trust:6
- Working: Real price ($65,924), real target ($100k), distance metric
- Weak: Prose about "consolidation phase" is generic

### Will the US and Iran go to war?
- URL: /questions/will-the-iran-us-conflict-escalate-further
- Template: binary_event | Sources: 47 signals, 2 families
- **Verdict: Keep**
- Scores: Q:8 Sig:6 Div:4 Synth:4 Hero:5 Copy:5 Pay:5 Ret:5 Des:5 Trust:5
- Working: High signal count, real tension topic, "Uneasy calm" headline fits
- Weak: 47 signals but most are micro-market variants from Polymarket

### Will the Gaza war end by summer 2026?
- URL: /questions/will-there-be-a-ceasefire
- Template: binary_event | Sources: 24 signals, 2 families
- **Verdict: Keep**
- Scores: Q:8 Sig:6 Div:4 Synth:4 Hero:5 Copy:5 Pay:5 Ret:5 Des:5 Trust:5

### Will there be a Russia-Ukraine ceasefire?
- URL: /questions/will-the-russia-ukraine-war-end-soon
- Template: binary_event | Sources: 5 signals, 2 families
- **Verdict: Keep**
- Scores: Q:8 Sig:5 Div:4 Synth:4 Hero:5 Copy:5 Pay:5 Ret:5 Des:5 Trust:5

### Is a recession coming?
- URL: /questions/is-a-recession-coming
- Template: binary_event | Sources: 10 signals, 2 families
- **Verdict: Keep**
- Scores: Q:7 Sig:6 Div:5 Synth:5 Hero:5 Copy:5 Pay:5 Ret:5 Des:5 Trust:5

### Will US tariffs on China exceed 60%?
- URL: /questions/will-tariffs-keep-increasing
- Template: binary_event | Sources: 6 signals, 2 families
- **Verdict: Keep**
- Has a "Case for/against" section -- one of few pages with real two-sided presentation

### Will Iran build a nuclear bomb by 2027?
- URL: /questions/will-iran-get-nuclear-weapons
- Template: binary_event | Sources: 2 signals, 2 families
- **Verdict: Fix** -- multi-source but very thin (2 signals)

### Will the S&P 500 hit a new all-time high?
- URL: /questions/will-the-stock-market-keep-climbing
- Template: threshold | Sources: 2 signals, 2 families
- **Verdict: Fix** -- too thin (2 signals), but multi-source

### Who will win the World Cup?
- URL: /questions/who-will-win-the-world-cup
- Template: competition | Sources: 43 signals, 1 family (Polymarket only)
- **Verdict: Fix**
- Working: Correct ranking (Spain, England, France), gap visualization, leaderboard
- Broken: Single source. "43 signals from 1 source" is a confession. Needs The Odds API.

### Who will win the F1 championship?
- URL: /questions/who-will-win-the-f1-championship
- Template: competition | Sources: 26 signals, 1 family
- **Verdict: Fix**
- Broken: "McLaren" appears alongside individual drivers -- entity type mixing

### Who will win the NBA title?
- URL: /questions/who-will-win-the-nba-title
- Template: competition | Sources: 13 signals, 1 family
- **Verdict: Fix**
- Broken: "Victor Wembanyama" and "Luka Doncic" listed as championship contenders -- MVP market contamination

### Who will win the Champions League?
- URL: /questions/who-will-win-the-champions-league
- Template: competition | Sources: 7 signals, 1 family
- **Verdict: Fix** -- ranking looks correct. Needs odds API.

### Who will win the Premier League?
- URL: /questions/who-will-win-the-premier-league
- Template: competition | Sources: 9 signals, 1 family
- **Verdict: Fix** -- Arsenal 89% is correct. Needs odds.

### Which AI company is winning the race?
- URL: /questions/which-ai-company-is-winning-the-race
- Template: competition | Sources: 9 signals, 1 family
- **Verdict: Fix** -- shows "Wide open / No clear leader" which seems wrong

### Crypto total market cap $5T
- URL: /questions/will-crypto-break-out-of-its-current-range
- Template: threshold | Sources: 10 signals, 1 family
- **Verdict: Fix** -- needs CoinGecko data connected

### Who will win the Tennis Grand Slams?
- URL: /questions/who-will-win-the-tennis-grand-slams
- Template: competition | Sources: 6 signals, 1 family
- **Verdict: Remove** -- Victoria Mboko at #1 is wrong and embarrassing

### Will Taylor Swift release a new album?
- URL: /questions/will-taylor-swift-release-a-new-album-this-year
- Template: binary_event | Sources: 2 signals, 1 family
- **Verdict: Remove immediately** -- WRONG SIGNALS (Pope Nobel Prize, golfer Taylor Pendrith)

### Will Tesla stock double?
- URL: /questions/will-tesla-stock-break-out-of-its-range
- Template: binary_event | Sources: 1 signal, 1 family
- **Verdict: Remove** -- 1 signal is not a product

### All "gathering" pages (Sudan, China-Taiwan, North Korea, TikTok, Best Picture, MCU, Oil)
- **Verdict: Remove** -- empty pages should not have public URLs on the homepage

### All thin single-source macro pages (dollar, food prices, consumer confidence, home prices, mortgages, gas prices, groceries)
- **Verdict: Hide** -- raw FRED numbers without context, single source, no synthesis

### SpaceX, Steve Hilton, Apple, UFC, Venezuela, Lebanon
- **Verdict: Hide** -- single source, thin, not premium

---

## 5. Hard Classification

### A. Flagship (0 pages)
None. No page achieves true cross-source synthesis with explicit agreement/disagreement analysis.

### B. Keep (8 pages)
Fed rates, Bitcoin $100k, Iran-US war, Gaza ceasefire, Russia-Ukraine, Recession, Tariffs, Iran nuclear

### C. Fix (8 pages)
World Cup, F1, NBA, Champions League, Premier League, AI race, S&P 500, Crypto $5T

### D. Tracking only (8 pages)
SpaceX, Steve Hilton, Apple foldable, UFC, Dollar, Home prices, Mortgages, Unemployment

### E. Remove (16 pages)
Taylor Swift, Tennis, Tesla, Groceries, Food prices, Consumer confidence, Gas prices, Venezuela, Lebanon, Sudan, China-Taiwan, North Korea, TikTok, Best Picture, MCU, Oil prices

---

## 6. The 10 Worst Pages

1. **Taylor Swift** -- WRONG signals (Pope + golfer). Actively embarrassing. Hide now.
2. **Tennis Grand Slams** -- Victoria Mboko at #1. Wrong entity extraction. Hide now.
3. **NBA title** -- Wembanyama/Doncic as teams. Entity contamination. Misleading.
4. **Sudan** -- Empty. No signals. Should not have a homepage link.
5. **China-Taiwan** -- Empty. Same.
6. **Consumer confidence** -- "56.60%" with no context. Meaningless to users.
7. **Home prices** -- "327.659" with no units. Meaningless.
8. **Food prices** -- "130.043" displayed raw. No context.
9. **Dollar** -- "119.515" displayed. No user knows what this means.
10. **Tesla** -- 1 signal. Not a product page.

---

## 7. The 10 Best Pages

1. **Fed rates** -- Real metric, real target, 2 sources, distance calculation. Model for threshold pages.
2. **Bitcoin $100k** -- Real price, real target, CoinGecko + Polymarket. What multi-source looks like.
3. **Iran-US** -- High signal count, real tension, 2 sources, good headline.
4. **Gaza ceasefire** -- Similar to Iran. Real topic, decent signals.
5. **Recession** -- 10 signals, 2 sources. Universally relevant.
6. **Tariffs** -- Has a "Case for/against" section. One of few with two-sided presentation.
7. **World Cup** -- Despite single source, correct ranking, good leaderboard. Closest to what competition should be.
8. **Russia-Ukraine** -- Relevant, timely, 2 sources.
9. **Champions League** -- Correct entity extraction, gap visualization works.
10. **F1** -- 26 signals, good competitive framing despite entity mixing.

---

## 8. Root-Cause Diagnosis

### Content problems
- LLM prose is generic Wikipedia-quality, not signal-aware synthesis
- "What Changed" rarely references specific signal movements
- "What to Watch" is vague ("watch for developments")

### Synthesis problems
- Zero pages explicitly compare what source A says vs what source B says
- The "Based on X signals from Y sources" line is a confession, not a strength
- Expert voice does not exist -- the product sounds like a dashboard, not an analyst

### Signal problems
- Entity contamination: MVP markets leaking into championship rankings
- Semantic mismatching: Pope Nobel Prize on Taylor Swift page
- Raw FRED index values displayed without units (327.659, 130.043, 119.515)
- Single-source dominance: Polymarket is ~90% of all signal data

### Question-selection problems
- Too many questions created without checking if meaningful signals exist
- Entertainment questions (Taylor Swift, MCU, Best Picture) have no prediction market depth
- Some questions are too vague ("Are Americans feeling good?")

### Page-structure problems
- Pages without enough signals still render full premium template
- "Gathering" state looks like a bug, not a product choice
- No visual distinction between strong multi-source and thin single-source pages

### Design problems
- Light mode looks washed out
- Threshold pages display raw numbers without units
- Competition leaderboards lack team logos
- Mobile cards lack visual identity

### Trust problems
- Wrong signals on Taylor Swift destroys trust in the whole product
- "43 signals from 1 source" sounds impressive until you realize it's one API
- Generic prose feels AI-generated without adding value

---

## 9. Card-vs-Page Mismatch Audit

### Cards stronger than their pages
- **World Cup card** shows confident race with team logos, page confesses "1 source"
- **NBA card** shows "Close race" with Celtics logo, page has player contamination
- **F1 card** shows Ferrari with logo, page mixes teams and drivers

### Click not rewarded
- Most macro/threshold pages: card shows a verdict, page shows a raw FRED number
- Tennis: card implies competitive race, page shows Victoria Mboko at #1

---

## 10. Synthesis Truth Audit

| State | Count | % | Pages |
|-------|-------|---|-------|
| True synthesis | 0 | 0% | None |
| Partial synthesis | 8 | 25% | Fed, Bitcoin, Iran-US, Gaza, Russia-Ukraine, Recession, Tariffs, Iran nuclear |
| Dressed-up source | 8 | 25% | World Cup, F1, NBA, CL, PL, AI, Crypto, SpaceX |
| Fake synthesis | 8 | 25% | All thin macro pages |
| Semantically broken | 3 | 9% | Taylor Swift, Tennis, NBA entities |
| Empty | 7 | 22% | All gathering pages |

**Zero pages achieve true synthesis.**

---

## 11. What Should Be Done Immediately

### Immediate (today)
1. Run `scripts/cut-weak-pages.sql` to hide 16 Remove pages from homepage
2. Hide 8 Tracking pages from homepage (same mechanism)
3. This shrinks homepage to ~16 pages max

### Next (this week)
4. Fix entity contamination in NBA, Tennis, F1 ranking extraction
5. Fix raw FRED display -- add units and context to threshold index values
6. Connect The Odds API to sports competition topics

### Later (next 2 weeks)
7. Build real synthesis prose that names source agreement/disagreement
8. Add Kalshi and Metaculus as predictive spine sources
9. Deploy synthesis gate so new pages can't reach homepage without multi-source data

---

## 12. Final Blunt Verdict

**What percentage of the current app is actually worthy of the brand promise?**
About 25%. 8 pages out of 32 have multi-source data, and even those don't truly synthesize.

**Is the product currently more "real synthesis app" or more "styled source viewer"?**
Styled source viewer. It is a Polymarket browser with better UI and some FRED data sprinkled in.

**What is the single hardest truth?**
The product has been optimizing the wrong layer. It spent time on layouts, vocabulary, card design, and lane grouping while the content layer -- signal matching, source diversity, synthesis quality -- remained single-source and often wrong. The product looks 10x better than it reads.

**If forced to shrink to only what is truly good, how small would it become?**
8 pages. Maybe 10 if generous about the better competition pages. That's it.
