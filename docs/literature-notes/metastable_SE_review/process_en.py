import json, re

BASE = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review"
cite = json.load(open(BASE + "/notes/cite_data.json", encoding="utf-8"))
pool = json.load(open(BASE + "/notes/pool_final.json", encoding="utf-8"))

en = open(BASE + "/02_英文综述.md", encoding="utf-8").read()

# find all tokens (single or comma-separated inside one bracket)
tokens = re.findall(r"\[@([A-Za-z0-9,\- ]+)\]", en)
order = []
for grp in tokens:
    for t in grp.split(","):
        t = t.strip()
        if t and t not in order:
            order.append(t)

# disambiguation: (fam0, year) -> letter
from collections import defaultdict
groups = defaultdict(list)
for pid in order:
    key = (cite[pid]["fam0"], cite[pid]["year"])
    groups[key].append(pid)
letter = {}
for key, pids in groups.items():
    if len(pids) > 1:
        for i, pid in enumerate(pids):
            letter[pid] = chr(ord("a") + i)

def intext(m):
    inner = m.group(1)
    parts = []
    for t in inner.split(","):
        t = t.strip()
        if t in cite:
            a = cite[t]["ay"]  # (First, Year)
            if a.startswith("(") and a.endswith(")"):
                a = a[1:-1]
            if t in letter:
                # append letter to year: "... Year" -> "... YearX"
                a = re.sub(r"(\d{4})$", r"\1" + letter[t], a)
            parts.append(a)
    return "(" + "; ".join(parts) + ")"

en2 = re.sub(r"\[@([A-Za-z0-9,\- ]+)\]", intext, en)

# build Nature reference list in citation order (with disambiguated year in list entry)
reflines = ["## References\n"]
for i, pid in enumerate(order):
    nat = cite[pid]["nature"]
    if pid in letter:
        # nature string has " Year;" -> " YearX;"
        nat = re.sub(r" (\d{4});", r" \1" + letter[pid] + ";", nat, count=1)
    reflines.append("[%d] %s" % (i + 1, nat))
en2 = en2.replace("<!--REFERENCES-->", "\n".join(reflines))
open(BASE + "/02_英文综述.md", "w", encoding="utf-8").write(en2)

print("EN cited count:", len(order))
print("disambiguated:", {k: v for k, v in letter.items()})
