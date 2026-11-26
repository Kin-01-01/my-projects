# -*- coding: utf-8 -*-
import re
from docx import Document
doc = Document("万政_基于机器学习的固态电解质材料筛选与性能预测_优化版.docx")
paras = doc.paragraphs

def info(i):
    p = paras[i]
    return (i, p.style.name, repr(p.text[:55]))

print("=== 前 100 段（封面/摘要/目录/图清单区域）===")
for i in range(70, 130):
    print(info(i))

# find first chapter heading (第一章) index
print("\n=== 第一章 / 参考文献 真实位置 ===")
for i,p in enumerate(paras):
    t=p.text.strip()
    if re.match(r'^第一章', t):
        print("第一章 idx:", i, repr(t[:40]))
        break
# find all 参考文献 headings (chapter-end ones)
refs=[i for i,p in enumerate(paras) if re.match(r'^参考文献', p.text.strip())]
print("参考文献 headings at:", refs)
# find 致谢 / 攻读 / 附录 near end
for kw in ['致谢','攻读学位','附录','个人简历','论文发表']:
    for i,p in enumerate(paras):
        if p.text.strip().startswith(kw):
            print(kw,"idx:", i, repr(p.text[:30]))
            break
