import * as THREE from '../vendor/three.module.min.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function initScene(canvas) {
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || Math.min(innerWidth, innerHeight) < 380;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !lowEnd, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  /* ---------------- floating petals / bokeh / stars ---------------- */
  const N = lowEnd ? 260 : 480;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N), kind = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - .5) * 12;
    pos[i * 3 + 1] = (Math.random() - .5) * 12;
    pos[i * 3 + 2] = -6 + Math.random() * 9;
    seed[i] = Math.random();
    size[i] = .6 + Math.random() * 1.8;
    kind[i] = Math.random() < .42 ? 1 : 0;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  pGeo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const pUni = {
    uTime: { value: 0 }, uPix: { value: renderer.getPixelRatio() }, uScroll: { value: 0 },
    uNight: { value: 0 }, uAlpha: { value: 1 }, uBoost: { value: 0 }
  };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pUni, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float aSeed; attribute float aSize; attribute float aKind;
      uniform float uTime, uPix, uScroll, uNight, uBoost;
      varying float vSeed, vKind, vRot, vDepth;
      void main(){
        vec3 p = position;
        float sp = .12 + aSeed * .25 + uBoost;
        float h = 12.;
        p.y = mod(p.y - uTime * sp * (1. - uNight * .85) + uScroll * (.0006 + aSeed * .0012) + h * .5, h) - h * .5;
        p.x += sin(uTime * .35 + aSeed * 40.) * .45 * (1. - uNight);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float s = aSize * mix(1., .45, uNight) * mix(1., 1.7, aKind * (1. - uNight));
        gl_PointSize = s * uPix * 26. / -mv.z;
        vSeed = aSeed; vKind = aKind; vRot = uTime * (.4 + aSeed) + aSeed * 6.28; vDepth = clamp((-mv.z - 1.) / 10., 0., 1.);
      }`,
    fragmentShader: `
      uniform float uNight, uAlpha, uTime;
      varying float vSeed, vKind, vRot, vDepth;
      void main(){
        vec2 c = gl_PointCoord - .5;
        float a;
        if (vKind > .5 && uNight < .5) {
          float s = sin(vRot), co = cos(vRot);
          vec2 q = vec2(co * c.x - s * c.y, s * c.x + co * c.y);
          q.y += .12;
          float d = length(vec2(q.x * (1.9 - q.y * 1.6), q.y * 1.15));
          a = smoothstep(.42, .3, d);
        } else {
          float d = length(c);
          a = smoothstep(.5, .05, d) * mix(.55, 1., smoothstep(.5, .35, d));
        }
        vec3 pinkA = vec3(1., .8, .87), pinkB = vec3(1., .93, .96), white = vec3(1.);
        vec3 col = mix(mix(pinkA, pinkB, vSeed), white, step(.8, vSeed) * .6);
        float tw = .55 + .45 * sin(uTime * (1.5 + vSeed * 3.) + vSeed * 50.);
        col = mix(col, vec3(1., .93, .97), uNight);
        a *= mix(.75 - vDepth * .35, tw * .95, uNight) * uAlpha;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  pMat.premultipliedAlpha = true;
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------------- globe with India → Yangon arc ---------------- */
  const globe = new THREE.Group(), globeInner = new THREE.Group();
  globe.add(globeInner);
  const R = 1.7;
  const ll = (lat, lon, r = R) => {
    const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };
  const GN = lowEnd ? 1400 : 2400, gp = new Float32Array(GN * 3);
  for (let i = 0; i < GN; i++) {
    const y = 1 - (i / (GN - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.39996;
    gp[i * 3] = Math.cos(t) * r * R; gp[i * 3 + 1] = y * R; gp[i * 3 + 2] = Math.sin(t) * r * R;
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  const gUni = { uAlpha: { value: 0 }, uPix: { value: renderer.getPixelRatio() } };
  const gMat = new THREE.ShaderMaterial({
    uniforms: gUni, transparent: true, depthWrite: false,
    vertexShader: `uniform float uPix; varying float vF;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vec3 n = normalize(mat3(modelViewMatrix) * position);
        vF = n.z; gl_Position = projectionMatrix * mv; gl_PointSize = uPix * 2.8; }`,
    fragmentShader: `uniform float uAlpha; varying float vF;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5,.2,d) * mix(.1,.9,smoothstep(-.2,1.,vF)) * uAlpha;
        gl_FragColor = vec4(vec3(.55,.08,.27) * a, a); }`,
  });
  gMat.premultipliedAlpha = true;
  globeInner.add(new THREE.Points(gGeo, gMat));

  const rimMat = new THREE.ShaderMaterial({
    uniforms: gUni, transparent: true, depthWrite: false,
    vertexShader: `varying float vF; void main(){ vec3 n = normalize(normalMatrix * normal); vF = 1. - abs(n.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uAlpha; varying float vF; void main(){ float a = (pow(vF, 3.) * .55 + .05) * uAlpha;
      gl_FragColor = vec4(vec3(1.,.82,.88) * a, a); }`,
  });
  rimMat.premultipliedAlpha = true;
  globeInner.add(new THREE.Mesh(new THREE.SphereGeometry(R * .995, 48, 32), rimMat));

  const A = ll(22.5, 79), B = ll(16.84, 96.17);
  const labels = [['India', 'Betu', A], ['Yangon', 'Baba', B]].map(([place, who, v]) => {
    const el = document.createElement('div');
    el.className = 'geo-label';
    el.innerHTML = `<b>${place}</b><span>${who}</span>`;
    document.body.append(el);
    return { el, v: v.clone().multiplyScalar(1.02) };
  });
  const tmpV = new THREE.Vector3();
  const mid = A.clone().add(B).multiplyScalar(.5).normalize().multiplyScalar(R * 1.45);
  const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
  const tube = new THREE.TubeGeometry(curve, 80, .012, 6, false);
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xa3164c, transparent: true, opacity: 0 });
  const arc = new THREE.Mesh(tube, arcMat);
  globeInner.add(arc);
  const tubeCount = tube.index.count;
  tube.setDrawRange(0, 0);

  const dotGeo = new THREE.BufferGeometry().setFromPoints([A.clone().multiplyScalar(1.01), B.clone().multiplyScalar(1.01)]);
  const dUni = { uAlpha: { value: 0 }, uTime: { value: 0 }, uPix: { value: renderer.getPixelRatio() } };
  const dMat = new THREE.ShaderMaterial({
    uniforms: dUni, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: `uniform float uPix, uTime; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.);
      gl_Position = projectionMatrix * mv; gl_PointSize = uPix * (34. + 10. * sin(uTime * 3.)) * 6. / -mv.z; }`,
    fragmentShader: `uniform float uAlpha; void main(){ float d = length(gl_PointCoord - .5);
      float a = (smoothstep(.5,.0,d) * .55 + smoothstep(.14,.08,d)) * uAlpha; gl_FragColor = vec4(vec3(.9,.3,.48) * a, a); }`,
  });
  dMat.premultipliedAlpha = true;
  globeInner.add(new THREE.Points(dotGeo, dMat));

  const C = ll(19.5, 87.5).normalize();
  globeInner.quaternion.setFromUnitVectors(C, new THREE.Vector3(0, .25, 1).normalize());
  globe.position.set(0, -.15, -.6);
  scene.add(globe);

  /* ---------------- procedural white rose ---------------- */
  const rose = new THREE.Group();
  const head = new THREE.Group();
  rose.add(head);
  const PET = 26, SEG_U = 10, SEG_V = 14;
  const petals = [];
  const petalMat = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: .62, metalness: 0,
    emissive: new THREE.Color(0xfff2f5), emissiveIntensity: .16, transparent: true, opacity: 0,
  });
  const cBase = new THREE.Color(0xdfe8c8), cMid = new THREE.Color(0xffffff), cTip = new THREE.Color(0xffeef2);
  for (let k = 0; k < PET; k++) {
    const t = k / (PET - 1);
    const g = new THREE.PlaneGeometry(1, 1, SEG_U, SEG_V);
    const uv = g.attributes.uv.array;
    const cols = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const u = uv[i * 2] - .5, v = uv[i * 2 + 1];
      const c = cBase.clone().lerp(cMid, Math.min(1, v * 3)).lerp(cTip, Math.max(0, (Math.abs(u) * 2 + v - 1.2)) * .9);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, petalMat);
    const pivot = new THREE.Object3D();
    pivot.rotation.y = k * 2.39996;
    pivot.add(m);
    head.add(pivot);
    petals.push({ m, g, t, h: .6 + .38 * t, r0: .012 + .12 * t });
  }
  function shapeRose(open) {
    for (const p of petals) {
      const { g, t, h } = p, w = h * (.78 + .2 * t);
      const pa = g.attributes.position.array, uv = g.attributes.uv.array;
      const cup = (3.4 - 1.5 * t) * (1 - .3 * open);
      const curl = open * (.15 + .8 * t);
      for (let i = 0; i < g.attributes.position.count; i++) {
        const u = uv[i * 2] - .5, v = uv[i * 2 + 1];
        const wp = Math.max(.2, .45 + .55 * Math.sin(Math.PI * v * .82 + .15));
        const x = u * w * wp;
        const y = v * h * (1 - .14 * (2 * u) * (2 * u) * v * v * v);
        let z = -cup * x * x + .06 * h * Math.sin(Math.PI * v);
        const tv = Math.max(0, v - .55);
        z += curl * tv * tv * h * 3.2;
        pa[i * 3] = x; pa[i * 3 + 1] = y; pa[i * 3 + 2] = z;
      }
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
      p.m.position.set(0, -.26 * t, p.r0 * (1 + open * .6));
      p.m.rotation.x = (.02 + .16 * t) + open * (.04 + .5 * t * t);
    }
  }
  shapeRose(0);
  head.position.y = .18;

  const green = new THREE.MeshStandardMaterial({ color: 0x55734a, roughness: .7, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .05, 0), new THREE.Vector3(.04, -.8, .02), new THREE.Vector3(-.05, -1.8, 0), new THREE.Vector3(.02, -3.2, 0)]);
  rose.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 40, .04, 8, false), green));
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(.07, .42, 4, 1, true), green);
    const piv = new THREE.Object3D(); piv.rotation.y = i * 1.2566;
    s.position.set(0, -.02, .16); s.rotation.x = 2.1;
    piv.add(s); rose.add(piv);
  }
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.bezierCurveTo(.18, .12, .22, .42, 0, .62); leafShape.bezierCurveTo(-.22, .42, -.18, .12, 0, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 12), green);
  leaf.position.set(.02, -1.3, 0); leaf.rotation.set(.3, .4, -1.05);
  rose.add(leaf);
  rose.position.set(0, -.25, 0);
  rose.scale.setScalar(.001);
  scene.add(rose);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xead3dc, 1.25));
  const key = new THREE.DirectionalLight(0xfff6ee, 1.5); key.position.set(2.5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc2d6, .9); rim.position.set(-3, 1, -3); scene.add(rim);

  /* ---------------- state ---------------- */
  const target = { globe: 0, rose: 0, night: 0, open: 0, arc: 0 };
  const cur = { globe: 0, rose: 0, night: 0, open: 0, arc: 0 };
  let px = 0, py = 0, gx = 0, gy = 0, scrollY = 0, boost = 0, lastOpen = -1;
  addEventListener('pointermove', e => { px = e.clientX / innerWidth - .5; py = e.clientY / innerHeight - .5; }, { passive: true });
  addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    gx = Math.max(-1, Math.min(1, e.gamma / 30)) * .5; gy = Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * .5;
  }, { passive: true });

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 52 : 40;
    camera.updateProjectionMatrix();
    const narrow = w / h < .7;
    globe.scale.setScalar(narrow ? .82 : 1);
    globe.userData.k = narrow ? .5 : 1;
    globe.position.y = narrow ? -1.7 : -.15;
    rose.userData.base = narrow ? .82 : 1;
  }
  addEventListener('resize', resize); resize();

  let running = true, t0 = performance.now(), last = t0;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); loop(); } });
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000;
    const k = 1 - Math.pow(.02, dt);
    for (const key in cur) cur[key] = lerp(cur[key], target[key], key === 'open' ? 1 - Math.pow(.15, dt) : k);
    boost = lerp(boost, 0, 1 - Math.pow(.3, dt));

    pUni.uTime.value = time; pUni.uScroll.value = scrollY; pUni.uNight.value = cur.night; pUni.uBoost.value = boost;
    pUni.uAlpha.value = 1 - cur.rose * .35;

    const gk = cur.globe * (globe.userData.k || 1);
    gUni.uAlpha.value = gk; dUni.uAlpha.value = cur.globe * cur.arc; dUni.uTime.value = time;
    arcMat.opacity = cur.globe * .9;
    tube.setDrawRange(0, Math.floor(tubeCount * cur.arc / 3) * 3);
    globe.visible = cur.globe > .005;
    globe.rotation.y = Math.sin(time * .15) * .25 + (px + gx) * .3;
    globe.rotation.x = (py + gy) * .15;

    const la = cur.globe * Math.max(0, cur.arc * 1.4 - .4);
    globe.updateMatrixWorld();
    for (const L of labels) {
      if (la < .01) { L.el.style.opacity = 0; continue; }
      tmpV.copy(L.v).applyMatrix4(globeInner.matrixWorld).project(camera);
      L.el.style.opacity = la;
      L.el.style.transform = `translate(${(tmpV.x * .5 + .5) * innerWidth}px,${(-tmpV.y * .5 + .5) * innerHeight}px)`;
    }

    rose.visible = cur.rose > .005;
    if (rose.visible) {
      const s = (rose.userData.base || 1) * 1.35 * (.6 + .4 * cur.rose);
      rose.scale.setScalar(s);
      petalMat.opacity = green.opacity = Math.min(1, cur.rose * 1.2);
      petalMat.transparent = green.transparent = cur.rose < .99;
      petalMat.depthWrite = !petalMat.transparent;
      if (Math.abs(cur.open - lastOpen) > .002) { shapeRose(cur.open); lastOpen = cur.open; }
      rose.rotation.y = time * .18 + (px + gx) * .6;
      rose.rotation.x = .14 + (py + gy) * .2 + Math.sin(time * .5) * .03;
      rose.rotation.z = Math.sin(time * .4) * .03;
    }

    camera.position.x = lerp(camera.position.x, (px + gx) * .5, .05);
    camera.position.y = lerp(camera.position.y, -(py + gy) * .35, .05);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  loop();

  return {
    set(o) { Object.assign(target, o); },
    scroll(y) { scrollY = y; },
    burst() { boost = 2.2; },
  };
}
