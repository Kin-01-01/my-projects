# -*- coding: utf-8 -*-
"""忠实转换：PDF -> DOCX，保留原始版面/字体/布局，不做任何优化。"""
import logging
from pdf2docx import Converter

PDF = r"D:\亚稳相_文献\基于机器学习的固态电解质材料筛选与性能预测_万政.pdf"
OUT = r"D:\亚稳相_文献\基于机器学习的固态电解质材料筛选与性能预测_万政.docx"

# 关闭 pdf2docx 的过度日志
logging.getLogger("pdf2docx").setLevel(logging.ERROR)

cv = Converter(PDF)
cv.convert(OUT, multi_processing=False, cpu_count=1)
cv.close()
print("saved:", OUT)
