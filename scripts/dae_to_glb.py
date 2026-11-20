"""KSPO DOME 실감형 콘텐츠(DAE, SketchUp export) -> 웹용 GLB 변환기.

- 씬 그래프(visual_scene + library_nodes instance_node)를 평탄화하여 월드 좌표로 변환
- 재질(material)별로 메시를 병합 -> 뷰어에서 좌석/경사로/출입문/사인 레이어 하이라이트 가능
- 단위 inch -> m, Z-up -> Y-up
사용: python dae_to_glb.py <input.dae> <output.glb> [<summary.json>]
"""
import sys, json, re, collections
import numpy as np
import xml.etree.ElementTree as ET
import pygltflib as G

NS = "{http://www.collada.org/2005/11/COLLADASchema}"
q = lambda t: NS + t


def parse_floats(s):
    return np.array(s.split(), dtype=np.float64) if s and s.strip() else np.zeros(0)


def main(src, dst, summary_path=None):
    print("parsing XML ...", flush=True)
    root = ET.parse(src).getroot()
    unit = float(root.find(f"{q('asset')}/{q('unit')}").get("meter", "1"))

    # ---- materials: id -> (name, rgba)
    effects = {}
    for ef in root.iter(q("effect")):
        col = ef.find(f".//{q('diffuse')}/{q('color')}")
        rgba = [float(v) for v in col.text.split()] if col is not None else [0.75, 0.75, 0.75, 1.0]
        if ef.find(f".//{q('diffuse')}/{q('texture')}") is not None:
            rgba = [0.8, 0.8, 0.8, 1.0]
        tr = ef.find(f".//{q('transparency')}/{q('float')}")
        if tr is not None and ef.find(f".//{q('transparent')}") is not None:
            rgba[3] = min(rgba[3], float(tr.text))
        effects[ef.get("id")] = rgba
    materials = {}
    for m in root.iter(q("material")):
        ie = m.find(q("instance_effect"))
        url = ie.get("url")[1:] if ie is not None else None
        materials[m.get("id")] = (m.get("name") or m.get("id"), effects.get(url, [0.75, 0.75, 0.75, 1.0]))

    # ---- geometries: id -> list of (symbol, tri_vertex_positions (n,3,3) local)
    print("reading geometries ...", flush=True)
    geoms = {}
    for g in root.iter(q("geometry")):
        mesh = g.find(q("mesh"))
        if mesh is None:
            continue
        srcs = {s.get("id"): s for s in mesh.findall(q("source"))}
        verts = mesh.find(q("vertices"))
        pos_src = None
        if verts is not None:
            for inp in verts.findall(q("input")):
                if inp.get("semantic") == "POSITION":
                    pos_src = inp.get("source")[1:]
        parts = []
        for tri in mesh.findall(q("triangles")):
            inputs = tri.findall(q("input"))
            stride = max(int(i.get("offset")) for i in inputs) + 1
            voff = [int(i.get("offset")) for i in inputs if i.get("semantic") == "VERTEX"][0]
            p = tri.find(q("p"))
            if p is None or not p.text:
                continue
            idx = np.array(p.text.split(), dtype=np.int64).reshape(-1, stride)[:, voff]
            parts.append((tri.get("material"), idx))
        if not parts or pos_src not in srcs:
            continue
        pos = parse_floats(srcs[pos_src].find(q("float_array")).text).reshape(-1, 3)
        geoms[g.get("id")] = [(sym, pos[idx].reshape(-1, 3, 3)) for sym, idx in parts]

    lib_nodes = {}
    for ln in root.iter(q("library_nodes")):
        for n in ln.findall(q("node")):
            lib_nodes[n.get("id")] = n

    # ---- traverse
    buckets = collections.defaultdict(list)  # material id -> list of (n,3,3) world
    counts = collections.Counter()

    def node_matrix(n):
        M = np.eye(4)
        for ch in n:
            if ch.tag == q("matrix"):
                M = M @ parse_floats(ch.text).reshape(4, 4)
            elif ch.tag == q("translate"):
                T = np.eye(4); T[:3, 3] = parse_floats(ch.text); M = M @ T
            elif ch.tag == q("scale"):
                S = np.eye(4); S[[0, 1, 2], [0, 1, 2]] = parse_floats(ch.text); M = M @ S
            elif ch.tag == q("rotate"):
                x, y, z, a = parse_floats(ch.text); a = np.radians(a)
                v = np.array([x, y, z]); v = v / (np.linalg.norm(v) or 1)
                K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
                R = np.eye(4); R[:3, :3] = np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K
                M = M @ R
        return M

    def visit(n, parent, inherited_bind):
        M = parent @ node_matrix(n)
        for ig in n.findall(q("instance_geometry")):
            bind = dict(inherited_bind)
            for im in ig.iter(q("instance_material")):
                bind[im.get("symbol")] = im.get("target")[1:]
            for sym, tris in geoms.get(ig.get("url")[1:], []):
                mid = bind.get(sym, "__default")
                w = tris.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
                buckets[mid].append(w.astype(np.float32))
                counts[mid] += len(tris)
        for inode in n.findall(q("instance_node")):
            ref = lib_nodes.get(inode.get("url")[1:])
            if ref is not None:
                visit(ref, M, inherited_bind)
        for ch in n.findall(q("node")):
            visit(ch, M, inherited_bind)

    print("traversing scene ...", flush=True)
    scene = next(root.iter(q("visual_scene")))
    for n in scene.findall(q("node")):
        visit(n, np.eye(4), {})
    del root, geoms

    # ---- build GLB: one mesh per material, indexed (dedup per material)
    print("building GLB ...", flush=True)
    blob = bytearray(); bviews, accs, meshes, nodes, mats = [], [], [], [], []
    summary = []
    # Z-up inch -> Y-up meter
    conv = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float32) * unit
    allmin, allmax = None, None
    for mid, arrs in sorted(buckets.items(), key=lambda kv: -counts[kv[0]]):
        v = np.concatenate(arrs) @ conv.T
        q6 = np.round(v * 1000).astype(np.int64)  # mm 단위 정점 병합
        uniq, inv = np.unique(q6, axis=0, return_inverse=True)
        pos = (uniq / 1000.0).astype(np.float32)
        idx = inv.reshape(-1).astype(np.uint32)
        tri = idx.reshape(-1, 3)
        keep = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
        idx = tri[keep].reshape(-1)
        if len(idx) == 0:
            continue
        name, rgba = materials.get(mid, (mid, [0.75, 0.75, 0.75, 1.0]))
        mn, mx = pos.min(0), pos.max(0)
        allmin = mn if allmin is None else np.minimum(allmin, mn)
        allmax = mx if allmax is None else np.maximum(allmax, mx)
        for data, target, comp, typ, extra in (
            (pos, G.ARRAY_BUFFER, G.FLOAT, "VEC3", {"min": mn.tolist(), "max": mx.tolist()}),
            (idx, G.ELEMENT_ARRAY_BUFFER, G.UNSIGNED_INT, "SCALAR", {}),
        ):
            while len(blob) % 4:
                blob.append(0)
            b = data.tobytes()
            bviews.append(G.BufferView(buffer=0, byteOffset=len(blob), byteLength=len(b), target=target))
            blob.extend(b)
            accs.append(G.Accessor(bufferView=len(bviews) - 1, componentType=comp, count=len(data), type=typ, **extra))
        mats.append(G.Material(name=name, doubleSided=True, alphaMode="BLEND" if rgba[3] < 0.99 else "OPAQUE",
                               pbrMetallicRoughness=G.PbrMetallicRoughness(baseColorFactor=rgba, metallicFactor=0.0, roughnessFactor=0.9)))
        meshes.append(G.Mesh(name=name, primitives=[G.Primitive(attributes=G.Attributes(POSITION=len(accs) - 2), indices=len(accs) - 1, material=len(mats) - 1)]))
        nodes.append(G.Node(name=name, mesh=len(meshes) - 1))
        summary.append({"material": name, "triangles": int(len(idx) // 3), "vertices": int(len(pos)),
                        "bbox_min_m": [round(float(x), 2) for x in mn], "bbox_max_m": [round(float(x), 2) for x in mx]})
        print(f"  {name:32s} tris={len(idx)//3:>9,d}", flush=True)
    gltf = G.GLTF2(asset=G.Asset(generator="dae_to_glb.py (KSPO DOME)"), scene=0,
                   scenes=[G.Scene(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes,
                   materials=mats, accessors=accs, bufferViews=bviews, buffers=[G.Buffer(byteLength=len(blob))])
    gltf.set_binary_blob(bytes(blob))
    gltf.save_binary(dst)
    info = {"unit_m_per_src": unit, "bbox_min_m": allmin.round(2).tolist(), "bbox_max_m": allmax.round(2).tolist(),
            "total_triangles": int(sum(s["triangles"] for s in summary)), "materials": summary}
    if summary_path:
        json.dump(info, open(summary_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("done", info["total_triangles"], "tris; bbox", info["bbox_min_m"], info["bbox_max_m"])


if __name__ == "__main__":
    main(*sys.argv[1:])
