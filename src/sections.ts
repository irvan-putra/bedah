// Generated from irvan-putra/vana @ 4f99634 by gen_sections.py - do not hand-edit.
export const COMMIT = "4f99634dba8278d2cda8f97f85f8b42d10f1442a";
export const COMMIT_SHORT = "4f99634";
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
        "lines": 1934
      },
      {
        "path": "territory.tsx",
        "lines": 250
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
        "lines": 760
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
    "digest": "2e56f2d8affe",
    "totalLines": 3150
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
        "lines": 684,
        "note": "generated - excluded from digest"
      },
      {
        "path": "src/codemap.ts",
        "lines": 23,
        "note": "generated - excluded from digest"
      }
    ],
    "notChecked": [
      "The generators read a checkout, so a stale checkout means stale cards - the pinned commit on each card is the tell"
    ],
    "digest": "e3b0c44298fc",
    "totalLines": 707
  },
  {
    "id": "generators",
    "title": "Content generators",
    "tag": "Tools - Python",
    "icon": "🏭",
    "purpose": "The CLIs and helpers that regenerate the review content from a local vana checkout. Run by hand, never in CI.",
    "link": "tools",
    "files": [
      {
        "path": "tools/gen_sections.py",
        "lines": 142
      },
      {
        "path": "tools/gen_code.py",
        "lines": 413
      },
      {
        "path": "tools/codemap_scan.py",
        "lines": 391
      },
      {
        "path": "tools/ast_ts.mjs",
        "lines": 123
      },
      {
        "path": "tools/compare_extractors.py",
        "lines": 41
      }
    ],
    "notChecked": [
      "Curated component names and section assignments inside the generators are judgment, reviewed only by reading them here"
    ],
    "digest": "a5441a60bdbd",
    "totalLines": 1110
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
        "lines": 108
      },
      {
        "path": "tools/verify_live.sh",
        "lines": 60
      }
    ],
    "notChecked": [
      "A failed deploy rollback (verify_live.sh only proves the new bytes went live, not that an old page returns on failure)"
    ],
    "digest": "72a900bfdc58",
    "totalLines": 757
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
        "lines": 93
      },
      {
        "path": ".gitignore",
        "lines": 3
      }
    ],
    "notChecked": [],
    "digest": "6b377d14f003",
    "totalLines": 96
  }
];
