import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// The Odds API: aggregates odds from 70+ bookmakers across 40+ sports
// Free tier: 500 requests/month

const SPORT_KEYS = [
  "soccer_fifa_world_cup",
  "soccer_epl",
  "soccer_uefa_champs_league",
  "motorsport_formula1",
  "basketball_nba",
  "americanfootball_nfl",
];

export class TheOddsApiAdapter extends BaseAdapter {
  async fetch(): Promise<FetchResult> {
    const config = this.sourceDefinition.config as { base_url: string };
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) {
      this.logger.warn("THE_ODDS_API_KEY not set, skipping");
      return { items: [] };
    }

    const items: RawItem[] = [];

    for (const sport of SPORT_KEYS) {
      try {
        const url = `${config.base_url}/sports/${sport}/odds/?apiKey=${apiKey}&regions=us,eu&markets=h2h&oddsFormat=decimal`;
        const response = await fetchWithRetry({ url, logger: this.logger });
        const events = (await response.json()) as OddsEvent[];

        for (const event of events) {
          const bestOdds = event.bookmakers?.[0]; // first bookmaker (consensus)
          if (!bestOdds) continue;
          const market = bestOdds.markets?.[0];
          if (!market) continue;

          items.push({
            externalId: event.id,
            payload: {
              sport_key: event.sport_key,
              sport_title: event.sport_title,
              home_team: event.home_team,
              away_team: event.away_team,
              commence_time: event.commence_time,
              bookmaker: bestOdds.key,
              outcomes: market.outcomes.map((o: OddsOutcome) => ({
                name: o.name,
                price: o.price,
                implied_probability: 1 / o.price,
              })),
              bookmaker_count: event.bookmakers?.length ?? 0,
            },
            occurredAt: event.commence_time ? new Date(event.commence_time) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn({ sport, err }, "Failed to fetch odds for sport");
      }
    }

    return { items };
  }

  normalize(raw: RawItem): NormalizedItem {
    const p = raw.payload;
    return {
      external_id: raw.externalId,
      source_key: "the_odds_api",
      source_item_type: "sports_odds",
      payload_type: "odds_api_event_v1",
      normalized_payload: {
        sport_key: p.sport_key,
        sport_title: p.sport_title,
        home_team: p.home_team,
        away_team: p.away_team,
        commence_time: p.commence_time,
        outcomes: p.outcomes,
        bookmaker: p.bookmaker,
        bookmaker_count: p.bookmaker_count,
      },
      content_hash: this.hashPayload({
        id: raw.externalId,
        outcomes: JSON.stringify(p.outcomes),
      }),
      occurred_at: raw.occurredAt?.toISOString() ?? null,
    };
  }
}

interface OddsOutcome {
  name: string;
  price: number;
}

interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers?: Array<{
    key: string;
    markets?: Array<{
      key: string;
      outcomes: OddsOutcome[];
    }>;
  }>;
}
