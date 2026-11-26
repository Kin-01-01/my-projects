import json, re

ENR = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review\notes\pool_enriched.json"
OUT = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review\notes\cite_data.json"

SUB = str.maketrans("0123456789","₀₁₂₃₄₅₆₇₈₉")

def clean_title(t):
    # strip XML/HTML tags; convert <sub>/<sup> to unicode or plain
    t = t.replace("&amp;", "&").replace("&#x2010;", "-").replace("&#8209;", "-")
    # subscripts
    def subfn(m): return m.group(1).translate(SUB)
    import re as _re
    t = _re.sub(r"<sub>(.*?)</sub>", subfn, t)
    t = _re.sub(r"<sup>(.*?)</sup>", lambda m: m.group(1), t)
    t = _re.sub(r"<.*?>", "", t)
    t = _re.sub(r"\s+", " ", t)
    # remove stray spaces around unicode subscripts/within chemical formulas
    t = _re.sub(r"([A-Za-z0-9])\s*([₀₁₂₃₄₅₆₇₈₉]+)", r"\1\2", t)
    t = _re.sub(r"([₀₁₂₃₄₅₆₇₈₉]+)\s*([A-Za-z])", r"\1\2", t)
    return t.strip()

with open(ENR, encoding="utf-8") as f:
    data = json.load(f)

def initials(given):
    if not given:
        return ""
    parts = re.split(r"[\s\-]", given.strip())
    return "".join(p[0].upper() for p in parts if p)

def fam_list(authors):
    return [a for a in authors if a]

cite = {}
for p in data["papers"]:
    pid = p["id"]
    full = p.get("_authors_full") or []
    fams = [a["family"] for a in full if a.get("family")]
    # GB/T 7714 author string
    if len(fams) == 0:
        gbt_auth = "佚名"
    elif len(fams) <= 3:
        gbt_auth = ", ".join(fams)
    else:
        gbt_auth = ", ".join(fams[:3]) + ", 等"
    title = clean_title(p.get("_title") or p.get("title") or "")
    cont = p.get("_container") or ""
    if not cont:
        d = p["doi"].lower()
        if "chemrxiv" in d:
            cont = "ChemRxiv"
        elif "arxiv" in d:
            cont = "arXiv"
    year = p.get("_year_cr") or str(p.get("year", ""))
    vol = p.get("_volume") or ""
    iss = p.get("_issue") or ""
    page = p.get("_page") or ""
    doi = p["doi"]
    # GB/T 7714: 作者. 题名[J]. 刊名, 年, 卷(期): 页.
    voliss = vol + ("(%s)" % iss if iss else "")
    gbt = "%s. %s[J]. %s, %s, %s" % (gbt_auth, title, cont, year, (voliss + ": " + page) if page else voliss)
    gbt = gbt.rstrip(", ") + ". DOI:%s." % doi
    # Nature: Author A, Author B, et al. Title. Journal Year; Volume(Issue): Pages.
    def natname(a):
        return "%s %s" % (a["family"], initials(a.get("given", "")))
    if len(full) == 0:
        nat_auth = "Anonymous"
    elif len(full) <= 3:
        nat_auth = ", ".join(natname(a) for a in full)
    else:
        nat_auth = ", ".join(natname(a) for a in full[:3]) + ", et al"
    volstr = (vol + "(" + iss + ")" if iss else vol)
    suffix = ""
    if volstr:
        suffix = "; " + volstr + (":" + page if page else "")
    nat = "%s. %s. %s %s%s." % (nat_auth, title, cont, year, suffix)
    nat = nat.rstrip(" .") + ". DOI:" + doi + "."
    # author-year in-text
    if fams:
        ay = "(%s, %s)" % (fams[0], year)
    else:
        ay = "(%s, %s)" % (cont, year)
    cite[pid] = {"gbt": gbt, "nature": nat, "ay": ay, "year": year, "fam0": fams[0] if fams else cont}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(cite, f, ensure_ascii=False, indent=2)

# print a quick preview
for pid in ["C1","S1-1","C2","S3-3","M1","S2-1"]:
    print("==", pid)
    print("  GBT:", cite[pid]["gbt"])
    print("  NAT:", cite[pid]["nature"])
    print("  AY :", cite[pid]["ay"])
