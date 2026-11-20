/* KSPO DOME 외관 3D (지도 모드용)
   치수: 실감형 콘텐츠(DAE) 반경-높이 프로파일 실측
     - 하부(유리·출입층) r≈55m, 0~9m
     - 외벽 드럼 r≈62.8m, 9~21m (가로 줄무늬 금속 외장 - 사진 참고)
     - 처마 링 r≈63.3m, 21~23.2m
     - 지붕 케이블돔 막구조: 23.2m(가장자리) -> 28.5m(중앙), 가장자리 방사형 봉우리
   지붕 표면 = 브이월드 항공사진(실제 지붕)을 평면 투영 텍스처로 입힘.
   좌표: 로컬 m, x=동, y=위, z=남 (MapLibre 커스텀 레이어 기준) */
import * as THREE from "three";

const M_LAT = 110574;
const mLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

function stripeTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const x = c.getContext("2d");
  const bands = 14, bh = c.height / bands;
  for (let i = 0; i < bands; i++) {
    const g = x.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
    g.addColorStop(0, "#e9ecf0"); g.addColorStop(0.55, "#c3c8cf"); g.addColorStop(1, "#8d939c");
    x.fillStyle = g; x.fillRect(0, i * bh, c.width, bh);
    x.fillStyle = "rgba(40,44,52,.55)"; x.fillRect(0, (i + 1) * bh - 3, c.width, 3);
  }
  x.fillStyle = "rgba(60,64,72,.25)"; for (let u = 0; u < c.width; u += 32) x.fillRect(u, 0, 2, c.height);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(48, 1); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function glassTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#5d6b7d"); g.addColorStop(1, "#2c3440");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.fillStyle = "rgba(220,228,238,.55)"; for (let u = 0; u < 256; u += 32) x.fillRect(u, 0, 3, 256); x.fillRect(0, 120, 256, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(70, 1); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 브이월드 항공사진 타일을 이어 붙여 지붕 텍스처 생성 */
async function aerialRoof(center, radius, key, z = 19) {
  const [lon0, lat0] = center, N = 256 * 2 ** z;
  const px = (lon) => ((lon + 180) / 360) * N;
  const py = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N; };
  const dLon = radius / mLon(lat0), dLat = radius / M_LAT;
  const x0 = px(lon0 - dLon), x1 = px(lon0 + dLon), y0 = py(lat0 + dLat), y1 = py(lat0 - dLat);
  const tx0 = Math.floor(x0 / 256), tx1 = Math.floor(x1 / 256), ty0 = Math.floor(y0 / 256), ty1 = Math.floor(y1 / 256);
  const c = document.createElement("canvas"); c.width = (tx1 - tx0 + 1) * 256; c.height = (ty1 - ty0 + 1) * 256;
  const ctx = c.getContext("2d");
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push(new Promise((res) => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => { ctx.drawImage(im, (tx - tx0) * 256, (ty - ty0) * 256); res(); }; im.onerror = res;
    im.src = `https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/${z}/${ty}/${tx}.jpeg`;
  }));
  await Promise.all(jobs);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // 로컬(x동, z남) -> 텍스처 UV
  const ox = tx0 * 256, oy = ty0 * 256;
  const uv = (x, zS) => { const lon = lon0 + x / mLon(lat0), lat = lat0 - zS / M_LAT; return [(px(lon) - ox) / c.width, 1 - (py(lat) - oy) / c.height]; };
  return { tex, uv };
}

export function createDomeExterior(center, vworldKey) {
  const g = new THREE.Group();
  const R_BASE = 55, R_DRUM = 62.8, R_EAVE = 63.4, Y_BASE = 9, Y_DRUM = 21, Y_EAVE = 23.2, Y_TOP = 28.5, PEAKS = 24;

  // 하부 유리층
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R_BASE, R_BASE, Y_BASE, 128, 1, true),
    new THREE.MeshLambertMaterial({ map: glassTexture(), side: THREE.DoubleSide }));
  base.position.y = Y_BASE / 2; g.add(base);
  // 하부 위 덮개(외벽 아래면)
  const soffit = new THREE.Mesh(new THREE.RingGeometry(R_BASE, R_DRUM, 128), new THREE.MeshLambertMaterial({ color: 0x9aa1ab, side: THREE.DoubleSide }));
  soffit.rotation.x = Math.PI / 2; soffit.position.y = Y_BASE; g.add(soffit);
  // 외벽 드럼(가로 줄무늬)
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R_DRUM, R_DRUM * 0.995, Y_DRUM - Y_BASE, 192, 1, true),
    new THREE.MeshLambertMaterial({ map: stripeTexture(), side: THREE.DoubleSide }));
  drum.position.y = (Y_BASE + Y_DRUM) / 2; g.add(drum);
  // 처마 링
  const eaveMat = new THREE.MeshLambertMaterial({ color: 0xf1f3f6, side: THREE.DoubleSide });
  const eave = new THREE.Mesh(new THREE.CylinderGeometry(R_EAVE, R_EAVE - 0.6, Y_EAVE - Y_DRUM, 192, 1, true), eaveMat);
  eave.position.y = (Y_DRUM + Y_EAVE) / 2; g.add(eave);
  const eaveUnder = new THREE.Mesh(new THREE.RingGeometry(R_DRUM - 0.2, R_EAVE - 0.6, 192), eaveMat);
  eaveUnder.rotation.x = Math.PI / 2; eaveUnder.position.y = Y_DRUM; g.add(eaveUnder);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(R_EAVE + 0.02, 0.12, 6, 192), new THREE.MeshLambertMaterial({ color: 0x8b929c }));
  groove.rotation.x = Math.PI / 2; groove.position.y = Y_EAVE - 0.9; g.add(groove);

  // 지붕 막구조
  const RINGS = 48, SEG = 288;
  const pos = [], idx = [], rs = [], th = [];
  const roofY = (r, a) => {
    const t = Math.min(1, r / R_EAVE);
    const dome = Y_EAVE + (Y_TOP - Y_EAVE) * Math.pow(Math.max(0, 1 - t * t), 0.75);
    const edge = THREE.MathUtils.smoothstep(t, 0.55, 0.93) * (1 - THREE.MathUtils.smoothstep(t, 0.96, 1.0));
    const peak = Math.pow(Math.max(0, Math.cos(PEAKS * a)), 2.5) * 1.6 * edge;
    return dome + peak;
  };
  for (let i = 0; i <= RINGS; i++) {
    const r = (R_EAVE * i) / RINGS;
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a);
      pos.push(x, roofY(r, a), z); rs.push(r); th.push(a);
    }
  }
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
    const a = i * (SEG + 1) + j, b = a + SEG + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xf4f5f7, side: THREE.DoubleSide });
  const roof = new THREE.Mesh(geo, roofMat); g.add(roof);
  // 방사형 케이블 라인
  const cable = new THREE.LineBasicMaterial({ color: 0xa9b0ba, transparent: true, opacity: 0.8 });
  for (let k = 0; k < PEAKS; k++) {
    const a = (k / PEAKS) * Math.PI * 2, pts = [];
    for (let i = 4; i <= RINGS; i++) { const r = (R_EAVE * i) / RINGS; pts.push(new THREE.Vector3(r * Math.cos(a), roofY(r, a) + 0.08, r * Math.sin(a))); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cable));
  }

  // 지붕에 실제 항공사진 입히기 (실패해도 흰 막구조로 표시)
  const ready = aerialRoof(center, R_EAVE + 6, vworldKey).then(({ tex, uv }) => {
    const uvs = [];
    for (let k = 0; k < pos.length; k += 3) uvs.push(...uv(pos[k], pos[k + 2]));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    roofMat.map = tex; roofMat.color.set(0xffffff); roofMat.needsUpdate = true;
  }).catch(() => {});
  g.userData.ready = ready;
  return g;
}
