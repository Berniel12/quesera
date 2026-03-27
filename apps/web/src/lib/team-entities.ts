// Maps topic slugs to competition answers (favorite + contenders)
// and provides logos for topics, sources, and entities.
//
// Logo strategy:
//   - Sports teams: ESPN CDN (verified working for NBA, NFL, soccer, MLB)
//   - Countries: flagcdn.com
//   - Companies/institutions: Google Favicon API (universal, free, no key)
//   - F1 teams: Google Favicon (ESPN doesn't host F1 logos)

/** High-res company/institution logo via Uplead (free, no key, ~200px+) */
const logo = (domain: string) => `https://logo.uplead.com/${domain}`;

export interface TeamEntity {
  name: string;
  shortName: string;
  logoUrl: string;
  /** Tailwind bg class for the logo container */
  bgColor: string;
}

export interface CompetitionAnswer {
  /** The predicted favorite -- shown as the main answer */
  favorite: TeamEntity;
  /** Runner-ups shown below the favorite */
  contenders: TeamEntity[];
}

// ─── Competition answers by topic slug ────────────────────────────────────

const COMPETITION_ANSWERS: Record<string, CompetitionAnswer> = {
  "fifa-world-cup-2026": {
    favorite: {
      name: "Brazil",
      shortName: "BRA",
      logoUrl: "https://flagcdn.com/w160/br.png",
      bgColor: "bg-yellow-900/30",
    },
    contenders: [
      { name: "Argentina", shortName: "ARG", logoUrl: "https://flagcdn.com/w160/ar.png", bgColor: "bg-sky-900/30" },
      { name: "France", shortName: "FRA", logoUrl: "https://flagcdn.com/w160/fr.png", bgColor: "bg-blue-900/30" },
      { name: "England", shortName: "ENG", logoUrl: "https://flagcdn.com/w160/gb-eng.png", bgColor: "bg-red-900/30" },
    ],
  },
  "nba-season-2025-26": {
    favorite: {
      name: "Boston Celtics",
      shortName: "BOS",
      logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
      bgColor: "bg-emerald-900/30",
    },
    contenders: [
      { name: "OKC Thunder", shortName: "OKC", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png", bgColor: "bg-blue-900/30" },
      { name: "Denver Nuggets", shortName: "DEN", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/den.png", bgColor: "bg-yellow-900/30" },
      { name: "New York Knicks", shortName: "NYK", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png", bgColor: "bg-orange-900/30" },
    ],
  },
  "nfl-2026-season": {
    favorite: {
      name: "Kansas City Chiefs",
      shortName: "KC",
      logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
      bgColor: "bg-red-900/30",
    },
    contenders: [
      { name: "Detroit Lions", shortName: "DET", logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/det.png", bgColor: "bg-blue-900/30" },
      { name: "Philadelphia Eagles", shortName: "PHI", logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png", bgColor: "bg-emerald-900/30" },
      { name: "Buffalo Bills", shortName: "BUF", logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png", bgColor: "bg-blue-900/30" },
    ],
  },
  "premier-league": {
    favorite: {
      name: "Arsenal",
      shortName: "ARS",
      logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png",
      bgColor: "bg-red-900/30",
    },
    contenders: [
      { name: "Manchester City", shortName: "MCI", logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/382.png", bgColor: "bg-sky-900/30" },
      { name: "Liverpool", shortName: "LIV", logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/364.png", bgColor: "bg-red-900/30" },
    ],
  },
  "champions-league": {
    favorite: {
      name: "Real Madrid",
      shortName: "RMA",
      logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
      bgColor: "bg-violet-900/30",
    },
    contenders: [
      { name: "Arsenal", shortName: "ARS", logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png", bgColor: "bg-red-900/30" },
      { name: "Bayern Munich", shortName: "BAY", logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/132.png", bgColor: "bg-red-900/30" },
      { name: "Barcelona", shortName: "BAR", logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png", bgColor: "bg-blue-900/30" },
    ],
  },
  "mlb-season-2026": {
    favorite: {
      name: "Los Angeles Dodgers",
      shortName: "LAD",
      logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png",
      bgColor: "bg-blue-900/30",
    },
    contenders: [
      { name: "New York Yankees", shortName: "NYY", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png", bgColor: "bg-slate-900/30" },
      { name: "Atlanta Braves", shortName: "ATL", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png", bgColor: "bg-red-900/30" },
    ],
  },
  "formula-1-2026": {
    favorite: {
      name: "Scuderia Ferrari",
      shortName: "FER",
      logoUrl: logo("ferrari.com"),
      bgColor: "bg-red-900/30",
    },
    contenders: [
      { name: "Red Bull Racing", shortName: "RBR", logoUrl: logo("redbullracing.com"), bgColor: "bg-blue-900/30" },
      { name: "McLaren", shortName: "MCL", logoUrl: logo("mclaren.com"), bgColor: "bg-orange-900/30" },
    ],
  },
  "ufc-mma": {
    favorite: {
      name: "Islam Makhachev",
      shortName: "MAK",
      logoUrl: logo("ufc.com"),
      bgColor: "bg-red-900/30",
    },
    contenders: [],
  },
  "ai-industry": {
    favorite: {
      name: "OpenAI",
      shortName: "OAI",
      logoUrl: logo("openai.com"),
      bgColor: "bg-emerald-900/30",
    },
    contenders: [
      { name: "Google DeepMind", shortName: "GDM", logoUrl: logo("deepmind.google"), bgColor: "bg-blue-900/30" },
      { name: "Anthropic", shortName: "ANT", logoUrl: logo("anthropic.com"), bgColor: "bg-amber-900/30" },
      { name: "Meta AI", shortName: "META", logoUrl: logo("ai.meta.com"), bgColor: "bg-blue-900/30" },
    ],
  },
  "2026-us-midterm-elections": {
    favorite: {
      name: "Republicans",
      shortName: "GOP",
      logoUrl: logo("gop.com"),
      bgColor: "bg-red-900/30",
    },
    contenders: [
      { name: "Democrats", shortName: "DEM", logoUrl: logo("democrats.org"), bgColor: "bg-blue-900/30" },
    ],
  },
  "netflix-streaming-wars": {
    favorite: {
      name: "Netflix",
      shortName: "NFLX",
      logoUrl: logo("netflix.com"),
      bgColor: "bg-red-900/30",
    },
    contenders: [
      { name: "Disney+", shortName: "DIS", logoUrl: logo("disneyplus.com"), bgColor: "bg-blue-900/30" },
      { name: "Apple TV+", shortName: "ATV", logoUrl: logo("tv.apple.com"), bgColor: "bg-slate-900/30" },
    ],
  },
  "spotify-vs-apple-music": {
    favorite: {
      name: "Spotify",
      shortName: "SPOT",
      logoUrl: logo("spotify.com"),
      bgColor: "bg-emerald-900/30",
    },
    contenders: [
      { name: "Apple Music", shortName: "AAPL", logoUrl: logo("music.apple.com"), bgColor: "bg-pink-900/30" },
    ],
  },
};

/**
 * Check if a question is a competition/pick-a-winner type.
 * These get team answers instead of yes/no verdicts.
 */
export function isCompetitionQuestion(questionText: string): boolean {
  const q = questionText.toLowerCase();
  return (
    q.startsWith("who will win") ||
    q.startsWith("who is the") ||
    q.startsWith("which party will win") ||
    q.startsWith("which ai company") ||
    q.startsWith("which streaming")
  );
}

/**
 * Get the competition answer for a topic slug.
 * Returns null if the topic has no competition mapping.
 */
export function getCompetitionAnswer(topicSlug: string): CompetitionAnswer | null {
  return COMPETITION_ANSWERS[topicSlug] ?? null;
}

// ─── Topic logos: non-competition topics that deserve a visual identity ─────
// Used on topic pages and cards to give each topic a recognizable icon.

const TOPIC_LOGOS: Record<string, { logoUrl: string; bgColor: string }> = {
  // Tech
  "tesla": { logoUrl: logo("tesla.com"), bgColor: "bg-red-900/30" },
  "apple": { logoUrl: logo("apple.com"), bgColor: "bg-slate-900/30" },
  "spacex-starship": { logoUrl: logo("spacex.com"), bgColor: "bg-slate-900/30" },
  "tiktok-ban": { logoUrl: logo("tiktok.com"), bgColor: "bg-pink-900/30" },
  "ai-industry": { logoUrl: logo("openai.com"), bgColor: "bg-emerald-900/30" },

  // Macro / institutions
  "us-federal-reserve-interest-rates": { logoUrl: logo("federalreserve.gov"), bgColor: "bg-blue-900/30" },
  "us-inflation-rate": { logoUrl: logo("bls.gov"), bgColor: "bg-blue-900/30" },
  "us-stock-market": { logoUrl: logo("nyse.com"), bgColor: "bg-blue-900/30" },
  "us-housing-market": { logoUrl: logo("realtor.com"), bgColor: "bg-blue-900/30" },
  "ecb-interest-rates": { logoUrl: logo("ecb.europa.eu"), bgColor: "bg-blue-900/30" },
  "uk-inflation": { logoUrl: logo("bankofengland.co.uk"), bgColor: "bg-blue-900/30" },
  "gold-price": { logoUrl: logo("gold.org"), bgColor: "bg-yellow-900/30" },
  "global-oil-prices": { logoUrl: logo("opec.org"), bgColor: "bg-amber-900/30" },
  "us-dollar-strength": { logoUrl: logo("treasury.gov"), bgColor: "bg-emerald-900/30" },
  "china-gdp-growth": { logoUrl: "https://flagcdn.com/w160/cn.png", bgColor: "bg-red-900/30" },
  "japan-economy": { logoUrl: "https://flagcdn.com/w160/jp.png", bgColor: "bg-red-900/30" },
  "india-economy": { logoUrl: "https://flagcdn.com/w160/in.png", bgColor: "bg-orange-900/30" },

  // Politics
  "us-supreme-court": { logoUrl: logo("uscourts.gov"), bgColor: "bg-slate-900/30" },
  "us-congress-legislation": { logoUrl: logo("congress.gov"), bgColor: "bg-slate-900/30" },
  "us-debt-ceiling": { logoUrl: logo("treasury.gov"), bgColor: "bg-slate-900/30" },
  "artificial-intelligence-policy": { logoUrl: logo("whitehouse.gov"), bgColor: "bg-blue-900/30" },
  "us-trade-policy": { logoUrl: logo("ustr.gov"), bgColor: "bg-blue-900/30" },
  "us-immigration-policy": { logoUrl: logo("uscis.gov"), bgColor: "bg-blue-900/30" },
  "us-healthcare-policy": { logoUrl: logo("hhs.gov"), bgColor: "bg-blue-900/30" },
  "uk-elections": { logoUrl: "https://flagcdn.com/w160/gb.png", bgColor: "bg-red-900/30" },
  "india-elections": { logoUrl: "https://flagcdn.com/w160/in.png", bgColor: "bg-orange-900/30" },
  "brazil-politics": { logoUrl: "https://flagcdn.com/w160/br.png", bgColor: "bg-green-900/30" },
  "france-elections": { logoUrl: "https://flagcdn.com/w160/fr.png", bgColor: "bg-blue-900/30" },

  // Crypto
  "bitcoin-price": { logoUrl: logo("bitcoin.org"), bgColor: "bg-amber-900/30" },
  "ethereum-price": { logoUrl: logo("ethereum.org"), bgColor: "bg-indigo-900/30" },
  "crypto-market": { logoUrl: logo("coingecko.com"), bgColor: "bg-emerald-900/30" },

  // Geopolitics (flags)
  "russia-ukraine-war": { logoUrl: "https://flagcdn.com/w160/ua.png", bgColor: "bg-blue-900/30" },
  "china-taiwan-relations": { logoUrl: "https://flagcdn.com/w160/tw.png", bgColor: "bg-red-900/30" },
  "israel-palestine-conflict": { logoUrl: "https://flagcdn.com/w160/il.png", bgColor: "bg-blue-900/30" },
  "iran-us-tensions": { logoUrl: "https://flagcdn.com/w160/ir.png", bgColor: "bg-red-900/30" },
  "iran-nuclear-program": { logoUrl: "https://flagcdn.com/w160/ir.png", bgColor: "bg-red-900/30" },
  "north-korea": { logoUrl: "https://flagcdn.com/w160/kp.png", bgColor: "bg-red-900/30" },
  "nato-alliance": { logoUrl: logo("nato.int"), bgColor: "bg-blue-900/30" },
  "european-union": { logoUrl: logo("europa.eu"), bgColor: "bg-blue-900/30" },
  "lebanon-war-2026": { logoUrl: "https://flagcdn.com/w160/lb.png", bgColor: "bg-red-900/30" },
  "sudan-conflict": { logoUrl: "https://flagcdn.com/w160/sd.png", bgColor: "bg-red-900/30" },
  "venezuela-crisis": { logoUrl: "https://flagcdn.com/w160/ve.png", bgColor: "bg-yellow-900/30" },
  "climate-change": { logoUrl: logo("unfccc.int"), bgColor: "bg-emerald-900/30" },

  // Disasters
  "earthquake-activity": { logoUrl: logo("usgs.gov"), bgColor: "bg-orange-900/30" },
  "severe-weather-alerts": { logoUrl: logo("weather.gov"), bgColor: "bg-orange-900/30" },
  "hurricane-season-2026": { logoUrl: logo("noaa.gov"), bgColor: "bg-orange-900/30" },
  "wildfire-season": { logoUrl: logo("nifc.gov"), bgColor: "bg-orange-900/30" },

  // Entertainment
  "taylor-swift": { logoUrl: logo("taylorswift.com"), bgColor: "bg-pink-900/30" },
  "marvel-cinematic-universe": { logoUrl: logo("marvel.com"), bgColor: "bg-red-900/30" },
  "oscar-awards-2026": { logoUrl: logo("oscars.org"), bgColor: "bg-yellow-900/30" },
  "grammy-awards-2026": { logoUrl: logo("grammy.com"), bgColor: "bg-yellow-900/30" },
  "eurovision-2026": { logoUrl: logo("eurovision.tv"), bgColor: "bg-pink-900/30" },
  "gta-6": { logoUrl: logo("rockstargames.com"), bgColor: "bg-slate-900/30" },
  "beyonce": { logoUrl: logo("beyonce.com"), bgColor: "bg-yellow-900/30" },
  "k-pop": { logoUrl: logo("kprofiles.com"), bgColor: "bg-pink-900/30" },
  "bollywood": { logoUrl: "https://flagcdn.com/w160/in.png", bgColor: "bg-orange-900/30" },
  "star-wars": { logoUrl: logo("starwars.com"), bgColor: "bg-yellow-900/30" },
  "game-of-thrones-spinoffs": { logoUrl: logo("hbo.com"), bgColor: "bg-slate-900/30" },
  "video-game-industry": { logoUrl: logo("ign.com"), bgColor: "bg-red-900/30" },

  // Sports (non-competition topics)
  "la-liga": { logoUrl: logo("laliga.com"), bgColor: "bg-blue-900/30" },
  "bundesliga": { logoUrl: logo("bundesliga.com"), bgColor: "bg-red-900/30" },
  "ipl-cricket": { logoUrl: logo("iplt20.com"), bgColor: "bg-blue-900/30" },
  "cricket-world-cup": { logoUrl: logo("icc-cricket.com"), bgColor: "bg-blue-900/30" },
  "tennis-grand-slams": { logoUrl: logo("wimbledon.com"), bgColor: "bg-emerald-900/30" },
  "olympics-2028": { logoUrl: logo("olympics.com"), bgColor: "bg-blue-900/30" },
  "tour-de-france": { logoUrl: logo("letour.fr"), bgColor: "bg-yellow-900/30" },
  "rugby-world-cup": { logoUrl: logo("rugbyworldcup.com"), bgColor: "bg-emerald-900/30" },
};

/**
 * Get a logo for any topic by slug.
 * Used on topic pages and cards for visual identity.
 */
export function getTopicLogo(topicSlug: string): { logoUrl: string; bgColor: string } | null {
  return TOPIC_LOGOS[topicSlug] ?? null;
}

// ─── Single-entity matching (for Polymarket-imported team questions) ─────

const TEAM_MAP: Array<{ pattern: RegExp; entity: TeamEntity }> = [
  { pattern: /\bceltics\b/i, entity: COMPETITION_ANSWERS["nba-season-2025-26"].favorite },
  { pattern: /\bhornets\b/i, entity: { name: "Charlotte Hornets", shortName: "CHA", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cha.png", bgColor: "bg-teal-900/30" } },
  { pattern: /\bchiefs\b/i, entity: COMPETITION_ANSWERS["nfl-2026-season"].favorite },
  { pattern: /\barsenal\b/i, entity: COMPETITION_ANSWERS["premier-league"].favorite },
  { pattern: /\breal madrid\b/i, entity: COMPETITION_ANSWERS["champions-league"].favorite },
  { pattern: /\bdodgers\b/i, entity: COMPETITION_ANSWERS["mlb-season-2026"].favorite },
  { pattern: /\bferrari\b/i, entity: COMPETITION_ANSWERS["formula-1-2026"].favorite },
  { pattern: /\bbrazil\b/i, entity: COMPETITION_ANSWERS["fifa-world-cup-2026"].favorite },
  { pattern: /\bscotland\b/i, entity: { name: "Scotland", shortName: "SCO", logoUrl: "https://flagcdn.com/w160/gb-sct.png", bgColor: "bg-blue-900/30" } },
  { pattern: /\bcroatia\b/i, entity: { name: "Croatia", shortName: "CRO", logoUrl: "https://flagcdn.com/w160/hr.png", bgColor: "bg-red-900/30" } },
  { pattern: /\bmakhachev\b/i, entity: COMPETITION_ANSWERS["ufc-mma"].favorite },
  { pattern: /\bargentin/i, entity: COMPETITION_ANSWERS["fifa-world-cup-2026"].contenders[0] },
  { pattern: /\bfrance\b/i, entity: COMPETITION_ANSWERS["fifa-world-cup-2026"].contenders[1] },
  { pattern: /\bopenai\b/i, entity: COMPETITION_ANSWERS["ai-industry"].favorite },
  { pattern: /\bnetflix\b/i, entity: COMPETITION_ANSWERS["netflix-streaming-wars"].favorite },
  { pattern: /\bspotify\b/i, entity: COMPETITION_ANSWERS["spotify-vs-apple-music"].favorite },
];

/**
 * Extract a team/entity from question text (for Polymarket-imported questions
 * that mention a specific team, e.g. "Will the Charlotte Hornets win...").
 */
export function getTeamEntity(questionText: string): TeamEntity | null {
  for (const entry of TEAM_MAP) {
    if (entry.pattern.test(questionText)) {
      return entry.entity;
    }
  }
  return null;
}
