// The fixed territory below the container frames: component buildings, file
// rooms, declaration chips and the relationships between them. Everything
// here has a fixed world footprint; zoom only decides which labels and
// details are drawn (the mapmaker), never where anything sits.
import React from 'react';
import { COMPONENTS, CODE_COMMIT_SHORT, C4Component } from './src/code';
import { CM_DECLS, CM_EDGES, CM_FILES, CMDecl } from './src/codemap';
import { SECTIONS } from './src/sections';

export type Rect = { x: number; y: number; w: number; h: number };
type Pt = [number, number];

// frame-local inner origin and size: below the 78px label strip + 28 pad
const IN_X = 28, IN_Y = 106, IN_PAD_B = 28;

// Hand-placed component footprints, frame-local to the inner area. Fixed
// forever; the frames they live in come from NEST_EST.
const SLOTS: Record<string, { frame: string; x: number; y: number; w: number; h: number }> = {
    'cp-canvas': { frame: 'c-app', x: 0, y: 0, w: 230, h: 378 },
    'cp-shim': { frame: 'c-app', x: 254, y: 0, w: 232, h: 111 },
    'cp-style': { frame: 'c-app', x: 254, y: 133, w: 232, h: 111 },
    'cp-entry': { frame: 'c-app', x: 254, y: 266, w: 232, h: 112 },
    'cp-sections-data': { frame: 'c-app', x: 524, y: 0, w: 242, h: 178 },
    'cp-code-data': { frame: 'c-app', x: 524, y: 200, w: 242, h: 178 },
    'cp-gen-sections': { frame: 'c-gen', x: 0, y: 0, w: 371, h: 94 },
    'cp-gen-code': { frame: 'c-gen', x: 395, y: 0, w: 371, h: 94 },
    'cp-build': { frame: 'c-devsupport', x: 0, y: 0, w: 246, h: 94 },
    'cp-deploy': { frame: 'c-devsupport', x: 270, y: 0, w: 300, h: 94 },
    'cp-docs': { frame: 'c-devsupport', x: 594, y: 0, w: 172, h: 94 },
};

export type TileGeo = { id: string; rect: Rect; head: Rect; resp: Rect; rooms: RoomGeo[] };
export type RoomGeo = { file: string; rect: Rect; cap: Rect; chips: { d: CMDecl; r: Rect }[]; fs: number; note: string | null; section: string };

const DECLS_BY_FILE: Record<string, CMDecl[]> = {};
for (const d of CM_DECLS) (DECLS_BY_FILE[d.file] ??= []).push(d);
const FILEINFO = Object.fromEntries(CM_FILES.map((f) => [f.path, f]));
const SECTION_OF: Record<string, string> = {};
for (const s of SECTIONS) for (const f of s.files) SECTION_OF[f.path] ??= s.title;

const CW = 0.58; // monospace-ish glyph width per font unit
const chipW = (name: string, fs: number) => Math.max(fs * 3, name.length * fs * CW + fs * 1.1);

function packChips(decls: CMDecl[], w: number, fs: number): { rects: Rect[]; h: number } {
    const rects: Rect[] = [];
    const ch = fs * 2.05, gx = fs * 0.35, gy = fs * 0.35;
    let x = 0, y = 0;
    for (const d of decls) {
        const cw = Math.min(w, chipW(d.name, fs));
        if (x > 0 && x + cw > w) { x = 0; y += ch + gy; }
        rects.push({ x, y, w: cw, h: ch });
        x += cw + gx;
    }
    return { rects, h: decls.length ? y + ch : 0 };
}

const CAP_FS = 3.4;
export function layoutTerritory(frames: Record<string, Rect>): Record<string, TileGeo> {
    const out: Record<string, TileGeo> = {};
    for (const cp of COMPONENTS) {
        const sl = SLOTS[cp.id];
        const f = frames[sl.frame];
        const T: Rect = { x: f.x + IN_X + sl.x, y: f.y + IN_Y + sl.y, w: sl.w, h: sl.h };
        const pad = 5;
        const head: Rect = { x: T.x + pad, y: T.y + pad, w: T.w - 2 * pad, h: 15 };
        const respLines = T.h > 150 ? 3 : 2;
        const resp: Rect = { x: head.x, y: head.y + head.h + 1, w: head.w, h: respLines * 5.6 };
        const area: Rect = { x: T.x + pad, y: resp.y + resp.h + 3, w: T.w - 2 * pad, h: T.y + T.h - pad - (resp.y + resp.h + 3) };
        // largest chip font at which every room fits the area
        let chosen: { fs: number; rooms: { file: string; h: number; rects: Rect[]; note: string | null; cw: number }[] } | null = null;
        for (const fs of [6, 5.2, 4.4, 3.6, 3.2, 2.9, 2.6, 2.3, 2.05, 1.8, 1.55]) {
            const rooms = cp.files.map((file) => {
                const ds = DECLS_BY_FILE[file] ?? [];
                const info = FILEINFO[file];
                const pk = packChips(ds, area.w - 4, fs);
                const note = ds.length ? null : (info?.note || 'file-level only');
                const h = 7 + (ds.length ? pk.h + 2 : 6) + 2;
                return { file, h, rects: pk.rects, note, cw: area.w - 4 };
            });
            const tot = rooms.reduce((a, r) => a + r.h, 0) + (rooms.length - 1) * 2;
            chosen = { fs, rooms };
            if (tot <= area.h) break;
        }
        let y = area.y;
        const rooms: RoomGeo[] = chosen!.rooms.map((r) => {
            const rect: Rect = { x: area.x, y, w: area.w, h: r.h };
            y += r.h + 2;
            const ds = DECLS_BY_FILE[r.file] ?? [];
            return {
                file: r.file, rect, fs: chosen!.fs, note: r.note, section: SECTION_OF[r.file] ?? '',
                cap: { x: rect.x + 2, y: rect.y + 0.5, w: rect.w - 4, h: 6 },
                chips: ds.map((d, i) => ({ d, r: { x: rect.x + 2 + r.rects[i].x, y: rect.y + 7 + r.rects[i].y, w: r.rects[i].w, h: r.rects[i].h } })),
            };
        });
        out[cp.id] = { id: cp.id, rect: T, head, resp, rooms };
    }
    return out;
}

// ---- component-to-component relationships (labels, never numbers) ----
export type CompEdge = { key: string; pts: Pt[]; label: string; kind: string; ev: string; dashed?: boolean; lx?: number; ly?: number };
const EDGE_LABEL: Record<string, string> = { imports: 'imports', 'generated-by': 'generates', 'run-step': 'runs', 'path-mention': 'mentions', 'path-trigger': 'starts on change' };

export function routeCompEdges(tiles: Record<string, TileGeo>, frames: Record<string, Rect>): CompEdge[] {
    const T = (id: string) => tiles[id].rect;
    const R = (id: string) => T(id).x + T(id).w;
    const B = (id: string) => T(id).y + T(id).h;
    const my = (id: string) => T(id).y + T(id).h / 2;
    const A = frames['c-app'], G = frames['c-gen'];
    const lane = A.x + IN_X + 486; // gutter between the middle and right component columns
    const edges: CompEdge[] = [];
    const add = (key: string, pts: Pt[], kind: string, ev: string, label?: string, lx?: number, ly?: number, dashed?: boolean) =>
        edges.push({ key, pts, label: label ?? EDGE_LABEL[kind], kind, ev, dashed, lx, ly });
    // inside the app container
    add('entry-canvas', [[T('cp-entry').x, my('cp-entry')], [R('cp-canvas'), my('cp-entry')]], 'imports', 'main.tsx imports ./App');
    add('canvas-shim', [[R('cp-canvas'), my('cp-shim')], [T('cp-shim').x, my('cp-shim')]], 'imports', 'App.tsx imports ./files-shim');
    add('entry-style', [[T('cp-entry').x + 116, T('cp-entry').y], [T('cp-entry').x + 116, B('cp-style')]], 'imports', 'main.tsx imports ./static.css, ./src/style.css');
    const gy = (B('cp-shim') + T('cp-style').y) / 2;
    add('canvas-sections', [[R('cp-canvas'), gy - 4], [lane + 11, gy - 4], [lane + 11, my('cp-sections-data') - 60], [T('cp-sections-data').x, my('cp-sections-data') - 60]], 'imports', 'App.tsx imports ./src/sections', 'imports', R('cp-canvas') + 45, gy - 4);
    add('canvas-code', [[R('cp-canvas'), gy + 4], [lane + 20, gy + 4], [lane + 20, my('cp-code-data') + 20], [T('cp-code-data').x, my('cp-code-data') + 20]], 'imports', 'App.tsx imports ./src/code (and ./src/codemap)', 'imports', R('cp-canvas') + 45, gy + 15);
    // generators write their generated files (the generated file's own header says so)
    const gsy = my('cp-gen-sections');
    add('gensec-sections', [[T('cp-gen-sections').x, gsy], [R('cp-sections-data'), gsy]], 'generated-by', 'sections.ts header: generated by gen_sections.py', 'generates', (T('cp-gen-sections').x + R('cp-sections-data')) / 2, gsy);
    const lanY = G.y + IN_Y + 94 + 11;
    const rx = A.x + A.w - 14;
    add('gencode-code', [[T('cp-gen-code').x + 120, B('cp-gen-code')], [T('cp-gen-code').x + 120, lanY], [rx, lanY], [rx, my('cp-code-data') + 40], [R('cp-code-data'), my('cp-code-data') + 40]], 'generated-by', 'code.ts and codemap.ts headers: generated by gen_code.py', 'generates', (rx + T('cp-gen-code').x) / 2, lanY);
    // build and deploy
    add('deploy-build', [[T('cp-deploy').x, my('cp-deploy')], [R('cp-build'), my('cp-deploy')]], 'run-step', 'deploy.yml run step: sh build.sh', 'runs build.sh');
    const by = B('cp-build') + 11;
    const mx = lane + 20 + 0;
    add('build-entry', [[T('cp-build').x, my('cp-build') - 14], [A.x + A.w + 120, my('cp-build') - 14], [A.x + A.w + 120, by], [mx, by], [mx, my('cp-entry') + 20], [R('cp-entry'), my('cp-entry') + 20]], 'path-mention', 'build.sh mentions main.tsx and index.html (esbuild entry, copied page shell)', 'bundles main.tsx', A.x + A.w + 60, by);
    return edges;
}

function longSeg(pts: Pt[]): Pt {
    let best: Pt = [pts[0][0], pts[0][1]], bl = -1;
    for (let i = 1; i < pts.length; i++) {
        const l = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
        if (l > bl) { bl = l; best = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2]; }
    }
    return best;
}
// ---- rendering ----
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const KIND_CLASS: Record<string, string> = { function: 'fn', 'inner function': 'in', const: 'cn', type: 'ty', interface: 'ty', class: 'cl', job: 'jb', step: 'st', heading: 'hd', dependency: 'dp', 'dev dependency': 'dp' };

// font size that stays screen-constant (counter-scaled) but never exceeds fit
const csFont = (screenPx: number, capWorld: number) => `min(calc(${screenPx}px / var(--camz)), ${capWorld}px)`;


// ---- file-pair routing: orthogonal paths around every other room and tile heading ----
// Grid A* (turn-penalised) over the territory with all rooms, tile names and responsibility text as obstacles except
// the two endpoint rooms. Computed once, lazily. A pair with no free path falls back to a straight line.
let PAIR_CACHE: Map<string, [number, number][]> | null = null;
function routeFilePairs(tiles: Record<string, TileGeo>, pairs: { fa: string; fb: string }[]): Map<string, [number, number][]> {
    if (PAIR_CACHE) return PAIR_CACHE;
    const CELL = 3;
    const rooms: Record<string, Rect> = {};
    const obst: { r: Rect; room?: string }[] = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const tl of Object.values(tiles)) {
        x0 = Math.min(x0, tl.rect.x); y0 = Math.min(y0, tl.rect.y); x1 = Math.max(x1, tl.rect.x + tl.rect.w); y1 = Math.max(y1, tl.rect.y + tl.rect.h);
        obst.push({ r: tl.head }, { r: tl.resp });
        for (const rm of tl.rooms) { rooms[rm.file] = rm.rect; obst.push({ r: rm.rect, room: rm.file }); }
    }
    x0 -= 40; y0 -= 40; x1 += 40; y1 += 40;
    const W = Math.ceil((x1 - x0) / CELL), H = Math.ceil((y1 - y0) / CELL);
    const out = new Map<string, [number, number][]>();
    const cell = (x: number, y: number): [number, number] => [Math.min(W - 1, Math.max(0, Math.round((x - x0) / CELL))), Math.min(H - 1, Math.max(0, Math.round((y - y0) / CELL)))];
    for (const p of pairs) {
        const key = p.fa + '>' + p.fb;
        const A = rooms[p.fa], B = rooms[p.fb];
        if (!A || !B) continue;
        const blocked = new Uint8Array(W * H);
        for (const o of obst) {
            if (o.room === p.fa || o.room === p.fb) continue;
            const [ax, ay] = cell(o.r.x - 1.5, o.r.y - 1.5), [bx, by] = cell(o.r.x + o.r.w + 1.5, o.r.y + o.r.h + 1.5);
            for (let yy = ay; yy <= by; yy++) for (let xx = ax; xx <= bx; xx++) blocked[yy * W + xx] = 1;
        }
        const [sx, sy] = cell(A.x + A.w / 2, A.y + A.h / 2), [tx, ty] = cell(B.x + B.w / 2, B.y + B.h / 2);
        const N = W * H * 4, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
        const heap: [number, number][] = [];
        const push = (f: number, s: number) => { heap.push([f, s]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
        const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
        const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
        for (let d = 0; d < 4; d++) { g[(sy * W + sx) * 4 + d] = 0; push(Math.abs(sx - tx) + Math.abs(sy - ty), (sy * W + sx) * 4 + d); }
        let goal = -1, guard = N * 2;
        while (heap.length && guard-- > 0) {
            const [, s] = pop(); const d = s & 3, c = s >> 2, cx2 = c % W, cy2 = (c - cx2) / W;
            if (cx2 === tx && cy2 === ty) { goal = s; break; }
            for (let nd = 0; nd < 4; nd++) {
                const nx = cx2 + DX[nd], ny = cy2 + DY[nd];
                if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[ny * W + nx]) continue;
                const ns = (ny * W + nx) * 4 + nd, ng = g[s] + 1 + (nd === d ? 0 : 6);
                if (ng < g[ns]) { g[ns] = ng; from[ns] = s; push(ng + Math.abs(nx - tx) + Math.abs(ny - ty), ns); }
            }
        }
        let pts: [number, number][] = [];
        if (goal >= 0) {
            const raw: [number, number][] = [];
            for (let s = goal; s !== -1; s = from[s]) { const c = s >> 2, cx2 = c % W; raw.push([x0 + cx2 * CELL, y0 + ((c - cx2) / W) * CELL]); }
            raw.reverse();
            // drop collinear points, then trim to the endpoint rooms' borders
            const inR = (r: Rect, q: [number, number]) => q[0] >= r.x && q[0] <= r.x + r.w && q[1] >= r.y && q[1] <= r.y + r.h;
            let a = 0, b = raw.length - 1;
            while (a < b && inR(A, raw[a + 1])) a++;
            while (b > a && inR(B, raw[b - 1])) b--;
            const seg = raw.slice(a, b + 1);
            for (let i = 0; i < seg.length; i++) if (i === 0 || i === seg.length - 1 || (seg[i][0] - seg[i - 1][0]) * (seg[i + 1][1] - seg[i][1]) !== (seg[i][1] - seg[i - 1][1]) * (seg[i + 1][0] - seg[i][0])) pts.push(seg[i]);
        }
        out.set(key, pts);
    }
    PAIR_CACHE = out;
    return out;
}

export const Territory = React.memo(function Territory({ tiles, zq, edges, trails, trail, tags, edgeMode, edgeFile }: { edgeMode: 'files' | 'file' | 'all' | 'off'; edgeFile: string | null; tiles: Record<string, TileGeo>; zq: number; edges: CompEdge[]; trails: Trail[]; trail: string; tags: ZoneTag[] }) {
    const decl = new Map<string, Rect>();
    for (const t of Object.values(tiles)) for (const r of t.rooms) for (const c of r.chips) decl.set(c.d.id, c.r);
    const fileRect = new Map<string, Rect>();
    for (const t of Object.values(tiles)) for (const r of t.rooms) fileRect.set('file:' + r.file, r.rect);
    const showResp = zq >= 0.8, showRooms = zq >= 1.4, showChipText = zq >= 3.0, showEdges = zq >= 2.2;
    // Declaration chips declutter Maps-style. The C4 entry zoom shows the
    // file rooms with names and line counts; the declaration chips inside
    // them arrive one zoom step deeper, together with the edges between
    // them, so the landing reads as named files rather than a wall of
    // symbols too small to tell apart.
    const showChips = zq >= 2.2;
    const cx = (r: Rect) => r.x + r.w / 2, cy = (r: Rect) => r.y + r.h / 2;
    const edgeLines: React.ReactNode[] = [];
    const fileOf = (id: string) => id.replace(/^file:/, '').split('#')[0];
    if (showEdges && edgeMode !== 'off') {
        let i = 0;
        if (edgeMode === 'files') {
            // one line per ordered file pair; the count is how many declaration edges it stands for
            const agg = new Map<string, { a: Rect; b: Rect; n: number; fa: string; fb: string }>();
            for (const e of CM_EDGES) {
                if (!e.kind.endsWith('-resolved') && e.kind !== 'same-file-name' && e.kind !== 'imported-name') continue;
                const fa = fileOf(e.a), fb = fileOf(e.b);
                if (fa === fb) continue;
                const a = fileRect.get('file:' + fa), b = fileRect.get('file:' + fb);
                if (!a || !b) continue;
                const k = fa + '>' + fb; const g = agg.get(k);
                if (g) g.n++; else agg.set(k, { a, b, n: 1, fa, fb });
            }
            const routes = routeFilePairs(tiles, [...agg.values()].map((g) => ({ fa: g.fa, fb: g.fb })));
            const lines = [...agg.values()].map((g) => {
                const pts = routes.get(g.fa + '>' + g.fb) ?? [];
                const line: [number, number][] = pts.length >= 2 ? pts : [[g.a.x + g.a.w / 2, g.a.y + g.a.h / 2], [g.b.x + g.b.w / 2, g.b.y + g.b.h / 2]];
                return { g, line };
            });
            // greedy label placement: try spots along every segment, keep the one that crosses the fewest
            // other lines and overlaps no earlier label
            const fsz = zq >= 3.2 ? Math.min(11 / zq, 8) : Math.min(7 / zq, 5);
            const placed: [number, number, number, number][] = [];
            const hitSeg = (r: [number, number, number, number], p: [number, number], q: [number, number]) => {
                for (let s = 0; s <= 8; s++) { const x = p[0] + (q[0] - p[0]) * s / 8, y = p[1] + (q[1] - p[1]) * s / 8; if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return true; }
                return false;
            };
            for (const { g, line } of lines) {
                const text = `${g.fa.split('/').pop()} \u2192 ${g.fb.split('/').pop()} (${g.n})`;
                const w = text.length * fsz * 0.62 + fsz * 1.5;
                let best: { x: number; y: number; sc: number } | null = null;
                for (let k = 1; k < line.length; k++) {
                    const p = line[k - 1], q = line[k];
                    const len = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
                    if (len < w * 0.6) continue;
                    for (let f = 0.1; f <= 0.91; f += 0.1) {
                        const x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f;
                        const r: [number, number, number, number] = [x - w / 2, y - fsz - 1.5, x + w / 2, y - 1.5];
                        let sc = Math.abs(f - 0.5) * 2 + (Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0]) ? 6 : 0) + (len < w ? 3 : 0);
                        for (const o of lines) { if (o.g === g) continue; for (let m = 1; m < o.line.length; m++) if (hitSeg(r, o.line[m - 1], o.line[m])) sc += 4; }
                        for (const pr of placed) if (r[0] < pr[2] && r[2] > pr[0] && r[1] < pr[3] && r[3] > pr[1]) sc += 20;
                        if (!best || sc < best.sc) best = { x, y, sc };
                    }
                }
                if (!best) { const p = line[0], q = line[line.length - 1]; best = { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, sc: 0 }; }
                placed.push([best.x - w / 2, best.y - fsz - 1.5, best.x + w / 2, best.y - 1.5]);
                edgeLines.push(<g key={i++}><polyline points={line.map((q) => q.join(',')).join(' ')} className="rc-cm-file" markerEnd="url(#rc-ce-arr)" /><text x={best.x} y={best.y - 1.5} textAnchor="middle" className="rc-cm-filelab" style={{ fontSize: zq >= 3.2 ? csFont(11, 8) : csFont(7, 5) }}>{text}</text></g>);
            }
        } else {
            for (const e of CM_EDGES) {
                if (!e.kind.endsWith('-resolved') && e.kind !== 'same-file-name' && e.kind !== 'imported-name') continue;
                if (edgeMode === 'file' && fileOf(e.a) !== edgeFile && fileOf(e.b) !== edgeFile) continue;
                const a = decl.get(e.a);
                const b = decl.get(e.b) ?? fileRect.get(e.b);
                if (!a || !b) continue;
                edgeLines.push(<line key={i++} x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} className={`rc-cm-edge rc-cm-k-${e.kind.replace('-resolved', '')}${a.x + 200 < b.x || b.x + 200 < a.x ? ' rc-cm-edge-imp' : ''}`} />);
            }
        }
    }
    const compEdges = zq >= 0.42 ? edges.map((e) => (
        <g key={e.key} className="rc-ce">
            <polyline points={e.pts.map((p) => p.join(',')).join(' ')} fill="none" markerEnd="url(#rc-ce-arr)" />
            <text x={e.lx ?? longSeg(e.pts)[0]} y={(e.ly ?? longSeg(e.pts)[1]) - 2} textAnchor="middle" style={{ fontSize: csFont(8, 8) }}>{e.label}</text>
            {zq >= 1.6 ? <title>{e.ev}</title> : null}
        </g>
    )) : null;
    return (
        <g className="rc-terr-tiles">
            <defs><marker id="rc-tr-arr" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#b8860b" /></marker><marker id="rc-ce-arr" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#2f6bab" /></marker></defs>
            {COMPONENTS.map((cp: C4Component) => {
                const t = tiles[cp.id];
                const fitCap = (t.head.w * 0.96) / (cp.name.length * 0.62);
                // Long names wrap to two balanced lines inside the tile instead
                // of shrinking below readability; only
                // while rooms are hidden, so the second line has free space.
                const words = cp.name.split(' ');
                let nameLines = [cp.name], nameCap = Math.min(28, fitCap);
                if (!showRooms && fitCap < 24 && words.length > 1) {
                    let bi = 1, bm = Infinity;
                    for (let i = 1; i < words.length; i++) {
                        const m = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
                        if (m < bm) { bm = m; bi = i; }
                    }
                    nameLines = [words.slice(0, bi).join(' '), words.slice(bi).join(' ')];
                    nameCap = Math.min(28, (t.head.w * 0.96) / (bm * 0.62));
                }
                // The rendered font is min(11px/zoom, nameCap): anchor the
                // baseline to that EFFECTIVE size. Anchoring to nameCap alone
                // dropped the name onto the responsibility line whenever the
                // screen-constant size was the smaller of the two.
                const nameFs = Math.min(nameCap, 11 / zq);
                const nameShow = zq * nameFs >= 6.2;
                return (
                    <g key={cp.id} data-comp={cp.id}>
                        <rect x={t.rect.x} y={t.rect.y} width={t.rect.w} height={t.rect.h} rx={6} className={`rc-t-tile${cp.shared ? ' rc-t-shared' : ''}`} />
                        {nameShow ? nameLines.map((ln, li) => <text key={li} x={t.head.x} y={t.head.y + nameFs * 0.82 + li * nameFs * 1.15} className="rc-t-name" style={{ fontSize: csFont(11, nameCap) }}>{ln}</text>) : null}
                        {showResp && cp.resp ? <foreignObject x={t.resp.x} y={t.resp.y} width={t.resp.w} height={t.resp.h}><div className="rc-t-resp">{cp.resp}</div></foreignObject> : null}
                        {showRooms ? t.rooms.map((r) => (
                            <g key={r.file}>
                                <rect x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h} rx={2} className="rc-t-room" />
                                <text x={r.cap.x} y={r.cap.y + 4.4} className="rc-t-cap" style={{ fontSize: CAP_FS }}>{r.file.split('/').pop()}<tspan className="rc-t-capmeta">{`${FILEINFO[r.file]?.lines != null ? ` · ${FILEINFO[r.file].lines} lines` : ' · size not shown'}${r.section ? ` · review: ${r.section}` : ''}`}</tspan></text>
                                {r.note ? <text x={r.rect.x + 3} y={r.rect.y + r.rect.h - 2.6} className="rc-t-note" style={{ fontSize: 3 }}>{r.note}</text> : null}
                                {/* while the room's chips are decluttered away, say what is
                                    inside instead of showing a blank box */}
                                {r.chips.length > 0 && !(showChips && zq * r.fs >= 5.2) ? (
                                    <text x={r.rect.x + r.rect.w / 2} y={r.rect.y + r.rect.h / 2} textAnchor="middle" className="rc-t-note" style={{ fontSize: 7 }}>{r.chips.length} {r.chips.length === 1 ? 'declaration' : 'declarations'} - zoom in</text>
                                ) : null}
                                {/* a chip renders only when its name can render with it:
                                    anonymous colored rects were the "wall of symbols"; a
                                    declaration without its readable name is clutter, not info */}
                                {showChips && zq * r.fs >= 5.2 ? r.chips.map((c) => (
                                    <g key={c.d.id} className={`rc-cm-chip rc-cm-${KIND_CLASS[c.d.kind] ?? 'cn'}`}>
                                        <rect x={c.r.x} y={c.r.y} width={c.r.w} height={c.r.h} rx={c.r.h * 0.25} />
                                        <text x={c.r.x + c.r.h * 0.4} y={c.r.y + c.r.h * 0.7} style={{ fontSize: r.fs, fontFamily: MONO }}>{c.d.name}</text>
                                    </g>
                                )) : null}
                            </g>
                        )) : null}
                    </g>
                );
            })}
            {edgeLines}
            {compEdges}
            {zq >= 0.42 ? trails.map((tr) => (
                <g key={tr.id} className={`rc-trail${trail === tr.id ? ' rc-trail-on' : zq >= 2.2 ? ' rc-trail-faded' : ''}`}>
                    {tr.steps.map((s, i) => (
                        <g key={i}>
                            <polyline points={s.pts.map((p) => p.join(',')).join(' ')} fill="none" markerEnd="url(#rc-tr-arr)" />
                            {trail === tr.id ? <text x={(s.pts[1] ?? s.pts[0])[0]} y={(s.pts[1] ?? s.pts[0])[1] + 9} style={{ fontSize: csFont(8, 7) }}>{s.label}</text> : null}
                            {trail === tr.id && zq >= 1.6 ? <title>{s.src}</title> : null}
                        </g>
                    ))}
                </g>
            )) : null}
            {zq >= 0.42 ? tags.map((g) => <text key={g.text} x={g.x} y={g.y} textAnchor={g.anchor} className="rc-zone" style={{ fontSize: csFont(7, 7.5) }}>{g.text}</text>) : null}
        </g>
    );
});

// ---- trails: the ship flow and the content refresh drawn over the same territory ----
export type TrailStep = { pts: Pt[]; label: string; src: string };
export type Trail = { id: 'ship' | 'refresh'; title: string; steps: TrailStep[] };
export function routeTrails(tiles: Record<string, TileGeo>, frames: Record<string, Rect>): Trail[] {
    const T = (id: string) => tiles[id].rect;
    const cx = (id: string) => T(id).x + T(id).w / 2, cy = (id: string) => T(id).y + T(id).h / 2;
    const R = (id: string) => T(id).x + T(id).w, B = (id: string) => T(id).y + T(id).h;
    const D = frames['c-devsupport'];
    return [
        { id: 'ship', title: 'Ship flow', steps: [
            { pts: [[cx('cp-deploy') - 40, T('cp-deploy').y + 14], [cx('cp-deploy') - 40, T('cp-deploy').y - 10], [cx('cp-build') + 40, T('cp-deploy').y - 10], [cx('cp-build') + 40, T('cp-build').y + 14]], label: 'push to main starts the build job', src: 'deploy.yml on.push.paths; build job runs build.sh' },
            { pts: [[cx('cp-build') + 60, B('cp-build') - 14], [cx('cp-build') + 60, B('cp-build') + 12], [cx('cp-deploy') + 40, B('cp-build') + 12], [cx('cp-deploy') + 40, B('cp-deploy') - 14]], label: 'built dist/ goes to the deploy job', src: 'deploy.yml: deploy job needs build' },
            { pts: [[R('cp-deploy') - 10, cy('cp-deploy') + 24], [D.x + D.w + 90, cy('cp-deploy') + 24]], label: 'deploy job publishes to Pages and checks the live bytes', src: 'deploy.yml deploy job; tools/verify_live.sh' },
        ] },
        { id: 'refresh', title: 'Content refresh', steps: [
            { pts: [[cx('cp-gen-sections'), B('cp-gen-sections') - 6], [cx('cp-gen-sections'), B('cp-gen-sections') + 14], [cx('cp-gen-sections') - 120, B('cp-gen-sections') + 14], [cx('cp-gen-sections') - 120, T('cp-sections-data').y + T('cp-sections-data').h - 30], [R('cp-sections-data'), T('cp-sections-data').y + T('cp-sections-data').h - 30]], label: 'generator rewrites sections.ts at a pinned commit', src: 'sections.ts header; README content refresh' },
            { pts: [[R('cp-sections-data') - 20, B('cp-sections-data') - 4], [R('cp-sections-data') - 20, T('cp-code-data').y + 6]], label: 'generator rewrites code.ts and codemap.ts', src: 'code.ts, codemap.ts headers' },
        ] },
    ];
}
export type ZoneTag = { x: number; y: number; text: string; anchor: 'start' | 'end' };
export function zoneTags(frames: Record<string, Rect>): ZoneTag[] {
    const e = (id: string, text: string): ZoneTag => ({ x: frames[id].x + frames[id].w - 14, y: frames[id].y + 40, text, anchor: 'end' });
    return [
        e('c-app', "runs in: the visitor's browser (static bundle + localStorage)"),
        e('c-gen', 'runs in: the developer machine (python3 generators)'),
        e('c-devsupport', 'runs in: GitHub Actions runner (build, deploy, verify)'),
    ];
}
