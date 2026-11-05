#!/usr/bin/env bash
#
# love-space 部署同步脚本
# 作用：把网站部署所需文件精确同步到 dist/ 目录（不含 .git），供 Cloudflare Pages 部署
# 范围：index.html、apps/、_headers、site.webmanifest
# 用法：
#   1. cd /workspace/love-space
#   2. ./deploy.sh
#   3. npx wrangler pages deploy dist --project-name=welcome-zjt
#

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
DIST="$ROOT/dist"

mkdir -p "$DIST"

echo "→ 同步网站文件到 dist/ ..."

# 用 include 白名单精确镜像，dist/ 里只会出现下面这些项目
rsync -a --delete \
  --include 'index.html' \
  --include 'apps/' \
  --include 'apps/**' \
  --include 'functions/' \
  --include 'functions/**' \
  --include '_headers' \
  --include 'site.webmanifest' \
  --exclude '*' \
  "$FRONTEND/" "$DIST/"

echo "→ 同步完成"
echo "  dist/ 大小: $(du -sh "$DIST" | cut -f1)"
echo "  文件总数:   $(find "$DIST" -type f | wc -l)"
echo "  单文件上限: $(find "$DIST" -type f -printf '%s\n' | sort -rn | head -1 | awk '{printf "%.2f MiB\n", $1/1048576}')"
echo
echo "→ 下一步：把 dist/ 整个文件夹上传到 Cloudflare Pages，或运行："
echo "  npx wrangler pages deploy dist --project-name=<你的项目名>"
