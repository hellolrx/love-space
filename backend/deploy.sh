#!/usr/bin/env bash

set -euo pipefail

python3 -m pip install --upgrade "uv>=0.13.4"
uv --version
uv run pywrangler deploy
