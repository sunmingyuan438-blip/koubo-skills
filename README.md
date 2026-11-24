# 口播剪辑 Skill 合集（62 套）

把真人口播包装成不同视觉风格的短视频：每个 skill 自带渲染引擎、字体与控件，产出**可编辑的剪映草稿**（动效层、人物、口播、字幕分轨），也可直接导出 MP4。适用于 Claude Code / Codex 等支持 `SKILL.md` 的宿主。

下面每张动图都是该 skill 用同一段 19.3 秒样板口播真跑出来的（点图看完整视频）。样板里的主播是程序绘制的无五官人形、声音是合成配音，不含任何真人。

## 分类目录

按用途分 6 个大类，每个大类再按视觉气质细分：

| 大类 | 适合 | 小类 |
| --- | --- | --- |
| **口播讲解**（21） | 真人出镜讲观点、讲方法，画面跟着口播逐句排版 | [纸面手作](#口播讲解-纸面手作)（3） · [编辑杂志](#口播讲解-编辑杂志)（3） · [科技暗场](#口播讲解-科技暗场)（5） · [海报色块](#口播讲解-海报色块)（2） · [角色剧场](#口播讲解-角色剧场)（4） · [界面拟物](#口播讲解-界面拟物)（4） |
| **行业专题**（12） | 竖屏 1080×1920，每个行业一条结构主轴 | [生活消费](#行业专题-生活消费)（4） · [工作学习](#行业专题-工作学习)（2） · [专业科普](#行业专题-专业科普)（3） · [大件决策](#行业专题-大件决策)（3） |
| **产品宣传**（8） | 产品发布、品牌故事、功能演示 | [品牌故事](#产品宣传-品牌故事)（2） · [发布演示](#产品宣传-发布演示)（2） · [教程拆解](#产品宣传-教程拆解)（2） · [趣味创意](#产品宣传-趣味创意)（2） |
| **知识讲解**（12） | 动效讲解，把一个知识点拆成几步讲清楚 | [手写板书](#知识讲解-手写板书)（2） · [数据几何](#知识讲解-数据几何)（3） · [结构图解](#知识讲解-结构图解)（3） · [质感场景](#知识讲解-质感场景)（4） |
| **视觉艺术**（8） | 照片与人像的情绪片、标题片 | [人像](#视觉艺术-人像)（2） · [照片叙事](#视觉艺术-照片叙事)（2） · [画面特效](#视觉艺术-画面特效)（3） · [动态海报](#视觉艺术-动态海报)（1） |
| **生活 Vlog**（1） | 旅行、日常记录 | [旅行手记](#生活-Vlog-旅行手记)（1） |

按画幅找：

- **竖屏**（20）：[08 纸面观点](skills/08-paper-perspective-portrait-koubo) · [03 现代编辑](skills/03-modern-editorial-koubo) · [10 控制台](skills/10-tech-console-portrait-koubo) · [04 动态技术](skills/04-kinetic-tech-koubo) · [09 深空多维舞台](skills/09-dark-dimensional-stage-koubo) · [05 鲜活海报](skills/05-vibrant-poster-koubo) · [06 鲜活角色](skills/06-vivid-characters-koubo) · [61 自由画布](skills/61-creator-canvas-koubo) · [21 关系](skills/21-industry-relationships-koubo) · [25 吃喝](skills/25-industry-food-koubo) · [26 护肤](skills/26-industry-skincare-koubo) · [27 购物](skills/27-industry-shopping-koubo) · [22 工作](skills/22-industry-work-koubo) · [28 教培](skills/28-industry-education-koubo) · [29 健康](skills/29-industry-health-koubo) · [30 法律](skills/30-industry-law-koubo) · [31 金融](skills/31-industry-finance-koubo) · [23 科技](skills/23-industry-tech-koubo) · [24 汽车](skills/24-industry-cars-koubo) · [32 房产](skills/32-industry-realestate-koubo)
- **横屏**（38）：[01 纸面观点](skills/01-paper-perspective-koubo) · [14 手绘卡通](skills/14-hand-drawn-cartoon-koubo) · [07 现代编辑](skills/07-modern-editorial-wide-koubo) · [02 控制台](skills/02-tech-console-koubo) · [13 深空多维舞台](skills/13-dark-dimensional-stage-wide-koubo) · [11 鲜活海报](skills/11-vibrant-poster-wide-koubo) · [12 鲜活角色](skills/12-vivid-characters-wide-koubo) · [15 卡牌桌](skills/15-card-table-shuffle-koubo) · [20 角色剧场](skills/20-character-theater-koubo) · [33 屏幕拼贴](skills/33-screen-collage-koubo) · [34 长卷](skills/34-paper-scroll-koubo) · [35 明暗切](skills/35-light-dark-cuts-koubo) · [39 发布会舞台](skills/39-keynote-stage-koubo) · [37 流程演示](skills/37-workflow-demo-koubo) · [38 工程蓝图](skills/38-engineering-blueprint-koubo) · [36 像素闯关](skills/36-pixel-platformer-koubo) · [40 模块拼贴](skills/40-modular-collage-koubo) · [41 点阵笔记](skills/41-dot-grid-notes-koubo) · [42 黑板](skills/42-chalkboard-koubo) · [43 瑞士网格](skills/43-swiss-grid-koubo) · [44 色块几何](skills/44-color-geometry-koubo) · [48 双色孔版](skills/48-two-color-risograph-koubo) · [46 生长导图](skills/46-growing-mind-map-koubo) · [49 等距系统](skills/49-isometric-systems-koubo) · [51 地铁线网](skills/51-metro-network-koubo) · [45 发光灯板](skills/45-glowing-lightboard-koubo) · [47 博物馆年表](skills/47-museum-timeline-koubo) · [50 叠层剪纸](skills/50-layered-papercut-koubo) · [52 黏土实验室](skills/52-clay-lab-koubo) · [53 半调网点](skills/53-halftone-dots-koubo) · [57 双重曝光](skills/57-double-exposure-koubo) · [55 空间画廊](skills/55-spatial-gallery-koubo) · [56 照片马赛克](skills/56-photo-mosaic-koubo) · [58 笔触重绘](skills/58-brush-repainting-koubo) · [59 信号故障](skills/59-signal-glitch-koubo) · [60 镜像万花筒](skills/60-mirror-kaleidoscope-koubo) · [54 几何拼贴](skills/54-geometric-collage-koubo) · [62 九月](skills/62-september-field-notes-koubo)
- **4:3 / 3:4**（4）：[17 越界](skills/17-beyond-the-frame-koubo) · [16 取景器](skills/16-camera-mode-koubo) · [18 桌面](skills/18-mac-desktop-koubo) · [19 新闻台](skills/19-news-desk-koubo)

## 口播讲解

<a id="口播讲解-纸面手作"></a>

### 口播讲解 · 纸面手作

纸张质感、手绘线条，温和、可信

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/01-paper-perspective-koubo/assets/sample.mp4"><img src="skills/01-paper-perspective-koubo/assets/sample.gif" width="260"></a><br><b>01 · 纸面观点 · 横屏版</b><br><sub>1920×1080 · 亮底 · <a href="skills/01-paper-perspective-koubo">skill</a> · <a href="skills/01-paper-perspective-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/08-paper-perspective-portrait-koubo/assets/sample.mp4"><img src="skills/08-paper-perspective-portrait-koubo/assets/sample.gif" width="150"></a><br><b>08 · 纸面观点 · 竖屏版</b><br><sub>1080×1920 · 亮底 · <a href="skills/08-paper-perspective-portrait-koubo">skill</a> · <a href="skills/08-paper-perspective-portrait-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/14-hand-drawn-cartoon-koubo/assets/sample.mp4"><img src="skills/14-hand-drawn-cartoon-koubo/assets/sample.gif" width="260"></a><br><b>14 · 手绘卡通 · 横屏版</b><br><sub>1920×1080 · 亮底 · <a href="skills/14-hand-drawn-cartoon-koubo">skill</a> · <a href="skills/14-hand-drawn-cartoon-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="口播讲解-编辑杂志"></a>

### 口播讲解 · 编辑杂志

杂志版式、大量留白、单一强调色

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/03-modern-editorial-koubo/assets/sample.mp4"><img src="skills/03-modern-editorial-koubo/assets/sample.gif" width="150"></a><br><b>03 · 现代编辑 · 竖屏版</b><br><sub>1080×1920 · 亮底 · <a href="skills/03-modern-editorial-koubo">skill</a> · <a href="skills/03-modern-editorial-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/07-modern-editorial-wide-koubo/assets/sample.mp4"><img src="skills/07-modern-editorial-wide-koubo/assets/sample.gif" width="260"></a><br><b>07 · 现代编辑 · 横屏版</b><br><sub>1920×1080 · 亮底 · <a href="skills/07-modern-editorial-wide-koubo">skill</a> · <a href="skills/07-modern-editorial-wide-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/17-beyond-the-frame-koubo/assets/sample.mp4"><img src="skills/17-beyond-the-frame-koubo/assets/sample.gif" width="150"></a><br><b>17 · 越界 · 3:4</b><br><sub>1440×1920 · 亮底 · <a href="skills/17-beyond-the-frame-koubo">skill</a> · <a href="skills/17-beyond-the-frame-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="口播讲解-科技暗场"></a>

### 口播讲解 · 科技暗场

深色底、等宽字、HUD 与发光

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/02-tech-console-koubo/assets/sample.mp4"><img src="skills/02-tech-console-koubo/assets/sample.gif" width="260"></a><br><b>02 · 控制台 · 横屏版</b><br><sub>1920×1080 · 暗底 · <a href="skills/02-tech-console-koubo">skill</a> · <a href="skills/02-tech-console-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/10-tech-console-portrait-koubo/assets/sample.mp4"><img src="skills/10-tech-console-portrait-koubo/assets/sample.gif" width="150"></a><br><b>10 · 控制台 · 竖屏版</b><br><sub>1080×1920 · 暗底 · <a href="skills/10-tech-console-portrait-koubo">skill</a> · <a href="skills/10-tech-console-portrait-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/04-kinetic-tech-koubo/assets/sample.mp4"><img src="skills/04-kinetic-tech-koubo/assets/sample.gif" width="150"></a><br><b>04 · 动态技术 · 竖屏版</b><br><sub>1080×1920 · 暗底 · <a href="skills/04-kinetic-tech-koubo">skill</a> · <a href="skills/04-kinetic-tech-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
<tr><td align="center" valign="top" width="33%"><a href="skills/09-dark-dimensional-stage-koubo/assets/sample.mp4"><img src="skills/09-dark-dimensional-stage-koubo/assets/sample.gif" width="150"></a><br><b>09 · 深空多维舞台 · 竖屏版</b><br><sub>1080×1920 · 暗底 · <a href="skills/09-dark-dimensional-stage-koubo">skill</a> · <a href="skills/09-dark-dimensional-stage-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/13-dark-dimensional-stage-wide-koubo/assets/sample.mp4"><img src="skills/13-dark-dimensional-stage-wide-koubo/assets/sample.gif" width="260"></a><br><b>13 · 深空多维舞台 · 横屏版</b><br><sub>1920×1080 · 暗底 · <a href="skills/13-dark-dimensional-stage-wide-koubo">skill</a> · <a href="skills/13-dark-dimensional-stage-wide-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="口播讲解-海报色块"></a>

### 口播讲解 · 海报色块

大字号、高饱和色块，冲击力强

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/05-vibrant-poster-koubo/assets/sample.mp4"><img src="skills/05-vibrant-poster-koubo/assets/sample.gif" width="150"></a><br><b>05 · 鲜活海报 · 竖屏版</b><br><sub>1080×1920 · 亮底 · <a href="skills/05-vibrant-poster-koubo">skill</a> · <a href="skills/05-vibrant-poster-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/11-vibrant-poster-wide-koubo/assets/sample.mp4"><img src="skills/11-vibrant-poster-wide-koubo/assets/sample.gif" width="260"></a><br><b>11 · 鲜活海报 · 横屏版</b><br><sub>1920×1080 · 亮底 · <a href="skills/11-vibrant-poster-wide-koubo">skill</a> · <a href="skills/11-vibrant-poster-wide-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="口播讲解-角色剧场"></a>

### 口播讲解 · 角色剧场

角色卡、剧场幕布、卡牌桌，适合讲故事

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/06-vivid-characters-koubo/assets/sample.mp4"><img src="skills/06-vivid-characters-koubo/assets/sample.gif" width="150"></a><br><b>06 · 鲜活角色 · 竖屏版</b><br><sub>1080×1920 · 亮底 · <a href="skills/06-vivid-characters-koubo">skill</a> · <a href="skills/06-vivid-characters-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/12-vivid-characters-wide-koubo/assets/sample.mp4"><img src="skills/12-vivid-characters-wide-koubo/assets/sample.gif" width="260"></a><br><b>12 · 鲜活角色 · 横屏版</b><br><sub>1920×1080 · 亮底 · <a href="skills/12-vivid-characters-wide-koubo">skill</a> · <a href="skills/12-vivid-characters-wide-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/15-card-table-shuffle-koubo/assets/sample.mp4"><img src="skills/15-card-table-shuffle-koubo/assets/sample.gif" width="260"></a><br><b>15 · 卡牌桌 · 横屏版</b><br><sub>1920×1080 · 亮底 · <a href="skills/15-card-table-shuffle-koubo">skill</a> · <a href="skills/15-card-table-shuffle-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
<tr><td align="center" valign="top" width="33%"><a href="skills/20-character-theater-koubo/assets/sample.mp4"><img src="skills/20-character-theater-koubo/assets/sample.gif" width="260"></a><br><b>20 · 角色剧场 · 横屏版</b><br><sub>1920×1080 · 暗底 · <a href="skills/20-character-theater-koubo">skill</a> · <a href="skills/20-character-theater-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="口播讲解-界面拟物"></a>

### 口播讲解 · 界面拟物

取景器、电脑桌面、新闻台、在线画布

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/16-camera-mode-koubo/assets/sample.mp4"><img src="skills/16-camera-mode-koubo/assets/sample.gif" width="150"></a><br><b>16 · 取景器 · 3:4</b><br><sub>1080×1440 · 亮底 · <a href="skills/16-camera-mode-koubo">skill</a> · <a href="skills/16-camera-mode-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/18-mac-desktop-koubo/assets/sample.mp4"><img src="skills/18-mac-desktop-koubo/assets/sample.gif" width="260"></a><br><b>18 · 桌面 · 4:3</b><br><sub>1440×1080 · 亮底 · <a href="skills/18-mac-desktop-koubo">skill</a> · <a href="skills/18-mac-desktop-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/19-news-desk-koubo/assets/sample.mp4"><img src="skills/19-news-desk-koubo/assets/sample.gif" width="260"></a><br><b>19 · 新闻台 · 4:3</b><br><sub>1440×1080 · 暗底 · <a href="skills/19-news-desk-koubo">skill</a> · <a href="skills/19-news-desk-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
<tr><td align="center" valign="top" width="33%"><a href="skills/61-creator-canvas-koubo/assets/sample.mp4"><img src="skills/61-creator-canvas-koubo/assets/sample.gif" width="150"></a><br><b>61 · 自由画布 · 协作叙事</b><br><sub>1080×1920 · 亮底 · <a href="skills/61-creator-canvas-koubo">skill</a> · <a href="skills/61-creator-canvas-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

## 行业专题

<a id="行业专题-生活消费"></a>

### 行业专题 · 生活消费

关系、吃喝、护肤、购物

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/21-industry-relationships-koubo/assets/sample.mp4"><img src="skills/21-industry-relationships-koubo/assets/sample.gif" width="150"></a><br><b>21 · 关系 · 一场对话复盘</b><br><sub>1080×1920 · 暗底 · <a href="skills/21-industry-relationships-koubo">skill</a> · <a href="skills/21-industry-relationships-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/25-industry-food-koubo/assets/sample.mp4"><img src="skills/25-industry-food-koubo/assets/sample.gif" width="150"></a><br><b>25 · 吃喝 · 值不值得等</b><br><sub>1080×1920 · 暗底 · <a href="skills/25-industry-food-koubo">skill</a> · <a href="skills/25-industry-food-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/26-industry-skincare-koubo/assets/sample.mp4"><img src="skills/26-industry-skincare-koubo/assets/sample.gif" width="150"></a><br><b>26 · 护肤 · 看懂成分表</b><br><sub>1080×1920 · 亮底 · <a href="skills/26-industry-skincare-koubo">skill</a> · <a href="skills/26-industry-skincare-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
<tr><td align="center" valign="top" width="33%"><a href="skills/27-industry-shopping-koubo/assets/sample.mp4"><img src="skills/27-industry-shopping-koubo/assets/sample.gif" width="150"></a><br><b>27 · 购物 · 四个测试场景</b><br><sub>1080×1920 · 暗底 · <a href="skills/27-industry-shopping-koubo">skill</a> · <a href="skills/27-industry-shopping-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="行业专题-工作学习"></a>

### 行业专题 · 工作学习

周报、教培方案

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/22-industry-work-koubo/assets/sample.mp4"><img src="skills/22-industry-work-koubo/assets/sample.gif" width="150"></a><br><b>22 · 工作 · 三行周报</b><br><sub>1080×1920 · 亮底 · <a href="skills/22-industry-work-koubo">skill</a> · <a href="skills/22-industry-work-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/28-industry-education-koubo/assets/sample.mp4"><img src="skills/28-industry-education-koubo/assets/sample.gif" width="150"></a><br><b>28 · 教培 · 三套方案</b><br><sub>1080×1920 · 亮底 · <a href="skills/28-industry-education-koubo">skill</a> · <a href="skills/28-industry-education-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="行业专题-专业科普"></a>

### 行业专题 · 专业科普

健康、法律、金融

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/29-industry-health-koubo/assets/sample.mp4"><img src="skills/29-industry-health-koubo/assets/sample.gif" width="150"></a><br><b>29 · 健康 · 读懂化验单</b><br><sub>1080×1920 · 暗底 · <a href="skills/29-industry-health-koubo">skill</a> · <a href="skills/29-industry-health-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/30-industry-law-koubo/assets/sample.mp4"><img src="skills/30-industry-law-koubo/assets/sample.gif" width="150"></a><br><b>30 · 法律 · 讨薪步骤</b><br><sub>1080×1920 · 亮底 · <a href="skills/30-industry-law-koubo">skill</a> · <a href="skills/30-industry-law-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/31-industry-finance-koubo/assets/sample.mp4"><img src="skills/31-industry-finance-koubo/assets/sample.gif" width="150"></a><br><b>31 · 金融 · 三本账</b><br><sub>1080×1920 · 亮底 · <a href="skills/31-industry-finance-koubo">skill</a> · <a href="skills/31-industry-finance-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="行业专题-大件决策"></a>

### 行业专题 · 大件决策

换机、买车、看房

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/23-industry-tech-koubo/assets/sample.mp4"><img src="skills/23-industry-tech-koubo/assets/sample.gif" width="150"></a><br><b>23 · 科技 · 换机还是再等等</b><br><sub>1080×1920 · 暗底 · <a href="skills/23-industry-tech-koubo">skill</a> · <a href="skills/23-industry-tech-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/24-industry-cars-koubo/assets/sample.mp4"><img src="skills/24-industry-cars-koubo/assets/sample.gif" width="150"></a><br><b>24 · 汽车 · 四项持有成本</b><br><sub>1080×1920 · 暗底 · <a href="skills/24-industry-cars-koubo">skill</a> · <a href="skills/24-industry-cars-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/32-industry-realestate-koubo/assets/sample.mp4"><img src="skills/32-industry-realestate-koubo/assets/sample.gif" width="150"></a><br><b>32 · 房产 · 一镜带看</b><br><sub>1080×1920 · 暗底 · <a href="skills/32-industry-realestate-koubo">skill</a> · <a href="skills/32-industry-realestate-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

## 产品宣传

<a id="产品宣传-品牌故事"></a>

### 产品宣传 · 品牌故事

屏幕拼贴、手绘长卷

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/33-screen-collage-koubo/assets/sample.mp4"><img src="skills/33-screen-collage-koubo/assets/sample.gif" width="260"></a><br><b>33 · 屏幕拼贴 · 品牌故事</b><br><sub>1920×1080 · 暗底 · <a href="skills/33-screen-collage-koubo">skill</a> · <a href="skills/33-screen-collage-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/34-paper-scroll-koubo/assets/sample.mp4"><img src="skills/34-paper-scroll-koubo/assets/sample.gif" width="260"></a><br><b>34 · 长卷 · 品牌故事</b><br><sub>1920×1080 · 亮底 · <a href="skills/34-paper-scroll-koubo">skill</a> · <a href="skills/34-paper-scroll-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="产品宣传-发布演示"></a>

### 产品宣传 · 发布演示

明暗硬切、发布会舞台

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/35-light-dark-cuts-koubo/assets/sample.mp4"><img src="skills/35-light-dark-cuts-koubo/assets/sample.gif" width="260"></a><br><b>35 · 明暗切 · 产品宣传</b><br><sub>1920×1080 · 暗底 · <a href="skills/35-light-dark-cuts-koubo">skill</a> · <a href="skills/35-light-dark-cuts-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/39-keynote-stage-koubo/assets/sample.mp4"><img src="skills/39-keynote-stage-koubo/assets/sample.gif" width="260"></a><br><b>39 · 发布会舞台 · 产品演示</b><br><sub>1920×1080 · 亮底 · <a href="skills/39-keynote-stage-koubo">skill</a> · <a href="skills/39-keynote-stage-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="产品宣传-教程拆解"></a>

### 产品宣传 · 教程拆解

流程演示、工程蓝图

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/37-workflow-demo-koubo/assets/sample.mp4"><img src="skills/37-workflow-demo-koubo/assets/sample.gif" width="260"></a><br><b>37 · 流程演示 · 产品教程</b><br><sub>1920×1080 · 亮底 · <a href="skills/37-workflow-demo-koubo">skill</a> · <a href="skills/37-workflow-demo-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/38-engineering-blueprint-koubo/assets/sample.mp4"><img src="skills/38-engineering-blueprint-koubo/assets/sample.gif" width="260"></a><br><b>38 · 工程蓝图 · 产品拆解</b><br><sub>1920×1080 · 暗底 · <a href="skills/38-engineering-blueprint-koubo">skill</a> · <a href="skills/38-engineering-blueprint-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="产品宣传-趣味创意"></a>

### 产品宣传 · 趣味创意

像素闯关、模块拼贴

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/36-pixel-platformer-koubo/assets/sample.mp4"><img src="skills/36-pixel-platformer-koubo/assets/sample.gif" width="260"></a><br><b>36 · 像素闯关 · 产品介绍</b><br><sub>1920×1080 · 暗底 · <a href="skills/36-pixel-platformer-koubo">skill</a> · <a href="skills/36-pixel-platformer-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/40-modular-collage-koubo/assets/sample.mp4"><img src="skills/40-modular-collage-koubo/assets/sample.gif" width="260"></a><br><b>40 · 模块拼贴 · 创作者工具</b><br><sub>1920×1080 · 亮底 · <a href="skills/40-modular-collage-koubo">skill</a> · <a href="skills/40-modular-collage-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

## 知识讲解

<a id="知识讲解-手写板书"></a>

### 知识讲解 · 手写板书

点阵笔记、黑板

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/41-dot-grid-notes-koubo/assets/sample.mp4"><img src="skills/41-dot-grid-notes-koubo/assets/sample.gif" width="260"></a><br><b>41 · 点阵笔记 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/41-dot-grid-notes-koubo">skill</a> · <a href="skills/41-dot-grid-notes-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/42-chalkboard-koubo/assets/sample.mp4"><img src="skills/42-chalkboard-koubo/assets/sample.gif" width="260"></a><br><b>42 · 黑板 · 知识讲解</b><br><sub>1920×1080 · 暗底 · <a href="skills/42-chalkboard-koubo">skill</a> · <a href="skills/42-chalkboard-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="知识讲解-数据几何"></a>

### 知识讲解 · 数据几何

瑞士网格、色块几何、双色孔版

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/43-swiss-grid-koubo/assets/sample.mp4"><img src="skills/43-swiss-grid-koubo/assets/sample.gif" width="260"></a><br><b>43 · 瑞士网格 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/43-swiss-grid-koubo">skill</a> · <a href="skills/43-swiss-grid-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/44-color-geometry-koubo/assets/sample.mp4"><img src="skills/44-color-geometry-koubo/assets/sample.gif" width="260"></a><br><b>44 · 色块几何 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/44-color-geometry-koubo">skill</a> · <a href="skills/44-color-geometry-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/48-two-color-risograph-koubo/assets/sample.mp4"><img src="skills/48-two-color-risograph-koubo/assets/sample.gif" width="260"></a><br><b>48 · 双色孔版 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/48-two-color-risograph-koubo">skill</a> · <a href="skills/48-two-color-risograph-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="知识讲解-结构图解"></a>

### 知识讲解 · 结构图解

生长导图、等距系统、地铁线网

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/46-growing-mind-map-koubo/assets/sample.mp4"><img src="skills/46-growing-mind-map-koubo/assets/sample.gif" width="260"></a><br><b>46 · 生长导图 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/46-growing-mind-map-koubo">skill</a> · <a href="skills/46-growing-mind-map-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/49-isometric-systems-koubo/assets/sample.mp4"><img src="skills/49-isometric-systems-koubo/assets/sample.gif" width="260"></a><br><b>49 · 等距系统 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/49-isometric-systems-koubo">skill</a> · <a href="skills/49-isometric-systems-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/51-metro-network-koubo/assets/sample.mp4"><img src="skills/51-metro-network-koubo/assets/sample.gif" width="260"></a><br><b>51 · 地铁线网 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/51-metro-network-koubo">skill</a> · <a href="skills/51-metro-network-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="知识讲解-质感场景"></a>

### 知识讲解 · 质感场景

发光灯板、博物馆年表、叠层剪纸、黏土实验室

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/45-glowing-lightboard-koubo/assets/sample.mp4"><img src="skills/45-glowing-lightboard-koubo/assets/sample.gif" width="260"></a><br><b>45 · 发光灯板 · 知识讲解</b><br><sub>1920×1080 · 暗底 · <a href="skills/45-glowing-lightboard-koubo">skill</a> · <a href="skills/45-glowing-lightboard-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/47-museum-timeline-koubo/assets/sample.mp4"><img src="skills/47-museum-timeline-koubo/assets/sample.gif" width="260"></a><br><b>47 · 博物馆年表 · 知识讲解</b><br><sub>1920×1080 · 暗底 · <a href="skills/47-museum-timeline-koubo">skill</a> · <a href="skills/47-museum-timeline-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/50-layered-papercut-koubo/assets/sample.mp4"><img src="skills/50-layered-papercut-koubo/assets/sample.gif" width="260"></a><br><b>50 · 叠层剪纸 · 知识讲解</b><br><sub>1920×1080 · 暗底 · <a href="skills/50-layered-papercut-koubo">skill</a> · <a href="skills/50-layered-papercut-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
<tr><td align="center" valign="top" width="33%"><a href="skills/52-clay-lab-koubo/assets/sample.mp4"><img src="skills/52-clay-lab-koubo/assets/sample.gif" width="260"></a><br><b>52 · 黏土实验室 · 知识讲解</b><br><sub>1920×1080 · 亮底 · <a href="skills/52-clay-lab-koubo">skill</a> · <a href="skills/52-clay-lab-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

## 视觉艺术

<a id="视觉艺术-人像"></a>

### 视觉艺术 · 人像

半调网点、双重曝光

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/53-halftone-dots-koubo/assets/sample.mp4"><img src="skills/53-halftone-dots-koubo/assets/sample.gif" width="260"></a><br><b>53 · 半调网点 · 人像标题</b><br><sub>1920×1080 · 暗底 · <a href="skills/53-halftone-dots-koubo">skill</a> · <a href="skills/53-halftone-dots-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/57-double-exposure-koubo/assets/sample.mp4"><img src="skills/57-double-exposure-koubo/assets/sample.gif" width="260"></a><br><b>57 · 双重曝光 · 人像叠影</b><br><sub>1920×1080 · 亮底 · <a href="skills/57-double-exposure-koubo">skill</a> · <a href="skills/57-double-exposure-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="视觉艺术-照片叙事"></a>

### 视觉艺术 · 照片叙事

空间画廊、照片马赛克

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/55-spatial-gallery-koubo/assets/sample.mp4"><img src="skills/55-spatial-gallery-koubo/assets/sample.gif" width="260"></a><br><b>55 · 空间画廊 · 照片回忆</b><br><sub>1920×1080 · 暗底 · <a href="skills/55-spatial-gallery-koubo">skill</a> · <a href="skills/55-spatial-gallery-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/56-photo-mosaic-koubo/assets/sample.mp4"><img src="skills/56-photo-mosaic-koubo/assets/sample.gif" width="260"></a><br><b>56 · 照片马赛克 · 画面揭晓</b><br><sub>1920×1080 · 暗底 · <a href="skills/56-photo-mosaic-koubo">skill</a> · <a href="skills/56-photo-mosaic-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="视觉艺术-画面特效"></a>

### 视觉艺术 · 画面特效

笔触重绘、信号故障、镜像万花筒

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/58-brush-repainting-koubo/assets/sample.mp4"><img src="skills/58-brush-repainting-koubo/assets/sample.gif" width="260"></a><br><b>58 · 笔触重绘 · 艺术照片</b><br><sub>1920×1080 · 亮底 · <a href="skills/58-brush-repainting-koubo">skill</a> · <a href="skills/58-brush-repainting-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/59-signal-glitch-koubo/assets/sample.mp4"><img src="skills/59-signal-glitch-koubo/assets/sample.gif" width="260"></a><br><b>59 · 信号故障 · 照片转场</b><br><sub>1920×1080 · 暗底 · <a href="skills/59-signal-glitch-koubo">skill</a> · <a href="skills/59-signal-glitch-koubo/assets/sample.mp4">▶ 视频</a></sub></td><td align="center" valign="top" width="33%"><a href="skills/60-mirror-kaleidoscope-koubo/assets/sample.mp4"><img src="skills/60-mirror-kaleidoscope-koubo/assets/sample.gif" width="260"></a><br><b>60 · 镜像万花筒 · 照片律动</b><br><sub>1920×1080 · 亮底 · <a href="skills/60-mirror-kaleidoscope-koubo">skill</a> · <a href="skills/60-mirror-kaleidoscope-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

<a id="视觉艺术-动态海报"></a>

### 视觉艺术 · 动态海报

包豪斯几何拼贴

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/54-geometric-collage-koubo/assets/sample.mp4"><img src="skills/54-geometric-collage-koubo/assets/sample.gif" width="260"></a><br><b>54 · 几何拼贴 · 动态海报</b><br><sub>1920×1080 · 亮底 · <a href="skills/54-geometric-collage-koubo">skill</a> · <a href="skills/54-geometric-collage-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

## 生活 Vlog

<a id="生活-Vlog-旅行手记"></a>

### 生活 Vlog · 旅行手记

宽银幕黑边、胶片颗粒、取景器角标

<table>
<tr><td align="center" valign="top" width="33%"><a href="skills/62-september-field-notes-koubo/assets/sample.mp4"><img src="skills/62-september-field-notes-koubo/assets/sample.gif" width="260"></a><br><b>62 · 九月 · 旅行手记</b><br><sub>1920×1080 · 暗底 · <a href="skills/62-september-field-notes-koubo">skill</a> · <a href="skills/62-september-field-notes-koubo/assets/sample.mp4">▶ 视频</a></sub></td></tr>
</table>

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

## 许可与来源

- 字体：Noto Sans SC、Geist Mono、站酷快乐体、Anton，均为 SIL OFL 1.1（许可文本在各 skill 的 `scripts/engine/stage/fonts/`）。
- `scripts/vendor/pyJianYingDraft`：Apache License 2.0（见 `scripts/vendor/LICENSE-pyJianYingDraft`）。
- 各风格的结构、比例、配色、节奏参考了公开的口播模板样片；本仓库**不包含**任何样片画面、人物、音乐、文案或品牌标识，渲染引擎与控件为原创实现。
- 示例口播文案为测试用段子，仅用于演示排版。

## 已知限制

- 剪映内打开/播放已人工抽验部分草稿；macOS 剪映的导出需在剪映里手动点击。
- 人物适配针对单人口播（多人时取画面中最大的人脸）。
