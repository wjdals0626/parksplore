"""길찾기용 주변 건물 이름(OSM, Overpass data/overpass_names.txt 결과 data/osm_names.json) -> park_geo.json 'landmarks'
지하철역~KSPO DOME 동선에서 눈에 띄는 건물·조형물만 선별."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
PICK = {  # OSM name -> (표시 이름 ko, en)
    "올림픽수영경기장": ("올림픽수영경기장", "Olympic Swimming Pool"),
    "SK올림픽핸드볼경기장": ("SK핸드볼경기장", "SK Handball Stadium"),
    "우리금융아트홀": ("우리금융아트홀", "Woori Art Hall"),
    "올림픽홀": ("올림픽홀", "Olympic Hall"),
    "올림픽공원 테니스경기장": ("테니스경기장", "Tennis Court"),
    "K-아트홀(태권도공연장)": ("K-아트홀", "K-Art Hall"),
    "엄지손가락": ("엄지손가락 조형물", "Thumb sculpture"),
    "벨로드롬": ("벨로드롬", "Velodrome"),
    "88호수 수변무대": ("88호수 수변무대", "88 Lakeside Stage"),
    "한국체육대학교 본관": ("한국체육대학교", "Korea Natl. Sport Univ."),
    "올림픽컨벤션센터": ("올림픽컨벤션센터", "Olympic Convention Center"),
    # 올림픽공원역 주변(1단계 확대 화면에서 보이는 건물)
    "파리크라상": ("파리크라상", "Paris Croissant"),
    "올림픽프라자": ("올림픽프라자", "Olympic Plaza"),
    "KB국민은행": ("KB국민은행", "KB Kookmin Bank"),
    "올림픽공원 실내테니스장": ("실내테니스장", "Indoor Tennis Court"),
    "외환은행": ("하나은행", "Hana Bank"),
    "88서울올림픽": ("88서울올림픽 기념비", "Seoul 1988 Monument"),
}
els = json.load(open(root / "data/osm_names.json", encoding="utf-8"))["elements"]
seen, out = set(), []
for e in els:
    n = e["tags"].get("name")
    if n in PICK and n not in seen:
        c = e.get("center") or {"lon": e.get("lon"), "lat": e.get("lat")}
        seen.add(n); out.append({"ko": PICK[n][0], "en": PICK[n][1], "lnglat": [round(c["lon"], 6), round(c["lat"], 6)]})
gp = root / "web/data/park_geo.json"
g = json.load(open(gp, encoding="utf-8")); g["landmarks"] = out
json.dump(g, open(gp, "w", encoding="utf-8"), ensure_ascii=False)
print(len(out), "landmarks; missing:", set(PICK) - seen)
