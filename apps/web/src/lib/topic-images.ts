/**
 * Topic-specific hero images from Unsplash.
 * Each topic gets a curated, relevant image displayed as a full-bleed hero background.
 * Images are user-uploaded photography (not stock), resized via Unsplash CDN params.
 *
 * To add images: find a photo on unsplash.com, copy the photo ID from the URL,
 * then use: https://images.unsplash.com/photo-{ID}?w=1200&q=75&auto=format
 */

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=75&auto=format`;

// ─── Per-topic images (specific, curated) ───────────────────────

const TOPIC_IMAGES: Record<string, string> = {
  // Crypto
  "bitcoin-price": img("1518546305927-5a555bb7020d"),      // gold bitcoin coin
  "ethereum-price": img("1622630998477-20aa696ecb05"),      // ethereum logo neon
  "crypto-market": img("1639762681485-074b7f938ba0"),       // crypto trading screens

  // Sports
  "nba-season-2025-26": img("1546519638-68e109498ffc"),     // basketball court
  "nfl-2026-season": img("1508098682722-e99c643e7f0b"),     // american football
  "premier-league": img("1574629810360-7efbbe195018"),       // soccer stadium
  "champions-league": img("1522778119698-d1e0e73a6ceb"),     // champions league night
  "fifa-world-cup-2026": img("1431324155629-1a6deb1dec8d"),  // world cup trophy/stadium
  "mlb-season-2026": img("1566577739112-5180d4bf9390"),      // baseball diamond
  "formula-1-2026": img("1568605117036-5fe5e7329430"),       // F1 race track
  "ufc-mma": img("1549719386-74dfcbf7dbed"),                 // MMA octagon
  "la-liga": img("1560272564-c83b66b1ad12"),                  // spanish football
  "bundesliga": img("1517747614396-d21a78768908"),            // football/soccer match
  "ipl-cricket": img("1531415074968-036ba1b575da"),          // cricket bat and ball
  "cricket-world-cup": img("1531415074968-036ba1b575da"),    // cricket
  "tennis-grand-slams": img("1554068865-24cecd4e34b8"),      // tennis court
  "olympics-2028": img("1461896836934-bd45ba8fcb39"),        // olympic stadium
  "tour-de-france": img("1517649763962-0c623066013b"),       // cycling race
  "rugby-world-cup": img("1544298621-35a764866120"),         // rugby

  // Macro
  "us-federal-reserve-interest-rates": img("1611974789855-9c2a0a7236a3"), // stock charts
  "us-inflation-rate": img("1579532537598-459ecdaf39cc"),     // money/currency
  "us-stock-market": img("1611974789855-9c2a0a7236a3"),      // trading floor
  "us-housing-market": img("1570129477492-45c003edd2be"),     // suburban houses
  "us-mortgage-rates": img("1560518883-ce09059eeffa"),        // house keys
  "us-gas-prices": img("1545262810-a959cbb7ef1e"),            // gas station
  "us-unemployment-rate": img("1521791055366-0d553872125f"),  // office workers
  "us-consumer-confidence": img("1556742049-0cfed4f6a45d"),   // shopping
  "us-dollar-strength": img("1526304640581-d334cdbbf45e"),    // US dollar bills
  "gold-price": img("1610375461246-83df859d849d"),            // gold bars
  "global-oil-prices": img("1513828583688-c52600e749c4"),     // oil rig
  "global-food-prices": img("1542838132-92c53300491e"),       // food market
  "global-recession-risk": img("1604594849809-dfedbc827105"), // economic downturn
  "ecb-interest-rates": img("1590283603385-17ffb3a7f29f"),    // European Central Bank
  "uk-inflation": img("1513635269975-59663e0ac1ad"),          // London city
  "china-gdp-growth": img("1547981609-4b6bfe67ca0b"),        // Shanghai skyline
  "euro-exchange-rate": img("1580519542036-c47de6196ba5"),    // euro coins
  "japan-economy": img("1542051841857-5f90071e7989"),         // Tokyo skyline
  "india-economy": img("1524492412937-b28074a5d7da"),         // Mumbai skyline

  // Geopolitics
  "russia-ukraine-war": img("1589519160732-57fc498c6e25"),    // conflict/war imagery
  "china-taiwan-relations": img("1547981609-4b6bfe67ca0b"),   // East Asia
  "israel-palestine-conflict": img("1526778548025-fa2f459cd5c1"), // Middle East
  "iran-us-tensions": img("1521295121783-8a321d551ad2"),      // military/diplomacy
  "iran-nuclear-program": img("1521295121783-8a321d551ad2"),  // nuclear facility
  "north-korea": img("1451187580459-43490279c0fa"),           // earth from space
  "nato-alliance": img("1451187580459-43490279c0fa"),         // globe/earth
  "european-union": img("1519923834699-ef0b7cde4712"),        // EU flags
  "sudan-conflict": img("1526778548025-fa2f459cd5c1"),        // Africa
  "venezuela-crisis": img("1526778548025-fa2f459cd5c1"),      // Latin America
  "lebanon-war-2026": img("1526778548025-fa2f459cd5c1"),      // Middle East
  "climate-change": img("1470071459604-3b5ec3a7fe05"),        // nature/earth
  "us-cuba-relations": img("1529424953289-6abe7c5b11d7"),     // Caribbean

  // Politics
  "2026-us-midterm-elections": img("1541872703-74c5e44368f9"), // US Capitol
  "us-supreme-court": img("1575320181282-9afab399332c"),      // Supreme Court building
  "us-congress-legislation": img("1529107386315-e1a2ed48a620"), // Capitol dome
  "us-debt-ceiling": img("1526304640581-d334cdbbf45e"),       // US currency
  "artificial-intelligence-policy": img("1677442136019-21780ecad995"), // AI abstract
  "us-trade-policy": img("1494412574643-ff11b0a5eb19"),       // shipping containers
  "us-immigration-policy": img("1521295121783-8a321d551ad2"),  // border/immigration
  "us-healthcare-policy": img("1519494026257-aeff85a46d3d"),   // hospital
  "uk-elections": img("1513635269975-59663e0ac1ad"),          // Parliament/London
  "india-elections": img("1524492412937-b28074a5d7da"),       // India Parliament
  "brazil-politics": img("1483729558449-99ef09a8c325"),       // Brasilia
  "france-elections": img("1502602898657-3e91760cbb34"),      // Paris/Eiffel Tower

  // Disasters
  "earthquake-activity": img("1509803874385-db7c23652552"),    // cracked earth
  "severe-weather-alerts": img("1527482797697-8795b05a13fe"),  // storm clouds
  "hurricane-season-2026": img("1559060017-445fb9722f2a"),     // hurricane satellite
  "wildfire-season": img("1473448912268-2022ce9509d8"),        // wildfire

  // Tech
  "ai-industry": img("1677442136019-21780ecad995"),            // AI neural network
  "tesla": img("1560958089-b8a1929cea89"),                     // Tesla car
  "apple": img("1491933382434-500287f9b54b"),                  // Apple products
  "tiktok-ban": img("1611162617213-7d7a39e9b1d7"),             // phone/social media
  "spacex-starship": img("1516849841208-e113e6928dc2"),        // rocket launch

  // Entertainment
  "taylor-swift": img("1493225457124-a3eb161ffa5f"),           // concert stage
  "marvel-cinematic-universe": img("1612036782180-cf1b572f97fc"), // superhero art
  "oscar-awards-2026": img("1478720568477-152d9b164e26"),      // movie theater
  "grammy-awards-2026": img("1493225457124-a3eb161ffa5f"),     // music performance
  "eurovision-2026": img("1493225457124-a3eb161ffa5f"),        // stage/performance
  "gta-6": img("1550745165-9bc0b252726f"),                     // gaming setup
  "beyonce": img("1493225457124-a3eb161ffa5f"),                // concert
  "k-pop": img("1493225457124-a3eb161ffa5f"),                  // stage performance
  "bollywood": img("1524492412937-b28074a5d7da"),              // India/colorful
  "star-wars": img("1478720568477-152d9b164e26"),              // cinema
  "game-of-thrones-spinoffs": img("1478720568477-152d9b164e26"), // TV/cinema
  "summer-movie-season-2026": img("1478720568477-152d9b164e26"), // movie theater
  "netflix-streaming-wars": img("1522869635100-9f4c5e86aa37"), // streaming/TV
  "spotify-vs-apple-music": img("1511379938547-c1f69419868d"), // headphones
  "video-game-industry": img("1550745165-9bc0b252726f"),       // gaming
};

// ─── Category fallback pool (when no topic-specific image exists) ──

const CATEGORY_FALLBACK: Record<string, string[]> = {
  crypto: [img("1621504450181-5d356f61d307"), img("1622630998477-20aa696ecb05"), img("1639762681485-074b7f938ba0")],
  sports: [img("1508098682722-e99c643e7f0b"), img("1574629810360-7efbbe195018"), img("1431324155629-1a6deb1dec8d")],
  macro: [img("1526304640581-d334cdbbf45e"), img("1611974789855-9c2a0a7236a3"), img("1590283603385-17ffb3a7f29f")],
  disasters: [img("1527482797697-8795b05a13fe"), img("1509803874385-db7c23652552"), img("1470071459604-3b5ec3a7fe05")],
  geopolitics: [img("1451187580459-43490279c0fa"), img("1526778548025-fa2f459cd5c1"), img("1521295121783-8a321d551ad2")],
  tech: [img("1677442136019-21780ecad995"), img("1550751827-4bd374c3f58b"), img("1488590528505-98d2b5aba04b")],
  politics: [img("1541872703-74c5e44368f9"), img("1529107386315-e1a2ed48a620"), img("1575320181282-9afab399332c")],
  entertainment: [img("1493225457124-a3eb161ffa5f"), img("1478720568477-152d9b164e26"), img("1522869635100-9f4c5e86aa37")],
};

/**
 * Get a hero image for a topic. Returns a specific image if available,
 * otherwise a category-appropriate fallback.
 */
export function getTopicImage(slug: string, category: string | null): string | null {
  // Try topic-specific first
  const specific = TOPIC_IMAGES[slug];
  if (specific) return specific;

  // Fall back to category pool (deterministic per slug for consistency)
  const pool = CATEGORY_FALLBACK[category ?? ""] ?? [];
  if (pool.length === 0) return null;

  // Deterministic selection based on slug hash
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length] ?? null;
}
