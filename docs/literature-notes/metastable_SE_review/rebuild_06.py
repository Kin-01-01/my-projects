import json, re

BASE = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review"
cite = json.load(open(BASE + "/notes/cite_data.json", encoding="utf-8"))
pool = json.load(open(BASE + "/notes/pool_final.json", encoding="utf-8"))

# --- extract ANCHORS dict from build_refs.py WITHOUT running its top-level writes ---
src = open(BASE + "/build_refs.py", encoding="utf-8").read()
m = re.search(r"ANCHORS\s*=\s*\{.*?\n\}", src, re.S)
ns = {}
exec(m.group(0), ns)
ANCHORS = ns["ANCHORS"]

# --- recover citation order from 01's ## 参考文献 list ---
zh = open(BASE + "/01_中文综述.md", encoding="utf-8").read()
# isolate reference section
sec = zh.split("## 参考文献", 1)[1]
refs = re.findall(r"^\[(\d+)\]\s+(.+)$", sec, re.M)
print("parsed reference lines:", len(refs))

# reverse map gbt -> pid (assume unique)
gbt2pid = {}
for pid, c in cite.items():
    gbt2pid.setdefault(c["gbt"].strip(), pid)

order = []
unmatched = []
for num, body in refs:
    body = body.strip()
    pid = gbt2pid.get(body)
    if pid is None:
        unmatched.append((num, body[:60]))
    else:
        order.append(pid)

print("recovered order count:", len(order))
print("unmatched:", unmatched)

# --- rebuild 06 ---
tlines = ["# 文献证据溯源表（防文献幻觉交付）\n",
          "> 仅列正文实际引用文献；逐条给出 DOI、OA 状态、核心证据原文位置与备注。\n",
          "| 正文序号 | 文献(作者, 年) | DOI | OA | 核心证据/锚点 | 备注 |\n",
          "|---|---|---|---|---|---|"]
pid2num = {pid: i + 1 for i, pid in enumerate(order)}
for pid in order:
    c = cite[pid]
    p = next(x for x in pool["papers"] if x["id"] == pid)
    anchor, note = ANCHORS.get(pid, ("—", "—"))
    tlines.append("| [%s] | %s, %s | %s | %s | %s | %s |" % (
        pid2num[pid], c["fam0"], c["year"], p["doi"],
        "是" if p.get("oa") else "否", anchor, note))
open(BASE + "/06_证据溯源表.md", "w", encoding="utf-8").write("\n".join(tlines))
print("06 rows written:", len(order))
