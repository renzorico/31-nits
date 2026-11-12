"""Metrics shared by the notebooks and the site export.

Every function takes listings already passed through cleaning.add_columns,
so one definition of each number serves both the analysis and the site.
"""

import numpy as np
import pandas as pd

from . import config as cfg

BANDS = ["under_31", "exactly_31", "over_31"]  # minimum stay asked, vs the 31-night line
# Status of a listing in a later snapshot, used for transitions.
GONE = "gone"
INACTIVE = "inactive"


POPULATION_LABEL = "listings with open dates"


def active(df: pd.DataFrame) -> pd.DataFrame:
    """Listings with at least one open date in the next 365 days - the same
    rule for every snapshot and city (see data/README.md).

    "Active" is shorthand only. An empty calendar can mean booked, blocked or
    withdrawn, so published text says POPULATION_LABEL and calls the rest
    "listed, no open dates".
    """
    return df[df["is_active"]]


def share(mask: pd.Series) -> float:
    """Share of True values, as a percentage rounded for display."""
    return round(float(mask.mean()) * 100, 1) if len(mask) else float("nan")


def snapshot_summary(df: pd.DataFrame) -> dict:
    """Headline numbers for one city snapshot (active listings only).

    Month-plus = minimum stay of 31 nights or more. It is a neutral,
    city-independent measure: the legal tourist/seasonal line differs
    between regions, so cross-city comparisons do not use stay bands.
    """
    act = active(df)
    priced = act[act["price"].between(1, cfg.MAX_PRICE)]
    masks = {
        "share_31_nights": act["minimum_nights"] == cfg.STAY_LINE_NIGHTS,
        "share_month_plus": act["minimum_nights"] >= cfg.STAY_LINE_NIGHTS,
        "share_tourist_licence": act["has_tourist_licence"],
        "share_nrua_seasonal": act["national_licence"] == "nrua_seasonal",
        "share_professional": act["is_professional"],
        "share_entire_home": act["is_entire_home"],
    }
    return {
        "population": POPULATION_LABEL,
        "listings": int(len(df)),
        "active": int(len(act)),
        # [numerator, denominator] behind every share, so each published
        # percentage can be checked against its population.
        "counts": {name: [int(mask.sum()), int(len(mask))] for name, mask in masks.items()},
        "share_31_nights": share(act["minimum_nights"] == cfg.STAY_LINE_NIGHTS),
        "share_month_plus": share(act["minimum_nights"] >= cfg.STAY_LINE_NIGHTS),
        "share_tourist_licence": share(act["has_tourist_licence"]),
        "share_nrua_seasonal": share(act["national_licence"] == "nrua_seasonal"),
        "share_professional": share(act["is_professional"]),
        "share_entire_home": share(act["is_entire_home"]),
        "median_price": float(priced["price"].median()) if len(priced) else None,
    }


def band_counts(df: pd.DataFrame) -> dict:
    """Active listings per stay band (Catalan legal line)."""
    counts = active(df)["stay_band"].value_counts()
    return {band: int(counts.get(band, 0)) for band in BANDS}


def concentration_curve(df: pd.DataFrame, points: int = 50) -> pd.DataFrame:
    """Lorenz-style curve: the top X% of hosts run Y% of active listings.

    Hosts are ranked from largest to smallest so the curve reads
    "the biggest 1% of hosts run ...". Uses host_id, never host names.
    """
    per_host = active(df).groupby("host_id")["id"].count().sort_values(ascending=False)
    host_share = np.arange(1, len(per_host) + 1) / len(per_host) * 100
    listing_share = per_host.cumsum().to_numpy() / per_host.sum() * 100
    picks = np.unique(np.linspace(0, len(per_host) - 1, points).round().astype(int))
    return pd.DataFrame(
        {
            "host_share": host_share[picks].round(2),
            "listing_share": listing_share[picks].round(2),
        }
    )


def top_host_share(df: pd.DataFrame, top_percent: float) -> float:
    """Share of active listings run by the largest top_percent of hosts."""
    curve = concentration_curve(df, points=1000)
    return float(
        np.interp(top_percent, curve["host_share"], curve["listing_share"]).round(1)
    )


def status_in(later: pd.DataFrame) -> pd.Series:
    """Each listing's status in a later snapshot: its stay band if
    active, otherwise 'inactive'. Indexed by listing id."""
    status = later["stay_band"].astype("object").where(later["is_active"], INACTIVE)
    return status.set_axis(later["id"]).fillna(INACTIVE)


def transitions(earlier: pd.DataFrame, later: pd.DataFrame) -> pd.DataFrame:
    """Where did the active listings of `earlier` end up in `later`?

    Rows: stay band in the earlier snapshot. Columns: stay band in the
    later one, 'inactive' (still listed, no open dates) or 'gone'
    (no longer in the file). Values are listing counts.
    """
    start = active(earlier).set_index("id")["stay_band"]
    end = status_in(later).reindex(start.index).fillna(GONE)
    order = BANDS + [INACTIVE, GONE]
    table = pd.crosstab(start, end).reindex(index=BANDS, columns=order, fill_value=0)
    return table.astype(int)


def exit_gap(table: pd.DataFrame) -> tuple[float, float]:
    """From a transitions table: (exit rate of month-plus listings) minus
    (exit rate of tourist listings), in percentage points, with its
    standard error. Month-plus = boundary + seasonal (31+ nights)."""
    month_plus = table.loc[["exactly_31", "over_31"]].sum()
    shorter = table.loc["under_31"]
    p1, n1 = month_plus[GONE] / month_plus.sum(), month_plus.sum()
    p2, n2 = shorter[GONE] / shorter.sum(), shorter.sum()
    se = np.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)
    return float((p1 - p2) * 100), float(se * 100)


def availability_sensitivity(df: pd.DataFrame) -> dict:
    """How the 31+ share changes with the population definition.

    An empty calendar is ambiguous, so the share is shown for three
    populations. Unknown minimum stays are counted separately and never
    treated as short stays.
    """
    open_dates = df["availability_365"] > 0
    reviewed = df["number_of_reviews_ltm"] > 0
    populations = {
        "open_dates": open_dates,
        "open_dates_or_reviewed_12m": open_dates | reviewed,
        "all_listings": pd.Series(True, index=df.index),
    }
    result = {}
    for name, mask in populations.items():
        selected = df.loc[mask]
        known = selected.loc[selected["minimum_nights"].notna()]
        result[name] = {
            "listings": int(len(selected)),
            "unknown_minimum_stay": int(selected["minimum_nights"].isna().sum()),
            "known_minimum_stay": int(len(known)),
            "month_plus_pct": share(known["minimum_nights"] >= cfg.STAY_LINE_NIGHTS),
        }
    return result


BOOTSTRAP_DRAWS = 3000
CI_PERCENTILES = (2.5, 97.5)


def exit_gap_cohort(earlier: pd.DataFrame, later: pd.DataFrame) -> pd.DataFrame:
    """One row per host account: how many of its listings with open dates in
    `earlier` were month-plus / shorter, and how many of each are absent from
    `later`. Columns: month_n, month_gone, short_n, short_gone.

    A listing without a host id is its own account, so missing ids never
    glue unrelated listings together.
    """
    cohort = active(earlier).copy()
    cohort["month_plus"] = cohort["minimum_nights"] >= cfg.STAY_LINE_NIGHTS
    cohort["gone"] = ~cohort["id"].isin(later["id"])
    unknown = cohort["host_id"].isna()
    cohort.loc[unknown, "host_id"] = -1 - np.arange(int(unknown.sum()))
    cohort["month_gone"] = cohort["month_plus"] & cohort["gone"]
    cohort["short_gone"] = ~cohort["month_plus"] & cohort["gone"]
    cohort["short_plus"] = ~cohort["month_plus"]
    accounts = cohort.groupby("host_id").agg(
        month_n=("month_plus", "sum"),
        month_gone=("month_gone", "sum"),
        short_n=("short_plus", "sum"),
        short_gone=("short_gone", "sum"),
    )
    return accounts.astype(int)


def exit_shares(accounts: pd.DataFrame) -> dict:
    """Share of month-plus and of shorter-stay listings absent from the later
    snapshot, in percent: the two terms whose difference is the exit gap."""
    totals = accounts[["month_n", "month_gone", "short_n", "short_gone"]].sum()
    return {
        "month_plus_gone_pct": round(100 * totals["month_gone"] / totals["month_n"], 1),
        "shorter_gone_pct": round(100 * totals["short_gone"] / totals["short_n"], 1),
    }


def _gap(totals: np.ndarray) -> float:
    month_n, month_gone, short_n, short_gone = totals
    return 100 * (month_gone / month_n - short_gone / short_n)


def exit_gap_draws(accounts: pd.DataFrame, draws: int = BOOTSTRAP_DRAWS, seed: int = cfg.SEED) -> np.ndarray:
    """Bootstrap draws of the exit gap, resampling whole host accounts.

    One operator can withdraw many listings together, so listings are not
    independent; resampling accounts keeps that dependence. This is a
    sensitivity estimate of sampling variation. It does not cover scrape
    omissions, platform changes or confounding, and it is not an estimate of
    any policy's effect.
    """
    counts = accounts[["month_n", "month_gone", "short_n", "short_gone"]].to_numpy()
    rng = np.random.default_rng(seed)
    gaps = np.empty(draws)
    for i in range(draws):
        gaps[i] = _gap(counts[rng.integers(0, len(counts), len(counts))].sum(axis=0))
    return gaps


def percentile_interval(values: np.ndarray) -> tuple[float, float]:
    low, high = np.percentile(values, CI_PERCENTILES)
    return round(float(low), 1), round(float(high), 1)


def contrast_draws(first: np.ndarray, second: np.ndarray) -> np.ndarray:
    """Draws of (first gap - second gap) for two cities. Their host accounts
    are separate, so the two bootstrap streams are independent."""
    return first - second


def top_account_share(accounts: pd.DataFrame, top: int = 10) -> float:
    """Share of month-plus listings held by the `top` largest accounts."""
    by_account = accounts["month_n"].sort_values(ascending=False)
    return round(float(by_account.head(top).sum() / by_account.sum()) * 100, 1)
