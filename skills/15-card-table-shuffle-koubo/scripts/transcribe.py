#!/usr/bin/env python3
"""本机 mlx-whisper 转写口播，带词级时间。只在 Apple Silicon 上可用。

用法（不需要全局安装）：
  uv run --with mlx-whisper python -I transcribe.py <口播视频或音频> <输出 words.json> [--prompt "专有名词…"]
首次运行会下载 mlx-community/whisper-large-v3-turbo；已缓存时可设 HF_HUB_OFFLINE=1。
"""
import argparse, json, os, subprocess, tempfile

ap = argparse.ArgumentParser()
ap.add_argument("media")
ap.add_argument("out")
ap.add_argument("--prompt", default="以下是普通话的句子，使用简体中文。")
ap.add_argument("--model", default="mlx-community/whisper-large-v3-turbo")
a = ap.parse_args()

import mlx_whisper  # noqa: E402

with tempfile.TemporaryDirectory() as tmp:
    wav = os.path.join(tmp, "a16k.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.media, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
    r = mlx_whisper.transcribe(wav, path_or_hf_repo=a.model, language="zh", word_timestamps=True, initial_prompt=a.prompt)

json.dump(r, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for s in r["segments"]:
    print(f'{s["start"]:.2f}-{s["end"]:.2f} {s["text"]}')
