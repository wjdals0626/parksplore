"""KSPO DOME 무장애 관람 기초데이터 생성: 지하철 엘리베이터/리프트 + 평면도 시설정보 -> data/access_kspodome.json"""
import sys, json, math, re, pandas as pd
RAW = sys.argv[1]; OUT = sys.argv[2]
DOME = (37.519243, 127.12752)  # KSPO DOME 중심 (OSM way 75956855 외곽선 중심)
def hav(a, b):
    R = 6371000; p1, p2 = map(math.radians, (a[0], b[0])); dp = p2 - p1; dl = math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
pts = []
for f, kind in [("서울시 지하철역 엘리베이터 위치정보.csv", "elevator"), ("서울시 지하철 출입구 리프트 위치정보.csv", "wheelchair_lift")]:
    df = pd.read_csv(f"{RAW}/{f}", encoding="cp949")
    df = df[df["지하철역명"].str.contains("올림픽공원|몽촌토성|한성백제|방이")]
    for _, r in df.iterrows():
        lon, lat = map(float, re.findall(r"[\d.]+", r["노드 WKT"]))
        pts.append({"type": kind, "station": r["지하철역명"], "node_id": int(r["노드 ID"]), "lat": lat, "lon": lon,
                    "dist_to_dome_m": round(hav(DOME, (lat, lon)))})
pts.sort(key=lambda x: x["dist_to_dome_m"])
data = {
  "venue": "KSPO DOME(체조경기장)", "center_approx": {"lat": DOME[0], "lon": DOME[1], "note": "OpenStreetMap 건물 외곽선 중심"},
  "seats": {"total_after_renovation": 14352, "floor2": 6530, "floor3": 7735,
            "wheelchair": {"3f_plan_note": 87, "seat_map_table": 82, "seat_map_label": 84,
                           "issue": "공식 도면 간 장애인석 수 불일치(82/84/87) - 기관 확인 필요"},
            "sections": 52, "box_seats": 121},
  "gates": ["1-1문(대관/분장)", "1-2문(피난출입구 신설)", "1-3문(장비차량)", "2-1문", "2-2문", "2-3문"],
  "entrances_windbreak": 9,
  "facilities_2f": {"toilet_male": 3, "toilet_female": 8 + 2 + 1, "toilet_accessible": 2, "toilet_vip": 1,
                    "tactile_map": "2-1문 인근(방풍실 #2~#3)", "elevator": "도면 미표기 - 기관 확인 필요"},
  "model_3d": {"ramps_slope_material": 4, "note": "3D 모델 재질 'slope' 4개소(상부 링 한쪽 집중)"},
  "transit_access_points": pts,
}
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p in pts: print(p["type"], p["station"], p["dist_to_dome_m"], "m")
