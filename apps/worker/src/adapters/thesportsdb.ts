import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

export class TheSportsDbAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string; leagues: string[] };
    const items: RawItem[] = [];

    for (const league of config.leagues) {
      try {
        const url = `${config.base_url}/eventspastleague.php?id=${league}`;
        const res = await fetchWithRetry({ url, logger: this.logger, maxRetries: 1 });
        const data = (await res.json()) as { events?: SportsEvent[] };

        for (const e of (data.events ?? []).slice(0, 20)) {
          items.push({
            externalId: e.idEvent,
            payload: { event_id: e.idEvent, event_name: e.strEvent, league: e.strLeague, sport: e.strSport, home_team: e.strHomeTeam, away_team: e.strAwayTeam, home_score: e.intHomeScore, away_score: e.intAwayScore, date: e.dateEvent, status: e.strStatus, venue: e.strVenue },
            occurredAt: e.dateEvent ? new Date(e.dateEvent) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn({ league, error: err instanceof Error ? err.message : String(err) }, "SportsDB fetch failed");
      }
    }
    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "thesportsdb",
      source_item_type: "sports_event",
      payload_type: "sportsdb_event_v1",
      normalized_payload: { event_name: p.event_name, league: p.league, sport: p.sport, home_team: p.home_team, away_team: p.away_team, home_score: p.home_score, away_score: p.away_score, date: p.date, status: p.status, venue: p.venue },
      content_hash: this.hashPayload({ id: String(p.event_id), home: String(p.home_score), away: String(p.away_score) }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface SportsEvent { idEvent: string; strEvent: string; strLeague: string; strSport: string; strHomeTeam: string; strAwayTeam: string; intHomeScore: string; intAwayScore: string; dateEvent: string; strStatus: string; strVenue: string; }
