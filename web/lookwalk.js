/* 사전답사 시점 조작 (공연장 내부)
   - 마우스(손가락)를 누른 채 좌우로 움직이면 제자리에서 360° 둘러보기
   - 누른 채 앞(위)·뒤(아래)로 움직이면 바라보는 방향으로 걸어서 이동 (벽·객석에 막힘)
   - 오른쪽 버튼(또는 Shift) 드래그: 위·아래 보기 / 휠, W·S: 앞뒤 이동 / A·D: 좌우 회전 */
import * as THREE from "three";

export function createLookWalk(camera, dom, { getColliders, blockAbove = () => Infinity, onUserMove } = {}) {
  let yaw = 0, pitch = 0, drag = null, enabled = true;
  const ray = new THREE.Raycaster(), tmp = new THREE.Vector3();
  const fwd = () => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const look = () => {
    const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(tmp.copy(camera.position).add(d));
  };
  function setFromTarget(tgt) {
    const d = tgt.clone().sub(camera.position).normalize();
    yaw = Math.atan2(d.x, d.z); pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)); look();
  }
  // 이동: 수평 방향으로, 앞에 벽·의자가 있으면 0.7m 앞에서 멈춤
  function walk(dist) {
    if (!dist) return;
    const dir = fwd().multiplyScalar(Math.sign(dist));
    let d = Math.abs(dist);
    const col = getColliders?.();
    if (col) {
      for (const h of [0, -1.0]) { // 눈높이와 허리높이 두 번 검사
        ray.set(camera.position.clone().add(new THREE.Vector3(0, h, 0)), dir); ray.far = d + 0.7;
        const hit = ray.intersectObject(col, true).find((i) => i.point.y < blockAbove());
        if (hit) d = Math.min(d, Math.max(0, hit.distance - 0.7));
      }
    }
    camera.position.addScaledVector(dir, d); look(); onUserMove?.();
  }
  const turn = (a) => { yaw += a; look(); onUserMove?.(); };
  const tilt = (a) => { pitch = THREE.MathUtils.clamp(pitch + a, -1.45, 1.45); look(); onUserMove?.(); };

  dom.style.touchAction = "none";
  dom.addEventListener("pointerdown", (e) => {
    if (!enabled) return;
    drag = { x: e.clientX, y: e.clientY, tiltMode: e.button === 2 || e.shiftKey, id: e.pointerId, ax: 0, ay: 0, axis: null };
    try { dom.setPointerCapture(e.pointerId); } catch (_) {} dom.classList.add("grabbing");
  });
  dom.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    // 축 고정: 처음 8px 움직인 방향으로 이번 드래그를 회전(좌우) 또는 이동(상하) 중 하나로만 처리
    if (!drag.axis) { drag.ax += dx; drag.ay += dy; if (Math.abs(drag.ax) + Math.abs(drag.ay) < 8) return;
      drag.axis = Math.abs(drag.ax) >= Math.abs(drag.ay) ? "x" : "y"; }
    if (drag.axis === "x") turn(dx * 0.006);      // 좌우 = 360° 회전
    else if (drag.tiltMode) tilt(dy * 0.004);     // 오른쪽 버튼 상하 = 위·아래 보기
    else walk(dy * 0.09);                         // 아래로 당기면 앞으로, 위로 밀면 뒤로
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; dom.classList.remove("grabbing"); } };
  dom.addEventListener("pointerup", end); dom.addEventListener("pointercancel", end);
  dom.addEventListener("contextmenu", (e) => e.preventDefault());
  dom.addEventListener("wheel", (e) => { if (!enabled) return; e.preventDefault(); walk(-Math.sign(e.deltaY) * Math.min(4, Math.abs(e.deltaY) * 0.02)); }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!enabled || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    const k = e.key.toLowerCase();
    if (k === "w" || k === "arrowup") { walk(1.5); e.preventDefault(); }
    if (k === "s" || k === "arrowdown") { walk(-1.5); e.preventDefault(); }
    if (k === "a") turn(0.12); if (k === "d") turn(-0.12);
  });
  return { setFromTarget, look, set enabled(v) { enabled = v; }, get yaw() { return yaw; } };
}
