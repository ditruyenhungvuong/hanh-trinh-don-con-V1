/* Hành Trình Đón Con – js/util.js · window.HTDC_UTIL · Chủ: FE-1 Lõi
   Nguồn: apps/sung-suc/js/util.js @ 10/11/2026 (esc, clamp, tzAt, dayOf, hourOf, ngày, randomId, csvCell) — ADR 0008.
   Nguồn: apps/checkin-me-bau/script.js:409–433 @ 10/11/2026 (randomInt dùng crypto, Fisher–Yates) → randInt, shuffle.
   Đặc tả: tech design mục 2 (util.js), 3.3, 14.1.
   Hàm THUẦN: không DOM, storage, không tự lấy giờ. Cấm new Date('YYYY-MM-DD'), Date.parse.
   Khung T-00 (architect, 10/11/2026). FE-1 (T-01) thêm: say (thay {nt}/{Nt}/{xung}/{Xung}), words, rng(seed) cho test. */
window.HTDC_UTIL = (() => {
  'use strict';

  /* ===== Escape mọi chuỗi trước khi vào HTML (AC-05) ===== */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ===== Giờ địa phương theo tz (phút lệch UTC) đã lưu trong bản ghi ===== */
  // Phút lệch UTC tại at theo giờ máy (Việt Nam = 420) — chỗ DUY NHẤT đọc múi giờ máy
  const tzAt = at => -new Date(at).getTimezoneOffset();
  const local = (at, tz) => new Date(at + tz * 60000);
  // 'YYYY-MM-DD' của at theo tz
  const dayOf = (at, tz) => local(at, tz).toISOString().slice(0, 10);
  // Giờ 0–23 của at theo tz
  const hourOf = (at, tz) => local(at, tz).getUTCHours();

  /* ===== Ngày 'YYYY-MM-DD', đếm bằng Date.UTC ===== */
  const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  // Số ngày kể từ 1970-01-01; sai định dạng → NaN
  function dayNum(day) {
    const m = DAY_RE.exec(String(day ?? ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN;
  }
  const fromDayNum = n => Number.isFinite(n) ? new Date(n * 86400000).toISOString().slice(0, 10) : '';
  const dayAdd = (day, n) => fromDayNum(dayNum(day) + n);
  // Ngày có thật (loại 2026-02-30)
  const isDay = day => { const n = dayNum(day); return Number.isFinite(n) && fromDayNum(n) === day; };
  // 'YYYY-MM-DD' → 'dd/mm/yyyy'
  const fmtDay = day => isDay(day) ? day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(0, 4) : '';

  /* ===== Ngẫu nhiên bằng crypto ===== */
  const cry = () => (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
  // id bản ghi: 20 ký tự [0-9a-z]
  function randomId(len = 20) {
    const abc = '0123456789abcdefghijklmnopqrstuvwxyz', c = cry();
    const bytes = c ? c.getRandomValues(new Uint8Array(len)) : Array.from({ length: len }, () => Math.floor(Math.random() * 256));
    let out = '';
    for (let i = 0; i < len; i++) out += abc[bytes[i] % 36];
    return out;
  }
  // Số nguyên 0 … n−1, bỏ phần dư để không lệch
  function randInt(n) {
    const c = cry();
    if (c) {
      const buf = new Uint32Array(1), limit = Math.floor(0x100000000 / n) * n;
      let x;
      do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }
  // Fisher–Yates trên bản sao; rand(n) → 0…n−1 (test truyền rng(seed))
  function shuffle(arr, rand = randInt) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ===== Xưng hô (PRD 6.1, AC-07, AC-14) ===== */
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // Thay {nt}/{Nt} (người thương) TRƯỚC rồi mới {xung}/{Xung}, vì {nt} có thể chứa {xung} ("một người thương {xung}").
  // {Xung}, {Nt} = viết hoa chữ đầu (đầu câu). ctx: {xung: 'chị'|'anh'|'bạn'|'hai bạn', nt?}
  function say(str, ctx = {}) {
    const x = String(ctx.xung || 'bạn'), nt = String(ctx.nt || 'người thương');
    return String(str ?? '')
      .replace(/\{nt\}/g, nt).replace(/\{Nt\}/g, cap(nt))
      .replace(/\{xung\}/g, x).replace(/\{Xung\}/g, cap(x));
  }
  // Số chữ để tính nhịp đọc: tách theo khoảng trắng, bỏ token chỉ có dấu câu ("–", "…") — tech design 7.2
  const words = text => String(text ?? '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

  /* ===== Ngẫu nhiên có hạt giống (chỉ cho test): rng(seed) → rand(n) 0…n−1, dùng được cho shuffle ===== */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return n => {   // mulberry32
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
  }

  /* ===== CSV: một ô, chặn công thức (ô bắt đầu = + - @ tab CR → thêm dấu nháy đơn) ===== */
  function csvCell(v) {
    let t = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }

  return { esc, clamp, tzAt, dayOf, hourOf, dayNum, dayAdd, isDay, fmtDay, randomId, randInt, shuffle, rng, say, words, csvCell };
})();
