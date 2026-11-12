// Average rent of new leases and the number of new leases lodged, Barcelona,
// quarterly, with the start dates of the two rent rules marked.
import * as d3 from "d3";

import type { Meta, RentRow } from "./data";
import { leverText, quarterOf, signedPct, T } from "./i18n";
import { chartHeight, COLOURS, dayMonthYear, euro, formatInt, freshSvg, insetOf, isNarrow, isWaiting, MOTION_MS, pct, revealOnView, setLegend, setText, share, widthOf, withTip } from "./story";

const RENT = COLOURS.ink;
const LEASES = "#bdb7aa";

export function initRents(rents: RentRow[], meta: Meta): () => void {
  const first = rents[0];
  const last = rents.at(-1);
  if (!first || !last) throw new Error("No rents");
  const peak = rents.reduce((m, r) => (r.avg_rent > m.avg_rent ? r : m), first);
  const leaseChange = share(last.new_leases - first.new_leases, first.new_leases);
  const markers = ["rent_cap", "seasonal_rentals"]
    .map((id) => meta.policy_levers[id])
    .filter((l): l is NonNullable<typeof l> => l !== undefined)
    .map((l) => ({ date: new Date(`${l.applies_from}T00:00:00Z`), label: leverText(l, "timeline_label"), iso: l.applies_from }));
  const q = (r: RentRow) => quarterOf(r.quarter_start);

  setText("rents-title", T.rents.title(q(last), euro(last.avg_rent), pct(Math.abs(leaseChange), 0), leaseChange < 0, q(first)));
  setText("rents-sub", T.rents.sub(euro(first.avg_rent), q(first), euro(peak.avg_rent), q(peak), euro(last.avg_rent), q(last), formatInt(first.new_leases), formatInt(last.new_leases)));
  setText("rents-how", T.rents.how(markers.map((m) => `${m.label}: ${dayMonthYear(m.iso)}`).join("; ")));
  setLegend("rents-legend", [
    [T.rents.legendRent, RENT],
    [T.rents.legendLeases, LEASES],
  ]);

  const root = document.getElementById("rents-chart") as HTMLElement;
  const KEY = "rents";
  return () => {
    const W = widthOf(root);
    const narrow = isNarrow();
    const H = chartHeight(W, 380, 480, 0.4);
    const inset = insetOf();
    const svg = freshSvg(root, W, H, T.rents.aria(euro(first.avg_rent), q(first), euro(last.avg_rent), q(last), formatInt(first.new_leases), formatInt(last.new_leases)));
    const dates = rents.map((r) => new Date(`${r.quarter_start}T00:00:00Z`));
    const firstDate = dates[0] ?? new Date();
    const lastDate = dates.at(-1) ?? new Date();
    const x = d3.scaleUtc().domain([firstDate, d3.utcMonth.offset(lastDate, 3)]).range([inset + 48, W - inset]);
    const splitY = H * 0.6;
    const yRent = d3.scaleLinear().domain([0, (d3.max(rents, (r) => r.avg_rent) ?? 1300) * 1.1]).range([splitY - 10, 18]);
    const yLeases = d3.scaleLinear().domain([0, d3.max(rents, (r) => r.new_leases) ?? 15000]).range([H - 26, splitY + 24]);

    for (const t of yRent.ticks(4).filter((t) => t > 0)) {
      svg.append("line").attr("class", "gridline").attr("x1", inset + 48).attr("x2", W - inset).attr("y1", yRent(t)).attr("y2", yRent(t));
      svg.append("text").attr("x", inset).attr("y", yRent(t) + 4).text(euro(t));
    }
    svg.append("line").attr("class", "axisline").attr("x1", inset + 48).attr("x2", W - inset).attr("y1", yRent(0)).attr("y2", yRent(0));
    svg.append("text").attr("x", inset).attr("y", splitY + 14).attr("class", "lab").text(T.rents.axisLeases);
    for (const t of yLeases.ticks(2).filter((t) => t > 0)) {
      svg.append("text").attr("x", inset).attr("y", yLeases(t) + 4).text(formatInt(t));
      svg.append("line").attr("class", "gridline").attr("x1", inset + 48).attr("x2", W - inset).attr("y1", yLeases(t)).attr("y2", yLeases(t));
    }
    for (let year = firstDate.getUTCFullYear(); year <= lastDate.getUTCFullYear(); year += 1) {
      if (narrow && year % 2 === 1) continue;
      const yx = x(new Date(Date.UTC(year, 6, 1)));
      if (yx > W - inset - 14) continue;
      svg.append("text").attr("x", yx).attr("y", H - 8).attr("text-anchor", "middle").text(String(year));
    }

    const waiting = isWaiting(KEY);
    const content = svg.append("g").attr("clip-path", "url(#rents-clip)");
    const clip = svg.append("clipPath").attr("id", "rents-clip").append("rect").attr("height", H).attr("width", waiting ? 0 : W);
    const step = x(dates[1] ?? lastDate) - x(firstDate);
    const bw = Math.max(2, step * 0.7);
    const at = (i: number) => x(dates[i] ?? firstDate);
    content
      .selectAll("rect.lease")
      .data(rents)
      .join("rect")
      .attr("x", (_, i) => at(i))
      .attr("width", bw)
      .attr("y", (d) => yLeases(d.new_leases))
      .attr("height", (d) => yLeases(0) - yLeases(d.new_leases))
      .attr("fill", LEASES);
    const mid = (i: number) => at(i) + bw / 2;
    content
      .append("path")
      .datum(rents)
      .attr("d", d3.area<RentRow>().x((_, i) => mid(i)).y0(yRent(0)).y1((d) => yRent(d.avg_rent)).curve(d3.curveMonotoneX))
      .attr("fill", RENT)
      .attr("opacity", 0.05);
    content
      .append("path")
      .datum(rents)
      .attr("d", d3.line<RentRow>().x((_, i) => mid(i)).y((d) => yRent(d.avg_rent)).curve(d3.curveMonotoneX))
      .attr("fill", "none")
      .attr("stroke", RENT)
      .attr("stroke-width", 2.5);
    for (const [r, anchor] of [
      [first, "start"],
      [peak, "middle"],
      [last, "end"],
    ] as const) {
      const i = rents.indexOf(r);
      content.append("circle").attr("cx", mid(i)).attr("cy", yRent(r.avg_rent)).attr("r", 4).attr("fill", RENT);
      content.append("text").attr("class", "lab-strong hl").attr("x", mid(i)).attr("y", yRent(r.avg_rent) - 12).attr("text-anchor", anchor).text(euro(r.avg_rent));
    }
    for (const m of markers) {
      const mx = x(m.date);
      svg.append("line").attr("x1", mx).attr("x2", mx).attr("y1", 14).attr("y2", H - 24).attr("stroke", COLOURS.ink).attr("stroke-dasharray", "3 4").attr("opacity", 0.6);
      if (!narrow) svg.append("text").attr("class", "lab hl").attr("x", mx - 6).attr("y", splitY + 14).attr("text-anchor", "end").text(m.label);
    }
    const hits = svg
      .append("g")
      .selectAll<SVGRectElement, RentRow>("rect")
      .data(rents)
      .join("rect")
      .attr("x", (_, i) => at(i))
      .attr("width", Math.max(4, step))
      .attr("y", 0)
      .attr("height", H)
      .attr("fill", "transparent");
    withTip(hits, (d) => T.rents.tip(q(d), euro(d.avg_rent), d.yoy_pct === null ? null : signedPct(d.yoy_pct), formatInt(d.new_leases)));

    if (waiting) revealOnView(KEY, root, () => clip.transition().duration(MOTION_MS * 1.3).ease(d3.easeCubicInOut).attr("width", W));
  };
}
