# -*- coding: utf-8 -*-
"""速查表 V2：在 V1 基础上增加 详解 + Python/numpy 代码实现；输出 docx + pdf。
腾讯文档 MCP 未连接，故直接用 python-docx 操作本地文件。"""
import os, shutil
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

BASE = r"D:\workBuddy\2026-10-04-20-01-29"
IMG_DIR = os.path.join(BASE, "_formula_imgs_v2")
os.makedirs(IMG_DIR, exist_ok=True)
DOCX = os.path.join(BASE, "吴恩达ML第一门课复习速查表.docx")
PDF  = os.path.join(BASE, "吴恩达ML第一门课复习速查表.pdf")
EA = "微软雅黑"; LAT = "Calibri"

# ---------- 公式数据：组 / 名称 / tex / 详解 / 代码(列表或None) ----------
groups = [
    ("A", "A. 线性回归与代价函数（Week 1）"),
    ("B", "B. 梯度下降（Week 1）"),
    ("C", "C. 多元回归、特征缩放与向量化（Week 2）"),
    ("D", "D. 逻辑回归与分类（Week 3）"),
    ("E", "E. 正则化（Week 3）"),
]

F = [
 ("A","线性回归（单变量）", r"f_{w,b}(x) = w\,x + b",
  "最基础的监督学习模型：w 控制直线斜率（权重），b 控制截距（偏置）。训练目标就是找到让所有样本预测值与真实值差距最小的 w、b。",
  ["def predict(x, w, b):",
   "    return w * x + b"]),
 ("A","多元线性回归（向量化）", r"f_{\mathbf{w},b}(\mathbf{x}) = \mathbf{w}\cdot\mathbf{x} + b",
  "把 n 个特征排成向量 x、权重排成向量 w，预测即点积 w·x + b。向量化后一次矩阵运算替代 n 次循环，是课程与作业的硬性要求，也显著提升速度。",
  ["import numpy as np",
   "# X: (m, n)  m个样本、n个特征; w: (n,); b: scalar",
   "f = X @ w + b          # 等价于逐样本 w·x + b"]),
 ("A","均方误差代价函数 (MSE)", r"J(w,b) = \frac{1}{2m}\sum_{i=1}^{m}\left(f_{w,b}(x^{(i)}) - y^{(i)}\right)^2",
  "衡量模型整体误差。平方是为了消除正负抵消并放大大误差；除以 2m 中 m 做平均、2 是为后续求偏导时与平方的指数 2 抵消，得到简洁梯度。目标是最小化 J。",
  ["def compute_cost(X, y, w, b):",
   "    m = X.shape[0]",
   "    f = X @ w + b",
   "    return (1/(2*m)) * np.sum((f - y)**2)"]),
 ("B","梯度下降更新规则", r"w := w - \alpha\,\frac{\partial J}{\partial w},\quad b := b - \alpha\,\frac{\partial J}{\partial b}",
  "梯度 ∇J 指向 J 上升最快方向，故沿其反方向、以步长 α 迭代更新参数。必须“同时”更新 w、b——先用旧值算全部梯度，再一起改，否则会用到已更新的错误值。",
  ["for _ in range(iterations):",
   "    f = X @ w + b",
   "    dw = (1/m) * (X.T @ (f - y))",
   "    db = (1/m) * np.sum(f - y)",
   "    w -= alpha * dw      # 同时更新",
   "    b -= alpha * db"]),
 ("B","线性回归代价函数偏导", r"\frac{\partial J}{\partial w} = \frac{1}{m}\sum_{i=1}^{m}\left(f - y^{(i)}\right)x^{(i)},\quad \frac{\partial J}{\partial b} = \frac{1}{m}\sum_{i=1}^{m}\left(f - y^{(i)}\right)",
  "把 MSE 对 w_j、b 求偏导得到闭式梯度。注意 Σ 内是 (f−y) 与对应特征 x_j 的乘积——这就是“误差乘以输入”的经典形式，也是上面更新规则中 dw/db 的来源。",
  ["# 直接对应更新规则里的梯度计算",
   "dw = (1/m) * (X.T @ (f - y))",
   "db = (1/m) * np.sum(f - y)"]),
 ("B","学习率 α 的选择", r"\alpha\ \text{too big}\rightarrow\text{diverge},\quad \alpha\ \text{too small}\rightarrow\text{slow}",
  "α 决定每一步迈多大。过大→在最小值附近来回震荡甚至发散；过小→收敛极慢。实践中画 J 随迭代次数的曲线诊断：应平滑下降。",
  ["costs = []",
   "for _ in range(iterations):",
   "    ... # 更新 w,b",
   "    costs.append(compute_cost(X, y, w, b))",
   "# 若 costs 上升或剧烈震荡 -> 减小 alpha"]),
 ("C","Z-score 特征归一化", r"x := \frac{x - \mu}{\sigma}",
  "不同特征量纲差异大会让代价函数等高线“扁长”，梯度下降绕远路。归一化到均值0、标准差1，使各方向尺度接近，收敛更快更稳。统计量 μ、σ 只能从训练集算，再套到验证/测试集。",
  ["mu = X_train.mean(axis=0)",
   "sigma = X_train.std(axis=0)",
   "X_train = (X_train - mu) / sigma",
   "X_val = (X_val - mu) / sigma   # 用训练集的 mu/sigma"]),
 ("C","多项式回归特征构造", r"x_1 = x,\; x_2 = x^2,\; x_3 = \sqrt{x},\;\dots",
  "真实关系常非线性。构造 x²、√x、x₁·x₂ 等特征，把非线性问题转化为“线性模型 + 非线性特征”，仍可套用线性回归与梯度下降。构造后务必再次做特征缩放。",
  ["from sklearn.preprocessing import PolynomialFeatures",
   "poly = PolynomialFeatures(degree=2, include_bias=False)",
   "X2 = poly.fit_transform(X[:, :1])   # 得到 [x, x^2]"]),
 ("D","逻辑回归 Sigmoid", r"g(z) = \frac{1}{1+e^{-z}},\qquad f = g(\mathbf{w}\cdot\mathbf{x}+b)",
  "逻辑回归先做线性组合 z=w·x+b，再过 sigmoid 压到 (0,1)，可解释为“属于类别1的概率”。z≫0→≈1，z≪0→≈0。",
  ["def sigmoid(z):",
   "    return 1 / (1 + np.exp(-z))",
   "f = sigmoid(X @ w + b)     # 预测概率"]),
 ("D","决策边界", r"\mathbf{w}\cdot\mathbf{x} + b = 0",
  "令 z=0（即 g(z)=0.5）得到 w·x+b=0，这是划分两类直线的代数表达。加入多项式特征后，这条直线可变成曲线边界。",
  ["# 线性边界 w·x + b = 0 -> x2 = -(w1*x1 + b)/w2",
   "y_pred = (f >= 0.5).astype(int)   # 预测类别"]),
 ("D","逻辑回归代价函数 (Log Loss)", r"J = -\frac{1}{m}\sum_{i=1}^{m}\left[y^{(i)}\log f^{(i)} + (1-y^{(i)})\log\left(1-f^{(i)}\right)\right]",
  "分类不能用 MSE（非凸、难优化）。交叉熵损失对 y=1 惩罚“预测偏低”、对 y=0 惩罚“预测偏高”，且在逻辑回归下是凸函数，保证梯度下降能达全局最优。",
  ["eps = 1e-15",
   "f = np.clip(f, eps, 1-eps)        # 防止 log(0)",
   "J = -(1/m) * np.sum(y*np.log(f) + (1-y)*np.log(1-f))"]),
 ("D","逻辑回归梯度", r"\frac{\partial J}{\partial w_j} = \frac{1}{m}\sum_{i=1}^{m}\left(f^{(i)} - y^{(i)}\right)x_j^{(i)}",
  "看似与线性回归梯度相同，本质是因为 sigmoid 的导数 g'(z)=g(z)(1−g(z)) 恰好与上层的 log 损失相乘“抵消”，得到简洁的 (f−y)·x_j 形式。",
  ["f = sigmoid(X @ w + b)",
   "dw = (1/m) * (X.T @ (f - y))",
   "db = (1/m) * np.sum(f - y)"]),
 ("E","L2 正则化代价函数", r"J = \frac{1}{2m}\sum_{i=1}^{m}(f-y^{(i)})^2 + \frac{\lambda}{2m}\sum_{j=1}^{n} w_j^2",
  "过拟合时某些 w_j 过大、模型对噪声敏感。L2 项 λ/(2m)·Σw_j² 惩罚大权重，把曲线“拉平”。λ 是超参：太大→欠拟合，太小→防不住过拟合。偏置 b 不参与惩罚。",
  ["def compute_cost_reg(X, y, w, b, lam):",
   "    m = X.shape[0]",
   "    f = X @ w + b",
   "    base = (1/(2*m)) * np.sum((f - y)**2)",
   "    reg = (lam/(2*m)) * np.sum(w**2)",
   "    return base + reg"]),
 ("E","正则化梯度更新", r"\frac{\partial J}{\partial w_j} = \frac{1}{m}\sum_{i=1}^{m}(f-y^{(i)})x_j^{(i)} + \frac{\lambda}{m}w_j",
  "对正则项求偏导得 λ/m·w_j，与基础梯度相加。等价每次更新前把 w_j 乘 (1−αλ/m)——这就是“权重衰减”，让参数持续向 0 收缩。",
  ["dw = (1/m)*(X.T @ (f - y)) + (lam/m)*w",
   "w -= alpha * dw",
   "# 等价于先 w *= (1 - alpha*lam/m)，再减基础梯度"]),
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
for i, (g, name, tex, detail, code) in enumerate(F, start=1):
    p, w, h = render(tex, i)
    imgs.append((i, g, name, tex, detail, code, p, w, h))

# ---------- 字体工具（docx） ----------
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def set_run(run, size, bold=False, color=None, font=LAT, ea=EA):
    run.font.name = font
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rpr.append(rf)
    rf.set(qn('w:eastAsia'), ea); rf.set(qn('w:ascii'), font); rf.set(qn('w:hAnsi'), font)
    run.font.size = Pt(size)
    if bold: run.font.bold = True
    if color: run.font.color.rgb = color

def shade(paragraph, fill='F2F3F5'):
    pPr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'),'clear'); shd.set(qn('w:color'),'auto'); shd.set(qn('w:fill'),fill)
    pPr.append(shd)

def add_code(doc, code_lines):
    text = "\n".join(code_lines)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.left_indent = Inches(0.15)
    p.paragraph_format.line_spacing = 1.0
    shade(p, 'F2F3F5')
    # 用 w:br 保留换行
    first = True
    for line in text.split("\n"):
        if not first:
            br = OxmlElement('w:br'); p.add_run()._r.append(br)
        else:
            first = False
        r = p.add_run(line)
        set_run(r, 9, font='Consolas', ea='Consolas')

# ---------- 构建 DOCX ----------
doc = Document()
normal = doc.styles['Normal']; normal.font.name = LAT; normal.font.size = Pt(10.5)
_r = normal.element.get_or_add_rPr(); _f = _r.find(qn('w:rFonts'))
if _f is None: _f = OxmlElement('w:rFonts'); _r.append(_f)
_f.set(qn('w:eastAsia'), EA)
for hs in ('Heading 1','Heading 2','Heading 3'):
    st = doc.styles[hs]; st.font.name = LAT
    rr = st.element.get_or_add_rPr(); ff = rr.find(qn('w:rFonts'))
    if ff is None: ff = OxmlElement('w:rFonts'); rr.append(ff)
    ff.set(qn('w:eastAsia'), EA)

tp = doc.add_paragraph(); tp.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_run(tp.add_run("吴恩达《Supervised Machine Learning》第一门课\n复习速查表 · 详解与代码版"), 18, True, RGBColor(0x1F,0x38,0x64))
sp = doc.add_paragraph(); sp.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_run(sp.add_run("线性回归 · 梯度下降 · 逻辑回归 · 正则化 ｜ 涵盖 Week 1–3 全核心公式（含推导与 numpy 实现）"), 10.5, color=RGBColor(0x59,0x59,0x59))
dp = doc.add_paragraph(); dp.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_run(dp.add_run("整理时间：2026-10-04 ｜ 公式以标准数学格式（TeX 渲染）；代码为 Python/numpy 伪代码"), 9, color=RGBColor(0x80,0x80,0x80))

doc.add_heading("一、文档说明与主题范围", level=1)
for t in [
    "本文档为吴恩达机器学习专项课程第一门课《Supervised Machine Learning: Regression and Classification》（Coursera / DeepLearning.AI · Stanford, 2022 版）的复习速查表详解版。在速查表基础上，为每条公式补充「详细推导/直觉说明」与「Python/numpy 代码实现」，便于边看公式边动手。",
    "涵盖主题：① 线性回归与代价函数；② 梯度下降；③ 多元回归、特征缩放与向量化；④ 逻辑回归与分类；⑤ 正则化。均为作业与考试重点。",
    "章节结构：第二节为「公式速查索引」（快速浏览），第三节起为「分组详解」（公式图 + 详解 + 代码）。",
]:
    pp = doc.add_paragraph(); pp.paragraph_format.space_after = Pt(3)
    set_run(pp.add_run(t), 10.5)

doc.add_heading("二、公式速查索引", level=1)
for (i, g, name, tex, detail, code, p, w, h) in imgs:
    lp = doc.add_paragraph(); lp.paragraph_format.left_indent = Inches(0.2); lp.paragraph_format.space_after = Pt(1)
    set_run(lp.add_run(f"{i:>2}. [{g}] {name}" + ("  ·  含代码" if code else "")), 10)

doc.add_heading("三、核心公式详解与代码实现", level=1)
for (gid, gtitle) in groups:
    doc.add_heading(gtitle, level=2)
    for (i, g, name, tex, detail, code, p, w, h) in imgs:
        if g != gid: continue
        h3 = doc.add_heading(f"{i}. {name}", level=3)
        # 公式图
        aspect = w/h; hi = 0.5; wi = hi*aspect
        if wi > 6.0: wi = 6.0; hi = wi/aspect
        fp = doc.add_paragraph(); fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.add_run().add_picture(p, width=Inches(wi), height=Inches(hi))
        fp.paragraph_format.space_after = Pt(2)
        # 详解
        dp2 = doc.add_paragraph(); dp2.paragraph_format.space_after = Pt(3)
        set_run(dp2.add_run("【详解】" + detail), 10.5)
        # 代码
        if code:
            cp = doc.add_paragraph(); cp.paragraph_format.space_after = Pt(1)
            set_run(cp.add_run("【代码实现】"), 10, True, RGBColor(0x2E,0x54,0x96))
            add_code(doc, code)

doc.add_page_break()
doc.save(DOCX)
print("DOCX SAVED:", DOCX)

# ---------- 构建 PDF ----------
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
                                KeepTogether, PageBreak, Preformatted)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.enums import TA_CENTER
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
CN='STSong-Light'
ss = getSampleStyleSheet()
st_title=ParagraphStyle('t',parent=ss['Title'],fontName=CN,fontSize=18,textColor=(0x1F,0x38,0x64),alignment=TA_CENTER,leading=22)
st_sub=ParagraphStyle('s',parent=ss['Normal'],fontName=CN,fontSize=10.5,alignment=TA_CENTER,textColor=(0x59,0x59,0x59))
st_h1=ParagraphStyle('h1',parent=ss['Heading1'],fontName=CN,fontSize=14,textColor=(0x1F,0x38,0x64),spaceBefore=10,spaceAfter=4)
st_h2=ParagraphStyle('h2',parent=ss['Heading2'],fontName=CN,fontSize=12,textColor=(0x2E,0x54,0x96),spaceBefore=8,spaceAfter=3)
st_h3=ParagraphStyle('h3',parent=ss['Heading3'],fontName=CN,fontSize=11,textColor=(0x1F,0x38,0x64),spaceBefore=6,spaceAfter=2)
st_body=ParagraphStyle('b',parent=ss['Normal'],fontName=CN,fontSize=10.5,leading=15)
st_idx=ParagraphStyle('i',parent=ss['Normal'],fontName=CN,fontSize=10,leading=14)
st_lbl=ParagraphStyle('l',parent=ss['Normal'],fontName=CN,fontSize=10,leading=14,textColor=(0x2E,0x54,0x96))
st_code=ParagraphStyle('c',parent=ss['Normal'],fontName='Courier',fontSize=8.5,leading=11,textColor=(0x1A,0x1A,0x1A))

def footer(canvas, docu):
    canvas.saveState()
    canvas.setFont(CN, 8); canvas.setFillColorRGB(0.5,0.5,0.5)
    canvas.drawCentredString(A4[0]/2, 0.5*inch, f"吴恩达 ML 第一门课复习速查表（详解版） · 第 {docu.page} 页")
    canvas.restoreState()

flow=[]
flow.append(Paragraph("吴恩达《Supervised Machine Learning》第一门课<br/>复习速查表 · 详解与代码版", st_title))
flow.append(Spacer(1,6))
flow.append(Paragraph("线性回归 · 梯度下降 · 逻辑回归 · 正则化 ｜ 涵盖 Week 1–3 全核心公式（含推导与 numpy 实现）", st_sub))
flow.append(Paragraph("整理时间：2026-10-04 ｜ 公式以标准数学格式（TeX 渲染）；代码为 Python/numpy 伪代码", ParagraphStyle('m',parent=st_sub,fontSize=9,textColor=(0x80,0x80,0x80))))
flow.append(Spacer(1,10))
flow.append(Paragraph("一、文档说明与主题范围", st_h1))
for t in [
    "本文档为吴恩达机器学习专项课程第一门课《Supervised Machine Learning: Regression and Classification》（Coursera / DeepLearning.AI · Stanford, 2022 版）的复习速查表详解版。在速查表基础上，为每条公式补充「详细推导/直觉说明」与「Python/numpy 代码实现」，便于边看公式边动手。",
    "涵盖主题：① 线性回归与代价函数；② 梯度下降；③ 多元回归、特征缩放与向量化；④ 逻辑回归与分类；⑤ 正则化。均为作业与考试重点。",
    "章节结构：第二节为「公式速查索引」（快速浏览），第三节起为「分组详解」（公式图 + 详解 + 代码）。",
]:
    flow.append(Paragraph(t, st_body)); flow.append(Spacer(1,3))
flow.append(Paragraph("二、公式速查索引", st_h1))
for (i,g,name,tex,detail,code,p,w,h) in imgs:
    flow.append(Paragraph(f"{i:>2}. [{g}] {name}" + ("  ·  含代码" if code else ""), st_idx))
flow.append(Paragraph("三、核心公式详解与代码实现", st_h1))
for (gid,gtitle) in groups:
    flow.append(Paragraph(gtitle, st_h2))
    for (i,g,name,tex,detail,code,p,w,h) in imgs:
        if g!=gid: continue
        aspect=w/h; wi=0.5*aspect
        if wi>6.0: wi=6.0
        img_w=wi*inch; img_h=wi/aspect*inch
        block=[Paragraph(f"{i}. {name}", st_h3),
               RLImage(p, width=img_w, height=img_h),
               Paragraph("【详解】"+detail, st_body)]
        if code:
            block.append(Paragraph("【代码实现】", st_lbl))
            block.append(Preformatted("\n".join(code), st_code))
        block.append(Spacer(1,4))
        flow.append(KeepTogether(block))

docp=SimpleDocTemplate(PDF, pagesize=A4, leftMargin=1*inch, rightMargin=1*inch,
                       topMargin=0.9*inch, bottomMargin=0.8*inch, title="吴恩达ML第一门课复习速查表-详解版")
docp.build(flow, onFirstPage=footer, onLaterPages=footer)
print("PDF SAVED:", PDF)

shutil.rmtree(IMG_DIR, ignore_errors=True)
print("CLEANED")
