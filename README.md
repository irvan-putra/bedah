# vana - intodo review canvas

The full-screen review canvas for [irvan-putra/intodo](https://github.com/irvan-putra/intodo),
extracted into its own repository so the canvas itself can be reviewed and
developed with minimum scope. This repo holds only the canvas, its generated
content, and its publish pipeline - no app code.

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
- Relationship lines labeled as references come from a static name scan at
  the pinned commit, not proven runtime calls; dashed lines mark design
  similarity or designed-but-never-deployed pieces (see the in-page legend).

## Content and honesty

The cards describe the intodo repository and are generated from it:

- `src/sections.ts` - 20 review sections, pinned at intodo commit `fbd0213`.
- `src/code.ts` - C4 component and code layers (22 components, 27
  references, 72 files), pinned at intodo commit `1f6ba2f`.

The pins are shown in the UI, so the cards never claim to describe a newer
intodo than they do. To refresh the content after intodo changes:

    python3 tools/gen_sections.py --repo /path/to/intodo --out src/sections.ts
    python3 tools/gen_code.py    --repo /path/to/intodo --out src/code.ts

Both generators take any local intodo checkout (`--commit` / `--from-git`
for exact pinning) and change nothing else in this repo.

## Build and deploy

    sh build.sh          # writes dist/: index.html + fingerprinted assets

Every push to `main` that touches the canvas deploys automatically through
`.github/workflows/deploy.yml`: an unprivileged build job (`contents: read`
only, locked `npm ci --ignore-scripts`, esbuild) produces the artifact, then
the only privileged job (`pages: write`, `id-token: write`, github-pages
environment) deploys it and polls the live URL until it serves the exact
built bytes. A green check means live, not just pushed.

## Not in this repo

- The Android app (itdapk), the DeltaChat mini-app (itdxdc), the feed
  encryption tools, and the native Android canvas view all stay in
  [irvan-putra/intodo](https://github.com/irvan-putra/intodo). The native
  canvas is a separate implementation embedded in the app build.
- The previous URL <https://vanipy.com/intodo/review/> keeps serving from
  the intodo repository, unchanged.
