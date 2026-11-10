/* =========================================================
   Quét mã JS tối giản cho check-static – Hành Trình Đón Con (Chủ: qa-tester; T-00 chép 10/11/2026).
   Nguồn: apps/sung-suc/tests/lib/jsscan.js @ 10/11/2026 (gốc apps/lifestyle-thai-phu, ADR 0008). Chỗ khác bản gốc ghi "HTDC: …".
   Tách mã thành: chuỗi '…' "…", template `…${…}…` (lồng nhau được), comment, regex literal.
   Trả:
   - code:    mã đã thay comment bằng khoảng trắng (giữ nguyên vị trí dòng), chuỗi giữ nguyên → dùng cho grep hành vi.
   - bare:    như code nhưng nội dung chuỗi/template cũng thành khoảng trắng → grep "mã thật" (không dính chữ).
   - strings: [{ text, line, kind: 'q'|'t', raw }] — text đã bỏ escape; template: phần ${…} thay bằng \u0000.
   - interps: [{ expr, line, tplHasTag }] — biểu thức trong ${…} của template (để kiểm esc()).
   Không phải parser đầy đủ; đủ cho mã IIFE thuần của app (không JSX, không TypeScript).
   ========================================================= */
'use strict';

const REGEX_PREV = /[(,=:[!&|?{};+\-*%<>~^]$|^$|\b(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

function unescapeJs(s) {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (m, e) => {
    if (e[0] === 'u' && e[1] === '{') return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', '\n': '' }[e] ?? e;
  });
}

function scan(src) {
  const n = src.length;
  const code = src.split('');
  const bare = src.split('');
  const strings = [], interps = [];
  let i = 0, line = 1;
  const blank = (a, b, alsoCode) => { for (let k = a; k < b; k++) if (src[k] !== '\n') { bare[k] = ' '; if (alsoCode) code[k] = ' '; } };
  const lastSig = pos => { let k = pos - 1; while (k >= 0 && /\s/.test(src[k])) k--; let w = ''; while (k >= 0 && /[\w$]/.test(src[k])) { w = src[k] + w; k--; } return w || (k >= 0 ? src[k] : ''); };

  function readQuote(q) {           // i ở dấu mở
    const start = i, ln = line; i++;
    let raw = '';
    while (i < n && src[i] !== q) { if (src[i] === '\\') { raw += src[i] + src[i + 1]; i += 2; continue; } if (src[i] === '\n') break; raw += src[i]; i++; }
    i++;
    strings.push({ text: unescapeJs(raw), line: ln, kind: 'q', raw });
    blank(start + 1, i - 1, false);
  }
  function readTemplate() {         // i ở dấu `
    const start = i, ln = line; i++;
    let text = '', raw = '';
    const myExprs = [];
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { raw += src[i] + src[i + 1]; text += unescapeJs(src[i] + src[i + 1]); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        const eStart = i + 2; i += 2; let depth = 1;
        while (i < n && depth > 0) {
          const c = src[i];
          if (c === '\n') line++;
          if (c === "'" || c === '"') { readQuote(c); continue; }
          if (c === '`') { readTemplate(); continue; }
          if (c === '{') depth++;
          else if (c === '}') { depth--; if (!depth) break; }
          i++;
        }
        myExprs.push({ expr: src.slice(eStart, i), line });
        text += '\u0000'; raw += '${}';
        i++; continue;
      }
      if (src[i] === '\n') line++;
      text += src[i]; raw += src[i]; i++;
    }
    i++;
    const hasTag = /<[a-zA-Z]/.test(text);
    myExprs.forEach(e => interps.push({ expr: e.expr.trim(), line: e.line, tplHasTag: hasTag }));
    strings.push({ text, line: ln, kind: 't', raw });
    // bare: xóa phần chữ của template nhưng giữ biểu thức để grep hành vi bên trong ${}
    let k = start + 1, depth = 0;
    for (; k < i - 1; k++) {
      if (src[k] === '$' && src[k + 1] === '{' && depth === 0) { depth = 1; k++; continue; }
      if (depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; continue; }
      if (src[k] !== '\n') bare[k] = ' ';
    }
  }

  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && d === '/') { const s = i; while (i < n && src[i] !== '\n') i++; blank(s, i, true); continue; }
    if (c === '/' && d === '*') { const s = i; i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; blank(s, i, true); continue; }
    if (c === "'" || c === '"') { readQuote(c); continue; }
    if (c === '`') { readTemplate(); continue; }
    if (c === '/' && REGEX_PREV.test(lastSig(i))) {   // regex literal
      const s = i; i++; let cls = false;
      while (i < n && src[i] !== '\n') { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; i++; }
      i++; while (i < n && /[a-z]/.test(src[i])) i++;
      blank(s + 1, i, false);
      continue;
    }
    i++;
  }
  return { code: code.join(''), bare: bare.join(''), strings, interps };
}

/* Chữ hiển thị từ chuỗi: bỏ thẻ HTML, giải mã thực thể thường gặp, gộp khoảng trắng */
function visible(text) {
  return String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/ ([.,!?…:;])/g, '$1')
    .trim();
}

module.exports = { scan, visible, unescapeJs };
