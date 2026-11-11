// Screen: what Barcelona listings show in Airbnb's licence field, per quarter.
import * as d3 from "d3";

import type { BarcelonaTrend } from "./data";
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

// Display groups, in stacking order. Codes from the export fold into them.
const GROUPS = [
  { key: "tourist_flat", label: "Tourist-flat licence (HUT)", colour: COLOURS.green, codes: ["tourist_flat"] },
  { key: "hotel", label: "Hotel or hostel", colour: COLOURS.violet, codes: ["hotel_or_hostel"] },
  { key: "exempt_seasonal", label: "“Exempt: seasonal rental”", colour: COLOURS.pink, codes: ["exempt_seasonal"] },
  { key: "other", label: "Other exemption or code", colour: "#8a867c", codes: ["exempt_other", "other_code", "other"] },
  { key: "missing", label: "Nothing shown", colour: "#3a3936", codes: ["missing"] },
] as const;

export function initLicences(trends: BarcelonaTrend[]): () => void {
  const rows = trends.map((t) => {
    const total = d3.sum(Object.values(t.regional_licence));
    return {
      snapshot: t.snapshot,
      total,
      parts: GROUPS.map((g) => ({ ...g, value: d3.sum(g.codes, (c) => t.regional_licence[c] ?? 0) })),
    };
  });
  const seasonal = (r: (typeof rows)[number]) => r.parts.find((p) => p.key === "exempt_seasonal")?.value ?? 0;
  const firstWith = rows.find((r) => seasonal(r) > 0);
  const latest = rows.at(-1);
  const before = firstWith ? rows[rows.indexOf(firstWith) - 1] : undefined;
  if (!latest || !firstWith) throw new Error("No licence rows");

  setText(
    "licences-title",
    `A new answer appeared in ${monthYear(firstWith.snapshot)}: by ${monthYear(latest.snapshot)}, ${pct(share(seasonal(latest), latest.total), 0)} of listings said “exempt: seasonal rental”.`,
  );
  setText(
    "licences-sub",
    "Airbnb asks Barcelona hosts for a licence number. Each bar splits one quarter's listings with open dates by what that field shows. " +
      `${before ? `The option was not in the ${monthYear(before.snapshot)} data, so its rise is partly a change in Airbnb's form, not only in hosts.` : ""}`,
  );
  setText(
    "licences-how",
    "The field is filled in by hosts and is not checked against any register here; the next screen does that for tourist-flat numbers. " +
      "A missing or unmatched number is not proof that a listing breaks a rule, and seasonal lets need no tourist licence.",
  );
  setLegend("licences-legend", GROUPS.map((g) => [g.label, g.colour]));

  const root = document.getElementById("licences-chart") as HTMLElement;
  const KEY = "licences";
  return () => {
    const W = widthOf(root);
    const H = heightOf(root, 360);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      "Stacked bars per quarter of what Barcelona listings show in the licence field: " +
        rows.map((r) => `${monthYear(r.snapshot)}: ${r.parts.map((p) => `${p.label} ${pct(share(p.value, r.total), 0)}`).join(", ")}`).join("; "),
    );
    const labelH = 20;
    const y = d3
      .scaleBand<string>()
      .domain(rows.map((r) => r.snapshot))
      .range([0, H])
      .paddingInner(0.28);
    const barH = Math.max(24, y.bandwidth() - labelH);
    const waiting = isWaiting(KEY);

    for (const r of rows) {
      const top = y(r.snapshot) ?? 0;
      svg
        .append("text")
        .attr("x", inset)
        .attr("y", top + 14)
        .attr("class", "lab-strong")
        .text(`${monthYear(r.snapshot)} · ${formatInt(r.total)} listings`);
      const x = d3.scaleLinear().domain([0, r.total]).range([0, W]);
      let cursor = 0;
      const g = svg.append("g").attr("class", "seg-row");
      for (const p of r.parts) {
        if (!p.value) continue;
        const x0 = x(cursor);
        const w = Math.max(0, x(cursor + p.value) - x0 - 2);
        cursor += p.value;
        g.append("rect")
          .attr("x", x0)
          .attr("y", top + labelH)
          .attr("width", w)
          .attr("height", barH)
          .attr("fill", p.colour)
          .on("pointermove", (event: PointerEvent) =>
            showTip(event, `<b>${p.label}</b>${formatInt(p.value)} of ${formatInt(r.total)} listings (${pct(share(p.value, r.total))}), ${monthYear(r.snapshot)}`),
          )
          .on("pointerleave", hideTip);
        const text = `${pct(share(p.value, r.total), 0)}`;
        if (w >= 52) {
          g.append("text")
            .attr("class", p.key === "missing" || p.key === "other" ? "lab-strong" : "on-fill")
            .attr("x", x0 + (x0 < 1 ? inset : 10))
            .attr("y", top + labelH + barH / 2 + 5)
            .text(text);
        }
      }
      const clip = svg
        .append("clipPath")
        .attr("id", `lic-clip-${r.snapshot}`)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", H)
        .attr("width", waiting ? 0 : W);
      g.attr("clip-path", `url(#lic-clip-${r.snapshot})`);
      if (waiting) {
        const i = rows.indexOf(r);
        revealOnView(`${KEY}-${r.snapshot}`, root, () =>
          clip.transition().delay(i * 120).duration(MOTION_MS).ease(d3.easeCubicInOut).attr("width", W),
        );
      }
    }
    if (waiting) revealOnView(KEY, root, () => undefined);
  };
}
