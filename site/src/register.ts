// The official HUT register against Airbnb listings.
import * as Plot from "@observablehq/plot";

import { mountChart, plotStyle, X_TITLE_EXTRA_HEIGHT, X_TITLE_MARGIN } from "./charts";
import type { NeighbourhoodRow, Register } from "./data";
import { cssVar, el, formatInt, formatPct, formatQuarter, POPULATION, requireElement, setDataTable } from "./ui";

const LEGEND_WIDTH = 260;
const LEGEND_MARGIN = 14;

/** "2026_3T" -> "Q3 2026" */
function quarterLabel(code: string): string {
  const [year, quarter] = code.split("_");
  return `Q${(quarter ?? "").replace("T", "")} ${year ?? ""}`;
}

export function initRegister(register: Register, places: NeighbourhoodRow[]): void {
  const latest = register.match.at(-1);
  const total = register.totals[register.register_quarter];
  if (!latest || total === undefined) return;

  const tiles: [string, string][] = [
    [formatInt(total), `records in Barcelona's register of tourist flats (${quarterLabel(register.register_quarter)})`],
    [
      formatPct(latest.displayed_found_pct, 0),
      `of the ${formatInt(latest.displayed_numbers)} licence numbers shown on listings with open dates exist in the register (${formatQuarter(latest.snapshot)} snapshot, ${quarterLabel(latest.register_quarter)} register)`,
    ],
    [
      formatPct(latest.register_numbers_displayed_pct, 0),
      `of the register's ${formatInt(latest.register_numbers)} numbers are shown on at least one listing with open dates`,
    ],
  ];
  requireElement("register-finding").textContent =
    `${formatPct(latest.displayed_found_pct, 0)} of the licence numbers shown on listings with open dates exist in Barcelona's register of tourist flats, ` +
    `and ${formatPct(latest.register_numbers_displayed_pct, 0)} of the register's numbers are shown on at least one such listing (${formatQuarter(latest.snapshot)} snapshot). ` +
    "That is coverage of displayed numbers, not the share of licensed flats on Airbnb.";
  requireElement("register-stats").replaceChildren(
    ...tiles.map(([value, label]) => {
      const tile = el("div", { class: "stat" });
      tile.append(el("strong", {}, value), el("span", {}, label));
      return tile;
    }),
  );

  const data = places.filter((p) => p.active_listings > 0 || p.registered_huts > 0);
  // A neighbourhood with no listings has no share of long minimum stays: it
  // is drawn as "no data", never as 0%.
  const withShare = data.filter((p) => p.share_month_plus !== null);
  const noShare = data.filter((p) => p.share_month_plus === null);
  const top = Math.max(...data.map((p) => Math.max(p.active_listings, p.registered_huts)));

  const rec = register.neighbourhood_reconciliation;
  requireElement("register-reconciliation").textContent =
    `${formatInt(rec.register_without_known_neighbourhood)} of the ${formatInt(rec.register_total)} registered flats have no known neighbourhood and are not on the chart. ` +
    `All ${formatInt(rec.listings_total)} listings are placed.`;

  const tipText = (p: NeighbourhoodRow) =>
    [
      `${p.neighbourhood} (${p.district})`,
      `${formatInt(p.registered_huts)} registered flats`,
      `${formatInt(p.active_listings)} ${POPULATION}, ${formatInt(p.with_tourist_licence)} showing a licence`,
      p.share_month_plus === null ? "no listings: share of 31+ nights is not defined" : `${formatPct(p.share_month_plus, 0)} ask 31+ nights`,
    ].join("\n");

  setDataTable(
    requireElement("register-table"),
    "Barcelona neighbourhoods: registered tourist flats and listings with open dates",
    ["Neighbourhood", "District", "Registered flats", "Listings", "Showing a licence", "Ask 31+ nights"],
    [...data]
      .sort((a, b) => a.neighbourhood.localeCompare(b.neighbourhood, "es"))
      .map((p) => [
        p.neighbourhood,
        p.district,
        formatInt(p.registered_huts),
        formatInt(p.active_listings),
        formatInt(p.with_tourist_licence),
        p.share_month_plus === null ? "n/a" : formatPct(p.share_month_plus, 0),
      ]),
  );

  mountChart(requireElement("register-chart"), (width) => {
    const plot = Plot.plot({
      width,
      height: Math.min(width, 440) + X_TITLE_EXTRA_HEIGHT,
      marginBottom: X_TITLE_MARGIN,
      marginLeft: 48,
      style: plotStyle(),
      x: { label: "registered tourist flats (official) →", domain: [0, top], grid: true },
      y: { label: "↑ Airbnb listings with open dates", domain: [0, top], grid: true },
      color: {
        type: "linear",
        domain: [0, 80],
        range: [cssVar("--tourist"), cssVar("--seasonal")],
        label: "% asking 31+ nights",
      },
      marks: [
        Plot.line([[0, 0], [top, top]], { stroke: cssVar("--muted"), strokeDasharray: "3,3" }),
        Plot.dot(withShare, {
          x: "registered_huts",
          y: "active_listings",
          fill: (p: NeighbourhoodRow) => p.share_month_plus,
          r: 5,
          fillOpacity: 0.85,
          stroke: cssVar("--surface"),
          tip: true,
          title: tipText,
        }),
        Plot.dot(noShare, {
          x: "registered_huts",
          y: "active_listings",
          fill: cssVar("--cat-7"),
          r: 5,
          stroke: cssVar("--surface"),
          tip: true,
          title: tipText,
        }),
      ],
    });
    plot.setAttribute("aria-label", "Scatter plot: registered tourist flats against Airbnb listings with open dates, one dot per Barcelona neighbourhood.");
    // Legend drawn separately: the built-in one has no side margins, so its
    // end labels overhang at phone width.
    const legend = plot.legend("color", { marginLeft: LEGEND_MARGIN, marginRight: LEGEND_MARGIN, width: LEGEND_WIDTH, style: plotStyle() });
    const wrapper = el("div");
    if (legend) wrapper.append(legend);
    wrapper.append(plot);
    return wrapper;
  });
}
