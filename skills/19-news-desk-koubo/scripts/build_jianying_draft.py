#!/usr/bin/env python3
"""口播风格引擎（家族核心）· 动效层 + 真人口播 → 可编辑的剪映草稿（画幅与人物框由 style.json 决定，不覆盖已有目录）。

轨道（从下到上）：
  视频「动效」  每个镜头一段（engine/render.mjs 渲染的动效层：含人物框装饰，不含人物和字幕），可单独拖动、裁剪、删除
  视频「人物」  按镜头样式（大卡/右上圆框）切好形状的透明人物视频，放进动效层的人物框里，剪点可改
  音频「口播」  与人物同源同起止的人声（人物视频本身静音，声画同步）
  文本「字幕」  每句一个原生文字片段；按镜头 theme 换字色与描边（light 黑字无描边 / dark 白字 2px 黑描边）
  音频「配乐」  可选

用法：
  python3 build_jianying_draft.py draft.json <新的草稿目录>
需要 pymediainfo（剪映草稿库依赖）；草稿库为随包固定版 pyJianYingDraft 0.3.0（Apache-2.0）。
"""
import copy, hashlib, json, math, shutil, subprocess, sys, time, uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "vendor"))

# 人物框几何：与 engine/stage/runtime.js 的 frameGeo 完全同源（都按 style.json 的比例算像素）
STYLE = json.loads((HERE / ".." / "style.json").read_text(encoding="utf-8"))
CW, CH = STYLE["canvas"]
MIN = min(CW, CH)


def _R(f, base):
    return f * base


def _frame(mode):
    fr = (STYLE.get("person") or {}).get("frame") or {}
    if mode == "split":   # 人物分屏：与 runtime.js#frameGeo('split') 同源
        f = fr.get("split", {})
        w = _R(f.get("w", 0.86), MIN); h = _R(f.get("h", 0.7), MIN)
        cx = _R(f.get("cx", 0.5), CW); cy = _R(f.get("cy", 0.27), CH); r = _R(f.get("r", 0.014), w)
        return {"shape": "rect", "cx": round(cx, 2), "cy": round(cy, 2), "w": round(w / 2) * 2, "h": round(h / 2) * 2, "radius": round(r)}
    f = fr.get("card" if mode == "card" else "small", {})
    w = _R(f.get("w", 0.30 if mode == "card" else 0.19), MIN)
    h = _R(f.get("h", 0.52 if mode == "card" else 0.19), MIN)
    cx = _R(f.get("cx", 0.815 if mode == "card" else 0.85), CW)
    cy = _R(f.get("cy", 0.40 if mode == "card" else 0.20), CH)
    r = _R(f.get("r", 0.018 if mode == "card" else 0.5), w)
    return {"shape": "rect" if mode == "card" else "circle", "cx": round(cx, 2), "cy": round(cy, 2),
            "w": round(w / 2) * 2, "h": round(h / 2) * 2, "radius": round(r)}


FRAMES = {m: _frame(m) for m in ((STYLE.get("person") or {}).get("modes") or ["card", "small"]) if m in ("card", "small", "split")}
INSET = 0          # 动效层里人物框只画描边和底色，人物视频正好填满
SETTLE = 0.0       # 人物框切换只有淡入淡出，人物从镜头开头就放上去


def need(ok, msg):
    if not ok:
        raise SystemExit(msg)


def probe(path):
    return json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
                                     check=True, capture_output=True, text=True).stdout)


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    spec_path, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    need(not out.exists(), f"草稿目录已存在，请换一个新名字：{out}")
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    base = spec_path.parent
    absp = lambda p: (base / p).resolve()

    import pyJianYingDraft as d

    W, H, FPS = spec.get("width", CW), spec.get("height", CH), spec.get("fps", STYLE.get("fps", 30))
    gtl = json.loads(absp(spec["graphics"]["timeline"]).read_text(encoding="utf-8"))
    graphics = absp(spec["graphics"]["path"])
    gprobe = probe(graphics)
    gdur = float(gprobe["format"]["duration"])
    duration = gtl["duration"]
    need(abs(gdur - duration) < 0.1, f"动效层时长 {gdur:.2f}s 与参数时长 {duration}s 不一致")

    # 口播保留区间 → 成片时间线（首尾相接）
    keeps, t = [], 0.0
    for k in spec["keeps"]:
        src = absp(k["path"])
        a, b = float(k["source_start_s"]), float(k["source_end_s"])
        need(b > a, f"保留区间不合法：{k}")
        keeps.append({"path": src, "src": a, "start": t, "end": t + (b - a), "reason": k.get("reason", "")})
        t += b - a
    need(abs(t - duration) < 0.05, f"保留区间总长 {t:.3f}s 与动效层时长 {duration}s 不一致（字幕和镜头都按成片时间排）")

    cue_doc = json.loads(absp(spec["captions"]).read_text(encoding="utf-8"))
    need(cue_doc.get("reviewed") or spec.get("allowUnreviewed"), "字幕未人工核对（reviewed=false），不能生成交付草稿")
    cues = cue_doc["cues"]
    for i, c in enumerate(cues):
        need(0 <= c["s"] < c["e"] <= duration + 1e-3, f"第 {i} 句字幕超出成片时长")
        need(i == 0 or c["s"] >= cues[i - 1]["e"] - 1e-3, f"第 {i} 句字幕与上一句重叠")

    out.mkdir(parents=True)
    res = out / "Resources"
    res.mkdir()
    staged = {}

    def stage(path):
        if str(path) in staged:
            return staged[str(path)]
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for blk in iter(lambda: f.read(1 << 20), b""):
                h.update(blk)
        dst = res / (h.hexdigest()[:20] + path.suffix.lower())
        shutil.copy2(path, dst)
        staged[str(path)] = dst
        return dst

    def wav_of(path, tag):
        dst = res / (stage(path).stem + f"-{tag}.wav")
        if not dst.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(stage(path)), "-map", "0:a:0", "-vn",
                            "-ar", "48000", "-c:a", "pcm_s16le", str(dst)], check=True)
        return dst

    script = d.ScriptFile(W, H, FPS, False)
    script.append_tracks([d.TrackSpec(d.TrackType.video, "动效"), d.TrackSpec(d.TrackType.video, "人物"),
                          d.TrackSpec(d.TrackType.audio, "口播"), d.TrackSpec(d.TrackType.audio, "音效"),
                          d.TrackSpec(d.TrackType.text, "字幕")])
    rng = lambda a, b: d.trange_seconds(a, duration=b - a)
    src_rng = lambda s, a, b: d.trange_seconds(s, duration=b - a)

    # 1. 动效层：按镜头切段；动作音效同样按镜头切段
    g_wav = wav_of(graphics, "sfx") if any(s["codec_type"] == "audio" for s in gprobe["streams"]) else None
    for seg in gtl["shots"]:
        a, b = seg["t0"], min(seg["t1"], duration)
        script.add_segment(d.VideoSegment(str(stage(graphics)), rng(a, b), source_timerange=src_rng(a, a, b), volume=0), "动效")
        if g_wav:
            script.add_segment(d.AudioSegment(str(g_wav), rng(a, b), source_timerange=src_rng(a, a, b),
                                              volume=spec["graphics"].get("sfxVolume", 1.0)), "音效")

    # 2. 人物：按镜头的人物样式（card 大卡 / small 右上圆框 / hide），用预先切好形状的透明视频
    #    精确盖在模板人物框上；不依赖剪映的蒙版功能。口播人声与人物同源同起止
    pres = spec.get("presenter", {})
    face_cy = pres.get("faceCy", 0.42)  # 人脸中心在人物画面中的相对高度（0 顶 1 底）
    # 按具体人物适配（scripts/person_fit.py 产出）：每种人物框的裁切矩形，以及必要时加高的人物框
    FIT = json.loads(absp(pres["fit"]).read_text(encoding="utf-8")).get("modes", {}) if pres.get("fit") else {}
    for m_, v_ in FIT.items():
        if v_.get("frame") and m_ in FRAMES:
            STYLE["person"]["frame"][m_] = v_["frame"]
            FRAMES[m_] = _frame(m_)
    default_mode = pres.get("default", (STYLE.get("person") or {}).get("default", "small"))
    shapes = {}

    def shaped(path, mode):
        """把整条人物视频切成模板框的形状（ProRes 4444 带透明），每种形状每个素材只做一次。"""
        key = (str(path), mode)
        if key in shapes:
            return shapes[key]
        f = FRAMES[mode]
        w, h = f["w"] - INSET, f["h"] - INSET
        vs = next(x for x in probe(path)["streams"] if x["codec_type"] == "video")
        sw, sh = vs["width"], vs["height"]
        fit = FIT.get(mode)
        if fit:   # 按人物裁切：fit 矩形宽高比 = 人物框宽高比，直接裁出再缩放
            fx, fy, fw_, fh_ = (int(fit[k]) // 2 * 2 for k in ("x", "y", "w", "h"))
            crop = f"crop={fw_}:{fh_}:{fx}:{fy},scale={w}:{h}"
        if f["shape"] == "circle":
            side = int(min(sw, sh) * 0.62) // 2 * 2
            cy = min(max(face_cy * sh, side / 2), sh - side / 2)
            crop = f"crop={side}:{side}:{(sw - side) // 2}:{int(cy - side / 2)},scale={w}:{h}"
            m = 4 * w
            lum = f"255*lte(pow(X-{m}/2,2)+pow(Y-{m}/2,2),pow({m}/2-2,2))"
            mask_size = f"{m}x{m}"
            if fit:
                crop = f"crop={fw_}:{fh_}:{fx}:{fy},scale={w}:{h}"
        else:
            scale = max(w / sw, h / sh)
            sw2, sh2 = int(sw * scale + 1) // 2 * 2, int(sh * scale + 1) // 2 * 2
            y0 = int(min(max(face_cy * sh2 - h / 2, 0), sh2 - h))
            crop = f"scale={sw2}:{sh2},crop={w}:{h}:{(sw2 - w) // 2}:{y0}"
            r = 4 * (f["radius"] - INSET // 2)
            lum = (f"255*lte(pow(max(max({r}-X,X-(W-1-{r})),0),2)+pow(max(max({r}-Y,Y-(H-1-{r})),0),2),{r * r})")
            mask_size = f"{4 * w}x{4 * h}"
            if fit:
                crop = f"crop={fw_}:{fh_}:{fx}:{fy},scale={w}:{h}"
        mask = res / f"mask-{mode}.png"
        if not mask.exists():  # 4 倍超采样再缩小，边缘抗锯齿
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=black:s={mask_size}", "-frames:v", "1",
                            "-vf", f"format=gray,geq=lum='{lum}',scale={w}:{h}:flags=area", str(mask)], check=True)
        out_mov = res / (stage(path).stem + f"-{mode}.mov")
        # 遮罩图循环输入没有终点，-shortest 在 alphamerge 下不生效：必须用 -t 限定为素材画面时长，否则会无限写盘
        vdur = float(vs.get("duration") or probe(path)["format"]["duration"])
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(stage(path)), "-loop", "1", "-t", f"{vdur:.3f}", "-i", str(mask),
                        "-filter_complex", f"[0:v]{crop},format=yuva444p10le[v];[1:v]format=gray[m];[v][m]alphamerge=shortest=1,format=yuva444p10le",
                        "-an", "-t", f"{vdur:.3f}", "-r", str(FPS), "-c:v", "prores_ks", "-profile:v", "4", "-qscale:v", "11",
                        "-pix_fmt", "yuva444p10le", str(out_mov)],
                       check=True, timeout=max(120, vdur * 20))
        need(out_mov.stat().st_size < 6 * 1024 * 1024 * max(10, vdur), f"人物形状视频异常偏大，已停止：{out_mov}")
        shapes[key] = out_mov
        return out_mov

    def to_source(t0, t1):
        """成片区间 → 各保留段的 (路径, 源起点, 成片起, 成片止)。"""
        for k in keeps:
            a, b = max(t0, k["start"]), min(t1, k["end"])
            if b - a > 1 / FPS:
                yield k["path"], k["src"] + (a - k["start"]), a, b

    overlays = []
    for seg in gtl["shots"]:
        mode = seg.get("presenter", default_mode)
        if mode in ("hide", "none") or mode not in FRAMES:
            continue
        a, b = min(seg["t0"] + SETTLE, seg["t1"]), min(seg["t1"], duration)
        for path, src, x0, x1 in to_source(a, b):
            f = FRAMES[mode]
            mov = shaped(path, mode)
            # 剪映把素材等比放进画布（竖长素材按高度铺满），scale=实际像素高/画布高；位移以半个画布为单位，向上为正
            sc = (f["h"] - INSET) / H if (f["w"] / f["h"]) <= W / H else (f["w"] - INSET) / W
            clip = d.ClipSettings(scale_x=sc, scale_y=sc, transform_x=(f["cx"] - W / 2) / (W / 2),
                                  transform_y=(H / 2 - f["cy"]) / (H / 2))
            script.add_segment(d.VideoSegment(str(mov), rng(x0, x1), source_timerange=src_rng(src, x0, x1),
                                              volume=0, clip_settings=clip), "人物")
            overlays.append({"mode": mode, "start": round(x0, 3), "end": round(x1, 3), "source_start": round(src, 3)})

    for k in keeps:
        if any(s["codec_type"] == "audio" for s in probe(k["path"])["streams"]):
            vw = wav_of(k["path"], "voice")
            # 音轨常比画面短几十毫秒：按实际音频长度截止，不拉伸、不补静音
            end = min(k["end"], k["start"] + float(probe(vw)["format"]["duration"]) - k["src"] - 1e-3)
            script.add_segment(d.AudioSegment(str(vw), rng(k["start"], end),
                                              source_timerange=src_rng(k["src"], k["start"], end), volume=1.0), "口播")

    # 3. 原生字幕：按镜头 theme 切字色与描边
    #    light 底：近黑字 #0a0a0b，无描边；dark 底：近白字 #f4f4f2，2px 黑描边
    cs = dict(STYLE.get("caption") or {})
    cs.update(spec.get("captionStyle") or {})
    hex2t = lambda h, dft: tuple(round(int(h.lstrip("#")[i:i + 2], 16) / 255, 3) for i in (0, 2, 4)) if h else dft
    font = getattr(d.FontType, cs.get("font", "SourceHanSansCN_Bold"))
    ink = hex2t(cs.get("ink"), (0.039, 0.039, 0.043))
    paper = hex2t(cs.get("paper"), (0.957, 0.957, 0.949))
    ACCENT = {"light": hex2t(cs.get("accent"), (0.075, 0.322, 0.898)),
              "dark": hex2t(cs.get("accentDark"), (0.282, 0.471, 0.941))}

    DFLT = (STYLE.get("theme") or {}).get("default", "light")

    def theme_at(t):
        th = DFLT
        for sh in gtl["shots"]:
            if t >= sh["t0"]:
                th = sh.get("theme", DFLT)
        return th

    highlights, hl_theme = {}, {}
    for c in cues:
        th = "dark" if theme_at((c["s"] + c["e"]) / 2) == "dark" else "light"
        th = th if th in ACCENT else "light"
        seg = d.TextSegment(c["text"], rng(c["s"], c["e"]), font=font,
                            style=d.TextStyle(size=cs.get("size", 9), bold=True, color=paper if th == "dark" else ink, align=1,
                                              auto_wrapping=True,
                                              # 横屏人物在侧边时字幕移到空白区：行宽收到该区宽度（与 runtime 同源）
                                              max_line_width=cs.get("maxLineWidth", 0.73 if cs.get("x", .5) == .5 else
                                                                    round(2 * min(cs.get("x", .5) - 0.06, 0.94 - cs.get("x", .5)), 3))),
                            clip_settings=d.ClipSettings(transform_x=(cs.get("x", .5) - .5) * 2, transform_y=cs.get("y", -0.79)),
                            border=d.TextBorder(color=(0, 0, 0), width=cs.get("borderWidth", 20), alpha=0.9) if th == "dark" else None)
        if c.get("highlight"):
            highlights[seg.material_id] = c["highlight"]
            hl_theme[seg.material_id] = th
        script.add_segment(seg, "字幕")

    # 4. 配乐（可选）
    if spec.get("music"):
        m = spec["music"]
        script.append_tracks([d.TrackSpec(d.TrackType.audio, "配乐")])
        mp = absp(m["path"])
        ms = wav_of(mp, "music") if any(s["codec_type"] == "video" for s in probe(mp)["streams"]) else stage(mp)
        mseg = d.AudioSegment(str(ms), rng(0, duration), source_timerange=src_rng(m.get("source_start_s", 0), 0, duration),
                              volume=m.get("volume", 0.12))
        mseg.add_fade(round(m.get("fade_s", 1.0) * 1e6), round(m.get("fade_s", 1.0) * 1e6))
        script.add_segment(mseg, "配乐")

    data = json.loads(script.dumps())
    draft_id = str(uuid.uuid4()).upper()
    data["id"], data["name"] = draft_id, spec["name"]
    for mat in data["materials"]["texts"]:  # 关键词着色
        words = highlights.get(mat["id"])
        if not words:
            continue
        accent = ACCENT[hl_theme.get(mat["id"], "light")]
        content = json.loads(mat["content"])
        text, base_style = content["text"], content["styles"][0]
        marked = set()
        for w in words:
            need(w in text, f"高亮词「{w}」不在字幕「{text}」里")
            p = 0
            while (k := text.find(w, p)) >= 0:
                marked.update(range(k, k + len(w)))
                p = k + len(w)
        runs, st = [], 0
        u16 = lambda s: len(s.encode("utf-16-le")) // 2
        for k in range(1, len(text) + 1):
            if k == len(text) or ((k in marked) != (st in marked)):
                r = copy.deepcopy(base_style)
                r["range"] = [u16(text[:st]), u16(text[:k])]
                if st in marked:
                    r["fill"]["content"]["solid"]["color"] = list(accent)
                runs.append(r)
                st = k
        content["styles"] = runs
        mat["content"] = json.dumps(content, ensure_ascii=False)

    for name in ("draft_content.json", "draft_info.json"):
        (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    meta = json.loads((HERE / "vendor/pyJianYingDraft/assets/draft_meta_info.json").read_text(encoding="utf-8"))
    now = int(time.time() * 1e6)
    meta.update(draft_id=draft_id, draft_name=spec["name"], draft_fold_path=str(out), draft_root_path=str(out.parent),
                draft_json_file=str(out / "draft_content.json"), tm_duration=round(duration * 1e6),
                tm_draft_create=now, tm_draft_modified=now, draft_cover=str(out / "draft_cover.jpg"))
    (out / "draft_meta_info.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(min(1.5, duration / 2)), "-i", str(graphics), "-frames:v", "1",
                    "-vf", "scale=480:-2", str(out / "draft_cover.jpg")], check=True)
    report = {"draft_id": draft_id, "name": spec["name"], "duration_s": duration, "canvas": [W, H, FPS],
              "frames": FRAMES, "presenterFit": {k: {kk: v[kk] for kk in ("zoom", "faceRatio", "note")} for k, v in FIT.items()},
              "tracks": {"动效": len(gtl["shots"]), "人物": len(overlays), "字幕": len(cues)}, "presenterOverlays": overlays,
              "staged": {k: str(v) for k, v in staged.items()}, "gui_verified": False,
              "notes": ["文件已生成，尚未在剪映中打开验证；字体等资源可能需要剪映联网下载。"]}
    (out / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
