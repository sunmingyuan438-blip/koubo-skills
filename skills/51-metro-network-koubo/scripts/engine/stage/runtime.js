// 口播风格引擎（家族核心）· window.renderAt(t) 只由 t 与 DATA 决定画面
// 风格差异全部来自 DATA.style 的令牌：底色/字体/版式/装饰/HUD/人物框/入场动作
// v2（2026-11-09）：主题感知配色、按可用宽度定字号（不缩字超限，只防溢出）、入场在 2.4s 内完成、竖屏内容视觉居中
(function () {
  const D = window.DATA, S = D.style || {};
  const [W, H] = S.canvas || [1080, 1920];
  const TH = S.theme || {}, TY = S.type || {}, CH = S.chrome || {}, LY = S.layout || {}, LK = S.look || {}, MO = S.motion || {};
  const $ = id => document.getElementById(id);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const span = (t, s, d) => clamp((t - s) / d);
  const out3 = p => 1 - Math.pow(1 - p, 3);
  const inout = p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const hi = s => esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>');
  const pad2 = n => String(n).padStart(2, '0');
  const px = v => Math.round(v) + 'px';
  const R = (f, base) => f * base;                 // 比例 → 像素（沿画布短边）
  const MIN = Math.min(W, H);
  const PORTRAIT = H > W * 1.15;

  // 版心（全部按比例，横竖屏通用）
  const M = LY.margin ?? 0.065;
  const L = R(M, MIN), RT = W - L;
  const TITLE_Y = R(LY.titleY ?? 0.135, H);
  const HERO_Y = R(LY.heroY ?? 0.20, H);
  const CONTENT_Y = R(LY.contentY ?? 0.42, H);
  const SAFE0 = R(LY.safe ?? 0.86, H);   // 内容下限（其下留字幕）
  let SAFE = SAFE0;                      // 每镜按人物框调整（人物在下部时收到人物框上沿）

  // 字号基准
  // 竖屏在手机上按全宽观看：正文/标题/大字统一放大（仍受 fit() 按版心宽度约束）
  const PS = PORTRAIT ? { body: 1.28, title: 1.15, hero: 1.25 } : { body: 1.1, title: 1.05, hero: 1.08 };
  const BS = R(TY.bodyPx ?? 0.03, MIN) * PS.body;   // 正文
  const KS = Math.max(14, R(0.019, MIN));          // kicker
  const HS = Math.max(13, R(0.0155, MIN));         // HUD / foot

  // ---------- 主题感知配色 ----------
  const isDarkHex = c => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(c || '').trim());
    if (!m) return false;
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
  };
  const inkOf = th => (th === 'dark' ? (TH.inkAlt || '#f4f4f2') : (TH.ink || '#111'));
  const mutedOf = th => (th === 'dark' ? (TH.mutedAlt || TH.muted || inkOf(th)) : (TH.muted || inkOf(th)));
  const lineOf = th => (th === 'dark' ? (TH.lineOnDark || 'rgba(255,255,255,.16)') : (TH.line || 'rgba(0,0,0,.14)'));
  const accOf = th => (th === 'dark' ? (TH.accentOnDark || TH.accent) : (TH.accentOnLight || TH.accent));
  const paperOf = th => (th === 'dark' ? 'rgba(255,255,255,.07)' : (isDarkHex(TH.paper) ? 'rgba(255,255,255,.88)' : (TH.paper || '#fbfbf6')));

  // 文字宽度估计：CJK/全角 1em，其余 0.62em（mono 取 0.64）
  const units = (s, mono) => {
    let u = 0;
    for (const ch of String(s ?? '').replace(/\*/g, '')) u += /[⺀-￯]/.test(ch) ? 1 : (mono ? 0.64 : 0.62);
    return u;
  };
  const fit = (size, width, u, lines = 1) => Math.max(10, Math.min(size, (width * lines) / Math.max(u, 1) * 0.97));

  const PERSON = S.person || { mode: 'small' };
  // 人物框：style.json 为准；口播素材经 person_fit.py 适配后若加高了人物框，以 presenterFit 为准（草稿同源）
  const FR = { ...(PERSON.frame || {}) };
  Object.entries(D.presenterFit?.modes || {}).forEach(([m, v]) => { if (v && v.frame) FR[m] = v.frame; });
  function frameGeo(mode) {
    if (!mode || mode === 'none') return null;
    if (mode === 'split') {
      const f = FR.split || {};
      const w = R(f.w ?? 0.86, MIN), h = R(f.h ?? 0.7, MIN), cx = R(f.cx ?? 0.5, W), cy = R(f.cy ?? 0.27, H);
      return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, r: R(f.r ?? 0.014, w) };
    }
    const f = mode === 'card' ? (FR.card || {}) : (FR.small || {});
    const w = R(f.w ?? (mode === 'card' ? 0.30 : 0.19), MIN);
    const h = R(f.h ?? (mode === 'card' ? 0.52 : 0.19), MIN);
    const cx = R(f.cx ?? (mode === 'card' ? 0.815 : 0.85), W);
    const cy = R(f.cy ?? (mode === 'card' ? 0.40 : 0.20), H);
    return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, r: R(f.r ?? (mode === 'card' ? 0.018 : 0.5), w) };
  }
  // 内容右边界：只有当人物框与 [y0,y1] 纵向相交时才让位
  const inPersonArea = (mode, y0 = 0, y1 = H) => {
    const g = frameGeo(mode);
    if (!g) return RT;
    const pad = R(0.03, MIN);
    if (y1 < g.y - pad || y0 > g.y + g.h + pad) return RT;
    return Math.min(RT, g.x - pad);
  };
  // 人物框横跨画面中线（顶部居中大卡）时，标题与内容整体排到人物框下方
  // 人物框横跨画面中线（顶部居中大卡），或竖屏里人物框在上部（magazine 式右上圆框）时，标题与内容整体排到人物框下方
  const below = mode => {
    const g = frameGeo(mode); if (!g) return 0;
    const spans = Math.abs(g.cx - W * 0.5) < W * 0.12 && g.y < H * 0.3, topPortrait = PORTRAIT && g.y + g.h < H * 0.42;
    return spans || topPortrait ? g.y + g.h + R(0.045, MIN) : 0;
  };
  // 竖屏里人物框在下部：内容安全区收到人物框上沿
  const safeFor = mode => { const g = frameGeo(mode); return g && PORTRAIT && g.y > H * 0.45 ? Math.min(SAFE0, g.y - R(0.04, MIN)) : SAFE0; };
  // 内容块在 [top, SAFE] 里偏上居中（竖屏 38%、横屏 30%），避免上重下空
  const place = (blockH, top) => top + Math.max(0, SAFE - top - blockH) * (PORTRAIT ? 0.38 : 0.30);

  function el(parent, cls, css = {}, html = '') {
    const e = document.createElement('div');
    if (cls) e.className = cls;
    Object.assign(e.style, css);
    if (html) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  const ease = p => (MO.ease === 'linear' ? p : MO.ease === 'inout' ? inout(p) : out3(p));
  function show(e, p, dy = 30, dx = 0) {
    if (!e) return;
    const k = ease(p);
    e.style.opacity = p <= 0 ? 0 : Math.min(1, k * 1.2);
    const kind = MO.in || 'rise';
    const sx = dx || Math.abs(dy) * 1.6;
    if (kind === 'flip') e.style.transform = `perspective(900px) rotateX(${(1 - k) * -22}deg) translateY(${(1 - k) * dy * .3}px)`;
    else if (kind === 'pop') e.style.transform = `scale(${0.92 + 0.08 * k})`;
    else if (kind === 'wipe') { e.style.transform = `translateX(${(1 - k) * -sx}px)`; e.style.clipPath = `inset(0 ${((1 - k) * 100).toFixed(2)}% 0 0)`; }
    else if (kind === 'settle') e.style.transform = `translateY(${(1 - k) * dy}px) scale(${0.985 + 0.015 * k})`;
    else e.style.transform = `translate(${(1 - k) * dx}px, ${(1 - k) * dy}px)`;
  }

  // ---------- 底纹扩展（v3，2026-11-10）：静态 SVG，只由 style 令牌与 theme 决定（纯函数；按 theme 缓存） ----------
  // 颜色：c.ink / c.acc / c.d[0..3]（theme.deco，可缺省）；尺寸单位 u = 短边/1080。装饰只放在四角与边缘，版心留白
  const U = MIN / 1080;
  const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const f1 = v => (Math.round(v * 10) / 10);
  const DECO = {
    blueprint: c => {
      const s = 54 * U, m = s * 5; let o = `<defs><pattern id='a' width='${s}' height='${s}' patternUnits='userSpaceOnUse'><path d='M${s} 0H0V${s}' fill='none' stroke='${c.ink}' stroke-opacity='.05'/></pattern>` +
        `<pattern id='b' width='${m}' height='${m}' patternUnits='userSpaceOnUse'><path d='M${m} 0H0V${m}' fill='none' stroke='${c.ink}' stroke-opacity='.10'/></pattern></defs><rect width='${W}' height='${H}' fill='url(#a)'/><rect width='${W}' height='${H}' fill='url(#b)'/>`;
      const k = 26 * U, e = 34 * U;
      [[e, e], [W - e, e], [e, H - e], [W - e, H - e]].forEach(([x, y]) => { o += `<path d='M${x - k} ${y}H${x + k}M${x} ${y - k}V${y + k}' stroke='${c.acc}' stroke-opacity='.7' stroke-width='${1.5 * U}'/><circle cx='${x}' cy='${y}' r='${7 * U}' fill='none' stroke='${c.acc}' stroke-opacity='.7'/>`; });
      for (let i = 0; i <= 24; i++) { const x = e + k * 2 + i * (W - 2 * e - 4 * k) / 24; o += `<path d='M${f1(x)} ${H - e}v${-(i % 6 ? 6 : 14) * U}' stroke='${c.ink}' stroke-opacity='.28'/>`; }
      return o;
    },
    ruler: c => {
      let o = `<defs><radialGradient id='g' cx='.5' cy='.42' r='.6'><stop offset='0' stop-color='${c.d[0] || c.acc}' stop-opacity='.20'/><stop offset='1' stop-color='${c.d[0] || c.acc}' stop-opacity='0'/></radialGradient></defs><rect width='${W}' height='${H}' fill='url(#g)'/>`;
      const y = H - 30 * U; o += `<path d='M${40 * U} ${y}H${W - 40 * U}' stroke='${c.ink}' stroke-opacity='.22'/>`;
      for (let i = 0; i <= 60; i++) { const x = 40 * U + i * (W - 80 * U) / 60; o += `<path d='M${f1(x)} ${y}v${-(i % 10 ? 5 : 13) * U}' stroke='${c.ink}' stroke-opacity='${i % 10 ? .16 : .4}'/>`; }
      const r = rng(7); for (let i = 0; i < 22; i++) { const yy = r() * H, l = (20 + r() * 60) * U, left = r() < .5; o += `<path d='M${left ? 0 : W - l} ${f1(yy)}h${f1(l)}' stroke='${c.ink}' stroke-opacity='.10'/>`; }
      return o;
    },
    chalk: c => {
      const r = rng(11); let o = `<defs><filter id='s'><feGaussianBlur stdDeviation='${40 * U}'/></filter></defs><g filter='url(#s)'>`;
      for (let i = 0; i < 9; i++) o += `<ellipse cx='${f1(r() * W)}' cy='${f1(r() * H)}' rx='${f1((180 + r() * 260) * U)}' ry='${f1((50 + r() * 90) * U)}' fill='#fff' fill-opacity='${f1(.3 + r() * .3) / 10}' transform='rotate(${f1(-12 + r() * 24)} ${W / 2} ${H / 2})'/>`;
      o += `</g>`;
      const b = 14 * U, wood = c.d[0] || '#8a6a45';
      o += `<rect x='${b / 2}' y='${b / 2}' width='${W - b}' height='${H - b}' fill='none' stroke='${wood}' stroke-width='${b}'/><rect x='${b}' y='${b}' width='${W - 2 * b}' height='${H - 2 * b}' fill='none' stroke='#000' stroke-opacity='.35' stroke-width='${2 * U}'/>`;
      [[.42, '#f4f1e6'], [.47, c.d[1] || '#e9c75a'], [.52, c.d[2] || '#8fc3dd']].forEach(([x, col]) => { o += `<rect x='${x * W}' y='${H - b * 1.25}' width='${44 * U}' height='${7 * U}' rx='${3 * U}' fill='${col}'/>`; });
      return o;
    },
    pixel: c => {
      const p = 6 * U, r = rng(23); let o = '';
      for (let i = 0; i < 130; i++) { const x = Math.floor(r() * W / p) * p, y = Math.floor(r() * H * .62 / p) * p, k = r(); o += `<rect x='${f1(x)}' y='${f1(y)}' width='${f1(k > .9 ? p * 1.5 : p * .7)}' height='${f1(k > .9 ? p * 1.5 : p * .7)}' fill='${k > .8 ? (c.d[1] || c.acc) : c.ink}' fill-opacity='${f1(.12 + k * .3)}'/>`; }
      const band = [c.d[0] || c.acc, c.d[1] || c.acc, c.d[2] || c.acc]; const bh = 22 * U;
      band.forEach((col, i) => { o += `<rect x='0' y='${H - (3 - i) * bh}' width='${W}' height='${bh}' fill='${col}' fill-opacity='${.10 + i * .07}'/>`; });
      let x = 0; while (x < W) { const w = (5 + Math.floor(r() * 9)) * p * 2, h = (4 + Math.floor(r() * 14)) * p * 2;
        o += `<rect x='${f1(x)}' y='${f1(H - h)}' width='${f1(w - p)}' height='${f1(h)}' fill='${c.bg}'/><rect x='${f1(x)}' y='${f1(H - h)}' width='${f1(w - p)}' height='${f1(h)}' fill='${c.ink}' fill-opacity='.07'/>`;
        for (let wy = H - h + p * 2; wy < H - p * 2; wy += p * 3) for (let wx = x + p * 1.5; wx < x + w - p * 3; wx += p * 3) if (r() < .32) o += `<rect x='${f1(wx)}' y='${f1(wy)}' width='${f1(p)}' height='${f1(p)}' fill='${c.d[1] || c.acc}' fill-opacity='.75'/>`;
        x += w; }
      return o;
    },
    halftone: c => {
      const s = 30 * U, fx = W * .98, fy = H * 1.02, fx2 = -W * .02, fy2 = -H * .04, R1 = MIN * .78, R2 = MIN * .5; let o = '';
      for (let j = 0, y = 0; y < H + s; y += s * .866, j++) for (let x = (j % 2) * s / 2; x < W + s; x += s) {
        const d1 = Math.hypot(x - fx, y - fy) / R1, d2 = Math.hypot(x - fx2, y - fy2) / R2;
        const k = Math.max(0, 1 - d1), k2 = Math.max(0, 1 - d2);
        if (k > .04) o += `<circle cx='${f1(x)}' cy='${f1(y)}' r='${f1(s * .52 * Math.pow(k, .8))}' fill='${c.acc}' fill-opacity='.55'/>`;
        else if (k2 > .04) o += `<circle cx='${f1(x)}' cy='${f1(y)}' r='${f1(s * .5 * Math.pow(k2, .8))}' fill='${c.d[0] || c.ink}' fill-opacity='.4'/>`;
      }
      return o;
    },
    scan: c => {
      const r = rng(31), s = 5 * U; let o = `<defs><pattern id='a' width='${s}' height='${s}' patternUnits='userSpaceOnUse'><rect width='${s}' height='${1.4 * U}' fill='${c.ink}' fill-opacity='.07'/></pattern>` +
        `<radialGradient id='v' cx='.5' cy='.5' r='.75'><stop offset='.55' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='${c.dark ? .55 : .14}'/></radialGradient></defs>`;
      for (let i = 0; i < 9; i++) { const y = r() * H, h = (4 + r() * 22) * U, x = r() < .5 ? 0 : W * (.55 + r() * .3), w = W * (.12 + r() * .3), dx = (6 + r() * 14) * U;
        o += `<rect x='${f1(x - dx)}' y='${f1(y)}' width='${f1(w)}' height='${f1(h)}' fill='${c.d[0] || '#35e0ff'}' fill-opacity='.22'/><rect x='${f1(x + dx)}' y='${f1(y + 3 * U)}' width='${f1(w)}' height='${f1(h)}' fill='${c.d[1] || '#ff3d7f'}' fill-opacity='.20'/>`; }
      o += `<rect width='${W}' height='${H}' fill='url(#a)'/><rect width='${W}' height='${H}' fill='url(#v)'/>`;
      const e = 30 * U, k = 34 * U;
      [[e, e, 1, 1], [W - e, e, -1, 1], [e, H - e, 1, -1], [W - e, H - e, -1, -1]].forEach(([x, y, sx, sy]) => { o += `<path d='M${x + sx * k} ${y}H${x}V${y + sy * k}' fill='none' stroke='${c.ink}' stroke-opacity='.55' stroke-width='${2 * U}'/>`; });
      return o;
    },
    frame: c => {
      const a = 20 * U, b = 30 * U; let o = `<rect x='${a}' y='${a}' width='${W - 2 * a}' height='${H - 2 * a}' fill='none' stroke='${c.acc}' stroke-opacity='.75' stroke-width='${1.6 * U}'/><rect x='${b}' y='${b}' width='${W - 2 * b}' height='${H - 2 * b}' fill='none' stroke='${c.ink}' stroke-opacity='.22'/>`;
      [[b, b], [W - b, b], [b, H - b], [W - b, H - b]].forEach(([x, y], i) => { o += `<rect x='${x - 6 * U}' y='${y - 6 * U}' width='${12 * U}' height='${12 * U}' fill='${[c.acc, c.d[0] || c.acc, c.d[1] || c.acc, c.acc][i]}' transform='rotate(45 ${x} ${y})'/>`; });
      o += `<circle cx='${W / 2}' cy='${H - a}' r='${4 * U}' fill='${c.acc}'/>`;
      return o;
    },
    papercut: c => {
      const cols = [c.d[0] || c.acc, c.d[1] || c.acc, c.d[2] || c.acc, c.d[3] || c.acc];
      let o = `<defs><filter id='s' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='${5 * U}' stdDeviation='${7 * U}' flood-color='#000' flood-opacity='.28'/></filter></defs>`;
      cols.forEach((col, i) => { o += `<circle cx='0' cy='${H}' r='${(285 - i * 66) * U}' fill='${col}' filter='url(#s)'/>`; });
      cols.slice().reverse().forEach((col, i) => { o += `<circle cx='${W}' cy='0' r='${(330 - i * 78) * U}' fill='${col}' filter='url(#s)'/>`; });
      let d = `M${W * .42} ${H}`; for (let x = W * .42; x <= W + 60 * U; x += 60 * U) d += `Q${f1(x + 30 * U)} ${f1(H - 58 * U)} ${f1(x + 60 * U)} ${H}`;
      o += `<path d='${d}Z' fill='${cols[1]}' fill-opacity='.9' filter='url(#s)'/>`;
      return o;
    },
    iso: c => {
      const s = 60 * U, h = s * Math.tan(Math.PI / 6); let o = `<defs><pattern id='a' width='${f1(s * 2)}' height='${f1(h * 2)}' patternUnits='userSpaceOnUse'><path d='M0 ${f1(h)}L${f1(s)} 0L${f1(s * 2)} ${f1(h)}L${f1(s)} ${f1(h * 2)}Z' fill='none' stroke='${c.ink}' stroke-opacity='.07'/></pattern></defs><rect width='${W}' height='${H}' fill='url(#a)'/>`;
      const cube = (x, y, k, col) => { const a = s * k, b = h * k; return `<path d='M${f1(x)} ${f1(y)}l${f1(a)} ${f1(-b)}l${f1(a)} ${f1(b)}l${f1(-a)} ${f1(b)}Z' fill='${col}' fill-opacity='.55'/><path d='M${f1(x)} ${f1(y)}v${f1(a * 1.1)}l${f1(a)} ${f1(b)}v${f1(-a * 1.1)}Z' fill='${col}' fill-opacity='.85'/><path d='M${f1(x + 2 * a)} ${f1(y)}v${f1(a * 1.1)}l${f1(-a)} ${f1(b)}v${f1(-a * 1.1)}Z' fill='${col}'/>`; };
      o += cube(30 * U, H - 250 * U, 1.5, c.d[0] || c.acc) + cube(190 * U, H - 150 * U, 1, c.d[1] || c.acc) + cube(W - 150 * U, 60 * U, .8, c.d[2] || c.acc);
      return o;
    },
    metro: c => {
      const cols = [c.d[0] || c.acc, c.d[1] || c.acc, c.d[2] || c.acc], w = 9 * U; let o = '';
      cols.forEach((col, i) => { const y = H - (34 + i * 20) * U, k = (120 + i * 20) * U, x1 = W * (.20 + i * .05);
        o += `<path d='M0 ${f1(y - k)}H${f1(x1)}l${f1(k)} ${f1(k)}H${W}' fill='none' stroke='${col}' stroke-width='${w}' stroke-linejoin='round'/>`;
        [.06 + i * .04, .5 + i * .06, .84 - i * .05].forEach((t, j) => { const x = W * t, yy = x < x1 ? y - k : y; o += `<circle cx='${f1(x)}' cy='${f1(yy)}' r='${8 * U}' fill='${c.bg}' stroke='${j === 1 ? c.ink : col}' stroke-width='${3 * U}'/>`; }); });
      o += `<path d='M${W - 300 * U} 0v${70 * U}l${70 * U} ${70 * U}H${W}' fill='none' stroke='${cols[0]}' stroke-width='${w}' stroke-linejoin='round' stroke-opacity='.9'/><circle cx='${W - 300 * U}' cy='${48 * U}' r='${8 * U}' fill='${c.bg}' stroke='${cols[0]}' stroke-width='${3 * U}'/>`;
      return o;
    },
    wall: c => {
      const gold = c.d[0] || c.acc, y = H - 44 * U;
      let o = `<defs><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${f1(.9 / U) / 1}' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0'/></filter>` +
        `<radialGradient id='v' cx='.5' cy='.4' r='.8'><stop offset='.4' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.38'/></radialGradient></defs><rect width='${W}' height='${H}' filter='url(#n)'/><rect width='${W}' height='${H}' fill='url(#v)'/>`;
      o += `<path d='M${40 * U} ${y}H${W - 40 * U}' stroke='${gold}' stroke-width='${2 * U}'/>`;
      for (let i = 0; i < 7; i++) { const x = 40 * U + (i + .5) * (W - 80 * U) / 7; o += `<path d='M${f1(x)} ${y}v${-16 * U}' stroke='${gold}' stroke-width='${1.5 * U}'/><circle cx='${f1(x)}' cy='${y}' r='${4 * U}' fill='${gold}'/>`; }
      o += `<path d='M${40 * U} ${38 * U}H${W - 40 * U}' stroke='${gold}' stroke-opacity='.5'/>`;
      return o;
    },
    clay: c => {
      const cols = [c.d[0] || c.acc, c.d[1] || c.acc, c.d[2] || c.acc]; let o = `<defs>`;
      cols.forEach((col, i) => { o += `<radialGradient id='g${i}' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#fff' stop-opacity='.9'/><stop offset='.35' stop-color='${col}'/><stop offset='1' stop-color='${col}'/></radialGradient>`; });
      o += `<filter id='s' x='-30%' y='-30%' width='160%' height='180%'><feDropShadow dx='0' dy='${16 * U}' stdDeviation='${16 * U}' flood-color='#5a3a2a' flood-opacity='.22'/></filter></defs>`;
      [[70, H / U - 90, 150, 0], [250, H / U - 40, 90, 1], [W / U - 120, 70, 110, 2], [W / U - 290, 20, 60, 0], [40, 90, 46, 1]].forEach(([x, y, r, i]) => { o += `<ellipse cx='${x * U}' cy='${y * U}' rx='${r * U}' ry='${r * .86 * U}' fill='url(#g${i})' filter='url(#s)'/>`; });
      return o;
    },
    kaleido: c => {
      const cx = W / 2, cy = H / 2, cols = [c.acc, c.d[0] || c.acc, c.d[1] || c.acc]; let o = '';
      [[MIN * 1.25, 12, .07], [MIN * .95, 12, .08], [MIN * .62, 12, .09]].forEach(([r, n, op], k) => { for (let i = 0; i < n; i++) { const a = (i / n) * 360 + k * 15;
        o += `<path d='M${cx} ${cy}Q${f1(cx + r * .22)} ${f1(cy - r * .5)} ${cx} ${f1(cy - r)}Q${f1(cx - r * .22)} ${f1(cy - r * .5)} ${cx} ${cy}Z' fill='${cols[k]}' fill-opacity='${op}' transform='rotate(${a} ${cx} ${cy})'/>`; } });
      o += `<circle cx='${cx}' cy='${cy}' r='${MIN * .49}' fill='none' stroke='${c.ink}' stroke-opacity='.12'/><circle cx='${cx}' cy='${cy}' r='${MIN * .66}' fill='none' stroke='${c.ink}' stroke-opacity='.07'/>`;
      return o;
    },
    mosaic: c => {
      const s = 60 * U, r = rng(47), cols = [c.acc, c.d[0] || c.acc, c.d[1] || c.ink, c.ink]; let o = '';
      for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { const k = r(), edge = Math.max(Math.abs(x + s / 2 - W / 2) / (W / 2), Math.abs(y + s / 2 - H / 2) / (H / 2));
        if (k < .62) o += `<rect x='${f1(x + 2 * U)}' y='${f1(y + 2 * U)}' width='${f1(s - 4 * U)}' height='${f1(s - 4 * U)}' rx='${3 * U}' fill='${cols[Math.floor(r() * 4)]}' fill-opacity='${f1((.03 + k * .1) * (.35 + edge * edge * 1.6) * 10) / 10}'/>`; }
      return o;
    },
    brush: c => {
      const r = rng(59), cols = [c.acc, c.d[0] || c.acc, c.d[1] || c.acc, c.d[2] || c.ink, c.d[3] || c.ink]; let o = '';
      const stroke = (x, y, a) => { const l = (30 + r() * 42) * U, t = (11 + r() * 8) * U; return `<rect x='${f1(x - l / 2)}' y='${f1(y - t / 2)}' width='${f1(l)}' height='${f1(t)}' rx='${f1(t / 2)}' fill='${cols[Math.floor(r() * cols.length)]}' transform='rotate(${f1(a)} ${f1(x)} ${f1(y)})'/>`; };
      for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H * .085; if (r() > Math.pow(1 - x / W, 1.4) * 1.1) continue; o += stroke(x, y, 20 + (r() - .5) * 50); }
      for (let i = 0; i < 260; i++) { const x = W * (.885 + r() * .13), y = H * (.80 + r() * .22); if (r() > Math.min(1, (x / W - .885) * 7) * Math.min(1, (y / H - .8) * 6)) continue; o += stroke(x, y, 210 + (r() - .5) * 50); }
      return o;
    },
    collage: c => {
      const A = c.acc, B = c.d[0] || c.acc, Y = c.d[1] || c.acc, K = c.d[2] || c.ink, u = U;
      return `<path d='M${-30 * u} ${H}a${125 * u} ${125 * u} 0 0 1 ${250 * u} 0Z' fill='${B}'/><circle cx='${200 * u}' cy='${H - 150 * u}' r='${30 * u}' fill='${K}'/>` +
        `<rect x='${12 * u}' y='${H - 230 * u}' width='${26 * u}' height='${110 * u}' rx='${13 * u}' fill='${Y}'/><path d='M${60 * u} ${H - 10 * u}L${235 * u} ${H - 190 * u}' stroke='${K}' stroke-width='${7 * u}'/>` +
        `<path d='M${W - 250 * u} 0a${190 * u} ${190 * u} 0 0 0 ${190 * u} ${190 * u}V0Z' fill='${A}' transform='translate(${60 * u} 0)'/><circle cx='${W - 300 * u}' cy='${56 * u}' r='${40 * u}' fill='${Y}'/>` +
        `<path d='M${40 * u} ${44 * u}h${56 * u}' stroke='${K}' stroke-width='${2 * u}'/>`;
    },
    scroll: c => {
      const band = c.d[0] || '#3b4a4a', gold = c.d[1] || '#b9a26a', bh = 30 * U, r = rng(71);
      let o = `<defs><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${.006 / U}' numOctaves='3' seed='9'/><feColorMatrix values='0 0 0 0 .4  0 0 0 0 .33  0 0 0 0 .2  0 0 0 .55 -.16'/></filter></defs><rect width='${W}' height='${H}' filter='url(#n)'/>`;
      o += `<rect width='${W}' height='${bh}' fill='${band}'/><rect y='${H - bh}' width='${W}' height='${bh}' fill='${band}'/><path d='M0 ${bh}H${W}M0 ${H - bh}H${W}' stroke='${gold}' stroke-width='${2.5 * U}'/>`;
      let y = H - bh - 46 * U, d = `M${W * .05} ${f1(y - 150 * U)}C${W * .07} ${f1(y - 10 * U)} ${W * .12} ${f1(y)} ${W * .2} ${f1(y)}`;
      for (let x = W * .2; x < W * .98; x += W * .06) { y += (r() - .5) * 8 * U; d += `S${f1(x + W * .03)} ${f1(y + (r() - .5) * 10 * U)} ${f1(x + W * .06)} ${f1(y)}`; }
      o += `<path d='${d}' fill='none' stroke='${c.ink}' stroke-opacity='.8' stroke-width='${2.2 * U}' stroke-linecap='round'/>`;
      return o;
    },
    gallery: c => {
      const hy = H * .6; let o = `<defs><linearGradient id='f' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.07'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>` +
        `<radialGradient id='l' cx='.5' cy='.2' r='.7'><stop offset='0' stop-color='#fff' stop-opacity='.09'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs><rect width='${W}' height='${hy}' fill='url(#l)'/><rect y='${hy}' width='${W}' height='${H - hy}' fill='url(#f)'/>`;
      for (let i = -8; i <= 8; i++) o += `<path d='M${W / 2 + i * 40 * U} ${hy}L${f1(W / 2 + i * 330 * U)} ${H}' stroke='${c.ink}' stroke-opacity='.06'/>`;
      [.0, .12, .3, .58].forEach(k => { o += `<path d='M0 ${f1(hy + (H - hy) * k)}H${W}' stroke='${c.ink}' stroke-opacity='.06'/>`; });
      o += `<path d='M${W * .4} ${40 * U}H${W * .6}' stroke='${c.ink}' stroke-opacity='.4' stroke-width='${3 * U}' stroke-linecap='round'/>`;
      return o;
    },
    riso: c => {
      const A = c.acc, B = c.d[0] || c.ink, s = 13 * U; let o = `<defs><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${1.1 / U}' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 .3  0 0 0 0 .25  0 0 0 0 .2  0 0 0 .16 0'/></filter>` +
        `<pattern id='a' width='${s}' height='${s}' patternUnits='userSpaceOnUse'><circle cx='${s / 2}' cy='${s / 2}' r='${s * .32}' fill='${A}'/></pattern><pattern id='b' width='${s}' height='${s}' patternUnits='userSpaceOnUse' patternTransform='rotate(30)'><circle cx='${s / 2}' cy='${s / 2}' r='${s * .3}' fill='${B}'/></pattern></defs>`;
      o += `<circle cx='${W - 60 * U}' cy='${H - 40 * U}' r='${210 * U}' fill='url(#a)'/><circle cx='${W - 250 * U}' cy='${H + 10 * U}' r='${150 * U}' fill='url(#b)'/><circle cx='${10 * U}' cy='${0}' r='${92 * U}' fill='url(#b)'/><circle cx='${120 * U}' cy='${-14 * U}' r='${54 * U}' fill='url(#a)'/>`;
      const e = 26 * U, k = 16 * U;
      [[e, H - e], [W - e, e]].forEach(([x, y]) => { o += `<path d='M${x - k} ${y}H${x + k}M${x} ${y - k}V${y + k}' stroke='${B}' stroke-width='${1.5 * U}'/><circle cx='${x}' cy='${y}' r='${6 * U}' fill='none' stroke='${A}' stroke-width='${1.5 * U}'/>`; });
      return o + `<rect width='${W}' height='${H}' filter='url(#n)'/>`;
    },
    notes: c => {
      const s = 34 * U, tape = c.d[0] || c.acc, hl = c.d[1] || c.acc;
      let o = `<defs><pattern id='a' width='${s}' height='${s}' patternUnits='userSpaceOnUse'><circle cx='${s / 2}' cy='${s / 2}' r='${1.6 * U}' fill='${c.ink}' fill-opacity='.2'/></pattern><pattern id='t' width='${14 * U}' height='${14 * U}' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='${7 * U}' height='${14 * U}' fill='#fff' fill-opacity='.35'/></pattern></defs><rect width='${W}' height='${H}' fill='url(#a)'/>`;
      o += `<g transform='rotate(-7 ${60 * U} ${40 * U})'><rect x='${-30 * U}' y='${26 * U}' width='${190 * U}' height='${34 * U}' fill='${tape}' fill-opacity='.85'/><rect x='${-30 * U}' y='${26 * U}' width='${190 * U}' height='${34 * U}' fill='url(#t)'/></g>`;
      o += `<g transform='rotate(5 ${W - 100 * U} ${H - 50 * U})'><rect x='${W - 210 * U}' y='${H - 62 * U}' width='${230 * U}' height='${30 * U}' fill='${hl}' fill-opacity='.8'/><rect x='${W - 210 * U}' y='${H - 62 * U}' width='${230 * U}' height='${30 * U}' fill='url(#t)'/></g>`;
      o += `<path d='M${40 * U} ${H - 120 * U}c${40 * U} ${-50 * U} ${90 * U} ${-40 * U} ${80 * U} ${10 * U}s${-70 * U} ${30 * U} ${-20 * U} ${-20 * U}s${110 * U} ${-20 * U} ${150 * U} ${40 * U}' fill='none' stroke='${c.ink}' stroke-opacity='.55' stroke-width='${2.4 * U}' stroke-linecap='round'/><path d='M${236 * U} ${H - 106 * U}l${16 * U} ${18 * U}l${-22 * U} ${4 * U}' fill='none' stroke='${c.ink}' stroke-opacity='.55' stroke-width='${2.4 * U}' stroke-linecap='round' stroke-linejoin='round'/>`;
      return o;
    },
    mindmap: c => {
      const A = c.acc, B = c.d[0] || c.acc, G = c.d[1] || c.acc; let o = '';
      const br = (x0, y0, x1, y1, col, w) => `<path d='M${f1(x0)} ${f1(y0)}C${f1(x0 + (x1 - x0) * .5)} ${f1(y0)} ${f1(x0 + (x1 - x0) * .5)} ${f1(y1)} ${f1(x1)} ${f1(y1)}' fill='none' stroke='${col}' stroke-opacity='.55' stroke-width='${w * U}' stroke-linecap='round'/><circle cx='${f1(x1)}' cy='${f1(y1)}' r='${(w + 5) * U}' fill='${col}' fill-opacity='.8'/>`;
      const ox = 50 * U, oy = H - 60 * U;
      o += br(ox, oy, ox + 250 * U, oy - 150 * U, A, 7) + br(ox, oy, ox + 330 * U, oy + 10 * U, B, 6) + br(ox + 250 * U, oy - 150 * U, ox + 430 * U, oy - 220 * U, A, 4) + br(ox + 250 * U, oy - 150 * U, ox + 450 * U, oy - 110 * U, G, 4) + br(ox + 330 * U, oy + 10 * U, ox + 520 * U, oy - 30 * U, B, 3.5);
      o += `<circle cx='${ox}' cy='${oy}' r='${22 * U}' fill='${A}'/>`;
      const tx = W - 40 * U, ty = 50 * U;
      o += br(tx, ty, tx - 220 * U, ty + 70 * U, G, 6) + br(tx, ty, tx - 300 * U, ty - 6 * U, B, 5) + br(tx - 220 * U, ty + 70 * U, tx - 380 * U, ty + 110 * U, G, 3.5) + `<circle cx='${tx}' cy='${ty}' r='${16 * U}' fill='${G}'/>`;
      return o;
    },
    neon: c => {
      const cols = [c.d[0] || c.acc, c.d[1] || c.acc, c.d[2] || c.acc]; let o = `<defs><filter id='g' x='-10%' y='-200%' width='120%' height='500%'><feGaussianBlur stdDeviation='${7 * U}' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>` +
        `<radialGradient id='v' cx='.5' cy='.45' r='.8'><stop offset='0' stop-color='${cols[0]}' stop-opacity='.10'/><stop offset='1' stop-color='#000' stop-opacity='.35'/></radialGradient></defs><rect width='${W}' height='${H}' fill='url(#v)'/>`;
      cols.forEach((col, i) => { const y = H - (62 - i * 18) * U, amp = (16 - i * 3) * U, wl = (230 + i * 70) * U; let d = `M0 ${f1(y)}`;
        for (let x = 0; x < W; x += wl) d += `q${f1(wl / 4)} ${f1(-amp * 2)} ${f1(wl / 2)} 0t${f1(wl / 2)} 0`;
        o += `<path d='${d}' fill='none' stroke='${col}' stroke-width='${2.6 * U}' stroke-opacity='.9' filter='url(#g)'/>`; });
      o += `<path d='M${40 * U} ${46 * U}H${260 * U}' stroke='${cols[0]}' stroke-width='${2.4 * U}' filter='url(#g)'/><path d='M${W - 260 * U} ${46 * U}H${W - 40 * U}' stroke='${cols[1]}' stroke-width='${2.4 * U}' filter='url(#g)'/>`;
      return o;
    },
    cards: c => {
      const r = rng(83); let o = `<defs><filter id='s' x='-30%' y='-30%' width='160%' height='170%'><feDropShadow dx='0' dy='${8 * U}' stdDeviation='${10 * U}' flood-color='#000' flood-opacity='.16'/></filter></defs>`;
      [[-30, H / U - 150, 210, 124, -9, 0], [150, H / U - 70, 170, 100, 6, 1], [W / U - 200, -30, 220, 130, 8, 1], [W / U - 370, 24, 130, 78, -6, 0], [20, 30, 120, 72, 5, 1]].forEach(([x, y, w, h, a, k]) => {
        const col = k ? (c.dark ? '#1c1f27' : '#ffffff') : (c.d[0] || '#16171c');
        o += `<g transform='rotate(${a} ${(x + w / 2) * U} ${(y + h / 2) * U})' filter='url(#s)'><rect x='${x * U}' y='${y * U}' width='${w * U}' height='${h * U}' rx='${8 * U}' fill='${col}'/><rect x='${(x + 12) * U}' y='${(y + 14) * U}' width='${w * .45 * U}' height='${7 * U}' rx='${3 * U}' fill='${c.acc}'/><rect x='${(x + 12) * U}' y='${(y + 30) * U}' width='${w * .7 * U}' height='${5 * U}' rx='${2 * U}' fill='${k ? c.ink : '#fff'}' fill-opacity='.22'/><rect x='${(x + 12) * U}' y='${(y + 42) * U}' width='${w * .55 * U}' height='${5 * U}' rx='${2 * U}' fill='${k ? c.ink : '#fff'}' fill-opacity='.14'/></g>`; });
      return o;
    },
    swiss: c => {
      const m = 70 * U, n = 12, g = (W - 2 * m) / n; let o = '';
      for (let i = 0; i <= n; i++) o += `<path d='M${f1(m + i * g)} 0V${H}' stroke='${c.ink}' stroke-opacity='.045'/>`;
      o += `<path d='M${m} ${62 * U}H${W - m}' stroke='${c.ink}' stroke-width='${5 * U}'/><path d='M${m} ${H - 52 * U}H${W - m}' stroke='${c.ink}' stroke-opacity='.5' stroke-width='${1.2 * U}'/><rect x='${m}' y='${H - 52 * U}' width='${g * 2}' height='${8 * U}' fill='${c.acc}'/>`;
      return o;
    },
    blocks: c => {
      const A = c.acc, B = c.d[0] || c.acc;
      return `<rect x='0' y='${H - 16 * U}' width='${W * .34}' height='${16 * U}' fill='${A}'/><rect x='${W * .34}' y='${H - 16 * U}' width='${W * .12}' height='${16 * U}' fill='${B}'/><rect x='${W - 26 * U}' y='0' width='${26 * U}' height='${H * .3}' fill='${A}'/><circle cx='${60 * U}' cy='${60 * U}' r='${9 * U}' fill='${B}'/><path d='M${84 * U} ${60 * U}h${90 * U}' stroke='${c.ink}' stroke-opacity='.35' stroke-width='${2 * U}'/>`;
    },
  };
  const _decoCache = {};
  const decoUrl = (g, c) => {
    const key = g + '|' + c.theme;
    if (!_decoCache[key]) _decoCache[key] = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>${DECO[g](c)}</svg>`)}")`;
    return _decoCache[key];
  };

  // ---------- 背景 ----------
  function background(root, theme) {
    const dark = theme === 'dark';
    const bg = dark ? (TH.bgAlt || TH.bg) : TH.bg;
    const ink = inkOf(theme), line = lineOf(theme);
    root.style.background = bg;
    root.style.color = ink;
    const g = CH.grid;
    if (g === 'hairline') {
      const step = R(0.045, MIN);
      root.style.backgroundImage =
        `linear-gradient(to right, ${line} 1px, transparent 1px),linear-gradient(to bottom, ${line} 1px, transparent 1px)`;
      root.style.backgroundSize = `${step}px ${step}px`;
      root.style.backgroundPosition = `${L % step}px 0`;
    } else if (g === 'dot') {
      const step = R(0.035, MIN);
      root.style.backgroundImage = `radial-gradient(${line} 1.4px, transparent 1.6px)`;
      root.style.backgroundSize = `${step}px ${step}px`;
    } else if (g === 'paper') {
      root.style.backgroundImage = dark
        ? `repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px ${R(0.006, MIN)}px)`
        : `radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,.5), transparent 60%),` +
          `repeating-linear-gradient(0deg, rgba(0,0,0,.028) 0 1px, transparent 1px ${R(0.006, MIN)}px)`;
    } else if (g === 'gradient') {
      const glow = dark ? (TH.bg2 || 'rgba(255,255,255,.07)') : (TH.tagBg || 'rgba(0,0,0,.04)');
      root.style.backgroundImage = `radial-gradient(120% 70% at 50% 0%, ${glow} 0%, transparent 65%)`;
    } else if (DECO[g]) {
      root.style.backgroundImage = decoUrl(g, { theme, dark, bg, ink, acc: accOf(theme), d: (dark ? TH.decoOnDark : TH.deco) || TH.deco || [] });
      root.style.backgroundSize = `${W}px ${H}px`;
      root.style.backgroundRepeat = 'no-repeat';
    }
    return ink;
  }

  // ---------- HUD ----------
  function hud(root, ctx, theme) {
    const ink = inkOf(theme), muted = mutedOf(theme), line = lineOf(theme);
    const kind = CH.kind || 'none';
    const t = ctx.t;
    const box = [];
    const base = { fontSize: px(HS), letterSpacing: px(R(0.0015, MIN)), whiteSpace: 'nowrap' };
    if (kind === 'corner' || kind === 'both') {
      const y = R(0.028, H);
      box.push(el(root, 'abs hud mono', { ...base, left: px(L), top: px(y), color: muted }, esc(CH.label || S.title || '')));
      box.push(el(root, 'abs hud mono', { ...base, left: '50%', transform: 'translateX(-50%)', top: px(y), color: ink, opacity: 0.9 }, fmt(t)));
      box.push(el(root, 'abs hud mono', { ...base, right: px(L), top: px(y), color: muted, textAlign: 'right' }, `${pad2(ctx.shotNo + 1)} / ${pad2(ctx.shotCount)}`));
    }
    if (kind === 'header' || kind === 'both') {
      const barY = R(0.058, H);
      box.push(el(root, 'abs', { left: px(L), top: px(barY), width: px(RT - L), height: '1px', background: line }));
      box.push(el(root, 'abs mono hud', { ...base, left: px(L), top: px(barY - HS * 1.9), color: muted, letterSpacing: px(R(0.002, MIN)) },
        esc((CH.label || '').toUpperCase())));
      box.push(el(root, 'abs mono hud', { ...base, right: px(L), top: px(barY - HS * 1.9), color: ink }, `${esc(CH.tag || '')} ${fmt(t)}`.trim()));
    }
    if (kind === 'footer') {
      const y = H - R(0.048, H);
      box.push(el(root, 'abs', { left: px(L), top: px(y), width: px(RT - L), height: '1px', background: line }));
      const a = el(root, 'abs mono hud', { ...base, left: px(L), top: px(y + HS * 0.8), color: muted });
      a.textContent = (CH.label || '') + (CH.tag ? `  ·  ${CH.tag}` : '');
      const b = el(root, 'abs mono hud', { ...base, right: px(L), top: px(y + HS * 0.8), color: ink, textAlign: 'right' });
      b.textContent = fmt(t);
      box.push(a, b);
    }
    if (CH.progress) {
      const y = H - R(0.016, H), hh = Math.max(2, R(0.0022, MIN));
      box.push(el(root, 'abs', { left: px(L), top: px(y), width: px(RT - L), height: px(hh), background: line }));
      box.push(el(root, 'abs', { left: px(L), top: px(y), width: px((RT - L) * clamp(t / (D.duration || 1))), height: px(hh), background: accOf(theme) }));
    }
    box.forEach(e => { e.style.opacity = 0; });
    return u => box.forEach((e, i) => { e.style.opacity = Math.min(1, out3(span(u, 0.03 * i, 0.3))); });
  }

  function fmt(t) {
    const s = Math.max(0, Math.floor(t));
    return (CH.timeStyle === 'clock')
      ? `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
      : `00:${pad2(Math.floor(s / 60))}:${pad2(s % 60)}:${pad2(Math.floor((t % 1) * (S.fps || 30)))}`;
  }

  // ---------- 装饰 ----------
  function kickerCss(theme) {
    const st = LK.titleStyle || 'plain';
    const css = { fontSize: px(KS), letterSpacing: px(R(0.003, MIN)), color: accOf(theme), whiteSpace: 'nowrap', lineHeight: 1.3 };
    if (st === 'tagged' || st === 'boxed') {
      css.background = theme === 'dark' ? 'rgba(255,255,255,.09)' : (TH.tagBg || 'rgba(0,0,0,.055)');
      css.padding = `${px(KS * 0.28)} ${px(KS * 0.6)}`;
      if (st === 'boxed') { css.background = accOf(theme); css.color = TH.onAccent || '#fff'; }
    }
    return css;
  }
  function kicker(root, text, x, y, theme) {
    if (!text) return null;
    return el(root, 'abs mono kicker', { left: px(x), top: px(y), ...kickerCss(theme) }, esc(text));
  }
  function bulletMark(root, i, x, y, bs, theme) {
    const k = LK.bullet || 'dot';
    const acc = accOf(theme);
    if (k === 'dot') return el(root, 'abs', { left: px(x), top: px(y + bs * 0.48), width: px(bs * 0.34), height: px(bs * 0.34), borderRadius: '50%', background: acc });
    if (k === 'dash') return el(root, 'abs', { left: px(x), top: px(y + bs * 0.62), width: px(bs * 0.8), height: px(Math.max(2, bs * 0.09)), background: acc });
    const txt = k === 'number' ? pad2(i + 1) : k === 'check' ? '✓' : '→';
    return el(root, 'abs mono mark', { left: px(x), top: px(y + bs * 0.08), height: px(bs * 1.1), fontSize: px(bs * 0.86), lineHeight: px(bs * 1.1), color: acc, justifyContent: 'flex-start' }, txt);
  }
  function panel(root, x, y, w, h, theme) {
    const dark = theme === 'dark';
    const st = LK.panelStyle || 'solid';
    const line = lineOf(theme);
    const css = { left: px(x), top: px(y), width: px(w), height: px(h), borderRadius: px(R(LK.radius ?? 0.012, MIN)) };
    if (st === 'solid') { css.background = dark ? (TH.panelDark || 'rgba(255,255,255,.06)') : (TH.panel || 'rgba(0,0,0,.045)'); }
    else if (st === 'outline') { css.border = `${px(Math.max(1, R(0.0012, MIN)))} solid ${line}`; }
    else if (st === 'paper') {
      css.background = paperOf(theme);
      css.boxShadow = `0 ${px(R(0.008, MIN))} ${px(R(0.022, MIN))} rgba(0,0,0,${dark ? .38 : .10})`;
    } else if (st === 'window') {
      css.background = dark ? 'rgba(10,14,20,.82)' : paperOf(theme);
      css.border = `1px solid ${line}`;
      css.boxShadow = `0 ${px(R(0.01, MIN))} ${px(R(0.03, MIN))} rgba(0,0,0,${dark ? .5 : .12})`;
    } else if (st === 'neon') {
      css.background = dark ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.7)';
      css.border = `${px(Math.max(2, R(0.002, MIN)))} solid ${accOf(theme)}`;
      css.boxShadow = `0 0 ${px(R(0.018, MIN))} ${accOf(theme)}88, inset 0 0 ${px(R(0.012, MIN))} ${accOf(theme)}33`;
    } else if (st === 'hard') {
      css.background = dark ? (TH.panelDark || '#1b1b1f') : paperOf(theme);
      css.border = `${px(Math.max(2, R(0.0028, MIN)))} solid ${inkOf(theme)}`;
      css.boxShadow = `${px(R(0.008, MIN))} ${px(R(0.008, MIN))} 0 ${accOf(theme)}`;
    } else if (st === 'sticker') {
      css.background = dark ? (TH.panelDark || 'rgba(255,255,255,.08)') : (TH.panel || '#fff6c9');
      css.boxShadow = `0 ${px(R(0.006, MIN))} ${px(R(0.014, MIN))} rgba(0,0,0,${dark ? .4 : .14})`;
    } else if (st === 'glass') {
      css.background = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.6)';
      css.border = `1px solid ${line}`;
      css.backdropFilter = 'blur(8px)';
    }
    const p = el(root, 'abs panel', css);
    p.hdr = 0;
    if (st === 'sticker') el(p, 'abs', { left: '50%', top: px(-R(0.011, MIN)), width: px(R(0.085, MIN)), height: px(R(0.022, MIN)), marginLeft: px(-R(0.0425, MIN)), background: accOf(theme), opacity: 0.55 });
    if (st === 'window') {
      const hh = R(0.03, MIN);
      p.hdr = hh;
      el(p, 'abs', { left: '0', top: '0', width: '100%', height: px(hh), borderBottom: `1px solid ${line}` });
      [0, 1, 2].forEach(i => el(p, 'abs', {
        left: px(R(0.013, MIN) + i * R(0.017, MIN)), top: px(hh / 2 - R(0.0045, MIN)),
        width: px(R(0.009, MIN)), height: px(R(0.009, MIN)), borderRadius: '50%',
        background: i === 0 ? accOf(theme) : line,
      }));
    }
    return p;
  }
  const PANEL_HDR = (LK.panelStyle === 'window') ? R(0.03, MIN) : 0;

  // 标题块：kicker + 单行标题（titleStyle 决定下划线/色块/标签）；返回 {draw, bottom}
  function heading(root, P, ctx) {
    const theme = ctx.theme;
    const x = L, top = Math.max(TITLE_Y, below(ctx.mode) + KS * 2.4);
    const size0 = R(TY.titlePx ?? 0.072, MIN) * PS.title;
    const r = inPersonArea(ctx.mode, top - KS * 2.4, top + size0 * 1.3);
    const size = fit(size0, r - x, units(P.title || ''));
    const st = LK.titleStyle || 'plain';
    const k = kicker(root, P.kicker, x, top - KS * 2.4, theme);
    let boxBg = null;
    if (st === 'boxed') boxBg = el(root, 'abs', { left: px(x - R(0.02, MIN)), top: px(top + size * 0.08), width: px(R(0.008, MIN)), height: px(size * 0.92), background: accOf(theme) });
    const t = el(root, 'abs title', {
      left: px(x), top: px(top), fontSize: px(size), fontWeight: TY.weight || 900, whiteSpace: 'nowrap',
      letterSpacing: px(R(TY.tracking ?? -0.02, size)), lineHeight: 1.08, color: inkOf(theme),
    }, hi(P.title || P.line1 || ''));
    const rule = el(root, 'abs', {
      left: px(x), top: px(top + size * 1.2), width: px(Math.min(R(0.16, MIN), units(P.title || '') * size)),
      height: px(Math.max(2, R(0.0045, MIN))), background: accOf(theme), transformOrigin: '0 50%',
    });
    const showRule = LK.underline !== false || st === 'underline';
    if (!showRule) rule.style.display = 'none';
    const bottom = top + size * 1.2 + R(0.01, MIN);
    return {
      bottom,
      draw: u => {
        if (boxBg) { boxBg.style.transformOrigin = '50% 0'; boxBg.style.transform = `scaleY(${out3(span(u, 0, .3))})`; }
        if (k) show(k, out3(span(u, 0, .35)), 12);
        show(t, out3(span(u, .04, .4)), 26);
        if (showRule) rule.style.transform = `scaleX(${inout(span(u, .2, .4))})`;
      },
    };
  }
  // 标题下方的内容起点：取令牌 contentY 与「标题底 + 间距」的较小者，避免标题和内容之间大片空白
  // 人物框加高后标题会下移：内容起点始终在标题之下
  const contentTop = hb => Math.max(hb + R(0.025, MIN), Math.min(CONTENT_Y, hb + R(PORTRAIT ? 0.07 : 0.05, MIN)));

  function foot(root, P, ctx) {
    if (!P.foot) return () => {};
    const f = el(root, 'abs foot mono', {
      left: px(L), top: px(SAFE + R(0.022, H)), fontSize: px(HS), color: mutedOf(ctx.theme), letterSpacing: px(R(0.002, MIN)), whiteSpace: 'nowrap',
    }, esc(P.foot));
    return u => show(f, out3(span(u, .5, .4)), 10);
  }

  // 人物占位剪影（只在动效层预览里出现；草稿里人物视频轨正好盖住）
  function avatar(box, w, h, dark) {
    const m = Math.min(w, h), c = dark ? '#5b6069' : '#9a9ea6';
    el(box, 'abs', { left: px(w / 2 - m * 0.17), top: px(h * 0.5 - m * 0.30), width: px(m * 0.34), height: px(m * 0.34), borderRadius: '50%', background: c });
    el(box, 'abs', { left: px(w / 2 - m * 0.34), top: px(h * 0.5 + m * 0.09), width: px(m * 0.68), height: px(m * 0.6), borderRadius: px(m * 0.34) + ' ' + px(m * 0.34) + ' 0 0', background: c });
  }
  // ---------- 人物框装饰（与草稿生成器的 FRAMES 一致） ----------
  function personFrame(root, mode, theme) {
    const g = frameGeo(mode);
    if (!g) return;
    const dark = theme === 'dark';
    const st = PERSON.style || 'solid';
    const acc = accOf(theme), line = lineOf(theme);
    if (mode === 'card') {
      const frame = el(root, 'abs', {
        left: px(g.x), top: px(g.y), width: px(g.w), height: px(g.h),
        border: `1px solid ${line}`, borderRadius: px(g.r),
        background: dark ? '#2a2d33' : '#c9cbd0', overflow: 'hidden',
        boxShadow: `0 ${px(R(0.012, MIN))} ${px(R(0.035, MIN))} rgba(0,0,0,${dark ? .55 : .22})`,
      });
      avatar(frame, g.w, g.h, dark);
      if (PERSON.label) {
        el(frame, 'abs mono plabel', {
          left: '0', top: '0', width: '100%', height: px(Math.max(HS * 1.8, g.h * 0.061)),
          background: acc, color: TH.onAccent || '#fff',
          fontSize: px(HS), letterSpacing: px(R(0.002, MIN)),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }, esc(PERSON.label));
      }
      if (st === 'duotone' || st === 'sketch') el(root, 'abs', { left: px(g.x - R(0.01, MIN)), top: px(g.y - R(0.01, MIN)), width: px(g.w + R(0.02, MIN)), height: px(g.h + R(0.02, MIN)), border: `${st === 'sketch' ? 2 : 1}px ${st === 'sketch' ? 'dashed' : 'solid'} ${acc}`, borderRadius: px(g.r + R(0.01, MIN)), opacity: 0.6 });
      if (st === 'glow') frame.style.boxShadow = `0 0 ${px(R(0.03, MIN))} ${acc}55`;
    } else if (mode === 'split') {
      const frame = el(root, 'abs', {
        left: px(g.x), top: px(g.y), width: px(g.w), height: px(g.h), borderRadius: px(g.r),
        border: `${px(Math.max(2, R(0.0024, MIN)))} solid ${acc}`, background: dark ? '#2a2d33' : '#c9cbd0', overflow: 'hidden',
      });
      if (st === 'glow') frame.style.boxShadow = `0 0 ${px(R(0.03, MIN))} ${acc}55`;
      el(root, 'abs mono plabel', {
        left: px(g.x + R(0.018, MIN)), top: px(g.y + R(0.018, MIN)), padding: `${px(HS * 0.3)} ${px(HS * 0.7)}`,
        background: acc, color: TH.onAccent || '#fff', fontSize: px(HS), letterSpacing: px(R(0.002, MIN)), whiteSpace: 'nowrap',
      }, esc(PERSON.label || 'LIVE'));
    } else if (mode === 'small') {
      const ring = el(root, 'abs', { left: px(g.x), top: px(g.y), width: px(g.w), height: px(g.h), borderRadius: '50%', overflow: 'hidden',
        background: dark ? '#2a2d33' : '#c9cbd0', boxShadow: `0 ${px(R(0.01, MIN))} ${px(R(0.03, MIN))} rgba(0,0,0,${dark ? .5 : .2})`,
        border: `${px(Math.max(3, R(0.004, MIN)))} ${st === 'sketch' ? 'dashed' : 'solid'} ${PERSON.ring === 'accent' ? acc : (dark ? '#1a1c20' : '#ffffff')}` });
      avatar(ring, g.w, g.h, dark);
      if (st === 'glow') ring.style.boxShadow = `0 0 ${px(R(0.028, MIN))} ${acc}66`;
      if (st === 'duotone') el(root, 'abs', { left: px(g.x - R(0.008, MIN)), top: px(g.y - R(0.008, MIN)), width: px(g.w + R(0.016, MIN)), height: px(g.h + R(0.016, MIN)), borderRadius: '50%', border: `1px solid ${line}` });
    }
  }

  // ---------- 控件 ----------
  const C_ = {};
  // 纵向流式容器：子元素按文档流排布，位置不靠估算
  const flow = (root, x, y, w, gap) => el(root, 'abs', { left: px(x), top: px(y), width: px(w), display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: px(gap) });
  const fl = (parent, css, html, cls = '') => el(parent, cls, { position: 'relative', ...css }, html);

  C_.opener = (root, P, ctx) => {
    const th = ctx.theme;
    const size0 = R(TY.heroPx ?? 0.098, MIN) * PS.hero;
    const lines = [P.line1, P.line2].filter(Boolean);
    let y0 = Math.max(HERO_Y - KS * 2.6, below(ctx.mode));
    const r = inPersonArea(ctx.mode, y0, HERO_Y + size0 * 2.6);
    const size = fit(size0, r - L, Math.max(...lines.map(s => units(s)), 1));
    // 人物在下部、安全区收窄时：整块上移，保证不进安全区下方
    const estH = KS * 2.4 + lines.length * size * 1.12 + (P.sub || P.note ? BS * 2 + size * 0.3 : 0) + size * 0.4;
    y0 = Math.max(R(0.06, H), Math.min(y0, SAFE - estH));
    const box = flow(root, L, y0, r - L, 0);
    const k = P.kicker ? fl(box, { ...kickerCss(th), marginBottom: px(KS * 1.1) }, esc(P.kicker), 'mono kicker') : null;
    const nodes = lines.map((ln, i) => fl(box, {
      fontSize: px(size), fontWeight: TY.weight || 900, lineHeight: TY.heroLh ?? 1.12, whiteSpace: 'nowrap',
      letterSpacing: px(R(TY.tracking ?? -0.02, size)), color: i === 0 ? inkOf(th) : accOf(th),
    }, hi(ln), 'title'));
    const sub = P.sub ? fl(box, { fontSize: px(fit(BS, r - L, units(P.sub))), color: mutedOf(th), marginTop: px(size * 0.32), lineHeight: 1.4 }, hi(P.sub)) : null;
    const F = foot(root, P, ctx);
    return u => {
      show(k, out3(span(u, 0, .35)), 14);
      nodes.forEach((n, i) => show(n, out3(span(u, .06 + i * .12, .42)), 34));
      show(sub, out3(span(u, .3, .4)), 18);
      F(u);
    };
  };

  C_.statement = (root, P, ctx) => {
    const th = ctx.theme;
    const u0 = units(P.text || '');
    // 短句（≤8 字）当节拍字用：放大到开场大字的 1.2 倍（参考 dark-console / blue-method 的节拍大字）
    const size0 = u0 <= 8 ? R(TY.heroPx ?? 0.1, MIN) * PS.hero * 1.2 : R(P.size ?? TY.statementPx ?? 0.082, MIN) * PS.title;
    const est = s => KS * 2.4 + Math.ceil(u0 * s / Math.max(1, RT - L)) * s * 1.18 + (P.source ? HS * 3 : 0);
    let top = place(est(size0), Math.max(TITLE_Y, below(ctx.mode)));
    const r = inPersonArea(ctx.mode, top, top + est(size0));
    const size = fit(size0, r - L, u0, u0 <= 8 ? 1 : 3);   // 短句节拍字只排一行，不拆成「怎么测 / 试？」
    top = place(est(size), Math.max(TITLE_Y, below(ctx.mode)));
    const box = flow(root, L, top, r - L, 0);
    const k = P.kicker ? fl(box, { ...kickerCss(th), marginBottom: px(KS * 1.1) }, esc(P.kicker), 'mono kicker') : null;
    const t = fl(box, { fontSize: px(size), fontWeight: TY.weight || 900, lineHeight: 1.18, color: inkOf(th), letterSpacing: px(R(TY.tracking ?? -0.02, size)), whiteSpace: u0 <= 8 ? 'nowrap' : 'normal' }, hi(P.text || ''), 'title');
    const src = P.source ? fl(box, { fontSize: px(KS), color: mutedOf(th), marginTop: px(size * 0.45), letterSpacing: px(R(0.002, MIN)) }, '— ' + esc(P.source), 'mono') : null;
    return u => { show(k, out3(span(u, 0, .35)), 10); show(t, out3(span(u, .06, .45)), 28); show(src, out3(span(u, .4, .35)), 12); };
  };

  C_.chapter = (root, P, ctx) => {
    const th = ctx.theme;
    const size0 = R(Math.max(TY.titlePx ?? 0.07, (TY.heroPx ?? 0.098) * 0.92), MIN) * PS.hero;
    const top = Math.max(PORTRAIT ? R(0.30, H) : R(0.24, H), below(ctx.mode));
    const r = inPersonArea(ctx.mode, top, top + size0 * 3);
    const size = fit(size0, r - L, units(P.name || ''));
    const box = flow(root, L, top, r - L, 0);
    const no = fl(box, { fontSize: px(size * 0.42), color: accOf(th), letterSpacing: px(R(0.004, MIN)), lineHeight: 1.1, marginBottom: px(size * 0.18) }, esc(P.no || ''), 'mono');
    const name = fl(box, { fontSize: px(size), fontWeight: TY.weight || 900, color: inkOf(th), lineHeight: 1.08, whiteSpace: 'nowrap', letterSpacing: px(R(TY.tracking ?? -0.02, size)) }, hi(P.name || ''), 'title');
    const rule = fl(box, { width: px(R(0.26, MIN)), height: px(Math.max(2, R(0.0045, MIN))), background: accOf(th), transformOrigin: '0 50%', marginTop: px(size * 0.3) });
    const sub = P.sub ? fl(box, { fontSize: px(HS * 1.25), color: mutedOf(th), letterSpacing: px(R(0.003, MIN)), marginTop: px(size * 0.28) }, hi(P.sub), 'mono') : null;
    const F = foot(root, P, ctx);
    return u => {
      show(no, out3(span(u, 0, .35)), 30);
      show(name, out3(span(u, .08, .42)), 40);
      rule.style.transform = `scaleX(${inout(span(u, .25, .4))})`;
      show(sub, out3(span(u, .4, .4)), 16);
      F(u);
    };
  };

  C_.list = (root, P, ctx) => {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const items = P.items || [];
    const n = Math.max(items.length, 1);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, SAFE);
    const indent = BS * ((LK.bullet === 'number') ? 1.9 : 1.5);
    const bs = fit(BS, r - L - indent, Math.max(...items.map(s => units(s)), 1));
    const rowH = Math.min(bs * 2.5, (SAFE - top0) / n);
    const y0 = place(n * rowH, top0);
    const line = lineOf(th);
    const rows = items.map((it, i) => {
      const y = y0 + i * rowH;
      const ty = y + (rowH - bs * 1.3) / 2;
      const mark = bulletMark(root, i, L, ty, bs, th);
      const txt = el(root, 'abs', { left: px(L + indent), top: px(ty), width: px(r - L - indent), fontSize: px(bs), lineHeight: 1.3, fontWeight: 600 }, hi(it));
      const hair = el(root, 'abs', { left: px(L), top: px(y + rowH - 1), width: px(r - L), height: '1px', background: line, transformOrigin: '0 50%' });
      return { mark, txt, hair, i };
    });
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      rows.forEach(({ mark, txt, hair, i }) => {
        const s = .16 + i * (MO.stagger ?? 0.16) * 0.8;
        show(mark, out3(span(u, s, .3)), 14);
        show(txt, out3(span(u, s + .03, .34)), 18);
        hair.style.transform = `scaleX(${inout(span(u, s, .4))})`;
      });
      F(u);
    };
  };

  C_.steps = (root, P, ctx) => (LK.stepsStyle === 'tiles' ? tiles(root, P, ctx) : stepCards(root, P, ctx));
  // 方块阶梯：横排实心块，逐块下落、错层，最后一块用强调色（参考片 03 / magazine-split 的分步方块）
  function tiles(root, P, ctx) {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const items = P.items || [];
    const n = Math.max(items.length, 1);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, top0 + R(0.3, MIN));
    const gap = R(0.018, MIN), w = (r - L - gap * (n - 1)) / n, h = Math.min(w * 0.95, R(0.30, MIN));
    const drop = R(0.022, MIN);
    const solid = th === 'dark' ? '#1d1f24' : '#0d0e10';
    const cards = items.map((it, i) => {
      const last = i === n - 1;
      const x = L + i * (w + gap), y = top0 + i * drop;
      const c = el(root, 'abs', { left: px(x), top: px(y), width: px(w), height: px(h), background: last ? accOf(th) : solid,
        borderRadius: px(R(LK.radius ?? 0.006, MIN)), boxShadow: `0 ${px(R(0.01, MIN))} ${px(R(0.025, MIN))} rgba(0,0,0,${th === 'dark' ? .5 : .18})` });
      const pad = w * 0.1, fg = last ? (TH.onAccent || '#fff') : '#f4f4f2';
      el(c, 'abs mono', { left: px(pad), top: px(pad * 0.9), fontSize: px(Math.max(KS, w * 0.075)), color: fg, opacity: 0.75 }, pad2(i + 1));
      const fs = fit(Math.min(BS * 1.15, w * 0.17), w - pad * 2, units(it), 2);
      el(c, 'abs', { left: px(pad), top: px(pad * 0.9 + w * 0.13), width: px(w - pad * 2), fontSize: px(fs), fontWeight: 800, lineHeight: 1.25, color: fg }, hi(it));
      [0, 1].forEach(j => el(c, 'abs', { left: px(pad), top: px(h - pad - j * w * 0.07), width: px((w - pad * 2) * (j ? 0.55 : 0.8)), height: px(Math.max(2, w * 0.012)), background: fg, opacity: 0.55 }));
      return { c, i };
    });
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      cards.forEach(({ c, i }) => show(c, out3(span(u, .14 + i * (MO.stagger ?? 0.14), .32)), R(0.05, MIN)));
      F(u);
    };
  }
  function stepCards(root, P, ctx) {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const items = P.items || P.steps || [];
    const n = Math.max(items.length, 1);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, SAFE);
    const pad = R(0.026, MIN), gap = R(0.018, MIN);
    const bs0 = BS * 1.05;
    const noW = bs0 * 2.0;
    const bs = fit(bs0, r - L - pad * 2 - noW, Math.max(...items.map(s => units(s)), 1));
    const cardH = Math.min(bs * 2.5 + PANEL_HDR, (SAFE - top0 - gap * (n - 1)) / n);
    const y0 = place(n * cardH + (n - 1) * gap, top0);
    const cards = items.map((it, i) => {
      const y = y0 + i * (cardH + gap);
      const p = panel(root, L, y, r - L, cardH, th);
      const cy = p.hdr + (cardH - p.hdr) / 2;
      const no = el(p, 'abs mono', { left: px(pad), top: px(cy - bs * 0.62), fontSize: px(bs * 1.05), lineHeight: 1.2, color: accOf(th), fontWeight: 700 }, pad2(i + 1));
      const tx = el(p, 'abs', { left: px(pad + noW), top: px(cy - bs * 0.65), width: px(r - L - pad * 2 - noW), fontSize: px(bs), lineHeight: 1.3, fontWeight: 600 }, hi(it));
      return { p, no, tx, i };
    });
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      cards.forEach(({ p, no, tx, i }) => {
        const s = .14 + i * (MO.stagger ?? 0.16) * 0.85;
        show(p, out3(span(u, s, .35)), 30);
        show(no, out3(span(u, s + .05, .3)), 10);
        show(tx, out3(span(u, s + .08, .32)), 14);
      });
      F(u);
    };
  }

  C_.compare = (root, P, ctx) => {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, SAFE);
    const stacked = PORTRAIT;
    const gap = R(0.022, MIN), pad = R(0.03, MIN);
    const colW = stacked ? (r - L) : (r - L - gap) / 2;
    const L1 = P.left || [], R1 = P.right || [];
    const nmax = Math.max(L1.length, R1.length, 1);
    const mw = BS * 1.1;                                    // 行首记号宽
    const fs = fit(BS, colW - pad * 2 - mw, Math.max(...[...L1, ...R1].map(s => units(s)), 1));
    const ls = fit(BS * 1.2, colW - pad * 2, Math.max(units(P.leftLabel), units(P.rightLabel), 1));
    const rowH = fs * 1.85;
    const inner = n => PANEL_HDR + pad + ls * 1.3 + pad * 0.7 + n * rowH + pad * 0.6;
    let ph = stacked ? null : inner(nmax);
    const total = stacked ? inner(L1.length) + gap + inner(R1.length) : ph;
    const fitScale = Math.min(1, (SAFE - top0) / total);
    const y0 = place(total * fitScale, top0);
    const mk = (label, items, x, y, idx) => {
      const h = (stacked ? inner(items.length) : ph) * fitScale;
      const p = panel(root, x, y, colW, h, th);
      const acc = accOf(th);
      const head = el(p, 'abs', {
        left: px(pad), top: px(p.hdr + pad * fitScale), fontSize: px(ls), fontWeight: 800, lineHeight: 1.3, whiteSpace: 'nowrap',
        color: idx === 0 ? acc : inkOf(th),
      }, esc(label || ''));
      const rows = items.map((t, i) => {
        const yy = p.hdr + (pad + ls * 1.3 + pad * 0.7) * fitScale + i * rowH * fitScale;
        const m = el(p, 'abs mono', { left: px(pad), top: px(yy), fontSize: px(fs * 0.9), lineHeight: 1.3, color: idx === 0 ? acc : mutedOf(th) }, idx === 0 ? '+' : '–');
        const tx = el(p, 'abs', { left: px(pad + mw), top: px(yy), width: px(colW - pad * 2 - mw), fontSize: px(fs), lineHeight: 1.3, color: inkOf(th), opacity: idx === 0 ? 1 : 0.78 }, hi(t));
        return [m, tx];
      });
      return { p, head, rows, h };
    };
    const A = mk(P.leftLabel, L1, L, y0, 0);
    const B = stacked ? mk(P.rightLabel, R1, L, y0 + A.h + gap, 1) : mk(P.rightLabel, R1, L + colW + gap, y0, 1);
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      [A, B].forEach((c, ci) => {
        show(c.p, out3(span(u, .12 + ci * .18, .38)), 34);
        show(c.head, out3(span(u, .18 + ci * .18, .3)), 10);
        c.rows.forEach(([m, t], i) => { const s = .24 + ci * .18 + i * .06; show(m, out3(span(u, s, .3)), 8); show(t, out3(span(u, s + .02, .3)), 12); });
      });
      F(u);
    };
  };

  C_.grid = (root, P, ctx) => {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const items = P.items || [];
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, SAFE);
    const cols = P.cols || (items.length <= 4 ? 2 : 3);
    const nr = Math.max(1, Math.ceil(items.length / cols));
    const gap = R(0.016, MIN);
    const cellW = (r - L - gap * (cols - 1)) / cols;
    const cellH = Math.min(cellW * (P.cellRatio ?? (PORTRAIT ? 0.82 : 0.62)), (SAFE - top0 - gap * (nr - 1)) / nr);
    const y0 = place(nr * cellH + (nr - 1) * gap, top0);
    const acc = accOf(th);
    const cells = items.map((it, i) => {
      const cx = L + (i % cols) * (cellW + gap), cy = y0 + Math.floor(i / cols) * (cellH + gap);
      const p = panel(root, cx, cy, cellW, cellH, th);
      const pad = Math.min(cellW, cellH) * 0.1;
      const zhT = typeof it === 'string' ? it : (it.zh || '');
      const enT = typeof it === 'object' ? (it.en || '') : '';
      const innerH = cellH - p.hdr;
      const noS = Math.min(BS * 0.8, innerH * 0.14);
      const enS = enT ? Math.max(Math.max(14, R(0.0145, MIN)), fit(Math.min(BS * 0.62, innerH * 0.11), cellW - pad * 2, units(enT, true) + enT.length * 0.12)) : 0;
      const zhS = fit(Math.min(BS * 1.45, innerH * 0.26), cellW - pad * 2, units(zhT), 1);   // 单行：两行会压到英文副标
      const no = el(p, 'abs mono', { left: px(pad), top: px(p.hdr + pad * 0.8), fontSize: px(noS), lineHeight: 1.2, color: acc }, pad2(i + 1));
      const zhTop = p.hdr + pad * 0.8 + noS * 1.3 + Math.max(0, (innerH - pad * 1.6 - noS * 1.3 - enS * 1.6 - zhS * 1.2) * 0.42);
      const zh = el(p, 'abs', { left: px(pad), top: px(zhTop), width: px(cellW - pad * 2), fontSize: px(zhS), fontWeight: 800, lineHeight: 1.2, color: inkOf(th), whiteSpace: 'nowrap' }, hi(zhT));
      const en = enT ? el(p, 'abs mono', { left: px(pad), top: px(cellH - pad * 0.8 - enS * 1.25), fontSize: px(enS), lineHeight: 1.25, color: mutedOf(th), letterSpacing: px(enS * 0.12), whiteSpace: 'nowrap' }, esc(enT)) : null;
      return { p, no, zh, en, i };
    });
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      cells.forEach(({ p, no, zh, en, i }) => {
        const s = .12 + i * (MO.stagger ?? 0.12) * 0.7;
        show(p, out3(span(u, s, .34)), 26);
        show(no, out3(span(u, s + .04, .3)), 8);
        show(zh, out3(span(u, s + .06, .32)), 12);
        show(en, out3(span(u, s + .1, .3)), 8);
      });
      F(u);
    };
  };

  C_.counter = (root, P, ctx) => (LK.counterStyle === 'ring' ? ring(root, P, ctx) : counterPlain(root, P, ctx));
  function ring(root, P, ctx) {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, SAFE);
    const Rr = Math.min((SAFE - top0 - (PORTRAIT && P.note ? BS * 3.6 : 0)) * 0.42, (r - L) * 0.36);
    const cx = PORTRAIT ? (L + r) / 2 : L + Rr + R(0.02, MIN), cy = top0 + Rr + R(0.02, MIN);
    const acc = accOf(th), vStr = String(P.value ?? '');
    const target = Number(P.value) || 0, frac = Math.max(0, Math.min(1, P.max ? target / P.max : (P.unit === '%' ? target / 100 : 1)));
    const NS = 'http://www.w3.org/2000/svg', S2 = Rr * 2 + R(0.06, MIN);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', S2); svg.setAttribute('height', S2);
    Object.assign(svg.style, { position: 'absolute', left: px(cx - S2 / 2), top: px(cy - S2 / 2), overflow: 'visible' });
    let ticks = '';
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r1 = Rr + R(0.022, MIN), r2 = Rr + R(i % 5 ? 0.03 : 0.04, MIN);
      ticks += `<line x1="${S2 / 2 + Math.sin(a) * r1}" y1="${S2 / 2 - Math.cos(a) * r1}" x2="${S2 / 2 + Math.sin(a) * r2}" y2="${S2 / 2 - Math.cos(a) * r2}" stroke="${lineOf(th)}" stroke-width="2"/>`; }
    const C = 2 * Math.PI * Rr, sw = Math.max(6, R(0.012, MIN));
    svg.innerHTML = ticks + `<circle cx="${S2 / 2}" cy="${S2 / 2}" r="${Rr}" fill="none" stroke="${lineOf(th)}" stroke-width="${sw}"/>` +
      `<circle class="arc" cx="${S2 / 2}" cy="${S2 / 2}" r="${Rr}" fill="none" stroke="${acc}" stroke-width="${sw}" stroke-linecap="round" transform="rotate(-90 ${S2 / 2} ${S2 / 2})" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="filter:drop-shadow(0 0 ${px(R(0.012, MIN))} ${acc})"/>`;
    root.appendChild(svg);
    const arc = svg.querySelector('.arc');
    const vs = fit(Rr * 0.75, Rr * 1.5, units(vStr, true) + 0.4);
    const val = el(root, 'abs mono', { left: px(cx - Rr), width: px(Rr * 2), top: px(cy - vs * 0.62), textAlign: 'center', fontSize: px(vs), fontWeight: 700, lineHeight: 1, color: inkOf(th) }, '0');
    const unit = P.unit ? el(root, 'abs', { left: px(cx - Rr), width: px(Rr * 2), top: px(cy + vs * 0.48), textAlign: 'center', fontSize: px(Math.max(KS * 1.2, vs * 0.22)), fontWeight: 800, color: acc }, esc(P.unit)) : null;
    const lab = P.label ? el(root, 'abs mono', { left: px(cx - Rr), width: px(Rr * 2), top: px(cy - vs * 0.62 - KS * 2), textAlign: 'center', fontSize: px(KS), color: mutedOf(th), letterSpacing: px(R(0.003, MIN)) }, esc(P.label)) : null;
    const nx = PORTRAIT ? L : cx + Rr + R(0.06, MIN), nw = PORTRAIT ? r - L : r - nx;
    const ny = PORTRAIT ? cy + Rr + R(0.05, MIN) : cy - BS;
    const note = P.note ? el(root, 'abs', { left: px(nx), top: px(ny), width: px(nw), fontSize: px(fit(BS * 1.1, nw, units(P.note), 2)), lineHeight: 1.4, fontWeight: 700, color: inkOf(th) }, hi(P.note)) : null;
    const dec = vStr.includes('.') ? vStr.split('.')[1].length : 0;
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      svg.style.opacity = out3(span(u, .08, .25));
      const p = out3(span(u, .12, .5));
      arc.setAttribute('stroke-dashoffset', String(C * (1 - frac * p)));
      val.textContent = (target * p).toFixed(dec);
      show(val, Math.min(1, span(u, .12, .15)), 10);
      show(unit, out3(span(u, .4, .3)), 8);
      show(lab, out3(span(u, .1, .3)), 8);
      show(note, out3(span(u, .5, .3)), 14);
      F(u);
    };
  }
  function counterPlain(root, P, ctx) {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, SAFE);
    const vStr = String(P.value ?? '');
    const vs = fit(R(PORTRAIT ? 0.24 : 0.17, MIN), (r - L) * 0.78, units(vStr, true) + 0.2);
    const ns = fit(BS, r - L, units(P.note || ''), 2);
    const blockH = KS * 2 + vs * 1.02 + (P.note ? ns * 2.9 : 0);
    const y0 = place(blockH, top0);
    const box = flow(root, L, y0, r - L, 0);
    const lab = P.label ? fl(box, { fontSize: px(KS), color: mutedOf(th), letterSpacing: px(R(0.003, MIN)), marginBottom: px(KS * 0.5) }, esc(P.label), 'mono') : null;
    const row = fl(box, { display: 'flex', alignItems: 'baseline', gap: px(vs * 0.08) });
    const val = el(row, 'mono', { position: 'relative', fontSize: px(vs), fontWeight: 700, lineHeight: 1.02, color: accOf(th), letterSpacing: px(-vs * 0.03), fontVariantNumeric: 'tabular-nums' }, '0');
    const unit = P.unit ? el(row, '', { position: 'relative', fontSize: px(Math.max(BS * 1.2, vs * 0.2)), fontWeight: 800, color: inkOf(th) }, esc(P.unit)) : null;
    const rule = fl(box, { width: px(Math.min(r - L, vs * Math.max(2, units(vStr, true)))), height: '1px', background: lineOf(th), marginTop: px(vs * 0.12), transformOrigin: '0 50%' });
    const note = P.note ? fl(box, { fontSize: px(ns), lineHeight: 1.4, color: inkOf(th), marginTop: px(ns * 0.8), fontWeight: 600 }, hi(P.note)) : null;
    const target = Number(P.value) || 0;
    const dec = vStr.includes('.') ? vStr.split('.')[1].length : 0;
    const numeric = vStr !== '' && !isNaN(Number(vStr));
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      show(lab, out3(span(u, .08, .3)), 12);
      const p = out3(span(u, .12, .55));
      val.textContent = numeric ? (target * p).toFixed(dec) : vStr;
      show(row, Math.min(1, span(u, .12, .2) * 1.0 + 0.0), 20);
      show(unit, out3(span(u, .45, .3)), 10);
      rule.style.transform = `scaleX(${inout(span(u, .4, .4))})`;
      show(note, out3(span(u, .55, .35)), 14);
      F(u);
    };
  }

  C_.quote = (root, P, ctx) => {
    const th = ctx.theme;
    const size0 = R(P.size ?? TY.quotePx ?? 0.045, MIN) * PS.title;
    const u0 = units(P.text || '');
    const est = s => s * 1.6 + Math.ceil(u0 * s / Math.max(1, RT - L)) * s * 1.45 + (P.source ? HS * 3 : 0);
    let top = place(est(size0), Math.max(TITLE_Y, below(ctx.mode)));
    const r = inPersonArea(ctx.mode, top, top + est(size0));
    const size = fit(size0, r - L, u0, 3);
    top = place(est(size), Math.max(TITLE_Y, below(ctx.mode)));
    const box = flow(root, L, top, r - L, 0);
    const q = fl(box, { fontSize: px(size * 2.2), color: accOf(th), lineHeight: 0.8, height: px(size * 1.2), fontWeight: 900 }, '“', 'title qmark');
    const t = fl(box, { fontSize: px(size), fontWeight: 700, lineHeight: 1.45, color: inkOf(th) }, hi(P.text || ''));
    const src = P.source ? fl(box, { fontSize: px(KS), color: mutedOf(th), marginTop: px(size * 0.6), letterSpacing: px(R(0.002, MIN)) }, '— ' + esc(P.source), 'mono') : null;
    const F = foot(root, P, ctx);
    return u => {
      show(q, out3(span(u, 0, .35)), 20);
      show(t, out3(span(u, .06, .42)), 26);
      show(src, out3(span(u, .35, .35)), 12);
      F(u);
    };
  };

  C_.outro = (root, P, ctx) => {
    const th = ctx.theme;
    const size0 = R(TY.heroPx ?? 0.098, MIN) * PS.hero;
    const lines = [P.line1, P.line2].filter(Boolean);
    let y0 = Math.max(HERO_Y - KS * 2.6, below(ctx.mode));
    const r = inPersonArea(ctx.mode, y0, HERO_Y + size0 * 2.6);
    const size = fit(size0, r - L, Math.max(...lines.map(s => units(s)), 1));
    // 人物在下部、安全区收窄时：整块上移，保证不进安全区下方
    const estH = KS * 2.4 + lines.length * size * 1.12 + (P.sub || P.note ? BS * 2 + size * 0.3 : 0) + size * 0.4;
    y0 = Math.max(R(0.06, H), Math.min(y0, SAFE - estH));
    const box = flow(root, L, y0, r - L, 0);
    const k = P.kicker ? fl(box, { ...kickerCss(th), marginBottom: px(KS * 1.1) }, esc(P.kicker), 'mono kicker') : null;
    const t = lines.map((ln, i) => fl(box, { fontSize: px(size), fontWeight: TY.weight || 900, lineHeight: 1.12, whiteSpace: 'nowrap', color: i === 0 ? inkOf(th) : accOf(th), letterSpacing: px(R(TY.tracking ?? -0.02, size)) }, hi(ln), 'title'));
    const ul = fl(box, { width: px(R(0.3, MIN)), height: px(Math.max(2, R(0.0045, MIN))), background: accOf(th), transformOrigin: '0 50%', marginTop: px(size * 0.3) });
    const note = P.note ? fl(box, { fontSize: px(fit(BS, r - L, units(P.note))), color: mutedOf(th), marginTop: px(size * 0.3) }, hi(P.note)) : null;
    const F = foot(root, P, ctx);
    return u => {
      show(k, out3(span(u, 0, .35)), 12);
      t.forEach((n, i) => show(n, out3(span(u, .06 + i * .14, .42)), 30));
      ul.style.transform = `scaleX(${inout(span(u, .4, .4))})`;
      show(note, out3(span(u, .5, .35)), 10);
      F(u);
    };
  };

  // ---------- 试点新增：结论横幅 / 巨字揭晓（参考 magazine-split 的 tabs+banner、card+bigword） ----------
  // banner：标题 + 标签胶囊组（逐个点亮） + 强调色实心横幅（label + 一句结论）
  C_.banner = (root, P, ctx) => {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, top0 + R(0.4, MIN));
    const tags = P.tags || [];
    const tsz = Math.min(BS * 1.05, (r - L) / Math.max(tags.reduce((a, t) => a + units(t) + 2.2, 0), 1));
    const row = el(root, 'abs', { left: px(L), top: px(top0), display: 'flex', gap: px(tsz * 0.6) });
    const solid = th === 'dark' ? '#1d1f24' : '#ffffff';
    const pills = tags.map((t, i) => el(row, '', { position: 'relative', padding: `${px(tsz * 0.45)} ${px(tsz * 1.0)}`, fontSize: px(tsz), fontWeight: 800,
      background: i === tags.length - 1 ? accOf(th) : solid, color: i === tags.length - 1 ? (TH.onAccent || '#fff') : inkOf(th),
      borderRadius: px(R(0.006, MIN)), boxShadow: `0 ${px(R(0.006, MIN))} ${px(R(0.016, MIN))} rgba(0,0,0,${th === 'dark' ? .45 : .12})`, whiteSpace: 'nowrap' }, hi(t)));
    const by = top0 + tsz * 2.6 + R(0.04, MIN), bw = r - L;
    const lsz = fit(BS * 1.25, bw * 0.8, units(P.label || ''));
    const msz = fit(BS * 1.05, bw - R(0.06, MIN), units(P.line || ''));
    const bh = lsz * 1.4 + msz * 1.6 + R(0.05, MIN);
    const ban = el(root, 'abs', { left: px(L), top: px(by), width: px(bw), height: px(bh), background: accOf(th), borderRadius: px(R(0.008, MIN)),
      boxShadow: `0 ${px(R(0.014, MIN))} ${px(R(0.04, MIN))} ${accOf(th)}55`, transformOrigin: '0 50%' });
    const fg = TH.onAccent || '#fff';
    const bl = el(ban, 'abs', { left: px(R(0.03, MIN)), top: px(R(0.022, MIN)), fontSize: px(lsz), fontWeight: 900, color: fg, lineHeight: 1.3 }, hi(P.label || ''));
    const bm = el(ban, 'abs', { left: px(R(0.03, MIN)), top: px(R(0.022, MIN) + lsz * 1.5), width: px(bw - R(0.06, MIN)), fontSize: px(msz), fontWeight: 700, color: fg, opacity: 0.95, lineHeight: 1.4 }, hi(P.line || ''));
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      pills.forEach((p, i) => show(p, out3(span(u, .06 + i * .06, .2)), 14));
      const k = out3(span(u, .18 + tags.length * .03, .22));
      ban.style.opacity = Math.min(1, k * 1.4); ban.style.transform = `scaleX(${0.6 + 0.4 * k})`;
      show(bl, out3(span(u, .26, .18)), 8);
      show(bm, out3(span(u, .3, .18)), 8);
      F(u);
    };
  };

  // reveal：两行问题标题 + 白色答案卡（小标签 + 一句 + 强调小字）+ 溢出卡片右侧的巨字
  C_.reveal = (root, P, ctx) => {
    const th = ctx.theme;
    const top = Math.max(TITLE_Y, below(ctx.mode));
    const rq = inPersonArea(ctx.mode, top, top + R(0.25, MIN));
    const qsz = fit(R(TY.titlePx ?? 0.07, MIN) * PS.title, rq - L, Math.max(units(P.q1 || ''), units(P.q2 || '')));
    const q1 = el(root, 'abs title', { left: px(L), top: px(top), fontSize: px(qsz), fontWeight: TY.weight || 900, lineHeight: 1.12, color: inkOf(th), whiteSpace: 'nowrap' }, hi(P.q1 || ''));
    const q2 = P.q2 ? el(root, 'abs title', { left: px(L), top: px(top + qsz * 1.12), fontSize: px(qsz), fontWeight: TY.weight || 900, lineHeight: 1.12, color: inkOf(th), whiteSpace: 'nowrap' }, hi(P.q2)) : null;
    const cy = top + qsz * (P.q2 ? 2.24 : 1.12) + R(0.05, MIN);
    // 巨字与答案卡按可用宽度一起缩：巨字始终在卡片右侧，最多压住卡片 1/4
    const rw = inPersonArea(ctx.mode, cy, cy + R(0.22, MIN));
    const wsz = fit(R(TY.heroPx ?? 0.1, MIN) * PS.hero * 1.15, (rw - L) * 0.5, units(P.word || ''));
    const wW = wsz * units(P.word || '');
    const cw = Math.min((rw - L) * 0.74, (rw - L) - wW * 0.75), csz = BS;
    const card = el(root, 'abs', { left: px(L), top: px(cy), width: px(cw), padding: `${px(csz * 0.8)} ${px(csz * 1.0)}`, background: th === 'dark' ? '#1d1f24' : '#ffffff',
      borderRadius: px(R(0.006, MIN)), boxShadow: `0 ${px(R(0.01, MIN))} ${px(R(0.03, MIN))} rgba(0,0,0,${th === 'dark' ? .5 : .14})` });
    el(card, 'mono', { position: 'relative', fontSize: px(KS * 0.9), color: mutedOf(th), marginBottom: px(csz * 0.3) }, esc(P.label || '答案'));
    el(card, '', { position: 'relative', fontSize: px(fit(csz * 1.15, cw - csz * 2 - wW * 0.3, units(P.line || ''))), fontWeight: 900, color: inkOf(th) }, hi(P.line || ''));
    if (P.sub) el(card, '', { position: 'relative', fontSize: px(KS), fontWeight: 700, color: accOf(th), marginTop: px(csz * 0.3) }, hi(P.sub));
    const word = el(root, 'abs title', { right: px(W - rw), top: px(cy + csz * 1.6), fontSize: px(wsz), fontWeight: 900, color: accOf(th), lineHeight: 1, whiteSpace: 'nowrap',
      textShadow: `0 ${px(R(0.008, MIN))} ${px(R(0.02, MIN))} rgba(0,0,0,${th === 'dark' ? .6 : .18})` }, hi(P.word || ''));
    const F = foot(root, P, ctx);
    return u => {
      show(q1, out3(span(u, 0, .3)), 24);
      show(q2, out3(span(u, .08, .3)), 24);
      show(card, out3(span(u, .25, .3)), 20);
      const k = out3(span(u, .45, .3));
      word.style.opacity = Math.min(1, k * 1.5); word.style.transform = `scale(${1.25 - 0.25 * k})`; word.style.transformOrigin = '100% 50%';
      F(u);
    };
  };

  // ---------- P0-3 新控件 ----------
  // imageSlot：用户素材/截图位。src 由 render.mjs build 拷进实例 assets/；无 src 时画占位框
  const RATIO = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '3:4': 3 / 4, '9:16': 9 / 16 };
  C_.imageSlot = (root, P, ctx) => {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const top0 = contentTop(Hd.bottom);
    const r = inPersonArea(ctx.mode, top0, SAFE);
    const ratio = RATIO[P.ratio] || (PORTRAIT ? 4 / 3 : 16 / 9);
    const capH = P.caption ? KS * 2.6 : 0;
    let w = r - L, h = (w - 0) / ratio + PANEL_HDR;
    const maxH = SAFE - top0 - capH;
    if (h > maxH) { h = maxH; w = (h - PANEL_HDR) * ratio; }
    const y0 = place(h + capH, top0);
    const p = panel(root, L, y0, w, h, th);
    const inset = (LK.panelStyle === 'outline' || LK.panelStyle === 'glass') ? R(0.008, MIN) : 0;
    const box = el(p, 'abs', { left: px(inset), top: px(p.hdr + inset), width: px(w - inset * 2), height: px(h - p.hdr - inset * 2),
      overflow: 'hidden', borderRadius: px(Math.max(0, R(LK.radius ?? 0.012, MIN) - inset)) });
    let img;
    if (P.src) {
      img = document.createElement('img');
      img.src = P.src;
      Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block', transformOrigin: '50% 50%' });
      box.appendChild(img);
    } else {
      box.style.background = `repeating-linear-gradient(135deg, ${lineOf(th)} 0 1px, transparent 1px ${px(R(0.018, MIN))})`;
      img = el(box, 'abs mono', { left: '0', top: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: px(KS), color: mutedOf(th), letterSpacing: px(R(0.003, MIN)) }, `素材位 · ${esc(P.ratio || (PORTRAIT ? '4:3' : '16:9'))}`);
    }
    const cap = P.caption ? el(root, 'abs mono', { left: px(L), top: px(y0 + h + KS * 0.9), width: px(r - L), fontSize: px(KS), color: mutedOf(th), letterSpacing: px(R(0.002, MIN)) }, '↳ ' + hi(P.caption)) : null;
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      show(p, out3(span(u, .1, .4)), 30);
      const k = out3(span(u, .14, .7));
      img.style.opacity = k;
      if (P.src) img.style.transform = `scale(${1.06 - 0.06 * k})`;
      show(cap, out3(span(u, .45, .35)), 10);
      F(u);
    };
  };

  // bars：横向数据条。focus（1 起）指定强调条，缺省为最大值
  C_.bars = (root, P, ctx) => {
    const th = ctx.theme;
    const Hd = heading(root, P, ctx);
    const items = P.items || [];
    const n = Math.max(items.length, 1);
    const top0 = contentTop(Hd.bottom);
    const noteH = P.note ? BS * 2.6 : 0;
    // 先按整宽估块高与位置，只有块的实际纵向区间与人物框相交时才让位
    const estH = Math.min(BS * 2.5 * n, SAFE - top0 - noteH) + noteH;
    const ey = place(estH, top0);
    const r = inPersonArea(ctx.mode, ey, ey + estH);
    const vals = items.map(it => Number(it.value) || 0);
    const vmax = Math.max(...vals, 1e-9);
    const fi = P.focus ? P.focus - 1 : vals.indexOf(Math.max(...vals));
    const labU = Math.max(...items.map(it => units(it.label)), 2);
    const bs = Math.min(BS, (r - L) * 0.3 / labU);
    const labW = bs * labU + bs * 0.8;
    const valW = bs * (Math.max(...items.map(it => units(String(it.value), true))) + units(P.unit || '')) + bs;
    const trackW = r - L - labW - valW;
    const rowH = Math.min(bs * 2.5, (SAFE - top0 - noteH) / n);
    const y0 = place(n * rowH + noteH, top0);
    const acc = accOf(th);
    const rows = items.map((it, i) => {
      const y = y0 + i * rowH, cy = y + rowH / 2;
      const on = i === fi;
      const lab = el(root, 'abs', { left: px(L), top: px(cy - bs * 0.65), fontSize: px(bs), lineHeight: 1.3, fontWeight: on ? 800 : 600, whiteSpace: 'nowrap', color: on ? inkOf(th) : mutedOf(th) }, hi(it.label));
      const track = el(root, 'abs', { left: px(L + labW), top: px(cy - bs * 0.42), width: px(trackW), height: px(bs * 0.84), background: lineOf(th), borderRadius: px(R(LK.radius ?? 0.01, MIN) * 0.6), opacity: 0.5 });
      const bar = el(root, 'abs', { left: px(L + labW), top: px(cy - bs * 0.42), width: px(Math.max(2, trackW * vals[i] / vmax)), height: px(bs * 0.84),
        background: on ? acc : (th === 'dark' ? 'rgba(255,255,255,.34)' : 'rgba(0,0,0,.26)'), borderRadius: px(R(LK.radius ?? 0.01, MIN) * 0.6), transformOrigin: '0 50%' });
      const val = el(root, 'abs mono', { left: px(L + labW + trackW * vals[i] / vmax + bs * 0.5), top: px(cy - bs * 0.62), fontSize: px(bs * 0.95), lineHeight: 1.3, fontWeight: 700, whiteSpace: 'nowrap', color: on ? acc : inkOf(th) }, '');
      const dec = String(it.value).includes('.') ? String(it.value).split('.')[1].length : 0;
      return { lab, track, bar, val, i, v: vals[i], dec };
    });
    const note = P.note ? el(root, 'abs', { left: px(L), top: px(y0 + n * rowH + bs * 0.9), width: px(r - L), fontSize: px(fit(BS, r - L, units(P.note), 2)), lineHeight: 1.4, fontWeight: 600, color: inkOf(th) }, hi(P.note)) : null;
    const F = foot(root, P, ctx);
    return u => {
      Hd.draw(u);
      rows.forEach(({ lab, track, bar, val, i, v, dec }) => {
        const s = .12 + i * (MO.stagger ?? 0.14) * 0.6;
        show(lab, out3(span(u, s, .3)), 10);
        track.style.transform = `scaleX(${out3(span(u, s, .3))})`;
        const k = out3(span(u, s + .05, .45));
        bar.style.transform = `scaleX(${k})`;
        val.textContent = (v * k).toFixed(dec) + (P.unit ? ' ' + P.unit : '');
        val.style.opacity = Math.min(1, k * 1.5);
        val.style.transform = `translateX(${-(1 - k) * trackW * v / vmax}px)`;
      });
      show(note, out3(span(u, .6, .35)), 12);
      F(u);
    };
  };

  // split：人物分屏。人物占半屏（style.json#person.frame.split），内容在另一半；镜头 presenter 由 render.mjs 强制为 split
  C_.split = (root, P, ctx) => {
    const th = ctx.theme;
    const g = frameGeo('split');
    const items = P.items || [];
    const gap = R(0.05, MIN);
    let x0, y0, w;
    if (PORTRAIT) { x0 = L; y0 = g.y + g.h + gap; w = RT - L; }
    else { x0 = L; y0 = TITLE_Y; w = g.x - gap - L; }
    const y1 = SAFE;
    const ts = fit(R(TY.titlePx ?? 0.07, MIN) * PS.title, w, units(P.title || ''));
    const iu = Math.max(...items.map(s => units(s)), 1);
    const bs = fit(BS, w - BS * 1.6, iu);
    const box = flow(root, x0, y0, w, 0);
    const k = P.kicker ? fl(box, { ...kickerCss(th), marginBottom: px(KS * 0.9) }, esc(P.kicker), 'mono kicker') : null;
    const t = fl(box, { fontSize: px(ts), fontWeight: TY.weight || 900, lineHeight: 1.12, color: inkOf(th), whiteSpace: 'nowrap', letterSpacing: px(R(TY.tracking ?? -0.02, ts)) }, hi(P.title || ''), 'title');
    const rule = fl(box, { width: px(R(0.12, MIN)), height: px(Math.max(2, R(0.0045, MIN))), background: accOf(th), transformOrigin: '0 50%', marginTop: px(ts * 0.28), marginBottom: px(bs * 0.9) });
    const rows = items.map((it, i) => {
      const row = fl(box, { display: 'flex', alignItems: 'baseline', gap: px(bs * 0.6), marginTop: px(i ? bs * 0.7 : 0) });
      el(row, 'mono', { position: 'relative', fontSize: px(bs * 0.8), color: accOf(th), minWidth: px(bs * 1.0) }, pad2(i + 1));
      el(row, '', { position: 'relative', fontSize: px(bs), lineHeight: 1.35, fontWeight: 600, color: inkOf(th) }, hi(it));
      return row;
    });
    void y1;
    const F = foot(root, P, ctx);
    return u => {
      show(k, out3(span(u, .05, .35)), 12);
      show(t, out3(span(u, .1, .4)), 24);
      rule.style.transform = `scaleX(${inout(span(u, .25, .4))})`;
      rows.forEach((rw, i) => show(rw, out3(span(u, .3 + i * (MO.stagger ?? 0.14) * 0.8, .35)), 16));
      F(u);
    };
  };

  // ---------- 构图（compose）：内容块整体放大并在可用区内纵向居中 ----------
  // 控件各自按「顶部锚定」排版，内容少时下半屏会空。这里在终态量出内容块外框，
  // 以外框左上角为原点等比放大（上限 layout.composeMax，默认 1.22），再在 [原顶边, SAFE] 内按 42% 视觉重心下移。
  // 候选从大到小试：放大后任何元素碰到人物框 / HUD / 版心右界 / 字幕安全线就降一档，全不行则保持原样。
  // 只依赖终态几何，与 t 无关：renderAt 仍是 t 与 DATA 的纯函数。
  function compose(content, root, mode) {
    const stage = $('stage'), sr = stage.getBoundingClientRect();
    [...content.querySelectorAll('.foot')].forEach(f => root.appendChild(f));   // 页脚固定在安全线下，不参与构图
    const rects = [];
    const push = b => { if (b.width > 0.5 && b.height > 0.5) rects.push({ l: b.left - sr.left, t: b.top - sr.top, r: b.right - sr.left, b: b.bottom - sr.top }); };
    content.querySelectorAll('*').forEach(e => {
      if (e.closest('.qmark')) return;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const tag = e.tagName.toLowerCase();
      if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        const rg = document.createRange(); rg.selectNodeContents(e); [...rg.getClientRects()].forEach(push);
      } else if (tag === 'img' || tag === 'svg' || tag === 'canvas' || cs.backgroundImage !== 'none'
        || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0) {
        if (!e.closest('svg') || tag === 'svg') push(e.getBoundingClientRect());
      }
    });
    if (!rects.length) return;
    const B = { l: Math.min(...rects.map(q => q.l)), t: Math.min(...rects.map(q => q.t)), r: Math.max(...rects.map(q => q.r)), b: Math.max(...rects.map(q => q.b)) };
    const bw = B.r - B.l, bh = B.b - B.t, room = SAFE - B.t;
    if (bw < 1 || bh < 1 || B.b > SAFE) return;
    const hit = (a, o) => Math.min(a.r, o.r) - Math.max(a.l, o.l) > 1 && Math.min(a.b, o.b) - Math.max(a.t, o.t) > 1;
    const pad = R(0.028, MIN), g = frameGeo(mode);
    let obs = [];
    if (g) obs.push({ l: g.x - pad, t: g.y - pad, r: g.x + g.w + pad, b: g.y + g.h + pad });
    root.querySelectorAll('.hud').forEach(h => { const b = h.getBoundingClientRect(); if (b.width > 0.5 && b.height > 0.5) obs.push({ l: b.left - sr.left, t: b.top - sr.top, r: b.right - sr.left, b: b.bottom - sr.top }); });
    obs = obs.filter(o => !rects.some(q => hit(q, o)));   // 原样就相交的（控件自己安排的贴靠）不算障碍
    const K = LY.composeY ?? 0.42;
    const smax = Math.max(1, Math.min(LY.compose === 'center' ? 1 : (LY.composeMax ?? 1.22), (RT - B.l) / bw, room * 0.9 / bh));
    for (let s = smax; s >= 1 - 1e-6; s = s > 1 ? Math.max(1, s - 0.05) : 0) {
      const slack = room - bh * s;
      for (const ty of [slack * K, slack * K * 0.5, 0]) {
        const tr = q => ({ l: B.l + (q.l - B.l) * s, r: B.l + (q.r - B.l) * s, t: B.t + (q.t - B.t) * s + ty, b: B.t + (q.b - B.t) * s + ty });
        if (rects.some(q => { const z = tr(q); return z.r > RT + 1 || z.b > SAFE + 1 || obs.some(o => hit(z, o)); })) continue;
        if (s === 1 && ty === 0) return;
        content.style.transformOrigin = `${B.l}px ${B.t}px`;
        content.style.transform = `translateY(${Math.round(ty)}px) scale(${s.toFixed(4)})`;
        return;
      }
    }
  }

  // ---------- 装配 ----------
  // 入场时长：镜头的 72%，且不超过 2.4s（长镜头不再把入场拖满整镜）
  const ENTER_MAX = MO.enterMax ?? 2.4;

  window.renderAt = function (t) {
    const stage = $('stage');
    stage.innerHTML = '';
    stage.style.width = W + 'px';
    stage.style.height = H + 'px';
    const shots = D.shots || [];
    let idx = shots.findIndex(s => t >= s.t0 && t < s.t1);
    if (idx < 0) idx = shots.length - 1;
    const sh = shots[idx];
    const theme = sh.theme || S.theme.default || 'dark';
    const root = el(stage, 'abs layer', { left: '0', top: '0', width: '100%', height: '100%' });
    root.style.setProperty('--accent', accOf(theme) || '#ffffff');
    // 字族令牌（缺字自动回落到 KB Sans / KB Mono，见 style.css）
    if (TY.titleFamily) root.style.setProperty('--kb-title', `'${TY.titleFamily}'`);
    if (TY.bodyFamily) root.style.setProperty('--kb-body', `'${TY.bodyFamily}'`);
    if (TY.monoFamily) root.style.setProperty('--kb-mono', `'${TY.monoFamily}'`);
    root.style.fontFamily = "var(--kb-body, 'KB Sans'), 'KB Sans', sans-serif";
    background(root, theme);
    personFrame(root, sh.presenter || 'none', theme);
    window.__shot = { control: sh.control, mode: sh.presenter || 'none' };
    SAFE = safeFor(sh.presenter || 'none');
    const ctx = { t, theme, mode: sh.presenter || 'none', shotStart: sh.t0, duration: sh.t1 - sh.t0, shotNo: idx, shotCount: shots.length };
    const ctrl = C_[sh.control];
    if (!ctrl) throw new Error('未知控件：' + sh.control);
    const local = t - sh.t0;
    const dur = sh.t1 - sh.t0;
    const u = clamp(local / Math.max(dur, .001));
    const ue = clamp(local / Math.max(.001, Math.min(dur * 0.72, ENTER_MAX)));
    hud(root, ctx, theme)(ue);
    // 控件画在 content 包裹层里：先按终态（u=1）量出内容块，再整体放大 / 纵向居中（compose），最后按当前时刻绘制
    const content = el(root, 'abs content', { left: '0', top: '0', width: '100%', height: '100%' });
    const draw = ctrl(content, sh.props || {}, ctx);
    if (draw) {
      if ((LY.compose ?? 'fill') !== 'off' && sh.control !== 'split') { draw(1); compose(content, root, sh.presenter || 'none'); }
      draw(ue);
    }
    // 收尾淡出（最后 0.18s）
    if (dur - local < 0.18) root.style.opacity = clamp((dur - local) / 0.18);
    void u;
  };
  // ---------- 全量预览（只在 --full 下生效）：人物画面 + 字幕 ----------
  function presenterLayer(root, mode, t) {
    if (!D.full || !D.presenterFrames || !D.presenterFrames.count) return;
    const g = frameGeo(mode);
    if (!g) return;
    const f = Math.min(D.presenterFrames.count, Math.max(1, Math.round(t * (D.fps || 30)) + 1));
    const img = document.createElement('img');
    img.src = `presenter/${String(f).padStart(5, '0')}.jpg`;
    const fit = D.presenterFit?.modes?.[mode], src = D.presenterFit?.source;
    if (fit && src) {   // 按人物裁切：把裁切矩形映射到人物框
      const box = el(root, 'abs', { left: px(g.x), top: px(g.y), width: px(g.w), height: px(g.h), borderRadius: px(g.r), overflow: 'hidden' });
      const k = g.w / fit.w;
      Object.assign(img.style, { position: 'absolute', left: px(-fit.x * k), top: px(-fit.y * k), width: px(src.w * k), height: px(src.h * k) });
      box.appendChild(img);
      return;
    }
    Object.assign(img.style, {
      position: 'absolute', left: px(g.x), top: px(g.y), width: px(g.w), height: px(g.h),
      borderRadius: px(g.r), objectFit: 'cover', objectPosition: `50% ${Math.round((D.faceCy ?? .42) * 100)}%`,
    });
    root.appendChild(img);
  }
  function captionLayer(root, t, theme) {
    if (!D.full || !D.captions) return;
    const c = D.captions.find(x => t >= x.s && t < x.e);
    if (!c) return;
    const dark = theme === 'dark';
    // 与剪映草稿同源：字号 = caption.size 换算出的 type.captionPx；行宽 = 草稿的 max_line_width；
    // 垂直以 caption.y 为文字块中心（剪映 transform_y 是文字块中心，两行时上下各长半行）
    const size = R(TY.captionPx ?? 0.048, MIN);
    const cx = S.caption?.x ?? .5;
    const lw = (S.caption?.maxLineWidth ?? (cx === .5 ? 0.73 : 2 * Math.min(cx - 0.06, 0.94 - cx))) * W;
    const box = el(root, 'abs caption', {
      left: px(cx * W - lw / 2), top: px((1 - (S.caption?.y ?? -0.79)) / 2 * H), transform: 'translateY(-50%)',
      width: px(lw), textAlign: 'center',
      fontSize: px(size), fontWeight: 700, lineHeight: 1.35,
      color: dark ? (TH.captionOnDark || TH.inkAlt || '#fff') : (TH.captionOn || TH.ink),
      textShadow: dark ? '0 2px 10px rgba(0,0,0,.55)' : '0 2px 10px rgba(255,255,255,.6)',
    }, hi(c.text));
    const p = clamp((t - c.s) / 0.16);
    box.style.opacity = p;
  }

  const _renderAt = window.renderAt;
  window.renderAt = function (t) {
    _renderAt(t);
    const stage = document.getElementById('stage');
    const layer = stage.querySelector('.layer');
    if (!layer) return;
    const shots = D.shots || [];
    let idx = shots.findIndex(s => t >= s.t0 && t < s.t1);
    if (idx < 0) idx = shots.length - 1;
    const sh = shots[idx];
    const theme = sh.theme || S.theme.default || 'dark';
    presenterLayer(layer, sh.presenter || 'none', t);
    captionLayer(layer, t, theme);
  };

  // ---------- W7 版面审计（只读，不参与渲染）：在 renderAt(t) 之后调用，返回违规清单 ----------
  window.auditLayout = function () {
    const out = [];
    const stage = $('stage');
    const sr = stage.getBoundingClientRect();
    const sh = window.__shot || {};
    const pg = frameGeo(sh.mode);
    const MINF = Math.max(14, R(0.0145, MIN)), MINF_HUD = Math.max(12, R(0.012, MIN));
    const op = e => { let o = 1; for (let x = e; x && x !== stage; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= Number(cs.opacity); } return o; };
    const texts = [];
    stage.querySelectorAll('*').forEach(e => {
      if (e.tagName === 'B' || e.tagName === 'IMG') return;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own || op(e) < 0.05) return;
      // 逐行取框，并把每行竖向收窄到 0.9em 的字身带：Range 给的是字体内容区（Noto Sans SC 约 1.45em），
      // 比行高大，直接比会把相邻行误判为互压
      const rg = document.createRange(); rg.selectNodeContents(e);
      const fs0 = parseFloat(getComputedStyle(e).fontSize);
      const lines = [...rg.getClientRects()].filter(b => b.width > 0.5).map(b => {
        const cy = (b.top + b.bottom) / 2, hh = Math.min(b.height, fs0 * 0.9) / 2;
        return { l: b.left - sr.left, r: b.right - sr.left, t: cy - hh - sr.top, b: cy + hh - sr.top };
      });
      if (!lines.length) return;
      const rect = { l: Math.min(...lines.map(x => x.l)), r: Math.max(...lines.map(x => x.r)), t: Math.min(...lines.map(x => x.t)), b: Math.max(...lines.map(x => x.b)) };
      const cls = e.className || '';
      const kind = /\bcaption\b/.test(cls) ? 'caption' : /\bhud\b|\bfoot\b/.test(cls) ? 'hud' : /\bplabel\b/.test(cls) ? 'plabel' : /\bkicker\b/.test(cls) ? 'kicker' : /\bqmark\b/.test(cls) ? 'qmark' : 'text';
      texts.push({ e, rect, lines, kind, fs: fs0, txt: e.textContent.trim().slice(0, 16) });
    });
    const tol = 2;
    for (const x of texts) {
      const { rect: q, e } = x;
      if (x.kind !== 'plabel' && (q.l < L - tol || q.r > RT + tol)) out.push({ rule: '超出版心', text: x.txt, l: Math.round(q.l), r: Math.round(q.r), bound: [Math.round(L), Math.round(RT)] });
      if (e.style.width && e.scrollWidth > e.clientWidth + tol) out.push({ rule: '溢出自身盒子', text: x.txt, need: e.scrollWidth, box: e.clientWidth });
      const p = e.closest('.panel');
      if (p) { const pr = p.getBoundingClientRect(); const P_ = { l: pr.left - sr.left, t: pr.top - sr.top, r: pr.right - sr.left, b: pr.bottom - sr.top };
        if (q.l < P_.l - tol || q.r > P_.r + tol || q.t < P_.t - tol || q.b > P_.b + tol) out.push({ rule: '溢出面板', text: x.txt }); }
      if (x.kind === 'text' && q.b > SAFE + tol) out.push({ rule: '进入字幕区', text: x.txt, bottom: Math.round(q.b), safe: Math.round(SAFE) });
      if (pg && x.kind !== 'plabel' && x.kind !== 'hud') {
        const ox = Math.min(q.r, pg.x + pg.w) - Math.max(q.l, pg.x), oy = Math.min(q.b, pg.y + pg.h) - Math.max(q.t, pg.y);
        if (ox > tol && oy > tol) out.push({ rule: '压到人物框', text: x.txt });
      }
      const lim = (x.kind === 'hud' || x.kind === 'kicker' || x.kind === 'plabel') ? MINF_HUD : MINF;
      if (x.fs < lim - 0.01) out.push({ rule: '字号过小', text: x.txt, px: Math.round(x.fs * 10) / 10, min: Math.round(lim * 10) / 10 });
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.kind === 'qmark' || b.kind === 'qmark' || a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const area = r => (r.r - r.l) * (r.b - r.t);
      let hit = false;
      for (const la of a.lines) for (const lb of b.lines) {
        const ox = Math.min(la.r, lb.r) - Math.max(la.l, lb.l), oy = Math.min(la.b, lb.b) - Math.max(la.t, lb.t);
        if (ox > tol && oy > tol && ox * oy > 0.08 * Math.min(area(la), area(lb))) hit = true;
      }
      if (hit) out.push({ rule: '文字互压', text: a.txt + ' × ' + b.txt });
    }
    return { control: sh.control, mode: sh.mode, texts: texts.length, violations: out };
  };

  window.STYLE = S;
  const load = async () => {
    if (!document.fonts) return;
    const extra = [...new Set([TY.titleFamily, TY.bodyFamily, TY.monoFamily].filter(Boolean))];
    await Promise.all([
      ...extra.map(f => document.fonts.load(`900 100px "${f}"`, '口播风格ABC0123')),
      document.fonts.load(`900 100px "KB Sans"`, '口播风格'),
      document.fonts.load(`700 100px "KB Mono"`, '0123456789'),
      document.fonts.load(`500 24px "KB Mono"`, 'ABC0123'),
    ]).catch(() => {});
    await document.fonts.ready;
  };
  window.READY = load();
})();
