import { initScene } from './scene.js?v=28';
import { createMusic } from './music.js?v=28';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let scene = null;
try { scene = initScene($('#gl')); } catch (e) { document.documentElement.classList.add('no-gl'); }
const S = { set() {}, scroll() {}, burst() {}, spin() {}, release() {}, ...(scene || {}) };

/* ================= smooth scroll ================= */
const lenis = new Lenis({ duration: 1.25, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
lenis.on('scroll', e => { ScrollTrigger.update(); S.scroll(e.scroll); });
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
window.__lenis = lenis;
ScrollTrigger.addEventListener("refresh", () => lenis.resize());

/* ================= lock screen ================= */
const fmt = (offsetMin) => {
  const d = new Date(Date.now() + offsetMin * 60000);
  let h = d.getUTCHours(), m = d.getUTCMinutes();
  const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
};
function tickLock() {
  $('#clkIN').textContent = fmt(330);
  $('#clkMM').textContent = fmt(390);
  const b = $('#openBtn');
  if (b.hidden) { b.hidden = false; gsap.from(b, { scale: .6, opacity: 0, duration: 1.2, ease: 'elastic.out(1,.6)' }); }
}
tickLock(); const lockTimer = setInterval(tickLock, 1000);
S.set({ globe: 0, rose: 0, night: 0 });
gsap.from('.lock-inner > *', { y: 30, opacity: 0, duration: 1.4, stagger: .12, ease: 'expo.out', delay: .2 });

$('#openBtn').addEventListener('click', () => {
  S.burst();
  playMusic();
  const tl = gsap.timeline();
  tl.to('.lock-inner > *', { y: -40, opacity: 0, duration: .9, stagger: .05, ease: 'power3.in' })
    .to('#lock', { opacity: 0, duration: .8, ease: 'power2.out' }, '-=.3')
    .add(() => {
      clearInterval(lockTimer);
      $('#lock').remove();
      document.body.classList.remove('is-locked');
      window.scrollTo(0, 0);
      lenis.start();
      setupStory();
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    });
});

/* ================= music ================= */
const music = createMusic();
window.__music = music;
const playMusic = () => music.start();
const duckFor = v => music.duckFor(v);

/* ================= helpers ================= */
function splitChars(el) {
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.append(' '); return; }
          const ws = document.createElement('span'); ws.className = 'word';
          [...w].forEach(c => { const s = document.createElement('span'); s.className = 'char'; s.textContent = c; ws.append(s); });
          frag.append(ws);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return $$('.char', el);
}

const THEMES = {
  dawn: ['#240816', '#3d0f27', '#fff3f6', '#f0c4d2', '#ff8db4', '#240816'],
  rose: ['#2c0a1c', '#4a1230', '#fff3f6', '#f2c6d4', '#ff94b9', '#2c0a1c'],
  blush: ['#26091a', '#40112c', '#fff3f6', '#f0c4d2', '#ff8db4', '#26091a'],
  cream: ['#270b15', '#421426', '#fff4f2', '#f2c7cf', '#ff92b0', '#270b15'],
  night: ['#0b0510', '#1d0a22', '#fff3f6', '#e6bfd0', '#ff94b9', '#0b0510'],
  dusk: ['#2a0b20', '#4a1638', '#fff3f6', '#f0c4d6', '#ff94bd', '#2a0b20'],
};
const SCENES = {
  globe: { globe: 1, rose: 0, night: 0 },
  petals: { globe: 0, rose: 0, night: 0 },
  stars: { globe: 0, rose: 0, night: 1 },
  rose: { globe: 0, rose: 1, night: 0 },
};
const root = document.documentElement, meta = $('meta[name=theme-color]');
function applyTheme(name) {
  const t = THEMES[name]; if (!t) return;
  gsap.to(root, { '--bg-a': t[0], '--bg-b': t[1], '--ink': t[2], '--muted': t[3], '--accent': t[4], duration: 1.2, ease: 'power2.out', overwrite: 'auto' });
  meta.setAttribute('content', t[5]);
}

function onceVisible(el, fn, opts = { threshold: .35 }) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(); } }), opts);
  io.observe(el);
}
function whileVisible(el, on, off, threshold = .15) {
  new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? on() : off()), { threshold }).observe(el);
}

/* ================= story ================= */
function setupStory() {
  // themes + 3D scene states: whichever section crosses 55% of the viewport
  const secs = $$('[data-theme]');
  let active = null, queued = false;
  const pickTheme = () => {
    queued = false;
    const line = innerHeight * .55;
    for (const sec of secs) {
      const box = (sec.parentElement.classList.contains('pin-spacer') ? sec.parentElement : sec).getBoundingClientRect();
      if (box.top <= line && box.bottom > line) {
        if (sec !== active) { active = sec; applyTheme(sec.dataset.theme); S.set(SCENES[sec.dataset.scene] || {}); }
        return;
      }
    }
  };
  lenis.on('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(pickTheme); } });
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(pickTheme); } }, { passive: true });
  setTimeout(pickTheme, 50);

  // hero entrance
  const heroChars = splitChars($('.hero-name'));
  gsap.from(heroChars, { yPercent: 110, rotateX: -80, opacity: 0, duration: 1.6, stagger: .035, ease: 'expo.out', delay: .1 });
  gsap.from('.hero > :not(.hero-name)', { y: 30, opacity: 0, duration: 1.4, stagger: .12, ease: 'expo.out', delay: .6 });
  gsap.to({}, { duration: 2.4, delay: .5, onStart: () => S.set({ arc: 1 }) });

  // generic reveals
  $$('.r-chars').forEach(el => {
    if (el.classList.contains('hero-name')) return;
    const ch = splitChars(el);
    gsap.from(ch, { yPercent: 100, opacity: 0, rotateZ: 6, duration: 1.3, stagger: .028, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  $$('.chapter .r, .finale .r').forEach(el => {
    gsap.from(el, { y: 36, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  $$('.r-up').forEach(el => {
    gsap.from(el, { y: 80, opacity: 0, scale: .94, rotateX: 8, transformPerspective: 900, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  $$('.big-quote').forEach(el => gsap.fromTo(el, { letterSpacing: '.04em' }, { letterSpacing: '0em', scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 40%', scrub: true } }));

  // parallax on images
  $$('.duo img, .mosaic img, .trio img, .discord img').forEach((img, i) => {
    gsap.fromTo(img, { y: 30 + (i % 3) * 14 }, { y: -30 - (i % 3) * 14, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  gsap.fromTo('.pol-l', { rotate: -14, x: -40 }, { rotate: -6, x: 0, ease: 'none', scrollTrigger: { trigger: '.polaroids', start: 'top bottom', end: 'center center', scrub: true } });
  gsap.fromTo('.pol-r', { rotate: 14, x: 40 }, { rotate: 5, x: 0, ease: 'none', scrollTrigger: { trigger: '.polaroids', start: 'top bottom', end: 'center center', scrub: true } });

  setupSpin($('.hero')); setupSpin($('#rose'));
  setupIG(); setupHop(); setupVideos(); setupEnvelope(); setupReveal(); setupNames(); setupOrb();
  setupScramble(); setupWall(); setupNight(); setupLyrics(); setupDeck(); setupPromiseBox(); setupStats(); setupRose(); setupILY();

  $('#again').addEventListener('click', () => lenis.scrollTo(0, { duration: 7, easing: t => 1 - Math.pow(1 - t, 4) }));
}

/* ---------- Instagram first messages ---------- */
function setupIG() {
  const msgs = [['her', 'Hello Hi!'], ['me first', 'Yoholoo'], ['her', 'I came from your threads by the way'], ['her', 'Nice to meet you'],
    ['me', 'Oh i see i almost forgot about it'], ['me', 'Ntmy too'], ['me', "I'm shubh<br>19<br>From india"]];
  const body = $('#igChat .ig-body');
  onceVisible($('#igChat'), async () => {
    for (const [who, text] of msgs) {
      const typing = document.createElement('div');
      typing.className = 'igb typing ' + (who.startsWith('me') ? 'me' : 'her');
      typing.innerHTML = '<i></i><i></i><i></i>';
      body.append(typing);
      gsap.to(typing, { opacity: 1, y: 0, scale: 1, duration: .35 });
      await sleep(650 + text.length * 18);
      typing.remove();
      const b = document.createElement('div');
      b.className = 'igb ' + who; b.innerHTML = text;
      body.append(b);
      gsap.to(b, { opacity: 1, y: 0, scale: 1, duration: .6, ease: 'back.out(2)' });
      await sleep(320);
    }
  });
}

/* ---------- Instagram → Telegram hop ---------- */
function setupHop() {
  const hop = $('.hop'), path = $('.hop-path path'), plane = $('.hop-plane'), L = path.getTotalLength();
  path.style.strokeDashoffset = 0;
  const st = { p: 0 };
  gsap.to(st, {
    p: 1, ease: 'none', scrollTrigger: { trigger: hop, start: 'top 80%', end: 'bottom 35%', scrub: 1 },
    onUpdate: () => {
      const w = hop.clientWidth, pt = path.getPointAtLength(st.p * L), pt2 = path.getPointAtLength(Math.min(L, st.p * L + 2));
      const x = w * .22 + pt.x / 300 * w * .56 - 15, y = 10 + pt.y / 80 * 60 - 15;
      const ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
      gsap.set(plane, { x: x - w * .22, y: y - 50, rotate: ang + 20 });
    },
  });
  gsap.to('.hop-ig', { opacity: .35, scale: .9, filter: 'grayscale(1)', scrollTrigger: { trigger: hop, start: 'top 60%', end: 'bottom 40%', scrub: true } });
  gsap.fromTo('.hop-tg', { scale: .9 }, { scale: 1.08, scrollTrigger: { trigger: hop, start: 'top 50%', end: 'bottom 35%', scrub: true } });
}

/* ---------- videos ---------- */
function setupVideos() {
  $$('[data-autoplay]').forEach(fig => {
    const v = $('video', fig);
    duckFor(v);
    whileVisible(fig, () => { v.play().catch(() => {}); }, () => { v.pause(); if (!v.muted) { v.muted = true; fig.classList.remove('unmuted'); } }, .4);
    if ('sound' in fig.dataset) fig.addEventListener('click', () => {
      v.muted = !v.muted; fig.classList.toggle('unmuted', !v.muted);
      if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); }
    });
  });
  const fv = $('.frags video'); if (fv) fv.play().catch(() => {});
}

/* ---------- envelope + letter ---------- */
function setupEnvelope() {
  const env = $('#envelope'), modal = $('#letterModal'), sheet = $('.modal-sheet', modal);
  env.addEventListener('click', async () => {
    env.classList.add('open');
    await sleep(1100);
    modal.hidden = false; lenis.stop();
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: .4 });
    gsap.fromTo(sheet, { yPercent: 100 }, { yPercent: 0, duration: .9, ease: 'expo.out' });
    gsap.from($$('.conf p', sheet), { y: 24, opacity: 0, stagger: .06, duration: 1, ease: 'expo.out', delay: .3 });
    sheet.scrollTop = 0;
  });
  const close = () => {
    gsap.to(sheet, { yPercent: 100, duration: .6, ease: 'power3.in' });
    gsap.to(modal, { opacity: 0, duration: .6, onComplete: () => { modal.hidden = true; lenis.start(); setTimeout(() => env.classList.remove('open'), 400); } });
  };
  $('#letterClose').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

/* ---------- face reveal: pieces → you ---------- */
function setupReveal() {
  const frags = $$('.frag'), n = frags.length;
  const spots = frags.map((_, i) => {
    const a = i / n * Math.PI * 2 + .4, rx = Math.min(innerWidth * .32, 300), ry = Math.min(innerHeight * .26, 260);
    return { x: Math.cos(a) * rx, y: Math.sin(a) * ry + 20, z: -200 + (i % 3) * 140, r: (i % 2 ? 1 : -1) * (6 + i * 2) };
  });
  frags.forEach((f, i) => gsap.set(f, { xPercent: -50, yPercent: -50, x: spots[i].x * .2, y: spots[i].y * .2 + 200, z: -1600, rotate: spots[i].r * 3, opacity: 0 }));
  const tl = gsap.timeline({ scrollTrigger: { trigger: '#reveal', start: 'top top', end: '+=260%', pin: true, scrub: 1, anticipatePin: 1 } });
  frags.forEach((f, i) => tl.to(f, { x: spots[i].x, y: spots[i].y, z: spots[i].z, rotate: spots[i].r, opacity: 1, duration: 1, ease: 'power3.out' }, i * .22));
  tl.to({}, { duration: .6 });
  tl.to('.reveal-cap1', { opacity: 0, y: -20, duration: .5 });
  frags.forEach((f, i) => tl.to(f, { x: 0, y: 0, z: 120, rotate: 0, scale: .55, opacity: 0, duration: 1.1, ease: 'power3.in' }, '<' + (i ? .05 : 0)));
  tl.fromTo('.reveal-face', { opacity: 0, scale: .7, filter: 'blur(24px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.4, ease: 'power2.out' }, '-=.5');
  tl.to('.reveal-cap2', { opacity: 1, y: 0, duration: .6 }, '-=.6');
  tl.to({}, { duration: .5 });
}

/* ---------- names drum ---------- */
function setupNames() {
  const names = ['Grace', 'baby', 'Baba', 'Bubu', 'monkey', 'donut', 'smooth brain', 'Oogy Woogy Baba', 'my shmol princess', 'itty bitty baba',
    'cutiepie', 'oompy loompy baba', 'my wifey', 'my everything', 'uutu buutu baba', 'princess', 'my cuteness aggression', 'Eaindray'];
  const cyl = $('#cyl'), N = names.length, step = 360 / N, r = 74 / (2 * Math.tan(Math.PI / N));
  names.forEach((t, i) => {
    const s = document.createElement('span'); s.textContent = t;
    s.style.transform = `rotateX(${-i * step}deg) translateZ(${r}px)`;
    cyl.append(s);
  });
  const spans = $$('span', cyl);
  const st = { a: 0 };
  gsap.to(st, {
    a: step * (N - 1), ease: 'none',
    scrollTrigger: { trigger: '#names', start: 'top top', end: '+=240%', pin: true, scrub: 1.2, anticipatePin: 1 },
    onUpdate: () => {
      cyl.style.transform = `translateZ(${-r}px) rotateX(${st.a}deg)`;
      spans.forEach((s, i) => { const d = Math.abs(((i * step - st.a) % 360 + 540) % 360 - 180); s.style.opacity = Math.max(.06, 1 - d / 75); });
    },
  });
  cyl.style.transform = `translateZ(${-r}px)`;
}

/* ---------- sticker orb ---------- */
function setupSpin(el) {
  let down = false, lx = 0, ly = 0, t = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('button,a,textarea')) return; down = true; lx = e.clientX; ly = e.clientY; t = performance.now(); });
  addEventListener('pointermove', e => {
    if (!down) return;
    S.spin(e.clientX - lx, e.pointerType === 'mouse' ? e.clientY - ly : 0);
    lx = e.clientX; ly = e.clientY; t = performance.now();
  }, { passive: true });
  const up = () => { if (!down) return; down = false; S.release(performance.now() - t > 90); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

function setupOrb() {
  const ids = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 38,
    40, 41, 43, 44, 46, 47, 48, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 62, 63, 64, 65, 66, 67, 68, 70, 71, 72];
  const orb = $('#orb'), rot = $('#orbRot'), N = ids.length;
  const R = Math.min(orb.clientWidth, 460) * .38;
  ids.forEach((id, i) => {
    const y = 1 - (i + .5) / N * 2, lat = Math.asin(y) * 180 / Math.PI, lon = i * 137.508;
    const img = new Image(); img.src = `img/s/${id}.webp`; img.alt = ''; img.decoding = 'async';
    img.style.transform = `rotateY(${lon}deg) rotateX(${lat}deg) translateZ(${R}px)`;
    rot.append(img);
  });
  let ax = -12, ay = 0, vx = 0, vy = .18, drag = false, lx = 0, ly = 0, on = false;
  const frame = () => {
    if (!on) return;
    if (!drag) { ay += vy; ax = Math.max(-60, Math.min(60, ax + vx)); vy += (.18 - vy) * .025; vx *= .92; }
    rot.style.transform = `rotateX(${ax}deg) rotateY(${ay}deg)`;
    requestAnimationFrame(frame);
  };
  whileVisible(orb, () => { if (!on) { on = true; frame(); } }, () => { on = false; }, 0);
  let lastMove = 0;
  orb.addEventListener('pointerdown', e => { drag = true; vx = vy = 0; lx = e.clientX; ly = e.clientY; lastMove = performance.now(); orb.setPointerCapture(e.pointerId); e.preventDefault(); });
  orb.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    ay += dx * .45; ax = Math.max(-60, Math.min(60, ax - dy * .35));
    vy = vy * .4 + dx * .45 * .6; vx = vx * .4 - dy * .35 * .6;
    lx = e.clientX; ly = e.clientY; lastMove = performance.now();
  });
  const up = () => { if (performance.now() - lastMove > 90) { vx = 0; vy = .18; } drag = false; };
  orb.addEventListener('pointerup', up); orb.addEventListener('pointercancel', up);
}

/* ---------- dancing letters ---------- */
function setupScramble() {
  const el = $('#scramble'), word = 'I love you';
  const jumble = s => { const a = [...s]; for (let k = 0; k < 2; k++) { const i = 2 + Math.floor(Math.random() * 3), j = i + 1; [a[i], a[j]] = [a[j], a[i]]; } const b = a.join(''); return b.slice(0, 7) + [...b.slice(7)].reverse().join(''); };
  let t = null;
  whileVisible(el, () => {
    if (t) return;
    let flip = 0;
    t = setInterval(() => {
      flip++;
      const txt = flip % 3 === 0 ? word : jumble(word);
      gsap.to(el, { opacity: 0, y: -6, duration: .18, onComplete: () => { el.textContent = txt; gsap.to(el, { opacity: 1, y: 0, duration: .3 }); } });
    }, 1100);
  }, () => { clearInterval(t); t = null; el.textContent = word; });
}

/* ---------- horizontal wall ---------- */
function setupWall() {
  const track = $('#wallTrack');
  gsap.to(track, {
    x: () => -(track.scrollWidth - innerWidth), ease: 'none',
    scrollTrigger: { trigger: '#wall', start: 'top top', end: () => '+=' + track.scrollWidth, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
  });
}

/* ---------- night ritual (Telegram) ---------- */
function setupNight() {
  const SO = n => Array(n).fill(0).map((_, i) => 'SO' + 'O'.repeat(i % 2 ? 4 : 18)).join(' ');
  const hers = `I LOVE YOU ${SO(14)} MUCH`;
  const mine = `I LOVE YOU ${Array(42).fill('SOOOOO').join(' ')} MUCH BABY MY BABA MY WIFE MY EVERYTHING MY CUTENESS AGRESSION WANNA SQUEEZE YOU SOOOOOO SOOOOO SOOOOO MUCH`;
  const steps = [
    ['me', 'say the things and send st', '11:52 PM'],
    ['her loud', hers, '11:52 PM'],
    ['me loud', mine, '11:53 PM'],
    ['her', '📱 <i>screen time sent</i>', '11:53 PM'],
    ['me', 'say goodnight', '11:54 PM'],
    ['her', 'goodnight betu 🤍', '11:54 PM'],
    ['me', 'goodnight baba 🤍', '11:54 PM'],
    ['me', 'lemme carry you', '11:55 PM'],
    ['stme', 21], ['stme', 40],
    ['me', '2 stickers and go', '11:55 PM'],
    ['sther', 62], ['sther', 56],
    ['pill', 'Baba is asleep 💤'],
  ];
  const body = $('#phBody'), status = $('#phStatus');
  const els = steps.map(([k, v, t]) => {
    let el;
    if (k.startsWith('st')) { el = new Image(); el.src = `img/s/${v}.webp`; el.className = 'tst ' + k.slice(2); }
    else if (k === 'pill') { el = document.createElement('div'); el.className = 'tpill'; el.textContent = v; }
    else { el = document.createElement('div'); el.className = 'tb ' + k; el.innerHTML = v; el.dataset.t = t; }
    return el;
  });
  let shown = 0;
  const render = n => {
    if (n === shown) return;
    while (shown < n) { const el = els[shown++]; body.append(el); gsap.fromTo(el, { opacity: 0, y: 24, scale: .92 }, { opacity: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(1.6)' }); }
    while (shown > n) { els[--shown].remove(); }
    status.textContent = n >= els.length ? 'last seen just now' : n % 2 ? 'typing…' : 'online';
  };
  ScrollTrigger.create({
    trigger: '#night', start: 'top top', end: '+=' + (els.length * 55) + '%', pin: true, scrub: true, anticipatePin: 1,
    onUpdate: s => render(Math.min(els.length, Math.floor(s.progress * (els.length + .6)))),
  });
}

/* ---------- night call: timer + lyrics ---------- */
const LYRIC_AT = [4.0, 7.2, 9.6, 13.6, 16.8, 19.2]; // when each line starts in ritual.m4a
function setupLyrics() {
  const lines = $$('#lyrics span'), timer = $('#callT');
  let lastLine = -2;
  gsap.ticker.add(() => {
    const a = music.ritualAudio; if (!a) return;
    let k = -1; LYRIC_AT.forEach((t, j) => { if (a.currentTime >= t) k = j; });
    if (k === lastLine) return; lastLine = k;
    lines.forEach((l, j) => l.classList.toggle('on', j === k));
  });
  let i = 0, secs = 3127, iv = null;
  whileVisible($('.call'), () => {
    music.ritual(true);
    if (iv) return;
    iv = setInterval(() => {
      secs++; timer.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      if (music.ritualAudio) return;
      if (secs % 2 === 0) { lines.forEach(l => l.classList.remove('on')); lines[i % lines.length].classList.add('on'); i++; }
    }, 1000);
  }, () => { music.ritual(false); clearInterval(iv); iv = null; });
}

/* ---------- promise deck ---------- */
const MY_PROMISES = [
  'I promise to be better, baby, to be calmer with you, and to always take care of you.',
  "I promise not to be defensive, and to always be understanding of you.",
  'I promise to be healthy, and more careful in general with everything.',
  'I promise to be gentler.',
  'I promise to love you more.',
  'I promise to care about you more.',
  'I promise to appreciate you more.',
  'I promise to always support your every dream, and help you with everything.',
  'I promise to always protect you from every harm, and anything and everything bad.',
  'I promise to always be with you, and always by your side.',
  'I promise to make enough money so you can waste it on cosmetics, stickers and claw clips…',
  'I promise to always watch your booger videos, and adore them.',
  'I promise to always love you, my baba.',
];
function setupDeck() {
  const deck = $('#deck');
  const build = () => {
    deck.innerHTML = '';
    const end = document.createElement('div');
    end.className = 'pc pc-end';
    end.innerHTML = `<span class="pc-n">AND</span><p class="pc-t">so many more, that I'll keep making to you as we go.</p><span class="pc-f"><span>— Betu</span><button class="pc-again" style="font:inherit;color:var(--accent)">again ↺</button></span>`;
    deck.append(end);
    $('.pc-again', end).addEventListener('click', e => { e.stopPropagation(); build(); });
    [...MY_PROMISES].reverse().forEach((p, ri) => {
      const i = MY_PROMISES.length - 1 - ri;
      const c = document.createElement('div');
      c.className = 'pc';
      c.innerHTML = `<span class="pc-n">PROMISE ${String(i + 1).padStart(2, '0')} / ${MY_PROMISES.length}</span><p class="pc-t">${p}</p><span class="pc-f"><span>♡</span><span>Betu</span></span>`;
      deck.append(c);
    });
    const cards = $$('.pc', deck);
    cards.forEach((c, k) => { const d = cards.length - 1 - k; gsap.set(c, { y: Math.min(d, 3) * 14, scale: 1 - Math.min(d, 3) * .04, rotate: d ? (d % 2 ? 2 : -2) : 0 }); });
    const top = () => cards.filter(c => c.isConnected && !c.classList.contains('pc-end')).pop();
    const restack = () => { const live = cards.filter(c => c.isConnected); live.forEach((c, k) => { const d = live.length - 1 - k; gsap.to(c, { y: Math.min(d, 3) * 14, scale: 1 - Math.min(d, 3) * .04, rotate: d ? (d % 2 ? 2 : -2) : 0, duration: .5, ease: 'power3.out' }); }); };
    let sx = 0, sy = 0, cur = null;
    deck.onpointerdown = e => { cur = top(); if (!cur || !cur.contains(e.target)) { cur = null; return; } sx = e.clientX; sy = e.clientY; cur.setPointerCapture(e.pointerId); };
    deck.onpointermove = e => { if (!cur) return; const dx = e.clientX - sx, dy = e.clientY - sy; gsap.set(cur, { x: dx, y: dy * .4, rotate: dx * .06 }); };
    deck.onpointerup = deck.onpointercancel = e => {
      if (!cur) return;
      const dx = e.clientX - sx, c = cur; cur = null;
      if (Math.abs(dx) > 70 || (Math.abs(dx) < 6 && e.type === 'pointerup')) {
        const dir = Math.abs(dx) > 6 ? Math.sign(dx) : 1;
        gsap.to(c, { x: dir * innerWidth * 1.1, rotate: dir * 28, opacity: 0, duration: .55, ease: 'power2.in', onComplete: () => { c.remove(); restack(); } });
        $('#deckHint').textContent = 'swipe or tap';
      } else gsap.to(c, { x: 0, y: 0, rotate: 0, duration: .6, ease: 'elastic.out(1,.6)' });
    };
  };
  build();
}

/* ---------- her promise box → image ---------- */
function setupPromiseBox() {
  const ta = $('#pText'), out = $('#pOut'), img = $('#pImg'), save = $('#pSave'), share = $('#pShare');
  let blob = null;
  try { ta.value = localStorage.getItem('baba-promises') || ''; } catch (e) {}
  ta.addEventListener('input', () => { try { localStorage.setItem('baba-promises', ta.value); } catch (e) {} });
  $('#pMake').addEventListener('click', async () => {
    const text = ta.value.trim();
    if (!text) { gsap.fromTo(ta, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)' }); ta.focus(); return; }
    $('#pMake').textContent = 'sealing…';
    blob = await drawPromises(text);
    const url = URL.createObjectURL(blob);
    img.src = url; save.href = url;
    out.hidden = false;
    $('#pMake').textContent = 'seal again ♡';
    S.burst();
    gsap.from(img, { scale: .85, opacity: 0, rotate: -3, duration: 1.2, ease: 'expo.out' });
    setTimeout(() => lenis.scrollTo(out, { offset: -40, duration: 1.4 }), 200);
  });
  share.addEventListener('click', async () => {
    if (!blob) return;
    const file = new File([blob], 'promises-for-betu.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: 'my promises to you, betu 💗' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    save.click();
  });
}

const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
async function drawPromises(text) {
  await Promise.all(['300 italic 90px Fraunces', '400 40px Fraunces', '500 30px "DM Sans"', '700 60px Caveat'].map(f => document.fonts.load(f).catch(() => {})));
  const [st1, st2, st3] = await Promise.all([loadImg('img/s/52.webp'), loadImg('img/s/69.webp'), loadImg('img/s/66.webp')]);
  const W = 1080, H = 1440, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#fff3f6'); g.addColorStop(.55, '#fde1e9'); g.addColorStop(1, '#f6c3d3');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const rx = Math.random() * W, ry = Math.random() * H, rr = 20 + Math.random() * 90;
    const rg = x.createRadialGradient(rx, ry, 0, rx, ry, rr); rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(rx, ry, rr, 0, 7); x.fill();
  }
  const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
  x.save(); x.shadowColor = 'rgba(150,40,80,.18)'; x.shadowBlur = 50; x.shadowOffsetY = 20;
  rr(56, 210, W - 112, H - 330, 48); x.fillStyle = 'rgba(255,253,250,.92)'; x.fill(); x.restore();
  x.strokeStyle = 'rgba(217,79,120,.25)'; x.lineWidth = 2; rr(76, 230, W - 152, H - 370, 36); x.stroke();

  x.textAlign = 'center'; x.fillStyle = '#d94f78';
  x.font = '500 26px "DM Sans"'; x.letterSpacing = '8px';
  x.fillText('15 MONTHS · 9 NOVEMBER 2026', W / 2, 92); x.letterSpacing = '0px';
  x.fillStyle = '#3a1c2a'; x.font = '300 italic 92px Fraunces'; x.fillText("Baba's promises", W / 2, 180);
  x.fillStyle = '#d94f78'; x.font = '700 64px Caveat'; x.fillText('to my Betu ♡', W / 2, 310);

  let lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 1 && !lines.every(l => /^\d+[.)]/.test(l))) lines = lines.map((l, i) => `${i + 1}. ${l.replace(/^\d+[.)]\s*/, '')}`);
  const top = 370, bottom = H - 250, maxW = W - 280;
  let size = 54, laid, hgt = 0;
  const layout = s => {
    x.font = `400 ${s}px Fraunces`;
    const out = [];
    lines.forEach(l => {
      const words = l.split(' '); let cur = '';
      words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; });
      out.push(cur); out.push(null);
    });
    out.pop();
    return out;
  };
  for (; size >= 18; size -= 2) { laid = layout(size); hgt = laid.reduce((h, l) => h + (l === null ? size * .7 : size * 1.42), 0); if (hgt <= bottom - top) break; }
  x.textAlign = 'left'; x.fillStyle = '#3a1c2a';
  let y = top + size + Math.max(0, (bottom - top - hgt) * .35);
  laid.forEach(l => { if (l === null) { y += size * .7; return; } x.fillText(l, 140, y); y += size * 1.42; });

  x.textAlign = 'right'; x.fillStyle = '#d94f78'; x.font = '700 58px Caveat';
  x.fillText('— forever yours, Baba', W - 130, H - 170);
  const drawSt = (im, X, Y, s, r) => { if (!im) return; x.save(); x.translate(X, Y); x.rotate(r); x.shadowColor = 'rgba(80,20,40,.3)'; x.shadowBlur = 24; x.shadowOffsetY = 10; rr(-s / 2, -s / 2, s, s, 28); x.clip(); x.drawImage(im, -s / 2, -s / 2, s, s); x.restore(); };
  drawSt(st1, W - 120, 250, 190, .12);
  if (st2) { x.save(); x.globalAlpha = .95; x.drawImage(st2, 30, H - 250, 220, 220); x.restore(); }
  drawSt(st3, 150, 230, 150, -.14);
  x.textAlign = 'center'; x.fillStyle = 'rgba(58,28,42,.45)'; x.font = '500 22px "DM Sans"';
  x.fillText('ngya chit thu · main tumse pyaar karti hoon', W / 2, H - 50);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ---------- counters ---------- */
function setupStats() {
  $$('[data-count]').forEach(b => {
    const end = +b.dataset.count, suf = b.dataset.suffix || '', o = { v: 0 };
    ScrollTrigger.create({ trigger: b, start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => b.textContent = Math.round(o.v) + suf }) });
  });
}

/* ---------- rose bloom ---------- */
function setupRose() {
  const st = { o: 0 };
  gsap.timeline({ scrollTrigger: { trigger: '#rose', start: 'top top', end: '+=170%', pin: true, scrub: 1, anticipatePin: 1 } })
    .to(st, { o: .5, ease: 'none', onUpdate: () => S.set({ open: st.o }) })
    .fromTo('.rose-cap', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .3 }, .55)
    .fromTo('.rose-stage .h', { letterSpacing: '.15em', opacity: .3 }, { letterSpacing: '-.02em', opacity: 1, duration: .6 }, 0);
}

/* ---------- final I LOVE YOU SOOOO ---------- */
function setupILY() {
  const so = $('#ilySo'), N = 42;
  so.innerHTML = Array(N).fill(0).map(() => '<span style="display:inline-block;opacity:0">SOOOOO&nbsp;</span>').join('');
  gsap.set(['.ily-a', '.ily-b', '.ily-tail'], { opacity: 0, y: 20 });
  ScrollTrigger.create({
    trigger: '#ily', start: 'top 75%', once: true,
    onEnter: () => {
      const tl = gsap.timeline();
      tl.to('.ily-a', { opacity: 1, y: 0, duration: .8, ease: 'expo.out' })
        .to($$('span', so), { opacity: 1, duration: .01, stagger: .045 })
        .fromTo('.ily-b', { scale: 2.4 }, { opacity: 1, y: 0, scale: 1, duration: .9, ease: 'elastic.out(1,.5)' })
        .to('.ily-tail', { opacity: 1, y: 0, duration: 1 })
        .add(() => S.burst());
    },
  });
}

if (reduced) gsap.globalTimeline.timeScale(3);
