"""Download every raw file listed in src/sources.py into data/raw/.

Skips files that already exist, so it is safe to re-run.

Run with:  python scripts/download_data.py
"""

import hashlib
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src import sources as src

USER_AGENT = "31-nits (research; contact via GitHub)"
TIMEOUT_SECONDS = 120


def download(url: str, target: Path) -> None:
    """Fetch one URL to target, writing via a temp file so a failed
    download never leaves a half-written file behind."""
    if target.exists():
        print(f"skip  {target.relative_to(src.RAW_DIR)}")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        partial.write_bytes(response.read())
    partial.rename(target)
    print(
        f"got   {target.relative_to(src.RAW_DIR)}  ({target.stat().st_size / 1e6:.1f} MB)"
    )


def all_downloads() -> list[tuple[str, Path]]:
    jobs = []
    for city, snapshots in src.SNAPSHOTS.items():
        for snapshot in snapshots:
            jobs.append(
                (src.listings_url(city, snapshot), src.listings_path(city, snapshot))
            )
        latest = snapshots[-1]
        jobs.append(
            (
                src.listings_url(city, latest, "neighbourhoods.geojson"),
                src.neighbourhoods_path(city),
            )
        )
    for quarter, url in src.HUT_REGISTER_URLS.items():
        jobs.append((url, src.hut_register_path(quarter)))
    jobs.append((src.rents_url(), src.RENTS_PATH))
    return jobs


def write_manifest(jobs: list[tuple[str, Path]]) -> None:
    """Record url, size, sha256 and retrieval time of every raw file.

    `retrieved_at` is the file's modification time, which is the download
    time for files fetched by this script.
    """
    entries = []
    for url, target in jobs:
        if not target.exists():
            continue
        stat = target.stat()
        entries.append(
            {
                "path": str(target.relative_to(src.RAW_DIR)),
                "url": url,
                "bytes": stat.st_size,
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "retrieved_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(timespec="seconds"),
            }
        )
    src.MANIFEST_PATH.write_text(json.dumps(sorted(entries, key=lambda e: e["path"]), indent=2) + "\n")
    print(f"wrote {src.MANIFEST_PATH.relative_to(src.RAW_DIR.parent.parent)} ({len(entries)} files)")


def main() -> None:
    failures = []
    for url, target in all_downloads():
        try:
            download(url, target)
        except OSError as error:  # URLError and HTTPError are OSErrors
            failures.append(target)
            print(f"FAIL  {target.relative_to(src.RAW_DIR)}: {error}")
    write_manifest(all_downloads())
    if failures:
        sys.exit(f"{len(failures)} download(s) failed - re-run to retry.")


if __name__ == "__main__":
    main()
