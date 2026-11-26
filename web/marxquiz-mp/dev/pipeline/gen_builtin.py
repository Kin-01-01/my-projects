# -*- coding: utf-8 -*-
"""把 7 个题库 JSON 拆成独立的小程序模块 utils/banks/bank-NN.js（一题一行），
再生成一个聚合入口 utils/builtin-banks.js。

拆分的理由：单个 730KB、最长行 35 万字符的 JS 文件容易让微信开发者工具编译卡住或
静默失败（工具会保留上一次成功的构建，表现为"代码没生效"）。
"""
import json, os

BANKS = r'C:\Users\Wpengz\WorkBuddy AI\2026-10-27-21-00-26\.docx-extract\banks'
APP = r'D:\03_项目归档\MarxQuiz MP'
BANK_DIR = os.path.join(APP, 'utils', 'banks')
ORDER = ['马原·导论', '马原·第一章', '马原·第二章', '马原·第三章',
         '马原·第四章', '马原·第五章', '马原·第六七章']

os.makedirs(BANK_DIR, exist_ok=True)
# 清理旧的分片，避免改名后残留
for f in os.listdir(BANK_DIR):
    if f.endswith('.js'):
        os.remove(os.path.join(BANK_DIR, f))

total = 0
lines = []
for idx, name in enumerate(ORDER, 1):
    with open(os.path.join(BANKS, name + '.json'), encoding='utf-8') as f:
        d = json.load(f)
    qs = d['questions']
    total += len(qs)

    body = []
    for q in qs:
        body.append(json.dumps(q, ensure_ascii=False, separators=(',', ':')))
    content = (
        '/**\n'
        ' * bank-%02d.js —— 内置题库「%s」，共 %d 题\n'
        ' * 由《马克思主义基本原理》题库解析文档生成，纯数据、勿手改。\n'
        ' */\n'
        'module.exports = {\n'
        '  name: %s,\n'
        '  questions: [\n%s\n  ]\n'
        '};\n'
    ) % (idx, name, len(qs), json.dumps(name, ensure_ascii=False), ',\n'.join(body))

    fn = 'bank-%02d.js' % idx
    path = os.path.join(BANK_DIR, fn)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    kb = os.path.getsize(path) / 1024
    print('  %-14s %4d 题  %7.1f KB  %5d 行' % (fn, len(qs), kb, content.count('\n')))
    lines.append("  require('./banks/%s')" % fn)

agg = (
    '/**\n'
    ' * builtin-banks.js —— 内置题库聚合入口\n'
    ' *\n'
    ' * 共 %d 个题库、%d 道题，覆盖单选/多选/判断，每题带完整解析。\n'
    ' * 首次启动时由 store.seedBuiltinOnce() 写入本地存储。\n'
    ' *\n'
    ' * 数据按章节拆在 utils/banks/bank-NN.js 里：单个大文件（700KB+、超长单行）\n'
    ' * 会让微信开发者工具编译变慢甚至静默失败，所以这里只做拼接。\n'
    ' * 本文件与 banks/ 下的分片都是生成产物，不要手改。\n'
    ' *\n'
    ' * 每个元素形如 { name: \'题库名\', questions: [...] }\n'
    ' */\n'
    'module.exports = [\n%s\n];\n'
) % (len(ORDER), total, ',\n'.join(lines))

path = os.path.join(APP, 'utils', 'builtin-banks.js')
with open(path, 'w', encoding='utf-8') as f:
    f.write(agg)

print('\n聚合入口 utils/builtin-banks.js  %.1f KB' % (os.path.getsize(path) / 1024))
print('合计 %d 个题库 / %d 道题' % (len(ORDER), total))
