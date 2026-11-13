---
name: 08-paper-perspective-portrait-koubo
description: 按「纸面观点 · 竖屏版」参考片提炼的口播剪辑风格：米白纸底竖屏，人物改右上圆框。当用户要做纸面观点 · 竖屏版风格口播、或点名 08-paper-perspective-portrait-koubo 时使用。
---

# 纸面观点 · 竖屏版

1080×1920 / 30fps，9 个控件，令牌全部在 `style.json`。

## 什么时候用
- 用户要「纸面观点 · 竖屏版」这一类的口播成片
- 需要 米白纸底竖屏，人物改右上圆框

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

## 控件
`opener`, `statement`, `list`, `steps`, `grid`, `quote`, `banner`, `reveal`, `outro`

## 令牌（改风格只改这里）
- 底色 `#eeeee6` / `#0d1411`，墨色 `#14120e` / `#f2f0e6`
- 强调色 `#0f5c46`（暗底 `#18b89e`）
- 标题 0.068 短边、开场 0.098
- 底纹 `paper`，标题式 `underline`，面板 `paper`
- 入场 `settle`，间隔 0.16s
- 人物 card / duotone，框体见 `style.json`

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
