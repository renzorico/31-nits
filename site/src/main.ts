import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/public-sans/latin-400.css";
import "@fontsource/public-sans/latin-600.css";
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
  type City,
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

/** The five cities side by side: share of listings asking 31+ nights.
 *  Bars share one 0-100% scale; Barcelona is listed first, the rest by value. */
function renderHeroStats(cities: CityRow[]): void {
  const rows = CITIES.map((city) => ({
    city,
    share: cities.find((c) => c.city === city)?.rounds[LATEST_ROUND]?.share_month_plus,
  })).filter((row): row is { city: City; share: number } => row.share !== undefined);
  if (rows.length === 0) return;
  const ordered = [
    ...rows.filter((row) => row.city === "barcelona"),
    ...rows.filter((row) => row.city !== "barcelona").sort((a, b) => b.share - a.share),
  ];

  const caption = el("p", { class: "city-bars-caption" }, `Share of ${POPULATION} asking for 31 nights or more, ${LATEST_ROUND}`);
  const list = el("ul", { class: "city-bars-list" });
  for (const { city, share } of ordered) {
    const item = el("li", { class: city === "barcelona" ? "city-bar is-focus" : "city-bar" });
    const bar = el("span", { class: "city-bar-track", "aria-hidden": "true" });
    const fill = el("span", { class: "city-bar-fill" });
    fill.style.width = `${share}%`;
    bar.append(fill);
    item.append(el("span", { class: "city-bar-name" }, CITY_LABELS[city]), bar, el("strong", {}, formatPct(share)));
    list.append(item);
  }
  requireElement("hero-stats").replaceChildren(caption, list);
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

/** A link to a collapsed section (the contents line, or a shared URL) opens it. */
function openSectionFromHash(): void {
  const target = document.getElementById(window.location.hash.slice(1));
  const details = target?.querySelector(":scope > details");
  if (details instanceof HTMLDetailsElement) details.open = true;
}

// A printed page has no way to click open: show every section.
window.addEventListener("beforeprint", () => {
  document.querySelectorAll("details").forEach((details) => {
    details.open = true;
  });
});

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
  openSectionFromHash();
  window.addEventListener("hashchange", openSectionFromHash);
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
