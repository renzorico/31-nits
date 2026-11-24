#!/bin/sh
# Vercel build: the privacy gate runs first, so data that could identify a
# host, listing or flat can never be deployed.
set -eu

VENV=/tmp/privacy-gate
python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet pytest
"$VENV/bin/python" -m pytest -q tests/test_export.py

cd site
npm run build
