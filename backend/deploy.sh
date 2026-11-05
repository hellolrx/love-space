#!/usr/bin/env bash

set -euo pipefail

uv_install_dir="$(mktemp -d)"
trap 'rm -rf "$uv_install_dir"' EXIT

python3 -m pip install --upgrade --prefix "$uv_install_dir" "uv>=0.13.4"
export PATH="$uv_install_dir/bin:$PATH"
uv --version
uv run pywrangler deploy
