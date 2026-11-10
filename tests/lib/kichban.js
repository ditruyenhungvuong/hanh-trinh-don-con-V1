/* =========================================================
   Đọc file kịch bản bài đêm làm "đáp án độc lập" – Hành Trình Đón Con (Chủ: qa-tester; T-Q1 10/11/2026).
   Nguồn: docs/specs/hiem-muon-kich-ban-hinh-dung.md (H1–H4, ký hiệu nhịp mục 0.3). KHÔNG đọc mã app.
   Trả mỗi bài: [{ id:'H1-01', text (một dòng, giữ {bạn}/{Bạn}), pause: 'short'|'breath3'|'long'|null, tags:[…] }].
   Tag: 'safety_open' / 'close_whatever' lấy từ tiêu đề phần "### Phần … (`safety_open`, …)" hoặc ghi chú cạnh mã khối
   "**H2-01** (`safety_open`)".
   Công thức (mục 0.3, tech design 7.2): ms = ceil(số chữ ÷ 2,5) × 1000 + dừng (ngắn 5 s · 3 hơi thở 15 s · dài 20 s).
   Số chữ: tách theo khoảng trắng sau khi thay xưng hô, bỏ token không có chữ/số (dấu gạch "–", "—").
   Bản ngày Bàn tay ấm (WARM_HAND_DAY) = H4-01…H4-10 + khối H4-D1 (câu thêm ở ghi chú cuối Phần 3 H4, không dừng).
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'specs', 'hiem-muon-kich-ban-hinh-dung.md');
const PAUSE = { 'dừng ngắn': 'short', 'dừng 3 hơi thở': 'breath3', 'dừng dài': 'long' };
const PACE_MS = { short: 5000, breath3: 15000, long: 20000 };
const WPS = 2.5;
const CODE2ID = { H1: 'NIGHT_HOME', H2: 'NIGHT_HOME_SHORT', H3: 'NIGHT_TOGETHER', H4: 'NIGHT_WARM_HAND' };
const DAY_EXTRA = { id: 'H4-D1', text: 'Mình được phép buồn. Khi nào sẵn sàng, mình làm việc tiếp theo nhé.', pause: null, tags: [] };

function available() { return fs.existsSync(FILE); }

function parse() {
  const lines = fs.readFileSync(FILE, 'utf8').split('\n');
  const byCode = {};
  let cur = null, sectionTag = null, inScript = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (/^## H\d\./.test(l)) { inScript = true; sectionTag = null; cur = null; continue; }
    if (/^## /.test(l)) { inScript = false; cur = null; continue; }
    if (!inScript) continue;
    if (/^### /.test(l)) { const t = /`(safety_open|close_whatever)`/.exec(l); sectionTag = t ? t[1] : null; cur = null; continue; }
    if (/^---/.test(l)) { cur = null; continue; }
    const m = /^\*\*(H\d)-(\d\d)\*\*(?:\s*\(`(\w+)`\))?/.exec(l);
    if (m) {
      const tags = [];
      if (sectionTag) tags.push(sectionTag);
      if (m[3] && !tags.includes(m[3])) tags.push(m[3]);
      cur = { id: m[1] + '-' + m[2], lines: [], pause: null, tags };
      (byCode[m[1]] = byCode[m[1]] || []).push(cur);
      continue;
    }
    if (!cur || !l) continue;
    if (/^[`*(]/.test(l) && !/^\{/.test(l)) continue;           // dòng mô tả / ghi chú in nghiêng
    const p = /^‹(dừng ngắn|dừng 3 hơi thở|dừng dài)›$/.exec(l);
    if (p) { cur.pause = PAUSE[p[1]]; continue; }
    cur.lines.push(l);
  }
  const out = {};
  for (const [code, blocks] of Object.entries(byCode)) {
    out[CODE2ID[code]] = blocks.map(b => ({ id: b.id, text: b.lines.join(' '), pause: b.pause, tags: b.tags }));
  }
  out.WARM_HAND_DAY = out.NIGHT_WARM_HAND.slice(0, 10).map(b => Object.assign({}, b)).concat([Object.assign({}, DAY_EXTRA)]);
  return out;
}

/* Thay xưng hô theo cách viết của kịch bản: {bạn} → xung, {Bạn} → Xung (viết hoa chữ đầu). */
function sayKB(text, xung) {
  const up = xung.charAt(0).toUpperCase() + xung.slice(1);
  return text.replace(/\{bạn\}/g, xung).replace(/\{Bạn\}/g, up);
}
const countWords = t => String(t).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const blockMs = (b, xung) => Math.ceil(countWords(sayKB(b.text, xung)) / WPS) * 1000 + (b.pause ? PACE_MS[b.pause] : 0);
const totalMs = (blocks, xung) => blocks.reduce((a, b) => a + blockMs(b, xung), 0);

module.exports = { FILE, available, parse, sayKB, countWords, blockMs, totalMs, PACE_MS, WPS, CODE2ID, DAY_EXTRA };
