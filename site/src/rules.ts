// The rules on one timeline. Each event can be selected; its card says what
// the rule says, what this data shows and what it cannot show. Rule texts,
// laws and dates come from src/config.py via meta.json, in the reader's language.
import * as d3 from "d3";

import type { BarcelonaTrend, CityRow, Meta, Register, RentRow } from "./data";
import { cityName, leverText, list, quarterOf, signedPct, T } from "./i18n";
import { byId, COLOURS, dayMonthYear, formatInt, freshSvg, insetOf, isNarrow, monthYear, setText, widthOf } from "./story";

const START = Date.UTC(2023, 6, 1);
const END = Date.UTC(2029, 2, 1);

interface Inputs {
  meta: Meta;
  register: Register;
  rents: RentRow[];
  trends: BarcelonaTrend[];
  cities: CityRow[];
}

interface RuleEvent {
  id: string;
  date: string;
  label: string;
  short: string;
  title: string;
  law: string;
  says: string;
  shows: string;
  limits: string;
  status: string;
  sources: { label: string; url: string }[];
  kind: "rule" | "deadline" | "later";
  before?: boolean; // in force before the timeline starts
}

function dataShows(id: string, { meta, register, rents, trends, cities }: Inputs): string {
  switch (id) {
    case "tourist_licence_phase_out": {
      const totals = Object.values(register.totals);
      return totals.length ? T.rules.showsLicence(formatInt(Math.min(...totals)), formatInt(Math.max(...totals))) : "";
    }
    case "rent_cap": {
      const capStart = meta.policy_levers.rent_cap?.applies_from;
      if (!capStart) return "";
      const withChange = rents.filter((r): r is RentRow & { yoy_pct: number } => r.yoy_pct !== null);
      const before = withChange.filter((r) => r.quarter_start <= capStart).at(-1);
      const after = withChange.filter((r) => r.quarter_start > capStart);
      const lowest = after.reduce<(typeof after)[number] | undefined>((m, r) => (!m || r.yoy_pct < m.yoy_pct ? r : m), undefined);
      const latest = withChange.at(-1);
      if (!before || !lowest || !latest) return "";
      return T.rules.showsRent(
        signedPct(before.yoy_pct),
        quarterOf(before.quarter_start),
        signedPct(lowest.yoy_pct),
        quarterOf(lowest.quarter_start),
        signedPct(latest.yoy_pct),
        quarterOf(latest.quarter_start),
      );
    }
    case "seasonal_rentals": {
      const [a, b] = trends;
      const c = trends.at(-1);
      if (!a || !b || !c) return "";
      const clear = cities.filter((x) => x.exit_gap.ci_low > 0).map((x) => cityName(x.city));
      return T.rules.showsSeasonal(
        formatInt(a.bands.over_31),
        monthYear(a.snapshot),
        formatInt(b.bands.over_31),
        monthYear(b.snapshot),
        formatInt(c.bands.over_31),
        monthYear(c.snapshot),
        clear.length,
        list(clear),
      );
    }
    case "owners_vote_catalonia":
    case "owners_approval_spain":
      return T.rules.showsOwners;
    default:
      return "";
  }
}

function buildEvents(inputs: Inputs): RuleEvent[] {
  const { meta } = inputs;
  const events: RuleEvent[] = Object.entries(meta.policy_levers).map(([id, l]) => ({
    id,
    date: l.applies_from,
    label: leverText(l, "timeline_label"),
    short: leverText(l, "timeline_label"),
    title: leverText(l, "title"),
    law: `${l.law} · ${leverText(l, "jurisdiction")}`,
    says: [leverText(l, "rule"), ...leverText(l, "exceptions")].join(" "),
    shows: dataShows(id, inputs),
    limits: leverText(l, "data_limits"),
    status: `${leverText(l, "status")}${leverText(l, "notes") ? ` ${leverText(l, "notes")}` : ""} ${T.rules.checked(dayMonthYear(l.status_checked_on))}`,
    sources: l.sources,
    kind: "rule",
    before: Date.parse(`${l.applies_from}T00:00:00Z`) < START,
  }));
  const phaseOut = meta.policy_levers.tourist_licence_phase_out;
  if (phaseOut?.deadline) {
    events.push({
      id: "deadline",
      date: phaseOut.deadline,
      label: T.rules.deadlineLabel,
      short: T.rules.deadlineLabel,
      title: T.rules.deadlineTitle,
      law: phaseOut.law,
      says: leverText(phaseOut, "rule"),
      shows: dataShows("tourist_licence_phase_out", inputs),
      limits: leverText(phaseOut, "data_limits"),
      status: leverText(phaseOut, "notes"),
      sources: phaseOut.sources,
      kind: "deadline",
    });
  }
  for (const later of meta.post_observation_developments) {
    events.push({
      id: `later-${later.date}`,
      date: later.date,
      label: leverText(later, "label"),
      short: leverText(later, "short_label"),
      title: leverText(later, "title"),
      law: later.law,
      says: leverText(later, "summary"),
      shows: T.rules.laterShows,
      limits: leverText(later, "note"),
      status: "",
      sources: [{ label: "BOE", url: later.url }],
      kind: "later",
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function initRules(inputs: Inputs): () => void {
  const { meta } = inputs;
  const events = buildEvents(inputs);
  const [obsStart, obsEnd] = meta.observation_window;
  const deadline = events.find((e) => e.kind === "deadline");
  let selected = events.find((e) => e.id === "seasonal_rentals")?.id ?? events[0]?.id ?? "";

  setText("rules-title", T.rules.title(events.filter((e) => e.kind === "rule").length, deadline ? Number(deadline.date.slice(0, 4)) : 2028));
  setText("rules-sub", T.rules.sub(dayMonthYear(meta.levers_as_of), monthYear(obsStart), monthYear(obsEnd)));

  const detail = byId("rule-detail");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const renderDetail = () => {
    const e = events.find((ev) => ev.id === selected);
    if (!e) return;
    detail.innerHTML =
      `<h3>${esc(e.title)}<small>${esc(e.law)} · ${T.rules.from(dayMonthYear(e.date))}</small></h3>` +
      `<dl><dt>${T.rules.says}</dt><dd>${esc(e.says)}</dd></dl>` +
      `<dl><dt>${T.rules.shows}</dt><dd>${esc(e.shows)}</dd></dl>` +
      `<dl><dt>${T.rules.cannot}</dt><dd>${esc(e.limits)}</dd></dl>` +
      `<p class="status">${esc(e.status)} ${e.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(" · ")}</p>`;
  };
  renderDetail();

  const root = byId("rules-chart");
  const draw = () => {
    const W = widthOf(root);
    const narrow = isNarrow();
    const H = narrow ? 330 : 260;
    const inset = insetOf();
    const svg = freshSvg(root, W, H, T.rules.aria(events.map((e) => `${e.label} ${dayMonthYear(e.date)}`).join("; ")));
    const x = d3.scaleUtc().domain([new Date(START), new Date(END)]).range([inset + (narrow ? 8 : 20), W - inset - 8]);
    const axisY = H - 30;
    const xs = x(new Date(`${obsStart}T00:00:00Z`));
    const xe = x(new Date(`${obsEnd}T00:00:00Z`));

    svg.append("rect").attr("x", xs).attr("width", xe - xs).attr("y", 4).attr("height", axisY - 4).attr("fill", "#ece7dc");
    svg.append("text").attr("x", xs + 6).attr("y", 18).attr("class", "lab").text(narrow ? T.rules.snapshotsNarrow : T.rules.snapshots);
    svg.append("line").attr("class", "axisline").attr("x1", inset).attr("x2", W - inset).attr("y1", axisY).attr("y2", axisY);
    for (let year = 2024; year <= 2029; year += 1) {
      if (narrow && year % 2 === 1) continue;
      const yx = x(new Date(Date.UTC(year, 0, 1)));
      svg.append("line").attr("class", "gridline").attr("x1", yx).attr("x2", yx).attr("y1", axisY).attr("y2", axisY + 6);
      svg.append("text").attr("x", yx).attr("y", H - 8).attr("text-anchor", "middle").text(String(year));
    }
    const tx = x(new Date());
    svg.append("line").attr("x1", tx).attr("x2", tx).attr("y1", 4).attr("y2", axisY).attr("stroke", COLOURS.ink).attr("opacity", 0.4);
    if (!narrow) svg.append("text").attr("x", tx + 4).attr("y", axisY - 6).attr("class", "lab").text(T.rules.today);

    const levels = narrow ? events.length : 4;
    const levelY = (i: number) => 34 + (i % levels) * ((axisY - 60) / Math.max(1, levels - 1));
    events.forEach((e, i) => {
      const ex = e.before ? x(new Date(START)) : x(new Date(`${e.date}T00:00:00Z`));
      const ly = levelY(i);
      const colour = e.kind === "deadline" ? COLOURS.over_31 : e.kind === "later" ? COLOURS.muted : COLOURS.ink;
      const isSel = e.id === selected;
      const select = () => {
        selected = e.id;
        renderDetail();
        draw();
      };
      const g = svg
        .append("g")
        .attr("class", "rules-picker")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-pressed", String(isSel))
        .attr("aria-label", `${e.title}, ${dayMonthYear(e.date)}`)
        .on("click", select)
        .on("keydown", (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          select();
          (svg.selectAll<SVGGElement, unknown>(".rules-picker").nodes()[i] as SVGGElement | undefined)?.focus();
        });
      g.append("line").attr("x1", ex).attr("x2", ex).attr("y1", ly + 6).attr("y2", axisY).attr("stroke", colour).attr("opacity", 0.35);
      g.append("circle")
        .attr("class", "ring")
        .attr("cx", ex)
        .attr("cy", axisY)
        .attr("r", isSel ? 8 : 6)
        .attr("fill", isSel ? colour : COLOURS.page)
        .attr("stroke", colour)
        .attr("stroke-width", 2);
      const anchor = ex > W * (narrow ? 0.5 : 0.7) ? "end" : "start";
      const label = g
        .append("text")
        .attr("x", ex + (anchor === "end" ? -6 : 6))
        .attr("y", ly)
        .attr("text-anchor", anchor)
        .attr("class", isSel ? "lab-strong hl" : "lab hl")
        .text(`${e.before ? T.rules.since(Number(e.date.slice(0, 4))) : ""}${narrow ? e.short : e.label}`);
      const box = (label.node() as SVGTextElement).getBBox();
      g.insert("rect", ":first-child")
        .attr("x", Math.min(box.x, ex - 10) - 4)
        .attr("y", box.y - 6)
        .attr("width", Math.max(box.width, 20) + 14)
        .attr("height", axisY - box.y + 16)
        .attr("fill", "transparent");
    });
  };
  return draw;
}
