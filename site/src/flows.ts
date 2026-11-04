// "Where did December's listings go?" and the exit-gap comparison.
import * as Plot from "@observablehq/plot";

import { mountChart, plotStyle, X_TITLE_EXTRA_HEIGHT, X_TITLE_MARGIN } from "./charts";
import { cityControl, currentCity } from "./cityChoice";
import { BANDS, CITIES, CITY_LABELS, type Band, type City, type CityRow, type TransitionTable, type Transitions } from "./data";
import { cssVar, el, formatInt, formatPct, formatQuarter, POPULATION, requireElement, segmented } from "./ui";

const NARROW_WIDTH = 520; // below this, shorter axis titles

const BAND_LABELS: Record<Band, string> = {
  under_31: "Under 31",
  exactly_31: "Exactly 31",
  over_31: "Over 31",
};

const OUTCOMES = ["same band", "other band", "listed, no open dates", "absent from later scrape"] as const;
type Outcome = (typeof OUTCOMES)[number];
const OUTCOME_COLOURS: Record<Outcome, string> = {
  "same band": "--cat-5",
  "other band": "--cat-4",
  "listed, no open dates": "--boundary",
  "absent from later scrape": "--cat-6",
};

interface Segment {
  band: string;
  outcome: Outcome;
  listings: number;
  share: number;
}

function segments(table: TransitionTable): Segment[] {
  const column = (name: string) => table.to.indexOf(name);
  return table.from.flatMap((band, row) => {
    const counts = table.counts[row] ?? [];
    const at = (name: string) => counts[column(name)] ?? 0;
    const total = counts.reduce((sum, n) => sum + n, 0);
    const same = at(band);
    const otherBand = BANDS.filter((b) => b !== band).reduce((sum, b) => sum + at(b), 0);
    const values: Record<Outcome, number> = {
      "same band": same,
      "other band": otherBand,
      "listed, no open dates": at("inactive"),
      "absent from later scrape": at("gone"),
    };
    return OUTCOMES.map((outcome) => ({
      band: BAND_LABELS[band],
      outcome,
      listings: values[outcome],
      share: total ? (values[outcome] / total) * 100 : 0,
    }));
  });
}

export function initFlows(transitions: Transitions): void {
  const controls = requireElement("flows-controls");
  const chart = requireElement("flows-chart");

  let city: City = currentCity();
  let periodIndex = -1; // -1 = first to last snapshot; otherwise a Barcelona quarter
  let render = () => {};

  const table = (): TransitionTable =>
    city === "barcelona" && periodIndex >= 0
      ? (transitions.barcelona_quarters[periodIndex] ?? transitions.cities.barcelona)
      : transitions.cities[city];

  const periodGroup = el("div");
  function renderPeriodControl(): void {
    if (city !== "barcelona") {
      periodGroup.replaceChildren();
      return;
    }
    const whole = transitions.cities.barcelona;
    const options = [
      { value: "-1", label: `${formatQuarter(whole.from_snapshot)} → ${formatQuarter(whole.to_snapshot)}` },
      ...transitions.barcelona_quarters.map((q, i) => ({
        value: String(i),
        label: `${formatQuarter(q.from_snapshot)} → ${formatQuarter(q.to_snapshot)}`,
      })),
    ];
    periodGroup.replaceChildren(
      segmented("Period", options, String(periodIndex), (value) => {
        periodIndex = Number(value);
        render();
      }),
    );
  }

  function draw(width: number): Element {
    const data = segments(table());
    const t = table();
    const plot = Plot.plot({
      width,
      height: 200 + X_TITLE_EXTRA_HEIGHT,
      marginBottom: X_TITLE_MARGIN,
      marginLeft: 104,
      style: plotStyle(),
      x: { label: "% of the band's listings with open dates →", domain: [0, 100], grid: true },
      y: { label: null, domain: BANDS.map((b) => BAND_LABELS[b]) },
      color: {
        domain: [...OUTCOMES],
        range: OUTCOMES.map((o) => cssVar(OUTCOME_COLOURS[o])),
        legend: true,
      },
      marks: [
        Plot.barX(data, Plot.stackX({ x: "share", y: "band", fill: "outcome", order: [...OUTCOMES] })),
        Plot.tip(
          data,
          Plot.pointer(
            Plot.stackX({
              x: "share",
              y: "band",
              z: "outcome", // the tip needs the same grouping as the bars to stack identically
              order: [...OUTCOMES],
              title: (d: Segment) => `${d.band} in ${formatQuarter(t.from_snapshot)}\n${d.outcome}: ${formatInt(d.listings)} (${formatPct(d.share)})`,
            }),
          ),
        ),
      ],
    });
    plot.setAttribute(
      "aria-label",
      `Stacked bars: what happened by ${formatQuarter(t.to_snapshot)} to ${CITY_LABELS[city]}'s ${POPULATION} of ${formatQuarter(t.from_snapshot)}, by stay band.`,
    );
    return plot;
  }

  controls.append(
    cityControl((value) => {
      city = value;
      periodIndex = -1;
      renderPeriodControl();
      render();
    }),
    periodGroup,
  );
  renderPeriodControl();
  render = mountChart(chart, draw);
}

export function initExitGap(cities: CityRow[]): void {
  const chart = requireElement("gap-chart");
  const readout = requireElement("gap-readout");
  const rows = CITIES.map((c) => cities.find((row) => row.city === c)).filter((r): r is CityRow => r !== undefined);
  const barcelona = rows.find((r) => r.city === "barcelona");
  if (!barcelona) return;
  const colour = (r: CityRow) => (r.city === "barcelona" ? cssVar("--seasonal") : cssVar("--tourist"));
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

  mountChart(chart, (width) => {
    const plot = Plot.plot({
      width,
      height: 220 + X_TITLE_EXTRA_HEIGHT,
      marginBottom: X_TITLE_MARGIN,
      marginLeft: 80,
      style: plotStyle(),
      x: { label: width < NARROW_WIDTH ? "exit gap, points →" : "exit gap, percentage points (month-plus minus shorter stays) →", grid: true, nice: true },
      y: { label: null, domain: rows.map((r) => CITY_LABELS[r.city]) },
      marks: [
        Plot.ruleX([0], { stroke: cssVar("--muted") }),
        Plot.ruleY(rows, {
          y: (r: CityRow) => CITY_LABELS[r.city],
          x1: (r: CityRow) => r.exit_gap.ci_low,
          x2: (r: CityRow) => r.exit_gap.ci_high,
          stroke: colour,
          strokeWidth: 3,
        }),
        Plot.dot(rows, {
          y: (r: CityRow) => CITY_LABELS[r.city],
          x: (r: CityRow) => r.exit_gap.points,
          r: 6,
          fill: colour,
          tip: true,
          title: (r: CityRow) => {
            const g = r.exit_gap;
            return [
              `${CITY_LABELS[r.city]}: ${signed(g.points)} points`,
              `95% interval (host accounts resampled): ${g.ci_low} to ${g.ci_high}`,
              `${formatInt(g.month_plus_listings)} month-plus and ${formatInt(g.shorter_listings)} shorter-stay listings, ${formatInt(g.accounts)} host accounts`,
              `${g.top10_accounts_share_of_month_plus_pct}% of the month-plus listings belong to the 10 largest accounts`,
              g.vs_barcelona ? `Barcelona minus ${CITY_LABELS[r.city]}: ${signed(g.vs_barcelona.difference_points)} (${g.vs_barcelona.ci_low} to ${g.vs_barcelona.ci_high})` : "",
            ]
              .filter(Boolean)
              .join("\n");
          },
        }),
      ],
    });
    plot.setAttribute("aria-label", "Dot chart with 95% intervals that resample host accounts: exit gap by city.");
    return plot;
  });

  // The sentences below are computed from the contrast intervals (Barcelona
  // minus each city), which test the quantity discussed. Overlapping
  // separate intervals are never used as a test.
  const others = rows.filter((r) => r.city !== "barcelona" && r.exit_gap.vs_barcelona);
  const distinguishable = others.filter((r) => {
    const contrast = r.exit_gap.vs_barcelona;
    return contrast !== null && (contrast.ci_low > 0 || contrast.ci_high < 0);
  });
  const gap = barcelona.exit_gap;
  const clearGap = rows.filter((r) => r.exit_gap.ci_low > 0).map((r) => CITY_LABELS[r.city]);
  const includesZero = rows.filter((r) => r.exit_gap.ci_low <= 0).map((r) => CITY_LABELS[r.city]);
  const minus = (value: number) => String(value).replace("-", "−"); // a real minus sign
  const range = (low: number, high: number) => `${minus(low)} to ${minus(high)}`;

  const contrastList = el("ul");
  for (const r of others) {
    const c = r.exit_gap.vs_barcelona;
    if (!c) continue;
    contrastList.append(
      el("li", {}, `${CITY_LABELS[r.city]}: ${signed(c.difference_points).replace("-", "−")} points (95% interval ${range(c.ci_low, c.ci_high)})`),
    );
  }

  requireElement("flows-finding").textContent =
    `In Barcelona, month-plus listings (31+ nights) were ${gap.points} points more likely than shorter-stay listings to be absent from the September scrape (95% interval ${range(gap.ci_low, gap.ci_high)}). ` +
    (distinguishable.length === 0
      ? "Every difference between Barcelona and the other cities includes zero: the data cannot distinguish Barcelona's gap from theirs."
      : `Barcelona's gap is clearly different from ${distinguishable.map((r) => CITY_LABELS[r.city]).join(", ")}; the others cannot be told apart from it.`);

  readout.replaceChildren(
    el(
      "p",
      {},
      `Barcelona: month-plus listings were ${gap.points} points more likely than shorter-stay listings to be absent from the September scrape (95% interval ${range(gap.ci_low, gap.ci_high)}). ` +
        `The interval is above zero for ${clearGap.join(", ")}` +
        (includesZero.length ? ` and includes zero for ${includesZero.join(" and ")}.` : "."),
    ),
    el("p", {}, "Barcelona minus each other city:"),
    contrastList,
    el(
      "p",
      {},
      distinguishable.length === 0
        ? "Every one of these differences includes zero: the data cannot distinguish Barcelona's gap from any of the four other cities' gaps."
        : `Barcelona's gap is clearly different from ${distinguishable.map((r) => CITY_LABELS[r.city]).join(", ")}; the others cannot be told apart from it.`,
    ),
    el(
      "p",
      { class: "note" },
      `The intervals resample host accounts, because one operator can withdraw many listings at once. Treating listings as independent would give Barcelona ${range(gap.listing_level_ci_low, gap.listing_level_ci_high)}, which is too narrow. ` +
        "This compares timing across cities; it is not an estimate of any rule's effect, and a single Barcelona snapshot before January cannot establish a common trend.",
    ),
  );
}
