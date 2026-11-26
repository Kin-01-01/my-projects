# -*- coding: utf-8 -*-
import re
from docx import Document
from docx.oxml.ns import qn

OUT = "万政_基于机器学习的固态电解质材料筛选与性能预测_最终版.docx"
doc = Document(OUT)
paras = doc.paragraphs
print("total paragraphs:", len(paras))

# 1. TOC field present?
xml = doc.element.xml
print("TOC field present:", 'TOC \\o' in xml or 'TOC \\o' in xml.replace('\\','\\\\'))
print("updateFields present:", 'updateFields' in xml)

# 2. 目录标题样式
for p in paras[:5]:
    if p.text.strip()=='目录':
        print("目录 style:", p.style.name, "align:", p.alignment, "size:", (p.runs[0].font.size if p.runs else None))
        break

# 3. 抽查正文开头（第一章 绪论 之后）
print("\n=== 第一章正文样本（合并后）===")
seen=0
for p in paras:
    if p.text.strip().startswith('第一章') and p.style.name=='Heading 1':
        # print next 12 non-empty
        it=iter(paras[paras.index(p)+1:])
        c=0
        for q in paras[paras.index(p)+1:paras.index(p)+40]:
            t=q.text.strip()
            if t:
                print(f"  [{q.style.name}] {t[:90]}")
                c+=1
                if c>=12: break
        break

# 4. 核对题注居中 + 文献悬挂缩进
print("\n=== 题注/文献样式核对 ===")
cap_checked=0; ref_checked=0
for p in paras:
    t=p.text.strip()
    if re.match(r'^(图|表)\s*[\d一二三四五六七八九十百]+\.', t) and not re.search(r'\.{4,}\s*[IVXLCDM\d]+\s*$', t):
        if cap_checked<3:
            print(f"  CAP align={p.alignment} indent={p.paragraph_format.left_indent} text={t[:40]}")
            cap_checked+=1
    if re.match(r'^\[\d+\]', t):
        if ref_checked<3:
            print(f"  REF indent={p.paragraph_format.left_indent} first_line={p.paragraph_format.first_line_indent} text={t[:40]}")
            ref_checked+=1

# 5. 检测可能的错误合并：段落内出现 "。X" 后紧跟新句子被粘连（粗略）
print("\n=== 潜在异常检测 ===")
bad=0
for p in paras:
    t=p.text
    # 含连续两个句末标点但中间无空格（粗略）
    if re.search(r'[。！？]{2,}', t):
        bad+=1
print("含重复句末标点的段落数:", bad)
