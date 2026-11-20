"""OSM(올림픽공원 일대) + 지하철 엘리베이터 -> 지도 레이어 GeoJSON + 계단 없는 보행 경로

출력: web/data/park_geo.json
 - dome: KSPO DOME 외곽선/중심/반경 (OSM way 75956855)
 - features: 엘리베이터·리프트, 지하철 출입구, 주차장, 공연장 건물, 공원 경계
 - routes: 역 엘리베이터 -> KSPO DOME 외곽 접근점, 계단(highway=steps) 제외 최단 경로
사용: python build_park_geo.py <osm_park.json> <access_kspodome.json> <out.json>
"""
import sys, json, math, heapq, collections

osm = json.load(open(sys.argv[1], encoding="utf-8"))
acc = json.load(open(sys.argv[2], encoding="utf-8"))
OUT = sys.argv[3]

R = 6371000.0
def dist(a, b):  # (lon, lat)
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp, dl = p2 - p1, math.radians(b[0] - a[0])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))

els = osm["elements"]
dome = next(e for e in els if e.get("id") == 75956855)
ring = [(g["lon"], g["lat"]) for g in dome["geometry"]]
cx = sum(p[0] for p in ring[:-1]) / (len(ring) - 1); cy = sum(p[1] for p in ring[:-1]) / (len(ring) - 1)
radius = sum(dist((cx, cy), p) for p in ring[:-1]) / (len(ring) - 1)

# ---- 보행 그래프 (계단 제외, 차도 중 보행 불가 등급 제외)
WALK_OK = {"footway", "path", "pedestrian", "service", "living_street", "residential", "unclassified", "track",
           "cycleway", "tertiary", "tertiary_link", "secondary", "secondary_link"}
adj = collections.defaultdict(list); coord = {}; n_steps = 0
for e in els:
    t = e.get("tags", {})
    hw = t.get("highway")
    if e["type"] != "way" or not hw: continue
    if hw == "steps": n_steps += 1; continue
    if hw not in WALK_OK or t.get("foot") == "no" or t.get("access") == "private": continue
    nodes, geom = e["nodes"], e["geometry"]
    for i, (n, g) in enumerate(zip(nodes, geom)):
        coord[n] = (g["lon"], g["lat"])
        if i:
            w = dist(coord[nodes[i - 1]], coord[n])
            # 보행 전용로 선호, 차도는 가중치
            k = 1.0 if hw in ("footway", "path", "pedestrian", "living_street", "cycleway") else 1.4
            adj[nodes[i - 1]].append((n, w * k, w)); adj[n].append((nodes[i - 1], w * k, w))

def nearest(pt):
    return min(coord, key=lambda n: dist(coord[n], pt))

def dijkstra(src, targets):
    pq, seen, prev, real = [(0.0, src)], {}, {}, {src: 0.0}
    while pq:
        d, u = heapq.heappop(pq)
        if u in seen: continue
        seen[u] = d
        if u in targets: break
        for v, w, wr in adj[u]:
            if v not in seen and (v not in real or d + w < seen.get(v, 1e18)):
                prev[v] = u; real[v] = real[u] + wr; heapq.heappush(pq, (d + w, v))
    best = min((t for t in targets if t in seen), key=lambda t: seen[t], default=None)
    if best is None: return None, None
    path = [best]
    while path[-1] != src: path.append(prev[path[-1]])
    return [coord[n] for n in reversed(path)], real[best]

# 돔 외곽에서 25m 이내의 그래프 노드 = 접근점 후보
dome_nodes = {n for n, p in coord.items() if dist(p, (cx, cy)) <= radius + 25}

# 역 엘리베이터(올림픽공원역/한성백제/몽촌토성) 중 역별 최단 접근 1개씩
routes = []
best_by_station = {}
for p in acc["transit_access_points"]:
    if p["dist_to_dome_m"] > 1500: continue
    src = nearest((p["lon"], p["lat"]))
    line, length = dijkstra(src, dome_nodes)
    if not line: continue
    key = p["station"].split("(")[0]
    if key not in best_by_station or length < best_by_station[key]["length_m"]:
        best_by_station[key] = {"station": p["station"], "from_type": p["type"], "length_m": round(length),
                                "walk_min_wheelchair": round(length / 50),  # 휠체어·보행약자 3km/h 가정
                                "coords": [[round(x, 6), round(y, 6)] for x, y in line]}
routes = sorted(best_by_station.values(), key=lambda r: r["length_m"])

feats = []
def pt(lon, lat, **props): feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props})
for p in acc["transit_access_points"]:
    pt(p["lon"], p["lat"], kind=p["type"], name=p["station"])
for e in els:
    t = e.get("tags", {})
    if t.get("railway") == "subway_entrance" and e["type"] == "node":
        pt(e["lon"], e["lat"], kind="subway_entrance", name=t.get("name", "") + (" " + t["ref"] + "번" if t.get("ref") else ""), wheelchair=t.get("wheelchair"))
    if e["type"] == "way" and (t.get("amenity") == "parking" or "building" in t) and e.get("geometry"):
        ring_ = [[g["lon"], g["lat"]] for g in e["geometry"]]
        if ring_[0] != ring_[-1]: ring_.append(ring_[0])
        kind = "parking" if t.get("amenity") == "parking" else "venue"
        feats.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring_]},
                      "properties": {"kind": kind, "name": t.get("name", ""), "wheelchair": t.get("wheelchair"),
                                     "capacity_disabled": t.get("capacity:disabled")}})
steps_lines = [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[g["lon"], g["lat"]] for g in e["geometry"]]},
                "properties": {"kind": "steps"}} for e in els if e.get("tags", {}).get("highway") == "steps"]
feats += steps_lines

out = {"attribution": "© OpenStreetMap contributors (ODbL)",
       "dome": {"center": [round(cx, 6), round(cy, 6)], "radius_m": round(radius, 1), "outline": ring},
       "graph": {"nodes": len(coord), "steps_excluded": n_steps},
       "routes": routes, "features": {"type": "FeatureCollection", "features": feats}}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print("dome center", out["dome"]["center"], "radius", out["dome"]["radius_m"], "m | graph nodes", len(coord), "| steps excluded", n_steps)
for r in routes:
    print("route", r["station"].encode("unicode_escape").decode()[:40], r["from_type"], r["length_m"], "m", r["walk_min_wheelchair"], "min")
print("features", collections.Counter(f["properties"]["kind"] for f in feats))
