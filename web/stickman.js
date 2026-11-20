/* 3D 안내 캐릭터 - 매끈한 흰색 마네킹형(큰 둥근 머리, 통통한 팔다리, 벙어리장갑 손, 큰 둥근 발)(보라색)
   포즈: walk, run, wave, scared(귀 막고 떨기), surprised(펄쩍), idle, sit(휠체어)
   seated 옵션(객석에 앉음): cheer(두 팔 들고 환호), earplug(귀 막고 몸 숙임)
   앞쪽 = +z. 단위 m, scale 1 = 실제 사람 키 약 1.7m (지도 모드에서만 확대 사용) */
import * as THREE from "three";

function limb(len, r0, r1, mat) {
  // 관절(group) 원점에서 -y 방향으로 뻗는, 위가 굵고 아래가 약간 가는 팔다리 + 끝 관절 group
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 16, 1), mat); m.position.y = -len / 2; g.add(m);
  const top = new THREE.Mesh(new THREE.SphereGeometry(r0, 16, 12), mat); g.add(top);
  const end = new THREE.Group(); end.position.y = -len; g.add(end);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(r1, 16, 12), mat); end.add(knob);
  g.userData.end = end; return g;
}

function bubbleTexture(text, accent) {
  const fs = 44, pad = 26;
  const c = document.createElement("canvas"); const x = c.getContext("2d");
  x.font = `700 ${fs}px Paperlogy, "Malgun Gothic", sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + pad * 2, h = fs + pad * 1.6 + 22;
  c.width = w; c.height = h;
  x.font = `700 ${fs}px Paperlogy, "Malgun Gothic", sans-serif`;
  const bh = h - 22, r = bh / 2;
  x.fillStyle = "#ffffff"; x.strokeStyle = accent; x.lineWidth = 6;
  x.beginPath(); x.roundRect(3, 3, w - 6, bh - 6, r); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(w / 2 - 16, bh - 5); x.lineTo(w / 2, h - 2); x.lineTo(w / 2 + 16, bh - 5); x.closePath();
  x.fill(); x.stroke();
  x.fillStyle = "#ffffff"; x.fillRect(w / 2 - 13, bh - 10, 26, 8);
  x.fillStyle = "#18181b"; x.textBaseline = "middle"; x.textAlign = "center"; x.fillText(text, w / 2, bh / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

/** 몸은 보라색(서비스 대표색)으로 통일 */
export function createStickman({ color = 0xffffff, accent = "#8c5cff", wheelchair = false, seated = false, scale = 1, screenBubble = true } = {}) {
  const mat = new THREE.MeshPhongMaterial({ color: 0x8c5cff, specular: 0x666666, shininess: 70 });
  const root = new THREE.Group(); root.scale.setScalar(scale);
  const body = new THREE.Group(); root.add(body);

  // 치수(m): 다리 0.36+0.33, 몸통 0.6, 머리 지름 0.42 -> 서 있는 키 약 1.7m
  const hipY = wheelchair ? 0.56 : seated ? 0.46 : 0.76;
  const hips = new THREE.Group(); hips.position.y = hipY; body.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.28, 8, 20), mat);
  torso.scale.set(1.05, 1, 0.78); torso.position.y = 0.27; spine.add(torso);
  const neck = new THREE.Group(); neck.position.y = 0.55; spine.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 24), mat); head.position.y = 0.14; neck.add(head);

  const mkArm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.2, 0.47, 0); spine.add(sh);
    const up = limb(0.25, 0.058, 0.052, mat); sh.add(up); const lo = limb(0.22, 0.052, 0.048, mat); up.userData.end.add(lo);
    // 벙어리장갑 손 + 엄지
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), mat); hand.scale.set(0.8, 1.15, 0.9); hand.position.y = -0.27; lo.add(hand);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat); thumb.scale.set(1, 1.5, 1); thumb.position.set(-side * 0.045, -0.24, 0.035); lo.add(thumb);
    return { sh, up, lo };
  };
  const mkLeg = (side) => {
    const hp = new THREE.Group(); hp.position.set(side * 0.085, 0.02, 0); hips.add(hp);
    const up = limb(0.36, 0.078, 0.068, mat); hp.add(up); const lo = limb(0.33, 0.068, 0.06, mat); up.userData.end.add(lo);
    // 크고 둥근 발
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), mat); foot.scale.set(0.95, 0.5, 1.55); foot.position.set(0, -0.36, 0.06); lo.add(foot);
    return { hp, up, lo };
  };
  const L = { armL: mkArm(1), armR: mkArm(-1), legL: mkLeg(1), legR: mkLeg(-1) };

  let chair = null;
  if (wheelchair) {
    chair = new THREE.Group(); root.add(chair);
    const frame = new THREE.MeshPhongMaterial({ color: 0x3f4350, shininess: 50 });
    const tire = new THREE.MeshPhongMaterial({ color: 0x33363d, shininess: 20 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.46), frame); seat.position.set(0, 0.47, 0); chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.04), frame); back.position.set(0, 0.74, -0.24); chair.add(back);
    for (const sx of [-0.29, 0.29]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 8, 32), tire); w.rotation.y = Math.PI / 2; w.position.set(sx, 0.3, -0.05); chair.add(w);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), frame); sp.rotation.z = Math.PI / 2; sp.rotation.y = Math.PI / 2; w.add(sp); w.userData.spoke = sp;
      const cs = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 14), tire); cs.rotation.y = Math.PI / 2; cs.position.set(sx * 0.85, 0.07, 0.28); chair.add(cs);
    }
    chair.userData.wheels = chair.children.filter((c) => c.geometry?.type === "TorusGeometry" && c.position.y > 0.2);
  }

  // 외곽선(뒤집힌 껍질): 밝은 바닥 위에서도 흰 캐릭터가 잘 보이도록
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x2a2c33, side: THREE.BackSide });
  const shells = [];
  root.traverse((o) => { if (o.isMesh && o.material === mat) shells.push(o); });
  for (const o of shells) { const sh = new THREE.Mesh(o.geometry, lineMat); sh.scale.setScalar(1.07); o.add(sh); }

  // 말풍선
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true, sizeAttenuation: !screenBubble }));
  bubble.renderOrder = 1000; bubble.visible = false; root.add(bubble);
  function setBubble(text) {
    if (!text) { bubble.visible = false; return; }
    const { tex, aspect } = bubbleTexture(text, accent);
    bubble.material.map?.dispose(); bubble.material.map = tex; bubble.material.needsUpdate = true;
    // screenBubble: 거리와 무관하게 화면 높이의 약 6%로 고정 (루트 scale 보정)
    const h = screenBubble ? 0.06 / scale : 0.5; bubble.scale.set(h * aspect, h, 1); bubble.position.set(0, wheelchair || seated ? 1.7 : 2.0, 0); bubble.visible = true;
  }

  // 경로 이동
  let path = null, seg = 0, u = 0, speed = 1.2, mode = "pingpong", dir = 1;
  function setPath(points, spd = 1.2, m = "pingpong") {
    path = points && points.length > 1 ? points.map((p) => p.clone()) : null; seg = 0; u = 0; dir = 1; speed = spd; mode = m;
    if (points?.length) root.position.copy(points[0]);
  }
  function faceTowards(v) { const d = v.clone().sub(root.position); if (d.lengthSq() > 1e-6) root.rotation.y = Math.atan2(d.x, d.z); }

  let pose = "idle";
  const setPose = (p) => { pose = p; };
  const reset = () => { for (const k in L) { L[k].up.rotation.set(0, 0, 0); L[k].lo.rotation.set(0, 0, 0); }
    spine.rotation.set(0, 0, 0); neck.rotation.set(0, 0, 0); body.position.set(0, 0, 0); };

  function update(dt, t) {
    if (path) {
      let remain = speed * dt; // world m/s
      while (remain > 0) {
        const a = path[seg], b = path[seg + dir] ?? path[seg];
        const len = a.distanceTo(b) || 1e-6, left = (1 - u) * len;
        if (remain < left) { u += remain / len; remain = 0; root.position.lerpVectors(a, b, u); faceTowards(b.clone().setY(root.position.y)); }
        else {
          remain -= left; seg += dir; u = 0;
          const end = dir > 0 ? seg >= path.length - 1 : seg <= 0;
          if (end) { if (mode === "loop") { seg = 0; dir = 1; root.position.copy(path[0]); break; } dir = -dir; }
        }
      }
    }
    reset();
    const s = t * (pose === "run" ? 10 : 6.5);
    if (wheelchair) {
      for (const k of ["legL", "legR"]) { L[k].up.rotation.x = -Math.PI / 2; L[k].lo.rotation.x = Math.PI / 2; }
      const moving = !!path, push = moving ? Math.sin(t * 5) : 0;
      for (const k of ["armL", "armR"]) { L[k].up.rotation.x = -0.25 + push * 0.35; L[k].lo.rotation.x = -0.6; L[k].up.rotation.z = (k === "armL" ? 1 : -1) * 0.12; }
      if (pose === "wave") { L.armR.up.rotation.x = 0; L.armR.up.rotation.z = -2.6; L.armR.lo.rotation.z = Math.sin(t * 8) * 0.5; }
      if (moving && chair) chair.userData.wheels.forEach((w) => (w.userData.spoke.rotation.x += dt * speed / 0.3));
      body.position.y = Math.sin(t * 2) * 0.004;
    } else if (seated) {
      // 객석 의자에 앉은 자세: 허벅지 수평, 종아리 수직
      for (const k of ["legL", "legR"]) { L[k].up.rotation.x = -Math.PI / 2; L[k].lo.rotation.x = Math.PI / 2; }
            if (pose === "cheer") {
        const w = Math.sin(t * 3.2);
        L.armL.up.rotation.z = 2.7 + w * 0.15; L.armR.up.rotation.z = -2.7 + w * 0.15;
        L.armL.lo.rotation.z = 0.25; L.armR.lo.rotation.z = -0.25;
        spine.rotation.z = w * 0.08; neck.rotation.x = -0.15;
        body.position.y = Math.abs(Math.sin(t * 3.2)) * 0.05;
      } else if (pose === "earplug") {
        L.armL.up.rotation.z = 2.3; L.armL.lo.rotation.z = 2.25; L.armR.up.rotation.z = -2.3; L.armR.lo.rotation.z = -2.25;
        L.armL.up.rotation.x = L.armR.up.rotation.x = -0.25;
        spine.rotation.x = 0.35; neck.rotation.x = 0.25;
        body.position.x = Math.sin(t * 40) * 0.006;
      } else { L.armL.up.rotation.x = L.armR.up.rotation.x = -0.5; L.armL.lo.rotation.x = L.armR.lo.rotation.x = -0.6; }
    } else if (pose === "walk" || pose === "run") {
      const amp = pose === "run" ? 0.85 : 0.45;
      L.legL.up.rotation.x = Math.sin(s) * amp; L.legR.up.rotation.x = -Math.sin(s) * amp;
      L.legL.lo.rotation.x = Math.max(0, -Math.sin(s)) * amp * 1.4; L.legR.lo.rotation.x = Math.max(0, Math.sin(s)) * amp * 1.4;
      L.armL.up.rotation.x = -Math.sin(s) * amp * 0.9; L.armR.up.rotation.x = Math.sin(s) * amp * 0.9;
      L.armL.up.rotation.z = 0.1; L.armR.up.rotation.z = -0.1;
      L.armL.lo.rotation.x = L.armR.lo.rotation.x = pose === "run" ? -1.3 : -0.25;
      spine.rotation.x = pose === "run" ? 0.22 : 0.04;
      body.position.y = Math.abs(Math.sin(s)) * (pose === "run" ? 0.06 : 0.025) - (pose === "run" ? 0.04 : 0.01);
    } else if (pose === "wave") {
      L.armR.up.rotation.z = -2.6; L.armR.lo.rotation.z = Math.sin(t * 8) * 0.5; L.armL.up.rotation.z = 0.12;
      body.position.y = Math.abs(Math.sin(t * 3)) * 0.02;
    } else if (pose === "scared") {
      // 무릎 굽히고 두 손으로 귀(머리 옆) 막기 + 떨림
      for (const k of ["legL", "legR"]) { L[k].up.rotation.x = -0.55; L[k].lo.rotation.x = 0.95; }
      body.position.y = -0.09;
      L.armL.up.rotation.z = 2.3; L.armL.lo.rotation.z = 2.25; L.armR.up.rotation.z = -2.3; L.armR.lo.rotation.z = -2.25;
      L.armL.up.rotation.x = L.armR.up.rotation.x = -0.25;
      spine.rotation.x = 0.22; neck.rotation.x = 0.15;
      body.position.x = Math.sin(t * 60) * 0.01;
    } else if (pose === "surprised") {
      // 펄쩍 뛰며 두 팔 위로
      const j = Math.max(0, Math.sin(t * 4));
      body.position.y = j * 0.28;
      L.armL.up.rotation.z = 2.6; L.armR.up.rotation.z = -2.6; L.armL.lo.rotation.z = 0.3; L.armR.lo.rotation.z = -0.3;
      L.legL.up.rotation.z = 0.22 * j; L.legR.up.rotation.z = -0.22 * j;
      neck.rotation.x = -0.2;
    } else {
      L.armL.up.rotation.z = 0.1; L.armR.up.rotation.z = -0.1;
      body.position.y = Math.sin(t * 2) * 0.006;
    }
  }

  return { group: root, setPose, setBubble, setPath, update, faceTowards, dispose() { root.traverse((o) => { o.geometry?.dispose(); }); bubble.material.map?.dispose(); } };
}
