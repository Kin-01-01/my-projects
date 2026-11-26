# -*- coding: utf-8 -*-
import re
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

SRC = "万政_基于机器学习的固态电解质材料筛选与性能预测.docx"
OUT = "万政_基于机器学习的固态电解质材料筛选与性能预测_优化版.docx"

doc = Document(SRC)

# ---------- 1. 样式字体 ----------
def set_style_font(style, ea, lat, size, bold=False):
    style.font.name = lat
    style.font.size = Pt(size)
    style.font.bold = bold
    rpr = style.element.get_or_add_rPr()
    rf = rpr.get_or_add_rFonts()
    rf.set(qn('w:eastAsia'), ea); rf.set(qn('w:ascii'), lat); rf.set(qn('w:hAnsi'), lat)

set_style_font(doc.styles['Normal'], '宋体', 'Times New Roman', 12, False)
for n,(ea,lat,sz) in {'Heading 1':('黑体','Times New Roman',16),
                      'Heading 2':('黑体','Times New Roman',14),
                      'Heading 3':('黑体','Times New Roman',12)}.items():
    set_style_font(doc.styles[n], ea, lat, sz, True)

# ---------- 2. 行级标题识别（严格，容忍空格，排除误匹配）----------
RE_DOTS  = re.compile(r'\.{4,}')
RE_TOC   = re.compile(r'\s\d+\s*$')                 # 以页码结尾 -> 目录项
RE_CH    = re.compile(r'^第[一二三四五六七八九十百]+章[一-龥]')
RE_LABEL = re.compile(r'^(摘要|Abstract|目录|参考文献|致谢|附录|攻读学位期间|符号说明|缩略语说明)')
RE_H3    = re.compile(r'^\d+\.\d+\.\d+\s*[一-龥A-Za-z]')
RE_H2    = re.compile(r'^\d+\.\d+(?!\.\d)\s*[一-龥A-Za-z]')

def line_level(s):
    s = s.strip()
    if not s: return None
    if RE_DOTS.search(s): return None
    if RE_TOC.search(s):  return None
    if RE_LABEL.match(s): return 'H1'
    if RE_CH.match(s):    return 'H1'
    if RE_H3.match(s):    return 'H3'
    if RE_H2.match(s):    return 'H2'
    return None

# ---------- 3. 段落重建（合并段递归拆分）----------
LV2STYLE = {'H1':'Heading 1','H2':'Heading 2','H3':'Heading 3','B':'Normal'}

def set_para_text(p, text):
    for r in list(p.runs):
        r._r.getparent().remove(r._r)
    if text:
        p.add_run(text)

def make_para_after(ref, text, style_name, is_body):
    new = OxmlElement('w:p')
    ref._p.addnext(new)
    np = Paragraph(new, ref._parent)
    np.style = doc.styles[LV2STYLE[style_name]]
    if is_body:
        np.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        np.paragraph_format.line_spacing = 1.5
        np.paragraph_format.space_after = Pt(6)
    if text:
        np.add_run(text)
    return np

def rebuild(p, first_h1):
    text = p.text
    lines = [ln.strip() for ln in text.split('\n') if ln.strip()]
    if not lines:
        return first_h1
    lvl0 = line_level(lines[0])
    if lvl0 is None:
        # 纯正文段：统一格式
        for r in p.runs:
            rp = r._r.get_or_add_rPr()
            for tg in ('w:rFonts','w:sz','w:szCs'):
                el = rp.find(qn(tg))
                if el is not None: rp.remove(el)
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_after = Pt(6)
        return first_h1
    # 标题段：拆成 [标题, 标题, 正文...]
    chunks = [(lvl0, lines[0])]
    pending = []
    for ln in lines[1:]:
        hl = line_level(ln)
        if hl and len(ln) <= 50 and not re.search(r'[。！？]', ln):
            if pending:
                chunks.append(('B', ' '.join(pending))); pending = []
            chunks.append((hl, ln))
        else:
            pending.append(ln)
    if pending:
        chunks.append(('B', ' '.join(pending)))
    # 应用到 p 与后续新建段落
    set_para_text(p, chunks[0][1])
    p.style = doc.styles[LV2STYLE[chunks[0][0]]]
    if chunks[0][0] == 'H1':
        if first_h1: p.paragraph_format.page_break_before = True
        first_h1 = True
    else:
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_after = Pt(6)
    ref = p
    for (lvl, txt) in chunks[1:]:
        ref = make_para_after(ref, txt, lvl, is_body=(lvl == 'B'))
        if lvl == 'H1':
            if first_h1: ref.paragraph_format.page_break_before = True
            first_h1 = True
    return first_h1

# ---------- 4. 主流程（快照遍历，避免边改边遍历）----------
first_h1 = False
for p in list(doc.paragraphs):
    first_h1 = rebuild(p, first_h1)

doc.save(OUT)
print("saved:", OUT)
