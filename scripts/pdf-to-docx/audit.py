# -*- coding: utf-8 -*-
import re
from docx import Document

F = "万政_基于机器学习的固态电解质材料筛选与性能预测_优化版.docx"
d = Document(F)
paras = [p for p in d.paragraphs]

# 标题模式（宽松：允许数字后空格）
RE_CH    = re.compile(r'^第[一二三四五六七八九十百]+章')
RE_LABEL = re.compile(r'^(摘要|Abstract|目录|参考文献|致谢|附录|攻读学位期间|符号说明|缩略语说明)')
RE_H3    = re.compile(r'^\d+\.\d+\.\d+\s*[^\s\d]')
RE_H2    = re.compile(r'^\d+\.\d+\s*[^\s\d]')
RE_DOTS  = re.compile(r'\.{4,}')

def looks_heading(t):
    if RE_DOTS.search(t): return None
    if RE_LABEL.match(t): return 'H1'
    if RE_CH.match(t):    return 'H1'
    if RE_H3.match(t):    return 'H3'
    if RE_H2.match(t):    return 'H2'
    return None

print("===== 当前所有标题（层级 | 文本）=====")
for i,p in enumerate(paras):
    if p.style.name.startswith('Heading'):
        lvl = p.style.name[-1]
        print(f"  {lvl} | {p.text.strip()[:60]}")

print("\n===== 误标/漏标排查：Normal 段落中像标题的（可能漏标）=====")
fn=0
for p in paras:
    if p.style.name!='Normal': continue
    t=p.text.strip()
    if not t: continue
    h=looks_heading(t)
    if h:
        fn+=1
        print(f"  [{h}?] {t[:60]}")
print("  疑似漏标数量:", fn)

print("\n===== 编号一致性：同一父节点下的同级编号是否层级统一 =====")
# 收集 H2 与 H3 的编号，找同父不同级
from collections import defaultdict
children=defaultdict(set)
for p in paras:
    if not p.style.name.startswith('Heading'): continue
    t=p.text.strip()
    m=re.match(r'^(\d+)\.(\d+)(?:\.(\d+))?', t)
    if not m: continue
    if m.group(3):  # 三级
        parent=m.group(1)+'.'+m.group(2)
        children[('H3',parent)].add(t[:12])
    else:
        parent=m.group(1)
        children[('H2',parent)].add(t[:12])
# 打印三级标题的父章节，看是否都标成 H3
print("  H3 各父章节下的三级条目数：")
h3parent=defaultdict(int)
for p in paras:
    if p.style.name!='Heading 3': continue
    t=p.text.strip()
    m=re.match(r'^(\d+)\.(\d+)\.(\d+)', t)
    if m: h3parent[m.group(1)+'.'+m.group(2)]+=1
for k,v in sorted(h3parent.items()):
    print(f"    {k}.* -> {v} 个三级标题")
