---
name: 22-industry-work-koubo
description: 按「工作 · 三行周报」参考片提炼的口播剪辑风格：工作类：亮底细网格 + 窗口面板，步骤流为主轴。当用户要做工作 · 三行周报风格口播、或点名 22-industry-work-koubo 时使用。
---

# 工作 · 三行周报

1080×1920 / 30fps，10 个控件，令牌全部在 `style.json`。

## 什么时候用
- 用户要「工作 · 三行周报」这一类的口播成片
- 需要 工作类：亮底细网格 + 窗口面板，步骤流为主轴

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
`opener`, `statement`, `steps`, `banner`, `reveal`, `list`, `chapter`, `counter`, `imageSlot`, `outro`

## 令牌（改风格只改这里）
- 底色 `#f4f5f6` / `#07090c`，墨色 `#101418` / `#e8edf2`
- 强调色 `#2f66e8`（暗底 `#5f8ff5`）
- 标题 0.062 短边、开场 0.088
- 底纹 `hairline`，标题式 `tagged`，面板 `paper`
- 入场 `wipe`，间隔 0.12s
- 人物 card / solid，框体见 `style.json`

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
