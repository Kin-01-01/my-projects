# -*- coding: utf-8 -*-
"""把《马克思主义基本原理》题库解析 docx 转成小程序可导入的 JSON 题库。"""
import sys, os, re, json, zipfile
import xml.etree.ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
BASE = r'D:\workBuddy\2026-10-27-21-08-59\output'
OUT = r'C:\Users\Wpengz\WorkBuddy AI\2026-10-27-21-00-26\.docx-extract\banks'

CHAPTERS = [
    ('导论', '马原·导论'),
    ('第一章', '马原·第一章'),
    ('第二章', '马原·第二章'),
    ('第三章', '马原·第三章'),
    ('第四章', '马原·第四章'),
    ('第五章', '马原·第五章'),
    ('第六七章', '马原·第六七章'),
]

SEC_RE = re.compile(r'^[一二三四五六七八九十]+、\s*(.+?)\s*$')
Q_RE = re.compile(r'^(\d+)\s*[.、．]\s*[（(]\s*([^）)]+?)\s*[）)]\s*(.*)$', re.S)
OPT_RE = re.compile(r'^([A-H])\s*[.、．]\s*(.+)$', re.S)
FIX_RE = re.compile(r'正确(?:选项)?应为\s*([A-H]+)')
INLINE_ANS_RE = re.compile(r'\s*答案[：:]\s*(\S+)\s*$')

# 文档原始缺陷的定点修复（共 2 处，人工核对后写死）
# key = (题库名, 题型, 该题型内的题号) —— 必须带题型，因为文档每节题号都从 1 重新开始
REPAIRS = {
    ('马原·第五章', 'multiple', 3): {
        'stem': '世界大变局下资本主义的矛盾与冲突（）。',
        'prepend': ('A', '经济发展失调'),
    },
    ('马原·第六七章', 'multiple', 12): {
        'stem': '社会主义在实践中开拓前进必须遵循（ ）规律。',
        'prepend': ('A', '人类社会发展规律'),
    },
}


def para_text(p):
    parts = []
    for node in p.iter():
        tag = node.tag.split('}')[-1]
        if tag == 't':
            parts.append(node.text or '')
        elif tag == 'tab':
            parts.append('\t')
        elif tag == 'br':
            parts.append('\n')
    return ''.join(parts)


def load_paragraphs(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    body = root.find('w:body', NS)
    out = []
    for el in body:
        tag = el.tag.split('}')[-1]
        if tag == 'p':
            out.append(para_text(el).replace('\u3000', ' ').strip())
        elif tag == 'tbl':
            for row in el.findall('w:tr', NS):
                for cell in row.findall('w:tc', NS):
                    for p in cell.findall('w:p', NS):
                        out.append(para_text(p).strip())
    return [t for t in out if t]


def type_from_section(title):
    if '单选' in title or '单项' in title:
        return 'single'
    if '多选' in title or '多项' in title:
        return 'multiple'
    if '判断' in title:
        return 'judge'
    return None


def norm_answer(raw, qtype):
    raw = (raw or '').strip()
    if qtype == 'judge':
        if raw in ('正确', '对', '√', 'T', 'A', '是'):
            return 'A'
        if raw in ('错误', '错', '×', 'F', 'B', '否'):
            return 'B'
        return None
    letters = re.findall(r'[A-H]', raw.upper())
    if not letters:
        return None
    letters = sorted(set(letters))
    if qtype == 'multiple':
        return letters
    return letters[0]


def parse_chapter(path, name):
    paras = load_paragraphs(path)
    cur_type = None
    qs = []
    cur = None
    pending_answer = None
    pending_verdict = None
    corrections = []

    def flush():
        nonlocal cur, pending_answer, pending_verdict
        if not cur:
            return
        # 文档原始缺陷修复：题干被并入了 A 选项
        rep = REPAIRS.get((name, cur['type'], cur['_no']))
        if rep:
            if 'stem' in rep:
                cur['stem'] = rep['stem']
            if 'prepend' in rep:
                cur['options'].insert(0, {'key': rep['prepend'][0], 'text': rep['prepend'][1]})
        qtype = cur['type']
        raw = pending_answer
        verdict = pending_verdict or ''
        # 若核验结论标注“答案有误”，按其中给出的正确项更正
        fixed = None
        if verdict.startswith('✗'):
            m = FIX_RE.search(verdict)
            if m:
                fixed = m.group(1)
        ans = norm_answer(fixed or raw, qtype)
        if ans is None:
            cur['_error'] = '答案无法识别：%r' % raw
            qs.append(cur)
            cur = pending_answer = pending_verdict = None
            return
        cur['answer'] = ans
        if fixed:
            cur['analysis'] = ('⚠ 原文档给定答案为 %s，经核验有误，已更正为 %s。\n\n' % (raw, fixed)) + cur['analysis']
            corrections.append((cur['_no'], raw, fixed))
        cur['analysis'] = cur['analysis'].strip()
        qs.append(cur)
        cur = pending_answer = pending_verdict = None

    for text in paras:
        m_sec = SEC_RE.match(text)
        if m_sec and type_from_section(m_sec.group(1)):
            flush()
            cur_type = type_from_section(m_sec.group(1))
            continue

        m_q = Q_RE.match(text)
        # 题目起始：编号 + （题型）
        if m_q and ('题' in m_q.group(2)):
            label_type = type_from_section(m_q.group(2)) or cur_type
            if not label_type:
                continue
            flush()
            stem = (m_q.group(3) or '').strip()
            inline_ans = None
            mi = INLINE_ANS_RE.search(stem)
            if mi:
                inline_ans = mi.group(1)
                stem = stem[:mi.start()].strip()
            cur = {
                '_no': int(m_q.group(1)),
                'type': label_type,
                'stem': stem,
                'options': [],
                'analysis': '',
                'tags': [name],
            }
            if inline_ans:
                pending_answer = inline_ans
            continue

        if cur is None:
            continue

        if text.startswith('【给定答案】'):
            val = text[len('【给定答案】'):].strip()
            if val:  # 空值不覆盖题干里已内嵌的答案
                pending_answer = val
            continue
        if text.startswith('【核验结论】'):
            pending_verdict = text[len('【核验结论】'):].strip()
            continue
        if text.startswith('【解析】'):
            cur['analysis'] = text[len('【解析】'):].strip()
            continue
        if text.startswith('【答案依据】'):
            cur['analysis'] = (cur['analysis'] + '\n' + text).strip()
            continue

        m_opt = OPT_RE.match(text)
        if m_opt and len(text) <= 400:
            cur['options'].append({'key': m_opt.group(1), 'text': m_opt.group(2).strip()})
            continue
        # 其余视为解析续行
        if cur['analysis']:
            cur['analysis'] = (cur['analysis'] + '\n' + text).strip()

    flush()

    # 判断题补全选项；清洗
    out = []
    bad = []
    for q in qs:
        if '_error' in q:
            bad.append((q['_no'], q['_error']))
            continue
        if q['type'] == 'judge' and not q['options']:
            q['options'] = [{'key': 'A', 'text': '正确'}, {'key': 'B', 'text': '错误'}]
        if q['type'] in ('single', 'multiple'):
            keys = [o['key'] for o in q['options']]
            if len(keys) < 2:
                bad.append((q['_no'], '选项不足：%s' % keys))
                continue
            ans = q['answer'] if isinstance(q['answer'], list) else [q['answer']]
            if any(a not in keys for a in ans):
                bad.append((q['_no'], '答案 %s 越界，选项 %s' % (ans, keys)))
                continue
            if q['type'] == 'single' and len(ans) > 1:
                bad.append((q['_no'], '单选题出现多答案 %s' % ans))
                continue
        q.pop('_no', None)
        out.append(q)
    return out, bad, corrections


def main():
    os.makedirs(OUT, exist_ok=True)
    all_q = []
    report = []
    for fname, bank_name in CHAPTERS:
        path = os.path.join(BASE, '%s_题库解析.docx' % fname)
        qs, bad, fixes = parse_chapter(path, bank_name)
        bank = {'name': bank_name, 'questions': qs}
        fp = os.path.join(OUT, '%s.json' % bank_name)
        with open(fp, 'w', encoding='utf-8') as f:
            json.dump(bank, f, ensure_ascii=False, indent=1)
        size = os.path.getsize(fp) / 1024
        report.append((bank_name, len(qs), len(bad), len(fixes), size))
        all_q.extend(qs)
        if bad:
            print('  [跳过] %s' % bank_name)
            for no, why in bad:
                print('     第 %s 题：%s' % (no, why))
    # 合并版
    merged = {'name': '马原·全册（%d题）' % len(all_q), 'questions': all_q}
    fp = os.path.join(OUT, '马原·全册.json')
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)

    print('\n%-16s %6s %6s %6s %10s' % ('题库', '题数', '跳过', '更正', '大小KB'))
    print('-' * 52)
    for name, n, b, fx, size in report:
        print('%-16s %6d %6d %6d %10.1f' % (name, n, b, fx, size))
    print('-' * 52)
    print('%-16s %6d' % ('合计', len(all_q)))
    print('合并版：%s （%.1f KB）' % (fp, os.path.getsize(fp) / 1024))


if __name__ == '__main__':
    main()
