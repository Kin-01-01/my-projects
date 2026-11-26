# -*- coding: utf-8 -*-
"""生成吴恩达 ML 专项第一门课 资源指南 .docx"""
import docx
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = r"D:\workBuddy\2026-10-04-20-01-29\吴恩达ML专项第一门课资源指南.docx"

EA_FONT = "微软雅黑"   # 中文 字体
LATIN_FONT = "Calibri"

def set_run_font(run, size=None, bold=None, color=None):
    run.font.name = LATIN_FONT
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn('w:rFonts'))
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts')
        rpr.append(rfonts)
    rfonts.set(qn('w:eastAsia'), EA_FONT)
    rfonts.set(qn('w:ascii'), LATIN_FONT)
    rfonts.set(qn('w:hAnsi'), LATIN_FONT)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color

def style_base(doc):
    normal = doc.styles['Normal']
    normal.font.name = LATIN_FONT
    normal.font.size = Pt(10.5)
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn('w:rFonts'))
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts'); rpr.append(rfonts)
    rfonts.set(qn('w:eastAsia'), EA_FONT)
    for hs in ('Heading 1', 'Heading 2', 'Heading 3'):
        st = doc.styles[hs]
        st.font.name = LATIN_FONT
        rpr = st.element.get_or_add_rPr()
        rfonts = rpr.find(qn('w:rFonts'))
        if rfonts is None:
            rfonts = OxmlElement('w:rFonts'); rpr.append(rfonts)
        rfonts.set(qn('w:eastAsia'), EA_FONT)

def add_hyperlink(paragraph, url, text):
    part = paragraph.part
    r_id = part.relate_to(url, docx.opc.constants.RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('r:id'), r_id)
    run = OxmlElement('w:r')
    rpr = OxmlElement('w:rPr')
    color = OxmlElement('w:color'); color.set(qn('w:val'), '0563C1')
    u = OxmlElement('w:u'); u.set(qn('w:val'), 'single')
    rpr.append(color); rpr.append(u)
    t = OxmlElement('w:t'); t.text = text
    run.append(rpr); run.append(t)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)
    return paragraph

def add_para(doc, text, size=10.5, bold=False, color=None, align=None, space_after=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    if align: p.alignment = align
    r = p.add_run(text)
    set_run_font(r, size=size, bold=bold, color=color)
    return p

def add_bullet(doc, text, level=0, bold_lead=None):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.3 + 0.25*level)
    p.paragraph_format.space_after = Pt(2)
    if bold_lead:
        r = p.add_run(bold_lead); set_run_font(r, size=10.5, bold=True)
        r2 = p.add_run(text); set_run_font(r2, size=10.5)
    else:
        r = p.add_run(text); set_run_font(r, size=10.5)
    return p

def add_table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 1'
    t.autofit = False
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ''
        p = hdr[i].paragraphs[0]
        r = p.add_run(h); set_run_font(r, size=9.5, bold=True, color=RGBColor(0xFF,0xFF,0xFF))
        # 表头底色
        tcPr = hdr[i]._tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd'); shd.set(qn('w:val'),'clear'); shd.set(qn('w:fill'),'2E5496')
        tcPr.append(shd)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ''
            p = cells[i].paragraphs[0]
            if isinstance(val, tuple) and val[0]=='link':
                add_hyperlink(p, val[1], val[2])
                for rr in p.runs: set_run_font(rr, size=9)
            else:
                r = p.add_run(str(val)); set_run_font(r, size=9)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

# ---------- 数据 ----------
notes = [
 ["machine-learning-specialization","mvarrone",8,"2025-12-24",("link","https://github.com/mvarrone/machine-learning-specialization","mvarrone/...specialization"),"W1–W3 全覆盖","EN；按「概述/监督无监督/回归/梯度下降」等主题拆成 README.md 笔记，结构清晰、纯文本易读，适合通读"],
 ["ML-specialization-notes","parsabsh",26,"2026-08-04",("link","https://github.com/parsabsh/ML-specialization-notes","parsabsh/ML-specialization-notes"),"W1–W3（全专项）","EN；LaTeX 源码 + 编译好的 PDF 讲义，公式推导完整，适合想看数学细节的人"],
 ["coursera-andrew-ng-machine-learning-notes","caitlin-leonard",2,"2026-09-21",("link","https://github.com/caitlin-leonard/coursera-andrew-ng-machine-learning-notes","caitlin-leonard/...notes"),"W1–W3（每门课独立 PDF）","EN；ML_Course1_Detailed_Notes.pdf 为详尽复习笔记，2026 年新建、与现行课程匹配度高"],
 ["Machine-Learning-Specialization（中文版）","Majiaozhen",1,"2026-10-02",("link","https://github.com/Majiaozhen/Machine-Learning-Specialization","Majiaozhen/...Specialization"),"W1–W3（中文）","中；含中文笔记 + 课件(slides) + 可运行代码，并带 requirements.txt，是稀缺的中文一站式资源"],
]
code = [
 ["Machine-Learning-Specialization-Coursera","greyhatguy007",7991,"2026-10-04",("link","https://github.com/greyhatguy007/Machine-Learning-Specialization-Coursera","greyhatguy007/...Coursera"),"W1–W3（C1 完整）","EN；本专项最权威星标最高的仓库，C1 含全部 Optional Labs + 编程作业 + 练习测验的 Soln Notebook；无统一 requirements.txt，依赖同仓 lab_utils_* 模块，需自行 pip install numpy matplotlib"],
 ["Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers","yasithWimukthi",115,"2026-09-14",("link","https://github.com/yasithWimukthi/Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers","yasithWimukthi/...Lab-Answers"),"W1–W3（仅第一门课）","EN；只做第一门课，专注度高；含 lab_utils_common.py / lab_utils_uni.py / data.txt / deeplearning.mplstyle 等运行必需辅助文件，开箱即用程度高；仍无 requirements.txt"],
 ["Machine-Learning-Specialization（中文版）","Majiaozhen",1,"2026-10-02",("link","https://github.com/Majiaozhen/Machine-Learning-Specialization","Majiaozhen/...Specialization"),"W1–W3（中文）","中；唯一带 requirements.txt 的候选，代码与中文笔记同仓，环境最完整"],
]
quiz = [
 ["Coursera-DeepLearning.AI-Stanford-University-Machine-Learning-Specialization","shantanu1109",222,"2026-09-23",("link","https://github.com/shantanu1109/Coursera-DeepLearning.AI-Stanford-University-Machine-Learning-Specialization","shantanu1109/...Specialization"),"W1–W3（C1）","EN；明确以「Quizes & Lab Assignments 解答」为主，Course-1-Week-1/2/3 + Course-1.md 集中放测验与实验答案"],
 ["Machine-Learning-Specialization-Coursera","greyhatguy007",7991,"2026-10-04",("link","https://github.com/greyhatguy007/Machine-Learning-Specialization-Coursera","greyhatguy007/...Coursera"),"W1–W3（C1）","EN；除代码外，每周含 Practice quiz - * 答案目录，可与代码一并参考"],
 ["Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers","yasithWimukthi",115,"2026-09-14",("link","https://github.com/yasithWimukthi/Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers","yasithWimukthi/...Lab-Answers"),"W1–W3（C1）","EN；Week1/2/week3 下均含 Practice Quiz - * 答案目录，第一门课专属"],
]
excluded = [
 ["LiMengyang990726/Coursera-Machine-Learning","MATLAB/Octave，最后更新 2018；对应的是吴恩达 2011/2014 经典 ML 课程，非 2022 机器学习专项，语言环境都不匹配"],
 ["amanchadha/coursera-deep-learning-specialization","这是深度学习专项（Deep Learning Specialization），不是机器学习专项第一门课"],
 ["Ezward/machinelearningnotes、Prashant47/ML-Foundations","华盛顿大学 ML 专项，课程结构不同，非本专项"],
 ["stasSajin/Machine-Learning-Specialization","最后更新 2019，长期停更，且对应旧版体系"],
 ["大量 0–2 Star 的 week1/week2 单周 fork 仓库","内容残缺、仅上传自己作业、无笔记无解答，无收录价值"],
]

# ---------- 构建文档 ----------
doc = Document()
style_base(doc)

# 标题
tp = doc.add_paragraph(); tp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = tp.add_run("吴恩达「机器学习专项课程」第一门课\n开源学习资源指南"); set_run_font(r, size=18, bold=True, color=RGBColor(0x1F,0x38,0x64))
sp = doc.add_paragraph(); sp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sp.add_run("Supervised Machine Learning: Regression and Classification（Coursera / DeepLearning.AI · Stanford, 2022 版）")
set_run_font(r, size=10.5, color=RGBColor(0x59,0x59,0x59))
dp = doc.add_paragraph(); dp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = dp.add_run("资料整理时间：2026-10-04 ｜ 来源：GitHub 公开仓库（按 Star 排序 + 关键词检索）")
set_run_font(r, size=9, color=RGBColor(0x80,0x80,0x80))
doc.add_paragraph()

# 内容概览
doc.add_heading("一、内容概览", level=1)
add_para(doc, "本文档面向正在学习吴恩达（Andrew Ng）机器学习专项课程第一门课《Supervised Machine Learning: Regression and Classification》的学习者，系统梳理了 GitHub 上高质量的开源配套资源，并按「笔记总结 / 代码实验 / 习题答案」三类分块呈现。", space_after=4)
add_bullet(doc, "覆盖第一门课全部 3 周内容（线性回归→梯度下降→逻辑回归→正则化）。", bold_lead="适用范围：")
add_bullet(doc, "每条资源均标注仓库名称、作者、Star 数、最近更新、链接、适用章节与一句话特点。", bold_lead="字段规范：")
add_bullet(doc, "剔除与新版课程不匹配或长期停更的仓库，并给出中文资源稀缺时的自查关键词。", bold_lead="质量过滤：")
add_para(doc, "文档结构：① 内容概览与目录 → ② 课程与适用章节 → ③ 笔记总结类 → ④ 代码实验类 → ⑤ 习题与答案类 → ⑥ 已剔除仓库 → ⑦ 稀缺类别与自查关键词。", space_after=2)

# 目录
doc.add_heading("二、目录", level=1)
toc = [
 "一、内容概览",
 "二、目录",
 "三、课程背景与适用章节说明",
 "四、笔记总结类（知识点 / 公式推导 / 总结）",
 "五、代码实验类（Notebook 作业 / Optional Labs / 参考答案）",
 "六、习题与答案类（课后测验解析）",
 "七、已剔除 / 需谨慎的仓库",
 "八、稀缺类别与后续自查关键词",
]
for i, item in enumerate(toc):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
    r = p.add_run(item); set_run_font(r, size=10.5)

# 课程背景
doc.add_heading("三、课程背景与适用章节说明", level=1)
add_para(doc, "本课程由 Andrew Ng、Eddy Shyu、Aarti Bagul、Geoff Ladwig 等通过 DeepLearning.AI 与斯坦福大学在 Coursera 联合开设（2022 版），是机器学习专项的三门课之一。下方为第一门课的分周主题，也是各资源「适用章节」字段的对应依据。", space_after=4)
add_bullet(doc, "机器学习概述、监督 vs 无监督、单变量线性回归、模型表示、代价函数、梯度下降。", bold_lead="Week 1：")
add_bullet(doc, "多元线性回归、梯度下降实践（特征缩放 / 学习率）、特征工程与多项式回归、Sklearn、逻辑回归引入。", bold_lead="Week 2：")
add_bullet(doc, "分类、Sigmoid、决策边界、逻辑回归代价函数与梯度下降、Scikit-Learn 逻辑回归、过拟合与正则化。", bold_lead="Week 3：")
add_para(doc, "检索说明：数据取自 2026-10-04 的 GitHub API，按 Star 数排序并结合关键词（machine-learning-specialization / supervised machine learning regression classification / coursera andrew ng / 中文）检索；Star 与更新时间会随时间变化。", size=9, color=RGBColor(0x80,0x80,0x80), space_after=2)

# 笔记类
doc.add_heading("四、笔记总结类（知识点 / 公式推导 / 总结）", level=1)
add_para(doc, "以文本资料为主，适合通读与复习。语言标注：EN=英文，中=中文。", space_after=4)
add_table(doc, ["仓库","作者","Star","最近更新","链接","适用章节","内容特点"],
          notes, widths=[1.0,0.8,0.4,0.8,1.3,0.9,2.5])
add_bullet(doc, "首选：parsabsh（LaTeX+PDF，公式最完整）、mvarrone（主题化 README，通读友好）。")
add_bullet(doc, "中文读者：Majiaozhen 是当前稀缺的中文一站式笔记 + 课件 + 代码资源。")

# 代码类
doc.add_heading("五、代码实验类（Notebook 作业 / Optional Labs / 参考答案）", level=1)
add_para(doc, "提供 Jupyter Notebook 形式的实验与参考答案；下表同时标注运行环境是否完整。", space_after=4)
add_table(doc, ["仓库","作者","Star","最近更新","链接","适用章节","内容特点"],
          code, widths=[1.0,0.8,0.4,0.8,1.3,0.9,2.5])
add_para(doc, "运行环境小结：除 Majiaozhen 外，其余代码库均未提供 requirements.txt，通用依赖为 numpy、matplotlib 与同仓的 lab_utils_* 模块。建议用 conda 新建 Python 3.9+ 环境后按需安装；或直接克隆 greyhatguy007 / yasithWimukthi 仓库以复用其自带辅助文件。", space_after=2)

# 习题类
doc.add_heading("六、习题与答案类（课后测验解析）", level=1)
add_para(doc, "集中收录练习测验（Practice Quiz）与实验答案，方便自测与对照。", space_after=4)
add_table(doc, ["仓库","作者","Star","最近更新","链接","适用章节","内容特点"],
          quiz, widths=[1.0,0.8,0.4,0.8,1.3,0.9,2.5])
add_bullet(doc, "最聚焦：shantanu1109 明确以「测验 + 实验解答」为主；greyhatguy007 与 yasithWimukthi 每周也附带 Practice quiz 答案目录。")

# 剔除
doc.add_heading("七、已剔除 / 需谨慎的仓库", level=1)
add_para(doc, "以下仓库因课程不匹配、版本过旧或内容残缺，未纳入主表。", space_after=4)
add_table(doc, ["仓库","剔除原因"], excluded, widths=[2.2,5.0])

# 稀缺与关键词
doc.add_heading("八、稀缺类别与后续自查关键词", level=1)
add_para(doc, "中文笔记类明显稀缺（仅 Majiaozhen 一个、1 Star、2026 新建）；纯习题解析（不含代码）也较少，多数仓库把答案与代码混在一起。建议后续自行检索以下关键词：", space_after=4)
add_bullet(doc, "吴恩达 机器学习专项 笔记、机器学习专项 中文 笔记 Regression Classification、Coursera 机器学习 专项 中文 答案、site:github.com 吴恩达 机器学习 第一门课", bold_lead="中文笔记：")
add_bullet(doc, "machine learning specialization practice quiz answers、\"Supervised Machine Learning\" coursera quiz solution、C1_W1 practice quiz regression solution", bold_lead="习题解析：")
add_bullet(doc, "machine learning specialization notes pdf、andrew ng ml specialization formula derivation、ml specialization week2 gradient descent derivation", bold_lead="公式推导：")

doc.save(OUT)
print("SAVED:", OUT)
