// Maps topic slugs to competition answers (favorite + contenders).
// Used when the question is a "Who will win?" type -- shows the predicted
// winner as the answer instead of "Probably yes/no".
//
// Logo URLs: ESPN CDN for teams, flagcdn.com for countries.

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
      logoUrl: "https://a.espncdn.com/i/teamlogos/f1/500/fer.png",
      bgColor: "bg-red-900/30",
    },
    contenders: [
      { name: "Red Bull Racing", shortName: "RBR", logoUrl: "https://a.espncdn.com/i/teamlogos/f1/500/rbr.png", bgColor: "bg-blue-900/30" },
      { name: "McLaren", shortName: "MCL", logoUrl: "https://a.espncdn.com/i/teamlogos/f1/500/mcl.png", bgColor: "bg-orange-900/30" },
    ],
  },
  "ufc-mma": {
    favorite: {
      name: "Islam Makhachev",
      shortName: "MAK",
      logoUrl: "https://a.espncdn.com/i/teamlogos/leagues/500/mma.png",
      bgColor: "bg-red-900/30",
    },
    contenders: [],
  },
  // Non-sports competition questions
  "ai-industry": {
    favorite: {
      name: "OpenAI",
      shortName: "OAI",
      logoUrl: "",
      bgColor: "bg-emerald-900/30",
    },
    contenders: [
      { name: "Google DeepMind", shortName: "GDM", logoUrl: "", bgColor: "bg-blue-900/30" },
      { name: "Anthropic", shortName: "ANT", logoUrl: "", bgColor: "bg-amber-900/30" },
      { name: "Meta AI", shortName: "META", logoUrl: "", bgColor: "bg-blue-900/30" },
    ],
  },
  "2026-us-midterm-elections": {
    favorite: {
      name: "Republicans",
      shortName: "GOP",
      logoUrl: "",
      bgColor: "bg-red-900/30",
    },
    contenders: [
      { name: "Democrats", shortName: "DEM", logoUrl: "", bgColor: "bg-blue-900/30" },
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
    q.startsWith("which ai company")
  );
}

/**
 * Get the competition answer for a topic slug.
 * Returns null if the topic has no competition mapping.
 */
export function getCompetitionAnswer(topicSlug: string): CompetitionAnswer | null {
  return COMPETITION_ANSWERS[topicSlug] ?? null;
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
