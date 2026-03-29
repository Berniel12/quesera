-- Cut weak pages from homepage: set is_featured = false
-- These pages fail the minimum publishable standard:
--   wrong signals, single-source thin, gathering/empty, or no real synthesis
--
-- Run via Supabase SQL editor or psql
-- This is reversible: set is_featured = true to restore any page

-- WRONG SIGNALS (semantically contaminated)
UPDATE questions SET is_featured = false WHERE slug = 'will-taylor-swift-release-a-new-album-this-year';

-- THIN SINGLE-SOURCE (1 source, few signals, no synthesis value)
UPDATE questions SET is_featured = false WHERE slug IN (
  'will-tesla-stock-break-out-of-its-range',
  'will-groceries-keep-getting-more-expensive',
  'will-gas-prices-keep-rising',
  'who-is-the-ufc-fighter-to-watch',
  'will-home-prices-come-down',
  'are-americans-feeling-good-about-the-economy',
  'will-apples-next-launch-shake-up-the-market',
  'is-the-dollar-getting-weaker',
  'will-the-lebanon-conflict-spread',
  'will-steve-hilton-win-the-california-governor-election-in-2026',
  'will-starship-development-hit-a-major-setback',
  'who-will-win-the-la-liga'
);

-- GATHERING / EMPTY (no signals at all)
UPDATE questions SET is_featured = false WHERE slug IN (
  'will-north-korea-provoke-again',
  'will-tiktok-get-banned',
  'will-china-invade-taiwan',
  'who-will-win-best-picture',
  'will-the-sudan-crisis-escalate',
  'will-the-mcu-stage-a-comeback',
  'will-oil-prices-spike',
  'will-the-venezuela-crisis-get-worse'
);

-- Also update quality_tier for hidden pages
UPDATE questions SET quality_tier = 'C' WHERE slug IN (
  'will-taylor-swift-release-a-new-album-this-year',
  'will-tesla-stock-break-out-of-its-range',
  'will-groceries-keep-getting-more-expensive',
  'will-gas-prices-keep-rising',
  'who-is-the-ufc-fighter-to-watch',
  'will-home-prices-come-down',
  'are-americans-feeling-good-about-the-economy',
  'will-apples-next-launch-shake-up-the-market',
  'is-the-dollar-getting-weaker',
  'will-the-lebanon-conflict-spread',
  'will-steve-hilton-win-the-california-governor-election-in-2026',
  'will-starship-development-hit-a-major-setback',
  'who-will-win-the-la-liga',
  'will-north-korea-provoke-again',
  'will-tiktok-get-banned',
  'will-china-invade-taiwan',
  'who-will-win-best-picture',
  'will-the-sudan-crisis-escalate',
  'will-the-mcu-stage-a-comeback',
  'will-oil-prices-spike',
  'will-the-venezuela-crisis-get-worse'
);

-- Set quality_tier = 'A' for the pages that stay
UPDATE questions SET quality_tier = 'A' WHERE slug IN (
  'will-the-fed-lower-rates',
  'will-bitcoin-keep-going-up',
  'will-the-iran-us-conflict-escalate-further',
  'will-there-be-a-ceasefire',
  'will-the-stock-market-keep-climbing',
  'is-a-recession-coming',
  'will-the-russia-ukraine-war-end-soon',
  'will-tariffs-keep-increasing',
  'will-iran-get-nuclear-weapons',
  'who-will-win-the-world-cup',
  'who-will-win-the-f1-championship',
  'who-will-win-the-nba-title',
  'will-crypto-break-out-of-its-current-range',
  'who-will-win-the-tennis-grand-slams'
);

-- Verify the cut
SELECT slug, is_featured, quality_tier FROM questions WHERE status = 'published' ORDER BY is_featured DESC, quality_tier ASC;
