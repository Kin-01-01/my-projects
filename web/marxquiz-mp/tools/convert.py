#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/convert.py —— 把 Excel(.xlsx) / Word(.docx) 题库转换成刷题小程序可导入的 JSON。

用法：
    python convert.py 题库.xlsx -o bank.json
    python convert.py 题库.docx -o bank.json
    python convert.py 题库.txt  -o bank.json
    python convert.py 题库.csv  -o bank.json

依赖：
    .xlsx 需要 openpyxl      -> pip install openpyxl
    .docx 需要 python-docx   -> pip install python-docx
    .txt / .csv 不需要任何第三方库

输出格式：
    {"name": "题库名", "questions": [ {id, type, stem, options, answer, analysis, tags}, ... ]}
"""

import argparse
import csv
import io
import json
import os
import re
import sys

# ----------------------------------------------------------------------------
# 常量
# ----------------------------------------------------------------------------

TYPE_ALIASES = {
    'single': ['single', 'radio', '单选', '单选题', '单项选择', '单项选择题', '单选择'],
    'multiple': ['multiple', 'multi', 'checkbox', '多选', '多选题', '多项选择', '多项选择题'],
    'judge': ['judge', 'truefalse', 'tf', 'bool', '判断', '判断题', '是非', '是非题'],
    'fill': ['fill', 'blank', 'text', '填空', '填空题', '简答', '简答题'],
}

LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

STEM_ALIASES = ['stem', 'question', 'title', 'content', 'q', '题目', '题干', '问题']
TYPE_ALIASES_FIELD = ['type', '题型', '类型']
ANSWER_ALIASES = ['answer', 'correct', 'answers', 'key', '答案', '正确答案']
ANALYSIS_ALIASES = ['analysis', 'explain', 'explanation', '解析', '解答', '分析', '答案解析']
TAGS_ALIASES = ['tags', 'tag', '标签', '分类']

TRUE_WORDS = ['正确', '对', '是', '√', '✓', 't', 'true', 'y', 'yes', 'a', '1']
FALSE_WORDS = ['错误', '错', '否', '×', '✗', 'x', 'f', 'false', 'n', 'no', 'b', '0']

_B36 = '0123456789abcdefghijklmnopqrstuvwxyz'


# ----------------------------------------------------------------------------
# 基础工具
# ----------------------------------------------------------------------------

def to_half_width(text):
    """全角字符转半角（只处理 ASCII 全角区与全角空格）。"""
    s = '' if text is None else str(text)
    out = []
    for ch in s:
        code = ord(ch)
        if 0xFF01 <= code <= 0xFF5E:
            out.append(chr(code - 0xFEE0))
        elif code == 0x3000:
            out.append(' ')
        else:
            out.append(ch)
    return ''.join(out)


def _to_base36(n):
    if n <= 0:
        return '0'
    out = ''
    while n > 0:
        out = _B36[n % 36] + out
        n //= 36
    return out


def hash_text(text):
    """与 utils/parser.js 中 hashText 保持一致的 djb2 变体。"""
    s = '' if text is None else str(text)
    h = 5381
    for ch in s:
        h = ((h << 5) + h + ord(ch)) & 0x7FFFFFFF
    value = _to_base36(h)[:4]
    return value if value else '0'


def normalize_type(value):
    if value is None:
        return ''
    s = str(value).strip().lower()
    if not s:
        return ''
    for key, aliases in TYPE_ALIASES.items():
        if s in aliases:
            return key
    if '多选' in s or 'multiple' in s:
        return 'multiple'
    if '单选' in s or 'single' in s:
        return 'single'
    if '判断' in s or 'judge' in s:
        return 'judge'
    if '填空' in s or 'fill' in s:
        return 'fill'
    return ''


def extract_letters(answer):
    """从任意答案表示中抽取字母序列。"""
    if isinstance(answer, (list, tuple)):
        out = []
        for item in answer:
            out.extend(extract_letters(item))
        return out
    if isinstance(answer, bool):
        return ['A'] if answer else ['B']
    if answer is None:
        return []
    s = to_half_width(answer)
    s = re.sub(r'^\s*(正确答案|参考答案|答案|answer|ans)\s*[:：]?', '', s, flags=re.IGNORECASE)
    s = s.upper()
    return [ch for ch in s if 'A' <= ch <= 'Z']


def normalize_judge_answer(answer):
    if isinstance(answer, bool):
        return 'A' if answer else 'B'
    if isinstance(answer, (list, tuple)):
        return normalize_judge_answer(answer[0]) if answer else ''
    if answer is None:
        return ''
    raw = to_half_width(answer).strip()
    if not raw:
        return ''
    compact = re.sub(r'[\s。.,，、:：;；]', '', raw.lower())
    if compact in TRUE_WORDS:
        return 'A'
    if compact in FALSE_WORDS:
        return 'B'
    letters = extract_letters(raw)
    if letters:
        return letters[0]
    if re.search(r'正确|对|√|✓', compact):
        return 'A'
    if re.search(r'错误|错|×|✗', compact):
        return 'B'
    return ''


def normalize_fill_answer(answer):
    if answer is None:
        return []
    if isinstance(answer, (list, tuple)):
        items = list(answer)
    else:
        items = re.split(r'[|｜;；\n]', to_half_width(answer))
    out = []
    for item in items:
        if item is None:
            continue
        s = str(item).strip()
        if s and s not in out:
            out.append(s)
    return out


def normalize_answer(answer, qtype, option_keys):
    if qtype == 'judge':
        return normalize_judge_answer(answer)
    if qtype == 'fill':
        return normalize_fill_answer(answer)

    letters = extract_letters(answer)
    if option_keys:
        letters = [ch for ch in letters if ch in option_keys]

    if qtype == 'multiple':
        uniq = []
        for ch in letters:
            if ch not in uniq:
                uniq.append(ch)
        return sorted(uniq)

    return letters[0] if letters else ''


def is_judge_options(options):
    if len(options) != 2:
        return False
    a = re.sub(r'\s', '', str(options[0].get('text', '')).lower())
    b = re.sub(r'\s', '', str(options[1].get('text', '')).lower())
    return (a in TRUE_WORDS and b in FALSE_WORDS) or (a in FALSE_WORDS and b in TRUE_WORDS)


def resolve_judge_answer(raw, options):
    semantic = normalize_judge_answer(raw)
    if len(options) != 2:
        return semantic
    letters = extract_letters(raw)
    if not letters:
        return semantic
    picked = None
    for opt in options:
        if str(opt.get('key', '')).upper() == letters[0]:
            picked = opt
            break
    if picked is None:
        return semantic
    txt = re.sub(r'\s', '', str(picked.get('text', '')).lower())
    if txt in TRUE_WORDS:
        return 'A'
    if txt in FALSE_WORDS:
        return 'B'
    return semantic


def pick_field(row, aliases):
    """按别名从字典中取值（键名忽略大小写与首尾空格）。"""
    if not isinstance(row, dict):
        return None
    lowered = {}
    for key in row.keys():
        lowered[str(key).strip().lower()] = row[key]
    for alias in aliases:
        key = str(alias).lower()
        if key in lowered:
            value = lowered[key]
            if value is not None and str(value).strip() != '':
                return value
    return None


# ----------------------------------------------------------------------------
# 单题构建
# ----------------------------------------------------------------------------

def build_question(row, index, errors):
    """把一行原始数据构建成标准题目，失败返回 None。"""
    no = index + 1

    stem_raw = pick_field(row, STEM_ALIASES)
    stem = '' if stem_raw is None else str(stem_raw).strip()
    if not stem:
        errors.append('第 %d 题：缺少题干，已跳过' % no)
        return None

    options = []
    raw_options = row.get('__options__')
    if isinstance(raw_options, list) and raw_options:
        for i, item in enumerate(raw_options):
            default_key = LETTERS[i] if i < len(LETTERS) else ''
            if isinstance(item, dict):
                raw_key = item.get('key')
                key = str(raw_key if raw_key else default_key).strip().upper()
                text = '' if item.get('text') is None else str(item.get('text')).strip()
            else:
                key = default_key
                text = '' if item is None else str(item).strip()
            if key:
                options.append({'key': key, 'text': text})
    else:
        for letter in LETTERS:
            value = row.get(letter)
            if value is not None and str(value).strip() != '':
                options.append({'key': letter, 'text': str(value).strip()})

    qtype = normalize_type(pick_field(row, TYPE_ALIASES_FIELD))
    answer_raw = pick_field(row, ANSWER_ALIASES)

    if not qtype:
        if not options:
            qtype = 'fill'
        elif is_judge_options(options):
            qtype = 'judge'
        else:
            qtype = 'multiple' if len(extract_letters(answer_raw)) > 1 else 'single'

    if qtype == 'judge':
        answer = resolve_judge_answer(answer_raw, options)
        options = [{'key': 'A', 'text': '正确'}, {'key': 'B', 'text': '错误'}]
    elif qtype == 'fill':
        options = []
        answer = normalize_fill_answer(answer_raw)
    else:
        if len(options) < 2:
            errors.append('第 %d 题：选择题选项少于 2 个，已跳过' % no)
            return None
        option_keys = [opt['key'] for opt in options]
        raw_letters = extract_letters(answer_raw)
        for letter in raw_letters:
            if letter not in option_keys:
                errors.append('第 %d 题：答案 %s 不在选项范围内（本题只有 %s），已跳过'
                              % (no, letter, '、'.join(option_keys)))
                return None
        answer = normalize_answer(answer_raw, qtype, option_keys)

    # 答案合法性校验
    if qtype == 'fill':
        if not answer:
            errors.append('第 %d 题：缺少答案，已跳过' % no)
            return None
    elif qtype == 'judge':
        if answer not in ('A', 'B'):
            errors.append('第 %d 题：判断题答案无法识别（应为 正确/错误 或 A/B），已跳过' % no)
            return None
    elif qtype == 'single':
        if not answer:
            errors.append('第 %d 题：缺少答案，已跳过' % no)
            return None
    else:
        if not answer:
            errors.append('第 %d 题：缺少答案，已跳过' % no)
            return None

    analysis_raw = pick_field(row, ANALYSIS_ALIASES)
    analysis = '' if analysis_raw is None else str(analysis_raw).strip()

    tags_raw = pick_field(row, TAGS_ALIASES)
    tags = []
    if isinstance(tags_raw, (list, tuple)):
        tags = [str(t).strip() for t in tags_raw if str(t).strip()]
    elif tags_raw is not None and str(tags_raw).strip():
        tags = [t.strip() for t in re.split(r'[,，、;；|/]', str(tags_raw)) if t.strip()]

    return {
        'id': 'q_%d_%s' % (no, hash_text(stem)),
        'type': qtype,
        'stem': stem,
        'options': options,
        'answer': answer,
        'analysis': analysis,
        'tags': tags,
    }


def build_all(rows, errors):
    questions = []
    for i, row in enumerate(rows):
        q = build_question(row, i, errors)
        if q:
            questions.append(q)
    return questions


# ----------------------------------------------------------------------------
# Excel
# ----------------------------------------------------------------------------

def rows_from_table(header_cells, data_rows):
    """把表头 + 数据行转成规范化的行字典列表。"""
    header = ['' if c is None else str(c).strip() for c in header_cells]

    def find_index(aliases):
        lowered = [h.lower().replace(' ', '') for h in header]
        for alias in aliases:
            key = str(alias).lower().replace(' ', '')
            if key in lowered:
                return lowered.index(key)
        return -1

    i_stem = find_index(STEM_ALIASES)
    i_type = find_index(TYPE_ALIASES_FIELD)
    i_answer = find_index(ANSWER_ALIASES)
    i_analysis = find_index(ANALYSIS_ALIASES)
    i_tags = find_index(TAGS_ALIASES)

    i_opt = {}
    for letter in LETTERS:
        idx = find_index([
            '选项' + letter, '选项' + letter.lower(),
            'option' + letter, 'option' + letter.lower(),
            letter, letter.lower(),
        ])
        if idx >= 0:
            i_opt[letter] = idx

    rows = []
    for cells in data_rows:
        def cell(idx):
            if idx < 0 or idx >= len(cells):
                return ''
            value = cells[idx]
            return '' if value is None else str(value).strip()

        row = {}
        row['题干'] = cell(i_stem) if i_stem >= 0 else ''
        if i_type >= 0:
            row['题型'] = cell(i_type)
        if i_answer >= 0:
            row['答案'] = cell(i_answer)
        if i_analysis >= 0:
            row['解析'] = cell(i_analysis)
        if i_tags >= 0:
            row['标签'] = cell(i_tags)
        for letter, idx in i_opt.items():
            value = cell(idx)
            if value:
                row[letter] = value

        # 整行都空则跳过
        if not any(str(v).strip() for v in row.values()):
            continue
        rows.append(row)

    return rows, i_stem


def convert_xlsx(path):
    try:
        from openpyxl import load_workbook
    except ImportError:
        print('缺少依赖：openpyxl')
        print('请先执行：pip install openpyxl')
        sys.exit(2)

    wb = load_workbook(filename=path, data_only=True, read_only=True)
    if not wb.sheetnames:
        raise ValueError('Excel 里没有工作表')

    ws = wb[wb.sheetnames[0]]
    all_rows = []
    for row in ws.iter_rows(values_only=True):
        cells = list(row)
        if any(c is not None and str(c).strip() != '' for c in cells):
            all_rows.append(cells)

    if not all_rows:
        raise ValueError('第一个工作表是空的')

    # 找到表头行：第一行包含题干类关键词
    header_index = 0
    for i, cells in enumerate(all_rows[:10]):
        joined = ' '.join('' if c is None else str(c) for c in cells)
        if re.search(r'题干|题目|stem|question|答案|answer', joined, re.IGNORECASE):
            header_index = i
            break

    header_cells = all_rows[header_index]
    data_rows = all_rows[header_index + 1:]
    rows, i_stem = rows_from_table(header_cells, data_rows)

    if i_stem < 0:
        raise ValueError('没有找到「题干」列。表头请至少包含：题干、答案（可选：题型、选项A~D、解析、标签）')

    return rows


# ----------------------------------------------------------------------------
# Word
# ----------------------------------------------------------------------------

def convert_docx(path):
    try:
        import docx  # python-docx
    except ImportError:
        print('缺少依赖：python-docx')
        print('请先执行：pip install python-docx')
        sys.exit(2)

    document = docx.Document(path)

    # 优先尝试表格（很多题库是 Word 表格）
    if document.tables:
        table = document.tables[0]
        grid = []
        for row in table.rows:
            grid.append([cell.text for cell in row.cells])
        if len(grid) >= 2:
            rows, i_stem = rows_from_table(grid[0], grid[1:])
            if i_stem >= 0 and rows:
                return rows

    # 退化到段落文本
    lines = []
    for para in document.paragraphs:
        lines.append(para.text)
    return parse_txt_rows('\n'.join(lines))


# ----------------------------------------------------------------------------
# 纯文本 / CSV（与小程序 parser 同一套规则）
# ----------------------------------------------------------------------------

RE_QUESTION_NO = [
    re.compile(r'^第\s*(\d+)\s*题\s*[.、．:：]?\s*(.*)$'),
    re.compile(r'^[(（]\s*(\d+)\s*[)）]\s*[.、．:：]?\s*(.*)$'),
    re.compile(r'^(\d+)\s*[.、．)）]\s*(.*)$'),
]
RE_OPTION = re.compile(r'^([A-Ha-h])\s*[.、．)）:：]\s*(.+)$')
RE_ANALYSIS = re.compile(r'^[【\[]?\s*(?:答案解析|试题解析|解析|解答|分析|explanation|explain|analysis)\s*[】\]]?\s*[:：]\s*(.*)$', re.IGNORECASE)
RE_ANSWER = re.compile(r'^[【\[]?\s*(?:正确答案|参考答案|答案|answer|ans)\s*[】\]]?\s*[:：]?\s*(.*)$', re.IGNORECASE)
RE_TAGS = re.compile(r'^[【\[]?\s*(?:标签|分类|tags?)\s*[】\]]?\s*[:：]\s*(.*)$', re.IGNORECASE)
RE_SECTION = re.compile(r'^[一二三四五六七八九十]+\s*[、.．]\s*(单选题|多选题|多项选择题|判断题|填空题|单项选择题)')


def parse_txt_rows(text):
    """按 TXT 分段格式解析，返回行字典列表。"""
    blocks = []
    cur = None
    in_analysis = False
    section_type = ''

    def new_block():
        return {
            'stem_lines': [],
            'options': [],
            'answer': '',
            'analysis_lines': [],
            'tags': [],
            'type': section_type,
        }

    for raw_line in str(text).replace('\ufeff', '').splitlines():
        line = raw_line.replace('\u3000', ' ').strip()
        if not line:
            continue

        m = RE_SECTION.match(line)
        if m:
            section_type = normalize_type(m.group(1))
            continue

        matched_no = None
        for pattern in RE_QUESTION_NO:
            m = pattern.match(line)
            if m:
                matched_no = (int(m.group(1)), m.group(2))
                break
        if matched_no:
            cur = new_block()
            blocks.append(cur)
            in_analysis = False
            if matched_no[1]:
                cur['stem_lines'].append(matched_no[1])
            continue

        m = RE_OPTION.match(line)
        if m:
            if cur is None:
                cur = new_block()
                blocks.append(cur)
            cur['options'].append({'key': m.group(1).upper(), 'text': m.group(2).strip()})
            in_analysis = False
            continue

        m = RE_ANALYSIS.match(line)
        if m:
            if cur is None:
                cur = new_block()
                blocks.append(cur)
            cur['analysis_lines'].append(m.group(1).strip())
            in_analysis = True
            continue

        m = RE_ANSWER.match(line)
        if m:
            if cur is None:
                cur = new_block()
                blocks.append(cur)
            cur['answer'] = m.group(1).strip()
            in_analysis = False
            continue

        m = RE_TAGS.match(line)
        if m:
            if cur is None:
                cur = new_block()
                blocks.append(cur)
            cur['tags'] = [t.strip() for t in re.split(r'[,，、;；|/]', m.group(1)) if t.strip()]
            in_analysis = False
            continue

        if cur is None:
            cur = new_block()
            blocks.append(cur)
        if in_analysis:
            cur['analysis_lines'].append(line)
        elif not cur['options'] and not cur['answer']:
            cur['stem_lines'].append(line)
        elif not cur['answer'] and cur['options']:
            cur['options'][-1]['text'] = (cur['options'][-1]['text'] + ' ' + line).strip()
        else:
            cur['analysis_lines'].append(line)
            in_analysis = True

    rows = []
    for blk in blocks:
        if not blk['stem_lines'] and not blk['options']:
            continue
        row = {'题干': ' '.join(blk['stem_lines']).strip()}
        if blk['type']:
            row['题型'] = blk['type']
        for opt in blk['options']:
            row[opt['key']] = opt['text']
        if blk['answer']:
            row['答案'] = blk['answer']
        if blk['analysis_lines']:
            row['解析'] = ' '.join(blk['analysis_lines']).strip()
        if blk['tags']:
            row['标签'] = ','.join(blk['tags'])
        rows.append(row)
    return rows


def split_csv_line(line):
    """引号感知的 CSV 行切分。"""
    cells = []
    cur = ''
    in_quote = False
    i = 0
    while i < len(line):
        ch = line[i]
        if in_quote:
            if ch == '"':
                if i + 1 < len(line) and line[i + 1] == '"':
                    cur += '"'
                    i += 1
                else:
                    in_quote = False
            else:
                cur += ch
        else:
            if ch == '"':
                in_quote = True
            elif ch in (',', '\t'):
                cells.append(cur)
                cur = ''
            else:
                cur += ch
        i += 1
    cells.append(cur)
    return [c.strip() for c in cells]


def convert_csv(path):
    with open(path, 'r', encoding='utf-8-sig', errors='replace') as f:
        raw_lines = [ln for ln in f.read().splitlines() if ln.strip()]
    if len(raw_lines) < 2:
        raise ValueError('CSV 至少需要 1 行表头 + 1 行数据')
    header = split_csv_line(raw_lines[0])
    data = [split_csv_line(ln) for ln in raw_lines[1:]]
    rows, i_stem = rows_from_table(header, data)
    if i_stem < 0:
        raise ValueError('CSV 表头缺少「题干」列')
    return rows


# ----------------------------------------------------------------------------
# 主流程
# ----------------------------------------------------------------------------

def detect_kind(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.xlsx', '.xlsm'):
        return 'xlsx'
    if ext == '.docx':
        return 'docx'
    if ext == '.csv':
        return 'csv'
    if ext in ('.txt', '.text', ''):
        return 'txt'
    return ''


def main():
    # Windows 控制台中文输出兼容
    try:
        if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
            sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    parser = argparse.ArgumentParser(
        description='把 Excel / Word / TXT / CSV 题库转换成刷题小程序可导入的 JSON',
    )
    parser.add_argument('input', help='输入文件路径，例如 题库.xlsx')
    parser.add_argument('-o', '--output', default='bank.json', help='输出 JSON 路径，默认 bank.json')
    parser.add_argument('-n', '--name', default='', help='题库名称，默认取文件名')
    args = parser.parse_args()

    src = os.path.abspath(args.input)
    if not os.path.isfile(src):
        print('找不到文件：%s' % src)
        sys.exit(1)

    kind = detect_kind(src)
    if not kind:
        print('不支持的文件类型：%s' % os.path.splitext(src)[1])
        print('支持的扩展名：.xlsx .docx .csv .txt')
        sys.exit(1)

    print('正在读取：%s' % src)
    errors = []
    try:
        if kind == 'xlsx':
            rows = convert_xlsx(src)
        elif kind == 'docx':
            rows = convert_docx(src)
        elif kind == 'csv':
            rows = convert_csv(src)
        else:
            with open(src, 'r', encoding='utf-8-sig', errors='replace') as f:
                rows = parse_txt_rows(f.read())
    except SystemExit:
        raise
    except Exception as exc:
        print('解析失败：%s' % exc)
        sys.exit(1)

    if not rows:
        print('没有解析到任何题目。请检查文件内容是否为题库格式。')
        sys.exit(1)

    questions = build_all(rows, errors)

    if not questions:
        print('没有生成任何有效题目，请检查表头或题目格式。')
        for err in errors:
            print('  - %s' % err)
        sys.exit(1)

    name = args.name.strip() if args.name else os.path.splitext(os.path.basename(src))[0]
    bank = {'name': name, 'questions': questions}

    out_path = os.path.abspath(args.output)
    out_dir = os.path.dirname(out_path)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    with io.open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
        f.write('\n')

    counts = {'single': 0, 'multiple': 0, 'judge': 0, 'fill': 0}
    for q in questions:
        counts[q['type']] += 1

    print('')
    print('转换完成：共 %d 道题' % len(questions))
    print('  单选 %d / 多选 %d / 判断 %d / 填空 %d'
          % (counts['single'], counts['multiple'], counts['judge'], counts['fill']))
    if errors:
        print('')
        print('有 %d 道题被跳过：' % len(errors))
        for err in errors[:20]:
            print('  - %s' % err)
        if len(errors) > 20:
            print('  ... 其余 %d 条已省略' % (len(errors) - 20))
    print('')
    print('已输出：%s' % out_path)
    print('下一步：把该 .json 文件发到微信里，在小程序「导入题库 → 从聊天选文件」中导入。')


if __name__ == '__main__':
    main()
