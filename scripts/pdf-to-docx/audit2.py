# -*- coding: utf-8 -*-
import re
from docx import Document
from docx.oxml.ns import qn

SRC = "万政_基于机器学习的固态电解质材料筛选与性能预测_优化版.docx"
doc = Document(SRC)

paras = [p.text for p in doc.paragraphs]
print("total paragraphs:", len(paras))

# ---- 1. TOC region ----
print("\n=== 目录区域探测 ===")
for i, t in enumerate(paras):
    if t.strip() in ("目录",) or re.match(r'^目录\s*$', t):
        print("目录 H1 at idx", i)
        # show next 25 non-empty
        c = 0
        for j in range(i+1, min(i+60, len(paras))):
            s = paras[j].strip()
            if s:
                print("  ", repr(s[:60]))
                c += 1
                if c >= 25: break
        break

# ---- 2. caption-like (图/表) ----
print("\n=== 图/表题注样本 ===")
cap_pat = re.compile(r'^(图|表)\s*[\d一二三四五六七八九十]+\.')
cnt = 0
for t in paras:
    s = t.strip()
    if cap_pat.match(s):
        print("  ", repr(s[:70]), "| style-ok?")
        cnt += 1
        if cnt >= 15: break
print("caption-like count:", sum(1 for t in paras if cap_pat.match(t.strip())))

# ---- 3. reference region ----
print("\n=== 参考文献区域探测 ===")
ref_start = None
for i, t in enumerate(paras):
    if re.match(r'^参考文献', t.strip()):
        ref_start = i
        print("参考文献 at idx", i)
        break
if ref_start is not None:
    for j in range(ref_start, min(ref_start+20, len(paras))):
        s = paras[j].strip()
        if s:
            print("  ", repr(s[:70]))
    # count reference entries: lines starting with [n] or number.
    refs = [paras[j] for j in range(ref_start, len(paras))
            if re.match(r'^\s*\[\d+\]', paras[j]) or re.match(r'^\s*\d+\.', paras[j])]
    print("reference-like entries:", len(refs))

# ---- 4. cross-line fragment detection ----
print("\n=== 跨行断句（续行碎片）探测 ===")
END_PUN = re.compile(r'[。！？；：，,）)\]”"、]$')
SENT_END = re.compile(r'[。！？]$')
frag = 0
samples = []
for i in range(1, len(paras)):
    prev = paras[i-1].strip()
    cur = paras[i].strip()
    if not prev or not cur: continue
    # skip headings
    sty = doc.paragraphs[i-1].style.name
    if sty.startswith('Heading'): continue
    # continuation if prev doesn't end with sentence-ending punct AND cur doesn't start with typical new-block markers
    if (not SENT_END.search(prev)) and (not re.match(r'^(图|表|第|[\d]+\.|\[|\()', cur)):
        frag += 1
        if len(samples) < 8:
            samples.append((prev[-30:], cur[:40]))
print("possible continuation fragments:", frag)
for a,b in samples:
    print("  prev_end:", repr(a), "-> cur:", repr(b))
