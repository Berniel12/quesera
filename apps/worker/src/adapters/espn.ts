import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// ESPN unofficial API: 17 sports, 139 leagues — scores, schedules, standings
// No auth required, no key needed

const SPORT_ENDPOINTS = [
  { sport: "soccer", league: "fifa.world", slug: "world-cup" },
  { sport: "soccer", league: "eng.1", slug: "premier-league" },
  { sport: "soccer", league: "uefa.champions", slug: "champions-league" },
  { sport: "racing", league: "f1", slug: "formula-1" },
  { sport: "basketball", league: "nba", slug: "nba" },
  { sport: "football", league: "nfl", slug: "nfl" },
];

export class EspnAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };
    const items: RawItem[] = [];

    for (const endpoint of SPORT_ENDPOINTS) {
      try {
        const url = `${config.base_url}/${endpoint.sport}/${endpoint.league}/scoreboard`;
        const response = await fetchWithRetry({ url, logger: this.logger });
        const data = (await response.json()) as EspnScoreboard;

        for (const event of data.events ?? []) {
          const comp = event.competitions?.[0];
          items.push({
            externalId: event.id,
            payload: {
              name: event.name,
              short_name: event.shortName,
              sport: endpoint.sport,
              league: endpoint.league,
              league_slug: endpoint.slug,
              date: event.date,
              status: comp?.status?.type?.name ?? "unknown",
              competitors: (comp?.competitors ?? []).map((c: EspnCompetitor) => ({
                team: c.team?.displayName ?? c.team?.name,
                score: c.score,
                home_away: c.homeAway,
                winner: c.winner,
              })),
            },
            occurredAt: event.date ? new Date(event.date) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn({ sport: endpoint.sport, league: endpoint.league, err }, "Failed to fetch ESPN data");
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "espn",
      source_item_type: "sports_event",
      payload_type: "espn_event_v1",
      normalized_payload: {
        name: p.name,
        sport: p.sport,
        league: p.league,
        league_slug: p.league_slug,
        date: p.date,
        status: p.status,
        competitors: p.competitors,
      },
      content_hash: this.hashPayload({ id: raw.externalId, status: String(p.status), competitors: JSON.stringify(p.competitors) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface EspnCompetitor {
  team?: { name: string; displayName: string };
  score: string;
  homeAway: string;
  winner: boolean;
}

interface EspnScoreboard {
  events?: Array<{
    id: string;
    name: string;
    shortName: string;
    date: string;
    competitions?: Array<{
      competitors?: EspnCompetitor[];
      status?: { type?: { name: string } };
    }>;
  }>;
}
