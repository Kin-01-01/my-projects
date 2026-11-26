import json, urllib.request, urllib.error, time, sys

POOL = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review\notes\pool_final.json"
OUT = r"D:\workBuddy\2026-11-02-22-43-05\metastable_SE_review\notes\pool_enriched.json"

with open(POOL, encoding="utf-8") as f:
    data = json.load(f)

def fetch(doi):
    url = "https://api.crossref.org/works/" + urllib.parse.quote(doi)
    req = urllib.request.Request(url, headers={"User-Agent": "metastable-SE-review/1.0 (mailto:[邮箱已脱敏])"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)["message"]
        except Exception as e:
            time.sleep(1.5 * (attempt + 1))
    return None

enriched = []
failed = []
for p in data["papers"]:
    doi = p["doi"]
    msg = fetch(doi)
    if not msg:
        failed.append(doi)
        p["_crossref_ok"] = False
        enriched.append(p)
        continue
    # verify DOI matches
    cr_doi = (msg.get("DOI") or "").lower()
    p["_crossref_ok"] = (cr_doi == doi.lower())
    p["_title"] = (msg.get("title") or [""])[0]
    authors = msg.get("author") or []
    fam = []
    full = []
    for a in authors:
        f = a.get("family") or a.get("name") or ""
        g = a.get("given") or ""
        if f:
            fam.append(f)
            full.append({"family": f, "given": g})
    p["_authors"] = fam
    p["_authors_full"] = full
    p["_container"] = (msg.get("container-title") or [""])[0]
    p["_volume"] = msg.get("volume") or ""
    p["_issue"] = msg.get("issue") or ""
    p["_page"] = msg.get("page") or ""
    yr = ""
    dp = msg.get("published", {}).get("date-parts", [[""]])[0]
    if dp and dp[0]:
        yr = str(dp[0])
    p["_year_cr"] = yr
    p["_publisher"] = msg.get("publisher") or ""
    enriched.append(p)
    time.sleep(0.9)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"papers": enriched, "failed": failed}, f, ensure_ascii=False, indent=2)

print("TOTAL:", len(enriched), "FAILED:", len(failed))
for d in failed:
    print("  FAILED DOI:", d)
# report DOI mismatches
for p in enriched:
    if not p.get("_crossref_ok"):
        print("  MISMATCH/UNVERIFIED:", p["id"], p["doi"])
