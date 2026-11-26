# -*- coding: utf-8 -*-
"""最终优化：可点击目录 + 统一题注 + 规整参考文献 + 消除正文跨行断句。"""
import re
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

SRC = "万政_基于机器学习的固态电解质材料筛选与性能预测_优化版.docx"
OUT = "万政_基于机器学习的固态电解质材料筛选与性能预测_最终版.docx"
doc = Document(SRC)

def remove_elem(p):
    el = p._p
    if el.getparent() is not None:
        el.getparent().remove(el)

def present(p):
    return p._p.getparent() is not None

def append_text(anchor, text, add_space=False):
    if not text:
        return
    last = anchor.runs[-1] if anchor.runs else None
    if add_space:
        anchor.add_run(' ' + text)
    else:
        if last is not None:
            last.text = last.text + text
        else:
            anchor.add_run(text)

def set_run_font(run, ea, lat, size=None, bold=None):
    run.font.name = lat
    rpr = run._r.get_or_add_rPr()
    rf = rpr.get_or_add_rFonts()
    rf.set(qn('w:eastAsia'), ea); rf.set(qn('w:ascii'), lat); rf.set(qn('w:hAnsi'), lat)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold

def style_para_fonts(p, ea, lat, size, bold=False, center=False):
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else p.alignment
    if not p.runs:
        p.add_run('')
    for r in p.runs:
        set_run_font(r, ea, lat, size, bold)

# ---------- 定位关键段落 ----------
paras = doc.paragraphs
toc_title = None
figlist = None
for p in paras:
    t = p.text.strip()
    if toc_title is None and p.style.name == 'Heading 1' and t == '目录':
        toc_title = p
    if figlist is None and t == '插图和附表页清单':
        figlist = p
assert toc_title is not None and figlist is not None, "未找到目录/图清单"

# ---------- 1. 删除静态目录条目（目录标题与图清单之间）----------
def delete_between(a, b):
    ael, bel = a._p, b._p
    # 收集 a 之后、b 之前的 w:p
    to_remove = []
    sib = ael.getnext()
    while sib is not None and sib is not bel:
        if sib.tag == qn('w:p'):
            to_remove.append(sib)
        sib = sib.getnext()
    for el in to_remove:
        el.getparent().remove(el)
    return len(to_remove)

removed = delete_between(toc_title, figlist)

# ---------- 2. 插入可点击目录域 ----------
def make_toc_field():
    p = OxmlElement('w:p')
    def run(fc=None, instr=None, text=None):
        r = OxmlElement('w:r')
        if fc:
            e = OxmlElement('w:fldChar'); e.set(qn('w:fldCharType'), fc); r.append(e)
        if instr:
            e = OxmlElement('w:instrText'); e.set(qn('xml:space'), 'preserve'); e.text = instr; r.append(e)
        if text:
            e = OxmlElement('w:t'); e.set(qn('xml:space'), 'preserve'); e.text = text; r.append(e)
        return r
    p.append(run(fc='begin'))
    p.append(run(instr=' TOC \\o "1-2" \\h \\z \\u '))
    p.append(run(fc='separate'))
    p.append(run(text='（打开后请右键单击此处，选择“更新域”以生成带超链接的目录）'))
    p.append(run(fc='end'))
    return p

toc_field = make_toc_field()
toc_title._p.addnext(toc_field)

# 目录标题改为 Title 样式（避免被 TOC 自身收录），并设字体
toc_title.style = doc.styles['Title']
style_para_fonts(toc_title, '黑体', 'Times New Roman', 18, bold=True, center=True)

# 打开时自动更新域
try:
    settings = doc.settings.element
    uf = OxmlElement('w:updateFields'); uf.set(qn('w:val'), 'true')
    settings.append(uf)
except Exception as e:
    print('updateFields skip:', e)

# ---------- 3. 题注/参考文献/正文跨行断句 统一处理 ----------
RE_CAP = re.compile(r'^(图|表)\s*[\d一二三四五六七八九十百]+\.')
RE_TRAILPAGE = re.compile(r'\.{4,}\s*[IVXLCDM\d]+\s*$')
RE_REFSTART = re.compile(r'^\[\d+\]|^\d+\.')
RE_SENT_END = re.compile(r'[。！？.!?]$')
RE_STRUCT = re.compile(r'^(图|表)\s*[\d一二三四五六七八九十百]+\.|第[一二三四五六七八九十]+章|^摘要|^Abstract|^参考文献|^致谢|^附录|^攻读')

def is_caption(p):
    t = p.text.strip()
    return p.style.name == 'Normal' and RE_CAP.match(t) and not RE_TRAILPAGE.search(t)

def is_refstart(p):
    t = p.text.strip()
    return p.style.name == 'Normal' and RE_REFSTART.match(t)

def merge_continuations(anchor, in_ref):
    # 若锚点本身已以句末标点结束，视为完整，不合并任何后续
    if RE_SENT_END.search(anchor.text.strip()):
        return
    nxt = anchor._p.getnext()
    while nxt is not None and nxt.tag == qn('w:p'):
        np = Paragraph(nxt, doc)
        if not present(np):
            nxt = anchor._p.getnext(); continue
        nt = np.text.strip()
        if nt == '':
            remove_elem(np); nxt = anchor._p.getnext(); continue
        # 遇到新的结构性段落则停止
        if RE_STRUCT.match(nt) or is_caption(np) or (in_ref and is_refstart(np)):
            break
        # 合并
        at = anchor.text.rstrip()
        add_space = bool(re.search(r'[A-Za-z0-9]$', at) and re.match(r'[A-Za-z0-9]', nt))
        append_text(anchor, nt, add_space=add_space)
        remove_elem(np)
        nxt = anchor._p.getnext()
        if RE_SENT_END.search(anchor.text):
            break
        if len(anchor.text) > 500:
            break

# 第二遍：遍历处理
in_body = False
in_ref = False
last_anchor = None
caption_count = 0
ref_count = 0
merge_count = 0

for p in list(doc.paragraphs):
    if not present(p):
        continue
    if p is toc_title or p._p is toc_field:
        continue
    sty = p.style.name
    t = p.text.strip()
    if sty.startswith('Heading'):
        if re.match(r'^参考文献', t):
            in_ref = True
        elif re.match(r'^第[一二三四五六]章', t):
            in_ref = False; in_body = True
        else:
            in_ref = False
        last_anchor = p
        continue
    if not in_body:
        last_anchor = p
        continue
    # 正文/前置内的普通段落
    if is_caption(p):
        merge_continuations(p, in_ref=False)
        style_para_fonts(p, '宋体', 'Times New Roman', 10.5, center=True)
        caption_count += 1
        last_anchor = p
        continue
    if in_ref and is_refstart(p):
        merge_continuations(p, in_ref=True)
        # 参考文献格式：悬挂缩进、小五号、宋体
        p.paragraph_format.left_indent = Pt(24)
        p.paragraph_format.first_line_indent = Pt(-24)
        style_para_fonts(p, '宋体', 'Times New Roman', 10.5)
        ref_count += 1
        last_anchor = p
        continue
    # 普通正文续行合并（仅当上一个锚点未以句末标点结束，且非题注/文献锚点）
    if (last_anchor is not None and present(last_anchor)
            and last_anchor.style.name == 'Normal'
            and not RE_CAP.match(last_anchor.text.strip())
            and not re.match(r'^\[\d+\]|^\d+\.', last_anchor.text.strip())
            and not RE_SENT_END.search(last_anchor.text.strip())):
        at = last_anchor.text.rstrip()
        add_space = bool(re.search(r'[A-Za-z0-9]$', at) and re.match(r'[A-Za-z0-9]', t))
        append_text(last_anchor, t, add_space=add_space)
        remove_elem(p)
        merge_count += 1
        continue
    last_anchor = p

doc.save(OUT)
print(f"removed_static_toc={removed}")
print(f"caption_styled={caption_count} ref_styled={ref_count} body_merge={merge_count}")
print("saved:", OUT)
