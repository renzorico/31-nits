---
name: The 31-Night Line
description: A flat, ruled data explainer on warm paper, set in mono and sans, with one orange signal.
colors:
  paper: "#f5f1e8"
  surface: "#fbf9f3"
  ink: "#1c1b18"
  muted: "#6b665c"
  rule: "#ddd6c6"
  accent-text: "#b84a1a"
  signal-orange: "#e4572e"
  under-31-slate: "#3f5468"
  exactly-31-sand: "#9a8f78"
  cat-violet: "#6a3d9a"
  cat-green: "#2e8a60"
  cat-rose: "#c43c5c"
  cat-stone: "#b8b0a0"
typography:
  display:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "clamp(2rem, 7.5vw, 3.2rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "clamp(1.2rem, 4.5vw, 1.6rem)"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  control: "3px"
spacing:
  gutter: "16px"
  section: "40px"
  touch-min: "40px"
components:
  segmented-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
    height: "40px"
  segmented-button-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  stat-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "16px 18px"
---

# Design System: The 31-Night Line

## Overview

**Creative North Star: "The Open Ledger"**

A page that keeps its books where the reader can see them. Warm paper, ruled lines, tabular figures and mono headings make the site read like a ledger: every number sits on a line, with its denominator and its limits within reach. Nothing is lit, lifted or animated to persuade; the only loud thing on the page is one orange, and it marks what the reader should look at first.

Density is moderate and text-led. Charts and tables carry the argument; surfaces are quiet frames around them. The reader is the informed public on a phone, so everything works as a single column with 16px gutters, large touch targets and no hover-only information.

**Key Characteristics:**
- Warm paper ground, near-black ink, one signal orange.
- Mono headings and labels, sans body, tabular numerals for every figure.
- Flat and ruled: 1px warm lines, no shadows.
- Square-ish 3px corners on every control and container.
- Light and dark schemes follow the system; chart colours keep their meaning across both.

## Colors

A warm neutral palette with a single orange voice and a muted slate-sand-orange series for the three minimum-stay groups.

### Primary
- **Signal Orange** (`#e4572e`, dark `#f26b3a`): the over-31-nights group and Barcelona in charts and on the map, and the text selection fill. Never used for body text.
- **Burnt Link Orange** (`#b84a1a`, dark `#f08a5d`): links, focus rings, the slider and summary toggles. A darkened sibling of the signal, chosen to pass 4.5:1 as text.

### Secondary
- **Slate** (`#3f5468`, dark `#8fa9c2`): the under-31-nights group.
- **Sand** (`#9a8f78`, dark `#a89d86`): the exactly-31-nights group.

### Tertiary
- **Violet, Green, Rose, Stone** (`#6a3d9a`, `#2e8a60`, `#c43c5c`, `#b8b0a0`; each lightened in dark mode): category colours for other cities and series, used only when a chart needs more than the three minimum-stay hues. Stone is the "other / rest" grey.

### Neutral
- **Paper** (`#f5f1e8`, dark `#17150f`): page background.
- **Surface** (`#fbf9f3`, dark `#201d16`): tiles, cards, buttons, table headers; a half-step lighter than paper.
- **Ink** (`#1c1b18`, dark `#ece8dc`): text; also the pressed-button fill.
- **Muted** (`#6b665c`, dark `#a8a293`): kickers, notes, labels, captions.
- **Rule** (`#ddd6c6`, dark `#343024`): every 1px border and divider.

### Named Rules
**The One Voice Rule.** Orange means "look here": the over-31 group, Barcelona, the next link. It is never decorative, and no second accent hue competes with it.

**The Same Colour Everywhere Rule.** Under 31, exactly 31 and over 31 keep the same slate, sand and orange in every chart, legend, map layer and readout. A colour is never reassigned between sections.

## Typography

**Display Font:** JetBrains Mono (with ui-monospace, SF Mono, Menlo, Consolas)
**Body Font:** Public Sans (with system-ui, -apple-system, Segoe UI, Roboto)
**Label/Mono Font:** JetBrains Mono

**Character:** A technical-notebook voice on top of a plain, readable text face. Mono gives headings and labels a measured, instrumented feel; the sans keeps long explanations easy on a phone.

### Hierarchy
- **Display** (700, clamp 2rem to 3.2rem, 1.05, -0.03em): the page title only.
- **Headline** (600, clamp 1.2rem to 1.6rem, 1.2): section titles (h2).
- **Title** (600, 1.15rem): sub-headings (h3) and card titles.
- **Body** (400, 17px, 1.55): all running text, capped at 68ch. The lede is 1.1rem.
- **Label** (400, 0.8rem mono; card term labels 0.75rem uppercase, 0.05em tracking): kickers, control labels, definition terms, chart axis text (11px mono).
- **Stat figure** (700, 2rem mono, tabular numerals): the Barcelona figure in the hero bars and the register stat tiles.

### Named Rules
**The Tabular Figures Rule.** Every number that can be compared (stats, legends, readouts, tables, charts) uses tabular numerals so columns and changing values do not jitter.

**The Mono For Marking Rule.** Mono marks structure and measurement (headings, labels, figures, axes). Prose is always the sans.

## Layout

Single column. Header, sections and footer share a 980px max width, 16px side gutters and 40px vertical padding; Paragraphs stop at 60ch (about 75 characters). Sections are separated by a 1px rule, not by background bands. Register stat tiles stack on phones and go three across from 640px. Long choice lists are 44px drop-downs (City and Snapshot sit side by side even on phones); short ones are segmented buttons that wrap (36px on phones, 40px from 640px). Sections after the map open with a one-sentence finding and its limit; the chart and method sit behind a "Show the chart" toggle. Space for late-drawn charts and stats is reserved with min-heights so nothing jumps on load. A table of contents of plain links sits under the hero; a skip link is first in the tab order.

## Elevation & Depth

Flat and ruled. There are no box-shadows anywhere. Depth is a half-step lighter surface fill plus a 1px Rule border on tiles, cards, buttons and table wrappers; the map has the same border. Interactive state is shown by fill inversion and focus outline, never by lift.

### Named Rules
**The Flat-By-Default Rule.** No shadows, glows or blurs. If something needs to stand out, change its fill or give it the orange, not elevation.

## Shapes

Everything is square-ish: a single 3px corner radius on buttons, tiles, cards, table wrappers and the map frame. Map legend swatches are 10px circles (the one round form, because they mirror map dots). Popups on the map use an 8px corner. Borders are always 1px Rule; no pills, no capsules, no outlined cards with coloured side stripes.

## Components

Plain and precise: small mono labels, inverted fill when selected, nothing decorative.

### Buttons (segmented controls)
- **Shape:** 3px corners, 40px minimum height (36px on phones).
- **Default:** Surface fill, Ink text, 1px Rule border, 0.8rem mono.
- **Pressed:** Ink fill, Paper text and border (`aria-pressed="true"`).
- **Focus:** 3px Burnt Link Orange outline, 2px offset.

### Legend toggles
- **Style:** transparent, 32px high, 0.85rem sans with tabular numerals, colour dot beside the label.
- **State:** unpressed items drop to 40% opacity with a strikethrough.

### City bars (hero)
- **Style:** five rows on one 0-100% scale, each a mono city name, a thin track with a fill, and a tabular value; Barcelona first, larger (14px track, 2rem value) with the Signal Orange fill, the other cities in Stone (`--cat-7`). Rows separated by 1px Rule lines. The only place a caption sits above the bars.

### Stat tiles (register)
- **Style:** Surface fill, 1px Rule border, 3px corners, 14px 16px padding; a 2rem bold mono figure over a muted 0.9rem caption.

### Cards (policy levers)
- **Corner Style:** 3px. **Background:** Surface. **Border:** 1px Rule. **Shadow:** none.
- **Padding:** 16px 18px. A native `<details>` summary (44px target) opens each card; term labels (what it says / what the data shows / what it cannot show) are uppercase 0.75rem mono in Muted.

### Disclosures
- **Method and limits** and **collapsed sections** use native `<details>`. Summary text is Burnt Link Orange, 32px (44px for section heads), with the 3px focus outline.

### Navigation
- A wrapped row of Burnt Link Orange text links, 0.85rem, 32px high, 14px column gap. No bar, no sticky header. A fixed "Contents ↑" button (44px, bottom-left) appears only while scrolling up, after the contents have scrolled away.

### Slider
- Native range input, `accent-color` Burnt Link Orange, 40px high, with a tabular value output beside it.

### Charts and tables
- Observable Plot on a transparent background, 12px mono axis text, colours from the tokens above, redrawn on theme change. Every chart has a text or table alternative; tables have sticky Surface headers, right-aligned numbers and 1px row rules.

## Do's and Don'ts

### Do:
- **Do** use orange for exactly one job per view: the thing to read first.
- **Do** keep the three minimum-stay colours the same in every chart, legend and map layer.
- **Do** show numbers in tabular mono figures and keep each beside its denominator or limit.
- **Do** separate sections with 1px Rule lines and a half-step Surface fill, not shadows.
- **Do** keep touch targets at 40px (36px minimum on phones) and give every control a visible 3px focus outline.
- **Do** reserve space (min-height) for anything that draws after data loads.

### Don't:
- **Don't** add shadows, glows, gradients or blur anywhere.
- **Don't** add a second accent hue, or use orange as body text colour.
- **Don't** use round pills or large radii; 3px is the system.
- **Don't** rely on hover for information; every tooltip has a tap or text equivalent.
- **Don't** set prose in mono or headings in the sans.
- **Don't** colour-code with red/green to imply good or bad; the palette is deliberately non-evaluative to match the site's neutrality.
