// Shared helpers for the scroll story: sizes, tooltip, legend, reveal-once
// animations and the one-gesture-one-screen wheel pager. Ported from the
// data-story-design helpers so every screen behaves the same.
import * as d3 from "d3";

export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const SCREEN_MODE = "(min-width: 900px) and (min-height: 640px)"; // must match styles.css
export const MOTION_MS = 1200;
const REVEAL_RATIO = 0.3;
const PAGE_LOCK_MS = 750;
const WHEEL_QUIET_MS = 160;
const WHEEL_MIN_DELTA = 4;
const NEW_GESTURE_RATIO = 1.6;

export const COLOURS = {
  under_31: "#3987e5",
  exactly_31: "#c98500",
  over_31: "#d95926",
  green: "#199e70",
  pink: "#d55181",
  violet: "#9085e9",
  other: "#5c5b56",
  ink: "#f0efec",
  ink2: "#c3c2b7",
  muted: "#898781",
  grid: "#2c2c2a",
  axis: "#383835",
  page: "#0f0f0e",
  raised: "#1a1a19",
} as const;

export const BAND_LABEL = {
  under_31: "Under 31 nights",
  exactly_31: "Exactly 31",
  over_31: "Over 31",
} as const;

export const formatInt = new Intl.NumberFormat("en-GB").format;
export const pct = (value: number, digits = 1): string => `${value.toFixed(digits)}%`;
export const share = (part: number, whole: number): number => (whole ? (part / whole) * 100 : 0);
export const euro = (value: number): string => `€${formatInt(Math.round(value))}`;

export function monthYear(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
export function dayMonthYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`;
}

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
export const isScreenMode = (): boolean => matchMedia(SCREEN_MODE).matches;
/** In screen mode a chart fills the room left in its screen; below that it uses the fallback. */
export const heightOf = (root: HTMLElement, fallback: number): number =>
  isScreenMode() ? Math.max(root.clientHeight, 220) : fallback;
/** Same value as --gutter in pixels, so chart text lines up with page text. */
export const insetOf = (): number => Math.max(16, Math.min(56, innerWidth * 0.04));

/** A fresh, sized SVG in a chart container. */
export function freshSvg(root: HTMLElement, W: number, H: number, label: string) {
  root.replaceChildren();
  root.setAttribute("aria-label", label);
  return d3.select(root).append("svg").attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
}

// ---------- Tooltip ----------
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

// ---------- Wheel pager: one gesture moves exactly one screen ----------
let pageLockedUntil = 0;
let lastWheelAt = 0;
let lastWheelDelta = 0;
export function initPager(): void {
  addEventListener(
    "wheel",
    (event) => {
      if (!isScreenMode() || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const now = performance.now();
      const delta = Math.abs(event.deltaY);
      const newGesture = now - lastWheelAt > WHEEL_QUIET_MS || delta > lastWheelDelta * NEW_GESTURE_RATIO;
      lastWheelAt = now;
      lastWheelDelta = delta;
      if (now < pageLockedUntil || !newGesture || delta < WHEEL_MIN_DELTA) return;
      const screens = [...document.querySelectorAll<HTMLElement>(".screen:not([hidden])")];
      const barHeight = byId("banner").offsetHeight;
      const tops = screens.map((el) => Math.abs(el.getBoundingClientRect().top - barHeight));
      const current = tops.indexOf(Math.min(...tops));
      const next = screens[Math.max(0, Math.min(screens.length - 1, current + Math.sign(event.deltaY)))];
      pageLockedUntil = now + PAGE_LOCK_MS;
      next?.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
    },
    { passive: false },
  );
}

/** Thin progress bar in the top banner. */
export function initProgress(): void {
  const bar = byId("progress");
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty("--p", `${max > 0 ? (scrollY / max) * 100 : 0}%`);
  };
  addEventListener("scroll", update, { passive: true });
  update();
}

// ---------- Drawing loop ----------
export type Draw = () => void;
let lastWidth = innerWidth;
let lastHeight = innerHeight;
let resizeTimer = 0;
export function redrawOnResize(draw: Draw): void {
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      // phones fire resize when the URL bar hides; only redraw on real width or big height changes
      const widthChanged = innerWidth !== lastWidth;
      const heightChanged = Math.abs(innerHeight - lastHeight) > 120 && isScreenMode();
      if (widthChanged || heightChanged) {
        lastWidth = innerWidth;
        lastHeight = innerHeight;
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
