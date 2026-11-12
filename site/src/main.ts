import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";

import { initAtlas, initHostsMap, type Hoods } from "./atlas";
import {
  CITIES,
  loadCities,
  loadConcentration,
  loadGeo,
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
import { initFlowsScreen, initGapScreen } from "./flowsScreen";
import { cityName, LANG, LANGS, list, T } from "./i18n";
import { initLicences } from "./licences";
import { initPrice } from "./price";
import { initRegisterScreen } from "./registerScreen";
import { initRents } from "./rentsScreen";
import { initRules } from "./rules";
import { byId, dayMonthYear, formatInt, monthYear, pct, redrawOnResize, safely, setHtml, setText, type Draw } from "./story";
import { initWall } from "./wall";

const LATEST_ROUND = "Sep 2026";
const REPOSITORY_URL = "https://github.com/renzorico/spain-housing-str-analysis";

/** Static text in index.html, in the reader's language. */
function renderChrome(meta: Meta): void {
  document.documentElement.lang = LANG;
  document.title = T.htmlTitle;
  setText("skip", T.skip);
  const [from, to] = meta.observation_window;
  setHtml("banner-note", T.banner(monthYear(from), monthYear(to)));
  byId("lang").setAttribute("aria-label", T.language);
  byId("lang").innerHTML = LANGS.map(
    (l) => `<a href="?lang=${l}" hreflang="${l}" lang="${l}" aria-current="${l === LANG}">${l.toUpperCase()}</a>`,
  ).join("");
  for (const summary of document.querySelectorAll<HTMLElement>("details.how > summary:not([id])")) summary.textContent = T.how;
}

function renderHero(cities: CityRow[], meta: Meta): void {
  const line = meta.stay_line_nights;
  const monthPlus = (c: CityRow) => c.rounds[LATEST_ROUND]?.share_month_plus ?? 0;
  const bcn = cities.find((c) => c.city === "barcelona");
  if (!bcn) return;
  const others = cities.filter((c) => c.city !== "barcelona");
  byId("hero-title").innerHTML = T.hero.title(Math.round(monthPlus(bcn) / 10));
  setText(
    "hero-lede",
    T.hero.lede(
      line,
      LATEST_ROUND === "Sep 2026" ? monthYear(meta.observation_window[1]) : LATEST_ROUND,
      pct(monthPlus(bcn)),
      pct(Math.min(...others.map(monthPlus))),
      pct(Math.max(...others.map(monthPlus))),
      list(others.map((c) => cityName(c.city))),
    ),
  );
  setHtml("byline", T.byline(meta.author, dayMonthYear(meta.published_on), monthYear(meta.observation_window[1]), `${REPOSITORY_URL}#corrections`));
}

function renderMethod(meta: Meta, cities: CityRow[]): void {
  const snapshots = Object.values(meta.snapshots).reduce((n, s) => n + s.length, 0);
  setText("method-title", T.method.title);
  setText("method-sub", T.method.sub);
  byId("pipeline").innerHTML = T.method
    .steps(snapshots, CITIES.length, meta.stay_line_nights)
    .map(([b, t]) => `<li><b>${b}.</b> ${t}</li>`)
    .join("");
  setText("all-caveats", T.method.all);
  const caveats = (LANG === "en" ? undefined : meta.caveats_i18n?.[LANG]) ?? meta.caveats;
  byId("caveats").innerHTML = caveats.map((c) => `<li>${c}</li>`).join("");
  byId("sources").innerHTML = meta.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a> (${s.licence})</li>`).join("");
  const sizes = cities.map((c) => `${cityName(c.city)} ${formatInt(c.rounds[LATEST_ROUND]?.active ?? 0)}`).join(", ");
  setText("endnote-caveat", T.method.sizes(monthYear(meta.observation_window[1]), sizes));
  byId("footer-links").innerHTML =
    `<span>${T.method.dataAsOf(monthYear(meta.observation_window[1]), dayMonthYear(meta.levers_as_of))}</span>` +
    `<span>${T.method.code} <a href="${REPOSITORY_URL}" target="_blank" rel="noopener">GitHub</a></span>` +
    `<span>${T.method.credits}</span>`;
}

/** The dot explorer loads MapLibre and the points only when opened. */
function lazyExplorer(meta: Meta): void {
  const details = byId<HTMLDetailsElement>("explore");
  let started = false;
  details.addEventListener("toggle", () => {
    if (!details.open || started) return;
    started = true;
    import("./mapScreen")
      .then(({ initMapScreen }) => initMapScreen(meta.snapshots.barcelona, meta.stay_line_nights))
      .catch((error: unknown) => {
        console.error("Map failed to load", error);
        byId("map").textContent = T.map.failed;
      });
  });
}

async function main(): Promise<void> {
  const [meta, nights, cities, register, transitions, , neighbourhoods, rents, trends, geo] = await Promise.all([
    loadMeta(),
    loadNights(),
    loadCities(),
    loadRegister(),
    loadTransitions(),
    loadConcentration(),
    loadNeighbourhoods(),
    loadRents(),
    loadTrends(),
    loadGeo(),
  ]);
  const line = meta.stay_line_nights;
  renderChrome(meta);
  renderHero(cities, meta);
  renderMethod(meta, cities);
  lazyExplorer(meta);

  const hoods = geo as Hoods;
  const draws: Draw[] = [
    safely("wall", initWall(nights, line)),
    safely("atlas", initAtlas(hoods, neighbourhoods, line)),
    safely("price", initPrice(nights, line)),
    safely("hosts", initHostsMap(hoods, neighbourhoods, cities, meta.professional_min)),
    safely("flows", initFlowsScreen(transitions, line)),
    safely("gap", initGapScreen(cities)),
    safely("licences", initLicences(trends)),
    safely("register", initRegisterScreen(register, meta.policy_levers.tourist_licence_phase_out)),
    safely("rents", initRents(rents, meta)),
    safely("rules", initRules({ meta, register, rents, trends, cities })),
  ];
  const drawAll = () => draws.forEach((draw) => draw());
  // first draw after layout, so every chart container has its real width
  requestAnimationFrame(drawAll);
  redrawOnResize(drawAll);
}

main().catch((error: unknown) => {
  console.error(error);
  byId("hero-lede").textContent = T.method.loadFailed;
});
