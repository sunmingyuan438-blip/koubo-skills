"""程序合成的原创配乐（样板专用，不取用任何现成音乐）。
用法：python3 make_music.py <preset> <秒数> <输出.wav>
preset：lofi（独居日常，78bpm）/ pop（探店开箱，116bpm）/ cinematic（旅行，92bpm）/ ambient（氛围，64bpm）/ bright（mini 片，124bpm）/ tick（上班学习，104bpm）
同时输出 <输出>.beats.json（每拍时间，供卡点）。
"""
import json, sys
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.005, d=0.3, s=0.0, r=0.05, sus_len=None):
    t = np.arange(n) / SR
    e = np.exp(-t / max(d, 1e-3)) * (1 - s) + s
    att = np.clip(t / a, 0, 1)
    e = e * att
    rel = int(r * SR)
    if rel and rel < n:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e


def keys(f, dur, bright=0.5):
    """电钢/钢琴感：带衰减的谐波叠加 + 轻微颤音"""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for k, amp in enumerate([1, 0.5 * bright + 0.2, 0.25 * bright, 0.12 * bright, 0.06]):
        y += amp * np.sin(2 * np.pi * f * (k + 1) * t * (1 + 0.0007 * k)) * np.exp(-t * (1.2 + k * 1.6))
    y *= 1 + 0.03 * np.sin(2 * np.pi * 5 * t)
    return y * env(n, 0.004, 9, 0, 0.08)


def pad(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * (1 + dt) * t + p) for dt, p in ((0, 0), (0.004, 1), (-0.005, 2)))
    y += 0.3 * sum(np.sin(2 * np.pi * 2 * f * (1 + dt) * t) for dt in (0.003, -0.003))
    a = np.clip(t / 0.8, 0, 1) * np.clip((dur - t) / 0.8, 0, 1)
    return y * a / 3


def pluck(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    saw = 2 * ((f * t) % 1) - 1
    sos = butter(2, min(0.45, 3000 / (SR / 2)), output="sos")
    return sosfilt(sos, saw) * np.exp(-t * 7) * 0.6


def kick(dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare(dur=0.22, soft=False):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    sos = butter(2, [1500 / (SR / 2), 9000 / (SR / 2)], btype="band", output="sos")
    y = sosfilt(sos, nz) * np.exp(-t * (28 if soft else 18)) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return y * (0.5 if soft else 0.8)


def hat(dur=0.06):
    n = int(dur * SR); t = np.arange(n) / SR
    sos = butter(2, 7000 / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, rng.standard_normal(n)) * np.exp(-t * 60) * 0.35


def place(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    m = min(len(x), len(buf) - i)
    buf[i:i + m] += x[:m]


def reverb(y, sec=2.2, mix=0.25):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 3.2)
    sos = butter(1, 6000 / (SR / 2), output="sos")
    ir = sosfilt(sos, ir); ir /= np.sqrt((ir ** 2).sum())
    wet = fftconvolve(y, ir)[:len(y)]
    return y * (1 - mix) + wet * mix * 3


PRESETS = {
    # 和弦（根音 MIDI + 结构），每和弦小节数
    "lofi": dict(bpm=78, chords=[(57, [0, 3, 7, 10, 14]), (50, [0, 3, 7, 10, 14]), (55, [0, 4, 7, 11, 14]), (52, [0, 4, 7, 11])],
                 drums="lofi", lead=None),
    "pop": dict(bpm=116, chords=[(60, [0, 4, 7]), (55, [0, 4, 7]), (57, [0, 3, 7]), (53, [0, 4, 7])], drums="pop", lead="pluck"),
    "cinematic": dict(bpm=92, chords=[(50, [0, 7, 12, 15]), (46, [0, 7, 12, 16]), (53, [0, 7, 12, 16]), (48, [0, 7, 12, 16])],
                      drums="cine", lead="arp"),
    "ambient": dict(bpm=64, chords=[(52, [0, 7, 11, 14]), (48, [0, 7, 11, 14]), (55, [0, 7, 9, 14]), (50, [0, 7, 10, 14])],
                    drums=None, lead="sparse"),
    "bright": dict(bpm=124, chords=[(64, [0, 4, 7, 11]), (61, [0, 3, 7, 10]), (57, [0, 4, 7, 11]), (59, [0, 4, 7, 9])],
                   drums="pop", lead="pluck"),
    "tick": dict(bpm=104, chords=[(62, [0, 3, 7, 10]), (58, [0, 4, 7, 11]), (60, [0, 4, 7, 9]), (57, [0, 3, 7, 10])],
                 drums="tick", lead="pluck"),
}


def render(preset, total):
    P = PRESETS[preset]
    beat = 60 / P["bpm"]; bar = beat * 4
    L = np.zeros(int((total + 3) * SR)); R = np.zeros_like(L)
    nbars = int(np.ceil(total / bar)) + 1
    beats = [round(i * beat, 3) for i in range(int(total / beat) + 1)]
    for b in range(nbars):
        t0 = b * bar
        root, iv = P["chords"][b % len(P["chords"])]
        intro = b < 2   # 前两小节只有和弦，鼓后进
        # 和弦层
        for k, s in enumerate(iv):
            f = midi(root + s)
            if preset in ("cinematic", "ambient"):
                v = pad(f, bar + 0.6) * 0.18
            else:
                v = keys(f, bar * 0.98, 0.6) * 0.16
                if preset == "lofi":   # 略微拖拍的人味
                    place(L if k % 2 else R, v * 0.5, t0 + 0.012 * k)
            place(L, v, t0 + 0.01 * k); place(R, v, t0 + 0.006 * k)
        # 低音
        bf = midi(root - 12)
        n = int(bar * SR); tt = np.arange(n) / SR
        bass = np.sin(2 * np.pi * bf * tt) * env(n, 0.01, 1.5, 0.3, 0.1) * 0.22
        place(L, bass, t0); place(R, bass, t0)
        # 旋律层
        if P["lead"] == "pluck" and not intro:
            pat = [0, 2, 3, 5, 6] if preset == "pop" else [0, 1.5, 2, 3.5]
            for j, pos in enumerate(pat):
                f = midi(root + 12 + iv[(j + b) % len(iv)])
                v = pluck(f, beat) * 0.14
                place(L, v * 0.8, t0 + pos * beat / 2 * (2 if preset == "tick" else 1)); place(R, v, t0 + pos * beat / 2 * (2 if preset == "tick" else 1) + 0.008)
        elif P["lead"] == "arp":
            for j in range(8):
                f = midi(root + 12 + iv[j % len(iv)])
                v = keys(f, beat, 0.9) * 0.09
                place(L if j % 2 else R, v, t0 + j * beat / 2)
        elif P["lead"] == "sparse" and b % 2 == 1:
            for j, pos in enumerate([0.5, 2.5]):
                v = keys(midi(root + 24 + iv[(j + b) % len(iv)]), beat * 3, 0.3) * 0.08
                place(L, v, t0 + pos * beat); place(R, v, t0 + pos * beat + 0.02)
        # 鼓
        dr = P["drums"]
        if dr and not intro:
            for q in range(4):
                tb = t0 + q * beat
                if dr == "lofi":
                    if q in (0, 2): place(L, kick() * 0.5, tb); place(R, kick() * 0.5, tb)
                    if q in (1, 3): place(L, snare(soft=True) * 0.45, tb + 0.02); place(R, snare(soft=True) * 0.45, tb + 0.02)
                    for e in (0, 0.5):
                        place(R, hat() * 0.5, tb + e * beat + (0.03 if e else 0))
                elif dr == "pop":
                    place(L, kick() * 0.65, tb); place(R, kick() * 0.65, tb)
                    if q in (1, 3): place(L, snare() * 0.5, tb); place(R, snare() * 0.5, tb)
                    for e in (0.5,):
                        place(L, hat() * 0.6, tb + e * beat); place(R, hat() * 0.6, tb + e * beat)
                elif dr == "cine":
                    if q == 0: place(L, kick(0.8) * 0.8, tb); place(R, kick(0.8) * 0.8, tb)
                    if q == 2 and b % 2: place(L, snare(0.5) * 0.35, tb); place(R, snare(0.5) * 0.35, tb)
                elif dr == "tick":
                    if q in (0, 2): place(L, kick() * 0.5, tb); place(R, kick() * 0.5, tb)
                    if q in (1, 3): place(L, snare(soft=True) * 0.35, tb); place(R, snare(soft=True) * 0.35, tb)
                    for e in (0, 0.25, 0.5, 0.75):
                        place(L, hat(0.03) * 0.45, tb + e * beat)
    y = np.stack([L, R])
    if preset == "lofi":   # 黑胶底噪 + 低通
        crackle = (rng.random(L.shape) > 0.9995) * rng.standard_normal(L.shape) * 0.3 + rng.standard_normal(L.shape) * 0.004
        y += crackle
        sos = butter(2, 5200 / (SR / 2), output="sos"); y = sosfilt(sos, y, axis=1)
    y = np.stack([reverb(c, 2.8 if preset in ("ambient", "cinematic") else 1.6, 0.35 if preset in ("ambient", "cinematic") else 0.2) for c in y])
    y = y[:, :int(total * SR)]
    fade = int(2.0 * SR); y[:, -fade:] *= np.linspace(1, 0, fade); y[:, :int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
    y = np.tanh(y / (np.abs(y).max() + 1e-9) * 1.3) * 0.85
    return y, beats


if __name__ == "__main__":
    preset, total, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    y, beats = render(preset, total)
    import wave
    pcm = (np.clip(y.T, -1, 1) * 32767).astype("<i2")
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    bpm = PRESETS[preset]["bpm"]
    json.dump({"bpm": bpm, "beats": beats, "bar": 240 / bpm, "drums_in": 2 * 240 / bpm},
              open(out + ".beats.json", "w"))
    print(out, total, "s", bpm, "bpm")
