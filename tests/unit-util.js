/* =========================================================
   Unit test js/util.js – Hành Trình Đón Con (Chủ: qa-tester; T-Q1 10/11/2026). Viết TỪ ĐẶC TẢ, không theo mã hiện có.
   Nguồn ca: tech design 2 (util.js), 3.3 (esc, say, xung), 5.3 (id, tz, day), 5.5 (csvCell), 14.1 (bảng unit-util);
   PRD AC-05 (esc), AC-07 (không còn {xung} thô), AC-16 ("{Xung} không cần làm gì lúc này cả." ba bộ), AC-38 (xáo hai seed).
   Hàm chưa có → CHỜ T-01 (FE-1 Lõi). Có FAIL → exit 1. Chạy dưới 4 múi giờ (kết quả phải trùng).
   Chạy: node tests/unit-util.js
   ========================================================= */
'use strict';
const { createHarness, runInTimezones, fmt } = require('./lib/harness');
const { loadApp } = require('./lib/load');

if (runInTimezones(__filename, 'unit-util')) main();

function main() {
  const H = createHarness('unit-util');
  const app = loadApp(['js/config.js', 'js/util.js'], { now: Date.UTC(2026, 10, 10, 2, 0, 0) });
  const U = app.win.HTDC_UTIL || {};
  const TASK = 'CHỜ T-01 (FE-1: util.js)';
  /* Một ca: thiếu hàm → CHỜ; có hàm thì chạy, lỗi ném ra → FAIL */
  const C = (name, fns, fn) => {
    const miss = fns.filter(f => typeof U[f] !== 'function');
    if (miss.length) return H.wait(name, TASK + ' — chưa có U.' + miss.join(', U.'));
    H.run(name, () => { const r = fn(); if (Array.isArray(r)) H.ok(name, !!r[0], r[1]); else if (r !== undefined) H.ok(name, !!r); });
  };
  const unq = cell => { const s = String(cell); return /^".*"$/s.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s; };

  /* ===== 1. esc (AC-05) ===== */
  H.section('1. esc (AC-05, tech design 3.3)');
  C('esc thay đủ & < > " \' ', ['esc'], () => { const r = U.esc('&<>"\''); return [!/[<>"']/.test(r.replace(/&(amp|lt|gt|quot|#39|#x27|apos);/g, '')) && r.includes('&amp;') && r.includes('&lt;'), r]; });
  C('esc chuỗi tấn công <img src=x onerror=alert(1)> không còn thẻ', ['esc'], () => { const r = U.esc('<img src=x onerror=alert(1)>'); return [!/[<>]/.test(r), r]; });
  C('esc(null), esc(undefined) → "" (không in "null"/"undefined")', ['esc'], () => [U.esc(null) === '' && U.esc(undefined) === '', fmt([U.esc(null), U.esc(undefined)])]);
  C('esc(số) → chuỗi số', ['esc'], () => [U.esc(12) === '12', fmt(U.esc(12))]);
  C('esc giữ nguyên chữ tiếng Việt', ['esc'], () => [U.esc('Chị không phải một mình.') === 'Chị không phải một mình.', U.esc('Chị không phải một mình.')]);

  /* ===== 2. say – xưng hô (AC-07, AC-14, AC-16) ===== */
  H.section('2. say – xưng hô (AC-07, AC-14, AC-16)');
  for (const [xung, up] of [['chị', 'Chị'], ['anh', 'Anh'], ['bạn', 'Bạn'], ['hai bạn', 'Hai bạn']]) {
    C('say {xung} → "' + xung + '"', ['say'], () => { const r = U.say('Chào {xung}. Mình ở đây với {xung} nhé.', { xung }); return [r === 'Chào ' + xung + '. Mình ở đây với ' + xung + ' nhé.', r]; });
    C('AC-16: say "{Xung} không cần làm gì lúc này cả." → "' + up + ' không cần…"', ['say'], () => { const r = U.say('{Xung} không cần làm gì lúc này cả.', { xung }); return [r === up + ' không cần làm gì lúc này cả.', r]; });
  }
  C('say thay MỌI chỗ, không còn {xung}/{Xung} thô (AC-07)', ['say'], () => { const r = U.say('{Xung} ơi, {xung} và {xung}. {Xung}!', { xung: 'chị' }); return [r === 'Chị ơi, chị và chị. Chị!', r]; });
  C('say chuỗi không có biến → giữ nguyên', ['say'], () => { const s = 'Mình dừng ở đây nhé. Thở tự nhiên thôi.'; return [U.say(s, { xung: 'anh' }) === s, U.say(s, { xung: 'anh' })]; });
  C('say {nt} khi không chọn "Mình đi một mình": không còn {nt} thô, không "undefined"', ['say'], () => {
    const r = U.say('Người thương: {nt}. {xung} nghĩ tới {nt}.', { xung: 'chị' });
    return [!/\{|\}|undefined|null/.test(r), r];
  });
  if (typeof U.say === 'function') H.run('say {nt} mặc định', () => {
    const r = U.say('{nt}', { xung: 'chị' });
    if (r === 'người thương') H.ok('say {nt} mặc định = "người thương" (tech design 7.1)', true);
    else H.limit('say {nt} mặc định = "người thương" (tech design 7.1)', 'nhận ' + fmt(r) + ' — đặc tả chưa chốt shape ctx.nt, hỏi architect');
  });
  else H.wait('say {nt} mặc định = "người thương" (tech design 7.1)', TASK + ' — chưa có U.say');

  /* ===== 3. words (tech design 7.2) ===== */
  H.section('3. words – đếm chữ cho nhịp bài đêm (7.2)');
  C('words: tách theo khoảng trắng', ['words'], () => [U.words('Chào bạn. Mình ở đây với bạn nhé.') === 8, U.words('Chào bạn. Mình ở đây với bạn nhé.')]);
  C('words: bỏ token chỉ có dấu câu ("–", "—", "…")', ['words'], () => [U.words('Thở ra – nhẹ thôi — nhé …') === 5, U.words('Thở ra – nhẹ thôi — nhé …')]);
  C('words: nhiều khoảng trắng, xuống dòng, đầu/cuối', ['words'], () => [U.words('  một\n\nhai\tba  ') === 3, U.words('  một\n\nhai\tba  ')]);
  C('words("") = 0', ['words'], () => [U.words('') === 0, U.words('')]);
  C('words: chữ trong ngoặc kép vẫn là chữ ("Mình đang buồn.")', ['words'], () => [U.words('"Mình đang buồn." Hay "mình đang giận",') === 7, U.words('"Mình đang buồn." Hay "mình đang giận",')]);

  /* ===== 4. shuffle + rng (AC-38) ===== */
  H.section('4. shuffle(arr, rand) + rng(seed) (AC-38)');
  const CARDS = ['vui_ve', 'dau_kho', 'lo_lang', 'tuc_gian', 'hoang_hot', 'kho_chiu', 'met_moi', 'binh_an', 'co_don', 'self_blame'];
  C('rng(seed) trả hàm rand(n) → số nguyên 0…n−1, cùng seed cùng dãy', ['rng'], () => {
    const a = U.rng(42), b = U.rng(42), xs = [], ys = [];
    for (let i = 0; i < 200; i++) { const n = 1 + (i % 11); xs.push(a(n)); ys.push(b(n)); }
    const okRange = xs.every((x, i) => Number.isInteger(x) && x >= 0 && x < 1 + (i % 11));
    return [okRange && fmt(xs) === fmt(ys), fmt(xs.slice(0, 12))];
  });
  C('AC-38: hai seed khác nhau → hai thứ tự khác nhau (10 thẻ)', ['shuffle', 'rng'], () => {
    const a = U.shuffle(CARDS, U.rng(1)), b = U.shuffle(CARDS, U.rng(2));
    return [fmt(a) !== fmt(b), fmt([a, b])];
  });
  C('shuffle giữ đủ mọi phần tử, không thêm/mất (50 seed)', ['shuffle', 'rng'], () => {
    const bad = [];
    for (let s = 1; s <= 50; s++) { const r = U.shuffle(CARDS, U.rng(s)); if (fmt([...r].sort()) !== fmt([...CARDS].sort())) bad.push(s); }
    return [!bad.length, 'seed lỗi: ' + bad.join(',')];
  });
  C('shuffle không sửa mảng gốc', ['shuffle', 'rng'], () => { const src = CARDS.slice(); U.shuffle(src, U.rng(9)); return [fmt(src) === fmt(CARDS), fmt(src)]; });
  C('shuffle thật sự xáo: 50 seed cho ≥ 40 thứ tự khác nhau, mỗi thẻ đứng đầu ≥ 1 lần', ['shuffle', 'rng'], () => {
    const seen = new Set(), first = new Set();
    for (let s = 1; s <= 50; s++) { const r = U.shuffle(CARDS, U.rng(s * 7919)); seen.add(fmt(r)); first.add(r[0]); }
    return [seen.size >= 40 && first.size === CARDS.length, 'thứ tự khác nhau: ' + seen.size + ', thẻ từng đứng đầu: ' + first.size];
  });
  C('shuffle mặc định (không truyền rand) dùng randInt: vẫn giữ đủ phần tử', ['shuffle'], () => { const r = U.shuffle(CARDS); return [fmt([...r].sort()) === fmt([...CARDS].sort()), fmt(r)]; });

  /* ===== 5. randomId, randInt (5.3: id 20 ký tự [0-9a-z], crypto) ===== */
  H.section('5. randomId, randInt (5.3)');
  C('randomId(): 20 ký tự [0-9a-z]; 2.000 lần không trùng', ['randomId'], () => {
    const s = new Set(); let bad = '';
    for (let i = 0; i < 2000; i++) { const id = U.randomId(); if (!/^[0-9a-z]{20}$/.test(id)) bad = id; s.add(id); }
    return [!bad && s.size === 2000, bad || 'trùng: ' + (2000 - s.size)];
  });
  C('randInt(n): số nguyên 0…n−1; randInt(1) = 0', ['randInt'], () => {
    let ok = U.randInt(1) === 0;
    const hit = new Set();
    for (let i = 0; i < 500; i++) { const x = U.randInt(7); if (!Number.isInteger(x) || x < 0 || x > 6) ok = false; hit.add(x); }
    return [ok && hit.size === 7, 'giá trị gặp: ' + [...hit].sort().join(',')];
  });

  /* ===== 6. Giờ, ngày (5.3; 3 múi giờ qua runInTimezones) ===== */
  H.section('6. tzAt, dayOf, hourOf, dayAdd (5.3)');
  const TZ = process.env.TZ || 'UTC';
  const EXPECT_TZ = { 'Asia/Ho_Chi_Minh': 420, 'America/Los_Angeles': -480, 'Pacific/Kiritimati': 840, UTC: 0 };
  C('tzAt(10/11/2026) = độ lệch phút của máy (+420 VN, −480 LA, +840 Kiritimati, 0 UTC)', ['tzAt'], () => {
    const want = EXPECT_TZ[TZ]; const got = U.tzAt(Date.UTC(2026, 10, 10, 3, 0));
    return [want === undefined || got === want, 'TZ chạy: ' + (want === undefined ? 'khác' : 'đúng bảng') + (got === want ? '' : ' nhận ' + got)];
  });
  const AT = Date.UTC(2026, 10, 10, 18, 0, 0);   // 18:00 UTC 10/11
  C('dayOf(at, 420) = 2026-11-11 (sang ngày mới ở VN)', ['dayOf'], () => [U.dayOf(AT, 420) === '2026-11-11', U.dayOf(AT, 420)]);
  C('dayOf(at, −480) = 2026-11-10', ['dayOf'], () => [U.dayOf(AT, -480) === '2026-11-10', U.dayOf(AT, -480)]);
  C('dayOf(at, 840) = 2026-11-11', ['dayOf'], () => [U.dayOf(AT, 840) === '2026-11-11', U.dayOf(AT, 840)]);
  C('dayOf không phụ thuộc múi giờ máy (cùng tz → cùng ngày ở mọi TZ)', ['dayOf'], () => [U.dayOf(Date.UTC(2026, 0, 1, 16, 59), 420) === '2026-01-01' && U.dayOf(Date.UTC(2026, 0, 1, 17, 0), 420) === '2026-01-02', fmt([U.dayOf(Date.UTC(2026, 0, 1, 16, 59), 420), U.dayOf(Date.UTC(2026, 0, 1, 17, 0), 420)])]);
  C('hourOf(at, tz): 420 → 1, −480 → 10, 840 → 8', ['hourOf'], () => [U.hourOf(AT, 420) === 1 && U.hourOf(AT, -480) === 10 && U.hourOf(AT, 840) === 8, fmt([U.hourOf(AT, 420), U.hourOf(AT, -480), U.hourOf(AT, 840)])]);
  C('dayAdd qua năm, năm nhuận, lùi tháng, ngày đổi giờ mùa hè', ['dayAdd'], () => {
    const r = [U.dayAdd('2026-12-31', 1), U.dayAdd('2028-02-28', 1), U.dayAdd('2026-03-01', -1), U.dayAdd('2026-03-08', 1), U.dayAdd('2026-11-01', 7)];
    return [fmt(r) === fmt(['2027-01-01', '2028-02-29', '2026-02-28', '2026-03-09', '2026-11-08']), fmt(r)];
  });

  /* ===== 7. csvCell (5.5: thêm ' khi bắt đầu = + - @ tab CR) ===== */
  H.section('7. csvCell (5.5, AC-18)');
  for (const [v, want] of [['=1+1', "'=1+1"], ['+84', "'+84"], ['-2', "'-2"], ['@SUM(A1)', "'@SUM(A1)"], ['\tx', "'\tx"], ['\rx', "'\rx"], ['abc', 'abc'], ['Lo lắng', 'Lo lắng']]) {
    C('csvCell(' + JSON.stringify(v) + ') → ô có giá trị ' + JSON.stringify(want), ['csvCell'], () => { const c = U.csvCell(v); return [unq(c) === want, c]; });
  }
  C('csvCell có dấu phẩy / xuống dòng / nháy kép → bọc "…", nháy kép nhân đôi', ['csvCell'], () => {
    const a = U.csvCell('a,b'), b = U.csvCell('dòng 1\ndòng 2'), c = U.csvCell('nói "nhỏ"');
    return [/^".*"$/s.test(a) && /^".*"$/s.test(b) && c === '"nói ""nhỏ"""', fmt([a, b, c])];
  });
  C('csvCell(null/undefined) → ô rỗng', ['csvCell'], () => [unq(U.csvCell(null)) === '' && unq(U.csvCell(undefined)) === '', fmt([U.csvCell(null), U.csvCell(undefined)])]);

  /* ===== 8. clamp, thuần ===== */
  H.section('8. clamp; hàm thuần');
  C('clamp(v, a, b)', ['clamp'], () => [U.clamp(-1, 0, 10) === 0 && U.clamp(11, 0, 10) === 10 && U.clamp(5, 0, 10) === 5, '']);
  H.ok('util không tự lấy giờ (Date.now()/new Date() không tham số: 0 lần)', app.clock.calls === 0, 'gọi ' + app.clock.calls + ' lần');

  H.done();
}
