/* 공연 무대 (콘서트 엔드 스테이지)
   - 위치: 경기장 바닥(지름 약 54m, 바닥 y≈0.2) 동쪽 끝, 대형 반입 통로(θ≈180°) 앞
     휠체어석 링(θ≈0°)에서 정면으로 보이는 방향
   - 무대 18m x 9m x 1.6m + 돌출 무대, 뒤 LED 벽 20m x 9m, 양옆 보조 화면, 무대 위 트러스와 움직이는 조명 빔
   - setShow(true)면 LED 영상과 조명이 움직이고, 아니면 꺼진 무대만 보임 */
import * as THREE from "three";

export function createStage(center = new THREE.Vector3(105.4, 0.2, -71.7)) {
  const g = new THREE.Group();
  // 무대 축: +z 방향(θ=180°)이 무대 뒤쪽
  const S = (dx, y, dz) => new THREE.Vector3(center.x + dx, center.y + y, center.z + dz);
  const dark = new THREE.MeshLambertMaterial({ color: 0x1b1d24 });
  const edge = new THREE.MeshBasicMaterial({ color: 0x8c5cff });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 9), dark); deck.position.copy(S(0, 0.8, 17)); g.add(deck);
  const run = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 7), dark); run.position.copy(S(0, 0.6, 9.5)); g.add(run);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(18.1, 0.12, 0.12), edge); lip.position.copy(S(0, 1.6, 12.5)); g.add(lip);
  // 무대 앞 펜스
  const fence = new THREE.Mesh(new THREE.BoxGeometry(24, 1.1, 0.15), new THREE.MeshLambertMaterial({ color: 0x9aa0aa }));
  fence.position.copy(S(0, 0.55, 5.2)); g.add(fence);

  // LED 화면(캔버스 애니메이션)
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 232; const cx = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const ledMat = new THREE.MeshBasicMaterial({ map: tex });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(20, 9), ledMat); led.position.copy(S(0, 6.3, 21.4)); led.rotation.y = Math.PI; g.add(led);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(20.8, 9.8, 0.4), dark); frame.position.copy(S(0, 6.3, 21.7)); g.add(frame);
  const sides = [];
  for (const sx of [-14.5, 14.5]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.6), ledMat); m.position.copy(S(sx, 7.5, 16)); m.rotation.y = Math.PI + (sx > 0 ? -0.35 : 0.35); g.add(m); sides.push(m);
    const f = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4, 0.3), dark); f.position.copy(S(sx, 7.5, 16.2)); f.rotation.y = m.rotation.y; g.add(f);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 0.4), dark); leg.position.copy(S(sx, 2.75, 16.3)); g.add(leg);
  }

  // 무대 위 트러스
  const truss = new THREE.MeshLambertMaterial({ color: 0x8e949e });
  for (const [w, d, x, z] of [[22, 0.6, 0, 12.8], [22, 0.6, 0, 20.5], [0.6, 8.3, -10.8, 16.6], [0.6, 8.3, 10.8, 16.6]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), truss); b.position.copy(S(x, 13.5, z)); g.add(b);
  }
  for (const [x, z] of [[-10.8, 12.8], [10.8, 12.8], [-10.8, 20.5], [10.8, 20.5]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 13.5, 0.4), truss); p.position.copy(S(x, 6.75, z)); g.add(p);
  }

  // 움직이는 조명 빔(꼭짓점이 트러스에 붙은 원뿔, 가산 혼합)
  const beams = [];
  const cols = [0x8c5cff, 0x22d3ee, 0xf472b6, 0xfacc15, 0x8c5cff, 0x22d3ee, 0xf472b6, 0xfacc15];
  cols.forEach((c, i) => {
    const pivot = new THREE.Group(); pivot.position.copy(S(-9 + i * (18 / 7), 13.2, 12.8 + (i % 2) * 1.2)); g.add(pivot);
    const geo = new THREE.ConeGeometry(2.2, 26, 24, 1, true); geo.translate(0, -13, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    pivot.add(m); beams.push({ pivot, ph: i * 0.8 });
  });
  // 공연 중 무대를 비추는 조명
  const wash = new THREE.PointLight(0xb69bff, 0, 60, 1.2); wash.position.copy(S(0, 9, 8)); g.add(wash);

  let on = false;
  function drawLED(t) {
    const w = cv.width, h = cv.height;
    const gr = cx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, `hsl(${(t * 30) % 360},80%,45%)`); gr.addColorStop(1, `hsl(${(t * 30 + 120) % 360},80%,35%)`);
    cx.fillStyle = gr; cx.fillRect(0, 0, w, h);
    cx.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 0; i < 32; i++) { const bh = (0.25 + 0.6 * Math.abs(Math.sin(t * 3 + i * 0.7))) * h * 0.6; cx.fillRect(i * (w / 32) + 2, h - bh, w / 32 - 4, bh); }
  }
  function drawOff() { cx.fillStyle = "#0e1016"; cx.fillRect(0, 0, cv.width, cv.height); tex.needsUpdate = true; }
  drawOff();
  for (const b of beams) b.pivot.visible = false;

  return {
    group: g,
    setShow(v) { on = v; for (const b of beams) b.pivot.visible = v; wash.intensity = v ? 60 : 0; if (!v) drawOff(); },
    update(t) {
      if (!on) return;
      for (const b of beams) { b.pivot.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.55; b.pivot.rotation.x = 0.45 + Math.cos(t * 0.7 + b.ph) * 0.35; }
      drawLED(t); tex.needsUpdate = true;
    },
  };
}
