---
name: 67-timestamp-day-vlog
description: 按抖音高赞「上班 · 学习」类 vlog 提炼的 vlog 剪辑风格「一天时间线」：开头 2 秒高光快闪 + 打字机「24H」，大号时间 + 小号事件两行居中，按时间推进卡着节拍切，左上 REC 时间角标，告别语收尾。 当用户丢来一组 iPhone 原始素材（可带口播或旁白）要剪上班、上学、学习、备考、打工人的一天、实习、自律 vlog、或点名 67-timestamp-day-vlog 时使用。
---

# 一天时间线

竖屏 9:16 / 帧率跟素材走，4 个文字模板，参数全部在 `style.json`。

## 什么时候用
- 用户要剪「上班 · 学习」这一类 vlog：上班、上学、学习、备考、打工人的一天、实习、自律 vlog
- 需要 开头 2 秒高光快闪 + 打字机「24H」，大号时间 + 小号事件两行居中，按时间推进卡着节拍切，左上 REC 时间角标，告别语收尾。

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
- `assets/sample.mp4`：样板视频（22.5s，14 段）。画面是 AI 生成的**无人物空镜**做成的手持推拉片段，环境声和配乐是程序合成，不含任何真人画面或真人声音。只用来看效果，不是素材。
- `assets/sample.gif`：样板视频的动图预览（约 5 秒一圈），用于仓库首页。

## 节奏（自动）
剪辑单里每段只给**可用区间**（`in`/`out`），剪点交给引擎：按节奏型 [1.0, 0.55, 1.3, 0.6, 1.8, 0.5] × 基准 1.6s 分配时长、在区间里挑动作最饱满的一截（避开说话）、长素材拆跳切、剪点卡拍、字幕读不完自动跨镜头。每段可用 `role`（hook / fast / breath / detail）、`len`、`lock` 微调，见 `references/03-剪辑单.md`。

## 剪法（写剪辑单时照着做）
1. **高光开头**：前 3–4 段写 `role: fast`（约 0.6 秒一刀），挑当天最好看的画面（会议室的夕阳、咖啡、夜景），叠 `opener`（打字机打出「24H」或「DAY 1」，`sub` 一句主题）。
2. **时间线**：之后每段写 `stamp`（大号 DIN 时间）+ `text`（事件，12 字以内），严格按时间先后；自动节奏中位约 1.2 秒一刀，长素材自动拆跳切，字幕读不完会跨到后面的镜头。
3. **学习/工作沉浸段**：想表现专注时，单段可以拉长到 5–8 秒并关掉卡点（剪辑单 `"snap": false`），原声 `vol` 拉高（翻书、键盘声）。
4. **角标**：左上角 REC 红点 + 日期常驻，日期写在 `badge_vals.date`。
5. **收尾**：最后一段写告别语（「下个 vlog 见」「晚安」）。
6. **调色**：干净偏冷白，不要胶片感。

## 模板
`stamp_caption`, `caption`, `rec`, `opener`

字段与写法见 `references/02-模板.md`。

## 令牌（改风格只改这里）
- 画布 竖屏 9:16，横拍素材进竖屏 `fit`：cover
- 调色 `eq=contrast=1.03:saturation=0.95:gamma=1.01,colorbalance=rs=-0.02:bs=0.03:rh=-0.01:bh=0.02`
- 剪映滤镜 冷白 40
- 转场默认 `cut`；卡点 每 1 拍
- 声音：原声 0.3 · 配乐 0.75 · 整体 -14 LUFS
- 默认配乐：程序合成 `tick`（只适合打样，正式发布换成有授权的音乐）

## 动效、转场与音效
- 字幕和标签入场用 上浮 / 打字机 / 淡入，出场淡出 0.18s。
- 有转场的剪点，成片里上一段尾巴叠进下一段开头，剪点位置和剪映草稿一致；剪映里对应 叠化 / 闪白 / 闪黑 等剪映内置转场。
- 卡点风格：引擎把每个剪点挪到最近的节拍上（只改出点，不超出素材长度）；剪辑单写 `"snap": false` 关掉。
- 有旁白时配乐用侧链自动压低；旁白撞上下一句时自动加长画面（以音频为轴）。

## 调研依据
- 上班 vlog [7710564012765620337](https://www.douyin.com/video/7710564012765620337)（41.1 万赞）：前 5 秒先快闪当天最好看的几个画面，再从「7:30 / 睡到自然醒」开始；时间戳和事件两行居中；结尾「21:35 下个 vlog 再见」
- 凌晨学习 [7663034872122329841](https://www.douyin.com/video/7663034872122329841)（10.4 万赞）：学习类反过来用长镜头（平均 8 秒），几乎只有环境声
- 年度 vlog [7672710335841241531](https://www.douyin.com/video/7672710335841241531)：取景框 REC 叠层

完整调研（20 条样本的镜头数、镜头时长、响度、文案）：`references/调研出处.md`。只学结构和节奏，没有用样本的画面、音乐和文案。

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
