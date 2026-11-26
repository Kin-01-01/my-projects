# -*- coding: utf-8 -*-
import re
from docx import Document
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH

OUT = "万政_基于机器学习的固态电解质材料筛选与性能预测_最终版.docx"
doc = Document(OUT)
paras = doc.paragraphs

# 标题层级计数
from collections import Counter
c = Counter(p.style.name for p in paras)
print("H1/H2/H3:", c['Heading 1'], c['Heading 2'], c['Heading 3'])

# 正文题注（排除前置图清单）：找 body 区（第一章 之后）的 图/表 且非 trailing page
first_chap = next(i for i,p in enumerate(paras) if p.style.name=='Heading 1' and re.match(r'^第一章', p.text.strip()))
print("first chapter idx:", first_chap)

body_caps = []
for p in paras[first_chap:]:
    t = p.text.strip()
    if re.match(r'^(图|表)\s*[\d一二三四五六七八九十百]+\.', t) and not re.search(r'\.{4,}\s*[IVXLCDM\d]*\s*$', t):
        body_caps.append(p)
print("body caption count:", len(body_caps))
for p in body_caps[:5]:
    print(f"  align={p.alignment} size={p.runs[0].font.size if p.runs else None} text={p.text.strip()[:45]}")

# 目录标题
for p in paras[:6]:
    if p.text.strip()=='目录':
        print("目录 style=", p.style.name, "align=", p.alignment)

# TOC 域内容
for p in paras:
    if '更新域' in p.text or 'TOC' in p.text:
        print("TOC-field para text:", repr(p.text[:60]))
        break

# 前置图清单 图1.1 应保持原样（不应居中）
for p in paras[:first_chap]:
    t=p.text.strip()
    if t.startswith('图1.1'):
        print("front 图1.1 align=", p.alignment, "text=", t[:40])
        break
