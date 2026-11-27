---
name: 65-travel-poster-vlog
description: 按抖音高赞「旅行 · 城市漫游」类 vlog 提炼的 vlog 剪辑风格「旅行大字」：宋体大字地名片头，中英双语字幕加橙色关键词块，卡着节拍 1 秒左右一刀，青橙调色，「下一站」收尾。 当用户丢来一组 iPhone 原始素材（可带口播或旁白）要剪旅行、城市漫游、出差顺路逛、周末短途、旅居 vlog、或点名 65-travel-poster-vlog 时使用。
---

# 旅行大字

竖屏 9:16 / 帧率跟素材走，5 个文字模板，参数全部在 `style.json`。

## 什么时候用
- 用户要剪「旅行 · 城市漫游」这一类 vlog：旅行、城市漫游、出差顺路逛、周末短途、旅居 vlog
- 需要 宋体大字地名片头，中英双语字幕加橙色关键词块，卡着节拍 1 秒左右一刀，青橙调色，「下一站」收尾。

## 安装
- 依赖：macOS、ffmpeg（9.x）、Python 3 + Pillow + numpy + scipy + pymediainfo。剪映草稿库（pyJianYingDraft，Apache-2.0）随包在 `scripts/vendor/`。
- 字体 Noto Sans SC（OFL，17.7 MB）：从 GitHub 拿到的轻包要先补一次 `python3 scripts/setup_fonts.py`（固定提交下载并校验 sha256）；已经有的会跳过。
- 旁白合成要 Fish Audio 密钥（`FISH_AUDIO_API_KEY`）；没有时退回 macOS `say`，只适合打样。

## 三步出片
```sh
# 0) 盘点素材：分辨率/帧率/HDR/响度 + 每段 6 帧缩略图条（带口播加 --asr）
python3 scripts/scan.py <素材目录>

# 1) 写剪辑单（参考 examples/plan.json，字段见 references/03-剪辑单.md），先出 540 宽预览看节奏
python3 scripts/vlog_engine.py plan.json --preview
python3 scripts/contact.py 输出/<名字>_预览.mp4        # 抽帧拼图，查字幕位置

# 2) 出成片 + 剪映草稿（成片跟素材同规格：iPhone 4K60 HLG 就输出 4K60 HLG，不降画质）
python3 scripts/vlog_engine.py plan.json --export --draft

# 3) 登记进剪映（先退出剪映）
python3 scripts/sync_draft.py <草稿目录> --root "$HOME/Movies/JianyingPro/User Data/Projects/com.lveditor.draft" \
  --registry "$HOME/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/root_meta_info.json"
```

## 风格图与样板视频
- `assets/preview.png`：风格图（样板成片的 3 帧 + 剪法要点）。
- `assets/sample.mp4`：样板视频（18.9s，10 段，旁白是 Fish 公共音色）。画面是 AI 生成的**无人物空镜**做成的手持推拉片段，环境声和配乐是程序合成，不含任何真人画面或真人声音。只用来看效果，不是素材。
- `assets/sample.gif`：样板视频的动图预览（约 5 秒一圈），用于仓库首页。

## 节奏（自动）
剪辑单里每段只给**可用区间**（`in`/`out`），剪点交给引擎：按节奏型 [1.0, 0.6, 1.4, 0.6, 0.6, 2.0, 0.8] × 基准 1.3s 分配时长、在区间里挑动作最饱满的一截（避开说话）、长素材拆跳切、剪点卡拍、字幕读不完自动跨镜头。每段可用 `role`（hook / fast / breath / detail）、`len`、`lock` 微调，见 `references/03-剪辑单.md`。

## 剪法（写剪辑单时照着做）
1. **片头**：第一段放最开阔的风景，叠地名大字（`title` 用 `place` 模板：`text` 地名 4 字以内、`en` 英文名、`sub` 日期或 DAY 几），停 3 秒左右。
2. **快切卡拍**：每段 1–2 秒，引擎把剪点对齐到配乐节拍（`pace.snap=1`）。路上镜头可以更短，重点画面（咖啡、日落）给 2–3 秒。
3. **双语字幕**：`text` 中文（宋体粗，y≈0.70）+ `en` 英文斜体小字；想强调的词放 `hl`（橙色块大字，压在字幕上方），一条片子用 2–3 次就够。
4. **转场**：基本硬切；换场景（上午→下午、城市→海边）时用一次 `"transition": "white"` 闪白。
5. **声音**：配乐为主（0.85），原声 0.15；旁白可选（公共音色「温柔叙事女声」），说态度不说流水账，`no_caption: true` 时只出段落字幕。
6. **调色**：青橙（暗部偏青、亮部偏暖）、对比和饱和略提，轻暗角。
7. **片尾**：最后一段夜景或日落，`end` 写「下一站 见」之类的告别，压在最后一段上。

## 模板
`place`, `caption`, `caption_en`, `kw`, `end`

字段与写法见 `references/02-模板.md`。

## 令牌（改风格只改这里）
- 画布 竖屏 9:16，横拍素材进竖屏 `fit`：cover
- 调色 `eq=contrast=1.08:saturation=1.12:gamma=0.99,colorbalance=rs=-0.04:gs=-0.01:bs=0.05:rh=0.05:gh=0.01:bh=-0.05` · 暗角 PI/6
- 剪映滤镜 青橙 55
- 转场默认 `cut`；卡点 每 1 拍
- 声音：原声 0.15 · 配乐 0.85 · 旁白 1.0 · 整体 -14 LUFS
- 默认配乐：程序合成 `cinematic`（只适合打样，正式发布换成有授权的音乐）；旁白默认 Fish 公共音色「温柔叙事女声」

## 动效、转场与音效
- 字幕和标签入场用 弹出 / 上浮 / 淡入，出场淡出 0.18s。
- 有转场的剪点，成片里上一段尾巴叠进下一段开头，剪点位置和剪映草稿一致；剪映里对应 叠化 / 闪白 / 闪黑 等剪映内置转场。
- 卡点风格：引擎把每个剪点挪到最近的节拍上（只改出点，不超出素材长度）；剪辑单写 `"snap": false` 关掉。
- 有旁白时配乐用侧链自动压低；旁白撞上下一句时自动加长画面（以音频为轴）。

## 调研依据
- 尼泊尔旅居 [7699696861678196081](https://www.douyin.com/video/7699696861678196081)（9.6 万赞）：80 刀中位 0.97 秒；中文字幕下面一行英文衬线小字；关键词放大加色块；旁白 3.6 字/秒，比口播慢，给音乐留位置
- 燥感旅行 [7706165562585435392](https://www.douyin.com/video/7706165562585435392)（8.7 万赞）：15 秒 34 刀纯卡点；色块超大字和城市名大字
- 年度 vlog [7672710335841241531](https://www.douyin.com/video/7672710335841241531)（20 万赞）：用标题卡开场

完整调研（20 条样本的镜头数、镜头时长、响度、文案）：`references/调研出处.md`。只学结构和节奏，没有用样本的画面、音乐和文案。

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
