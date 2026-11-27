---
name: 64-food-bite-vlog
description: 按抖音高赞「美食 · 探店」类 vlog 提炼的 vlog 剪辑风格「一口一镜」：成品先行的钩子，黑底白字食材标签，原声 ASMR 加轻声旁白，一口一镜，暖色提饱和，空碗收尾。 当用户丢来一组 iPhone 原始素材（可带口播或旁白）要剪探店、美食、做饭、吃播、夜宵、一个人吃饭的 vlog、或点名 64-food-bite-vlog 时使用。
---

# 一口一镜

竖屏 9:16 / 帧率跟素材走，4 个文字模板，参数全部在 `style.json`。

## 什么时候用
- 用户要剪「美食 · 探店」这一类 vlog：探店、美食、做饭、吃播、夜宵、一个人吃饭的 vlog
- 需要 成品先行的钩子，黑底白字食材标签，原声 ASMR 加轻声旁白，一口一镜，暖色提饱和，空碗收尾。

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
- `assets/sample.mp4`：样板视频（19.4s，9 段，旁白是 Fish 公共音色）。画面是 AI 生成的**无人物空镜**做成的手持推拉片段，环境声和配乐是程序合成，不含任何真人画面或真人声音。只用来看效果，不是素材。
- `assets/sample.gif`：样板视频的动图预览（约 5 秒一圈），用于仓库首页。

## 节奏（自动）
剪辑单里每段只给**可用区间**（`in`/`out`），剪点交给引擎：按节奏型 [1.0, 0.5, 1.2, 0.55, 0.5, 1.7, 0.8] × 基准 1.4s 分配时长、在区间里挑动作最饱满的一截（避开说话）、长素材拆跳切、剪点卡拍、字幕读不完自动跨镜头。每段可用 `role`（hook / fast / breath / detail）、`len`、`lock` 微调，见 `references/03-剪辑单.md`。

## 剪法（写剪辑单时照着做）
1. **第一段放最好吃的那一口或成品**，叠一句钩子标题（`title` 用 `hook` 模板，两行以内），再从门头/备料开始讲。
2. **一口一镜**：夹起 → 特写 → 一句评价；自动节奏中位约 1 秒一刀，特写用 `role: detail` 挑稳的一截，吃的那口用 `role: breath` 留长。
3. **两种字：** 食材、做法、价格这类信息用 `tag`（黑底白字小标签，画面下方，可以用 / 分隔）；旁白自动出字幕（白字深棕描边，y≈0.75，一屏不超过 13 字）。价格角标用 `price`。
4. **声音**：原声默认 1.0（滋滋声、咀嚼、店里的嘈杂就是氛围），配乐压到 0.28，有旁白时再自动压低。旁白像跟朋友聊天，每句 15 字以内。
5. **调色**：暖色、提饱和、轻锐化，食物高光要亮。
6. **收尾**：空碗、最后一口汤、喝一口饮料。

## 模板
`hook`, `caption`, `tag`, `price`

字段与写法见 `references/02-模板.md`。

## 令牌（改风格只改这里）
- 画布 竖屏 9:16，横拍素材进竖屏 `fit`：cover
- 调色 `eq=saturation=1.18:contrast=1.05:gamma=0.98,colorbalance=rm=0.04:bm=-0.04:rh=0.03:bh=-0.02,unsharp=5:5:0.35`
- 剪映滤镜 美食增色 60
- 转场默认 `cut`；卡点 每 1 拍
- 声音：原声 1.0 · 配乐 0.28 · 旁白 1.0 · 整体 -14 LUFS
- 默认配乐：程序合成 `pop`（只适合打样，正式发布换成有授权的音乐）；旁白默认 Fish 公共音色「活力女声」

## 动效、转场与音效
- 字幕和标签入场用 弹出 / 上浮 / 淡入，出场淡出 0.18s。
- 有转场的剪点，成片里上一段尾巴叠进下一段开头，剪点位置和剪映草稿一致；剪映里对应 叠化 / 闪白 / 闪黑 等剪映内置转场。
- 卡点风格：引擎把每个剪点挪到最近的节拍上（只改出点，不超出素材长度）；剪辑单写 `"snap": false` 关掉。
- 有旁白时配乐用侧链自动压低；旁白撞上下一句时自动加长画面（以音频为轴）。

## 调研依据
- 牛肉汤饭和炸虾 [7694102836821631680](https://www.douyin.com/video/7694102836821631680)（36.6 万赞，6.3 万收藏）：前 6 秒先放成品，再倒回备料；82 刀中位 1.37 秒；黑底白字小标签列食材；几乎不说话，靠切菜下锅的原声
- 胡同里的关东煮 [7700172718738526287](https://www.douyin.com/video/7700172718738526287)（16.8 万赞）：开头街景一句「天冷又到了吃关东煮的季节」；一口一镜；旁白每秒 5 字左右，白字深色描边在下方；喝一口饮料收尾
- 剪辑全流程教程 [7676812778783700209](https://www.douyin.com/video/7676812778783700209)（5.3 万收藏）：吃饭要拍店内环境、食物特写、吃的画面、评价四个角度

完整调研（20 条样本的镜头数、镜头时长、响度、文案）：`references/调研出处.md`。只学结构和节奏，没有用样本的画面、音乐和文案。

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
