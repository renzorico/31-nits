// Price by minimum stay: a lollipop of the median nightly asking price for
// the most common minimum stays in Barcelona. No area encoding, so the two
// values in the title never hide behind each other.
import * as d3 from "d3";

import type { NightsRow } from "./data";
import { decimal, T } from "./i18n";
import { chartHeight, COLOURS, euro, formatInt, freshSvg, insetOf, isWaiting, MOTION_MS, pct, revealOnView, setLegend, setText, share, widthOf, withTip } from "./story";
import { bandOf, latestHistograms } from "./wall";

const KEY = "price";
const MIN_LISTINGS = 20; // a median over fewer listings is too noisy to plot
const WEEK = 7;

export function initPrice(rows: NightsRow[], line: number): () => void {
  const bcn = latestHistograms(rows).find((h) => h.city === "barcelona");
  if (!bcn) throw new Error("No Barcelona histogram");
  const points = bcn.rows
    .filter((r): r is typeof r & { median_price: number } => r.median_price !== null && r.listings >= MIN_LISTINGS)
    .sort((a, b) => a.nights - b.nights);
  const at = (n: number) => points.find((p) => p.nights === n);
  const one = at(1);
  const after = at(line + 1);
  if (!one || !after) throw new Error("Missing price points");
  const between = share(d3.sum(bcn.rows.filter((r) => r.nights > WEEK && r.nights < line), (r) => r.listings), bcn.total);

  setText("price-title", T.price.title(line, euro(one.median_price), euro(after.median_price)));
  setText("price-sub", T.price.sub(decimal(one.median_price / after.median_price), pct(between), WEEK + 1, line - 1));
  setText("price-how", T.price.how(bcn.snapshot, line, MIN_LISTINGS));
  setLegend("price-legend", (["under_31", "exactly_31", "over_31"] as const).map((b) => [T.band(b, line), COLOURS[b]]));

  const root = document.getElementById("price-chart") as HTMLElement;
  return () => {
    const W = widthOf(root);
    const H = chartHeight(W, 300, 420, 0.32);
    const inset = insetOf();
    const svg = freshSvg(root, W, H, T.price.aria(euro(one.median_price), line, euro(after.median_price)));
    const x = d3
      .scaleBand<number>()
      .domain(points.map((p) => p.nights))
      .range([inset + 44, W - inset])
      .padding(0.35);
    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(points, (p) => p.median_price) ?? 300) * 1.12])
      .nice()
      .range([H - 28, 16]);

    for (const t of y.ticks(4).filter((t) => t > 0)) {
      svg.append("line").attr("class", "gridline").attr("x1", inset + 44).attr("x2", W - inset).attr("y1", y(t)).attr("y2", y(t));
      svg.append("text").attr("x", inset).attr("y", y(t) + 4).text(euro(t));
    }
    svg.append("line").attr("class", "axisline").attr("x1", inset + 44).attr("x2", W - inset).attr("y1", y(0)).attr("y2", y(0));
    // the 31-night line between the last short stay and the first month-long one
    const before = points.filter((p) => p.nights < line).at(-1);
    if (before) {
      const lx = ((x(before.nights) ?? 0) + x.bandwidth() + (x(line) ?? 0)) / 2;
      svg.append("line").attr("x1", lx).attr("x2", lx).attr("y1", 6).attr("y2", y(0)).attr("stroke", COLOURS.ink).attr("stroke-width", 1.5);
    }
    for (const p of points) {
      svg
        .append("text")
        .attr("x", (x(p.nights) ?? 0) + x.bandwidth() / 2)
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(p.nights === 120 ? "120+" : String(p.nights));
    }

    const waiting = isWaiting(KEY);
    const cx = (p: (typeof points)[number]) => (x(p.nights) ?? 0) + x.bandwidth() / 2;
    const g = svg.append("g");
    const stems = g
      .selectAll("line.stem")
      .data(points)
      .join("line")
      .attr("class", "stem")
      .attr("x1", cx)
      .attr("x2", cx)
      .attr("y1", y(0))
      .attr("y2", (p) => (waiting ? y(0) : y(p.median_price)))
      .attr("stroke", (p) => COLOURS[bandOf(p.nights, line)])
      .attr("stroke-width", 2);
    const dots = g
      .selectAll<SVGCircleElement, (typeof points)[number]>("circle")
      .data(points)
      .join("circle")
      .attr("cx", cx)
      .attr("cy", (p) => (waiting ? y(0) : y(p.median_price)))
      .attr("r", 6)
      .attr("fill", (p) => COLOURS[bandOf(p.nights, line)]);
    const labels = g
      .selectAll("text.val")
      .data(points.filter((p) => p === one || p === after || p.nights === line))
      .join("text")
      .attr("class", "lab-strong hl val")
      .attr("x", cx)
      .attr("y", (p) => y(p.median_price) - 12)
      .attr("text-anchor", "middle")
      .attr("opacity", waiting ? 0 : 1)
      .text((p) => euro(p.median_price));
    withTip(dots, (p) => `<b>${T.minimum(p.nights === 120 ? T.nightsOrMore(120) : T.nights(p.nights))}</b>${T.price.tip(euro(p.median_price), formatInt(p.listings))}`);

    if (waiting) {
      revealOnView(KEY, root, () => {
        stems.transition().duration(MOTION_MS).delay((_, i) => i * 40).ease(d3.easeCubicOut).attr("y2", (p) => y(p.median_price));
        dots.transition().duration(MOTION_MS).delay((_, i) => i * 40).ease(d3.easeCubicOut).attr("cy", (p) => y(p.median_price));
        labels.transition().delay(MOTION_MS).duration(300).attr("opacity", 1);
      });
    }
  };
}
