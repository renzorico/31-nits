# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the informed general public. Barcelona residents, journalists and voters ahead of Spain's general election (29 Nov 2026) and the municipal elections (23 May 2027). They arrive mostly on phones, want to check a claim, and do not want to be told what to think. (Inferred from the repo, confirmed by the owner. Secondary audiences such as analysts or portfolio reviewers were not confirmed as targets.)

## Product Purpose

An interactive, mobile-first explainer of short-term rentals and housing rules in Barcelona and four other Spanish cities (Madrid, Valencia, Málaga, Sevilla). It sets four quarterly Airbnb snapshots (Dec 2025 - Sep 2026) against Barcelona's official tourist-flat register and official rents of new leases, and treats each housing rule as a policy lever: what it says, what the data shows, what the data cannot show.

Success, as confirmed by the owner: (1) the reader understands the 31-night line, what the data shows and what it cannot show, with no verdict attached; (2) the site shows the owner's craft as a data analyst and engineer.

## Positioning

A data story that publishes its own corrections and limits. Every percentage has its numerator and denominator in the exported data; a z-test was withdrawn and a vote-majority error was fixed in public; comparisons use all cities, not one hand-picked one. A neighbouring explainer could copy the charts but not this audit trail.

## Operating Context

- Static site (Vite + strict TypeScript + Observable Plot + MapLibre) built from JSON exported by a Python/pandas pipeline in `src/` and `scripts/export_site_data.py`; notebooks 01-04 hold the full analysis. Site text that quotes numbers computes them from the exported data.
- Live at https://renzorico.github.io/spain-housing-str-analysis/ (GitHub Pages). The owner pushes; the agent commits small.
- Independent audits are kept in `audits/` (latest UX audit 2026-11-03 flagged length and density as the top issue).

## Capabilities and Constraints

- Population throughout: Airbnb listings with open dates. Listings are labelled by the minimum stay they ask (under 31 / exactly 31 / over 31 nights), never by legality.
- Sections: minimum stays histogram, map, listing flows, city comparison, host concentration, HUT register, rents, rules as policy levers.
- Privacy: the raw `license` column and the register's addresses never reach the site; tests scan the site data for identifying fields.
- Thresholds, dates and laws live only in `src/config.py`; URLs and paths only in `src/sources.py`.
- Language and visual direction beyond what the code already does were not stated as binding.

## Brand Commitments

- Name: "The 31-Night Line".
- Strict neutrality (binding): describe rules as policy levers (what it says / what the data shows / what it cannot show). Never name parties or give verdicts. Compare across all cities, never one hand-picked comparison.

## Evidence on Hand

- Real data and analysis: `data/` (gitignored raw), `site/public/data/` (committed export), `notebooks/`, `reports/figures/`.
- Source-checked rule texts (BOE, DOGC, checked 22 Oct 2026) in `src/config.py`.
- UX audits: `audits/UX-2026-10-22-deep.md`, `audits/UX-2026-11-03-deep.md`.
- Absent: no user research, traffic data or testimonials. Do not invent any.

## Product Principles

1. Show what the data cannot show as prominently as what it shows.
2. One number, one definition, one population; every published figure traceable to its denominator.
3. Neutral by construction: levers, not verdicts; all cities, not a favourite comparison.
4. Phone first: a first-time visitor should reach the first real chart quickly and be able to stop at any section.
5. Corrections are part of the product, not hidden.

## Accessibility & Inclusion

No product-specific standard was stated. Existing commitments in the code: skip link, text alternatives to charts, collapsed sections that open from a link, `color-scheme: light dark`. Treat WCAG 2.2 AA as the working floor unless the owner says otherwise.
