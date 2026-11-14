// AST extraction for TS/TSX using the TypeScript compiler API (parser + type checker).
// Usage: node tools/ast_ts.mjs <repo> <file>...   -> JSON on stdout
// Declarations: top-level function/class/type/interface/enum/const/let/var, plus named functions
// (function declarations, or const/let/var holding a function/arrow) that are direct statements
// of a top-level function body. References are resolved by the checker (so shadowed names and
// property names are not confused with declarations). Static resolution only: it never proves
// that a call runs, and calls through callbacks, aliases of aliases, dynamic imports or
// `any`-typed values can be missed or unresolved.
import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';

const repo = path.resolve(process.argv[2]);
const rels = process.argv.slice(3);
const abs = rels.map((r) => path.join(repo, r));
const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, allowJs: false, noEmit: true, skipLibCheck: true, strict: false, types: [] };
const program = ts.createProgram(abs, options);
const checker = program.getTypeChecker();
const relOf = (f) => path.relative(repo, f).split(path.sep).join('/');
const inRepo = (f) => !f.includes('node_modules') && path.resolve(f).startsWith(repo + path.sep);

const decls = [];            // {file,name,kind,line,end,parent,node}
const byNode = new Map();    // declaration name node -> decl
const nodeDecl = new Map();  // symbol-declaration node -> decl
const lineOf = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const isFn = (n) => n && (ts.isFunctionExpression(n) || ts.isArrowFunction(n));

// Leading comment block directly above a declaration (JSDoc or consecutive // lines), as the author wrote it.
function leadingDoc(sf, node) {
    const rs = ts.getLeadingCommentRanges(sf.text, node.getFullStart()) ?? [];
    const keep = [];
    for (let i = rs.length - 1; i >= 0; i--) {
        const gap = sf.text.slice(rs[i].end, i === rs.length - 1 ? node.getStart(sf) : rs[i + 1].pos);
        if ((gap.match(/\n/g) ?? []).length > 1) break;
        keep.unshift(rs[i]);
    }
    if (!keep.length) return null;
    const txt = keep.map((r) => sf.text.slice(r.pos, r.end).replace(/^\/\*+|\*+\/$/g, '').split('\n').map((l) => l.replace(/^\s*(\/\/+|\*+)\s?/, '').trim()).filter(Boolean).join(' ')).join(' ').replace(/\s+/g, ' ').trim();
    return txt ? { text: txt.slice(0, 280), kind: keep[0].kind === ts.SyntaxKind.MultiLineCommentTrivia && sf.text.slice(keep[0].pos, keep[0].pos + 3) === '/**' ? 'jsdoc' : 'comment' } : null;
}
function add(sf, name, kind, node, parent, declNode) {
    const doc = leadingDoc(sf, node);
    const d = { doc, file: relOf(sf.fileName), name, kind, line: lineOf(sf, node.getStart(sf)), end: lineOf(sf, node.getEnd()), parent: parent ? parent.name : null, node: declNode, top: parent ? parent.top : null };
    d.top = parent ? parent.top : d;
    decls.push(d); nodeDecl.set(declNode, d);
    return d;
}
function bodyOf(node) {
    if (ts.isFunctionDeclaration(node)) return node.body;
    if (ts.isVariableDeclaration(node) && isFn(node.initializer)) return node.initializer.body;
    return null;
}
for (const f of abs) {
    const sf = program.getSourceFile(f);
    if (!sf) continue;
    for (const st of sf.statements) {
        const top = [];
        if (ts.isFunctionDeclaration(st) && st.name) top.push(['function', st.name.text, st, st]);
        else if (ts.isClassDeclaration(st) && st.name) top.push(['class', st.name.text, st, st]);
        else if (ts.isInterfaceDeclaration(st)) top.push(['interface', st.name.text, st, st]);
        else if (ts.isTypeAliasDeclaration(st)) top.push(['type', st.name.text, st, st]);
        else if (ts.isEnumDeclaration(st)) top.push(['type', st.name.text, st, st]);
        else if (ts.isVariableStatement(st)) for (const vd of st.declarationList.declarations) if (ts.isIdentifier(vd.name)) top.push([isFn(vd.initializer) ? 'function' : 'const', vd.name.text, st, vd]);
        for (const [kind, name, span, dn] of top) {
            const d = add(sf, name, kind, span, null, dn);
            const body = bodyOf(dn);
            if (body && ts.isBlock(body)) {
                for (const s2 of body.statements) {
                    if (ts.isFunctionDeclaration(s2) && s2.name) add(sf, s2.name.text, 'inner function', s2, d, s2);
                    else if (ts.isVariableStatement(s2)) for (const vd of s2.declarationList.declarations) if (ts.isIdentifier(vd.name) && isFn(vd.initializer)) add(sf, vd.name.text, 'inner function', s2, d, vd);
                }
            }
        }
    }
}
// innermost declaration containing a position
const perFile = {};
for (const d of decls) (perFile[d.file] ??= []).push(d);
function owner(file, pos, sf) {
    const line = lineOf(sf, pos);
    let best = null;
    for (const d of perFile[file] ?? []) {
        const n = d.node.parent && ts.isVariableDeclaration(d.node) ? d.node.parent.parent : d.node;
        if (pos >= n.getStart(sf) && pos < n.getEnd()) { if (!best || (n.getEnd() - n.getStart(sf)) < best.sz) best = { d, sz: n.getEnd() - n.getStart(sf) }; }
    }
    return best ? best.d : null;
}
const refs = new Map(); const imports = [];
const key = (d) => `${d.file}:${d.line}:${d.name}`;
function addRef(from, to, kind) {
    const k = `${key(from)}|${to.file}|${to.decl ? key(to.decl) : ''}|${kind}`;
    const e = refs.get(k) ?? { from: key(from), to: to.decl ? key(to.decl) : null, toFile: to.file, kind, n: 0 };
    e.n++; refs.set(k, e);
}
for (const f of abs) {
    const sf = program.getSourceFile(f); if (!sf) continue;
    const file = relOf(f);
    function visit(node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            const spec = node.moduleSpecifier.text;
            if (spec.startsWith('.')) {
                const r = ts.resolveModuleName(spec, f, options, ts.sys).resolvedModule;
                let target = r && inRepo(r.resolvedFileName) ? relOf(r.resolvedFileName) : null;
                if (!target) { const p = path.join(path.dirname(f), spec); if (fs.existsSync(p)) target = relOf(p); }
                if (target) imports.push({ from: file, to: target, spec, typeOnly: !!node.importClause?.isTypeOnly });
            }
        }
        if (ts.isIdentifier(node)) {
            const p = node.parent;
            const isDeclName = (ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isClassDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isPropertyAssignment(p) && p.name === node || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isJsxAttribute(p) || ts.isNamespaceImport(p)) && p.name === node;
            const isPropName = ts.isPropertyAccessExpression(p) && p.name === node;
            if (!isDeclName && !isPropName && !ts.isImportSpecifier(p) && !ts.isJsxClosingElement(p)) {
                let sym = checker.getSymbolAtLocation(node);
                if (!sym && ts.isShorthandPropertyAssignment(p)) sym = checker.getShorthandAssignmentValueSymbol(p);
                if (sym && (sym.flags & ts.SymbolFlags.Alias)) { try { sym = checker.getAliasedSymbol(sym); } catch {} }
                const dd = sym?.declarations ?? [];
                let target = null;
                for (const dn of dd) { if (nodeDecl.has(dn)) { target = { decl: nodeDecl.get(dn), file: nodeDecl.get(dn).file }; break; } }
                if (!target) { const sfD = dd[0]?.getSourceFile(); if (sfD && inRepo(sfD.fileName) && relOf(sfD.fileName) !== file && !perFile[relOf(sfD.fileName)]) target = { decl: null, file: relOf(sfD.fileName) }; }
                if (target) {
                    const from = owner(file, node.getStart(sf), sf);
                    if (from && from !== target.decl) {
                        let q = node, kind = 'refs-resolved';
                        if (ts.isTypeReferenceNode(p) || ts.isExpressionWithTypeArguments(p) || ts.isTypeQueryNode(p) || ts.isTypeReferenceNode(p?.parent)) kind = 'type-ref-resolved';
                        else if (ts.isCallExpression(p) && p.expression === node) kind = 'calls-resolved';
                        else if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === node) kind = 'renders-resolved';
                        addRef(from, target, kind);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sf);
}
const out = { ts: ts.version, decls: decls.map(({ node, top, ...d }) => d), refs: [...refs.values()].map(({ line, ...e }) => e), imports };
process.stdout.write(JSON.stringify(out));
