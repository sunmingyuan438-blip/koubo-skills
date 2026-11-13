---
name: 47-museum-timeline-koubo
description: 按「博物馆年表 · 知识讲解」参考片提炼的口播剪辑风格：墨绿展墙 + 金色挂画线与年表刻度 + 米色展签面板，逐件展品讲过去。当用户要做博物馆年表 · 知识讲解风格口播、或点名 47-museum-timeline-koubo 时使用。
---

# 博物馆年表 · 知识讲解

1920×1080 / 30fps，9 个控件，令牌全部在 `style.json`。

## 什么时候用
- 用户要「博物馆年表 · 知识讲解」这一类的口播成片
- 需要 墨绿展墙 + 金色挂画线与年表刻度 + 米色展签面板，逐件展品讲过去

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
`opener`, `chapter`, `steps`, `statement`, `counter`, `quote`, `banner`, `reveal`, `outro`

## 令牌（改风格只改这里）
- 底色 `#efe6cf` / `#1f3d33`，墨色 `#2a2418` / `#f1e8cf`
- 强调色 `#7a5a1c`（暗底 `#d9bd6f`）
- 标题 0.078 短边、开场 0.106
- 底纹 `wall`，标题式 `underline`，面板 `paper`
- 入场 `settle`，间隔 0.22s
- 人物 card / duotone，框体见 `style.json`

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
