// Neighbourhood choropleths: the atlas maps. One sequential ramp per measure;
// neighbourhoods with too few listings are hatched, not coloured, so a share
// of 4 listings never looks like a finding.
import * as d3 from "d3";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import type { CityRow, NeighbourhoodRow } from "./data";
import { cityName, T } from "./i18n";
import { byId, formatInt, freshSvg, chartHeight, isNarrow, pct, setHtml, setText, widthOf, withTip } from "./story";

export const MIN_LISTINGS = 50; // below this a neighbourhood share is not shown
const LATEST_ROUND = "Sep 2026";

type HoodFeature = Feature<Geometry, { neighbourhood: string; neighbourhood_group: string }>;
export type Hoods = FeatureCollection<Geometry, { neighbourhood: string; neighbourhood_group: string }>;

/** d3-geo wants clockwise outer rings; RFC 7946 files are counter-clockwise. */
function rewind(geo: Hoods): Hoods {
  const fix = (f: HoodFeature): HoodFeature => {
    if (d3.geoArea(f) <= 2 * Math.PI) return f;
    const g = f.geometry;
    if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.map((r) => [...r].reverse()) } };
    if (g.type === "MultiPolygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.map((p) => p.map((r) => [...r].reverse())) } };
    return f;
  };
  return { ...geo, features: geo.features.map(fix) };
}

interface MeasureSpec {
  key: string;
  value: (row: NeighbourhoodRow) => number | null;
  colours: [string, string, string];
  label: string;
  tip: (row: NeighbourhoodRow, value: number) => string;
  aria: string;
}

function rampHtml(spec: MeasureSpec, domain: [number, number]): string {
  const [a, b, c] = spec.colours;
  return (
    `<span>${spec.label}</span><span>${pct(domain[0], 0)}</span><span class="bar" style="background:linear-gradient(90deg,${a},${b},${c})"></span>` +
    `<span>${pct(domain[1], 0)}</span><span class="mask"><i></i>${T.atlas.masked(MIN_LISTINGS)}</span>`
  );
}

function drawChoropleth(rootId: string, rampId: string, geoRaw: Hoods, rows: NeighbourhoodRow[], spec: MeasureSpec): () => void {
  const geo = rewind(geoRaw);
  const byName = new Map(rows.map((r) => [r.neighbourhood, r]));
  const shown = rows.filter((r) => r.active_listings >= MIN_LISTINGS && spec.value(r) !== null);
  const values = shown.map((r) => spec.value(r) ?? 0);
  const domain: [number, number] = [Math.floor((d3.min(values) ?? 0) / 10) * 10, Math.ceil((d3.max(values) ?? 100) / 10) * 10];
  const colour = d3.scaleLinear<string>().domain([domain[0], (domain[0] + domain[1]) / 2, domain[1]]).range(spec.colours).interpolate(d3.interpolateLab).clamp(true);
  setHtml(rampId, rampHtml(spec, domain));
  const root = byId(rootId);

  return () => {
    const W = widthOf(root);
    const narrow = isNarrow();
    const H = chartHeight(W, 420, 720, narrow ? 1.0 : 0.62);
    const svg = freshSvg(root, W, H, spec.aria);
    const defs = svg.append("defs");
    const hatch = defs.append("pattern").attr("id", `hatch-${spec.key}`).attr("width", 5).attr("height", 5).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    hatch.append("rect").attr("width", 5).attr("height", 5).attr("fill", "#e9e4da");
    hatch.append("rect").attr("width", 2).attr("height", 5).attr("fill", "#d6cfc0");

    const projection = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], geo);
    const path = d3.geoPath(projection);
    const fillOf = (f: HoodFeature) => {
      const row = byName.get(f.properties.neighbourhood);
      const v = row ? spec.value(row) : null;
      if (!row || v === null || row.active_listings < MIN_LISTINGS) return `url(#hatch-${spec.key})`;
      return colour(v);
    };
    const hoods = svg
      .append("g")
      .selectAll<SVGPathElement, HoodFeature>("path")
      .data(geo.features as HoodFeature[])
      .join("path")
      .attr("class", "hood")
      .attr("d", path)
      .attr("fill", fillOf);
    withTip(hoods, (f) => {
      const row = byName.get(f.properties.neighbourhood);
      const name = `<b>${f.properties.neighbourhood}</b>`;
      if (!row || row.active_listings < MIN_LISTINGS) return `${name}${T.atlas.tooFew(formatInt(row?.active_listings ?? 0), MIN_LISTINGS)}`;
      const v = spec.value(row);
      return v === null ? name : `${name}${spec.tip(row, v)}`;
    });

    // District names at the listing-weighted centre of their neighbourhoods.
    const districts = d3.rollups(
      geo.features as HoodFeature[],
      (fs) => {
        const pts = fs.map((f) => ({ c: path.centroid(f), w: Math.max(1, d3.geoArea(f)) }));
        const w = d3.sum(pts, (p) => p.w);
        return [d3.sum(pts, (p) => p.c[0] * p.w) / w, d3.sum(pts, (p) => p.c[1] * p.w) / w] as [number, number];
      },
      (f) => f.properties.neighbourhood_group,
    );
    if (!narrow) {
      svg
        .append("g")
        .selectAll("text")
        .data(districts)
        .join("text")
        .attr("class", "place")
        .attr("text-anchor", "middle")
        .attr("x", (d) => d[1][0])
        .attr("y", (d) => d[1][1])
        .text((d) => d[0]);
    }
  };
}

export interface DistrictShare {
  district: string;
  listings: number;
  value: number;
}
/** District shares from neighbourhood rows, weighted by listings. */
export function districtShares(rows: NeighbourhoodRow[], value: (r: NeighbourhoodRow) => number | null): DistrictShare[] {
  const acc = new Map<string, { listings: number; weighted: number }>();
  for (const row of rows) {
    const v = value(row);
    if (v === null) continue;
    const entry = acc.get(row.district) ?? { listings: 0, weighted: 0 };
    entry.listings += row.active_listings;
    entry.weighted += row.active_listings * v;
    acc.set(row.district, entry);
  }
  return [...acc.entries()].map(([district, e]) => ({ district, listings: e.listings, value: e.weighted / e.listings }));
}

const MIN_DISTRICT_LISTINGS = 1000; // districts compared in the month-plus title

export function initAtlas(geo: Hoods, rows: NeighbourhoodRow[], line: number): () => void {
  const districts = districtShares(rows, (r) => r.share_month_plus)
    .filter((d) => d.listings >= MIN_DISTRICT_LISTINGS)
    .sort((a, b) => b.value - a.value);
  const high = districts[0];
  const low = districts.at(-1);
  if (high && low) setText("atlas-title", T.atlas.title(high.district, pct(high.value, 0), line, low.district, pct(low.value, 0)));
  setText("atlas-sub", T.atlas.sub(line, MIN_LISTINGS));
  setText("atlas-how", T.atlas.how);
  setText("explore-summary", T.atlas.explore);
  return drawChoropleth("atlas-chart", "atlas-ramp", geo, rows, {
    key: "monthplus",
    value: (r) => r.share_month_plus,
    colours: ["#f7e6d8", "#e0814f", "#8a2a09"],
    label: T.atlas.rampLabel(line),
    tip: (r, v) => T.atlas.tip(r.district, pct(v), formatInt(r.active_listings), line),
    aria: T.atlas.aria(line),
  });
}

export function initHostsMap(geo: Hoods, rows: NeighbourhoodRow[], cities: CityRow[], professionalMin: number): () => void {
  const bcn = cities.find((c) => c.city === "barcelona");
  const overall = bcn?.rounds[LATEST_ROUND]?.share_professional ?? 0;
  const top = rows
    .filter((r) => r.active_listings >= MIN_LISTINGS * 4 && r.share_professional !== null)
    .sort((a, b) => (b.share_professional ?? 0) - (a.share_professional ?? 0))[0];
  const others = cities
    .filter((c) => c.city !== "barcelona")
    .map((c) => ({ name: cityName(c.city), v: c.rounds[LATEST_ROUND]?.share_professional ?? 0 }))
    .sort((a, b) => b.v - a.v);
  setText("hosts-title", T.hosts.title(pct(overall, 0), professionalMin, top?.neighbourhood ?? "", pct(top?.share_professional ?? 0, 0)));
  setText("hosts-sub", T.hosts.sub(others.map((o) => `${o.name} ${pct(o.v, 0)}`), pct(bcn?.top_host_share.top_1pct ?? 0, 0)));
  setText("hosts-how", T.hosts.how(LATEST_ROUND, professionalMin, MIN_LISTINGS));
  return drawChoropleth("hosts-chart", "hosts-ramp", geo, rows, {
    key: "professional",
    value: (r) => r.share_professional,
    colours: ["#ebe8f3", "#8a7fc4", "#2b2160"],
    label: T.hosts.rampLabel(professionalMin),
    tip: (r, v) => T.hosts.tip(r.district, pct(v), formatInt(r.active_listings), professionalMin),
    aria: T.hosts.aria(pct(overall), professionalMin),
  });
}
