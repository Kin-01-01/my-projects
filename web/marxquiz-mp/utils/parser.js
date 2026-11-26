/**
 * utils/parser.js
 * 题库解析器：把 JSON / TXT / CSV 三种文本解析为统一题目结构。
 *
 * 设计约束：
 *  1. 纯 JS，不引用任何 wx API，可在 Node 中直接 require 测试。
 *  2. 字段名高度容错（中英文均可）。
 *  3. 答案容错（全角转半角、A、C / A,C / AC / A C 都能拆）。
 *
 * 统一题目结构：
 * {
 *   id: 'q_1_a3f9',
 *   type: 'single' | 'multiple' | 'judge' | 'fill',
 *   stem: '题干',
 *   options: [{ key: 'A', text: '选项内容' }],
 *   answer: 'A' | ['A','C'] | ['答案1','答案2'],
 *   analysis: '',
 *   tags: []
 * }
 */

'use strict';

/** 题型别名表 */
var TYPE_ALIASES = {
  single: ['single', 'radio', '单选', '单选题', '单项选择', '单项选择题', '单选择'],
  multiple: ['multiple', 'multi', 'checkbox', '多选', '多选题', '多项选择', '多项选择题'],
  judge: ['judge', 'truefalse', 'tf', 'bool', '判断', '判断题', '是非', '是非题'],
  fill: ['fill', 'blank', 'text', '填空', '填空题', '简答', '简答题'],
};

/** 选项字母上限 */
var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** 字段别名表 */
var FIELD_ALIASES = {
  stem: ['stem', 'question', 'title', 'content', 'q', '题目', '题干', '问题'],
  options: ['options', 'option', 'choices', '选项'],
  answer: ['answer', 'correct', 'answers', 'key', '答案', '正确答案'],
  analysis: ['analysis', 'explain', 'explanation', '解析', '解答', '分析', '答案解析'],
  type: ['type', '题型', '类型'],
  tags: ['tags', 'tag', '标签', '分类'],
  name: ['name', 'bankname', '题库名', '名称', 'title'],
};

/** 判断题「正确」语义词（小写比较） */
var TRUE_WORDS = ['正确', '对', '是', '√', '✓', 't', 'true', 'y', 'yes', 'a', '1'];
/** 判断题「错误」语义词（小写比较） */
var FALSE_WORDS = ['错误', '错', '否', '×', '✗', 'x', 'f', 'false', 'n', 'no', 'b', '0'];

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

/**
 * 全角字符转半角（只处理 ASCII 全角区与全角空格，不影响中文）。
 * @param {string} input
 * @return {string}
 */
function toHalfWidth(input) {
  var s = String(input === undefined || input === null ? '' : input);
  s = s.replace(/[\uFF01-\uFF5E]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  return s.replace(/\u3000/g, ' ');
}

/**
 * 题干简单 hash（djb2），用于生成稳定的题目 id 后缀。
 * @param {string} text
 * @return {string} 4 位以内的 36 进制字符串
 */
function hashText(text) {
  var s = String(text === undefined || text === null ? '' : text);
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  var out = h.toString(36);
  return out.slice(0, 4) || '0';
}

/**
 * 归一化题型，支持中英文。
 * @param {*} value
 * @return {string} single | multiple | judge | fill | ''
 */
function normalizeType(value) {
  if (value === undefined || value === null) return '';
  var s = String(value).trim().toLowerCase();
  if (!s) return '';
  var keys = Object.keys(TYPE_ALIASES);
  for (var i = 0; i < keys.length; i++) {
    if (TYPE_ALIASES[keys[i]].indexOf(s) >= 0) return keys[i];
  }
  // 模糊匹配：包含关键词
  if (s.indexOf('多选') >= 0 || s.indexOf('multiple') >= 0) return 'multiple';
  if (s.indexOf('单选') >= 0 || s.indexOf('single') >= 0) return 'single';
  if (s.indexOf('判断') >= 0 || s.indexOf('judge') >= 0) return 'judge';
  if (s.indexOf('填空') >= 0 || s.indexOf('fill') >= 0) return 'fill';
  return '';
}

/**
 * 从对象中按别名取值（键名忽略大小写与首尾空格）。
 * @param {Object} obj
 * @param {Array<string>} aliases
 * @return {*}
 */
function pickField(obj, aliases) {
  if (!obj || typeof obj !== 'object') return undefined;
  var keys = Object.keys(obj);
  for (var i = 0; i < aliases.length; i++) {
    var alias = String(aliases[i]).toLowerCase();
    for (var j = 0; j < keys.length; j++) {
      if (String(keys[j]).trim().toLowerCase() === alias) {
        var v = obj[keys[j]];
        if (v !== undefined && v !== null && v !== '') return v;
      }
    }
  }
  return undefined;
}

/**
 * 从对象中取某个选项字母对应的值（支持 A / a / optionA / 选项A）。
 * @param {Object} obj
 * @param {string} letter
 * @return {*}
 */
function pickOptionField(obj, letter) {
  if (!obj || typeof obj !== 'object') return undefined;
  var lower = letter.toLowerCase();
  var candidates = [letter, lower, 'option' + letter, 'option' + lower, '选项' + letter, '选项' + lower];
  var keys = Object.keys(obj);
  for (var i = 0; i < candidates.length; i++) {
    for (var j = 0; j < keys.length; j++) {
      if (String(keys[j]).trim() === candidates[i]) return obj[keys[j]];
    }
  }
  return undefined;
}

/**
 * 从任意答案表示中抽取字母序列。
 * @param {*} answer
 * @return {Array<string>}
 */
function extractLetters(answer) {
  if (Array.isArray(answer)) {
    var all = [];
    for (var i = 0; i < answer.length; i++) {
      all = all.concat(extractLetters(answer[i]));
    }
    return all;
  }
  if (typeof answer === 'boolean') return [answer ? 'A' : 'B'];
  if (answer === undefined || answer === null) return [];
  var s = toHalfWidth(String(answer));
  s = s.replace(/^\s*(正确答案|参考答案|答案|answer|ans)\s*[:：]?/i, '');
  s = s.toUpperCase();
  var out = [];
  for (var k = 0; k < s.length; k++) {
    var c = s.charAt(k);
    if (c >= 'A' && c <= 'Z') out.push(c);
  }
  return out;
}

/**
 * 判断某个词是否在列表中。
 * @param {Array<string>} list
 * @param {string} word
 * @return {boolean}
 */
function inList(list, word) {
  return list.indexOf(word) >= 0;
}

/* ------------------------------------------------------------------ */
/* 答案归一化                                                          */
/* ------------------------------------------------------------------ */

/**
 * 判断题答案归一化：正确 → 'A'，错误 → 'B'。
 * @param {*} answer
 * @return {string} 'A' | 'B' | ''
 */
function normalizeJudgeAnswer(answer) {
  if (typeof answer === 'boolean') return answer ? 'A' : 'B';
  if (Array.isArray(answer)) {
    if (!answer.length) return '';
    return normalizeJudgeAnswer(answer[0]);
  }
  if (answer === undefined || answer === null) return '';
  var raw = toHalfWidth(String(answer)).trim();
  if (!raw) return '';

  var compact = raw.toLowerCase().replace(/[\s。.,，、:：;；]/g, '');
  if (inList(TRUE_WORDS, compact)) return 'A';
  if (inList(FALSE_WORDS, compact)) return 'B';

  var letters = extractLetters(raw);
  if (letters.length) return letters[0];

  if (/正确|对|√|✓/.test(compact)) return 'A';
  if (/错误|错|×|✗/.test(compact)) return 'B';
  return '';
}

/**
 * 填空题答案归一化：统一为去重后的字符串数组。
 * @param {*} answer
 * @return {Array<string>}
 */
function normalizeFillAnswer(answer) {
  if (answer === undefined || answer === null) return [];
  var list = [];
  if (Array.isArray(answer)) {
    list = answer;
  } else {
    list = toHalfWidth(String(answer)).split(/[|｜;；\n]/);
  }
  var out = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] === undefined || list[i] === null) continue;
    var s = String(list[i]).trim();
    if (s && out.indexOf(s) < 0) out.push(s);
  }
  return out;
}

/**
 * 通用答案归一化。
 * @param {*} answer 原始答案（字符串 / 数组 / 布尔）
 * @param {string} type 题型
 * @param {Array<Object>} options 选项列表，用于越界过滤
 * @return {string|Array<string>} single/judge 返回字符串，multiple/fill 返回数组
 */
function normalizeAnswer(answer, type, options) {
  var t = type || 'single';
  var opts = Array.isArray(options) ? options : [];
  var keys = [];
  for (var i = 0; i < opts.length; i++) {
    keys.push(String(opts[i].key || '').toUpperCase());
  }

  if (t === 'judge') return normalizeJudgeAnswer(answer);
  if (t === 'fill') return normalizeFillAnswer(answer);

  var letters = extractLetters(answer);
  // 过滤越界字母（当选项已知时）
  if (keys.length) {
    var filtered = [];
    for (var j = 0; j < letters.length; j++) {
      if (keys.indexOf(letters[j]) >= 0) filtered.push(letters[j]);
    }
    letters = filtered;
  }

  if (t === 'multiple') {
    var uniq = [];
    for (var k = 0; k < letters.length; k++) {
      if (uniq.indexOf(letters[k]) < 0) uniq.push(letters[k]);
    }
    uniq.sort();
    return uniq;
  }
  return letters.length ? letters[0] : '';
}

/**
 * 判断题答案语义修正：当原始选项顺序不是「正确 / 错误」时，按选项文本重新判定。
 * @param {*} rawAnswer
 * @param {Array<Object>} options 原始选项
 * @return {string} 'A' | 'B' | ''
 */
function resolveJudgeAnswer(rawAnswer, options) {
  var semantic = normalizeJudgeAnswer(rawAnswer);
  if (!Array.isArray(options) || options.length !== 2) return semantic;

  var letters = extractLetters(rawAnswer);
  if (!letters.length) return semantic;

  var picked = null;
  for (var i = 0; i < options.length; i++) {
    if (String(options[i].key || '').toUpperCase() === letters[0]) {
      picked = options[i];
      break;
    }
  }
  if (!picked) return semantic;

  var txt = String(picked.text || '').replace(/\s/g, '').toLowerCase();
  if (inList(TRUE_WORDS, txt)) return 'A';
  if (inList(FALSE_WORDS, txt)) return 'B';
  return semantic;
}

/* ------------------------------------------------------------------ */
/* 选项解析                                                            */
/* ------------------------------------------------------------------ */

/**
 * 判断两个选项文本是否构成「正确 / 错误」。
 * @param {Array<Object>} options
 * @return {boolean}
 */
function isJudgeOptions(options) {
  if (!Array.isArray(options) || options.length !== 2) return false;
  var a = String(options[0].text || '').replace(/\s/g, '').toLowerCase();
  var b = String(options[1].text || '').replace(/\s/g, '').toLowerCase();
  return (inList(TRUE_WORDS, a) && inList(FALSE_WORDS, b)) ||
    (inList(FALSE_WORDS, a) && inList(TRUE_WORDS, b));
}

/**
 * 从原始题目对象中解析选项。
 * @param {Object} obj
 * @return {Array<Object>}
 */
function parseOptionsFromObject(obj) {
  var raw = pickField(obj, FIELD_ALIASES.options);
  var opts = [];

  if (Array.isArray(raw)) {
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i];
      if (item === undefined || item === null) continue;
      if (typeof item === 'object') {
        var key = item.key || item.k || item.label || LETTERS[i] || String.fromCharCode(65 + i);
        var text;
        if (item.text !== undefined) text = item.text;
        else if (item.value !== undefined) text = item.value;
        else if (item.content !== undefined) text = item.content;
        else text = '';
        opts.push({
          key: String(key).trim().toUpperCase(),
          text: String(text).trim(),
        });
      } else {
        opts.push({
          key: String.fromCharCode(65 + i),
          text: String(item).trim(),
        });
      }
    }
  } else if (raw && typeof raw === 'object') {
    var objKeys = Object.keys(raw);
    for (var j = 0; j < objKeys.length; j++) {
      opts.push({
        key: String(objKeys[j]).trim().toUpperCase(),
        text: String(raw[objKeys[j]]).trim(),
      });
    }
    opts.sort(function (a, b) {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return 0;
    });
  }

  if (opts.length) {
    var cleaned = [];
    for (var k = 0; k < opts.length; k++) {
      if (opts[k].key) cleaned.push(opts[k]);
    }
    return cleaned;
  }

  // 独立字段形式：A / B / C / D、optionA、选项A
  var independent = [];
  for (var m = 0; m < LETTERS.length; m++) {
    var v = pickOptionField(obj, LETTERS[m]);
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      independent.push({ key: LETTERS[m], text: String(v).trim() });
    }
  }
  return independent;
}

/* ------------------------------------------------------------------ */
/* 单题构建                                                            */
/* ------------------------------------------------------------------ */

/**
 * 由原始对象构建一道标准题目。
 * @param {Object} rawObj
 * @param {number} index 原始序号（从 0 开始）
 * @param {Array<string>} errors 错误收集器
 * @return {Object|null}
 */
function buildQuestion(rawObj, index, errors) {
  var no = index + 1;
  var stemRaw = pickField(rawObj, FIELD_ALIASES.stem);
  var stem = stemRaw === undefined || stemRaw === null ? '' : String(stemRaw).trim();
  if (!stem) {
    errors.push('第 ' + no + ' 题：缺少题干，已跳过');
    return null;
  }

  var options = parseOptionsFromObject(rawObj);
  var type = normalizeType(pickField(rawObj, FIELD_ALIASES.type));
  var answerRaw = pickField(rawObj, FIELD_ALIASES.answer);

  if (!type) {
    if (!options.length) {
      type = 'fill';
    } else if (isJudgeOptions(options)) {
      type = 'judge';
    } else {
      var probe = extractLetters(answerRaw);
      type = probe.length > 1 ? 'multiple' : 'single';
    }
  }

  var answer;
  if (type === 'judge') {
    answer = resolveJudgeAnswer(answerRaw, options);
    options = [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }];
  } else if (type === 'fill') {
    options = [];
    answer = normalizeFillAnswer(answerRaw);
  } else {
    if (options.length < 2) {
      errors.push('第 ' + no + ' 题：选择题选项少于 2 个，已跳过');
      return null;
    }
    // 先按原始字母做越界检查，给出更精确的错误原因
    var rawLetters = extractLetters(answerRaw);
    if (rawLetters.length) {
      var keySet = [];
      for (var kk = 0; kk < options.length; kk++) {
        keySet.push(String(options[kk].key || '').toUpperCase());
      }
      for (var rl = 0; rl < rawLetters.length; rl++) {
        if (keySet.indexOf(rawLetters[rl]) < 0) {
          errors.push('第 ' + no + ' 题：答案 ' + rawLetters[rl] + ' 不在选项范围内（本题只有 ' +
            keySet.join('、') + '），已跳过');
          return null;
        }
      }
    }
    answer = normalizeAnswer(answerRaw, type, options);
  }

  var check = checkAnswer(answer, type, options);
  if (!check.ok) {
    errors.push('第 ' + no + ' 题：' + check.reason + '，已跳过');
    return null;
  }

  var analysisRaw = pickField(rawObj, FIELD_ALIASES.analysis);
  var analysis = analysisRaw === undefined || analysisRaw === null ? '' : String(analysisRaw).trim();

  var tagsRaw = pickField(rawObj, FIELD_ALIASES.tags);
  var tags = [];
  if (Array.isArray(tagsRaw)) {
    for (var t = 0; t < tagsRaw.length; t++) {
      var tv = String(tagsRaw[t]).trim();
      if (tv) tags.push(tv);
    }
  } else if (tagsRaw !== undefined && tagsRaw !== null && String(tagsRaw).trim() !== '') {
    var parts = String(tagsRaw).split(/[,，、;；|\/]/);
    for (var p = 0; p < parts.length; p++) {
      var pv = parts[p].trim();
      if (pv) tags.push(pv);
    }
  }

  return {
    id: 'q_' + no + '_' + hashText(stem),
    type: type,
    stem: stem,
    options: options,
    answer: answer,
    analysis: analysis,
    tags: tags,
  };
}

/**
 * 校验一道题目的答案是否合法。
 * @param {*} answer
 * @param {string} type
 * @param {Array<Object>} options
 * @return {{ok: boolean, reason: string}}
 */
function checkAnswer(answer, type, options) {
  var keys = [];
  var opts = Array.isArray(options) ? options : [];
  for (var i = 0; i < opts.length; i++) {
    keys.push(String(opts[i].key || '').toUpperCase());
  }

  if (type === 'fill') {
    if (!Array.isArray(answer) || !answer.length) return { ok: false, reason: '缺少答案' };
    return { ok: true, reason: '' };
  }
  if (type === 'judge') {
    if (answer !== 'A' && answer !== 'B') {
      return { ok: false, reason: '判断题答案无法识别（应为 正确/错误 或 A/B）' };
    }
    return { ok: true, reason: '' };
  }
  if (type === 'single') {
    if (!answer) return { ok: false, reason: '缺少答案' };
    if (keys.length && keys.indexOf(answer) < 0) {
      return { ok: false, reason: '答案 ' + answer + ' 不在选项范围内' };
    }
    return { ok: true, reason: '' };
  }
  // multiple
  if (!Array.isArray(answer) || !answer.length) return { ok: false, reason: '缺少答案' };
  if (keys.length) {
    for (var j = 0; j < answer.length; j++) {
      if (keys.indexOf(answer[j]) < 0) {
        return { ok: false, reason: '答案 ' + answer[j] + ' 不在选项范围内' };
      }
    }
  }
  return { ok: true, reason: '' };
}

/**
 * 批量构建题目。
 * @param {Array<Object>} rawList
 * @param {Object} result 解析结果对象
 */
function buildAll(rawList, result) {
  var questions = [];
  for (var i = 0; i < rawList.length; i++) {
    var item = rawList[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      result.errors.push('第 ' + (i + 1) + ' 题：不是有效的题目对象，已跳过');
      continue;
    }
    var q = buildQuestion(item, i, result.errors);
    if (q) questions.push(q);
  }
  result.questions = questions;
  result.ok = questions.length > 0;
  if (!questions.length && !result.errors.length) {
    result.errors.push('未解析到任何题目，请检查内容格式');
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* 格式识别                                                            */
/* ------------------------------------------------------------------ */

/**
 * 自动识别文本格式。
 * @param {string} rawText
 * @return {string} 'json' | 'csv' | 'txt'
 */
function detectFormat(rawText) {
  var text = String(rawText === undefined || rawText === null ? '' : rawText).replace(/^\uFEFF/, '').trim();
  if (!text) return 'txt';

  var first = text.charAt(0);
  if (first === '{' || first === '[') return 'json';

  var lines = text.split(/\r?\n/);
  var headerLine = '';
  for (var i = 0; i < lines.length; i++) {
    if (String(lines[i]).trim()) {
      headerLine = String(lines[i]).trim();
      break;
    }
  }
  if (headerLine && (headerLine.indexOf(',') >= 0 || headerLine.indexOf('\t') >= 0)) {
    if (/题型|题干|题目|答案|选项|解析|stem|question|answer|option|type/i.test(headerLine)) {
      return 'csv';
    }
  }
  return 'txt';
}

/* ------------------------------------------------------------------ */
/* JSON 解析                                                           */
/* ------------------------------------------------------------------ */

/**
 * 解析 JSON 题库文本。
 * @param {string} text
 * @param {Object} result
 * @return {Object}
 */
function parseJSON(text, result) {
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    result.errors.push('JSON 格式有误：' + (e && e.message ? e.message : '无法解析') +
      '（常见原因：缺少逗号、引号不成对、用了中文引号）');
    return result;
  }

  var rawList = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (data && typeof data === 'object') {
    var nameRaw = pickField(data, FIELD_ALIASES.name);
    if (nameRaw !== undefined && nameRaw !== null) result.name = String(nameRaw).trim();
    if (Array.isArray(data.questions)) rawList = data.questions;
    else if (Array.isArray(data.list)) rawList = data.list;
    else if (Array.isArray(data.data)) rawList = data.data;
    else if (Array.isArray(data.items)) rawList = data.items;
    else {
      result.errors.push('JSON 中没有找到题目数组，应为 { "name": "题库名", "questions": [ ... ] }');
      return result;
    }
  } else {
    result.errors.push('JSON 顶层应为对象或数组');
    return result;
  }

  return buildAll(rawList, result);
}

/* ------------------------------------------------------------------ */
/* CSV 解析                                                            */
/* ------------------------------------------------------------------ */

/**
 * 按行切分 CSV（引号感知，支持 "" 转义）。
 * @param {string} line
 * @return {Array<string>}
 */
function splitCSVLine(line) {
  var cells = [];
  var cur = '';
  var inQuote = false;
  var s = String(line === undefined || line === null ? '' : line);
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (inQuote) {
      if (c === '"') {
        if (s.charAt(i + 1) === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',' || c === '\t') {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  var out = [];
  for (var j = 0; j < cells.length; j++) out.push(String(cells[j]).trim());
  return out;
}

/**
 * 解析 CSV 题库文本。
 * @param {string} text
 * @param {Object} result
 * @return {Object}
 */
function parseCSV(text, result) {
  var lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  var rows = [];
  for (var i = 0; i < lines.length; i++) {
    if (String(lines[i]).trim() !== '') rows.push(lines[i]);
  }
  if (rows.length < 2) {
    result.errors.push('CSV 至少需要 1 行表头 + 1 行数据');
    return result;
  }

  var header = splitCSVLine(rows[0]);
  var map = {};
  for (var h = 0; h < header.length; h++) {
    var key = String(header[h]).trim().toLowerCase().replace(/\s/g, '');
    if (key) map[key] = h;
  }

  /**
   * 按候选列名找列下标。
   * @param {Array<string>} candidates
   * @return {number}
   */
  function col(candidates) {
    for (var c = 0; c < candidates.length; c++) {
      var name = String(candidates[c]).toLowerCase().replace(/\s/g, '');
      if (map[name] !== undefined) return map[name];
    }
    return -1;
  }

  var iType = col(['题型', 'type', '类型']);
  var iStem = col(['题干', '题目', 'stem', 'question', 'title', 'content']);
  var iAnswer = col(['答案', 'answer', 'correct', '正确答案', 'answers']);
  var iAnalysis = col(['解析', 'analysis', 'explain', '解答', '答案解析']);
  var iTags = col(['标签', 'tags', 'tag', '分类']);
  var iOpt = {};
  for (var L = 0; L < LETTERS.length; L++) {
    var letter = LETTERS[L];
    var idx = col([
      '选项' + letter,
      '选项' + letter.toLowerCase(),
      'option' + letter,
      'option' + letter.toLowerCase(),
      letter,
      letter.toLowerCase(),
    ]);
    if (idx >= 0) iOpt[letter] = idx;
  }

  if (iStem < 0) {
    result.errors.push('CSV 表头缺少「题干」列，无法解析。正确表头示例：题型,题干,选项A,选项B,选项C,选项D,答案,解析');
    return result;
  }

  var rawList = [];
  for (var r = 1; r < rows.length; r++) {
    var cells = splitCSVLine(rows[r]);
    var obj = {};
    obj['题干'] = iStem >= 0 && cells[iStem] !== undefined ? cells[iStem] : '';
    if (iType >= 0 && cells[iType] !== undefined) obj['题型'] = cells[iType];
    if (iAnswer >= 0 && cells[iAnswer] !== undefined) obj['答案'] = cells[iAnswer];
    if (iAnalysis >= 0 && cells[iAnalysis] !== undefined) obj['解析'] = cells[iAnalysis];
    if (iTags >= 0 && cells[iTags] !== undefined) obj['标签'] = cells[iTags];
    var optKeys = Object.keys(iOpt);
    for (var o = 0; o < optKeys.length; o++) {
      var k = optKeys[o];
      var v = cells[iOpt[k]];
      if (v !== undefined && String(v).trim() !== '') obj['选项' + k] = v;
    }
    rawList.push(obj);
  }

  return buildAll(rawList, result);
}

/* ------------------------------------------------------------------ */
/* TXT 解析                                                            */
/* ------------------------------------------------------------------ */

/**
 * 匹配题号行，返回题号与题干剩余部分。
 * @param {string} line
 * @return {{num: number, rest: string}|null}
 */
function matchQuestionNumber(line) {
  var m = line.match(/^第\s*(\d+)\s*题\s*[.、．:：]?\s*(.*)$/);
  if (m) return { num: parseInt(m[1], 10), rest: m[2] };
  m = line.match(/^[(（]\s*(\d+)\s*[)）]\s*[.、．:：]?\s*(.*)$/);
  if (m) return { num: parseInt(m[1], 10), rest: m[2] };
  m = line.match(/^(\d+)\s*[.、．)）]\s*(.*)$/);
  if (m) return { num: parseInt(m[1], 10), rest: m[2] };
  return null;
}

/**
 * 匹配选项行。
 * @param {string} line
 * @return {{key: string, text: string}|null}
 */
function matchOption(line) {
  var m = line.match(/^([A-Ha-h])\s*[.、．)）:：]\s*(.+)$/);
  if (!m) return null;
  return { key: m[1].toUpperCase(), text: m[2].trim() };
}

/**
 * 匹配答案解析行。
 * @param {string} line
 * @return {{value: string}|null}
 */
function matchAnalysis(line) {
  var m = line.match(/^[【\[]?\s*(?:答案解析|试题解析|解析|解答|分析|explanation|explain|analysis)\s*[】\]]?\s*[:：]\s*(.*)$/i);
  if (!m) return null;
  return { value: m[1].trim() };
}

/**
 * 匹配答案行。
 * @param {string} line
 * @return {{value: string}|null}
 */
function matchAnswer(line) {
  var m = line.match(/^[【\[]?\s*(?:正确答案|参考答案|答案|answer|ans)\s*[】\]]?\s*[:：]?\s*(.*)$/i);
  if (!m) return null;
  return { value: m[1].trim() };
}

/**
 * 匹配标签行。
 * @param {string} line
 * @return {{value: string}|null}
 */
function matchTags(line) {
  var m = line.match(/^[【\[]?\s*(?:标签|分类|tags?)\s*[】\]]?\s*[:：]\s*(.*)$/i);
  if (!m) return null;
  return { value: m[1].trim() };
}

/**
 * 解析 TXT 分段格式题库。
 * @param {string} text
 * @param {Object} result
 * @return {Object}
 */
function parseTXT(text, result) {
  var lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  var blocks = [];
  var cur = null;
  var inAnalysis = false;
  var sectionType = '';

  /**
   * 开启一个新题块。
   */
  function newBlock() {
    cur = {
      stemLines: [],
      options: [],
      answer: '',
      analysisLines: [],
      tags: [],
      type: sectionType,
    };
    blocks.push(cur);
    inAnalysis = false;
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/\u3000/g, ' ').trim();
    if (!line) continue;

    // 章节标题，如「一、单选题」
    var mSec = line.match(/^[一二三四五六七八九十]+\s*[、.．]\s*(单选题|多选题|多项选择题|判断题|填空题|单项选择题)/);
    if (mSec) {
      sectionType = normalizeType(mSec[1]);
      continue;
    }

    var mNum = matchQuestionNumber(line);
    if (mNum) {
      newBlock();
      if (mNum.rest) cur.stemLines.push(mNum.rest);
      continue;
    }

    var mOpt = matchOption(line);
    if (mOpt) {
      if (!cur) newBlock();
      cur.options.push({ key: mOpt.key, text: mOpt.text });
      inAnalysis = false;
      continue;
    }

    var mAna = matchAnalysis(line);
    if (mAna) {
      if (!cur) newBlock();
      cur.analysisLines.push(mAna.value);
      inAnalysis = true;
      continue;
    }

    var mAns = matchAnswer(line);
    if (mAns) {
      if (!cur) newBlock();
      cur.answer = mAns.value;
      inAnalysis = false;
      continue;
    }

    var mTag = matchTags(line);
    if (mTag) {
      if (!cur) newBlock();
      cur.tags = [];
      var tagParts = mTag.value.split(/[,，、;；|\/]/);
      for (var tp = 0; tp < tagParts.length; tp++) {
        var tv = tagParts[tp].trim();
        if (tv) cur.tags.push(tv);
      }
      inAnalysis = false;
      continue;
    }

    // 普通文本行
    if (!cur) newBlock();
    if (inAnalysis) {
      cur.analysisLines.push(line);
    } else if (cur.options.length === 0 && !cur.answer) {
      cur.stemLines.push(line);
    } else if (!cur.answer && cur.options.length > 0) {
      // 选项折行，拼到最后一个选项上
      var last = cur.options[cur.options.length - 1];
      last.text = last.text ? last.text + ' ' + line : line;
    } else {
      cur.analysisLines.push(line);
      inAnalysis = true;
    }
  }

  var rawList = [];
  for (var b = 0; b < blocks.length; b++) {
    var blk = blocks[b];
    if (!blk.stemLines.length && !blk.options.length) continue;
    var obj = { '题干': blk.stemLines.join(' ').trim() };
    if (blk.type) obj['题型'] = blk.type;
    for (var o = 0; o < blk.options.length; o++) {
      obj['选项' + blk.options[o].key] = blk.options[o].text;
    }
    if (blk.answer) obj['答案'] = blk.answer;
    if (blk.analysisLines.length) obj['解析'] = blk.analysisLines.join(' ').trim();
    if (blk.tags.length) obj['标签'] = blk.tags.join(',');
    rawList.push(obj);
  }

  if (!rawList.length) {
    result.errors.push('没有识别到任何题目。TXT 格式示例：第一行「1. 题干」，接着「A. 选项一」，然后「答案：A」');
    return result;
  }

  return buildAll(rawList, result);
}

/* ------------------------------------------------------------------ */
/* 对外主入口                                                          */
/* ------------------------------------------------------------------ */

/**
 * 解析题库文本。
 * @param {string} rawText
 * @return {{ok: boolean, name: string, questions: Array<Object>, errors: Array<string>, format: string}}
 */
function parse(rawText) {
  var result = {
    ok: false,
    name: '',
    questions: [],
    errors: [],
    format: 'txt',
  };

  if (rawText === undefined || rawText === null || String(rawText).trim() === '') {
    result.errors.push('内容为空，请粘贴题库内容或选择题库文件');
    return result;
  }

  var text = String(rawText).replace(/^\uFEFF/, '');
  var format = detectFormat(text);
  result.format = format;

  if (format === 'json') return parseJSON(text, result);
  if (format === 'csv') return parseCSV(text, result);
  return parseTXT(text, result);
}

/**
 * 校验题目数组的结构完整性。
 * @param {Array<Object>} questions
 * @return {{valid: Array<Object>, invalid: Array<{index: number, reason: string}>}}
 */
function validateBank(questions) {
  var valid = [];
  var invalid = [];
  if (!Array.isArray(questions)) {
    return { valid: [], invalid: [{ index: 0, reason: '题目列表不是数组' }] };
  }
  for (var i = 0; i < questions.length; i++) {
    var reason = checkQuestionShape(questions[i]);
    if (reason) invalid.push({ index: i, reason: reason });
    else valid.push(questions[i]);
  }
  return { valid: valid, invalid: invalid };
}

/**
 * 检查单道题目的结构。
 * @param {Object} q
 * @return {string} 空字符串表示通过
 */
function checkQuestionShape(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return '题目不是对象';
  if (!q.id) return '缺少 id';
  if (['single', 'multiple', 'judge', 'fill'].indexOf(q.type) < 0) return '题型非法：' + q.type;
  if (!q.stem || !String(q.stem).trim()) return '缺少题干';

  var options = Array.isArray(q.options) ? q.options : [];

  if (q.type === 'fill') {
    if (!Array.isArray(q.answer) || !q.answer.length) return '填空题缺少答案';
    return '';
  }
  if (q.type === 'judge') {
    if (q.answer !== 'A' && q.answer !== 'B') return '判断题答案应为 A 或 B';
    if (options.length !== 2) return '判断题选项应为 2 个';
    return '';
  }

  var keys = [];
  for (var i = 0; i < options.length; i++) keys.push(String(options[i].key || '').toUpperCase());
  if (options.length < 2) return '选项少于 2 个';

  if (q.type === 'single') {
    if (keys.indexOf(q.answer) < 0) return '单选答案不在选项中';
    return '';
  }

  if (!Array.isArray(q.answer) || !q.answer.length) return '多选题缺少答案';
  for (var j = 0; j < q.answer.length; j++) {
    if (keys.indexOf(q.answer[j]) < 0) return '多选答案 ' + q.answer[j] + ' 不在选项中';
  }
  return '';
}

module.exports = {
  parse: parse,
  detectFormat: detectFormat,
  normalizeAnswer: normalizeAnswer,
  validateBank: validateBank,
  // 以下为内部工具，导出便于测试与复用
  hashText: hashText,
  normalizeType: normalizeType,
  toHalfWidth: toHalfWidth,
};
