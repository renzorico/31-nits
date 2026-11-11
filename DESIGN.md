# Design System: The 31-Night Line

A dark scroll story: one finding per screen, each screen the same stack
(title sentence, two-line explanation, closed "How is this made?", centred
legend, chart edge to edge). Built on the `data-story-design` tokens, copied
unchanged at the top of `site/src/styles.css`; project additions follow them.

## Rules

- **Titles are findings.** Every screen title is a full sentence with a
  number, computed from the exported data in the screen's module.
- **One colour per entity, everywhere.** Minimum stay: under 31 `#3987e5`
  (blue), exactly 31 `#c98500` (amber), over 31 `#d95926` (orange), on the
  wall, the price dots, the map and the flow diagram. Tourist-flat licences
  are green `#199e70` on both the licence-field bars and the register waffle.
  Barcelona is `--ink` white against muted grey cities on the gap and host
  charts. "Absent from the scrape" is pink `#d55181`, never the red status
  colour.
- **Text never wears a series colour.** Labels are `--ink`, `--ink-2` or
  `--muted`; labels on fills are white with a dark halo. The halo class for
  text on the page background is `hl` (`halo` is the tokens' pulse animation).
- **Screen mode** (min 900x640): each screen is `100svh - 44px`, scroll snaps
  and one wheel gesture moves one screen (`story.ts`). Below that, normal flow
  with fixed chart heights.
- **Reveal once.** Charts animate in when 30% visible and never replay on
  redraw; `prefers-reduced-motion` skips all of it.
- **Neutral.** No red/green good-bad encoding, no verdicts in titles; every
  screen states what the data cannot show in its explanation or its "How".

## Screens (in order)

| Screen | Chart | Module |
|---|---|---|
| Hero | headline number + 4 stats | `main.ts` |
| The wall at 31 | histogram + 4 small multiples, same y scale | `wall.ts` |
| Price | log-log dot chart, area = listings | `price.ts` |
| Map | MapLibre dark, glow dots, band toggles, quarter switch | `mapScreen.ts` |
| Flows | two-column flow diagram Dec 2025 to Sep 2026 | `flowsScreen.ts` |
| Exit gap | dot + host-account interval per city | `flowsScreen.ts` |
| Licence field | 100% bars per quarter | `licences.ts` |
| Register | canvas unit chart, one square per licence number | `registerScreen.ts` |
| Hosts | concentration curves, five cities | `hosts.ts` |
| Rents | rent line over new-lease bars, rule dates dashed | `rentsScreen.ts` |
| Rules | selectable timeline + what it says / shows / cannot show | `rules.ts` |
| Method | six-step rail, caveats, sources | `main.ts` |

Type is the system stack only, tabular numerals everywhere. No tables, tabs
or cards; exact values live in tooltips and each chart's `aria-label`.
