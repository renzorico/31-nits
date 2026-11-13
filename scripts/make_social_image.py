"""Draw the 1200x630 social preview image (LinkedIn, Open Graph) from the
exported site data, so the picture always matches the page.

Run after export_site_data.py:  python scripts/make_social_image.py
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src import config as cfg

DATA_DIR = cfg.PROJECT_ROOT / "site" / "public" / "data"
OUT_FILE = cfg.PROJECT_ROOT / "site" / "public" / "og-image.png"

WIDTH_PX, HEIGHT_PX, DPI = 1200, 630, 100
MAX_NIGHTS_SHOWN = 45
LATEST_ROUND = "Sep 2026"
OTHER_CITIES = ["madrid", "valencia", "malaga", "sevilla"]

# Same palette as the site's light theme (site/src/styles.css).
BG, TEXT, MUTED = "#fbfaf7", "#1c1c1e", "#5f6368"
UNDER, EXACT, OVER = "#2f6fb3", "#8a8f98", "#e07b24"


def load(name: str):
    return json.loads((DATA_DIR / name).read_text())


def main() -> None:
    nights = [
        r
        for r in load("minimum_nights.json")
        if r["city"] == "barcelona" and r["round"] == LATEST_ROUND
    ]
    total = sum(r["listings"] for r in nights)
    shown = [r for r in nights if r["nights"] <= MAX_NIGHTS_SHOWN]

    cities = {row["city"]: row["rounds"][LATEST_ROUND] for row in load("cities.json")}
    barcelona_share = cities["barcelona"]["share_month_plus"]
    others = [cities[c]["share_month_plus"] for c in OTHER_CITIES]

    fig = plt.figure(figsize=(WIDTH_PX / DPI, HEIGHT_PX / DPI), dpi=DPI, facecolor=BG)

    fig.text(
        0.05,
        0.86,
        "31 nits",
        fontsize=44,
        fontweight="bold",
        color=TEXT,
        va="center",
    )
    fig.text(
        0.05,
        0.74,
        f"{barcelona_share:.0f}% of Barcelona's listings with open dates ask for 31+ nights.",
        fontsize=21,
        color=TEXT,
        va="center",
    )
    fig.text(
        0.05,
        0.665,
        f"In Madrid, Valencia, Málaga and Sevilla: {min(others):.0f}–{max(others):.0f}%.",
        fontsize=21,
        color=MUTED,
        va="center",
    )

    ax = fig.add_axes((0.05, 0.14, 0.9, 0.44), facecolor=BG)
    xs = [r["nights"] for r in shown]
    ys = [r["listings"] / total * 100 for r in shown]
    # Colour by what listings ask (under 31 / exactly 31 / over 31 nights),
    # never by legality: a minimum stay is a setting, not a legal finding.
    colours = [
        UNDER if n < cfg.STAY_LINE_NIGHTS else (EXACT if n == cfg.STAY_LINE_NIGHTS else OVER)
        for n in xs
    ]
    ax.bar(xs, ys, color=colours, width=0.8)
    ax.axvline(cfg.STAY_LINE_NIGHTS, color=TEXT, linestyle="--", linewidth=1.2, zorder=0)
    ax.text(
        cfg.STAY_LINE_NIGHTS - 1,
        max(ys) * 0.92,
        "Catalan tourist-stay limit: 31 days",
        fontsize=13,
        color=MUTED,
        ha="right",
    )
    ax.set_xlim(0.3, MAX_NIGHTS_SHOWN + 0.7)
    ax.set_xticks([1, 10, 20, 31, 40])
    ax.tick_params(colors=MUTED, labelsize=12, length=0)
    ax.set_xlabel(
        "minimum stay asked (nights) · Barcelona listings with open dates, September 2026",
        fontsize=12,
        color=MUTED,
    )
    ax.set_yticks([])
    for side in ["top", "right", "left"]:
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color("#e4e1da")

    fig.text(
        0.05,
        0.035,
        "Barcelona and four Spanish cities · Dec 2025 – Sep 2026 · Inside Airbnb, Ajuntament de Barcelona, Generalitat de Catalunya",
        fontsize=11,
        color=MUTED,
        va="center",
    )

    fig.savefig(OUT_FILE, dpi=DPI, facecolor=BG)
    print(f"wrote {OUT_FILE.relative_to(cfg.PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
