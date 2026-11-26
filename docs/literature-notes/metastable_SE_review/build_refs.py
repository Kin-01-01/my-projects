import json, re

BASE = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review"
cite = json.load(open(BASE + "/notes/cite_data.json", encoding="utf-8"))
pool = json.load(open(BASE + "/notes/pool_final.json", encoding="utf-8"))
enr = json.load(open(BASE + "/notes/pool_enriched.json", encoding="utf-8"))

# evidence anchors per pool id (from OA full texts / notes)
ANCHORS = {
 "C1": ("角色：argyrodite Li6PS5X 家族奠基（机械化学/高温合成亚稳相）。核心证据：首次报道晶体锂超离子导体、高 Li+ 迁移率。", "非OA；具体电导率数值未全文核验，仅作背景"),
 "C2": ("角色：LGPS Li10GeP2S12 奠基，室温 σ≈1.2×10⁻² S·cm⁻¹（社群公认）。", "【争议】亚稳属性学界分歧，本文不做绝对化定性；非OA"),
 "C3": ("角色：石榴石 LLZO 奠基，立方相为亚稳高导相。", "非OA；背景"),
 "C4": ("角色：无机固态电解质离子输运机理总述。", "非OA；引言背景"),
 "C5": ("角色：LGPS 家族相稳定性/电化学稳定性第一性原理计算，提供自由能面框架。", "非OA；方法性背景，具体ΔG未全文核验"),
 "S1-1": ("OA核心。α-Li3PS4 TTT图与快淬可获性：室温平衡相γ；α仅>480°C稳定；σα>10⁻³ vs σγ=10⁻⁷ S·cm⁻¹（~4数量级）；400°C/min快热后淬火保留α；α表面能最低(0.43/0.50/0.58 J·m⁻²)→纳米限域稳定；块体相变γ→β 296°C/β→α 385°C，8.5nm半径压至127/180°C；混合样总σ 5.8×10⁻⁴ S·cm⁻¹。", "OA全文锚点：Abstract / Results Fig.1,3 / Fig.S8（Nat Commun 2026, 17, 10060）"),
 "S1-2": ("角色：高能球磨机械化学诱导生成 argyrodite 亚稳相。", "非OA；成因归类背景，具体数值未全文核验"),
 "S1-3": ("角色：低温NMR探测 argyrodite 长程 Li+ 动力学。", "非OA；背景"),
 "S1-4": ("角色：低温NMR直接探测极快 Li+ 跳跃（argyrodite）。", "非OA；摘要级，精确数值【证据缺口】"),
 "S1-5": ("角色：Li7PSe6 长程 Li+ 动力学（阴离子无序）。", "非OA；背景"),
 "S1-6": ("角色：argyrodite 全固态锂硫电池应用。", "非OA；应用背景"),
 "S1-7": ("角色：³¹P NMR 显示 argyrodite 阴离子(S/Cl)旋转/重排动力学与超离子导电相关。", "非OA；机制背景，精确Ea【证据缺口】"),
 "S1-8": ("角色：氧掺杂提升 argyrodite 电化学稳定性（掺杂稳定化示例）。", "非OA；背景，窗口数值【证据缺口】"),
 "S1-9": ("角色：阴离子无序是 Li6PS5X 超离子扩散的机制来源（AIMD+ML势）。", "预印本(ChemRxiv, 有DOI)；数值未独立复核，引用注明preprint"),
 "S1-10": ("角色：Ge取代提升 argyrodite 电导（组分调控）。", "非OA；背景"),
 "S1-11": ("角色：卤素取代调控 argyrodite 电导与稳定性。", "非OA；背景"),
 "S1-12": ("角色：argyrodite 综述（合成/结构/稳定性/动力学）。", "非OA；背景"),
 "S1-13": ("角色：Li7P3S11 玻璃陶瓷（非晶对照）。", "非OA；概念区分（非晶≠亚稳晶相）"),
 "S1-14": ("角色：结晶 LiPON 新相 vs 非晶 LiPON（亚稳≠非晶）。", "非OA；概念区分"),
 "S2-1": ("角色：Li3YCl6/Li3YBr6 卤化物奠基，冷压 σ>1 mS·cm⁻¹，4V级ASSB库伦效率94%。", "非OA；摘要级背景"),
 "S2-2": ("角色：明确以 metastable chloride 为题的亚稳氯化物电解质，高可塑性。", "非OA；具体σ/相变温度【证据缺口】，作亚稳氯化物概念锚点"),
 "S2-3": ("角色：揭示 Li3YCl6 的 Pnma 结构及多晶型差异（卤化物相变差异核心）。", "非OA；具体能差/Ea【证据缺口】"),
 "S2-4": ("角色：Li3YCl6/Li3YBr6 锂亚结构无序是卤化物高导来源。", "非OA；精确占有率/Ea【证据缺口】"),
 "S2-5": ("角色：Al³⁺异价取代调控 Li2ZrCl6 电导与稳定性（高熵/掺杂自由能面）。", "非OA；背景"),
 "S2-6": ("角色：Li2ZrCl6 卤化物电化学性能变化。", "非OA；背景"),
 "S2-7": ("角色：水相/酸辅助合成纯相 Li3InCl6，利于规模化低成本（低能耗路线）。", "非OA；σ~1.5-2×10⁻³ S·cm⁻¹为社群公认/综述级，【证据缺口】精确值"),
 "S2-8": ("角色：磷酸辅助制备高性能 Li3InCl6。", "非OA；背景"),
 "S3-1": ("角色：富锂反钙钛矿 Li3OCl 超离子导电奠基。", "非OA；σ范围10⁻⁷–10⁻⁴ S·cm⁻¹（离散大，背景）"),
 "S3-2": ("角色：纯相 Li3OCl/Li3OBr 制备困难，主因热力学不稳定与潮解。", "非OA；背景"),
 "S3-3": ("OA核心。RF溅射薄膜中稳定微量亚稳 Li3OCl 反钙钛矿相；FT-IR无O-H证实为Li3OCl而非稳定相Li2OHCl；退火分解为Li2O+LiCl；σ~10⁻⁸ S·cm⁻¹（低相纯度）。", "OA全文锚点：Abstract/正文（Mater Adv 2022, 3, 8995-9008）"),
 "S3-4": ("角色：缺陷分布影响 Li3OCl 的 Li 扩散与弹性。", "非OA；背景"),
 "S3-5": ("角色：应变/界面限域调控 Li3OCl 离子扩散（动力学锁相-界面应变）。", "非OA；具体Ea/σ【证据缺口】"),
 "S3-6": ("角色：LLZO 四方→立方相变，立方为亚稳高导相，需掺杂/快冷维持。", "非OA；σ~10⁻⁴–10⁻³ S·cm⁻¹、Ea~0.3eV为背景量级"),
 "S3-7": ("角色：高熵掺杂提升 LLZO 性能与稳定性（热力学稳定化-高熵设计）。", "会议/汇编级，层级较低，作支撑背景"),
 "S3-8": ("角色：Na系反钙钛矿对照（非Li，仅背景）。", "非OA；对照"),
 "S3-9": ("角色：反钙钛矿电解质基固态锂金属电池界面优化。", "非OA；界面背景"),
 "M1": ("OA核心。Cu2-xSe 在~140°C发生有序→超离子相变，原位HRTEM直接观测阳离子亚晶格无序化→高迁移率→超离子导电。", "OA全文锚点：Abstract/Results（Nat Commun 2019, 10, 1505）；非Li体系，作机制级通用原理佐证"),
}

# ---------- Chinese manuscript numbering ----------
zh = open(BASE + "/01_中文综述.md", encoding="utf-8").read()
tokens = re.findall(r"\[@([A-Za-z0-9\-]+)\]", zh)
order = []
for t in tokens:
    if t not in order:
        order.append(t)
num = {pid: i + 1 for i, pid in enumerate(order)}
zh2 = re.sub(r"\[@([A-Za-z0-9\-]+)\]", lambda m: "[%d]" % num[m.group(1)], zh)
reflines = ["## 参考文献\n"]
for i, pid in enumerate(order):
    reflines.append("[%d] %s" % (i + 1, cite[pid]["gbt"]))
zh2 = zh2.replace("<!--REFERENCES-->", "\n".join(reflines))
open(BASE + "/01_中文综述.md", "w", encoding="utf-8").write(zh2)
print("ZH cited count:", len(order))
print("cited ids:", order)

# ---------- 03 unified library (all 37, both formats) ----------
olines = ["# 统一参考文献库（共用·双语）\n",
          "> 共 %d 篇，含奠基经典 5 篇；均经 Crossref 核验 DOI 有效。\n" % len(pool["papers"]),
          "## A. GB/T 7714 顺序编码格式（中文稿用）\n"]
for p in pool["papers"]:
    olines.append("[%s] %s" % (p["id"], cite[p["id"]]["gbt"]))
olines.append("\n## B. Nature 格式（英文稿用）\n")
for p in pool["papers"]:
    olines.append("[%s] %s" % (p["id"], cite[p["id"]]["nature"]))
open(BASE + "/03_参考文献库.md", "w", encoding="utf-8").write("\n".join(olines))

# ---------- 06 traceability (cited subset) ----------
tlines = ["# 文献证据溯源表（防文献幻觉交付）\n",
          "> 仅列正文实际引用文献；逐条给出 DOI、OA 状态、核心证据原文位置与备注。\n",
          "| 正文序号 | 文献(作者, 年) | DOI | OA | 核心证据/锚点 | 备注 |\n",
          "|---|---|---|---|---|---|"]
for pid in order:
    c = cite[pid]
    p = next(x for x in pool["papers"] if x["id"] == pid)
    anchor, note = ANCHORS.get(pid, ("—", "—"))
    tlines.append("| [%s] | %s, %s | %s | %s | %s | %s |" % (
        num[pid], c["fam0"], c["year"], p["doi"],
        "是" if p.get("oa") else "否", anchor, note))
open(BASE + "/06_证据溯源表.md", "w", encoding="utf-8").write("\n".join(tlines))
print("06 rows:", len(order))
