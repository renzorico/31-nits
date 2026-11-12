// Types and loaders for the JSON written by scripts/export_site_data.py.
// Paths are relative so the build works under any GitHub Pages subpath.

export const CITIES = ["barcelona", "madrid", "valencia", "malaga", "sevilla"] as const;
export type City = (typeof CITIES)[number];

export const CITY_LABELS: Record<City, string> = {
  barcelona: "Barcelona",
  madrid: "Madrid",
  valencia: "Valencia",
  malaga: "Málaga",
  sevilla: "Sevilla",
};

export interface Source {
  title: string;
  url: string;
  licence: string;
}

/** Translated fields for "es" and "ca"; English is the record itself. */
export type Translations<F extends string> = Partial<Record<"es" | "ca", Partial<Record<F, string | string[]>>>>;

export type LeverField = "title" | "timeline_label" | "jurisdiction" | "rule" | "exceptions" | "status" | "notes" | "data_limits";

export interface PolicyLever {
  i18n?: Translations<LeverField>;
  title: string;
  timeline_label: string;
  jurisdiction: string;
  applies_to: City[];
  mechanism: string;
  rule: string;
  exceptions: string[];
  law: string;
  applies_from: string;
  deadline: string | null;
  status: string;
  status_checked_on: string;
  sources: { label: string; url: string }[];
  notes: string;
  data_limits: string;
}

export type LaterField = "title" | "label" | "short_label" | "summary" | "note";

export interface LaterDevelopment {
  i18n?: Translations<LaterField>;
  date: string;
  label: string;
  short_label: string;
  law: string;
  title: string;
  summary: string;
  note: string;
  url: string;
}

export interface Meta {
  generated: string;
  snapshots: Record<City, string[]>;
  policy_levers: Record<string, PolicyLever>;
  levers_as_of: string;
  observation_window: [string, string];
  post_observation_developments: LaterDevelopment[];
  context_events: Record<string, string>;
  stay_line_nights: number;
  professional_min: number;
  author: string;
  published_on: string;
  sources: Source[];
  caveats: string[];
  caveats_i18n?: Partial<Record<"es" | "ca", string[]>>;
}

/** One quarter's Barcelona listings with open dates, as parallel arrays. */
export interface Points {
  legend: {
    band: string[];
    licence: string[];
    room: string[];
    host_size: string[];
  };
  lat: number[];
  lon: number[];
  band: number[];
  licence: number[];
  room: number[];
  host_size: number[];
  nights: number[];
  price: (number | null)[];
}

export interface NightsRow {
  city: City;
  snapshot: string;
  round: string;
  nights: number;
  listings: number;
  median_price: number | null;
}

export interface SnapshotSummary {
  population: string;
  /** [numerator, denominator] behind each share_* value */
  counts: Record<string, [number, number]>;
  listings: number;
  active: number;
  share_31_nights: number;
  share_month_plus: number;
  share_tourist_licence: number;
  share_nrua_seasonal: number;
  share_professional: number;
  share_entire_home: number;
  median_price: number | null;
}

export interface PopulationCheck {
  listings: number;
  unknown_minimum_stay: number;
  known_minimum_stay: number;
  month_plus_pct: number;
}

export interface ExitGap {
  points: number;
  /** 95% interval resampling host accounts (the one to quote) */
  ci_low: number;
  ci_high: number;
  method: string;
  /** naive interval treating listings as independent; understated */
  listing_level_ci_low: number;
  listing_level_ci_high: number;
  accounts: number;
  month_plus_listings: number;
  shorter_listings: number;
  /** share of month-plus / shorter-stay listings absent from the later snapshot, % */
  month_plus_gone_pct: number;
  shorter_gone_pct: number;
  /** first and last snapshot dates compared */
  from: string;
  to: string;
  top10_accounts_share_of_month_plus_pct: number;
  /** Barcelona minus this city; null for Barcelona itself */
  vs_barcelona: { difference_points: number; ci_low: number; ci_high: number } | null;
}

export interface CityRow {
  city: City;
  scrape_dates: Record<string, string>;
  availability_sensitivity: {
    open_dates: PopulationCheck;
    open_dates_or_reviewed_12m: PopulationCheck;
    all_listings: PopulationCheck;
  };
  rounds: Record<string, SnapshotSummary>;
  exit_gap: ExitGap;
  top_host_share: Record<string, number>;
}

export interface RegisterMatch {
  snapshot: string;
  /** the register quarter nearest in time to this snapshot */
  register_quarter: string;
  /** administrative records (case ids): the headline stock */
  register_records: number;
  /** distinct parseable HUT numbers; a few records have none */
  register_numbers: number;
  listings_showing_number: number;
  displayed_numbers: number;
  displayed_numbers_found_in_register: number;
  /** share of displayed numbers that exist in the register */
  displayed_found_pct: number;
  /** share of register numbers shown on at least one listing with open dates */
  register_numbers_displayed_pct: number;
  numbers_on_2plus_listings: number;
}

export interface NeighbourhoodReconciliation {
  listings_total: number;
  listings_in_neighbourhood_rows: number;
  register_total: number;
  register_in_neighbourhood_rows: number;
  register_without_known_neighbourhood: number;
}

export interface Register {
  register_quarter: string;
  totals: Record<string, number>;
  match: RegisterMatch[];
  neighbourhood_reconciliation: NeighbourhoodReconciliation;
}

// Minimum stay asked, against the 31-night line. Observed settings, not legal classes.
export const BANDS = ["under_31", "exactly_31", "over_31"] as const;
export type Band = (typeof BANDS)[number];

/** Where one snapshot's listings with open dates were in a later snapshot. */
export interface TransitionTable {
  from_snapshot: string;
  to_snapshot: string;
  from: Band[];
  to: string[]; // the bands, then "inactive" (listed, no open dates) and "gone" (absent from the later scrape)
  counts: number[][];
}

export interface Transitions {
  cities: Record<City, TransitionTable>;
  barcelona_quarters: TransitionTable[];
}

export type Concentration = Record<City, { host_share: number[]; listing_share: number[] }>;

export interface NeighbourhoodRow {
  neighbourhood: string;
  district: string;
  active_listings: number;
  with_tourist_licence: number;
  registered_huts: number;
  share_month_plus: number | null;
  share_professional: number | null;
  median_price: number | null;
}

export interface RentRow {
  quarter_start: string;
  avg_rent: number;
  new_leases: number;
  yoy_pct: number | null;
}

export interface BarcelonaTrend {
  snapshot: string;
  bands: Record<Band, number>;
  regional_licence: Record<string, number>;
  national_licence: Record<string, number>;
  median_price_by_band: Record<Band, number | null>;
}

async function loadJson<T>(file: string): Promise<T> {
  const response = await fetch(`data/${file}`);
  if (!response.ok) {
    throw new Error(`Could not load data/${file} (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

export const loadMeta = () => loadJson<Meta>("meta.json");
export const loadNights = () => loadJson<NightsRow[]>("minimum_nights.json");
export const loadCities = () => loadJson<CityRow[]>("cities.json");
export const loadRegister = () => loadJson<Register>("register.json");
export const loadTransitions = () => loadJson<Transitions>("transitions.json");
export const loadConcentration = () => loadJson<Concentration>("concentration.json");
export const loadNeighbourhoods = () => loadJson<NeighbourhoodRow[]>("neighbourhoods.json");
export const loadRents = () => loadJson<RentRow[]>("rents.json");
export const loadTrends = () => loadJson<BarcelonaTrend[]>("barcelona_trends.json");
export const loadGeo = () => loadJson<import("geojson").FeatureCollection>("neighbourhoods.geojson");

// Map files are ~400 kB each, so they are fetched on demand and cached.
const pointsCache = new Map<string, Promise<Points>>();
export function loadPoints(snapshot: string): Promise<Points> {
  let cached = pointsCache.get(snapshot);
  if (!cached) {
    cached = loadJson<Points>(`barcelona_points_${snapshot}.json`);
    pointsCache.set(snapshot, cached);
  }
  return cached;
}
