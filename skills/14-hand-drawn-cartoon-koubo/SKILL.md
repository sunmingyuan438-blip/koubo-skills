---
name: 14-hand-drawn-cartoon-koubo
description: 按「手绘卡通 · 横屏版」参考片提炼的口播剪辑风格：米黄纸 + 手绘描边 + 橙色重点。当用户要做手绘卡通 · 横屏版风格口播、或点名 14-hand-drawn-cartoon-koubo 时使用。
---

# 手绘卡通 · 横屏版

1920×1080 / 30fps，9 个控件，令牌全部在 `style.json`。

## 什么时候用
- 用户要「手绘卡通 · 横屏版」这一类的口播成片
- 需要 米黄纸 + 手绘描边 + 橙色重点

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

## 控件
`opener`, `statement`, `list`, `steps`, `grid`, `quote`, `banner`, `reveal`, `outro`

## 令牌（改风格只改这里）
- 底色 `#fdf6e3` / `#22201c`，墨色 `#22201c` / `#fdf6e3`
- 强调色 `#e2762b`（暗底 `#f59a4e`）
- 标题 0.084 短边、开场 0.112
- 底纹 `none`，标题式 `underline`，面板 `paper`
- 入场 `pop`，间隔 0.2s
- 人物 card / sketch，框体见 `style.json`

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
