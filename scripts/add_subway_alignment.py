"""OSM 지하철 선로(5호선 마천지선, 9호선) -> 올림픽공원역 승강장 위치·방향을 park_geo.json 에 추가
사용: python add_subway_alignment.py <osm_subway.json> <park_geo.json>"""
import sys, json, math
osm = json.load(open(sys.argv[1], encoding="utf-8")); geo = json.load(open(sys.argv[2], encoding="utf-8"))
evs = [f["geometry"]["coordinates"] for f in geo["features"]["features"] if f["properties"]["kind"] == "elevator" and "올림픽공원" in (f["properties"].get("name") or "")]
st = [sum(p[0] for p in evs) / len(evs), sum(p[1] for p in evs) / len(evs)]
kx = 111320 * math.cos(math.radians(st[1])); ky = 110574
loc = lambda p: ((p[0] - st[0]) * kx, -(p[1] - st[1]) * ky)  # x=동, z=남
lines = {}
for e in osm["elements"]:
    t = e.get("tags", {}); name = t.get("name", "")
    key = "5호선" if "마천" in name or "5" in name else "9호선" if "9" in name else None
    if not key or key in lines: continue
    pts = [loc((g["lon"], g["lat"])) for g in e["geometry"]]
    i = min(range(len(pts)), key=lambda k: pts[k][0] ** 2 + pts[k][1] ** 2)
    a, b = pts[max(0, i - 2)], pts[min(len(pts) - 1, i + 2)]
    ang = math.atan2(b[1] - a[1], b[0] - a[0])  # x축(동) 기준, z(남) 방향 양수
    lines[key] = {"offset_m": [round(pts[i][0], 1), round(pts[i][1], 1)], "angle_rad": round(ang, 4), "osm_way": e["id"], "layer": t.get("layer")}
geo["subway"] = {"station_center": st, "lines": lines, "source": "OpenStreetMap railway=subway"}
json.dump(geo, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
print(json.dumps(geo["subway"], ensure_ascii=True))
