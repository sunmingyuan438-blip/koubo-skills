#!/usr/bin/env python3
"""成片抽帧拼图（检查字幕位置、调色、节奏用）：python3 contact.py 成片.mp4 [输出.jpg] [张数]"""
import subprocess, sys, json
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
p = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else p.rsplit(".", 1)[0] + "_拼图.jpg"; n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
D = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout)
F = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 20, index=1)
ims = []
for i in range(n):
    t = D * (i + 0.5) / n
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", p, "-frames:v", "1", "-vf", "scale=-2:420", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    if not r.stdout:   # 个别时间点取不到帧（落在剪点上）时往后挪一点再取
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t + 0.1:.2f}", "-i", p, "-frames:v", "1", "-vf", "scale=-2:420", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    if r.stdout:
        ims.append((t, Image.open(BytesIO(r.stdout)).convert("RGB")))
w, h = ims[0][1].size; cols = 6 if w < h else 4
rows = (n + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * (h + 24)), "white"); d = ImageDraw.Draw(S)
for i, (t, im) in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * (h + 24); S.paste(im, (x, y)); d.text((x + 4, y + h + 2), f"{t:.1f}s", fill="black", font=F)
S.save(out, quality=85); print(out)
