import "./styles.css";

import {
  CITIES,
  CITY_LABELS,
  loadCities,
  loadConcentration,
  loadMeta,
  loadNeighbourhoods,
  loadNights,
  loadRegister,
  loadRents,
  loadTransitions,
  loadTrends,
  type CityRow,
  type Meta,
  type Register,
} from "./data";
import { initFlowsScreen, initGapScreen } from "./flowsScreen";
import { initHosts } from "./hosts";
import { initLicences } from "./licences";
import { initMapScreen } from "./mapScreen";
import { initPrice } from "./price";
import { initRegisterScreen } from "./registerScreen";
import { initRents } from "./rentsScreen";
import { initRules } from "./rules";
import { byId, formatInt, initPager, initProgress, monthYear, pct, redrawOnResize, safely, setHtml, type Draw } from "./story";
import { initWall } from "./wall";

const LATEST_ROUND = "Sep 2026";
const REPOSITORY_URL = "https://github.com/renzorico/spain-housing-str-analysis";

function renderHero(cities: CityRow[], register: Register, meta: Meta): void {
  const line = meta.stay_line_nights;
  const share = (c: CityRow) => c.rounds[LATEST_ROUND]?.share_month_plus ?? 0;
  const bcn = cities.find((c) => c.city === "barcelona");
  if (!bcn) return;
  const bcnRound = bcn.rounds[LATEST_ROUND];
  const others = cities.filter((c) => c.city !== "barcelona");
  const lo = Math.min(...others.map(share));
  const hi = Math.max(...others.map(share));
  const inTen = Math.round(share(bcn) / 10);
  const latestRegister = register.match.at(-1);

  byId("hero-title").innerHTML = `<em>${inTen} in 10</em> Barcelona Airbnb listings ask guests to stay a month or more.`;
  setHtml(
    "hero-lede",
    `In Catalonia a tourist stay is legally ${line} days or fewer. In ${LATEST_ROUND}, ${pct(share(bcn))} of Barcelona's Airbnb listings with open dates asked for a minimum of ${line} nights or more, ` +
      `against ${pct(lo)}–${pct(hi)} in ${others.map((c) => CITY_LABELS[c.city]).join(", ").replace(/, ([^,]*)$/, " and $1")}. ` +
      "What that shows about the housing rules, and what it cannot.",
  );
  const stats: [string, string][] = [
    [formatInt(bcnRound?.active ?? 0), `Barcelona listings with open dates, ${LATEST_ROUND}`],
    [pct(share(bcn)), `ask for ${line}+ nights`],
    [`${pct(lo, 0)}–${pct(hi, 0)}`, "the same share in Madrid, Valencia, Málaga, Sevilla"],
    [formatInt(latestRegister?.register_records ?? 0), "tourist flats on the city's official register"],
  ];
  byId("hero-stats").innerHTML = stats.map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`).join("");
}

function renderMethod(meta: Meta, cities: CityRow[]): void {
  const snapshots = Object.values(meta.snapshots).reduce((n, s) => n + s.length, 0);
  const steps: [string, string][] = [
    ["Download", `${snapshots} Inside Airbnb snapshots for ${CITIES.length} cities, the city's tourist-flat register, and official rents.`],
    ["Count", "Only listings with at least one open date in the next year, so dormant ones do not inflate the totals."],
    ["Classify", `Each listing by the minimum stay it asks: under ${meta.stay_line_nights}, exactly ${meta.stay_line_nights}, or over. Never by legality.`],
    ["Match", "Licence numbers shown on listings against the register, as numbers, never as addresses."],
    ["Compare", "Cities with intervals that resample whole host accounts, so one large operator cannot fake a pattern."],
    ["Publish", "Tests check that no host, listing or address can be identified in the published data."],
  ];
  byId("pipeline").innerHTML = steps.map(([b, t]) => `<li><b>${b}</b>${t}</li>`).join("");
  byId("caveats").innerHTML = meta.caveats.map((c) => `<li>${c}</li>`).join("");
  byId("sources").innerHTML = meta.sources
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a> (${s.licence})</li>`)
    .join("");
  const sizes = cities.map((c) => `${CITY_LABELS[c.city]} ${formatInt(c.rounds[LATEST_ROUND]?.active ?? 0)}`).join(", ");
  byId("endnote-caveat").textContent =
    `Listings with open dates in the ${LATEST_ROUND} snapshots: ${sizes}. A minimum stay is a setting, not a stay; a missing licence number is not proof of a breach; comparisons show timing and differences, not causes.`;
  byId("footer-links").innerHTML =
    `<span>Data as of ${monthYear(meta.observation_window[1])}; rules checked ${meta.levers_as_of}.</span>` +
    `<span>Code, notebooks and corrections: <a href="${REPOSITORY_URL}" target="_blank" rel="noopener">GitHub</a></span>` +
    "<span>Data: Inside Airbnb, Ajuntament de Barcelona, Generalitat de Catalunya (CC BY 4.0)</span>";
}

async function main(): Promise<void> {
  initPager();
  initProgress();
  const [meta, nights, cities, register, transitions, concentration, neighbourhoods, rents, trends] = await Promise.all([
    loadMeta(),
    loadNights(),
    loadCities(),
    loadRegister(),
    loadTransitions(),
    loadConcentration(),
    loadNeighbourhoods(),
    loadRents(),
    loadTrends(),
  ]);
  const line = meta.stay_line_nights;
  renderHero(cities, register, meta);
  renderMethod(meta, cities);

  const draws: Draw[] = [
    safely("wall", initWall(nights, line)),
    safely("price", initPrice(nights, line)),
    safely("flows", initFlowsScreen(transitions, line)),
    safely("gap", initGapScreen(cities)),
    safely("licences", initLicences(trends)),
    safely("register", initRegisterScreen(register, meta.policy_levers.tourist_licence_phase_out)),
    safely("hosts", initHosts(concentration, cities, meta.professional_min)),
    safely("rents", initRents(rents, meta)),
    safely("rules", initRules({ meta, register, rents, trends, cities })),
  ];
  const drawAll = () => draws.forEach((draw) => draw());
  drawAll();
  redrawOnResize(drawAll);
  initMapScreen(meta.snapshots.barcelona, neighbourhoods, line).catch((error: unknown) => {
    console.error("Map failed to load", error);
    byId("map").textContent = "The map could not load. The figures above do not depend on it.";
  });
}

main().catch((error: unknown) => {
  console.error(error);
  byId("hero-lede").textContent = "The data could not load. Please reload the page.";
});
