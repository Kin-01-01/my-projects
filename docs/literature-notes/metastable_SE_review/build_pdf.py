import subprocess, re, os

BASE = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review"
PANDOC = r"D:\已安装软件\Anaconda3\Library\bin\pandoc.exe"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HEAD = os.path.join(BASE, "style_head.html")
PDF_ENGINE = True

def build(md_name, html_name, pdf_name):
    md = os.path.join(BASE, md_name)
    html = os.path.join(BASE, html_name)
    pdf = os.path.join(BASE, pdf_name)
    # md -> html standalone with embedded css header
    subprocess.run([PANDOC, md, "-s", "--from=markdown", "--to=html5",
                    "-H", HEAD, "-o", html], check=True)
    # post-process: wrap reference paragraphs in <div class="ref">
    with open(html, encoding="utf-8") as f:
        s = f.read()
    # references section begins at the h2 containing 参考文献 or References
    m = re.search(r'(<h2[^>]*id="[^"]*(?:参考文献|References)[^"]*">.*?</h2>)', s, re.S)
    if m:
        start = s.index(m.group(1)) + len(m.group(1))
        # wrap subsequent top-level <p> until next <h2 or end
        tail = s[start:]
        # split into segments at <h2
        parts = re.split(r'(<h2)', tail)
        newtail = parts[0]
        # wrap each <p>...</p> in ref div
        newtail = re.sub(r'<p>(.*?)</p>', r'<div class="ref">\1</div>', newtail, flags=re.S)
        # reattach
        rebuilt = s[:start] + newtail
        for i in range(1, len(parts)):
            rebuilt += "<h2" + parts[i]
        s = rebuilt
        with open(html, "w", encoding="utf-8") as f:
            f.write(s)
    # html -> pdf via Edge headless
    url = "file:///" + html.replace("\\", "/")
    subprocess.run([EDGE, "--headless=new", "--no-sandbox", "--disable-gpu",
                    "--no-pdf-header-footer",
                    "--print-to-pdf=" + pdf, url], check=True)
    print("Built:", pdf)

build("01_中文综述.md", "01_中文综述.html", "中文综述.pdf")
build("02_英文综述.md", "02_英文综述.html", "英文综述.pdf")
