import os, re, json
from docx import Document

SRC_DIR = r"D:\微信\xwechat_files\wxid_pmntj14ade1j22_22de\msg\file\2026-10"
OUT_DIR = r"D:\workBuddy\2026-10-27-21-08-59\parsed"
os.makedirs(OUT_DIR, exist_ok=True)

files = {
    "导论": "1.题库：导论.docx",
    "第一章": "2.题库：第一章.docx",
    "第二章": "3.题库：第二章.docx",
    "第三章": "4.题库：第三章.docx",
    "第四章": "5.题库：第四章.docx",
    "第五章": "6.题库：第五章.docx",
    "第六七章": "7.第六章  第七章.docx",
}

# section header: optional leading 一、 etc., then a known section keyword
sec_re = re.compile(
    r'^(?:[一二三四五六七八九十]+[、.．\s])?\s*'
    r'(单选题|多选题|单项选择题|多项选择题|不定项选择题|判断题|简答题|'
    r'论述题|材料分析题|材料题|名词解释题?|填空题|辨析题|单项选择|多项选择|不定项选择)'
)
opt_re = re.compile(r'^([A-Ga-g])[\.、．]')
ans_re = re.compile(r'^\s*答案[：:\s]*(.*)$')
num_re = re.compile(r'^(\d+)[\.、．]\s*')

def clean(s):
    return s.strip()

def parse_doc(path):
    doc = Document(path)
    paras = [p.text for p in doc.paragraphs]
    questions = []
    cur_sec = "未分类"
    cur_q = None
    cur_opts = []
    def flush():
        nonlocal cur_q, cur_opts
        if cur_q is not None:
            cur_q["options"] = cur_opts[:]
            questions.append(cur_q)
        cur_q = None
        cur_opts = []
    for raw in paras:
        line = clean(raw)
        if not line:
            continue
        if sec_re.match(line):
            flush()
            cur_sec = line
            continue
        m = ans_re.match(line)
        if m and cur_q is not None:
            cur_q["answer"] = m.group(1).strip()
            flush()
            continue
        mo = opt_re.match(line)
        if mo and cur_q is not None:
            cur_opts.append((mo.group(1).upper(), line[mo.end():].strip()))
            continue
        mn = num_re.match(line)
        if mn:
            flush()
            cur_q = {"section": cur_sec, "number": mn.group(1),
                     "stem": line[mn.end():].strip(), "options": [], "answer": ""}
            continue
        if cur_q is not None and not opt_re.match(line) and not ans_re.match(line):
            cur_q["stem"] += line
            continue
    flush()
    return questions

summary = {}
for ch, fn in files.items():
    p = os.path.join(SRC_DIR, fn)
    qs = parse_doc(p)
    secs = {}
    for q in qs:
        secs[q["section"]] = secs.get(q["section"], 0) + 1
    summary[ch] = {"total": len(qs), "sections": secs}
    out = os.path.join(OUT_DIR, ch + ".json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(qs, f, ensure_ascii=False, indent=1)
    print(f"{ch}: {len(qs)} questions")
    print(f"   sections: {secs}")

with open(os.path.join(OUT_DIR, "summary.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=1)
print("\nSUMMARY:")
print(json.dumps(summary, ensure_ascii=False, indent=1))
