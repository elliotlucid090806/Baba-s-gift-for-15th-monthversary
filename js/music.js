const SONGS = [
  { t: 'Ae Dil Hai Mushkil', a: 'Arijit Singh', src: 'audio/songs/1.m4a', c: ['#f7a8bf', '#b8325c'] },
  { t: 'Alag Aasmaan', a: 'Anuv Jain', src: 'audio/songs/2.m4a', c: ['#ffd9c2', '#e0708f'] },
  { t: 'Maula Mere Maula', a: 'Roop Kumar Rathod', src: 'audio/songs/3.m4a', c: ['#f3c4e4', '#8d3b7a'] },
  { t: 'Paaro', a: 'Aditya Rikhari', src: 'audio/songs/4.m4a', c: ['#fbe0e8', '#d0577d'] },
  { t: 'Those Eyes', a: 'New West', src: 'audio/songs/5.m4a', c: ['#e6d3f5', '#9a4f8f'] },
];
const BASE = .6, RIT_SRC = 'audio/ritual.m4a';
const $ = (s, r = document) => r.querySelector(s);
const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';

export function createMusic() {
  const bg = new Audio(), rit = new Audio();
  bg.preload = 'none'; rit.preload = 'none'; rit.loop = true;
  let order = [], pos = 0, cur = -1, loop = false, wantPlay = false, inRitual = false, duck = 1, hasRit = false;
  fetch(RIT_SRC, { method: 'HEAD' }).then(r => { hasRit = r.ok; if (hasRit) rit.src = RIT_SRC; }).catch(() => {});

  const fade = (el, to, dur, done) => gsap.to(el, { volume: to, duration: dur, overwrite: true, ease: 'sine.inOut', onComplete: done });
  const shuffled = avoid => {
    const a = SONGS.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a[0] === avoid) [a[0], a[1]] = [a[1], a[0]];
    return a;
  };

  /* ---------- UI ---------- */
  const btn = document.createElement('button');
  btn.className = 'mbtn'; btn.hidden = true; btn.setAttribute('aria-label', 'Our songs');
  btn.innerHTML = '<span class="eq"><i></i><i></i><i></i><i></i></span><svg class="note" viewBox="0 0 24 24"><path d="M9 18.5a2.5 2.5 0 1 1-2-2.45V5l11-2v12.5a2.5 2.5 0 1 1-2-2.45V7.1L9 8.4z"/></svg>';
  const panel = document.createElement('div');
  panel.className = 'mpanel'; panel.hidden = true; panel.setAttribute('data-lenis-prevent', '');
  panel.innerHTML = `
    <div class="mp-head"><span class="mp-title">our songs</span>
      <button class="mp-loop" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4V7H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5h10zM7 22l-4-4 4-4v3h10a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7z"/></svg><span>loop</span></button>
      <button class="mp-x" aria-label="Close">×</button></div>
    <div class="mp-cards">${SONGS.map((s, i) => `
      <button class="mp-card" data-i="${i}" style="--c1:${s.c[0]};--c2:${s.c[1]}">
        <span class="mp-art"><span class="mp-vinyl"></span><span class="mp-ini">${s.t[0]}</span><span class="mp-eq eq"><i></i><i></i><i></i><i></i></span></span>
        <b>${s.t}</b><small>${s.a}</small></button>`).join('')}</div>
    <div class="mp-now"><div><b class="mp-nt"></b><small class="mp-na"></small></div><span class="mp-mode">shuffle</span></div>
    <div class="mp-bar"><i></i></div><div class="mp-times"><span class="mp-t0">0:00</span><span class="mp-t1">0:00</span></div>
    <div class="mp-ctrl">
      <button class="mp-prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>
      <button class="mp-play" aria-label="Play"><svg class="i-play" viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg></button>
      <button class="mp-next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button>
    </div>`;
  document.body.append(btn, panel);
  const cards = [...panel.querySelectorAll('.mp-card')], bar = $('.mp-bar i', panel), loopBtn = $('.mp-loop', panel);

  const playing = () => !bg.paused && !inRitual;
  function ui() {
    const p = wantPlay && !inRitual;
    btn.classList.toggle('on', p); panel.classList.toggle('on', p);
    cards.forEach((c, i) => c.classList.toggle('cur', i === cur));
    if (cur >= 0) { $('.mp-nt', panel).textContent = SONGS[cur].t; $('.mp-na', panel).textContent = SONGS[cur].a; }
    $('.mp-mode', panel).textContent = loop ? 'on repeat' : 'shuffle';
    loopBtn.classList.toggle('act', loop); loopBtn.setAttribute('aria-pressed', loop);
  }
  function session() {
    if (!('mediaSession' in navigator) || cur < 0) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: SONGS[cur].t, artist: SONGS[cur].a, album: 'for baba ♡', artwork: [{ src: 'img/s/69.webp', sizes: '512x512', type: 'image/webp' }] });
  }

  /* ---------- playback ---------- */
  function play() {
    wantPlay = true; ui();
    if (inRitual) return;
    if (bg.paused) { bg.volume = 0; bg.play().catch(() => {}); }
    fade(bg, BASE * duck, 1.6);
  }
  function pause() { wantPlay = false; ui(); fade(bg, 0, .5, () => bg.pause()); }
  function load(i) {
    cur = i; bg.src = SONGS[i].src; bg.loop = loop; bar.style.width = '0%';
    ui(); session();
    const card = cards[i]; card.parentElement.scrollTo({ left: card.offsetLeft - 18, behavior: 'smooth' });
    if (wantPlay) { bg.pause(); play(); }
  }
  function next() {
    if (++pos >= order.length) { order = shuffled(cur); pos = 0; }
    load(order[pos]);
  }
  function prev() {
    if (bg.currentTime > 3 || pos === 0) { bg.currentTime = 0; return; }
    load(order[--pos]);
  }
  function pick(i) {
    if (i === cur) { wantPlay ? pause() : play(); return; }
    const k = order.indexOf(i);
    order.splice(k, 1);
    if (k < pos) pos--;
    order.splice(pos + 1, 0, i);
    wantPlay = true; pos++; load(i);
  }
  bg.addEventListener('ended', next);
  bg.addEventListener('timeupdate', () => {
    if (!bg.duration) return;
    bar.style.width = (bg.currentTime / bg.duration * 100) + '%';
    $('.mp-t0', panel).textContent = fmt(bg.currentTime); $('.mp-t1', panel).textContent = fmt(bg.duration);
  });

  /* ---------- controls ---------- */
  btn.addEventListener('click', e => { e.stopPropagation(); panel.hidden ? openPanel() : closePanel(); });
  function openPanel() { panel.hidden = false; gsap.fromTo(panel, { opacity: 0, y: -12, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'expo.out' }); }
  function closePanel() { gsap.to(panel, { opacity: 0, y: -8, duration: .25, onComplete: () => { panel.hidden = true; } }); }
  $('.mp-x', panel).addEventListener('click', closePanel);
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) closePanel(); });
  $('.mp-play', panel).addEventListener('click', () => wantPlay ? pause() : play());
  $('.mp-next', panel).addEventListener('click', () => { wantPlay = true; next(); });
  $('.mp-prev', panel).addEventListener('click', () => { wantPlay = true; prev(); play(); });
  cards.forEach(c => c.addEventListener('click', () => pick(+c.dataset.i)));
  loopBtn.addEventListener('click', () => { loop = !loop; bg.loop = loop; ui(); });
  $('.mp-bar', panel).addEventListener('click', e => {
    if (!bg.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    bg.currentTime = (e.clientX - r.left) / r.width * bg.duration;
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('nexttrack', () => { wantPlay = true; next(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { wantPlay = true; prev(); });
  }

  return {
    get audio() { return bg; },
    get ritualAudio() { return hasRit && inRitual ? rit : null; },
    start() {
      btn.hidden = false;
      gsap.from(btn, { scale: 0, rotate: -90, duration: 1, ease: 'back.out(2)', delay: 1.2 });
      order = shuffled(-1); pos = 0; wantPlay = true; load(order[0]);
    },
    // a video was unmuted/muted: keep the music underneath it
    duckFor(v) {
      v.addEventListener('volumechange', () => {
        duck = v.muted ? 1 : .12;
        if (playing()) fade(bg, BASE * duck, .8);
      });
    },
    // Betu's own song takes over while the night-call section is on screen
    ritual(on) {
      if (!hasRit || on === inRitual) return;
      inRitual = on; ui();
      if (on) {
        fade(bg, 0, 1.2, () => bg.pause());
        rit.currentTime = 0; rit.volume = 0; rit.play().catch(() => {});
        fade(rit, .95, 1.6);
      } else {
        fade(rit, 0, 1.2, () => rit.pause());
        if (wantPlay) play();
      }
    },
  };
}
