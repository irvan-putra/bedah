# vana - self-review canvas

A full-screen review canvas that reviews its own repository. The cards,
diagrams and code facts on the page describe this repo's source at the
pinned commit, so the page is both the review surface and the thing under
review. Extracted from the intodo review canvas, which keeps its own
unchanged page at <https://vanipy.com/intodo/review/>.

Live at <https://vanipy.com/vana/>.

## What it is

- A static React + esbuild page. No backend, no platform dependency
  (`files-shim.tsx` replaces the hosted-page component kit with a tiny
  localStorage-backed `useLocalState`).
- Full-screen, FreeForm/Miro-style infinite canvas: drag to pan, pinch to
  zoom, one continuous map from the C4 system-context level down to
  containers, sections, components and code - no layer jumps. Cards are
  fixed in place; review marks and camera position stay in the visitor's
  browser only (localStorage), nothing is sent anywhere.
- Relationship lines labeled as references come from a static name/import
  scan at the pinned commit, not proven runtime calls; dashed lines mark
  one-time history (the intodo extraction), not a live link.

## Content and honesty

The cards describe this repository and are generated from it:

- `src/sections.ts` - the review sections (file inventory, line counts,
  per-section digests).
- `src/code.ts` - the C4 component and code layers (components, curated
  responsibilities, declarations, static references).

Both carry the commit they were generated from, shown in the UI, so the
cards never claim to describe a newer vana than they do. The generated
files are excluded from their own digests - a self-referential content hash
can never stabilise. To refresh the content after the source changes:

    python3 tools/gen_sections.py --repo /path/to/vana --out src/sections.ts
    python3 tools/gen_code.py    --repo /path/to/vana --out src/code.ts

Both generators take any local vana checkout (`--commit` / `--from-git`
for exact pinning) and change nothing else in this repo.

## Build and deploy

    sh build.sh          # writes dist/: index.html + fingerprinted assets

Every push to `main` deploys automatically through
`.github/workflows/deploy.yml`: an unprivileged build job (`contents: read`
only, locked `npm ci --ignore-scripts`, esbuild) produces the artifact, then
the only privileged job (`pages: write`, `id-token: write`, github-pages
environment) deploys it and polls the live URL until it serves the exact
built bytes (`tools/verify_live.sh`). A green check means live, not just
pushed.

## Not in this repo

- The intodo applications (Android app, DeltaChat mini-app, feed tools, the
  native Android canvas view) stay in
  [irvan-putra/intodo](https://github.com/irvan-putra/intodo). This repo
  holds only the canvas, its generated content, and its publish pipeline.
