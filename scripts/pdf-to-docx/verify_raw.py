# -*- coding: utf-8 -*-
"""核对忠实转换的文字完整性：PDF 全文词元 vs DOCX 全文词元。"""
import re, sys
import fitz  # pymupdf
from docx import Document

PDF = r"D:\亚稳相_文献\基于机器学习的固态电解质材料筛选与性能预测_万政.pdf"
DOCX = r"D:\亚稳相_文献\基于机器学习的固态电解质材料筛选与性能预测_万政.docx"

TOKEN = re.compile(r'[\u4e00-\u9fffA-Za-z0-9]+')

# 1) PDF 全文
d = fitz.open(PDF)
pdf_text = []
for pg in d:
    pdf_text.append(pg.get_text())
pdf_text = "\n".join(pdf_text)
d.close()
pdf_tokens = TOKEN.findall(pdf_text)
pdf_set = set(pdf_tokens)

# 2) DOCX 全文
doc = Document(DOCX)
doc_text_parts = [p.text for p in doc.paragraphs]
for tb in doc.tables:
    for row in tb.rows:
        for cell in row.cells:
            doc_text_parts.append(cell.text)
doc_text = "\n".join(doc_text_parts)
doc_tokens = TOKEN.findall(doc_text)
doc_set = set(doc_tokens)

# 3) 乱码扫描
garbled = doc_text.count("\ufffd")

# 4) 缺失词（PDF 有、DOCX 无）
missing = [t for t in pdf_tokens if t not in doc_set]
missing_set = set(missing)
# 统计长度分布
short = [t for t in missing_set if len(t) <= 3]
long_ = [t for t in missing_set if len(t) > 3]

print("PDF 词元总数:", len(pdf_tokens), " 去重:", len(pdf_set))
print("DOCX 词元总数:", len(doc_tokens), " 去重:", len(doc_set))
print("DOCX 覆盖率(去重词): %.2f%%" % (100.0 * len(pdf_set & doc_set) / len(pdf_set)))
print("乱码(\\ufffd)数:", garbled)
print("缺失词(去重)数:", len(missing_set))
print("  其中 <=3 字符(多为公式片段):", len(short))
print("  其中 >3 字符:", len(long_))
print("缺失词样本(前 40):", missing_set if len(missing_set) <= 40 else list(missing_set)[:40])
