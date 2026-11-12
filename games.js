// Другие головоломки: филворд, чайнворд, «Слова из слова», японский кроссворд, судоку.
// А ещё главная: выбор игры, тематические подборки, «Игра дня».
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const SK = () => window.SK;
  const EN = window.SkanEngine;
  const rng = seed => EN.mulberry32(EN.hashStr(String(seed)));
  const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const newSeed = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- словарь ----------
  const WL = window.SKAN_WORDS.w.map(([word, ...clues]) => ({ word, clues }));
  const BYW = {}; WL.forEach(e => BYW[e.word] = e);
  const BYLEN = {}; WL.forEach(e => (BYLEN[e.word.length] = BYLEN[e.word.length] || []).push(e));
  const themeOf = id => id ? SK().THEMES.find(t => t.id === id) : null;
  const themeSet = id => { const t = themeOf(id); return new Set(t ? t.words : []); };

  // ---------- игры ----------
  const GAMES = {
    scan: { name: "Сканворд", short: "Вопросы в клетках", desc: "Вопросы стоят прямо в клетках, стрелки показывают, куда вписывать ответ.", sizes: [["s", "Малый", "8×10"], ["m", "Средний", "9×12"], ["l", "Большой", "10×13"]], themes: true },
    cross: { name: "Кроссворд", short: "Классический, как в газете", desc: "Номера в клетках, вопросы списком: по горизонтали и по вертикали.", sizes: [["s", "Малый", "8×10"], ["m", "Средний", "9×12"], ["l", "Большой", "10×13"]], themes: true },
    fill: { name: "Филворд", short: "Найдите слова в буквах", desc: "Найдите спрятанные слова и проведите по ним пальцем. Слова изгибаются под прямым углом, все буквы поля заняты.", sizes: [["s", "Малый", "6×6"], ["m", "Средний", "8×8"], ["l", "Большой", "10×10"]], themes: true },
    key: { name: "Кейворд", short: "Разгадайте шифр", desc: "Вместо вопросов — числа. Одинаковые числа означают одинаковые буквы. Две буквы уже открыты.", sizes: [["s", "Малый", "8×10"], ["m", "Средний", "9×12"], ["l", "Большой", "10×13"]], themes: true },
    chain: { name: "Чайнворд", short: "Цепочка слов", desc: "Слова идут цепочкой: последняя буква одного слова — первая буква следующего.", sizes: [["s", "Короткий", "8 слов"], ["m", "Средний", "11 слов"], ["l", "Длинный", "14 слов"]], themes: true },
    wfw: { name: "Слова из слова", short: "Составьте слова", desc: "Составьте как можно больше слов из букв длинного слова. Каждую букву можно взять столько раз, сколько она встречается." },
    nono: { name: "Японский", short: "Закрасьте картинку", desc: "Числа слева и сверху показывают, сколько клеток подряд закрашено в строке и столбце. Закрасьте клетки — получится картинка.", sizes: [["s", "Малый", "10×10"], ["l", "Большой", "15×15"]] },
    sudoku: { name: "Судоку", short: "Цифры от 1 до 9", desc: "Расставьте цифры от 1 до 9 так, чтобы они не повторялись ни в строке, ни в столбце, ни в квадрате 3×3.", sizes: [["s", "Лёгкий", ""], ["m", "Средний", ""], ["l", "Сложный", ""]] }
  };
  const ORDER = ["scan", "cross", "fill", "key", "chain", "wfw", "nono", "sudoku"];

  // Маленькие картинки для плиток
  function icon(g) {
    const sq = (x, y, f, t, tc) => `<rect x="${x}" y="${y}" width="13" height="13" rx="2.5" fill="${f}"/>` + (t ? `<text x="${x + 6.5}" y="${y + 10}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${tc || "var(--ink)"}">${t}</text>` : "");
    const L = "var(--paper)", C = "var(--clue)", I = "var(--ink)", M = "var(--marker)";
    let b = "";
    if (g === "scan") b = sq(2, 2, C) + sq(17, 2, L, "К") + sq(32, 2, L, "О") + sq(2, 17, L, "Д") + sq(17, 17, C) + sq(32, 17, L, "Т") + sq(2, 32, L, "А") + sq(17, 32, L, "Р") + sq(32, 32, L, "Ы") + `<path d="M11 8h4l-1.6-1.6M11 8l-1.6 1.6" stroke="var(--ink2)" stroke-width="1.2" fill="none"/>`;
    else if (g === "cross") b = sq(2, 2, L, "1") + sq(17, 2, L) + sq(32, 2, I) + sq(2, 17, L) + sq(17, 17, I) + sq(32, 17, L, "2") + sq(2, 32, L) + sq(17, 32, L) + sq(32, 32, L);
    else if (g === "key") b = sq(2, 2, L, "7") + sq(17, 2, L, "3") + sq(32, 2, I) + sq(2, 17, M, "А", "#1D2A4A") + sq(17, 17, I) + sq(32, 17, L, "3") + sq(2, 32, L, "1") + sq(17, 32, L, "7") + sq(32, 32, L, "5");
    else if (g === "fill") b = sq(2, 2, L, "Л") + sq(17, 2, L, "Е") + sq(32, 2, L, "С") + sq(2, 17, L, "Д") + sq(17, 17, L, "О") + sq(32, 17, L, "М") + sq(2, 32, L, "Ы") + sq(17, 32, L, "М") + sq(32, 32, L, "Ш") + `<path d="M8.5 8.5H23.5V23.5H38.5" stroke="#F4A23A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".5"/>`;
    else if (g === "chain") b = sq(2, 9, L, "С") + sq(17, 9, L, "О") + sq(32, 9, M, "К", "#1D2A4A") + sq(32, 25, L, "О") + sq(17, 25, L, "Т");
    else if (g === "wfw") b = `<rect x="1" y="4" width="46" height="14" rx="3" fill="var(--ink)"/><text x="24" y="14.5" text-anchor="middle" font-size="9" font-weight="700" fill="var(--paper)" letter-spacing="1">СЛОВО</text>` + sq(4, 26, L, "Л") + sq(18, 26, L, "О") + sq(32, 26, L, "В");
    else if (g === "nono") { const p = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"]; p.forEach((row, y) => row.split("").forEach((v, x) => { b += `<rect x="${3 + x * 6}" y="${6 + y * 6}" width="5.4" height="5.4" rx="1" fill="${v === "1" ? "#E2557A" : "var(--line2)"}"/>`; })); }
    else if (g === "sudoku") b = sq(2, 2, L, "5") + sq(17, 2, L, "3") + sq(32, 2, L) + sq(2, 17, L) + sq(17, 17, L, "9") + sq(32, 17, L, "1") + sq(2, 32, L, "8") + sq(17, 32, L) + sq(32, 32, M, "4", "#1D2A4A");
    return `<svg viewBox="0 0 48 48" aria-hidden="true">${b}</svg>`;
  }

  // ---------- главная ----------
  function home(s) {
    // Игра дня
    const dl = $("#dailies"); dl.innerHTML = "";
    [["fill", "Филворд дня"], ["sudoku", "Судоку дня"]].forEach(([g, name]) => {
      const r = SK().loadRec(dailyId(g, s));
      const b = document.createElement("button"); b.className = "dcard";
      b.innerHTML = `<div class="ic">${icon(g)}</div><div class="t"><b>${name}</b><small>${r && r.done ? "Решён за " + SK().tfmt(r.t) + " ✓" : r ? "Продолжить" : "Новый каждый день"}</small></div>`;
      if (r && r.done) b.classList.add("done");
      b.onclick = () => openDaily(g, s); dl.appendChild(b);
    });
    // Плитки игр
    const gs = $("#games"); gs.innerHTML = "";
    ORDER.forEach(g => {
      const b = document.createElement("button"); b.className = "gtile";
      b.innerHTML = `<div class="ic">${icon(g)}</div><b>${GAMES[g].name}</b><small>${GAMES[g].short}</small>`;
      b.onclick = () => gameSheet(g); gs.appendChild(b);
    });
    // Тематические подборки
    const gn = $("#genres"); gn.innerHTML = "";
    SK().GENRES.forEach(t => {
      const b = document.createElement("button"); b.className = "theme";
      b.innerHTML = `<div class="e">${t.emoji}</div><b>${t.name}</b>`;
      b.onclick = () => genreSheet(t); gn.appendChild(b);
    });
  }

  function gameSheet(g, themeId) {
    const G = GAMES[g], last = SK().store.get("gz", {});
    let size = G.sizes ? (G.sizes.some(z => z[0] === last[g]) ? last[g] : G.sizes[Math.min(1, G.sizes.length - 1)][0]) : null;
    let theme = themeId || null;
    const cur = SK().themeFor(SK().today());
    const chips = G.themes ? [[null, "🎲", "Обычный"]].concat(cur ? [[cur.id, cur.emoji, cur.name.replace(/\s*сканворд\s*/i, " ").trim()]] : []).concat(SK().GENRES.map(t => [t.id, t.emoji, t.name])) : [];
    const draw = () => {
      SK().openSheet(`<div class="gsh"><div class="gi">${icon(g)}</div><h2>${G.name}</h2><p>${G.desc}</p>
        ${G.sizes ? `<div class="zsel">${G.sizes.map(([k, n, d]) => `<button data-z="${k}" class="${k === size ? "on" : ""}"><b>${n}</b>${d ? `<small>${d}</small>` : ""}</button>`).join("")}</div>` : ""}
        ${G.themes ? `<h3 class="sub">Тема</h3><div class="chips">${chips.map(([id, e, n]) => `<button data-t="${id || ""}" class="${(id || null) === theme ? "on" : ""}">${e} ${n}</button>`).join("")}</div>` : ""}
        <button class="big" id="gStart">Начать</button></div>`);
      document.querySelectorAll("#sheet [data-z]").forEach(b => b.onclick = () => { size = b.dataset.z; draw(); });
      document.querySelectorAll("#sheet [data-t]").forEach(b => b.onclick = () => { theme = b.dataset.t || null; draw(); });
      $("#gStart").onclick = () => { last[g] = size; SK().store.set("gz", last); SK().closeSheet(); start(g, size, theme); };
    };
    draw();
  }
  function genreSheet(t) {
    const list = ["scan", "cross", "fill", "key", "chain"];
    SK().openSheet(`<h2>${t.emoji} ${t.name}</h2><p>Во что сыграем на эту тему?</p>
      ${list.map(g => `<button class="opt" data-g="${g}"><span class="ic gic">${icon(g)}</span><span class="t"><b>${GAMES[g].name}</b><small>${GAMES[g].short}</small></span><span class="cost">›</span></button>`).join("")}`);
    document.querySelectorAll("#sheet [data-g]").forEach(b => b.onclick = () => { SK().closeSheet(); gameSheet(b.dataset.g, t.id); });
  }

  function start(g, size, theme, seed) {
    if (g === "scan" || g === "cross" || g === "key") return SK().openFree(size || "m", seed || null, theme, g);
    if (g === "wfw") { const n = seed != null ? +seed : SK().store.get("wfwNext", 0); return openRec(makeRec("wfw", "free", String(n % ROOTS.length), null, null, null)); }
    seed = seed || newSeed();
    const id = "g" + g + "-" + size + "-" + (theme || "") + "-" + seed;
    const old = SK().loadRec(id);
    if (old) return mount(old);
    openRec(makeRec(g, theme ? "theme" : "free", seed, size, theme, null, id));
  }
  const dailyId = (g, d) => "g" + g + "-d" + d;
  function openDaily(g, d) {
    const id = dailyId(g, d), old = SK().loadRec(id);
    if (old) return mount(old);
    openRec(makeRec(g, "daily", "daily-" + g + "-" + d, g === "sudoku" ? "m" : "m", null, d, id));
  }
  function openRec(rec) {
    if (rec.game === "wfw") { const old = SK().loadRec(rec.id); if (old) return mount(old); }
    SK().withLoader("Составляю головоломку…", () => { rec.data = IMPL[rec.game].create(rec); SK().saveRec(rec); mount(rec); });
  }
  function makeRec(g, kind, seed, size, theme, date, id) {
    return { id: id || ("g" + g + "-" + seed), game: g, kind, seed, size, theme: theme || null, date: date || null, data: null, st: {}, t: 0, hu: 0, done: false, ts: Date.now() };
  }

  // ---------- общий экран ----------
  let C = null, timer = null, last = 0;
  function mount(rec) {
    C = { rec, api: IMPL[rec.game] };
    SK().show("pz"); $("#pz").dataset.game = rec.game;
    $("#pzTitle").textContent = title(rec);
    $("#pzHintCount").textContent = SK().ST.hints;
    $("#pzBody").innerHTML = ""; $("#pzFoot").innerHTML = "";
    C.api.mount(rec);
    startTimer();
    history.replaceState(null, "", location.pathname);
    if (rec.done) setTimeout(() => win(false), 300);
  }
  function title(r) {
    const G = GAMES[r.game], th = themeOf(r.theme);
    if (r.kind === "daily") return G.name.replace("Японский", "Японский кроссворд") + " дня, " + SK().human(r.date);
    if (r.game === "wfw") return "Слова из слова: " + ROOTS[+r.seed];
    const z = G.sizes ? G.sizes.find(x => x[0] === r.size) : null;
    return (th ? th.emoji + " " : "") + G.name + (th ? ": " + th.name.replace(/\s*сканворд\s*/i, " ").trim() : z ? ", " + z[1].toLowerCase() : "");
  }
  function startTimer() {
    clearInterval(timer); last = Date.now(); upTime();
    if (C.rec.done) return;
    timer = setInterval(() => {
      if (document.hidden || !$("#pz").classList.contains("on") || $("#sheetbg").classList.contains("on")) { last = Date.now(); return; }
      const now = Date.now(); C.rec.t += Math.round((now - last) / 1000); last = now; upTime();
      if (C.rec.t % 10 === 0) save();
    }, 1000);
  }
  function upTime() { if (!C) return; const st = C.api.status ? C.api.status(C.rec) : ""; $("#pzTime").textContent = SK().tfmt(C.rec.t) + (st ? ", " + st : ""); }
  function save() { if (C) { C.rec.ts = Date.now(); SK().saveRec(C.rec); } }
  function leave() { save(); clearInterval(timer); C = null; }
  function finish() {
    const r = C.rec; if (r.done) return;
    r.done = true; clearInterval(timer); upTime();
    SK().solvedOne(); $("#pzHintCount").textContent = SK().ST.hints;
    if (r.game === "wfw") SK().store.set("wfwNext", (+r.seed + 1) % ROOTS.length);
    save(); SK().buzz([20, 40, 30]);
    setTimeout(() => { SK().confetti(); win(true); }, 450);
  }
  function hint(n) { if (!SK().spendHint(n)) return false; C.rec.hu += n; $("#pzHintCount").textContent = SK().ST.hints; return true; }

  function win(fresh) {
    const r = C.rec, info = C.api.winInfo ? C.api.winInfo(r) : {}, stars = r.hu === 0 ? 3 : r.hu <= 3 ? 2 : 1, P = SK().plural;
    SK().openSheet(`<div class="win">${info.pic || `<div class="medal">${info.medal || "★"}</div>`}
      <h2>${fresh ? info.title || "Решено!" : "Уже решено"}</h2>
      <p>${"⭐".repeat(stars)}</p>
      <div class="nums"><div><b>${SK().tfmt(r.t)}</b><small>время</small></div><div><b>${info.n}</b><small>${info.nl}</small></div><div><b>${r.hu}</b><small>${P(r.hu, "подсказка", "подсказки", "подсказок")}</small></div></div>
      <button class="big" id="wShare">Отправить результат друзьям</button>
      <button class="big alt" id="wNext">${info.next || "Ещё одну"}</button>
      <button class="big alt" id="wHome">На главную</button></div>`);
    $("#wShare").onclick = () => SK().shareText(shareText(r, stars));
    $("#wNext").onclick = () => { SK().closeSheet(); leave(); if (fresh) SK().adBreak(); r.kind === "daily" ? start(r.game, r.size || "m", null) : start(r.game, r.size, r.theme); };
    $("#wHome").onclick = () => { SK().closeSheet(); leave(); if (fresh) SK().adBreak(); SK().goHome(); };
  }
  function shareText(r, stars) {
    const H = SK().HOME;
    const link = r.kind === "daily" ? H + "?g=" + r.game + "&d=" + r.date : r.game === "wfw" ? H + "?g=wfw&n=" + r.seed : H + "?g=" + r.game + "&s=" + encodeURIComponent(r.seed) + "&z=" + r.size + (r.theme ? "&t=" + r.theme : "");
    return `🧩 ${title(r).replace(/^\S+\s(?=[А-ЯЁ])/u, m => /[А-Яа-я]/.test(m) ? m : "")}\nРешил(а) за ${SK().tfmt(r.t)} ${"⭐".repeat(stars)}\n${r.hu ? "Подсказок: " + r.hu : "Без единой подсказки!"}\nСможете быстрее? ${link}`;
  }
  function hintSheet(opts) {
    const x = SK().hintExtras(), P = SK().plural, n = SK().ST.hints;
    SK().openSheet(`<h2>Подсказки</h2><p>У вас ${n} ${P(n, "подсказка", "подсказки", "подсказок")}. За каждую решённую головоломку дарим ещё одну.</p>
      ${opts.map((o, i) => `<button class="opt" data-o="${i}"><span class="ic">${o.ic}</span><span class="t"><b>${o.t}</b><small>${o.s}</small></span><span class="cost">${o.c ? o.c : "даром"}</span></button>`).join("")}
      ${x.gift ? `<button class="opt gift" id="hG"><span class="ic">🎁</span><span class="t"><b>Подарок дня</b><small>Раз в день, просто так</small></span><span class="cost">+2</span></button>` : ""}
      <button class="opt" id="hM" ${!x.ads && x.freeLeft <= 0 ? "disabled" : ""}><span class="ic">${x.ads ? "▶" : "＋"}</span><span class="t"><b>${x.ads ? "Посмотреть короткое видео" : "Получить ещё"}</b><small>${x.ads ? "После видео начислим подсказки" : "Осталось сегодня: " + Math.max(0, x.freeLeft)}</small></span><span class="cost">+3</span></button>`);
    document.querySelectorAll("#sheet [data-o]").forEach(b => b.onclick = () => { const o = opts[+b.dataset.o]; if (o.c && !hint(o.c)) return; SK().closeSheet(); o.fn(); save(); });
    const again = () => { $("#pzHintCount").textContent = SK().ST.hints; hintSheet(opts); };
    if ($("#hG")) $("#hG").onclick = () => { SK().takeGift(); again(); };
    $("#hM").onclick = () => SK().getMore(again);
  }
  $("#pzBack").onclick = () => { leave(); SK().goHome(); };
  $("#pzHint").onclick = () => { if (!C) return; if (C.rec.done) return win(false); if (C.api.hints) hintSheet(C.api.hints(C.rec)); };
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (C && $("#pz").classList.contains("on") && C.api.render) C.api.render(C.rec); }, 150); });
  document.addEventListener("keydown", e => {
    if (!C || !$("#pz").classList.contains("on") || $("#sheetbg").classList.contains("on") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (C.api.key) C.api.key(e);
  });

  // Экранная клавиатура (для чайнворда)
  function keyboard(onKey) {
    const kb = document.createElement("div"); kb.className = "kbd";
    ["ЙЦУКЕНГШЩЗХ", "ФЫВАПРОЛДЖЭ", "ЯЧСМИТЬБЮЪ"].forEach((row, n) => {
      const r = document.createElement("div"); r.className = "r";
      row.split("").forEach(ch => { const b = document.createElement("button"); b.textContent = ch; b.dataset.k = ch; r.appendChild(b); });
      if (n === 2) { const d = document.createElement("button"); d.className = "del"; d.dataset.k = "del"; d.setAttribute("aria-label", "Стереть"); d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M13 10l4 4M17 10l-4 4"/></svg>'; r.appendChild(d); }
      kb.appendChild(r);
    });
    kb.addEventListener("pointerdown", e => { const b = e.target.closest("button"); if (!b) return; e.preventDefault(); b.classList.add("p"); setTimeout(() => b.classList.remove("p"), 120); onKey(b.dataset.k); });
    return kb;
  }
  const typedKey = (e, onKey) => { const k = e.key.toUpperCase().replace("Ё", "Е"); if (/^[А-Я]$/.test(k)) { e.preventDefault(); onKey(k); } else if (e.key === "Backspace") { e.preventDefault(); onKey("del"); } };

  // ======================================================================
  // ФИЛВОРД
  // ======================================================================
  const FW_COLORS = ["#F4A23A", "#4CC38A", "#7FB2FF", "#E2557A", "#B48CF2", "#3CC6C0", "#F07F5A", "#9BC53D", "#E6B800", "#5B8DEF"];
  function fwPartition(W, H, maxL, rnd) {
    const n = W * H;
    const NB = Array.from({ length: n }, (_, i) => { const r = Math.floor(i / W), c = i % W, a = []; if (r > 0) a.push(i - W); if (r < H - 1) a.push(i + W); if (c > 0) a.push(i - 1); if (c < W - 1) a.push(i + 1); return a; });
    const free = (own, i) => NB[i].filter(j => own[j] < 0).length;
    function compsOk(own) {
      const seen = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (own[i] >= 0 || seen[i]) continue;
        let size = 0; const st = [i]; seen[i] = 1;
        while (st.length) { const x = st.pop(); size++; NB[x].forEach(j => { if (own[j] < 0 && !seen[j]) { seen[j] = 1; st.push(j); } }); }
        if (size < 3) return false;
      }
      return true;
    }
    function grow(own, s, L) {
      const path = [s], inP = new Set([s]); let steps = 0;
      const opts = [shuffle(NB[s].filter(j => own[j] < 0), rnd)];
      while (path.length) {
        if (path.length === L) return path.slice();
        if (++steps > 400) return null;
        const top = opts[opts.length - 1];
        if (!top.length) { inP.delete(path.pop()); opts.pop(); continue; }
        const j = top.shift();
        if (inP.has(j)) continue;
        path.push(j); inP.add(j);
        const nx = NB[j].filter(x => own[x] < 0 && !inP.has(x));
        shuffle(nx, rnd).sort((a, b) => (free(own, a) - free(own, b)) + (rnd() - .5) * 1.5);
        opts.push(nx);
      }
      return null;
    }
    for (let att = 0; att < 400; att++) {
      const own = new Int16Array(n).fill(-1), paths = [];
      let ok = true;
      while (true) {
        let best = -1, bd = 9;
        for (let i = 0; i < n; i++) if (own[i] < 0) { const d = free(own, i); if (d < bd || (d === bd && rnd() < .25)) { bd = d; best = i; } }
        if (best < 0) break;
        const Ls = []; for (let L = 3; L <= maxL; L++) Ls.push(L);
        shuffle(Ls, rnd).sort((a, b) => Math.abs(a - 5.2) - Math.abs(b - 5.2) + (rnd() - .5) * 3);
        let placed = false;
        for (const L of Ls) {
          const p = grow(own, best, L); if (!p) continue;
          p.forEach(i => own[i] = paths.length);
          if (compsOk(own)) { paths.push(p); placed = true; break; }
          p.forEach(i => own[i] = -1);
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return paths;
    }
    return null;
  }
  const FILL = {
    create(r) {
      const N = { s: 6, m: 8, l: 10 }[r.size] || 8, maxL = { s: 6, m: 7, l: 8 }[r.size] || 7, rnd = rng("fw-" + r.seed);
      const paths = fwPartition(N, N, maxL, rnd);
      const th = themeSet(r.theme), used = new Set(), letters = new Array(N * N).fill("");
      const words = paths.map(p => {
        const L = p.length, pool = BYLEN[L] || [];
        const tp = pool.filter(e => th.has(e.word) && !used.has(e.word));
        const gp = pool.filter(e => !used.has(e.word) && !/[ЪЬЫ]/.test(e.word[0]));
        const pick = tp.length && rnd() < .85 ? tp[Math.floor(rnd() * tp.length)] : gp[Math.floor(rnd() * gp.length)];
        used.add(pick.word);
        p.forEach((i, k) => letters[i] = pick.word[k]);
        return { w: pick.word, p };
      });
      return { n: N, letters, words };
    },
    mount(r) {
      r.st.found = r.st.found || []; r.st.hl = r.st.hl || [];
      $("#pzBody").innerHTML = `<div class="fwwrap"><div class="fw" id="fw"></div><svg class="fwsvg" id="fwsvg"></svg></div>`;
      $("#pzFoot").innerHTML = `<div class="fwlist" id="fwlist"></div>`;
      this.render(r); this.bind(r);
    },
    render(r) {
      const D = r.data, N = D.n, body = $("#pzBody");
      const cs = Math.floor(Math.min((body.clientWidth - 28 - 2 * N) / N, (body.clientHeight - 20 - 2 * N) / N, 64));
      const fw = $("#fw"); fw.style.gridTemplateColumns = `repeat(${N},${cs}px)`; fw.style.setProperty("--cs", cs + "px");
      fw.innerHTML = D.letters.map((ch, i) => `<div class="fc${r.st.hl.includes(i) ? " hl" : ""}" data-i="${i}">${ch}</div>`).join("");
      this.cs = cs; this.draw(r, []);
      const list = $("#fwlist");
      list.innerHTML = `<div class="cnt">Найдено ${r.st.found.length} из ${D.words.length}</div>` + D.words.map((w, k) => ({ w, k })).sort((a, b) => a.w.w.length - b.w.w.length || a.w.w.localeCompare(b.w.w, "ru"))
        .map(({ w, k }) => `<span class="${r.st.found.includes(k) ? "f" : ""}" style="${r.st.found.includes(k) ? "--c:" + FW_COLORS[k % FW_COLORS.length] : ""}">${w.w}</span>`).join("");
    },
    draw(r, sel) {
      const D = r.data, N = D.n, cs = this.cs, st = cs + 2, sv = $("#fwsvg"), W = N * st + 2;
      sv.setAttribute("viewBox", `0 0 ${W} ${W}`); sv.setAttribute("width", W); sv.setAttribute("height", W);
      const pt = i => `${1 + (i % N) * st + cs / 2},${1 + Math.floor(i / N) * st + cs / 2}`;
      const line = (p, col, cls) => p.length === 1 ? `<circle cx="${pt(p[0]).split(",")[0]}" cy="${pt(p[0]).split(",")[1]}" r="${cs * .3}" fill="${col}" class="${cls}"/>` : `<polyline points="${p.map(pt).join(" ")}" stroke="${col}" stroke-width="${cs * .62}" class="${cls}"/>`;
      sv.innerHTML = r.st.found.map(k => line(D.words[k].p, FW_COLORS[k % FW_COLORS.length], "fo")).join("") + (sel.length ? line(sel, "var(--marker)", "se") : "");
    },
    bind(r) {
      const fw = $("#fw"); let sel = [], down = false;
      const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.classList.contains("fc") ? +el.dataset.i : -1; };
      const N = () => r.data.n;
      const adj = (a, b) => (Math.abs(a - b) === 1 && Math.floor(a / N()) === Math.floor(b / N())) || Math.abs(a - b) === N();
      fw.onpointerdown = e => {
        if (r.done) return; const i = cellAt(e.clientX, e.clientY); if (i < 0) return;
        e.preventDefault(); down = true; sel = [i]; try { fw.setPointerCapture(e.pointerId); } catch (er) { } this.draw(r, sel); SK().buzz(5);
      };
      fw.onpointermove = e => {
        if (!down) return; const i = cellAt(e.clientX, e.clientY); if (i < 0) return;
        const lastI = sel[sel.length - 1];
        if (i === lastI) return;
        if (sel.length > 1 && i === sel[sel.length - 2]) { sel.pop(); this.draw(r, sel); return; }
        if (!sel.includes(i) && adj(i, lastI)) { sel.push(i); this.draw(r, sel); SK().buzz(4); }
      };
      const up = () => {
        if (!down) return; down = false;
        const s = sel.map(i => r.data.letters[i]).join(""), key = sel.join(",");
        const k = r.data.words.findIndex((w, k) => !r.st.found.includes(k) && w.p.join(",") === key);
        if (k >= 0) {
          r.st.found.push(k); SK().ding(); this.render(r); upTime(); save();
          if (r.st.found.length === r.data.words.length) finish();
        } else if (sel.length > 1) {
          if (r.data.words.some((w, k) => !r.st.found.includes(k) && w.w === s)) SK().toast("Слово «" + s + "» есть, но спрятано по-другому");
          else if (sel.length >= 3 && BYW[s] && !r.data.words.some(w => w.w === s)) SK().toast("«" + s + "» — хорошее слово, но здесь спрятано другое");
          this.draw(r, []);
        } else this.draw(r, []);
        sel = [];
      };
      fw.onpointerup = up; fw.onpointercancel = up;
    },
    status: r => "найдено " + r.st.found.length + " из " + r.data.words.length,
    progress: r => r.data ? (r.st.found || []).length / r.data.words.length : 0,
    hints(r) {
      const left = r.data.words.map((w, k) => k).filter(k => !r.st.found.includes(k));
      const pick = () => left.slice().sort((a, b) => r.data.words[a].w.length - r.data.words[b].w.length)[0];
      return [
        { ic: "А", t: "Первая буква слова", s: "Подсветим, откуда начинается слово", c: 1, fn: () => { const k = left.find(k => !r.st.hl.includes(r.data.words[k].p[0])); if (k == null) return; r.st.hl.push(r.data.words[k].p[0]); this.render(r); } },
        { ic: "АБВ", t: "Показать слово", s: "Самое короткое из оставшихся", c: 3, fn: () => { const k = pick(); if (k == null) return; r.st.found.push(k); this.render(r); upTime(); if (r.st.found.length === r.data.words.length) finish(); } }
      ];
    },
    winInfo: r => ({ title: "Филворд решён!", medal: "🔤", n: r.data.words.length, nl: SK().plural(r.data.words.length, "слово", "слова", "слов"), next: "Новый филворд" })
  };

  // ======================================================================
  // ЧАЙНВОРД
  // ======================================================================
  const CHAIN = {
    create(r) {
      const n = { s: 8, m: 11, l: 14 }[r.size] || 11, rnd = rng("ch-" + r.seed), th = themeSet(r.theme);
      const pool = WL.filter(e => e.word.length >= 4 && e.word.length <= 8);
      const byFirst = {}; pool.forEach(e => (byFirst[e.word[0]] = byFirst[e.word[0]] || []).push(e));
      let best = [];
      for (let att = 0; att < 60 && best.length < n; att++) {
        const chain = [], used = new Set(); let steps = 0;
        const firsts = shuffle(pool.filter(e => !/[ЪЬЫЙ]/.test(e.word[0])), rnd);
        const tf = firsts.filter(e => th.has(e.word));
        const go = () => {
          if (chain.length === n) return true;
          if (++steps > 3000) return false;
          const lastW = chain[chain.length - 1].word, cand = shuffle((byFirst[lastW[lastW.length - 1]] || []).filter(e => !used.has(e.word)), rnd);
          cand.sort((a, b) => (th.has(b.word) ? 1 : 0) - (th.has(a.word) ? 1 : 0));
          for (const e of cand.slice(0, 12)) { chain.push(e); used.add(e.word); if (go()) return true; chain.pop(); used.delete(e.word); }
          if (chain.length > best.length) best = chain.slice();
          return false;
        };
        const s0 = (tf.length && rnd() < .8 ? tf : firsts)[0];
        chain.push(s0); used.add(s0.word);
        if (go()) { best = chain.slice(); break; }
      }
      let pos = 0, tape = "";
      const words = best.map((e, k) => { const start = k === 0 ? 0 : pos; tape = k === 0 ? e.word : tape + e.word.slice(1); pos = tape.length - 1; return { w: e.word, start, clue: e.clues[Math.floor(rnd() * e.clues.length)] }; });
      return { tape, words, cols: r.size === "s" ? 7 : 8 };
    },
    mount(r) {
      r.st.e = r.st.e || new Array(r.data.tape.length).fill(""); r.st.solved = r.st.solved || []; r.st.rev = r.st.rev || [];
      this.cur = { w: r.st.solved.length < r.data.words.length ? r.data.words.findIndex((w, k) => !r.st.solved.includes(k)) : 0, t: 0 };
      this.cur.t = this.firstEmpty(r, this.cur.w); this.bad = new Set();
      $("#pzBody").innerHTML = `<div class="chwrap"><div class="ch" id="ch"></div></div>`;
      $("#pzFoot").innerHTML = `<div class="cluebar"><button class="nav" id="chPrev" aria-label="Предыдущее слово"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><div class="cluetext" id="chClue"><b></b><small></small></div><button class="nav" id="chNext" aria-label="Следующее слово"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
      $("#pzFoot").appendChild(keyboard(k => this.input(r, k)));
      $("#chPrev").onclick = () => this.go(r, -1); $("#chNext").onclick = () => this.go(r, 1);
      $("#chClue").onclick = () => this.list(r);
      this.render(r);
    },
    pos(r, t) { const C = r.data.cols, row = Math.floor(t / C), k = t % C; return { row, col: row % 2 ? C - 1 - k : k }; },
    render(r) {
      const D = r.data, C = D.cols, T = D.tape.length, rows = Math.ceil(T / C), body = $("#pzBody");
      const cs = Math.floor(Math.min((body.clientWidth - 24 - (C - 1) * 4) / C, (body.clientHeight - 12 - (rows - 1) * 4) / rows, 56));
      const ch = $("#ch"); ch.style.gridTemplateColumns = `repeat(${C},${cs}px)`; ch.style.setProperty("--cs", cs + "px");
      const cells = new Array(rows * C).fill(null), starts = {};
      D.words.forEach((w, k) => starts[w.start] = k + 1);
      for (let t = 0; t < T; t++) { const p = this.pos(r, t); cells[p.row * C + p.col] = t; }
      ch.innerHTML = cells.map(t => {
        if (t == null) return `<div class="cc none"></div>`;
        const p = this.pos(r, t), endRow = (t + 1) % C === 0 && t < T - 1;
        return `<div class="cc" data-t="${t}"><span class="v"></span>${starts[t] ? `<i class="n">${starts[t]}</i>` : ""}${endRow ? `<i class="turn"></i>` : ""}${t > 0 && t % C !== 0 ? `<i class="lk ${p.row % 2 ? "r" : "l"}"></i>` : ""}</div>`;
      }).join("");
      ch.onclick = e => { const c = e.target.closest(".cc[data-t]"); if (c) this.tap(r, +c.dataset.t); };
      this.paint(r);
    },
    wordCells: (r, k) => { const w = r.data.words[k]; return Array.from({ length: w.w.length }, (_, j) => w.start + j); },
    firstEmpty(r, k) { const cs = this.wordCells(r, k); const t = cs.find(t => !r.st.e[t]); return t == null ? cs[0] : t; },
    paint(r) {
      const inW = new Set(this.wordCells(r, this.cur.w)), solvedT = new Set();
      r.st.solved.forEach(k => this.wordCells(r, k).forEach(t => solvedT.add(t)));
      document.querySelectorAll("#ch .cc[data-t]").forEach(el => {
        const t = +el.dataset.t, v = r.st.e[t];
        el.firstChild.textContent = v;
        el.className = "cc" + (inW.has(t) ? " w" : "") + (t === this.cur.t ? " cur" : "") + (solvedT.has(t) ? " ok" : "") + (r.st.rev.includes(t) ? " rev" : "") + (v && (this.bad.has(t) || (SK().S.easy && v !== r.data.tape[t])) ? " bad" : "");
      });
      const w = r.data.words[this.cur.w], done = r.st.solved.includes(this.cur.w), ct = $("#chClue");
      ct.className = "cluetext" + (done ? " done" : "");
      ct.querySelector("b").textContent = (this.cur.w + 1) + ". " + w.clue;
      ct.querySelector("small").textContent = (done ? "Отгадано: " + w.w : w.w.length + " " + SK().plural(w.w.length, "буква", "буквы", "букв")) + " · все вопросы ›";
    },
    tap(r, t) {
      const ks = r.data.words.map((w, k) => k).filter(k => t >= r.data.words[k].start && t < r.data.words[k].start + r.data.words[k].w.length);
      let k = ks.includes(this.cur.w) ? this.cur.w : ks[0];
      if (ks.length > 1 && t === this.cur.t) k = ks.find(x => x !== this.cur.w);
      this.cur = { w: k, t }; this.paint(r);
    },
    go(r, d) { const n = r.data.words.length; let k = this.cur.w; for (let s = 0; s < n; s++) { k = (k + d + n) % n; if (!r.st.solved.includes(k) || s === n - 1) break; } this.cur = { w: k, t: this.firstEmpty(r, k) }; this.paint(r); },
    locked(r, t) { return r.st.rev.includes(t) || r.st.solved.some(k => { const w = r.data.words[k]; return t >= w.start && t < w.start + w.w.length; }); },
    check(r, t) {
      let any = false;
      r.data.words.forEach((w, k) => {
        if (r.st.solved.includes(k) || t < w.start || t >= w.start + w.w.length) return;
        if (this.wordCells(r, k).every(x => r.st.e[x] === r.data.tape[x])) { r.st.solved.push(k); any = true; }
      });
      if (any) { SK().ding(); upTime(); if (r.st.solved.length === r.data.words.length) finish(); }
      return any;
    },
    input(r, k) {
      if (r.done) return;
      const cells = this.wordCells(r, this.cur.w);
      if (k === "del") {
        let t = this.cur.t;
        if (!r.st.e[t] || this.locked(r, t)) { let j = cells.indexOf(t) - 1; while (j >= 0 && this.locked(r, cells[j])) j--; if (j < 0) return this.paint(r); t = cells[j]; }
        if (!this.locked(r, t)) { r.st.e[t] = ""; this.bad.delete(t); }
        this.cur.t = t; SK().buzz(5); this.paint(r); save(); return;
      }
      let t = this.cur.t;
      if (this.locked(r, t)) { const nt = cells.find(x => cells.indexOf(x) >= cells.indexOf(t) && !this.locked(r, x)); if (nt == null) return this.go(r, 1); t = nt; }
      r.st.e[t] = k; this.bad.delete(t); SK().buzz(8);
      const solvedNow = this.check(r, t); if (r.done) { this.paint(r); return; }
      if (solvedNow && r.st.solved.includes(this.cur.w)) { save(); this.paint(r); return setTimeout(() => this.go(r, 1), 260); }
      let j = cells.indexOf(t) + 1;
      while (j < cells.length && (this.locked(r, cells[j]) || (SK().S.skip && r.st.e[cells[j]]))) j++;
      this.cur.t = j < cells.length ? cells[j] : t;
      this.paint(r); save();
    },
    key(e) { typedKey(e, k => this.input(C.rec, k)); if (e.key === "ArrowRight" || e.key === "Enter") this.go(C.rec, 1); if (e.key === "ArrowLeft") this.go(C.rec, -1); },
    list(r) {
      SK().openSheet(`<h2>Вопросы</h2><div class="cls">${r.data.words.map((w, k) => `<button class="cl${r.st.solved.includes(k) ? " ok" : ""}${k === this.cur.w ? " act" : ""}" data-k="${k}"><b>${k + 1}.</b><span>${w.clue} <small>(${w.w.length})</small></span>${r.st.solved.includes(k) ? `<em>${w.w}</em>` : ""}</button>`).join("")}</div>`);
      document.querySelectorAll("#sheet .cl").forEach(b => b.onclick = () => { SK().closeSheet(); const k = +b.dataset.k; this.cur = { w: k, t: this.firstEmpty(r, k) }; this.paint(r); });
    },
    status: r => "отгадано " + r.st.solved.length + " из " + r.data.words.length,
    progress: r => r.data && r.st.solved ? r.st.solved.length / r.data.words.length : 0,
    hints(r) {
      const rev = ts => { ts.forEach(t => { r.st.e[t] = r.data.tape[t]; if (!r.st.rev.includes(t)) r.st.rev.push(t); this.bad.delete(t); }); ts.forEach(t => this.check(r, t)); if (!r.done) this.paint(r); };
      return [
        { ic: "А", t: "Открыть букву", s: "В выбранной клетке", c: 1, fn: () => { const cs = this.wordCells(r, this.cur.w); const t = r.st.e[this.cur.t] !== r.data.tape[this.cur.t] ? this.cur.t : cs.find(x => r.st.e[x] !== r.data.tape[x]); if (t != null) rev([t]); } },
        { ic: "АБВ", t: "Открыть слово", s: "Всё выделенное слово", c: 3, fn: () => rev(this.wordCells(r, this.cur.w)) },
        { ic: "✓", t: "Проверить ошибки", s: "Подчеркнём неверные буквы", c: 0, fn: () => { this.bad = new Set(); r.st.e.forEach((v, t) => { if (v && v !== r.data.tape[t]) this.bad.add(t); }); this.paint(r); SK().toast(this.bad.size ? "Ошибок: " + this.bad.size : "Ошибок нет, так держать!"); } }
      ];
    },
    winInfo: r => ({ title: "Чайнворд решён!", medal: "🔗", n: r.data.words.length, nl: SK().plural(r.data.words.length, "слово", "слова", "слов"), next: "Новый чайнворд" })
  };

  // ======================================================================
  // СЛОВА ИЗ СЛОВА
  // ======================================================================
  const ROOTS_ALL = ["ПРЕДПРИНИМАТЕЛЬ", "ЛАБОРАТОРИЯ", "ПУТЕШЕСТВЕННИК", "ПАРИКМАХЕРСКАЯ", "ПЕРЕКРЕСТОК", "ВОДОПРОВОД", "АВТОМОБИЛИСТ", "КОНСТРУКТОР", "ПРОСТОКВАША", "ДОСТОПРИМЕЧАТЕЛЬНОСТЬ", "ВЕЛОСИПЕДИСТ", "КОСМОНАВТИКА", "ТЕЛЕВИДЕНИЕ", "МОРЕПЛАВАТЕЛЬ", "СТРОИТЕЛЬСТВО", "КРАСНОАРМЕЕЦ", "ЗЕМЛЕТРЯСЕНИЕ", "ПАРОВОЗОСТРОЕНИЕ", "ГРАМПЛАСТИНКА", "КАРАНДАШ", "ПОДСНЕЖНИК", "ПРОГРАММИСТ", "ЭКСКАВАТОР", "АПЕЛЬСИН", "ПРОДАВЩИЦА", "СТИХОТВОРЕНИЕ", "КОРАБЛЕКРУШЕНИЕ", "ОРАНЖЕРЕЯ", "КЛАВИАТУРА", "БАСКЕТБОЛИСТ", "ПРЕПОДАВАТЕЛЬ", "ВОСПИТАТЕЛЬНИЦА", "САМОЛЕТОСТРОЕНИЕ", "ЭЛЕКТРОСТАНЦИЯ", "ПОМИДОР", "СНЕГОКАТ", "ДИРИЖАБЛЬ", "РЕСТОРАН", "ПЕРЕВОДЧИК", "КОНСЕРВАТОРИЯ", "НАСТРОЕНИЕ", "КАРТОФЕЛЬ", "ПРОСВЕЩЕНИЕ", "ПЕРЕПЕЛКА", "КОЛОКОЛЬЧИК", "ПОДОКОННИК", "ДОМОХОЗЯЙКА", "БИБЛИОТЕКАРЬ", "ЧЕРЕПАХА", "ПАРОХОДСТВО", "МАТЕМАТИКА", "ПЕРСПЕКТИВА", "КОРРЕСПОНДЕНТ", "РАСПИСАНИЕ", "СОТРУДНИЧЕСТВО", "ТРАКТОРИСТ", "ПОЛИТЕХНИКУМ", "ЗООПАРК", "АРХИТЕКТОР", "ПРЕДСТАВЛЕНИЕ", "СТАРШЕКЛАССНИК", "МАРМЕЛАД", "СТОЛЯРНИЧЕСТВО", "САМОВАР", "ПРОИЗВЕДЕНИЕ", "ПОКУПАТЕЛЬ", "РАДИОСТАНЦИЯ", "ВОДОНАПОРНАЯ", "КРОССВОРДИСТ", "ПЕРЕМЕНА", "ПРИКЛЮЧЕНИЕ"];
  const canMake = (w, cnt) => { const c = Object.assign({}, cnt); for (const ch of w) { if (!c[ch]) return false; c[ch]--; } return true; };
  const letterCount = w => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
  const subWords = root => { const cnt = letterCount(root); return WL.filter(e => e.word.length >= 3 && e.word !== root && canMake(e.word, cnt)).map(e => e.word); };
  const ROOTS = ROOTS_ALL.filter(w => w.length <= 14 && subWords(w).length >= 10);
  const WFW = {
    create(r) { const root = ROOTS[+r.seed % ROOTS.length]; const t = subWords(root).sort((a, b) => a.length - b.length || a.localeCompare(b, "ru")); return { root, t }; },
    mount(r) {
      r.st.f = r.st.f || []; r.st.hl = r.st.hl || {}; this.pick = [];
      $("#pzBody").innerHTML = `<div class="wfw"><div class="wcnt" id="wCnt"></div><div class="wslots" id="wSlots"></div></div>`;
      $("#pzFoot").innerHTML = `<div class="wcur" id="wCur"></div><div class="wtiles" id="wTiles"></div><div class="wbtns"><button class="big alt" id="wClr">Стереть</button><button class="big" id="wOk">Проверить</button></div>`;
      $("#wClr").onclick = () => { this.pick = []; this.paint(r); };
      $("#wOk").onclick = () => this.check(r);
      this.render(r);
    },
    render(r) {
      const root = r.data.root, W = $("#pzFoot").clientWidth || 360, ts = Math.floor(Math.min(52, (W - 16) / root.length - 4));
      $("#wTiles").style.setProperty("--ts", ts + "px");
      $("#wTiles").innerHTML = root.split("").map((ch, i) => `<button data-i="${i}">${ch}</button>`).join("");
      $("#wTiles").onclick = e => { const b = e.target.closest("button"); if (!b || r.done) return; const i = +b.dataset.i; const at = this.pick.indexOf(i); if (at >= 0) this.pick.splice(at, 1); else this.pick.push(i); SK().buzz(5); this.paint(r); };
      this.paint(r); this.slots(r);
    },
    paint(r) {
      document.querySelectorAll("#wTiles button").forEach(b => b.classList.toggle("on", this.pick.includes(+b.dataset.i)));
      const w = this.pick.map(i => r.data.root[i]).join("");
      $("#wCur").innerHTML = w ? `<b>${w}</b><button id="wDel" aria-label="Стереть букву">⌫</button>` : `<small>Нажимайте на буквы, чтобы составить слово</small>`;
      if ($("#wDel")) $("#wDel").onclick = () => { this.pick.pop(); this.paint(r); };
    },
    slots(r) {
      const by = {}; r.data.t.forEach(w => (by[w.length] = by[w.length] || []).push(w));
      $("#wCnt").textContent = "Найдено " + r.st.f.length + " из " + r.data.t.length;
      $("#wSlots").innerHTML = Object.keys(by).map(L => `<div class="wg"><h4>${L} ${SK().plural(+L, "буква", "буквы", "букв")}</h4><div>${by[L].map(w => r.st.f.includes(w) ? `<span class="f">${w}</span>` : `<span>${w.split("").map((ch, j) => j < (r.st.hl[w] || 0) ? ch : "·").join(" ")}</span>`).join("")}</div></div>`).join("");
    },
    check(r) {
      const w = this.pick.map(i => r.data.root[i]).join("");
      if (!w) return;
      if (w.length < 3) SK().toast("Слово должно быть не короче трёх букв");
      else if (r.st.f.includes(w)) SK().toast("Это слово уже найдено");
      else if (r.data.t.includes(w)) {
        r.st.f.push(w); SK().ding(); this.pick = []; this.paint(r); this.slots(r); upTime(); save();
        if (r.st.f.length === r.data.t.length) finish();
        return;
      } else if (w === r.data.root) SK().toast("Это само слово 😉");
      else SK().toast("Такого слова нет в нашем словаре");
      SK().buzz([10, 40, 10]); this.pick = []; this.paint(r);
    },
    key(e) {
      const r = C.rec, k = e.key.toUpperCase().replace("Ё", "Е");
      if (e.key === "Enter") return this.check(r);
      if (e.key === "Backspace") { this.pick.pop(); return this.paint(r); }
      if (/^[А-Я]$/.test(k)) { const i = r.data.root.split("").findIndex((ch, i) => ch === k && !this.pick.includes(i)); if (i >= 0) { this.pick.push(i); this.paint(r); } }
    },
    status: r => "найдено " + r.st.f.length + " из " + r.data.t.length,
    progress: r => r.data ? (r.st.f || []).length / r.data.t.length : 0,
    hints(r) {
      const left = r.data.t.filter(w => !r.st.f.includes(w));
      return [
        { ic: "А", t: "Подсказать букву", s: "Откроем букву в самом коротком слове", c: 1, fn: () => { const w = left.find(w => (r.st.hl[w] || 0) < w.length - 1); if (!w) return; r.st.hl[w] = (r.st.hl[w] || 0) + 1; this.slots(r); } },
        { ic: "АБВ", t: "Показать слово", s: "Самое короткое из оставшихся", c: 2, fn: () => { const w = left[0]; if (!w) return; r.st.f.push(w); this.slots(r); upTime(); if (r.st.f.length === r.data.t.length) finish(); } }
      ];
    },
    winInfo: r => ({ title: "Все слова найдены!", medal: "🧠", n: r.data.t.length, nl: SK().plural(r.data.t.length, "слово", "слова", "слов"), next: "Следующее слово" })
  };

  // ======================================================================
  // ЯПОНСКИЙ КРОССВОРД
  // ======================================================================
  const lineClues = arr => { const c = []; let n = 0; arr.forEach(v => { if (v) n++; else if (n) { c.push(n); n = 0; } }); if (n) c.push(n); return c.length ? c : [0]; };
  function nonoClues(sol, W, H) {
    const rows = [], cols = [];
    for (let y = 0; y < H; y++) rows.push(lineClues(sol.slice(y * W, y * W + W)));
    for (let x = 0; x < W; x++) cols.push(lineClues(Array.from({ length: H }, (_, y) => sol[y * W + x])));
    return { rows, cols };
  }
  // Логическое решение по строкам: возвращает true, если картинка однозначна
  function lineSolve(line, clue) {
    const L = line.length, cl = clue[0] === 0 ? [] : clue, canF = new Array(L).fill(false), canE = new Array(L).fill(false);
    const memo = new Map();
    const fits = (i, k) => {
      const key = i * 64 + k; if (memo.has(key)) return memo.get(key);
      let res = false;
      if (k === cl.length) { res = true; for (let j = i; j < L; j++) if (line[j] === 1) { res = false; break; } if (res) for (let j = i; j < L; j++) canE[j] = true; memo.set(key, res); return res; }
      if (i >= L) { memo.set(key, false); return false; }
      if (line[i] !== 1 && fits(i + 1, k)) { canE[i] = true; res = true; }
      const n = cl[k];
      if (i + n <= L) {
        let ok = true; for (let j = i; j < i + n; j++) if (line[j] === 0) { ok = false; break; }
        if (ok && i + n < L && line[i + n] === 1) ok = false;
        if (ok) {
          const nx = i + n + (i + n < L ? 1 : 0);
          if (fits(nx, k + 1)) { for (let j = i; j < i + n; j++) canF[j] = true; if (i + n < L) canE[i + n] = true; res = true; }
        }
      }
      memo.set(key, res); return res;
    };
    if (!fits(0, 0)) return null;
    return line.map((v, j) => v !== -1 ? v : canF[j] && !canE[j] ? 1 : canE[j] && !canF[j] ? 0 : -1);
  }
  function nonoUnique(sol, W, H) {
    const { rows, cols } = nonoClues(sol, W, H), g = new Array(W * H).fill(-1);
    for (let it = 0; it < 60; it++) {
      let ch = false;
      for (let y = 0; y < H; y++) { const ln = lineSolve(g.slice(y * W, y * W + W), rows[y]); if (!ln) return false; ln.forEach((v, x) => { if (g[y * W + x] !== v) { g[y * W + x] = v; ch = true; } }); }
      for (let x = 0; x < W; x++) { const ln = lineSolve(Array.from({ length: H }, (_, y) => g[y * W + x]), cols[x]); if (!ln) return false; ln.forEach((v, y) => { if (g[y * W + x] !== v) { g[y * W + x] = v; ch = true; } }); }
      if (!ch) break;
    }
    return g.every(v => v !== -1);
  }
  const PICS = window.NONO_PICS || [];
  function randomPattern(W, H, rnd) {
    for (let att = 0; att < 200; att++) {
      let g = new Array(W * H).fill(0).map(() => rnd() < .52 ? 1 : 0);
      for (let s = 0; s < 2; s++) { const h = g.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if ((dy || dx) && yy >= 0 && xx >= 0 && yy < H && xx < W) n += g[yy * W + xx]; } h[y * W + x] = n >= 5 ? 1 : n <= 2 ? 0 : g[y * W + x]; } g = h; }
      for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) g[y * W + (W - 1 - x)] = g[y * W + x];
      const f = g.reduce((a, b) => a + b, 0) / g.length;
      if (f < .3 || f > .7) continue;
      if (nonoUnique(g, W, H)) return g;
    }
    return null;
  }
  const NONO = {
    create(r) {
      const W = r.size === "l" ? 15 : 10, rnd = rng("nn-" + r.seed), done = SK().store.get("nnDone", []);
      const pics = PICS.filter(p => p.w === W);
      let pic = r.kind === "daily" ? pics[Math.floor(rnd() * pics.length)] : pics.find(p => !done.includes(p.id));
      if (pic) return { w: W, h: pic.h, sol: pic.rows.join("").split("").map(c => c === "#" ? 1 : 0), name: pic.name, pid: pic.id };
      const g = randomPattern(W, W, rnd) || pics[Math.floor(rnd() * pics.length)].rows.join("").split("").map(c => c === "#" ? 1 : 0);
      return { w: W, h: W, sol: g, name: "Узор" };
    },
    mount(r) {
      const D = r.data; r.st.g = r.st.g || new Array(D.w * D.h).fill(0); this.mode = 1; this.bad = new Set();
      this.cl = nonoClues(D.sol, D.w, D.h);
      $("#pzBody").innerHTML = `<div class="nnwrap"><div class="nn" id="nn"></div></div>`;
      $("#pzFoot").innerHTML = `<div class="nnmode"><button id="nnF" class="on"><i class="sq"></i>Закрашивать</button><button id="nnX"><i class="x">✕</i>Ставить крестик</button></div>`;
      $("#nnF").onclick = () => { this.mode = 1; $("#nnF").classList.add("on"); $("#nnX").classList.remove("on"); };
      $("#nnX").onclick = () => { this.mode = 2; $("#nnX").classList.add("on"); $("#nnF").classList.remove("on"); };
      this.render(r); this.bind(r);
    },
    render(r) {
      const D = r.data, W = D.w, H = D.h, mr = Math.max(...this.cl.rows.map(c => c.length)), mc = Math.max(...this.cl.cols.map(c => c.length)), body = $("#pzBody");
      const cs = Math.floor(Math.max(15, Math.min(40, (body.clientWidth - 24 - W) / (W + mr * .62), (body.clientHeight - 24 - H) / (H + mc * .62))));
      const f = Math.round(cs * .62), nn = $("#nn");
      nn.style.gridTemplateColumns = `${mr * f}px repeat(${W},${cs}px)`; nn.style.gridTemplateRows = `${mc * f}px repeat(${H},${cs}px)`;
      nn.style.setProperty("--cs", cs + "px"); nn.style.setProperty("--f", f + "px");
      let h = `<div class="corner"></div>`;
      for (let x = 0; x < W; x++) h += `<div class="cc col${x % 5 === 4 && x < W - 1 ? " b5" : ""}" data-c="${x}">${this.cl.cols[x].map(n => `<span>${n}</span>`).join("")}</div>`;
      for (let y = 0; y < H; y++) {
        h += `<div class="cc row${y % 5 === 4 && y < H - 1 ? " b5" : ""}" data-r="${y}">${this.cl.rows[y].map(n => `<span>${n}</span>`).join("")}</div>`;
        for (let x = 0; x < W; x++) h += `<div class="nc${x % 5 === 4 && x < W - 1 ? " bx" : ""}${y % 5 === 4 && y < H - 1 ? " by" : ""}" data-i="${y * W + x}"></div>`;
      }
      nn.innerHTML = h; this.paint(r);
    },
    paint(r) {
      const D = r.data, W = D.w, H = D.h, g = r.st.g;
      document.querySelectorAll("#nn .nc").forEach(el => { const i = +el.dataset.i; el.className = el.className.replace(/ (f|x|bad)\b/g, "") + (g[i] === 1 ? " f" : g[i] === 2 ? " x" : "") + (this.bad.has(i) ? " bad" : ""); });
      const okLine = (cells, clue) => lineClues(cells.map(v => v === 1 ? 1 : 0)).join(",") === clue.join(",");
      for (let y = 0; y < H; y++) $(`#nn [data-r="${y}"]`).classList.toggle("ok", okLine(g.slice(y * W, y * W + W), this.cl.rows[y]));
      for (let x = 0; x < W; x++) $(`#nn [data-c="${x}"]`).classList.toggle("ok", okLine(Array.from({ length: H }, (_, y) => g[y * W + x]), this.cl.cols[x]));
    },
    solved(r) { return document.querySelectorAll("#nn .cc.ok").length === r.data.w + r.data.h; },
    bind(r) {
      const nn = $("#nn"); let down = false, val = 0, start = -1, axis = null;
      const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.classList.contains("nc") ? +el.dataset.i : -1; };
      const set = i => { if (r.st.g[i] === val) return; r.st.g[i] = val; this.bad.delete(i); };
      nn.onpointerdown = e => {
        if (r.done) return; const i = cellAt(e.clientX, e.clientY); if (i < 0) return;
        e.preventDefault(); down = true; start = i; axis = null; try { nn.setPointerCapture(e.pointerId); } catch (er) { }
        val = r.st.g[i] === this.mode ? 0 : this.mode; set(i); SK().buzz(6); this.paint(r);
      };
      nn.onpointermove = e => {
        if (!down) return; let i = cellAt(e.clientX, e.clientY); if (i < 0) return;
        const W = r.data.w, sr = Math.floor(start / W), sc = start % W, ir = Math.floor(i / W), ic = i % W;
        if (!axis && i !== start) axis = ir === sr ? "r" : ic === sc ? "c" : (Math.abs(ir - sr) > Math.abs(ic - sc) ? "c" : "r");
        if (axis === "r") i = sr * W + ic; else if (axis === "c") i = ir * W + sc;
        const a = axis === "r" ? [sc, ic] : [sr, ir], lo = Math.min(...a), hi = Math.max(...a);
        for (let k = lo; k <= hi; k++) set(axis === "r" ? sr * W + k : k * W + sc);
        this.paint(r);
      };
      const up = () => { if (!down) return; down = false; save(); upTime(); if (this.solved(r)) { r.st.g = r.st.g.map(v => v === 1 ? 1 : 0); this.paint(r); finish(); } };
      nn.onpointerup = up; nn.onpointercancel = up;
    },
    status: r => { const s = r.data.sol.reduce((a, b) => a + b, 0), ok = r.st.g ? r.st.g.filter((v, i) => v === 1 && r.data.sol[i]).length : 0; return Math.round(100 * ok / s) + "%"; },
    progress: r => r.data && r.st.g ? r.st.g.filter((v, i) => v === 1 && r.data.sol[i]).length / r.data.sol.reduce((a, b) => a + b, 0) : 0,
    hints(r) {
      const D = r.data, wrong = () => D.sol.map((v, i) => i).filter(i => (r.st.g[i] === 1) !== (D.sol[i] === 1) && !(D.sol[i] === 0 && r.st.g[i] === 2));
      const fix = is => { is.forEach(i => r.st.g[i] = D.sol[i] ? 1 : 2); this.paint(r); upTime(); if (this.solved(r)) finish(); };
      return [
        { ic: "■", t: "Открыть клетку", s: "Одну случайную клетку", c: 1, fn: () => { const w = wrong().filter(i => D.sol[i]); const pool = w.length ? w : wrong(); if (pool.length) fix([pool[Math.floor(Math.random() * pool.length)]]); } },
        { ic: "▤", t: "Открыть строку", s: "Строку, где больше всего работы", c: 3, fn: () => { let best = -1, bn = -1; for (let y = 0; y < D.h; y++) { let n = 0; for (let x = 0; x < D.w; x++) if (wrong().includes(y * D.w + x)) n++; if (n > bn) { bn = n; best = y; } } fix(Array.from({ length: D.w }, (_, x) => best * D.w + x)); } },
        { ic: "✓", t: "Проверить ошибки", s: "Покажем лишние закрашенные клетки", c: 0, fn: () => { this.bad = new Set(D.sol.map((v, i) => i).filter(i => r.st.g[i] === 1 && !D.sol[i])); this.paint(r); SK().toast(this.bad.size ? "Лишних клеток: " + this.bad.size : "Ошибок нет!"); } }
      ];
    },
    winInfo(r) {
      const D = r.data;
      if (D.pid) { const d = SK().store.get("nnDone", []); if (!d.includes(D.pid)) { d.push(D.pid); SK().store.set("nnDone", d); } }
      const pic = `<div class="nnpic" style="grid-template-columns:repeat(${D.w},1fr)">${D.sol.map(v => `<i class="${v ? "f" : ""}"></i>`).join("")}</div>`;
      return { title: D.name === "Узор" ? "Узор готов!" : "Это " + D.name.toLowerCase() + "!", pic, n: D.w + "×" + D.h, nl: "поле", next: "Новая картинка" };
    }
  };

  // ======================================================================
  // СУДОКУ
  // ======================================================================
  const SD = (() => {
    const peers = [];
    for (let i = 0; i < 81; i++) { const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3, s = new Set(); for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); s.add((br + Math.floor(k / 3)) * 9 + bc + k % 3); } s.delete(i); peers.push([...s]); }
    function count(g, limit) {
      let n = 0;
      const rec = () => {
        let best = -1, bo = null;
        for (let i = 0; i < 81; i++) if (!g[i]) { const used = new Set(peers[i].map(j => g[j])); const o = []; for (let d = 1; d <= 9; d++) if (!used.has(d)) o.push(d); if (!o.length) return; if (!bo || o.length < bo.length) { best = i; bo = o; if (o.length === 1) break; } }
        if (best < 0) { n++; return; }
        for (const d of bo) { g[best] = d; rec(); g[best] = 0; if (n >= limit) return; }
      };
      rec(); return n;
    }
    function full(rnd) {
      const g = new Array(81).fill(0);
      const rec = i => { if (i === 81) return true; const used = new Set(peers[i].map(j => g[j])); for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) { if (used.has(d)) continue; g[i] = d; if (rec(i + 1)) return true; } g[i] = 0; return false; };
      rec(0); return g;
    }
    function make(rnd, keep) {
      const sol = full(rnd), g = sol.slice();
      const order = shuffle(Array.from({ length: 81 }, (_, i) => i), rnd);
      let left = 81;
      for (const i of order) { if (left <= keep) break; const v = g[i]; g[i] = 0; if (count(g.slice(), 2) !== 1) g[i] = v; else left--; }
      return { sol, puz: g };
    }
    return { make, peers };
  })();
  const SUDOKU = {
    create(r) { const keep = { s: 40, m: 32, l: 26 }[r.size] || 32; return SD.make(rng("sd-" + r.seed), keep); },
    mount(r) {
      const D = r.data; r.st.v = r.st.v || D.puz.slice(); r.st.n = r.st.n || new Array(81).fill(0); r.st.rev = r.st.rev || [];
      this.sel = D.puz.findIndex(v => !v); this.notes = false; this.bad = new Set();
      $("#pzBody").innerHTML = `<div class="sdwrap"><div class="sd" id="sd"></div></div>`;
      $("#pzFoot").innerHTML = `<div class="sdpad" id="sdPad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-d="${d}">${d}</button>`).join("")}</div><div class="sdtools"><button id="sdNote">✎ Заметки: <b>выкл</b></button><button id="sdDel">⌫ Стереть</button></div>`;
      $("#sdPad").onpointerdown = e => { const b = e.target.closest("button"); if (!b) return; e.preventDefault(); this.input(r, +b.dataset.d); };
      $("#sdDel").onclick = () => this.input(r, 0);
      $("#sdNote").onclick = () => { this.notes = !this.notes; $("#sdNote").classList.toggle("on", this.notes); $("#sdNote b").textContent = this.notes ? "вкл" : "выкл"; };
      this.render(r);
    },
    render(r) {
      const body = $("#pzBody"), cs = Math.floor(Math.min((body.clientWidth - 20) / 9, (body.clientHeight - 16) / 9, 52));
      const sd = $("#sd"); sd.style.gridTemplateColumns = `repeat(9,${cs}px)`; sd.style.setProperty("--cs", cs + "px");
      sd.innerHTML = Array.from({ length: 81 }, (_, i) => `<div class="sc${i % 9 === 2 || i % 9 === 5 ? " bx" : ""}${Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? " by" : ""}" data-i="${i}"></div>`).join("");
      sd.onclick = e => { const c = e.target.closest(".sc"); if (!c) return; this.sel = +c.dataset.i; this.paint(r); };
      this.paint(r);
    },
    paint(r) {
      const D = r.data, v = r.st.v, sv = this.sel >= 0 ? v[this.sel] : 0, pe = new Set(this.sel >= 0 ? SD.peers[this.sel] : []);
      document.querySelectorAll("#sd .sc").forEach(el => {
        const i = +el.dataset.i, x = v[i];
        el.innerHTML = x ? x : r.st.n[i] ? `<div class="nt">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i>${r.st.n[i] & (1 << d) ? d : ""}</i>`).join("")}</div>` : "";
        el.className = "sc" + (i % 9 === 2 || i % 9 === 5 ? " bx" : "") + (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? " by" : "") + (D.puz[i] ? " given" : r.st.rev.includes(i) ? " rev" : x ? " u" : "") +
          (i === this.sel ? " cur" : pe.has(i) ? " peer" : "") + (sv && x === sv && i !== this.sel ? " same" : "") + (x && !D.puz[i] && (this.bad.has(i) || (SK().S.easy && x !== D.sol[i])) ? " bad" : "");
      });
      const cnt = {}; v.forEach(x => { if (x) cnt[x] = (cnt[x] || 0) + 1; });
      document.querySelectorAll("#sdPad button").forEach(b => b.classList.toggle("full", cnt[b.dataset.d] >= 9));
    },
    input(r, d) {
      const i = this.sel; if (r.done || i < 0 || r.data.puz[i] || r.st.rev.includes(i)) return;
      if (this.notes && d) { r.st.v[i] = 0; r.st.n[i] ^= (1 << d); }
      else { r.st.v[i] = r.st.v[i] === d ? 0 : d; r.st.n[i] = 0; this.bad.delete(i); if (d && r.st.v[i]) SD.peers[i].forEach(j => { r.st.n[j] &= ~(1 << d); }); }
      SK().buzz(6); this.paint(r); upTime(); save();
      if (r.st.v.every((x, k) => x === r.data.sol[k])) finish();
    },
    key(e) {
      const r = C.rec;
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); this.input(r, +e.key); }
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { e.preventDefault(); this.input(r, 0); }
      else if (e.key.startsWith("Arrow")) { e.preventDefault(); const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key]; this.sel = Math.min(80, Math.max(0, this.sel + d)); this.paint(r); }
    },
    status: r => "осталось " + (r.st.v ? r.st.v.filter(x => !x).length : 81) + " клеток",
    progress: r => { if (!r.data || !r.st.v) return 0; const empty = r.data.puz.filter(x => !x).length; return empty ? r.st.v.filter((x, i) => !r.data.puz[i] && x === r.data.sol[i]).length / empty : 0; },
    hints(r) {
      const D = r.data;
      return [
        { ic: "5", t: "Открыть цифру", s: "В выбранной клетке или любой пустой", c: 1, fn: () => { let i = this.sel; if (i < 0 || D.puz[i] || r.st.v[i] === D.sol[i]) i = r.st.v.findIndex((x, k) => x !== D.sol[k]); if (i < 0) return; r.st.v[i] = D.sol[i]; r.st.n[i] = 0; r.st.rev.push(i); this.sel = i; this.paint(r); upTime(); if (r.st.v.every((x, k) => x === D.sol[k])) finish(); } },
        { ic: "✓", t: "Проверить ошибки", s: "Подсветим неверные цифры", c: 0, fn: () => { this.bad = new Set(r.st.v.map((x, i) => i).filter(i => r.st.v[i] && r.st.v[i] !== D.sol[i])); this.paint(r); SK().toast(this.bad.size ? "Ошибок: " + this.bad.size : "Ошибок нет, так держать!"); } }
      ];
    },
    winInfo: r => ({ title: "Судоку решено!", medal: "🔢", n: ({ s: "Лёгкий", m: "Средний", l: "Сложный" })[r.size] || "Средний", nl: "уровень", next: "Новое судоку" })
  };

  const IMPL = { fill: FILL, chain: CHAIN, wfw: WFW, nono: NONO, sudoku: SUDOKU };

  // ---------- для app.js ----------
  window.SKG = {
    home, leave, gameSheet,
    info(x) { const I = IMPL[x.game]; return { label: title(x), progress: I && x.data ? I.progress(x) : 0 }; },
    resume(x) { mount(x); },
    boot(qs) {
      const g = qs.get("g"); if (!g || !GAMES[g]) return;
      const d = qs.get("d");
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= SK().today() && (g === "fill" || g === "sudoku")) return openDaily(g, d);
      if (g === "wfw") return start("wfw", null, null, qs.get("n") != null ? String(+qs.get("n") || 0) : null);
      const z = qs.get("z"), sizes = GAMES[g].sizes || [], t = qs.get("t");
      start(g, sizes.some(s => s[0] === z) ? z : (sizes[1] || sizes[0] || ["m"])[0], SK().THEMES.some(x => x.id === t) ? t : null, (qs.get("s") || "").slice(0, 40) || null);
    },
    _test: { fwPartition, nonoUnique, SD, ROOTS, subWords, CHAIN, FILL }
  };
})();
