/* 공원 지도 모드: MapLibre(OpenFreeMap, 키 불필요) + KSPO DOME 3D 모델(three.js 커스텀 레이어)
   - 실제 위치에 공연장 외관 배치, 주변 3D 건물, 지하철 엘리베이터·리프트, 주차장, 계단(회피), 계단 없는 경로
   - 라이트/다크 테마에 맞춰 지도 스타일 전환 (style.load 마다 오버레이 재추가) */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createStickman } from "./stickman.js?v=202611200856";
import { VWORLD_KEY } from "./config.js?v=202611200856";
import { createDomeExterior } from "./exterior.js?v=202611200856";
import { createStation } from "./station.js?v=202611200856";

const ML = window.maplibregl;
/* 바탕: 브이월드 항공사진(국토교통부) + 브이월드 하이브리드(지명·도로) + OpenFreeMap 건물(3D 돌출) */
function buildStyle(theme) {
  const vw = (layer, ext) => `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${ext}`;
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      sat: { type: "raster", tiles: [vw("Satellite", "jpeg")], tileSize: 256, minzoom: 6, maxzoom: 19,
             attribution: '항공사진 © <a href="https://www.vworld.kr" target="_blank">브이월드(국토교통부)</a>' },
      hyb: { type: "raster", tiles: [vw("Hybrid", "png")], tileSize: 256, minzoom: 6, maxzoom: 19 },
      openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": theme === "dark" ? "#1a1b1e" : "#e9eaf0" } },
      { id: "sat", type: "raster", source: "sat",
        paint: { "raster-brightness-max": theme === "dark" ? 0.78 : 1, "raster-saturation": theme === "dark" ? -0.25 : -0.05, "raster-fade-duration": 150 } },
      { id: "hyb", type: "raster", source: "hyb", paint: { "raster-opacity": 0.9 } },
    ],
  };
}
export const MAP_COLORS = { route: "#ff7a1a", alt: "#64748b", steps: "#e11d48", elevator: "#ff7a1a", lift: "#0ea5e9", parking: "#94a3b8" };
const THEME = {
  light: { building: "#ecebe6", casing: "#ffffff", label: "#18181b", halo: "#ffffff", dome: 0xf4f4f6 },
  dark:  { building: "#9a9aa3", casing: "#1a1b1e", label: "#fafafa", halo: "#1a1b1e", dome: 0xd4d4d8 },
};
// 모델 좌표계: +x=북, +z=동 (모델 내 방위 문자 기준), 경기장 중심 (105.4, -71.7), 지면 y≈-0.71
const MODEL_CENTER = new THREE.Vector3(105.44, -0.71, -71.68);

let gltfPromise = null;
function loadDome() {
  if (!gltfPromise) {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    gltfPromise = loader.loadAsync("assets/kspodome.glb").then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) {
        // 모델 바닥의 방위 문자(N/S/E/W, 재질 text_white)는 항공사진 위에서 어색하므로 지도에서는 숨김
        if ((o.material.name || o.name || "").toLowerCase() === "text_white") o.visible = false;
        const c = o.material.color ? o.material.color.clone() : new THREE.Color(0xcccccc);
        o.material = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, flatShading: true });
      } });
      g.scene.position.copy(MODEL_CENTER).multiplyScalar(-1);
      return g.scene;
    });
  }
  return gltfPromise;
}

export function initMap(container, geo, onReady, theme = "light") {
  const map = new ML.Map({
    maxZoom: 19.5,
    container, style: buildStyle(theme), center: geo.dome.center, zoom: 16.2, pitch: 55, bearing: -20, maxPitch: 75,
    attributionControl: { compact: true },
  });
  map.__theme = theme; map.__geo = geo; map.__actorSpec = null; map.__markers = [];
  if (location.hash.includes("debug")) window.__map = map;
  map.addControl(new ML.NavigationControl({ visualizePitch: true }), "top-right");
  map.on("error", (e) => { document.body.dataset.mapError = String(e?.error?.message || e?.message || e).slice(0, 300); });
  map.on("idle", () => { document.body.dataset.mapIdle = "1"; });
  map.on("style.load", () => addOverlays(map, geo));
  lookWalkMap(map);
  map.once("load", () => { addPlaceLabels(map, geo); onReady?.(map); });

  map.on("click", "pois", (e) => {
    const p = e.features[0].properties;
    new ML.Popup().setLngLat(e.lngLat).setHTML(`<b>${p.name}</b><br>${{ elevator: "엘리베이터", wheelchair_lift: "휠체어 리프트" }[p.kind] || "지하철 출입구"}`).addTo(map);
  });
  map.on("click", "parking", (e) => new ML.Popup().setLngLat(e.lngLat)
    .setHTML(`<b>주차장</b> ${e.features[0].properties.name || ""}<br><small>장애인 주차면 위치는 공개 데이터 없음</small>`).addTo(map));
  for (const id of ["pois", "parking"]) {
    map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
  }
  return map;
}

/* 사전답사 시점 조작(지도): 누른 채 좌우 = 360° 회전, 앞(위)·뒤(아래) = 바라보는 방향으로 이동
   (오른쪽 버튼·Ctrl 드래그 = 기울기, 휠 = 확대/축소는 MapLibre 기본 동작 유지) */
function lookWalkMap(map) {
  map.dragPan.disable();
  const el = map.getCanvasContainer(); let drag = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.ctrlKey || e.pointerType === "touch" && !e.isPrimary) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, ax: 0, ay: 0, axis: null };
  });
  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    // 축 고정: 처음 8px 움직인 방향으로 회전(좌우) 또는 앞뒤 이동(상하) 중 하나만
    if (!drag.axis) { drag.ax += dx; drag.ay += dy; if (Math.abs(drag.ax) + Math.abs(drag.ay) < 8) return;
      drag.axis = Math.abs(drag.ax) >= Math.abs(drag.ay) ? "x" : "y"; }
    map.stop(); map.__touched = true;
    if (drag.axis === "x") map.jumpTo({ bearing: map.getBearing() - dx * 0.3 });
    else if (dy) map.panBy([0, -dy * 1.4], { duration: 0 });
    document.querySelectorAll(".navhint").forEach((h) => h.classList.add("dim"));
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  addEventListener("pointerup", end); addEventListener("pointercancel", end);
}

/* 길찾기 표시(지도 단계 공통): 주변 건물 이름(검은 글씨), KSPO DOME(보라 테두리 말풍선),
   올림픽공원역 엘리베이터·휠체어 리프트 말풍선(가까운 출구 번호 포함). 축소 시 역 시설은 한 개로 묶어 표시 */
const PL = {
  ko: { dome: "KSPO DOME 공연장", ev: "엘리베이터", lift: "휠체어 리프트", near: (n, w) => `${n}번 출구 옆 ${w}`, count: (n) => ` ${n}곳`, group: (e, l) => `엘리베이터 ${e}곳, 휠체어 리프트 ${l}곳` },
  en: { dome: "KSPO DOME (venue)", ev: "Elevator", lift: "Wheelchair lift", near: (n, w) => `${w} by Exit ${n}`, count: (n) => ` (${n})`, group: (e, l) => `${e} elevators and ${l} wheelchair lift` },
};
function addPlaceLabels(map, geo) {
  const mk = (cls, lnglat, anchor = "bottom", offset = [0, 0]) => {
    const el = document.createElement("div"); el.className = cls;
    const m = new ML.Marker({ element: el, anchor, offset }).setLngLat(lnglat).addTo(map); return { el, m };
  };
  const L = (map.__labels = { lm: [], fac: [], group: null, dome: null });
  for (const b of geo.landmarks || []) { const o = mk("lm-label", b.lnglat, "center"); o.data = b; L.lm.push(o); }
  L.dome = mk("dome-label", geo.dome.center, "bottom", [0, -6]);
  // 올림픽공원역 엘리베이터·리프트 + 가장 가까운 출구 번호
  const feats = geo.features.features, c = geo.subway?.station_center || geo.dome.center;
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * 88200, (a[1] - b[1]) * 110574);
  const exits = feats.filter((f) => f.properties.kind === "subway_entrance" && /(\d+)\s*번/.test(f.properties.name || ""));
  const fac = feats.filter((f) => ["elevator", "wheelchair_lift"].includes(f.properties.kind) && dist(f.geometry.coordinates, c) < 300);
  const placed = [];
  fac.forEach((f, i) => {
    const p = f.geometry.coordinates, ex = exits.slice().sort((a, b) => dist(a.geometry.coordinates, p) - dist(b.geometry.coordinates, p))[0];
    const exit = ex && dist(ex.geometry.coordinates, p) < 60 ? ex.properties.name.match(/(\d+)\s*번/)[1] : null;
    // 같은 출구 옆 같은 종류 시설은 말풍선 하나로 합침 ("2번 출구 옆 엘리베이터 2곳")
    const same = L.fac.find((o) => o.data.kind === f.properties.kind && o.data.exit && o.data.exit === exit);
    if (same) { same.data.n++; return; }
    const k = placed.filter((q) => dist(q, p) < 45).length; placed.push(p); // 가까운 시설끼리 겹치지 않게 위로 쌓기
    const o = mk(`fac-bubble ${f.properties.kind === "elevator" ? "ev" : "lift"}`, p, "bottom", [0, -10 - 34 * k]);
    o.data = { kind: f.properties.kind, exit, n: 1 };
    L.fac.push(o);
  });
  if (fac.length) {
    const mid = fac.reduce((a, f) => [a[0] + f.geometry.coordinates[0] / fac.length, a[1] + f.geometry.coordinates[1] / fac.length], [0, 0]);
    L.group = mk("fac-bubble ev", mid, "bottom", [0, -10]);
    L.group.data = { ev: fac.filter((f) => f.properties.kind === "elevator").length, lift: fac.filter((f) => f.properties.kind !== "elevator").length };
  }
  const zoomVis = () => {
    const z = map.getZoom(), near = z >= 17.4;
    L.fac.forEach((o) => (o.el.style.display = near ? "" : "none"));
    if (L.group) L.group.el.style.display = near ? "none" : "";
    L.lm.forEach((o) => (o.el.style.display = z >= 15.2 ? "" : "none"));
  };
  map.on("zoom", zoomVis); zoomVis();
  setMapLang(map, map.__lang || document.documentElement.lang || "ko");
}
export function setMapLang(map, lang) {
  if (!map) return; map.__lang = lang; const L = map.__labels; if (!L) return;
  const T = PL[lang] || PL.ko;
  for (const o of L.lm) o.el.textContent = o.data[lang] || o.data.ko;
  L.dome.el.textContent = T.dome;
  for (const o of L.fac) { const w = (o.data.kind === "elevator" ? T.ev : T.lift) + (o.data.n > 1 ? T.count(o.data.n) : "");
    o.el.textContent = o.data.exit ? T.near(o.data.exit, w) : w; }
  if (L.group) L.group.el.textContent = T.group(L.group.data.ev, L.group.data.lift);
}

/* 범례 항목 누르면 지도에서 해당 표시를 약 2.4초간 깜빡임 */
const FLASH_LAYERS = { route: ["route-main", "line-width", 6, 14], steps: ["steps", "line-width", 4, 10], alt: ["route-alt", "line-width", 3, 8], park: ["parking", "fill-opacity", 0.22, 0.75] };
export function flashMapItem(map, key) {
  if (!map) return;
  clearInterval(map.__flashT); let n = 0;
  const L = map.__labels || {};
  const els = { fac: [...(L.fac || []), L.group].filter(Boolean).map((o) => o.el), dome: L.dome ? [L.dome.el] : [], bld: (L.lm || []).map((o) => o.el),
    sub: [...map.getContainer().querySelectorAll(".st-label.under")] }[key] || [];
  if (key === "sub") map.getContainer().classList.add("show-st");
  els.forEach((el) => { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2500); });
  const lay = FLASH_LAYERS[key], ghosts = key === "sub" ? map.__station?.userData.ghosts || [] : [];
  map.__flashT = setInterval(() => {
    const on = n % 2 === 0, done = ++n > 8;
    if (lay && map.getLayer(lay[0])) map.setPaintProperty(lay[0], lay[1], done || !on ? lay[2] : lay[3]);
    for (const g of ghosts) g.material.opacity = done || !on ? g.base : 0.85;
    if (ghosts.length) map.triggerRepaint();
    if (done) { clearInterval(map.__flashT); if (key === "sub") map.getContainer().classList.toggle("show-st", map.getZoom() >= 17.3); }
  }, 300);
}

export function setMapTheme(map, theme) {
  if (!map || map.__theme === theme) return;
  map.__theme = theme; map.setStyle(buildStyle(theme)); // style.load -> addOverlays
}

function addOverlays(map, geo) {
  const th = THEME[map.__theme] || THEME.light;
  // 3D 건물
  if (!map.getLayer("building-3d") && map.getSource("openmaptiles")) {
    map.addLayer({ id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
      paint: { "fill-extrusion-color": th.building, "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
               "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 16, 0.8, 18.5, 0.35],
               "fill-extrusion-vertical-gradient": true } }, "hyb");
  }
  // KSPO DOME 자리의 OSM 건물은 숨김 (3D 실감형 모델로 대체)
  const domeHole = { type: "Feature", geometry: { type: "Polygon", coordinates: [geo.dome.outline.map((p) => [...p])] } };
  const hideDome = ["!", ["within", domeHole]];
  for (const id of ["building-3d", "building"]) if (map.getLayer(id)) {
    const f = map.getFilter(id); map.setFilter(id, f ? ["all", f, hideDome] : hideDome);
  }
  map.addSource("park", { type: "geojson", data: geo.features });
  map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: geo.routes.map((r, i) => ({
    type: "Feature", properties: { rank: i, station: r.station, length: r.length_m, min: r.walk_min_wheelchair },
    geometry: { type: "LineString", coordinates: r.coords } })) } });
  const C = MAP_COLORS;
  map.addLayer({ id: "parking", type: "fill", source: "park", filter: ["==", ["get", "kind"], "parking"],
    paint: { "fill-color": C.parking, "fill-opacity": 0.22, "fill-outline-color": C.parking } });
  map.addLayer({ id: "steps", type: "line", source: "park", filter: ["==", ["get", "kind"], "steps"],
    paint: { "line-color": C.steps, "line-width": 4, "line-dasharray": [1, 1] } });
  map.addLayer({ id: "route-alt", type: "line", source: "routes", filter: [">", ["get", "rank"], 0],
    layout: { "line-cap": "round" }, paint: { "line-color": C.alt, "line-width": 3, "line-dasharray": [2, 1.5], "line-opacity": 0.85 } });
  map.addLayer({ id: "route-main-casing", type: "line", source: "routes", filter: ["==", ["get", "rank"], 0],
    layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": th.casing, "line-width": 11 } });
  map.addLayer({ id: "route-main", type: "line", source: "routes", filter: ["==", ["get", "rank"], 0],
    layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.route, "line-width": 6 } });
  map.addLayer({ id: "pois", type: "circle", source: "park", filter: ["in", ["get", "kind"], ["literal", ["elevator", "wheelchair_lift", "subway_entrance"]]],
    paint: { "circle-radius": ["match", ["get", "kind"], "subway_entrance", 4, 8],
             "circle-color": ["match", ["get", "kind"], "elevator", C.elevator, "wheelchair_lift", C.lift, "#a1a1aa"],
             "circle-stroke-color": th.casing, "circle-stroke-width": 2 } });
  map.addLayer(domeLayer(map, geo.dome.center));
}

function domeLayer(mapRef, lngLat) {
  const mc = ML.MercatorCoordinate.fromLngLat(lngLat, 0);
  const s = mc.meterInMercatorCoordinateUnits();
  const camera = new THREE.Camera(), scene = new THREE.Scene();
  let renderer, map;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(100, 200, 50); scene.add(sun);
  const pivot = new THREE.Group(); pivot.rotation.y = Math.PI / 2; // 모델 +x(북) -> -Z(북), +z(동) -> +X(동)
  scene.add(pivot);
  const actorsGroup = new THREE.Group(); scene.add(actorsGroup);
  mapRef.__actorsGroup = actorsGroup; let last = performance.now();
  const base = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  return {
    id: "kspo-dome-3d", type: "custom", renderingMode: "3d",
    onAdd(m, gl) {
      map = m;
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      // 외관: 실측 치수 기반 KSPO DOME 외관 + 지붕 실사(브이월드 항공사진) / 올림픽공원역 3D
      const ext = createDomeExterior(lngLat, VWORLD_KEY); scene.add(ext);
      ext.userData.ready.then(() => { map.triggerRepaint(); document.body.dataset.domeLoaded = "1"; });
      const st = createStation(map.__geo, lngLat); scene.add(st); map.__station = st;
      // 역 라벨: HTML 마커(지도 위 선명), 확대(17.3+)했을 때만 표시
      for (const m of map.__stationMarkers || []) m.remove();
      map.__stationMarkers = (st.userData.labels || []).map((l) => {
        const el = document.createElement("div"); el.className = `st-label ${l.cls}`; el.textContent = l.text;
        return new ML.Marker({ element: el, anchor: "center" }).setLngLat(toLngLat(lngLat, l.pos)).addTo(map);
      });
      const vis = () => map.getContainer().classList.toggle("show-st", map.getZoom() >= 17.3);
      map.on("zoom", vis); vis();
      spawnMapActors(map);
    },
    render(gl, arg) {
      const mm = arg && arg.defaultProjectionData ? arg.defaultProjectionData.mainMatrix : arg;
      camera.projectionMatrix = new THREE.Matrix4().fromArray(mm).multiply(base);
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      const acts = map.__actors || [];
      for (const a of acts) {
        a.update(dt, now / 1000);
        if (a.ride) { // 2초 대기 -> 10초 상승(가감속) -> 지상에서 3초 정지, 반복
          const r = a.ride, c = (now / 1000 - r.t0) % 15, u = c < 2 ? 0 : c > 12 ? 1 : (1 - Math.cos(Math.PI * (c - 2) / 10)) / 2;
          a.group.position.set(r.x, r.y0 + (r.y1 - r.y0) * u, r.z);
        }
        a.marker?.setLngLat(toLngLat(map.__geo.dome.center, a.group.position)); }
      renderer.resetState(); renderer.render(scene, camera);
      if (acts.length) map.triggerRepaint();
    },
  };
}

/* ---------- 지도 위 졸라맨 ---------- */
const M_PER_DEG_LAT = 110574;
const toLocal = (c, [lon, lat]) => new THREE.Vector3((lon - c[0]) * 111320 * Math.cos(c[1] * Math.PI / 180), 0, -(lat - c[1]) * M_PER_DEG_LAT);
const toLngLat = (c, v) => [c[0] + v.x / (111320 * Math.cos(c[1] * Math.PI / 180)), c[1] - v.z / M_PER_DEG_LAT];

/** spec: [{ pose, along: "route" | "routeEnd", bubble: "텍스트", scale, speed }] */
export function setMapActors(map, spec) {
  if (!map) return;
  map.__actorSpec = spec || null;
  spawnMapActors(map);
}
function spawnMapActors(map) {
  for (const a of map.__actors || []) { a.group.parent?.remove(a.group); a.extra?.parent?.remove(a.extra); a.marker?.remove(); a.dispose(); }
  map.__actors = [];
  const grp = map.__actorsGroup, geo = map.__geo;
  if (!grp || !map.__actorSpec || !geo?.routes?.length) return;
  const c = geo.dome.center, route = geo.routes[0].coords.map((p) => toLocal(c, p));
  for (const s of map.__actorSpec) {
    const a = createStickman({ wheelchair: !!s.wheelchair, scale: s.scale || 10, screenBubble: false });
    a.setPose(s.pose || "walk");
    if (s.along === "route") a.setPath(route, s.speed || 35, "loop");
    else if (s.along === "elevator") {
      // 승강장(지하 26m) -> 엘리베이터 수직 이동 -> 지상 -> 경로 시작 구간 걷기
      const evs = geo.features.features.filter((f) => f.properties.kind === "elevator" && /올림픽공원/.test(f.properties.name || ""))
        .map((f) => toLocal(c, f.geometry.coordinates));
      const ev = evs.sort((p, q) => p.distanceTo(route[0]) - q.distanceTo(route[0]))[0] || route[0];
      // 엘리베이터 칸(직육면체) 안에 가만히 서서 승강장(지하 26m)에서 지상까지 올라감
      a.setPose("idle");
      const k = s.scale || 3, car = new THREE.Group();
      const cw = 1.5, ch = 2.3; // 사람 기준(키 1.7m) 칸 크기, 루트 스케일과 함께 커짐
      const box = new THREE.BoxGeometry(cw, ch, cw); box.translate(0, ch / 2, 0);
      car.add(new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0xffb27a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })));
      car.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0xff7a1a })));
      const fl = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.08, cw), new THREE.MeshLambertMaterial({ color: 0x5b4636 })); fl.position.y = -0.04; car.add(fl);
      a.group.add(car);
      // 승강로(지하 26m ~ 지상) 반투명 기둥
      const sh = new THREE.BoxGeometry(cw * k * 1.15, 26, cw * k * 1.15); sh.translate(ev.x, -13, ev.z);
      const shaft = new THREE.Group();
      shaft.add(new THREE.Mesh(sh, new THREE.MeshLambertMaterial({ color: 0xffd2b0, transparent: true, opacity: 0.12, depthWrite: false })));
      shaft.add(new THREE.LineSegments(new THREE.EdgesGeometry(sh), new THREE.LineBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.7 })));
      grp.add(shaft); a.extra = shaft;
      a.group.position.copy(ev).setY(-26);
      a.ride = { x: ev.x, z: ev.z, y0: -26, y1: 0, t0: performance.now() / 1000 };
    }
    else { const end = route[route.length - 1], prev = route[Math.max(0, route.length - 4)]; a.group.position.copy(end); a.faceTowards(prev); }
    if (s.bubble) {
      const el = document.createElement("div"); el.className = "map-bubble"; el.textContent = s.bubble;
      a.marker = new ML.Marker({ element: el, anchor: "bottom", offset: [0, -30] }).setLngLat(toLngLat(c, a.group.position)).addTo(map);
    }
    grp.add(a.group); map.__actors.push(a);
  }
  map.triggerRepaint();
}
