"""自动节奏：把剪辑单里每段素材的「可用区间」变成真正的剪点。

调研结论（抖音高赞 vlog，见 references/调研出处.md）：
- 记录类中位 1.2–2 秒一刀，20–50% 的镜头不到 1 秒；长短交替，隔几刀有一个 2.5 秒以上的「喘气」镜头。
- 开头 1 秒内切第一刀；切在动作上，不切在说话中间；剪点落在音乐节拍上。

做法：
1. 每段素材算运动曲线（低分辨率帧差）和声音曲线（短时能量）。
2. 按风格的节奏型（pattern × base）给每一刀分配时长；clip 的 role 可改：hook 钩子 / breath 喘气长镜头 / detail 特写 / fast 快切。
3. 在可用区间里挑一截：动作镜头挑运动最饱满的一截，喘气和特写镜头挑最稳的一截；两端尽量落在声音低谷（不切断说话）。
4. 素材够长、风格允许时拆成 2–3 刀跳切（split）。
5. 剪点再对齐节拍（由 vlog_engine.snap_clips 完成，这里只给出目标时长）。
锁定的段落（"lock": true）保持剪辑单里的入点出点。
"""
import copy, json, subprocess
from pathlib import Path

import numpy as np

FPS_A = 10   # 运动分析帧率


def _curves(src, cache_dir):
    cache = Path(cache_dir) / (Path(src).stem + "_curves.json")
    if cache.exists():
        j = json.loads(cache.read_text())
        return np.array(j["m"]), np.array(j["a"])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vf", f"fps={FPS_A},scale=48:48,format=gray",
                          "-f", "rawvideo", "-"], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 48 * 48).astype(np.float32) if raw else np.zeros((1, 2304), np.float32)
    m = np.concatenate([[0], np.abs(np.diff(fr, axis=0)).mean(1)]) if len(fr) > 1 else np.zeros(len(fr))
    au = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                        capture_output=True).stdout
    if au:
        x = np.frombuffer(au, "<i2").astype(np.float32) / 32768
        hop = 8000 // FPS_A
        n = len(x) // hop
        a = np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-9) if n else np.zeros(1)
    else:
        a = np.zeros(len(m))
    L = max(len(m), len(a))
    m = np.pad(m, (0, L - len(m)), mode="edge"); a = np.pad(a, (0, L - len(a)), mode="edge")
    cache.write_text(json.dumps({"m": m.round(3).tolist(), "a": a.round(5).tolist()}))
    return m, a


def _pick(m, a, lo, hi, L, mode, avoid=()):
    """在 [lo, hi] 秒里挑长度 L 的一截，返回起点。mode=action 取运动最饱满，steady 取最稳。"""
    if hi - lo <= L + 1e-3:
        return lo
    i0, i1, n = int(lo * FPS_A), int((hi - L) * FPS_A), max(1, int(L * FPS_A))
    i1 = min(i1, len(m) - n)
    if i1 <= i0:
        return lo
    cs = np.concatenate([[0], np.cumsum(m)])
    a_med = np.median(a) + 1e-6
    best, bs = i0, -1e9
    for i in range(i0, i1 + 1):
        mean_m = (cs[i + n] - cs[i]) / n
        sc = mean_m if mode == "action" else -mean_m
        # 剪点落在说话中间要扣分（两端 0.15 秒的平均声音能量相对中位数）
        for j in (i, i + n - 1):
            k = slice(max(0, j - 1), min(len(a), j + 2))
            sc -= 0.6 * max(0.0, float(a[k].mean()) / a_med - 1.2) * (np.std(m) + 1e-3)
        # 避开已经用过的部分（同一段素材拆成几刀时）
        for (u0, u1) in avoid:
            if i / FPS_A < u1 and (i + n) / FPS_A > u0:
                sc -= 1e3
        if sc > bs:
            bs, best = sc, i
    return best / FPS_A


def apply(plan, style, info, work):
    P = dict(style.get("pace") or {})
    P.update(plan.get("pace") or {})
    if not P.get("auto", False) or plan.get("auto_pace") is False:
        return plan["clips"]
    base = P.get("base", 1.5)
    pattern = P.get("pattern") or [1.0, 0.6, 1.3, 0.7, 0.5, 1.8]
    mn, mx = P.get("min", 0.4), P.get("max", 3.5)
    roles = {"hook": P.get("hook", 0.9), "breath": P.get("breath", base * 1.9), "detail": base * 0.9, "fast": max(mn, base * 0.45)}
    out, k = [], 0
    for idx, c in enumerate(plan["clips"]):
        inf = info[c["src"]]
        if c.get("lock") or inf.get("image"):
            c2 = dict(c); c2["_from"] = idx; out.append(c2); continue
        sp = c.get("speed", 1.0)
        lo, hi = float(c.get("in", 0)), float(c.get("out", inf["duration"]))
        role = c.get("role") or ("hook" if idx == 0 and P.get("hook_first", True) else None)
        if c.get("len"):
            L = float(c["len"])
        elif role in roles:
            L = roles[role]
        else:
            L = base * pattern[k % len(pattern)]; k += 1
        # 有字幕的镜头不能短到读不完；读不完的由字幕跨镜头解决，这里只保底
        if c.get("text") or c.get("stamp"):
            L = max(L, P.get("text_min", 0.9))
        L = float(np.clip(L, mn, mx))
        avail = (hi - lo) / sp
        m, a = _curves(c["src"], work)
        mode = "steady" if role in ("breath", "detail") or c.get("steady") else "action"
        nsplit = 1
        if P.get("split", True) and not c.get("no_split") and role not in ("hook", "breath") and avail >= L * 2.6 and not (c.get("text") and P.get("split_text") is False):
            nsplit = min(int(c.get("split", P.get("split_max", 3))), int(avail // (L * 1.3)))
            nsplit = max(1, nsplit)
        used = []
        segs = []
        for j in range(nsplit):
            Lj = L if j == 0 else float(np.clip(base * pattern[k % len(pattern)], mn, mx)); k += (1 if j else 0)
            s = _pick(m, a, lo, hi, Lj * sp, mode, used)
            used.append((s - 0.3, s + Lj * sp + 0.3))
            segs.append((s, Lj))
        segs.sort()
        for j, (s, Lj) in enumerate(segs):
            c2 = copy.deepcopy(c)
            c2["in"], c2["out"] = round(s, 3), round(s + Lj * sp, 3)
            c2["_from"] = idx
            if j > 0:   # 跳切的后几刀不重复字幕和标签，字幕由第一刀延续
                for f in ("text", "stamp", "en", "hl", "tag", "price", "no", "name", "word"):
                    c2.pop(f, None)
                c2.pop("transition", None)
            elif nsplit > 1:
                c2.pop("transition", None)
            if j == len(segs) - 1 and c.get("transition"):
                c2["transition"] = c["transition"]; c2["transition_dur"] = c.get("transition_dur")
            out.append(c2)
    # 旁白挂的段落编号要换成新编号（挂在原段落的第一刀上）
    first = {}
    for i, c in enumerate(out):
        first.setdefault(c["_from"], i)
    for v in plan.get("vo") or []:
        if "clip" in v:
            v["clip"] = first.get(v["clip"], v["clip"])
    for o in plan.get("overlays") or []:
        if "clip" in o:
            o["clip"] = first.get(o["clip"], o["clip"])
    return out


def caption_hold(plan, style):
    """字幕跨镜头：一句字幕至少显示 text_min 秒（按字数加长），本镜头不够长就延续到后面没有字幕的镜头上。"""
    P = style.get("pace") or {}
    if not P.get("auto"):
        return
    clips = plan["clips"]
    for i, c in enumerate(clips):
        t = (c.get("text") or "") + (c.get("en") and " " or "")
        if not t.strip():
            continue
        need = P.get("read_base", 0.7) + P.get("read_per_char", 0.11) * len(c.get("text", ""))
        have = (c["out"] - c["in"]) / c.get("speed", 1.0)
        h = 0
        j = i + 1
        while have < need and j < len(clips) and not (clips[j].get("text") or clips[j].get("stamp")) and h < 3:
            have += (clips[j]["out"] - clips[j]["in"]) / clips[j].get("speed", 1.0)
            h += 1; j += 1
        if h:
            c["hold"] = h
