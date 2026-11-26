#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_deck_a.py — 生成「方向 A · 满版浅绿 · 字体当图」的 14 页 HTML deck。

方向 A = 用户选定的方向（见 design-demos/direction-approved.md 记录）：
  满版单一浅绿色场铺底 / 无卡片无描边无阴影 / 字体即主视觉 / 上下双色块分割。
  底色 #DCEBD8（场）+ #C9DFC4（次级分割带）；墨 #123322；强调 #2F7A46；标注 #3F6B4E。

输出：
  deck-a/style-a.css
  deck-a/slides/page01.html … page14.html
  deck-a/index.html            概览墙（14 页网格 + 键盘翻页）

用法：python build_deck_a.py <deck-a 目录>
"""

import os
import sys

# ── 设计 token ────────────────────────────────────────────────
CSS = r"""
:root{
  --field:#DCEBD8;   /* 满版浅绿：页面底色 */
  --field2:#C9DFC4;  /* 次级浅绿：分割带 */
  --ink:#123322;     /* 墨绿：主文字 */
  --accent:#2F7A46;  /* 强调绿 */
  --label:#3F6B4E;   /* 标注 */
  --sub:#4A6B54;     /* 次级文字 */
  --pale:#E4F1E2;    /* 反白色（深底上的字） */
  --hair:rgba(18,51,34,.16);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#8FA98F}
body{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
.slide{position:relative;width:1920px;height:1080px;overflow:hidden;background:var(--field);
  color:var(--ink);padding:96px 108px 84px;display:flex;flex-direction:column}
.mono{font-family:"JetBrains Mono",Consolas,"Courier New",monospace;font-variant-numeric:tabular-nums}

/* 头部 / 页脚 */
.head{display:flex;justify-content:space-between;align-items:baseline;flex:none}
.eyebrow{font-size:27px;font-weight:600;letter-spacing:.18em;color:var(--label)}
.pageno{font-size:25px;letter-spacing:.08em;color:var(--label)}
.h2{margin-top:20px;font-size:92px;line-height:1.06;font-weight:900;letter-spacing:-.04em;
  color:var(--ink);flex:none;max-width:1620px}
.h2.sm{font-size:78px;max-width:1700px}
.h2.xs{font-size:68px;max-width:1700px}
.body{flex:1;min-height:0;margin-top:46px;display:flex;gap:56px}
.foot{display:flex;justify-content:space-between;align-items:baseline;flex:none;
  font-size:23px;color:var(--label);letter-spacing:.06em;padding-top:22px}

/* 通用块 */
.cols{display:flex;gap:56px;width:100%}
.c58{flex:0 0 58%;display:flex;flex-direction:column}
.c42{flex:1;display:flex;flex-direction:column;justify-content:center}
.c50{flex:1;display:flex;flex-direction:column}
.hair{height:2px;background:var(--hair);width:100%}
.band{background:var(--field2);border-radius:0;padding:26px 34px;margin-top:auto}
.band .k{font-size:26px;letter-spacing:.2em;color:var(--sub);font-weight:600;margin-bottom:10px}
.band .v{font-size:38px;font-weight:700;color:var(--ink);line-height:1.4}
em.e{font-style:normal;color:var(--accent);border-bottom:7px solid var(--accent);padding-bottom:2px}
strong.k{font-weight:800;color:var(--accent)}

/* 大序号行 */
.rows{display:flex;flex-direction:column;width:100%}
.row{display:flex;gap:34px;align-items:flex-start;padding:24px 0;border-top:2px solid var(--hair)}
.row:first-child{border-top:0;padding-top:0}
.row .n{font-size:84px;line-height:.98;font-weight:900;color:var(--accent);flex:0 0 130px}
.row .t{font-size:42px;font-weight:800;letter-spacing:-.02em}
.row .d{font-size:28px;color:var(--sub);margin-top:12px;line-height:1.5}
.row.tight{padding:16px 0}
.row.tight .n{font-size:68px;flex:0 0 104px}

/* 大列表（无卡片） */
.list{display:flex;flex-direction:column;gap:26px;width:100%}
.li{display:flex;gap:26px;align-items:baseline}
.li .n{font-size:56px;line-height:1;font-weight:900;color:var(--accent);flex:0 0 92px}
.li .x{font-size:38px;font-weight:700;line-height:1.4}
.li .x small{display:block;font-size:27px;font-weight:500;color:var(--sub);margin-top:8px}

/* 对照双栏 */
.vs{display:flex;gap:70px;width:100%}
.vs .c{flex:1;display:flex;flex-direction:column;gap:22px}
.vs .top{height:8px;width:100%;background:#9DBFA6}
.vs .c.new .top{background:var(--accent)}
.vs .who{font-size:38px;font-weight:800}
.vs .id{display:flex;align-items:center;gap:26px}
.vs .badge{width:150px;height:150px;background:#9DBFA6;color:var(--ink);font-family:Georgia,serif;
  font-style:italic;font-weight:700;font-size:86px;text-align:center;line-height:150px;flex:none}
.vs .c.new .badge{background:var(--accent);color:var(--pale)}
.vs .qm{font-size:27px;color:var(--sub);line-height:1.5}
.vs .q{font-size:34px;font-weight:700;line-height:1.45}

/* 表格 */
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:28px;font-weight:700;color:var(--accent);text-align:left;padding:0 0 20px;letter-spacing:.02em}
.tbl td{font-size:34px;padding:20px 0;border-top:2px solid var(--hair)}
.tbl td:first-child{font-weight:800}
.tbl td.dim{color:var(--sub)}

/* 四宫格 */
.quad{display:grid;grid-template-columns:1fr 1fr;gap:44px 70px;width:100%}
.quad .cell{display:flex;flex-direction:column;gap:10px;border-top:6px solid var(--accent);padding-top:20px}
.quad .tag{font-size:26px;letter-spacing:.24em;color:var(--sub);font-weight:700}
.quad .h{font-size:58px;font-weight:900;letter-spacing:-.03em}
.quad .d{font-size:27px;color:var(--sub);line-height:1.5}

/* 两个一行的信息块 */
.pairs{display:grid;grid-template-columns:1fr 1fr;gap:34px 76px;width:100%}
.pair .lab{font-size:25px;letter-spacing:.22em;color:var(--sub);font-weight:700;margin-bottom:12px}
.pair .txt{font-size:33px;font-weight:700;line-height:1.5}
.pair .txt small{display:block;font-size:26px;font-weight:500;color:var(--sub);margin-top:8px}

/* 大字结论 */
.big{font-size:64px;font-weight:900;letter-spacing:-.035em;line-height:1.28}
.eq{font-size:38px;font-weight:700;color:var(--ink);letter-spacing:.01em}
.note{font-size:26px;color:var(--sub);line-height:1.5}

/* 按钮（答案触发，保持常驻可见） */
.btn{display:inline-block;background:var(--ink);color:var(--pale);font-size:28px;font-weight:700;
  padding:16px 30px;letter-spacing:.06em}
.answer{font-size:44px;font-weight:900;color:var(--accent);letter-spacing:.01em}
.opts{display:flex;flex-direction:column;gap:16px;font-size:31px;color:var(--ink)}
.opts span{color:var(--ink)}
svg{display:block}

/* ── 实验类动画专用：装置 / 数据条 / 轨道用 DOM 元素而非 SVG 内部图元 ──
   SVG 内部图元会被整块截成一张图，无法在 PPTX 里逐件挂动画；
   拆成绝对定位的 div 后每件都是独立形状，可按 data-anim 分组逐步展示。 */
.rig{position:relative;width:100%}
.piece{position:absolute}
.trk{height:10px;background:var(--accent)}
.trk.dash{background:none;
  background-image:repeating-linear-gradient(90deg,#2F7A46 0 34px,rgba(0,0,0,0) 34px 58px)}
.tick{width:3px;background:none;
  background-image:repeating-linear-gradient(180deg,#3F6B4E 0 9px,rgba(0,0,0,0) 9px 17px)}
.carblk{width:36px;height:36px;background:var(--ink)}
.carblk.a{background:var(--accent)}
.lbl{font-size:28px;color:var(--sub);line-height:1.2}
.anno{font-size:38px;font-weight:700;color:var(--accent)}
.surf{height:30px;background:var(--accent)}
.surf.s1{background:#8FA98F}
.surf.s2{background:#B4CBAF}
.surf.s3{background:var(--field);border:3px solid var(--accent)}
.bar{height:36px;background:var(--accent)}
.bar.b1{background:var(--ink)}
.axis{height:5px;background:var(--ink)}
.trow{position:relative;display:grid;grid-template-columns:141px 220px 220px 320px}
.th{font-size:28px;font-weight:700;color:var(--accent);padding-bottom:20px}
.tc{font-size:34px;padding:20px 0}
.tc.dim{color:var(--sub)}
.rowline{position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--hair)}
"""


def wrap(title, body, page_no, chapter):
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="../style-a.css">
</head>
<body>
<section class="slide">
{body}
</section>
</body>
</html>
"""


def head(eyebrow, page_no):
    return f"""  <div class="head">
    <div class="eyebrow">{eyebrow}</div>
    <div class="pageno mono">{page_no:02d} / 14</div>
  </div>"""


def foot(page_no, chapter):
    return f"""  <div class="foot">
    <div class="mono">{page_no:02d} / 14</div>
    <div>{chapter}</div>
  </div>"""


# ── 各页内容 ───────────────────────────────────────────────────
PAGES = {}

# P1 封面（绝对定位，单独写）
PAGES[1] = ("P01 · 封面", """
  <style>
    #p1{padding:96px 108px 84px;display:block;position:relative}
    #p1 .field2{position:absolute;left:0;right:0;bottom:0;height:252px;background:var(--field2)}
    #p1 .brand{position:absolute;left:110px;top:96px;font-size:27px;letter-spacing:.18em;font-weight:600;color:var(--label)}
    #p1 .tag{position:absolute;right:110px;top:96px;font-size:26px;color:var(--label)}
    #p1 h1{position:absolute;left:98px;top:238px;font-size:256px;line-height:1;font-weight:900;
      letter-spacing:-.05em;color:var(--ink)}
    #p1 .rule{position:absolute;left:110px;top:576px;width:1180px;height:12px;background:var(--ink)}
    #p1 .sub{position:absolute;left:110px;top:620px;font-size:60px;font-weight:700;color:var(--accent)}
    #p1 .note2{position:absolute;left:112px;top:722px;font-size:34px;letter-spacing:.14em;color:var(--sub)}
    #p1 svg{position:absolute;right:-60px;bottom:24px;width:900px;height:380px}
    #p1 .meta{position:absolute;left:110px;bottom:92px;font-size:26px;color:var(--label)}
  </style>
  <section class="slide" id="p1">
    <div class="field2"></div>
    <div class="brand">人教版八年级下册 · 第八章 运动和力</div>
    <div class="tag mono">第八章 · 第 1 节</div>
    <h1>牛顿第一定律</h1>
    <div class="rule"></div>
    <div class="sub">探究力与运动的关系</div>
    <div class="note2">初中物理试讲课件</div>
    <svg viewBox="0 0 900 380" aria-hidden="true">
      <line x1="20" y1="352" x2="880" y2="352" stroke="#123322" stroke-width="8"/>
      <g stroke="#7FB98C" stroke-width="12" stroke-linecap="square">
        <line x1="40" y1="122" x2="168" y2="122"/>
        <line x1="72" y1="180" x2="232" y2="180"/>
        <line x1="40" y1="238" x2="168" y2="238"/>
      </g>
      <rect x="320" y="180" width="280" height="96" fill="#123322"/>
      <rect x="386" y="114" width="140" height="66" fill="#2F7A46"/>
      <circle cx="386" cy="292" r="42" fill="#DCEBD8" stroke="#123322" stroke-width="15"/>
      <circle cx="546" cy="292" r="42" fill="#DCEBD8" stroke="#123322" stroke-width="15"/>
      <line x1="634" y1="228" x2="816" y2="228" stroke="#2F7A46" stroke-width="9" stroke-dasharray="24 18"/>
      <polygon points="866,228 818,206 818,250" fill="#2F7A46"/>
    </svg>
    <div class="meta mono">授课人：________　|　班级：________</div>
  </section>""")

# P2 学习目标
PAGES[2] = ("P02 · 学习目标", head("学习目标", 2) + """
  <h2 class="h2">这节课我们要达成哪四个目标？</h2>
  <div class="body">
    <div class="rows">
      <div class="row" data-anim="p2r1"><div class="n">01</div><div><div class="t">物理观念</div>
        <div class="d">理解牛顿第一定律的内容，知道惯性概念，理解力与运动的关系</div></div></div>
      <div class="row" data-anim="p2r2"><div class="n">02</div><div><div class="t">科学思维</div>
        <div class="d">经历实验探究与科学推理过程，体会理想实验法和控制变量法</div></div></div>
      <div class="row" data-anim="p2r3"><div class="n">03</div><div><div class="t">科学探究</div>
        <div class="d">通过「阻力对物体运动的影响」实验，培养观察、分析、推理能力</div></div></div>
      <div class="row" data-anim="p2r4"><div class="n">04</div><div><div class="t">科学态度与责任</div>
        <div class="d">感受规律建立过程，培养实事求是的科学态度和勇于质疑的精神</div></div></div>
    </div>
  </div>
""" + foot(2, "学习目标"))

# P3 情境导入
PAGES[3] = ("P03 · 情境导入", head("情境导入", 3) + """
  <h2 class="h2">运动的物体为什么会停下来？</h2>
  <div class="body">
    <div class="c58">
      <div class="list">
        <div class="li" data-anim="p3a"><div class="n">①</div><div class="x">自行车<small>停止蹬车后，仍向前滑行一段</small></div></div>
        <div class="li" data-anim="p3b"><div class="n">②</div><div class="x">滑冰运动员<small>停止用力后，仍向前运动</small></div></div>
        <div class="li" data-anim="p3c"><div class="n">③</div><div class="x">关闭发动机的列车<small>仍继续向前前进</small></div></div>
      </div>
      <div class="band" data-anim="p3core">
        <div class="k">核 心 问 题</div>
        <div class="v">力，真的是<em class="e">维持物体运动</em>的原因吗？</div>
      </div>
    </div>
    <div class="c42" data-anim="p3fig">
      <svg viewBox="0 0 620 420" width="620" height="420" aria-hidden="true">
        <line x1="20" y1="330" x2="600" y2="330" stroke="#123322" stroke-width="7"/>
        <rect x="30" y="218" width="196" height="64" fill="#123322"/>
        <rect x="74" y="176" width="106" height="46" fill="#2F7A46"/>
        <circle cx="80" cy="300" r="30" fill="#DCEBD8" stroke="#123322" stroke-width="12"/>
        <circle cx="176" cy="300" r="30" fill="#DCEBD8" stroke="#123322" stroke-width="12"/>
        <line x1="272" y1="250" x2="452" y2="250" stroke="#2F7A46" stroke-width="10" stroke-dasharray="30 22"/>
        <line x1="488" y1="250" x2="544" y2="250" stroke="#2F7A46" stroke-width="10" stroke-dasharray="14 16"/>
        <rect x="576" y="196" width="12" height="112" fill="#123322"/>
        <text x="30" y="72" fill="#123322" font-family="Noto Sans SC,Microsoft YaHei"
          font-size="36" font-weight="700">运动 → 阻力 → 停下</text>
        <text x="30" y="128" fill="#3F6B4E" font-family="Noto Sans SC,Microsoft YaHei"
          font-size="27">阻力改变了它的运动状态</text>
      </svg>
    </div>
  </div>
""" + foot(3, "情境导入"))

# P4 历史回顾
PAGES[4] = ("P04 · 历史回顾", head("历史回顾", 4) + """
  <h2 class="h2 sm">两千年来，我们对「力与运动」的理解走过怎样的弯路？</h2>
  <div class="body">
    <div class="vs">
      <div class="c old" data-anim="p4old">
        <div class="top"></div>
        <div class="who">亚里士多德（前 384 – 前 322）</div>
        <div class="id"><div class="badge">A</div>
          <div><div class="q">亚里士多德</div><div class="qm mono">前 384–前 322</div></div></div>
        <div class="q">观点：「力是<b>维持</b>物体运动的原因」</div>
        <div class="qm">这一看法统治了近两千年</div>
      </div>
      <div class="c new" data-anim="p4new">
        <div class="top"></div>
        <div class="who">伽利略（1564 – 1642）</div>
        <div class="id"><div class="badge">G</div>
          <div><div class="q">伽利略</div><div class="qm mono">1564–1642</div></div></div>
        <div class="q">质疑：物体的运动<b>不需要力</b>来维持</div>
        <div class="qm">用实验与推理挑战权威</div>
      </div>
    </div>
  </div>
  <div class="note" data-anim="p4note" style="margin-top:26px">科学发展是曲折的：从「权威结论」到「实验与推理」，真理往往要经历漫长的质疑与验证。</div>
""" + foot(4, "历史回顾"))

# P5 实验方案
PAGES[5] = ("P05 · 实验探究（一）方案设计", head("实验探究（一）· 方案设计", 5) + """
  <h2 class="h2 sm">怎样用实验研究「阻力对物体运动的影响」？</h2>
  <div class="body">
    <div class="c58">
      <div class="pairs">
        <div class="pair" data-anim="p5m1"><div class="lab">实 验 器 材</div>
          <div class="txt">斜面、小车<small>三种水平面：毛巾 · 棉布 · 木板</small></div></div>
        <div class="pair" data-anim="p5m2"><div class="lab">实 验 原 理</div>
          <div class="txt">比较滑行距离<small>让小车在不同粗糙程度的水平面上滑行</small></div></div>
        <div class="pair" data-anim="p5m3"><div class="lab">操 作 步 骤</div>
          <div class="txt">同一高度、由静止下滑</div></div>
        <div class="pair" data-anim="p5m4"><div class="lab">数 据 记 录</div>
          <div class="txt">表面 → 阻力 → 距离</div></div>
      </div>
      <div class="band" data-anim="p5ctrl">
        <div class="k">控 制 变 量</div>
        <div class="v">同一小车 · 同一斜面 · 同一高度 → 到达水平面时<em class="e">初速度相同</em></div>
      </div>
    </div>
    <div class="c42">
      <div class="rig" style="height:560px">
        <!-- 斜面：整块淡入 -->
        <svg class="piece" data-anim="p5ramp" style="left:0;top:40px;width:300px;height:300px"
             viewBox="0 0 300 300" aria-hidden="true">
          <polygon points="20,24 20,268 288,268" fill="none" stroke="#123322" stroke-width="8"/>
        </svg>
        <!-- 小车：独立一件，从坡顶就位 -->
        <svg class="piece" data-anim="p5car" style="left:52px;top:38px;width:150px;height:70px"
             viewBox="0 0 150 70" aria-hidden="true">
          <rect x="0" y="16" width="118" height="30" fill="#2F7A46"/>
          <circle cx="22" cy="54" r="14" fill="#DCEBD8" stroke="#123322" stroke-width="7"/>
          <circle cx="96" cy="54" r="14" fill="#DCEBD8" stroke="#123322" stroke-width="7"/>
        </svg>
        <div class="piece lbl"  data-anim="p5ramp" style="left:196px;top:6px">同一高度释放</div>
        <div class="piece axis" data-anim="p5ramp" style="left:20px;top:304px;width:640px"></div>
        <!-- 三种水平面：一条一条出现 -->
        <div class="piece lbl"     data-anim="p5s1" style="left:0;top:344px">毛巾</div>
        <div class="piece surf s1" data-anim="p5s1" style="left:0;top:384px;width:150px"></div>
        <div class="piece lbl"     data-anim="p5s2" style="left:180px;top:344px">棉布</div>
        <div class="piece surf s2" data-anim="p5s2" style="left:180px;top:384px;width:150px"></div>
        <div class="piece lbl"     data-anim="p5s3" style="left:360px;top:344px">木板</div>
        <div class="piece surf s3" data-anim="p5s3" style="left:360px;top:384px;width:150px"></div>
        <div class="piece" data-anim="p5note" style="left:0;top:470px;font-size:30px;font-weight:700;color:var(--ink)">
          只改变一个变量 —— 表面粗糙程度</div>
      </div>
    </div>
  </div>
""" + foot(5, "实验探究 · 一"))

# P6 现象与数据
PAGES[6] = ("P06 · 实验探究（二）现象与数据", head("实验探究（二）· 现象与数据", 6) + """
  <h2 class="h2 sm">水平面越光滑，小车会滑得越远吗？</h2>
  <div class="body">
    <div class="c58">
      <div style="width:100%">
        <div class="trow" data-anim="p6h">
          <div class="th">表 面</div><div class="th">阻力大小</div>
          <div class="th">滑行距离</div><div class="th">速度减小快慢</div>
        </div>
        <div class="trow" data-anim="p6r1">
          <div class="tc">毛巾</div><div class="tc dim">大</div><div class="tc dim">短</div><div class="tc dim">快</div>
          <div class="rowline"></div>
        </div>
        <div class="trow" data-anim="p6r2">
          <div class="tc">棉布</div><div class="tc dim">较大</div><div class="tc dim">较长</div><div class="tc dim">较慢</div>
          <div class="rowline"></div>
        </div>
        <div class="trow" data-anim="p6r3">
          <div class="tc">木板</div><div class="tc dim">小</div><div class="tc dim">长</div><div class="tc dim">慢</div>
          <div class="rowline"></div>
        </div>
      </div>
      <div class="band" data-anim="p6c">
        <div class="k">结 论</div>
        <div class="v">表面越光滑 → 阻力越小 → 滑行越远 → 速度减小得<em class="e">越慢</em></div>
      </div>
    </div>
    <div class="c42">
      <div class="rig" style="height:460px">
        <div class="piece lbl"    data-anim="p6b1" style="left:0;top:0">毛巾（阻力大）</div>
        <div class="piece bar b1" data-anim="p6b1" style="left:0;top:44px;width:130px"></div>
        <div class="piece lbl"    data-anim="p6b2" style="left:0;top:126px">棉布（阻力较大）</div>
        <div class="piece bar"    data-anim="p6b2" style="left:0;top:170px;width:250px"></div>
        <div class="piece lbl"    data-anim="p6b3" style="left:0;top:252px">木板（阻力小）</div>
        <div class="piece bar"    data-anim="p6b3" style="left:0;top:296px;width:390px"></div>
        <div class="piece axis"   style="left:0;top:376px;width:540px"></div>
        <div class="piece lbl"    style="left:0;top:398px">滑行距离 →</div>
      </div>
    </div>
  </div>
""" + foot(6, "实验探究 · 二"))

# P7 理想实验法
PAGES[7] = ("P07 · 科学推理 · 理想实验法", head("科学推理 · 理想实验法", 7) + """
  <h2 class="h2 sm">如果水平面绝对光滑，小车会永远运动下去吗？</h2>
  <div class="body" style="flex-direction:column;gap:0">
    <div class="rig" style="height:440px">
      <!-- 毛巾 -->
      <div class="piece lbl"    data-anim="p7a" style="left:0;top:42px">毛巾：阻力大</div>
      <div class="piece carblk" data-anim="p7a" style="left:300px;top:40px"></div>
      <div class="piece trk"    data-anim="p7a" style="left:364px;top:53px;width:200px"></div>
      <div class="piece tick"   data-anim="p7a" style="left:562px;top:18px;height:70px"></div>
      <!-- 棉布 -->
      <div class="piece lbl"    data-anim="p7b" style="left:0;top:142px">棉布：阻力较大</div>
      <div class="piece carblk" data-anim="p7b" style="left:300px;top:140px"></div>
      <div class="piece trk"    data-anim="p7b" style="left:364px;top:153px;width:340px"></div>
      <div class="piece tick"   data-anim="p7b" style="left:702px;top:118px;height:70px"></div>
      <!-- 木板 -->
      <div class="piece lbl"    data-anim="p7c" style="left:0;top:242px">木板：阻力小</div>
      <div class="piece carblk" data-anim="p7c" style="left:300px;top:240px"></div>
      <div class="piece trk"    data-anim="p7c" style="left:364px;top:253px;width:500px"></div>
      <div class="piece tick"   data-anim="p7c" style="left:862px;top:218px;height:70px"></div>
      <!-- 绝对光滑：虚线轨道一路延伸 -->
      <div class="piece lbl"      data-anim="p7d" style="left:0;top:342px">绝对光滑：阻力为零</div>
      <div class="piece carblk a" data-anim="p7d" style="left:300px;top:340px"></div>
      <div class="piece trk dash" data-anim="p7d" style="left:364px;top:353px;width:1326px"></div>
      <div class="piece anno"     data-anim="p7e" style="left:1120px;top:246px">速度不变 → 永远运动下去</div>
    </div>
    <div class="band" data-anim="p7band" style="margin-top:26px">
      <div class="k">理 想 实 验 法</div>
      <div class="v">在实验基础上推理极端情况：表面越光滑 → 阻力越小 → 滑得越远；若阻力为零，物体将永远匀速运动下去。</div>
    </div>
  </div>
""" + foot(7, "科学推理"))

# P8 定律内容
PAGES[8] = ("P08 · 定律内容", head("定律内容", 8) + """
  <h2 class="h2 sm">牛顿第一定律究竟是怎么说的？</h2>
  <div class="body" style="flex-direction:column;gap:0">
    <div class="hair" style="background:#123322;flex:none"></div>
    <div class="big" data-anim="p8law" style="margin-top:52px;font-size:76px;line-height:1.5;max-width:1560px">
      <em class="e">「一切物体」</em>在没有<em class="e">受到力的作用</em>时，<em class="e">总保持</em>静止状态<em class="e">或</em>匀速直线运动状态。
    </div>
    <div class="quad" style="margin-top:auto;gap:30px 60px">
      <div class="cell" data-anim="p8k1" style="border-top-width:4px"><div class="tag">0 1</div>
        <div class="h" style="font-size:38px;font-weight:700">「一切物体」——普遍适用，没有例外</div></div>
      <div class="cell" data-anim="p8k2" style="border-top-width:4px"><div class="tag">0 2</div>
        <div class="h" style="font-size:38px;font-weight:700">「没有受到力的作用」——成立条件</div></div>
      <div class="cell" data-anim="p8k3" style="border-top-width:4px"><div class="tag">0 3</div>
        <div class="h" style="font-size:38px;font-weight:700">「总保持」——必然结果</div></div>
      <div class="cell" data-anim="p8k4" style="border-top-width:4px"><div class="tag">0 4</div>
        <div class="h" style="font-size:38px;font-weight:700">「或」——两种状态居其一</div></div>
    </div>
  </div>
""" + foot(8, "定律内容"))

# P9 概念深化
PAGES[9] = ("P09 · 概念深化", head("概念深化", 9) + """
  <h2 class="h2 sm">力，到底是维持运动还是改变运动？</h2>
  <div class="body">
    <div class="c58">
      <div class="big">力不是维持物体运动的原因，<br>而是<strong class="k">改变物体运动状态</strong>的原因。</div>
      <div class="eq" style="margin-top:34px">运动状态的改变 ＝ 速度大小改变　或　运动方向改变</div>
      <div class="band">
        <div class="k">注 意</div>
        <div class="v">牛顿第一定律是在实验基础上通过推理概括得出，<em class="e">不能用实验直接验证</em>。</div>
      </div>
    </div>
    <div class="c42">
      <svg viewBox="0 0 600 560" width="600" height="560" aria-hidden="true">
        <text x="0" y="34" fill="#3F6B4E" font-family="Noto Sans SC,Microsoft YaHei" font-size="30"
          font-weight="700">① 速度大小改变</text>
        <line x1="0" y1="120" x2="190" y2="120" stroke="#2F7A46" stroke-width="12" stroke-linecap="square"/>
        <line x1="0" y1="120" x2="430" y2="120" stroke="#123322" stroke-width="12" stroke-linecap="square"/>
        <text x="450" y="132" fill="#123322" font-family="Noto Sans SC,Microsoft YaHei" font-size="30">变快</text>
        <line x1="0" y1="236" x2="430" y2="236" stroke="#123322" stroke-width="12" stroke-linecap="square"/>
        <line x1="0" y1="236" x2="150" y2="236" stroke="#2F7A46" stroke-width="12" stroke-linecap="square"/>
        <text x="450" y="248" fill="#123322" font-family="Noto Sans SC,Microsoft YaHei" font-size="30">变慢</text>
        <text x="0" y="358" fill="#3F6B4E" font-family="Noto Sans SC,Microsoft YaHei" font-size="30"
          font-weight="700">② 运动方向改变</text>
        <polyline points="0,520 240,520 240,420 560,420" fill="none" stroke="#123322" stroke-width="12"/>
        <text x="330" y="500" fill="#123322" font-family="Noto Sans SC,Microsoft YaHei" font-size="30">转弯</text>
      </svg>
    </div>
  </div>
""" + foot(9, "概念深化"))

# P10 惯性概念
PAGES[10] = ("P10 · 惯性概念", head("惯性概念", 10) + """
  <h2 class="h2 sm">什么是惯性？它和什么有关？</h2>
  <div class="body" style="flex-direction:column;gap:0">
    <div class="big" style="font-size:60px;max-width:1560px">
      <em class="e">一切物体</em>都有保持原来运动状态不变的性质，叫<strong class="k">惯性</strong>。
    </div>
    <div class="list" style="margin-top:34px">
      <div class="li" style="gap:20px"><div class="n" style="flex:0 0 40px;font-size:34px">—</div>
        <div class="x" style="font-size:32px;font-weight:500">惯性是物体的固有属性：一切物体、任何情况下都有惯性</div></div>
      <div class="li" style="gap:20px"><div class="n" style="flex:0 0 40px;font-size:34px">—</div>
        <div class="x" style="font-size:32px;font-weight:500">惯性大小<strong class="k">只与质量有关</strong>，与速度、是否受力无关</div></div>
    </div>
    <div class="quad" style="margin-top:auto">
      <div class="cell"><div class="tag">0 1</div><div class="h" style="font-size:44px">汽车急刹车人前倾</div></div>
      <div class="cell"><div class="tag">0 2</div><div class="h" style="font-size:44px">拍打衣服除尘</div></div>
      <div class="cell"><div class="tag">0 3</div><div class="h" style="font-size:44px">跳远助跑</div></div>
      <div class="cell"><div class="tag">0 4</div><div class="h" style="font-size:44px">锤头松了撞锤柄</div></div>
    </div>
  </div>
""" + foot(10, "惯性概念"))

# P11 方法示范
PAGES[11] = ("P11 · 方法示范", head("方法示范", 11) + """
  <h2 class="h2 sm">怎样用惯性解释生活中的现象？</h2>
  <div class="body">
    <div class="c58">
      <div class="rows">
        <div class="row tight"><div class="n">1</div><div><div class="t">确定研究对象</div></div></div>
        <div class="row tight"><div class="n">2</div><div><div class="t">研究对象原来的运动状态</div></div></div>
        <div class="row tight"><div class="n">3</div><div><div class="t">哪个部分受力，运动状态先改变</div></div></div>
        <div class="row tight"><div class="n">4</div><div><div class="t">另一部分由于惯性，保持原来的运动状态</div></div></div>
      </div>
    </div>
    <div class="c42">
      <svg viewBox="0 0 600 520" width="600" height="520" aria-hidden="true">
        <line x1="20" y1="420" x2="580" y2="420" stroke="#123322" stroke-width="7"/>
        <rect x="140" y="300" width="300" height="86" fill="#123322"/>
        <circle cx="206" cy="396" r="28" fill="#DCEBD8" stroke="#123322" stroke-width="12"/>
        <circle cx="374" cy="396" r="28" fill="#DCEBD8" stroke="#123322" stroke-width="12"/>
        <polygon points="290,300 366,296 372,180 296,184" fill="#2F7A46"/>
        <circle cx="330" cy="150" r="32" fill="#2F7A46"/>
        <line x1="330" y1="150" x2="440" y2="96" stroke="#2F7A46" stroke-width="11" stroke-dasharray="22 16"/>
        <polygon points="474,82 428,78 440,118" fill="#2F7A46"/>
        <text x="440" y="200" fill="#3F6B4E" font-family="Noto Sans SC,Microsoft YaHei" font-size="28">上身继续向前</text>
        <text x="140" y="486" fill="#3F6B4E" font-family="Noto Sans SC,Microsoft YaHei" font-size="28">脚受力随车停</text>
      </svg>
    </div>
  </div>
  <div class="band" style="margin-top:26px">
    <div class="k">示 范</div>
    <div class="v">汽车急刹车，人原来随车向前 → 脚受力停下 → <em class="e">上身由于惯性保持向前</em> → 前倾。</div>
  </div>
""" + foot(11, "方法示范"))

# P12 易错辨析
PAGES[12] = ("P12 · 易错辨析", head("易错辨析", 12) + """
  <h2 class="h2 sm">关于惯性，这三个说法错在哪里？</h2>
  <div class="body">
    <div class="c58">
      <div class="list" style="gap:30px">
        <div class="li" data-anim="p12e1"><div class="n">①</div><div class="x">惯性不是力
          <small>不能说「惯性力」「受到惯性作用」，应说「具有惯性」「由于惯性」</small></div></div>
        <div class="li" data-anim="p12e2"><div class="n">②</div><div class="x">速度大的物体惯性不一定大
          <small>惯性只与质量有关</small></div></div>
        <div class="li" data-anim="p12e3"><div class="n">③</div><div class="x">静止的物体也有惯性</div></div>
      </div>
    </div>
    <div class="c42">
      <div class="band" data-anim="p12q" style="margin-top:0;padding:34px 40px">
        <div class="k">随 堂 判 断</div>
        <div class="v" style="font-size:34px;margin-bottom:20px">下列说法正确的是（　）</div>
        <div class="opts">
          <div>A. 速度越大惯性越大</div>
          <div>B. 静止的物体没有惯性</div>
          <div>C. 物体具有惯性</div>
          <div>D. 惯性是一种力</div>
        </div>
        <div class="answer" style="margin-top:26px">答案：C</div>
      </div>
      <div style="margin-top:22px"><div class="btn">▶ 点击显示答案</div></div>
    </div>
  </div>
""" + foot(12, "易错辨析"))

# P13 课堂小结
PAGES[13] = ("P13 · 课堂小结", head("课堂小结", 13) + """
  <h2 class="h2 sm">一节课，我们收获了哪「四个一」？</h2>
  <div class="body">
    <div class="quad" style="gap:52px 70px;align-content:center">
      <div class="cell"><div class="tag">一 个 定 律</div>
        <div class="h">牛顿第一定律</div>
        <div class="d">一切物体在没有受力时，总保持静止或匀速直线运动状态</div></div>
      <div class="cell"><div class="tag">一 种 方 法</div>
        <div class="h">理想实验法</div>
        <div class="d">在实验基础上推理极端情况 —— 实验 + 推理</div></div>
      <div class="cell"><div class="tag">一 个 概 念</div>
        <div class="h">惯性</div>
        <div class="d">物体保持原运动状态不变的性质，大小只与质量有关</div></div>
      <div class="cell"><div class="tag">一 个 关 系</div>
        <div class="h">力与运动</div>
        <div class="d">力不是维持运动的原因，而是改变运动状态的原因</div></div>
    </div>
  </div>
  <div class="note" style="margin-top:24px">回到核心问题：运动的物体停下，不是因为没有了「维持的力」，而是因为受到了阻力，改变了运动状态。</div>
""" + foot(13, "课堂小结"))

# P14 作业与结束
PAGES[14] = ("P14 · 作业与结束", head("作业与结束", 14) + """
  <h2 class="h2 sm">今天，你准备好用「惯性」解释世界了吗？</h2>
  <div class="body">
    <div class="c58">
      <div class="pair" style="margin-bottom:38px"><div class="lab">基 础 题 · 2 道</div>
        <div class="txt">① 举出两个生活中利用惯性的例子
          <small>② 用「四步法」解释「汽车急刹车乘客前倾」</small></div></div>
      <div class="pair"><div class="lab">提 高 题 · 1 道</div>
        <div class="txt">为什么跳远运动员助跑越快，跳得越远？<small>从惯性角度思考</small></div></div>
    </div>
    <div class="c42" style="justify-content:center">
      <div class="big" style="font-size:112px;line-height:1.2">谢谢聆听<br><span style="color:var(--accent)">敬请指正</span></div>
    </div>
  </div>
""" + foot(14, "作业与结束"))


def main(root):
    os.makedirs(os.path.join(root, "slides"), exist_ok=True)
    with open(os.path.join(root, "style-a.css"), "w", encoding="utf-8") as f:
        f.write(CSS)
    for n, (title, body) in PAGES.items():
        # P1 自带 <style>+<section>，其余由 wrap 包裹
        if n == 1:
            html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="../style-a.css">
</head>
<body>
{body}
</body>
</html>
"""
        else:
            html = wrap(title, body, n, "")
        with open(os.path.join(root, "slides", f"page{n:02d}.html"), "w", encoding="utf-8") as f:
            f.write(html)
    # 概览墙
    cells = "\n".join(
        f'    <a class="cell" href="slides/page{i:02d}.html" target="stage"><span class="no">{i:02d}</span>'
        f'<iframe src="slides/page{i:02d}.html" loading="eager"></iframe></a>' for i in range(1, 15))
    idx = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>牛顿第一定律 · 浅绿字体当图 · 14 页</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:#8FA98F;font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;padding:40px 40px 80px}}
  h1{{font-size:30px;font-weight:800;color:#123322;letter-spacing:.04em;margin-bottom:8px}}
  p{{font-size:18px;color:#20402F;margin-bottom:28px}}
  .wall{{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}}
  .cell{{position:relative;display:block;background:#000;aspect-ratio:16/9;overflow:hidden;
    outline:2px solid rgba(18,51,34,.35)}}
  .cell iframe{{width:1920px;height:1080px;border:0;transform:scale(calc(1/3));transform-origin:top left;
    pointer-events:none}}
  .cell .no{{position:absolute;right:10px;top:8px;z-index:2;color:#DCEBD8;font-size:15px;
    font-family:Consolas,monospace;background:rgba(18,51,34,.75);padding:2px 8px}}
</style></head>
<body>
<h1>牛顿第一定律 · 浅绿 · 字体当图</h1>
<p>方向 A（用户选定）· 14 页 · 每页 1920×1080 —— 点击任意一页在新标签打开</p>
<div class="wall">
{cells}
</div>
</body></html>
"""
    with open(os.path.join(root, "index.html"), "w", encoding="utf-8") as f:
        f.write(idx)
    print(f"generated -> {root} (style-a.css + slides/page01..14.html + index.html)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "deck-a")
