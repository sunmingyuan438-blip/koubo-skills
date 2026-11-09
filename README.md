# 口播剪辑 Skill 合集（32 套）

把真人口播包装成不同视觉风格的短视频：每个 skill 自带渲染引擎、字体与控件，产出**可编辑的剪映草稿**（动效层、人物、口播、字幕分轨），也可直接导出 MP4。适用于 Claude Code / Codex 等支持 `SKILL.md` 的宿主。

## 安装（每个 skill 独立）

```sh
# 1. 把需要的 skill 目录复制到 ~/.claude/skills/
# 2. 安装渲染依赖（Playwright Chromium）
cd <skill>/scripts/engine && npm ci
# 3. 补齐大字体（Noto Sans SC，17.7 MB；从 google/fonts 固定提交下载并校验 sha256；支持代理，可用 KB_FONT_CACHE 指定本地缓存）
cd ../.. && node scripts/setup_light.mjs
```

需要：macOS（人物适配用 Vision 人脸检测）、Node 18+、Python 3.10+、ffmpeg。

## 工作流（每个 skill 的 SKILL.md 有详细说明）

1. 转写口播并人工核对字幕 → `cues.json`
2. `python3 scripts/person_fit.py 口播.mp4 --out presenter-fit.json`：按素材里的人物算人物框裁切（必要时加高人物框）
3. **按口播逐句**写镜头表（提问 → 方法 → 结论 → 揭晓），见 `examples/shots-控件演示.json`
4. `node scripts/engine/render.mjs build …` → `audit`（像素级版面审计：越界/压字/压人物/字号过小即报错）→ `render`
5. `python3 scripts/build_jianying_draft.py draft.json <新草稿目录>` → 登记进剪映（先退出剪映）

## 32 套风格

| skill | 风格 | 画幅 | 强调色 | 默认人物 | 控件数 | 标题字体 |
| --- | --- | --- | --- | --- | --- | --- |
| `01-paper-perspective-koubo` | 纸面观点 · 横屏版 | 1920×1080 | `#0f5c46` | card | 10 | Noto Sans SC |
| `02-tech-console-koubo` | 控制台 · 横屏版 | 1920×1080 | `#3f7fb8` | card | 9 | Noto Sans SC |
| `03-modern-editorial-koubo` | 现代编辑 · 竖屏版 | 1080×1920 | `#1049d8` | small | 10 | Noto Sans SC |
| `04-kinetic-tech-koubo` | 动态技术 · 竖屏版 | 1080×1920 | `#d8ff3e` | small | 6 | Noto Sans SC |
| `05-vibrant-poster-koubo` | 鲜活海报 · 竖屏版 | 1080×1920 | `#e8342c` | small | 9 | KB Condensed、KB Condensed |
| `06-vivid-characters-koubo` | 鲜活角色 · 竖屏版 | 1080×1920 | `#f0a23c` | card | 10 | Noto Sans SC |
| `07-modern-editorial-wide-koubo` | 现代编辑 · 横屏版 | 1920×1080 | `#1049d8` | small | 9 | Noto Sans SC |
| `08-paper-perspective-portrait-koubo` | 纸面观点 · 竖屏版 | 1080×1920 | `#0f5c46` | card | 9 | Noto Sans SC |
| `09-dark-dimensional-stage-koubo` | 深空多维舞台 · 竖屏版 | 1080×1920 | `#3b6cf0` | small | 9 | Noto Sans SC |
| `10-tech-console-portrait-koubo` | 控制台 · 竖屏版 | 1080×1920 | `#3f7fb8` | small | 8 | Noto Sans SC |
| `11-vibrant-poster-wide-koubo` | 鲜活海报 · 横屏版 | 1920×1080 | `#e8342c` | small | 9 | KB Condensed、KB Condensed |
| `12-vivid-characters-wide-koubo` | 鲜活角色 · 横屏版 | 1920×1080 | `#f0a23c` | small | 10 | Noto Sans SC |
| `13-dark-dimensional-stage-wide-koubo` | 深空多维舞台 · 横屏版 | 1920×1080 | `#3b6cf0` | small | 9 | Noto Sans SC |
| `14-hand-drawn-cartoon-koubo` | 手绘卡通 · 横屏版 | 1920×1080 | `#e2762b` | card | 9 | KB Round |
| `15-card-table-shuffle-koubo` | 卡牌桌 · 横屏版 | 1920×1080 | `#4878f0` | card | 10 | Noto Sans SC |
| `16-camera-mode-koubo` | 取景器 · 3:4 | 1080×1440 | `#2a6ee0` | card | 8 | Noto Sans SC |
| `17-beyond-the-frame-koubo` | 越界 · 3:4 | 1440×1920 | `#1f6ae0` | card | 10 | Noto Sans SC |
| `18-mac-desktop-koubo` | 桌面 · 4:3 | 1440×1080 | `#6f8ad6` | card | 9 | Noto Sans SC |
| `19-news-desk-koubo` | 新闻台 · 4:3 | 1440×1080 | `#d94a3d` | card | 10 | Noto Sans SC |
| `20-character-theater-koubo` | 角色剧场 · 横屏版 | 1920×1080 | `#2a6ee0` | card | 10 | Noto Sans SC |
| `21-industry-relationships-koubo` | 关系 · 一场对话复盘 | 1080×1920 | `#d95d78` | card | 10 | Noto Sans SC |
| `22-industry-work-koubo` | 工作 · 三行周报 | 1080×1920 | `#2f66e8` | card | 10 | Noto Sans SC |
| `23-industry-tech-koubo` | 科技 · 换机还是再等等 | 1080×1920 | `#4a90e0` | small | 9 | Noto Sans SC |
| `24-industry-cars-koubo` | 汽车 · 四项持有成本 | 1080×1920 | `#30c98c` | card | 9 | Noto Sans SC |
| `25-industry-food-koubo` | 吃喝 · 值不值得等 | 1080×1920 | `#e0662a` | card | 9 | Noto Sans SC |
| `26-industry-skincare-koubo` | 护肤 · 看懂成分表 | 1080×1920 | `#d86078` | card | 8 | Noto Sans SC |
| `27-industry-shopping-koubo` | 购物 · 四个测试场景 | 1080×1920 | `#f06018` | card | 10 | Noto Sans SC |
| `28-industry-education-koubo` | 教培 · 三套方案 | 1080×1920 | `#c07c1c` | card | 8 | Noto Sans SC |
| `29-industry-health-koubo` | 健康 · 读懂化验单 | 1080×1920 | `#2f9f8a` | card | 9 | Noto Sans SC |
| `30-industry-law-koubo` | 法律 · 讨薪步骤 | 1080×1920 | `#b03a22` | card | 9 | Noto Sans SC |
| `31-industry-finance-koubo` | 金融 · 三本账 | 1080×1920 | `#a07a16` | card | 9 | Noto Sans SC |
| `32-industry-realestate-koubo` | 房产 · 一镜带看 | 1080×1920 | `#5f8fdd` | small | 10 | Noto Sans SC |

## 许可与来源

- 字体：Noto Sans SC、Geist Mono、站酷快乐体、Anton，均为 SIL OFL 1.1（许可文本在各 skill 的 `scripts/engine/stage/fonts/`）。
- `scripts/vendor/pyJianYingDraft`：Apache License 2.0（见 `scripts/vendor/LICENSE-pyJianYingDraft`）。
- 各风格的结构、比例、配色、节奏参考了公开的口播模板样片；本仓库**不包含**任何样片画面、人物、音乐、文案或品牌标识，渲染引擎与控件为原创实现。
- 示例口播文案为测试用段子，仅用于演示排版。

## 已知限制

- 剪映内打开/播放已人工抽验部分草稿；macOS 剪映的导出需在剪映里手动点击。
- 人物适配针对单人口播（多人时取画面中最大的人脸）。
