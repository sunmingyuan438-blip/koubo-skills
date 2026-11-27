#!/usr/bin/env python3
"""vlog 剪辑引擎：一份剪辑单（plan.json）+ 一份风格（style.json）→ 成片 mp4 和/或可编辑的剪映草稿。

    python3 vlog_engine.py plan.json [--style ../style.json] [--out 输出目录] [--export] [--draft] [--preview]

--export   用 ffmpeg 一次出片（默认）。素材是 iPhone 4K HDR（HLG）时保持原分辨率、原帧率、10bit HLG，不降画质。
--draft    生成剪映草稿目录（主轨视频按剪点切好、原生字幕可改字、包装图层、旁白和配乐分轨）。
--preview  只出 540 宽的快速预览（检查节奏用，不当成片）。

剪辑单的字段见 references/剪辑单格式.md。引擎只做排版和合成，镜头选哪段、字幕写什么由人（或 Claude）在剪辑单里决定。
"""
import argparse, copy, hashlib, json, math, os, shutil, subprocess, sys, time, uuid, wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
FONT_DIR = HERE / "fonts"

# ---------------------------------------------------------------- 字体
FONTS = {
    "noto": (str(FONT_DIR / "NotoSansSC.ttf"), None),
    "heiti": ("/System/Library/Fonts/STHeiti Medium.ttc", 1),
    "hiragino": ("/System/Library/Fonts/Hiragino Sans GB.ttc", 0),
    "hiragino-bold": ("/System/Library/Fonts/Hiragino Sans GB.ttc", 2),
    "songti": ("/System/Library/Fonts/Supplemental/Songti.ttc", 6),
    "songti-bold": ("/System/Library/Fonts/Supplemental/Songti.ttc", 1),
    "songti-black": ("/System/Library/Fonts/Supplemental/Songti.ttc", 0),
    "songti-light": ("/System/Library/Fonts/Supplemental/Songti.ttc", 3),
    "didot": ("/System/Library/Fonts/Supplemental/Didot.ttc", 0),
    "didot-italic": ("/System/Library/Fonts/Supplemental/Didot.ttc", 1),
    "georgia": ("/System/Library/Fonts/Supplemental/Georgia.ttf", 0),
    "baskerville": ("/System/Library/Fonts/Supplemental/Baskerville.ttc", 0),
    "baskerville-italic": ("/System/Library/Fonts/Supplemental/Baskerville.ttc", 1),
    "din": ("/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf", 0),
    "din-condensed": ("/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf", 0),
    "futura": ("/System/Library/Fonts/Supplemental/Futura.ttc", 0),
    "futura-bold": ("/System/Library/Fonts/Supplemental/Futura.ttc", 2),
    "menlo": ("/System/Library/Fonts/Menlo.ttc", 0),
    "menlo-bold": ("/System/Library/Fonts/Menlo.ttc", 1),
    "impact": ("/System/Library/Fonts/Supplemental/Impact.ttf", 0),
}
_font_cache = {}


def font(spec, px):
    """spec 例：'noto:Bold'、'songti-bold'、'didot'。"""
    key = (spec, int(px))
    if key in _font_cache:
        return _font_cache[key]
    name, _, weight = spec.partition(":")
    path, idx = FONTS.get(name, FONTS["noto"])
    f = ImageFont.truetype(path, int(px), index=idx or 0)
    if name == "noto":
        try:
            f.set_variation_by_name(weight or "Medium")
        except Exception:
            pass
    _font_cache[key] = f
    return f


def has_glyphs(spec, text):
    """西文字体缺中文时退回 noto，避免出现方框（已踩过的坑：缺字显示成豆腐块）。"""
    name = spec.partition(":")[0]
    if name in ("didot", "didot-italic", "georgia", "baskerville", "baskerville-italic", "din", "din-condensed",
                "futura", "futura-bold", "menlo", "menlo-bold", "impact"):
        return all(ord(ch) < 0x2E80 for ch in text)
    return True


def hex2rgb(h, a=255):
    h = h.lstrip("#")
    if len(h) == 8:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4, 6))
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


# ---------------------------------------------------------------- 探测素材
def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
                       capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    v = next((s for s in j["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    info = {"duration": float(j["format"].get("duration") or 0), "has_audio": a is not None}
    if v:
        w, h = int(v["width"]), int(v["height"])
        rot = 0
        for sd in v.get("side_data_list") or []:
            if "rotation" in sd:
                rot = int(sd["rotation"])
        rot = int((v.get("tags") or {}).get("rotate", rot))
        if abs(rot) % 180 == 90:
            w, h = h, w
        fr = v.get("avg_frame_rate") or v.get("r_frame_rate") or "30/1"
        n, d = fr.split("/")
        fps = float(n) / float(d) if float(d) else 30.0
        info.update(width=w, height=h, fps=fps, hdr=v.get("color_transfer") in ("arib-std-b67",),
                    pq=v.get("color_transfer") == "smpte2084", pix=v.get("pix_fmt"), codec=v.get("codec_name"),
                    image=v.get("codec_name") in ("png", "mjpeg", "webp") and info["duration"] < 0.2)
    return info


def std_fps(f):
    for s in (24, 25, 30, 50, 60):
        if abs(f - s) < 1.2 or abs(f - s * 1000 / 1001) < 0.05:
            return s
    return int(round(f))


# ---------------------------------------------------------------- 文字图层（PIL）
class Layerer:
    """按模板把文字/色块画成透明 PNG。尺寸单位：画布宽度的比例（字号、边距）；位置 x/y 是画布比例。"""

    def __init__(self, W, H, hdr, outdir):
        self.W, self.H, self.hdr, self.dir = W, H, hdr, Path(outdir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def col(self, c, alpha=None):
        r, g, b, a = hex2rgb(c) if isinstance(c, str) else c
        if alpha is not None:
            a = int(255 * alpha)
        if self.hdr:   # HLG 里普通白 ≈ 75% 信号，图文按比例压低，避免字亮得刺眼
            r, g, b = (int(v * 0.75) for v in (r, g, b))
        return (r, g, b, a)

    def wrap(self, text, f, maxw, d):
        lines = []
        for para in str(text).split("\n"):
            cur = ""
            for ch in para:
                if d.textlength(cur + ch, font=f) > maxw and cur:
                    lines.append(cur); cur = ch
                else:
                    cur += ch
            lines.append(cur)
        return lines

    def draw_text_layer(self, im, L, vals):
        W, H = self.W, self.H
        d = ImageDraw.Draw(im)
        text = L.get("text", "")
        for k, v in vals.items():
            text = text.replace("{" + k + "}", str(v))
        if "{" in text and "}" in text:   # 缺字段的图层不画
            return None
        if not text.strip():
            return None
        if L.get("upper"):
            text = text.upper()
        spec = L.get("font", "noto:Medium")
        if not has_glyphs(spec, text):
            spec = L.get("font_fallback", "noto:Bold")
        px = L.get("size", 0.04) * W
        maxw = L.get("maxw", 0.86) * W
        f = font(spec, px)
        track = L.get("tracking", 0) * px
        lines = self.wrap(text, f, maxw, d) if not L.get("nowrap") else str(text).split("\n")
        # 放不下就缩字号（最多缩到 60%）
        while L.get("fit") and len(lines) > L.get("max_lines", 2) and px > L.get("size") * W * 0.6:
            px *= 0.92; f = font(spec, px); lines = self.wrap(text, f, maxw, d)
        lh = px * L.get("lh", 1.3)
        widths = [d.textlength(s, font=f) + track * max(0, len(s) - 1) for s in lines]
        bw, bh = max(widths), lh * (len(lines) - 1) + px
        x, y = L.get("x", 0.5) * W, L.get("y", 0.5) * H
        ax, ay = {"center": (0.5, 0.5), "left": (0, 0.5), "right": (1, 0.5), "top": (0.5, 0), "bottom": (0.5, 1),
                  "topleft": (0, 0), "topright": (1, 0), "bottomleft": (0, 1), "bottomright": (1, 1)}[L.get("anchor", "center")]
        x0, y0 = x - ax * bw, y - ay * bh
        align = L.get("align", "center" if ax == 0.5 else ("left" if ax == 0 else "right"))
        # 底框（标签、气泡、色块）
        box = L.get("box")
        if box:
            pad = box.get("pad", [0.35, 0.22])
            px_, py_ = pad[0] * px, pad[1] * px
            r = box.get("radius", 0) * (bh + 2 * py_)
            per_line = box.get("per_line")
            rects = []
            if per_line:
                for i, (s, w_) in enumerate(zip(lines, widths)):
                    lx = x0 + (bw - w_) * (0.5 if align == "center" else (1 if align == "right" else 0))
                    ly = y0 + i * lh
                    rects.append((lx - px_, ly - py_ * 0.7, lx + w_ + px_, ly + px + py_ * 0.9))
            else:
                rects.append((x0 - px_, y0 - py_ * 0.7, x0 + bw + px_, y0 + bh + py_ * 0.9))
            if box.get("shadow"):
                sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
                o = box["shadow"] * px
                for rc in rects:
                    sd.rounded_rectangle((rc[0] + o, rc[1] + o, rc[2] + o, rc[3] + o), radius=r, fill=self.col(box.get("shadow_color", "#000000"), 1))
                im.alpha_composite(sh)
            for rc in rects:
                d.rounded_rectangle(rc, radius=r, fill=self.col(box.get("color", "#000000"), box.get("alpha", 0.85)),
                                    outline=self.col(box["outline"]) if box.get("outline") else None,
                                    width=int(box.get("outline_w", 0.06) * px) if box.get("outline") else 0)
        # 投影（柔和阴影，不描边）
        shadow = L.get("shadow", 0)
        stroke = L.get("stroke", 0) * px

        def put(dr, fill, dx=0, dy=0, sw=0, sf=None):
            for i, (s, w_) in enumerate(zip(lines, widths)):
                lx = x0 + (bw - w_) * (0.5 if align == "center" else (1 if align == "right" else 0))
                ly = y0 + i * lh
                if track:
                    cx = lx
                    for ch in s:
                        dr.text((cx + dx, ly + dy), ch, font=f, fill=fill, stroke_width=int(sw), stroke_fill=sf)
                        cx += dr.textlength(ch, font=f) + track
                else:
                    dr.text((lx + dx, ly + dy), s, font=f, fill=fill, stroke_width=int(sw), stroke_fill=sf)

        if shadow:
            sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
            put(ImageDraw.Draw(sh), self.col(L.get("shadow_color", "#000000"), 1), 0, px * 0.05, max(1, px * 0.06), self.col(L.get("shadow_color", "#000000"), 1))
            sh = sh.filter(ImageFilter.GaussianBlur(px * 0.12))
            a = sh.split()[3].point(lambda v: int(min(255, v * shadow * 1.6)))
            sh.putalpha(a)
            im.alpha_composite(sh)
        if L.get("hard_shadow"):
            o = L["hard_shadow"] * px
            put(d, self.col(L.get("shadow_color", "#000000")), o, o, stroke, self.col(L.get("shadow_color", "#000000")) if stroke else None)
        put(d, self.col(L.get("color", "#ffffff")), 0, 0, stroke, self.col(L.get("stroke_color", "#000000")) if stroke else None)
        return (x0, y0, bw, bh)

    def draw_shape(self, im, L, vals):
        W, H = self.W, self.H
        d = ImageDraw.Draw(im)
        k = L["shape"]
        c = self.col(L.get("color", "#ffffff"), L.get("alpha"))
        if k == "rect":
            x, y, w, h = L["rect"]
            d.rounded_rectangle((x * W, y * H, (x + w) * W, (y + h) * H), radius=L.get("radius", 0) * W, fill=c,
                                outline=self.col(L["outline"]) if L.get("outline") else None, width=int(L.get("outline_w", 0) * W))
        elif k == "line":
            x0, y0, x1, y1 = L["line"]
            d.line((x0 * W, y0 * H, x1 * W, y1 * H), fill=c, width=max(1, int(L.get("width", 0.003) * W)))
        elif k == "circle":
            x, y, r = L["circle"]
            d.ellipse((x * W - r * W, y * H - r * W, x * W + r * W, y * H + r * W), fill=c if not L.get("ring") else None,
                      outline=c if L.get("ring") else None, width=int(L.get("ring", 0) * W))
        elif k == "rec_frame":   # 取景框四角 + REC
            m = L.get("margin", 0.05) * W; ln = L.get("len", 0.07) * W; wd = max(2, int(L.get("width", 0.004) * W))
            for (cx, cy, sx, sy) in ((m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)):
                d.line((cx, cy, cx + sx * ln, cy), fill=c, width=wd); d.line((cx, cy, cx, cy + sy * ln), fill=c, width=wd)

    def render(self, name, template, vals, anim=None):
        """返回 (png 路径, x, y) 或 None。PNG 已裁到内容边界，节省叠加开销。"""
        im = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
        drawn = False
        for L in template:
            if L.get("when") and not all(vals.get(k) for k in L["when"].split(",")):
                continue
            if "shape" in L:
                self.draw_shape(im, L, vals); drawn = True
            elif self.draw_text_layer(im, L, vals):
                drawn = True
        if not drawn:
            return None
        bb = im.getbbox()
        if not bb:
            return None
        pad = int(0.01 * self.W)
        bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(self.W, bb[2] + pad), min(self.H, bb[3] + pad))
        bb = (bb[0] // 2 * 2, bb[1] // 2 * 2, min(self.W, (bb[2] + 1) // 2 * 2), min(self.H, (bb[3] + 1) // 2 * 2))
        crop = im.crop(bb)
        p = self.dir / f"{name}.png"
        crop.save(p)
        out = {"png": str(p), "x": bb[0], "y": bb[1], "w": crop.width, "h": crop.height}
        if anim and anim.get("kind") in ("type", "pop", "rise"):
            out["seq"] = self.anim_seq(name, crop, anim, vals, template)
        return out

    def anim_seq(self, name, crop, anim, vals, template):
        """入场动画帧序列（只做入场，出场用淡出）。type=逐字打出；pop=弹出缩放；rise=上浮。"""
        fps, n = anim.get("fps", 30), max(2, int(anim.get("dur", 0.35) * anim.get("fps", 30)))
        seqdir = self.dir / f"{name}_seq"; seqdir.mkdir(exist_ok=True)
        if anim["kind"] == "type":
            full = vals.get("text", "")
            k = anim.get("field", "text")
            full = str(vals.get(k, ""))
            n = max(2, len(full))
            frames = []
            for i in range(1, n + 1):
                v2 = dict(vals); v2[k] = full[:i]
                im = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
                for L in template:
                    if L.get("when") and not all(v2.get(q) for q in L["when"].split(",")):
                        continue
                    if "shape" in L:
                        self.draw_shape(im, L, v2)
                    else:
                        self.draw_text_layer(im, L, v2)
                frames.append(im)
            bb = (0, 0, self.W, self.H)
            res = []
            x0, y0 = None, None
            for i, im in enumerate(frames):
                p = seqdir / f"{i:03d}.png"; im.save(p); res.append(str(p))
            return {"dir": str(seqdir), "n": len(res), "fps": anim.get("cps", 14), "full": True}
        res = []
        for i in range(n):
            u = (i + 1) / n
            e = 1 - (1 - u) ** 3
            im = Image.new("RGBA", crop.size, (0, 0, 0, 0))
            if anim["kind"] == "pop":
                s = 0.6 + 0.4 * e + 0.08 * math.sin(math.pi * u) * (1 - u)
                c2 = crop.resize((max(1, int(crop.width * s)), max(1, int(crop.height * s))), Image.BICUBIC)
                im.alpha_composite(c2, ((crop.width - c2.width) // 2, (crop.height - c2.height) // 2))
            else:   # rise
                dy = int((1 - e) * 0.03 * self.H)
                c2 = crop.copy(); a = c2.split()[3].point(lambda v: int(v * e)); c2.putalpha(a)
                im.alpha_composite(c2, (0, min(crop.height - 1, dy)))
            p = seqdir / f"{i:03d}.png"; im.save(p); res.append(str(p))
        return {"dir": str(seqdir), "n": n, "fps": fps, "full": False}


# ---------------------------------------------------------------- 音乐节拍
def beats_of(music, total):
    bj = Path(str(music) + ".beats.json")
    if bj.exists():
        return json.loads(bj.read_text())["beats"]
    # 没有节拍文件：用能量起伏估计（够用来卡点，不追求精确）
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(music), "-t", str(total + 2), "-ac", "1", "-ar", "11025", "-f", "s16le", "-"],
                         capture_output=True).stdout
    x = np.frombuffer(raw, "<i2").astype(np.float32) / 32768
    hop = 256
    fr = np.lib.stride_tricks.sliding_window_view(x, 1024)[::hop]
    spec = np.abs(np.fft.rfft(fr * np.hanning(1024), axis=1))
    flux = np.maximum(0, np.diff(np.log1p(spec), axis=0)).sum(1)
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    sr_f = 11025 / hop
    ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
    lo, hi = int(sr_f * 60 / 160), int(sr_f * 60 / 70)
    lag = lo + int(np.argmax(ac[lo:hi]))
    period = lag / sr_f
    best, phase = -1, 0
    for ph in np.linspace(0, period, 32, endpoint=False):
        idx = ((np.arange(ph, len(flux) / sr_f, period)) * sr_f).astype(int)
        idx = idx[idx < len(flux)]
        sc = flux[idx].sum()
        if sc > best:
            best, phase = sc, ph
    return [round(t, 3) for t in np.arange(phase, total + period, period)]


def snap_clips(clips, beats, unit, info):
    """把每个剪点对齐到最近的节拍（unit=每几拍可切一刀，0.5 表示半拍），只改片段出点。"""
    if not beats:
        return
    grid = []
    for i in range(len(beats) - 1):
        a, b = beats[i], beats[i + 1]
        if unit < 1:
            grid += [a, (a + b) / 2]
        elif i % int(unit) == 0:
            grid.append(a)
    grid = np.array(sorted(grid))
    t = 0.0
    for c in clips:
        d = (c["out"] - c["in"]) / c.get("speed", 1.0)
        target = t + d
        cand = grid[(grid > t + max(0.2, c.get("_min", 0) - 0.02)) & (grid < t + max(d * 1.6, c.get("_min", 0)) + 0.3)]
        if len(cand):
            nb = cand[np.argmin(np.abs(cand - target))]
            nd = nb - t
            avail = (info[c["src"]]["duration"] - c["in"]) / c.get("speed", 1.0) if not info[c["src"]].get("image") else 99
            if nd <= avail - 0.02:
                c["out"] = round(c["in"] + nd * c.get("speed", 1.0), 3)
                d = nd
        t += d


# ---------------------------------------------------------------- 主流程
def load(plan_path, style_path):
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    sp = Path(style_path) if style_path else (Path(plan_path).resolve().parent / plan.get("style", "style.json"))
    if not sp.exists():
        sp = HERE.parent / "style.json"
    style = json.loads(sp.read_text(encoding="utf-8"))
    for k, v in (plan.get("style_overrides") or {}).items():   # 剪辑单可局部覆盖风格
        if isinstance(v, dict) and isinstance(style.get(k), dict):
            style[k].update(v)
        else:
            style[k] = v
    return plan, style


def resolve_paths(plan, base):
    for c in plan["clips"]:
        c["src"] = str((base / c["src"]).resolve()) if not os.path.isabs(c["src"]) else c["src"]
    for v in plan.get("vo") or []:
        if v.get("file"):
            v["file"] = str((base / v["file"]).resolve()) if not os.path.isabs(v["file"]) else v["file"]
    if plan.get("music", {}).get("file"):
        m = plan["music"]["file"]
        plan["music"]["file"] = str((base / m).resolve()) if not os.path.isabs(m) else m


def spec_of(plan, style, info, preview):
    """输出规格：跟着素材走（不降分辨率、不降帧率；HDR 素材保持 HLG）。"""
    vids = [info[c["src"]] for c in plan["clips"] if not info[c["src"]].get("image")]
    land = style.get("canvas", "portrait") == "landscape"
    if plan.get("canvas"):
        land = plan["canvas"] == "landscape"
    short = max([min(v["width"], v["height"]) for v in vids] or [1080])
    short = min(short, 2160)
    if style.get("max_short"):
        short = min(short, style["max_short"])
    if plan.get("max_short"):
        short = min(short, plan["max_short"])
    if plan.get("short"):   # 素材是低清代理（如 360p 试剪版）时，强制成片短边，例如 1080
        short = plan["short"]
    short = int(short) // 2 * 2
    W, H = (int(round(short * 16 / 9)) // 2 * 2, short) if land else (short, int(round(short * 16 / 9)) // 2 * 2)
    fpss = [std_fps(v["fps"]) for v in vids] or [30]
    fps = plan.get("fps") or style.get("fps")
    if not fps or fps == "auto":
        fps = max(set(fpss), key=fpss.count)
    hdr = bool(vids) and all(v.get("hdr") for v in vids) and not plan.get("force_sdr")   # 全是 HLG 才出 HDR；混拍统一转 SDR
    if preview:
        s = 540 / min(W, H)
        W, H = int(W * s) // 2 * 2, int(H * s) // 2 * 2
        fps = min(fps, 30)
    return W, H, int(fps), hdr


def tts_fill(plan, workdir, style=None):
    """旁白缺音频文件时，用 Fish 公共音色合成（不使用任何个人克隆音色）。"""
    need = [v for v in plan.get("vo") or [] if not v.get("file")]
    if not need:
        return
    sys.path.insert(0, str(HERE))
    import tts
    voice = plan.get("voice") or (style or {}).get("voice") or tts.DEFAULT_VOICE
    for i, v in enumerate(need):
        out = Path(workdir) / "vo" / (hashlib.md5((voice + v["text"]).encode()).hexdigest()[:12] + ".wav")
        out.parent.mkdir(parents=True, exist_ok=True)
        if not out.exists():
            tts.synth(v.get("say", v["text"]), voice, out, speed=plan.get("voice_speed", 1.0))
        v["file"] = str(out)


def wav_dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True).stdout or 0)


def split_caption(text, maxc):
    """长旁白按标点切成一屏一句（每屏不超过 maxc 个字）。"""
    import re
    parts = [p for p in re.split(r"(?<=[，。！？；,!?;…])", text) if p.strip()]
    out, cur = [], ""
    for p in parts:
        p2 = p.strip()
        if len(cur) + len(p2) <= maxc:
            cur += p2
        else:
            if cur:
                out.append(cur)
            while len(p2) > maxc:
                out.append(p2[:maxc]); p2 = p2[maxc:]
            cur = p2
    if cur:
        out.append(cur)
    P = "，,。；;、！!？?…"
    return [s2 for s2 in (s.strip(P) if s.endswith(tuple("，,。；;、")) else s.lstrip(P) for s in out) if s2]


def build_timeline(plan, style, info):
    td_default = style.get("transition", {}).get("dur", 0.4)
    t, segs = 0.0, []
    for i, c in enumerate(plan["clips"]):
        sp = c.get("speed", 1.0)
        d = (c["out"] - c["in"]) / sp
        tr = c.get("transition") or style.get("transition", {}).get("default", "cut")
        if i == len(plan["clips"]) - 1:
            tr = "cut"
        segs.append({"i": i, "start": round(t, 4), "dur": round(d, 4), "tr": tr, "td": c.get("transition_dur", td_default) if tr != "cut" else 0})
        t += d
    return segs, t


def collect_overlays(plan, style, segs, total, lay, W, H):
    """把剪辑单里的文字（每段的 text/stamp/tag…、旁白字幕、自由定时的 overlays）排成 (图层, 起, 止)。"""
    T = style.get("templates", {})
    out = []
    capk = style.get("clip_text", {})   # 片段字段 → 模板
    for s in segs:
        c = plan["clips"][s["i"]]
        vals = {k: v for k, v in c.items() if isinstance(v, (str, int, float))}
        for tk, rule in capk.items():
            need = rule.get("needs", "text").split(",")
            if not all(c.get(k) not in (None, "") for k in need):
                continue
            if rule.get("unless") and c.get(rule["unless"]):
                continue
            a = s["start"] + c.get("text_at", rule.get("delay", 0.08))
            b = s["start"] + s["dur"] - rule.get("early", 0.04) if not c.get("text_dur") else a + c["text_dur"]
            if c.get("hold") and not rule.get("no_hold") and ("text" in need or "stamp" in need):
                b = s["start"] + s["dur"] + sum(segs[j]["dur"] for j in range(s["i"] + 1, min(len(segs), s["i"] + 1 + c["hold"])))
            out.append({"tpl": tk, "vals": vals, "a": a, "b": min(b, total), "anim": rule.get("anim", style.get("text_anim")), "native": rule.get("native"), "clip": s["i"]})
    # 旁白字幕：按旁白音频时长等比分配给每一屏
    if style.get("vo_caption") and plan.get("vo"):
        maxc = style["vo_caption"].get("max", 14)
        for v in plan["vo"]:
            if v.get("no_caption"):
                continue
            st = v["_at"]; du = v["_dur"]
            chunks = split_caption(v["text"], maxc)
            n = sum(len(x) for x in chunks) or 1
            t0 = st
            for ch in chunks:
                d = du * len(ch) / n
                out.append({"tpl": style["vo_caption"].get("template", "caption"), "vals": {"text": ch, **{k: v2 for k, v2 in v.items() if k in ("en",)}},
                            "a": t0, "b": min(t0 + d, total), "anim": style["vo_caption"].get("anim"), "native": True})
                t0 += d
    for k, o in enumerate(plan.get("overlays") or []):
        a = o.get("at", 0) if "clip" not in o else segs[o["clip"]]["start"] + o.get("offset", 0)
        b = a + o.get("dur", 2.5) if o.get("dur") != "end" else total
        out.append({"tpl": o["template"], "vals": o, "a": a, "b": min(b, total), "anim": o.get("anim", (T.get(o["template"]) or {}).get("anim") if isinstance(T.get(o["template"]), dict) else None)})
    for k in ("title", "end"):
        o = plan.get(k)
        if o:
            tpl = o.get("template", k)
            if k == "title":
                a = o.get("at", 0.15); b = a + o.get("dur", 2.6)
            else:
                b = total - o.get("tail", 0.05); a = max(b - o.get("dur", 2.2), segs[-1]["start"] + 0.15)
            out.append({"tpl": tpl, "vals": o, "a": a, "b": min(b, total), "anim": o.get("anim", style.get(k + "_anim"))})
    # 片头标题和第一句字幕不叠：标题最晚在第一句字幕出现时收掉
    caps = sorted(o["a"] for o in out if o.get("clip") is not None or o.get("native"))
    for o in out:
        if o["tpl"] == (plan.get("title") or {}).get("template", "title") and plan.get("title") and o["vals"] is plan["title"]:
            later = [a for a in caps if a > o["a"] + 0.3]
            if later and later[0] < o["b"]:
                o["b"] = later[0]
    # 全片常驻（角标、水印）
    for k, o in enumerate(style.get("persistent") or []):
        if plan.get("no_" + o.get("id", "badge")):
            continue
        vals = dict(plan.get("badge_vals") or {}); vals.update(o.get("vals") or {})
        out.append({"tpl": o["template"], "vals": vals, "a": o.get("from", 0), "b": total - o.get("tail", 0), "anim": None})
    rendered = []
    for k, o in enumerate(out):
        tpl = T.get(o["tpl"])
        if tpl is None:
            raise SystemExit(f"风格里没有模板「{o['tpl']}」")
        layers = tpl["layers"] if isinstance(tpl, dict) else tpl
        r = lay.render(f"ov{k:03d}_{o['tpl']}", layers, o["vals"], o.get("anim"))
        if r:
            r.update(a=round(o["a"], 3), b=round(o["b"], 3), tpl=o["tpl"], vals=o["vals"], native=o.get("native"),
                     fade=(tpl.get("fade", style.get("text_fade", 0.18)) if isinstance(tpl, dict) else style.get("text_fade", 0.18)))
            rendered.append(r)
    return rendered


def hlg_cube(work, n=33):
    """HLG（BT.2100，BT.2020 原色）→ SDR（BT.709，gamma 2.4）的 3D LUT。参考白：HLG 75% 信号 → SDR 100%，高光软压缩。"""
    p = Path(work) / "hlg2sdr.cube"
    if p.exists():
        return str(p)
    a, b, c = 0.17883277, 0.28466892, 0.55991073
    g = np.linspace(0, 1, n)
    R, G, B = np.meshgrid(g, g, g, indexing="ij")
    def inv_oetf(e):
        return np.where(e <= 0.5, e * e / 3, (np.exp((e - c) / a) + b) / 12)
    rgb = np.stack([inv_oetf(R), inv_oetf(G), inv_oetf(B)], -1)
    Y = rgb @ np.array([0.2627, 0.6780, 0.0593])
    disp = rgb * (np.maximum(Y, 1e-6) ** 0.2)[..., None]          # OOTF（系统 gamma 1.2）
    ref = float(inv_oetf(np.array(0.75))) ** 1.2                    # 参考白
    lin = disp / ref
    m = np.array([[1.6605, -0.5876, -0.0728], [-0.1246, 1.1329, -0.0083], [-0.0182, -0.1006, 1.1187]])
    lin = np.clip(lin @ m.T, 0, None)
    k = 0.8                                                         # 高光软压缩
    lin = np.where(lin <= k, lin, k + (1 - k) * (1 - np.exp(-(lin - k) / (1 - k))))
    out = np.clip(lin, 0, 1) ** (1 / 2.4)
    with open(p, "w") as f:
        f.write(f"LUT_3D_SIZE {n}\n")
        for bi in range(n):
            for gi in range(n):
                for ri in range(n):
                    v = out[ri, gi, bi]
                    f.write(f"{v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
    return str(p)


def build_export(plan, style, info, segs, total, ovs, W, H, FPS, hdr, out_mp4, work, preview):
    cmd = ["ffmpeg", "-v", "error", "-stats", "-y"]
    fc, n = [], 0
    fmt = "yuv420p10le" if hdr else "yuv420p"
    tag = ("setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv" if hdr
           else "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv")
    clip_streams = []
    for s in segs:
        c = plan["clips"][s["i"]]
        inf = info[c["src"]]
        sp = c.get("speed", 1.0)
        ext = s["td"] if s["tr"] != "cut" else 0     # 有转场的片段尾部多取 td 秒，保证剪点位置与剪映草稿一致
        if inf.get("image"):
            cmd += ["-loop", "1", "-framerate", str(FPS), "-t", f"{s['dur'] + ext:.3f}", "-i", c["src"]]
        else:
            avail = inf["duration"] - c["in"]
            take = min(avail, (s["dur"] + ext) * sp)
            cmd += ["-ss", f"{c['in']:.3f}", "-t", f"{take:.3f}", "-i", c["src"]]
        k = n; n += 1
        c["_input"] = k
        ch = f"[{k}:v:0]setpts=(PTS-STARTPTS)/{sp},fps={FPS},"
        if not inf.get("image") and (s["dur"] + ext) * sp > inf["duration"] - c["in"] + 0.01:
            ch += f"tpad=stop_mode=clone:stop_duration={ext + 0.1:.3f},"
        ch += f"trim=duration={s['dur'] + ext:.3f},setpts=PTS-STARTPTS,settb=1/{FPS},"
        fit = c.get("fit") or style.get("fit", "cover")
        sw, sh = inf.get("width", W), inf.get("height", H)
        tm = ""
        if inf.get("hdr") and not hdr:   # HLG 素材放进 SDR 成片：按 BT.2100 → BT.709 转换，否则会发灰
            tm = (f"scale=in_color_matrix=bt2020:in_range=tv,format=gbrp,lut3d=file='{hlg_cube(work)}':interp=tetrahedral,"
                  f"scale=out_color_matrix=bt709:out_range=tv,")
        z = 1.0 + (style.get("move_amount", 0.06) if c.get("move") in ("push", "pull") else 0)
        if c.get("move") in ("pan_l", "pan_r", "tilt_up", "tilt_down"):
            z = 1.0 + style.get("move_amount", 0.06) * 1.6
        sub = f"cv{k}"
        if fit == "blur" and abs(sw / sh - W / H) > 0.05:
            fc.append(ch + f"{tm}split[{sub}a][{sub}b]")
            fc.append(f"[{sub}a]scale={W // 8}:{H // 8}:force_original_aspect_ratio=increase,crop={W // 8}:{H // 8},gblur=sigma=6,scale={W}:{H},eq=brightness=-0.06[{sub}bg]")
            fc.append(f"[{sub}b]scale={W}:{H}:force_original_aspect_ratio=decrease[{sub}fg]")
            fc.append(f"[{sub}bg][{sub}fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format={fmt}[{sub}0]")
        else:
            fc.append(ch + f"{tm}scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,format={fmt}[{sub}0]")
        cur = f"{sub}0"
        D = s["dur"] + ext
        mv = c.get("move")
        if mv in ("push", "pull"):
            a, b = (1.0, z) if mv == "push" else (z, 1.0)
            fc.append(f"[{cur}]scale=w='trunc({W}*({a}+({b}-{a})*t/{D:.3f})/2)*2':h=-2:eval=frame,crop={W}:{H},setsar=1[{sub}1]"); cur = f"{sub}1"
        elif mv in ("pan_l", "pan_r", "tilt_up", "tilt_down"):
            BW, BH = int(W * z) // 2 * 2, int(H * z) // 2 * 2
            if mv in ("pan_l", "pan_r"):
                xe = f"({BW - W})*t/{D:.3f}" if mv == "pan_r" else f"({BW - W})*(1-t/{D:.3f})"
                ye = f"{(BH - H) // 2}"
            else:
                ye = f"({BH - H})*(1-t/{D:.3f})" if mv == "tilt_up" else f"({BH - H})*t/{D:.3f}"
                xe = f"{(BW - W) // 2}"
            fc.append(f"[{cur}]scale={BW}:{BH},crop={W}:{H}:x='{xe}':y='{ye}',setsar=1[{sub}1]"); cur = f"{sub}1"
        if c.get("inset") or style.get("inset_all"):   # 白边相框：画面缩小贴在底色上
            ins = style.get("inset", {})
            sc = ins.get("scale", 0.74); bd = ins.get("border", 0.018)
            iw, ih = int(W * sc) // 2 * 2, int(H * sc) // 2 * 2
            b = int(W * bd) // 2 * 2
            bgc = ins.get("bg", "#efebe4")
            fc.append(f"[{cur}]split[{sub}p][{sub}q]")
            if ins.get("bg_mode") == "blur":
                fc.append(f"[{sub}p]scale={W // 10}:{H // 10},gblur=sigma=4,scale={W}:{H},eq=brightness=-0.08[{sub}bg2]")
            else:
                fc.append(f"color=c=0x{bgc.lstrip('#')}:s={W}x{H}:r={FPS}:d={D:.3f},format={fmt}[{sub}bg2]; [{sub}p]nullsink")
            fc.append(f"[{sub}q]scale={iw}:{ih},pad={iw + 2 * b}:{ih + 2 * b}:{b}:{b}:color=0x{ins.get('border_color', '#ffffff').lstrip('#')}[{sub}fr]")
            rot = c.get("tilt", 0)
            if rot:
                fc.append(f"[{sub}fr]format=rgba,rotate={rot}*PI/180:c=none:ow=rotw({rot}*PI/180):oh=roth({rot}*PI/180)[{sub}fr2]")
                fc.append(f"[{sub}bg2][{sub}fr2]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1,format={fmt}[{sub}2]")
            else:
                fc.append(f"[{sub}bg2][{sub}fr]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1,format={fmt}[{sub}2]")
            cur = f"{sub}2"
        if c.get("bw"):
            fc.append(f"[{cur}]hue=s=0[{sub}3]"); cur = f"{sub}3"
        clip_streams.append((cur, s))
    # 剪点 / 转场：xfade 的 offset = 下一段的名义起点
    XF = {"fade": "fade", "white": "fadewhite", "black": "fadeblack", "dissolve": "dissolve", "zoom": "zoomin",
          "slide": "slideleft", "slideup": "slideup", "wipe": "wipeleft", "blur": "hblur", "circle": "circleopen"}
    cur, curlen = clip_streams[0][0], clip_streams[0][1]["dur"] + clip_streams[0][1]["td"]
    for j in range(1, len(clip_streams)):
        prev_s = clip_streams[j - 1][1]
        nxt, s = clip_streams[j]
        lab = f"x{j}"
        if prev_s["tr"] == "cut":
            fc.append(f"[{cur}][{nxt}]concat=n=2:v=1:a=0,settb=1/{FPS}[{lab}]")
            curlen += s["dur"] + s["td"]
        else:
            fc.append(f"[{cur}][{nxt}]xfade=transition={XF.get(prev_s['tr'], 'fade')}:duration={prev_s['td']:.3f}:offset={s['start']:.3f},settb=1/{FPS}[{lab}]")
            curlen = s["start"] + s["dur"] + s["td"]
        cur = lab
    # 调色 + 颗粒 + 暗角 + 画幅
    g = style.get("grade", {})
    vf = g.get("hdr_vf" if hdr else "vf")
    post = []
    if vf:
        post.append(vf)
    if g.get("grain") and not preview:
        post.append(f"noise=alls={g['grain']}:allf=t")
    if g.get("vignette"):
        post.append(f"vignette=angle={g['vignette']}")
    fb = style.get("frame", {})
    if fb.get("kind") == "letterbox":
        bh = int((H - W / fb.get("ratio", 2.35)) / 2) if W > H else int((H - W / fb.get("ratio", 0.8)) / 2)
        if bh > 0:
            post.append(f"drawbox=x=0:y=0:w=iw:h={bh}:color=black:t=fill,drawbox=x=0:y=ih-{bh}:w=iw:h={bh}:color=black:t=fill")
    post.append(f"trim=duration={total:.3f}")
    fc.append(f"[{cur}]" + ",".join(post) + "[base]")
    cur = "base"
    # 文字图层
    for k, o in enumerate(ovs):
        dur = o["b"] - o["a"]
        if dur <= 0.05:
            continue
        f = min(o.get("fade", 0.18), dur / 3)
        if o.get("seq"):
            sq = o["seq"]
            cmd += ["-framerate", str(sq["fps"]), "-i", os.path.join(sq["dir"], "%03d.png")]
            ki = n; n += 1
            sd = sq["n"] / sq["fps"]
            cmd += ["-loop", "1", "-framerate", str(FPS), "-t", f"{max(0.05, dur - sd):.3f}", "-i", o["png"]]
            kh = n; n += 1
            xs = 0 if sq.get("full") else o["x"]; ys = 0 if sq.get("full") else o["y"]
            fc.append(f"[{ki}:v]format=rgba,fps={FPS},setpts=PTS-STARTPTS+{o['a']:.3f}/TB[s{k}]")
            fc.append(f"[{cur}][s{k}]overlay={xs}:{ys}:eof_action=pass:format={'yuv420p10' if hdr else 'yuv420'}[o{k}a]")
            fc.append(f"[{kh}:v]format=rgba,fade=t=out:st={max(0, dur - sd - f):.3f}:d={f:.3f}:alpha=1,setpts=PTS-STARTPTS+{o['a'] + sd:.3f}/TB[h{k}]")
            fc.append(f"[o{k}a][h{k}]overlay={o['x']}:{o['y']}:eof_action=pass:format={'yuv420p10' if hdr else 'yuv420'}[o{k}]")
        else:
            cmd += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", o["png"]]
            ki = n; n += 1
            fi = f"fade=t=in:st=0:d={f:.3f}:alpha=1," if f > 0 else ""
            fo = f"fade=t=out:st={dur - f:.3f}:d={f:.3f}:alpha=1," if f > 0 else ""
            fc.append(f"[{ki}:v]format=rgba,{fi}{fo}setpts=PTS-STARTPTS+{o['a']:.3f}/TB[s{k}]")
            fc.append(f"[{cur}][s{k}]overlay={o['x']}:{o['y']}:eof_action=pass:format={'yuv420p10' if hdr else 'yuv420'}[o{k}]")
        cur = f"o{k}"
    fade_out = style.get("fade_out", 0)
    fade_in = style.get("fade_in", 0)
    tail = []
    if fade_in:
        tail.append(f"fade=t=in:st=0:d={fade_in}")
    if fade_out:
        tail.append(f"fade=t=out:st={total - fade_out:.3f}:d={fade_out}")
    tail += [f"format={fmt}", tag]
    fc.append(f"[{cur}]" + ",".join(tail) + "[vout]")

    # ---------------- 声音
    A = style.get("audio", {})
    al = []
    for s in segs:
        c = plan["clips"][s["i"]]
        inf = info[c["src"]]
        vol = c.get("vol", A.get("clip", 0.0))
        if vol <= 0 or not inf.get("has_audio") or inf.get("image"):
            continue
        sp = c.get("speed", 1.0)
        k = c["_input"]
        tempo = ""
        if abs(sp - 1) > 0.01:
            t_ = sp; parts = []
            while t_ > 2.0: parts.append("atempo=2.0"); t_ /= 2
            while t_ < 0.5: parts.append("atempo=0.5"); t_ /= 0.5
            parts.append(f"atempo={t_:.4f}"); tempo = ",".join(parts) + ","
        d = s["dur"] + (s["td"] if s["tr"] != "cut" else 0)
        ms = int(s["start"] * 1000)
        fc.append(f"[{k}:a:0]asetpts=PTS-STARTPTS,{tempo}atrim=duration={d:.3f},aresample=48000,aformat=channel_layouts=stereo,"
                  f"volume={vol},afade=t=in:d=0.06,afade=t=out:st={max(0, d - 0.12):.3f}:d=0.12,adelay={ms}|{ms}[ca{s['i']}]")
        al.append(f"ca{s['i']}")
    vo_l = []
    for j, v in enumerate(plan.get("vo") or []):
        cmd += ["-i", v["file"]]
        k = n; n += 1
        ms = int(v["_at"] * 1000)
        fc.append(f"[{k}:a:0]aresample=48000,aformat=channel_layouts=stereo,volume={A.get('vo', 1.0) * v.get('vol', 1.0)},adelay={ms}|{ms}[vo{j}]")
        vo_l.append(f"vo{j}")
    mus = plan.get("music")
    if mus and mus.get("file"):
        cmd += ["-ss", str(mus.get("offset", 0)), "-t", f"{total + 0.5:.3f}", "-i", mus["file"]]
        k = n; n += 1
        mv = mus.get("volume", A.get("music", 0.8))
        mf = mus.get("fade", A.get("music_fade", 1.5))
        fc.append(f"[{k}:a:0]aresample=48000,aformat=channel_layouts=stereo,volume={mv},afade=t=in:d=0.3,"
                  f"afade=t=out:st={max(0, total - mf):.3f}:d={mf}[mu0]")
        if vo_l and A.get("duck", True):
            fc.append("".join(f"[{x}]" for x in vo_l) + f"amix=inputs={len(vo_l)}:normalize=0,asplit=2[vob][vok]")
            fc.append(f"[mu0][vok]sidechaincompress=threshold=0.03:ratio={A.get('duck_ratio', 6)}:attack=20:release=400[mud]")
            al += ["mud", "vob"]
        else:
            al.append("mu0"); al += vo_l
    else:
        al += vo_l
    if not al:
        fc.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={total:.3f}[aout]")
    else:
        fc.append("".join(f"[{x}]" for x in al) + f"amix=inputs={len(al)}:normalize=0:duration=longest,atrim=duration={total:.3f},"
                  f"loudnorm=I={A.get('lufs', -14)}:TP=-1.5:LRA=11,aresample=48000[aout]")
    script = Path(work) / "filter.txt"
    script.write_text(";\n".join(fc))
    cmd += ["-/filter_complex", str(script), "-map", "[vout]", "-map", "[aout]", "-r", str(FPS)]
    if preview:
        cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p"]
    elif hdr:
        br = {True: "60M", False: "24M"}[min(W, H) >= 2000]
        if FPS <= 30 and min(W, H) >= 2000:
            br = "40M"
        cmd += ["-c:v", "hevc_videotoolbox", "-profile:v", "main10", "-b:v", br, "-tag:v", "hvc1",
                "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc", "-color_range", "tv"]
    elif min(W, H) >= 2000:
        cmd += ["-c:v", "hevc_videotoolbox", "-b:v", "45M", "-tag:v", "hvc1", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
    else:
        cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
    cmd += ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(out_mp4)]
    (Path(work) / "ffmpeg_cmd.json").write_text(json.dumps(cmd, ensure_ascii=False, indent=0))
    r = subprocess.run(cmd)
    if r.returncode:
        raise SystemExit(f"ffmpeg 出片失败（命令和滤镜图在 {work}）")


# ---------------------------------------------------------------- 剪映草稿
def build_draft(plan, style, info, segs, total, ovs, W, H, FPS, out_dir, name):
    sys.path.insert(0, str(HERE / "vendor"))
    import pyJianYingDraft as d
    out = Path(out_dir)
    if out.exists():
        raise SystemExit(f"草稿目录已存在，请换个名字：{out}")
    out.mkdir(parents=True)
    res = out / "Resources"; res.mkdir()
    staged = {}

    def stage(p):
        p = Path(p)
        if str(p) in staged:
            return staged[str(p)]
        h = hashlib.sha256(str(p).encode() + str(p.stat().st_size).encode()).hexdigest()[:16]
        dst = res / (h + p.suffix.lower())
        try:
            os.link(p, dst)   # 同盘硬链接，不占双倍空间
        except OSError:
            shutil.copy2(p, dst)
        staged[str(p)] = dst
        return dst

    script = d.ScriptFile(W, H, FPS, False)
    script.append_tracks([d.TrackSpec(d.TrackType.video, "主轨"), d.TrackSpec(d.TrackType.video, "包装"),
                          d.TrackSpec(d.TrackType.text, "字幕"), d.TrackSpec(d.TrackType.audio, "旁白"),
                          d.TrackSpec(d.TrackType.audio, "配乐")])
    us = lambda x: int(round(x * 1e6))
    lanes = {"字幕": [], "包装": []}

    def lane(base, a, b):
        """同一时间有多层文字/图层时自动分到「字幕2」「包装2」……轨，避免片段重叠。"""
        k = 1
        while True:
            nm = base if k == 1 else f"{base}{k}"
            if nm not in lanes:
                script.append_tracks([d.TrackSpec(d.TrackType.text if base == "字幕" else d.TrackType.video, nm)])
                lanes[nm] = []
            if all(b <= x0 + 1e-6 or a >= x1 - 1e-6 for x0, x1 in lanes[nm]):
                lanes[nm].append((a, b))
                return nm
            k += 1
    rng = lambda a, b: d.Timerange(us(a), us(b - a))
    A = style.get("audio", {})
    J = style.get("jianying", {})
    TR = {"fade": "叠化", "dissolve": "叠化", "white": "闪白", "black": "闪黑", "zoom": "推近", "slide": "向左",
          "slideup": "向上", "wipe": "向右擦除", "blur": "横向模糊", "circle": "圆形遮罩"}
    filt = J.get("filter")
    prev = None
    for s in segs:
        c = plan["clips"][s["i"]]
        inf = info[c["src"]]
        sw, sh = inf.get("width", W), inf.get("height", H)
        fit = min(W / sw, H / sh); cover = max(W / sw, H / sh)
        sc = cover / fit if (c.get("fit") or style.get("fit", "cover")) == "cover" else 1.0
        if c.get("move") in ("push",):
            sc *= 1.0
        if c.get("inset") or style.get("inset_all"):
            sc *= style.get("inset", {}).get("scale", 0.74) * (cover / fit) if (sw / sh) > (W / H) * 0.9 else style.get("inset", {}).get("scale", 0.74)
        cs = d.ClipSettings(scale_x=sc, scale_y=sc)
        sp = c.get("speed", 1.0)
        vol = c.get("vol", A.get("clip", 0.0))
        if inf.get("image"):
            seg = d.VideoSegment(str(stage(c["src"])), rng(s["start"], s["start"] + s["dur"]), clip_settings=cs)
        else:
            seg = d.VideoSegment(str(stage(c["src"])), rng(s["start"], s["start"] + s["dur"]),
                                 source_timerange=d.Timerange(us(c["in"]), us(s["dur"] * sp)), volume=vol, clip_settings=cs)
        if c.get("move") == "push":
            seg.add_keyframe(d.KeyframeProperty.uniform_scale, 0, sc)
            seg.add_keyframe(d.KeyframeProperty.uniform_scale, us(s["dur"]) - 1, sc * (1 + style.get("move_amount", 0.06)))
        if filt:
            try:
                seg.add_filter(getattr(d.FilterType, filt[0]), filt[1])
            except Exception as e:
                print("  剪映滤镜跳过：", filt, e)
        if s["tr"] != "cut":
            try:
                seg.add_transition(getattr(d.TransitionType, TR.get(s["tr"], "叠化")), duration=us(s["td"]))
            except Exception as e:
                print("  转场跳过：", e)
        script.add_segment(seg, "主轨")
        prev = seg
    # 包装图层（标题卡、标签、角标）：透明 PNG 图片片段；字幕类用原生文字（可直接改字）
    NT = J.get("text", {})
    font_t = getattr(d.FontType, NT.get("font", "SourceHanSansCN_Medium"), d.FontType.SourceHanSansCN_Medium)
    for o in ovs:
        if o["b"] - o["a"] < 0.05:
            continue
        nt = NT.get("templates", {}).get(o["tpl"]) if o.get("native") is not False else None
        if nt:
            text = nt.get("text", "{text}")
            ok = True
            for k, v in o["vals"].items():
                text = text.replace("{" + k + "}", str(v))
            if "{" in text:
                import re
                text = re.sub(r"\{[a-z_]+\}\n?", "", text)
            col = hex2rgb(nt.get("color", "#ffffff"))
            ts = d.TextStyle(size=nt.get("size", 6), bold=nt.get("bold", False),
                             color=(col[0] / 255, col[1] / 255, col[2] / 255), align=1, auto_wrapping=True, max_line_width=nt.get("maxw", 0.82),
                             line_spacing=nt.get("line_spacing", 0), letter_spacing=nt.get("letter_spacing", 0))
            kw = {}
            if nt.get("bg"):
                kw["background"] = d.TextBackground(color=nt["bg"], alpha=nt.get("bg_alpha", 0.85), round_radius=nt.get("bg_round", 0.0))
            if nt.get("shadow"):
                try:
                    kw["shadow"] = d.TextShadow(alpha=nt["shadow"], color=(0, 0, 0), diffuse=15, distance=3)
                except Exception:
                    pass
            if nt.get("border"):
                kw["border"] = d.TextBorder(color=(0, 0, 0), width=nt["border"], alpha=0.9)
            fspec = getattr(d.FontType, nt.get("font", ""), font_t) if nt.get("font") else font_t
            seg = d.TextSegment(text, rng(o["a"], o["b"]), font=fspec, style=ts,
                                clip_settings=d.ClipSettings(transform_x=(nt.get("x", 0.5) - 0.5) * 2, transform_y=(0.5 - nt.get("y", 0.5)) * 2), **kw)
            if nt.get("intro"):
                try:
                    seg.add_animation(getattr(d.TextIntro, nt["intro"]), duration=us(min(0.5, (o["b"] - o["a"]) / 3)))
                except Exception:
                    pass
            script.add_segment(seg, lane("字幕", o["a"], o["b"]))
        else:
            png = o["png"]
            # 图片放到画布对应位置：剪映按画布等比放入，scale 1 = 宽或高贴边
            pw, ph = o["w"], o["h"]
            fit = min(W / pw, H / ph)
            sc = 1 / fit
            cx, cy = o["x"] + pw / 2, o["y"] + ph / 2
            seg = d.VideoSegment(str(stage(png)), rng(o["a"], o["b"]),
                                 clip_settings=d.ClipSettings(scale_x=sc, scale_y=sc, transform_x=(cx - W / 2) / (W / 2), transform_y=(H / 2 - cy) / (H / 2)))
            script.add_segment(seg, lane("包装", o["a"], o["b"]))
    for v in plan.get("vo") or []:
        st = stage(v["file"])
        script.add_segment(d.AudioSegment(str(st), rng(v["_at"], min(total, v["_at"] + v["_dur"] - 0.005)), volume=A.get("vo", 1.0)), "旁白")
    mus = plan.get("music")
    if mus and mus.get("file"):
        mlen = min(total, wav_dur(mus["file"]) - mus.get("offset", 0) - 0.01)
        ms = d.AudioSegment(str(stage(mus["file"])), rng(0, mlen), source_timerange=d.Timerange(us(mus.get("offset", 0)), us(mlen)),
                            volume=mus.get("volume", A.get("music", 0.8)) * (A.get("draft_music_scale", 1.0) if plan.get("vo") else 1.0))
        ms.add_fade(us(0.3), us(mus.get("fade", 1.5)))
        script.add_segment(ms, "配乐")
    data = json.loads(script.dumps())
    did = str(uuid.uuid4()).upper()
    data["id"], data["name"] = did, name
    for nm in ("draft_content.json", "draft_info.json"):
        (out / nm).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    meta = json.loads((HERE / "vendor/pyJianYingDraft/assets/draft_meta_info.json").read_text(encoding="utf-8"))
    now = int(time.time() * 1e6)
    meta.update(draft_id=did, draft_name=name, draft_fold_path=str(out), draft_root_path=str(out.parent),
                draft_json_file=str(out / "draft_content.json"), tm_duration=us(total), tm_draft_create=now, tm_draft_modified=now,
                draft_cover=str(out / "draft_cover.jpg"))
    (out / "draft_meta_info.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    first = plan["clips"][0]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(first["in"] + 0.2) if not info[first["src"]].get("image") else "0", "-i", first["src"],
                    "-frames:v", "1", "-vf", "scale=480:-2", str(out / "draft_cover.jpg")])
    rep = {"draft_id": did, "name": name, "duration_s": round(total, 3), "canvas": [W, H, FPS],
           "tracks": {"主轨": len(segs), "包装": sum(1 for o in ovs if not (NT.get("templates", {}).get(o["tpl"]) and o.get("native") is not False)),
                      "字幕": sum(1 for o in ovs if NT.get("templates", {}).get(o["tpl"]) and o.get("native") is not False),
                      "旁白": len(plan.get("vo") or []), "配乐": 1 if mus else 0},
           "gui_verified": False,
           "notes": ["草稿文件已生成，没有在剪映里打开核对；剪映滤镜、转场、字体可能需要联网下载或会员。",
                     "成片里的颗粒、暗角、遮幅、白边相框在草稿里没有对应效果，需要时在剪映里手动加。"]}
    (out / "build-report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    return rep


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("--style")
    ap.add_argument("--out")
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--name")
    a = ap.parse_args()
    if not (a.export or a.draft or a.preview):
        a.export = True
    plan_path = Path(a.plan).resolve()
    plan, style = load(plan_path, a.style)
    resolve_paths(plan, plan_path.parent)
    outdir = Path(a.out).resolve() if a.out else plan_path.parent / "输出"
    outdir.mkdir(parents=True, exist_ok=True)
    name = a.name or plan.get("name", plan_path.stem)
    work = outdir / f"{name}_工作"; work.mkdir(exist_ok=True)
    info = {}
    for c in plan["clips"]:
        if c["src"] not in info:
            if not Path(c["src"]).exists():
                raise SystemExit(f"素材不存在：{c['src']}")
            info[c["src"]] = probe(c["src"])
        if info[c["src"]].get("image"):
            c.setdefault("in", 0); c.setdefault("out", c.get("dur", 2.0))
        c["in"] = float(c.get("in", 0)); c["out"] = float(c.get("out", info[c["src"]]["duration"]))
        if c["out"] > info[c["src"]]["duration"] + 0.05 and not info[c["src"]].get("image"):
            raise SystemExit(f"出点超出素材长度：{Path(c['src']).name} {c['out']} > {info[c['src']]['duration']:.2f}")
    # 自动节奏：按风格节奏型挑剪点、拆跳切（剪辑单里的 in/out 当作可用区间；"lock": true 的段落不动）
    sys.path.insert(0, str(HERE))
    import pacing
    plan["clips"] = pacing.apply(plan, style, info, work)
    # 配乐：剪辑单没给就按风格合成一首原创配乐（无版权风险，但质量一般，正式发布建议换成自己的音乐）
    if not plan.get("music") and style.get("music_preset") and not plan.get("no_music"):
        est = sum((c["out"] - c["in"]) / c.get("speed", 1) for c in plan["clips"])
        mf = work / f"bgm_{style['music_preset']}.wav"
        if not mf.exists():
            subprocess.run([sys.executable, str(HERE / "make_music.py"), style["music_preset"], f"{est * 1.3 + 8:.1f}", str(mf)], check=True)
        bj = Path(str(mf) + ".beats.json")
        off = json.loads(bj.read_text()).get("drums_in", 0) if bj.exists() and (style.get("pace") or {}).get("snap") else 0
        plan["music"] = {"file": str(mf), "offset": round(off, 3)}   # 卡点风格从鼓点进来的地方起
    tts_fill(plan, work, style)
    # 以旁白为轴：一句旁白可以跨好几段画面；只有它会撞上下一句旁白（或片尾）时，才把它覆盖的最后一段画面往后放
    for v in plan.get("vo") or []:
        v["_dur"] = wav_dur(v["file"])
    vos = sorted([v for v in plan.get("vo") or [] if "clip" in v], key=lambda v: (v["clip"], v.get("offset", 0.15)))
    dur_of = lambda c: (c["out"] - c["in"]) / c.get("speed", 1.0)
    for j, v in enumerate(vos):
        k0 = v["clip"]
        k1 = vos[j + 1]["clip"] if j + 1 < len(vos) else len(plan["clips"])
        nxt_off = vos[j + 1].get("offset", 0.15) if j + 1 < len(vos) and vos[j + 1]["clip"] == k0 else None
        need = v.get("offset", 0.15) + v["_dur"] + plan.get("vo_gap", 0.25)
        if nxt_off is not None:
            continue   # 同一段上挂了两句，由剪辑单自己排 offset
        span = list(range(k0, max(k0 + 1, k1)))
        have = sum(dur_of(plan["clips"][i]) for i in span)
        last = plan["clips"][span[-1]]
        last["_min"] = max(last.get("_min", 0), dur_of(last) + max(0, need - have))
        if need > have + 1e-3 and plan.get("fit_vo", True):
            lim = info[last["src"]]["duration"] if not info[last["src"]].get("image") else 1e9
            sp = last.get("speed", 1.0)
            last["out"] = round(min(lim, last["out"] + (need - have) * sp), 3)
            if have + (last["out"] - last["in"]) / sp - dur_of(last) < need - 0.05 and dur_of(last) * sp >= lim - last["in"] - 1e-3:
                print(f"⚠ 第 {span[-1]} 段素材不够长，旁白「{v['text'][:10]}…」会压到下一句")
    snap = (style.get("pace") or {}).get("snap")
    if snap and plan.get("music", {}).get("file") and plan.get("snap", True):
        est = sum((c["out"] - c["in"]) / c.get("speed", 1) for c in plan["clips"])
        bts = beats_of(plan["music"]["file"], est + 4)
        off = plan["music"].get("offset", 0)
        bts = [b - off for b in bts if b >= off]
        snap_clips(plan["clips"], bts, snap, info)
    pacing.caption_hold(plan, style)
    segs, total = build_timeline(plan, style, info)
    for v in plan.get("vo") or []:
        v["_at"] = v.get("at", 0) if "clip" not in v else segs[v["clip"]]["start"] + v.get("offset", 0.15)
        if v["_at"] + v["_dur"] > total + 0.01:
            print(f"⚠ 旁白「{v['text'][:12]}…」超出成片结尾 {v['_at'] + v['_dur'] - total:.2f}s，请加长画面或挪前")
    W, H, FPS, hdr = spec_of(plan, style, info, a.preview)
    print(f"成片规格 {W}x{H} {FPS}fps {'HLG HDR 10bit' if hdr else 'SDR'}，时长 {total:.2f}s，{len(segs)} 段")
    lay = Layerer(W, H, hdr, work / ("png_prev" if a.preview else "png"))
    ovs = collect_overlays(plan, style, segs, total, lay, W, H)
    result = {"name": name, "duration": round(total, 3), "spec": [W, H, FPS, "HLG" if hdr else "SDR"],
              "cuts": [round(s["start"], 3) for s in segs], "overlays": [{k: o[k] for k in ("tpl", "a", "b")} for o in ovs]}
    if a.export or a.preview:
        mp4 = outdir / (f"{name}_预览.mp4" if a.preview else f"{name}.mp4")
        build_export(plan, style, info, segs, total, ovs, W, H, FPS, hdr, mp4, work, a.preview)
        result["mp4"] = str(mp4)
        print("成片：", mp4)
    if a.draft:
        DW, DH, DF, _ = spec_of(plan, style, info, False)
        lay2 = Layerer(DW, DH, False, work / "png_draft")
        ovs2 = collect_overlays(plan, style, segs, total, lay2, DW, DH)
        dd = outdir / f"{name}_剪映草稿"
        rep = build_draft(plan, style, info, segs, total, ovs2, DW, DH, DF, dd, name)
        result["draft"] = str(dd)
        print("剪映草稿：", dd, json.dumps(rep["tracks"], ensure_ascii=False))
    (outdir / f"{name}_结果.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
