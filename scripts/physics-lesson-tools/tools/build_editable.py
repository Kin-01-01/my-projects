#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_editable.py — 把 extract.mjs 产出的 dom-<deck>.json 重建为「文字可编辑」PPTX。

约定（与 extract.mjs / 路线文档一致）：
  - 画布 1920 x 1080 CSS px，1 px = 1 pt（12700 EMU）
  - 每个元素按量测坐标落真文本框 / 真形状 / 带文字的 SVG 截图
  - SVG 内 <text> 已被 extract 拆成 svgtext（图归图、字归字），所以全部文字可编辑
  - 演讲者备注来自 spec 文件里每页的「备注栏台词：」块

用法：
  python build_editable.py <dom.json> <out.pptx> [--spec spec.md]
"""
import json
import os
import re
import sys

from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# 1 CSS px = 1 PPT pt = 12700 EMU
SCALE = 12700


def E(v):
    try:
        return int(round(float(v) * SCALE))
    except (TypeError, ValueError):
        return 0


_COLOR_RE = re.compile(r'rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)')


def parse_color(c):
    if not c:
        return None
    c = c.strip()
    if c in ('transparent', 'inherit', 'none', 'initial', ''):
        return None
    m = _COLOR_RE.search(c)
    if m:
        return RGBColor(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    if c.startswith('#') and len(c) >= 7:
        return RGBColor(int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16))
    return None


def parse_notes(spec_path):
    notes = {}
    if not spec_path or not os.path.exists(spec_path):
        return notes
    text = open(spec_path, encoding='utf-8').read()
    # 按 "## ..." 切分页面块（兼容「## P1 · 封面」与「## 第 2 页 · 学习目标」）
    parts = re.split(r'(?m)^##\s+', text)
    for part in parts[1:]:
        head = part.split('\n', 1)[0]
        mnum = re.search(r'(?:P(\d+)|第\s*(\d+)\s*页)', head)
        if not mnum:
            continue
        num = int(mnum.group(1) or mnum.group(2))
        lines = part.split('\n')
        note_lines = []
        capturing = False
        for ln in lines:
            if re.search(r'备注栏', ln):
                capturing = True
                after = re.split(r'[:：]', ln, 1)
                tail = after[1].strip() if len(after) > 1 else ''
                if tail:
                    note_lines.append(re.sub(r'^[-\s>]+', '', tail))
                continue
            if capturing:
                s = ln.strip()
                if s.startswith('>'):
                    note_lines.append(s.lstrip('>').strip())
                elif ln[:1] in (' ', '\t') and s:
                    note_lines.append(s)
                elif s == '':
                    capturing = False
                else:
                    capturing = False
        note = '\n'.join(note_lines).strip()
        if note:
            notes[num] = note
    return notes


def pick_font(fam):
    if not fam:
        return '微软雅黑'
    fam = fam.lower()
    if 'cambria math' in fam:
        return 'Cambria Math'
    if 'serif' in fam and 'sans' not in fam:
        return 'Times New Roman'
    return '微软雅黑'


def set_run_fonts(run, name):
    rPr = run._r.get_or_add_rPr()
    for tag in ('a:latin', 'a:ea', 'a:cs'):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set('typeface', name)


def set_letter_spacing(run, ls_px):
    if not ls_px or ls_px < 0.5:
        return
    rPr = run._r.get_or_add_rPr()
    for t in ('a:spcPct', 'a:spcPts'):
        e = rPr.find(qn(t))
        if e is not None:
            rPr.remove(e)
    spc = rPr.makeelement(qn('a:spcPts'), {'val': str(int(round(ls_px * 100)))})
    rPr.append(spc)


def set_bg(slide, color):
    if not color:
        return
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


# 动画分组命名：HTML 里写 data-anim="p6r1"，构出的形状就命名成 p6r1@0 / p6r1@1 …
# PowerPoint 侧按名字前缀找形状挂动画（见 animate_experiment.ps1）。
_ANIM_COUNT = {}


def name_shape(shape, el):
    a = (el.get('anim') or '').strip()
    if not a:
        return
    n = _ANIM_COUNT.get(a, 0)
    _ANIM_COUNT[a] = n + 1
    try:
        shape.name = f"{a}@{n}"
    except Exception:
        pass


def add_text(slide, el):
    x, y, w, h = E(el['x']), E(el['y']), E(el['w']), E(el['h'])
    if w <= 0 or h <= 0:
        return
    base_fs = el.get('fs', 24)
    lh = el.get('lhEff')
    tb = slide.shapes.add_textbox(x, y, w, h)
    name_shape(tb, el)
    tf = tb.text_frame
    # 浏览器已按容器宽度折行并据此量得盒高；PowerPoint 默认 nowrap 会让长句冲出页面。
    # lhEff 是「元素总高」而非单行高，故用「盒高 / 字号 >= 1.9」判定是否为多行文本，
    # 只对真正折了行的盒子开自动换行，避免单行盒子被 PowerPoint 误折成两行。
    try:
        _fs = float(base_fs) if base_fs else 24.0
        _multi = _fs > 0 and (float(el.get('h', 0)) / _fs) >= 1.9
    except (TypeError, ValueError):
        _multi = False
    tf.word_wrap = bool(el.get('wrap')) or _multi
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.TOP

    runs = el.get('runs', [])
    paras = [[]]
    for r in runs:
        if r.get('br'):
            paras.append([])
        else:
            paras[-1].append(r)
    paras = [p for p in paras if p]
    if not paras:
        return

    ta = (el.get('ta') or 'left').lower()
    align = {'center': PP_ALIGN.CENTER, 'right': PP_ALIGN.RIGHT}.get(ta, PP_ALIGN.LEFT)

    # 行距：extract 给的 lhEff 是「元素总高」而不是单行高，直接拿来设 line_spacing
    # 会让 N 行文本撑成 N×总高（P8 定律、P9 注意条都因此压到下一块内容）。
    # 这里按「总高 / 估算行数」还原单行高；估算行数用 h/(fs*1.5) 四舍五入；
    # 单行文本不设行距，交给 PowerPoint 默认，避免首行被无谓下推。
    _fs_num = 0.0
    try:
        _fs_num = float(base_fs) if base_fs else 0.0
    except (TypeError, ValueError):
        _fs_num = 0.0
    line_pt = None
    if lh and _fs_num > 0:
        try:
            _n = max(1, round(float(el.get('h', 0)) / (_fs_num * 1.5)))
        except (TypeError, ValueError):
            _n = 1
        if _n > 1:
            line_pt = float(el.get('h', 0)) / _n

    for pi, plist in enumerate(paras):
        p = tf.paragraphs[0] if pi == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_before = Pt(0)
        p.space_after = Pt(0)
        if line_pt:
            p.line_spacing = Pt(line_pt)
        for r in plist:
            run = p.add_run()
            run.text = r.get('t', '')
            f = run.font
            fs = r.get('fs', base_fs)
            f.size = Pt(fs)
            f.bold = int(r.get('fw', 400) or 400) >= 600
            f.italic = bool(r.get('italic'))
            f.underline = bool(r.get('under'))
            col = parse_color(r.get('color')) or parse_color(el.get('color'))
            if col:
                f.color.rgb = col
            fam = r.get('fam') or ''
            name = pick_font(fam)
            set_run_fonts(run, name)
            set_letter_spacing(run, r.get('ls', 0))
    # SVG 内文字可能有旋转（合运动等），按量测角旋转文本框
    rot = el.get('rot')
    if rot:
        try:
            tb.rotation = float(rot)
        except (TypeError, ValueError):
            pass
    return tb


def add_shape(slide, el):
    bg = parse_color(el.get('bg'))
    bdc = parse_color(el.get('bdc')) if el.get('bdc') else None
    bdw = el.get('bdw', 0) or 0
    radius = el.get('radius', 0) or 0
    w = el['w']
    h = el['h']
    if w <= 0 or h <= 0:
        return
    is_oval = radius and radius >= (min(w, h) / 2.0) - 0.5
    shp_type = MSO_SHAPE.OVAL if is_oval else MSO_SHAPE.RECTANGLE
    sp = slide.shapes.add_shape(shp_type, E(el['x']), E(el['y']), E(w), E(h))
    name_shape(sp, el)
    if bg:
        sp.fill.solid()
        sp.fill.fore_color.rgb = bg
    else:
        sp.fill.background()
    if bdc and bdw:
        sp.line.color.rgb = bdc
        sp.line.width = Pt(bdw)
    else:
        sp.line.fill.background()
        sp.line.width = 0
    sp.shadow.inherit = False
    return sp


def add_svg(slide, el):
    fpath = el.get('file')
    if not fpath or not os.path.exists(fpath):
        return
    w = el['w']
    h = el['h']
    if w <= 0 or h <= 0:
        return
    pic = slide.shapes.add_picture(fpath, E(el['x']), E(el['y']), E(w), E(h))
    name_shape(pic, el)


def add_img(slide, el):
    add_svg(slide, el)


def fix_paths(data, dom_path):
    """extract.mjs 把截图路径存成相对 outDir 的形式，可能因 cwd 不同而找不到。
    统一改写为：原路径存在则用；否则回退到 dom 同目录的 assets/<basename>。"""
    dom_dir = os.path.dirname(os.path.abspath(dom_path))
    assets_dir = os.path.join(dom_dir, 'assets')
    for p in data.get('pages', []):
        for el in p.get('els', []):
            f = el.get('file')
            if not f:
                continue
            if os.path.exists(f):
                continue
            cand = os.path.join(assets_dir, os.path.basename(f))
            if os.path.exists(cand):
                el['file'] = cand


def build(dom_path, out_path, spec_path=None):
    data = json.load(open(dom_path, encoding='utf-8'))
    fix_paths(data, dom_path)
    pages = data['pages']
    notes = parse_notes(spec_path) if spec_path else {}

    prs = Presentation()
    prs.slide_width = Emu(E(1920))
    prs.slide_height = Emu(E(1080))
    blank = prs.slide_layouts[6]

    n_notes = 0
    for p in pages:
        _ANIM_COUNT.clear()
        slide = prs.slides.add_slide(blank)
        set_bg(slide, parse_color(p.get('bg')))
        for el in p.get('els', []):
            k = el.get('kind')
            if k in ('text', 'svgtext'):
                add_text(slide, el)
            elif k == 'shape':
                add_shape(slide, el)
            elif k == 'svg':
                add_svg(slide, el)
            elif k == 'img':
                add_img(slide, el)
        idx = p.get('index')
        if idx in notes:
            slide.notes_slide.notes_text_frame.text = notes[idx]
            n_notes += 1
        # 统计
        n_t = sum(1 for e in p.get('els', []) if e.get('kind') in ('text', 'svgtext'))
        n_s = sum(1 for e in p.get('els', []) if e.get('kind') == 'shape')
        n_i = sum(1 for e in p.get('els', []) if e.get('kind') in ('svg', 'img'))
        print(f"  P{idx:02d}: 文本框{n_t} 形状{n_s} 图{n_i}{' [备注✓]' if idx in notes else ''}")

    prs.save(out_path)
    print(f"✅ {out_path}  ({len(pages)} 页, 备注 {n_notes} 页)")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("usage: build_editable.py <dom.json> <out.pptx> [--spec spec.md]")
        sys.exit(1)
    dom = sys.argv[1]
    out = sys.argv[2]
    spec = None
    if '--spec' in sys.argv:
        spec = sys.argv[sys.argv.index('--spec') + 1]
    build(dom, out, spec)
