"""팍스플로어 - 실시간/일일 데이터 수집 -> web/data/live.json

1) 공연 일정: 올림픽공원 공연정보 (API 엔드포인트 확인 전까지 공개 일정 페이지 파싱으로 대체)
2) 날씨: 기상청 단기예보 (env KMA_KEY, Encoding 키)
3) 주차: 한국체육산업개발 실시간 주차현황 API
GitHub Actions 등에서 30분~1시간 주기 실행을 가정 (키는 Secrets로 주입, 소스에 하드코딩 금지).
"""
import os, re, json, html, datetime as dt, urllib.request, sys

UA = {"User-Agent": "Mozilla/5.0 (barrier-free-viewing-navi; public-data-contest)"}
KST = dt.timezone(dt.timedelta(hours=9))


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def fetch_events():
    url = "https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoList?mid=a20301010100"
    t = get(url)
    items = []
    for m in re.finditer(r'evtSeq=(\d+)" class="item">(.*?)</a>', t, re.S):
        blk = m.group(2)
        f = lambda c: (lambda x: html.unescape(re.sub(r"\s+", " ", x.group(1))).strip() if x else "")(
            re.search(rf'class="{c}">(.*?)</', blk, re.S))
        date = f("date")
        d = re.findall(r"\d{4}-\d{2}-\d{2}", date)
        img = re.search(r'<img src="([^"]+)"', blk)
        items.append({"id": m.group(1), "place": f("place"), "title": f("title"),
                      "start": d[0] if d else None, "end": d[-1] if d else None, "time": f("time"),
                      "image": ("https://www.ksponco.or.kr" + img.group(1)) if img else None,
                      "url": f"https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoView.es?mid=a20301010100&evtSeq={m.group(1)}"})
    return items


def fetch_weather(key):
    now = dt.datetime.now(KST) - dt.timedelta(minutes=15)
    bases = [2, 5, 8, 11, 14, 17, 20, 23]
    h = max([b for b in bases if b <= now.hour], default=None)
    base = now if h is not None else now - dt.timedelta(days=1)
    h = 23 if h is None else h
    url = ("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
           f"?serviceKey={key}&dataType=JSON&numOfRows=2000&pageNo=1"
           f"&base_date={base:%Y%m%d}&base_time={h:02d}00&nx=62&ny=126")
    items = json.loads(get(url))["response"]["body"]["items"]["item"]
    out = {}
    for it in items:
        k = it["fcstDate"] + it["fcstTime"]
        out.setdefault(k, {})[it["category"]] = it["fcstValue"]
    rows = [{"time": k, "temp": v.get("TMP"), "pop": v.get("POP"), "sky": v.get("SKY"), "pty": v.get("PTY"),
             "wind": v.get("WSD")} for k, v in sorted(out.items())]
    return {"base": f"{base:%Y%m%d}{h:02d}00", "hourly": rows}


def fetch_parking():
    t = get("https://www.ksponco.or.kr/online/main/parkingorsApi.do?apiKey=PARKING21803504")
    return {"parking_sum": json.loads(t)[0]["parking_sum"]}


def main(out):
    res = {"updated": dt.datetime.now(KST).isoformat(timespec="minutes")}
    for name, fn in [("events", fetch_events), ("parking", fetch_parking),
                     ("weather", lambda: fetch_weather(os.environ["KMA_KEY"]))]:
        try:
            res[name] = fn()
        except Exception as e:  # 개별 실패가 전체를 막지 않도록
            res[name] = None; res.setdefault("errors", {})[name] = repr(e)[:200]
    json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ev = res.get("events") or []
    print("events", len(ev), "| KSPO DOME", sum("KSPO" in e["place"] for e in ev),
          "| parking", res.get("parking"), "| weather rows", len((res.get("weather") or {}).get("hourly", [])),
          "| errors", res.get("errors"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "web/data/live.json")
