# -*- coding: utf-8 -*-
import re
from docx import Document
doc = Document("万政_基于机器学习的固态电解质材料筛选与性能预测_优化版.docx")
paras = doc.paragraphs

print("=== 所有 Heading 1（含索引）===")
for i,p in enumerate(paras):
    if p.style.name == 'Heading 1':
        print(i, repr(p.text[:30]))

print("\n=== 关键边界 ===")
for kw in ['插图和附表页清单','致谢','攻读学位期间','附录','个人简历','论文发表','缩略语','符号说明']:
    for i,p in enumerate(paras):
        if p.text.strip().startswith(kw):
            print(kw, "idx:", i, repr(p.text[:30]))
            break

# real first body chapter H1 (第X章 ... not TOC entry)
print("\n=== 真实章节 H1（第X章 且 Heading1）===")
for i,p in enumerate(paras):
    if p.style.name=='Heading 1' and re.match(r'^第[一二三四五六七八九十]+章', p.text.strip()):
        print(i, repr(p.text[:30]))
