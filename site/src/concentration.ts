// Host concentration curves, with a "largest X% of hosts" slider.
import * as Plot from "@observablehq/plot";

import { mountChart, plotStyle, X_TITLE_EXTRA_HEIGHT, X_TITLE_MARGIN } from "./charts";
import { CITIES, CITY_LABELS, type City, type Concentration } from "./data";
import { cssVar, el, formatPct, POPULATION, requireElement } from "./ui";

const X_MAX = 30; // % of hosts shown; beyond this the curves flatten out
const DEFAULT_TOP = 1;
const END_LABEL_MARGIN = 84; // room right of the plot for the city names
const END_LABEL_GAP = 7; // minimum distance between two labels, in % of listings
const CITY_COLOURS: Record<City, string> = {
  barcelona: "--seasonal",
  madrid: "--tourist",
  valencia: "--cat-5",
  malaga: "--cat-4",
  sevilla: "--cat-6",
};

/** City names for the right end of each curve. Where curves end close
 *  together the labels are pushed apart so none overlaps another. */
function endLabels(curves: Concentration): { city: string; x: number; y: number }[] {
  const ends = CITIES.map((c) => ({ city: CITY_LABELS[c], x: X_MAX, y: listingShareAt(curves[c], X_MAX) })).sort((a, b) => b.y - a.y);
  ends.forEach((end, index) => {
    const above = ends[index - 1];
    if (above) end.y = Math.min(end.y, above.y - END_LABEL_GAP);
  });
  return ends;
}

/** Linear interpolation of the curve at x (% of hosts). */
function listingShareAt(curve: { host_share: number[]; listing_share: number[] }, x: number): number {
  const xs = curve.host_share;
  const ys = curve.listing_share;
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1] ?? 0;
    const x1 = xs[i] ?? 0;
    if (x <= x1) {
      const y0 = ys[i - 1] ?? 0;
      const y1 = ys[i] ?? 0;
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return ys.at(-1) ?? 100;
}

export function initConcentration(curves: Concentration): void {
  const controls = requireElement("concentration-controls");
  const chart = requireElement("concentration-chart");
  const readout = requireElement("concentration-readout");

  let top = DEFAULT_TOP;
  let render = () => {};

  requireElement("concentration-finding").textContent =
    `The largest ${DEFAULT_TOP}% of host accounts run ` +
    CITIES.map((c) => ({ city: CITY_LABELS[c], share: listingShareAt(curves[c], DEFAULT_TOP) }))
      .sort((a, b) => b.share - a.share)
      .map((r) => `${formatPct(r.share, 0)} in ${r.city}`)
      .join(", ") +
    ` of ${POPULATION} (September 2026). An account is not necessarily one owner or one company.`;

  const points = CITIES.flatMap((city) =>
    curves[city].host_share.map((x, i) => ({ city: CITY_LABELS[city], x, y: curves[city].listing_share[i] ?? 0 })),
  ).filter((p) => p.x <= X_MAX);

  const labels = endLabels(curves);

  function draw(width: number): Element {
    const plot = Plot.plot({
      width,
      height: 320 + X_TITLE_EXTRA_HEIGHT,
      marginBottom: X_TITLE_MARGIN,
      marginLeft: 44,
      marginRight: END_LABEL_MARGIN,
      style: plotStyle(),
      x: { label: "largest host accounts, % of all host accounts →", domain: [0, X_MAX] },
      y: { label: `↑ % of ${POPULATION} they run`, domain: [0, 100], grid: true },
      color: {
        domain: CITIES.map((c) => CITY_LABELS[c]),
        range: CITIES.map((c) => cssVar(CITY_COLOURS[c])),
        legend: true,
      },
      marks: [
        Plot.line([[0, 0], [X_MAX, X_MAX]], { stroke: cssVar("--muted"), strokeDasharray: "3,3" }),
        Plot.ruleX([top], { stroke: cssVar("--text"), strokeDasharray: "4,3" }),
        Plot.line(points, { x: "x", y: "y", stroke: "city", strokeWidth: 2 }),
        Plot.text(labels, { x: "x", y: "y", text: "city", fill: "city", textAnchor: "start", dx: 8, fontWeight: 600 }),
        Plot.dot(
          CITIES.map((c) => ({ city: CITY_LABELS[c], x: top, y: listingShareAt(curves[c], top) })),
          { x: "x", y: "y", fill: "city", r: 4, tip: true, title: (d: { city: string; y: number }) => `${d.city}: ${formatPct(d.y)}` },
        ),
      ],
    });
    plot.setAttribute("aria-label", `Line chart: share of ${POPULATION} run by the largest host accounts, by city, September 2026.`);

    const ranked = CITIES.map((c) => ({ city: CITY_LABELS[c], share: listingShareAt(curves[c], top) })).sort((a, b) => b.share - a.share);
    readout.textContent =
      `The largest ${top}% of host accounts run: ` + ranked.map((r) => `${r.city} ${formatPct(r.share, 0)}`).join(" · ") + ` of ${POPULATION} (September 2026).`;
    return plot;
  }

  const group = el("div", { class: "control-group wide" });
  const label = el("label", { class: "control-label", for: "top-slider" }, "Largest … % of host accounts");
  const slider = el("input", { id: "top-slider", type: "range", min: "1", max: "20", step: "1", value: String(top) });
  const output = el("output", { for: "top-slider" }, `${top}%`);
  slider.addEventListener("input", () => {
    top = Number(slider.value);
    output.textContent = `${top}%`;
    render();
  });
  const row = el("div", { class: "slider-row" });
  row.append(slider, output);
  group.append(label, row);
  controls.append(group);

  render = mountChart(chart, draw);
}
