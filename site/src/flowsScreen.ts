// Screens: where December's listings went (a two-column flow diagram), and
// whether Barcelona's month-plus exits stand out against the other cities.
import * as d3 from "d3";

import { BANDS, CITIES, CITY_LABELS, type Band, type CityRow, type TransitionTable, type Transitions } from "./data";
import {
  COLOURS,
  formatInt,
  freshSvg,
  heightOf,
  hideTip,
  insetOf,
  isWaiting,
  monthYear,
  MOTION_MS,
  pct,
  revealOnView,
  setLegend,
  setText,
  share,
  showTip,
  widthOf,
} from "./story";

const OUTCOME_LABEL: Record<string, string> = {
  under_31: "Under 31",
  exactly_31: "Exactly 31",
  over_31: "Over 31",
  inactive: "Listed, no open dates",
  gone: "Absent from the scrape",
};
const SHORT_OUTCOME: Record<string, string> = { inactive: "No open dates", gone: "Absent" };
const OUTCOME_COLOUR: Record<string, string> = {
  ...COLOURS,
  inactive: COLOURS.other,
  gone: COLOURS.pink,
};

function bandLabel(band: Band, line: number): string {
  return band === "under_31" ? `Under ${line} nights` : band === "exactly_31" ? `Exactly ${line}` : `Over ${line}`;
}

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

export function initFlowsScreen(transitions: Transitions, line: number): () => void {
  const table: TransitionTable = transitions.cities.barcelona;
  const rowTotal = (band: Band) => d3.sum(table.counts[table.from.indexOf(band)] ?? []);
  const cell = (band: Band, to: string) => table.counts[table.from.indexOf(band)]?.[table.to.indexOf(to)] ?? 0;
  const monthPlusBands: Band[] = ["exactly_31", "over_31"];
  const monthPlus = d3.sum(monthPlusBands, rowTotal);
  const monthPlusGone = d3.sum(monthPlusBands, (b) => cell(b, "gone"));
  const shorterGone = cell("under_31", "gone");
  const shorter = rowTotal("under_31");
  const from = monthYear(table.from_snapshot);
  const to = monthYear(table.to_snapshot);

  setText(
    "flows-title",
    `Of ${from}'s ${formatInt(monthPlus)} month-plus listings, ${pct(share(monthPlusGone, monthPlus), 0)} were absent from the ${to} scrape. Of the shorter stays, ${pct(share(shorterGone, shorter), 0)}.`,
  );
  setText(
    "flows-sub",
    `Inside Airbnb keeps a listing's id across snapshots, so each Barcelona listing with open dates in ${from} can be followed to ${to}: same minimum-stay group, another group, still listed without open dates, or absent from the later scrape. ` +
      `Catalonia extended its rent limit to seasonal lets on 1 January 2026, in between.`,
  );
  setText(
    "flows-how",
    "Absent means withdrawn, re-listed under a new id, or missed by the scraper: the file cannot say which. " +
      "Listed without open dates can mean fully booked, blocked or paused. Listings that first appeared after the first snapshot are not in this diagram.",
  );
  setLegend(
    "flows-legend",
    ["under_31", "exactly_31", "over_31", "inactive", "gone"].map((k) => [
      k in COLOURS ? bandLabel(k as Band, line) : (OUTCOME_LABEL[k] ?? k),
      OUTCOME_COLOUR[k] ?? COLOURS.other,
    ]),
  );

  const root = document.getElementById("flows-chart") as HTMLElement;
  const KEY = "flows";
  return () => {
    const W = widthOf(root);
    const H = heightOf(root, 520);
    const inset = insetOf();
    const narrow = W < 640;
    const svg = freshSvg(
      root,
      W,
      H,
      `Flow diagram, Barcelona ${from} to ${to}: ${formatInt(monthPlusGone)} of ${formatInt(monthPlus)} month-plus listings and ${formatInt(shorterGone)} of ${formatInt(shorter)} shorter-stay listings were absent from the later scrape.`,
    );

    const nodeW = 12;
    const pad = narrow ? 8 : 12;
    const top = 22;
    const bottom = 8;
    const leftX = inset + (narrow ? 0 : 150);
    const rightX = W - inset - nodeW - (narrow ? 118 : 190);
    const total = d3.sum(BANDS, rowTotal);

    const layout = (keys: string[], value: (k: string) => number, colour: (k: string) => string, label: (k: string) => string): FlowNode[] => {
      const room = H - top - bottom - pad * (keys.length - 1);
      const k = room / total;
      let y = top;
      return keys.map((key) => {
        const v = value(key);
        const node = { key, label: label(key), value: v, y0: y, y1: y + v * k, colour: colour(key) };
        y += v * k + pad;
        return node;
      });
    };
    const left = layout(BANDS as unknown as string[], (k) => rowTotal(k as Band), (k) => COLOURS[k as Band], (k) => bandLabel(k as Band, line));
    const right = layout(
      table.to,
      (k) => d3.sum(BANDS, (b) => cell(b, k)),
      (k) => OUTCOME_COLOUR[k] ?? COLOURS.other,
      (k) => (k in COLOURS ? (narrow ? (OUTCOME_LABEL[k] ?? k) : bandLabel(k as Band, line)) : narrow ? (SHORT_OUTCOME[k] ?? k) : (OUTCOME_LABEL[k] ?? k)),
    );
    const scale = (H - top - bottom - pad * (BANDS.length - 1)) / total;

    // links: stacked in order within each node
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

    svg
      .append("text")
      .attr("x", leftX)
      .attr("y", 12)
      .attr("class", "lab")
      .text(from);
    svg
      .append("text")
      .attr("x", rightX + nodeW)
      .attr("y", 12)
      .attr("text-anchor", "end")
      .attr("class", "lab")
      .text(to);

    const waiting = isWaiting(KEY);
    const g = svg.append("g");
    const clipRect = svg
      .append("clipPath")
      .attr("id", "flows-clip")
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("height", H)
      .attr("width", waiting ? x0 : W);
    g.attr("clip-path", "url(#flows-clip)");

    const linkSel = g
      .selectAll<SVGPathElement, FlowLink>("path")
      .data(links)
      .join("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", (l) => COLOURS[l.from])
      .attr("stroke-opacity", (l) => (l.to === "gone" ? 0.55 : 0.28))
      .attr("stroke-width", (l) => Math.max(1, l.width))
      .on("pointermove", (event: PointerEvent, l) => {
        linkSel.attr("stroke-opacity", (o) => (o === l ? 0.75 : 0.08));
        showTip(
          event,
          `<b>${bandLabel(l.from, line)} → ${OUTCOME_LABEL[l.to]?.toLowerCase()}</b>${formatInt(l.value)} listings, ${pct(share(l.value, rowTotal(l.from)))} of the ${bandLabel(l.from, line).toLowerCase()} group in ${from}`,
        );
      })
      .on("pointerleave", () => {
        linkSel.attr("stroke-opacity", (l) => (l.to === "gone" ? 0.55 : 0.28));
        hideTip();
      });

    const drawNodes = (nodes: FlowNode[], x: number, side: "left" | "right", denominators: boolean) => {
      for (const n of nodes) {
        svg
          .append("rect")
          .attr("x", x)
          .attr("y", n.y0)
          .attr("width", nodeW)
          .attr("height", Math.max(1, n.y1 - n.y0))
          .attr("rx", 2)
          .attr("fill", n.colour);
        const tx = side === "left" ? x - 8 : x + nodeW + 8;
        const ty = (n.y0 + n.y1) / 2;
        const text = svg
          .append("text")
          .attr("x", narrow && side === "left" ? x + nodeW + 6 : tx)
          .attr("y", ty - (narrow ? 0 : 2))
          .attr("text-anchor", side === "left" && !narrow ? "end" : "start")
          .attr("class", "lab-strong hl");
        if (narrow && side === "left") {
          text.text(formatInt(n.value));
          continue;
        }
        text.append("tspan").text(n.label);
        text
          .append("tspan")
          .attr("x", narrow && side === "left" ? x + nodeW + 6 : tx)
          .attr("dy", 16)
          .attr("class", "lab")
          .style("font-weight", "400")
          .text(denominators ? `${formatInt(n.value)} (${pct(share(n.value, total), 0)})` : formatInt(n.value));
      }
    };
    drawNodes(left, leftX, "left", false);
    drawNodes(right, rightX, "right", true);

    if (waiting) {
      revealOnView(KEY, root, () => {
        clipRect.transition().duration(MOTION_MS).ease(d3.easeCubicInOut).attr("width", W);
      });
    }
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
    distinguishable.length === 0
      ? `Barcelona's ${Math.round(bcn.exit_gap.points)}-point exit gap cannot be told apart from the four other cities'.`
      : `Barcelona's exit gap differs clearly from ${distinguishable.map((r) => CITY_LABELS[r.city]).join(", ")}.`,
  );
  setText(
    "gap-sub",
    "The exit gap is the share of month-plus listings absent from the later scrape minus the share of shorter-stay listings absent. " +
      `Of the five cities, only Barcelona is under the Catalan seasonal-let rule. The gap is clearly above zero in ${clearlyAbove.length} of 5 cities, ` +
      `and ${larger.length === 0 ? "no other city" : larger.map((r) => CITY_LABELS[r.city]).join(" and ")} ${larger.length === 1 ? "has" : "have"} a larger point estimate.`,
  );
  setText(
    "gap-how",
    "Lines are 95% intervals from resampling whole host accounts, because one operator can withdraw many listings at once; resampling listings would understate the uncertainty. " +
      "A city is called different from Barcelona only when the interval of the difference (Barcelona minus that city) excludes zero. The other cities have only two snapshots, about nine months apart.",
  );
  setLegend("gap-legend", [
    ["Barcelona", COLOURS.ink],
    ["Other cities", COLOURS.muted],
  ]);

  const root = document.getElementById("gap-chart") as HTMLElement;
  const KEY = "gap";
  return () => {
    const W = widthOf(root);
    const H = heightOf(root, 360);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      "Dot chart with 95% intervals, exit gap in percentage points: " +
        rows.map((r) => `${CITY_LABELS[r.city]} ${r.exit_gap.points} (${r.exit_gap.ci_low} to ${r.exit_gap.ci_high})`).join("; "),
    );
    const labelW = W < 640 ? 84 : 130;
    const lo = Math.min(0, d3.min(rows, (r) => r.exit_gap.ci_low) ?? 0);
    const hi = d3.max(rows, (r) => r.exit_gap.ci_high) ?? 40;
    const x = d3
      .scaleLinear()
      .domain([lo - 2, hi + 2])
      .nice()
      .range([inset + labelW, W - inset - 10]);
    const y = d3
      .scaleBand<string>()
      .domain(rows.map((r) => r.city))
      .range([14, H - 34])
      .padding(0.3);

    for (const t of x.ticks(W < 640 ? 4 : 8)) {
      svg.append("line").attr("class", t === 0 ? "axisline" : "gridline").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 6).attr("y2", H - 30);
      svg
        .append("text")
        .attr("x", x(t))
        .attr("y", H - 12)
        .attr("text-anchor", "middle")
        .text(t === 0 ? (W < 640 ? "0" : "0 = no gap") : `${t > 0 ? "+" : ""}${t}`);
    }
    svg
      .append("text")
      .attr("x", W - inset)
      .attr("y", 2)
      .attr("text-anchor", "end")
      .text("percentage points, month-plus minus shorter stays →");

    const waiting = isWaiting(KEY);
    const zero = x(0);
    rows.forEach((r, i) => {
      const cy = (y(r.city) ?? 0) + y.bandwidth() / 2;
      const isBcn = r.city === "barcelona";
      const colour = isBcn ? COLOURS.ink : COLOURS.muted;
      svg
        .append("text")
        .attr("x", inset)
        .attr("y", cy + 4)
        .attr("class", isBcn ? "lab-strong" : "lab")
        .text(CITY_LABELS[r.city]);
      const g = svg.append("g").attr("class", "gap-row");
      const ci = g
        .append("line")
        .attr("y1", cy)
        .attr("y2", cy)
        .attr("x1", waiting ? zero : x(r.exit_gap.ci_low))
        .attr("x2", waiting ? zero : x(r.exit_gap.ci_high))
        .attr("stroke", colour)
        .attr("stroke-width", isBcn ? 4 : 3)
        .attr("stroke-linecap", "round")
        .attr("opacity", 0.55);
      const dot = g
        .append("circle")
        .attr("cy", cy)
        .attr("cx", waiting ? zero : x(r.exit_gap.points))
        .attr("r", isBcn ? 9 : 7)
        .attr("fill", colour)
        .attr("stroke", COLOURS.page)
        .attr("stroke-width", 2);
      const value = g
        .append("text")
        .attr("class", "lab-strong hl")
        .attr("x", x(r.exit_gap.points))
        .attr("y", cy - 14)
        .attr("text-anchor", "middle")
        .attr("opacity", waiting ? 0 : 1)
        .text(`${r.exit_gap.points > 0 ? "+" : ""}${r.exit_gap.points}`);
      g.append("rect")
        .attr("x", inset)
        .attr("width", W - 2 * inset)
        .attr("y", y(r.city) ?? 0)
        .attr("height", y.bandwidth())
        .attr("fill", "transparent")
        .on("pointermove", (event: PointerEvent) => {
          const e = r.exit_gap;
          const contrast = e.vs_barcelona
            ? `<br>Barcelona minus ${CITY_LABELS[r.city]}: ${e.vs_barcelona.difference_points > 0 ? "+" : ""}${e.vs_barcelona.difference_points} (${e.vs_barcelona.ci_low} to ${e.vs_barcelona.ci_high})`
            : "";
          showTip(
            event,
            `<b>${CITY_LABELS[r.city]}: ${e.points > 0 ? "+" : ""}${e.points} points</b>95% interval ${e.ci_low} to ${e.ci_high}<br>` +
              `${formatInt(e.month_plus_listings)} month-plus and ${formatInt(e.shorter_listings)} shorter-stay listings, ${formatInt(e.accounts)} host accounts<br>` +
              `The 10 largest accounts hold ${e.top10_accounts_share_of_month_plus_pct}% of the month-plus listings${contrast}`,
          );
        })
        .on("pointerleave", hideTip);
      if (waiting) {
        revealOnView(`${KEY}-${r.city}`, root, () => {
          const t = d3.transition().duration(MOTION_MS * 0.8).delay(i * 90).ease(d3.easeCubicOut);
          ci.transition(t).attr("x1", x(r.exit_gap.ci_low)).attr("x2", x(r.exit_gap.ci_high));
          dot.transition(t).attr("cx", x(r.exit_gap.points));
          value.transition().delay(MOTION_MS * 0.8 + i * 90).duration(300).attr("opacity", 1);
        });
      }
    });
    if (waiting) revealOnView(KEY, root, () => undefined);
  };
}
