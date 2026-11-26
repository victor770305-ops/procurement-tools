#!/usr/bin/env bash
# 下載指定版本的 three.js（預設 r187），只取建置檔與 addons，放到 pet/vendor/three/
# 用法：bash pet/tools/update-three.sh [r187]
set -euo pipefail
TAG="${1:-r187}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HERE/vendor/three"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --branch "$TAG" --filter=blob:none --sparse https://github.com/mrdoob/three.js "$TMP/src"
git -C "$TMP/src" sparse-checkout set --no-cone /build /examples/jsm /LICENSE /package.json
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$TMP/src/build/three.module.js" "$TMP/src/build/three.core.js" "$DEST/"
cp -r "$TMP/src/examples/jsm" "$DEST/addons"
cp "$TMP/src/LICENSE" "$DEST/LICENSE"
VER="$(sed -n 's/.*"version": "\(.*\)".*/\1/p' "$TMP/src/package.json" | head -1)"
printf '%s (%s)\n' "$TAG" "$VER" > "$DEST/VERSION"
echo "three.js $TAG ($VER) -> $DEST"
