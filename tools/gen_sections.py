import argparse, hashlib, json, os, sys

# Portable: point at any local bedah checkout and any output path.
#   python3 gen_sections.py --repo /path/to/bedah --out src/sections.ts
# Regenerate after any repo change so cards match the pinned commit.
ap = argparse.ArgumentParser(description='Generate sections.ts for the bedah review canvas from a local bedah checkout.')
ap.add_argument('--repo', default='.', help='path to the bedah repository root (default: current directory)')
ap.add_argument('--out', default='-', help='output path for sections.ts (default: stdout)')
ap.add_argument('--commit', default=None, help='commit hash the cards pin; default: git rev-parse HEAD in --repo')
ap.add_argument('--from-git', action='store_true', help='read file contents via git show COMMIT:path, so counts and digests describe the pinned commit exactly rather than the worktree')
args = ap.parse_args()

REPO = os.path.abspath(args.repo)
if args.commit:
    COMMIT = args.commit
else:
    import subprocess
    COMMIT = subprocess.check_output(['git', '-C', REPO, 'rev-parse', 'HEAD'], text=True).strip()
SHORT = COMMIT[:7]

OUT_ABS = os.path.abspath(args.out) if args.out != '-' else None

def _size_and_lines(path, want_lines):
    """From the pinned commit itself when --from-git is set, so the
    inventory can never describe a dirty worktree while claiming to pin a
    commit; from the worktree otherwise. Lines counted only when asked."""
    if args.from_git:
        import subprocess
        data = subprocess.check_output(
            ['git', '-C', REPO, 'show', '%s:%s' % (COMMIT, path)])
        n = data.decode('utf-8', errors='strict').count('\n') if want_lines else None
        return len(data), n
    full = os.path.join(REPO, path)
    assert os.path.isfile(full), 'missing: ' + path
    if not want_lines:
        return os.path.getsize(full), None
    with open(full, 'r', encoding='utf-8', errors='strict') as fh:
        n = sum(1 for _ in fh)
    return os.path.getsize(full), n

def f(path, note=None):
    if OUT_ABS and os.path.abspath(os.path.join(REPO, path)) == OUT_ABS:
        # The generated file's self-size is measurable but excluded to avoid
        # self-reference: any count would describe the previous generation.
        return {'path': path, 'lines': None,
                'note': 'generated - self-size excluded to avoid self-reference'}
    if note == 'binary':
        size, _ = _size_and_lines(path, want_lines=False)
        note_s = '%.1f MB binary' % (size/1e6) if size >= 100000 else '%.0f KB binary' % (size/1e3)
        return {'path': path, 'lines': None, 'note': note_s}
    size, n = _size_and_lines(path, want_lines=True)
    if note == 'generated':
        # A generated file that itself contains section digests can never have
        # a stable content hash, so it is listed for coverage but excluded
        # from its section's digest.
        return {'path': path, 'lines': n, 'note': 'generated - excluded from digest'}
    return {'path': path, 'lines': n}

SECTIONS = [
 dict(id='canvas-ui', title='Canvas UI & interaction', tag='Web app - UI', icon='\U0001F5FA\uFE0F',
      purpose='The full-screen map you are looking at: pan/zoom bands, cards, review marks, and the reading overlays.',
      link='.',
      files=[f('App.tsx'),
             f('territory.tsx'),
             f('main.tsx'),
             f('index.html'),
             f('files-shim.tsx'),
             f('static.css'),
             f('src/style.css')],
      notChecked=['Small-phone and screen-reader pass over every zoom band',
                  'Saved-layout restore across browsers (localStorage is per browser, by design)']),
 dict(id='content-data', title='Generated review content', tag='Web app - data', icon='\U0001F4E6',
      purpose='The section and component facts the canvas renders. Generated from this repo by the tools below; never hand-edited.',
      link='src',
      files=[f('src/sections.ts', 'generated'),
             f('src/code.ts', 'generated'),
             f('src/codemap.ts', 'generated')],
      notChecked=['The generators read a checkout, so a stale checkout means stale cards - the pinned commit on each card is the tell']),
 dict(id='generators', title='Content generators', tag='Tools - Python', icon='\U0001F3ED',
      purpose='The CLIs and helpers that regenerate the review content from a local bedah checkout. Run by hand, never in CI.',
      link='tools',
      files=[f('tools/gen_sections.py'),
             f('tools/gen_code.py'),
             f('tools/codemap_scan.py'),
             f('tools/ast_ts.mjs'),
             f('tools/compare_extractors.py')],
      notChecked=['Curated component names and section assignments inside the generators are judgment, reviewed only by reading them here']),
 dict(id='build-deploy', title='Build & deploy', tag='Repo plumbing', icon='\U0001F527',
      purpose='The esbuild bundle script and the two-job GitHub Actions workflow that publishes to Pages on every push to main.',
      link='.github/workflows',
      files=[f('build.sh'),
             f('package.json'),
             f('package-lock.json'),
             f('.github/workflows/deploy.yml'),
             f('tools/verify_live.sh')],
      notChecked=['A failed deploy rollback (verify_live.sh only proves the new bytes went live, not that an old page returns on failure)']),
 dict(id='docs-meta', title='Docs & repo meta', tag='Non-code', icon='\U0001F4C4',
      purpose='README and gitignore - the repo\'s own description of itself.',
      link='.',
      files=[f('README.md'),
             f('.gitignore')],
      notChecked=[]),
]

def _read_bytes(path):
    """File bytes from the pinned commit's tree when --from-git is set;
    from the worktree otherwise. Digests must describe the same source the
    line counts do."""
    if args.from_git:
        import subprocess
        return subprocess.check_output(
            ['git', '-C', REPO, 'show', '%s:%s' % (COMMIT, path)])
    with open(os.path.join(REPO, path), 'rb') as fh:
        return fh.read()

for s in SECTIONS:
    h = hashlib.sha256()
    for fl in sorted(s['files'], key=lambda x: x['path']):
        if fl.get('note', '').startswith('generated'):
            continue  # self-referential content hash can never stabilise
        h.update(('%s:%s\n' % (fl['path'], hashlib.sha256(_read_bytes(fl['path'])).hexdigest())).encode())
    s['digest'] = h.hexdigest()[:12]
    s['totalLines'] = sum(fl['lines'] or 0 for fl in s['files'])

out = []
out.append('// Generated from irvan-putra/bedah @ %s by gen_sections.py - do not hand-edit.' % SHORT)
out.append('export const COMMIT = %s;' % json.dumps(COMMIT))
out.append('export const COMMIT_SHORT = %s;' % json.dumps(SHORT))
out.append('export type SectionFile = { path: string; lines: number | null; note?: string };')
out.append('export type Section = { id: string; title: string; tag: string; icon: string; purpose: string; link: string; digest: string; totalLines: number; files: SectionFile[]; notChecked: string[] };')
out.append('export const SECTIONS: Section[] = %s;' % json.dumps(SECTIONS, indent=2, ensure_ascii=False))
text = '\n'.join(out) + '\n'
if args.out == '-':
    sys.stdout.write(text)
else:
    with open(args.out, 'w') as fh:
        fh.write(text)
total_files = sum(len(s['files']) for s in SECTIONS)
total_lines = sum(s['totalLines'] for s in SECTIONS)
print('sections:', len(SECTIONS), 'files:', total_files, 'text lines:', total_lines)
for s in SECTIONS:
    print(' %-13s %3d files %6d lines %s' % (s['id'], len(s['files']), s['totalLines'], s['digest']))
