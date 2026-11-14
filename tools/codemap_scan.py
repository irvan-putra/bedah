"""Static scan behind the code map (src/codemap.ts).

TS/TSX and Python use real parsers (tools/ast_ts.mjs = TypeScript compiler API incl. type checker;
Python stdlib ast) in mode="ast". mode="regex" is the earlier line scan, kept only for before/after
comparison. YAML, Markdown and package.json are line/JSON scans; everything else is file-level.

What it can and cannot claim (the UI repeats this):
  * Declarations: named top-level declarations per file, plus named inner
    functions one level inside a top-level function (App.tsx's Canvas has
    dozens). TS/TSX, Python, GitHub Actions YAML (jobs and steps), Markdown
    headings and package.json dependencies are scanned. Shell, CSS, HTML and
    lockfiles are file-level only (counted, not decomposed).
  * Edges are one of these kinds, and none of them is a proven runtime call:
      imports          a module import statement (proven, static)
      imported-name    a declaration whose text uses a name bound by such an import
      same-file-name   a declaration whose text uses another declaration's name
      generated-by     the generated file's own header names its generator
      run-step         a workflow run: step names a repo file as the command argument
      path-trigger     the workflow's push paths filter lists the file (a change to it starts the workflow)
      path-mention     a script/config text mentions another repo file's path
"""
import os, re, ast, json, subprocess

def strip_code(src, lang):
    """Blank comments and string literals (keep line structure) so names in
    prose or strings are not counted as references."""
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        two = src[i:i + 2]
        if lang == 'ts' and two == '//':
            j = src.find('\n', i); j = n if j < 0 else j
            out.append(' ' * (j - i)); i = j
        elif lang == 'ts' and two == '/*':
            j = src.find('*/', i + 2); j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', src[i:j])); i = j
        elif lang == 'py' and c == '#':
            j = src.find('\n', i); j = n if j < 0 else j
            out.append(' ' * (j - i)); i = j
        elif c in '\'"' and not (lang == 'ts' and c == "'" and False):
            q = c
            if lang == 'py' and src[i:i + 3] in ('"""', "'''"):
                q = src[i:i + 3]
                j = src.find(q, i + 3); j = n if j < 0 else j + 3
                out.append(re.sub(r'[^\n]', ' ', src[i:j])); i = j
                continue
            j = i + 1
            while j < n and src[j] != q and src[j] != '\n':
                j += 2 if src[j] == '\\' else 1
            j = min(n, j + 1)
            out.append(q + ' ' * (j - i - 2) + q if j - i >= 2 else src[i:j]); i = j
        elif lang == 'ts' and c == '`':
            # template literal: blank the text parts, keep ${...} code
            j = i + 1; buf = ['`']
            depth = 0
            while j < n:
                ch = src[j]
                if depth == 0 and ch == '`':
                    buf.append('`'); j += 1; break
                if depth == 0 and src[j:j + 2] == '${':
                    depth = 1; buf.append('  '); j += 2; continue
                if depth > 0:
                    if ch == '{': depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0: buf.append(' '); j += 1; continue
                    buf.append(ch); j += 1; continue
                buf.append('\n' if ch == '\n' else ' '); j += 1
            out.append(''.join(buf)); i = j
        else:
            out.append(c); i += 1
    return ''.join(out)

TS_TOP = re.compile(r'^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:(function)\s*\*?\s+([A-Za-z_$][\w$]*)|(class)\s+([A-Za-z_$][\w$]*)|(type)\s+([A-Za-z_$][\w$]*)\b|(interface)\s+([A-Za-z_$][\w$]*)|(const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=])')
TS_INNER = re.compile(r'^    (?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)\s*[(<]|const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>)')
PY_TOP = re.compile(r'^(?:(class)|(def))\s+([A-Za-z_]\w*)|^([A-Z][A-Z0-9_]{2,})\s*=')

def ts_decls(path, raw, clean):
    lines = raw.split('\n'); cl = clean.split('\n')
    ds = []
    cur_fn = None
    for i, ln in enumerate(cl):
        m = TS_TOP.match(ln)
        if m:
            g = m.groups()
            if g[0]: name, kind = g[1], 'function'
            elif g[2]: name, kind = g[3], 'class'
            elif g[4]: name, kind = g[5], 'type'
            elif g[6]: name, kind = g[7], 'interface'
            else:
                name, kind = g[9], 'const'
                # arrow/function-valued top-level const is a function in spirit
                tail = ' '.join(cl[i:i + 3])
                if re.search(r'=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>', tail) or re.search(r'=\s*(?:async\s+)?function\b', tail):
                    kind = 'function'
            ds.append(dict(name=name, kind=kind, line=i + 1, parent=None))
            cur_fn = name if kind == 'function' else None
            continue
        if cur_fn:
            m = TS_INNER.match(ln)
            if m:
                name = m.group(1) or m.group(2)
                ds.append(dict(name=name, kind='inner function', line=i + 1, parent=cur_fn))
    return ds

def py_decls(path, raw, clean):
    ds = []
    for i, ln in enumerate(clean.split('\n')):
        m = PY_TOP.match(ln)
        if m:
            if m.group(3): ds.append(dict(name=m.group(3), kind='class' if m.group(1) else 'function', line=i + 1, parent=None))
            else: ds.append(dict(name=m.group(4), kind='const', line=i + 1, parent=None))
    return ds

def yml_decls(path, raw):
    ds = []; lines = raw.split('\n'); in_jobs = False; job = None
    for i, ln in enumerate(lines):
        if re.match(r'^jobs:\s*$', ln): in_jobs = True; continue
        if in_jobs:
            m = re.match(r'^  ([A-Za-z_][\w-]*):\s*$', ln)
            if m: job = m.group(1); ds.append(dict(name=job, kind='job', line=i + 1, parent=None)); continue
            m = re.match(r'^      - name:\s*(.+?)\s*$', ln)
            if m and job: ds.append(dict(name=m.group(1)[:60], kind='step', line=i + 1, parent=job))
    return ds

def md_decls(path, raw):
    return [dict(name=m.group(2).strip()[:60], kind='heading', line=raw[:m.start()].count('\n') + 1, parent=None)
            for m in re.finditer(r'^(#{1,3})\s+(.+)$', raw, re.M)]

def pkg_decls(path, raw):
    import json
    ds = []
    try: j = json.loads(raw)
    except Exception: return ds
    lines = raw.split('\n')
    for sec in ('dependencies', 'devDependencies'):
        for k in (j.get(sec) or {}):
            ln = next((i + 1 for i, l in enumerate(lines) if '"%s"' % k in l), 1)
            ds.append(dict(name=k, kind='dependency' if sec == 'dependencies' else 'dev dependency', line=ln, parent=None))
    return ds

FILE_LEVEL_NOTE = {'.mjs': 'JavaScript module - file-level only (the AST pass covers TS/TSX and Python only)',
                   '.sh': 'shell script - file-level only (no named declarations scanned)',
                   '.css': 'stylesheet - file-level only (rules are not decomposed)',
                   '.html': 'page shell - file-level only',
                   '.json': 'data - file-level only'}

def scan_file(path, raw):
    """-> (lang, decls, support, note, clean)"""
    ext = os.path.splitext(path)[1]
    if ext in ('.ts', '.tsx'):
        clean = strip_code(raw, 'ts'); return 'ts', ts_decls(path, raw, clean), 'declarations', '', clean
    if ext == '.py':
        clean = strip_code(raw, 'py'); return 'py', py_decls(path, raw, clean), 'declarations', '', clean
    if ext in ('.yml', '.yaml'):
        return 'yml', yml_decls(path, raw), 'declarations', 'jobs and steps', raw
    if ext == '.md':
        return 'md', md_decls(path, raw), 'declarations', 'headings', raw
    if os.path.basename(path) == 'package.json':
        return 'json', pkg_decls(path, raw), 'declarations', 'dependencies', raw
    return 'other', [], 'file-level', FILE_LEVEL_NOTE.get(ext, 'file-level only'), raw

def assign_spans(decls, nlines):
    """A span runs from its start to just before the next declaration at the
    same or shallower level (inner functions end at the next sibling or the
    next top-level declaration)."""
    tops = [d for d in decls if not d['parent']]
    for i, d in enumerate(decls):
        end = nlines
        for e in decls[i + 1:]:
            if d['parent']:
                if e['parent'] == d['parent'] or not e['parent']: end = e['line'] - 1; break
            else:
                if not e['parent']: end = e['line'] - 1; break
        d['end'] = max(d['line'], end)
    return decls

IDENT = re.compile(r'(?<![\w$.])([A-Za-z_$][\w$]*)')
IMPORT_RE = re.compile(r"import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:\*\s+as\s+(\w+))?\s*from\s+['\"](\.[^'\"]*)['\"]")

def resolve(path, spec, known):
    base = os.path.normpath(os.path.join(os.path.dirname(path), spec))
    for ext in ('', '.ts', '.tsx', '.css', '/index.ts', '/index.tsx'):
        if base + ext in known: return base + ext
    return None


# ---------------------------------------------------------------- AST mode
def ast_ts_scan(repo, paths):
    """TypeScript compiler API (tools/ast_ts.mjs): declarations + checker-resolved references."""
    if not paths: return dict(decls=[], refs=[], imports=[])
    out = subprocess.run(['node', os.path.join(repo, 'tools', 'ast_ts.mjs'), repo] + paths, capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def py_ast_scan(path, raw, mods):
    """Python stdlib ast. -> (decls, refs). refs: (from_key, target_file_or_None, target_key_or_None, kind).
    Names bound anywhere inside a function (params, assignments, imports, nested defs, loop/with/except/comprehension
    targets) shadow module-level declarations of the same name; attribute access on an imported repo module resolves
    to that module's declaration. Static only: never proves a call runs."""
    tree = ast.parse(raw)
    ds = []
    def key(d): return '%s:%d:%s' % (path, d['line'], d['name'])
    nodes = {}
    for st in tree.body:
        if isinstance(st, ast.ClassDef):
            d = dict(name=st.name, kind='class', line=st.lineno, end=st.end_lineno, parent=None); ds.append(d); nodes[id(st)] = d
            for m in st.body:
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    e = dict(name=m.name, kind='method', line=m.lineno, end=m.end_lineno, parent=st.name); ds.append(e); nodes[id(m)] = e
        elif isinstance(st, (ast.FunctionDef, ast.AsyncFunctionDef)):
            d = dict(name=st.name, kind='function', line=st.lineno, end=st.end_lineno, parent=None); ds.append(d); nodes[id(st)] = d
            for m in st.body:
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    e = dict(name=m.name, kind='inner function', line=m.lineno, end=m.end_lineno, parent=st.name); ds.append(e); nodes[id(m)] = e
        elif isinstance(st, (ast.Assign, ast.AnnAssign)):
            tg = st.targets if isinstance(st, ast.Assign) else [st.target]
            for t in tg:
                if isinstance(t, ast.Name) and re.match(r'^[A-Z][A-Z0-9_]{2,}$', t.id):
                    e = dict(name=t.id, kind='const', line=st.lineno, end=st.end_lineno, parent=None); ds.append(e); nodes[id(st)] = e
    srclines = raw.split('\n')
    for st in ast.walk(tree):
        d = nodes.get(id(st))
        if d is None: continue
        doc = ast.get_docstring(st) if isinstance(st, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) else None
        if doc:
            d['doc'] = dict(text=' '.join(doc.split())[:280], kind='docstring'); continue
        i = st.lineno - 2; cm = []
        while i >= 0 and srclines[i].lstrip().startswith('#'):
            cm.insert(0, srclines[i].lstrip().lstrip('#').strip()); i -= 1
        if cm: d['doc'] = dict(text=' '.join(' '.join(cm).split())[:280], kind='comment')
    top = {d['name']: d for d in ds if not d['parent'] and d['kind'] in ('function', 'class', 'const')}
    # import map: local name -> ('module', file) or ('name', file, exported)
    imp = {}
    for st in tree.body:
        if isinstance(st, ast.Import):
            for a in st.names:
                f = mods.get(a.name.split('.')[0])
                if f: imp[a.asname or a.name.split('.')[0]] = ('module', f)
        elif isinstance(st, ast.ImportFrom) and st.module and mods.get(st.module.split('.')[0]):
            for a in st.names: imp[a.asname or a.name] = ('name', mods[st.module.split('.')[0]], a.name)
    refs = []
    def bound_names(fn):
        b = set()
        for n in ast.walk(fn):
            if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)): b.add(n.id)
            elif isinstance(n, ast.arg): b.add(n.arg)
            elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n is not fn: b.add(n.name)
            elif isinstance(n, ast.alias): b.add((n.asname or n.name).split('.')[0])
            elif isinstance(n, ast.ExceptHandler) and n.name: b.add(n.name)
        return b
    def walk_decl(fn, d, shadow):
        sh = shadow | (bound_names(fn) if not isinstance(fn, (ast.Assign, ast.AnnAssign)) else set())
        parents = {}
        for p in ast.walk(fn):
            for ch in ast.iter_child_nodes(p): parents[id(ch)] = p
        for n in ast.walk(fn):
            if n is fn: continue
            if id(n) in nodes and nodes[id(n)] is not d and id(n) != id(fn):
                pass
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                par = parents.get(id(n))
                kind = 'calls-resolved' if isinstance(par, ast.Call) and par.func is n else 'refs-resolved'
                if n.id in imp and n.id not in sh and imp[n.id][0] == 'name':
                    refs.append((key(d), imp[n.id][1], imp[n.id][2], kind))
                elif n.id in top and n.id not in (sh - {d['name']}) and top[n.id] is not d and n.id not in sh:
                    refs.append((key(d), None, key(top[n.id]), kind))
            elif isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id in imp and n.value.id not in sh and imp[n.value.id][0] == 'module':
                par = parents.get(id(n))
                kind = 'calls-resolved' if isinstance(par, ast.Call) and par.func is n else 'refs-resolved'
                refs.append((key(d), imp[n.value.id][1], n.attr, kind))
    fnnodes = {}
    for st in ast.walk(tree):
        if id(st) in nodes: fnnodes[id(st)] = st
    for st in tree.body:
        for n in ([st] + (list(st.body) if isinstance(st, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) else [])):
            if id(n) in nodes and isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Assign, ast.AnnAssign)):
                walk_decl(n, nodes[id(n)], set())
    # module-level constants: references inside their value expressions
    return ds, refs

def build(files, generated, repo=None, mode='ast'):
    """files: {path: raw}; generated: {path: generator path} for self-header edges.
    Returns dict(decls, edges, coverage)."""
    known = set(files)
    scans = {}
    decls_all = []; coverage = []; keymap = {}
    ast_ts = ast_py = None
    pyrefs = {}
    if mode == 'ast':
        tsfiles = [p for p in files if os.path.splitext(p)[1] in ('.ts', '.tsx') and p not in generated]
        ast_ts = ast_ts_scan(repo, tsfiles)
        mods = {os.path.splitext(os.path.basename(p))[0]: p for p in files if p.endswith('.py')}
    for p, raw in files.items():
        lang, ds, support, note, clean = scan_file(p, raw)
        if mode == 'ast' and lang == 'ts':
            ds = [dict(name=d['name'], kind=d['kind'], line=d['line'], end=d['end'], parent=d['parent'], doc=d.get('doc')) for d in ast_ts['decls'] if d['file'] == p]
        elif mode == 'ast' and lang == 'py':
            ds, pyrefs[p] = py_ast_scan(p, raw, mods)
        nl = raw.count('\n') + (0 if raw.endswith('\n') else 1)
        if not (mode == 'ast' and lang in ('ts', 'py')): assign_spans(ds, nl)
        for d in ds: d['id'] = '%s#%s' % (p, d['name']) if not any(x['id'] == '%s#%s' % (p, d['name']) for x in ds if 'id' in x) else '%s#%s@%d' % (p, d['name'], d['line']); d['file'] = p
        scans[p] = (lang, ds, clean)
        for d in ds: keymap['%s:%d:%s' % (p, d['line'], d['name'])] = d['id']
        decls_all += ds
        coverage.append(dict(path=p, lang=lang, support=support, note=note, decls=len(ds), lines=nl))
    edges = {}
    def add(a, b, kind, ev=None):
        if a == b: return
        k = (a, b, kind)
        e = edges.setdefault(k, dict(a=a, b=b, kind=kind, n=0, ev=ev))
        e['n'] += 1
    # imports + imported names + same-file names
    byfile = {p: scans[p][1] for p in scans}
    for p, (lang, ds, clean) in scans.items():
        if lang != 'ts' and lang != 'py': continue
        if mode == 'ast': continue
        lines = clean.split('\n')
        bound = {}  # local name -> (target file, exported name)
        if lang == 'ts':
            raw = files[p]
            for m in IMPORT_RE.finditer(strip_code(raw, 'ts').replace('\n', ' ') if False else raw):
                tgt = resolve(p, m.group(4), known)
                if not tgt: continue
                add('file:' + p, 'file:' + tgt, 'imports', "%s imports %s" % (os.path.basename(p), m.group(4)))
                if m.group(1): bound[m.group(1)] = (tgt, 'default')
                for part in (m.group(2) or '').split(','):
                    part = part.strip()
                    if not part: continue
                    nm = re.split(r'\s+as\s+', part.replace('type ', ''))
                    bound[nm[-1].strip()] = (tgt, nm[0].strip())
            # side-effect imports (css)
            for m in re.finditer(r"^import\s+['\"](\.[^'\"]+)['\"]", raw, re.M):
                tgt = resolve(p, m.group(1), known)
                if tgt: add('file:' + p, 'file:' + tgt, 'imports', "%s imports %s" % (os.path.basename(p), m.group(1)))
        names = {}
        for d in ds: names.setdefault(d['name'], d)
        for d in ds:
            seg = '\n'.join(lines[d['line'] - 1:d['end']])
            toks = set(IDENT.findall(seg))
            for nm in toks:
                o = names.get(nm)
                if o and o is not d and not (o['parent'] and o['parent'] != d['parent'] and o['parent'] != d['name'] and d['parent'] != o['parent']):
                    # a top-level declaration's span includes its inner functions: do not draw parent->child
                    if o['parent'] == d['name'] or d['parent'] == o['name']: continue
                    if len(nm) >= 3 or o['kind'] in ('function', 'inner function', 'class', 'type', 'interface'):
                        add(d['id'], o['id'], 'same-file-name')
                if nm in bound:
                    tf, ex = bound[nm]
                    target = next((x for x in byfile.get(tf, []) if x['name'] == ex and not x['parent']), None)
                    add(d['id'], target['id'] if target else 'file:' + tf, 'imported-name')
    if mode == 'ast':
        for im in ast_ts['imports']:
            add('file:' + im['from'], 'file:' + im['to'], 'imports', "%s imports %s%s" % (os.path.basename(im['from']), im['spec'], ' (type-only)' if im['typeOnly'] else ''))
        def tid(file, tkey, exported):
            if tkey: return keymap.get(tkey)
            if exported:
                return next((d['id'] for d in scans[file][1] if d['name'] == exported and not d['parent']), None) if file in scans else None
            return None
        for r in ast_ts['refs']:
            a = keymap.get(r['from'])
            b = keymap.get(r['to']) if r['to'] else 'file:' + r['toFile']
            if a and b: add(a, b, r['kind'], 'TypeScript checker resolved the identifier to its declaration')
        for p, rl in pyrefs.items():
            for frm, tfile, tkey, kind in rl:
                a = keymap.get(frm)
                b = keymap.get(tkey) if tfile is None else (tid(tfile, None, tkey) or 'file:' + tfile)
                if a and b: add(a, b, kind, 'Python ast: name resolved to a module-level declaration (not shadowed locally)')
    # generated-by header, run steps, path mentions
    for p, raw in files.items():
        head = '\n'.join(raw.split('\n')[:6])
        m = re.search(r'Generated from .* by (\w+\.py)', head)
        if m:
            g = next((q for q in files if os.path.basename(q) == m.group(1)), None)
            if g: add('file:' + g, 'file:' + p, 'generated-by', "%s header: generated by %s" % (os.path.basename(p), m.group(1)))
    for p, raw in files.items():
        if p in generated: continue
        ext = os.path.splitext(p)[1]
        if ext in ('.md', '.css', '.html') or os.path.basename(p) == '.gitignore' or p.endswith('lock.json'): continue
        lang = scans[p][0]
        text = scans[p][2] if lang in ('ts', 'py') else raw
        if ext == '.sh':  # comments are prose, not commands
            text = '\n'.join('' if l.lstrip().startswith('#') else l for l in raw.split('\n'))
        for q in files:
            if q == p: continue
            if q.endswith(('.md', 'lock.json')) or os.path.basename(q) in ('package.json', '.gitignore'): continue
            if lang == 'ts': continue  # TS relations come from import statements only
            bn = os.path.basename(q)
            if len(bn) < 6: continue
            pat = re.escape(q) if '/' in q else r'(?<![\w/.-])' + re.escape(bn) + r'(?![\w])'
            if lang == 'yml':
                trig = [l for l in text.split('\n') if re.match(r"^\s+- '" + re.escape(q) + r"'\s*$", l) or (os.path.dirname(q) and re.match(r"^\s+- '" + re.escape(os.path.dirname(q)) + r"/\*\*'\s*$", l))]
                if trig:
                    add('file:' + p, 'file:' + q, 'path-trigger', 'workflow on.push.paths lists ' + (q if any(q in l for l in trig) else os.path.dirname(q) + '/**'))
                runs = [l for l in text.split('\n') if re.search(r'^\s*run:\s*(?:sh|bash|node|python3?)\s+.*' + re.escape(os.path.basename(q)), l)]
                if runs:
                    add('file:' + p, 'file:' + q, 'run-step', 'workflow run step: ' + runs[0].strip()[:90])
                continue
            hit = [i for i, l in enumerate(text.split('\n')) if re.search(pat, l)]
            if not hit: continue
            add('file:' + p, 'file:' + q, 'path-mention', '%s mentions %s (line %d)' % (os.path.basename(p), q, hit[0] + 1))
    return dict(decls=decls_all, edges=list(edges.values()), coverage=coverage)
