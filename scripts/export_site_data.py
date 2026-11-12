"""Export the aggregated data the website reads, into site/public/data/.

Every number comes from the same functions the notebooks use (src/metrics.py,
src/official.py), so the site and the analysis cannot disagree.

PRIVACY: nothing exported identifies a host or a flat. No listing ids, host
ids, names, licence text or addresses. Map points carry only Inside Airbnb's
already-offset coordinates plus a few categories. tests/test_export.py scans
the output for forbidden fields.

Run with:  python scripts/export_site_data.py
"""

import hashlib
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src import cleaning, metrics, official
from src import config as cfg
from src import sources as src

OUT_DIR = cfg.PROJECT_ROOT / "site" / "public" / "data"
COORD_DECIMALS = 4  # ~11 m; Inside Airbnb already offsets points up to 150 m
GEOJSON_DECIMALS = 5  # ~1 m; enough for neighbourhood outlines
MIN_NIGHTS_CAP = 120  # longer minimum stays are grouped into one "120+" bar
CURVE_POINTS = 500  # dense enough that the site can interpolate "top 1%" accurately
HOST_SIZE_BUCKETS = [(1, 1, "1"), (2, 4, "2-4"), (5, 19, "5-19"), (20, np.inf, "20+")]
# A few listings have no host-listing count (0.8% in Jun 2026).
HOST_SIZE_LABELS = [label for _, _, label in HOST_SIZE_BUCKETS] + ["unknown"]

# Small integer codes keep the per-listing map files light on phones.
BAND_CODES = {band: i for i, band in enumerate(metrics.BANDS)}
LICENCE_CODES = {
    name: i
    for i, name in enumerate(
        [
            "tourist_flat",
            "hotel_or_hostel",
            "other_code",
            "exempt_seasonal",
            "exempt_other",
            "missing",
            "other",
        ]
    )
}
ROOM_CODES = {
    name: i
    for i, name in enumerate(
        ["Entire home/apt", "Private room", "Shared room", "Hotel room"]
    )
}


def write_json(name: str, payload: object) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    )
    print(
        f"wrote {path.relative_to(cfg.PROJECT_ROOT)}  ({path.stat().st_size / 1e3:.0f} kB)"
    )


def clean_number(value: object) -> object:
    """JSON has no NaN: turn missing numbers into null."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    return value.item() if hasattr(value, "item") else value


def json_safe(obj: object) -> object:
    """Recursively replace NaN (and numpy scalars) so the payload is valid JSON."""
    if isinstance(obj, dict):
        return {key: json_safe(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(value) for value in obj]
    return clean_number(obj)


def round_label(city: str, snapshot: str) -> str:
    """'Dec 2025' / 'Sep 2026' etc. Snapshot days differ between cities."""
    return pd.Timestamp(snapshot).strftime("%b %Y")


def host_size(count: pd.Series) -> pd.Series:
    labels = pd.Series("unknown", index=count.index)
    for low, high, label in HOST_SIZE_BUCKETS:
        labels[(count >= low) & (count <= high)] = label
    return labels


# ---- datasets ----------------------------------------------------------


def provenance() -> dict:
    """Tie this export to its inputs: the raw-data manifest and the config."""
    manifest = src.MANIFEST_PATH.read_bytes() if src.MANIFEST_PATH.exists() else b""
    return {
        "raw_manifest_sha256": hashlib.sha256(manifest).hexdigest() if manifest else None,
        "raw_files": len(json.loads(manifest)) if manifest else 0,
        "config_sha256": hashlib.sha256((cfg.PROJECT_ROOT / "src" / "config.py").read_bytes()).hexdigest(),
    }


def meta() -> dict:
    return {
        "generated": date.today().isoformat(),
        "provenance": provenance(),
        "snapshots": src.SNAPSHOTS,
        "policy_levers": cfg.POLICY_LEVERS,
        "levers_as_of": cfg.LEVERS_AS_OF,
        "observation_window": cfg.OBSERVATION_WINDOW,
        "post_observation_developments": cfg.POST_OBSERVATION_DEVELOPMENTS,
        "context_events": cfg.CONTEXT_EVENTS,
        "stay_line_nights": cfg.STAY_LINE_NIGHTS,
        "professional_min": cfg.PROFESSIONAL_MIN,
        "author": cfg.AUTHOR,
        "published_on": cfg.PUBLISHED_ON,
        "sources": [
            {
                "title": "Inside Airbnb",
                "url": "https://insideairbnb.com/get-the-data/",
                "licence": "CC BY 4.0",
            },
            {
                "title": "Ajuntament de Barcelona - Habitatges d'ús turístic",
                "url": src.HUT_REGISTER_DATASET,
                "licence": "CC BY 4.0",
            },
            {
                "title": "Generalitat de Catalunya - Preu mitjà del lloguer (Incasòl)",
                "url": src.RENTS_DATASET,
                "licence": "CC BY 4.0",
            },
        ],
        "caveats": CAVEATS["en"],
        "caveats_i18n": {"es": CAVEATS["es"], "ca": CAVEATS["ca"]},
    }


# Reader-facing caveats, in the three site languages (same facts, same order).
CAVEATS = {
    "en": [
            "Prices are asking prices, not what guests paid; every Dec 2025 snapshot has no prices.",
            "The population is listings with at least one open date in the next 365 days. An empty calendar can mean booked, blocked or withdrawn, and listings with no open dates jump to ~22-24% in every city's Sep 2026 snapshot. The 31+ share in Barcelona is 41.7% / 41.5% / 39.9% under three population definitions.",
            "A listing that is absent from a later scrape may have been withdrawn, re-listed under a new id, or missed by the scrape.",
            "Tourist-licence shares outside Catalonia are a lower bound: only confirmed regional codes are counted.",
            "A missing or unmatched licence number is not proof of an illegal listing.",
            "Airbnb's licence form changed: the 'Exempt - seasonal rental' option appears in Barcelona between Mar and Jun 2026 and is used in Madrid and Valencia by Sep 2026, but almost never in Málaga or Sevilla, so licence categories are not comparable across those dates.",
            "Comparisons show timing and differences, not causes.",
        ],
    "es": [
        "Los precios son precios pedidos, no lo que pagaron los huéspedes; ninguna captura de dic. 2025 tiene precios.",
        "La población son los anuncios con al menos una fecha disponible en los 365 días siguientes. Un calendario vacío puede significar reservado, bloqueado o retirado, y los anuncios sin fechas disponibles suben a un 22-24 % en la captura de sept. 2026 de todas las ciudades. La proporción de 31+ noches en Barcelona es del 41,7 % / 41,5 % / 39,9 % con tres definiciones de población.",
        "Un anuncio ausente de una captura posterior puede haberse retirado, haberse vuelto a publicar con otro identificador o no haber sido captado.",
        "Las proporciones de licencia turística fuera de Cataluña son un mínimo: solo se cuentan los códigos autonómicos confirmados.",
        "Un número de licencia ausente o que no coincide no prueba que un anuncio sea ilegal.",
        "El formulario de licencia de Airbnb cambió: la opción «Exento - alquiler de temporada» aparece en Barcelona entre mar. y jun. 2026 y se usa en Madrid y Valencia en sept. 2026, pero casi nunca en Málaga o Sevilla, así que las categorías de licencia no son comparables entre esas fechas.",
        "Las comparaciones muestran momentos y diferencias, no causas.",
    ],
    "ca": [
        "Els preus són preus demanats, no el que van pagar els hostes; cap captura del des. 2025 no té preus.",
        "La població són els anuncis amb almenys una data disponible en els 365 dies següents. Un calendari buit pot voler dir reservat, bloquejat o retirat, i els anuncis sense dates disponibles pugen a un 22-24 % a la captura del set. 2026 de totes les ciutats. La proporció de 31+ nits a Barcelona és del 41,7 % / 41,5 % / 39,9 % amb tres definicions de població.",
        "Un anunci absent d'una captura posterior pot haver estat retirat, tornat a publicar amb un altre identificador o no captat.",
        "Les proporcions de llicència turística fora de Catalunya són un mínim: només es compten els codis autonòmics confirmats.",
        "Un número de llicència absent o que no coincideix no prova que un anunci sigui il·legal.",
        "El formulari de llicència d'Airbnb va canviar: l'opció «Exempt - lloguer de temporada» apareix a Barcelona entre el març i el juny del 2026 i s'usa a Madrid i València el set. 2026, però gairebé mai a Màlaga o Sevilla, de manera que les categories de llicència no són comparables entre aquestes dates.",
        "Les comparacions mostren moments i diferències, no causes.",
    ],
}


def map_points(df: pd.DataFrame) -> dict:
    """Columnar arrays for one snapshot's listings with open dates."""
    act = metrics.active(df)
    price = act["price"].where(act["price"].between(1, cfg.MAX_PRICE))
    return {
        "legend": {
            "band": metrics.BANDS,
            "licence": list(LICENCE_CODES),
            "room": list(ROOM_CODES),
            "host_size": HOST_SIZE_LABELS,
        },
        "lat": act["latitude"].round(COORD_DECIMALS).tolist(),
        "lon": act["longitude"].round(COORD_DECIMALS).tolist(),
        "band": act["stay_band"].map(BAND_CODES).astype(int).tolist(),
        "licence": act["regional_licence"].map(LICENCE_CODES).astype(int).tolist(),
        "room": act["room_type"].map(ROOM_CODES).astype(int).tolist(),
        "host_size": host_size(act["calculated_host_listings_count"])
        .map({label: i for i, label in enumerate(HOST_SIZE_LABELS)})
        .astype(int)
        .tolist(),
        "nights": act["minimum_nights"].astype(int).tolist(),
        "price": [clean_number(p) for p in price.round(0)],
    }


def minimum_nights(snapshots: dict) -> list:
    """Listings with open dates per minimum stay, with median asking price per bar."""
    rows = []
    for (city, snapshot), df in snapshots.items():
        act = metrics.active(df)
        nights = act["minimum_nights"].clip(upper=MIN_NIGHTS_CAP).astype(int)
        price = act["price"].where(act["price"].between(1, cfg.MAX_PRICE))
        grouped = pd.DataFrame({"nights": nights, "price": price}).groupby("nights")
        for value, group in grouped:
            rows.append(
                {
                    "city": city,
                    "snapshot": snapshot,
                    "round": round_label(city, snapshot),
                    "nights": int(value),
                    "listings": int(len(group)),
                    "median_price": clean_number(group["price"].median()),
                }
            )
    return rows


def barcelona_trends(snapshots: dict) -> list:
    rows = []
    for snapshot in src.SNAPSHOTS["barcelona"]:
        act = metrics.active(snapshots[("barcelona", snapshot)])
        priced = act[act["price"].between(1, cfg.MAX_PRICE)]
        rows.append(
            {
                "snapshot": snapshot,
                "bands": metrics.band_counts(snapshots[("barcelona", snapshot)]),
                "regional_licence": act["regional_licence"].value_counts().to_dict(),
                "national_licence": act["national_licence"].value_counts().to_dict(),
                "median_price_by_band": {
                    band: clean_number(
                        priced.loc[priced["stay_band"] == band, "price"].median()
                    )
                    for band in metrics.BANDS
                },
            }
        )
    return rows


def transitions(snapshots: dict) -> dict:
    """Dec -> Sep flows per city, plus consecutive quarters for Barcelona."""

    def table_payload(earlier, later):
        table = metrics.transitions(earlier, later)
        return {
            "from": table.index.tolist(),
            "to": table.columns.tolist(),
            "counts": table.to_numpy().tolist(),
        }

    out = {"cities": {}, "barcelona_quarters": []}
    for city, dates in src.SNAPSHOTS.items():
        out["cities"][city] = {
            "from_snapshot": dates[0],
            "to_snapshot": dates[-1],
            **table_payload(snapshots[(city, dates[0])], snapshots[(city, dates[-1])]),
        }
    bcn = src.SNAPSHOTS["barcelona"]
    for earlier, later in zip(bcn, bcn[1:]):
        out["barcelona_quarters"].append(
            {
                "from_snapshot": earlier,
                "to_snapshot": later,
                **table_payload(
                    snapshots[("barcelona", earlier)], snapshots[("barcelona", later)]
                ),
            }
        )
    return out


def exit_gap_estimates(snapshots: dict) -> dict:
    """Exit gap per city with host-account bootstrap intervals, plus the
    Barcelona-minus-city contrast for each comparison city.

    The earlier listing-level interval treats every listing as independent
    and is kept only to show how much narrower it is. Each city has its own
    seed (cfg.SEED + its position in src.SNAPSHOTS) so results do not depend
    on the order cities are processed.
    """
    estimates, draws = {}, {}
    for index, (city, dates) in enumerate(src.SNAPSHOTS.items()):
        earlier, later = snapshots[(city, dates[0])], snapshots[(city, dates[-1])]
        accounts = metrics.exit_gap_cohort(earlier, later)
        draws[city] = metrics.exit_gap_draws(accounts, seed=cfg.SEED + index)
        gap, se = metrics.exit_gap(metrics.transitions(earlier, later))
        low, high = metrics.percentile_interval(draws[city])
        estimates[city] = {
            "points": round(gap, 1),
            "ci_low": low,
            "ci_high": high,
            "method": f"{metrics.BOOTSTRAP_DRAWS} bootstrap draws resampling host accounts, 95% percentile interval",
            "listing_level_ci_low": round(gap - 1.96 * se, 1),
            "listing_level_ci_high": round(gap + 1.96 * se, 1),
            "accounts": int(len(accounts)),
            "month_plus_listings": int(accounts["month_n"].sum()),
            "shorter_listings": int(accounts["short_n"].sum()),
            **metrics.exit_shares(accounts),
            "from": dates[0],
            "to": dates[-1],
            "top10_accounts_share_of_month_plus_pct": metrics.top_account_share(accounts),
            "vs_barcelona": None,
        }
    for city in src.SNAPSHOTS:
        if city == "barcelona":
            continue
        difference = metrics.contrast_draws(draws["barcelona"], draws[city])
        low, high = metrics.percentile_interval(difference)
        estimates[city]["vs_barcelona"] = {
            "difference_points": round(estimates["barcelona"]["points"] - estimates[city]["points"], 1),
            "ci_low": low,
            "ci_high": high,
        }
    return estimates


def cities(snapshots: dict) -> list:
    estimates = exit_gap_estimates(snapshots)
    rows = []
    for city, dates in src.SNAPSHOTS.items():
        rows.append(
            {
                "city": city,
                "rounds": {
                    round_label(city, d): metrics.snapshot_summary(snapshots[(city, d)])
                    for d in dates
                },
                # Exact scrape days: the five cities were not observed on the
                # same dates.
                "scrape_dates": {round_label(city, d): d for d in dates},
                "availability_sensitivity": metrics.availability_sensitivity(
                    snapshots[(city, dates[-1])]
                ),
                "exit_gap": estimates[city],
                "top_host_share": {
                    f"top_{p}pct": metrics.top_host_share(
                        snapshots[(city, dates[-1])], p
                    )
                    for p in (1, 5, 10)
                },
            }
        )
    # snapshot_summary holds NaN prices for Dec 2025
    return json_safe(rows)


def concentration(snapshots: dict) -> dict:
    return {
        city: metrics.concentration_curve(
            snapshots[(city, dates[-1])], points=CURVE_POINTS
        ).to_dict(orient="list")
        for city, dates in src.SNAPSHOTS.items()
    }


def polygons_of(geometry: dict) -> list:
    """The polygons of a Polygon or MultiPolygon geometry."""
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return list(geometry["coordinates"])


def neighbourhoods(snapshots: dict) -> tuple[list, dict, dict]:
    """One row and one outline per neighbourhood (Barcelona, latest snapshot),
    plus a reconciliation of the totals.

    The source geojson splits some neighbourhoods into several pieces
    (Vallvidrera has three). Pieces are merged into one MultiPolygon so each
    neighbourhood is counted once. Register records whose neighbourhood has no
    outline are reported in the reconciliation, never dropped silently.
    """
    latest_quarter = list(src.HUT_REGISTER_URLS)[-1]
    act = metrics.active(snapshots[("barcelona", src.SNAPSHOTS["barcelona"][-1])])
    key = act["neighbourhood"].map(official.normalise_place_name)
    priced = act["price"].where(act["price"].between(1, cfg.MAX_PRICE))
    register_counts = official.hut_counts_by_neighbourhood(latest_quarter)
    table = pd.DataFrame(
        {
            "active_listings": act.groupby(key)["id"].count(),
            "with_tourist_licence": act.groupby(key)["has_tourist_licence"].sum(),
            "share_month_plus": act.groupby(key)["minimum_nights"].apply(
                lambda n: metrics.share(n >= cfg.STAY_LINE_NIGHTS)
            ),
            "share_professional": act.groupby(key)["is_professional"].apply(
                metrics.share
            ),
            "median_price": priced.groupby(key).median().round(0),
        }
    ).join(register_counts, how="outer")

    geo = json.loads(src.neighbourhoods_path("barcelona").read_text())
    pieces: dict[str, dict] = {}
    for feature in geo["features"]:
        props = feature["properties"]
        name_key = official.normalise_place_name(props["neighbourhood"])
        entry = pieces.setdefault(name_key, {"props": props, "polygons": []})
        entry["polygons"].extend(polygons_of(feature["geometry"]))

    rows, features = [], []
    for name_key, entry in pieces.items():
        props = entry["props"]
        values = (
            table.loc[name_key] if name_key in table.index else pd.Series(dtype=float)
        )
        row = {
            "neighbourhood": props["neighbourhood"],
            "district": props["neighbourhood_group"],
        }
        for column in table.columns:
            row[column] = clean_number(values.get(column, np.nan))
        for column in ["active_listings", "with_tourist_licence", "registered_huts"]:
            row[column] = int(row[column] or 0)
        rows.append(row)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "neighbourhood": props["neighbourhood"],
                    "neighbourhood_group": props["neighbourhood_group"],
                },
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": round_coordinates(entry["polygons"]),
                },
            }
        )

    unplaced = register_counts[~register_counts.index.isin(pieces)]
    reconciliation = {
        "listings_total": int(len(act)),
        "listings_in_neighbourhood_rows": sum(r["active_listings"] for r in rows),
        "register_total": int(register_counts.sum()),
        "register_in_neighbourhood_rows": sum(r["registered_huts"] for r in rows),
        "register_without_known_neighbourhood": int(unplaced.sum()),
    }
    outlines = {"type": "FeatureCollection", "features": features}
    return rows, outlines, reconciliation


def round_coordinates(coords):
    if isinstance(coords, (int, float)):
        return round(coords, GEOJSON_DECIMALS)
    return [round_coordinates(c) for c in coords]


def register(snapshots: dict, reconciliation: dict) -> dict:
    """How the HUT numbers shown on listings with open dates relate to the
    official register.

    Units, kept apart on purpose: register *records* (case ids, the headline
    stock), register *numbers* (distinct parseable HUT numbers, a few records
    have none) and *listings*. Each Airbnb snapshot is matched to the register
    quarter nearest in time. A match shows that a number exists in the
    register; it does not verify that the listing belongs to that property,
    and it cannot show how many licensed flats are absent from Airbnb.
    """
    latest_quarter = list(src.HUT_REGISTER_URLS)[-1]
    numbers_by_quarter: dict[str, set] = {}
    match = []
    for snapshot in src.SNAPSHOTS["barcelona"]:
        quarter = official.register_quarter_for(snapshot)
        if quarter not in numbers_by_quarter:
            numbers_by_quarter[quarter] = official.registered_hut_numbers(quarter)
        numbers = numbers_by_quarter[quarter]
        shown = (
            metrics.active(snapshots[("barcelona", snapshot)])["license"]
            .map(cleaning.listing_hut_number)
            .dropna()
        )
        match.append(
            {
                "snapshot": snapshot,
                "register_quarter": quarter,
                "register_records": official.register_record_count(quarter),
                "register_numbers": len(numbers),
                **official.summarise_match(shown, numbers),
            }
        )
    return {
        "register_quarter": latest_quarter,
        "totals": official.hut_totals().to_dict(),
        "match": match,
        "match_population": "listings with open dates",
        "neighbourhood_reconciliation": reconciliation,
    }


def rents() -> list:
    series = official.load_rents()
    series["yoy_pct"] = (series["avg_rent"].pct_change(4) * 100).round(1)
    series["quarter_start"] = series["quarter_start"].dt.strftime("%Y-%m-%d")
    return [
        {k: clean_number(v) for k, v in row.items()}
        for row in series.to_dict(orient="records")
    ]


def main() -> None:
    snapshots = {
        (city, snapshot): cleaning.add_columns(cleaning.load_snapshot(city, snapshot))
        for city, dates in src.SNAPSHOTS.items()
        for snapshot in dates
    }
    write_json("meta.json", meta())
    for snapshot in src.SNAPSHOTS["barcelona"]:
        write_json(
            f"barcelona_points_{snapshot}.json",
            map_points(snapshots[("barcelona", snapshot)]),
        )
    write_json("minimum_nights.json", minimum_nights(snapshots))
    write_json("barcelona_trends.json", barcelona_trends(snapshots))
    write_json("transitions.json", transitions(snapshots))
    write_json("cities.json", cities(snapshots))
    write_json("concentration.json", concentration(snapshots))
    table, outlines, reconciliation = neighbourhoods(snapshots)
    write_json("neighbourhoods.json", table)
    write_json("neighbourhoods.geojson", outlines)
    write_json("register.json", register(snapshots, reconciliation))
    write_json("rents.json", rents())


if __name__ == "__main__":
    main()
