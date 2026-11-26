const fs = require('fs');
const path = require('path');

const PARSER = 'D:/03_项目归档/MarxQuiz MP/utils/parser.js';
const BANKS = 'C:/Users/Wpengz/WorkBuddy AI/2026-10-27-21-00-26/.docx-extract/banks';

const parser = require(PARSER);
let totalQ = 0, totalBad = 0, fail = 0;

const files = fs.readdirSync(BANKS).filter(f => f.endsWith('.json'));
for (const f of files) {
  const raw = fs.readFileSync(path.join(BANKS, f), 'utf8');
  const res = parser.parse(raw);
  const vb = parser.validateBank(res.questions || []);
  const okShape = res.ok === true;
  const sameCount = (res.questions || []).length;
  const badN = vb.invalid.length;
  totalQ += sameCount;
  totalBad += badN;
  if (!okShape || badN > 0) fail++;
  console.log(
    (okShape && badN === 0 ? 'PASS ' : 'FAIL ') +
    f.padEnd(22) +
    ' 解析题数=' + String(sameCount).padStart(4) +
    ' 名称=' + String(res.name || '').padEnd(20) +
    ' errors=' + (res.errors || []).length +
    ' invalid=' + badN
  );
  if (badN) {
    vb.invalid.slice(0, 3).forEach(x => console.log('     invalid: 第' + (x.index + 1) + '题 ' + x.reason));
  }
  if ((res.errors || []).length) {
    res.errors.slice(0, 3).forEach(e => console.log('     error: ' + e));
  }
}

console.log('\n合计题数=' + totalQ + '  非法题数=' + totalBad + '  失败文件=' + fail + '/' + files.length);
process.exit(fail ? 1 : 0);
