#!/usr/bin/env node
// 轻包安装：补齐轻包里省掉的大文件（目前只有 Noto Sans SC 字体，17.7 MB）。
// 用法（在 skill 根目录）：
//   cd scripts/engine && npm ci && cd ../.. && node scripts/setup_light.mjs
// 来源固定到 google/fonts 的某一次提交，下载后校验 sha256；与全包内的文件逐字节一致。
// 已存在且校验通过则跳过；校验失败不落盘、退出码 1。全包里也带着本脚本，运行它不会改动任何东西。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  {
    to: 'scripts/engine/stage/fonts/NotoSansSC.ttf',
    // 两个源指向同一次提交的同一文件；无论从哪个源下载，都必须通过同一个 sha256
    urls: [
      'https://raw.githubusercontent.com/google/fonts/a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',
    ],
    sha256: 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da',
    size: 17772300,
    license: 'SIL OFL 1.1（见同目录 OFL-NotoSansSC.txt）',
  },
];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

let failed = 0;
for (const f of FILES) {
  const dst = path.join(ROOT, f.to);
  if (fs.existsSync(dst) && sha(fs.readFileSync(dst)) === f.sha256) { console.log('已就绪', f.to); continue; }
  // 可选本地缓存（团队镜像/离线安装）：KB_FONT_CACHE=<目录>。缓存文件同样要过 sha256，下载成功后也写回缓存
  const cache = process.env.KB_FONT_CACHE ? path.join(process.env.KB_FONT_CACHE, path.basename(f.to)) : null;
  if (cache && fs.existsSync(cache) && sha(fs.readFileSync(cache)) === f.sha256) {
    fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(cache, dst);
    console.log('取自缓存（sha256 校验通过）', f.to); continue;
  }
  process.stdout.write(`下载 ${path.basename(f.to)}（${(f.size / 1048576).toFixed(1)} MB）… `);
  // 优先 curl（会读 HTTPS_PROXY 等代理环境变量；Node 22 自带 fetch 不读），没有 curl 再用 fetch（带超时）
  const get = async url => {
    try { return execFileSync('curl', ['-fsSL', '--retry', '2', '--connect-timeout', '15', '--max-time', '600', url], { maxBuffer: 64 << 20 }); }
    catch (e) { if (e.code !== 'ENOENT') throw Error('curl 失败'); }
    const r = await fetch(url, { signal: AbortSignal.timeout(600000) });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  };
  try {
    let buf = null, why = [];
    for (const url of f.urls) {
      try { const b = await get(url); if (sha(b) === f.sha256) { buf = b; break; } why.push(new URL(url).host + ' sha256 不匹配'); }
      catch (e) { why.push(new URL(url).host + ' ' + e.message); }
    }
    if (!buf) throw Error(why.join('；'));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst + '.part', buf);
    fs.renameSync(dst + '.part', dst);
    if (cache) { fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, buf); }
    console.log('完成，sha256 校验通过（网络下载）');
  } catch (e) {
    failed++;
    console.log('失败：' + e.message);
  }
}
if (failed) { console.error(`有 ${failed} 个文件没有就绪：请检查网络后重跑，或改用全包。`); process.exit(1); }
