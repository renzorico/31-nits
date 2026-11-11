// Screen: two markets, two prices. Median asking price per night by the
// minimum stay a Barcelona listing asks. Dot area = number of listings.
import * as d3 from "d3";

import type { NightsRow } from "./data";
import {
  COLOURS,
  formatInt,
  freshSvg,
  heightOf,
  hideTip,
  insetOf,
  isWaiting,
  MOTION_MS,
  revealOnView,
  setLegend,
  pct,
  setText,
  share,
  showTip,
  widthOf,
} from "./story";
import { bandOf, latestHistograms, NIGHTS_CAP } from "./wall";

const KEY = "price";
const MIN_LISTINGS = 20; // a median over fewer listings is too noisy to plot

export function initPrice(rows: NightsRow[], line: number): () => void {
  const bcn = latestHistograms(rows).find((h) => h.city === "barcelona");
  if (!bcn) throw new Error("No Barcelona histogram");
  const points = bcn.rows
    .filter((r): r is typeof r & { median_price: number } => r.median_price !== null && r.listings >= MIN_LISTINGS)
    .sort((a, b) => b.listings - a.listings);
  const at = (n: number) => points.find((p) => p.nights === n);
  const one = at(1);
  const after = at(line + 1);
  if (!one || !after) throw new Error("Missing price points");
  const ratio = one.median_price / after.median_price;
  const WEEK = 7;
  const between = share(d3.sum(bcn.rows.filter((r) => r.nights > WEEK && r.nights < line), (r) => r.listings), bcn.total);

  setText(
    "price-title",
    `A one-night listing asks €${one.median_price} a night; a ${line + 1}-night listing asks €${after.median_price}.`,
  );
  setText(
    "price-sub",
    `Same city, same platform, ${ratio.toFixed(1)} times apart. Each dot is a minimum stay, placed at the median nightly price its listings ask and sized by how many listings ask it. ` +
      `Only ${pct(between)} of listings ask for a minimum between ${WEEK + 1} and ${line - 1} nights.`,
  );
  setText(
    "price-how",
    `Barcelona, snapshot ${bcn.snapshot}. Prices are what hosts ask per night, before fees and before any weekly or monthly discount, so they are not what guests paid ` +
      `and a month at the ${line + 1}-night price is not a monthly rent. Minimum stays with fewer than ${MIN_LISTINGS} listings are left out. Both axes are logarithmic, so 1 to 7 nights and 28 to 33 nights both have room.`,
  );
  setLegend("price-legend", [
    [`Under ${line} nights`, COLOURS.under_31],
    [`Exactly ${line}`, COLOURS.exactly_31],
    [`Over ${line}`, COLOURS.over_31],
  ]);

  const root = document.getElementById("price-chart") as HTMLElement;
  return () => {
    const W = widthOf(root);
    const H = heightOf(root, 420);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      `Dot chart: median asking price per night by minimum stay in Barcelona. 1 night: €${one.median_price}; ${line + 1} nights: €${after.median_price}.`,
    );
    const top = 20;
    const bottom = 28;
    // log scale: the short-stay cluster (1-7) and the month cluster (28-33) both get room
    const x = d3.scaleLog().domain([0.8, NIGHTS_CAP * 1.15]).range([inset + 40, W - inset - 30]);
    const prices = points.map((p) => p.median_price);
    const y = d3
      .scaleLog()
      .domain([Math.min(40, d3.min(prices) ?? 40) * 0.85, (d3.max(prices) ?? 300) * 1.15])
      .range([H - bottom, top]);
    const r = d3
      .scaleSqrt()
      .domain([0, d3.max(points, (p) => p.listings) ?? 1])
      .range([0, Math.min(46, H * 0.11, W * 0.07)]);

    for (const t of [50, 100, 200, 400].filter((t) => t >= y.domain()[0]! && t <= y.domain()[1]!)) {
      svg.append("line").attr("class", "gridline").attr("x1", inset + 40).attr("x2", W - inset).attr("y1", y(t)).attr("y2", y(t));
      svg.append("text").attr("x", inset).attr("y", y(t) + 4).text(`€${t}`);
    }
    svg
      .append("line")
      .attr("x1", x(line))
      .attr("x2", x(line))
      .attr("y1", top)
      .attr("y2", H - bottom)
      .attr("stroke", COLOURS.ink)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0.5);
    for (const t of [1, 2, 3, 7, 14, line, 60, 120]) {
      svg
        .append("text")
        .attr("x", x(t))
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(t === 1 ? "1 night" : t === NIGHTS_CAP ? `${t}+` : String(t));
    }

    const waiting = isWaiting(KEY);
    const dots = svg
      .append("g")
      .selectAll<SVGCircleElement, (typeof points)[number]>("circle")
      .data(points)
      .join("circle")
      .attr("cx", (d) => x(d.nights))
      .attr("cy", (d) => y(d.median_price))
      .attr("r", (d) => (waiting ? 0 : r(d.listings)))
      .attr("fill", (d) => COLOURS[bandOf(d.nights, line)])
      .attr("fill-opacity", 0.78)
      .attr("stroke", COLOURS.page)
      .on("pointermove", (event: PointerEvent, d) => {
        dots.attr("opacity", (o) => (o === d ? 1 : 0.25));
        showTip(event, `<b>${d.nights === NIGHTS_CAP ? `${NIGHTS_CAP}+` : d.nights} night${d.nights === 1 ? "" : "s"} minimum</b>median asking price €${d.median_price} a night<br>${formatInt(d.listings)} listings`);
      })
      .on("pointerleave", () => {
        dots.attr("opacity", 1);
        hideTip();
      });

    const label = (d: (typeof points)[number], text: string, side: "left" | "right") => {
      svg
        .append("text")
        .attr("class", "lab-strong hl plabel")
        .attr("x", x(d.nights) + (side === "right" ? r(d.listings) + 8 : -r(d.listings) - 8))
        .attr("y", y(d.median_price) + 4)
        .attr("text-anchor", side === "right" ? "start" : "end")
        .attr("opacity", waiting ? 0 : 1)
        .text(text);
    };
    label(one, `1 night: €${one.median_price}`, "right");
    label(after, `${line + 1} nights: €${after.median_price}`, "right");

    if (waiting) {
      revealOnView(KEY, root, () => {
        dots
          .transition()
          .duration(MOTION_MS * 0.7)
          .delay((_, i) => i * 45)
          .ease(d3.easeBackOut.overshoot(1.1))
          .attr("r", (d) => r(d.listings));
        svg.selectAll("text.plabel").transition().delay(MOTION_MS).duration(400).attr("opacity", 1);
      });
    }
  };
}
