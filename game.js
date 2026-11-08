// ============================================================
//  Birthday Adventure - a tiny 2D platformer. No libraries.
//  Sections: setup, input, audio, level loading, physics,
//  update, drawing, menus, main loop.
// ============================================================
(() => {
'use strict';

const CFG = window.CONFIG;
const LEVELS = window.LEVELS;

const TILE = 32, VW = 640, VH = 384, ROWS = 12;
const STEP_MS = 1000 / 60;

// ---- feel / physics ------------------------------------------------
const GRAVITY = 0.5, MAX_FALL = 11;
const RUN = 3.1, ACC_GROUND = 0.6, ACC_AIR = 0.38;
const JUMP_V = 10.6, AIR_JUMP_V = 10.0, SPRING_V = 15.5;
const COYOTE = 7, JUMP_BUFFER = 7;
const GLIDE_FALL = 1.3;
const SHOT_SPEED = 6.5, SHOT_LIFE = 55, SHOT_COOLDOWN = 16;

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (a, n) => ((a % n) + n) % n;
const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

document.title = `Happy ${ordinal(CFG.age)} Birthday ${CFG.name}!`;

// ---- canvas --------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() {
  const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  const S = clamp(Math.round(scale * (window.devicePixelRatio || 1)), 1, 4);
  canvas.width = VW * S; canvas.height = VH * S;
  canvas.style.width = Math.floor(VW * scale) + 'px';
  canvas.style.height = Math.floor(VH * scale) + 'px';
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---- themes --------------------------------------------------------
// Colours taken straight from Azaan's sprite (navy jacket, denim, sky-blue shirt,
// cream collar, tractor-logo red/orange/green, lime shoe stripes, ink outline).
const INK = '#2b1b3a', NIGHT = '#1a1222', NAVY = '#253878', DENIM = '#3f6fb4', SKY = '#62b8ea', CREAM = '#f5f1e8';
const RED = '#e5483a', ORANGE = '#f0a03c', GREEN = '#3fae5a', LIME = '#9be05a';
const THEMES = {
  garden: { sky: [SKY, '#e8f5ff'], far: '#a6dca4', near: '#7cc47f', body: '#8a5a3a', body2: '#9d6a45', frost: LIME, stars: false },
  candy:  { sky: ['#f6a96b', '#fff0dc'], far: '#f3c39c', near: '#e9996f', body: '#d9603f', body2: '#e6704c', frost: CREAM, stars: false },
  cake:   { sky: ['#141a3c', '#e9855f'], far: '#3f4f96', near: '#2a376f', body: '#5e3a2e', body2: '#704838', frost: ORANGE, stars: true },
};
const PARTY = [RED, ORANGE, SKY, GREEN, LIME, CREAM];
const RAINBOW = [RED, ORANGE, CREAM, SKY, LIME];

// ====================================================================
//  INPUT
// ====================================================================
const kb = { left: false, right: false, jump: false };
const tch = { left: false, right: false, jump: false, power: false };
const edge = { jump: false, shoot: false };

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyX: 'shoot', KeyZ: 'shoot', KeyJ: 'shoot', ShiftLeft: 'shoot', ShiftRight: 'shoot',
};
window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  initAudio();
  if (state !== 'play') { if (!e.repeat) advance(); e.preventDefault(); return; }
  if (!k) return;
  e.preventDefault();
  if (k === 'shoot') { if (!e.repeat) edge.shoot = true; return; }
  if (k === 'jump' && !kb.jump) edge.jump = true;
  kb[k] = true;
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k && k !== 'shoot') kb[k] = false;
});
window.addEventListener('blur', () => { kb.left = kb.right = kb.jump = false; tch.left = tch.right = tch.jump = false; });

// touch / pointer buttons
const $ = (id) => document.getElementById(id);
// touch controls: shown on any touch device (also forced with ?touch=1, or toggled with the T key on a computer)
const showTouch = () => document.body.classList.add('touch');
if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || (window.matchMedia && matchMedia('(pointer: coarse), (hover: none)').matches) || (typeof location !== "undefined" && /[?&]touch=1/.test(location.search))) showTouch();
window.addEventListener('touchstart', showTouch, { passive: true });
window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') showTouch(); }, { passive: true });
window.addEventListener('keydown', (e) => { if (e.key === 't' || e.key === 'T') document.body.classList.toggle('touch'); });

function bindHold(el, onDown, onUp) {
  const down = (e) => { e.preventDefault(); initAudio(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) {} onDown(e); };
  const up = (e) => { e.preventDefault(); el.classList.remove('down'); onUp(e); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
// d-pad: one element, slide a thumb between left and right
const dpad = $('dpad');
function dpadUpdate(e) {
  const r = dpad.getBoundingClientRect();
  const x = e.clientX - r.left;
  tch.left = x < r.width / 2;
  tch.right = !tch.left;
  $('btnLeft').classList.toggle('down', tch.left);
  $('btnRight').classList.toggle('down', tch.right);
}
dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); try { dpad.setPointerCapture(e.pointerId); } catch (_) {} dpadUpdate(e); });
dpad.addEventListener('pointermove', (e) => { if (tch.left || tch.right) dpadUpdate(e); });
const dpadEnd = (e) => { tch.left = tch.right = false; $('btnLeft').classList.remove('down'); $('btnRight').classList.remove('down'); };
dpad.addEventListener('pointerup', dpadEnd);
dpad.addEventListener('pointercancel', dpadEnd);
dpad.addEventListener('lostpointercapture', dpadEnd);
dpad.addEventListener('contextmenu', (e) => e.preventDefault());

bindHold($('btnJump'), () => { tch.jump = true; edge.jump = true; }, () => { tch.jump = false; });
bindHold($('btnPower'), () => { edge.shoot = true; }, () => {});

// tap anywhere to continue on menu screens
window.addEventListener('pointerdown', (e) => {
  initAudio();
  if (state !== 'play' && !(e.target.closest && e.target.closest('#mute'))) advance();
});
$('mute').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); setMuted(!muted); });

// ====================================================================
//  AUDIO (all synthesised, no files needed)
// ====================================================================
let ac = null, master = null, muted = false;
try { muted = localStorage.getItem('bday-muted') === '1'; } catch (_) {}
function initAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ac.destination);
    startMusic();
  }
  if (ac.state === 'suspended') ac.resume();
}
function setMuted(m) {
  muted = m;
  try { localStorage.setItem('bday-muted', m ? '1' : '0'); } catch (_) {}
  if (master) master.gain.value = m ? 0 : 0.8;
  $('mute').textContent = m ? '\u{1F507}' : '\u{1F50A}';
}
setMuted(muted);

function tone(f0, dur, type = 'square', vol = 0.1, f1 = null, t = null) {
  if (!ac) return;
  t = t == null ? ac.currentTime : t;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}
const hz = (semi) => 261.63 * Math.pow(2, semi / 12); // semitones above middle C
const SFX = {
  jump:    () => tone(330, 0.14, 'square', 0.08, 700),
  air:     () => tone(480, 0.16, 'square', 0.08, 960),
  gift:    () => { tone(880, 0.07, 'square', 0.07); tone(1320, 0.12, 'square', 0.07, null, ac && ac.currentTime + 0.06); },
  stomp:   () => tone(220, 0.14, 'triangle', 0.16, 70),
  shoot:   () => tone(1100, 0.1, 'sawtooth', 0.05, 300),
  pop:     () => tone(600, 0.12, 'triangle', 0.12, 120),
  hurt:    () => tone(300, 0.3, 'sawtooth', 0.08, 80),
  spring:  () => tone(200, 0.25, 'sine', 0.2, 900),
  check:   () => [0, 4, 7, 12].forEach((s, i) => tone(hz(s + 12), 0.12, 'triangle', 0.1, null, ac && ac.currentTime + i * 0.07)),
  fanfare: () => [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(hz(s + 12), 0.22, 'square', 0.08, null, ac && ac.currentTime + i * 0.11)),
  cupcake: () => { tone(660, 0.08, 'triangle', 0.12); tone(990, 0.12, 'triangle', 0.12, null, ac && ac.currentTime + 0.07); },
  star:    () => [1047, 1319, 1568].forEach((f, i) => tone(f, 0.1, 'square', 0.05, null, ac && ac.currentTime + i * 0.05)),
  letter:  (k) => { const n = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][(k || 0) % 10] + 12; tone(hz(n), 0.12, 'triangle', 0.14); tone(hz(n + 12), 0.2, 'square', 0.05, null, ac && ac.currentTime + 0.06); },
  nameDone: () => [0, 4, 7, 12, 16, 19, 24].forEach((st, i) => tone(hz(st + 12), 0.2, 'square', 0.07, null, ac && ac.currentTime + i * 0.08)),
  unlock:  () => [7, 12, 16, 19, 24].forEach((s, i) => tone(hz(s), 0.18, 'triangle', 0.12, null, ac && ac.currentTime + i * 0.09)),
};
function sfx(name, arg) { if (ac && !muted) SFX[name](arg); }

// chiptune background loop (C - Am - F - G)
const CHORDS = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
const M_STEP = 60 / 132 / 2;
let musicTimer = null, nextNote = 0, mStep = 0;
function scheduleMusic() {
  if (!ac) return;
  while (nextNote < ac.currentTime + 0.3) {
    const chord = CHORDS[Math.floor(mStep / 8) % 4], i = mStep % 8;
    tone(hz(chord[ARP[i]] + 12), M_STEP * 0.9, 'square', 0.022, null, nextNote);
    if (i % 4 === 0) tone(hz(chord[0] - 12), M_STEP * 3.6, 'triangle', 0.06, null, nextNote);
    nextNote += M_STEP; mStep = (mStep + 1) % 32;
  }
}
function startMusic() { if (!ac || musicTimer) return; nextNote = ac.currentTime + 0.1; mStep = 0; musicTimer = setInterval(scheduleMusic, 100); }
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

// "Happy Birthday to You" (public domain) - [semitones above middle C, beats]
const HB = [[7, .75], [7, .25], [9, 1], [7, 1], [12, 1], [11, 2],
            [7, .75], [7, .25], [9, 1], [7, 1], [14, 1], [12, 2],
            [7, .75], [7, .25], [19, 1], [16, 1], [12, 1], [11, 1], [9, 2],
            [17, .75], [17, .25], [16, 1], [12, 1], [14, 1], [12, 3]];
function playBirthday() {
  if (!ac) return;
  let t = ac.currentTime + 0.3; const beat = 0.5;
  for (const [n, b] of HB) {
    tone(hz(n), b * beat * 0.95, 'square', 0.07, null, t);
    tone(hz(n - 12), b * beat * 0.95, 'triangle', 0.08, null, t);
    t += b * beat;
  }
  return t - ac.currentTime;
}

// ====================================================================
//  PLAYER SPRITE (real sheet if present, cute placeholder if not)
// ====================================================================
const DEFAULT_ANIM = { idle: [0, 1], run: [2, 3, 4, 5], jump: [6], fall: [7] };
const PLACEHOLDER_SP = { file: '', frameW: 64, frameH: 64, frames: 8, drawSize: 52, footPad: 2 };
let SP = CFG.sprite;
let AN = Object.assign({}, DEFAULT_ANIM, SP.anim || {});
let sheet = null; // set once the image has loaded
{
  const img = new Image();
  img.onload = () => { sheet = img; };
  img.onerror = () => { SP = PLACEHOLDER_SP; AN = DEFAULT_ANIM; sheet = makePlaceholderSheet(); };
  img.src = SP.file;
}
// which frame to show for an animation name at time t (in game ticks), at fps frames per second
const ANIM_FALLBACK = { jumpTop: 'jump', glide: 'fall', cheer2: 'cheer', cheer: 'jump', jump: 'idle', fall: 'jump' };
function animFrame(name, t, fps) {
  let a = AN[name];
  if (!a || !a.length) a = AN[ANIM_FALLBACK[name]] || AN.idle;
  if (!a || !a.length) a = AN.idle;
  return Math.min(a[Math.floor(t * fps / 60) % a.length], SP.frames - 1);
}
// draw one frame with its feet at `bottom`, centred on cx
function drawHero(f, cx, bottom, size, flip) {
  if (!sheet) return;
  const pad = SP.footPad * size / SP.frameH;
  ctx.save();
  ctx.translate(Math.round(cx), 0);
  if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, f * SP.frameW, 0, SP.frameW, SP.frameH, -size / 2, Math.round(bottom - size + pad), size, size);
  ctx.restore();
}
function makePlaceholderSheet() {
  const c = document.createElement('canvas');
  c.width = SP.frameW * SP.frames; c.height = SP.frameH;
  const g = c.getContext('2d');
  if (!g || !g.fillRect) return c;
  const u = SP.frameW / 16;
  for (let f = 0; f < SP.frames; f++) {
    const ox = f * SP.frameW;
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(ox + Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u)); };
    const bob = f === 1 ? 1 : 0;
    const air = f >= 6;
    const legSwing = f >= 2 && f <= 5 ? [0, 2, 0, -2][f - 2] : 0;
    // party hat
    px(7, 0 + bob, 2, 1, ORANGE); px(6, 1 + bob, 4, 1, '#ff4fa3'); px(5, 2 + bob, 6, 1, '#ff4fa3'); px(4, 3 + bob, 8, 1, '#ff7cc0');
    // head
    px(4, 4 + bob, 8, 5, '#f4c28f'); px(3.5, 4 + bob, 1, 3, '#3b2314'); px(11.5, 4 + bob, 1, 3, '#3b2314'); px(4, 4 + bob, 8, 1, '#3b2314');
    px(5.5, 6 + bob, 1.2, 1.4, '#222'); px(9.3, 6 + bob, 1.2, 1.4, '#222'); px(6.5, 8 + bob, 3, 0.6, '#c0392b');
    // body
    px(4.5, 9 + bob, 7, 3.4, '#3aa0ff'); px(4.5, 11 + bob, 7, 0.8, ORANGE);
    // arms
    if (air) { px(2.5, f === 6 ? 7 : 9, 2, 1.4, '#f4c28f'); px(11.5, f === 6 ? 7 : 9, 2, 1.4, '#f4c28f'); }
    else { px(3, 9.5 + bob, 1.6, 2.6, '#f4c28f'); px(11.4, 9.5 + bob, 1.6, 2.6, '#f4c28f'); }
    // legs
    if (air) { px(5, 12.4, 2.2, 2, '#2d3e8f'); px(8.8, 12.4, 2.2, 2, '#2d3e8f'); px(4.6, 14.2, 2.8, 1.4, '#fff'); px(8.6, 14.2, 2.8, 1.4, '#fff'); }
    else {
      px(5 - legSwing / 2, 12.4, 2.2, 2, '#2d3e8f'); px(8.8 + legSwing / 2, 12.4, 2.2, 2, '#2d3e8f');
      px(4.6 - legSwing / 2, 14.2, 2.8, 1.4, '#fff'); px(8.6 + legSwing / 2, 14.2, 2.8, 1.4, '#fff');
    }
  }
  return c;
}

// ====================================================================
//  GAME STATE
// ====================================================================
let state = 'title', stateT = 0;
let levelIndex = 0, L = null;
let gifts, enemies, springs, checks, shots, parts, finish, letters = [], lettersGot = 0;
let player, spawn, camX = 0, gotGifts = 0, oopsT = 0, animT = 0, worldT = 0;
const results = []; // gifts collected per level
let fx = [];        // screen-space confetti / fireworks
let winT = 0, nextFirework = 0, winMusicEnd = 0;
let banner = { text: '', t: 999, head: null }, msgBag = [], firstMsgDone = false;

const hasConfetti = () => levelIndex >= 1 || (LEVELS[levelIndex] && LEVELS[levelIndex].unlock === 'confetti');
const hasGlide = () => levelIndex >= 2;

const nameLetters = () => [...String(CFG.name).toUpperCase()].filter((ch) => /\S/.test(ch)).slice(0, 10);

function loadLevel(i) {
  levelIndex = i;
  const d = LEVELS[i];
  L = { def: d, w: d.width, theme: d.theme || 'garden', tiles: Array.from({ length: ROWS }, () => new Array(d.width).fill(0)) };
  for (const [a, b, top = 10] of d.ground) for (let c = a; c <= b; c++) for (let r = top; r < ROWS; r++) L.tiles[r][c] = 1;
  for (const [r, a, b] of d.blocks || []) for (let c = a; c <= b; c++) L.tiles[r][c] = 2;
  for (const [r, a, b] of d.plats || []) for (let c = a; c <= b; c++) if (!L.tiles[r][c]) L.tiles[r][c] = 3;

  gifts = d.gifts.map(([c, r], k) => ({ x: c * TILE + 4, y: r * TILE + 4, w: 24, h: 24, got: false, ph: k * 0.7, hue: k % 4 }));
  // the letters of his name: some presents (spread evenly along the level) become letter tiles
  const NAME = nameLetters(), picked = new Set();
  letters = []; lettersGot = 0;
  NAME.forEach((ch, k) => {
    const target = ((k + 1) / (NAME.length + 1)) * d.width * TILE;
    let best = -1, bd = 1e9;
    gifts.forEach((g, gi) => { if (g.x > 6 * TILE && !picked.has(gi)) { const dd = Math.abs(g.x - target); if (dd < bd) { bd = dd; best = gi; } } });
    if (best >= 0) { picked.add(best); const g = gifts[best]; letters.push({ x: g.x - 2, y: g.y - 2, w: 28, h: 28, ch, k, got: false, ph: k * 1.3 }); }
  });
  gifts = gifts.filter((_, gi) => !picked.has(gi));
  enemies = d.enemies.map(([c, r], k) => ({ x: c * TILE + 2, y: (r + 1) * TILE - 26, w: 28, h: 26, vx: 0, vy: 0, dir: k % 2 ? 1 : -1, alive: true, dead: 0, ph: k }));
  springs = (d.springs || []).map(([c, r]) => ({ x: c * TILE + 2, y: r * TILE + 14, w: 28, h: 18, sq: 0 }));
  checks = d.checkpoints.map(([c, r]) => ({ x: c * TILE + 8, y: (r + 1) * TILE - 64, w: 16, h: 64, active: false, col: c, row: r }));
  const [fc, fr] = d.finish;
  finish = { x: fc * TILE - 24, y: (fr + 1) * TILE - 96, w: 80, h: 96, cx: fc * TILE + 16, bottom: (fr + 1) * TILE };

  const [sc, sr] = d.start;
  player = { x: 0, y: 0, w: 20, h: 28, vx: 0, vy: 0, facing: 1, onGround: false, coyote: 0, buf: 0, jumpsLeft: 1, gliding: false, shootCd: 0, shootAnim: 0, invuln: 0 };
  spawn = { x: sc * TILE + (TILE - player.w) / 2, y: (sr + 1) * TILE - player.h };
  player.x = spawn.x; player.y = spawn.y;
  shots = []; parts = [];
  gotGifts = 0; oopsT = 0; banner.t = 999;
  camX = clamp(player.x - VW / 2, 0, L.w * TILE - VW);
  $('btnPower').classList.toggle('show', hasConfetti());
}

// ====================================================================
//  PHYSICS
// ====================================================================
const solidAt = (c, r) => {
  if (c < 0 || c >= L.w) return true;
  if (r < 0 || r >= ROWS) return false;
  const t = L.tiles[r][c]; return t === 1 || t === 2;
};
const platAt = (c, r) => c >= 0 && c < L.w && r >= 0 && r < ROWS && L.tiles[r][c] === 3;

function moveBody(b) {
  b.onGround = false; b.hitWall = false;
  // horizontal
  b.x += b.vx;
  if (b.vx !== 0) {
    const r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.h - 0.01) / TILE);
    const c = b.vx > 0 ? Math.floor((b.x + b.w - 0.01) / TILE) : Math.floor(b.x / TILE);
    for (let r = r0; r <= r1; r++) {
      if (solidAt(c, r)) { b.x = b.vx > 0 ? c * TILE - b.w : (c + 1) * TILE; b.hitWall = true; b.vx = 0; break; }
    }
  }
  // vertical
  const prevBottom = b.y + b.h;
  b.y += b.vy;
  const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 0.01) / TILE);
  if (b.vy >= 0) {
    const bottom = b.y + b.h, r = Math.floor((bottom - 0.01) / TILE);
    for (let c = c0; c <= c1; c++) {
      const solid = solidAt(c, r);
      const plat = platAt(c, r) && prevBottom <= r * TILE + 0.01;
      if ((solid || plat) && bottom > r * TILE) { b.y = r * TILE - b.h; b.vy = 0; b.onGround = true; break; }
    }
  } else {
    const r = Math.floor(b.y / TILE);
    for (let c = c0; c <= c1; c++) if (solidAt(c, r)) { b.y = (r + 1) * TILE; b.vy = 0; break; }
  }
}

// ====================================================================
//  EFFECTS
// ====================================================================
function burst(x, y, n, colors = PARTY, sp = 3, grav = 0.12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * sp;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 28 + Math.random() * 20, max: 48, c: colors[i % colors.length], s: 2 + Math.random() * 3, g: grav });
  }
}
function confettiRain(n) {
  for (let i = 0; i < n; i++) fx.push({ x: Math.random() * VW, y: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 1.2, vy: 1 + Math.random() * 1.8, c: PARTY[(Math.random() * PARTY.length) | 0], s: 4 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 400, max: 400, g: 0, conf: true });
}
function firework(x, y) {
  const col = PARTY[(Math.random() * PARTY.length) | 0], col2 = PARTY[(Math.random() * PARTY.length) | 0];
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, s = 1.4 + Math.random() * 2.2;
    fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 55 + Math.random() * 30, max: 85, c: i % 2 ? col : col2, s: 3, g: 0.04 });
  }
  tone(180 + Math.random() * 120, 0.35, 'triangle', 0.1, 60);
}
function stepParticles(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g || 0;
    if (p.conf) { p.vx += Math.sin((p.y + p.ph) / 20) * 0.02; p.r += p.vr; }
    if (--p.life <= 0 || p.y > VH + 20) list.splice(i, 1);
  }
}

// ====================================================================
//  UPDATE (60 times per second)
// ====================================================================
function update() {
  stateT++; worldT++;
  stepParticles(fx);
  if (state === 'title') { if (stateT % 14 === 0) confettiRain(2); camX += 0.6; }
  else if (state === 'complete') { if (stateT % 10 === 0) confettiRain(3); }
  else if (state === 'win') {
    winT++;
    if (winT % 8 === 0) confettiRain(3);
    if (winT >= nextFirework) { firework(80 + Math.random() * (VW - 160), 50 + Math.random() * 120); nextFirework = winT + 28 + Math.random() * 30; }
  }
  else if (state === 'play') updatePlay();
}

function nextMessage() {
  if (!msgBag.length) {
    msgBag = CFG.messages.slice();
    for (let i = msgBag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [msgBag[i], msgBag[j]] = [msgBag[j], msgBag[i]]; }
  }
  return msgBag.pop();
}
function showMessage(raw, head) { banner = { text: String(raw).replace(/\{name\}/g, CFG.name), t: 0, head: head || null }; }

function respawn() {
  player.x = spawn.x; player.y = spawn.y; player.vx = 0; player.vy = 0; player.invuln = 90; player.gliding = false;
  shots = [];
  camX = clamp(player.x - VW / 2, 0, L.w * TILE - VW);
}
function oops() { sfx('hurt'); oopsT = 70; burst(player.x + 10, player.y + 14, 12, ['#ffffff', ORANGE], 2.5); respawn(); }

function updatePlay() {
  const p = player;
  const left = kb.left || tch.left, right = kb.right || tch.right, jumpHeld = kb.jump || tch.jump;
  animT++; banner.t++; if (oopsT > 0) oopsT--; if (p.invuln > 0) p.invuln--; if (p.shootCd > 0) p.shootCd--; if (p.shootAnim > 0) p.shootAnim--;

  // --- horizontal
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (dir) p.facing = dir;
  const target = dir * RUN, acc = p.onGround ? ACC_GROUND : ACC_AIR;
  if (dir === 0 && p.onGround) p.vx = Math.abs(p.vx) < 0.5 ? 0 : p.vx - Math.sign(p.vx) * 0.5; // quick stop on ground
  else p.vx += clamp(target - p.vx, -acc, acc);

  // --- jump logic (coyote time + jump buffer make it forgiving)
  if (edge.jump) p.buf = JUMP_BUFFER;
  if (p.onGround) { p.coyote = COYOTE; p.jumpsLeft = 1; } else if (p.coyote > 0) p.coyote--;
  if (p.buf > 0) {
    p.buf--;
    if (p.coyote > 0) { p.vy = -JUMP_V; p.coyote = 0; p.buf = 0; p.onGround = false; sfx('jump'); p.held = 0; }
    else if (p.jumpsLeft > 0 && edge.jump) { p.vy = -AIR_JUMP_V; p.jumpsLeft--; p.buf = 0; sfx('air'); burst(p.x + 10, p.y + p.h, 8, ['#ffffff', '#cfefff'], 1.6, 0.05); }
  }
  edge.jump = false;

  // --- gravity (short tap = short hop, hold = high jump, glide = float)
  p.gliding = false;
  if (p.vy < 0 && !jumpHeld) p.vy += GRAVITY * 1.7; else p.vy += GRAVITY;
  if (hasGlide() && jumpHeld && p.vy > GLIDE_FALL && !p.onGround) { p.vy = GLIDE_FALL; p.gliding = true; }
  p.vy = Math.min(p.vy, MAX_FALL);

  moveBody(p);

  // --- confetti popper
  if (edge.shoot) {
    if (hasConfetti() && p.shootCd === 0) {
      p.shootCd = SHOT_COOLDOWN; p.shootAnim = 16; sfx('shoot');
      shots.push({ x: p.x + p.w / 2 + p.facing * 10, y: p.y + 12, w: 10, h: 10, vx: p.facing * SHOT_SPEED, life: SHOT_LIFE, r: 0 });
      burst(p.x + p.w / 2 + p.facing * 12, p.y + 12, 6, PARTY, 2, 0.08);
    }
    edge.shoot = false;
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.x += s.vx; s.r += 0.4;
    if (Math.random() < 0.7) parts.push({ x: s.x + 5, y: s.y + 5, vx: (Math.random() - 0.5), vy: Math.random() * 0.8, life: 16, max: 16, c: PARTY[(Math.random() * 6) | 0], s: 2, g: 0.05 });
    let dead = --s.life <= 0 || solidAt(Math.floor((s.x + 5) / TILE), Math.floor((s.y + 5) / TILE));
    for (const e of enemies) if (e.alive && !dead && overlap(s, e)) { killEnemy(e, false); dead = true; }
    if (dead) shots.splice(i, 1);
  }

  // --- enemies
  for (const e of enemies) {
    if (!e.alive) { if (e.dead > 0) e.dead--; continue; }
    // only simulate those near the camera
    if (e.x < camX - 200 || e.x > camX + VW + 200) continue;
    e.vx = e.dir * 0.8; e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
    moveBody(e);
    if (e.hitWall) e.dir *= -1;
    else if (e.onGround) {
      const ahead = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
      const c = Math.floor(ahead / TILE), r = Math.floor((e.y + e.h + 2) / TILE);
      if (!solidAt(c, r) && !platAt(c, r)) e.dir *= -1;
    }
    if (p.invuln === 0 && overlap(p, e)) {
      const stomp = p.vy > 0 && (p.y + p.h) < e.y + e.h * 0.65;
      if (stomp) { killEnemy(e, true); p.vy = jumpHeld ? -11.5 : -8; p.jumpsLeft = 1; }
      else oops();
    }
  }

  // --- springs
  for (const s of springs) {
    if (s.sq > 0) s.sq--;
    if (p.vy >= 0 && overlap(p, s) && p.y + p.h <= s.y + 14 + p.vy) { p.vy = -SPRING_V; s.sq = 14; p.jumpsLeft = 1; sfx('spring'); burst(s.x + 14, s.y, 10, PARTY, 2.5); }
  }

  // --- presents
  for (const g of gifts) {
    if (!g.got && overlap(p, g)) {
      g.got = true; gotGifts++;
      const it = itemType();
      sfx(it === 'present' ? 'gift' : it);
      burst(g.x + 12, g.y + 12, 10, ITEMS[it].burst, 2.4, 0.06);
    }
  }

  // --- letters of his name
  for (const l of letters) {
    if (!l.got && overlap(p, l)) {
      l.got = true; lettersGot++; sfx('letter', l.k);
      burst(l.x + 14, l.y + 14, 18, [ORANGE, CREAM, '#ffd84d', SKY], 2.8, 0.06);
      if (lettersGot === letters.length) {
        sfx('nameDone');
        showMessage(`You spelled ${nameLetters().join('')}! Bonus!`, 'BONUS!');
        burst(p.x + 10, p.y, 40, PARTY, 4.2, 0.1);
      }
    }
  }

  // --- checkpoints
  for (const c of checks) {
    if (!c.active && overlap(p, c)) {
      c.active = true; sfx('check'); burst(c.x + 8, c.y + 8, 14, [ORANGE, CREAM, SKY], 2.5, 0.05);
      spawn = { x: c.col * TILE + (TILE - p.w) / 2, y: (c.row + 1) * TILE - p.h };
      // a little note from the big brother
      let m;
      if (!firstMsgDone && CFG.firstMessage) { m = CFG.firstMessage; firstMsgDone = true; }
      else if (levelIndex === LEVELS.length - 1 && c === checks[checks.length - 1] && CFG.lastMessage) m = CFG.lastMessage;
      else m = nextMessage();
      showMessage(m);
    }
  }

  // --- fell in a pit
  if (p.y > ROWS * TILE + 60) oops();

  // --- goal
  if (overlap(p, finish)) completeLevel();

  stepParticles(parts);

  // --- camera
  const tx = clamp(p.x + p.w / 2 - VW / 2 + p.facing * 40, 0, L.w * TILE - VW);
  camX += (tx - camX) * 0.12;
}

function killEnemy(e, stomped) {
  e.alive = false; e.dead = 22;
  sfx(stomped ? 'stomp' : 'pop');
  burst(e.x + 14, e.y + 12, 14, [LIME, '#b6e07a', '#3fa84a', ORANGE], 2.8);
}

function completeLevel() {
  results[levelIndex] = { got: gotGifts, total: gifts.length, item: itemType(), flags: nameLetters().map((_, k) => letters.some((l) => l.k === k && l.got)) };
  state = 'complete'; stateT = 0; fx = [];
  sfx('fanfare'); confettiRain(60);
}

// ====================================================================
//  DRAWING HELPERS
// ====================================================================
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
const FONT = '"Fredoka","Trebuchet MS",system-ui,sans-serif';          // friendly rounded text
const PIX = '"Pixelify Sans","Fredoka",monospace';                        // pixel font to match the sprite
if (document.fonts && document.fonts.load) ['700 20px "Fredoka"', '700 20px "Pixelify Sans"'].forEach((f) => document.fonts.load(f).catch(() => {}));
function text(str, x, y, size, color = CREAM, align = 'center', stroke = INK, maxW = 0, fam = FONT) {
  if (color === '#fff' || color === '#ffffff') color = CREAM;
  ctx.font = `700 ${size}px ${fam}`;
  if (maxW) { const w = ctx.measureText(str).width; if (w > maxW) ctx.font = `700 ${Math.floor(size * maxW / w)}px ${fam}`; }
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke; ctx.strokeText(str, x, y);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function rainbowText(str, cx, y, size, maxW) {
  ctx.font = `700 ${size}px ${FONT}`;
  let w = ctx.measureText(str).width, sz = size;
  if (maxW && w > maxW) { sz = Math.floor(size * maxW / w); ctx.font = `700 ${sz}px ${FONT}`; w = ctx.measureText(str).width; }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  let x = cx - w / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i], cw = ctx.measureText(ch).width, by = Math.sin(worldT / 12 + i * 0.6) * 4;
    ctx.lineWidth = Math.max(4, sz / 5); ctx.strokeStyle = INK; ctx.strokeText(ch, x, y + by);
    ctx.fillStyle = RAINBOW[(i + Math.floor(worldT / 8)) % RAINBOW.length]; ctx.fillText(ch, x, y + by);
    x += cw;
  }
}
function star(cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
}
function balloon(x, y, r, color) {
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y + r * 1.2); ctx.quadraticCurveTo(x - 4, y + r * 2.2, x + 2, y + r * 3); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, r * 0.82, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 3, y + r); ctx.lineTo(x + 3, y + r); ctx.lineTo(x, y + r + 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
}

// ---------- background ----------
function hills(color, base, amp, wl, par, ph) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, VH);
  for (let x = 0; x <= VW; x += 8) {
    const wx = x + camX * par;
    ctx.lineTo(x, base + Math.sin(wx / wl + ph) * amp + Math.sin(wx / (wl * 0.43) + ph * 2) * amp * 0.35);
  }
  ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
}
function drawBackground() {
  const th = THEMES[L.theme];
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  if (th.stars) {
    for (let i = 0; i < 46; i++) {
      const x = mod(hash(i * 3) * 900 - camX * 0.05, VW), y = hash(i * 7 + 1) * 210;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(worldT / 30 + i))})`;
      ctx.fillRect(x, y, 2, 2);
    }
  } else {
    ctx.fillStyle = 'rgba(255,240,150,.95)'; ctx.beginPath(); ctx.arc(540, 70, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,150,.3)'; ctx.beginPath(); ctx.arc(540, 70, 48, 0, Math.PI * 2); ctx.fill();
  }
  // clouds
  ctx.fillStyle = L.theme === 'cake' ? 'rgba(255,200,190,.35)' : 'rgba(255,255,255,.85)';
  for (let i = 0; i < 6; i++) {
    const x = mod(i * 260 + hash(i) * 80 - camX * 0.15, VW + 300) - 150, y = 50 + hash(i + 9) * 90;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.arc(x + 20, y - 8, 22, 0, 7); ctx.arc(x + 44, y, 18, 0, 7); ctx.arc(x + 22, y + 6, 18, 0, 7); ctx.fill();
  }
  hills(th.far, 250, 26, 90, 0.22, 1);
  hills(th.near, 285, 20, 60, 0.4, 3);
  // floating balloons
  for (let i = 0; i < 7; i++) {
    const x = mod(i * 190 + hash(i + 40) * 100 - camX * 0.55, VW + 160) - 80;
    const y = 150 + hash(i + 60) * 110 + Math.sin(worldT / 50 + i * 2) * 8;
    balloon(x, y, 13, PARTY[i % PARTY.length]);
  }
  // bunting
  const par = 0.8, seg = 240, s0 = Math.floor(camX * par / seg) - 1;
  for (let s = s0; s <= s0 + 4; s++) {
    const x0 = s * seg - camX * par, x1 = x0 + seg, cx = x0 + seg / 2;
    ctx.strokeStyle = 'rgba(80,40,110,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, 4); ctx.quadraticCurveTo(cx, 52, x1, 4); ctx.stroke();
    for (let k = 1; k < 12; k++) {
      const t = k / 12, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      const fx_ = a * x0 + b * cx + c * x1, fy_ = a * 4 + b * 52 + c * 4;
      ctx.fillStyle = PARTY[mod(s * 12 + k, PARTY.length)];
      ctx.beginPath(); ctx.moveTo(fx_ - 8, fy_); ctx.lineTo(fx_ + 8, fy_); ctx.lineTo(fx_, fy_ + 18); ctx.fill();
    }
  }
}

// ---------- tiles ----------
function drawTiles() {
  const th = THEMES[L.theme];
  const c0 = Math.max(0, Math.floor(camX / TILE)), c1 = Math.min(L.w - 1, Math.floor((camX + VW) / TILE));
  for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
    const t = L.tiles[r][c]; if (!t) continue;
    const x = Math.round(c * TILE - camX), y = r * TILE;
    if (t === 1) {
      ctx.fillStyle = th.body; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = th.body2; ctx.fillRect(x, y + 14, TILE, 3); ctx.fillRect(x + 6, y + 24, 5, 3); ctx.fillRect(x + 20, y + 5, 4, 3);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x, y + TILE - 3, TILE, 3);
      if (!solidAt(c, r - 1) || (r > 0 && L.tiles[r - 1][c] !== 1 && L.tiles[r - 1][c] !== 2)) {
        ctx.fillStyle = th.frost; ctx.fillRect(x, y, TILE, 9);
        for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 8, y + 9, 8, 2 + Math.floor(hash(c * 4 + i) * 7));
        for (let i = 0; i < 2; i++) { ctx.fillStyle = PARTY[Math.floor(hash(c * 2 + i + 5) * 6)]; ctx.fillRect(x + 3 + Math.floor(hash(c + i * 9) * 22), y + 2 + i * 3, 3, 2); }
      }
    } else if (t === 2) {
      ctx.fillStyle = ORANGE; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#b9742a';
      ctx.fillRect(x, y, TILE, 3); ctx.fillRect(x, y + TILE - 3, TILE, 3); ctx.fillRect(x, y, 3, TILE); ctx.fillRect(x + TILE - 3, y, 3, TILE);
      ctx.fillRect(x + 14, y, 4, TILE); ctx.fillRect(x, y + 14, TILE, 4);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + 4, y + 4, 8, 3);
    } else {
      ctx.fillStyle = DENIM; rrect(x, y, TILE, 11, 4); ctx.fill();
      ctx.fillStyle = CREAM;
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 8, y + 1, 4, 8);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + 9, TILE, 2);
    }
  }
}

// ---------- objects ----------
const GIFT_COL = [[RED, CREAM], [SKY, CREAM], [GREEN, ORANGE], [ORANGE, NAVY]];
function drawGift(x, y, s, hue) {
  const [a, b] = GIFT_COL[hue];
  ctx.fillStyle = a; ctx.fillRect(x, y + s * 0.25, s, s * 0.75);
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x, y + s * 0.85, s, s * 0.15);
  ctx.fillStyle = b; ctx.fillRect(x + s * 0.42, y + s * 0.25, s * 0.16, s * 0.75); ctx.fillRect(x, y + s * 0.5, s, s * 0.14);
  ctx.fillRect(x - 1, y + s * 0.15, s + 2, s * 0.14);
  ctx.beginPath(); ctx.ellipse(x + s * 0.3, y + s * 0.08, s * 0.2, s * 0.12, -0.4, 0, 7); ctx.ellipse(x + s * 0.7, y + s * 0.08, s * 0.2, s * 0.12, 0.4, 0, 7); ctx.fill();
}
// ---------- collectibles: a different kind in each level ----------
const ITEMS = {
  present: { label: 'presents', burst: PARTY },
  cupcake: { label: 'cupcakes', burst: [CREAM, '#f6c58a', ORANGE, '#c98a5a'] },
  star:    { label: 'stars', burst: ['#ffd84d', '#fff3a0', CREAM, '#ffb02e'] },
};
const itemType = () => (L && L.def.item) || 'present';
const CUP_WRAP = [RED, SKY, ORANGE, GREEN];
const CUP_FROST = [CREAM, '#f6c58a', '#bfe3fa', '#d6f2b0'];
function drawCupcake(x, y, s, hue) {
  const k = s / 24;
  ctx.fillStyle = CUP_WRAP[hue];
  ctx.beginPath(); ctx.moveTo(x + 4 * k, y + 13 * k); ctx.lineTo(x + 20 * k, y + 13 * k); ctx.lineTo(x + 17 * k, y + 24 * k); ctx.lineTo(x + 7 * k, y + 24 * k); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,20,70,.55)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + (8.5 + i * 3.5) * k, y + 14.5 * k, 1.6 * k, 8 * k);
  ctx.fillStyle = CUP_FROST[hue]; ctx.strokeStyle = 'rgba(60,20,70,.45)';
  [[12, 11.5, 11, 4.4], [12, 8, 8, 3.8], [12, 4.8, 5, 3]].forEach(([cx, cy, rx, ry]) => {
    ctx.beginPath(); ctx.ellipse(x + cx * k, y + cy * k, rx * k, ry * k, 0, 0, 7); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = '#e8304a'; ctx.beginPath(); ctx.arc(x + 12 * k, y + 1.8 * k, 2.6 * k, 0, 7); ctx.fill();
  const sp = [[SKY, 7, 11], [ORANGE, 15, 9.5], [LIME, 11, 7.6], [RED, 17, 12.4]];
  for (const [c, sx, sy] of sp) { ctx.fillStyle = c; ctx.fillRect(x + sx * k, y + sy * k, 2 * k, 1.4 * k); }
}
function drawStarItem(x, y, s, hue) {
  const R = s / 2 + 2;
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2 + 1);
  ctx.rotate(Math.sin(worldT / 25 + hue) * 0.18);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.48 : R; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  ctx.fillStyle = hue % 2 ? '#ffd84d' : '#ffc21a'; ctx.fill();
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeStyle = '#b8791a'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-R * 0.22, -R * 0.2, R * 0.15, R * 0.27, -0.5, 0, 7); ctx.fill();
  ctx.restore();
}
function drawItem(type, x, y, s, hue) {
  if (type === 'cupcake') drawCupcake(x, y, s, hue);
  else if (type === 'star') drawStarItem(x, y, s, hue);
  else drawGift(x, y, s, hue);
}
function drawLetterTile(x, y, sz, ch, mode) {
  const r = sz * 0.24;
  if (mode === 'empty') {
    ctx.fillStyle = 'rgba(245,241,232,.14)'; rrect(x, y, sz, sz, r); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(245,241,232,.45)'; ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + sz);
    g.addColorStop(0, '#ffe08a'); g.addColorStop(1, ORANGE);
    ctx.fillStyle = g; rrect(x, y, sz, sz, r); ctx.fill();
    ctx.lineWidth = Math.max(2, sz / 12); ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x + sz * 0.16, y + sz * 0.1, sz * 0.5, sz * 0.08);
  }
  ctx.font = `700 ${Math.round(sz * 0.78)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = mode === 'empty' ? 'rgba(245,241,232,.4)' : NAVY;
  ctx.fillText(ch, x + sz / 2, y + sz / 2 + sz * 0.05);
}
function drawLetters() {
  for (const l of letters) {
    if (l.got || l.x < camX - 40 || l.x > camX + VW + 40) continue;
    const bob = Math.sin(worldT / 12 + l.ph) * 4, x = Math.round(l.x - camX), y = Math.round(l.y + bob);
    ctx.fillStyle = `rgba(255,224,138,${0.2 + 0.14 * Math.sin(worldT / 10 + l.ph)})`;
    ctx.beginPath(); ctx.arc(x + 14, y + 14, 25, 0, 7); ctx.fill();
    drawLetterTile(x, y, 28, l.ch, 'world');
    if ((worldT + l.k * 17) % 70 < 7) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 26, y - 3, 3, 3); ctx.fillRect(x - 3, y + 24, 3, 3); }
  }
}
function drawLetterRow(cx, y, sz, flags) {
  const NAME = nameLetters(), step = sz + 4, x0 = cx - (NAME.length * step - 4) / 2;
  NAME.forEach((ch, k) => drawLetterTile(x0 + k * step, y, sz, ch, flags[k] ? 'got' : 'empty'));
}
function drawGifts() {
  const type = itemType();
  for (const g of gifts) {
    if (g.got || g.x < camX - 40 || g.x > camX + VW + 40) continue;
    const bob = Math.sin(worldT / 14 + g.ph) * 3, x = Math.round(g.x - camX);
    drawItem(type, x, g.y + bob, 24, g.hue);
    if ((worldT + g.hue * 15) % 60 < 6) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 20, g.y + bob - 2, 3, 3); }
  }
}
function drawEnemy(e) {
  const x = Math.round(e.x - camX), y = e.y;
  if (!e.alive) {
    if (e.dead <= 0) return;
    ctx.fillStyle = '#3fa84a'; ctx.fillRect(x, y + e.h - 6, e.w, 6); return;
  }
  const w = Math.sin(worldT / 6 + e.ph) * 2;
  ctx.fillStyle = '#b6e07a'; rrect(x + 8, y + 12, 12, 14, 3); ctx.fill();
  ctx.fillStyle = '#3fa84a';
  ctx.beginPath(); ctx.arc(x + 8, y + 10, 8, 0, 7); ctx.arc(x + 20, y + 10, 8, 0, 7); ctx.arc(x + 14, y + 6, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#2f8a3a'; ctx.beginPath(); ctx.arc(x + 14, y + 8, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 8, y + 13, 5, 5); ctx.fillRect(x + 15, y + 13, 5, 5);
  ctx.fillStyle = '#222'; ctx.fillRect(x + 9 + e.dir, y + 15, 3, 3); ctx.fillRect(x + 16 + e.dir, y + 15, 3, 3);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 7, y + 11); ctx.lineTo(x + 13, y + 14); ctx.moveTo(x + 21, y + 11); ctx.lineTo(x + 15, y + 14); ctx.stroke();
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x + 8 + w, y + 24, 5, 2); ctx.fillRect(x + 15 - w, y + 24, 5, 2);
}
function drawSpring(s) {
  const x = Math.round(s.x - camX), sq = s.sq > 0 ? 6 : 0;
  ctx.fillStyle = ORANGE; rrect(x, s.y + sq, s.w, 6, 3); ctx.fill();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 6, s.y + 18); ctx.lineTo(x + 22, s.y + 12 + sq); ctx.lineTo(x + 6, s.y + 8 + sq); ctx.stroke();
  ctx.fillStyle = SKY; ctx.fillRect(x + 2, s.y + 15, s.w - 4, 3);
}
function drawCheckpoint(c) {
  const x = Math.round(c.x - camX) + 6, top = c.y + 6;
  ctx.fillStyle = '#e8e8f0'; ctx.fillRect(x, top, 3, 58);
  ctx.fillStyle = c.active ? ORANGE : '#9a9ab0';
  const wave = Math.sin(worldT / 8) * (c.active ? 3 : 0.5);
  ctx.beginPath(); ctx.moveTo(x + 3, top + 2); ctx.lineTo(x + 26, top + 9 + wave); ctx.lineTo(x + 3, top + 18); ctx.fill();
  ctx.fillStyle = c.active ? RED : '#777'; ctx.beginPath(); ctx.arc(x + 1, top, 4, 0, 7); ctx.fill();
}
function drawFinish() {
  const x = Math.round(finish.cx - camX), b = finish.bottom;
  if (levelIndex === LEVELS.length - 1) {
    // giant birthday cake with candles
    ctx.fillStyle = '#5e3a2e'; rrect(x - 48, b - 30, 96, 30, 6); ctx.fill();
    ctx.fillStyle = ORANGE; rrect(x - 40, b - 56, 80, 28, 6); ctx.fill();
    ctx.fillStyle = CREAM; rrect(x - 32, b - 78, 64, 24, 6); ctx.fill();
    ctx.fillStyle = ORANGE; for (let i = 0; i < 6; i++) ctx.fillRect(x - 32 + i * 11, b - 56, 8, 5 + (i % 2) * 3);
    ctx.fillStyle = CREAM; for (let i = 0; i < 8; i++) ctx.fillRect(x - 44 + i * 12, b - 30, 8, 4 + (i % 3) * 2);
    const n = Math.min(7, CFG.age);
    for (let i = 0; i < n; i++) {
      const cx = x - 27 + i * (54 / Math.max(1, n - 1));
      ctx.fillStyle = PARTY[i % 6]; ctx.fillRect(cx - 2, b - 94, 4, 16);
      const fl = Math.sin(worldT / 4 + i) * 1.5;
      ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.ellipse(cx, b - 99, 3.5, 6 + fl, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.ellipse(cx, b - 98, 1.8, 3.5, 0, 0, 7); ctx.fill();
    }
  } else {
    // balloon gate
    ctx.fillStyle = '#e8e8f0'; ctx.fillRect(x - 38, b - 80, 4, 80); ctx.fillRect(x + 34, b - 80, 4, 80);
    ctx.fillStyle = RED; ctx.fillRect(x - 38, b - 84, 76, 12);
    ctx.fillStyle = ORANGE; for (let i = 0; i < 6; i++) ctx.fillRect(x - 36 + i * 13, b - 84, 6, 12);
    text('PARTY!', x, b - 64, 12, '#fff', 'center', NIGHT);
    balloon(x - 36, b - 96 + Math.sin(worldT / 20) * 3, 11, SKY);
    balloon(x + 36, b - 96 + Math.cos(worldT / 20) * 3, 11, LIME);
    balloon(x - 24, b - 104 + Math.cos(worldT / 17) * 3, 9, ORANGE);
    balloon(x + 24, b - 104 + Math.sin(worldT / 17) * 3, 9, DENIM);
  }
}
function drawShot(s) {
  const x = Math.round(s.x - camX);
  ctx.save(); ctx.translate(x + 5, s.y + 5); ctx.rotate(s.r);
  ctx.fillStyle = PARTY[0]; ctx.fillRect(-5, -5, 5, 5);
  ctx.fillStyle = PARTY[1]; ctx.fillRect(0, -5, 5, 5);
  ctx.fillStyle = PARTY[2]; ctx.fillRect(-5, 0, 5, 5);
  ctx.fillStyle = PARTY[3]; ctx.fillRect(0, 0, 5, 5);
  ctx.restore();
}
function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2) return;
  let f;
  if (p.shootAnim > 0 && AN.shoot) f = AN.shoot[Math.min(AN.shoot.length - 1, Math.floor((16 - p.shootAnim) / 4))];
  else if (!p.onGround) {
    if (p.gliding) f = animFrame('glide', animT, 8);
    else if (p.vy < -2) f = animFrame('jump', animT, 8);
    else if (p.vy < 2.5) f = animFrame('jumpTop', animT, 8);
    else f = animFrame('fall', animT, 8);
  }
  else if (Math.abs(p.vx) > 0.4) f = animFrame('run', animT, 12);
  else f = animFrame('idle', animT, 2.5);
  f = Math.min(f, SP.frames - 1);
  const cx = p.x + p.w / 2 - camX, bottom = p.y + p.h;
  if (p.gliding) balloon(Math.round(cx), Math.round(bottom - SP.drawSize) - 4 + Math.sin(worldT / 8) * 2, 15, RED);
  drawHero(f, cx, bottom, SP.drawSize, p.facing < 0);
}
function drawParticles(list, shift) {
  for (const p of list) {
    ctx.globalAlpha = clamp(p.life / (p.max * 0.6), 0, 1);
    ctx.fillStyle = p.c;
    if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    else ctx.fillRect(Math.round(p.x - (shift ? camX : 0)), Math.round(p.y), p.s, p.s);
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD ----------
function wrapText(str, maxW, size) {
  ctx.font = `700 ${size}px ${FONT}`;
  const lines = []; let cur = '';
  for (const w of String(str).split(' ')) {
    const test = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
const BANNER_LIFE = 270;
function drawBanner() {
  if (!banner.text || banner.t >= BANNER_LIFE) return;
  const a = clamp(Math.min(banner.t / 14, (BANNER_LIFE - banner.t) / 24), 0, 1);
  const lines = wrapText(banner.text, 400, 19);
  const w = 460, h = 36 + lines.length * 24, x = (VW - w) / 2, y = 54 - (1 - a) * 14;
  ctx.save(); ctx.globalAlpha = a * 0.96;
  ctx.fillStyle = CREAM; rrect(x, y, w, h, 16); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = DENIM; ctx.stroke();
  ctx.fillStyle = DENIM; ctx.fillRect(x + 14, y + 10, 20, 14);           // little envelope
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 14, y + 10); ctx.lineTo(x + 24, y + 18); ctx.lineTo(x + 34, y + 10); ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = DENIM;
  ctx.fillText(banner.head || `Message from ${CFG.sender}`, x + 42, y + 17);
  ctx.font = `700 19px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = INK;
  lines.forEach((ln, i) => ctx.fillText(ln, VW / 2, y + 42 + i * 24));
  ctx.restore();
}
function drawHUD() {
  ctx.fillStyle = 'rgba(26,18,34,.72)'; rrect(10, 10, 112, 34, 17); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(245,241,232,.55)'; ctx.stroke();
  drawItem(itemType(), 18, 15, 22, 0);
  text(`${gotGifts}/${gifts.length}`, 50, 28, 20, CREAM, 'left', INK, 0, PIX);
  const NAME = nameLetters(), lw = NAME.length * 26 + 12;
  ctx.fillStyle = 'rgba(26,18,34,.72)'; rrect(130, 10, lw, 34, 17); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(245,241,232,.55)'; ctx.stroke();
  NAME.forEach((ch, k) => drawLetterTile(136 + k * 26, 16, 22, ch, letters.some((l) => l.k === k && l.got) ? 'got' : 'empty'));
  text(`${levelIndex + 1}. ${L.def.name}`, VW - 64, 26, 17, '#fff', 'right', INK);
  if (oopsT > 0) text('Oops! Try again!', VW / 2, 160, 28, ORANGE);
  drawBanner();
}

// ---------- menus ----------
function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(26,36,92,.92)'; rrect(x, y, w, h, 22); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(245,241,232,.9)'; ctx.stroke();
}
const blink = () => Math.floor(worldT / 30) % 2 === 0;

function drawTitle() {
  drawBackground();
  const th = THEMES[L.theme];
  ctx.fillStyle = th.body; ctx.fillRect(0, VH - 56, VW, 56);
  ctx.fillStyle = th.frost; ctx.fillRect(0, VH - 56, VW, 9);
  for (let i = 0; i < VW / 8; i++) ctx.fillRect(i * 8, VH - 47, 8, 2 + Math.floor(hash(i) * 7));
  const bounce = Math.abs(Math.sin(worldT / 18)) * 24;
  drawHero(animFrame('cheer2', worldT, 8), VW / 2, VH - 52 - bounce, SP.drawSize * 1.5, false);
  rainbowText(`HAPPY ${ordinal(CFG.age).toUpperCase()} BIRTHDAY`, VW / 2, 52, 40, 600);
  text(CFG.name.toUpperCase() + '!', VW / 2, 108, 58, ORANGE, 'center', NIGHT, 560, PIX);
  text(`A birthday adventure from ${CFG.sender}`, VW / 2, 152, 21, '#fff', 'center', INK, 560);
  if (blink()) text('TAP TO START', VW / 2, 192, 28, '#fff');
  drawParticles(fx, false);
}
function drawIntro() {
  drawBackground(); drawTiles(); drawFinish();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, VW, VH);
  panel(80, 40, 480, 290);
  text(`LEVEL ${levelIndex + 1}`, VW / 2, 74, 20, ORANGE);
  text(L.def.name, VW / 2, 110, 38, '#fff', 'center', INK, 420);
  L.def.tip.forEach((t, i) => {
    const big = i === 0 && L.def.unlock;
    text(t, VW / 2, 152 + i * 28, big ? 23 : 18, big ? ORANGE : '#fff', 'center', INK, 450);
  });
  const it = itemType(), y = 152 + L.def.tip.length * 28 + 14;
  const label = (levelIndex > 0 ? 'NEW! ' : '') + `Collect the ${ITEMS[it].label}!`;
  ctx.font = `700 22px ${FONT}`;
  const x0 = VW / 2 - (ctx.measureText(label).width + 38) / 2;
  drawItem(it, x0, y - 15, 28, 0);
  text(label, x0 + 38, y, 22, LIME, 'left');
  // ...and the letters of his name
  const NAME = nameLetters(), ly = y + 26, cap = 'Find every letter:';
  ctx.font = `700 17px ${FONT}`;
  const cw = ctx.measureText(cap).width, total = cw + 12 + NAME.length * 30 - 4, lx = VW / 2 - total / 2;
  text(cap, lx, ly + 14, 17, CREAM, 'left');
  NAME.forEach((ch, k) => drawLetterTile(lx + cw + 12 + k * 30, ly, 26, ch, 'got'));
  if (blink()) text('TAP TO GO!', VW / 2, 308, 22, '#ffffff');
}
function drawComplete() {
  drawScene();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, VW, VH);
  panel(110, 36, 420, 312);
  text('LEVEL COMPLETE!', VW / 2, 76, 32, ORANGE, 'center', NIGHT, 380);
  const r = results[levelIndex], pct = r.got / Math.max(1, r.total);
  const stars = pct >= 0.7 ? 3 : pct >= 0.35 ? 2 : 1;
  for (let i = 0; i < 3; i++) {
    const t = clamp((stateT - 10 - i * 14) / 10, 0, 1);
    star(VW / 2 + (i - 1) * 68, 132 + (i === 1 ? -8 : 0), (i === 1 ? 32 : 26) * (0.4 + 0.6 * t), i < stars ? '#ffd84d' : '#4a4670');
  }
  drawItem(r.item, VW / 2 - 118, 176, 30, 0);
  text(`${r.got} / ${r.total} ${ITEMS[r.item].label}`, VW / 2 - 78, 192, 24, '#fff', 'left', INK, 190);
  drawLetterRow(VW / 2, 218, 30, r.flags);
  const n = r.flags.filter(Boolean).length;
  if (r.flags.length && n === r.flags.length) text(`You spelled ${nameLetters().join('')}! Bonus!`, VW / 2, 270, 20, ORANGE, 'center', NIGHT, 380);
  else text(`Letters: ${n} / ${r.flags.length}`, VW / 2, 270, 18, CREAM, 'center', INK, 380);
  if (stateT > 40 && blink()) text('TAP TO CONTINUE', VW / 2, 314, 22, LIME);
  drawParticles(fx, false);
}
function drawWin() {
  const th = THEMES.cake;
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#141a3c'); g.addColorStop(1, '#2c3f8a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 50; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(worldT / 30 + i))})`; ctx.fillRect(hash(i) * VW, hash(i + 3) * VH * 0.7, 2, 2); }
  ctx.fillStyle = th.body; ctx.fillRect(0, VH - 40, VW, 40); ctx.fillStyle = th.frost; ctx.fillRect(0, VH - 40, VW, 8);
  // two cheering Azaans
  const bounce = Math.abs(Math.sin(worldT / 10)) * 22;
  drawHero(animFrame('cheer', worldT, 8), 60, VH - 36 - bounce, SP.drawSize * 1.5, false);
  drawHero(animFrame('cheer2', worldT + 20, 8), VW - 60, VH - 36 - bounce, SP.drawSize * 1.5, true);
  drawParticles(fx, false);
  rainbowText(`HAPPY ${ordinal(CFG.age).toUpperCase()}`, VW / 2, 40, 46, 560);
  rainbowText('BIRTHDAY', VW / 2, 88, 46, 560);
  text(CFG.name.toUpperCase() + '!', VW / 2, 140, 54, ORANGE, 'center', NIGHT, 540, PIX);
  text(String(CFG.finalMessage).replace(/\{name\}/g, CFG.name), VW / 2, 184, 20, '#fff', 'center', INK, 560);
  results.forEach((r, i) => {
    const cx = VW / 2 + (i - 1) * 180;
    drawItem(r.item, cx - 62, 209, 26, 0);
    text(`${r.got}/${r.total}`, cx - 30, 222, 20, '#fff', 'left');
  });
  const full = results.filter((r) => r && r.flags && r.flags.length && r.flags.every(Boolean)).length;
  text(full === results.length ? `You spelled ${nameLetters().join('')} in every level!` : `${nameLetters().join('')} spelled in ${full} of ${results.length} levels`, VW / 2, 250, 18, ORANGE, 'center', NIGHT, 400);
  text(CFG.from, VW / 2, 284, 26, CREAM, 'center', INK, 400);
  if (winT > 180 && blink()) text('TAP TO PLAY AGAIN', VW / 2, 322, 20, LIME);
}
function drawScene() {
  drawBackground(); drawTiles(); drawFinish();
  checks.forEach(drawCheckpoint); springs.forEach(drawSpring); drawGifts(); drawLetters();
  enemies.forEach(drawEnemy); shots.forEach(drawShot); drawPlayer();
  drawParticles(parts, true);
}
function render() {
  if (state === 'title') drawTitle();
  else if (state === 'win') drawWin();
  else if (state === 'intro') drawIntro();
  else if (state === 'complete') drawComplete();
  else { drawScene(); drawHUD(); }
}

// ====================================================================
//  FLOW
// ====================================================================
function advance() {
  if (stateT < 25) return; // ignore accidental double taps
  if (state === 'title') { results.length = 0; fx = []; msgBag = []; firstMsgDone = false; loadLevel(0); state = 'intro'; stateT = 0; }
  else if (state === 'intro') {
    state = 'play'; stateT = 0; edge.jump = false; edge.shoot = false;
    if (L.def.unlock) sfx('unlock');
  }
  else if (state === 'complete') {
    fx = [];
    if (levelIndex < LEVELS.length - 1) { loadLevel(levelIndex + 1); state = 'intro'; stateT = 0; }
    else { state = 'win'; stateT = 0; winT = 0; nextFirework = 20; stopMusic(); playBirthday(); }
  }
  else if (state === 'win') {
    if (winT < 180) return;
    fx = []; loadLevel(0); state = 'title'; stateT = 0; startMusic();
  }
}

// ---- main loop (fixed 60 fps simulation) ----
let last = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  let dt = ts - last; last = ts;
  if (dt > 100) dt = 100;
  acc += dt;
  while (acc >= STEP_MS) { update(); acc -= STEP_MS; }
  render();
}
loadLevel(0);
requestAnimationFrame(frame);

// small hook so tools/test_game.js can drive the game headlessly
window.__game = {
  get state() { return state; }, get player() { return player; }, get L() { return L; },
  get gifts() { return gifts; }, get enemies() { return enemies; }, get springs() { return springs; }, get finish() { return finish; },
  get levelIndex() { return levelIndex; }, get got() { return gotGifts; }, get banner() { return banner; }, get letters() { return letters; }, get lettersGot() { return lettersGot; }, get checks() { return checks; },
  go(st) { state = st; stateT = 100; if (st === 'win') { winT = 200; fx = []; } },
  resetMessages() { msgBag = []; firstMsgDone = false; },
  start(i) { loadLevel(i); state = 'play'; stateT = 100; edge.jump = false; edge.shoot = false; },
  step() { update(); }, advance, render, completeLevel, showMessage,
  input(l, r, j, press, shoot) { kb.left = l; kb.right = r; kb.jump = j; if (press) edge.jump = true; if (shoot) edge.shoot = true; },
  solidAt, platAt, TILE, ROWS,
};
})();
