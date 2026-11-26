# -*- coding: utf-8 -*-
import os, json
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

BASE = r"D:\workBuddy\2026-10-27-21-08-59"
PARSED = os.path.join(BASE, "parsed")
OUT = os.path.join(BASE, "output")
os.makedirs(OUT, exist_ok=True)

SRC_DIR = r"D:\微信\xwechat_files\wxid_pmntj14ade1j22_22de\msg\file\2026-10"

CHAPTERS = {
    "导论":   {"src": "1.题库：导论.docx",
               "parts": ["导论_explained.json"]},
    "第一章": {"src": "2.题库：第一章.docx",
               "parts": ["第一章_explained_0.json", "第一章_explained_1.json", "第一章_explained_2.json"]},
    "第二章": {"src": "3.题库：第二章.docx",
               "parts": ["第二章_explained_0.json", "第二章_explained_1.json"]},
    "第三章": {"src": "4.题库：第三章.docx",
               "parts": ["第三章_explained_0.json", "第三章_explained_1.json", "第三章_explained_2.json"]},
    "第四章": {"src": "5.题库：第四章.docx",
               "parts": ["第四章_explained.json"]},
    "第五章": {"src": "6.题库：第五章.docx",
               "parts": ["第五章_explained.json"]},
    "第六七章": {"src": "7.第六章  第七章.docx",
               "parts": ["第六七章_explained.json"],
               "combined_note": "本文件在源题库中与第七章合并为一册（第六章 社会主义的发展及其规律 / 第七章 共产主义崇高理想及其最终实现），源文件未按章节拆分题目，故两章解析合并输出。"},
}

EASTASIA = "宋体"
HEAD_FONT = "黑体"

def set_run_font(run, size=None, bold=None, color=None, font=EASTASIA):
    run.font.name = font
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = r.makeelement(qn('w:rFonts'), {})
        rPr.append(rFonts)
    rFonts.set(qn('w:eastAsia'), font)
    rFonts.set(qn('w:ascii'), "Times New Roman")
    rFonts.set(qn('w:hAnsi'), "Times New Roman")
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color

def add_para(doc, text="", size=11, bold=False, color=None, font=EASTASIA,
             align=None, space_after=4, space_before=0, indent=None):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.space_before = Pt(space_before)
    if indent is not None:
        pf.first_line_indent = indent
    if text:
        run = p.add_run(text)
        set_run_font(run, size=size, bold=bold, color=color, font=font)
    return p

def add_runs_lines(doc, lines, size=10.5, color=None, space_after=2, label=None):
    """Add a block of text split by \n, each non-empty line as its own paragraph,
    optionally prefixed by a bold label on the first line."""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    first = True
    for ln in lines:
        if not ln.strip():
            continue
        if first and label:
            r = p.add_run(label + " ")
            set_run_font(r, size=size, bold=True, color=color)
            first = False
        r = p.add_run(ln)
        set_run_font(r, size=size, color=color)
        # soft break so subsequent lines continue in same paragraph
        r.add_break()
    return p

def get_chapter_title(src_name):
    try:
        from docx import Document as D
        d = D(os.path.join(SRC_DIR, src_name))
        for p in d.paragraphs:
            t = p.text.strip()
            if ("第" in t and "章" in t) or t == "导论":
                return t
    except Exception:
        pass
    return ""

STATUS_COLOR = {
    "correct": RGBColor(0x1E, 0x7A, 0x34),
    "wrong":   RGBColor(0xC0, 0x00, 0x00),
    "suspect": RGBColor(0xC0, 0x5A, 0x00),
}
STATUS_TEXT = {
    "correct": "✓ 经核验，给定答案正确",
    "wrong":   "✗ 给定答案有误",
    "suspect": "⚠ 存疑",
}

def build_chapter(ch, cfg):
    # load original
    orig = json.load(open(os.path.join(PARSED, ch + ".json"), encoding="utf-8"))
    # load explained
    expl = {}
    for part in cfg["parts"]:
        arr = json.load(open(os.path.join(PARSED, part), encoding="utf-8"))
        for e in arr:
            expl[e["idx"]] = e
    # merge in order
    items = []
    for q in orig:
        idx = orig.index(q)  # original list index equals idx (since parsed in order, 0-based)
        # safer: use position
        e = expl.get(len(items))
        items.append((q, e))
    # recompute idx by enumerate to be safe
    items = []
    for i, q in enumerate(orig):
        items.append((q, expl.get(i)))

    title = get_chapter_title(cfg["src"]) or ch

    doc = Document()
    # base style
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.element.rPr.rFonts.set(qn('w:eastAsia'), EASTASIA)
    style.font.size = Pt(11)

    # cover heading
    add_para(doc, title + " · 题库解析", size=20, bold=True, font=HEAD_FONT,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)
    add_para(doc, "《马克思主义基本原理》逐题核验与详解", size=12, color=RGBColor(0x55,0x55,0x55),
             align=WD_ALIGN_PARAGRAPH.CENTER, space_after=14)

    # stats
    n = len(items)
    cnt = {"correct":0, "wrong":0, "suspect":0}
    for q,e in items:
        if e:
            cnt[e["status"]] = cnt.get(e["status"],0)+1
    add_para(doc,
             f"本章共 {n} 题　|　答案正确 {cnt['correct']}　|　存疑 {cnt['suspect']}　|　答案有误 {cnt['wrong']}",
             size=11, bold=True, color=RGBColor(0x33,0x33,0x33), space_after=4)
    add_para(doc, "核验图例：✓ 正确　⚠ 存疑（题干/答案有歧义或超出常考范围）　✗ 答案有误（已给出正确项）",
             size=10, color=RGBColor(0x66,0x66,0x66), space_after=4)
    if cfg.get("combined_note"):
        add_para(doc, "注：" + cfg["combined_note"], size=10, color=RGBColor(0xC0,0x5A,0x00), space_after=8)
    add_para(doc, "说明：每题解析含【考查要点】与逐选项（或正误）分析，依据高等教育出版社《马克思主义基本原理》（2023年版）及考研政治权威表述。",
             size=10, color=RGBColor(0x66,0x66,0x66), space_after=10)

    # group by section preserving order
    sections = []
    sec_map = {}
    for q, e in items:
        s = q["section"]
        if s not in sec_map:
            sec_map[s] = []
            sections.append(s)
        sec_map[s].append((q, e))

    for s in sections:
        # section heading
        add_para(doc, s, size=14, bold=True, font=HEAD_FONT, color=RGBColor(0x1F,0x3A,0x5F), space_after=6, space_before=8)
        for q, e in sec_map[s]:
            num = q["number"]
            # question header
            ph = add_para(doc, f"{num}.（{s.replace('一、','').replace('二、','').replace('三、','').replace('四、','')}）{q['stem']}",
                         size=11.5, bold=True, color=RGBColor(0x11,0x11,0x11), space_after=2)
            # options
            if q["options"]:
                for letter, txt in q["options"]:
                    add_para(doc, f"{letter}. {txt}", size=10.5, space_after=1, indent=Pt(14))
            # given answer
            add_para(doc, f"【给定答案】{q['answer']}", size=10.5, bold=True, color=RGBColor(0x33,0x33,0x33), space_after=1, indent=Pt(14))
            # verification badge
            if e:
                st = e["status"]
                badge = STATUS_TEXT[st]
                note = e.get("note","") or ""
                txt = badge + ("：" + note if (st in ("wrong","suspect") and note) else "")
                add_para(doc, "【核验结论】" + txt, size=10.5, bold=True, color=STATUS_COLOR[st], space_after=1, indent=Pt(14))
                # explanation
                exp = e.get("explanation","") or ""
                lines = [l for l in exp.split("\n") if l.strip()]
                add_runs_lines(doc, lines, size=10.5, color=RGBColor(0x22,0x22,0x22), space_after=8, label="【解析】")
            else:
                add_para(doc, "【核验结论】缺失（未能生成解析）", size=10.5, bold=True, color=RGBColor(0xC0,0x00,0x00), space_after=8, indent=Pt(14))
        # separator
        add_para(doc, "—"*30, size=9, color=RGBColor(0xBB,0xBB,0xBB), space_after=6, space_before=4)

    out_path = os.path.join(OUT, ch + "_题库解析.docx")
    doc.save(out_path)
    return out_path, n, cnt

if __name__ == "__main__":
    for ch, cfg in CHAPTERS.items():
        try:
            p, n, cnt = build_chapter(ch, cfg)
            print(f"{ch}: saved {p}  ({n}题 correct={cnt['correct']} suspect={cnt['suspect']} wrong={cnt['wrong']})")
        except Exception as ex:
            import traceback; traceback.print_exc()
            print(f"{ch}: ERROR {ex}")
    print("DONE")
