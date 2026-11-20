"""KCISA 올림픽공원 공연정보(KSCperf, 이력 2,502건) -> 공연장별 공연 소요시간 통계 (귀가 계획·쉬운 안내용)
사용: KSCPERF_KEY=<키> python perf_history_stats.py <out.json>"""
import os, sys, re, json, statistics, urllib.request, xml.etree.ElementTree as ET, collections
KEY = os.environ["KSCPERF_KEY"]; URL = "https://api.kcisa.kr/openapi/service/rest/meta/KSCperf?serviceKey={}&numOfRows=100&pageNo={}"
items, page = [], 1
while True:
    r = ET.fromstring(urllib.request.urlopen(URL.format(KEY, page), timeout=90).read())
    its = r.findall(".//item"); items += its
    if len(items) >= int(r.findtext(".//totalCount") or 0) or not its: break
    page += 1
def venue(s):
    s = (s or "").replace(" ", "").lower()
    for k, v in [("kspo", "KSPO DOME"), ("체조", "KSPO DOME"), ("핸드볼", "핸드볼경기장"), ("우리금융", "우리금융아트홀"), ("올림픽홀", "올림픽홀"),
                 ("뮤즈라이브", "뮤즈라이브"), ("수변", "수변무대"), ("88", "88잔디마당"), ("펜싱", "우리금융아트홀"), ("역도", "우리금융아트홀")]:
        if k in s: return v
    return "기타"
def minutes(ext):
    ext = ext or ""; h = re.search(r"(\d+)\s*시간", ext); m = re.search(r"(\d+)\s*분", ext)
    v = (int(h.group(1)) * 60 if h else 0) + (int(m.group(1)) if m else 0)
    return v if 30 <= v <= 600 else None
skip = re.compile(r"주간행사|예약완료|준비대관|대관|철수|셋업")
by = collections.defaultdict(list); n_events = collections.Counter()
for it in items:
    t = it.findtext("title") or ""
    if skip.search(t): continue
    v = venue((it.findtext("spatial") or "") + (it.findtext("subjectKeyword") or ""))
    n_events[v] += 1
    mm = minutes(it.findtext("extent"))
    if mm: by[v].append(mm)
out = {"source": "한국문화정보원 KSCperf(한국체육산업개발 올림픽공원 공연정보)", "records": len(items), "venues": {}}
for v, arr in sorted(by.items(), key=lambda x: -len(x[1])):
    out["venues"][v] = {"events": n_events[v], "with_duration": len(arr), "median_min": statistics.median(arr),
                        "p25_min": statistics.quantiles(arr, n=4)[0] if len(arr) > 3 else None,
                        "p75_min": statistics.quantiles(arr, n=4)[2] if len(arr) > 3 else None}
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=True)[:900])
