#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

UPSTREAM_REPO=${UPSTREAM_REPO:-https://github.com/sst/models.dev.git}
UPSTREAM_BRANCH=${UPSTREAM_BRANCH:-}
VENDOR_PREFIX=${VENDOR_PREFIX:-vendor/models.dev}

if [ -z "$UPSTREAM_BRANCH" ]; then
  UPSTREAM_BRANCH=$(git ls-remote --symref "$UPSTREAM_REPO" HEAD | awk '/^ref:/{gsub("refs\/heads\/","",$2); print $2; exit}')
fi

if [ -z "$UPSTREAM_BRANCH" ]; then
  echo "Failed to determine upstream branch for $UPSTREAM_REPO" >&2
  exit 1
fi

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Refreshing $VENDOR_PREFIX from $UPSTREAM_REPO#$UPSTREAM_BRANCH"

git clone --depth 1 --branch "$UPSTREAM_BRANCH" "$UPSTREAM_REPO" "$TMP_DIR/upstream" >/dev/null

mkdir -p "$(dirname "$VENDOR_PREFIX")"

if command -v rsync >/dev/null 2>&1; then
  mkdir -p "$VENDOR_PREFIX"
  rsync -a --delete --exclude '.git' "$TMP_DIR/upstream"/ "$VENDOR_PREFIX"/
else
  rm -rf "$VENDOR_PREFIX"
  mkdir -p "$VENDOR_PREFIX"
  cp -R "$TMP_DIR/upstream"/. "$VENDOR_PREFIX"/
  rm -rf "$VENDOR_PREFIX/.git"
fi
