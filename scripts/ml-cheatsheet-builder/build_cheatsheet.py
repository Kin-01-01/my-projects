# -*- coding: utf-8 -*-
"""生成吴恩达 ML 专项第一门课 复习速查表 .docx + .pdf（公式以标准数学图呈现）"""
import os, shutil
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

BASE = r"D:\workBuddy\2026-10-04-20-01-29"
IMG_DIR = os.path.join(BASE, "_formula_imgs")
os.makedirs(IMG_DIR, exist_ok=True)
DOCX = os.path.join(BASE, "吴恩达ML第一门课复习速查表.docx")
PDF  = os.path.join(BASE, "吴恩达ML第一门课复习速查表.pdf")

EA = "微软雅黑"; LAT = "Calibri"

# ---------- 公式数据 ----------
groups = [
    ("A", "A. 线性回归与代价函数（Week 1）"),
    ("B", "B. 梯度下降（Week 1）"),
    ("C", "C. 多元回归、特征缩放与向量化（Week 2）"),
    ("D", "D. 逻辑回归与分类（Week 3）"),
    ("E", "E. 正则化（Week 3）"),
]

formulas = [
    ("A", "线性回归（单变量）", r"f_{w,b}(x) = w\,x + b",
     "模型对输入 x 的预测；w 为权重（斜率），b 为偏置（截距）。"),
    ("A", "多元线性回归（向量化）", r"f_{\mathbf{w},b}(\mathbf{x}) = \mathbf{w}\cdot\mathbf{x} + b",
     "n 个特征时把 w、x 写成向量，点积一次算出；向量化比 for 循环更快更稳。"),
    ("A", "均方误差代价函数 (MSE)", r"J(w,b) = \frac{1}{2m}\sum_{i=1}^{m}\left(f_{w,b}(x^{(i)}) - y^{(i)}\right)^2",
     "m 个样本的平均平方误差；除以 2 是为求偏导消系数，便于梯度计算。目标是最小化 J。"),
    ("B", "梯度下降更新规则", r"w := w - \alpha\,\frac{\partial J}{\partial w},\quad b := b - \alpha\,\frac{\partial J}{\partial b}",
     "沿代价函数最陡下降方向迭代；w 与 b 必须同时更新（用同一次迭代的旧值算梯度）。"),
    ("B", "线性回归代价函数偏导", r"\frac{\partial J}{\partial w} = \frac{1}{m}\sum_{i=1}^{m}\left(f - y^{(i)}\right)x^{(i)},\quad \frac{\partial J}{\partial b} = \frac{1}{m}\sum_{i=1}^{m}\left(f - y^{(i)}\right)",
     "代入梯度下降即得线性回归参数更新；这是 Batch Gradient Descent（每步用全部样本）。"),
    ("B", "学习率 α 的选择", r"\alpha\ \text{too big}\rightarrow\text{diverge},\quad \alpha\ \text{too small}\rightarrow\text{slow}",
     "α 控制步长：画 J–迭代曲线，若 J 上升说明 α 过大；目标是让 J 随迭代单调下降。"),
    ("C", "Z-score 特征归一化", r"x := \frac{x - \mu}{\sigma}",
     "μ 为均值、σ 为标准差；把不同量纲特征缩到相近范围，加速梯度下降。只用训练集统计量，再套到验证/测试集。"),
    ("C", "多项式回归特征构造", r"x_1 = x,\; x_2 = x^2,\; x_3 = \sqrt{x},\;\dots",
     "通过构造非线性特征，用线性回归框架拟合曲线；构造后仍需做特征缩放。"),
    ("D", "逻辑回归 Sigmoid", r"g(z) = \frac{1}{1+e^{-z}},\qquad f = g(\mathbf{w}\cdot\mathbf{x}+b)",
     "把线性组合压到 (0,1)，输出=样本属于类别 1 的概率。"),
    ("D", "决策边界", r"\mathbf{w}\cdot\mathbf{x} + b = 0",
     "使 g(z)=0.5 的边界；z>0 判为类1，z<0 判为类0；加多项式特征可得非线性边界。"),
    ("D", "逻辑回归代价函数 (Log Loss)", r"J = -\frac{1}{m}\sum_{i=1}^{m}\left[y^{(i)}\log f^{(i)} + (1-y^{(i)})\log\left(1-f^{(i)}\right)\right]",
     "交叉熵损失，对分类任务为凸函数、无局部最优；y=1 时惩罚 f 偏小，y=0 时惩罚 f 偏大。"),
    ("D", "逻辑回归梯度", r"\frac{\partial J}{\partial w_j} = \frac{1}{m}\sum_{i=1}^{m}\left(f^{(i)} - y^{(i)}\right)x_j^{(i)}",
     "形式与线性回归一致（sigmoid 导数抵消），故统一用同一条梯度下降流程。"),
    ("E", "L2 正则化代价函数", r"J = \frac{1}{2m}\sum_{i=1}^{m}(f-y^{(i)})^2 + \frac{\lambda}{2m}\sum_{j=1}^{n} w_j^2",
     "第二项惩罚大权重，缓解过拟合；偏置 b 不惩罚；λ 过大→欠拟合，过小→仍过拟合。"),
    ("E", "正则化梯度更新", r"\frac{\partial J}{\partial w_j} = \frac{1}{m}\sum_{i=1}^{m}(f-y^{(i)})x_j^{(i)} + \frac{\lambda}{m}w_j",
     "等价于每次更新前先把 w_j 乘 (1-αλ/m)，即权重衰减（weight decay）。"),
]

# ---------- 渲染公式图 ----------
def render(tex, idx):
    path = os.path.join(IMG_DIR, f"f{idx:02d}.png")
    fig = plt.figure(figsize=(max(4.0, len(tex)*0.085), 0.85))
    fig.text(0.02, 0.5, f"${tex}$", fontsize=16, va='center', ha='left')
    fig.savefig(path, dpi=200, transparent=True, bbox_inches='tight', pad_inches=0.04)
    plt.close(fig)
    with Image.open(path) as im:
        w, h = im.size
    return path, w, h

imgs = []
for i, (g, name, tex, desc) in enumerate(formulas, start=1):
    p, w, h = render(tex, i)
    imgs.append((i, g, name, tex, desc, p, w, h))

# ---------- 公共：字体工具 ----------
def set_run_font(run, size, bold=False, color=None):
    run.font.name = LAT
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rpr.append(rf)
    rf.set(qn('w:eastAsia'), EA); rf.set(qn('w:ascii'), LAT); rf.set(qn('w:hAnsi'), LAT)
    run.font.size = __import__('docx').shared.Pt(size)
    if bold: run.font.bold = True
    if color: run.font.color.rgb = color

# ---------- 构建 DOCX ----------
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
doc = Document()
normal = doc.styles['Normal']; normal.font.name = LAT; normal.font.size = Pt(10.5)
from docx.oxml.ns import qn as _qn
from docx.oxml import OxmlElement as _OE
_rpr = normal.element.get_or_add_rPr()
_rf = _rpr.find(_qn('w:rFonts'))
if _rf is None: _rf = _OE('w:rFonts'); _rpr.append(_rf)
_rf.set(_qn('w:eastAsia'), EA)
for hs in ('Heading 1','Heading 2'):
    st = doc.styles[hs]; st.font.name = LAT
    rr = st.element.get_or_add_rPr(); ff = rr.find(_qn('w:rFonts'))
    if ff is None: ff = _OE('w:rFonts'); rr.append(ff)
    ff.set(_qn('w:eastAsia'), EA)

tp = doc.add_paragraph(); tp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = tp.add_run("吴恩达《Supervised Machine Learning》第一门课\n复习速查表（核心公式）")
set_run_font(r, 18, True, RGBColor(0x1F,0x38,0x64))
sp = doc.add_paragraph(); sp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sp.add_run("线性回归 · 梯度下降 · 逻辑回归 · 正则化 ｜ 涵盖 Week 1–3 全核心公式")
set_run_font(r, 10.5, color=RGBColor(0x59,0x59,0x59))
dp = doc.add_paragraph(); dp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = dp.add_run("整理时间：2026-10-04 ｜ 公式以标准数学格式（基于 TeX 渲染）呈现")
set_run_font(r, 9, color=RGBColor(0x80,0x80,0x80))

doc.add_heading("一、文档说明与主题范围", level=1)
for t in [
    "本文档为吴恩达（Andrew Ng）机器学习专项课程第一门课《Supervised Machine Learning: Regression and Classification》（Coursera / DeepLearning.AI · Stanford, 2022 版）的复习速查表，独立于资源清单文档，专注于「核心公式 + 说明」，便于打印随身携带。",
    "涵盖主题：① 线性回归与代价函数；② 梯度下降；③ 多元回归、特征缩放与向量化；④ 逻辑回归与分类；⑤ 正则化。均为作业与考试重点。",
    "公式以标准数学排版呈现（TeX 渲染），每条附「名称 + 公式 + 说明」，并在第二节给出公式索引。",
]:
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(3)
    rr = p.add_run(t); set_run_font(rr, 10.5)

doc.add_heading("二、公式列表（索引）", level=1)
for i, (g, name, tex, desc, p, w, h) in [(x[0], x[1:]) for x in imgs]:
    pass
idx_p = doc.add_paragraph(); idx_p.paragraph_format.space_after = Pt(2)
for (i, g, name, tex, desc, p, w, h) in imgs:
    line = doc.add_paragraph(); line.paragraph_format.left_indent = Inches(0.2)
    line.paragraph_format.space_after = Pt(1)
    rr = line.add_run(f"{i:>2}. [{g}] {name}"); set_run_font(rr, 10)

doc.add_heading("三、核心公式与说明", level=1)
for (gid, gtitle) in groups:
    doc.add_heading(gtitle, level=2)
    for (i, g, name, tex, desc, p, w, h) in imgs:
        if g != gid: continue
        hp = doc.add_paragraph(); hp.paragraph_format.space_before = Pt(6); hp.paragraph_format.space_after = Pt(1)
        rr = hp.add_run(f"{i}. {name}"); set_run_font(rr, 11, True, RGBColor(0x2E,0x54,0x96))
        # 公式图：按高度 0.5in 缩放，宽度上限 6.2in
        aspect = w / h
        height_in = 0.5
        width_in = height_in * aspect
        if width_in > 6.2:
            width_in = 6.2; height_in = width_in / aspect
        fp = doc.add_paragraph(); fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.add_run().add_picture(p, width=Inches(width_in), height=Inches(height_in))
        fp.paragraph_format.space_after = Pt(1)
        ep = doc.add_paragraph(); ep.paragraph_format.left_indent = Inches(0.2); ep.paragraph_format.space_after = Pt(4)
        rr = ep.add_run(desc); set_run_font(rr, 10)

doc.save(DOCX)
print("DOCX SAVED:", DOCX)

# ---------- 构建 PDF ----------
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
                                KeepTogether, PageBreak)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.enums import TA_CENTER
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
CN = 'STSong-Light'
styles = getSampleStyleSheet()
st_title = ParagraphStyle('t', parent=styles['Title'], fontName=CN, fontSize=18, textColor=(0x1F,0x38,0x64), alignment=TA_CENTER, leading=22)
st_sub = ParagraphStyle('s', parent=styles['Normal'], fontName=CN, fontSize=10.5, alignment=TA_CENTER, textColor=(0x59,0x59,0x59))
st_h1 = ParagraphStyle('h1', parent=styles['Heading1'], fontName=CN, fontSize=14, textColor=(0x1F,0x38,0x64), spaceBefore=10, spaceAfter=4)
st_h2 = ParagraphStyle('h2', parent=styles['Heading2'], fontName=CN, fontSize=12, textColor=(0x2E,0x54,0x96), spaceBefore=8, spaceAfter=3)
st_body = ParagraphStyle('b', parent=styles['Normal'], fontName=CN, fontSize=10.5, leading=15)
st_idx = ParagraphStyle('i', parent=styles['Normal'], fontName=CN, fontSize=10, leading=14)
st_fname = ParagraphStyle('f', parent=styles['Normal'], fontName=CN, fontSize=11, leading=15, textColor=(0x2E,0x54,0x96))

flow = []
flow.append(Paragraph("吴恩达《Supervised Machine Learning》第一门课<br/>复习速查表（核心公式）", st_title))
flow.append(Spacer(1,6))
flow.append(Paragraph("线性回归 · 梯度下降 · 逻辑回归 · 正则化 ｜ 涵盖 Week 1–3 全核心公式", st_sub))
flow.append(Paragraph("整理时间：2026-10-04 ｜ 公式以标准数学格式（基于 TeX 渲染）呈现", ParagraphStyle('m', parent=st_sub, fontSize=9, textColor=(0x80,0x80,0x80))))
flow.append(Spacer(1,10))
flow.append(Paragraph("一、文档说明与主题范围", st_h1))
for t in [
    "本文档为吴恩达机器学习专项课程第一门课《Supervised Machine Learning: Regression and Classification》（Coursera / DeepLearning.AI · Stanford, 2022 版）的复习速查表，独立于资源清单文档，专注于「核心公式 + 说明」，便于打印随身携带。",
    "涵盖主题：① 线性回归与代价函数；② 梯度下降；③ 多元回归、特征缩放与向量化；④ 逻辑回归与分类；⑤ 正则化。均为作业与考试重点。",
    "公式以标准数学排版呈现（TeX 渲染），每条附「名称 + 公式 + 说明」，并在第二节给出公式索引。",
]:
    flow.append(Paragraph(t, st_body)); flow.append(Spacer(1,3))
flow.append(Paragraph("二、公式列表（索引）", st_h1))
for (i, g, name, tex, desc, p, w, h) in imgs:
    flow.append(Paragraph(f"{i:>2}. [{g}] {name}", st_idx))
flow.append(Paragraph("三、核心公式与说明", st_h1))
for (gid, gtitle) in groups:
    flow.append(Paragraph(gtitle, st_h2))
    for (i, g, name, tex, desc, p, w, h) in imgs:
        if g != gid: continue
        aspect = w / h
        width_in = 0.5 * aspect
        if width_in > 6.0: width_in = 6.0
        img_w = width_in * inch; img_h = width_in / aspect * inch
        block = [Paragraph(f"{i}. {name}", st_fname),
                 RLImage(p, width=img_w, height=img_h),
                 Paragraph(desc, st_body), Spacer(1,5)]
        flow.append(KeepTogether(block))

docp = SimpleDocTemplate(PDF, pagesize=A4, leftMargin=1*inch, rightMargin=1*inch,
                         topMargin=0.9*inch, bottomMargin=0.8*inch,
                         title="吴恩达ML第一门课复习速查表")
docp.build(flow)
print("PDF SAVED:", PDF)

shutil.rmtree(IMG_DIR, ignore_errors=True)
print("CLEANED imgs")
