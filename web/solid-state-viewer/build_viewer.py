# -*- coding: utf-8 -*-
"""DEPRECATED 兼容层 —— 生成逻辑已迁移至可复用 skill `dual-pane-reader`。

旧版本（约 580 行硬编码 SRC_HTML / OUT_DIR / PAGE_COUNT=20）按代码审查结论移除，
避免"屎山"与换文献串号。现在请使用：

    PY="C:/Users/Wpengz/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
    "$PY" "../skills/dual-pane-reader/scripts/build_dual_viewer.py" \
        --html <双语HTML> --pdf <原文PDF> --out .

带参数调用本文件会原样转发给 skill（兼容旧调用方式）；不带参数则打印本说明。
"""
import runpy
import sys
from pathlib import Path

SKILL = (
    Path(__file__).resolve().parent.parent
    / "skills" / "dual-pane-reader" / "scripts" / "build_dual_viewer.py"
)

if not SKILL.exists():
    sys.exit("找不到 dual-pane-reader skill：%s" % SKILL)

if len(sys.argv) == 1:
    print(__doc__)
    sys.exit(2)

sys.argv = [str(SKILL)] + sys.argv[1:]
runpy.run_path(str(SKILL), run_name="__main__")
