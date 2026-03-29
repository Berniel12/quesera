import { BaseAdapter, type FetchResult, type RawItem, type NormalizedItem } from "./base.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";

// The Odds API: aggregates odds from 70+ bookmakers across 40+ sports
// Free tier: 500 requests/month

// Head-to-head match odds (individual games)
const H2H_SPORT_KEYS = [
  "soccer_fifa_world_cup",
  "soccer_epl",
  "soccer_uefa_champs_league",
  "soccer_spain_la_liga",
  "basketball_nba",
  "americanfootball_nfl",
];

// Outright/futures odds (tournament winners) -- these are the competition signals
// Only keys confirmed available via the API (checked 2026-03-29)
const OUTRIGHTS_SPORT_KEYS = [
  "soccer_fifa_world_cup_winner",
  "basketball_nba_championship_winner",
  "americanfootball_nfl_super_bowl_winner",
  "baseball_mlb_world_series_winner",
  "icehockey_nhl_championship_winner",
  "politics_us_presidential_election_winner",
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

    // Fetch head-to-head match odds
    for (const sport of H2H_SPORT_KEYS) {
      try {
        const url = `${config.base_url}/sports/${sport}/odds/?apiKey=${apiKey}&regions=us,eu&markets=h2h&oddsFormat=decimal`;
        const response = await fetchWithRetry({ url, logger: this.logger });
        const events = (await response.json()) as OddsEvent[];

        for (const event of events) {
          const bestOdds = event.bookmakers?.[0];
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
              market_type: "h2h",
            },
            occurredAt: event.commence_time ? new Date(event.commence_time) : undefined,
          });
        }
      } catch (err) {
        this.logger.warn({ sport, err }, "Failed to fetch h2h odds");
      }
    }

    // Fetch outright/futures odds (tournament winner markets)
    // These are the competition signals -- who will win the league/cup
    for (const sport of OUTRIGHTS_SPORT_KEYS) {
      try {
        const url = `${config.base_url}/sports/${sport}/odds/?apiKey=${apiKey}&regions=us,eu&markets=outrights&oddsFormat=decimal`;
        const response = await fetchWithRetry({ url, logger: this.logger });
        const events = (await response.json()) as OddsEvent[];

        for (const event of events) {
          // Outright markets: each bookmaker has an "outrights" market with all contenders
          for (const bookie of event.bookmakers ?? []) {
            const outright = bookie.markets?.find((m) => m.key === "outrights");
            if (!outright) continue;

            for (const outcome of outright.outcomes) {
              // Map outright sport key back to the base sport for seed map matching
              // e.g., "soccer_fifa_world_cup_winner" -> "soccer_fifa_world_cup"
              const baseSport = sport.replace(/_winner$/, "").replace(/_championship_winner$/, "");

              items.push({
                externalId: `${event.id}-outright-${outcome.name}-${bookie.key}`,
                payload: {
                  sport_key: baseSport,
                  sport_title: event.sport_title,
                  home_team: outcome.name,
                  away_team: "",
                  commence_time: event.commence_time,
                  bookmaker: bookie.key,
                  outcomes: [{
                    name: outcome.name,
                    price: outcome.price,
                    implied_probability: outcome.price > 0 ? 1 / outcome.price : 0,
                  }],
                  bookmaker_count: event.bookmakers?.length ?? 0,
                  market_type: "outright",
                  question: `Will ${outcome.name} win the ${event.sport_title}?`,
                },
                occurredAt: event.commence_time ? new Date(event.commence_time) : undefined,
              });
            }
            break; // Use first bookmaker only to avoid duplication
          }
        }
      } catch (err) {
        this.logger.warn({ sport, err }, "Failed to fetch outright odds");
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
