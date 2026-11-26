#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对生成的「可编辑」PPTX 做结构性自检：越界 / 文字-文字重叠 / 文字溢出风险。"""
import sys
from pptx import Presentation
from pptx.util import Emu

SCALE = 12700  # EMU per px (1px=1pt)
CANVAS_W, CANVAS_H = 1920, 1080


def box(sh):
    try:
        return (sh.left / SCALE, sh.top / SCALE, sh.width / SCALE, sh.height / SCALE)
    except Exception:
        return None


def overlap(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = min(ax + aw, bx + bw) - max(ax, bx)
    iy = min(ay + ah, by + bh) - max(ay, by)
    if ix <= 0 or iy <= 0:
        return 0, 0, 0, 0
    area = ix * iy
    smaller = min(aw * ah, bw * bh) or 1
    rX = ix / min(aw, bw)
    rY = iy / min(ah, bh)
    return area, rX, rY, smaller


def est_lines(text, fs, bw_px):
    if not text or fs <= 0 or bw_px <= 0:
        return 1, 0
    units = 0
    for ch in text:
        if '一' <= ch <= '鿿' or '　' <= ch <= '〿' or ch in '，。、；：？！（）《》「」':
            units += 1.0
        else:
            units += 0.55
    per_line = bw_px / fs
    if per_line <= 0:
        return 1, 0
    return max(1, -(-int(units) // max(1, int(per_line)))), units


def main(path):
    prs = Presentation(path)
    print(f"\n=== {path} ===")
    total_issues = 0
    for i, s in enumerate(prs.slides, 1):
        shapes = []
        for sh in s.shapes:
            b = box(sh)
            if not b:
                continue
            x, y, w, h = b
            is_text = sh.has_text_frame and sh.text_frame.text.strip()
            shapes.append((sh, x, y, w, h, bool(is_text), sh.text_frame.text if is_text else ''))
        # OOB
        for sh, x, y, w, h, it, txt in shapes:
            if x < -1 or y < -1 or x + w > CANVAS_W + 1 or y + h > CANVAS_H + 1:
                print(f"  [P{i:02d} OOB] {txt[:18]!r} box=({x:.0f},{y:.0f},{w:.0f}x{h:.0f})")
                total_issues += 1
        # pairwise overlap among text shapes
        texts = [s for s in shapes if s[5]]
        for a in range(len(texts)):
            for b in range(a + 1, len(texts)):
                _, ax, ay, aw, ah, _, at = texts[a]
                _, bx, by, bw, bh, _, bt = texts[b]
                area, rX, rY, smaller = overlap((ax, ay, aw, ah), (bx, by, bw, bh))
                if area > 240 and area / smaller > 0.1 and rX > 0.12 and rY > 0.28:
                    print(f"  [P{i:02d} TXT-OVL] {at[:14]!r} X {bt[:14]!r} area={area:.0f}")
                    total_issues += 1
        # overflow estimate
        for sh, x, y, w, h, it, txt in texts:
            if not txt:
                continue
            fs = None
            for p in sh.text_frame.paragraphs:
                for r in p.runs:
                    if r.font.size:
                        fs = r.font.size.pt
                        break
                if fs:
                    break
            if not fs:
                fs = 24
            lines, units = est_lines(txt, fs, w)
            need_h = lines * fs * 1.25
            if need_h > h * 1.12:
                print(f"  [P{i:02d} OVERFLOW?] {txt[:16]!r} fs={fs:.0f} box_h={h:.0f} est_lines={lines} need≈{need_h:.0f}")
                total_issues += 1
    print(f"  自检问题数: {total_issues}")
    return total_issues


if __name__ == '__main__':
    for p in sys.argv[1:]:
        main(p)
