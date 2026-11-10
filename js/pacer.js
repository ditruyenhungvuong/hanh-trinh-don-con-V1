/* Hành Trình Đón Con – js/pacer.js · window.HTDC_PACER · Chủ: FE-5 Trước khi ngủ
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 7.2; ADR 0012; kịch bản mục 0.3; AC-47, 47b, 49.
   Hàm THUẦN: không DOM, không storage, không tự đọc giờ — `now` luôn truyền vào. Trạng thái tiến theo GIỜ THẬT,
   không đếm interval: tab bị giãn timer thì tick kế tiếp nhảy qua nhiều khối cho đúng (R6).
   Công thức một khối: ceil(số chữ ÷ WPS) giây + thời gian dừng (short 5 s, breath3 15 s, long 20 s, null 0).
   Số chữ đếm SAU khi thay xưng hô (chị/anh/bạn = 1 chữ, "hai bạn" = 2), bỏ token chỉ có dấu câu.
   sayCtx = { xung: 'chị'|'anh'|'bạn'|'hai bạn', nt?: chuỗi thay {nt} (mặc định "người thương") }. */
window.HTDC_PACER = (() => {
  'use strict';
  const SC = () => window.HTDC_SCRIPTS || {};
  const PACE = () => SC().PACE || { WPS: 2.5, short: 5000, breath3: 15000, long: 20000 };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ===== Thay xưng hô ({nt} trước vì có thể chứa {xung}) ===== */
  function fill(text, ctx) {
    const c = ctx || {}, x = c.xung || 'bạn', nt = c.nt || 'người thương';
    return String(text ?? '').replace(/\{nt\}/g, nt).replace(/\{Nt\}/g, cap(nt))
      .replace(/\{xung\}/g, x).replace(/\{Xung\}/g, cap(x));
  }
  // Số chữ: tách theo khoảng trắng, bỏ token không có chữ/số
  const words = text => String(text ?? '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  const pauseMs = p => (p && p !== 'WPS' && PACE()[p]) || 0;
  const readMs = (text, ctx) => Math.ceil(words(fill(text, ctx)) / PACE().WPS) * 1000;
  const blockMs = (block, ctx) => readMs(block.text, ctx) + pauseMs(block.pause);

  /* ===== Kế hoạch một bài: khối đã thay xưng + ms ===== */
  function plan(scriptId, ctx) {
    const s = (SC().SCRIPTS || {})[scriptId];
    if (!s || !Array.isArray(s.blocks) || !s.blocks.length) return null;
    const blocks = s.blocks.map(b => ({ id: b.id, text: fill(b.text, ctx), ms: blockMs(b, ctx), readMs: readMs(b.text, ctx),
      pause: b.pause || null, tags: (b.tags || []).slice() }));
    return { id: scriptId, blocks, totalMs: blocks.reduce((a, b) => a + b.ms, 0) };
  }

  /* ===== Trạng thái chạy: { i, blockStart, paused, pausedAt, done } ===== */
  const start = (pl, now) => ({ i: 0, blockStart: now, paused: false, pausedAt: null, done: !pl || !pl.blocks.length });
  // Tiến theo giờ thật; khối cuối hết giờ → done (giữ i ở khối cuối để còn vẽ)
  function tick(st, pl, now) {
    if (!st || st.done || st.paused || !pl) return st;
    let i = st.i, bs = st.blockStart;
    const last = pl.blocks.length - 1;
    while (now - bs >= pl.blocks[i].ms) {
      if (i >= last) return Object.assign({}, st, { i: last, blockStart: bs, done: true });
      bs += pl.blocks[i].ms; i++;
    }
    return i === st.i ? st : Object.assign({}, st, { i, blockStart: bs });
  }
  // Chạm màn: sang khối kế ngay (đang tạm dừng thì vẫn giữ tạm dừng, khối mới tính từ 0)
  function next(st, pl, now) {
    if (!st || st.done || !pl) return st;
    if (st.i >= pl.blocks.length - 1) return Object.assign({}, st, { done: true });
    return Object.assign({}, st, { i: st.i + 1, blockStart: now, pausedAt: st.paused ? now : null });
  }
  const pause = (st, now) => (!st || st.done || st.paused ? st : Object.assign({}, st, { paused: true, pausedAt: now }));
  // Dồn thời gian đã chạy của khối hiện tại: không mất, không cộng thêm
  const resume = (st, now) => (!st || !st.paused ? st
    : Object.assign({}, st, { paused: false, pausedAt: null, blockStart: st.blockStart + (now - st.pausedAt) }));
  // 0..1 cho thanh tiến độ mờ
  function progress(st, pl, now) {
    if (!st || !pl || !pl.totalMs) return 0;
    if (st.done) return 1;
    let t = 0;
    for (let k = 0; k < st.i; k++) t += pl.blocks[k].ms;
    t += Math.max(0, Math.min(pl.blocks[st.i].ms, (st.paused ? st.pausedAt : now) - st.blockStart));
    return Math.max(0, Math.min(1, t / pl.totalMs));
  }
  // Thời gian còn lại của khối hiện tại (ms) — e2e đo lệch nhịp
  const remaining = (st, pl, now) => (!st || !pl || st.done ? 0
    : Math.max(0, pl.blocks[st.i].ms - ((st.paused ? st.pausedAt : now) - st.blockStart)));
  // "Đọc cho nhau nghe": cả bài + nhãn dừng (AC-49)
  const readView = pl => (pl ? pl.blocks.map(b => ({ id: b.id, text: b.text, pause: b.pause, pauseLabel: (SC().PAUSE_LABEL || {})[b.pause] || '' })) : []);

  return { fill, words, blockMs, plan, start, tick, next, pause, resume, progress, remaining, readView };
})();
