// Generated from irvan-putra/bedah @ e12fa35 by gen_sections.py - do not hand-edit.
export const COMMIT = "e12fa3599c8bfef968279b798d7a1e969522b26a";
export const COMMIT_SHORT = "e12fa35";
export type SectionFile = { path: string; lines: number | null; note?: string };
export type Section = { id: string; title: string; tag: string; icon: string; purpose: string; link: string; digest: string; totalLines: number; files: SectionFile[]; notChecked: string[] };
export const SECTIONS: Section[] = [
  {
    "id": "canvas-ui",
    "title": "Canvas UI & interaction",
    "tag": "Web app - UI",
    "icon": "🗺️",
    "purpose": "The full-screen map you are looking at: pan/zoom bands, cards, review marks, and the reading overlays.",
    "link": ".",
    "files": [
      {
        "path": "App.tsx",
        "lines": 2198
      },
      {
        "path": "territory.tsx",
        "lines": 513
      },
      {
        "path": "main.tsx",
        "lines": 7
      },
      {
        "path": "index.html",
        "lines": 26
      },
      {
        "path": "files-shim.tsx",
        "lines": 68
      },
      {
        "path": "static.css",
        "lines": 788
      },
      {
        "path": "src/style.css",
        "lines": 105
      }
    ],
    "notChecked": [
      "Small-phone and screen-reader pass over every zoom band",
      "Saved-layout restore across browsers (localStorage is per browser, by design)"
    ],
    "digest": "5ca930ec92f5",
    "totalLines": 3705
  },
  {
    "id": "content-data",
    "title": "Generated review content",
    "tag": "Web app - data",
    "icon": "📦",
    "purpose": "The section and component facts the canvas renders. Generated from this repo by the tools below; never hand-edited.",
    "link": "src",
    "files": [
      {
        "path": "src/sections.ts",
        "lines": null,
        "note": "generated - self-size excluded to avoid self-reference"
      },
      {
        "path": "src/code.ts",
        "lines": 711,
        "note": "generated - excluded from digest"
      },
      {
        "path": "src/codemap.ts",
        "lines": 25,
        "note": "generated - excluded from digest"
      }
    ],
    "notChecked": [
      "The generators read a checkout, so a stale checkout means stale cards - the pinned commit on each card is the tell"
    ],
    "digest": "e3b0c44298fc",
    "totalLines": 736
  },
  {
    "id": "generators",
    "title": "Content generators",
    "tag": "Tools - Python",
    "icon": "🏭",
    "purpose": "The CLIs and helpers that regenerate the review content from a local bedah checkout. Run by hand, never in CI.",
    "link": "tools",
    "files": [
      {
        "path": "tools/gen_sections.py",
        "lines": 142
      },
      {
        "path": "tools/gen_code.py",
        "lines": 457
      },
      {
        "path": "tools/codemap_scan.py",
        "lines": 402
      },
      {
        "path": "tools/ast_ts.mjs",
        "lines": 137
      },
      {
        "path": "tools/compare_extractors.py",
        "lines": 41
      }
    ],
    "notChecked": [
      "Curated component names and section assignments inside the generators are judgment, reviewed only by reading them here"
    ],
    "digest": "db1a9a65d9e5",
    "totalLines": 1179
  },
  {
    "id": "build-deploy",
    "title": "Build & deploy",
    "tag": "Repo plumbing",
    "icon": "🔧",
    "purpose": "The esbuild bundle script and the two-job GitHub Actions workflow that publishes to Pages on every push to main.",
    "link": ".github/workflows",
    "files": [
      {
        "path": "build.sh",
        "lines": 30
      },
      {
        "path": "package.json",
        "lines": 14
      },
      {
        "path": "package-lock.json",
        "lines": 545
      },
      {
        "path": ".github/workflows/deploy.yml",
        "lines": 109
      },
      {
        "path": "tools/verify_live.sh",
        "lines": 60
      }
    ],
    "notChecked": [
      "A failed deploy rollback (verify_live.sh only proves the new bytes went live, not that an old page returns on failure)"
    ],
    "digest": "90cf7dd41fda",
    "totalLines": 758
  },
  {
    "id": "docs-meta",
    "title": "Docs & repo meta",
    "tag": "Non-code",
    "icon": "📄",
    "purpose": "README and gitignore - the repo's own description of itself.",
    "link": ".",
    "files": [
      {
        "path": "README.md",
        "lines": 125
      },
      {
        "path": ".gitignore",
        "lines": 3
      }
    ],
    "notChecked": [],
    "digest": "769ccdaece22",
    "totalLines": 128
  }
];
