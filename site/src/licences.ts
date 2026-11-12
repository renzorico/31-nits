// What Barcelona listings show in Airbnb's licence field, per quarter.
import * as d3 from "d3";

import type { BarcelonaTrend } from "./data";
import { T } from "./i18n";
import { chartHeight, COLOURS, formatInt, freshSvg, insetOf, isWaiting, monthYear, MOTION_MS, pct, revealOnView, setLegend, setText, share, widthOf, withTip } from "./story";

// Display groups, in stacking order; `dark` = use dark label text on this fill.
const GROUPS = [
  { key: "tourist_flat", colour: COLOURS.green, dark: false, codes: ["tourist_flat"] },
  { key: "hotel", colour: "#b9b1e8", dark: true, codes: ["hotel_or_hostel"] },
  { key: "exempt_seasonal", colour: COLOURS.pink, dark: false, codes: ["exempt_seasonal"] },
  { key: "other", colour: "#bdb7aa", dark: true, codes: ["exempt_other", "other_code", "other"] },
  { key: "missing", colour: COLOURS.none, dark: true, codes: ["missing"] },
] as const;

export function initLicences(trends: BarcelonaTrend[]): () => void {
  const rows = trends.map((t) => {
    const total = d3.sum(Object.values(t.regional_licence));
    return { snapshot: t.snapshot, total, parts: GROUPS.map((g) => ({ ...g, value: d3.sum(g.codes, (c) => t.regional_licence[c] ?? 0) })) };
  });
  const part = (r: (typeof rows)[number], key: string) => r.parts.find((p) => p.key === key)?.value ?? 0;
  const first = rows[0];
  const latest = rows.at(-1);
  const firstSeasonal = rows.find((r) => part(r, "exempt_seasonal") > 0);
  if (!first || !latest || !firstSeasonal) throw new Error("No licence rows");
  const before = rows[rows.indexOf(firstSeasonal) - 1];

  setText(
    "licences-title",
    T.licences.title(
      pct(share(part(first, "missing"), first.total), 0),
      monthYear(first.snapshot),
      pct(share(part(latest, "missing"), latest.total), 0),
      monthYear(latest.snapshot),
      pct(share(part(latest, "exempt_seasonal"), latest.total), 0),
    ),
  );
  setText("licences-sub", T.licences.sub(monthYear(firstSeasonal.snapshot), before ? monthYear(before.snapshot) : null));
  setText("licences-how", T.licences.how);
  setLegend("licences-legend", GROUPS.map((g) => [T.licences.groups[g.key], g.colour]));

  const root = document.getElementById("licences-chart") as HTMLElement;
  const KEY = "licences";
  return () => {
    const W = widthOf(root);
    const H = chartHeight(W, 300, 380, 0.3);
    const inset = insetOf();
    const svg = freshSvg(root, W, H, T.licences.aria);
    const labelH = 22;
    const y = d3.scaleBand<string>().domain(rows.map((r) => r.snapshot)).range([0, H]).paddingInner(0.25);
    const barH = Math.max(24, y.bandwidth() - labelH);
    const waiting = isWaiting(KEY);

    rows.forEach((r, i) => {
      const top = y(r.snapshot) ?? 0;
      svg.append("text").attr("x", inset).attr("y", top + 15).attr("class", "lab-strong").text(T.licences.row(monthYear(r.snapshot), formatInt(r.total)));
      const x = d3.scaleLinear().domain([0, r.total]).range([inset, W - inset]);
      let cursor = 0;
      const g = svg.append("g").attr("clip-path", `url(#lic-clip-${i})`);
      for (const p of r.parts) {
        if (!p.value) continue;
        const x0 = x(cursor);
        const w = Math.max(0, x(cursor + p.value) - x0 - 2);
        cursor += p.value;
        const rect = g.append("rect").datum(p).attr("x", x0).attr("y", top + labelH).attr("width", w).attr("height", barH).attr("fill", p.colour);
        withTip(rect, (d) => T.licences.tip(T.licences.groups[d.key], formatInt(d.value), formatInt(r.total), pct(share(d.value, r.total)), monthYear(r.snapshot)));
        if (w >= 44) {
          g.append("text")
            .attr("class", p.dark ? "on-fill dark" : "on-fill")
            .attr("x", x0 + 8)
            .attr("y", top + labelH + barH / 2 + 5)
            .attr("pointer-events", "none")
            .text(pct(share(p.value, r.total), 0));
        }
      }
      const clip = svg.append("clipPath").attr("id", `lic-clip-${i}`).append("rect").attr("height", H).attr("width", waiting ? 0 : W);
      if (waiting) revealOnView(`${KEY}-${i}`, root, () => clip.transition().delay(i * 120).duration(MOTION_MS).ease(d3.easeCubicInOut).attr("width", W));
    });
    if (waiting) revealOnView(KEY, root, () => undefined);
  };
}
