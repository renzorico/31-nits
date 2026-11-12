// Shared chart helpers: colours, sizes, tooltip (hover and tap), legends and
// reveal-once animations. Text formats live in i18n.ts.
import * as d3 from "d3";

export { dayMonthYear, euro, formatInt, monthShort, monthYear, pct } from "./i18n";

export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const MOTION_MS = 1000;
const REVEAL_RATIO = 0.3;

// Colours follow the entity, the same on every chart and the map.
export const COLOURS = {
  under_31: "#2f6fb3",
  exactly_31: "#b97a00",
  over_31: "#c8471b",
  green: "#1b7a57",
  violet: "#7a6fd0",
  pink: "#b8436c",
  other: "#8a867c",
  none: "#d9d3c6",
  ink: "#1d1b17",
  ink2: "#47433b",
  muted: "#6b665c",
  grid: "#e4dfd4",
  axis: "#c9c1b0",
  page: "#f7f5f0",
  raised: "#fffdf8",
} as const;

export const share = (part: number, whole: number): number => (whole ? (part / whole) * 100 : 0);

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}
export function setText(id: string, text: string): void {
  byId(id).textContent = text;
}
/** Only for strings built from our own data and constants, never user input. */
export function setHtml(id: string, html: string): void {
  byId(id).innerHTML = html;
}
export const swatch = (colour: string): string => `<i class="sw" style="background:${colour}"></i>`;

export const widthOf = (el: Element): number => el.getBoundingClientRect().width;
export const isNarrow = (): boolean => innerWidth < 640;
/** Chart height: wider screens get taller charts, within limits. */
export const chartHeight = (W: number, min: number, max: number, ratio = 0.5): number => Math.round(Math.max(min, Math.min(max, W * ratio)));
/** Same value as --gutter in pixels, so chart text lines up with page text. */
export const insetOf = (): number => Math.max(16, Math.min(56, innerWidth * 0.04));

export function freshSvg(root: HTMLElement, W: number, H: number, label: string) {
  root.replaceChildren();
  root.setAttribute("aria-label", label);
  return d3.select(root).append("svg").attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
}

// ---------- Tooltip: hover on desktop, tap on phones ----------
const tip = byId("tip");
export function showTip(event: { clientX: number; clientY: number }, html: string): void {
  tip.innerHTML = html;
  tip.style.opacity = "1";
  const margin = 14;
  const box = tip.getBoundingClientRect();
  const x = Math.min(event.clientX + margin, innerWidth - box.width - 8);
  const y = event.clientY + margin + box.height > innerHeight ? event.clientY - box.height - margin : event.clientY + margin;
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${y}px`;
}
export function hideTip(): void {
  tip.style.opacity = "0";
}
addEventListener("scroll", hideTip, { passive: true });

/** Bind a tooltip to marks for both pointer hover and tap/click. */
export function withTip<E extends Element, D>(
  sel: d3.Selection<E, D, d3.BaseType, unknown>,
  html: (d: D) => string,
  focus?: (d: D | null) => void,
): void {
  const show = (event: Event, d: D) => {
    focus?.(d);
    showTip(event as MouseEvent, html(d));
  };
  sel.on("pointermove", show).on("click", show).on("pointerleave", () => {
    focus?.(null);
    hideTip();
  });
}

// ---------- Legend ----------
export function setLegend(id: string, items: [string, string][]): void {
  byId(id).innerHTML = items.map(([label, colour]) => `<li><i style="background:${colour}"></i>${label}</li>`).join("");
}

// ---------- Reveal once, when the chart is on screen ----------
const revealed = new Set<string>();
const watchers = new Map<string, IntersectionObserver>();
export const isWaiting = (key: string): boolean => !REDUCED && !revealed.has(key);
export function revealOnView(key: string, root: Element, start: () => void): void {
  watchers.get(key)?.disconnect();
  const watcher = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry || entry.intersectionRatio < REVEAL_RATIO) return;
      watcher.disconnect();
      revealed.add(key);
      start();
    },
    { threshold: [REVEAL_RATIO] },
  );
  watchers.set(key, watcher);
  watcher.observe(root);
}

// ---------- Drawing loop ----------
export type Draw = () => void;
let lastWidth = innerWidth;
let resizeTimer = 0;
export function redrawOnResize(draw: Draw): void {
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      // phones fire resize when the URL bar hides; only redraw on width changes
      if (innerWidth !== lastWidth) {
        lastWidth = innerWidth;
        draw();
      }
    }, 180);
  });
}

/** Run a chart's draw and log, not swallow, a failure, so one broken chart never blanks the page. */
export function safely(name: string, draw: Draw): Draw {
  return () => {
    try {
      draw();
    } catch (error) {
      console.error(`Chart "${name}" failed to draw`, error);
    }
  };
}
