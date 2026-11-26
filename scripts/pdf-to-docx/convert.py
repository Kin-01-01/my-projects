import sys, time
from pdf2docx import Converter

PDF = "wan_pdf.pdf"
DOCX = "万政_基于机器学习的固态电解质材料筛选与性能预测.docx"

t0 = time.time()
try:
    cv = Converter(PDF)
    cv.convert(DOCX, multi_processing=False)
    cv.close()
    print(f"OK: {DOCX}  ({(time.time()-t0)/60:.1f} min)")
except Exception as e:
    print("ERROR:", repr(e))
    sys.exit(1)
