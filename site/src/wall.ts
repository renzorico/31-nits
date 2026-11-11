// Screen: the wall at 31 nights. Barcelona's minimum-stay histogram, large,
// over four small multiples of the other cities on the SAME vertical scale,
// so the absence of a wall elsewhere is visible, not asserted.
import * as d3 from "d3";

import { CITIES, CITY_LABELS, type Band, type City, type NightsRow } from "./data";
import {
  BAND_LABEL,
  COLOURS,
  formatInt,
  freshSvg,
  heightOf,
  hideTip,
  insetOf,
  isWaiting,
  MOTION_MS,
  pct,
  revealOnView,
  setHtml,
  setLegend,
  setText,
  share,
  showTip,
  widthOf,
} from "./story";

export const NIGHTS_CAP = 120; // the export groups longer minimum stays into one "120+" bar
const KEY = "wall";
// Beyond this many nights the bars are tiny and far apart, so they are folded
// into one "N+" bar; the tooltip and the how-to say so.
const WALL_MAX = 45;
const FOLDED = WALL_MAX + 1;

function fold(rows: CityHistogram["rows"]): CityHistogram["rows"] {
  const kept = rows.filter((r) => r.nights <= WALL_MAX);
  const rest = rows.filter((r) => r.nights > WALL_MAX);
  if (!rest.length) return kept;
  return [...kept, { nights: FOLDED, listings: d3.sum(rest, (r) => r.listings), share: d3.sum(rest, (r) => r.share), median_price: null }];
}
const nightsLabel = (n: number): string => (n === FOLDED ? `${FOLDED} or more nights` : `${n} night${n === 1 ? "" : "s"}`);

export function bandOf(nights: number, line: number): Band {
  return nights < line ? "under_31" : nights === line ? "exactly_31" : "over_31";
}

export interface CityHistogram {
  city: City;
  snapshot: string;
  total: number;
  rows: { nights: number; listings: number; share: number; median_price: number | null }[];
}

export function latestHistograms(rows: NightsRow[]): CityHistogram[] {
  return CITIES.map((city) => {
    const own = rows.filter((r) => r.city === city);
    const snapshot = d3.max(own, (r) => r.snapshot) ?? "";
    const latest = own.filter((r) => r.snapshot === snapshot);
    const total = d3.sum(latest, (r) => r.listings);
    return {
      city,
      snapshot,
      total,
      rows: latest.map((r) => ({ nights: r.nights, listings: r.listings, share: share(r.listings, total), median_price: r.median_price })),
    };
  });
}

export function initWall(rows: NightsRow[], line: number): () => void {
  const hists = latestHistograms(rows);
  const bcn = hists.find((h) => h.city === "barcelona");
  if (!bcn) throw new Error("No Barcelona histogram");
  const at = (n: number) => bcn.rows.find((r) => r.nights === n);
  const one = at(1);
  const nearLine = bcn.rows.filter((r) => r.nights === line || r.nights === line + 1);
  const nearLineShare = share(d3.sum(nearLine, (r) => r.listings), bcn.total);

  setText("wall-title", `Barcelona's listings split in two: one night (${pct(one?.share ?? 0, 0)}) or ${line}–${line + 1} nights (${pct(nearLineShare, 0)}).`);
  setHtml(
    "wall-sub",
    `Each bar is the share of a city's Airbnb listings with open dates that ask for that minimum stay. In Catalonia a tourist stay is ${line} days or fewer, ` +
      `and ${formatInt(at(line)?.listings ?? 0)} Barcelona listings ask exactly ${line} nights while ${formatInt(at(line + 1)?.listings ?? 0)} ask ${line + 1}. ` +
      "The four other cities, drawn on the same scale, have no such wall.",
  );
  setText(
    "wall-how",
    `Latest snapshot per city (Barcelona ${bcn.snapshot}). A minimum stay is a setting the host chooses: it is not how long guests stay, and not a legal finding. ` +
      `Whether a ${line}-night booking counts as "${line} days or fewer" is ambiguous, so exactly ${line} has its own colour. ` +
      `Minimum stays of ${FOLDED} nights or more are grouped in the last bar. Outside Catalonia ${line} nights has no legal meaning and is only a common yardstick.`,
  );
  setLegend("wall-legend", [
    [BAND_LABEL.under_31, COLOURS.under_31],
    [`Exactly ${line}`, COLOURS.exactly_31],
    [`Over ${line}`, COLOURS.over_31],
  ]);

  const root = document.getElementById("wall-chart") as HTMLElement;
  const shown = hists.map((h) => ({ ...h, rows: fold(h.rows) }));
  const yMax = d3.max(shown, (h) => d3.max(h.rows, (r) => r.share)) ?? 50;

  return () => {
    const W = widthOf(root);
    const H = heightOf(root, 560);
    const inset = insetOf();
    const narrow = W < 640;
    const svg = freshSvg(
      root,
      W,
      H,
      `Bar charts of minimum stays. Barcelona: ${pct(one?.share ?? 0)} ask 1 night and ${pct(nearLineShare)} ask ${line} or ${line + 1}. ` +
        hists
          .filter((h) => h.city !== "barcelona")
          .map((h) => `${CITY_LABELS[h.city]}: ${pct(share(d3.sum(h.rows.filter((r) => r.nights >= line), (r) => r.listings), h.total))} ask ${line} or more`)
          .join("; "),
    );

    const others = shown.filter((h) => h.city !== "barcelona");
    const big = shown.find((h) => h.city === "barcelona") ?? bcn;
    const yAxisW = 34;
    const cols = narrow ? 2 : 4;
    const rowsOfSmall = Math.ceil(others.length / cols);
    const gap = 28;
    const bigH = Math.max(180, (H - gap) * (narrow ? 0.5 : 0.64));
    const smallH = (H - bigH - gap) / rowsOfSmall;
    const right = inset;

    const panels: { h: CityHistogram; x0: number; y0: number; w: number; h0: number; big: boolean }[] = [
      { h: big, x0: inset + yAxisW, y0: 0, w: W - inset - right - yAxisW, h0: bigH, big: true },
      ...others.map((h, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const w = (W - inset - right - (cols - 1) * 20) / cols;
        return { h, x0: inset + col * (w + 20), y0: bigH + gap + row * smallH, w, h0: smallH, big: false };
      }),
    ];

    const waiting = isWaiting(KEY);

    for (const p of panels) {
      const top = p.big ? 34 : 22;
      const bottom = p.big ? 22 : 16;
      const g = svg.append("g").attr("transform", `translate(${p.x0},${p.y0})`);
      const x = d3.scaleLinear().domain([0.5, FOLDED + 0.5]).range([0, p.w]);
      const y = d3.scaleLinear().domain([0, yMax]).range([p.h0 - bottom, top]);
      const bw = Math.max(1, x(2) - x(1) - (p.w > 500 ? 1 : 0.3));

      // gridlines (big panel only), baseline
      if (p.big) {
        for (const t of y.ticks(4).filter((t) => t > 0)) {
          g.append("line").attr("class", "gridline").attr("x1", 0).attr("x2", p.w).attr("y1", y(t)).attr("y2", y(t));
          g.append("text").attr("x", -yAxisW).attr("y", y(t) + 4).text(`${t}%`);
        }
      }
      g.append("line").attr("class", "axisline").attr("x1", 0).attr("x2", p.w).attr("y1", y(0)).attr("y2", y(0));

      // the line
      const lx = x(line);
      g.append("line")
        .attr("x1", lx)
        .attr("x2", lx)
        .attr("y1", top - (p.big ? 18 : 6))
        .attr("y2", y(0))
        .attr("stroke", COLOURS.ink)
        .attr("stroke-dasharray", "3 3")
        .attr("opacity", 0.55);
      if (p.big) {
        g.append("text")
          .attr("class", "lab hl")
          .attr("x", narrow ? lx - 6 : lx + 8)
          .attr("y", top - 8)
          .attr("text-anchor", narrow ? "end" : "start")
          .text(narrow ? `tourist stay: ${line} days or fewer` : `Catalan tourist-stay limit: ${line} days or fewer`);
      }

      const sel = g
        .selectAll<SVGRectElement, CityHistogram["rows"][number]>("rect.bar")
        .data(p.h.rows)
        .join("rect")
        .attr("class", "bar")
        .attr("x", (d) => x(d.nights) - bw / 2)
        .attr("width", bw)
        .attr("rx", p.big && bw > 4 ? 1.5 : 0)
        .attr("fill", (d) => COLOURS[bandOf(d.nights, line)])
        .attr("y", (d) => (waiting ? y(0) : y(d.share)))
        .attr("height", (d) => (waiting ? 0 : y(0) - y(d.share)))
        .on("pointermove", (event: PointerEvent, d) => {
          sel.attr("opacity", (o) => (o === d ? 1 : 0.35));
          const price = d.median_price === null ? "no price data" : `median asking price €${d.median_price} a night`;
          showTip(
            event,
            `<b>${CITY_LABELS[p.h.city]}: ${nightsLabel(d.nights)} minimum</b>` +
              `${formatInt(d.listings)} listings, ${pct(d.share)} of ${formatInt(p.h.total)}<br>${price}`,
          );
        })
        .on("pointerleave", () => {
          sel.attr("opacity", 1);
          hideTip();
        });
      // store the scale on the selection for the reveal
      sel.each(function (d) {
        (this as SVGRectElement).dataset.y = String(y(d.share));
        (this as SVGRectElement).dataset.y0 = String(y(0));
      });

      // city name and its 31+ share
      const plus = share(d3.sum(p.h.rows.filter((r) => r.nights >= line), (r) => r.listings), p.h.total);
      const name = g
        .append("text")
        .attr("class", "lab-strong hl")
        .attr("x", p.w)
        .attr("y", p.big ? top + 18 : top - 6)
        .attr("text-anchor", "end");
      name.append("tspan").text(CITY_LABELS[p.h.city]);
      name
        .append("tspan")
        .attr("class", "lab")
        .attr("dx", 6)
        .style("font-weight", "400")
        .style("fill", COLOURS.ink2)
        .text(`${pct(plus, 0)} ask ${line}+`);

      // x ticks
      const ticks = p.big ? (narrow ? [1, 14, line, FOLDED] : [1, 7, 14, 21, 28, line, FOLDED]) : [1, line, FOLDED];
      for (const t of ticks) {
        g.append("text")
          .attr("x", x(t))
          .attr("y", p.h0 - (p.big ? 4 : 2))
          .attr("text-anchor", t === 1 ? "start" : t === FOLDED ? "end" : "middle")
          .text(t === FOLDED ? `${t}+` : t === 1 && p.big ? "1 night" : String(t));
      }

      // direct labels on Barcelona's three peaks
      if (p.big) {
        for (const n of [1, line, line + 1]) {
          const d = p.h.rows.find((r) => r.nights === n);
          if (!d) continue;
          const anchorEnd = n === line;
          g.append("text")
            .attr("class", "lab-strong hl peak")
            .attr("x", x(n) + (n === 1 ? bw / 2 + 6 : anchorEnd ? -bw / 2 - 5 : bw / 2 + 5))
            .attr("y", y(d.share) + 14)
            .attr("text-anchor", anchorEnd ? "end" : "start")
            .attr("opacity", waiting ? 0 : 1)
            .text(narrow && n !== 1 ? pct(d.share, 0) : `${n} night${n === 1 ? "" : "s"}: ${pct(d.share, 0)}`);
        }
      }
    }

    if (waiting) {
      revealOnView(KEY, root, () => {
        svg
          .selectAll<SVGRectElement, unknown>("rect.bar")
          .transition()
          .duration(MOTION_MS)
          .delay((_, i) => i * 4)
          .ease(d3.easeCubicOut)
          .attr("y", function () {
            return Number(this.dataset.y);
          })
          .attr("height", function () {
            return Number(this.dataset.y0) - Number(this.dataset.y);
          });
        svg.selectAll("text.peak").transition().delay(MOTION_MS * 0.8).duration(400).attr("opacity", 1);
      });
    }
  };
}
