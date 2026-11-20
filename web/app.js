import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createLookWalk } from "./lookwalk.js?v=202611200856";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { initMap, setMapTheme, setMapActors, setMapLang, flashMapItem } from "./map.js?v=202611200856";
import { createStickman } from "./stickman.js?v=202611200856";
import { createStage } from "./stage.js?v=202611200856";

// 데이터 파일도 코드 버전으로 캐시 무효화
const DATA_V = new URL(import.meta.url).searchParams.get("v") || Date.now();

/* ---------- i18n ---------- */
const T = {
  ko: { title: "팍스플로어", subtitle: "KSPO DOME 실감형 3D로 미리 가 보는 공연장", easy: "쉬운 안내", loading: "3D 공연장을 불러오는 중…",
    l_slope: "경사로", l_door: "통로 문", l_tunnel: "출입통로", l_num: "출입구 번호", l_fire: "소화·비상설비", l_roof: "지붕 보기", photo: "사진", hint: "좌우로 끌면 360° 둘러보기, 위아래로 끌면 앞뒤로 이동",
    m_map: "공원 지도", m_in: "공연장 내부", g_route: "계단 없는 추천 경로", g_route_d: "이 주황색 길을 따라가세요", g_alt: "다른 역에서 오는 길", g_steps: "계단 (피하세요)", g_steps_d: "휠체어·유모차는 이용 불가",
    lg_title: "지도 보는 법", g_fac: "엘리베이터와 휠체어 리프트", g_fac_d: "말풍선이 가리키는 곳에서 타요", g_dome: "KSPO DOME 공연장", g_bld: "주변 건물 이름", lg_tap: "항목을 누르면 지도에서 깜빡여요", home: "올림픽공원역으로 돌아가기", homeIn: "처음 보던 위치로 돌아가기", g_sub: "지하 승강장", g_sub_d: "5호선은 보라색, 9호선은 금색",
    g_ev: "지하철 엘리베이터", g_lift: "휠체어 리프트", g_park: "주차장",
    t_show: "공연 선택", t_tour: "사전 답사", t_today: "오늘의 이동", t_info: "접근성 정보",
    show_hint: "관람할 KSPO DOME 공연을 고르면 날씨·이동 정보가 공연 일정에 맞춰집니다.",
    wx: "공연 시간 날씨", pk: "올림픽공원 주차 현황", tr: "가까운 지하철 엘리베이터·리프트", seats: "좌석", gap: "공공데이터로 확인되지 않는 정보", src: "사용한 공공데이터",
    noEvents: "예정된 KSPO DOME 공연 정보를 불러오지 못했습니다.", pickShow: "공연을 먼저 선택하세요.", outRange: "예보 범위(약 3일) 밖입니다. 공연 3일 전부터 확인할 수 있어요.",
    parkNote: "공원 전체 주차 차량 수(구역별·장애인 주차면 정보는 미제공)", updated: "데이터 갱신", est: "추정", cars: "대",
    sky: { 1: "맑음", 3: "구름 많음", 4: "흐림" }, pty: { 0: "", 1: "비", 2: "비/눈", 3: "눈", 4: "소나기" }, pop: "강수확률", wind: "바람",
    elevator: "엘리베이터", wheelchair_lift: "휠체어 리프트" },
  en: { title: "ParksPlore", subtitle: "Preview KSPO DOME in 3D before the show", easy: "Easy read", loading: "Loading 3D venue…",
    l_slope: "Ramps", l_door: "Passage doors", l_tunnel: "Vomitories", l_num: "Entrance numbers", l_fire: "Safety equipment", l_roof: "Show roof", photo: "Photo", hint: "Drag sideways to look around 360°, drag up or down to move",
    m_map: "Park map", m_in: "Inside venue", g_route: "Step-free route", g_route_d: "Follow this orange path", g_alt: "From other stations", g_steps: "Stairs (avoid)", g_steps_d: "Not for wheelchairs or strollers",
    lg_title: "How to read the map", g_fac: "Elevators and wheelchair lift", g_fac_d: "Board where the bubble points", g_dome: "KSPO DOME venue", g_bld: "Nearby buildings", lg_tap: "Tap an item to flash it on the map", home: "Back to Olympic Park Station", homeIn: "Back to the starting view", g_sub: "Underground platforms", g_sub_d: "Line 5 purple, Line 9 gold",
    g_ev: "Subway elevator", g_lift: "Wheelchair lift", g_park: "Parking",
    t_show: "Shows", t_tour: "Pre-visit", t_today: "Getting there", t_info: "Access info",
    show_hint: "Pick a KSPO DOME show to tailor weather and travel info to its schedule.",
    wx: "Weather at show time", pk: "Olympic Park parking", tr: "Nearest subway elevators & lifts", seats: "Seating", gap: "Not confirmed by public data", src: "Public data used",
    noEvents: "Could not load upcoming KSPO DOME shows.", pickShow: "Select a show first.", outRange: "Outside the ~3-day forecast range. Check again closer to the show.",
    parkNote: "Total cars parked in the park (no per-lot or accessible-space data)", updated: "Updated", est: "estimated", cars: "cars",
    sky: { 1: "Clear", 3: "Partly cloudy", 4: "Cloudy" }, pty: { 0: "", 1: "Rain", 2: "Rain/Snow", 3: "Snow", 4: "Showers" }, pop: "Rain chance", wind: "Wind",
    elevator: "Elevator", wheelchair_lift: "Wheelchair lift" },
};
let lang = "ko", easy = false;
const t = (k) => T[lang][k] ?? k;

/* ---------- tour steps (model coords: m, Y-up; arena center ≈ (105.4, 0.2, -71.7)) ---------- */
const C = new THREE.Vector3(105.4, 2, -71.7);
// 경기장 중심 기준 극좌표(반지름 r m, 각도 th°: 0=남쪽 통로 방향, 90=동쪽 2층 문) -> 모델 좌표
const P = (r, th, y) => [+(105.4 + r * Math.sin(th * Math.PI / 180)).toFixed(2), y, +(-71.7 - r * Math.cos(th * Math.PI / 180)).toFixed(2)];
const STEPS = [
  { cam: [105, 170, 110], tgt: [105, 0, -71], est: false, mode: "map",
    view: { center: [127.13095, 37.51645], zoom: 18.6, pitch: 58, bearing: 172 },
    mapActors: [{ pose: "walk", along: "elevator", scale: 4.5, bubble: { ko: "엘리베이터로 지상까지", en: "Elevator up to street level" } }],
    ko: ["올림픽공원역 엘리베이터", "5·9호선 승강장에서 엘리베이터를 타면 지상까지 바로 올라옵니다. 주황색 기둥은 엘리베이터 승강로이고, 반투명 층은 대합실과 승강장 위치입니다.", "엘리베이터를 타고 땅 위로 올라와요. 계단은 안 타도 돼요."],
    en: ["Olympic Park Station elevator", "From the Line 5·9 platforms, take the elevator straight up to street level. The orange column is the elevator shaft; translucent layers show the concourse and platforms.", "Ride the elevator up. No stairs needed."] },
  { cam: [105, 170, 110], tgt: [105, 0, -71], est: false, mode: "map",
    mapActors: [{ pose: "walk", along: "route", scale: 10, bubble: { ko: "계단 없는 길로 가요", en: "Taking the step-free way" } }],
    view: { center: [127.1295, 37.5176], zoom: 16.3, pitch: 50, bearing: -30 },
    ko: ["지하철에서 출발", "5·9호선 올림픽공원역 엘리베이터에서 공연장까지 계단 없는 길로 {len}m, 휠체어로 약 {min}분입니다(주황색 선). 빨간 점선은 계단이니 피하세요.", "지하철역 엘리베이터를 타고 올라와요. 주황색 길을 따라 약 {min}분 가면 공연장이에요."],
    en: ["Start at the subway", "From the Olympic Park Station (Lines 5·9) elevator, the step-free route (orange) is {len} m, about {min} min by wheelchair. Red dashes are stairs — avoid them.", "Take the station elevator up. Follow the orange path for about {min} minutes."] },
  { cam: [40, 60, -180], tgt: [105, 10, -71], est: false, mode: "map",
    mapActors: [{ pose: "wave", along: "routeEnd", scale: 4.5, bubble: { ko: "도착! 2층 문으로 들어가요", en: "Arrived! Enter on level 2" } }],
    view: { center: [127.12752, 37.519243], zoom: 17.5, pitch: 62, bearing: 25 },
    ko: ["공연장 외관", "KSPO DOME은 지름 약 120m의 원형 건물입니다. 2층 출입문(2-1·2-2·2-3문)으로 입장합니다.", "둥근 큰 건물이에요. 사람이 많을 수 있어요. 2층 문으로 들어가요."],
    en: ["The venue", "KSPO DOME is a round building about 120 m across. Audiences enter through level-2 gates (2-1, 2-2, 2-3).", "It is a big round building. It may be crowded. You enter on level 2."] },
  { cam: P(41.2, 83.5, 6.0), tgt: P(49, 87, 5.3), est: true,
    actors: [{ pose: "walk", path: [P(48.3, 87, 4.2), P(46.5, 87, 4.3), P(44.6, 86.5, 4.8)], speed: 1.0, bubble: { ko: "문을 지나 객석으로 들어가요", en: "Through the door to the seats" } }],
    ko: ["출입문", "관객 출입문은 2층의 2-1문, 2-2문, 2-3문 세 곳입니다(2층 평면도 기준, 건물 밖에서 보면 보라색으로 표시). 문을 지나 방풍실과 복도를 거쳐, 통로 문을 열고 객석으로 들어갑니다. 2-1문 쪽 방풍실에는 시각장애인용 촉지판이 있습니다.", "2-1문, 2-2문, 2-3문 중 하나로 들어와요. 복도를 지나 문을 열고 객석으로 들어가요."],
    en: ["Entrance gates", "Audiences enter through three level-2 gates: 2-1, 2-2 and 2-3 (from the level-2 floor plan, marked purple outside the building). Past the gate are a windbreak room and the concourse, then a passage door into the seating bowl. A tactile map is in the windbreak room at gate 2-1.", "Come in through gate 2-1, 2-2 or 2-3. Walk along the hall, then through a door to the seats."] },
  { cam: P(41.2, 3.5, 6.0), tgt: P(49, 0, 5.3), est: true,
    actors: [{ pose: "scared", path: [P(47.6, 1.1, 4.2)], face: P(41.2, 3.5, 6.0), bubble: { ko: "어둡고 소리가 울려요", en: "Dark and echoey" } },
             { pose: "walk", path: [P(48.4, -1.1, 4.2), P(46.5, -1.1, 4.3), P(44.6, -1.6, 4.8)], speed: 1.0 }],
    ko: ["출입통로", "복도에서 객석으로 들어가는 짧은 통로입니다. 통로마다 W1~W8, N1~N4, S1~S4, E1~E8 번호가 붙어 있고, 괄호 속 숫자는 그 통로와 이어지는 좌석 구역(좌석배치도 기준)입니다. 표에 적힌 구역과 같은 번호의 통로로 들어가세요. 통로 안은 어둡고 소리가 울릴 수 있습니다.", "표에 적힌 구역 번호가 보이는 통로로 들어가요. 조금 어둡고 소리가 울릴 수 있어요. 괜찮아요."],
    en: ["Vomitory", "Short tunnels lead from the concourse into the seating bowl. Each is numbered W1-W8, N1-N4, S1-S4 or E1-E8, and the number in brackets is the seat section it leads to (official seating chart). Use the one that matches your ticket. It can be dim and echoey.", "Find the tunnel with your section number. It may be a little dark and loud. That is okay."] },
  { cam: P(41.2, 26.5, 6.0), tgt: P(49, 22.6, 5.3), est: true,
    actors: [{ pose: "sit", wheelchair: true, path: [P(48.3, 22.6, 4.3), P(46.5, 22.6, 4.5), P(44.6, 22.2, 4.8)], speed: 0.8, bubble: { ko: "계단 없이 갈 수 있어요", en: "No stairs needed" } }],
    ko: ["경사로", "보라색은 3D 모델의 경사로 4곳으로, '휠체어' 번호판이 붙은 W1, W3, W6, W8 통로에 있습니다. 휠체어 관람 구역으로 이어집니다.", "보라색 길은 계단이 없는 비탈길이에요. 휠체어로 갈 수 있어요."],
    en: ["Ramps", "Purple marks the four ramps, in tunnels W1, W3, W6 and W8 (signed 'Wheelchair'). They lead to the wheelchair seating zone.", "The purple path is a slope with no stairs. Wheelchairs can use it."] },
  { cam: [105, 7.5, -114], tgt: [105, 2, -60], pin: [105, 5, -113], est: true,
    actors: [{ pose: "sit", wheelchair: true, path: [[102.6, 4.2, -106]], face: [105, 2, -60], bubble: { ko: "무대가 잘 보여요", en: "Great view!" } },
             { pose: "wave", path: [[104.4, 4.2, -106.3]], face: [105, 2, -60] }],
    ko: ["휠체어석에서 본 무대", "경사로가 있는 쪽 링에서 무대를 바라본 시야입니다. 좌석배치도상 장애인석은 한쪽 링을 따라 배치되어 있습니다(도면별 82/84/87석).", "여기에 앉으면 무대가 이렇게 보여요."],
    en: ["View from wheelchair seating", "The view toward the stage from the ramp-side ring. Accessible seats run along one ring (82/84/87 seats depending on drawing).", "From here, the stage looks like this."] },
  { cam: P(38.6, 10.6, 6.2), tgt: P(10, 180, -3.8), est: false, show: true, outside: true,
    actors: [{ pose: "cheer", seated: true, fixY: true, path: [P(32.6, 12.9, 2.2)], face: P(17, 180, 2.2), bubble: { ko: "신나요! 무대가 잘 보여요", en: "So fun! Great view" } },
             { pose: "earplug", seated: true, fixY: true, path: [P(32.6, 8.3, 2.2)], face: P(17, 180, 2.2), bubble: { ko: "소리가 커서 귀를 막았어요", en: "Too loud, covering my ears" } },
             { pose: "wave", fixY: true, path: [P(13.5, 180, 1.8)], face: P(37, 10, 2) }],
    photo: true,
    ko: ["공연 중", "공연 중에는 조명이 어두워지고 음향이 큽니다. 감각이 예민하다면 귀마개·선글라스를 준비하세요.", "불이 꺼지고 음악이 커요. 귀마개를 쓰면 편해요. 힘들면 직원에게 말해요."],
    en: ["During the show", "Lights dim and sound gets loud. Bring earplugs or sunglasses if you are sensory-sensitive.", "Lights go off and music is loud. Earplugs help. Tell staff if you feel unwell."] },
  { cam: P(40.2, -9, 6.6), tgt: P(44, 6.5, 5.0), est: false,
    actors: [{ pose: "wave", path: [P(44.3, -2.4, 4.8)], face: P(43.5, 12, 4.7), bubble: { ko: "직원: 이쪽 통로로!", en: "Staff: This way!" } },
             { pose: "run", path: [P(43.5, 22, 4.7), P(43.5, 16, 4.7), P(43.5, 10, 4.7), P(43.5, 5, 4.7), P(43.5, 1, 4.7), P(44.8, 0, 4.8), P(46.5, 0, 4.3), P(48.3, 0, 4.2)], speed: 2.8, mode: "loop", bubble: { ko: "직원을 따라 출구로!", en: "Follow staff to the exit!" } }],
    ko: ["비상시", "빨간색은 소화·비상설비입니다. 비상시 직원 안내에 따라 가까운 출입문으로 대피하세요. 공식 안전이용안내 영상: 한국체육산업개발 KSPO DOME 자료실.", "위험하면 직원을 따라 가까운 문으로 나가요."],
    en: ["In an emergency", "Red marks safety equipment. Follow staff to the nearest exit. See the official safety video on the KSPO&CO KSPO DOME page.", "If there is danger, follow staff to the nearest door."] },
];
let step = 0;

/* ---------- 단계별 3D 졸라맨 ---------- */
let modelRoot = null;
const actors = [];
const ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
function floorAt(x, yHint, z) {
  if (!modelRoot) return yHint;
  ray.set(new THREE.Vector3(x, yHint + 1.2, z), DOWN); ray.far = 3;
  const h = ray.intersectObject(modelRoot, true)[0];
  return h ? h.point.y : yHint;
}
const bubbleText = (b) => (b ? b[lang] || b.ko : null);
function spawnActors(list) {
  for (const a of actors.splice(0)) { scene.remove(a.group); a.dispose(); }
  if (!modelRoot || !list) return;
  for (const sp of list) {
    const a = createStickman({ wheelchair: !!sp.wheelchair, seated: !!sp.seated, scale: sp.scale || 1 });
    a.setPose(sp.pose);
    const pts = sp.path.map(([x, y, z]) => new THREE.Vector3(x, sp.fixY ? y : floorAt(x, y, z), z));
    if (pts.length > 1) a.setPath(pts, sp.speed || 1.2, sp.mode || "pingpong"); else a.group.position.copy(pts[0]);
    if (sp.face) a.faceTowards(new THREE.Vector3(...sp.face).setY(pts[0].y));
    a.setBubble(bubbleText(sp.bubble));
    scene.add(a.group); actors.push(a);
  }
}


/* ---------- three.js ---------- */
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 3000);
// 시점 조작: 누른 채 좌우 = 360° 둘러보기, 앞뒤 = 걸어서 이동 (lookwalk.js)
const nav = createLookWalk(camera, canvas, { getColliders: () => modelRoot, blockAbove: () => (roofOn ? Infinity : 15.5), onUserMove: () => { tween = null; hideHint(); } });
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 2.2); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(200, 300, 100); scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshLambertMaterial({ color: 0xc9d3c0 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(105, -0.75, -71); scene.add(ground);

const HL = { slope: 0x8c5cff, door: 0x0ea5e9, turnel: 0x64748b, fire_box: 0xf87171 };
const layerMeshes = { slope: [], door: [], turnel: [], fire_box: [] };
const roofMeshes = [];
// 지붕 숨김: 높이 15.5m 위를 잘라내는 클리핑 평면 (외피가 벽과 한 메시로 병합되어 있어 메시 단위 숨김으로는 부족)
const roofClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 15.5);
renderer.localClippingEnabled = true;
const modelMats = [];
let roofOn = false;
function setRoof(on) {
  roofOn = on; for (const m of modelMats) { m.clippingPlanes = on ? [] : [roofClip]; m.needsUpdate = true; }
  const cb = document.querySelector("[data-roof]"); if (cb) cb.checked = on;
}
/* 실내 천장: 실제 KSPO DOME 내부처럼 흰 강철 트러스 격자(사진 참고). 객석 안 시점(카메라 18m 이하)에서만 표시 */
function trussTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 1024; const x = c.getContext("2d");
  x.fillStyle = "#1f2633"; x.fillRect(0, 0, 1024, 1024);
  x.strokeStyle = "rgba(235,240,248,.85)"; x.lineWidth = 3;
  for (let i = 0; i <= 1024; i += 48) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(1024, i); x.stroke(); }
  x.lineWidth = 1.4; x.strokeStyle = "rgba(235,240,248,.5)";
  for (let i = 0; i < 1024; i += 48) for (let j = 0; j < 1024; j += 48) { x.beginPath(); x.moveTo(i, j); x.lineTo(i + 48, j + 48); x.moveTo(i + 48, j); x.lineTo(i, j + 48); x.stroke(); }
  x.lineWidth = 8; x.strokeStyle = "rgba(245,248,252,.95)";
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; x.beginPath(); x.moveTo(512, 512); x.lineTo(512 + 520 * Math.cos(a), 512 + 520 * Math.sin(a)); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const ceiling = new THREE.Mesh(new THREE.CircleGeometry(61, 96), new THREE.MeshBasicMaterial({ map: trussTexture(), side: THREE.DoubleSide }));
ceiling.rotation.x = Math.PI / 2; ceiling.position.set(105.4, 23.5, -71.7); ceiling.visible = false; scene.add(ceiling);
// 조명 트러스(무대 위 구조물)
const rig = new THREE.Group(); rig.position.set(105.4, 19, -71.7); scene.add(rig);
for (const [w, d, x, z] of [[34, 1.2, 0, -8], [34, 1.2, 0, 8], [1.2, 18, -16, 0], [1.2, 18, 16, 0]]) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), new THREE.MeshLambertMaterial({ color: 0xc9ced6 })); b.position.set(x, 0, z); rig.add(b);
}
rig.visible = false;
/* 단계별 위치 표시 핀 */
const pin = new THREE.Group();
const pinMat = new THREE.MeshBasicMaterial({ color: 0x8c5cff, depthTest: false, transparent: true });
const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.35, 8, 40), pinMat); ring.rotation.x = Math.PI / 2;
const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 16), pinMat); cone.rotation.x = Math.PI; cone.position.y = 4.5;
pin.add(ring, cone); pin.renderOrder = 999; ring.renderOrder = cone.renderOrder = 999; scene.add(pin);
document.querySelector("[data-roof]")?.addEventListener("change", (e) => setRoof(e.target.checked));
/* 공연 무대: 경기장 동쪽 끝(대형 반입 통로 앞), 휠체어석 링(서쪽) 정면 */
const stage = createStage(new THREE.Vector3(105.4, 0.2, -71.7)); scene.add(stage.group);
/* 출입구 번호판
   - 방향 맞춤: 좌석배치도(휠체어석이 있는 5~11구역 링, 48~49구역 쪽 대형 통로)와 2층 평면도(2-2문 맞은편 VIP실)를
     3D 모델의 경사로 4곳(θ ±22.6°, ±48.6°)과 폭 22m 반입 통로(θ≈180°)에 맞춤. 남북은 모델 방위 문자(+x=북) 기준
   - 출입구 번호(W1~W8, N1~N4, S1~S4, E1~E8)는 3D 모델 통로 위 표지판 글자 그대로. W가 θ=0(서쪽), N이 θ=+90(북쪽)으로 지도 방위와 일치
   - 괄호 속 구역 = 그 통로 각도에서 가장 가까운 좌석 구역(두 구역 사이면 "a~b구역") */
function labelSprite(text, kind) {
  const c = document.createElement("canvas"), x = c.getContext("2d"), fs = 46, pad = 18;
  const font = `800 ${fs}px Pretendard, "Noto Sans KR", sans-serif`; x.font = font;
  const w = Math.ceil(x.measureText(text).width) + pad * 2, h = fs + pad * 1.4;
  c.width = w + 8; c.height = h + 8; x.font = font;
  const fill = kind === "gate" ? "#8c5cff" : kind === "wc" ? "#ffffff" : "#1f2430", ink = kind === "wc" ? "#6d3df0" : "#ffffff";
  x.fillStyle = fill; x.strokeStyle = kind === "wc" ? "#8c5cff" : "#ffffff"; x.lineWidth = 6;
  x.beginPath(); x.roundRect(4, 4, w, h, 14); x.fill(); x.stroke();
  x.fillStyle = ink; x.textBaseline = "middle"; x.fillText(text, 4 + pad, 4 + h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, sizeAttenuation: false, depthTest: kind !== "gate" }));
  const H = kind === "gate" ? 0.05 : 0.034; sp.scale.set(H * c.width / c.height, H, 1); sp.renderOrder = kind === "gate" ? 998 : 5;
  return sp;
}
const NUMS = [
  // [θ, r, y, 출입구 번호(3D 모델 통로 위 표지판), 이어지는 좌석 구역(좌석배치도), 휠체어 통로]
  [48.6, 45.3, 7.0, "W1", "11", 1], [33.8, 50.6, 10.6, "W2", "36~37"], [22.6, 45.3, 7.0, "W3", "9~10", 1], [0, 45.3, 7.0, "W4", "8"],
  [0, 50.6, 10.6, "W5", "33~34"], [-22.6, 45.3, 7.0, "W6", "6~7", 1], [-33.8, 50.6, 10.6, "W7", "30~31"], [-48.6, 45.3, 7.0, "W8", "5", 1],
  [116.2, 45.3, 7.0, "N1", "15"], [101.5, 50.6, 10.6, "N2", "42~43"], [86.8, 45.3, 7.0, "N3", "13~14"], [67.7, 50.6, 10.6, "N4", "39~40"],
  [-67.7, 50.6, 10.6, "S1", "27~28"], [-86.8, 45.3, 7.0, "S2", "2~3"], [-101.5, 50.6, 10.6, "S3", "24~25"], [-116.2, 45.3, 7.0, "S4", "1"],
  [-135, 50.6, 10.6, "E1", "52"], [-146.4, 45.3, 7.0, "E2", "21"], [-157.6, 50.6, 10.6, "E3", "50~51"], [-165.1, 45.3, 7.0, "E4", "20"],
  [164.9, 45.3, 7.0, "E5", "18"], [157.6, 50.6, 10.6, "E6", "46~47"], [146.4, 45.3, 7.0, "E7", "16~17"], [135, 50.6, 10.6, "E8", "45"],
];
const GATES = [[0, "2-2"], [64, "2-3"], [-64, "2-1"]]; // 2층 평면도의 문 위치(2-2문 기준 좌우 약 64°)
const numGroup = new THREE.Group(); scene.add(numGroup);
const gateMat = new THREE.MeshBasicMaterial({ color: 0x8c5cff, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
function buildNums() {
  for (const o of numGroup.children) { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }
  numGroup.clear();
  for (const [th, r, y, code, sec, wc] of NUMS) {
    const txt = lang === "ko" ? `${code}${wc ? " 휠체어" : ""} (${sec}구역)` : `${code}${wc ? " Wheelchair" : ""} (Sec ${sec.replace("~", "-")})`;
    const sp = labelSprite(txt, wc ? "wc" : "num"); sp.position.set(...P(r, th, y)); numGroup.add(sp);
  }
  for (const [th, n] of GATES) {
    const sp = labelSprite(lang === "ko" ? `${n}문` : `Gate ${n}`, "gate"); sp.userData.gate = 1; sp.position.set(...P(66.5, th, 10.2)); numGroup.add(sp);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), gateMat); door.position.set(...P(65.9, th, 5.9)); door.rotation.y = -th * Math.PI / 180; door.userData.gate = 1; numGroup.add(door);
  }
}
document.querySelector("[data-nums]")?.addEventListener("change", (e) => { numGroup.visible = e.target.checked; });
/* 테마: 기본 라이트, 버튼으로 다크 전환 (선택은 이 브라우저에만 저장) */
let theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
function applyTheme(t) {
  theme = t; document.documentElement.dataset.theme = t;
  try { localStorage.setItem("theme", t); } catch (e) {}
  scene.background = new THREE.Color(t === "dark" ? 0x1a1b1e : 0xe9eaf0);
  ground.material.color.set(t === "dark" ? 0x26282d : 0xdcdfe6);
  const b = document.getElementById("themeBtn");
  if (b) { b.textContent = t === "dark" ? "☀" : "☾"; b.setAttribute("aria-label", t === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"); b.title = t === "dark" ? "라이트 모드" : "다크 모드"; }
  setMapTheme(MAP, t);
}

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

// 경기장 바닥 텍스처: 짙은 회색 바닥 보호 패널 한 장(2m x 2m), 이음매와 약한 얼룩
function arenaFloorTex() {
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d");
  x.fillStyle = "#757a85"; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 1400; i++) { const g = 100 + Math.random() * 30; x.fillStyle = `rgba(${g},${g + 2},${g + 8},0.35)`; x.fillRect(Math.random() * n, Math.random() * n, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  x.strokeStyle = "#454850"; x.lineWidth = 5; x.strokeRect(0, 0, n, n);
  x.strokeStyle = "rgba(255,255,255,0.12)"; x.lineWidth = 2; x.strokeRect(4, 4, n - 8, n - 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
loader.load("assets/kspodome.glb", (g) => {
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material, name = (src.name || o.name || "").toLowerCase();
    let base = src.color ? src.color.clone() : new THREE.Color(0xbbbbbb);
    // 실제 내부 사진 기준: 객석 의자 하늘색 계열, 스탠드·프레임 짙은 회색
    if (name.includes("chair") || name.startsWith("arm")) base = new THREE.Color(name.startsWith("arm") ? 0x3f8bd0 : [0x5aa8e6, 0x6db3ea, 0x4f9fe0][name.length % 3]);
    else if (name.includes("stand_floor") || name === "floor" || name.includes("1f_floor")) base = new THREE.Color(0x5a5f69);
    else if (name === "material_12" && o.name === "Basic_Tile") {
      // 경기장 바닥: 공연 때 까는 짙은 회색 바닥 보호 패널(2m 격자). 모델 UV 대신 평면 좌표로 UV 생성
      o.updateWorldMatrix(true, false);
      const pos = o.geometry.attributes.position, v = new THREE.Vector3(), uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); uv[i * 2] = v.x / 2; uv[i * 2 + 1] = v.z / 2; }
      o.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      const m = new THREE.MeshLambertMaterial({ color: 0xffffff, map: arenaFloorTex(), side: THREE.DoubleSide, flatShading: true });
      m.name = name; m.userData.base = new THREE.Color(0xffffff); o.material = m; modelMats.push(m);
      return;
    }
    else if (name.includes("stand_frame") || name.includes("stand_paint") || name === "material_6" || name === "material_7") base = new THREE.Color(0x454a54);
    const m = new THREE.MeshLambertMaterial({ color: base, side: THREE.DoubleSide, flatShading: true,
      transparent: src.transparent || src.opacity < 1, opacity: Math.max(src.opacity ?? 1, 0.25) });
    m.name = name; m.userData.base = base; o.material = m; modelMats.push(m);
    for (const k of Object.keys(HL)) if (name.includes(k)) layerMeshes[k].push(o);
  });
  scene.add(g.scene); modelRoot = g.scene;
  if (location.hash.includes("debug")) { window.__mats = modelMats.map((m) => m.name + ":" + m.color.getHexString()); window.__app = { THREE, scene, camera, modelRoot, actors }; }
  setRoof(false);
  document.getElementById("loading").remove();
  applyLayers();
  const m = location.hash.match(/step=(\d+)/); goStep(m ? +m[1] - 1 : 0, true);
}, (e) => { if (e.total) document.getElementById("prog").style.width = (100 * e.loaded / e.total) + "%"; },
(err) => { document.getElementById("loading").textContent = "3D 로드 실패: " + err.message; });

function applyLayers() {
  document.querySelectorAll("[data-layer]").forEach((cb) => {
    for (const o of layerMeshes[cb.dataset.layer]) {
      o.material.color.set(cb.checked ? HL[cb.dataset.layer] : o.material.userData.base);
      o.material.emissive = new THREE.Color(cb.checked ? HL[cb.dataset.layer] : 0x000000);
      o.material.emissiveIntensity = cb.checked ? 0.45 : 0;
    }
  });
}
document.querySelectorAll("[data-layer]").forEach((cb) => cb.addEventListener("change", applyLayers));

/* camera tween */
let tween = null;
const camTarget = new THREE.Vector3(105, 0, -71);
function flyTo(pos, tgt, instant) {
  const p0 = camera.position.clone(), t0 = camTarget.clone();
  const p1 = new THREE.Vector3(...pos), t1 = new THREE.Vector3(...tgt);
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) { tween = null; camera.position.copy(p1); camTarget.copy(t1); nav.setFromTarget(t1); return; }
  tween = { p0, t0, p1, t1, s: performance.now(), d: 1400 };
}
let lastT = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  for (const a of actors) a.update(dt, now / 1000);
  stage.update(now / 1000);
  if (tween) {
    const k = Math.min(1, (now - tween.s) / tween.d), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e); camTarget.lerpVectors(tween.t0, tween.t1, e); camera.lookAt(camTarget);
    if (k === 1) { nav.setFromTarget(tween.t1); tween = null; }
  }
  if (pin.visible) { const s = 1 + 0.15 * Math.sin(now / 250); ring.scale.set(s, s, s); }
  ceiling.visible = rig.visible = !roofOn && camera.position.y < 18;
  renderer.render(scene, camera);
});

/* ---------- UI ---------- */
const $ = (id) => document.getElementById(id);
function hideHint() { document.querySelectorAll(".navhint").forEach((h) => h.classList.add("dim")); }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function stepText(s) {
  const a = s[lang], r = GEO?.routes?.[0];
  const fill = (x) => x.replace("{len}", r ? r.length_m.toLocaleString() : "~570").replaceAll("{min}", r ? r.walk_min_wheelchair : "11");
  return { title: a[0], body: fill(easy ? a[2] : a[1]) };
}
/* 보기 전환: 공원 지도 <-> 공연장 내부 */
let GEO = null, MAP = null, mode = "in";
function setMode(m, view) {
  mode = m;
  const isMap = m === "map";
  $("map").hidden = !isMap; $("legendMap").hidden = !isMap; $("layersIn").hidden = isMap; canvas.style.visibility = isMap ? "hidden" : "visible";
  $("modeMap").setAttribute("aria-pressed", isMap); $("homeBtn").title = $("homeBtn").ariaLabel = t(isMap ? "home" : "homeIn"); $("modeIn").setAttribute("aria-pressed", !isMap);
  if ($("loading")) $("loading").style.display = isMap ? "none" : "";
  if (isMap) {
    if (!MAP && GEO) MAP = initMap($("map"), GEO, () => { const v = STEPS[step].view || view; if (v && !MAP.__touched) MAP.jumpTo(v); }, theme);
    else if (MAP) { MAP.resize(); MAP.__touched = false; if (view) MAP.flyTo({ ...view, duration: 1600, essential: false }); }
  }
}
function goStep(i, instant) {
  step = (i + STEPS.length) % STEPS.length; const s = STEPS[step], tx = stepText(s);
  setMode(s.mode || "in", s.view);
  spawnActors(s.mode === "map" ? null : s.actors);
  setMapActors(MAP, s.mode === "map" ? (s.mapActors || []).map((a) => ({ ...a, bubble: bubbleText(a.bubble) })) : null);
  flyTo(s.cam, s.tgt, instant);
  pin.visible = !s.mode && !s.actors; pin.position.set(...(s.pin || s.tgt));
  for (const o of numGroup.children) if (!o.userData.gate) o.visible = !s.outside;
  stage.setShow(!!s.show); hemi.intensity = s.show ? 0.9 : 2.2; sun.intensity = s.show ? 0.35 : 1.4;
  $("stepCap").innerHTML = `<b>${step + 1}/${STEPS.length} · ${esc(tx.title)}</b>${esc(tx.body)}`;
  document.querySelectorAll("#steps li").forEach((li, j) => li.classList.toggle("on", j === step));
}
function renderSteps() {
  $("steps").innerHTML = STEPS.map((s, i) => { const tx = stepText(s);
    const ph = s.photo && REF ? `<figure class="refphoto"><img src="assets/ref_interior.jpg" alt="${lang === "ko" ? "KSPO DOME 공연 중 실제 내부 모습" : "Real interior of KSPO DOME during a show"}" loading="lazy"><figcaption>${lang === "ko" ? "실제 공연 때 내부" : "Actual interior during a show"} · ${t("photo")}: <a href="${esc(REF.page)}" target="_blank" rel="noopener">${esc(REF.artist)}</a>, <a href="${esc(REF.license_url)}" target="_blank" rel="noopener">${esc(REF.license)}</a></figcaption></figure>` : "";
    return `<li data-i="${i}"><b>${esc(tx.title)}</b><p>${esc(tx.body)}</p>${ph}</li>`; }).join("");
  $("steps").querySelectorAll("li").forEach((li) => li.onclick = () => goStep(+li.dataset.i));
}
$("lgHead").onclick = () => { const L = $("legendMap"), open = L.classList.toggle("closed") === false; $("lgHead").setAttribute("aria-expanded", open); };
if (matchMedia("(max-width: 700px)").matches) { $("legendMap").classList.add("closed"); $("lgHead").setAttribute("aria-expanded", "false"); }
// 돌아가기: 지도에서는 올림픽공원역, 공연장 내부에서는 현재 단계의 처음 시점으로
$("homeBtn").onclick = () => {
  if (mode === "map" && MAP) { MAP.__touched = false; MAP.flyTo({ ...STEPS[0].view, duration: 1500, essential: true }); }
  else flyTo(STEPS[step].cam, STEPS[step].tgt);
};
document.querySelectorAll("#lgBody [data-flash]").forEach((li) => {
  const go = () => { flashMapItem(MAP, li.dataset.flash); li.classList.remove("flash"); void li.offsetWidth; li.classList.add("flash"); };
  li.onclick = go; li.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
});
$("prevBtn").onclick = () => goStep(step - 1); $("nextBtn").onclick = () => goStep(step + 1);
$("modeMap").onclick = () => setMode("map", STEPS[2].view);
$("modeIn").onclick = () => { setMode("in"); if (STEPS[step].mode === "map") goStep(STEPS.findIndex((x) => !x.mode)); };
document.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.id === "pane-" + b.dataset.tab));
});

let LIVE = null, ACCESS = null, PERF = null, REF = null, selected = null;
let sess = null; // 선택한 회차 {date, hour}
// 공연 기간의 날짜마다 시작 시각을 붙임 ("오후 7시", "6PM", "19:00" 순서대로 날짜에 대응)
function sessions(ev) {
  const days = [], end = new Date((ev.end || ev.start) + "T00:00:00Z");
  for (let d = new Date(ev.start + "T00:00:00Z"); d <= end && days.length < 14; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  const hrs = [], re = /(오후|오전)\s*(\d{1,2})\s*시|(\d{1,2})\s*(PM|AM)|(\d{1,2}):(\d{2})/gi; let m;
  while ((m = re.exec(ev.time || ""))) hrs.push(m[2] ? (+m[2] % 12) + (m[1] === "오후" ? 12 : 0) : m[3] ? (+m[3] % 12) + (/PM/i.test(m[4]) ? 12 : 0) : +m[5]);
  return days.map((date, i) => ({ date, hour: hrs.length === days.length ? hrs[i] : (hrs[0] ?? 18) }));
}
const WD = { ko: ["일", "월", "화", "수", "목", "금", "토"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
function sessLabel(x) {
  const d = new Date(x.date + "T00:00:00Z"), wd = WD[lang][d.getUTCDay()];
  return lang === "ko" ? `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${wd}) ${x.hour > 12 ? "오후 " + (x.hour - 12) : "오전 " + x.hour}시`
    : `${wd} ${d.getUTCMonth() + 1}/${d.getUTCDate()} ${x.hour > 12 ? x.hour - 12 + " PM" : x.hour + " AM"}`;
}
const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
function wxFor(x) {
  const w = LIVE?.weather?.hourly || [], day = x.date.replaceAll("-", "");
  const same = w.filter((r) => r.time.startsWith(day));
  if (!same.length) return null;
  return same.reduce((a, r) => (Math.abs(+r.time.slice(8, 10) - x.hour) < Math.abs(+a.time.slice(8, 10) - x.hour) ? r : a));
}
function endRange(x) {
  const ds = PERF?.venues?.["KSPO DOME"]; if (!ds) return null;
  const f = (m) => `${String(Math.floor((x.hour * 60 + m) / 60) % 24).padStart(2, "0")}:${String((x.hour * 60 + m) % 60).padStart(2, "0")}`;
  return { a: f(ds.p25_min), b: f(ds.p75_min), ds };
}
function wxText(r) { return `${r.temp}℃ ${T[lang].sky[r.sky] || ""} ${T[lang].pty[r.pty] || ""}`.replace(/\s+/g, " ").trim() + `, ${t("pop")} ${r.pop}%`; }
function wxOpenDate(x) { const d = new Date(x.date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 3); return lang === "ko" ? `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일` : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; }
function renderPick() {
  const box = $("showSel"); if (!box) return;
  if (!selected) { box.hidden = true; return; }
  const ko = lang === "ko", list = sessions(selected), dd = Math.round((new Date(sess.date) - new Date(todayKST())) / 864e5);
  const r = wxFor(sess), e = endRange(sess);
  box.hidden = false;
  box.innerHTML = `<h3>${esc(selected.title)}</h3>
    <p class="muted small">${ko ? "관람할 날짜를 고르세요" : "Pick your date"}</p>
    <div class="sess">${list.map((x, i) => `<button type="button" data-s="${i}" class="${x.date === sess.date ? "on" : ""}">${esc(sessLabel(x))}</button>`).join("")}</div>
    <dl class="pick">
      <dt>${ko ? "남은 날" : "Countdown"}</dt><dd><b>${dd > 0 ? `D-${dd}` : dd === 0 ? (ko ? "오늘" : "Today") : (ko ? "지난 공연" : "Past")}</b></dd>
      <dt>${ko ? "공연 시간 날씨" : "Weather"}</dt><dd>${r ? esc(wxText(r)) : dd < 0 ? "-" : (ko ? `${wxOpenDate(sess)}부터 확인할 수 있어요` : `Available from ${wxOpenDate(sess)}`)}</dd>
      ${e ? `<dt>${ko ? "예상 종료" : "Expected end"}</dt><dd><b>${e.a}~${e.b}</b></dd>` : ""}
    </dl>
    <button type="button" class="gotoday">${ko ? "오늘의 이동에서 자세히 보기" : "See details in Getting there"}</button>`;
  box.querySelectorAll(".sess button").forEach((b) => b.onclick = () => { sess = list[+b.dataset.s]; renderPick(); renderToday(); });
  box.querySelector(".gotoday").onclick = () => document.querySelector('.tab[data-tab="today"]')?.click();
}
function renderEvents() {
  const today = todayKST();
  const evs = (LIVE?.events || []).filter((e) => /KSPO/i.test(e.place)).sort((a, b) => (a.start > b.start ? 1 : -1));
  const up = evs.filter((e) => (e.end || e.start) >= today);
  const list = up.length ? up : evs;
  if (!list.length) { $("events").innerHTML = `<li>${t("noEvents")}</li>`; return; }
  $("events").innerHTML = list.map((e, i) => `<li data-i="${i}" tabindex="0" role="button" class="${selected && selected.url === e.url ? "on" : ""}">${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : ""}
    <div><b>${esc(e.title)}</b><span>${esc(e.start)} ~ ${esc(e.end)}</span><span>${esc(sessions(e).map(sessLabel).join(", "))}</span></div></li>`).join("");
  $("events").querySelectorAll("li").forEach((li) => {
    li.onclick = () => {
      selected = list[+li.dataset.i];
      const ss = sessions(selected); sess = ss.find((x) => x.date >= today) || ss[0];
      $("events").querySelectorAll("li").forEach((x) => x.classList.toggle("on", x === li)); renderPick(); renderToday();
    };
    li.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); } };
  });
  renderPick();
}
function renderToday() {
  if (!selected) $("wx").textContent = t("pickShow");
  else {
    const r = wxFor(sess), ko = lang === "ko";
    $("wx").innerHTML = `<p class="selshow"><b>${esc(selected.title)}</b><br><span class="muted small">${esc(sessLabel(sess))}</span></p>` + (r ? `<div class="wxrow"><span class="big">${esc(r.temp)}℃</span><span>${T[lang].sky[r.sky] || ""} ${T[lang].pty[r.pty] || ""}</span>
      <span>${t("pop")} ${esc(r.pop)}%</span><span>${t("wind")} ${esc(r.wind)} m/s</span></div><p class="muted small">${ko ? "기상청 단기예보" : "KMA short-range forecast"}, ${r.time.slice(8, 10)}:00</p>`
      : `<p>${ko ? `날씨 예보는 공연 3일 전인 ${wxOpenDate(sess)}부터 확인할 수 있어요.` : `Forecast available from ${wxOpenDate(sess)} (3 days before).`}</p>`);
    const e = endRange(sess);
    if (e) $("wx").insertAdjacentHTML("beforeend", ko
      ? `<p><b>예상 종료</b> ${e.a}~${e.b} <span class="muted small">(KSPO DOME 과거 공연 ${e.ds.with_duration}건의 소요시간 중앙값 ${e.ds.median_min}분 기준). 장애인 콜택시나 막차 예약에 활용하세요.</span></p>`
      : `<p><b>Expected end</b> ${e.a}–${e.b} <span class="muted small">(median ${e.ds.median_min} min across ${e.ds.with_duration} past KSPO DOME shows). Plan your ride home.</span></p>`);
  }
  const pk = LIVE?.parking?.parking_sum;
  $("pk").innerHTML = pk != null ? `<span class="big">${pk.toLocaleString()}</span> ${t("cars")}<p class="muted small">${t("parkNote")}</p>` : "-";
  const seen = new Set();
  const routes = (GEO?.routes || []).map((r) => `<li><b>${esc(r.station)}</b><span>${lang === "ko" ? "계단 없는 길" : "step-free"} ${r.length_m.toLocaleString()} m · ${lang === "ko" ? "약" : "~"} ${r.walk_min_wheelchair}${lang === "ko" ? "분" : " min"}</span></li>`).join("");
  $("tr").innerHTML = routes + (ACCESS?.transit_access_points || []).filter((p) => { const k = p.station + p.type + p.dist_to_dome_m; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 8).map((p) => `<li><a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=19/${p.lat}/${p.lon}" target="_blank" rel="noopener">${esc(p.station)} · ${t(p.type)}</a><span>${p.dist_to_dome_m.toLocaleString()} m</span></li>`).join("");
  $("updated").textContent = LIVE ? `${t("updated")}: ${LIVE.updated}` : "";
}
function renderInfo() {
  const s = ACCESS?.seats; if (!s) return;
  const ko = lang === "ko";
  $("seats").innerHTML = ko
    ? `전체 ${s.total_after_renovation.toLocaleString()}석(2층 ${s.floor2.toLocaleString()} · 3층 ${s.floor3.toLocaleString()}) · ${s.sections}개 구역 · BOX석 ${s.box_seats}석<br>장애인석: <b>82~87석</b> (도면마다 다름) · 장애인화장실 2층 2개소`
    : `${s.total_after_renovation.toLocaleString()} seats (L2 ${s.floor2.toLocaleString()} · L3 ${s.floor3.toLocaleString()}) · ${s.sections} sections · ${s.box_seats} box seats<br>Wheelchair seats: <b>82–87</b> (differs by drawing) · 2 accessible restrooms on L2`;
  $("gaps").innerHTML = (ko ? [
    "장애인석 수가 공식 도면마다 다름: 좌석배치도 표 82석, 같은 도면 라벨 84석, 3층 평면도 87석",
    "공연장 내부 엘리베이터 위치가 공개 평면도에 표기되지 않음",
    "장애인 주차구역 위치: 기관 FAQ 답변이 '각 주차장 내 안내문 부착'뿐 → 현장 도착 전 확인 불가",
    "실시간 주차현황은 공원 전체 합계 1개 값만 제공(구역별·장애인 주차면 없음)",
  ] : [
    "Wheelchair seat count differs across official drawings: 82 / 84 / 87",
    "Elevator locations inside the venue are not marked on public floor plans",
    "Accessible parking: official FAQ only says 'signs are posted in each lot' — not knowable before arrival",
    "Real-time parking API gives only a park-wide total (no per-lot or accessible spaces)",
  ]).map((x) => `<li>${esc(x)}</li>`).join("");
  $("srcs").innerHTML = [
    "한국체육산업개발_올림픽공원 공연장 실감형 콘텐츠 (KSPO DOME SKP·DAE)",
    "한국체육산업개발_KSPO DOME 평면도·좌석배치도 (기관 자료실)",
    "한국체육산업개발_올림픽공원 공연정보", "한국체육산업개발_실시간 주차현황 (API)",
    "한국체육산업개발_영문 공연정보 · 자주 묻는 질문정보",
    "기상청_단기예보 조회서비스 (API)", "서울시 지하철역 엘리베이터 위치정보 · 지하철 출입구 리프트 위치정보",
    "보건복지부_장애인 편의시설 설치현황",
    "국토교통부 브이월드_항공사진·하이브리드 지도(WMTS)",
    "한국문화정보원_올림픽공원 공연정보 이력(KSCperf) - 공연 소요시간",
    "OpenStreetMap_보행로·지하철 출입구·건물 (ODbL)",
  ].map((x) => `<li>${esc(x)}</li>`).join("");
}
function applyLang() {
  document.documentElement.lang = lang; setMapLang(MAP, lang);
  document.querySelectorAll("[data-i18n]").forEach((el) => el.textContent = t(el.dataset.i18n));
  $("langBtn").textContent = lang === "ko" ? "EN" : "한국어";
  $("homeBtn").title = $("homeBtn").ariaLabel = t(mode === "map" ? "home" : "homeIn");
  buildNums(); renderSteps(); goStep(step, true); renderEvents(); renderToday(); renderInfo();
}
$("langBtn").onclick = () => { lang = lang === "ko" ? "en" : "ko"; applyLang(); };
$("themeBtn").onclick = () => applyTheme(theme === "dark" ? "light" : "dark");
$("easyBtn").onclick = () => { easy = !easy; $("easyBtn").setAttribute("aria-pressed", easy); document.body.classList.toggle("easy", easy); renderSteps(); goStep(step, true); };
addEventListener("keydown", (e) => { if (e.key === "ArrowRight") goStep(step + 1); if (e.key === "ArrowLeft") goStep(step - 1); });

Promise.all([
  fetch(`data/live.json?v=${DATA_V}`).then((r) => r.json()).catch(() => null),
  fetch(`data/access_kspodome.json?v=${DATA_V}`).then((r) => r.json()).catch(() => null),
  fetch(`data/perf_stats.json?v=${DATA_V}`).then((r) => r.json()).catch(() => null),
  fetch(`data/park_geo.json?v=${DATA_V}`).then((r) => r.json()).catch(() => null),
  fetch(`data/ref_interior.json?v=${DATA_V}`).then((r) => r.json()).catch(() => null),
]).then(([live, access, perf, geo, ref]) => {
  LIVE = live; ACCESS = access; PERF = perf; GEO = geo; REF = ref; applyLang();
  // 딥링크: #tab=today&show=1 (기획서 캡처·공유용)
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("show")) document.querySelectorAll("#events li")[+h.get("show") - 1]?.click();
  if (h.get("tab")) document.querySelector(`.tab[data-tab="${h.get("tab")}"]`)?.click();
});
renderSteps();

applyTheme(theme);
