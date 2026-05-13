/**
 * 中文排版工具 — 知乎风格
 *
 * 1) 把英文直引号 "..." 替换为中文直角引号 「...」（单引号 '' → 『』）
 *    例外 1：在 markdown 代码块 (``` ``` 或 `inline`) 内不动
 *    例外 2：引号内只含 ASCII（纯英文/数字/符号）时保留原样
 * 2) 中文字与拉丁字母/数字之间补空格（CJK Width 国标）
 *    同样在代码块内不动
 */

// CJK 主区 + 扩展 A + 常用标点：足够覆盖知乎答题场景
const CJK_RE = /[一-鿿㐀-䶿]/;

function hasCJK(text: string): boolean {
  return CJK_RE.test(text);
}

/**
 * 把代码块（``` ``` 与 `inline`）切出来，给上层逐段决定是否处理。
 * 返回一个数组，标记每段是否是代码（isCode = true 时上层应原样保留）。
 */
function tokenizeByCode(text: string): { text: string; isCode: boolean }[] {
  const out: { text: string; isCode: boolean }[] = [];
  let i = 0;
  let buffer = '';

  const flush = () => {
    if (buffer) {
      out.push({ text: buffer, isCode: false });
      buffer = '';
    }
  };

  while (i < text.length) {
    // Triple-backtick fenced block
    if (text.startsWith('```', i)) {
      flush();
      const end = text.indexOf('```', i + 3);
      if (end === -1) {
        out.push({ text: text.slice(i), isCode: true });
        return out;
      }
      out.push({ text: text.slice(i, end + 3), isCode: true });
      i = end + 3;
      continue;
    }
    // Inline `code`
    if (text[i] === '`') {
      // Only treat as inline code if there is a closing backtick on the same line
      const lineEnd = text.indexOf('\n', i + 1);
      const closingSearchEnd = lineEnd === -1 ? text.length : lineEnd;
      const close = text.indexOf('`', i + 1);
      if (close !== -1 && close < closingSearchEnd) {
        flush();
        out.push({ text: text.slice(i, close + 1), isCode: true });
        i = close + 1;
        continue;
      }
    }
    buffer += text[i];
    i++;
  }
  flush();
  return out;
}

/**
 * Replace paired " ... " (or curly “ ... ”) with 「 ... 」 when content has CJK.
 * Pure ASCII content is left alone.
 */
function replaceDoubleQuotes(s: string): string {
  return s.replace(/(["“])([^"“”]*?)(["”])/g, (match, _open, content: string, _close) => {
    return hasCJK(content) ? `「${content}」` : match;
  });
}

function replaceSingleQuotes(s: string): string {
  return s.replace(/(['‘])([^'‘’]*?)(['’])/g, (match, _open, content: string, _close) => {
    return hasCJK(content) ? `『${content}』` : match;
  });
}

/**
 * Add a space between adjacent CJK and ASCII letter/digit pairs.
 * - "中文123" → "中文 123"
 * - "abc中文" → "abc 中文"
 * - Does NOT cross existing whitespace or newlines.
 * - Does NOT touch ASCII-only or CJK-only runs.
 */
function spacingBetweenCJKAndAscii(s: string): string {
  return s
    .replace(/([一-鿿㐀-䶿])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([一-鿿㐀-䶿])/g, '$1 $2');
}

export function formatZhihuTypography(text: string): string {
  if (!text) return text;
  const tokens = tokenizeByCode(text);
  return tokens
    .map(({ text: seg, isCode }) => {
      if (isCode) return seg;
      let out = seg;
      out = replaceDoubleQuotes(out);
      out = replaceSingleQuotes(out);
      out = spacingBetweenCJKAndAscii(out);
      return out;
    })
    .join('');
}
