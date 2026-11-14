"""Before/after check of the two code-map extractors (regex vs AST).
Usage: copy the repo files to fx/, then for m in regex ast: python3 tools/gen_code.py --repo fx --commit <sha> --out out_$m/code.ts --map-mode $m
and run this script next to fx/, out_regex/, out_ast/. Prints declaration and edge differences and classifies them against the source."""
import re,json,collections,sys
def load(m):
    s=open(f'out_{m}/codemap.ts').read()
    return json.loads(re.search(r'CM_DECLS: CMDecl\[\] = (\[.*?\]);\n',s).group(1)),json.loads(re.search(r'CM_EDGES: CMEdge\[\] = (\[.*?\]);\n',s).group(1))
rd,R=load('regex'); ad,A=load('ast')
Ad={d['id']:d for d in ad}; Rdid={d['id'] for d in rd}
k=lambda d:(d['file'],d['name'])
kk=lambda d:(d['file'],d['name'],d['kind'])
print('decls regex',len(rd),'ast',len(ad))
print(' kind-label diffs',sorted(set(map(kk,rd))&{(a,b,c) for a,b,c in []} ) or sorted(((x['file'],x['name'],x['kind'],[y['kind'] for y in ad if k(y)==k(x)][0]) for x in rd if k(x) in {k(y) for y in ad} and kk(x) not in set(map(kk,ad)))))
print(' only-ast names',sorted(set(map(k,ad))-set(map(k,rd))))
print(' only-regex names',sorted(set(map(k,rd))-set(map(k,ad))))
pair=lambda e:(e['a'],e['b'])
AS={pair(e) for e in A if e['kind'].endswith('resolved')}; RS={pair(e) for e in R if e['kind'] in('same-file-name','imported-name')}
srcs={}
def span(d):
    f='fx/'+d['file']
    if f not in srcs: srcs[f]=open(f).read().split('\n')
    return '\n'.join(srcs[f][d['line']-1:d['end']])
only_r=[e for e in R if e['kind'] in('same-file-name','imported-name') and pair(e) not in AS]
fp=[];contain=[];other=[]
for e in only_r:
    a=Ad.get(e['a']); t=e['b'].split('#')[-1].split('@')[0]
    if a and not e['b'].startswith('file:') and not re.search(r'(?<![\w$.])'+re.escape(t)+r'(?![\w$])',span(a)): fp.append(e)
    else: contain.append(e)
print('regex-only edges',len(only_r),'| target absent from the real span (false positive):',len(fp),'| word in span:',len(contain))
for e in contain: 
    inner=[x['a'] for x in A if x['b']==e['b'] and Ad.get(x['a'],{}).get('parent')==e['a']]
    print('  ',e['kind'],e['a'],'->',e['b'],'| via inner/child:',inner[:2])
only_a=[e for e in A if e['kind'].endswith('resolved') and pair(e) not in RS]
c=collections.Counter()
for e in only_a:
    a,b=e['a'],e['b']
    if a not in Rdid or (b not in Rdid and not b.startswith('file:')): c['involves declaration regex never found']+=1
    elif Ad[a].get('parent')==b or Ad.get(b,{}).get('parent')==a: c['parent<->inner']+=1
    elif b.startswith('file:'): c['into non-decomposed file']+=1
    else: c['word-match missed (e.g. spread "...Name")']+=1
print('ast-only edges',len(only_a),dict(c)); print('both',len(RS&AS))
