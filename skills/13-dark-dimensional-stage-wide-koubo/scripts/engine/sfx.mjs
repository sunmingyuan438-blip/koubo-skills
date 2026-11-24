// 口播风格引擎 · 动作音效（v4，2026-11-24）
// 全部由本文件的算式合成（噪声 + 正弦 + 滤波），不带任何采样或外部素材；同一份事件表每次合成结果完全一致。
// synth(events, duration, kit) → 48 kHz 立体声 16-bit WAV（Buffer）。
// 事件 kind：intro 开场 / cut 切镜 / tick 条目 / pop 卡片 / hit 重音 / roll 数字滚动（带 d 时长）。
const SR = 48000;
const TAU = Math.PI * 2;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1; }

class Mix {
  constructor(dur) { this.n = Math.ceil(dur * SR); this.L = new Float32Array(this.n); this.R = new Float32Array(this.n); }
  add(t, buf, gain = 1, pan = 0) {   // pan −1 左 … 1 右；buf 可为 [L, R]
    const o = Math.round(t * SR), st = Array.isArray(buf), a = st ? buf[0] : buf, b = st ? buf[1] : buf;
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * 1.414, gr = gain * Math.sin((pan + 1) * Math.PI / 4) * 1.414;
    for (let i = 0; i < a.length; i++) { const j = o + i; if (j < 0) continue; if (j >= this.n) break; this.L[j] += a[i] * gl; this.R[j] += b[i] * gr; }
  }
}
const buf = d => new Float32Array(Math.max(1, Math.ceil(d * SR)));
// 状态变量带通：fc 可逐样本变化
function bandNoise(d, f, q, seed, env) {
  const o = buf(d), r = rng(seed); let lp = 0, bp = 0;
  for (let i = 0; i < o.length; i++) {
    const x = i / o.length, fc = f(x), g = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    const hp = r() - lp - bp / q; bp += g * hp; lp += g * bp;
    o[i] = bp * env(x);
  }
  return o;
}
function tone(d, f, env, shape = 0) {   // shape 0 正弦；>0 掺入奇次谐波（偏方波）
  const o = buf(d); let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const x = i / o.length; ph += TAU * f(x) / SR;
    let v = Math.sin(ph); if (shape) v = (v + shape * Math.sin(3 * ph) / 3 + shape * Math.sin(5 * ph) / 5) / (1 + shape * 0.4);
    o[i] = v * env(x);
  }
  return o;
}
const ex = k => x => Math.exp(-k * x) * Math.min(1, x * 400);            // 快起、指数衰减
const bell = p => x => Math.pow(Math.sin(Math.PI * Math.min(1, x)), p);   // 两头收的鼓包
const lerp3 = (a, b, c) => x => (x < .5 ? a + (b - a) * (x * 2) : b + (c - b) * (x * 2 - 1));
const glide = (a, b) => x => a * Math.pow(b / a, x);
function sum(...bs) { const o = new Float32Array(Math.max(...bs.map(b => b.length))); bs.forEach(b => { for (let i = 0; i < b.length; i++) o[i] += b[i]; }); return o; }
function scale(b, g) { const o = new Float32Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b[i] * g; return o; }
function sweepStereo(b) {   // 单声道 → 左到右扫过
  const l = new Float32Array(b.length), r = new Float32Array(b.length);
  for (let i = 0; i < b.length; i++) { const x = i / b.length, a = (0.15 + 0.7 * x) * Math.PI / 2; l[i] = b[i] * Math.cos(a) * 1.3; r[i] = b[i] * Math.sin(a) * 1.3; }
  return [l, r];
}

// —— 基础音色 ——
const whoosh = (d, f0, f1, f2, q, seed, p = 1.6) => sweepStereo(bandNoise(d, lerp3(f0, f1, f2), q, seed, bell(p)));
const tick = (f, d, n, seed) => sum(tone(d, () => f, ex(9)), scale(bandNoise(Math.min(d, .012), () => f * 2.2, 1.2, seed, ex(5)), n));
const pop = (f0, f1, d) => tone(d, glide(f0, f1), ex(7));
const thump = (f0, f1, d, seed, click = .5) => sum(tone(d, glide(f0, f1), ex(5)), scale(bandNoise(.02, () => 1800, .9, seed, ex(6)), click));
const chime = (fs, d) => sum(...fs.map((f, i) => scale(tone(d, () => f, ex(5 + i * 1.5)), 1 / (1 + i * .7))));
const blip = (f0, f1, d, shape = .8) => tone(d, glide(f0, f1), ex(8), shape);
const scratch = (d, f, seed) => bandNoise(d, x => f * (1 + .25 * Math.sin(x * 40)), 2.2, seed, x => bell(.8)(x) * (.6 + .4 * Math.sin(x * 90)));
const shutter = seed => { const o = buf(.07), a = bandNoise(.014, () => 3200, .8, seed, ex(5)), b = bandNoise(.02, () => 2200, .8, seed + 7, ex(5)); o.set(a, 0); o.set(b, Math.round(.034 * SR)); return o; };
const arp = (fs, step, shape) => { const o = buf(step * fs.length + .08); fs.forEach((f, i) => { const b = tone(step + .06, () => f, ex(6), shape); const at = Math.round(i * step * SR); for (let j = 0; j < b.length && at + j < o.length; j++) o[at + j] += b[j]; }); return o; };
const stutter = (d, seed) => { const b = bandNoise(d, () => 2600, .7, seed, x => (Math.floor(x * 7) % 2 ? 0 : 1) * (1 - x)); return b; };

// —— 音色包：每种事件一个生成函数（k = 该事件在全片里的序号，用来做细微变化）——
const KITS = {
  // 纸面 / 编辑：轻的纸张划过声 + 木质点击
  paper: { cut: k => [whoosh(.30, 380, 1700, 650, 1.1, 11 + k), .55], intro: k => [whoosh(.42, 300, 1500, 500, 1.0, 5), .5],
    tick: k => [tick(880 + (k % 3) * 60, .05, .5, 31 + k), .42], pop: k => [pop(330, 210, .09), .5], hit: k => [sum(thump(115, 62, .22, 3, .4), scale(tick(1320, .06, .2, 9), .35)), .7] },
  // 科技 / 控制台：窄带扫频 + 电子哔声 + 低频下沉
  tech: { cut: k => [whoosh(.26, 700, 5200, 1400, 2.6, 21 + k, 2), .5], intro: k => [sum(...[whoosh(.4, 500, 4200, 900, 2.4, 8)[0]].map(x => x), scale(blip(440, 1760, .28, .5), .25)), .5],
    tick: k => [blip(1900 + (k % 2) * 240, 1800, .04), .3], pop: k => [blip(900, 1350, .07), .34], hit: k => [sum(thump(72, 40, .32, 4, .3), scale(blip(2400, 2300, .08), .3)), .75] },
  // 海报 / 新闻：短促有力的风声 + 拍击 + 重低音
  poster: { cut: k => [whoosh(.22, 260, 2600, 380, .9, 41 + k, 1.3), .7], intro: k => [whoosh(.34, 220, 2200, 320, .9, 6, 1.2), .65],
    tick: k => [sum(bandNoise(.035, () => 1500, .8, 51 + k, ex(6)), scale(tone(.04, () => 190, ex(7)), .6)), .5], pop: k => [thump(170, 92, .12, 13 + k, .6), .6], hit: k => [sum(thump(92, 44, .34, 2, .9), scale(bandNoise(.09, () => 900, .7, 17, ex(4)), .45)), .85] },
  // 柔和 / 生活：气声 + 上扬的水滴 + 风铃
  soft: { cut: k => [whoosh(.34, 520, 1500, 800, 1.3, 61 + k, 2), .42], intro: k => [sum(whoosh(.4, 480, 1400, 700, 1.3, 4, 2)[0], scale(chime([660, 990], .5), .3)), .45],
    tick: k => [pop(600 + (k % 3) * 70, 930 + (k % 3) * 90, .07), .36], pop: k => [pop(480, 760, .09), .42], hit: k => [sum(chime([880, 1320, 1760], .7), scale(pop(300, 200, .12), .5)), .55] },
  // 胶片 / 影像：快门 + 低沉的带子声 + 钢片余音
  film: { cut: k => [sum(shutter(71 + k), scale(bandNoise(.26, lerp3(180, 700, 220), 1.0, 73 + k, bell(1.6)), .9)), .55], intro: k => [sum(shutter(70), scale(chime([330, 495], .9), .35)), .5],
    tick: k => [tick(700, .03, .9, 81 + k), .36], pop: k => [tick(520, .05, .7, 83 + k), .42], hit: k => [sum(chime([440, 660, 1320], .9), thump(98, 55, .26, 5, .2)), .55] },
  // 粉笔 / 手写：摩擦声
  chalk: { cut: k => [scratch(.24, 2600, 91 + k), .55], intro: k => [scratch(.34, 2300, 90), .55],
    tick: k => [scratch(.07, 3100 + (k % 3) * 200, 95 + k), .5], pop: k => [tick(620, .05, .6, 97 + k), .45], hit: k => [sum(thump(120, 70, .2, 6, .5), scale(scratch(.12, 2800, 99), .5)), .7] },
  // 像素游戏：方波琶音 + 金币声
  game: { cut: k => [arp([523, 659, 784], .045, 1), .75], intro: k => [arp([392, 523, 659, 784], .06, 1), .75],
    tick: k => [blip(988, 988, .05, 1), .6], pop: k => [blip(660, 990, .07, 1), .65], hit: k => [arp([988, 1319], .07, 1), .85] },
  // 故障 / 信号：断续噪声 + 高频哔 + 低频
  glitch: { cut: k => [stutter(.2, 111 + k), .5], intro: k => [stutter(.28, 110), .5],
    tick: k => [blip(3200, 2600, .03, .6), .26], pop: k => [stutter(.07, 121 + k), .4], hit: k => [sum(thump(80, 42, .3, 7, .6), scale(stutter(.12, 123), .5)), .8] },
};
export const SFX_KITS = Object.keys(KITS);

export function synth(events, duration, kit = 'paper', volume = 1) {
  const K = KITS[kit] || KITS.paper, m = new Mix(duration);
  const cnt = {};
  for (const e of events) {
    const k = (cnt[e.kind] = (cnt[e.kind] || 0) + 1) - 1;
    if (e.kind === 'roll') {   // 数字滚动：一串逐渐升高、逐渐变密的点击
      const d = e.d || .6; let t = 0, i = 0;
      while (t < d) { const [b, g] = K.tick(i); m.add(e.t + t, scale(b, .55 + .45 * t / d), g * .6, -.2 + .4 * t / d); t += .075 - .035 * (t / d); i++; }
      continue;
    }
    const f = K[e.kind] || (e.kind === 'intro' ? K.cut : null); if (!f) continue;
    const [b, g] = f(k);
    const lead = (e.kind === 'cut' || e.kind === 'intro') ? (Array.isArray(b) ? b[0].length : b.length) / SR * 0.45 : 0;   // 风声的最响处对准切点
    m.add(Math.max(0, e.t - lead), b, g * (e.flip ? 1.15 : 1), e.kind === 'tick' ? ((k % 2) ? .18 : -.18) : 0);
  }
  // 总线：整体压到约 −15 dBFS 峰值以内，软限幅；口播永远是主角
  const G = 0.2 * volume, n = m.n, pcm = Buffer.alloc(44 + n * 4);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + n * 4, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(n * 4, 40);
  const fade = Math.round(.03 * SR);
  for (let i = 0; i < n; i++) {
    const w = i > n - fade ? (n - i) / fade : 1;
    pcm.writeInt16LE(Math.round(Math.tanh(m.L[i] * G * 2.2) / 2.2 * w * 32767), 44 + i * 4);
    pcm.writeInt16LE(Math.round(Math.tanh(m.R[i] * G * 2.2) / 2.2 * w * 32767), 46 + i * 4);
  }
  return pcm;
}
