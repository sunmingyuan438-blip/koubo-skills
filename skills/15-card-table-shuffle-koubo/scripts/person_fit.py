#!/usr/bin/env python3
"""按「具体的人物」算人物框裁切：人脸检测 → 每种人物框（圆框 / 竖卡 / 分屏）各自的裁切矩形。

用法（skill 根目录）：
  python3 scripts/person_fit.py <口播视频> [--out presenter-fit.json]
输出 presenter-fit.json：{source:{w,h}, face:{cx,cy,w,h,spread}, modes:{small|card|split:{x,y,w,h,faceRatio,note}}}
  - x/y/w/h 是源视频像素坐标里的裁切矩形，宽高比 = 该人物框的宽高比（来自 style.json#person.frame，唯一来源）
  - 镜头表 presenter.fit 与草稿 draft.json presenter.fit 都指向这个文件：预览与剪映里人物大小一致
规则（人脸高度占框高的目标比例 / 人脸中心在框内的高度）：
  圆框 0.40 / 0.47；竖卡（高宽比≥1.2）0.22 / 0.34；横卡与分屏 0.30 / 0.40
  放大上限 2.4 倍（再大画面会糊）；裁切不出画；说话时头部活动范围（10–90 分位）留在框内。
需要 macOS（Vision 人脸检测）；检测不到人脸时退回「水平居中、脸在 40% 高度」的旧规则并在 note 里写明。
"""
import json, pathlib, subprocess, sys, tempfile, statistics as stt

HERE = pathlib.Path(__file__).resolve().parent
STYLE = json.loads((HERE.parent / "style.json").read_text(encoding="utf-8"))
CW, CH = STYLE["canvas"]
MIN = min(CW, CH)
TARGET = {"circle": (0.40, 0.47), "tall": (0.22, 0.34), "wide": (0.30, 0.40)}
MAX_ZOOM = 2.4


def probe(p):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(p)],
                                  capture_output=True, text=True, check=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    rot = int((v.get("tags") or {}).get("rotate", 0) or 0)
    for sd in v.get("side_data_list") or []:
        rot = int(sd.get("rotation", rot) or rot)
    if abs(rot) % 180 == 90:
        w, h = h, w
    return w, h, float(j["format"]["duration"])


def faces(video, n=12):
    import Quartz, Vision
    from Foundation import NSURL
    w, h, dur = probe(video)
    out = []
    with tempfile.TemporaryDirectory() as td:
        for i in range(n):
            t = dur * (i + 0.5) / n
            png = pathlib.Path(td) / f"{i}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1", str(png)], check=True)
            src = Quartz.CGImageSourceCreateWithURL(NSURL.fileURLWithPath_(str(png)), None)
            img = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
            req = Vision.VNDetectFaceRectanglesRequest.alloc().init()
            Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(img, None).performRequests_error_([req], None)
            res = req.results() or []
            if not res:
                continue
            b = max(res, key=lambda r: r.boundingBox().size.width * r.boundingBox().size.height).boundingBox()
            # Vision 坐标原点在左下，转成左上原点的归一化坐标
            out.append({"cx": b.origin.x + b.size.width / 2, "cy": 1 - (b.origin.y + b.size.height / 2),
                        "w": b.size.width, "h": b.size.height})
    return w, h, out


def frame_px(mode):
    f = (STYLE.get("person") or {}).get("frame", {}).get(mode)
    if not f:
        return None
    return f["w"] * MIN, f["h"] * MIN


def crop_for(mode, sw, sh, face, spread):
    fp = frame_px(mode)
    if not fp:
        return None
    fw, fh = fp
    asp = fw / fh
    kind = "circle" if mode == "small" else ("tall" if fh / fw >= 1.2 else "wide")
    ratio, fy = TARGET[kind]
    notes = []
    if face:
        fcx, fcy, fhh = face["cx"] * sw, face["cy"] * sh, face["h"] * sh
        ch = fhh / ratio
    else:
        fcx, fcy, ch = sw / 2, 0.40 * sh, sh * (0.62 if kind == "circle" else 1.0)
        notes.append("未检测到人脸：按水平居中、脸在 40% 高度裁切")
    cw = ch * asp
    # 放大上限：裁切区域不能小于 人物框像素 / MAX_ZOOM
    if fh / ch > MAX_ZOOM:
        ch = fh / MAX_ZOOM; cw = ch * asp
        notes.append(f"人物在素材里偏小，已放大到上限 {MAX_ZOOM}×")
    # 头部活动范围留在框内（裁切至少覆盖 10–90 分位的人脸外框）
    if face and spread:
        need_w = (spread["x1"] - spread["x0"]) * sw * 1.15
        if cw < need_w:
            cw = need_w; ch = cw / asp
            notes.append("人物左右移动较大，已放宽裁切")
    # 素材比人物框「窄」（如竖拍素材进横卡）：人物框保持宽度、往下加高（顶边不动，最多 1.6 倍），
    # 让人物回到目标比例——即按具体的人物调整人物框比例，而不是把人塞满
    frame = None
    if kind != "circle" and cw > sw + 1 and ch <= sh:
        f0 = STYLE["person"]["frame"][mode]
        new_h = min(fh * 1.6, fw / (sw / ch))
        # 加高后下沿不压字幕带（人物框与字幕水平居中区重叠时）
        cap_cy = (1 - (STYLE.get("caption") or {}).get("y", -0.79)) / 2 * CH
        cx_px = f0["cx"] * CW
        if abs(cx_px - CW * (STYLE.get("caption") or {}).get("x", .5)) < CW * 0.3:
            top_ = f0["cy"] * CH - fh / 2
            if top_ < cap_cy:
                new_h = min(new_h, max(fh, cap_cy - 0.04 * CH - top_))
        if new_h > fh * 1.02:
            top = f0["cy"] * CH - fh / 2
            frame = {**f0, "h": round(new_h / MIN, 4), "cy": round((top + new_h / 2) / CH, 4)}
            fh = new_h; asp = fw / fh; cw = ch * asp
            notes.append(f"素材比人物框窄：人物框加高 {new_h / (f0['h'] * MIN):.2f} 倍以保持人物比例")
    # 不出画：裁切仍比素材大时等比缩小（人物会比目标比例大）
    if cw > sw + 1 or ch > sh + 1:
        k = min(sw / cw, sh / ch); cw *= k; ch *= k
        notes.append("素材画面不够大，人物比目标比例偏大")
    x = min(max(fcx - cw / 2, 0), sw - cw)
    y = min(max(fcy - fy * ch, 0), sh - ch)
    fr = (face["h"] * sh / ch) if face else None
    return {"x": round(x), "y": round(y), "w": round(cw), "h": round(ch), "kind": kind, "frame": frame,
            "faceRatio": round(fr, 3) if fr else None, "zoom": round(fh / ch, 2), "note": "；".join(notes)}


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    video = pathlib.Path(sys.argv[1]).resolve()
    out = pathlib.Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else video.with_name("presenter-fit.json")
    sw, sh, fs = faces(video)
    face = spread = None
    if fs:
        med = lambda k: stt.median(f[k] for f in fs)
        face = {k: round(med(k), 4) for k in ("cx", "cy", "w", "h")}
        xs = sorted(f["cx"] - f["w"] / 2 for f in fs); xe = sorted(f["cx"] + f["w"] / 2 for f in fs)
        q = lambda a, p: a[min(len(a) - 1, int(p * len(a)))]
        spread = {"x0": round(q(xs, .1), 4), "x1": round(q(xe, .9), 4)}
    modes = {m: crop_for(m, sw, sh, face, spread) for m in ("small", "card", "split")}
    doc = {"source": {"path": str(video), "w": sw, "h": sh}, "face": face, "spread": spread, "samples": len(fs),
           "modes": {k: v for k, v in modes.items() if v}}
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"out": str(out), "face": face, "modes": {k: (v["zoom"], v["faceRatio"], v["note"]) for k, v in doc["modes"].items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
