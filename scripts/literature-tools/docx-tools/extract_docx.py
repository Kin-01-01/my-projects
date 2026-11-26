import os, sys
from docx import Document

SRC_DIR = r"D:\微信\xwechat_files\wxid_pmntj14ade1j22_22de\msg\file\2026-10"
OUT_DIR = r"D:\workBuddy\2026-10-27-21-08-59\extracted"
os.makedirs(OUT_DIR, exist_ok=True)

files = [
    "1.题库：导论.docx",
    "2.题库：第一章.docx",
    "3.题库：第二章.docx",
    "4.题库：第三章.docx",
    "5.题库：第四章.docx",
    "6.题库：第五章.docx",
    "7.第六章  第七章.docx",
]

def dump(path):
    doc = Document(path)
    lines = []
    lines.append(f"===== FILE: {os.path.basename(path)} =====")
    lines.append(f"[paragraph count: {len(doc.paragraphs)}] [table count: {len(doc.tables)}]")
    # paragraphs
    for i, p in enumerate(doc.paragraphs):
        txt = p.text.strip()
        if txt:
            style = p.style.name if p.style else ""
            lines.append(f"[P|{style}] {txt}")
    # tables
    for ti, t in enumerate(doc.tables):
        lines.append(f"----- TABLE {ti} ({len(t.rows)}x{len(t.columns)}) -----")
        for ri, row in enumerate(t.rows):
            cells = [c.text.strip().replace("\n", " / ") for c in row.cells]
            lines.append(f"  R{ri}: " + " | ".join(cells))
    return "\n".join(lines)

for f in files:
    p = os.path.join(SRC_DIR, f)
    if not os.path.exists(p):
        print(f"MISSING: {f}")
        continue
    out = dump(p)
    outpath = os.path.join(OUT_DIR, f.replace(".docx", ".txt").replace(" ", "_"))
    with open(outpath, "w", encoding="utf-8") as fh:
        fh.write(out)
    print(f"wrote {outpath} ({len(out)} chars)")

print("ALL DONE")
