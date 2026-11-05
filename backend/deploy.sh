#!/usr/bin/env bash

set -euo pipefail

uv self update
uv run pywrangler deploy
