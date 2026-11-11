// Screen: the rules on one timeline. Each event can be selected; its card
// below says what the rule says, what this data shows and what it cannot show.
// Rule texts, laws and dates come from src/config.py via meta.json.
import * as d3 from "d3";

import { CITY_LABELS, type BarcelonaTrend, type CityRow, type Meta, type Register, type RentRow } from "./data";
import { byId, COLOURS, dayMonthYear, formatInt, freshSvg, heightOf, insetOf, monthYear, setText, widthOf } from "./story";

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

const quarter = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
};
const signed = (v: number): string => `${v > 0 ? "+" : ""}${v}%`;

function dataShows(id: string, { meta, register, rents, trends, cities }: Inputs): string {
  switch (id) {
    case "tourist_licence_phase_out": {
      const totals = Object.values(register.totals);
      if (totals.length === 0) return "";
      return `The register holds ${formatInt(Math.min(...totals))}–${formatInt(Math.max(...totals))} records in every published quarter: no decline yet. A stable register before a deadline says nothing about what happens after it.`;
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
      return `New-lease rents were rising ${signed(before.yoy_pct)} a year just before the limit (${quarter(before.quarter_start)}), fell to ${signed(lowest.yoy_pct)} (${quarter(lowest.quarter_start)}), and were ${signed(latest.yoy_pct)} in ${quarter(latest.quarter_start)}.`;
    }
    case "seasonal_rentals": {
      const first = trends[0];
      const second = trends[1];
      const last = trends.at(-1);
      const clear = cities.filter((c) => c.exit_gap.ci_low > 0).map((c) => CITY_LABELS[c.city]);
      if (!first || !second || !last) return "";
      return (
        `Listings asking over 31 nights: ${formatInt(first.bands.over_31)} (${monthYear(first.snapshot)}), ${formatInt(second.bands.over_31)} (${monthYear(second.snapshot)}), ${formatInt(last.bands.over_31)} (${monthYear(last.snapshot)}). ` +
        `Month-plus listings left the scrape more often than shorter ones in ${clear.length} of 5 cities (${clear.join(", ")}), and Barcelona's gap cannot be told apart from any other city's.`
      );
    }
    case "owners_vote_catalonia":
    case "owners_approval_spain":
      return "No direct measure. This rule acts building by building, and listing data cannot see it.";
    default:
      return "";
  }
}

function buildEvents(inputs: Inputs): RuleEvent[] {
  const { meta } = inputs;
  const events: RuleEvent[] = Object.entries(meta.policy_levers).map(([id, l]) => ({
    id,
    date: l.applies_from,
    label: l.timeline_label,
    title: l.title,
    law: `${l.law} · ${l.jurisdiction}`,
    says: [l.rule, ...l.exceptions].join(" "),
    shows: dataShows(id, inputs),
    limits: l.data_limits,
    status: `${l.status}${l.notes ? ` ${l.notes}` : ""} Checked ${dayMonthYear(l.status_checked_on)}.`,
    sources: l.sources,
    kind: "rule",
    before: Date.parse(`${l.applies_from}T00:00:00Z`) < START,
  }));
  const phaseOut = meta.policy_levers.tourist_licence_phase_out;
  if (phaseOut?.deadline) {
    events.push({
      id: "deadline",
      date: phaseOut.deadline,
      label: "Licence deadline",
      title: "End of the tourist-flat transition",
      law: phaseOut.law,
      says: phaseOut.rule,
      shows: dataShows("tourist_licence_phase_out", inputs),
      limits: phaseOut.data_limits,
      status: phaseOut.notes,
      sources: phaseOut.sources,
      kind: "deadline",
    });
  }
  for (const later of meta.post_observation_developments) {
    events.push({
      id: `later-${later.date}`,
      date: later.date,
      label: later.title.split(":")[0] ?? later.title,
      title: later.title,
      law: "Spain",
      says: later.summary,
      shows: "Nothing yet: it was published after every snapshot used here, so it cannot explain any change in this data.",
      limits: later.note,
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
  let selected = events.find((e) => e.id === "seasonal_rentals")?.id ?? events[0]?.id ?? "";

  setText("rules-title", `${events.filter((e) => e.kind === "rule").length} rules from Catalan and Spanish law, and a deadline in ${new Date(`${events.find((e) => e.kind === "deadline")?.date ?? "2028-11-09"}T00:00:00Z`).getUTCFullYear()}.`);
  setText(
    "rules-sub",
    `Not every rule in force: the ones this data can say something about, checked against the official gazettes on ${dayMonthYear(meta.levers_as_of)}. ` +
      `The shaded band is when the snapshots were taken (${monthYear(obsStart)} – ${monthYear(obsEnd)}). Select a rule to read it.`,
  );

  const detail = byId("rule-detail");
  const renderDetail = () => {
    const e = events.find((ev) => ev.id === selected);
    if (!e) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    detail.innerHTML =
      `<h3>${esc(e.title)}<small>${esc(e.law)} · from ${dayMonthYear(e.date)}</small></h3>` +
      `<dl><dt>What it says</dt><dd>${esc(e.says)}</dd></dl>` +
      `<dl><dt>What the data shows</dt><dd>${esc(e.shows)}</dd></dl>` +
      `<dl><dt>What it cannot show</dt><dd>${esc(e.limits)}</dd></dl>` +
      `<p class="status">${esc(e.status)} ${e.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(" · ")}</p>`;
  };
  renderDetail();

  const root = byId("rules-chart");
  const draw = () => {
    const W = widthOf(root);
    const H = heightOf(root, W < 640 ? 330 : 280);
    const inset = insetOf();
    const svg = freshSvg(
      root,
      W,
      H,
      "Timeline of rules: " + events.map((e) => `${e.label} ${dayMonthYear(e.date)}`).join("; "),
    );
    const narrow = W < 640;
    const x = d3
      .scaleUtc()
      .domain([new Date(START), new Date(END)])
      .range([inset + (narrow ? 8 : 20), W - inset - 8]);
    const axisY = H - 30;

    svg
      .append("rect")
      .attr("x", x(new Date(`${obsStart}T00:00:00Z`)))
      .attr("width", x(new Date(`${obsEnd}T00:00:00Z`)) - x(new Date(`${obsStart}T00:00:00Z`)))
      .attr("y", 4)
      .attr("height", axisY - 4)
      .attr("fill", COLOURS.raised);
    svg
      .append("text")
      .attr("x", x(new Date(`${obsStart}T00:00:00Z`)) + 6)
      .attr("y", 18)
      .attr("class", "lab")
      .text(narrow ? "data" : "snapshots");
    svg.append("line").attr("class", "axisline").attr("x1", inset).attr("x2", W - inset).attr("y1", axisY).attr("y2", axisY);
    for (let year = 2024; year <= 2029; year += 1) {
      if (narrow && year % 2 === 1) continue;
      const yx = x(new Date(Date.UTC(year, 0, 1)));
      svg.append("line").attr("class", "gridline").attr("x1", yx).attr("x2", yx).attr("y1", axisY).attr("y2", axisY + 6);
      svg.append("text").attr("x", yx).attr("y", H - 8).attr("text-anchor", "middle").text(String(year));
    }
    const today = new Date();
    const tx = x(today);
    svg.append("line").attr("x1", tx).attr("x2", tx).attr("y1", 4).attr("y2", axisY).attr("stroke", COLOURS.ink).attr("opacity", 0.5);
    if (!narrow) svg.append("text").attr("x", tx + 4).attr("y", axisY - 6).attr("class", "lab").text("today");

    // stagger labels on alternating heights so they never collide
    const levels = narrow ? events.length : 4;
    const levelY = (i: number) => 34 + (i % levels) * ((axisY - 60) / (levels - 1 || 1));
    events.forEach((e, i) => {
      const ex = e.before ? x(new Date(START)) : x(new Date(`${e.date}T00:00:00Z`));
      const ly = levelY(i);
      const colour = e.kind === "deadline" ? COLOURS.over_31 : e.kind === "later" ? COLOURS.ink2 : COLOURS.ink;
      const g = svg
        .append("g")
        .attr("class", "rules-picker")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-pressed", String(e.id === selected))
        .attr("aria-label", `${e.title}, ${dayMonthYear(e.date)}`)
        .on("click", () => {
          selected = e.id;
          renderDetail();
          draw();
        })
        .on("keydown", (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selected = e.id;
            renderDetail();
            draw();
            (svg.selectAll<SVGGElement, unknown>(".rules-picker").nodes()[i] as SVGGElement | undefined)?.focus();
          }
        });
      g.append("line").attr("x1", ex).attr("x2", ex).attr("y1", ly + 6).attr("y2", axisY).attr("stroke", colour).attr("opacity", 0.35);
      g.append("circle").attr("class", "ring").attr("cx", ex).attr("cy", axisY).attr("r", e.id === selected ? 8 : 6).attr("fill", e.id === selected ? colour : COLOURS.page).attr("stroke", colour).attr("stroke-width", 2);
      const anchor = ex > W * (narrow ? 0.5 : 0.7) ? "end" : "start";
      const label = g
        .append("text")
        .attr("x", ex + (anchor === "end" ? -6 : 6))
        .attr("y", ly)
        .attr("text-anchor", anchor)
        .attr("class", e.id === selected ? "lab-strong hl" : "lab hl")
        .text(`${e.before ? "← since " + new Date(`${e.date}T00:00:00Z`).getUTCFullYear() + ": " : ""}${narrow ? e.label.replace("Real Decreto-ley", "RDL") : e.label}`);
      // generous hit area for touch
      const box = (label.node() as SVGTextElement).getBBox();
      g.insert("rect", ":first-child").attr("x", Math.min(box.x, ex - 10) - 4).attr("y", box.y - 6).attr("width", Math.max(box.width, 20) + 14).attr("height", axisY - box.y + 16).attr("fill", "transparent");
    });
  };
  return draw;
}
