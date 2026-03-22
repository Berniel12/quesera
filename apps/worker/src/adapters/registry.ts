import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";
import { BaseAdapter, type SourceDefinitionRow } from "./base.js";
import { UsgsEarthquakesAdapter } from "./usgs-earthquakes.js";
import { NoaaNwsAdapter } from "./noaa-nws.js";
import { OpenMeteoAdapter } from "./open-meteo.js";
import { WikidataAdapter } from "./wikidata.js";
import { FredAdapter } from "./fred.js";
import { CongressGovAdapter } from "./congress-gov.js";
import { FecAdapter } from "./fec.js";
import { PolymarketAdapter } from "./polymarket.js";
import { KalshiAdapter } from "./kalshi.js";
import { MetaculusAdapter } from "./metaculus.js";
import { ManifoldAdapter } from "./manifold.js";
import { NewsApiAdapter } from "./newsapi.js";
import { RssAdapter } from "./rss.js";
import { ReliefWebAdapter } from "./reliefweb.js";
import { GdeltAdapter } from "./gdelt.js";
import { BlsAdapter } from "./bls.js";
import { EiaAdapter } from "./eia.js";
import { WorldBankAdapter } from "./world-bank.js";

type AdapterConstructor = new (
  sourceDefinition: SourceDefinitionRow,
  supabase: SupabaseClient,
  logger: Logger,
) => BaseAdapter;

const adapters: Record<string, AdapterConstructor> = {
  // Phase 1: Structured truth backbone
  usgs_earthquakes: UsgsEarthquakesAdapter,
  noaa_nws: NoaaNwsAdapter,
  open_meteo: OpenMeteoAdapter,
  wikidata: WikidataAdapter,
  fred: FredAdapter,
  congress_gov: CongressGovAdapter,
  fec: FecAdapter,
  // Prediction markets
  polymarket: PolymarketAdapter,
  kalshi: KalshiAdapter,
  metaculus: MetaculusAdapter,
  manifold: ManifoldAdapter,
  // Evidence / news
  newsapi: NewsApiAdapter,
  rss: RssAdapter,
  reliefweb: ReliefWebAdapter,
  gdelt: GdeltAdapter,
  // Macro expansion
  bls: BlsAdapter,
  eia: EiaAdapter,
  world_bank: WorldBankAdapter,
};

export function getAdapter(
  sourceKey: string,
  sourceDefinition: SourceDefinitionRow,
  supabase: SupabaseClient,
  logger: Logger,
): BaseAdapter {
  const AdapterClass = adapters[sourceKey];
  if (!AdapterClass) {
    throw new Error(`No adapter registered for source: ${sourceKey}`);
  }
  return new AdapterClass(sourceDefinition, supabase, logger);
}
