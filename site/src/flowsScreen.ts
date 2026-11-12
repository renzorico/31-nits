// Where December's listings went (a two-column flow diagram, with only the
// two flows that carry the story in colour), and whether Barcelona's
// disappearances stand out against the other cities.
import * as d3 from "d3";

import { BANDS, CITIES, type Band, type CityRow, type TransitionTable, type Transitions } from "./data";
import { cityName, decimal, signed, T } from "./i18n";
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

export function initGapScreen(cities: CityRow[]): () => void {
  const rows = CITIES.map((c) => cities.find((r) => r.city === c)).filter((r): r is CityRow => r !== undefined);
  const bcn = rows.find((r) => r.city === "barcelona");
  if (!bcn) throw new Error("No Barcelona exit gap");
  const others = rows.filter((r) => r.city !== "barcelona");
  // The contrast intervals (Barcelona minus each city) are the test; overlapping separate intervals never are.
  const distinguishable = others.filter((r) => r.exit_gap.vs_barcelona && (r.exit_gap.vs_barcelona.ci_low > 0 || r.exit_gap.vs_barcelona.ci_high < 0));
  const clearlyAbove = rows.filter((r) => r.exit_gap.ci_low > 0);
  const larger = others.filter((r) => r.exit_gap.points > bcn.exit_gap.points);

  setText(
    "gap-title",
    distinguishable.length === 0 ? T.gap.titleSame(Math.round(bcn.exit_gap.points)) : T.gap.titleDiff(distinguishable.map((r) => cityName(r.city)).join(", ")),
  );
  setText("gap-sub", T.gap.sub(clearlyAbove.length, larger.map((r) => cityName(r.city))));
  setText("gap-how", T.gap.how);
  setLegend("gap-legend", [
    [T.gap.barcelona, COLOURS.ink],
    [T.gap.others, COLOURS.muted],
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
      T.gap.aria(rows.map((r) => `${cityName(r.city)} ${decimal(r.exit_gap.points)} (${decimal(r.exit_gap.ci_low)} – ${decimal(r.exit_gap.ci_high)})`).join("; ")),
    );
    const labelW = narrow ? 84 : 130;
    const lo = Math.min(0, d3.min(rows, (r) => r.exit_gap.ci_low) ?? 0);
    const hi = d3.max(rows, (r) => r.exit_gap.ci_high) ?? 40;
    const x = d3.scaleLinear().domain([lo - 2, hi + 2]).nice().range([inset + labelW, W - inset - 10]);
    const y = d3.scaleBand<string>().domain(rows.map((r) => r.city)).range([26, H - 30]).padding(0.3);

    svg.append("text").attr("x", W - inset).attr("y", 12).attr("text-anchor", "end").text(T.gap.axis);
    for (const t of x.ticks(narrow ? 4 : 8)) {
      svg.append("line").attr("class", t === 0 ? "axisline" : "gridline").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 20).attr("y2", H - 26);
      svg
        .append("text")
        .attr("x", x(t))
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(t === 0 ? (narrow ? "0" : T.gap.zero) : signed(t));
    }

    const waiting = isWaiting(KEY);
    const zero = x(0);
    rows.forEach((r, i) => {
      const e = r.exit_gap;
      const cy = (y(r.city) ?? 0) + y.bandwidth() / 2;
      const isBcn = r.city === "barcelona";
      const colour = isBcn ? COLOURS.ink : COLOURS.muted;
      svg.append("text").attr("x", inset).attr("y", cy + 4).attr("class", isBcn ? "lab-strong" : "lab").text(cityName(r.city));
      const ci = svg
        .append("line")
        .attr("y1", cy)
        .attr("y2", cy)
        .attr("x1", waiting ? zero : x(e.ci_low))
        .attr("x2", waiting ? zero : x(e.ci_high))
        .attr("stroke", colour)
        .attr("stroke-width", isBcn ? 4 : 3)
        .attr("stroke-linecap", "round")
        .attr("opacity", 0.45);
      const dot = svg
        .append("circle")
        .attr("cy", cy)
        .attr("cx", waiting ? zero : x(e.points))
        .attr("r", isBcn ? 9 : 7)
        .attr("fill", colour)
        .attr("stroke", COLOURS.page)
        .attr("stroke-width", 2);
      const value = svg
        .append("text")
        .attr("class", "lab-strong hl")
        .attr("x", x(e.points))
        .attr("y", cy - 14)
        .attr("text-anchor", "middle")
        .attr("opacity", waiting ? 0 : 1)
        .text(signed(e.points));
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
          signed(g.points),
          decimal(g.ci_low),
          decimal(g.ci_high),
          formatInt(g.month_plus_listings),
          formatInt(g.shorter_listings),
          formatInt(g.accounts),
          pct(g.top10_accounts_share_of_month_plus_pct),
          contrast,
        );
      });
      if (waiting) {
        revealOnView(`${KEY}-${r.city}`, root, () => {
          const t = d3.transition().duration(MOTION_MS * 0.8).delay(i * 90).ease(d3.easeCubicOut);
          ci.transition(t).attr("x1", x(e.ci_low)).attr("x2", x(e.ci_high));
          dot.transition(t).attr("cx", x(e.points));
          value.transition().delay(MOTION_MS * 0.8 + i * 90).duration(300).attr("opacity", 1);
        });
      }
    });
    if (waiting) revealOnView(KEY, root, () => undefined);
  };
}
