#!/usr/bin/env node
// 口播风格引擎（家族核心）· 渲染器。画幅、控件、字体令牌全部读 style.json。
//   node render.mjs build   <shots.json> <实例目录> [--full]
//   node render.mjs preview <实例目录> <out.png> --time 3
//   node render.mjs render  <实例目录> <out.mp4>
// 不带 --full 时只出「动效层」：不含人物画面、不含字幕、无声，给剪映草稿用。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STYLE_FILE = path.resolve(HERE, '..', '..', 'style.json');
const STYLE = JSON.parse(fs.readFileSync(STYLE_FILE, 'utf8'));
const [W, H] = STYLE.canvas;
const FPS = STYLE.fps || 30;
const CONTROLS = STYLE.controls || ['opener', 'statement', 'list', 'steps', 'compare', 'grid', 'counter', 'quote', 'chapter', 'outro'];
const MODES = STYLE.person?.modes || ['card', 'small', 'none'];
const THEMES = STYLE.theme?.variants || ['light', 'dark'];
const fail = m => { console.error(m); process.exit(1); };
const pad2n = n => String(n).padStart(2, '0');
const probe = f => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', f]).toString());

// 可见字数上限（*星号* 不计）。数字 = 单字段；数组 = [项数, 每项上限]。超限直接报错，不缩字不截断。
const LIMITS = {
  opener: { kicker: 20, line1: 9, line2: 11, sub: 24, foot: 24 },
  statement: { kicker: 20, text: 44, source: 18 },
  chapter: { no: 5, name: 12, sub: 18, foot: 24 },
  list: { kicker: 20, title: 11, items: [6, 20], foot: 24 },
  steps: { kicker: 20, title: 11, items: [4, 18], foot: 24 },
  compare: { kicker: 20, title: 11, leftLabel: 8, rightLabel: 8, left: [4, 14], right: [4, 14], foot: 24 },
  grid: { kicker: 20, title: 11, items: [9, { zh: 12, en: 14 }], foot: 24 },
  counter: { kicker: 20, title: 11, label: 12, value: 6, unit: 4, note: 28, foot: 24 },
  quote: { kicker: 20, text: 44, source: 18, foot: 24 },
  outro: { kicker: 20, line1: 12, line2: 12, note: 18, foot: 24 },
  imageSlot: { kicker: 20, title: 11, caption: 24, foot: 24 },
  banner: { kicker: 20, title: 11, tags: [4, 6], label: 8, line: 22, foot: 24 },
  reveal: { q1: 9, q2: 9, label: 8, line: 14, sub: 16, word: 5, foot: 24 },
  bars: { kicker: 20, title: 11, items: [6, { label: 8, value: 6 }], unit: 4, note: 28, foot: 24 },
  split: { kicker: 20, title: 9, items: [3, 16], foot: 24 },
};
const vis = s => [...String(s ?? '').replace(/\*/g, '')].length;
const pick = (o, p) => p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);

function check(k, sh, mode) {
  const L = LIMITS[sh.control], P = sh.props || {}, errs = [];
  if (!L) fail(`第 ${k} 个镜头（${sh.control}）不在本风格的控件表里（可用：${CONTROLS.join(' / ')}）`);
  const one = (name, v, max) => { if (v != null && vis(v) > max) errs.push(`${name}「${v}」${vis(v)} 字，上限 ${max}`); };
  const list = (name, arr, [n, max]) => {
    if (!Array.isArray(arr) || !arr.length) return errs.push(`${name} 至少 1 项`);
    if (arr.length > n) errs.push(`${name} 最多 ${n} 项`);
    arr.forEach((v, i) => {
      if (max && typeof max === 'object') {
        if (typeof v === 'string') one(`${name}[${i}]`, v, Object.values(max)[0]);
        else for (const [f, mx] of Object.entries(max)) one(`${name}[${i}].${f}`, v?.[f], mx);
      } else one(`${name}[${i}]`, v, max);
    });
  };
  for (const [p, lim] of Object.entries(L)) {
    if (Array.isArray(lim)) list(p, pick(P, p), lim);
    else one(p, pick(P, p), lim);
  }
  // 控件专属取值校验（类型/枚举，不是长度）
  if (sh.control === 'bars') {
    (P.items || []).forEach((it, i) => { if (typeof it !== 'object' || it.value === '' || isNaN(Number(it.value))) errs.push(`items[${i}].value 必须是数字`); });
    if (P.focus != null && !(Number.isInteger(P.focus) && P.focus >= 1 && P.focus <= (P.items || []).length)) errs.push(`focus 必须是 1–${(P.items || []).length} 的整数`);
  }
  if (sh.control === 'imageSlot') {
    if (P.ratio && !['16:9', '4:3', '1:1', '3:4', '9:16'].includes(P.ratio)) errs.push('ratio 只能是 16:9 / 4:3 / 1:1 / 3:4 / 9:16');
    if (P.src && !/\.(png|jpe?g|webp)$/i.test(P.src)) errs.push(`src 只支持 png / jpg / webp：${P.src}`);
  }
  if (sh.control === 'split' && !MODES.includes('split')) errs.push('本风格未启用人物分屏（style.json#person.modes 缺 split）');
  if (errs.length) fail(`第 ${k} 个镜头（${sh.control}）放不下：\n- ` + errs.join('\n- '));
}

export function timeline(spec, base) {
  const cueDoc = JSON.parse(fs.readFileSync(path.resolve(base, spec.cues), 'utf8'));
  const cues = cueDoc.cues;
  const media = spec.presenter?.src ? path.resolve(base, spec.presenter.src) : null;
  const duration = spec.duration || (media ? Math.round(Number(probe(media).format.duration) * FPS) / FPS : null);
  if (!duration) fail('需要 presenter.src 或 duration');
  const shots = spec.shots;
  if (!shots?.length) fail('shots 不能为空');
  const starts = shots.map((sh, k) => {
    if (k === 0) return 0;
    if (sh.t0 != null) return sh.t0;
    if (!sh.captions?.length) fail(`第 ${k} 个镜头需要 t0 或 captions`);
    const first = cues[sh.captions[0]], prevEnd = sh.captions[0] > 0 ? cues[sh.captions[0] - 1].e : 0;
    return first.s - prevEnd > .2 ? +((prevEnd + first.s) / 2).toFixed(3) : first.s;
  });
  starts.forEach((s, k) => { if (k && s <= starts[k - 1]) fail(`第 ${k} 个镜头起点 ${s} 不晚于上一个`); });
  const out = shots.map((sh, k) => {
    if (!CONTROLS.includes(sh.control)) fail(`第 ${k} 个镜头控件不存在：${sh.control}（可用：${CONTROLS.join(' / ')}）`);
    if (sh.presenter === 'split' && sh.control !== 'split') fail(`第 ${k} 个镜头：presenter=split 只能配 split 控件`);
    const mode = sh.control === 'split' ? 'split' : (sh.presenter || spec.presenterDefault || STYLE.person?.default || 'small');
    if (sh.theme && !THEMES.includes(sh.theme)) fail(`第 ${k} 个镜头 theme 只能是 ${THEMES.join(' / ')}`);
    if (!MODES.includes(mode)) fail(`第 ${k} 个镜头 presenter 只能是 ${MODES.join(' / ')}`);
    check(k, sh, mode);
    const t0 = starts[k], t1 = k + 1 < shots.length ? starts[k + 1] : duration;
    const owned = cues.filter(c => c.s < t1 && c.e > t0).map(c => c.i);
    let cueTimes = sh.cues;
    if (sh.cues === 'captions') cueTimes = owned.map(i => Math.max(cues[i].s, t0));
    return { control: sh.control, props: sh.props || {}, presenter: mode, theme: sh.theme || STYLE.theme?.default || 'light',
      label: sh.label || '', t0, t1, cues: cueTimes || null, captions: owned };
  });
  const covered = new Set(out.flatMap(s => s.captions));
  const missing = cues.filter(c => !covered.has(c.i)).map(c => c.i);
  if (missing.length) fail('这些字幕没有被任何镜头覆盖：' + missing.join(','));
  return { duration, cues, reviewed: !!cueDoc.reviewed, shots: out, media };
}

function build(specFile, inst, full) {
  if (fs.existsSync(inst)) fail('实例目录已存在，换一个新目录：' + inst);
  const base = path.dirname(path.resolve(specFile));
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const T = timeline(spec, base);
  fs.mkdirSync(inst, { recursive: true });
  fs.cpSync(path.join(HERE, 'stage'), inst, { recursive: true });
  // imageSlot 素材：拷进实例 assets/，props.src 改写为实例内相对路径；文件不存在直接报错
  T.shots.forEach((s, k) => {
    if (s.control !== 'imageSlot' || !s.props.src) return;
    const src = path.resolve(base, s.props.src);
    if (!fs.existsSync(src)) fail(`第 ${k} 个镜头（imageSlot）素材不存在：${s.props.src}`);
    fs.mkdirSync(path.join(inst, 'assets'), { recursive: true });
    const name = `${pad2n(k)}-${path.basename(src)}`;
    fs.copyFileSync(src, path.join(inst, 'assets', name));
    s.props = { ...s.props, src: 'assets/' + name };
  });
  const data = {
    style: STYLE, fps: FPS, duration: T.duration, episode: spec.episode || '01',
    section: spec.section || STYLE.title || '', presenterTag: spec.presenterTag || '本期讲述者',
    presenterDefault: spec.presenterDefault || STYLE.person?.default || 'small',
    faceCy: spec.presenter?.faceCy ?? .42, shots: T.shots, captions: null, presenterFrames: null, full,
    presenterFit: spec.presenter?.fit ? JSON.parse(fs.readFileSync(path.resolve(base, spec.presenter.fit), 'utf8')) : null,
  };
  if (full) {
    if (!T.media) fail('--full 需要 presenter.src');
    const dir = path.join(inst, 'presenter');
    fs.mkdirSync(dir);
    execFileSync('ffmpeg', ['-v', 'error', '-i', T.media, '-t', String(T.duration), '-vf', `fps=${FPS},scale=720:-2`, '-q:v', '3', path.join(dir, '%05d.jpg')]);
    data.presenterFrames = { count: fs.readdirSync(dir).length };
    data.captions = T.cues.map(c => ({ s: c.s, e: c.e, text: c.highlight?.length ? c.highlight.reduce((s, w) => s.split(w).join(`*${w}*`), c.text) : c.text }));
    execFileSync('ffmpeg', ['-v', 'error', '-i', T.media, '-vn', '-ac', '2', '-ar', '48000', '-af', `apad=whole_dur=${T.duration}`, '-t', String(T.duration), path.join(inst, 'audio.wav')]);
  }
  fs.writeFileSync(path.join(inst, 'data.js'), `window.DATA = ${JSON.stringify(data, null, 1)};\n`);
  fs.writeFileSync(path.join(inst, 'timeline.json'), JSON.stringify({ duration: T.duration, reviewed: T.reviewed, shots: T.shots }, null, 1));
  for (const s of T.shots) console.log(`${s.t0.toFixed(2).padStart(6)}-${s.t1.toFixed(2).padStart(6)} ${s.control.padEnd(10)} 人物=${s.presenter.padEnd(5)} 底=${String(s.theme).padEnd(5)} 句${JSON.stringify(s.captions)}`);
  if (!T.reviewed) console.error('注意：cues.json 未人工核对（reviewed=false），只能用于试排。');
}

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const d of (fs.existsSync(cache) ? fs.readdirSync(cache) : []).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse())
    for (const a of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']) {
      const b = path.join(cache, d, a, 'chrome-headless-shell');
      if (fs.existsSync(b)) return b;
    }
  fail('没找到 Chromium：设置 CHROME，或运行 npx playwright-core install chromium-headless-shell');
}

async function page(inst, fn) {
  const root = path.resolve(inst);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const server = http.createServer((req, res) => {
    const f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return res.writeHead(404).end();
    res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { chromium } = createRequire(import.meta.url)('playwright-core');
  const browser = await chromium.launch({ executablePath: chrome(), args: ['--force-color-profile=srgb', '--disable-gpu'] });
  try {
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('requestfailed', r => errors.push('请求失败 ' + r.url()));
    await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await p.evaluate(() => window.READY || (window.READY = 1));
    if (errors.length) throw Error(errors.join('\n'));
    // 每帧等人物帧/素材图解码完再截图，否则 --full 出片会出现半张人物
    return await fn(p, async t => {
      await p.evaluate(async t => { window.renderAt(t); await Promise.all([...document.images].map(i => (i.complete && i.naturalWidth ? null : i.decode().catch(() => {})))); }, t);
      if (errors.length) throw Error(errors.join('\n'));
    });
  } finally { await browser.close(); server.close(); }
}

async function render(inst, out) {
  if (fs.existsSync(out)) fail('输出已存在：' + out);
  const tl = JSON.parse(fs.readFileSync(path.join(inst, 'timeline.json'), 'utf8'));
  const n = Math.round(tl.duration * FPS);
  const hasAudio = fs.existsSync(path.join(inst, 'audio.wav'));
  const args = ['-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0'];
  if (hasAudio) args.push('-i', path.join(inst, 'audio.wav'), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-frames:v', String(n), '-movflags', '+faststart', out);
  const enc = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = once(enc, 'exit');
  await page(inst, async (p, step) => {
    for (let f = 0; f < n; f++) {
      await step(f / FPS);
      const jpg = await p.screenshot({ type: 'jpeg', quality: 92 });
      if (!enc.stdin.write(jpg)) await once(enc.stdin, 'drain');
      if (f % (FPS * 10) === 0) console.error(`渲染 ${(f / FPS).toFixed(0)}s / ${tl.duration}s`);
    }
  });
  enc.stdin.end();
  if ((await done)[0] !== 0) fail('ffmpeg 编码失败');
  console.log(JSON.stringify({ video: out, frames: n, fps: FPS, duration: tl.duration, audio: hasAudio }));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  const opt = k => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : undefined);
  if (cmd === 'build' && a && b) build(a, path.resolve(b), rest.includes('--full'));
  else if (cmd === 'preview' && a && b) {
    if (fs.existsSync(b)) fail('输出已存在：' + b);
    await page(a, async (p, step) => { await step(Number(opt('--time') ?? 2)); await p.screenshot({ path: path.resolve(b) }); });
  } else if (cmd === 'render' && a && b) await render(a, path.resolve(b));
  else if (cmd === 'audit' && a) {
    // W7：按像素判定版面。每个镜头取入场结束后的一帧，量出每个文字元素的实际渲染框；任一违规 exit 1
    const tl = JSON.parse(fs.readFileSync(path.join(a, 'timeline.json'), 'utf8'));
    const rep = await page(a, async (p, step) => {
      const res = [];
      for (const s of tl.shots) {
        const d = s.t1 - s.t0, t = +Math.min(s.t1 - 0.25, s.t0 + Math.min(d * 0.72, 2.4) + 0.15).toFixed(3);
        await step(t);
        await p.evaluate(() => document.fonts.ready);
        res.push({ t, ...(await p.evaluate(() => window.auditLayout())) });
      }
      return res;
    });
    const bad = rep.filter(r => r.violations.length);
    console.log(JSON.stringify({ shots: rep.length, texts: rep.reduce((n, r) => n + r.texts, 0), bad: bad.length, detail: bad }, null, rest.includes('--pretty') ? 1 : 0));
    if (bad.length) process.exit(1);
  }
  else fail('用法见文件开头注释');
}