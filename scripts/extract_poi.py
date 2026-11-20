"""GLB(raw)에서 경사로/출입문/터널(출입통로)/좌석 재질의 군집 중심 좌표 추출 -> data/model_poi.json"""
import sys, json, numpy as np, pygltflib as G
g = G.GLTF2().load(sys.argv[1]); blob = g.binary_blob()
def acc(i, n):
    a = g.accessors[i]; bv = g.bufferViews[a.bufferView]
    dt = np.float32 if n == 3 else np.uint32
    return np.frombuffer(blob, dt, a.count * n, bv.byteOffset).reshape(-1, n) if n == 3 else np.frombuffer(blob, dt, a.count, bv.byteOffset)
def clusters(pts, cell=4.0):
    keys = np.floor(pts / cell).astype(int); cells = {}
    for i, k in enumerate(map(tuple, keys)): cells.setdefault(k, []).append(i)
    seen, out = set(), []
    for k in cells:
        if k in seen: continue
        stack, members = [k], []; seen.add(k)
        while stack:
            c = stack.pop(); members += cells[c]
            for d in np.ndindex(3, 3, 3):
                n = (c[0]+d[0]-1, c[1]+d[1]-1, c[2]+d[2]-1)
                if n in cells and n not in seen: seen.add(n); stack.append(n)
        p = pts[members]; out.append({"center": p.mean(0).round(2).tolist(), "min": p.min(0).round(1).tolist(), "max": p.max(0).round(1).tolist(), "n": len(members)})
    return sorted(out, key=lambda c: -c["n"])
res = {}; allpts = []
for m in g.meshes:
    p = m.primitives[0]; pos = acc(p.attributes.POSITION, 3); idx = acc(p.indices, 1).reshape(-1, 3)
    cen = pos[idx].mean(1); allpts.append(cen[:: max(1, len(cen)//20000)])
    nm = m.name.lower()
    for key in ("slope", "door", "turnel", "fire_box", "sign"):
        if key in nm: res.setdefault(key, []).extend(clusters(cen, 3.0 if key != "turnel" else 2.0))
allp = np.concatenate(allpts)
res["model_bbox"] = {"min": allp.min(0).round(1).tolist(), "max": allp.max(0).round(1).tolist()}
# 경기장 중심: 좌석(chair) 분포 중심
ch = [m for m in g.meshes if "chair" in m.name.lower()]
cp = np.concatenate([acc(m.primitives[0].attributes.POSITION, 3) for m in ch])
res["arena_center"] = [round(float((cp[:,0].min()+cp[:,0].max())/2),2), round(float(cp[:,1].min()),2), round(float((cp[:,2].min()+cp[:,2].max())/2),2)]
res["seat_extent"] = {"min": cp.min(0).round(1).tolist(), "max": cp.max(0).round(1).tolist()}
for k in ("slope", "door", "turnel", "fire_box", "sign"):
    if k in res: res[k] = [c for c in res[k] if c["n"] >= (1 if k in ("slope","fire_box") else 4)]
json.dump(res, open(sys.argv[2], "w", encoding="utf-8"), indent=1)
print("center", res["arena_center"], "seat extent", res["seat_extent"])
for k in ("slope", "door", "turnel", "fire_box"):
    print(k, len(res.get(k, [])), [c["center"] for c in res.get(k, [])[:12]])
