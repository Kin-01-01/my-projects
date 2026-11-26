# -*- coding: utf-8 -*-
import docx
from docx.shared import Pt

PATH = '平抛运动-说课稿.docx'
d = docx.Document(PATH)

def replace_text(par, new_text):
    # 保留段落样式与首 run 的字体属性，仅替换文字
    ref_font = None
    if par.runs:
        rf = par.runs[0].font
        ref_font = (rf.name, rf.size, rf.bold, rf.italic)
    for r in list(par.runs):
        r._element.getparent().remove(r._element)
    run = par.add_run(new_text)
    if ref_font:
        name, size, bold, italic = ref_font
        if name: run.font.name = name
        if size: run.font.size = size
        if bold is not None: run.font.bold = bold
        if italic is not None: run.font.italic = italic
    return par

intro_old = ("各位评委老师好！我说课的内容是《平抛运动》第 1 课时。"
             "下面我从说教材、说学情、说教学目标、说重点难点、说教法学法、"
             "说教学过程、说板书设计七个方面进行阐述，最后谈教学反思。")
intro_new = ("各位评委老师好！我说课的内容是《平抛运动》第 1 课时。"
             "本课可以一句话概括——「一条曲线，两种直线运动」。"
             "下面我从说教材、说学情、说教学目标、说重点难点、说教法学法、"
             "说教学过程、说板书设计、谈教学反思八个模块展开阐述。")

close_old = "以上是我的说课内容，敬请各位老师指正。"
close_new = ("「曲线运动，可以分解为两个熟悉的直线运动。」"
             "以上是我的说课内容，敬请各位老师指正。")

c1 = c2 = 0
for p in d.paragraphs:
    t = p.text.strip()
    if t == intro_old:
        replace_text(p, intro_new); c1 += 1
    elif t == close_old:
        replace_text(p, close_new); c2 += 1

print("intro replaced:", c1, "close replaced:", c2)
d.save(PATH)
print("saved:", PATH)
