// The tourist-flat register against Airbnb: per snapshot, the share of the
// register's licence numbers shown on at least one listing with open dates.
import * as d3 from "d3";

import type { PolicyLever, Register } from "./data";
import { registerQuarter, T } from "./i18n";
import { chartHeight, COLOURS, dayMonthYear, formatInt, freshSvg, insetOf, isWaiting, monthYear, MOTION_MS, pct, revealOnView, setText, widthOf, withTip } from "./story";

const DAY_MS = 86_400_000;

/** Whole calendar days from the reader's local today, so the count does not jump at UTC midnight. */
export function daysUntil(iso: string): number {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - today) / DAY_MS);
}

export function initRegisterScreen(register: Register, phaseOut: PolicyLever | undefined): () => void {
  const latest = register.match.at(-1);
  if (!latest) throw new Error("No register match");
  const totals = Object.entries(register.totals).sort(([a], [b]) => a.localeCompare(b));
  const first = totals[0];
  const last = totals.at(-1);
  const deadline = phaseOut?.deadline ?? null;
  const days = deadline ? daysUntil(deadline) : null;

  setText("register-title", T.register.title(pct(latest.register_numbers_displayed_pct, 0), formatInt(latest.register_numbers)));
  setText(
    "register-sub",
    T.register.sub(
      formatInt(first?.[1] ?? 0),
      registerQuarter(first?.[0] ?? ""),
      formatInt(last?.[1] ?? 0),
      registerQuarter(last?.[0] ?? ""),
      formatInt(latest.register_numbers),
      deadline ? dayMonthYear(deadline) : null,
      days !== null && days > 0 ? formatInt(days) : null,
    ),
  );
  setText("register-how", T.register.how(registerQuarter(latest.register_quarter), monthYear(latest.snapshot), pct(latest.displayed_found_pct)));
  document.getElementById("register-ramp")?.replaceChildren();

  const root = document.getElementById("register-chart") as HTMLElement;
  const KEY = "register";
  const rows = register.match;
  return () => {
    const W = widthOf(root);
    const H = chartHeight(W, 280, 360, 0.3);
    const inset = insetOf();
    const svg = freshSvg(root, W, H, T.register.aria(rows.map((r) => `${monthYear(r.snapshot)} ${pct(r.register_numbers_displayed_pct)}`).join(", ")));
    const x = d3.scaleBand<string>().domain(rows.map((r) => r.snapshot)).range([inset + 40, W - inset]).padding(0.38);
    const y = d3.scaleLinear().domain([0, 100]).range([H - 44, 12]);
    for (const t of [25, 50, 75, 100]) {
      svg.append("line").attr("class", "gridline").attr("x1", inset + 40).attr("x2", W - inset).attr("y1", y(t)).attr("y2", y(t));
      svg.append("text").attr("x", inset).attr("y", y(t) + 4).text(pct(t, 0));
    }
    svg.append("line").attr("class", "axisline").attr("x1", inset + 40).attr("x2", W - inset).attr("y1", y(0)).attr("y2", y(0));
    const waiting = isWaiting(KEY);
    const g = svg.append("g");
    // the whole register as a pale bar, the share shown on Airbnb in green on top
    g.selectAll("rect.all")
      .data(rows)
      .join("rect")
      .attr("x", (r) => x(r.snapshot) ?? 0)
      .attr("width", x.bandwidth())
      .attr("y", y(100))
      .attr("height", y(0) - y(100))
      .attr("fill", COLOURS.none);
    const bars = g
      .selectAll<SVGRectElement, (typeof rows)[number]>("rect.shown")
      .data(rows)
      .join("rect")
      .attr("class", "shown")
      .attr("x", (r) => x(r.snapshot) ?? 0)
      .attr("width", x.bandwidth())
      .attr("y", (r) => (waiting ? y(0) : y(r.register_numbers_displayed_pct)))
      .attr("height", (r) => (waiting ? 0 : y(0) - y(r.register_numbers_displayed_pct)))
      .attr("fill", COLOURS.green);
    const labels = g
      .selectAll("text.val")
      .data(rows)
      .join("text")
      .attr("class", "on-fill val")
      .attr("x", (r) => (x(r.snapshot) ?? 0) + x.bandwidth() / 2)
      .attr("y", (r) => y(r.register_numbers_displayed_pct) + 20)
      .attr("text-anchor", "middle")
      .attr("opacity", waiting ? 0 : 1)
      .text((r) => pct(r.register_numbers_displayed_pct, 0));
    for (const r of rows) {
      const cx = (x(r.snapshot) ?? 0) + x.bandwidth() / 2;
      svg.append("text").attr("class", "lab-strong").attr("x", cx).attr("y", H - 24).attr("text-anchor", "middle").text(monthYear(r.snapshot));
      svg.append("text").attr("x", cx).attr("y", H - 8).attr("text-anchor", "middle").text(T.register.vs(registerQuarter(r.register_quarter)));
    }
    withTip(bars, (r) =>
      T.register.tip(monthYear(r.snapshot), formatInt(r.displayed_numbers_found_in_register), formatInt(r.register_numbers), registerQuarter(r.register_quarter), pct(r.register_numbers_displayed_pct)),
    );
    if (waiting) {
      revealOnView(KEY, root, () => {
        bars.transition().duration(MOTION_MS).delay((_, i) => i * 100).ease(d3.easeCubicOut).attr("y", (r) => y(r.register_numbers_displayed_pct)).attr("height", (r) => y(0) - y(r.register_numbers_displayed_pct));
        labels.transition().delay(MOTION_MS + 300).duration(300).attr("opacity", 1);
      });
    }
  };
}
