import json

BASE = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review"
cite = json.load(open(BASE + "/notes/cite_data.json", encoding="utf-8"))
new_nat = cite["S1-9"]["nature"]  # updated Nature string

# --- patch 03_参考文献库.md section B S1-9 line ---
p03 = BASE + "/03_参考文献库.md"
s03 = open(p03, encoding="utf-8").read()
# find the [S1-9] nature line in section B (after '## B.')
idxB = s03.index("## B.")
tail = s03[idxB:]
import re
# replace the line starting with '[S1-9]' in the B section
def repl(m):
    return "[S1-9] " + new_nat
new_tail = re.sub(r"\[S1-9\] .*", repl, tail, count=1)
s03 = s03[:idxB] + new_tail
open(p03, "w", encoding="utf-8").write(s03)
print("03 patched:", "[S1-9]" in new_tail)

# --- patch 02_英文综述.md ref line [27] ---
p02 = BASE + "/02_英文综述.md"
s02 = open(p02, encoding="utf-8").read()
# the ref line is "[27] Morgan B. ... ChemRxiv 2021...DOI:..."
new_line = "[27] " + new_nat
s02 = re.sub(r"\[27\] Morgan B\..*DOI:10\.26434/chemrxiv\.12349703\.", new_line, s02)
open(p02, "w", encoding="utf-8").write(s02)
print("02 patched:", new_line in s02)
