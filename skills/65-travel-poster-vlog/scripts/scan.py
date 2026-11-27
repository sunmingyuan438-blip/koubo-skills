#!/usr/bin/env python3
"""素材盘点：扫一个目录里的视频和照片，输出每段素材的规格、时长、有没有人声，并给每段素材出一张缩略图条。

    python3 scan.py <素材目录> [--out 盘点目录] [--asr]

输出：
  <盘点目录>/素材清单.json   每段：路径、时长、分辨率、帧率、HDR、是否有音轨、响度、（可选）口播文字和时间轴
  <盘点目录>/sheets/<名字>.jpg  每段均匀取 6 帧并标时间，用来挑入点出点
  <盘点目录>/总览.jpg         所有素材的首帧总览
--asr 会调用 AI 超市 ASR（public-domain-research 技能的 research.py transcribe，按次扣积分），用于带口播的素材。
"""
import argparse, json, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vlog_engine import probe  # noqa

EXT_V = {".mov", ".mp4", ".m4v", ".hevc"}
EXT_I = {".jpg", ".jpeg", ".png", ".heic", ".webp"}
F = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 20, index=1)


def frame(p, t, w=200):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", str(p), "-frames:v", "1", "-vf", f"scale={w}:-2",
                        "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    from io import BytesIO
    return Image.open(BytesIO(r.stdout)).convert("RGB") if r.stdout else None


def loud(p):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(p), "-vn", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out")
    ap.add_argument("--asr", action="store_true")
    a = ap.parse_args()
    src = Path(a.src).expanduser().resolve()
    out = Path(a.out).resolve() if a.out else src / "_盘点"
    (out / "sheets").mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in src.iterdir() if p.suffix.lower() in EXT_V | EXT_I and not p.name.startswith("."))
    items, firsts = [], []
    for p in files:
        info = probe(p) if p.suffix.lower() != ".heic" else {"image": True}
        it = {"path": str(p), "name": p.name, **{k: info.get(k) for k in ("duration", "width", "height", "fps", "hdr", "has_audio", "image")}}
        if p.suffix.lower() in EXT_V and info.get("has_audio"):
            it["lufs"] = loud(p)
        if p.suffix.lower() in EXT_V:
            D = info["duration"]
            ts = [D * (i + 0.5) / 6 for i in range(6)]
            ims = [(t, frame(p, t)) for t in ts]
            ims = [(t, im) for t, im in ims if im]
            if ims:
                w, h = ims[0][1].size
                S = Image.new("RGB", (w * len(ims), h + 26), "white"); d = ImageDraw.Draw(S)
                for i, (t, im) in enumerate(ims):
                    S.paste(im.resize((w, h)), (i * w, 0)); d.text((i * w + 4, h + 2), f"{t:.1f}s", fill="black", font=F)
                S.save(out / "sheets" / f"{p.stem}.jpg", quality=80)
                firsts.append((p.name, ims[0][1]))
        if a.asr and info.get("has_audio") and (it.get("lufs") or -99) > -40:
            r = subprocess.run([sys.executable, "-I", str(Path.home() / ".claude/skills/public-domain-research/scripts/research.py"),
                                "--out", str(out / "asr"), "transcribe", str(p), "--mode", "auto"], capture_output=True, text=True)
            tj = out / "asr" / "transcripts" / f"local_{p.stem}.json"
            if tj.exists():
                j = json.loads(tj.read_text())
                it["speech"] = j.get("text"); it["speech_segments"] = j.get("segments")
        items.append(it)
        print(p.name, f"{it.get('duration') or 0:.1f}s", f"{it.get('width')}x{it.get('height')}", "HDR" if it.get("hdr") else "", f"{it.get('lufs')}LUFS" if it.get("lufs") else "")
    (out / "素材清单.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    if firsts:
        w, h = 160, int(160 * firsts[0][1].height / firsts[0][1].width)
        cols = 8; rows = (len(firsts) + cols - 1) // cols
        S = Image.new("RGB", (cols * w, rows * (h + 24)), "white"); d = ImageDraw.Draw(S)
        for i, (n, im) in enumerate(firsts):
            x, y = (i % cols) * w, (i // cols) * (h + 24)
            S.paste(im.resize((w, h)), (x, y)); d.text((x + 3, y + h + 2), n[:16], fill="black", font=F)
        S.save(out / "总览.jpg", quality=80)
    print("盘点完成：", out)


if __name__ == "__main__":
    main()
