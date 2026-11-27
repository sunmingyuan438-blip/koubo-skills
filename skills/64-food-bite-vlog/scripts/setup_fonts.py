#!/usr/bin/env python3
"""补齐字体（从 GitHub 获取的轻包不带 17.7 MB 的 Noto Sans SC）。
来源固定到 google/fonts 的某一次提交，下载后校验 sha256；已存在且校验通过就跳过。
用法（在 skill 根目录）：python3 scripts/setup_fonts.py
"""
import hashlib, subprocess, sys
from pathlib import Path
DST = Path(__file__).resolve().parent / "fonts" / "NotoSansSC.ttf"
SHA = "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da"
URLS = ["https://raw.githubusercontent.com/google/fonts/a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
        "https://cdn.jsdelivr.net/gh/google/fonts@a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"]
sha = lambda b: hashlib.sha256(b).hexdigest()
if DST.exists() and sha(DST.read_bytes()) == SHA:
    sys.exit(print("已就绪", DST))
for u in URLS:
    r = subprocess.run(["curl", "-fsSL", "--retry", "2", "--connect-timeout", "15", "--max-time", "600", u], capture_output=True)
    if r.returncode == 0 and sha(r.stdout) == SHA:
        DST.parent.mkdir(parents=True, exist_ok=True)
        DST.with_suffix(".part").write_bytes(r.stdout); DST.with_suffix(".part").rename(DST)
        sys.exit(print("完成，sha256 校验通过", DST))
    print("失败：", u.split("/")[2], "下载失败" if r.returncode else "sha256 不匹配")
sys.exit(1)
