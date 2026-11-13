# Design System: 31 nits

A light, map-led atlas of Barcelona's short-term rentals (chosen after the
UX audit of 2026-11-12: the earlier dark scroll story read as a tech
showcase). Civic data journalism register: warm paper, editorial type,
byline and date, normal scroll, every claim placed where readers live.

## Rules

- **Titles are findings.** Every screen title is a sentence with a number,
  computed from the exported data; plain words, no "scrape" or "point
  estimate" in titles (those stay in "How is this made?").
- **Three languages.** All reader text lives in `site/src/i18n.ts` (typed:
  a missing key fails `tsc`); rule texts and caveats in `src/config.py` /
  the export, with ES and CA next to EN and a test for parity. Numbers and
  dates are formatted per locale (`41,7 %`, `10.623`, `set. 2026`).
- **Type.** Archivo (variable width): 118% wide bold for h1, 110% for h2,
  normal for text, 85% narrow for chart and map labels. Tabular numerals.
- **Colour follows the entity.** Under 31 `#2f6fb3`, exactly 31 `#b97a00`,
  over 31 `#c8471b`; tourist-flat licence green `#1b7a57`. One sequential
  ramp per map measure (orange for month-plus share, violet for host
  size). Neighbourhoods with fewer than 50 listings are hatched, never
  coloured. The 31-night line is ink.
- **Body text justified** with hyphenation; "How is this made?" sits under each chart, small and muted.
- **Values on tap.** Every tooltip opens on hover and on tap (`withTip`).
- **Lazy heavy parts.** MapLibre and the dot points load only when the
  reader opens the explorer.
- **Neutral.** No red/green verdicts; each screen states what the data
  cannot show.

## Screens (in order)

| Screen | Chart | Module |
|---|---|---|
| Hero | headline, byline, lede | `main.ts` |
| The wall at 31 | histogram + 4 small multiples, same y scale | `wall.ts` |
| Atlas | neighbourhood choropleth of month-plus share + dot explorer | `atlas.ts`, `mapScreen.ts` |
| Price | lollipop of median asking price by minimum stay | `price.ts` |
| Hosts | neighbourhood choropleth of listings in 5+ accounts | `atlas.ts` |
| Flows | flow diagram, only "vanished" and "switched" in colour | `flowsScreen.ts` |
| Exits by city | dumbbell: share gone, shorter stays vs month-plus; interval in the tooltip | `flowsScreen.ts` |
| Licence field | 100% bars per quarter | `licences.ts` |
| Register | share of licence numbers shown on Airbnb, per snapshot | `registerScreen.ts` |
| Rents | rent line over new-lease bars, rule dates dashed | `rentsScreen.ts` |
| Rules | selectable timeline + says / shows / cannot show | `rules.ts` |
| Method | numbered list, caveats, sources | `main.ts` |
