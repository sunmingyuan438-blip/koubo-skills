#!/usr/bin/env python3
"""旁白合成：Fish Audio 公共音色（不用任何个人克隆音色，也不模仿用户语调）。

密钥按顺序找：环境变量 FISH_AUDIO_API_KEY、$FISH_ENV_FILE、~/.config/fish/fish.env、当前目录及上级目录里的 .env。
注意：只读取 FISH_AUDIO_API_KEY；不使用任何个人克隆音色。
没有 Fish 密钥时退回 macOS `say -v Tingting`（音质一般，只适合打样）。

    python3 tts.py "要说的话" out.wav [--voice 音色ID] [--speed 1.0]
    python3 tts.py --search 温柔女声        # 查公共音色（按使用量排序）
"""
import argparse, json, os, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path

DEFAULT_VOICE = "faccba1a8ac54016bcfc02761285e67f"   # 公共音色「温柔动听女声」
VOICES = {   # 各风格默认用的公共音色（名字是 Fish 上的公开标题）
    "温柔动听女声": "faccba1a8ac54016bcfc02761285e67f",
    "活力女声": "bf6c479f5a384b8d857310030035824b",
    "温柔叙事女声": "23632847285a487d8e0c6ae5bc593c71",
    "影视解说": "b4bdf5dc66004241a21ff2df165bf442",
}


def key():
    if os.environ.get("FISH_AUDIO_API_KEY"):
        return os.environ["FISH_AUDIO_API_KEY"]
    cands = [Path(os.environ["FISH_ENV_FILE"])] if os.environ.get("FISH_ENV_FILE") else []
    cands.append(Path.home() / ".config/fish/fish.env")
    cands += [d / ".env" for d in [Path.cwd(), *Path.cwd().parents]]
    for p in cands:
        if p.exists():
            for line in p.read_text().splitlines():
                if line.strip().startswith("FISH_AUDIO_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"')
    return None


def req(url, data=None, headers=None):
    h = {"Authorization": f"Bearer {key()}"}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, headers=h, method="POST" if data else "GET")
    with urllib.request.urlopen(r, timeout=180) as f:
        return f.read()


def synth(text, voice, out, speed=1.0):
    out = Path(out)
    voice = VOICES.get(voice, voice)
    if key():
        body = json.dumps({"text": text, "reference_id": voice, "format": "wav", "sample_rate": 44100,
                           "prosody": {"speed": speed}, "normalize": True}).encode()
        out.write_bytes(req("https://api.fish.audio/v1/tts", body, {"Content-Type": "application/json", "model": "s1"}))
    else:
        aiff = out.with_suffix(".aiff")
        subprocess.run(["say", "-v", "Tingting", "-r", str(int(190 * speed)), "-o", str(aiff), text], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(aiff), "-ar", "48000", str(out)], check=True)
        aiff.unlink()
    # 去掉首尾静音，方便对齐画面
    tmp = out.with_suffix(".trim.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
                    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse", str(tmp)], check=True)
    tmp.replace(out)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("text", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--search")
    a = ap.parse_args()
    if a.search:
        q = urllib.parse.urlencode({"title": a.search, "language": "zh", "sort_by": "task_count", "page_size": 10})
        for m in json.loads(req("https://api.fish.audio/model?" + q)).get("items", []):
            print(m["_id"], m["title"], m.get("task_count"))
    else:
        print(synth(a.text, a.voice, a.out, a.speed))
