---
name: 68-mini-film-vlog
description: 按抖音高赞「氛围感 · mini vlog」类 vlog 提炼的 vlog 剪辑风格「氛围 mini 片」：横屏 16:9，0.5 秒一刀全程卡拍，穿插倾斜的白边相框镜头，左上衬线「MINI VLOG.」角标，胶片颗粒和暗角，15 秒左右。 当用户丢来一组 iPhone 原始素材（可带口播或旁白）要剪氛围感、citywalk、周末碎片、旅行花絮、清空相册素材、mini vlog 模板、或点名 68-mini-film-vlog 时使用。
---

# 氛围 mini 片

横屏 16:9 / 帧率跟素材走，3 个文字模板，参数全部在 `style.json`。

## 什么时候用
- 用户要剪「氛围感 · mini vlog」这一类 vlog：氛围感、citywalk、周末碎片、旅行花絮、清空相册素材、mini vlog 模板
- 需要 横屏 16:9，0.5 秒一刀全程卡拍，穿插倾斜的白边相框镜头，左上衬线「MINI VLOG.」角标，胶片颗粒和暗角，15 秒左右。

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
- `assets/sample.mp4`：样板视频（12.1s，21 段）。画面是 AI 生成的**无人物空镜**做成的手持推拉片段，环境声和配乐是程序合成，不含任何真人画面或真人声音。只用来看效果，不是素材。
- `assets/sample.gif`：样板视频的动图预览（约 5 秒一圈），用于仓库首页。

## 节奏（自动）
剪辑单里每段只给**可用区间**（`in`/`out`），剪点交给引擎：按节奏型 [1.0, 1.0, 0.5, 1.0, 1.5, 0.5, 1.0, 2.0] × 基准 0.5s 分配时长、在区间里挑动作最饱满的一截（避开说话）、长素材拆跳切、剪点卡拍、字幕读不完自动跨镜头。每段可用 `role`（hook / fast / breath / detail）、`len`、`lock` 微调，见 `references/03-剪辑单.md`。

## 剪法（写剪辑单时照着做）
1. **画幅**：横屏 16:9（竖拍素材会被裁成横的，挑主体在中间的段落）。
2. **全程卡拍**：每段先写 0.5–0.7 秒，引擎对齐到节拍（124 BPM 约 0.48 秒一刀）；同一段素材可以取两个不同的入点用两次。15 秒左右放 25–35 刀。
3. **白边相框**：每 4–5 刀插一段 `"inset": true`（可加 `tilt` ±2°），画面缩小贴在米白底上，像贴照片。
4. **字**：几乎不放字幕。常驻左上「MINI VLOG.」和底部日期（`badge_vals.date`）；个别镜头可以用 `word` 放一个英文小词（右下角斜体）。
5. **调色**：胶片感（褪色黑位、略降饱和、暖高光）、颗粒 9、暗角。
6. **收尾**：最后一段拉长到 1.5–2.5 秒，`end` 写一句英文（斜体），整片淡出。

## 模板
`badge`, `word`, `end`

字段与写法见 `references/02-模板.md`。

## 令牌（改风格只改这里）
- 画布 横屏 16:9，横拍素材进竖屏 `fit`：cover
- 调色 `eq=contrast=1.04:saturation=0.9:gamma=1.02,colorbalance=rs=0.03:bs=-0.02:rh=0.03:bm=0.02,curves=all='0/0.05 0.5/0.5 1/0.95'` · 颗粒 9 · 暗角 PI/5
- 剪映滤镜 胶片电影 50
- 转场默认 `cut`；卡点 每 0.5 拍
- 声音：原声 0.0 · 配乐 1.0 · 整体 -14 LUFS
- 默认配乐：程序合成 `bright`（只适合打样，正式发布换成有授权的音乐）

## 动效、转场与音效
- 字幕和标签入场用 上浮 / 淡入，出场淡出 0.18s。
- 有转场的剪点，成片里上一段尾巴叠进下一段开头，剪点位置和剪映草稿一致；剪映里对应 叠化 / 闪白 / 闪黑 等剪映内置转场。
- 卡点风格：引擎把每个剪点挪到最近的节拍上（只改出点，不超出素材长度）；剪辑单写 `"snap": false` 关掉。
- 有旁白时配乐用侧链自动压低；旁白撞上下一句时自动加长画面（以音频为轴）。

## 调研依据
- mini vlog 模板 [7684741312528488939](https://www.douyin.com/video/7684741312528488939)（69.7 万赞，11.5 万收藏，收藏率 16.5%）：14.6 秒 35 刀，中位 0.3 秒，前 3 秒切 14 刀；横屏；部分镜头缩成白边相框；只有小号衬线角标「MINI VLOG.」
- 燥感旅行 [7706165562585435392](https://www.douyin.com/video/7706165562585435392)：15 秒纯卡点，平均 0.46 秒一刀
- 标题写「提前存好，可以用来清空你的素材」——可套用本身就是卖点

完整调研（20 条样本的镜头数、镜头时长、响度、文案）：`references/调研出处.md`。只学结构和节奏，没有用样本的画面、音乐和文案。

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
