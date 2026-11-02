// Сканворды: интерфейс, игра, сохранение, подсказки, отправка результата.
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const E = window.SkanEngine;
  E.loadDict(window.SKAN_WORDS);
  const HOME = "https://ravettikeney-sudo.github.io/skanvordy/";
  const CARDS = "https://ravettikeney-sudo.github.io/otkrytki/";
  const APP = window.SkanApp || null;   // мост Android-приложения (если открыто в APK)

  // ---------- хранилище ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sk." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("sk." + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem("sk." + k); } catch (e) { } }
  };
  const S = Object.assign({ fs: 1, theme: "auto", skip: true, easy: false, sound: true, vibro: true, remind: "10:00" }, store.get("set", {}));
  const ST = Object.assign({ solved: 0, streak: 0, best: 0, lastDaily: "", hints: 5, gift: "", free: {}, words: 0 }, store.get("stats", {}));
  const saveSet = () => { store.set("set", S); applySet(); };
  const saveStats = () => store.set("stats", ST);

  function applySet() {
    document.documentElement.style.setProperty("--fs", S.fs);
    if (S.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", S.theme);
    const dark = S.theme === "dark" || (S.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]').content = dark ? "#0E1730" : "#EEF3FB";
  }
  applySet();
  if (APP && APP.setDaily) try { APP.setDaily(S.remind || ""); } catch (e) { }

  // ---------- даты ----------
  const pad = n => String(n).padStart(2, "0");
  const dstr = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => dstr(new Date());
  const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const human = s => { const d = parseD(s); return d.getDate() + " " + MONTHS[d.getMonth()]; };
  const tfmt = t => Math.floor(t / 60) + ":" + pad(t % 60);
  function plural(n, a, b, c) { n = Math.abs(n) % 100; const k = n % 10; if (n > 10 && n < 20) return c; if (k > 1 && k < 5) return b; if (k === 1) return a; return c; }

  // Православная Пасха (по новому стилю)
  function easter(y) {
    const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    const m = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
    const dt = new Date(y, m - 1, day); dt.setDate(dt.getDate() + 13); return dt;
  }
  function themeOn(th, s) {
    if (th.dates === "always") return false;
    const d = parseD(s), y = d.getFullYear();
    if (th.dates.startsWith("easter")) {
      const ed = easter(y), diff = Math.round((d - ed) / 864e5);
      return diff >= -3 && diff <= 3;
    }
    const [a, b] = th.dates.split("..");
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    const A = pa[0] * 100 + pa[1], B = pb[0] * 100 + pb[1];
    return A <= B ? md >= A && md <= B : md >= A || md <= B;
  }
  const THEMES = window.SKAN_WORDS.themes;
  const themeFor = s => THEMES.find(t => themeOn(t, s)) || null;

  // ---------- сканворды ----------
  const SIZES = { s: { w: 8, h: 10, name: "Малый", note: "10 минут" }, m: { w: 9, h: 12, name: "Средний", note: "15 минут" }, l: { w: 10, h: 13, name: "Большой", note: "20 минут" } };

  function makeRec(id, kind, seed, size, theme, date) {
    const z = SIZES[size];
    const p = E.generate(seed, { w: z.w, h: z.h, tries: kind === "daily" ? 50 : 24, themeWords: theme ? theme.words : [] });
    return { id, kind, seed, size, theme: theme ? theme.id : null, date: date || null, p, e: p.cells.map(() => ""), rev: [], solved: [], t: 0, hu: 0, done: false, ts: Date.now() };
  }
  const loadRec = id => store.get("p." + id, null);
  function saveRec(r) {
    store.set("p." + r.id, r);
    if (r.kind !== "daily") {
      let l = store.get("list", []).filter(x => x !== r.id);
      if (!r.done) l.unshift(r.id);
      l.slice(12).forEach(x => store.del("p." + x));
      store.set("list", l.slice(0, 12));
    }
  }
  function withLoader(text, fn) {
    $("#loaderText").textContent = text; $("#loader").classList.add("on");
    setTimeout(() => { try { fn(); } finally { $("#loader").classList.remove("on"); } }, 40);
  }
  function openDaily(s) {
    let r = loadRec("d" + s);
    if (r) return startGame(r);
    withLoader("Составляю сканворд дня…", () => {
      const th = themeFor(s);
      r = makeRec("d" + s, "daily", "daily-" + s, "m", th, s);
      saveRec(r); startGame(r);
    });
  }
  function openFree(size, seed, themeId) {
    const th = themeId ? THEMES.find(t => t.id === themeId) : null;
    seed = seed || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    const id = "f" + (themeId ? themeId + "-" : "") + size + "-" + seed;
    let r = loadRec(id);
    if (r) return startGame(r);
    withLoader(th ? "Составляю праздничный сканворд…" : "Составляю новый сканворд…", () => {
      r = makeRec(id, th ? "theme" : "free", (th ? th.id + "-" : "") + seed, size, th, null);
      saveRec(r); startGame(r);
    });
  }

  // ---------- главная ----------
  function miniGrid(p, filledFrac) {
    const el = document.createElement("div"); el.className = "mini";
    el.style.gridTemplateColumns = `repeat(${p.w},1fr)`;
    let k = 0;
    p.cells.forEach(c => { const s = document.createElement("span"); if (c.t === "C") s.className = "c"; else if (c.t === "L") { s.className = (k++ / 60) < filledFrac ? "f" : "l"; } el.appendChild(s); });
    return el;
  }
  function progress(r) {
    const L = r.p.cells.filter(c => c.t === "L").length;
    const f = r.p.cells.reduce((n, c, i) => n + (c.t === "L" && r.e[i] ? 1 : 0), 0);
    return L ? f / L : 0;
  }
  function renderHome() {
    const s = today(), d = parseD(s), th = themeFor(s), r = loadRec("d" + s);
    const box = $("#today"); box.innerHTML = "";
    const left = document.createElement("div");
    const pr = r ? progress(r) : 0;
    left.innerHTML = `<div class="when">${d.getDate()} ${MONTHS[d.getMonth()]}, ${WD[d.getDay()]}</div>
      <h1>Сканворд дня</h1>
      ${th ? `<div class="badge">${th.emoji} ${th.name}</div>` : ""}
      <div class="meta">${r && r.done ? "Решён за " + tfmt(r.t) + ". Завтра будет новый." : r ? "Решено " + Math.round(pr * 100) + "%. Продолжим?" : "Один на всех: сравните время с друзьями."}</div>`;
    box.appendChild(left);
    const mg = { w: 9, cells: [] };
    if (r) box.appendChild(miniGrid(r.p, r.done ? 1 : pr));
    else { const fake = E.generate("preview-" + s, { w: 9, h: 12, tries: 1 }); box.appendChild(miniGrid(fake, 0)); }
    const go = document.createElement("button"); go.className = "big go";
    go.textContent = r && r.done ? "Посмотреть решение" : r ? "Продолжить" : "Решать";
    go.onclick = () => openDaily(s); box.appendChild(go);
    void mg;

    $("#sizes").innerHTML = "";
    Object.entries(SIZES).forEach(([k, z]) => {
      const b = document.createElement("button"); b.className = "size";
      const g = Array.from({ length: (z.w - 5) * (z.h - 7) }, () => "<span></span>").join("");
      b.innerHTML = `<div class="g" style="grid-template-columns:repeat(${z.w - 5},7px)">${g}</div><b>${z.name}</b><small>${z.w}×${z.h}<br>≈ ${z.note}</small>`;
      b.onclick = () => openFree(k); $("#sizes").appendChild(b);
    });

    $("#themes").innerHTML = "";
    const order = THEMES.slice().sort((a, b) => (themeOn(b, s) ? 1 : 0) - (themeOn(a, s) ? 1 : 0));
    order.forEach(t => {
      const b = document.createElement("button"); b.className = "theme" + (themeOn(t, s) ? " now" : "");
      b.innerHTML = `<div class="e">${t.emoji}</div><b>${t.name}</b>`;
      b.onclick = () => openFree("m", null, t.id); $("#themes").appendChild(b);
    });

    const list = store.get("list", []).map(loadRec).filter(x => x && !x.done);
    $("#contWrap").classList.toggle("hidden", !list.length);
    $("#cont").innerHTML = "";
    list.slice(0, 5).forEach(x => {
      const th2 = x.theme ? THEMES.find(t => t.id === x.theme) : null;
      const b = document.createElement("button"); b.className = "row";
      const pr2 = progress(x);
      b.innerHTML = `<div class="t"><b>${th2 ? th2.emoji + " " + th2.name : SIZES[x.size].name + " сканворд"}</b><small>Решено ${Math.round(pr2 * 100)}%, ${tfmt(x.t)}</small><div class="bar"><i style="width:${Math.round(pr2 * 100)}%"></i></div></div>`;
      b.onclick = () => startGame(x); $("#cont").appendChild(b);
    });

    const days = $("#days"); days.innerHTML = "";
    const first = new Date(d); first.setDate(d.getDate() - 27);
    for (let i = 0; i < 28; i++) {
      const x = new Date(first); x.setDate(first.getDate() + i);
      const ds = dstr(x), rr = loadRec("d" + ds);
      const b = document.createElement("button");
      b.className = "day" + (rr && rr.done ? " done" : rr ? " part" : "") + (ds === s ? " cur" : "");
      b.textContent = x.getDate(); b.setAttribute("aria-label", "Сканворд " + human(ds));
      b.onclick = () => openDaily(ds); days.appendChild(b);
    }
    const streak = ST.lastDaily && (ST.lastDaily === s || ST.lastDaily === dstr(new Date(d.getTime() - 864e5))) ? ST.streak : 0;
    $("#stats").innerHTML = `<div class="stat"><b>${ST.solved}</b><small>${plural(ST.solved, "сканворд", "сканворда", "сканвордов")} решено</small></div>
      <div class="stat"><b>${streak}</b><small>${plural(streak, "день", "дня", "дней")} подряд</small></div>
      <div class="stat"><b>${ST.best ? tfmt(ST.best) : "—"}</b><small>лучшее время дня</small></div>`;
  }

  // ---------- игра ----------
  let R = null, P = null, at = [], cur = { w: 0, k: 0 }, timer = null, zoom = false, bad = new Set(), dirty = false;
  const isRev = i => R.rev.indexOf(i) >= 0;

  function startGame(r) {
    R = r; P = r.p; bad = new Set(); zoom = false;
    at = P.cells.map(() => ({}));
    P.words.forEach(w => { for (let k = 0; k < w.word.length; k++) { const i = cellOf(w, k); at[i][w.dir] = w.id; } });
    const th = r.theme ? THEMES.find(t => t.id === r.theme) : null;
    $("#gTitle").textContent = r.kind === "daily" ? (th ? th.emoji + " " : "") + "Сканворд " + human(r.date) : th ? th.emoji + " " + th.name : SIZES[r.size].name + " сканворд";
    show("game");
    buildGrid();
    const first = P.words.find(w => R.solved.indexOf(w.id) < 0) || P.words[0];
    select(first.id, firstEmpty(first));
    updHints(); tick(true);
    history.replaceState(null, "", r.kind === "daily" ? "?d=" + r.date : location.pathname);
    if (r.done) setTimeout(() => showWin(false), 300);
  }
  const cellOf = (w, k) => (w.r + (w.dir === "d" ? k : 0)) * P.w + w.c + (w.dir === "a" ? k : 0);
  const firstEmpty = w => { for (let k = 0; k < w.word.length; k++) if (!R.e[cellOf(w, k)]) return k; return 0; };

  function cellSize() {
    const b = $("#board"), W = b.clientWidth - 16, H = b.clientHeight - 14;
    let cs = Math.floor(Math.min((W - P.w - 3) / P.w, (H - P.h - 3) / P.h));
    cs = Math.max(cs, 26);
    if (zoom) cs = Math.max(cs + 14, Math.round(56 * S.fs));
    return cs;
  }
  function buildGrid() {
    const g = $("#grid"); g.innerHTML = "";
    const cs = cellSize();
    g.style.setProperty("--cs", cs + "px");
    $("#gridbox").style.setProperty("--cs", cs + "px");
    g.style.gridTemplateColumns = `repeat(${P.w},${cs}px)`;
    P.cells.forEach((c, i) => {
      const d = document.createElement("div"); d.className = "cell " + c.t; d.dataset.i = i;
      if (c.t === "C") c.q.forEach(id => { const q = document.createElement("div"); q.className = "q"; q.dataset.w = id; q.textContent = P.words[id].clue; d.appendChild(q); });
      g.appendChild(d);
    });
    fitClues(); drawArrows(cs); paint();
  }
  function fitClues() {
    document.querySelectorAll(".cell.C .q").forEach(q => {
      let fs = parseFloat(getComputedStyle(q).fontSize), n = 0;
      while ((q.scrollHeight > q.clientHeight + 1 || q.scrollWidth > q.clientWidth + 1) && fs > 6 && n++ < 14) { fs -= 0.5; q.style.fontSize = fs + "px"; }
    });
  }
  function drawArrows(cs) {
    const sv = $("#arrows"), st = cs + 1, o = 2;
    const W = P.w * st + 3, H = P.h * st + 3;
    sv.setAttribute("viewBox", `0 0 ${W} ${H}`); sv.setAttribute("width", W); sv.setAttribute("height", H);
    let out = "";
    const a = Math.max(4, cs * 0.12);
    const head = (x, y, dir) => {
      const pts = dir === "r" ? [[x, y - a * .7], [x + a, y], [x, y + a * .7]] : dir === "d" ? [[x - a * .7, y], [x, y + a], [x + a * .7, y]] : dir === "l" ? [[x, y - a * .7], [x - a, y], [x, y + a * .7]] : [[x - a * .7, y], [x, y - a], [x + a * .7, y]];
      return `<path class="h" d="M${pts.map(p => p.join(",")).join("L")}Z"/>`;
    };
    P.words.forEach(w => {
      const q = P.cells[w.cr * P.w + w.cc].q, two = q.length > 1, slot = q.indexOf(w.id);
      const x0 = o + w.cc * st, y0 = o + w.cr * st;           // клетка вопроса
      const sx = o + w.c * st, sy = o + w.r * st;              // первая буква
      const my = two ? y0 + (slot === 0 ? cs * .25 : cs * .75) : y0 + cs / 2;
      if (w.arrow === "r") out += head(sx + 1, my, "r");
      else if (w.arrow === "d") out += head(x0 + cs / 2, sy + 1, "d");
      else if (w.arrow === "dr") { const x = sx + cs * .2; out += `<path d="M${x},${sy - 2}V${sy + cs * .2}H${sx + cs * .32}"/>` + head(sx + cs * .32, sy + cs * .2, "r"); }
      else if (w.arrow === "ur") { const x = sx + cs * .2, yb = sy + cs + 2; out += `<path d="M${x},${yb}V${sy + cs * .8}H${sx + cs * .32}"/>` + head(sx + cs * .32, sy + cs * .8, "r"); }
      else if (w.arrow === "rd") { const y = sy + cs * .2; out += `<path d="M${sx - 2},${y}H${sx + cs * .2}V${sy + cs * .32}"/>` + head(sx + cs * .2, sy + cs * .32, "d"); }
      else if (w.arrow === "ld") { const y = sy + cs * .2, xr = sx + cs + 2; out += `<path d="M${xr},${y}H${sx + cs * .8}V${sy + cs * .32}"/>` + head(sx + cs * .8, sy + cs * .32, "d"); }
    });
    sv.innerHTML = out;
  }

  function paint() {
    const w = P.words[cur.w], inW = new Set();
    for (let k = 0; k < w.word.length; k++) inW.add(cellOf(w, k));
    const ci = cellOf(w, cur.k);
    const solvedCells = new Set();
    R.solved.forEach(id => { const x = P.words[id]; for (let k = 0; k < x.word.length; k++) solvedCells.add(cellOf(x, k)); });
    const els = $("#grid").children;
    P.cells.forEach((c, i) => {
      const el = els[i];
      if (c.t === "L") {
        const v = R.e[i];
        el.textContent = v;
        el.className = "cell L" + (inW.has(i) ? " w" : "") + (i === ci ? " cur" : "") + (solvedCells.has(i) ? " done ok" : "") + (isRev(i) ? " rev" : "") +
          (v && (bad.has(i) || (S.easy && v !== c.a)) ? " bad" : "");
      } else if (c.t === "C") {
        for (const q of el.children) { const id = +q.dataset.w; q.className = "q" + (id === cur.w ? " act" : "") + (R.solved.indexOf(id) >= 0 ? " solved" : ""); }
      }
    });
    const ct = $("#clueText"), done = R.solved.indexOf(w.id) >= 0;
    ct.className = "cluetext" + (done ? " done" : "");
    ct.querySelector("b").textContent = w.clue;
    ct.querySelector("small").textContent = (done ? "Отгадано: " + w.word : w.word.length + " " + plural(w.word.length, "буква", "буквы", "букв")) + (w.dir === "a" ? ", по горизонтали" : ", по вертикали");
    if (zoom) { const el = els[ci]; if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" }); }
  }

  function select(id, k) { cur = { w: id, k: k == null ? firstEmpty(P.words[id]) : k }; paint(); }

  function tapCell(i) {
    const c = P.cells[i];
    if (c.t === "C") {
      const q = c.q; let id = q[0];
      if (q.length > 1 && q.indexOf(cur.w) === 0) id = q[1];
      return select(id);
    }
    if (c.t !== "L") return;
    const ids = at[i], w = P.words[cur.w];
    const inCur = ids[w.dir] === cur.w;
    let id;
    if (inCur && cellOf(w, cur.k) === i && ids[w.dir === "a" ? "d" : "a"] != null) id = ids[w.dir === "a" ? "d" : "a"];
    else if (inCur) id = cur.w;
    else id = ids.a != null ? ids.a : ids.d;
    const x = P.words[id];
    let k = 0; for (; k < x.word.length; k++) if (cellOf(x, k) === i) break;
    select(id, k);
  }

  function locked(i) {
    if (isRev(i)) return true;
    return R.solved.some(id => { const x = P.words[id]; for (let k = 0; k < x.word.length; k++) if (cellOf(x, k) === i) return true; return false; });
  }

  function type(ch) {
    if (R.done) return;
    const w = P.words[cur.w];
    let i = cellOf(w, cur.k);
    if (locked(i)) { // перескочить на свободную клетку
      let k = cur.k; while (k < w.word.length && locked(cellOf(w, k))) k++;
      if (k >= w.word.length) return nextWord(1);
      cur.k = k; i = cellOf(w, k);
    }
    R.e[i] = ch; bad.delete(i); dirty = true;
    buzz(8);
    const solvedNow = checkWords(i);
    if (R.done) return;
    if (solvedNow && R.solved.indexOf(cur.w) >= 0) { save(); return setTimeout(() => nextWord(1, true), 260); }
    let k = cur.k + 1;
    while (k < w.word.length && (locked(cellOf(w, k)) || (S.skip && R.e[cellOf(w, k)]))) k++;
    if (k < w.word.length) cur.k = k;
    else if (cur.k < w.word.length - 1) cur.k = Math.min(cur.k + 1, w.word.length - 1);
    paint(); save();
  }
  function erase() {
    if (R.done) return;
    const w = P.words[cur.w];
    let i = cellOf(w, cur.k);
    if (!R.e[i] || locked(i)) {
      let k = cur.k - 1; while (k >= 0 && locked(cellOf(w, k))) k--;
      if (k < 0) { paint(); return; }
      cur.k = k; i = cellOf(w, k);
    }
    if (!locked(i)) { R.e[i] = ""; bad.delete(i); }
    buzz(5); paint(); save();
  }
  function checkWords(i) {
    let any = false;
    ["a", "d"].forEach(dir => {
      const id = at[i][dir]; if (id == null || R.solved.indexOf(id) >= 0) return;
      const x = P.words[id]; let ok = true;
      for (let k = 0; k < x.word.length; k++) if (R.e[cellOf(x, k)] !== x.word[k]) { ok = false; break; }
      if (ok) { R.solved.push(id); any = true; ST.words++; }
    });
    if (any) { ding(); if (R.solved.length === P.words.length) finish(); }
    return any;
  }
  function nextWord(d, skipSolved) {
    const n = P.words.length;
    let id = cur.w;
    for (let s = 0; s < n; s++) {
      id = (id + d + n) % n;
      if (!skipSolved || R.solved.indexOf(id) < 0) break;
    }
    select(id);
  }

  // ---------- таймер и сохранение ----------
  let lastTick = 0;
  function tick(reset) {
    clearInterval(timer);
    lastTick = Date.now();
    $("#gTime").textContent = timeLabel();
    if (R.done) return;
    timer = setInterval(() => {
      if (document.hidden || !$("#game").classList.contains("on") || $("#sheetbg").classList.contains("on")) { lastTick = Date.now(); return; }
      const now = Date.now(); R.t += Math.round((now - lastTick) / 1000); lastTick = now;
      $("#gTime").textContent = timeLabel();
      if (R.t % 10 === 0) save();
    }, 1000);
    void reset;
  }
  const timeLabel = () => tfmt(R.t) + ", отгадано " + R.solved.length + " из " + P.words.length;
  function save() { if (R) { R.ts = Date.now(); saveRec(R); saveStats(); } }

  // ---------- подсказки ----------
  function updHints() { $("#hintCount").textContent = ST.hints; }
  function useHint(n) {
    if (ST.hints < n) { toast("Подсказки закончились"); return false; }
    ST.hints -= n; R.hu += n; updHints(); saveStats(); return true;
  }
  function revealCell(i) { const c = P.cells[i]; R.e[i] = c.a; if (!isRev(i)) R.rev.push(i); bad.delete(i); }
  function hintLetter() {
    const w = P.words[cur.w];
    let k = cur.k, i = cellOf(w, k);
    if (R.e[i] === P.cells[i].a) { k = -1; for (let j = 0; j < w.word.length; j++) { const ii = cellOf(w, j); if (R.e[ii] !== P.cells[ii].a) { k = j; break; } } }
    if (k < 0) { toast("В этом слове всё верно"); return; }
    if (!useHint(1)) return;
    i = cellOf(w, k); revealCell(i); cur.k = k;
    closeSheet(); checkWords(i); paint(); save();
  }
  function hintWord() {
    const w = P.words[cur.w];
    if (R.solved.indexOf(w.id) >= 0) { toast("Это слово уже отгадано"); return; }
    if (!useHint(3)) return;
    for (let k = 0; k < w.word.length; k++) revealCell(cellOf(w, k));
    closeSheet();
    for (let k = 0; k < w.word.length; k++) checkWords(cellOf(w, k));
    if (!R.done) { paint(); save(); setTimeout(() => nextWord(1, true), 300); }
  }
  function checkAll() {
    bad = new Set(); let n = 0;
    P.cells.forEach((c, i) => { if (c.t === "L" && R.e[i] && R.e[i] !== c.a) { bad.add(i); n++; } });
    closeSheet(); paint();
    toast(n ? "Ошибок: " + n + ". Они подчёркнуты красным" : "Ошибок нет, так держать!");
  }
  function giftToday() { return ST.gift !== today(); }
  function takeGift() { ST.gift = today(); ST.hints += 2; saveStats(); updHints(); toast("+2 подсказки. Приходите завтра за новыми!"); hintSheet(); }
  function freeLeft() { const f = ST.free || {}; return f.d === today() ? 3 - f.n : 3; }
  function getMore() {
    if (APP && APP.hasAds && APP.hasAds()) {
      window.onRewarded = ok => { if (ok) { ST.hints += 3; saveStats(); updHints(); toast("+3 подсказки"); hintSheet(); } else toast("Видео не досмотрено, подсказки не начислены"); };
      try { APP.showRewarded(); } catch (e) { toast("Видео сейчас недоступно"); }
      return;
    }
    if (freeLeft() <= 0) { toast("На сегодня всё. Завтра будут ещё"); return; }
    const f = ST.free && ST.free.d === today() ? ST.free : { d: today(), n: 0 };
    f.n++; ST.free = f; ST.hints += 3; saveStats(); updHints(); toast("+3 подсказки"); hintSheet();
  }
  function hintSheet() {
    const ads = APP && APP.hasAds && APP.hasAds();
    openSheet(`<h2>Подсказки</h2><p>У вас ${ST.hints} ${plural(ST.hints, "подсказка", "подсказки", "подсказок")}. За каждый решённый сканворд дарим ещё одну.</p>
      <button class="opt" id="hL"><span class="ic">А</span><span class="t"><b>Открыть букву</b><small>В выбранной клетке</small></span><span class="cost">1</span></button>
      <button class="opt" id="hW"><span class="ic">АБВ</span><span class="t"><b>Открыть слово</b><small>Всё выделенное слово</small></span><span class="cost">3</span></button>
      <button class="opt" id="hC"><span class="ic">✓</span><span class="t"><b>Проверить ошибки</b><small>Подчеркнём неверные буквы</small></span><span class="cost">даром</span></button>
      ${giftToday() ? `<button class="opt gift" id="hG"><span class="ic">🎁</span><span class="t"><b>Подарок дня</b><small>Раз в день, просто так</small></span><span class="cost">+2</span></button>` : ""}
      <button class="opt" id="hM" ${!ads && freeLeft() <= 0 ? "disabled" : ""}><span class="ic">${ads ? "▶" : "＋"}</span><span class="t"><b>${ads ? "Посмотреть короткое видео" : "Получить ещё"}</b><small>${ads ? "После видео начислим подсказки" : "Осталось сегодня: " + Math.max(0, freeLeft())}</small></span><span class="cost">+3</span></button>`);
    $("#hL").onclick = hintLetter; $("#hW").onclick = hintWord; $("#hC").onclick = checkAll; $("#hM").onclick = getMore;
    if ($("#hG")) $("#hG").onclick = takeGift;
  }

  // ---------- финал ----------
  function finish() {
    R.done = true; clearInterval(timer);
    ST.solved++; ST.hints += 1;
    if (R.kind === "daily" && R.date === today()) {
      const y = dstr(new Date(Date.now() - 864e5));
      ST.streak = ST.lastDaily === y ? ST.streak + 1 : ST.lastDaily === today() ? ST.streak : 1;
      ST.lastDaily = today();
      if (!ST.best || R.t < ST.best) ST.best = R.t;
    }
    save(); paint(); updHints(); $("#gTime").textContent = timeLabel();
    buzz([20, 40, 30]);
    setTimeout(() => { confetti(); showWin(true); }, 450);
  }
  function shareText() {
    const th = R.theme ? THEMES.find(t => t.id === R.theme) : null;
    const title = R.kind === "daily" ? "Сканворд дня, " + human(R.date) : th ? th.name : SIZES[R.size].name + " сканворд";
    const link = R.kind === "daily" ? HOME + "?d=" + R.date : HOME + "?s=" + encodeURIComponent(freeSeed()) + "&z=" + R.size + (R.theme ? "&t=" + R.theme : "");
    const stars = R.hu === 0 ? "⭐⭐⭐" : R.hu <= 3 ? "⭐⭐" : "⭐";
    return `🧩 ${title}\nРешил(а) за ${tfmt(R.t)} ${stars}\n${R.hu ? "Подсказок: " + R.hu : "Без единой подсказки!"}\nСможете быстрее? ${link}`;
  }
  function freeSeed() { return R.theme ? R.seed.slice(R.theme.length + 1) : R.seed; }
  function share() {
    const txt = shareText();
    if (APP && APP.shareText) { try { APP.shareText(txt); return; } catch (e) { } }
    if (navigator.share) { navigator.share({ text: txt }).catch(() => { }); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("Скопировано. Вставьте в WhatsApp или Telegram"));
    window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
  }
  function showWin(fresh) {
    const th = R.theme ? THEMES.find(t => t.id === R.theme) : null;
    const stars = R.hu === 0 ? 3 : R.hu <= 3 ? 2 : 1;
    openSheet(`<div class="win"><div class="medal">${th ? th.emoji : "★"}</div>
      <h2>${fresh ? "Сканворд решён!" : "Этот сканворд уже решён"}</h2>
      <p>${"⭐".repeat(stars)}${R.kind === "daily" && ST.lastDaily === today() && ST.streak > 1 ? "<br>Вы решаете " + ST.streak + " " + plural(ST.streak, "день", "дня", "дней") + " подряд" : ""}</p>
      <div class="nums"><div><b>${tfmt(R.t)}</b><small>время</small></div><div><b>${P.words.length}</b><small>${plural(P.words.length, "слово", "слова", "слов")}</small></div><div><b>${R.hu}</b><small>${plural(R.hu, "подсказка", "подсказки", "подсказок")}</small></div></div>
      <button class="big" id="wShare">Отправить результат друзьям</button>
      ${th ? `<button class="big alt" id="wCard">${th.emoji} Отправить открытку к празднику</button>` : ""}
      <button class="big alt" id="wNext">Новый сканворд</button>
      <button class="big alt" id="wHome">На главную</button></div>`);
    $("#wShare").onclick = share;
    if ($("#wCard")) $("#wCard").onclick = () => { const u = CARDS + "?h=" + th.card; if (APP && APP.openUrl) APP.openUrl(u); else window.open(u, "_blank"); };
    $("#wNext").onclick = () => { closeSheet(); openFree(R.size === "s" || R.size === "l" ? R.size : "m", null, R.theme && R.kind === "theme" ? R.theme : null); };
    $("#wHome").onclick = () => { closeSheet(); goHome(); };
  }
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = $("#confetti"); cv.hidden = false; const dpr = devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; const x = cv.getContext("2d"); x.scale(dpr, dpr);
    const cols = ["#FFE066", "#1D3A7A", "#4CC38A", "#FF8A80", "#7FB2FF"];
    const ps = Array.from({ length: 120 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35, vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)], s: 5 + Math.random() * 6 }));
    let f = 0;
    (function fr() {
      x.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
      if (++f < 110) requestAnimationFrame(fr); else cv.hidden = true;
    })();
  }

  // ---------- звук и вибрация ----------
  let ac = null;
  function ding() {
    buzz(25);
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, n) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(.0001, ac.currentTime + n * .09); g.gain.exponentialRampToValueAtTime(.12, ac.currentTime + n * .09 + .02); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + n * .09 + .25); o.connect(g).connect(ac.destination); o.start(ac.currentTime + n * .09); o.stop(ac.currentTime + n * .09 + .3); });
    } catch (e) { }
  }
  function buzz(p) { if (S.vibro && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { } }

  // ---------- окна ----------
  function openSheet(html) { $("#sheet").innerHTML = '<div class="grab"></div>' + html; $("#sheetbg").classList.add("on"); }
  function closeSheet() { $("#sheetbg").classList.remove("on"); }
  $("#sheetbg").addEventListener("click", e => { if (e.target.id === "sheetbg") closeSheet(); });
  let tt = 0;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2600); }

  function settingsSheet() {
    const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(S[key]) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
    const sw = key => `<button class="sw ${S[key] ? "on" : ""}" data-sw="${key}" aria-label="Переключить"></button>`;
    openSheet(`<h2>Настройки</h2>
      <div class="setrow"><div class="t"><b>Размер текста</b><small>И клавиатуры тоже</small></div>${seg("fs", [[1, "А"], [1.12, "А+"], [1.25, "А++"]])}</div>
      <div class="setrow"><div class="t"><b>Тема</b></div>${seg("theme", [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]])}</div>
      <div class="setrow"><div class="t"><b>Лёгкий режим</b><small>Сразу показывать ошибки</small></div>${sw("easy")}</div>
      <div class="setrow"><div class="t"><b>Пропускать заполненные</b><small>Курсор прыгает через буквы</small></div>${sw("skip")}</div>
      <div class="setrow"><div class="t"><b>Звук</b><small>Когда слово отгадано</small></div>${sw("sound")}</div>
      <div class="setrow"><div class="t"><b>Вибрация</b></div>${sw("vibro")}</div>
      ${APP && APP.setDaily ? `<div class="setrow"><div class="t"><b>Напоминать о сканворде дня</b><small>${S.remind ? "Каждый день в это время" : "Выключено"}</small></div><div style="display:flex;gap:8px;align-items:center"><input type="time" id="remT" value="${S.remind || "10:00"}" ${S.remind ? "" : "disabled"}>${sw("remindOn")}</div></div>` : ""}
      <div class="setrow"><div class="t"><b>Слов в базе</b><small>Новые слова приходят с обновлениями</small></div><b>${window.SKAN_WORDS.v}</b></div>`);
    document.querySelectorAll("#sheet .seg button").forEach(b => b.onclick = () => {
      const k = b.parentNode.dataset.k; let v = b.dataset.v; if (k === "fs") v = +v; S[k] = v; saveSet(); settingsSheet(); if (R && $("#game").classList.contains("on")) buildGrid();
    });
    document.querySelectorAll("#sheet [data-sw]").forEach(b => b.onclick = () => {
      const k = b.dataset.sw;
      if (k === "remindOn") { S.remind = S.remind ? "" : ($("#remT").value || "10:00"); try { APP.setDaily(S.remind); } catch (e) { } }
      else S[k] = !S[k];
      saveSet(); settingsSheet(); if (R && $("#game").classList.contains("on")) paint();
    });
    if ($("#remT")) $("#remT").onchange = e => { S.remind = e.target.value; saveSet(); try { APP.setDaily(S.remind); } catch (er) { } };
  }

  // ---------- навигация ----------
  function show(id) { document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id)); }
  function goHome() { if (R) save(); clearInterval(timer); show("home"); renderHome(); history.replaceState(null, "", location.pathname); }
  window.appBack = function () {
    if ($("#sheetbg").classList.contains("on")) { closeSheet(); return true; }
    if ($("#game").classList.contains("on")) { goHome(); return true; }
    return false;
  };

  // ---------- клавиатура ----------
  const ROWS = ["ЙЦУКЕНГШЩЗХ", "ФЫВАПРОЛДЖЭ", "ЯЧСМИТЬБЮЪ"];
  const kb = $("#kbd");
  ROWS.forEach((row, n) => {
    const r = document.createElement("div"); r.className = "r";
    row.split("").forEach(ch => { const b = document.createElement("button"); b.textContent = ch; b.dataset.k = ch; r.appendChild(b); });
    if (n === 2) { const d = document.createElement("button"); d.className = "del"; d.dataset.k = "del"; d.setAttribute("aria-label", "Стереть"); d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M13 10l4 4M17 10l-4 4"/></svg>'; r.appendChild(d); }
    kb.appendChild(r);
  });
  kb.addEventListener("pointerdown", e => {
    const b = e.target.closest("button"); if (!b) return; e.preventDefault();
    b.classList.add("p"); setTimeout(() => b.classList.remove("p"), 120);
    if (b.dataset.k === "del") erase(); else type(b.dataset.k);
  });
  document.addEventListener("keydown", e => {
    if (!$("#game").classList.contains("on") || $("#sheetbg").classList.contains("on")) { if (e.key === "Escape") window.appBack(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let k = e.key.toUpperCase().replace("Ё", "Е");
    if (/^[А-Я]$/.test(k)) { e.preventDefault(); type(k); }
    else if (e.key === "Backspace") { e.preventDefault(); erase(); }
    else if (e.key === "ArrowRight" || e.key === "Tab" || e.key === "Enter") { e.preventDefault(); nextWord(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); nextWord(-1); }
    else if (e.key === "Escape") window.appBack();
  });

  $("#grid").addEventListener("click", e => {
    const q = e.target.closest(".q"); if (q) return select(+q.dataset.w);
    const c = e.target.closest(".cell"); if (c) tapCell(+c.dataset.i);
  });
  $("#back").onclick = goHome;
  $("#prevW").onclick = () => nextWord(-1);
  $("#nextW").onclick = () => nextWord(1);
  $("#hintBtn").onclick = () => R && !R.done ? hintSheet() : R && showWin(false);
  $("#zoom").onclick = () => { zoom = !zoom; $("#zoomPlus").setAttribute("d", zoom ? "M20 20l-4-4M8 11h6" : "M20 20l-4-4M11 8v6M8 11h6"); buildGrid(); };
  $("#openSettings").onclick = settingsSheet;
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (R && $("#game").classList.contains("on")) buildGrid(); }, 150); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && R) save(); else if ($("#home").classList.contains("on")) renderHome(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySet);

  // ---------- старт ----------
  renderHome();
  const qs = new URLSearchParams(location.search);
  const qd = qs.get("d"), qsd = qs.get("s");
  if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) && qd <= today()) openDaily(qd);
  else if (qsd) openFree(SIZES[qs.get("z")] ? qs.get("z") : "m", qsd.slice(0, 40), THEMES.some(t => t.id === qs.get("t")) ? qs.get("t") : null);
  else if (qs.get("play") === "daily") openDaily(today());

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
  window.SkanDebug = { get R() { return R; }, finish: () => { P.cells.forEach((c, i) => { if (c.t === "L") R.e[i] = c.a; }); R.solved = P.words.map(w => w.id); finish(); } };
})();
