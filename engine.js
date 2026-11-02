// Генератор сканвордов. Строит новую сетку из базы слов по «зерну» (seed):
// одинаковое зерно и база дают одинаковый сканворд у всех (так работает «Сканворд дня»).
(function (root) {
  "use strict";

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ---- словарь ----
  let DICT = null;
  function loadDict(data) {
    const list = data.w.map(([word, ...clues]) => ({ word, clues }));
    const byLetter = {};      // буква -> [[индекс слова, позиция буквы]]
    const byWord = {};
    list.forEach((e, i) => {
      byWord[e.word] = i;
      for (let p = 0; p < e.word.length; p++) {
        (byLetter[e.word[p]] = byLetter[e.word[p]] || []).push([i, p]);
      }
    });
    const byLen = {};
    list.forEach((e, i) => { (byLen[e.word.length] = byLen[e.word.length] || []).push(i); });
    DICT = { list, byLetter, byWord, byLen, themes: data.themes || [] };
    return DICT;
  }

  // Клетки: 0 — пусто, 1 — занято (не буква), строка — буква; клетки с вопросами хранятся отдельно.
  const EMPTY = 0, BLOCK = 1;

  function makeGrid(W, H) {
    return { W, H, g: new Array(W * H).fill(EMPTY), clue: new Array(W * H).fill(null), words: [], used: new Set(), dirAt: new Array(W * H).fill(0) };
  }
  const idx = (G, r, c) => r * G.W + c;
  const inside = (G, r, c) => r >= 0 && c >= 0 && r < G.H && c < G.W;
  const isLetter = v => typeof v === "string";

  // Где можно поставить клетку-вопрос для слова: основная позиция и запасная (стрелка с поворотом).
  function clueSpots(r, c, dir) {
    return dir === "a"
      ? [[r, c - 1, "r"], [r - 1, c, "dr"], [r + 1, c, "ur"]]
      : [[r - 1, c, "d"], [r, c - 1, "rd"], [r, c + 1, "ld"]];
  }
  function clueFree(G, r, c) {
    if (!inside(G, r, c)) return false;
    const i = idx(G, r, c), v = G.g[i];
    if (isLetter(v)) return false;
    if (G.clue[i]) return G.clue[i].length < 2;
    return true;
  }

  // Проверка: можно ли вписать слово. Возвращает число пересечений или -1.
  function check(G, word, r, c, dir) {
    const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0;
    const L = word.length;
    const er = r + dr * (L - 1), ec = c + dc * (L - 1);
    if (!inside(G, r, c) || !inside(G, er, ec)) return -1;
    // клетка после конца — не буква
    const ar = er + dr, ac = ec + dc;
    if (inside(G, ar, ac) && (isLetter(G.g[idx(G, ar, ac)]))) return -1;
    // клетка перед началом — не буква (там часто стоит вопрос)
    const br = r - dr, bc = c - dc;
    if (inside(G, br, bc) && isLetter(G.g[idx(G, br, bc)])) return -1;
    let cross = 0;
    for (let k = 0; k < L; k++) {
      const rr = r + dr * k, cc = c + dc * k, i = idx(G, rr, cc), v = G.g[i];
      if (isLetter(v)) {
        if (v !== word[k]) return -1;
        if (G.dirAt[i] & (dir === "a" ? 1 : 2)) return -1;  // уже есть слово в этом направлении
        cross++;
      } else {
        if (v === BLOCK || G.clue[i]) return -1;
        // соседи сбоку не должны быть буквами
        const n1r = rr + dc, n1c = cc + dr, n2r = rr - dc, n2c = cc - dr;
        if (inside(G, n1r, n1c) && isLetter(G.g[idx(G, n1r, n1c)])) return -1;
        if (inside(G, n2r, n2c) && isLetter(G.g[idx(G, n2r, n2c)])) return -1;
      }
    }
    if (cross === L) return -1;
    return cross;
  }

  function pickClueSpot(G, r, c, dir) {
    for (const [cr, cc, arrow] of clueSpots(r, c, dir)) {
      if (!clueFree(G, cr, cc)) continue;
      // запасные позиции не должны «закрывать» продолжение слова
      return [cr, cc, arrow];
    }
    return null;
  }

  function place(G, wi, word, r, c, dir, spot, clue) {
    const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0;
    for (let k = 0; k < word.length; k++) {
      const i = idx(G, r + dr * k, c + dc * k);
      G.g[i] = word[k];
      G.dirAt[i] |= dir === "a" ? 1 : 2;
    }
    const ar = r + dr * word.length, ac = c + dc * word.length;
    if (inside(G, ar, ac) && G.g[idx(G, ar, ac)] === EMPTY) G.g[idx(G, ar, ac)] = BLOCK;
    const br = r - dr, bc = c - dc;
    if (inside(G, br, bc) && G.g[idx(G, br, bc)] === EMPTY) G.g[idx(G, br, bc)] = BLOCK;
    const [cr, cc, arrow] = spot, ci = idx(G, cr, cc);
    G.g[ci] = BLOCK;
    const id = G.words.length;
    (G.clue[ci] = G.clue[ci] || []).push(id);
    G.words.push({ id, word, r, c, dir, cr, cc, arrow, clue, wi });
    G.used.add(word);
  }

  function generate(seed, opts) {
    opts = opts || {};
    if (!DICT) throw new Error("dict");
    const W = opts.w || 9, H = opts.h || 12;
    const tries = opts.tries || 30;
    const themeWords = new Set(opts.themeWords || []);
    let best = null;
    const rnd0 = mulberry32(typeof seed === "number" ? seed : hashStr(String(seed)));
    for (let t = 0; t < tries; t++) {
      const rnd = mulberry32(Math.floor(rnd0() * 4294967296));
      const G = build(W, H, rnd, themeWords);
      const score = rate(G, themeWords);
      if (!best || score > best.score) best = { G, score };
    }
    return finish(best.G, opts);
  }

  function rate(G, themeWords) {
    let letters = 0, clues = 0;
    for (let i = 0; i < G.g.length; i++) { if (isLetter(G.g[i])) letters++; if (G.clue[i]) clues++; }
    let th = 0; G.words.forEach(w => { if (themeWords.has(w.word)) th++; });
    return letters * 3 + clues * 2 + th * 6 - (G.g.length - letters - clues) * 4;
  }

  function build(W, H, rnd, themeWords) {
    const G = makeGrid(W, H);
    const list = DICT.list;
    // первое слово — по горизонтали во второй строке, вопрос слева
    for (let a = 0; a < 200; a++) {
      const e = list[Math.floor(rnd() * list.length)];
      if (e.word.length < 5 || e.word.length > W - 1) continue;
      const r = 1 + Math.floor(rnd() * 2), c = 1;
      if (check(G, e.word, r, c, "a") < 0) continue;
      place(G, 0, e.word, r, c, "a", [r, c - 1, "r"], e.clues[Math.floor(rnd() * e.clues.length)]);
      break;
    }
    let stall = 0;
    while (stall < 6) {
      const cands = [];
      for (let i = 0; i < G.g.length; i++) {
        const ch = G.g[i];
        if (!isLetter(ch)) continue;
        const r = Math.floor(i / W), c = i % W;
        for (const dir of ["a", "d"]) {
          if (G.dirAt[i] & (dir === "a" ? 1 : 2)) continue;
          const pool = DICT.byLetter[ch] || [];
          // случайная выборка из пула, чтобы не перебирать всё
          const n = Math.min(pool.length, 90), off = Math.floor(rnd() * pool.length);
          for (let q = 0; q < n; q++) {
            const [wi, p] = pool[(off + q * 7) % pool.length];
            const e = list[wi];
            if (G.used.has(e.word)) continue;
            const sr = dir === "d" ? r - p : r, sc = dir === "a" ? c - p : c;
            const cross = check(G, e.word, sr, sc, dir);
            if (cross < 1) continue;
            const spot = pickClueSpot(G, sr, sc, dir);
            if (!spot) continue;
            let s = cross * 9 + e.word.length * 2 + rnd() * 6;
            if (themeWords.has(e.word)) s += 14;
            if (spot[2].length > 1) s -= 2;
            cands.push([s, wi, sr, sc, dir, spot]);
          }
        }
      }
      if (!cands.length) { stall++; if (!fillGaps(G, rnd, themeWords)) break; continue; }
      cands.sort((x, y) => y[0] - x[0]);
      const k = Math.floor(rnd() * Math.min(3, cands.length));
      const [, wi, sr, sc, dir, spot] = cands[k];
      const e = list[wi];
      if (check(G, e.word, sr, sc, dir) < 1) continue;
      place(G, wi, e.word, sr, sc, dir, spot, e.clues[Math.floor(rnd() * e.clues.length)]);
      stall = 0;
    }
    return G;
  }

  // Пытается вписать слово в пустой участок, даже без пересечения.
  function fillGaps(G, rnd, themeWords) {
    const list = DICT.list;
    const order = [];
    for (let i = 0; i < G.g.length; i++) if (G.g[i] === EMPTY && !G.clue[i]) order.push(i);
    for (let n = order.length - 1; n > 0; n--) { const j = Math.floor(rnd() * (n + 1)); [order[n], order[j]] = [order[j], order[n]]; }
    for (const i of order) {
      const r = Math.floor(i / G.W), c = i % G.W;
      for (const dir of (rnd() < 0.5 ? ["a", "d"] : ["d", "a"])) {
        let room = 0;
        for (let k = 0; ; k++) {
          const rr = dir === "d" ? r + k : r, cc = dir === "a" ? c + k : c;
          if (!inside(G, rr, cc)) break;
          const v = G.g[idx(G, rr, cc)];
          if (v === BLOCK || G.clue[idx(G, rr, cc)]) break;
          room++;
        }
        if (room < 2) continue;
        const spot = pickClueSpot(G, r, c, dir);
        if (!spot) continue;
        for (let L = Math.min(room, 9); L >= 2; L--) {
          const pool = DICT.byLen[L] || [];
          if (!pool.length) continue;
          const off = Math.floor(rnd() * pool.length);
          for (let q = 0; q < pool.length; q++) {
            const wi = pool[(off + q) % pool.length], e = list[wi];
            if (G.used.has(e.word)) continue;
            if (check(G, e.word, r, c, dir) < 0) continue;
            const sp = pickClueSpot(G, r, c, dir); if (!sp) break;
            place(G, wi, e.word, r, c, dir, sp, e.clues[Math.floor(rnd() * e.clues.length)]);
            return true;
          }
        }
      }
    }
    return false;
  }
  function checkFree(G, word, r, c, dir) {
    const cr = check(G, word, r, c, dir);
    if (cr >= 0) return cr;
    // check() требует хотя бы одну пустую клетку — этого достаточно и для слова без пересечений
    return -1;
  }

  function finish(G, opts) {
    const cells = [];
    for (let r = 0; r < G.H; r++) for (let c = 0; c < G.W; c++) {
      const i = idx(G, r, c), v = G.g[i];
      if (isLetter(v)) cells.push({ t: "L", a: v });
      else if (G.clue[i]) cells.push({ t: "C", q: G.clue[i].slice() });
      else cells.push({ t: "E" });
    }
    const words = G.words.map(w => ({ id: w.id, word: w.word, clue: w.clue, r: w.r, c: w.c, dir: w.dir, cr: w.cr, cc: w.cc, arrow: w.arrow }));
    // порядок вопросов в клетке: сначала горизонтальный, потом вертикальный
    cells.forEach(cl => { if (cl.t === "C") cl.q.sort((a, b) => (words[a].dir === "a" ? 0 : 1) - (words[b].dir === "a" ? 0 : 1)); });
    let letters = 0; cells.forEach(c => { if (c.t === "L") letters++; });
    return { w: G.W, h: G.H, cells, words, density: Math.round(100 * (cells.length - cells.filter(c => c.t === "E").length) / cells.length) };
  }

  const api = { loadDict, generate, hashStr, mulberry32 };
  if (typeof module !== "undefined") module.exports = api; else root.SkanEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
