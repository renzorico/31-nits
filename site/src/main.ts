import "./styles.css";

import { initCities } from "./cities";
import { initConcentration } from "./concentration";
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
} from "./data";
import { initExitGap, initFlows } from "./flows";
import { initLevers } from "./levers";
import { initRegister } from "./register";
import { initRents } from "./rents";
import { initNightsChart } from "./nightsChart";
import { el, formatPct, POPULATION, requireElement } from "./ui";

const LATEST_ROUND = "Sep 2026";
const REPOSITORY_URL = "https://github.com/renzorico/spain-housing-str-analysis";

function renderHeroStats(cities: CityRow[]): void {
  const latest = (city: string) => cities.find((c) => c.city === city)?.rounds[LATEST_ROUND];
  const barcelona = latest("barcelona");
  const others = CITIES.filter((c) => c !== "barcelona")
    .map((c) => latest(c)?.share_month_plus)
    .filter((v): v is number => v !== undefined);
  if (!barcelona || others.length === 0) return;

  const tiles: [string, string][] = [
    [formatPct(barcelona.share_month_plus, 0), `of Barcelona's ${POPULATION} ask for 31 nights or more (${LATEST_ROUND})`],
    [
      `${Math.round(Math.min(...others))}–${Math.round(Math.max(...others))}%`,
      `ask for 31+ nights in ${CITIES.filter((c) => c !== "barcelona").map((c) => CITY_LABELS[c]).join(", ")}`,
    ],
  ];
  requireElement("hero-stats").replaceChildren(
    ...tiles.map(([value, label]) => {
      const tile = el("div", { class: "stat" });
      tile.append(el("strong", {}, value), el("span", {}, label));
      return tile;
    }),
  );
}

function renderFooter(meta: Meta): void {
  requireElement("sources").replaceChildren(
    ...meta.sources.map((source) => {
      const item = el("li");
      item.append(el("a", { href: source.url, rel: "noopener" }, source.title), document.createTextNode(` (${source.licence})`));
      return item;
    }),
  );
  requireElement("caveats").replaceChildren(...meta.caveats.map((text) => el("li", {}, text)));

  const footer = requireElement("footer-links");
  footer.append(
    document.createTextNode("Method, code and every number: "),
    el("a", { href: REPOSITORY_URL, rel: "noopener" }, "the repository"),
    document.createTextNode(
      ` (notebooks, tests and the exported data). Data exported ${meta.generated}; rules checked against the official gazettes on ${meta.levers_as_of}. Data licensed CC BY 4.0.`,
    ),
  );
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  document.querySelector("main")?.prepend(el("p", { class: "note", role: "alert" }, `Could not load the data: ${message}`));
}

/** Run one section's setup; if it fails, say so in that section only,
 *  so the rest of the page still works. */
function inSection(sectionId: string, setup: () => void): void {
  try {
    setup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Section #${sectionId} failed`, error);
    requireElement(sectionId).append(el("p", { class: "note", role: "alert" }, `This chart could not be drawn: ${message}`));
  }
}

// MapLibre is most of the JavaScript, so it is only downloaded when the
// reader scrolls near the map.
const MAP_PRELOAD_MARGIN = "600px";

function loadMapWhenNear(snapshots: string[]): void {
  const section = requireElement("map-section");
  const load = () => import("./map").then(({ initMap }) => initMap(snapshots)).catch(showError);
  // Already close (e.g. a link straight to #map-section): load now rather
  // than wait for the observer's first callback.
  if (section.getBoundingClientRect().top < window.innerHeight + parseInt(MAP_PRELOAD_MARGIN, 10)) {
    void load();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void load();
    },
    { rootMargin: MAP_PRELOAD_MARGIN },
  );
  observer.observe(section);
}

async function main(): Promise<void> {
  const [meta, nights, cities, register] = await Promise.all([loadMeta(), loadNights(), loadCities(), loadRegister()]);
  renderHeroStats(cities);
  renderFooter(meta);
  initNightsChart(nights, meta.stay_line_nights, cities);
  loadMapWhenNear(meta.snapshots.barcelona);

  // The sections below the map: small files, loaded together.
  const [transitions, concentration, places, rents, trends] = await Promise.all([
    loadTransitions(),
    loadConcentration(),
    loadNeighbourhoods(),
    loadRents(),
    loadTrends(),
  ]);
  inSection("flows", () => initFlows(transitions));
  inSection("flows", () => initExitGap(cities));
  inSection("cities", () => initCities(cities));
  inSection("concentration", () => initConcentration(concentration));
  inSection("register", () => initRegister(register, places));
  inSection("rents", () => initRents(rents, meta));
  inSection("levers", () => initLevers({ meta, register, rents, trends, cities }));
}

main().catch(showError);
