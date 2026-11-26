#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
recolor_theme.py — 把《牛顿第一定律》课件从深色主题整体改为「浅绿 + 灰 + 白」浅色主题。

只改颜色：页面背景、形状填充/描边、文字颜色。不动任何文字内容、位置、尺寸、
层级、动画与备注（因此版式与内容结构 100% 保留）。

原配色（design token，来自 deck-newton/slides/grammar.css）：
  --bg:#1C1C1C  --bg-raised:#232325  --ink:#F4F2EA  --muted:#B9B8B2
  --faint:#85837D  --hairline:#3D3F3C  --blue:#58C4DD  --green:#83C167
  --yellow:#FFFF00  --red:#FC6255

映射到浅色主题：
  页面底 #1C1C1C → #FFFFFF          文字 ink      #F4F2EA → #333333
  卡片底 #232325 → #E9F4E9(+描边)   文字 muted    #B9B8B2 → #5A5F5A
  细线   #3D3F3C → #C2CCC2          文字 faint    #85837D → #8A8F8A
  强调   #FFFF00 → #6FBF73(形)/#3E8E41(字)
  蓝     #58C4DD → #4E9A55
  红     #FC6255 → #9AA39A(形)/#6E766E(字)
  暗字   #1C1C1C → #243024

用法：python recolor_theme.py <scan_dir>     # scan_dir 含 p*.json 与 shapes/shapes.json
"""

import json
import glob
import os
import re
import subprocess
import sys

SKILL_DIR = "C:/Users/Wpengz/.workbuddy/plugins/cache/workbuddy-builtin/skill-tencent-local-office-edit/0.0.1"
PYEXE = r"C:/Users/Wpengz/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
FILE_ID = "sid_mv6p6yan_8ibk292p"

PAGE_BG = "FFFFFF"

# 形状填充：旧 → 新
FILL_MAP = {
    "FFFF00": "6FBF73",   # 强调条 / 序号点 / 圆章 → 浅绿主色
    "FC6255": "9AA39A",   # 红（旧观点 / 警示）→ 中性灰
    "58C4DD": "4E9A55",   # 蓝（牛顿章）→ 深绿
    "FFD400": "6FBF73",   # 按钮底 → 浅绿
    "232325": "E9F4E9",   # 卡片底 → 极浅绿
    "3D3F3C": "C2CCC2",   # 表格细线 → 浅灰绿
}
CARD_BORDER = "CFE0CF"    # 浅绿卡片描边（白底上给卡片一点轮廓）
# 少量需要“重点强调”的面板，用更实的浅绿
EMPHASIS_PANEL = {("7", "0002e6"): "D8ECD8"}   # P8 定律原文框

# 文字颜色：旧 → 新
TEXT_MAP = {
    "F4F2EA": "333333",   # 主文字 → 深灰
    "B9B8B2": "5A5F5A",   # 次文字 → 中深灰
    "85837D": "8A8F8A",   # 辅助标注 → 中灰
    "FFFF00": "3E8E41",   # 黄色强调 → 深绿
    "83C167": "3E8E41",   # 绿（答案 / 正确）→ 深绿
    "58C4DD": "4E9A55",   # 蓝 → 深绿
    "FC6255": "6E766E",   # 红 → 灰
    "1C1C1C": "243024",   # 深底上的暗字 → 近黑绿灰
}


def call(tool, payload):
    r = subprocess.run(
        [PYEXE, "edsdk.py", "call", tool, "--json", json.dumps(payload, ensure_ascii=False)],
        cwd=SKILL_DIR, capture_output=True, text=True, encoding="utf-8")
    out = (r.stdout or "").strip()
    try:
        return True, json.loads(out)
    except Exception:
        return False, (out or r.stderr)[:300]


def main(scan):
    pages = sorted(glob.glob(os.path.join(scan, "p*.json")),
                   key=lambda p: int(re.search(r'p(\d+)\.json', p).group(1)))
    shapes_meta = json.load(open(os.path.join(scan, "shapes", "shapes.json"), encoding="utf-8"))
    fc_by_key = {(str(r["page"]), str(r["id"])): r.get("fc") for r in shapes_meta if r.get("fc")}

    ok_pages = 0
    for pf in pages:
        d = json.load(open(pf, encoding="utf-8"))
        page = d.get("page_index")
        shapes = d.get("shapes", [])

        # 1) 页面背景 → 白
        ok, res = call("slide_set_page_properties",
                       {"file_id": FILE_ID, "page_index": page,
                        "fill_type": "solid", "fill_color": PAGE_BG})
        if not ok:
            print(f"  p{page} BG FAIL: {res}")

        # 2) 形状填充 / 描边
        items = []
        for s in shapes:
            if s.get("type") != "shape":
                continue
            old = s.get("fill")
            if not old or old == "none":
                continue
            key = (str(page), str(s.get("id")))
            new = EMPHASIS_PANEL.get(key) or FILL_MAP.get(old)
            if not new:
                continue
            it = {"shape_id": s.get("id"), "fill_color": new}
            if old == "232325" and key not in EMPHASIS_PANEL:
                it["border_color"] = CARD_BORDER
                it["border_width"] = 1
            items.append(it)
        if items:
            ok, res = call("slide_set_shape_properties",
                           {"file_id": FILE_ID, "page_index": page, "shapes": items})
            print(f"  p{page} FILL x{len(items)}: {'ok' if ok else 'FAIL ' + str(res)}")

        # 3) 文字颜色（整段）
        titems = []
        for s in shapes:
            if s.get("type") != "shape":
                continue
            key = (str(page), str(s.get("id")))
            fc = fc_by_key.get(key)
            if not fc:
                continue
            new = TEXT_MAP.get(fc)
            txt = s.get("text") or ""
            if not new or not txt.strip():
                continue
            titems.append({"shape_id": s.get("id"), "index": 0,
                           "count": len(txt), "color": new})
        if titems:
            ok, res = call("slide_set_text_property",
                           {"file_id": FILE_ID, "page_index": page, "shapes": titems})
            print(f"  p{page} TEXT x{len(titems)}: {'ok' if ok else 'FAIL ' + str(res)}")

        ok_pages += 1

    print(f"pages processed: {ok_pages}")
    ok, res = call("save_file", {"file_id": FILE_ID})
    print("save_file:", "ok" if ok else f"FAIL {res}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "_recolor")
