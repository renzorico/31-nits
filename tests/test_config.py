"""The policy records feed the website and README, so they are checked for
completeness and sane dates.

Run with:  python -m pytest -q
"""
import sys
from datetime import date
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src import config as cfg
from src.sources import CITY_PATHS

REQUIRED_KEYS = {
    "title", "timeline_label", "jurisdiction", "applies_to", "mechanism",
    "rule", "exceptions", "law", "applies_from", "deadline", "status",
    "status_checked_on", "sources", "notes", "data_limits",
}


def test_every_lever_has_the_full_record():
    for name, lever in cfg.POLICY_LEVERS.items():
        assert set(lever) == REQUIRED_KEYS | {"i18n"}, name


TRANSLATED_FIELDS = {"title", "timeline_label", "jurisdiction", "rule", "exceptions", "status", "notes", "data_limits"}


def test_every_lever_is_translated_to_spanish_and_catalan():
    for name, lever in cfg.POLICY_LEVERS.items():
        assert set(lever["i18n"]) == {"es", "ca"}, name
        for lang, texts in lever["i18n"].items():
            assert set(texts) == TRANSLATED_FIELDS, (name, lang)
            assert len(texts["exceptions"]) == len(lever["exceptions"]), (name, lang)
            # an empty English field stays empty, a filled one is filled
            for field in TRANSLATED_FIELDS - {"exceptions"}:
                assert bool(texts[field]) == bool(lever[field]), (name, lang, field)


def test_later_developments_are_translated():
    for later in cfg.POST_OBSERVATION_DEVELOPMENTS:
        assert set(later["i18n"]) == {"es", "ca"}, later["date"]
        for lang, texts in later["i18n"].items():
            assert {"title", "summary", "note"} <= set(texts), (later["date"], lang)


def test_lever_dates_and_cities_are_valid():
    for name, lever in cfg.POLICY_LEVERS.items():
        start = date.fromisoformat(lever["applies_from"])
        if lever["deadline"]:
            assert date.fromisoformat(lever["deadline"]) > start, name
        assert date.fromisoformat(lever["status_checked_on"]) <= date.today(), name
        assert lever["applies_to"] and set(lever["applies_to"]) <= set(CITY_PATHS), name
        assert lever["sources"] and all(s["url"].startswith("https://") for s in lever["sources"]), name


def test_each_comparison_city_is_covered_by_an_owners_rule():
    covered = {
        city
        for lever in cfg.POLICY_LEVERS.values()
        if "owners" in lever["timeline_label"].lower()
        for city in lever["applies_to"]
    }
    assert covered == set(CITY_PATHS)


def test_post_observation_developments_come_after_the_window():
    for item in cfg.POST_OBSERVATION_DEVELOPMENTS:
        assert item["date"] > cfg.OBSERVATION_WINDOW[1], item["title"]
