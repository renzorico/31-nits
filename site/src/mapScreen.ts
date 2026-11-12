// Dot explorer: every Barcelona listing with open dates, coloured by minimum
// stay. Loaded only when the reader opens it, so MapLibre and the points do
// not slow the page down.
import type { Feature, FeatureCollection, Point } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre runs a web worker; ?url makes Vite emit it and return its final URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import { BANDS, loadPoints, type Band, type Points } from "./data";
import { T } from "./i18n";
import { byId, COLOURS, formatInt, monthShort } from "./story";

maplibregl.setWorkerUrl(workerUrl);

// Free vector basemap, no API key (https://openfreemap.org).
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const BARCELONA: [number, number] = [2.165, 41.393];
const SOURCE_ID = "listings";
const LAYER_ID = "listings-dots";

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

export async function initMapScreen(snapshots: string[], line: number): Promise<void> {
  byId("map").setAttribute("aria-label", T.map.aria);
  byId("map-how").textContent = T.map.how;
  let snapshot = snapshots.at(-1) ?? "";
  const hidden = new Set<Band>();
  let data = toGeoJson(await loadPoints(snapshot));

  const map = new maplibregl.Map({
    container: byId("map"),
    style: STYLE,
    center: BARCELONA,
    zoom: innerWidth < 600 ? 11.2 : 12,
    minZoom: 10,
    maxZoom: 17,
    scrollZoom: false, // the page scrolls; zoom with the buttons or a pinch
    cooperativeGestures: innerWidth < 900,
    attributionControl: { compact: true, customAttribution: T.map.attribution },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  const colour = ["match", ["get", "b"], ...BANDS.flatMap((b) => [b, COLOURS[b]]), COLOURS.other] as unknown as ExpressionSpecification;
  const sortKey = ["match", ["get", "b"], "under_31", 0, "exactly_31", 1, "over_31", 2, 0] as unknown as ExpressionSpecification;
  const filter = (): ExpressionSpecification | null =>
    hidden.size ? (["!", ["in", ["get", "b"], ["literal", [...hidden]]]] as ExpressionSpecification) : null;

  map.on("style.load", () => {
    if (map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, { type: "geojson", data });
    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      layout: { "circle-sort-key": sortKey },
      paint: {
        "circle-color": colour,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 13, 2.6, 16, 6],
        "circle-opacity": 0.85,
        "circle-stroke-color": COLOURS.raised,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 12, 0, 14, 0.6],
      },
    });
    map.setFilter(LAYER_ID, filter());
  });

  const popup = new maplibregl.Popup({ closeButton: false, maxWidth: "260px" });
  map.on("click", LAYER_ID, (event) => {
    const p = event.features?.[0]?.properties;
    if (!p) return;
    const price = p.p === null || p.p === undefined || p.p === "null" ? T.noPrice : T.askingPrice(String(p.p));
    popup
      .setLngLat(event.lngLat)
      .setHTML(`<b>${T.minimum(T.nights(Number(p.n)))}</b><br>${T.band(p.b as Band, line)} · ${T.map.room(String(p.r))}<br>${price}`)
      .addTo(map);
  });
  map.on("mouseenter", LAYER_ID, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", LAYER_ID, () => (map.getCanvas().style.cursor = ""));

  const legend = byId("map-legend");
  const render = () => {
    const counts = new Map<Band, number>(BANDS.map((b) => [b, 0]));
    for (const f of data.features) counts.set(f.properties?.b as Band, (counts.get(f.properties?.b as Band) ?? 0) + 1);
    legend.innerHTML =
      BANDS.map(
        (b) =>
          `<li><button type="button" data-band="${b}" aria-pressed="${!hidden.has(b)}"><i style="background:${COLOURS[b]}"></i>${T.band(b, line)} · ${formatInt(counts.get(b) ?? 0)}</button></li>`,
      ).join("") +
      `<li><span class="view-switch" role="group" aria-label="${T.map.snapshot}">${snapshots
        .map((s) => `<button type="button" data-snapshot="${s}" aria-pressed="${s === snapshot}">${monthShort(s)}</button>`)
        .join("")}</span></li>`;
  };
  legend.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest("button");
    if (!button) return;
    const band = button.dataset.band as Band | undefined;
    if (band) {
      if (hidden.has(band)) hidden.delete(band);
      else hidden.add(band);
      if (map.getLayer(LAYER_ID)) map.setFilter(LAYER_ID, filter());
      render();
      return;
    }
    const next = button.dataset.snapshot;
    if (next && next !== snapshot) {
      snapshot = next;
      data = toGeoJson(await loadPoints(snapshot));
      (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);
      render();
    }
  });
  render();
}
