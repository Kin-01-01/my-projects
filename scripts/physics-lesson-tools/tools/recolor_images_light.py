#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
recolor_images_light.py — 把课件里的深色底插图重着色为「白底 + 浅绿/灰」浅色风格。

背景：这套 PPTX 的插图是深色主题（底 #1C1C1C / #232325，图形用 manim 风格
      YELLOW #FFFF00 / WHITE #F4F2EA / GREEN #83C167 / BLUE #58C4DD / RED #FC6255）。
      整册换浅色主题时，这些不透明的深底矩形会变成白底页上的「黑块」，
      必须连同图形一起重着色。

做法（逐像素 HSV 判定，保留图形的内部明暗）：
  · 低明度 + 低饱和 → 判为背景 → alpha=0（透明），露出页面白色背景
  · 低饱和（灰阶笔画）→ 明度反转，映射到深灰阶 #2E..#AC
  · 有色像素 → 按色相归入浅绿 / 灰两族，并保留原有明暗层次
输出 RGBA PNG；像素尺寸与原图一致（替换时不改变形状大小）。

用法：
  python recolor_images_light.py <src_dir_or_pptx> <out_dir>
"""

import io
import os
import sys
import glob
import zipfile

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow：pip install pillow")
    sys.exit(1)

BG_GATE_V = 52       # 明度阈值（0-255）：低于此且低饱和 → 判为背景
GRAY_SAT = 0.18      # 饱和阈值：低于此判为灰阶笔画
BG_SAT = 0.35        # 背景判定的饱和上限

# 有色像素的目标基色（与课件浅绿主色一致）
TARGET = {
    "green": (111, 191, 115),   # #6FBF73 浅绿主色
    "deep":  (62, 142, 65),      # #3E8E41 深绿（原绿色元素）
    "gray":  (150, 158, 150),    # #969E96 灰（原红色元素→中性灰）
}


def classify(h, s, v):
    if h < 25 or h >= 335:
        return TARGET["gray"]
    if 25 <= h < 80:
        return TARGET["green"]
    if 80 <= h < 160:
        return TARGET["deep"]
    if 160 <= h < 250:
        return TARGET["green"]
    return TARGET["gray"]


def recolor(im):
    im = im.convert("RGBA")
    px = im.load()
    w, h_ = im.size
    for y in range(h_):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            mx = max(r, g, b)
            mn = min(r, g, b)
            v = mx / 255.0
            s = 0.0 if mx == 0 else (mx - mn) / mx

            # 1) 背景 → 透明
            if mx <= BG_GATE_V and s < BG_SAT:
                px[x, y] = (0, 0, 0, 0)
                continue

            if s < GRAY_SAT:
                # 2) 灰阶笔画：明度反转 → 深灰（保留层次）
                lum = 0.299 * r + 0.587 * g + 0.114 * b
                gv = int(46 + (255 - lum) / 255.0 * 126)
                gv = max(28, min(180, gv))
                px[x, y] = (gv, min(255, gv + 4), gv, 255)
                continue

            # 3) 有色像素：色相归类 + 保留明暗
            mxch = mx
            if mxch == r:
                hh = (60 * ((g - b) / (mx - mn)) + 360) % 360
            elif mxch == g:
                hh = 60 * ((b - r) / (mx - mn)) + 120
            else:
                hh = 60 * ((r - g) / (mx - mn)) + 240
            base = classify(hh, s, v)
            k = min(1.0, max(0.55, v / 0.85))
            px[x, y] = (int(base[0] * k), int(base[1] * k), int(base[2] * k), 255)
    return im


def main(src, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    if src.lower().endswith((".pptx", ".pptm")):
        z = zipfile.ZipFile(src)
        items = [(n, z.read(n)) for n in z.namelist() if n.startswith("ppt/media/")]
    else:
        items = [(os.path.basename(p), open(p, "rb").read())
                 for p in sorted(glob.glob(os.path.join(src, "*.png")))]
    n = 0
    for name, data in items:
        im = Image.open(io.BytesIO(data))
        out = recolor(im)
        dst = os.path.join(out_dir, os.path.basename(name))
        out.save(dst)
        print(f"  {os.path.basename(name)}: {im.size} -> {os.path.getsize(dst)} bytes")
        n += 1
    print(f"done: {n} images -> {out_dir}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
