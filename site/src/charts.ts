// Shared plumbing for Observable Plot charts: redraw on width or theme
// change, and the theme-aware base style every chart uses.
import { cssVar, onThemeChange } from "./ui";

export const MIN_CHART_WIDTH = 300;

/** Bottom margin for a chart whose x axis has a title: room for the tick
 *  labels AND the title below them. With Plot's default margin the title
 *  is drawn on top of the tick numbers. */
export const X_TITLE_MARGIN = 54;
/** Extra chart height that margin needs compared with Plot's default (30). */
export const X_TITLE_EXTRA_HEIGHT = X_TITLE_MARGIN - 30;

/** Base `style` option for Plot, following the CSS theme tokens. */
export function plotStyle(): Record<string, string> {
  return { background: "transparent", color: cssVar("--text"), fontSize: "12px" };
}

/**
 * Draw a chart into `container` now, and again whenever its width changes
 * or the colour scheme flips. Returns a function to force a redraw after
 * the caller's own state changes (toggles, sliders).
 */
export function mountChart(container: HTMLElement, draw: (width: number) => Element): () => void {
  const render = () => {
    const drawn = draw(Math.max(MIN_CHART_WIDTH, container.clientWidth));
    container.replaceChildren(drawn);
    // The wrapper is the image (role="img" in index.html), so it carries the
    // name; a label on the svg inside would be skipped by screen readers.
    const label = drawn.getAttribute("aria-label") ?? drawn.querySelector("[aria-label]")?.getAttribute("aria-label");
    if (label) container.setAttribute("aria-label", label);
  };
  // Redraw only on a real width change, so a redraw cannot trigger
  // another resize callback.
  let lastWidth = container.clientWidth;
  new ResizeObserver(() => {
    if (container.clientWidth === lastWidth) return;
    lastWidth = container.clientWidth;
    render();
  }).observe(container);
  onThemeChange(render);
  render();
  return render;
}
