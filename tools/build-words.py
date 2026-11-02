#!/usr/bin/env python3
"""Собирает базу слов из words/*.txt в words.js (используется приложением)."""
import json, re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "words"
OK = re.compile(r"^[А-Я]{2,11}$")

def norm(w):
    return w.strip().upper().replace("Ё", "Е")

words = {}   # слово -> список вопросов
themes = []
bad = []

def add(word, clues, line):
    w = norm(word)
    if not OK.match(w):
        bad.append(line); return None
    clues = [c.strip() for c in clues if c.strip()]
    if not clues:
        bad.append(line); return None
    lst = words.setdefault(w, [])
    for c in clues:
        if c not in lst and len(c) <= 34:
            lst.append(c)
    return w

for f in sorted(SRC.glob("*.txt")):
    theme = None
    for line in f.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("@"):
            tid, name, emoji, card, dates = line[1:].split("|")
            theme = next((t for t in themes if t["id"] == tid), None)
            if theme is None:
                theme = {"id": tid, "name": name, "emoji": emoji, "card": card, "dates": dates, "words": []}
                themes.append(theme)
            continue
        parts = line.split("|")
        w = add(parts[0], parts[1:], line)
        if w and theme is not None and w not in theme["words"]:
            theme["words"].append(w)

if bad:
    print("Пропущены строки:", *bad, sep="\n  ", file=sys.stderr)

items = sorted(words.items())
out = {
    "v": len(items),
    "w": [[w] + c for w, c in items],
    "themes": themes,
}
js = "// Сгенерировано tools/build-words.py — не редактировать вручную\nwindow.SKAN_WORDS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
(ROOT / "words.js").write_text(js, encoding="utf-8")
lens = {}
for w, _ in items:
    lens[len(w)] = lens.get(len(w), 0) + 1
print(f"Слов: {len(items)}, тем: {len(themes)}, по длине: {dict(sorted(lens.items()))}")
