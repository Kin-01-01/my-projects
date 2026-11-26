# -*- coding: utf-8 -*-
"""
拾光 · 字体本地化构建脚本
------------------------------------------------------------
把站点对 fonts.googleapis.com 的运行时依赖，改成构建期一次性抓取 + 本地自托管。

产物：
  TravelNotes/fonts/oswald-latin.woff2              拉丁展示体（标签/数字/坐标用）
  TravelNotes/fonts/shiguang-display-700.woff2      固定中文标题（衬线，子集）
  TravelNotes/fonts/shiguang-display-900.woff2      固定中文标题（衬线，子集）
  TravelNotes/css/fonts.css                         对应的 @font-face 声明

设计取舍：
  - 拉丁（Oswald）体积极小，全量自托管，保住全站「大写 + 宽字距」的识别度。
  - 中文正文（Noto Sans/Serif SC）单字重即 4.4–5.9 MB，全量自托管不可接受，
    改为交给操作系统（PingFang / 微软雅黑 / 宋体），这是中文站的标准做法。
  - 只有「固定的编辑文案」（首屏巨字、六个栏目名、品牌字）用子集自托管，
    因为它们在 52–340px 上，回退字体的排印落差会被放大到肉眼可见。
  - 子集只作用于固定字符串选择器，用户自己写的标题不走子集——
    避免同一行里「有的字来自子集、有的字来自回退」的混排事故。

用法：python build-fonts.py [--display-only]
"""
import os, re, ssl, sys, json, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = os.path.join(ROOT, "TravelNotes")
FONTS = os.path.join(SITE, "fonts")
CSSDIR = os.path.join(SITE, "css")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# —— 只有这些固定字符串会用到展示子集；改文案务必同步这里 ——
DISPLAY_TEXTS = [
    "拾光·",                 # 首屏巨字 / 导航品牌 / 页脚落款
    "年度回看", "关于这趟路", "足迹地图",
    "写一则旅途", "旅途归档", "照片墙",
    "0123456789",            # 首屏计数、时间轴月份：数字全部由应用生成，可穷举
    "月",                    # monthLabel() 的「月」
]

# 中文标点与全角符号也算「要覆盖的字」
CJK_RANGES = [
    (0x3000, 0x303F),   # CJK 符号与标点
    (0x3400, 0x4DBF),   # 扩展 A
    (0x4E00, 0x9FFF),   # 基本区
    (0xFF00, 0xFFEF),   # 全角形式
]
EXTRA_PUNCT = "·—…“”‘’"    # 拉丁区但中文排版会用到的几个
# 展示子集里一并保留的拉丁字符：这些位点全部由应用生成，不会随用户输入变化。
# （首屏计数、时间轴月份里的数字；月份 "3 月" 中间那个空格）
LATIN_KEEP = "0123456789.: "


def keep_char(ch):
    o = ord(ch)
    if ch in EXTRA_PUNCT or ch in LATIN_KEEP:
        return True
    for a, b in CJK_RANGES:
        if a <= o <= b:
            return True
    return False


def fetch(url, ua=UA):
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
        return r.read()


def unique_chars(s):
    out = []
    seen = set()
    for ch in s:
        if ch in seen or not keep_char(ch):
            continue
        seen.add(ch)
        out.append(ch)
    return out


def collect_display_chars(whole_html=False):
    """整体扫描 index.html，收紧到子集时只用固定文案。"""
    path = os.path.join(SITE, "index.html")
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    if whole_html:
        src = html
    else:
        src = "".join(DISPLAY_TEXTS)
    # 顺带把 CSS 里 content:"..." 的中文也带上
    css = os.path.join(CSSDIR, "styles.css")
    if os.path.exists(css):
        with open(css, encoding="utf-8") as fh:
            src += "".join(re.findall(r'content:\s*"([^"]*)"', fh.read()))
    return unique_chars(src)


def build():
    os.makedirs(FONTS, exist_ok=True)

    wide = collect_display_chars(whole_html=True)
    tight = collect_display_chars(whole_html=False)
    sys.stderr.write("chars: tight=%d  whole-html=%d\n" % (len(tight), len(wide)))

    manifest = []

    # ---------- 1. Oswald：只取 latin 一份 ----------
    css = fetch("https://fonts.googleapis.com/css2"
                "?family=Oswald:wght@300;400;500;600;700&display=swap").decode("utf-8")
    blocks = re.findall(r"@font-face\s*\{(.*?)\}", css, re.S)
    latin_url = latin_range = None
    for b in blocks:
        u = re.search(r"src:\s*url\((https://[^)]+)\)", b)
        r = re.search(r"unicode-range:\s*([^;]+);", b)
        if u and r and r.group(1).strip().startswith("U+0000-00FF"):
            latin_url, latin_range = u.group(1), r.group(1).strip()
            break
    if not latin_url:
        raise SystemExit("没找到 Oswald 的 latin 子集")
    data = fetch(latin_url)
    with open(os.path.join(FONTS, "oswald-latin.woff2"), "wb") as fh:
        fh.write(data)
    manifest.append(("Oswald", "oswald-latin.woff2", len(data), latin_range))

    # ---------- 2. 中文展示子集：700 / 900 ----------
    text = urllib.parse.quote("".join(tight))
    for w in (700, 900):
        url = ("https://fonts.googleapis.com/css2"
               "?family=Noto+Serif+SC:wght@%d&display=swap&text=%s" % (w, text))
        sub_css = fetch(url).decode("utf-8")
        m = re.search(r"src:\s*url\((https://[^)]+)\)", sub_css)
        if not m:
            raise SystemExit("权重 %d 没拿到子集 URL" % w)
        blob = fetch(m.group(1))
        fn = "shiguang-display-%d.woff2" % w
        with open(os.path.join(FONTS, fn), "wb") as fh:
            fh.write(blob)
        manifest.append(("Noto Serif SC Display", fn, len(blob), ""))

    # ---------- 3. 生成 css/fonts.css ----------
    lines = [
        "/* ============================================================",
        "   拾光 · 字体层（全部本地自托管，零外部请求）",
        "",
        "   生成方式：tools/build-fonts.py，请勿手改。",
        "   - Oswald：拉丁展示体，全量 latin 子集。",
        "   - Noto Serif SC Display：仅固定编辑文案的中文子集（700/900），",
        "     只允许挂在首屏巨字 / 栏目名 / 品牌字上。",
        "   - 中文正文交给系统字体，见 styles.css 里的 --display / --sans。",
        "   ============================================================ */",
        "",
    ]
    for fam, fn, size, rng in manifest:
        if fam == "Oswald":
            lines.append('@font-face {')
            lines.append('  font-family: "Oswald";')
            lines.append('  font-style: normal;')
            lines.append('  font-weight: 300 700;        /* 可变字重，一份文件覆盖全部档位 */')
            lines.append('  font-display: swap;')
            lines.append('  src: url("../fonts/%s") format("woff2");' % fn)
            lines.append('  unicode-range: %s;' % rng)
            lines.append('}')
        else:
            w = int(re.search(r"-(\d+)\.woff2", fn).group(1))
            lines.append('@font-face {')
            lines.append('  font-family: "Noto Serif SC Display";')
            lines.append('  font-style: normal;')
            lines.append('  font-weight: %d;' % w)
            lines.append('  font-display: swap;')
            lines.append('  src: url("../fonts/%s") format("woff2");' % fn)
            lines.append('}')
        lines.append("")

    out_css = os.path.join(CSSDIR, "fonts.css")
    with open(out_css, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines))

    total = sum(m[2] for m in manifest)
    lines_txt = ["=== self-hosted fonts ==="]
    for fam, fn, size, rng in manifest:
        lines_txt.append("%-26s %-32s %8.1f KB" % (fam, fn, size / 1024.0))
    lines_txt.append("")
    lines_txt.append("TOTAL = %.1f KB" % (total / 1024.0))
    lines_txt.append("display subset chars = %d  (%s)" % (len(tight), "".join(tight)))
    lines_txt.append("whole-html chars     = %d" % len(wide))
    with open(os.path.join(HERE, "_build_report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines_txt))


if __name__ == "__main__":
    build()
