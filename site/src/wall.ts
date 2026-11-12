// The wall at 31 nights: Barcelona's minimum-stay histogram, large, over four
// small multiples of the other cities on the SAME vertical scale, so the
// absence of a wall elsewhere is visible, not asserted.
import * as d3 from "d3";

import { CITIES, type Band, type City, type NightsRow } from "./data";
import { cityName, T } from "./i18n";
import {
  chartHeight,
  COLOURS,
  euro,
  formatInt,
  freshSvg,
  insetOf,
  isNarrow,
  isWaiting,
  MOTION_MS,
  pct,
  revealOnView,
  setLegend,
  setText,
  share,
  widthOf,
  withTip,
} from "./story";

export const NIGHTS_CAP = 120; // the export groups longer minimum stays into one "120+" bar
const KEY = "wall";
// Beyond this many nights the bars are tiny and far apart, so they are folded
// into one "N+" bar; the tooltip and the how-to say so.
const WALL_MAX = 45;
const FOLDED = WALL_MAX + 1;

export function bandOf(nights: number, line: number): Band {
  return nights < line ? "under_31" : nights === line ? "exactly_31" : "over_31";
}

type Row = { nights: number; listings: number; share: number; median_price: number | null };
export interface CityHistogram {
  city: City;
  snapshot: string;
  total: number;
  rows: Row[];
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

function fold(rows: Row[]): Row[] {
  const kept = rows.filter((r) => r.nights <= WALL_MAX);
  const rest = rows.filter((r) => r.nights > WALL_MAX);
  if (!rest.length) return kept;
  return [...kept, { nights: FOLDED, listings: d3.sum(rest, (r) => r.listings), share: d3.sum(rest, (r) => r.share), median_price: null }];
}
const nightsLabel = (n: number): string => (n === FOLDED ? T.nightsOrMore(FOLDED) : T.nights(n));

export function initWall(rows: NightsRow[], line: number): () => void {
  const hists = latestHistograms(rows);
  const bcn = hists.find((h) => h.city === "barcelona");
  if (!bcn) throw new Error("No Barcelona histogram");
  const at = (n: number) => bcn.rows.find((r) => r.nights === n);
  const one = at(1);
  const nearLine = bcn.rows.filter((r) => r.nights === line || r.nights === line + 1);
  const nearLineShare = share(d3.sum(nearLine, (r) => r.listings), bcn.total);
  const plusShare = (h: CityHistogram) => share(d3.sum(h.rows.filter((r) => r.nights >= line), (r) => r.listings), h.total);

  setText("wall-title", T.wall.title(pct(one?.share ?? 0, 0), line, pct(nearLineShare, 0)));
  setText("wall-sub", T.wall.sub(line, formatInt(at(line)?.listings ?? 0), formatInt(at(line + 1)?.listings ?? 0)));
  setText("wall-how", T.wall.how(bcn.snapshot, line, FOLDED));
  setLegend("wall-legend", (["under_31", "exactly_31", "over_31"] as Band[]).map((b) => [T.band(b, line), COLOURS[b]]));

  const root = document.getElementById("wall-chart") as HTMLElement;
  const shown = hists.map((h) => ({ ...h, rows: fold(h.rows) }));
  const yMax = d3.max(shown, (h) => d3.max(h.rows, (r) => r.share)) ?? 50;
  const others = shown.filter((h) => h.city !== "barcelona");
  const big = shown.find((h) => h.city === "barcelona") ?? bcn;

  return () => {
    const W = widthOf(root);
    const narrow = isNarrow();
    const H = chartHeight(W, 520, 640, narrow ? 1.5 : 0.48);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      T.wall.aria(pct(one?.share ?? 0), pct(nearLineShare), line, others.map((h) => T.wall.otherAria(cityName(h.city), pct(plusShare(h)), line)).join("; ")),
    );

    const cols = narrow ? 2 : 4;
    const rowsOfSmall = Math.ceil(others.length / cols);
    const gap = 32;
    const yAxisW = 38;
    const bigH = Math.max(200, (H - gap) * (narrow ? 0.5 : 0.62));
    const smallH = (H - bigH - gap) / rowsOfSmall;
    const panels = [
      { h: big, x0: inset + yAxisW, y0: 0, w: W - 2 * inset - yAxisW, h0: bigH, big: true },
      ...others.map((h, i) => {
        const w = (W - 2 * inset - (cols - 1) * 24) / cols;
        return { h, x0: inset + (i % cols) * (w + 24), y0: bigH + gap + Math.floor(i / cols) * smallH, w, h0: smallH, big: false };
      }),
    ];
    const waiting = isWaiting(KEY);

    for (const p of panels) {
      const top = p.big ? 36 : 24;
      const bottom = p.big ? 22 : 18;
      const g = svg.append("g").attr("transform", `translate(${p.x0},${p.y0})`);
      const x = d3.scaleLinear().domain([0.5, FOLDED + 0.5]).range([0, p.w]);
      const y = d3.scaleLinear().domain([0, yMax]).range([p.h0 - bottom, top]);
      const bw = Math.max(1, x(2) - x(1) - (p.w > 500 ? 1.5 : 0.4));

      if (p.big) {
        for (const t of y.ticks(4).filter((t) => t > 0)) {
          g.append("line").attr("class", "gridline").attr("x1", 0).attr("x2", p.w).attr("y1", y(t)).attr("y2", y(t));
          g.append("text").attr("x", -yAxisW).attr("y", y(t) + 4).text(pct(t, 0));
        }
      }
      g.append("line").attr("class", "axisline").attr("x1", 0).attr("x2", p.w).attr("y1", y(0)).attr("y2", y(0));

      const lx = x(line) + bw / 2 + 1;
      g.append("line")
        .attr("x1", lx)
        .attr("x2", lx)
        .attr("y1", top - (p.big ? 20 : 8))
        .attr("y2", y(0))
        .attr("stroke", COLOURS.ink)
        .attr("stroke-width", p.big ? 1.5 : 1);
      if (p.big) {
        g.append("text")
          .attr("class", "lab-strong hl")
          .attr("x", narrow ? lx - 6 : lx + 8)
          .attr("y", top - 10)
          .attr("text-anchor", narrow ? "end" : "start")
          .text(narrow ? T.wall.lineNarrow(line) : T.wall.lineWide(line));
      }

      const bars = g
        .selectAll<SVGRectElement, Row>("rect.bar")
        .data(p.h.rows)
        .join("rect")
        .attr("class", "bar")
        .attr("x", (d) => x(d.nights) - bw / 2)
        .attr("width", bw)
        .attr("fill", (d) => COLOURS[bandOf(d.nights, line)])
        .attr("y", (d) => (waiting ? y(0) : y(d.share)))
        .attr("height", (d) => (waiting ? 0 : y(0) - y(d.share)))
        .each(function (d) {
          this.dataset.y = String(y(d.share));
          this.dataset.y0 = String(y(0));
        });
      withTip(
        bars,
        (d) =>
          `<b>${cityName(p.h.city)}: ${T.minimum(nightsLabel(d.nights))}</b>${T.listingsOf(formatInt(d.listings), pct(d.share), formatInt(p.h.total))}<br>` +
          (d.median_price === null ? T.noPrice : T.askingPrice(euro(d.median_price))),
        (d) => bars.attr("opacity", (o) => (d === null || o === d ? 1 : 0.35)),
      );

      const name = g
        .append("text")
        .attr("class", "lab-strong hl")
        .attr("x", p.w)
        .attr("y", p.big ? top + 20 : top - 8)
        .attr("text-anchor", "end");
      name.append("tspan").text(cityName(p.h.city));
      name.append("tspan").attr("dx", 6).style("font-weight", "400").text(T.wall.askPlus(pct(plusShare(p.h), 0), line));

      const ticks = p.big ? (narrow ? [1, 14, line, FOLDED] : [1, 7, 14, 21, 28, line, FOLDED]) : [1, line, FOLDED];
      for (const t of ticks) {
        g.append("text")
          .attr("x", x(t))
          .attr("y", p.h0 - (p.big ? 4 : 2))
          .attr("text-anchor", t === 1 ? "start" : t === FOLDED ? "end" : "middle")
          .text(t === FOLDED ? `${t}+` : t === 1 && p.big ? T.wall.oneNight : String(t));
      }

      if (p.big) {
        for (const n of [1, line, line + 1]) {
          const d = p.h.rows.find((r) => r.nights === n);
          if (!d) continue;
          const left = n === line;
          g.append("text")
            .attr("class", "lab-strong hl peak")
            .attr("x", x(n) + (left ? -bw / 2 - 6 : bw / 2 + 6))
            .attr("y", y(d.share) + 14)
            .attr("text-anchor", left ? "end" : "start")
            .attr("opacity", waiting ? 0 : 1)
            .text(narrow && n !== 1 ? pct(d.share, 0) : `${nightsLabel(n)}: ${pct(d.share, 0)}`);
        }
      }
    }

    if (waiting) {
      revealOnView(KEY, root, () => {
        svg
          .selectAll<SVGRectElement, unknown>("rect.bar")
          .transition()
          .duration(MOTION_MS)
          .delay((_, i) => i * 3)
          .ease(d3.easeCubicOut)
          .attr("y", function () {
            return Number(this.dataset.y);
          })
          .attr("height", function () {
            return Number(this.dataset.y0) - Number(this.dataset.y);
          });
        svg.selectAll("text.peak").transition().delay(MOTION_MS * 0.8).duration(300).attr("opacity", 1);
      });
    }
  };
}
