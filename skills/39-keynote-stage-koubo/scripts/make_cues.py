#!/usr/bin/env python3
"""把 whisper 词级结果（或 SRT）切成整句字幕，输出待人工核对的 cues.json 和 captions.srt。

用法：
  python3 make_cues.py --words words.json --out cues.json [--max-chars 20] [--gap 0.45]
  python3 make_cues.py --srt 原字幕.srt --out cues.json        # 已有剪辑软件导出的字幕

cues.json：{"reviewed": false, "source": "...", "cues": [{"i": 0, "s": 1.78, "e": 4.1, "text": "…"}]}
人工逐句听过、改对字后，把 reviewed 改成 true，build_params.py 才会把它当作已核对的时间。
"""
import argparse, json, re, sys

END = "。！？!?…"
SOFT = "，,、；;：:"


def from_words(path, max_chars, gap):
    r = json.load(open(path, encoding="utf-8"))
    words = [w for s in r["segments"] for w in s.get("words", [])]
    if not words:
        sys.exit("words.json 里没有词级时间（转写时要开 word_timestamps）")
    cues, cur = [], []

    def flush():
        if not cur:
            return
        text = "".join(w["word"] for w in cur).strip()
        text = text.replace(",", "，").replace("?", "？").replace("!", "！")
        cues.append({"s": round(cur[0]["start"], 3), "e": round(cur[-1]["end"], 3), "text": text})
        cur.clear()

    for i, w in enumerate(words):
        if cur and w["start"] - cur[-1]["end"] >= gap:
            flush()
        cur.append(w)
        t = w["word"].strip()
        length = len(re.sub(r"\s", "", "".join(x["word"] for x in cur)))
        if t and (t[-1] in END or (t[-1] in SOFT and length >= max_chars * 0.6) or length >= max_chars):
            flush()
    flush()
    # 去掉句末逗号，保留问号叹号句号
    for c in cues:
        c["text"] = c["text"].rstrip("，、；：")
    return cues


def from_srt(path):
    blocks = re.split(r"\n\s*\n", open(path, encoding="utf-8-sig").read().strip())
    ts = lambda x: sum(float(p) * m for p, m in zip(x.replace(",", ".").split(":"), (3600, 60, 1)))
    cues = []
    for b in blocks:
        lines = [l for l in b.splitlines() if l.strip()]
        k = next((i for i, l in enumerate(lines) if "-->" in l), None)
        if k is None:
            continue
        s, e = [ts(x.strip()) for x in lines[k].split("-->")]
        cues.append({"s": round(s, 3), "e": round(e, 3), "text": "".join(lines[k + 1:]).strip()})
    return cues


def srt_time(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", ",")


ap = argparse.ArgumentParser()
g = ap.add_mutually_exclusive_group(required=True)
g.add_argument("--words")
g.add_argument("--srt")
ap.add_argument("--out", required=True)
ap.add_argument("--max-chars", type=int, default=20)
ap.add_argument("--gap", type=float, default=0.45, help="超过这个停顿就断句（秒）")
a = ap.parse_args()

cues = from_words(a.words, a.max_chars, a.gap) if a.words else from_srt(a.srt)
for i, c in enumerate(cues):
    c["i"] = i
    if c["e"] <= c["s"]:
        sys.exit(f"第 {i} 句时间不合法：{c}")
    if i and c["s"] < cues[i - 1]["e"] - 1e-3:
        print(f"提醒：第 {i} 句与上一句重叠", file=sys.stderr)
out = {"reviewed": False, "source": a.words or a.srt, "cues": [{"i": c["i"], "s": c["s"], "e": c["e"], "text": c["text"]} for c in cues]}
json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
srt = a.out.rsplit(".", 1)[0] + ".srt"
with open(srt, "w", encoding="utf-8") as f:
    for c in cues:
        f.write(f"{c['i'] + 1}\n{srt_time(c['s'])} --> {srt_time(c['e'])}\n{c['text']}\n\n")
for c in cues:
    print(f"{c['i']:>3} {c['s']:7.2f}-{c['e']:7.2f} {c['text']}")
print(f"共 {len(cues)} 句。逐句试听核对文字和时间后，把 {a.out} 里的 reviewed 改为 true。", file=sys.stderr)
