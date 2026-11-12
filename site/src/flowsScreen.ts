// Where December's listings went (a two-column flow diagram, with only the
// two flows that carry the story in colour), and whether Barcelona's
// disappearances stand out against the other cities.
import * as d3 from "d3";

import { BANDS, CITIES, type Band, type CityRow, type TransitionTable, type Transitions } from "./data";
import { cityName, decimal, list, signed, T } from "./i18n";
import {
  chartHeight,
  COLOURS,
  formatInt,
  freshSvg,
  insetOf,
  isNarrow,
  isWaiting,
  monthYear,
  MOTION_MS,
  pct,
  revealOnView,
  setLegend,
  setText,
  share,
  widthOf,
  withTip,
} from "./story";

const OUTCOME_COLOUR: Record<string, string> = {
  under_31: COLOURS.under_31,
  exactly_31: COLOURS.exactly_31,
  over_31: COLOURS.over_31,
  inactive: COLOURS.other,
  gone: COLOURS.ink,
};

interface FlowNode {
  key: string;
  label: string;
  value: number;
  y0: number;
  y1: number;
  colour: string;
}
interface FlowLink {
  from: Band;
  to: string;
  value: number;
  sy: number;
  ty: number;
  width: number;
}

const MONTH_PLUS: Band[] = ["exactly_31", "over_31"];

export function initFlowsScreen(transitions: Transitions, line: number): () => void {
  const table: TransitionTable = transitions.cities.barcelona;
  const rowTotal = (band: Band) => d3.sum(table.counts[table.from.indexOf(band)] ?? []);
  const cell = (band: Band, to: string) => table.counts[table.from.indexOf(band)]?.[table.to.indexOf(to)] ?? 0;
  const monthPlus = d3.sum(MONTH_PLUS, rowTotal);
  const monthPlusGone = d3.sum(MONTH_PLUS, (b) => cell(b, "gone"));
  const switched = d3.sum(MONTH_PLUS, (b) => cell(b, "under_31"));
  const shorter = rowTotal("under_31");
  const shorterGone = cell("under_31", "gone");
  const from = monthYear(table.from_snapshot);
  const to = monthYear(table.to_snapshot);
  // the two flows the story is about: disappearing, and switching to short stays
  const highlighted = (l: FlowLink) => l.to === "gone" || (MONTH_PLUS.includes(l.from) && l.to === "under_31");

  setText("flows-title", T.flows.title(from, formatInt(monthPlus), pct(share(monthPlusGone, monthPlus), 0), to, pct(share(shorterGone, shorter), 0)));
  setText("flows-sub", T.flows.sub(from, to, formatInt(switched), formatInt(monthPlusGone)));
  setText("flows-how", T.flows.how);
  setLegend(
    "flows-legend",
    ["under_31", "exactly_31", "over_31", "inactive", "gone"].map((k) => [k in OUTCOME_COLOUR && BANDS.includes(k as Band) ? T.band(k as Band, line) : k === "gone" ? T.flows.gone : T.flows.inactive, OUTCOME_COLOUR[k] ?? COLOURS.other]),
  );

  const root = document.getElementById("flows-chart") as HTMLElement;
  const KEY = "flows";
  return () => {
    const W = widthOf(root);
    const narrow = isNarrow();
    const H = chartHeight(W, 420, 560, narrow ? 1.25 : 0.42);
    const inset = insetOf();
    const svg = freshSvg(root, W, H, T.flows.aria(from, to, formatInt(monthPlusGone), formatInt(monthPlus), formatInt(shorterGone), formatInt(shorter)));

    const nodeW = 12;
    const pad = narrow ? 8 : 12;
    const top = 24;
    const bottom = 8;
    const leftX = inset + (narrow ? 0 : 150);
    const rightX = W - inset - nodeW - (narrow ? 118 : 200);
    const total = d3.sum(BANDS, rowTotal);
    const outcomeLabel = (k: string) =>
      BANDS.includes(k as Band) ? T.band(k as Band, line) : k === "gone" ? (narrow ? T.flows.goneShort : T.flows.gone) : narrow ? T.flows.inactiveShort : T.flows.inactive;

    const layout = (keys: string[], value: (k: string) => number, colour: (k: string) => string, label: (k: string) => string): FlowNode[] => {
      const k = (H - top - bottom - pad * (keys.length - 1)) / total;
      let y = top;
      return keys.map((key) => {
        const v = value(key);
        const node = { key, label: label(key), value: v, y0: y, y1: y + v * k, colour: colour(key) };
        y += v * k + pad;
        return node;
      });
    };
    const left = layout([...BANDS], (k) => rowTotal(k as Band), (k) => COLOURS[k as Band], (k) => T.band(k as Band, line));
    const right = layout(table.to, (k) => d3.sum(BANDS, (b) => cell(b, k)), (k) => OUTCOME_COLOUR[k] ?? COLOURS.other, outcomeLabel);
    const scale = (H - top - bottom - pad * (BANDS.length - 1)) / total;

    const leftCursor = new Map(left.map((n) => [n.key, n.y0]));
    const rightCursor = new Map(right.map((n) => [n.key, n.y0]));
    const links: FlowLink[] = [];
    for (const band of BANDS) {
      for (const target of table.to) {
        const value = cell(band, target);
        if (!value) continue;
        const width = value * scale;
        const sy = (leftCursor.get(band) ?? 0) + width / 2;
        leftCursor.set(band, (leftCursor.get(band) ?? 0) + width);
        links.push({ from: band, to: target, value, sy, ty: 0, width });
      }
    }
    for (const target of table.to) {
      for (const link of links.filter((l) => l.to === target)) {
        link.ty = (rightCursor.get(target) ?? 0) + link.width / 2;
        rightCursor.set(target, (rightCursor.get(target) ?? 0) + link.width);
      }
    }

    const x0 = leftX + nodeW;
    const x1 = rightX;
    const path = (l: FlowLink) => {
      const mid = (x0 + x1) / 2;
      return `M${x0},${l.sy}C${mid},${l.sy} ${mid},${l.ty} ${x1},${l.ty}`;
    };
    svg.append("text").attr("x", leftX).attr("y", 14).attr("class", "lab-strong").text(from);
    svg.append("text").attr("x", rightX + nodeW).attr("y", 14).attr("text-anchor", "end").attr("class", "lab-strong").text(to);

    const waiting = isWaiting(KEY);
    const g = svg.append("g").attr("clip-path", "url(#flows-clip)");
    const clipRect = svg.append("clipPath").attr("id", "flows-clip").append("rect").attr("height", H).attr("width", waiting ? x0 : W);
    const baseOpacity = (l: FlowLink) => (highlighted(l) ? 0.55 : 0.12);
    const linkSel = g
      .selectAll<SVGPathElement, FlowLink>("path")
      .data(links)
      .join("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", (l) => (highlighted(l) ? COLOURS[l.from] : COLOURS.muted))
      .attr("stroke-opacity", baseOpacity)
      .attr("stroke-width", (l) => Math.max(1, l.width));
    withTip(
      linkSel,
      (l) => T.flows.tip(T.band(l.from, line), outcomeLabel(l.to), formatInt(l.value), pct(share(l.value, rowTotal(l.from))), from),
      (l) => linkSel.attr("stroke-opacity", (o) => (l === null ? baseOpacity(o) : o === l ? 0.8 : 0.06)),
    );

    const drawNodes = (nodes: FlowNode[], x: number, side: "left" | "right") => {
      for (const n of nodes) {
        svg.append("rect").attr("x", x).attr("y", n.y0).attr("width", nodeW).attr("height", Math.max(1, n.y1 - n.y0)).attr("rx", 1).attr("fill", n.colour);
        const ty = (n.y0 + n.y1) / 2;
        if (narrow && side === "left") {
          svg.append("text").attr("x", x + nodeW + 6).attr("y", ty + 4).attr("class", "lab-strong hl").text(formatInt(n.value));
          continue;
        }
        const tx = side === "left" ? x - 8 : x + nodeW + 8;
        const text = svg.append("text").attr("x", tx).attr("y", ty - 2).attr("text-anchor", side === "left" ? "end" : "start").attr("class", "lab-strong hl");
        text.append("tspan").text(n.label);
        text
          .append("tspan")
          .attr("x", tx)
          .attr("dy", 16)
          .style("font-weight", "400")
          .text(side === "right" ? `${formatInt(n.value)} (${pct(share(n.value, total), 0)})` : formatInt(n.value));
      }
    };
    drawNodes(left, leftX, "left");
    drawNodes(right, rightX, "right");

    if (waiting) revealOnView(KEY, root, () => clipRect.transition().duration(MOTION_MS).ease(d3.easeCubicInOut).attr("width", W));
  };
}

export function initGapScreen(cities: CityRow[], line: number): () => void {
  const rows = CITIES.map((c) => cities.find((r) => r.city === c)).filter((r): r is CityRow => r !== undefined);
  const bcn = rows.find((r) => r.city === "barcelona");
  if (!bcn) throw new Error("No Barcelona exit gap");
  const others = rows.filter((r) => r.city !== "barcelona");
  // The contrast intervals (Barcelona minus each city) are the test; overlapping separate intervals never are.
  const distinguishable = others.filter((r) => r.exit_gap.vs_barcelona && (r.exit_gap.vs_barcelona.ci_low > 0 || r.exit_gap.vs_barcelona.ci_high < 0));
  const clearlyAbove = rows.filter((r) => r.exit_gap.ci_low > 0);
  const more = rows.filter((r) => r.exit_gap.month_plus_gone_pct > r.exit_gap.shorter_gone_pct);
  const b = bcn.exit_gap;

  setText("gap-title", T.gap.title(more.length, rows.length, distinguishable.length ? list(distinguishable.map((r) => cityName(r.city))) : null));
  setText("gap-sub", T.gap.sub(monthYear(b.from), monthYear(b.to), pct(b.month_plus_gone_pct, 0), pct(b.shorter_gone_pct, 0), clearlyAbove.length, line));
  setText("gap-how", T.gap.how(decimal(b.ci_low), decimal(b.ci_high)));
  setLegend("gap-legend", [
    [T.gap.shorter(line), COLOURS.under_31],
    [T.gap.monthPlus(line), COLOURS.over_31],
  ]);

  const root = document.getElementById("gap-chart") as HTMLElement;
  const KEY = "gap";
  return () => {
    const W = widthOf(root);
    const narrow = isNarrow();
    const H = chartHeight(W, 300, 380, 0.3);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      T.gap.aria(rows.map((r) => `${cityName(r.city)} ${pct(r.exit_gap.month_plus_gone_pct, 0)} / ${pct(r.exit_gap.shorter_gone_pct, 0)}`).join("; ")),
    );
    const labelW = narrow ? 76 : 120;
    const apartW = narrow ? 40 : 96;
    const hi = d3.max(rows, (r) => r.exit_gap.month_plus_gone_pct) ?? 50;
    // headroom right of the largest dot for its value label
    const x = d3.scaleLinear().domain([0, hi * (narrow ? 1.25 : 1.12)]).range([inset + labelW, W - inset - apartW]);
    const y = d3.scaleBand<string>().domain(rows.map((r) => r.city)).range([28, H - 28]).padding(0.25);

    svg.append("text").attr("x", inset + labelW).attr("y", 12).text(T.gap.axis);
    for (const t of x.ticks(narrow ? 3 : 5)) {
      svg.append("line").attr("class", t === 0 ? "axisline" : "gridline").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 22).attr("y2", H - 24);
      svg.append("text").attr("x", x(t)).attr("y", H - 6).attr("text-anchor", "middle").text(pct(t, 0));
    }

    const waiting = isWaiting(KEY);
    rows.forEach((r, i) => {
      const e = r.exit_gap;
      const cy = (y(r.city) ?? 0) + y.bandwidth() / 2;
      const isBcn = r.city === "barcelona";
      const xs = x(e.shorter_gone_pct);
      const xm = x(e.month_plus_gone_pct);
      if (isBcn) {
        svg.append("rect").attr("x", inset).attr("width", Math.max(0, W - 2 * inset)).attr("y", y(r.city) ?? 0).attr("height", y.bandwidth()).attr("fill", "#ece7dc");
      }
      svg.append("text").attr("x", inset + 6).attr("y", cy + 4).attr("class", isBcn ? "lab-strong" : "lab").text(cityName(r.city));
      const bar = svg
        .append("line")
        .attr("y1", cy)
        .attr("y2", cy)
        .attr("x1", xs)
        .attr("x2", waiting ? xs : xm)
        .attr("stroke", COLOURS.ink)
        .attr("stroke-width", 2)
        .attr("opacity", 0.35);
      svg.append("circle").attr("cy", cy).attr("cx", xs).attr("r", isBcn ? 8 : 6.5).attr("fill", COLOURS.under_31).attr("stroke", COLOURS.page).attr("stroke-width", 2);
      const dot = svg
        .append("circle")
        .attr("cy", cy)
        .attr("cx", waiting ? xs : xm)
        .attr("r", isBcn ? 8 : 6.5)
        .attr("fill", COLOURS.over_31)
        .attr("stroke", COLOURS.page)
        .attr("stroke-width", 2);
      const values = svg.append("g").attr("opacity", waiting ? 0 : 1);
      values.append("text").attr("class", "lab hl").attr("x", xs - 12).attr("y", cy + 4).attr("text-anchor", "end").text(pct(e.shorter_gone_pct, 0));
      values.append("text").attr("class", "lab-strong hl").attr("x", xm + 12).attr("y", cy + 4).text(pct(e.month_plus_gone_pct, 0));
      values
        .append("text")
        .attr("class", isBcn ? "lab-strong" : "lab")
        .attr("x", W - inset - 6)
        .attr("y", cy + 4)
        .attr("text-anchor", "end")
        .text(narrow ? signed(Math.round(e.points)) : T.gap.apart(signed(Math.round(e.points))));
      const hit = svg
        .append("rect")
        .datum(r)
        .attr("x", inset)
        .attr("width", Math.max(0, W - 2 * inset))
        .attr("y", y(r.city) ?? 0)
        .attr("height", y.bandwidth())
        .attr("fill", "transparent");
      withTip(hit, (row) => {
        const g = row.exit_gap;
        const contrast = g.vs_barcelona ? T.gap.contrast(cityName(row.city), signed(g.vs_barcelona.difference_points), decimal(g.vs_barcelona.ci_low), decimal(g.vs_barcelona.ci_high)) : "";
        return T.gap.tip(
          cityName(row.city),
          pct(g.month_plus_gone_pct),
          formatInt(g.month_plus_listings),
          pct(g.shorter_gone_pct),
          formatInt(g.shorter_listings),
          signed(g.points),
          decimal(g.ci_low),
          decimal(g.ci_high),
          contrast,
        );
      });
      if (waiting) {
        revealOnView(`${KEY}-${r.city}`, root, () => {
          const t = d3.transition().duration(MOTION_MS * 0.8).delay(i * 90).ease(d3.easeCubicOut);
          bar.transition(t).attr("x2", xm);
          dot.transition(t).attr("cx", xm);
          values.transition().delay(MOTION_MS * 0.8 + i * 90).duration(300).attr("opacity", 1);
        });
      }
    });
    if (waiting) revealOnView(KEY, root, () => undefined);
  };
}
