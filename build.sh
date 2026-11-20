#!/bin/sh
# Build the static review canvas for GitHub Pages.
# Usage: sh build.sh [outdir]   (default: ./dist)
# The bundle is fully self-contained: index.html plus fingerprinted
# app.<hash>.js / app.<hash>.css, servable from any base path.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/dist}"
mkdir -p "$OUT"
cd "$HERE"
if [ ! -d node_modules ]; then
  if [ -n "$CI" ]; then
    # CI (GitHub Actions build job, contents:read only): locked deterministic
    # install from package-lock.json, dependency lifecycle scripts disabled.
    npm ci --ignore-scripts --no-fund --no-audit
  else
    npm install --no-fund --no-audit
  fi
fi
./node_modules/.bin/esbuild main.tsx --bundle --outfile="$OUT/app.js" --jsx=automatic --minify
cp index.html "$OUT/index.html"
# Static subpages (e.g. pages/naming/) ship verbatim alongside the canvas.
if [ -d pages ]; then
  cp -r pages/. "$OUT/"
fi
# Content-fingerprint the JS/CSS asset names and rewrite index.html to match,
# so a new release is picked up immediately instead of waiting out the
# browser cache (GitHub Pages serves these with max-age=600).
JS_HASH=$(md5sum "$OUT/app.js" | cut -c1-8)
CSS_HASH=$(md5sum "$OUT/app.css" | cut -c1-8)
mv "$OUT/app.js" "$OUT/app.$JS_HASH.js"
mv "$OUT/app.css" "$OUT/app.$CSS_HASH.css"
sed -i "s|\./app\.js|./app.$JS_HASH.js|; s|\./app\.css|./app.$CSS_HASH.css|" "$OUT/index.html"
echo "Built: $OUT (index.html, app.$JS_HASH.js, app.$CSS_HASH.css)"
