/* =========================================================
   Unit test js/scripts.js + js/pacer.js – Hành Trình Đón Con (Chủ: qa-tester; T-Q1 10/11/2026). Viết TỪ ĐẶC TẢ.
   Nguồn ca: tech design 7.1 (dữ liệu bài, chép kịch bản không sửa câu), 7.2 (công thức, bảng tổng thời gian ±1 s),
   ADR 0012; PRD AC-43 (tag safety_open / close_whatever), AC-47 (H1 8–11 phút, H2 2,5–4 phút; mỗi khối = đọc + dừng),
   AC-47b (tạm dừng giữ khối), AC-49 (đọc cho nhau nghe có nhãn ‹dừng›), AC-49b (audio rỗng).
   Đáp án độc lập: tests/lib/kichban.js đọc thẳng docs/specs/hiem-muon-kich-ban-hinh-dung.md (không đọc mã app).
   Bảng 7.2 (vai "bạn"): H1 28 khối 10:18 · H2 8 khối 2:49 · H3 14 khối 5:14 · H4 18 khối 6:43 · bản ngày 11 khối.
   Bản ngày: bảng 7.2 ghi "≈ 3 phút 45 s" là CHƯA tính khối H4-D1 (14 chữ = 6 s); có H4-D1 thì 3:49 → test khóa 229 s ±1.
   Hàm chưa có → CHỜ T-05 (FE-5). Có FAIL → exit 1.
   Chạy: node tests/unit-pacer.js
   ========================================================= */
'use strict';
const { createHarness, fmt } = require('./lib/harness');
const { loadApp, PURE_CHAIN } = require('./lib/load');
const KB = require('./lib/kichban');

const H = createHarness('unit-pacer');
const app = loadApp(PURE_CHAIN, { now: Date.UTC(2026, 10, 10, 15, 0, 0) });
const W = app.win, SC = W.HTDC_SCRIPTS || {}, PC = W.HTDC_PACER || {};
const TASK = 'CHỜ T-05 (FE-5)';
const ALL = ['NIGHT_HOME', 'NIGHT_HOME_SHORT', 'NIGHT_TOGETHER', 'NIGHT_WARM_HAND'];
const ROLES = ['chị', 'anh', 'bạn'];
const TABLE = { NIGHT_HOME: [28, 618], NIGHT_HOME_SHORT: [8, 169], NIGHT_TOGETHER: [14, 314], NIGHT_WARM_HAND: [18, 403], WARM_HAND_DAY: [11, 229] };
const OR = KB.available() ? KB.parse() : null;
const ctx = xung => ({ xung });

function C(name, needs, fn) {
  const miss = needs.filter(n => { const [o, f] = n.split('.'); const v = (o === 'PC' ? PC : SC)[f]; return !(typeof v === 'function' || (v && typeof v === 'object')); });
  if (miss.length) return H.wait(name, TASK + ' — chưa có ' + miss.join(', '));
  if (!OR) return H.wait(name, 'không đọc được ' + KB.FILE + ' (đáp án)');
  H.run(name, () => { const r = fn(); if (Array.isArray(r)) H.ok(name, !!r[0], r[1]); else if (r !== undefined) H.ok(name, !!r); });
}
const S = id => (SC.SCRIPTS || {})[id];
/* Chữ trong scripts.js ghi {xung}/{Xung}/{nt} → đổi về cách viết của kịch bản để so nguyên văn */
const toKB = t => String(t).replace(/\{xung\}/g, '{bạn}').replace(/\{Xung\}/g, '{Bạn}').replace(/\{nt\}/g, 'người thương');

/* ===== 1. Hằng số nhịp ===== */
H.section('1. PACE, PAUSE_LABEL (kịch bản 0.3, tech design 7.1)');
C('PACE = {WPS 2,5; short 5000; breath3 15000; long 20000}', ['SC.PACE'], () => [SC.PACE.WPS === 2.5 && SC.PACE.short === 5000 && SC.PACE.breath3 === 15000 && SC.PACE.long === 20000, fmt(SC.PACE)]);
/* Nhãn dừng theo PRD Phụ lục A.6 + UX 4.5 (chốt sau tech design 7.1, bản 7.1 còn ghi ‹dừng ngắn›…) */
const LAB = { short: '· dừng một hơi thở ·', breath3: '· dừng ba hơi thở ·', long: '· dừng lâu, không cần vội ·' };
C('PAUSE_LABEL theo PRD A.6: "· dừng một hơi thở ·" / "· dừng ba hơi thở ·" / "· dừng lâu, không cần vội ·"', ['SC.PAUSE_LABEL'], () => [fmt(SC.PAUSE_LABEL) === fmt(LAB), fmt(SC.PAUSE_LABEL)]);

/* ===== 2. Dữ liệu bài (7.1, AC-43, AC-49b, PRD 8.8) ===== */
H.section('2. SCRIPTS: trường, trạng thái duyệt, nguyên văn kịch bản (7.1, AC-43)');
for (const id of ALL.concat(['WARM_HAND_DAY'])) {
  C(id + ': có id, code, title, icon, minutes, status, reviewer, reviewedAt; audio là mảng', ['SC.SCRIPTS'], () => {
    const s = S(id);
    return [s && s.id === id && typeof s.title === 'string' && s.title && typeof s.icon === 'string' && typeof s.minutes === 'number' && ['draft', 'approved'].includes(s.status)
      && typeof s.reviewer === 'string' && typeof s.reviewedAt === 'string' && Array.isArray(s.audio) && (s.status !== 'approved' || (s.reviewer && s.reviewedAt)), fmt(s && Object.assign({}, s, { blocks: (s.blocks || []).length }))];
  });
}
C('hasBaby: H1, H2 = true; H3, H4, bản ngày = false (V1 cổng hỏi)', ['SC.SCRIPTS'], () => {
  const v = Object.fromEntries(ALL.concat(['WARM_HAND_DAY']).map(id => [id, !!(S(id) && S(id).hasBaby)]));
  return [v.NIGHT_HOME && v.NIGHT_HOME_SHORT && !v.NIGHT_TOGETHER && !v.NIGHT_WARM_HAND && !v.WARM_HAND_DAY, fmt(v)];
});
C('code H1…H4 đúng bài', ['SC.SCRIPTS'], () => [ALL.every((id, k) => S(id) && S(id).code === 'H' + (k + 1)), fmt(ALL.map(id => S(id) && S(id).code))]);
C('H3 xungMode "pair" (đọc cho nhau nghe / mục Hai ta → "hai bạn")', ['SC.SCRIPTS'], () => [S('NIGHT_TOGETHER') && S('NIGHT_TOGETHER').xungMode === 'pair', fmt(S('NIGHT_TOGETHER') && S('NIGHT_TOGETHER').xungMode)]);
for (const id of ALL) {
  C(id + ': đúng số khối, đúng mã khối, CHỮ NGUYÊN VĂN kịch bản (chỉ thay {bạn}→{xung}, "người thương"→{nt})', ['SC.SCRIPTS'], () => {
    const b = (S(id).blocks || []), o = OR[id], diff = [];
    if (b.length !== o.length) diff.push('số khối ' + b.length + ' ≠ ' + o.length);
    o.forEach((x, k) => { const y = b[k] || {}; if (y.id !== x.id) diff.push(x.id + ': mã ' + y.id); else if (toKB(y.text).normalize('NFC') !== x.text.normalize('NFC')) diff.push(x.id + ': "' + toKB(y.text) + '" ≠ "' + x.text + '"'); });
    return [!diff.length, diff.slice(0, 3).join(' | ')];
  });
  C(id + ': dừng sau mỗi khối đúng ký hiệu kịch bản (short / breath3 / long / không)', ['SC.SCRIPTS'], () => {
    const b = S(id).blocks || [], diff = OR[id].filter((x, k) => (b[k] && (b[k].pause || null)) !== x.pause).map(x => x.id + ' cần ' + x.pause);
    return [!diff.length, diff.join(', ')];
  });
  C('AC-43 ' + id + ': có khối safety_open và close_whatever, đặt trong đúng phần của kịch bản', ['SC.SCRIPTS'], () => {
    const b = S(id).blocks || [], tagged = t => b.filter(x => arr(x.tags).includes(t)).map(x => x.id), allow = t => OR[id].filter(x => x.tags.includes(t)).map(x => x.id);
    const so = tagged('safety_open'), cw = tagged('close_whatever');
    return [so.length >= 1 && cw.length >= 1 && so.every(x => allow('safety_open').includes(x)) && cw.every(x => allow('close_whatever').includes(x)), fmt({ safety_open: so, close_whatever: cw })];
  });
}
C('AC-49b: audio là mảng, mỗi mục trỏ assets/audio/ (rỗng ở MVP, câu 9)', ['SC.SCRIPTS'], () => [ALL.every(id => S(id) && Array.isArray(S(id).audio) && S(id).audio.every(a => a && /^assets\/audio\//.test(a.url))), fmt(ALL.map(id => S(id) && S(id).audio))]);
C('HEAVY (kịch bản 0.5): "Mình dừng ở đây nhé." + "không có gì sai" + "thở tự nhiên thôi"', ['SC.HEAVY'], () => {
  const t = [SC.HEAVY.title || ''].concat(arr(SC.HEAVY.lines).map(x => (typeof x === 'string' ? x : x && x.text))).join(' ');
  return [/Mình dừng ở đây nhé/.test(t) && /không có gì sai/.test(t) && /thở tự nhiên thôi/i.test(t), t];
});

/* ===== 3. words, blockMs (7.2) ===== */
H.section('3. words, blockMs (7.2: ceil(chữ ÷ 2,5) × 1000 + dừng)');
C('PC.words: tách khoảng trắng, bỏ token chỉ có dấu câu', ['PC.words'], () => [PC.words('Chào bạn. Mình ở đây – nhé.') === 6 && PC.words('') === 0, fmt([PC.words('Chào bạn. Mình ở đây – nhé.'), PC.words('')])]);
C('blockMs ví dụ: 5 chữ + ngắn = 2000 + 5000; 10 chữ + dài = 4000 + 20000; 1 chữ, không dừng = 1000', ['PC.blockMs'], () => {
  const a = PC.blockMs({ text: 'một hai ba bốn năm', pause: 'short' }, ctx('bạn')), b = PC.blockMs({ text: 'một hai ba bốn năm sáu bảy tám chín mười', pause: 'long' }, ctx('bạn')), c = PC.blockMs({ text: 'Chào', pause: null }, ctx('bạn'));
  return [a === 7000 && b === 24000 && c === 1000, fmt([a, b, c])];
});
C('blockMs đếm chữ SAU khi thay xưng hô ("{xung}" → "hai bạn" = 2 chữ)', ['PC.blockMs'], () => {
  const a = PC.blockMs({ text: '{xung} {xung} {xung} {xung} {xung}', pause: null }, ctx('bạn')), b = PC.blockMs({ text: '{xung} {xung} {xung} {xung} {xung}', pause: null }, ctx('hai bạn'));
  return [a === 2000 && b === 4000, fmt([a, b])];
});
for (const id of ALL) for (const x of ROLES) {
  C('blockMs ' + id + ' vai "' + x + '": mọi khối = đáp án kịch bản', ['PC.blockMs', 'SC.SCRIPTS'], () => {
    const b = S(id).blocks || [], diff = OR[id].filter((o, k) => !b[k] || PC.blockMs(b[k], ctx(x)) !== KB.blockMs(o, x)).map((o, k) => o.id + ' ' + (b[k] ? PC.blockMs(b[k], ctx(x)) : '—') + '≠' + KB.blockMs(o, x));
    return [!diff.length, diff.slice(0, 4).join(', ')];
  });
}

/* ===== 4. plan + bảng tổng 7.2 + AC-47 ===== */
H.section('4. plan, bảng tổng thời gian 7.2 (±1 s), AC-47');
for (const id of ALL.concat(['WARM_HAND_DAY'])) for (const x of ROLES) {
  C('plan ' + id + ' vai "' + x + '": ' + TABLE[id][0] + ' khối, tổng ' + TABLE[id][1] + ' s ±1, = đáp án, chữ đã thay xưng hô', ['PC.plan', 'SC.SCRIPTS'], () => {
    const p = PC.plan(id, ctx(x)), o = OR[id];
    const ids = p.blocks.map(b => b.id), wantIds = o.map(b => b.id);
    const textOk = p.blocks.every((b, k) => o[k] && b.text.normalize('NFC') === KB.sayKB(o[k].text, x).normalize('NFC'));
    const msOk = p.blocks.every((b, k) => o[k] && b.ms === KB.blockMs(o[k], x));
    const sum = p.blocks.reduce((a, b) => a + b.ms, 0);
    const ok = p.id === id && fmt(ids) === fmt(wantIds) && ids.length === TABLE[id][0] && textOk && msOk && p.totalMs === sum && Math.abs(p.totalMs / 1000 - TABLE[id][1]) <= 1 && !p.blocks.some(b => /[{}]/.test(b.text));
    return [ok, fmt({ n: ids.length, totalS: p.totalMs / 1000, textOk, msOk, ids: ids.slice(-2) })];
  });
}
for (const x of ROLES) {
  C('AC-47 vai "' + x + '": H1 trong 8–11 phút, H2 trong 2,5–4 phút', ['PC.plan', 'SC.SCRIPTS'], () => {
    const a = PC.plan('NIGHT_HOME', ctx(x)).totalMs / 60000, b = PC.plan('NIGHT_HOME_SHORT', ctx(x)).totalMs / 60000;
    return [a >= 8 && a <= 11 && b >= 2.5 && b <= 4, fmt([a.toFixed(2), b.toFixed(2)])];
  });
}
C('plan H3 với "hai bạn" (đọc cho nhau nghe): tổng = đáp án với "hai bạn"', ['PC.plan', 'SC.SCRIPTS'], () => { const p = PC.plan('NIGHT_TOGETHER', ctx('hai bạn')); return [p.totalMs === KB.totalMs(OR.NIGHT_TOGETHER, 'hai bạn') && /Hai bạn|hai bạn/.test(p.blocks.map(b => b.text).join(' ')), p.totalMs]; });
C('plan bản ngày: H4-01…H4-10 + H4-D1 "Mình được phép buồn…" ở cuối, khối cuối không dừng', ['PC.plan', 'SC.SCRIPTS'], () => {
  const p = PC.plan('WARM_HAND_DAY', ctx('chị')), last = p.blocks[p.blocks.length - 1] || {};
  return [p.blocks.length === 11 && p.blocks[0].id === 'H4-01' && p.blocks[9].id === 'H4-10' && last.text === KB.DAY_EXTRA.text && !last.pause, fmt(p.blocks.map(b => b.id))];
});
C('plan id lạ → không ném lỗi, trả null hoặc kế hoạch rỗng', ['PC.plan'], () => { let p; try { p = PC.plan('NIGHT_EVIL', ctx('bạn')); } catch (e) { return [false, 'ném lỗi: ' + e.message]; } return [p == null || (p.blocks || []).length === 0, fmt(p)]; });

/* ===== 5. start / tick / next / pause / resume / progress (AC-47, 47b) ===== */
H.section('5. Trình chiếu theo giờ thật (AC-47, AC-47b, R6)');
const T0 = 1_800_000_000_000;
const plan2 = () => PC.plan('NIGHT_HOME_SHORT', ctx('chị'));
const NEED5 = ['PC.plan', 'PC.start', 'PC.tick', 'SC.SCRIPTS'];
C('start → khối 0, chưa xong, không tạm dừng', NEED5, () => { const st = PC.start(plan2(), T0); return [st.i === 0 && !st.done && !st.paused, fmt(st)]; });
C('tick: còn 100 ms → vẫn khối 0; quá 100 ms → khối 1 (±0,5 s)', NEED5, () => {
  const p = plan2(), m0 = p.blocks[0].ms;
  const a = PC.tick(PC.start(p, T0), p, T0 + m0 - 100), b = PC.tick(PC.start(p, T0), p, T0 + m0 + 100);
  return [a.i === 0 && b.i === 1, fmt([a.i, b.i, m0])];
});
C('tick nhảy nhiều khối khi timer bị giãn (giờ thật), khối kế tính từ ranh giới khối, không từ lúc tick', NEED5, () => {
  const p = plan2(), m = p.blocks.map(b => b.ms);
  const a = PC.tick(PC.start(p, T0), p, T0 + m[0] + m[1] + m[2] + 100);
  const b1 = PC.tick(PC.start(p, T0), p, T0 + m[0] + 300);
  const b2 = PC.tick(b1, p, T0 + m[0] + m[1] + 100);
  return [a.i === 3 && b1.i === 1 && b2.i === 2, fmt([a.i, b1.i, b2.i])];
});
C('tick quá tổng thời gian → done; tick tiếp không lỗi, vẫn done', NEED5, () => {
  const p = plan2(); const a = PC.tick(PC.start(p, T0), p, T0 + p.totalMs + 1000); const b = PC.tick(a, p, T0 + p.totalMs + 5000);
  return [a.done === true && b.done === true, fmt([a, b])];
});
C('tick không sửa trạng thái cũ (trả st mới)', NEED5, () => { const p = plan2(); const s0 = PC.start(p, T0); const before = fmt(s0); PC.tick(s0, p, T0 + 60000); return [fmt(s0) === before, before]; });
C('next: chạm màn → khối kế NGAY, khối kế đủ thời gian của nó', NEED5.concat(['PC.next']), () => {
  const p = plan2(); const s = PC.next(PC.start(p, T0), p, T0 + 1000);
  const a = PC.tick(s, p, T0 + 1000 + p.blocks[1].ms - 100), b = PC.tick(s, p, T0 + 1000 + p.blocks[1].ms + 100);
  return [s.i === 1 && a.i === 1 && b.i === 2, fmt([s.i, a.i, b.i])];
});
C('next ở khối cuối → done', NEED5.concat(['PC.next']), () => { const p = plan2(); let s = PC.start(p, T0); for (let k = 0; k < p.blocks.length; k++) s = PC.next(s, p, T0 + k); return [s.done === true, fmt(s)]; });
C('AC-47b: pause giữ khối dù 1 giờ trôi qua; resume không mất thời gian đã chạy', NEED5.concat(['PC.pause', 'PC.resume']), () => {
  const p = plan2(), m0 = p.blocks[0].ms;
  let s = PC.pause(PC.start(p, T0), T0 + 1000);
  const held = PC.tick(s, p, T0 + 3600000);
  s = PC.resume(held, T0 + 3600000);
  const a = PC.tick(s, p, T0 + 3600000 + (m0 - 1000) - 100), b = PC.tick(s, p, T0 + 3600000 + (m0 - 1000) + 100);
  return [s.paused === false && held.i === 0 && held.paused === true && !held.done && a.i === 0 && b.i === 1, fmt({ held: held.i, a: a.i, b: b.i })];
});
C('progress: 0 lúc đầu, 1 khi xong, không giảm, trong [0, 1]', NEED5.concat(['PC.progress']), () => {
  const p = plan2(); let s = PC.start(p, T0); const xs = [];
  for (let t = 0; t <= p.totalMs + 2000; t += 5000) { s = PC.tick(s, p, T0 + t); xs.push(PC.progress(s, p, T0 + t)); }
  const mono = xs.every((v, k) => k === 0 || v >= xs[k - 1] - 1e-9);
  return [Math.abs(xs[0]) < 0.01 && Math.abs(xs[xs.length - 1] - 1) < 1e-9 && mono && xs.every(v => v >= 0 && v <= 1), fmt(xs.map(v => +v.toFixed(3)).slice(0, 8))];
});
C('progress giữa chừng ≈ thời gian đã chạy ÷ tổng (±5 %)', NEED5.concat(['PC.progress']), () => {
  const p = plan2(), t = Math.round(p.totalMs / 2); const s = PC.tick(PC.start(p, T0), p, T0 + t); const v = PC.progress(s, p, T0 + t);
  return [Math.abs(v - 0.5) <= 0.05, v];
});

/* ===== 6. readView (AC-49) ===== */
H.section('6. readView – "Đọc cho nhau nghe" (AC-49)');
for (const id of ALL) {
  C('readView ' + id + ': cả bài (mọi khối), nhãn ‹dừng› đúng PAUSE_LABEL, không biến thô', ['PC.readView', 'PC.plan', 'SC.SCRIPTS'], () => {
    const p = PC.plan(id, ctx('anh')), v = PC.readView(p), o = OR[id];
    const lab = LAB;
    const ok = v.length === o.length && v.every((x, k) => x.text === p.blocks[k].text && (o[k].pause ? x.pauseLabel === lab[o[k].pause] : !x.pauseLabel)) && !v.some(x => /[{}]/.test(x.text));
    return [ok, fmt(v.slice(0, 2))];
  });
}

/* ===== 7. Thuần ===== */
H.section('7. Hàm thuần');
H.ok('pacer/scripts không tự lấy giờ (Date.now()/new Date() không tham số: 0 lần)', app.clock.calls === 0, 'gọi ' + app.clock.calls + ' lần');
H.done();

function arr(x) { return Array.isArray(x) ? x : x == null ? [] : [x]; }
