#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
add_speaker_notes.py — 为「牛顿第一定律」课件逐页补充【讲解要点】【过渡语】【核心结论】

设计约束（来自用户要求）：
  1. 保持原有版式、图表、数据不变 → 新增文字全部写入**演讲者备注**（notes），
     不动幻灯片上的任何形状/图片/表格；放映投屏画面与原文件 100% 一致。
  2. 新增文字与原文风格一致：初中物理试讲口吻，短句、重点突出、不冗长。
  3. 每页 = 讲解要点（2–3 条）+ 过渡语（1 句，通向下一页）+ 核心结论（1 句）。
  4. 幂等：重复运行不会叠加（已含标记则先剥离旧块再写）。

用法：
  python add_speaker_notes.py <in.pptx> <out.pptx>
"""

import sys
from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor

# ── 每页新增内容（键 = 页码，从 1 开始）────────────────────────────────
EXTRA = {
    1: dict(
        points=[
            "开口先抛生活疑问（不蹬车为何还往前走），制造认知冲突，别一上来念课题。",
            "点明本节课要探的是「力与运动的关系」，不是背一条规律。",
        ],
        transition="带着这个疑问，我们先看这节课要达成哪四个目标。",
        conclusion="这节课要回答的核心问题——力，到底是不是维持运动的原因？",
    ),
    2: dict(
        points=[
            "四个目标用「看得见的行为」表述：能说出定律、能像科学家推理、能动手实验、能敢于质疑。",
            "不要逐字念，每条约用一句话带过，最后一句收束到「像科学家一样」。",
        ],
        transition="目标清楚了，我们从三个熟悉的生活画面开始。",
        conclusion="四条目标指向同一件事——弄清力与运动到底什么关系。",
    ),
    3: dict(
        points=[
            "三个画面只用一个共同点拎出来：「原来在动、后来不再用力、却还在动」。",
            "顺势把矛盾抛给学生：既然不用力还在动，那最后为什么又停了？",
        ],
        transition="这个问题，两千多年前就有人认真想过。",
        conclusion="现象背后藏着一个疑问——力，真的是维持物体运动的原因吗？",
    ),
    4: dict(
        points=[
            "强调对比：亚里士多德的观点「统治了近两千年」，伽利略却敢站出来质疑。",
            "伽利略的反驳理由先不展开，留悬念到实验环节。",
        ],
        transition="伽利略凭什么反对亚里士多德？我们用实验说话。",
        conclusion="科学的进步，靠的是实验与推理，而不是权威。",
    ),
    5: dict(
        points=[
            "反复强调「同一高度、由静止下滑」的目的是——到达水平面时初速度相同。",
            "点明这就是控制变量法：只改变表面粗糙程度，其余都不变。",
        ],
        transition="方案定好了，我们看实验现象和数据。",
        conclusion="只改变一个变量，比较才有意义。",
    ),
    6: dict(
        points=[
            "先让学生自己读表得出结论，老师再归纳，避免直接给答案。",
            "每条结论都与表格中的一行一一对应，指到哪说到哪。",
        ],
        transition="表面越来越光滑……如果一直光滑下去呢？",
        conclusion="表面越光滑 → 阻力越小 → 滑行越远 → 速度减小得越慢。",
    ),
    7: dict(
        points=[
            "配合动画指小车停止位置，边动边讲，让「越滑越远」看得见。",
            "点出方法名：在实验基础上推理极端情况，叫理想实验法。",
        ],
        transition="就是这一步推理，直接通向牛顿第一定律。",
        conclusion="若阻力为零，物体将以不变的速度永远运动下去。",
    ),
    8: dict(
        points=[
            "先请学生齐读一遍，读出语感；再逐词抠：一切物体 / 没有受到力 / 总保持 / 或。",
            "「或」字要重读——原来静止就保持静止，原来运动就保持匀速直线，二选一。",
        ],
        transition="定律说清楚了，我们回头看去课始那个问题。",
        conclusion="不受力时：静止的保持静止，运动的保持匀速直线运动。",
    ),
    9: dict(
        points=[
            "用「加速、减速、转弯」三种情形说明什么叫运动状态改变。",
            "提醒学生：这条定律是「实验 + 推理」得来的理想规律，不能由实验直接验证。",
        ],
        transition="物体为什么「不愿意」改变运动状态？因为它有惯性。",
        conclusion="力不是维持运动的原因，而是改变物体运动状态的原因。",
    ),
    10: dict(
        points=[
            "把「三个一切」讲透：一切物体、任何状态、任何时候都有惯性。",
            "惯性大小只看质量，与速度大小、是否受力都无关——这里要明确否掉错误直觉。",
        ],
        transition="光知道概念还不够，我们学一套解释惯性现象的方法。",
        conclusion="惯性是物体的固有属性，质量是量度惯性大小的唯一标准。",
    ),
    11: dict(
        points=[
            "四步法边讲边在副板书上对照写出来，让学生看得见推理链。",
            "用「急刹车人前倾」把四步完整走一遍，学生说、老师补。",
        ],
        transition="方法有了，我们用几个常见说法检验一下。",
        conclusion="解释惯性现象的关键：谁先受力变了，谁因惯性保持原状态。",
    ),
    12: dict(
        points=[
            "先让学生举手表决 A/B/C/D，再点按钮揭晓答案，不要提前泄露。",
            "三条错误说法逐条纠正：惯性不是力、惯性与速度无关、静止物体也有惯性。",
        ],
        transition="最后，把今天的收获收一收。",
        conclusion="惯性不是力，只与质量有关，静止的物体同样有惯性。",
    ),
    13: dict(
        points=[
            "用「四个一」把全课串成一条线：一个定律、一种方法、一个概念、一个关系。",
            "回扣开场问题，形成闭环，再让学生把结构图抄到笔记本上。",
        ],
        transition="留两道基础题和一道提高题，检验今天的收获。",
        conclusion="从亚里士多德到牛顿——力改变运动状态，惯性维持原状态。",
    ),
    14: dict(
        points=[
            "讲清两类作业的差别：基础题重「会用四步法」，提高题重「会用惯性分析」。",
            "预告批改标准：能写全「原来状态 → 谁先变 → 谁因惯性不变」，就算过关。",
        ],
        transition="这节课就到这里，谢谢聆听，敬请各位老师指正。",
        conclusion="用惯性解释世界——答案就藏在你的日常生活里。",
    ),
}

MARK = "【讲解要点】"
C_HEAD = RGBColor(0x1F, 0x4E, 0x79)   # 深蓝：小标题
C_BODY = RGBColor(0x33, 0x33, 0x33)   # 深灰：正文
C_KEY = RGBColor(0xC0, 0x00, 0x00)    # 深红：核心结论


def strip_old(tf):
    """幂等：删除上一次注入的备注块（从含标记的段落起，到末尾）。"""
    ps = list(tf.paragraphs)
    cut = None
    for i, p in enumerate(ps):
        if MARK in p.text:
            cut = i
            break
    if cut is None:
        return
    for p in ps[cut:]:
        p._p.getparent().remove(p._p)


def add_p(tf, text, size=13, bold=False, color=C_BODY, before=4):
    p = tf.add_paragraph()
    if before:
        p.space_before = Pt(before)
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.name = "微软雅黑"
    r.font.color.rgb = color
    return p


def main(src, dst):
    prs = Presentation(src)
    for i, slide in enumerate(prs.slides, 1):
        extra = EXTRA.get(i)
        if not extra:
            continue
        tf = slide.notes_slide.notes_text_frame
        strip_old(tf)
        add_p(tf, MARK, size=13, bold=True, color=C_HEAD, before=10)
        for pt in extra["points"]:
            add_p(tf, "· " + pt, size=13, color=C_BODY)
        add_p(tf, "【过渡语】", size=13, bold=True, color=C_HEAD, before=7)
        add_p(tf, extra["transition"], size=13, color=C_BODY, before=0)
        add_p(tf, "【核心结论】", size=13, bold=True, color=C_KEY, before=7)
        add_p(tf, extra["conclusion"], size=13, bold=True, color=C_KEY, before=0)
    prs.save(dst)
    print(f"saved -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
