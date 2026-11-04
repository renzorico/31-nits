// Small, framework-free UI helpers shared by the sections.

/** What the site counts: listings with at least one open date at the snapshot.
 *  An empty calendar can mean booked, blocked or withdrawn, so the rest are
 *  "listed, no open dates", never "inactive". */
export const POPULATION = "listings with open dates";

export const formatInt = new Intl.NumberFormat("en-GB").format;

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** "2025-12-14" -> "14 Dec" (the year is in the surrounding text). */
export function formatDay(isoDate: string): string {
  if (!isoDate) return "n/a";
  const date = new Date(`${isoDate}T00:00:00Z`);
  // en-US month names ("Sep"), matching the "Sep 2026" labels elsewhere
  return `${date.getUTCDate()} ${date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`;
}

export function formatQuarter(snapshot: string): string {
  // en-US gives "Sep 2026", matching the labels in the exported data
  // (en-GB would say "Sept 2026").
  return new Date(`${snapshot}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** Read a CSS custom property so charts and the map follow the theme. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function requireElement<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}

export interface Option<V extends string> {
  value: V;
  label: string;
}

/** A labelled row of toggle buttons; calls onChange with the chosen value. */
export function segmented<V extends string>(
  label: string,
  options: Option<V>[],
  initial: V,
  onChange: (value: V) => void,
): HTMLElement {
  const group = el("div", { class: "control-group" });
  const id = `seg-${label.toLowerCase().replace(/\W+/g, "-")}`;
  group.append(el("span", { class: "control-label", id }, label));
  const row = el("div", { class: "segmented", role: "group", "aria-labelledby": id });
  const buttons = options.map((option) => {
    const button = el("button", { type: "button", "aria-pressed": String(option.value === initial) }, option.label);
    button.addEventListener("click", () => {
      for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
      onChange(option.value);
    });
    row.append(button);
    return button;
  });
  group.append(row);
  return group;
}

/** A labelled drop-down: one control for many options, where a row of
 *  buttons would take a phone's whole width. `select` is returned so
 *  the caller can set its value from outside. */
export function selectControl<V extends string>(
  label: string,
  options: Option<V>[],
  initial: V,
  onChange: (value: V) => void,
): { element: HTMLElement; select: HTMLSelectElement } {
  const group = el("div", { class: "control-group select-control" });
  const id = `select-${label.toLowerCase().replace(/\W+/g, "-")}-${selectCount++}`;
  group.append(el("label", { class: "control-label", for: id }, label));
  const select = el("select", { id });
  for (const option of options) {
    const node = el("option", { value: option.value }, option.label);
    if (option.value === initial) node.selected = true;
    select.append(node);
  }
  select.addEventListener("change", () => onChange(select.value as V));
  group.append(select);
  return { element: group, select };
}

let selectCount = 0; // keeps each drop-down's id unique across sections

/** A text alternative to a chart: the same figures as a table, scrollable
 *  and reachable by keyboard. Replaces any table already in `host`. */
export function setDataTable(host: HTMLElement, caption: string, headers: string[], rows: string[][]): void {
  const table = el("table");
  table.append(el("caption", {}, caption));
  const head = el("tr");
  for (const header of headers) head.append(el("th", { scope: "col" }, header));
  const thead = el("thead");
  thead.append(head);
  table.append(thead);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    row.forEach((cell, index) => tr.append(el(index === 0 ? "th" : "td", index === 0 ? { scope: "row" } : {}, cell)));
    body.append(tr);
  }
  table.append(body);
  const wrap = el("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": caption });
  wrap.append(table);
  host.querySelector(".table-wrap")?.remove();
  host.append(wrap);
}

/** Re-run a callback when the colour scheme flips, so SVG/canvas colours update. */
export function onThemeChange(callback: () => void): void {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", callback);
}

/** "2024-01-01" -> "Q1 2024" (a calendar quarter, e.g. for rent data). */
export function formatCalendarQuarter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}
