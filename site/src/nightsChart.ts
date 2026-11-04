// "Where would you draw the line?" - minimum-stay distribution. Bars are
// coloured by what listings ask (under / exactly / over the 31-night limit),
// the legal limit is a fixed marker, and the reader's own cutoff is a
// separate, labelled exploration line.
import * as Plot from "@observablehq/plot";

import { mountChart, plotStyle, X_TITLE_MARGIN } from "./charts";
import { CITY_LABELS, type Band, type City, type CityRow, type NightsRow } from "./data";
import { cityControl, currentCity } from "./cityChoice";
import { cssVar, el, formatInt, formatPct, POPULATION, requireElement, selectControl, setDataTable } from "./ui";

const MAX_NIGHTS_SHOWN = 60; // longer minimum stays are summarised in the readout
const CHART_HEIGHT = 320;
const NARROW_WIDTH = 520; // below this, axis labels every 10 nights instead of 5

interface Bar {
  nights: number;
  listings: number;
  share: number;
  medianPrice: number | null;
  band: Band;
}

export function initNightsChart(rows: NightsRow[], stayLine: number, cities: CityRow[]): void {
  const chart = requireElement<HTMLDivElement>("nights-chart");
  const controls = requireElement<HTMLDivElement>("nights-controls");
  const lineControls = requireElement<HTMLDivElement>("nights-line-controls");
  const finding = requireElement<HTMLParagraphElement>("nights-finding");
  const readout = requireElement<HTMLParagraphElement>("nights-readout");
  const robustness = requireElement<HTMLParagraphElement>("nights-robustness");
  const tableHost = requireElement("nights-table");

  const roundsFor = (city: City) => [...new Set(rows.filter((r) => r.city === city).map((r) => r.round))];

  let city: City = currentCity();
  let round = roundsFor(city).at(-1) ?? "";
  let cutoff = stayLine; // the reader's own line; starts at the legal limit
  let render = () => {}; // replaced by mountChart below

  const bandOf = (nights: number): Band => (nights < stayLine ? "under_31" : nights === stayLine ? "exactly_31" : "over_31");

  function bars(): { shown: Bar[]; total: number; beyond: number } {
    const selected = rows.filter((r) => r.city === city && r.round === round);
    const total = selected.reduce((sum, r) => sum + r.listings, 0);
    const shown = selected
      .filter((r) => r.nights <= MAX_NIGHTS_SHOWN)
      .map((r) => ({
        nights: r.nights,
        listings: r.listings,
        share: (r.listings / total) * 100,
        medianPrice: r.median_price,
        band: bandOf(r.nights),
      }));
    const beyond = selected.filter((r) => r.nights > MAX_NIGHTS_SHOWN).reduce((sum, r) => sum + r.listings, 0);
    return { shown, total, beyond };
  }

  function draw(width: number): Element {
    const { shown, total, beyond } = bars();
    updateReadout(shown, total, beyond);
    updateFinding(shown, total, beyond);
    const tickStep = width < NARROW_WIDTH ? 10 : 5;
    const tipText = (d: Bar) =>
      [
        `${d.nights} night${d.nights === 1 ? "" : "s"} minimum`,
        `${formatInt(d.listings)} listings (${formatPct(d.share)})`,
        d.medianPrice === null ? "no prices in this snapshot" : `median asking price €${Math.round(d.medianPrice)}`,
      ].join("\n");

    const plot = Plot.plot({
      width,
      height: CHART_HEIGHT,
      marginLeft: 40,
      marginBottom: X_TITLE_MARGIN,
      style: plotStyle(),
      x: {
        label: "minimum stay (nights) →",
        type: "band",
        domain: Array.from({ length: MAX_NIGHTS_SHOWN }, (_, i) => i + 1),
        // Label 1, the legal limit, the cutoff, and round numbers that are not
        // so close to either that the labels collide.
        tickFormat: (n: number) =>
          n === 1 ||
          n === stayLine ||
          n === cutoff ||
          (n % tickStep === 0 && Math.abs(n - stayLine) > 2 && Math.abs(n - cutoff) > 2)
            ? String(n)
            : "",
        padding: 0.12,
      },
      y: { label: `↑ % of ${POPULATION}`, grid: true, nice: true },
      color: {
        domain: ["under_31", "exactly_31", "over_31"],
        range: [cssVar("--tourist"), cssVar("--boundary"), cssVar("--seasonal")],
      },
      marks: [
        Plot.barY(shown, { x: "nights", y: "share", fill: "band" }),
        // Fixed: the Catalan tourist-stay limit (what it means is explained under the chart).
        Plot.text(
          shown.filter((b) => b.nights === stayLine),
          { x: "nights", y: "share", text: () => (width < NARROW_WIDTH ? `${stayLine}-day limit →` : `Catalan tourist-stay limit: ${stayLine} days →`), textAnchor: "end", dx: -6, fill: cssVar("--muted"), stroke: cssVar("--bg"), strokeWidth: 3 },
        ),
        // Movable: the reader's own cutoff, drawn between two bars.
        Plot.ruleX([cutoff], {
          x: (n: number) => n,
          dx: width / MAX_NIGHTS_SHOWN / 2,
          stroke: cssVar("--text"),
          strokeDasharray: "4,3",
        }),
        Plot.ruleY([0], { stroke: cssVar("--line") }),
        Plot.tip(shown, Plot.pointerX({ x: "nights", y: "share", title: tipText })),
      ],
    });
    plot.setAttribute(
      "aria-label",
      `Bar chart: share of ${CITY_LABELS[city]} ${POPULATION} by minimum stay, ${round}.`,
    );
    return plot;
  }

  /** The 31+ share under three definitions of the population (latest snapshot). */
  function updateRobustness(): void {
    const check = cities.find((c) => c.city === city)?.availability_sensitivity;
    if (!check) return;
    const { open_dates: open, open_dates_or_reviewed_12m: reviewed, all_listings: all } = check;
    robustness.textContent =
      `Does the population matter? Among listings with a known minimum stay (latest snapshot), the 31+ share is ` +
      `${formatPct(open.month_plus_pct)} for ${POPULATION}, ${formatPct(reviewed.month_plus_pct)} adding listings reviewed in the last 12 months, ` +
      `and ${formatPct(all.month_plus_pct)} for every listing. ` +
      `${formatInt(all.unknown_minimum_stay)} listings have no minimum stay on file and are left out, not counted as short stays.`;
  }

  function updateReadout(shown: Bar[], total: number, beyond: number): void {
    updateRobustness();
    setDataTable(
      tableHost,
      `${CITY_LABELS[city]}, ${round}: listings with open dates by minimum stay`,
      ["Minimum stay (nights)", "Listings", "Share", "Median asking price"],
      shown.map((b) => [
        String(b.nights),
        formatInt(b.listings),
        formatPct(b.share),
        b.medianPrice === null ? "n/a" : `€${Math.round(b.medianPrice)}`,
      ]),
    );
    const atOrBelow = shown.filter((b) => b.nights <= cutoff).reduce((s, b) => s + b.listings, 0);
    const nearCutoff = shown.filter((b) => b.nights === cutoff || b.nights === cutoff + 1).reduce((s, b) => s + b.listings, 0);
    const split = el("span", { class: "readout-line" });
    split.append(
      document.createTextNode(`${CITY_LABELS[city]}, ${round}. A line after ${cutoff} nights: `),
      el("strong", {}, formatPct((atOrBelow / total) * 100)),
      document.createTextNode(` of ${POPULATION} ask ${cutoff} nights or fewer and `),
      el("strong", {}, formatPct(((total - atOrBelow) / total) * 100)),
      document.createTextNode(` ask more${beyond ? ` (${formatInt(beyond)} ask more than ${MAX_NIGHTS_SHOWN} nights)` : ""}.`),
    );
    const near = el(
      "span",
      { class: "readout-line" },
      `${formatPct((nearCutoff / total) * 100)} sit within one night of that line (${cutoff} or ${cutoff + 1}).`,
    );
    readout.replaceChildren(split, near);
  }

  /** The finding, stated before any control: computed from the same bars. */
  function updateFinding(shown: Bar[], total: number, beyond: number): void {
    const asking = (test: (nights: number) => boolean) =>
      shown.filter((b) => test(b.nights)).reduce((s, b) => s + b.listings, 0);
    const monthPlus = asking((n) => n >= stayLine) + beyond;
    const onTheLine = asking((n) => n === stayLine || n === stayLine + 1);
    finding.textContent =
      `In ${CITY_LABELS[city]} (${round}), ${formatPct((monthPlus / total) * 100)} of ${POPULATION} ask for ${stayLine} nights or more, ` +
      `and ${formatPct((onTheLine / total) * 100)} ask for exactly ${stayLine} or ${stayLine + 1}, either side of the Catalan limit.`;
  }

  const roundGroup = el("div");
  function renderRoundControl(): void {
    roundGroup.replaceChildren(
      selectControl(
        "Snapshot",
        roundsFor(city).map((r) => ({ value: r, label: r })),
        round,
        (value) => {
          round = value;
          render();
        },
      ).element,
    );
  }

  const sliderGroup = el("div", { class: "control-group wide" });
  const sliderLabel = el("label", { class: "control-label", for: "line-slider" }, "Your line: after … nights");
  const slider = el("input", {
    id: "line-slider",
    type: "range",
    min: "1",
    max: String(MAX_NIGHTS_SHOWN - 1),
    step: "1",
    value: String(cutoff),
  });
  const output = el("output", { for: "line-slider" }, `${cutoff}`);
  slider.addEventListener("input", () => {
    cutoff = Number(slider.value);
    output.textContent = `${cutoff}`;
    render();
  });
  const sliderRow = el("div", { class: "slider-row" });
  sliderRow.append(slider, output);
  sliderGroup.append(sliderLabel, sliderRow);

  controls.append(
    cityControl((value) => {
      city = value;
      const rounds = roundsFor(city);
      if (!rounds.includes(round)) round = rounds.at(-1) ?? "";
      renderRoundControl();
      render();
    }),
    roundGroup,
  );
  lineControls.append(sliderGroup);
  renderRoundControl();
  render = mountChart(chart, draw);
}
