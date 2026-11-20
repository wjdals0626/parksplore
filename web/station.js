/* 올림픽공원역 3D (지도 모드)
   - 지상: 지하철 출입구 캐노피(OSM subway_entrance), 엘리베이터·휠체어리프트 타워(서울시 위치정보) - 실제 좌표
   - 지하: 대합실·5호선·9호선 승강장 '개략' 단면(출입구 분포의 주축 방향으로 정렬, 깊이는 대략값)
   좌표: 로컬 m, x=동, y=위, z=남 (기준점 = KSPO DOME 중심) */
import * as THREE from "three";

const M_LAT = 110574;
const toLocal = (c, lon, lat) => new THREE.Vector3((lon - c[0]) * 111320 * Math.cos((c[1] * Math.PI) / 180), 0, -(lat - c[1]) * M_LAT);

function label(text, { bg = "#ffffff", fg = "#18181b", border = "#8c5cff", h = 7 } = {}) {
  const fs = 56, pad = 28, c = document.createElement("canvas"), x = c.getContext("2d");
  x.font = `700 ${fs}px Paperlogy, "Malgun Gothic", sans-serif`;
  c.width = Math.ceil(x.measureText(text).width) + pad * 2; c.height = fs + pad * 1.4;
  x.font = `700 ${fs}px Paperlogy, "Malgun Gothic", sans-serif`;
  x.fillStyle = bg; x.strokeStyle = border; x.lineWidth = 8;
  x.beginPath(); x.roundRect(4, 4, c.width - 8, c.height - 8, c.height / 2); x.fill(); x.stroke();
  x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set((h * c.width) / c.height, h, 1); s.renderOrder = 900; return s;
}

function canopy(heading) {
  // 서울 지하철 출입구형 캐노피: 3.4m x 8m, 높이 3.2m, 경사 유리지붕
  const g = new THREE.Group();
  const frame = new THREE.MeshLambertMaterial({ color: 0x3b3f47 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd0f2, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  for (const sx of [-1.6, 1.6]) for (const sz of [-3.8, 3.8]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.18), frame); p.position.set(sx, 1.6, sz); g.add(p);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 7.4), glass); w.position.set(sx, 1.3, 0); if (sz > 0) g.add(w);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 8.2), glass); roof.position.y = 3.25; roof.rotation.x = 0.06; g.add(roof);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.25, 0.3), frame); top.position.set(0, 3.35, -4.1); g.add(top);
  const stair = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 7.6), new THREE.MeshLambertMaterial({ color: 0x2a2d33 })); stair.position.set(0, 0.05, 0); g.add(stair);
  g.rotation.y = heading; return g;
}
function elevatorTower(kind) {
  const g = new THREE.Group();
  const isLift = kind === "wheelchair_lift";
  const glass = new THREE.MeshLambertMaterial({ color: isLift ? 0x7dd3fc : 0xffb27a, transparent: true, opacity: 0.6 });
  const frame = new THREE.MeshLambertMaterial({ color: 0x2e2a45 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, isLift ? 1.4 : 3.8, 2.6), glass); box.position.y = isLift ? 0.7 : 1.9; g.add(box);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.35, 2.9), frame); cap.position.y = isLift ? 1.55 : 3.95; g.add(cap);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.08), new THREE.MeshBasicMaterial({ color: isLift ? 0x0ea5e9 : 0xff7a1a })); sign.position.set(0, isLift ? 1.1 : 3.3, 1.35); g.add(sign);
  return g;
}

/** geo: park_geo.json, center: [lon, lat] 기준점 */
export function createStation(geo, center) {
  const g = new THREE.Group(); g.userData.labels = [];
  const tag = (text, pos, cls = "") => g.userData.labels.push({ text, pos: pos.clone(), cls });
  const feats = geo.features.features;
  const evs = feats.filter((f) => ["elevator", "wheelchair_lift"].includes(f.properties.kind) && /올림픽공원/.test(f.properties.name || ""));
  if (!evs.length) return g;
  const sc = evs.reduce((a, f) => [a[0] + f.geometry.coordinates[0] / evs.length, a[1] + f.geometry.coordinates[1] / evs.length], [0, 0]);
  const S = toLocal(center, sc[0], sc[1]);
  const ents = feats.filter((f) => f.properties.kind === "subway_entrance").map((f) => ({ f, p: toLocal(center, ...f.geometry.coordinates) }))
    .filter(({ p }) => p.distanceTo(S) < 260);

  // 출입구 분포 주축(PCA) -> 역 방향
  const pts = [...ents.map((e) => e.p), ...evs.map((f) => toLocal(center, ...f.geometry.coordinates))];
  let cxx = 0, czz = 0, cxz = 0;
  for (const p of pts) { const dx = p.x - S.x, dz = p.z - S.z; cxx += dx * dx; czz += dz * dz; cxz += dx * dz; }
  const axis = 0.5 * Math.atan2(2 * cxz, cxx - czz); // x축 기준 각도
  const span = Math.max(80, ...pts.map((p) => Math.abs((p.x - S.x) * Math.cos(axis) + (p.z - S.z) * Math.sin(axis)) * 2 + 20));

  for (const { f, p } of ents) {
    const away = Math.atan2(p.x - S.x, p.z - S.z);
    const c = canopy(away); c.position.copy(p); g.add(c);
    const ref = f.properties.name?.match(/(\d+)\s*번/)?.[1];
    if (ref) tag(`${ref}번 출구`, p, "exit");
  }
  for (const f of evs) {
    const p = toLocal(center, ...f.geometry.coordinates); const t = elevatorTower(f.properties.kind); t.position.copy(p); g.add(t);
  }

  // 지하 개략 단면 (반투명)
  // 지하: OSM 선로(railway=subway)의 역 부근 위치·방향으로 승강장 정렬, 깊이는 개략값
  const ghost = (color, op) => new THREE.MeshLambertMaterial({ color, transparent: true, opacity: op, depthWrite: false });
  const sub = geo.subway?.lines || {};
  const L5 = sub["5호선"] || { offset_m: [0, 0], angle_rad: axis }, L9 = sub["9호선"] || { offset_m: [0, 0], angle_rad: axis };
  const lvl = [
    { y: -7, h: 5, w: 22, len: 110, line: L5, color: 0xb9a6ff, name: "대합실" },
    { y: -15, h: 6, w: 18, len: 160, line: L5, color: 0x8c5cff, name: "5호선 승강장" },
    { y: -26, h: 6, w: 16, len: 120, line: L9, color: 0xc9a227, name: "9호선 승강장" },
  ];
  for (const L of lvl) {
    const grp = new THREE.Group(); grp.position.set(S.x + L.line.offset_m[0], L.y, S.z + L.line.offset_m[1]); grp.rotation.y = -L.line.angle_rad; g.add(grp);
    const b = new THREE.Mesh(new THREE.BoxGeometry(L.len, L.h, L.w), ghost(L.color, 0.3)); grp.add(b);
    (g.userData.ghosts ||= []).push({ material: b.material, base: 0.3 });
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color: L.color, transparent: true, opacity: 0.9 })));
    grp.updateMatrixWorld(true); tag(L.name, new THREE.Vector3(-L.len / 2, 0, 0).applyMatrix4(grp.matrixWorld), "under");
  }
  // 엘리베이터 수직 동선(지상 -> 승강장)
  const shaftMat = new THREE.LineDashedMaterial({ color: 0xff7a1a, dashSize: 1.5, gapSize: 1 });
  for (const f of evs) {
    const p = toLocal(center, ...f.geometry.coordinates);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x, 0, p.z), new THREE.Vector3(p.x, -26, p.z)]), shaftMat);
    line.computeLineDistances(); g.add(line);
  }
  tag("올림픽공원역 (5·9호선)", S, "title");
  g.userData.center = S;
  return g;
}
