#!/usr/bin/env python3
"""Extract per-page text from the 29 literature PDFs into lit_extract/ folder.
Each output file: lit_extract/paper_NN.txt with '=== PAGE N ===' markers.
PDF physical page number == N (what user calls PDF页码)."""
import os, glob, re
import pymupdf

SRC = r"D:/相关文献汇总"
OUT = r"D:/workBuddy/2026-10-16-13-59-23/lit_extract"
os.makedirs(OUT, exist_ok=True)

# Map each PDF to a stable paper number from its filename prefix NN_.
pdfs = []
for p in glob.glob(os.path.join(SRC, "*.pdf")):
    base = os.path.basename(p)
    m = re.match(r"(\d{2})_", base)
    if m:
        pdfs.append((int(m.group(1)), p))
pdfs.sort()

total_pages = 0
report = []
for num, path in pdfs:
    doc = pymupdf.open(path)
    n = doc.page_count
    total_pages += n
    outp = os.path.join(OUT, f"paper_{num:02d}.txt")
    with open(outp, "w", encoding="utf-8") as f:
        for i in range(n):
            page = doc[i]
            text = page.get_text("text")
            f.write(f"=== PAGE {i+1} ===\n")
            f.write(text if text.strip() else "[NO EXTRACTABLE TEXT - image/scanned page]\n")
            f.write("\n")
    doc.close()
    report.append((num, n, os.path.basename(path)))

print(f"Total PDFs: {len(pdfs)}  Total pages: {total_pages}")
for num, n, name in report:
    print(f"  paper_{num:02d}: {n} pages  {name}")
