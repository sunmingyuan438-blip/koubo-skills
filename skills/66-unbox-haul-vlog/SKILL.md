---
name: 66-unbox-haul-vlog
description: 按抖音高赞「开箱 · 好物」类 vlog 提炼的 vlog 剪辑风格「开箱快闪」：开头把所有物件 0.5 秒一个快闪一遍，淡紫圆角气泡字幕，编号 + 名字 + 价格的卡片，一件一段，明亮偏白，全家福收尾。 当用户丢来一组 iPhone 原始素材（可带口播或旁白）要剪开箱、拆快递、好物分享、购物分享、桌面改造、家居好物 vlog、或点名 66-unbox-haul-vlog 时使用。
---

# 开箱快闪

竖屏 9:16 / 帧率跟素材走，4 个文字模板，参数全部在 `style.json`。

## 什么时候用
- 用户要剪「开箱 · 好物」这一类 vlog：开箱、拆快递、好物分享、购物分享、桌面改造、家居好物 vlog
- 需要 开头把所有物件 0.5 秒一个快闪一遍，淡紫圆角气泡字幕，编号 + 名字 + 价格的卡片，一件一段，明亮偏白，全家福收尾。

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
- `assets/sample.mp4`：样板视频（23.4s，13 段）。画面是 AI 生成的**无人物空镜**做成的手持推拉片段，环境声和配乐是程序合成，不含任何真人画面或真人声音。只用来看效果，不是素材。
- `assets/sample.gif`：样板视频的动图预览（约 5 秒一圈），用于仓库首页。

## 节奏（自动）
剪辑单里每段只给**可用区间**（`in`/`out`），剪点交给引擎：按节奏型 [1.0, 0.55, 1.5, 0.7, 2.0, 0.6] × 基准 1.5s 分配时长、在区间里挑动作最饱满的一截（避开说话）、长素材拆跳切、剪点卡拍、字幕读不完自动跨镜头。每段可用 `role`（hook / fast / breath / detail）、`len`、`lock` 微调，见 `references/03-剪辑单.md`。

## 剪法（写剪辑单时照着做）
1. **快闪开头**：前 4–6 段写 `role: fast`（约 0.5 秒一刀），把这次所有物件各闪一下（取最好看的角度），叠 `opener`（在顶层 `overlays` 里，`text` 主题，`sub` 一句补充）。
2. **拆箱**：快递盒 → 拆开，各一段，`text` 写一句。
3. **一件一段**：每件 2.5–4 秒（可以拆成整体 + 细节两段），第一段写 `no`（编号）、`name`（名字，6 字以内）、`price`（价格），卡片在左上角弹出；`text` 写一个卖点（淡紫气泡，y≈0.79）。
4. **对比**：有改造前后的，前后各一段，进入「之后」那段用闪白。
5. **声音**：原声 0.9（撕胶带、拆纸、按键声），配乐 0.45。有口播把那段 `vol` 设 1。
6. **调色**：明亮、干净、偏白，不要暖黄。
7. **收尾**：所有东西摆在一起的全家福，`end` 写「本期 N 件 · 共 ¥xxx」+ 一句互动（`sub`）。

## 模板
`opener`, `caption`, `tag`, `end`

字段与写法见 `references/02-模板.md`。

## 令牌（改风格只改这里）
- 画布 竖屏 9:16，横拍素材进竖屏 `fit`：cover
- 调色 `eq=brightness=0.025:contrast=1.02:saturation=1.04:gamma=1.05,colorbalance=bs=0.02:bh=0.02`
- 剪映滤镜 清透感 50
- 转场默认 `cut`；卡点 每 1 拍
- 声音：原声 0.9 · 配乐 0.45 · 整体 -14 LUFS
- 默认配乐：程序合成 `pop`（只适合打样，正式发布换成有授权的音乐）

## 动效、转场与音效
- 字幕和标签入场用 弹出 / 淡入，出场淡出 0.18s。
- 有转场的剪点，成片里上一段尾巴叠进下一段开头，剪点位置和剪映草稿一致；剪映里对应 叠化 / 闪白 / 闪黑 等剪映内置转场。
- 卡点风格：引擎把每个剪点挪到最近的节拍上（只改出点，不超出素材长度）；剪辑单写 `"snap": false` 关掉。
- 有旁白时配乐用侧链自动压低；旁白撞上下一句时自动加长画面（以音频为轴）。

## 调研依据
- 家居开箱 [7672369361038211833](https://www.douyin.com/video/7672369361038211833)：前 6 秒把所有物件每个约 0.7 秒快闪一遍，配「欢迎收看我的……开箱」；淡紫色圆角小气泡字幕；最后是全家福平铺；原声拆箱声加轻音乐
- 神级好物 [7698290185972659045](https://www.douyin.com/video/7698290185972659045)（13.5 万赞）：一件一段，整体 → 细节 → 用起来；标题条一直挂着
- 开箱类平均镜头 3.7 秒，比生活记录慢，要让观众看清东西

完整调研（20 条样本的镜头数、镜头时长、响度、文案）：`references/调研出处.md`。只学结构和节奏，没有用样本的画面、音乐和文案。

## 文档
`references/01-风格规范.md` … `06-检查与踩坑.md`；示例在 `examples/`。
