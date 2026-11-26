# -*- coding: utf-8 -*-
"""字符级完整性核对：去掉空白后比较 PDF 与 DOCX 的字符覆盖，隔离真正的掉字。"""
import re
import fitz
from docx import Document
from collections import Counter

PDF = r"D:\亚稳相_文献\基于机器学习的固态电解质材料筛选与性能预测_万政.pdf"
DOCX = r"D:\亚稳相_文献\基于机器学习的固态电解质材料筛选与性能预测_万政.docx"

def norm(s):
    return re.sub(r'\s+', '', s)  # 去掉所有空白/换行

# PDF 全文
d = fitz.open(PDF)
pdf_text = "\n".join(p.get_text() for p in d)
d.close()
pdf_n = norm(pdf_text)

# DOCX 全文
doc = Document(DOCX)
parts = [p.text for p in doc.paragraphs]
for tb in doc.tables:
    for row in tb.rows:
        for cell in row.cells:
            parts.append(cell.text)
doc_n = norm("\n".join(parts))

# 仅统计「有意义字符」：CJK + 字母 + 数字
KEEP = re.compile(r'[\u4e00-\u9fffA-Za-z0-9]')
pdf_chars = Counter(c for c in pdf_n if KEEP.match(c))
doc_chars = Counter(c for c in doc_n if KEEP.match(c))

total = sum(pdf_chars.values())
present = sum(min(pdf_chars[c], doc_chars.get(c, 0)) for c in pdf_chars)
missing = sum(pdf_chars[c] - doc_chars.get(c, 0) for c in pdf_chars if pdf_chars[c] > doc_chars.get(c, 0))
print("PDF 有意义字符总数:", total)
print("DOCX 字符覆盖率: %.3f%%" % (100.0 * present / total))
print("疑似掉字符数(字符级):", missing)
# 掉字按字符列出（多为公式符号/上下标）
miss_counter = Counter()
for c in pdf_chars:
    gap = pdf_chars[c] - doc_chars.get(c, 0)
    if gap > 0:
        miss_counter[c] += gap
print("掉字种类(字符: 缺失次数):", dict(miss_counter.most_common(60)))

# 乱码
print("乱码(\\ufffd)数:", doc_n.count("\ufffd"))
