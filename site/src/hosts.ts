// Screen: how concentrated supply is. Cumulative share of listings run by
// the largest host accounts, five cities on one chart.
import * as d3 from "d3";

import { CITIES, CITY_LABELS, type City, type CityRow, type Concentration } from "./data";
import {
  COLOURS,
  freshSvg,
  heightOf,
  hideTip,
  insetOf,
  isWaiting,
  MOTION_MS,
  pct,
  revealOnView,
  setLegend,
  setText,
  showTip,
  widthOf,
} from "./story";

const LATEST_ROUND = "Sep 2026";
const X_MAX = 20; // the chart shows the largest 20% of accounts, where the story is

export function initHosts(concentration: Concentration, cities: CityRow[], professionalMin: number): () => void {
  const bcn = cities.find((c) => c.city === "barcelona");
  if (!bcn) throw new Error("No Barcelona row");
  const top1 = bcn.top_host_share.top_1pct ?? 0;
  const professional = bcn.rounds[LATEST_ROUND]?.share_professional ?? 0;
  const others = cities.filter((c) => c.city !== "barcelona");
  const range = d3.extent(others, (c) => c.top_host_share.top_1pct ?? 0) as [number, number];
  const runnerUp = others.find((c) => (c.top_host_share.top_1pct ?? 0) === range[1]);

  setText("hosts-title", `The largest 1% of host accounts run ${pct(top1, 0)} of Barcelona's listings.`);
  setText(
    "hosts-sub",
    `${pct(professional, 0)} of Barcelona's listings belong to accounts with ${professionalMin} listings or more. In the other four cities the largest 1% run ${pct(range[0], 0)}–${pct(range[1], 0)}` +
      (top1 > range[1] ? `, so Barcelona is the most concentrated of the five by this measure, ahead of ${runnerUp ? CITY_LABELS[runnerUp.city] : "the next city"} (${pct(range[1], 0)}).` : "."),
  );
  setText(
    "hosts-how",
    `Host accounts are ranked from largest to smallest; each curve adds up their share of listings with open dates (${LATEST_ROUND} snapshot). ` +
      "An account is not a person or a company: one firm can run several accounts, and one account can manage flats for many owners.",
  );
  setLegend(
    "hosts-legend",
    CITIES.map((c) => [CITY_LABELS[c], c === "barcelona" ? COLOURS.ink : COLOURS.muted]),
  );

  const root = document.getElementById("hosts-chart") as HTMLElement;
  const KEY = "hosts";
  return () => {
    const W = widthOf(root);
    const H = heightOf(root, 420);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      "Curves of cumulative share of listings by the largest host accounts. Largest 1% of accounts: " +
        cities.map((c) => `${CITY_LABELS[c.city]} ${pct(c.top_host_share.top_1pct ?? 0)}`).join(", "),
    );
    const x = d3.scaleLinear().domain([0, X_MAX]).range([inset + 34, W - inset - 90]);
    const y = d3.scaleLinear().domain([0, 100]).range([H - 30, 12]);

    for (const t of [25, 50, 75, 100]) {
      svg.append("line").attr("class", "gridline").attr("x1", inset).attr("x2", W - inset).attr("y1", y(t)).attr("y2", y(t));
      svg.append("text").attr("x", inset).attr("y", y(t) + 4).text(`${t}%`);
    }
    for (const t of [1, 5, 10, 15]) {
      svg
        .append("text")
        .attr("x", x(t))
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(t === 1 ? "top 1%" : `${t}%`);
    }
    svg.append("line").attr("class", "axisline").attr("x1", x(1)).attr("x2", x(1)).attr("y1", y(0)).attr("y2", y(100)).attr("stroke-dasharray", "3 3");
    svg
      .append("text")
      .attr("x", W - inset)
      .attr("y", H - 8)
      .attr("text-anchor", "end")
      .text(W < 640 ? "of accounts →" : "largest accounts →");

    const line = d3
      .line<[number, number]>()
      .x((d) => x(d[0]))
      .y((d) => y(d[1]))
      .curve(d3.curveMonotoneX);
    const waiting = isWaiting(KEY);
    const order: City[] = [...CITIES.filter((c) => c !== "barcelona"), "barcelona"];
    const paths: d3.Selection<SVGPathElement, unknown, null, undefined>[] = [];
    const endLabels: { city: City; y: number }[] = [];
    for (const city of order) {
      const curve = concentration[city];
      if (!curve) continue;
      const pts: [number, number][] = [[0, 0], ...curve.host_share.map((h, i): [number, number] => [h, curve.listing_share[i] ?? 0]).filter((p) => p[0] <= X_MAX)];
      const isBcn = city === "barcelona";
      const path = svg
        .append("path")
        .datum(pts)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", isBcn ? COLOURS.ink : COLOURS.muted)
        .attr("stroke-width", isBcn ? 3 : 1.5)
        .attr("opacity", isBcn ? 1 : 0.7);
      paths.push(path as unknown as d3.Selection<SVGPathElement, unknown, null, undefined>);
      const end = pts.at(-1);
      if (end) {
        endLabels.push({ city, y: y(end[1]) + 4 });
        svg
          .append("text")
          .attr("class", isBcn ? "lab-strong hl" : "lab hl")
          .attr("data-city", city)
          .attr("x", x(end[0]) + 8)
          .attr("y", y(end[1]) + 4)
          .text(`${CITY_LABELS[city]} ${pct(end[1], 0)}`)
          .attr("opacity", waiting ? 0 : 1)
          .attr("data-end", "1");
      }
      if (isBcn) {
        const at1 = cities.find((c) => c.city === city)?.top_host_share.top_1pct ?? 0;
        svg.append("circle").attr("cx", x(1)).attr("cy", y(at1)).attr("r", 5).attr("fill", COLOURS.ink).attr("data-end", "1").attr("opacity", waiting ? 0 : 1);
        svg
          .append("text")
          .attr("class", "lab-strong hl")
          .attr("x", x(1) + 10)
          .attr("y", y(at1) - 10)
          .attr("data-end", "1")
          .attr("opacity", waiting ? 0 : 1)
          .text(`top 1% → ${pct(at1, 0)} of listings`);
      }
    }
    // end labels: push apart so none overlap (top to bottom, 15px apart)
    const MIN_GAP = 15;
    endLabels.sort((a, b) => a.y - b.y);
    endLabels.forEach((label, i) => {
      const prev = endLabels[i - 1];
      if (prev && label.y - prev.y < MIN_GAP) label.y = prev.y + MIN_GAP;
      svg.select(`text[data-city="${label.city}"]`).attr("y", label.y);
    });

    // hover: nearest city curve at pointer x
    svg
      .append("rect")
      .attr("x", x(0))
      .attr("y", 0)
      .attr("width", x(X_MAX) - x(0))
      .attr("height", H)
      .attr("fill", "transparent")
      .on("pointermove", (event: PointerEvent) => {
        const [px] = d3.pointer(event);
        const hx = Math.max(0.1, x.invert(px));
        const lines = CITIES.map((city) => {
          const curve = concentration[city];
          const i = d3.bisectLeft(curve?.host_share ?? [], hx);
          return { city, v: curve?.listing_share[Math.min(i, (curve?.listing_share.length ?? 1) - 1)] ?? 0 };
        }).sort((a, b) => b.v - a.v);
        showTip(event, `<b>Largest ${hx.toFixed(1)}% of accounts</b>${lines.map((l) => `${CITY_LABELS[l.city]}: ${pct(l.v, 0)} of listings`).join("<br>")}`);
      })
      .on("pointerleave", hideTip);

    if (waiting) {
      for (const p of paths) {
        const node = p.node();
        const len = node?.getTotalLength() ?? 0;
        p.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len);
      }
      revealOnView(KEY, root, () => {
        for (const p of paths) p.transition().duration(MOTION_MS).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
        svg.selectAll("[data-end]").transition().delay(MOTION_MS).duration(400).attr("opacity", 1);
      });
    }
  };
}
