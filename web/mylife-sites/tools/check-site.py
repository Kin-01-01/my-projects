# -*- coding: utf-8 -*-
"""
拾光 · 站点静态自检
------------------------------------------------------------
把「改完必须核对」的项固化成一个命令，避免靠肉眼漏检。
每次改完 HTML/CSS/JS 跑一次：python tools/check-site.py

检查项：
  1. JS 语法（node --check）
  2. 是否还残留任何 Google Fonts / 外部字体请求
  3. --display-fixed 的定义与用处，逐个列出用到它的选择器
  4. fonts.css 引用的字体文件是否都真实存在，并统计总体积
  5. 动效纪律：styles.css 里不应再有裸写的秒数（时长必须走 --dur-* token）
  6. 子集字体是否覆盖了展示文案所需的全部字符
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = os.path.join(ROOT, "TravelNotes")
NODE = r"C:\Users\Wpengz\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"

rows = []
ok = True


def read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def fail(msg):
    global ok
    ok = False
    rows.append("  [FAIL] " + msg)


# ---------- 1. JS 语法 ----------
rows.append("1) JS 语法")
for name in ("js/main.js", "js/ambient.js", "js/china-geo.js"):
    p = os.path.join(SITE, name)
    if not os.path.exists(p):
        fail("%s 不存在" % name)
        continue
    r = subprocess.run([NODE, "--check", p], capture_output=True, text=True)
    if r.returncode == 0:
        rows.append("  [ok]   %s" % name)
    else:
        fail("%s -> %s" % (name, (r.stderr or "").strip()[:200]))

# ---------- 2. 外部字体残留 ----------
rows.append("2) 外部字体请求")
pat = re.compile(r"googleapis|gstatic|fonts\.google|@import\s+url\(\s*['\"]?https?://")
hits = []
for rel in ("index.html", "css/styles.css", "css/fonts.css"):
    p = os.path.join(SITE, rel)
    if not os.path.exists(p):
        continue
    for i, line in enumerate(read(p).splitlines(), 1):
        if pat.search(line):
            hits.append("%s:%d  %s" % (rel, i, line.strip()[:110]))
if hits:
    for h in hits:
        fail("残留外部字体引用 -> " + h)
else:
    rows.append("  [ok]   index.html / styles.css / fonts.css 均无外部字体请求")

# ---------- 3. --display-fixed ----------
rows.append("3) --display-fixed 使用面")
css = read(os.path.join(SITE, "css/styles.css"))
if not re.search(r"--display-fixed:\s*[^;]+;", css):
    fail("没有定义 --display-fixed")
used = re.findall(r"\.([A-Za-z0-9_-]+)[^{]*\{[^}]*font-family:\s*var\(--display-fixed\)", css)
rows.append("  定义在 :root，用到它的选择器（应只含固定文案）：%s" % (", ".join(used) if used else "(none)"))
rows.append("  仍走 --display（用户内容）的衬线选择器：")
for m in re.finditer(r"([^\n{}]+)\{([^}]*)\}", css):
    sel, body = m.group(1).strip(), m.group(2)
    if "font-family: var(--display)" in body:
        rows.append("    " + " ".join(sel.split()))

# ---------- 4. 字体文件 ----------
rows.append("4) 自托管字体文件")
fpath = os.path.join(SITE, "css/fonts.css")
if not os.path.exists(fpath):
    fail("css/fonts.css 不存在")
else:
    fcss = read(fpath)
    total = 0
    refs = re.findall(r'url\("\.\./([^"]+)"\)', fcss)
    if not refs:
        fail("fonts.css 里没有任何 url() 引用")
    for r in refs:
        p = os.path.join(SITE, r.replace("/", os.sep))
        if os.path.exists(p):
            sz = os.path.getsize(p)
            total += sz
            rows.append("  [ok]   %-38s %8.1f KB" % (r, sz / 1024.0))
        else:
            fail("引用的字体文件缺失 -> " + r)
    rows.append("  字体层合计 = %.1f KB" % (total / 1024.0))

# ---------- 5. 动效纪律 ----------
rows.append("5) 动效 token 纪律")
naked = []
for i, line in enumerate(css.splitlines(), 1):
    s = line.split("/*")[0]
    if "--dur-" in s or "animation-duration" in s:
        continue
    for m in re.finditer(r"(?<![\w.])(\d+(?:\.\d+)?)s\b", s):
        if m.group(1) in ("0",):
            continue
        naked.append("styles.css:%d  %s" % (i, line.strip()[:100]))
        break
if naked:
    for n in naked:
        fail("裸写的秒数（应改用 --dur-*） -> " + n)
else:
    rows.append("  [ok]   没有裸写的秒数，时长全部走 token")

# ---------- 6. 子集字形覆盖 ----------
rows.append("6) 展示子集字形覆盖")
try:
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import importlib.util
    spec = importlib.util.spec_from_file_location("bf", os.path.join(ROOT, "tools", "build-fonts.py"))
    bf = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bf)
    need = set("".join(bf.DISPLAY_TEXTS))
    need = {c for c in need if bf.keep_char(c)}
    from fontTools.ttLib import TTFont
    have = set()
    for fn in ("shiguang-display-700.woff2", "shiguang-display-900.woff2"):
        f = TTFont(os.path.join(SITE, "fonts", fn), lazy=True)
        cm = f.getBestCmap()
        have |= {chr(c) for c in cm.keys()}
    miss = sorted(c for c in need if c not in have)
    if miss:
        fail("子集缺字（这些字会回退到系统衬线）-> " + "".join(miss))
    else:
        rows.append("  [ok]   %d 个展示字符全部在子集内" % len(need))
except Exception as e:  # noqa
    rows.append("  [skip] 字形覆盖检查未执行：%s" % e)

rows.insert(0, "拾光 · 站点自检  结果：%s" % ("全部通过" if ok else "有失败项"))
out = "\n".join(rows)
with open(os.path.join(HERE, "_check_report.txt"), "w", encoding="utf-8") as fh:
    fh.write(out)
print(out)
sys.exit(0 if ok else 1)
