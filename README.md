# 팍스플로어 (MVP)

올림픽공원 무장애 관람 사전답사 서비스.

KSPO DOME 실감형 3D 공공데이터로 교통약자·발달장애인·외국인 관객이 공연 전에 공연장을 미리 둘러보는 웹 서비스.

## 구조
```
scripts/
  dae_to_glb.py         실감형 콘텐츠 DAE(475MB) -> 재질별 병합 GLB(44MB)
  render_check.py       변환 검증 렌더(평면/단면)
  extract_poi.py        경사로/출입문/출입통로/소화설비 좌표 추출 -> data/model_poi.json
  build_access_data.py  지하철 엘리베이터·리프트 + 도면 시설정보 -> data/access_kspodome.json
  fetch_live.py         공연일정·기상청 단기예보·실시간 주차 -> web/data/live.json
  perf_history_stats.py KCISA 공연정보 이력(2,502건) -> 공연장별 소요시간 통계(예상 종료시각)
  build_park_geo.py     OSM(Overpass) + 역 엘리베이터 -> 공원 지도 레이어·계단 없는 경로(web/data/park_geo.json)
  add_subway_alignment.py OSM 선로(5호선 마천지선·9호선) -> 올림픽공원역 승강장 위치·방향(park_geo.json subway)
  build_landmarks.py    OSM 건물·조형물 이름(data/osm_names.json) -> 지도 길찾기용 건물명(park_geo.json landmarks)
  make_logo.py          로고 흰배경 투명화 -> 헤더 로고·파비콘
web/                    정적 사이트 (three.js + MapLibre/OpenFreeMap, 빌드 불필요)
  map.js                공원 지도 모드: 실제 위치에 KSPO DOME 3D 외관 + 경로/엘리베이터/주차장/계단
  lookwalk.js           사전답사 시점 조작: 누른 채 좌우 = 360° 둘러보기, 앞뒤 = 걸어서 이동(벽·객석 충돌), 휠/W·S 이동
  stickman.js           안내 캐릭터(보라색 마네킹형, 실제 키 1.7m, 객석 착석 포즈 cheer/earplug). 단계별 동선은 3D 실측(통로 링 r≈43.5m, 출입통로 바닥 4.2m·천장 6.2m, r≈49m 철문)
  stage.js              공연 무대(경기장 동쪽 끝(θ≈180°), 휠체어석 정면): 무대·돌출무대·LED 벽·트러스·조명 빔. '공연 중' 단계에서만 점등
  assets/kspodome.glb   meshopt 압축본 (4MB)
.github/workflows/update-live.yml  30분 주기 갱신 + GitHub Pages 배포
```

## 로컬 미리보기
`python scripts/serve.py` (캐시 끔, http://127.0.0.1:8765) · 코드 수정 후 `python scripts/bump_version.py` 로 ?v= 갱신

## 재현 순서
```bash
python scripts/dae_to_glb.py "<...>/temp_export.dae" assets/kspodome_raw.glb data/kspodome_model_summary.json
npx @gltf-transform/cli@4.1.1 optimize assets/kspodome_raw.glb web/assets/kspodome.glb --compress meshopt --simplify true --simplify-ratio 0.5 --simplify-error 0.0005 --texture-compress false --join false --instance false --flatten false --palette false
python scripts/build_access_data.py "../01. 활용 데이터" web/data/access_kspodome.json
KMA_KEY=<인증키> python scripts/fetch_live.py web/data/live.json
cd web && python -m http.server 8765
```
딥링크: `#step=5` (사전답사 단계), `#show=1&tab=today` (공연 선택 + 탭).

## 알려진 한계 (기획서 '추가 개방 제안'과 연결)
- 공연정보 API(KCISA KSCperf)는 2025-01-02 일괄 적재된 이력 아카이브로 일자 필드·예정 공연 없음 -> 일정은 올림픽공원 공개 공연일정 페이지 파싱, API는 소요시간 통계에 활용
- 유실물 API(KSClost)는 2026-11-17 기준 정상 키로도 HTTP 504(제공기관 서버 장애) -> 미사용
- 장애인석 수 도면 간 불일치(82/84/87), 내부 엘리베이터 도면 미표기
- 공연장 중심: OSM 건물 외곽선 중심(37.519243, 127.12752). 모델 방위는 모델 내 N/S/E/W 문자 기준
- 지도 데이터 © OpenStreetMap contributors (ODbL), 타일 OpenFreeMap
- 지도 바탕: 브이월드(국토교통부) 항공사진·하이브리드 WMTS. 키는 web/config.js(도메인 제한형) - 배포 도메인을 브이월드에 추가 등록해야 함
- 인증키는 소스에 넣지 않음(환경변수/Secrets)
- 문체부 관람좌석별 조망 3D(sketchfab 설계용)는 기존 실감형 콘텐츠 DAE와 동일 파일(MD5 일치), 텍스처 UV 없음 -> 추가 반영 사항 없음
- 3D 모델의 출입통로 철문은 닫힌 상태로 모델링됨 -> 캐릭터는 문 안쪽에서 객석 방향으로만 이동
- 출입구 번호: 3D 모델 통로 위 표지판 글자(W1~W8, N1~N4, S1~S4, E1~E8)를 그대로 사용. W=θ0(서), N=θ+90(북)으로 지도 방위(+x=북)와 일치. 괄호 속 좌석 구역은 좌석배치도 구역 각도에서 가장 가까운 구역
- 2-1·2-2·2-3문: 3D 모델에는 외벽 문과 2층 복도가 없음(외피 r≈65.5m 한 겹) -> 2층 평면도 위치(2-2문 = 휠체어석 쪽 θ0, 2-1/2-3문 = 좌우 약 64°)에 표시
- 3D 레이어 '통로 문'(재질 door)은 각 출입통로 안의 철문, '출입통로'(재질 turnel)는 그 통로 구조물. 같은 장소의 두 부분
