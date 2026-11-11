// Screen: average rent of new leases and the number of new leases lodged,
// Barcelona, quarterly, with the start dates of the two rent rules marked.
import * as d3 from "d3";

import type { Meta, RentRow } from "./data";
import {
  COLOURS,
  dayMonthYear,
  euro,
  formatInt,
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
  share,
  showTip,
  widthOf,
} from "./story";

const quarter = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
};
const RENT = COLOURS.ink;
const LEASES = COLOURS.under_31;

export function initRents(rents: RentRow[], meta: Meta): () => void {
  const first = rents[0];
  const last = rents.at(-1);
  if (!first || !last) throw new Error("No rents");
  const peak = rents.reduce((m, r) => (r.avg_rent > m.avg_rent ? r : m), first);
  const leaseChange = share(last.new_leases - first.new_leases, first.new_leases);
  const markers = ["rent_cap", "seasonal_rentals"]
    .map((id) => meta.policy_levers[id])
    .filter((l): l is NonNullable<typeof l> => l !== undefined)
    .map((l) => ({ date: new Date(`${l.applies_from}T00:00:00Z`), label: l.timeline_label, iso: l.applies_from }));

  setText(
    "rents-title",
    `In ${quarter(last.quarter_start)} new leases averaged ${euro(last.avg_rent)} a month, and ${pct(Math.abs(leaseChange), 0)} ${leaseChange < 0 ? "fewer" : "more"} were lodged than in ${quarter(first.quarter_start)}.`,
  );
  setText(
    "rents-sub",
    `The average rent of a new lease rose from ${euro(first.avg_rent)} (${quarter(first.quarter_start)}) to a peak of ${euro(peak.avg_rent)} (${quarter(peak.quarter_start)}) and was ${euro(last.avg_rent)} in ${quarter(last.quarter_start)}. ` +
      `New leases lodged went from ${formatInt(first.new_leases)} to ${formatInt(last.new_leases)} a quarter. The dashed lines mark when the two rent rules began.`,
  );
  setText(
    "rents-how",
    "From the deposits landlords must lodge with the Catalan housing agency (Incasòl), Barcelona city, euros of each year (not adjusted for inflation). " +
      "The timing is shown; the cause is not. Interest rates, wages, supply and the mix of flats rented all move the average, and a lease that is never lodged is not counted. " +
      `Rule dates: ${markers.map((m) => `${m.label} ${dayMonthYear(m.iso)}`).join("; ")}.`,
  );
  setLegend("rents-legend", [
    ["Average monthly rent, new leases", RENT],
    ["New leases lodged per quarter", LEASES],
  ]);

  const root = document.getElementById("rents-chart") as HTMLElement;
  const KEY = "rents";
  return () => {
    const W = widthOf(root);
    const H = heightOf(root, 440);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      `Line chart: average rent of new leases from ${euro(first.avg_rent)} in ${quarter(first.quarter_start)} to ${euro(last.avg_rent)} in ${quarter(last.quarter_start)}; bars: new leases from ${formatInt(first.new_leases)} to ${formatInt(last.new_leases)} a quarter.`,
    );
    const dates = rents.map((r) => new Date(`${r.quarter_start}T00:00:00Z`));
    const x = d3
      .scaleUtc()
      .domain([dates[0] ?? new Date(), d3.utcMonth.offset(dates.at(-1) ?? new Date(), 3)])
      .range([inset + 44, W - inset]);
    const splitY = H * 0.6;
    const yRent = d3
      .scaleLinear()
      .domain([0, (d3.max(rents, (r) => r.avg_rent) ?? 1300) * 1.08])
      .range([splitY - 10, 18]);
    const yLeases = d3
      .scaleLinear()
      .domain([0, d3.max(rents, (r) => r.new_leases) ?? 15000])
      .range([H - 26, splitY + 22]);

    for (const t of yRent.ticks(4).filter((t) => t > 0)) {
      svg.append("line").attr("class", "gridline").attr("x1", inset).attr("x2", W - inset).attr("y1", yRent(t)).attr("y2", yRent(t));
      svg.append("text").attr("x", inset).attr("y", yRent(t) + 4).text(`€${formatInt(t)}`);
    }
    svg.append("line").attr("class", "axisline").attr("x1", inset).attr("x2", W - inset).attr("y1", yRent(0)).attr("y2", yRent(0));
    svg.append("text").attr("x", inset).attr("y", splitY + 14).attr("class", "lab").text("new leases a quarter");
    for (const t of yLeases.ticks(2).filter((t) => t > 0)) {
      svg.append("text").attr("x", inset).attr("y", yLeases(t) + 4).text(formatInt(t));
      svg.append("line").attr("class", "gridline").attr("x1", inset + 44).attr("x2", W - inset).attr("y1", yLeases(t)).attr("y2", yLeases(t));
    }
    for (const year of d3.range(2019, (dates.at(-1)?.getUTCFullYear() ?? 2026) + 1)) {
      if (W < 480 && year % 2 === 1) continue;
      if (x(new Date(Date.UTC(year, 6, 1))) > W - inset - 14) continue;
      svg
        .append("text")
        .attr("x", x(new Date(Date.UTC(year, 6, 1))))
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(String(year));
    }

    const waiting = isWaiting(KEY);
    const content = svg.append("g");
    const clip = svg.append("clipPath").attr("id", "rents-clip").append("rect").attr("height", H).attr("width", waiting ? 0 : W);
    content.attr("clip-path", "url(#rents-clip)");

    const bw = Math.max(2, (x(dates[1] ?? new Date()) - x(dates[0] ?? new Date())) * 0.7);
    content
      .selectAll("rect.lease")
      .data(rents)
      .join("rect")
      .attr("class", "lease")
      .attr("x", (_, i) => x(dates[i] ?? new Date()))
      .attr("width", bw)
      .attr("y", (d) => yLeases(d.new_leases))
      .attr("height", (d) => yLeases(0) - yLeases(d.new_leases))
      .attr("rx", 1.5)
      .attr("fill", LEASES)
      .attr("opacity", 0.8);

    const mid = (i: number) => x(dates[i] ?? new Date()) + bw / 2;
    const area = d3
      .area<RentRow>()
      .x((_, i) => mid(i))
      .y0(yRent(0))
      .y1((d) => yRent(d.avg_rent))
      .curve(d3.curveMonotoneX);
    const lineGen = d3
      .line<RentRow>()
      .x((_, i) => mid(i))
      .y((d) => yRent(d.avg_rent))
      .curve(d3.curveMonotoneX);
    content.append("path").datum(rents).attr("d", area).attr("fill", RENT).attr("opacity", 0.06);
    content.append("path").datum(rents).attr("d", lineGen).attr("fill", "none").attr("stroke", RENT).attr("stroke-width", 2.5);

    for (const [r, anchor] of [
      [first, "start"],
      [peak, "middle"],
      [last, "end"],
    ] as const) {
      const i = rents.indexOf(r);
      content.append("circle").attr("cx", mid(i)).attr("cy", yRent(r.avg_rent)).attr("r", 4).attr("fill", RENT);
      content
        .append("text")
        .attr("class", "lab-strong hl")
        .attr("x", mid(i) + (anchor === "end" ? 4 : 0))
        .attr("y", yRent(r.avg_rent) - 12)
        .attr("text-anchor", anchor)
        .text(euro(r.avg_rent));
    }

    for (const m of markers) {
      const mx = x(m.date);
      svg
        .append("line")
        .attr("x1", mx)
        .attr("x2", mx)
        .attr("y1", 14)
        .attr("y2", H - 24)
        .attr("stroke", COLOURS.ink2)
        .attr("stroke-dasharray", "3 4")
        .attr("opacity", 0.6);
      svg
        .append("text")
        .attr("class", "lab hl")
        .attr("x", mx - 6)
        .attr("y", splitY + 14)
        .attr("text-anchor", "end")
        .text(W < 640 ? "" : m.label);
    }

    // hover per quarter
    svg
      .append("g")
      .selectAll("rect")
      .data(rents)
      .join("rect")
      .attr("x", (_, i) => x(dates[i] ?? new Date()))
      .attr("width", Math.max(4, x(dates[1] ?? new Date()) - x(dates[0] ?? new Date())))
      .attr("y", 0)
      .attr("height", H)
      .attr("fill", "transparent")
      .on("pointermove", (event: PointerEvent, d) =>
        showTip(
          event,
          `<b>${quarter(d.quarter_start)}</b>average rent ${euro(d.avg_rent)} a month${d.yoy_pct === null ? "" : ` (${d.yoy_pct > 0 ? "+" : ""}${d.yoy_pct}% on a year earlier)`}<br>${formatInt(d.new_leases)} new leases lodged`,
        ),
      )
      .on("pointerleave", hideTip);

    if (waiting) revealOnView(KEY, root, () => clip.transition().duration(MOTION_MS * 1.3).ease(d3.easeCubicInOut).attr("width", W));
  };
}
