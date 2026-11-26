#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
!!! DEPRECATED / DO NOT USE !!!
本脚本会生成**非法**的 OOXML，PowerPoint 打开时会弹「发现内容有问题，可尝试修复」。
已知硬错：<p:cBhvr> 里写了 <p:cTnLst> 而非 <p:cTn>；<p:anim> 缺必需的 <p:tavLst>；
<p:timing> 缺 p:tnLst>p:par(nodeType=tmRoot)>p:seq 标准骨架；入场动画缺必需 <p:set>。

请改用：tools/animate_via_powerpoint.ps1 —— 由本机 PowerPoint COM 自己生成动画 XML，
保证合法，并可用 -ExportDir 导出 PNG 做真渲染校验。
保留本文件仅作历史记录，__main__ 已加退出守卫。

----- 以下为原始（错误）实现，仅供追溯 -----

animate_pptx.py — 给「可编辑」PPTX 注入：
  1) 每页切换过渡（淡入淡出）
  2) 元素按序淡入（入场动画，错峰 stagger）
  3) 题目页「点击显示答案」交互：答案初始隐藏，点触发按钮后淡入

实现要点（避免灰屏）：
  - 使用 p:anim（属性动画，style.opacity 0->1），而非 p:animEffect（特效动画）。
    p:animEffect 依赖渲染滤镜资源，手搓结构在 PowerPoint 放映时极易整页灰屏；
    p:anim 是标准属性动画，无外部依赖，受 PowerPoint 自动隐藏(entr)机制支持。
  - 题目页答案框：单条 onclick 触发的 p:anim（presetClass=entr），
    由 PowerPoint 自动在点击前隐藏，点击后淡入，避免提前泄露。
  - 每页先移除既有 p:timing（若有），重建为干净结构，保留 p:transition。
  - 若页面已存在「点击显示答案」按钮则复用，不重复添加。

用法：python animate_pptx.py <in.pptx> <out.pptx>
"""
import sys
import copy
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.oxml.ns import qn
from lxml import etree
from pptx.enum.shapes import MSO_SHAPE

etree.register_namespace('p', 'http://schemas.openxmlformats.org/presentationml/2006/main')

SCALE = 12700
CANVAS_W, CANVAS_H = 1920, 1080


def mk(tag, **attrs):
    e = etree.Element(qn(tag))
    for k, v in attrs.items():
        e.set(k, str(v))
    return e


def add_transition(sld):
    """淡入淡出切换过渡，保留幂等（已存在则不重复）。"""
    existing = sld.find(qn('p:transition'))
    if existing is not None:
        return existing
    tr = mk('p:transition')
    tr.append(mk('p:fade'))
    return tr


def make_anim(spid, nid, delay_ms, frm, to, dur_ms=400, preset='entr',
              evt=None, btn_spid=None):
    """单个 p:anim（style.opacity）淡入；若 evt='onclick' 则点击触发。"""
    par = mk('p:par')
    ctn = mk('p:cTn', id=str(nid), fill='hold')
    par.append(ctn)
    stc = mk('p:stCondLst'); ctn.append(stc)
    if evt == 'onclick':
        cond = mk('p:cond', evt='onclick', delay='0'); stc.append(cond)
        cond.append(mk('p:tn', ref=str(btn_spid)))
    else:
        stc.append(mk('p:cond', delay=str(delay_ms)))
    ctn.append(mk('p:childTnLst'))
    inner = mk('p:par'); ctn.find(qn('p:childTnLst')).append(inner)
    ic = mk('p:cTn', id=str(nid + 1), fill='hold', presetID='1',
            presetClass=preset, presetSubtype='0', nodeType='withEffect')
    inner.append(ic)
    istc = mk('p:stCondLst'); ic.append(istc)
    istc.append(mk('p:cond', delay='0'))
    ic.append(mk('p:childTnLst'))
    anim = mk('p:anim', calcmode='lin', valueType='num')
    anim.set('from', str(frm))
    anim.set('to', str(to))
    ic.find(qn('p:childTnLst')).append(anim)
    cb = mk('p:cBhvr'); anim.append(cb)
    ctnl = mk('p:cTnLst'); cb.append(ctnl)
    ctnl.append(mk('p:cTn', id=str(nid + 2), dur=str(dur_ms), fill='hold', nodeType='afterEffect'))
    tgt = mk('p:tgtEl'); cb.append(tgt)
    tgt.append(mk('p:spTgt', spid=str(spid)))
    anl = mk('p:attrNameLst'); cb.append(anl)
    an = mk('p:attrName'); anl.append(an); an.text = 'style.opacity'
    return par


def _rect(sh):
    return (sh.left / SCALE, sh.top / SCALE, sh.width / SCALE, sh.height / SCALE)


def _overlap(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = min(ax + aw, bx + bw) - max(ax, bx)
    iy = min(ay + ah, by + bh) - max(ay, by)
    return ix > 0 and iy > 0


def add_button(slide, answer_shape, all_rects):
    """在「不与任何现有元素重叠」且尽量靠近答案处放一个圆角触发按钮。"""
    bw, bh = 340, 50
    ax0, ay0, aw, ah = _rect(answer_shape)
    acx, acy = ax0 + aw / 2, ay0 + ah / 2
    cands = []
    for dy in range(0, CANVAS_H, 12):
        for dx in range(-300, 321, 40):
            x = acx - bw / 2 + dx
            y = acy - bh / 2 + dy
            if x < 12 or y < 12 or x + bw > CANVAS_W - 12 or y + bh > CANVAS_H - 12:
                continue
            cand = (x, y)
            if any(_overlap(cand + (bw, bh), r) for r in all_rects):
                continue
            cands.append(cand)
            break
        if cands:
            break
    if not cands:
        cands = [(CANVAS_W / 2 - bw / 2, CANVAS_H - bh - 14)]
    x, y = cands[0]
    btn = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                                 Emu(int(x * SCALE)), Emu(int(y * SCALE)),
                                 Emu(int(bw * SCALE)), Emu(int(bh * SCALE)))
    tf = btn.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(int(8 * SCALE)); tf.margin_right = Emu(int(8 * SCALE))
    tf.margin_top = Emu(int(4 * SCALE)); tf.margin_bottom = Emu(int(4 * SCALE))
    p = tf.paragraphs[0]
    p.alignment = 1
    r = p.add_run()
    r.text = '▶ 点击显示答案'
    from pptx.dml.color import RGBColor
    r.font.size = Pt(26)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0x1C, 0x1C, 0x1C)
    btn.fill.solid(); btn.fill.fore_color.rgb = RGBColor(0xFF, 0xD4, 0x00)
    btn.line.fill.background()
    btn.shadow.inherit = False
    return btn


def process(path_in, path_out):
    prs = Presentation(path_in)
    nid = 1000
    total_answers = 0
    for s in prs.slides:
        sld = s._element
        # 移除既有 timing（保留 transition），重建干净结构
        old = sld.find(qn('p:timing'))
        if old is not None:
            sld.remove(old)

        # 识别答案框 / 已有按钮（按钮优先，避免被误判为答案）
        answer = None
        button = None
        for sh in s.shapes:
            if sh.has_text_frame:
                t = sh.text_frame.text
                if ('点击显示答案' in t) or ('▶' in t):
                    if button is None:
                        button = sh
                    continue
                if '答案' in t and answer is None:
                    answer = sh

        # 有答案但无按钮则补一个
        if answer is not None and button is None:
            all_rects = [_rect(sh) for sh in s.shapes]
            button = add_button(s, answer, all_rects)

        answer_spid = answer.shape_id if answer else None
        button_spid = button.shape_id if button else None
        if answer is not None:
            total_answers += 1

        # 构建 timing
        timing = mk('p:timing')
        tnLst = mk('p:tnLst'); timing.append(tnLst)
        rootPar = mk('p:par'); tnLst.append(rootPar)
        rootCtn = mk('p:cTn', id=str(nid), fill='hold'); nid += 1
        rootPar.append(rootCtn)
        stc = mk('p:stCondLst'); rootCtn.append(stc)
        stc.append(mk('p:cond', delay='indefinite'))
        child = mk('p:childTnLst'); rootCtn.append(child)

        order = 0
        for sh in s.shapes:
            spid = sh.shape_id
            if spid == answer_spid:
                continue  # 答案单独处理（点击触发）
            delay = min(order * 90, 900)
            order += 1
            nid += 3
            child.append(make_anim(spid, nid, delay, 0, 1))

        if answer is not None and button is not None:
            nid += 3
            child.append(make_anim(answer_spid, nid, 0, 0, 1,
                                   evt='onclick', btn_spid=button_spid))

        # 插入 timing（在 extLst 之前）；transition 保留原有
        ext = sld.find(qn('p:extLst'))
        if ext is not None:
            ext.addprevious(timing)
        else:
            sld.append(timing)
        # 确保 transition 存在
        add_transition(sld)

    prs.save(path_out)
    print(f"✅ {path_out}  (含点击显示答案的页面: {total_answers})")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("usage: animate_pptx.py <in.pptx> <out.pptx>")
        sys.exit(1)
    process(sys.argv[1], sys.argv[2])
