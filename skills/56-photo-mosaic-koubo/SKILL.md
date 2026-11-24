---
name: 56-photo-mosaic-koubo
description: 按「照片马赛克 · 画面揭晓」参考片提炼的口播剪辑风格：深海蓝底 + 四周密、中间疏的小方格 + 橙色点睛，由碎片拼出答案。当用户要做照片马赛克 · 画面揭晓风格口播、或点名 56-photo-mosaic-koubo 时使用。
---

# 照片马赛克 · 画面揭晓

1920×1080 / 30fps，7 个控件，令牌全部在 `style.json`。

## 什么时候用
- 用户要「照片马赛克 · 画面揭晓」这一类的口播成片
- 需要 深海蓝底 + 四周密、中间疏的小方格 + 橙色点睛，由碎片拼出答案

## 安装
- 全包（约 12 MB）：解压即用，只需 `cd scripts/engine && npm ci`。
- 轻包（≤2 MB，`*-light.zip`）：多一步联网补字体——`cd scripts/engine && npm ci && cd ../.. && node scripts/setup_light.mjs`（从 google/fonts 固定提交下载 Noto Sans SC，sha256 校验，和全包同一份文件）。

## 三步出片
```sh
# 0) 先按口播素材里的人物算人物框裁切（人脸检测；素材比人物框窄时会加高人物框）
#    python3 scripts/person_fit.py 口播.mp4 --out examples/presenter-fit.json
#    镜头表与 draft.json 的 presenter 都写 "fit": "presenter-fit.json"
# 0.5) 写完镜头表先过版面审计（像素级：越界/压字/压人物/字号过小 → exit 1）
#    node scripts/engine/render.mjs audit <实例目录>
# 1) 写镜头表（参考 examples/shots-控件演示.json）
node scripts/engine/render.mjs build examples/shots-试排.json examples/inst-试排
node scripts/engine/render.mjs render examples/inst-试排 examples/layer.mp4

# 2) 出剪映草稿（人物 + 口播 + 原生字幕）
python3 scripts/build_jianying_draft.py examples/draft.json <新草稿目录>

# 3) 登记进剪映（先退出剪映）
python3 scripts/sync_draft.py <草稿目录> --root "$HOME/Movies/JianyingPro/User Data/Projects/com.lveditor.draft" \
  --registry "$HOME/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/root_meta_info.json"
```

## 风格图与样板视频
- `assets/preview.png`：风格图（本 skill 引擎真跑的 5–6 张示例帧拼版，人物位为灰色占位）。
- `assets/sample.mp4`：样板视频（19.3s，段子「渣男测试」逐句排版：提问 → 怎么测 → 方法 → 结论 → 揭晓；人物位是程序绘制的无五官虚拟主播、声音是合成配音，不含任何真人）。只用来看效果，不是素材。
- `assets/sample.gif`：样板视频的动图预览（每镜取动画落定后的帧，约 5 秒一圈），用于仓库首页。

## 控件
`opener`, `grid`, `counter`, `statement`, `imageSlot`, `reveal`, `outro`

## 令牌（改风格只改这里）
- 底色 `#e9f0f8` / `#0b2548`，墨色 `#0f2440` / `#eef5ff`
- 强调色 `#c4541a`（暗底 `#ff9a52`）
- 标题 0.064 短边、开场 0.092
- 底纹 `mosaic`，标题式 `plain`，面板 `glass`
- 入场 `pop`，间隔 0.08s
- 人物 card / solid，框体见 `style.json`

## 动效、转场与音效
- 标题从自身基线下方「顶」出来（遮罩上浮）；卡片类入场带轻微过冲；`*重点*` 的呈现是 `underline`（`underline` 划线 / `marker` 马克笔底 / `none` 只变色，改 `style.json#look.highlight`）。
- 亮暗切换的镜头，新底色按 `按入场方式自动` 擦入（`style.json#motion.cut`：`up` / `wipe` / `iris` / `fade` / `cut`）；同底色的镜头只换内容，切镜不闪黑。
- 动作音效：音色包 `tech`（`style.json#sfx.kit`，可选 paper / tech / poster / soft / film / chalk / game / glitch）。切镜一声、条目和卡片各一声、巨字和数字落定一声重音，时刻由画面入场时刻算出，不用手排。
  - 声音由 `scripts/engine/sfx.mjs` 现场合成，不带任何音频素材。峰值约 −15 dBFS，比口播低很多。
  - 动效层 mp4 自带这条音轨，草稿生成器会把它放进剪映的「音效」轨，可在剪映里单独调音量或静音；也可在草稿 spec 里写 `graphics.sfxVolume`。
  - 不要音效：`style.json#sfx.enabled` 改成 `false`。只想导出音效：`node scripts/engine/render.mjs sfx <实例目录> out.wav`。
- 带底纹的风格，字幕后面的底纹会淡出成底色（字幕带净空），字幕不被线条和网点穿过。
- 字幕一行放不下时优先在标点处断成两行，没有合适标点就对半断，不会出现末行只剩一个字。

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
