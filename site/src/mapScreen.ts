// Screen: every Barcelona listing with open dates, coloured by minimum stay.
import type { Feature, FeatureCollection, Point } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre runs a web worker; ?url makes Vite emit it and return its final URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import { BANDS, loadPoints, type Band, type NeighbourhoodRow, type Points } from "./data";
import { BAND_LABEL, byId, COLOURS, formatInt, monthYear, pct, setHtml, setText } from "./story";

maplibregl.setWorkerUrl(workerUrl);

// Free vector basemap, no API key (https://openfreemap.org).
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const BARCELONA: [number, number] = [2.165, 41.393];
const SOURCE_ID = "listings";
const LAYER_ID = "listings-dots";
const GLOW_ID = "listings-glow";
const MIN_DISTRICT_LISTINGS = 1000; // districts compared in the title

function toGeoJson(points: Points): FeatureCollection<Point> {
  const features: Feature<Point>[] = points.lat.map((lat, i) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [points.lon[i] ?? 0, lat] },
    properties: {
      b: points.legend.band[points.band[i] ?? 0],
      r: points.legend.room[points.room[i] ?? 0],
      n: points.nights[i],
      p: points.price[i],
    },
  }));
  return { type: "FeatureCollection", features };
}

interface DistrictShare {
  district: string;
  listings: number;
  monthPlus: number;
}

/** District shares from the neighbourhood rows (listings x their month-plus share). */
function districtShares(rows: NeighbourhoodRow[]): DistrictShare[] {
  const byDistrict = new Map<string, { listings: number; monthPlus: number }>();
  for (const row of rows) {
    if (row.share_month_plus === null) continue;
    const entry = byDistrict.get(row.district) ?? { listings: 0, monthPlus: 0 };
    entry.listings += row.active_listings;
    entry.monthPlus += (row.active_listings * row.share_month_plus) / 100;
    byDistrict.set(row.district, entry);
  }
  return [...byDistrict.entries()]
    .map(([district, v]) => ({ district, listings: v.listings, monthPlus: (v.monthPlus / v.listings) * 100 }))
    .sort((a, b) => b.listings - a.listings);
}

export async function initMapScreen(snapshots: string[], neighbourhoods: NeighbourhoodRow[], line: number): Promise<void> {
  const districts = districtShares(neighbourhoods).filter((d) => d.listings >= MIN_DISTRICT_LISTINGS);
  const sorted = [...districts].sort((a, b) => b.monthPlus - a.monthPlus);
  const high = sorted[0];
  const low = sorted.at(-1);
  if (high && low) {
    setText(
      "map-title",
      `In ${high.district}, ${pct(high.monthPlus, 0)} of listings ask for ${line} nights or more; in ${low.district}, ${pct(low.monthPlus, 0)}.`,
    );
  }
  setHtml(
    "map-sub",
    `Every dot is one Airbnb listing with open dates: ${legendDot("under_31")}under ${line} nights, ${legendDot("exactly_31")}exactly ${line}, ${legendDot("over_31")}over ${line}. ` +
      "Hide a group or switch the quarter with the buttons below; tap a dot for its details.",
  );

  let snapshot = snapshots.at(-1) ?? "";
  const hidden = new Set<Band>();
  let data = toGeoJson(await loadPoints(snapshot));

  const map = new maplibregl.Map({
    container: byId("map"),
    style: STYLE_DARK,
    center: BARCELONA,
    zoom: innerWidth < 600 ? 11.2 : 12,
    minZoom: 10,
    maxZoom: 17,
    scrollZoom: false, // the page scrolls; zoom with the buttons or a pinch
    cooperativeGestures: innerWidth < 900, // one finger scrolls the page on phones
    attributionControl: { compact: true, customAttribution: "Listings: Inside Airbnb (CC BY 4.0)" },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  const colour = ["match", ["get", "b"], ...BANDS.flatMap((b) => [b, COLOURS[b]]), COLOURS.other] as unknown as ExpressionSpecification;
  // Rarer groups are drawn on top so they are not buried under the most common one.
  const sortKey = ["match", ["get", "b"], "under_31", 0, "exactly_31", 1, "over_31", 2, 0] as unknown as ExpressionSpecification;
  const filter = (): ExpressionSpecification | null =>
    hidden.size ? (["!", ["in", ["get", "b"], ["literal", [...hidden]]]] as ExpressionSpecification) : null;

  function addLayers(): void {
    if (map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, { type: "geojson", data });
    map.addLayer({
      id: GLOW_ID,
      type: "circle",
      source: SOURCE_ID,
      layout: { "circle-sort-key": sortKey },
      paint: {
        "circle-color": colour,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 13, 6, 16, 12],
        "circle-blur": 1,
        "circle-opacity": 0.18,
      },
    });
    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      layout: { "circle-sort-key": sortKey },
      paint: {
        "circle-color": colour,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 13, 2, 16, 5],
        "circle-opacity": 0.9,
      },
    });
    applyFilter();
  }
  function applyFilter(): void {
    for (const id of [GLOW_ID, LAYER_ID]) if (map.getLayer(id)) map.setFilter(id, filter());
  }
  map.on("style.load", addLayers);

  const popup = new maplibregl.Popup({ closeButton: false, maxWidth: "260px" });
  map.on("click", LAYER_ID, (event) => {
    const p = event.features?.[0]?.properties;
    if (!p) return;
    const band = p.b as Band;
    const price = p.p === null || p.p === undefined || p.p === "null" ? "no price shown" : `asks €${p.p} a night`;
    popup
      .setLngLat(event.lngLat)
      .setHTML(`<b>${p.n} night${p.n === 1 ? "" : "s"} minimum</b><br>${BAND_LABEL[band]} · ${p.r}<br>${price}`)
      .addTo(map);
  });
  map.on("mouseenter", LAYER_ID, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", LAYER_ID, () => (map.getCanvas().style.cursor = ""));

  // Legend: band toggles with live counts, then the quarter switch.
  const legend = byId("map-legend");
  function renderLegend(): void {
    const counts = new Map<Band, number>(BANDS.map((b) => [b, 0]));
    for (const f of data.features) counts.set(f.properties?.b as Band, (counts.get(f.properties?.b as Band) ?? 0) + 1);
    const items = BANDS.map((b) => {
      const label = b === "under_31" ? `Under ${line} nights` : b === "exactly_31" ? `Exactly ${line}` : `Over ${line}`;
      return `<li><button type="button" data-band="${b}" aria-pressed="${!hidden.has(b)}" style="${hidden.has(b) ? "opacity:.45" : ""}"><i style="background:${COLOURS[b]}"></i>${label} · ${formatInt(counts.get(b) ?? 0)}</button></li>`;
    }).join("");
    const switcher = `<li><span class="view-switch" role="group" aria-label="Snapshot">${snapshots
      .map((s) => `<button type="button" data-snapshot="${s}" aria-pressed="${s === snapshot}">${monthYear(s)}</button>`)
      .join("")}</span></li>`;
    legend.innerHTML = items + switcher;
  }
  legend.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest("button");
    if (!button) return;
    const band = button.dataset.band as Band | undefined;
    if (band) {
      if (hidden.has(band)) hidden.delete(band);
      else hidden.add(band);
      applyFilter();
      renderLegend();
      return;
    }
    const next = button.dataset.snapshot;
    if (next && next !== snapshot) {
      snapshot = next;
      data = toGeoJson(await loadPoints(snapshot));
      (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);
      renderLegend();
    }
  });
  renderLegend();
}

function legendDot(band: Band): string {
  return `<i class="sw" style="background:${COLOURS[band]}"></i>`;
}
