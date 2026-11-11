// Screen: the tourist-flat register as 10,000+ squares, one per licence
// number, lit when that number appears on a listing with open dates.
import * as d3 from "d3";

import type { PolicyLever, Register } from "./data";
import {
  COLOURS,
  dayMonthYear,
  formatInt,
  heightOf,
  insetOf,
  isWaiting,
  monthYear,
  MOTION_MS,
  pct,
  revealOnView,
  setLegend,
  setText,
  widthOf,
} from "./story";

const OFF = "#2f2e2b";
const DAY_MS = 86_400_000;

function quarterLabel(code: string): string {
  // "2026_3T" -> "Q3 2026"
  const [year, q] = code.split("_");
  return `Q${(q ?? "").replace("T", "")} ${year}`;
}

export function initRegisterScreen(register: Register, phaseOut: PolicyLever | undefined): () => void {
  const latest = register.match.at(-1);
  if (!latest) throw new Error("No register match");
  const totals = Object.entries(register.totals).sort(([a], [b]) => a.localeCompare(b));
  const first = totals[0];
  const last = totals.at(-1);
  const lit = latest.displayed_numbers_found_in_register;
  const all = latest.register_numbers;
  const deadline = phaseOut?.deadline ?? null;
  // whole calendar days from the reader's local today, so the count does not jump at UTC midnight
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = deadline ? Math.round((Date.parse(`${deadline}T00:00:00Z`) - todayUtc) / DAY_MS) : null;

  setText(
    "register-title",
    `${pct(latest.register_numbers_displayed_pct, 0)} of Barcelona's ${formatInt(all)} tourist-flat licence numbers appear on an Airbnb listing with open dates.`,
  );
  setText(
    "register-sub",
    `The city's register has barely moved: ${formatInt(first?.[1] ?? 0)} records in ${quarterLabel(first?.[0] ?? "")}, ${formatInt(last?.[1] ?? 0)} in ${quarterLabel(last?.[0] ?? "")}. ` +
      (deadline
        ? `Under a 2023 Catalan decree these flats need an urban-planning licence by ${dayMonthYear(deadline)} or must stop operating as tourist flats${daysLeft !== null && daysLeft > 0 ? `: ${formatInt(daysLeft)} days from today` : ""}.`
        : ""),
  );
  setText(
    "register-how",
    `Each square is one licence number in the ${quarterLabel(latest.register_quarter)} register; it is lit when that number is shown on at least one listing with open dates in the ${monthYear(latest.snapshot)} snapshot. ` +
      `${pct(latest.displayed_found_pct)} of the numbers listings display exist in the register. A match shows the number exists; it does not show the listing is that flat. ` +
      "An unlit square is not an empty flat: it may let on other platforms, directly, or not at all. Owners can ask for one extension of up to five years. " +
      "The council has said (June 2024 press reports) that it does not plan to grant the new licences; that is a stated policy, not a legal text.",
  );
  setLegend("register-legend", [
    [`Shown on Airbnb · ${formatInt(lit)}`, COLOURS.green],
    [`Not shown on a listing with open dates · ${formatInt(all - lit)}`, OFF],
  ]);

  const root = document.getElementById("register-chart") as HTMLElement;
  const KEY = "register";
  return () => {
    const W = widthOf(root);
    const H = heightOf(root, Math.min(560, Math.max(360, W * 0.9)));
    const inset = insetOf();
    root.replaceChildren();
    root.setAttribute(
      "aria-label",
      `Unit chart of ${formatInt(all)} licence numbers; ${formatInt(lit)} are lit because they appear on an Airbnb listing with open dates.`,
    );
    const innerW = W - 2 * inset;
    // largest square cell that fits all numbers in the box
    let cell = Math.floor(Math.sqrt((innerW * H) / all));
    let cols = Math.floor(innerW / cell);
    while (cell > 2 && cols * Math.floor(H / cell) < all) {
      cell -= 1;
      cols = Math.floor(innerW / cell);
    }
    const rows = Math.ceil(all / cols);
    const gap = cell >= 6 ? 1 : cell >= 4 ? 0.6 : 0;
    const usedW = cols * cell;
    const usedH = rows * cell;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(usedH * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${usedH}px`;
    canvas.style.marginTop = `${Math.max(0, (H - usedH) / 2)}px`;
    root.append(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const x0 = inset + (innerW - usedW) / 2;

    const paint = (litCount: number) => {
      ctx.clearRect(0, 0, W, usedH);
      for (let i = 0; i < all; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.fillStyle = i < litCount ? COLOURS.green : OFF;
        ctx.fillRect(x0 + col * cell, row * cell, cell - gap, cell - gap);
      }
    };

    if (isWaiting(KEY)) {
      paint(0);
      revealOnView(KEY, root, () => {
        const ease = d3.easeCubicInOut;
        const timer = d3.timer((elapsed) => {
          const t = Math.min(1, elapsed / (MOTION_MS * 1.4));
          paint(Math.round(ease(t) * lit));
          if (t >= 1) timer.stop();
        });
      });
    } else {
      paint(lit);
    }
  };
}
