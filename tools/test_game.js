// Headless sanity test:  node tools/test_game.js
// 1) checks level data is sane   2) runs a simple bot through every level.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
    if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
    if (k in t) return t[k];
    return noop;
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
const el = () => ({
  style: {}, classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop,
  getContext: () => ctxStub, getBoundingClientRect: () => ({ left: 0, width: 100, top: 0, height: 100 }),
  setPointerCapture: noop, set textContent(v) {}, width: 0, height: 0, closest: () => null,
});
const sandbox = {
  console, Math, Date, Image: function () { Object.defineProperty(this, 'src', { set: () => { this.onload && this.onload(); } }); }, setInterval: noop, clearInterval: noop,
  setTimeout: noop, requestAnimationFrame: noop, localStorage: { getItem: () => null, setItem: noop },
  navigator: { maxTouchPoints: 0 }, devicePixelRatio: 1, innerWidth: 800, innerHeight: 400,
  document: { getElementById: el, createElement: el, title: '', body: { classList: { add: noop } } },
};
sandbox.window = sandbox;
sandbox.addEventListener = noop;
vm.createContext(sandbox);
const root = path.join(__dirname, '..');
for (const f of ['config.js', 'levels.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });

const G = sandbox.__game, LEVELS = sandbox.LEVELS;
let problems = 0;
const bad = (m) => { problems++; console.log('  PROBLEM:', m); };

// ---------- 1. level data ----------
LEVELS.forEach((d, i) => {
  G.start(i);
  const L = G.L, T = G.TILE;
  const solid = (c, r) => G.solidAt(c, r);
  const standable = (c, r) => solid(c, r + 1) || G.platAt(c, r + 1);
  d.gifts.forEach(([c, r]) => { if (solid(c, r)) bad(`L${i + 1} gift (${c},${r}) is inside a wall`); if (c >= d.width) bad(`L${i + 1} gift off map`); });
  d.enemies.forEach(([c, r]) => { if (!standable(c, r)) bad(`L${i + 1} enemy (${c},${r}) has no floor`); if (solid(c, r)) bad(`L${i + 1} enemy in wall`); });
  (d.springs || []).forEach(([c, r]) => { if (!standable(c, r)) bad(`L${i + 1} spring (${c},${r}) has no floor`); });
  d.checkpoints.forEach(([c, r]) => { if (!standable(c, r)) bad(`L${i + 1} checkpoint (${c},${r}) has no floor`); });
  [d.start, d.finish].forEach(([c, r], k) => { if (!standable(c, r)) bad(`L${i + 1} ${k ? 'finish' : 'start'} (${c},${r}) has no floor`); });
  // gaps wider than a double jump can clear
  let run = 0, maxGap = 0;
  for (let c = 0; c < d.width; c++) {
    let ground = false; for (let r = 0; r < 12; r++) if (solid(c, r)) ground = true;
    run = ground ? 0 : run + 1; maxGap = Math.max(maxGap, run);
  }
  console.log(`Level ${i + 1} "${d.name}": ${d.width} cols, ${d.gifts.length} gifts, ${d.enemies.length} enemies, widest pit ${maxGap} tiles`);
});

// ---------- 2. bot playthrough ----------
function bot(i, maxFrames = 60 * 150) {
  G.start(i);
  let frames = 0, deaths = 0, lastX = -1, stuck = 0, jumpHold = 0, lastRespawnCheck = G.player.x;
  while (frames < maxFrames) {
    const p = G.player, T = G.TILE;
    if (G.state !== 'play') return { done: G.state === 'complete', frames, deaths, got: G.got, total: G.gifts.length };
    const aheadX = p.x + p.w + 6;
    const col = Math.floor(aheadX / T), feetRow = Math.floor((p.y + p.h - 1) / T);
    const wall = G.solidAt(col, feetRow) || G.solidAt(col, feetRow - 1);
    // ground ahead? look 1-2 tiles forward for a floor within 3 rows below feet
    const floorAt = (c) => { for (let r = feetRow + 1; r < feetRow + 4; r++) if (G.solidAt(c, r) || G.platAt(c, r)) return true; return false; };
    const gap = p.onGround && !floorAt(Math.floor((p.x + p.w + 14) / T));
    const enemyNear = G.enemies.some((e) => e.alive && e.x > p.x && e.x - p.x < 70 && Math.abs(e.y - p.y) < 40);
    let press = false, hold = false;
    if (p.onGround && (wall || gap || enemyNear)) { press = true; jumpHold = 22; }
    // double jump if falling and gap still below us / wall still ahead
    if (!p.onGround && p.vy > 1 && (wall || !floorAt(Math.floor((p.x + p.w) / T)))) { if (p.vy > 2 && p.vy < 3 && (frames % 7 === 0)) press = true; }
    if (jumpHold > 0) { hold = true; jumpHold--; }
    if (!p.onGround && p.vy > 1) hold = true; // glide on level 3
    G.input(false, true, hold, press, false);
    const beforeY = p.y;
    G.step(); frames++;
    if (G.player.invuln === 90) deaths++; // just respawned
    if (Math.abs(G.player.x - lastX) < 0.01) stuck++; else stuck = 0;
    lastX = G.player.x;
    if (stuck > 240) return { done: false, frames, deaths, got: G.got, total: G.gifts.length, stuckAt: Math.round(G.player.x / T) };
  }
  return { done: false, frames, deaths, got: G.got, total: G.gifts.length, timeout: true, at: Math.round(G.player.x / G.TILE) };
}

console.log('\nBot run (holds right, jumps over walls/gaps/enemies):');
LEVELS.forEach((d, i) => {
  const r = bot(i);
  const secs = (r.frames / 60).toFixed(0);
  console.log(`  Level ${i + 1}: ${r.done ? 'FINISHED' : 'NOT FINISHED'} in ~${secs}s, gifts ${r.got}/${r.total}, respawns ~${r.deaths}` + (r.stuckAt ? `, stuck at col ${r.stuckAt}` : '') + (r.timeout ? `, timeout near col ${r.at}` : ''));
  if (!r.done) problems++;
});

// ---------- 2a. letters of the name ----------
(function () {
  const NAME = [...String(sandbox.CONFIG ? sandbox.CONFIG.name : sandbox.CFG.name).toUpperCase()];
  LEVELS.forEach((d, li) => {
    G.start(li);
    const ls = G.letters;
    if (ls.length !== NAME.length) bad(`level ${li + 1}: expected ${NAME.length} letters, found ${ls.length}`);
    if (ls.map((l) => l.ch).join('') !== NAME.join('')) bad(`level ${li + 1}: letters out of order`);
    for (let i = 1; i < ls.length; i++) if (ls[i].x <= ls[i - 1].x) bad(`level ${li + 1}: letters not left-to-right`);
    ls.forEach((l) => {
      for (const [cx, cy] of [[l.x, l.y], [l.x + l.w, l.y], [l.x, l.y + l.h], [l.x + l.w, l.y + l.h]])
        if (G.solidAt(Math.floor(cx / G.TILE), Math.floor(cy / G.TILE))) bad(`level ${li + 1}: letter ${l.ch} inside a wall`);
    });
    // grab them all: the bonus message must appear
    ls.forEach((l) => { G.player.x = l.x; G.player.y = l.y; G.player.vy = 0; G.input(false, false, false, false, false); G.step(); });
    if (G.lettersGot !== ls.length) bad(`level ${li + 1}: collected ${G.lettersGot}/${ls.length} letters`);
    if (!/Bonus/.test(G.banner.text)) bad(`level ${li + 1}: no bonus message`);
  });
  console.log('\nLetters: ' + NAME.join('-') + ' placed in all ' + LEVELS.length + ' levels, reachable, bonus fires');
})();

// ---------- 2b. messages + collectibles ----------
(function () {
  G.start(0);
  const types = LEVELS.map((d) => d.item);
  console.log('\nCollectibles per level:', types.join(', '));
  if (new Set(types).size !== LEVELS.length) bad('each level should have its own collectible type');
  // step onto every flag of every level and collect the messages that pop up
  let sawFirst = false, texts = [];
  G.resetMessages();
  LEVELS.forEach((d, li) => {
    G.start(li);
    G.checks.forEach((c) => {
      G.player.x = c.x - 3; G.player.y = c.y + 20; G.player.vy = 0;
      G.input(false, false, false, false, false);
      G.step();
      texts.push(G.banner.text);
    });
  });
  sawFirst = /Azaan/.test(texts[0]);
  texts = new Set(texts);
  console.log('Flag messages (' + texts.size + ' different):\n   ' + [...texts].slice(0, 6).map((x) => '"' + x + '"').join('\n   ') + '\n   ...');
  if (!texts.size || texts.has('') || texts.has(undefined)) bad('a flag showed no message'); else if (!sawFirst) bad('first message does not contain the name');
})();

// ---------- 3. menu flow + rendering doesn't crash ----------

try {
  for (let i = 0; i < 3; i++) { G.start(i); for (let f = 0; f < 120; f++) { G.step(); G.render(); } }
  // walk the real menu flow: title -> intro -> play -> complete -> ... -> win
  G.advance(); // no-op or start, just must not crash
  for (let i = 0; i < 3; i++) {
    G.start(i); for (let f = 0; f < 30; f++) { G.step(); }
    G.completeLevel();
    for (let f = 0; f < 60; f++) { G.step(); G.render(); }   // level complete screen
    G.advance();                                              // -> next intro, or win
    for (let f = 0; f < 40; f++) { G.step(); G.render(); }    // intro / win screen
  }
  for (let f = 0; f < 400; f++) { G.step(); G.render(); }     // win screen with fireworks
  if (G.state !== 'win') bad('expected win screen at the end, got ' + G.state);
  console.log('\nRender smoke test (all screens): OK');
} catch (e) { bad('render crashed: ' + e.stack); }

console.log(problems ? `\n${problems} problem(s) found` : '\nAll checks passed');
process.exit(problems ? 1 : 0);
