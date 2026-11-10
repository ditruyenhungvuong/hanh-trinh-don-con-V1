/* =========================================================
   Unit test js/engine.js + js/keywords.js + danh mục js/data.js – Hành Trình Đón Con
   Chủ: qa-tester (T-Q1 10/11/2026). Viết TỪ ĐẶC TẢ (tech design 6, 14.1; PRD v0.3 mục 8, AC-25…42), không theo mã hiện có.
   Nội dung:
    1. SAFETY_BANK STOP-4P nguyên văn (tests/lib/safety-bank.js): urgent → selfHarm, noturgent → không, human → human.
       Câu "phys" (nhóm cơ thể của STOP-4P) không áp dụng: HTDC bỏ nhóm đó, có nhóm 8.2b riêng.
    2. Bộ câu mới nhóm 8.2, 8.2b (tests/lib/safety-bank-htdc.js), ≥ 1 bắt + ≥ 1 không bắt mỗi nhóm (AC-30).
    3. Từ khóa STOP-4P chép NGUYÊN VĂN (so từng phần tử với apps/lifestyle-thai-phu/js/data.js KEYWORDS).
    4. detectPII (AC-33), band, assess (AC-25, 27, 28).
    5. recommend: ≥ 1 ca mỗi R1–R8 + R3b (AC-39, 39e), K-6 / L-6 (AC-27), L-7 câu ghi nhận tự trách, AC-29, AC-31,
       AC-39b, lọc phút, "Đổi gợi ý" xoay vòng, A1 vs A2; thứ tự thẻ PRD 8.1.
    6. Không hạ mức: 1.000 tổ hợp ngẫu nhiên (hạt giống cố định) — thêm thông tin không làm mất cờ / thẻ an toàn.
    7. library, validate, ALLOW_DRAFT_CONTENT bật/tắt (AC-34, K-14 câu an toàn không ẩn).
    8. nightList / nightGate / gateOutcome (AC-40, 41, 42) — chặn bài em bé sau tin buồn và khi phiên có nhóm "Mất con".
    9. check.* (5.5 kiểm shape; AC-23 không lưu cờ / câu trả lời an toàn; AC-56 bản ghi Hai ta không trường lạ), stageCard.
   10. Danh mục data.js: B1–B8 đủ trường (AC-50), không holdsBreath (AC-36), 11 thẻ cảm xúc + 9 ảnh, giai đoạn, vai.
   11. Hàm thuần: không tự lấy giờ.
   Quy ước: hàm/dữ liệu chưa có → CHỜ T-02 (FE-2) hoặc T-05 (FE-5); có hàm thì mọi ca phải chạy. Có FAIL → exit 1.
   T-Q2 (qa-tester 10/11/2026) siết theo chỗ đã chốt ở tech design 6.3 / 6.5 (T-I1):
    - `available` nhận hàm (tên màn → bool, như api.has) | mảng | Set tên màn; bỏ trống = chỉ màn A1 (mục 5b).
    - R8 nối ở MỌI attempt (kể cả 0), trừ mức thấp và dòng R1: danh sách gợi ý = đúng cửa sổ attempt × 2 (so BẰNG).
    - `rule` = dòng khớp gốc, `list` = dòng cấp ứng viên ('R3' khi mức thấp đổi), `reason` = list hoặc 'R8'.
    - "bị đánh thức": không vào nhóm home (exclude T-I1), human STOP-4P nguyên văn vẫn bắt (mục 2b).
   Chạy: node tests/unit-engine.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createHarness, fmt, rng } = require('./lib/harness');
const { loadApp, PURE_CHAIN, APP } = require('./lib/load');
const SAFETY_BANK = require('./lib/safety-bank');
const HTDC_BANK = require('./lib/safety-bank-htdc');

const H = createHarness('unit-engine');
const app = loadApp(PURE_CHAIN, { now: Date.UTC(2026, 10, 10, 2, 0, 0) });
const W = app.win;
const E = W.HTDC_ENGINE || {}, D = W.HTDC_DATA || {}, K = W.HTDC_KEYWORDS || {}, CFG = W.HTDC_CONFIG || {};

/* ===== Hằng số theo đặc tả ===== */
const B_IDS = ['PAUSE5', 'BREATHE_46', 'GROUND_54321', 'RELEASE', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN', 'CALM_SOUND', 'WARM_HAND_DAY'];  // B1…B8
const A2_IDS = ['THREE_QUESTIONS', 'SEND_WORDS'];
const NIGHT = ['NIGHT_HOME', 'NIGHT_HOME_SHORT', 'NIGHT_TOGETHER', 'NIGHT_WARM_HAND'];
const BABY = ['NIGHT_HOME', 'NIGHT_HOME_SHORT'];
const ROWS = {
  R1: ['CALM_SOUND', 'PAUSE5'], R2: ['WARM_HAND_DAY', 'CALM_SOUND', 'PAUSE5'], R3: ['BREATHE_46', 'GROUND_54321', 'PAUSE5'],
  R3b: ['WARM_HAND_DAY', 'THOUGHT_CLOUD'], R4: ['THOUGHT_CLOUD', 'KNOW_UNKNOWN'], R5: ['THREE_QUESTIONS', 'SEND_WORDS', 'WARM_HAND_DAY'],
  R6: ['CALM_SOUND', 'RELEASE'], R7: ['RELEASE'], R8: ['BREATHE_46', 'GROUND_54321', 'THOUGHT_CLOUD']
};
const CALM_FIRST = ['hoang_hot', 'tuc_gian', 'lo_lang', 'kho_chiu'];
const EMOS = ['vui_ve', 'dau_kho', 'lo_lang', 'tuc_gian', 'hoang_hot', 'kho_chiu', 'met_moi', 'binh_an', 'co_don', 'self_blame', 'unsure'];
const IMGS = ['vui_ve.png', 'dau_kho.png', 'lo_lang.png', 'tuc_gian.png', 'hoang_hot.png', 'kho_chiu.png', 'met_moi.png', 'binh_an.png', 'co_don.png'];
const STAGES = ['start', 'cycle', 'waiting', 'after_loss', 'pause', 'positive', 'none'];
const SAFETY_CARDS = ['need_doctor', 'not_alone', 'self_blame_ack', 'ask_stage_change'];   // thứ tự PRD 8.1
const PRD_MIN = { PAUSE5: 0.5, BREATHE_46: 2, GROUND_54321: 3, RELEASE: 5, THOUGHT_CLOUD: 3, KNOW_UNKNOWN: 3, CALM_SOUND: 5, WARM_HAND_DAY: 4 };
const A1_SCREENS = ['welcome', 'consent', 'role', 'stage', 'home', 'result', 'loss_soft', 'good_news', 'support', 'urgent', 'about', 'pause5', 'checkin',
  'safety_q', 'suggest', 'library', 'player', 'checkout', 'done', 'night', 'night_how', 'night_play', 'night_heavy', 'mydata', 'never'];
const A2_SCREENS = ['together', 'together_stop5', 'together_breathe', 'together_talk', 'send_words', 'care', 'journal'];

/* `available`: đặc tả 6.3/6.5 chưa chốt shape → hàm (gọi được) có thêm has/includes/indexOf/iterator, chứa khóa màn + id bài */
function avail(list) {
  const s = new Set(list);
  const f = x => s.has(x);
  f.has = x => s.has(x); f.includes = x => s.has(x); f.indexOf = x => [...s].indexOf(x);
  f[Symbol.iterator] = function* () { yield* s; };
  Object.defineProperty(f, 'size', { value: s.size });
  f.toJSON = () => [...s];
  return f;
}
const A1 = avail([...B_IDS, ...NIGHT, ...A1_SCREENS]);
const A2 = avail([...B_IDS, ...NIGHT, ...A1_SCREENS, ...A2_SCREENS, ...A2_IDS, 'C1', 'C2', 'C3', 'C4']);

/* ===== Tiện ích ===== */
const isSet = x => Object.prototype.toString.call(x) === '[object Set]';
const arr = x => (x == null ? [] : isSet(x) ? [...x] : Array.isArray(x) ? x.slice() : typeof x === 'object' ? Object.keys(x).filter(k => x[k]) : [x]);
const ids = r => arr(r && r.suggestions).map(s => (s && typeof s === 'object' ? s.id : s));
const cards = r => arr(r && r.cards).map(c => (c && typeof c === 'object' ? (c.id || c.kind || c.type) : c));
const has = (path) => {   // 'E.recommend', 'D.EXERCISES', 'SC.SCRIPTS'
  const [o, ...rest] = path.split('.');
  const root = { E, D, K, C: CFG, SC: W.HTDC_SCRIPTS || {} }[o];
  const v = rest.reduce((a, k) => (a == null ? undefined : a[k]), root);
  return typeof v === 'function' || (v != null && typeof v === 'object' && (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0));
};
const taskOf = p => (p.startsWith('SC.') ? 'T-05 (FE-5)' : 'T-02 (FE-2)');
/* Một ca: thiếu → CHỜ <task>; lỗi ném ra → FAIL */
function C(name, needs, fn) {
  const miss = needs.filter(p => !has(p));
  if (miss.length) return H.wait(name, 'CHỜ ' + [...new Set(miss.map(taskOf))].join(', ') + ' — chưa có ' + miss.join(', '));
  H.run(name, () => { const r = fn(); if (Array.isArray(r)) H.ok(name, !!r[0], r[1]); else if (r !== undefined) H.ok(name, !!r); });
}
const exList = () => (Array.isArray(D.EXERCISES) ? D.EXERCISES : Object.entries(D.EXERCISES || {}).map(([k, v]) => Object.assign({ id: k }, v)));
const ex = id => exList().find(x => x && x.id === id);
const minOf = id => { const x = ex(id); return x && typeof x.min === 'number' ? x.min : PRD_MIN[id]; };
const withDraft = (on, fn) => { const old = CFG.ALLOW_DRAFT_CONTENT; CFG.ALLOW_DRAFT_CONTENT = on; try { return fn(); } finally { CFG.ALLOW_DRAFT_CONTENT = old; } };

/* Đầu vào mặc định của recommend: mức 7 (ok), không thẻ, giai đoạn cycle, 10 giờ sáng, A1 */
const IN = o => Object.assign({ level: 7, emotions: [], contexts: [], stage: 'cycle', minutes: null, hour: 10, flags: new Set(), available: A1 }, o || {});
const rec = (o, attempt) => E.recommend(IN(o), attempt || 0);

/* Tổ hợp ngẫu nhiên (hạt giống cố định) cho mục 7 và 9 */
const TEXTS = ['', 'hôm nay mình thấy lo', 'tuyệt vọng quá', 'lỗi tại mình hết', 'chồng đòi ly hôn', 'mình vừa sẩy thai', 'mất ngủ cả tuần nay', 'đau bụng dữ dội', 'bị bạo hành', 'trời mưa'];
const CTX = ['waiting', 'couple', 'sleep'];
function randomInput(r) {
  const pick = a => a[Math.floor(r() * a.length)];
  const em = []; const n = Math.floor(r() * 4); for (let k = 0; k < n; k++) { const e = pick(EMOS); if (!em.includes(e)) em.push(e); }
  return { level: r() < 0.15 ? null : 1 + Math.floor(r() * 10), emotions: em, contexts: CTX.filter(() => r() < 0.3), stage: pick([...STAGES, null]),
    minutes: pick([null, 1, 3, 5, 10]), hour: Math.floor(r() * 24), flags: new Set(), texts: [pick(TEXTS)] };
}

/* ===== Mô hình tham chiếu viết từ bảng 6.5 (chỉ dùng để tính danh sách mong đợi) ===== */
function bandOf(l) { return typeof l !== 'number' || !Number.isInteger(l) || l < 1 || l > 10 ? null : l <= 3 ? 'low' : l <= 5 ? 'mid' : 'ok'; }
function ruleOf(i) {
  const em = i.emotions || [], fl = new Set(arr(i.flags)), cx = i.contexts || [];
  if (fl.has('body')) return 'R1';
  if (em.includes('dau_kho') || i.stage === 'after_loss') return 'R2';
  if (em.some(e => CALM_FIRST.includes(e))) return 'R3';
  if (em.includes('self_blame')) return 'R3b';
  if (i.stage === 'waiting') return 'R4';
  if (em.includes('co_don') || cx.includes('couple')) return 'R5';
  if (em.includes('met_moi')) return 'R6';
  if (cx.includes('sleep') || (typeof i.hour === 'number' && i.hour >= 21)) return 'R7';
  return 'R8';
}
function filt(list, i, low, a2) {
  let l = list.slice();
  if (i.stage === 'after_loss' || (i.emotions || []).includes('dau_kho')) l = l.filter(x => !['BREATHE_46', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN'].includes(x));
  if (low) l = l.filter(x => !['THOUGHT_CLOUD', 'KNOW_UNKNOWN'].includes(x));
  if (i.minutes != null) { l = l.filter(x => (minOf(x) == null ? true : minOf(x) <= i.minutes)); if (!l.length) l = ['PAUSE5']; }
  if (!a2) l = l.filter(x => !A2_IDS.includes(x));
  return l.filter(x => !!ex(x));   // validate: chỉ id trong danh mục

}
function model(o) {
  const i = IN(o), low = bandOf(i.level) === 'low', a2 = i.available === A2;
  let rule = ruleOf(i);
  const eff = low && !['R1', 'R2', 'R3', 'R3b'].includes(rule) ? 'R3' : rule;
  const row = filt(ROWS[eff], i, low, a2);
  const list = row.slice();
  if (!low && rule !== 'R1') for (const x of filt(ROWS.R8, i, low, a2)) if (!list.includes(x)) list.push(x);
  return { rule, eff, row, list, low };
}
const windowOf = (list, attempt) => { if (list.length <= 2) return list.slice(); const s = (attempt * 2) % list.length; return [list[s], list[(s + 1) % list.length]]; };

/* =========================================================
   1. SAFETY_BANK STOP-4P (AC-25)
   ========================================================= */
H.section('1. SAFETY_BANK STOP-4P nguyên văn (AC-25)');
if (typeof E.safetyCheck !== 'function') {
  H.wait('SAFETY_BANK STOP-4P: ' + SAFETY_BANK.length + ' câu (urgent/noturgent/human/nothuman)', 'CHỜ T-02 (FE-2) — chưa có E.safetyCheck');
} else {
  let phys = 0;
  for (const [t, exp, src] of SAFETY_BANK) {
    const e = exp.replace('*', ''), star = exp.endsWith('*');
    if (e === 'phys') { phys++; continue; }
    const name = 'bank ' + src + ': "' + t + '" → ' + e;
    H.run(name, () => {
      const r = E.safetyCheck(t) || {};
      const ok = { urgent: r.selfHarm === true, noturgent: !r.selfHarm, human: !r.selfHarm && r.human === true, nothuman: !r.selfHarm && !r.human }[e];
      if (star && ok) H.limit(name, 'giới hạn đã biết của STOP-4P (chép nguyên văn)');
      else H.ok(name, ok, fmt(r));
    });
  }
  H.ok('bank: ' + phys + ' câu "phys" của STOP-4P không áp dụng (HTDC bỏ nhóm cơ thể STOP-4P, có 8.2b riêng) — ghi nhận', phys === 3, phys);
  for (const t of ['mệt muốn chết', 'mình muốn tự tử', 'không muốn sống nữa', 'muon chet', 'mún chết']) {
    C('tự hại: "' + t + '" → selfHarm (PRD 8.1 bước 1)', ['E.safetyCheck'], () => { const r = E.safetyCheck(t); return [r && r.selfHarm === true, fmt(r)]; });
  }
  C('safetyCheck trả đủ khóa {selfHarm, human, groups[], body}', ['E.safetyCheck'], () => {
    const r = E.safetyCheck('hôm nay mình thấy lo');
    return [r && typeof r.selfHarm === 'boolean' && typeof r.human === 'boolean' && Array.isArray(arr(r.groups)) && typeof r.body === 'boolean' && arr(r.groups).length === 0 && !r.selfHarm && !r.human && !r.body, fmt(r)];
  });
  C('safetyCheck("") / null / undefined không ném lỗi, không cờ nào', ['E.safetyCheck'], () => {
    const rs = ['', null, undefined, '   '].map(x => E.safetyCheck(x));
    return [rs.every(r => r && !r.selfHarm && !r.human && !r.body && arr(r.groups).length === 0), fmt(rs)];
  });
}

/* =========================================================
   2. Bộ câu mới 8.2, 8.2b (AC-30, AC-31)
   ========================================================= */
H.section('2. Nhóm 8.2 + 8.2b (safety-bank-htdc.js, AC-30, AC-31)');
if (typeof E.safetyCheck !== 'function') {
  H.wait('bộ câu 8.2/8.2b: ' + HTDC_BANK.length + ' câu', 'CHỜ T-02 (FE-2) — chưa có E.safetyCheck');
} else {
  const perGroup = {};
  for (const [t, g, exp, note] of HTDC_BANK) {
    const soft = exp.endsWith('?'), anh = exp.endsWith('!'), want = exp.replace(/[?!]/, '') === 'yes';
    const name = (want ? 'bắt' : 'không bắt') + ' [' + g + ']: "' + t + '"' + (note ? ' (' + note + ')' : '');
    H.run(name, () => {
      const r = E.safetyCheck(t) || {};
      const got = g === 'body' ? r.body === true : arr(r.groups).includes(g);
      const ok = got === want && (!want || !r.selfHarm);
      if (anh) return ok ? H.ok(name, true) : H.wait(name, 'CHỜ ANH — cụm PRD 8.2 bắt nhầm câu vô hại, anh Thông quyết giữ/bỏ: ' + fmt(r));
      if (!soft) { perGroup[g] = perGroup[g] || { y: 0, n: 0 }; if (ok) perGroup[g][want ? 'y' : 'n']++; }
      if (soft && !ok) H.limit(name, 'QA gợi ý (chưa có trong đặc tả): nhận ' + fmt(r));
      else H.ok(name, ok, fmt(r));
    });
  }
  for (const g of ['hopeless', 'selfblame', 'home', 'loss', 'prolonged', 'body']) {
    const c = perGroup[g] || { y: 0, n: 0 };
    H.ok('AC-30: nhóm ' + g + ' có ≥ 1 câu bắt đúng và ≥ 1 câu không bắt đúng', c.y >= 1 && c.n >= 1, fmt(c));
  }
}

/* T-Q2: "bị đánh thức" — T-I1 thêm exclude cho nhóm home; nhóm human là STOP-4P NGUYÊN VĂN nên vẫn bắt (giới hạn chờ anh) */
H.section('2b. "bị đánh thức" (T-I1 exclude nhóm home; human STOP-4P nguyên văn)');
for (const t of ['mình bị đánh thức lúc ba giờ sáng', 'bi danh thuc luc 3h sang', 'đêm qua con mèo làm mình bị đánh thức']) {
  C('"' + t + '" → không nhóm home, human = true (STOP-4P), không selfHarm', ['E.safetyCheck'], () => {
    const r = E.safetyCheck(t) || {};
    return [!arr(r.groups).includes('home') && r.human === true && !r.selfHarm, fmt(r)];
  });
}
C('exclude chỉ gỡ "bị đánh thức": "bị đánh thức rồi lại bị đánh" vẫn vào nhóm home', ['E.safetyCheck'], () => { const r = E.safetyCheck('bị đánh thức rồi lại bị đánh'); return [arr(r.groups).includes('home'), fmt(r)]; });

/* =========================================================
   3. Từ khóa STOP-4P nguyên văn (tech design 6.2, ADR 0008)
   ========================================================= */
H.section('3. keywords.js: phần STOP-4P chép NGUYÊN VĂN (6.2)');
{
  let L = null;
  try {
    const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
    const base = path.join(APP, '..', 'lifestyle-thai-phu', 'js');
    vm.runInContext(fs.readFileSync(path.join(base, 'config.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(base, 'data.js'), 'utf8'), ctx);
    L = ctx.LSTP_DATA && ctx.LSTP_DATA.KEYWORDS;
  } catch (e) { L = null; }
  const sig = v => JSON.stringify(v, (k, x) => (x instanceof RegExp || Object.prototype.toString.call(x) === '[object RegExp]' ? String(x) : x));
  const PAIRS = [['urgent.strict', 'urgent.strict'], ['urgent.loose', 'urgent.loose'], ['urgent.strictPatterns', 'urgent.strictPatterns'],
    ['urgent.patterns', 'urgent.patterns'], ['urgent.teen', 'urgent.teen'], ['human.list', 'human'], ['human.strict', 'humanStrict'], ['human.patterns', 'humanPatterns']];
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  if (!L) H.wait('so nguyên văn với apps/lifestyle-thai-phu/js/data.js', 'không nạp được file nguồn lifestyle (không phải lỗi app)');
  else for (const [mine, theirs] of PAIRS) {
    C('K.' + mine + ' = lifestyle KEYWORDS.' + theirs + ' (nguyên văn STOP-4P)', ['K.urgent', 'K.human'], () => [sig(get(K, mine)) === sig(get(L, theirs)), 'HTDC ' + String(sig(get(K, mine))).slice(0, 120)]);
  }
  C('K.groups có đủ 5 nhóm 8.2 (hopeless, selfblame, home, loss, prolonged), K.body có (8.2b)', ['K.groups', 'K.body'], () => {
    const g = Object.keys(K.groups || {});
    return [['hopeless', 'selfblame', 'home', 'loss', 'prolonged'].every(x => g.includes(x)) && !!K.body, g.join(',')];
  });
  C('K không còn nhóm thai kỳ của lifestyle (harmBaby, DANGER_SIGNS) — tech design 2.1', ['K.urgent'], () => [!('harmBaby' in K) && !('DANGER_SIGNS' in K) && !('harmBaby' in (K.urgent || {})), Object.keys(K).join(',')]);
  const PRD82 = { hopeless: ['hết hy vọng', 'không còn hy vọng', 'tuyệt vọng', 'buông xuôi'], selfblame: ['tại tôi', 'lỗi tại mình', 'mình vô dụng', 'mình là gánh nặng'],
    home: ['bị ép', 'bị đánh', 'đòi bỏ', 'đòi ly hôn', 'bị chửi', 'mẹ chồng ép'], loss: ['sẩy thai', 'thai lưu', 'mất bé', 'mất con', 'hư thai'],
    prolonged: ['mất ngủ cả tuần', 'khóc suốt', 'không làm được gì'] };
  for (const [g, list] of Object.entries(PRD82)) {
    C('K.groups.' + g + '.strict có đủ cụm PRD 8.2', ['K.groups'], () => { const s = arr(K.groups[g] && K.groups[g].strict).map(x => String(x).normalize('NFC')); const miss = list.filter(x => !s.includes(x)); return [!miss.length, 'thiếu: ' + miss.join(', ')]; });
  }
  C('K.body.strict có đủ 6 cụm PRD 8.2b', ['K.body'], () => { const s = arr(K.body.strict).map(x => String(x).normalize('NFC')); const miss = ['đau bụng dữ dội', 'bụng chướng to', 'khó thở nhiều', 'ra máu nhiều', 'sốt cao', 'ngất'].filter(x => !s.includes(x)); return [!miss.length, 'thiếu: ' + miss.join(', ')]; });
  C('K.pii danh xưng PRD 8.6 (chồng, vợ, anh, chị, em, mẹ chồng, bố chồng, bác sĩ, điều dưỡng); bỏ bn, giường, phòng', ['K.pii'], () => {
    const t = arr(K.pii.titles).map(x => String(x).normalize('NFC'));
    const miss = ['chồng', 'vợ', 'anh', 'chị', 'em', 'mẹ chồng', 'bố chồng', 'bác sĩ', 'điều dưỡng'].filter(x => !t.includes(x));
    const extra = ['bn', 'giường', 'phòng'].filter(x => t.includes(x));
    return [!miss.length && !extra.length, 'thiếu: ' + miss.join(',') + ' · thừa: ' + extra.join(',')];
  });
}

/* =========================================================
   4. detectPII, band, assess
   ========================================================= */
H.section('4a. detectPII (AC-33, PRD 8.6)');
const PII_YES = [
  ['0912 345 678', ['phone', 'digits'], 'AC-33'], ['mã IVF 2611234', ['code', 'digits'], 'AC-33'], ['chồng mình là anh Trần Minh Quân', ['name'], 'AC-33'],
  ['0912345678', ['phone', 'digits'], ''], ['+84 912 345 678', ['phone', 'digits'], ''], ['0912.345.678', ['phone', 'digits'], ''],
  ['email mình là thu.ha@gmail.com', ['email'], ''], ['số hồ sơ: HM-2026-001', ['code'], 'PRD 8.6'], ['mã bệnh nhân 88213', ['code'], 'PRD 8.6'],
  ['nhà ở số nhà 12 đường Lê Lợi', ['address'], 'PRD 8.6'], ['phường Bến Thành', ['address'], 'PRD 8.6'], ['dãy 123456', ['digits', 'phone'], '≥ 6 chữ số'],
  ['mẹ chồng là bà Lan', ['name'], 'danh xưng mới'], ['hôm nay gặp bác sĩ Nguyễn Văn Hùng', ['name'], 'danh xưng mới']
];
const PII_NO = ['hôm nay mình thấy lo', 'chồng mình đi làm về muộn', 'chờ 14 ngày nữa mới biết', 'Mình đi bộ 30 phút', 'Kết quả ngày 20/11', 'anh ấy ôm mình'];
for (const [t, why, note] of PII_YES) {
  C('PII bắt: "' + t + '" → ' + why.join('|') + (note ? ' (' + note + ')' : ''), ['E.detectPII'], () => {
    const r = arr(E.detectPII(t));
    return [r.some(h => why.includes(h.why)) && r.every(h => typeof h.text === 'string' && t.includes(h.text)), fmt(r)];
  });
}
for (const t of PII_NO) C('PII không bắt: "' + t + '"', ['E.detectPII'], () => { const r = arr(E.detectPII(t)); return [r.length === 0, fmt(r)]; });
C('detectPII("") / null → []', ['E.detectPII'], () => [arr(E.detectPII('')).length === 0 && arr(E.detectPII(null)).length === 0, '']);

H.section('4b. band (6.3: low 1–3, mid 4–5, ok 6–10, còn lại null)');
C('band 1..10 và giá trị lạ', ['E.band'], () => {
  const got = [1, 2, 3, 4, 5, 6, 7, 10, 0, 11, null, undefined, '5', 2.5, NaN].map(x => E.band(x));
  const want = ['low', 'low', 'low', 'mid', 'mid', 'ok', 'ok', 'ok', null, null, null, null, null, null, null];
  const ok = got.slice(0, 10).every((g, k) => g === want[k]) && got.slice(10).every(g => g == null || g === 'mid');   // '5' chuỗi: chấp nhận null hoặc mid
  return [ok && got[8] == null && got[9] == null, fmt(got)];
});

H.section('4c. assess (AC-25, 27, 28; tech design 6.4)');
const AS = o => E.assess(Object.assign({ texts: [], level: 7, emotions: [], flags: new Set() }, o));
const fl = r => new Set(arr(r && r.flags));
C('tự hại trong ô viết → route urgent, cờ self_harm (AC-25)', ['E.assess'], () => { const r = AS({ texts: ['mình muốn tự tử'] }); return [r.route === 'urgent' && fl(r).has('self_harm'), fmt(r)]; });
C('tự hại + mức 2 → urgent đứng trước safety_q (PRD 8.1)', ['E.assess'], () => { const r = AS({ texts: ['muốn chết cho xong'], level: 2 }); return [r.route === 'urgent', fmt(r)]; });
C('tự hại ở ô thứ hai trong texts vẫn bắt', ['E.assess'], () => { const r = AS({ texts: ['bình thường', 'không muốn sống nữa'] }); return [r.route === 'urgent', fmt(r)]; });
for (const l of [1, 2, 3]) C('mức ' + l + ' → safety_q (AC-27)', ['E.assess'], () => { const r = AS({ level: l }); return [r.route === 'safety_q', fmt(r)]; });
for (const l of [4, 5, 6, 10, null]) C('mức ' + l + ' → next, không M08 (AC-28)', ['E.assess'], () => { const r = AS({ level: l }); return [r.route === 'next', fmt(r)]; });
C('assess trả flags là Set (6.3)', ['E.assess'], () => { const r = AS({}); return [isSet(r.flags), fmt(r)]; });
const GROUP_CASES = [['tuyệt vọng quá', ['not_alone']], ['lỗi tại mình hết', ['not_alone', 'self_blame']], ['chồng đòi ly hôn', ['not_alone']],
  ['mình vừa sẩy thai', ['not_alone', 'loss']], ['mất ngủ cả tuần nay', ['not_alone']], ['đau bụng dữ dội', ['body']], ['bị bạo hành', ['not_alone']]];
for (const [t, want] of GROUP_CASES) C('assess "' + t + '" → cờ ' + want.join(' + ') + ', route next', ['E.assess'], () => { const r = AS({ texts: [t] }); const f = fl(r); return [want.every(x => f.has(x)) && r.route === 'next', fmt(r)]; });
C('assess "mất ngủ cả tuần" → có cờ kéo dài (prolonged hoặc two_weeks)', ['E.assess'], () => { const f = fl(AS({ texts: ['mất ngủ cả tuần nay'] })); return [f.has('prolonged') || f.has('two_weeks'), fmt([...f])]; });
for (const [em, l, want] of [['co_don', 5, true], ['dau_kho', 4, true], ['co_don', 3, true], ['co_don', 6, false], ['dau_kho', 8, false], ['lo_lang', 4, false]]) {
  C('thẻ ' + em + ' + mức ' + l + ' → cờ not_alone ' + (want ? 'CÓ' : 'KHÔNG') + ' (PRD 8.1 bước 4: Cô đơn/Đau khổ & mức ≤ 5)', ['E.assess'], () => {
    const f = fl(AS({ emotions: [em], level: l })); return [f.has('not_alone') === want, fmt([...f])];
  });
}
C('thẻ Tự trách → cờ self_blame (L-7)', ['E.assess'], () => { const f = fl(AS({ emotions: ['self_blame'] })); return [f.has('self_blame'), fmt([...f])]; });
C('cờ cũ luôn còn: flags vào {loss, body, not_alone} + câu vô hại → ra ⊇ vào (6.4 "chỉ cộng")', ['E.assess'], () => {
  const r = AS({ texts: ['hôm nay trời đẹp'], level: 9, flags: new Set(['loss', 'body', 'not_alone', 'self_blame']) });
  const f = fl(r); return [['loss', 'body', 'not_alone', 'self_blame'].every(x => f.has(x)), fmt([...f])];
});
C('assess không sửa Set đầu vào theo hướng xóa (vào vẫn đủ phần tử)', ['E.assess'], () => { const s = new Set(['loss']); AS({ flags: s, texts: ['ok'] }); return [s.has('loss'), fmt([...s])]; });

/* =========================================================
   5. recommend – bảng R1–R8 + R3b (AC-39, 39e)
   ========================================================= */
H.section('5. recommend – bảng luật (AC-39, AC-39e)');
/* Kiểm một ca: rule (khi không ở band low), phần đầu danh sách, ≤ 2, phần thêm ⊆ R8 (hoặc ⊆ dòng khi low / R1) */
function checkRow(name, o, extra) {
  C(name, ['E.recommend', 'D.EXERCISES'], () => {
    const r = rec(o), m = model(o), got = ids(r);
    /* T-Q2: so BẰNG cửa sổ của danh sách đầy đủ (dòng + R8 khi không low / R1) ở attempt 0..3; rule gốc, list, reason */
    const wins = [0, 1, 2, 3].map(a => ids(rec(o, a))), want = [0, 1, 2, 3].map(a => windowOf(m.list, a));
    const reasons = [0, 1, 2, 3].flatMap(a => arr(rec(o, a).suggestions)).filter(x => (m.row.includes(x.id) ? x.reason !== m.eff : x.reason !== 'R8'));
    const ruleOk = r.rule === m.rule && r.list === m.eff;
    let ok = ruleOk && got.length <= 2 && got.length >= 1 && fmt(wins) === fmt(want) && !reasons.length;
    let why = 'rule/list ' + r.rule + '/' + r.list + ' (cần ' + m.rule + '/' + m.eff + ') · attempt 0..3 ' + fmt(wins) + ' (cần ' + fmt(want) + ')' + (reasons.length ? ' · reason sai ' + fmt(reasons) : '');
    if (extra) { const e = extra(r, got); if (e !== true) { ok = false; why += ' · ' + e; } }
    return [ok, why + ' · thẻ ' + fmt(cards(r))];
  });
}
checkRow('R1: cờ body → Âm thanh êm dịu, Dừng 5 giây; thẻ need_doctor (AC-31)', { flags: new Set(['body']) }, (r) => cards(r).includes('need_doctor') || 'thiếu need_doctor');
checkRow('R1 thắng R3: body + Lo lắng → R1', { flags: new Set(['body']), emotions: ['lo_lang'] });
checkRow('R1 thắng R2: body + after_loss → R1', { flags: new Set(['body']), stage: 'after_loss' });
checkRow('R2: thẻ Đau khổ → Bàn tay ấm bản ngày, Âm thanh êm dịu', { emotions: ['dau_kho'] });
checkRow('R2: giai đoạn after_loss, không thẻ → R2', { stage: 'after_loss' });
checkRow('R2 thắng R3: Đau khổ + Lo lắng → R2', { emotions: ['dau_kho', 'lo_lang'] });
for (const e of CALM_FIRST) checkRow('R3: thẻ ' + e + ' → Thở 4–6, Về với lúc này', { emotions: [e] });
checkRow('R3b (AC-39e): chỉ thẻ Tự trách, mức 7 → Bàn tay ấm bản ngày, Đặt tên suy nghĩ + câu ghi nhận', { emotions: ['self_blame'] }, r => cards(r).includes('self_blame_ack') || 'thiếu self_blame_ack');
checkRow('R3b (AC-39e): Tự trách, mức bỏ qua (null) → R3b', { emotions: ['self_blame'], level: null });
checkRow('AC-39e: Tự trách + Lo lắng → R3 VÀ vẫn có câu ghi nhận', { emotions: ['self_blame', 'lo_lang'] }, r => cards(r).includes('self_blame_ack') || 'thiếu self_blame_ack');
checkRow('AC-39e: Tự trách + Đau khổ → R2 VÀ vẫn có câu ghi nhận', { emotions: ['self_blame', 'dau_kho'] }, r => cards(r).includes('self_blame_ack') || 'thiếu self_blame_ack');
checkRow('R3b thắng R4: Tự trách + waiting → R3b', { emotions: ['self_blame'], stage: 'waiting' });
checkRow('R4: giai đoạn waiting → Đặt tên suy nghĩ, Biết chắc – Chưa biết', { stage: 'waiting' });
checkRow('R4 thắng R5: waiting + Cô đơn → R4', { stage: 'waiting', emotions: ['co_don'] });
checkRow('R5 (A1): thẻ Cô đơn → Bàn tay ấm bản ngày, không có bài A2; thẻ not_alone', { emotions: ['co_don'] },
  (r, g) => (!g.some(x => A2_IDS.includes(x)) && cards(r).includes('not_alone')) || 'có bài A2 hoặc thiếu not_alone');
checkRow('R5 (A1): chip couple → R5', { contexts: ['couple'] }, (r, g) => !g.some(x => A2_IDS.includes(x)) || 'có bài A2 ở A1');
checkRow('R5 (A2): thẻ Cô đơn → Ba câu cho nhau, Gửi lời cho người thương', { emotions: ['co_don'], available: A2 });
checkRow('R6: thẻ Mệt mỏi → Âm thanh êm dịu, Thả lỏng từng vùng', { emotions: ['met_moi'] });
checkRow('R7: chip sleep → thẻ go_night + Thả lỏng từng vùng', { contexts: ['sleep'] }, r => cards(r).includes('go_night') || 'thiếu go_night');
checkRow('R7: 21 giờ (LATE_HOUR) → R7', { hour: 21 }, r => cards(r).includes('go_night') || 'thiếu go_night');
checkRow('R7: 23 giờ → R7', { hour: 23 });
checkRow('R8: 20 giờ (chưa tới LATE_HOUR) → R8', { hour: 20 });
checkRow('R8: không thẻ, không chip → Thở 4–6, Về với lúc này', {});
checkRow('R8: thẻ Vui vẻ, Bình an không kích luật → R8', { emotions: ['vui_ve', 'binh_an'] });
checkRow('R8: chỉ "Chưa rõ" → R8, không câu ghi nhận (AC-39e)', { emotions: ['unsure'] }, r => !cards(r).includes('self_blame_ack') || 'có self_blame_ack khi chỉ chọn Chưa rõ');
checkRow('Chưa rõ + giai đoạn waiting → R4 (luật theo điều kiện khác)', { emotions: ['unsure'], stage: 'waiting' });
C('recommend: mặc định attempt = 0 (gọi 1 tham số = attempt 0)', ['E.recommend'], () => [fmt(E.recommend(IN({ emotions: ['lo_lang'] }))) === fmt(E.recommend(IN({ emotions: ['lo_lang'] }), 0)), '']);
C('recommend trả {rule, cards[], suggestions[{id, reason}]}', ['E.recommend'], () => {
  const r = rec({ emotions: ['lo_lang'] });
  return [typeof r.rule === 'string' && Array.isArray(arr(r.cards)) && arr(r.suggestions).every(s => s && typeof s.id === 'string' && 'reason' in s), fmt(r)];
});

/* T-Q2: `available` (chốt T-I1, 6.3): hàm tên màn → bool | mảng | Set tên màn; bỏ trống = chỉ màn A1 */
H.section('5b. Tham số available: hàm | mảng | Set | bỏ trống (tech design 6.3, chốt T-I1)');
{
  const A1S = A1_SCREENS, A2S = A1_SCREENS.concat(A2_SCREENS);
  const shapes = [['hàm (như api.has)', s => A1S.includes(s), s => A2S.includes(s)], ['mảng', A1S.slice(), A2S.slice()], ['Set', new Set(A1S), new Set(A2S)]];
  const a2InCat = A2_IDS.filter(id => !!ex(id));
  for (const [nm, a1, a2] of shapes) {
    C('available = ' + nm + ' (A1): R5 Cô đơn → [Bàn tay ấm, …R8], không bài A2', ['E.recommend', 'D.EXERCISES'], () => {
      const g = ids(E.recommend(IN({ emotions: ['co_don'], available: a1 })));
      return [g[0] === 'WARM_HAND_DAY' && !g.some(x => A2_IDS.includes(x)), fmt(g)];
    });
    C('available = ' + nm + ' (A2 có together_talk, send_words): validate giữ bài A2 có trong danh mục', ['E.validate', 'D.EXERCISES'], () => {
      const v = arr(E.validate(['THREE_QUESTIONS', 'SEND_WORDS', 'WARM_HAND_DAY'], { available: a2 }));
      return [fmt(v) === fmt(a2InCat.concat(['WARM_HAND_DAY'])), fmt(v) + ' cần ' + fmt(a2InCat.concat(['WARM_HAND_DAY']))];
    });
    C('available = ' + nm + ' không có "player" → không bài B nào', ['E.validate'], () => {
      const no = typeof a1 === 'function' ? (s => s !== 'player' && a1(s)) : Array.isArray(a1) ? a1.filter(s => s !== 'player') : new Set([...a1].filter(s => s !== 'player'));
      const v = arr(E.validate(B_IDS, { available: no })); return [v.length === 0, fmt(v)];
    });
  }
  C('available bỏ trống → chỉ màn A1 (player, night_how): B1–B8 + 4 bài đêm còn, A2 bị bỏ', ['E.validate'], () => {
    const v = arr(E.validate([...B_IDS, ...NIGHT, ...A2_IDS], {}));
    return [fmt(v) === fmt([...B_IDS, ...NIGHT]), fmt(v)];
  });
  C('available rỗng (mảng []) → không bài nào (khác bỏ trống)', ['E.validate'], () => { const v = arr(E.validate(B_IDS, { available: [] })); return [v.length === 0, fmt(v)]; });
  C('available = hàm nhận TÊN MÀN (không nhận id bài): được gọi với "player" / "night_how" / together_*', ['E.validate'], () => {
    const seen = new Set(); E.validate([...B_IDS, ...NIGHT, ...A2_IDS], { available: s => { seen.add(s); return true; } });
    const ok = [...seen].every(s => A1_SCREENS.includes(s) || A2_SCREENS.includes(s)) && seen.has('player') && seen.has('night_how');
    return [ok, fmt([...seen])];
  });
}

/* =========================================================
   6. Mức (band) – K-6, L-6 (AC-27), mid (AC-29)
   ========================================================= */
H.section('6. Mức 1–3 (K-6, L-6, AC-27) và 4–5 (AC-29)');
const NO_WRITE = ['THOUGHT_CLOUD', 'KNOW_UNKNOWN'];
function lowCase(name, o, want) {
  C(name, ['E.recommend', 'D.EXERCISES'], () => {
    const res = [0, 1, 2, 3].map(a => ({ a, r: rec(Object.assign({ level: 2, flags: new Set(['not_alone', 'low']) }, o), a) }));
    const g0 = ids(res[0].r);
    const all = res.flatMap(x => ids(x.r));
    const ok = fmt(g0.slice(0, want.length)) === fmt(want.slice(0, 2)) && all.every(x => !NO_WRITE.includes(x)) && all.every(x => model(Object.assign({ level: 2 }, o)).row.includes(x))
      && cards(res[0].r)[0 === cards(res[0].r).indexOf('need_doctor') ? 1 : 0] === 'not_alone';
    return [ok, 'attempt 0..3: ' + res.map(x => fmt(ids(x.r))).join(' ') + ' · thẻ ' + fmt(cards(res[0].r))];
  });
}
lowCase('AC-27: chấm 2 + Mệt mỏi → danh sách R3; "Đổi gợi ý" không ra R8; thẻ not_alone đầu', { emotions: ['met_moi'] }, ['BREATHE_46', 'GROUND_54321']);
lowCase('AC-27: chấm 2 + giai đoạn waiting → danh sách R3', { stage: 'waiting' }, ['BREATHE_46', 'GROUND_54321']);
lowCase('AC-27 / L-6: chấm 2 + Tự trách → CHỈ Bàn tay ấm bản ngày', { emotions: ['self_blame'] }, ['WARM_HAND_DAY']);
lowCase('K-6: chấm 1 + không thẻ (R8) → danh sách R3', { level: 1 }, ['BREATHE_46', 'GROUND_54321']);
lowCase('K-6: chấm 3 + 23 giờ (R7) → danh sách R3', { level: 3, hour: 23 }, ['BREATHE_46', 'GROUND_54321']);
lowCase('K-6: chấm 2 + Cô đơn (R5) → danh sách R3', { emotions: ['co_don'] }, ['BREATHE_46', 'GROUND_54321']);
lowCase('chấm 2 + Đau khổ → giữ R2 (Bàn tay ấm, Âm thanh êm dịu)', { emotions: ['dau_kho'] }, ['WARM_HAND_DAY', 'CALM_SOUND']);
lowCase('chấm 2 + Lo lắng → giữ R3', { emotions: ['lo_lang'] }, ['BREATHE_46', 'GROUND_54321']);
C('chấm 2 + Tự trách: câu ghi nhận vẫn có (L-7 mọi mức)', ['E.recommend'], () => { const r = rec({ level: 2, emotions: ['self_blame'], flags: new Set(['not_alone', 'low']) }); return [cards(r).includes('self_blame_ack'), fmt(cards(r))]; });
C('chấm 2, KHÔNG truyền cờ not_alone/low → vẫn có thẻ not_alone (6.5 bước 2: low → not_alone)', ['E.recommend'], () => { const r = rec({ level: 2, emotions: ['met_moi'] }); return [cards(r).includes('not_alone'), fmt(cards(r))]; });
C('chấm 2 + Mệt mỏi: rule = "R6" (dòng gốc, ghi StopRec), list = "R3", reason mọi gợi ý = "R3" (chốt T-I1)', ['E.recommend'], () => {
  const rs = [0, 1, 2].map(a => rec({ level: 2, emotions: ['met_moi'] }, a));
  return [rs.every(r => r.rule === 'R6' && r.list === 'R3' && arr(r.suggestions).every(x => x.reason === 'R3')), fmt(rs.map(r => [r.rule, r.list, arr(r.suggestions).map(x => x.reason)]))];
});
for (const [nm, o, rule, list] of [['chấm 1 + không thẻ', { level: 1 }, 'R8', 'R3'], ['chấm 3 + 23 giờ', { level: 3, hour: 23 }, 'R7', 'R3'], ['chấm 2 + waiting', { level: 2, stage: 'waiting' }, 'R4', 'R3'],
  ['chấm 2 + Cô đơn', { level: 2, emotions: ['co_don'] }, 'R5', 'R3'], ['chấm 2 + Tự trách', { level: 2, emotions: ['self_blame'] }, 'R3b', 'R3b'], ['chấm 2 + Đau khổ', { level: 2, emotions: ['dau_kho'] }, 'R2', 'R2'],
  ['chấm 7 + cờ phiên low (không hạ mức)', { level: 7, emotions: ['met_moi'], flags: new Set(['low']) }, 'R6', 'R3'], ['chấm 8 + cờ self_harm', { level: 8, flags: new Set(['self_harm']) }, 'R8', 'R3']]) {
  C('rule/list (chốt T-I1): ' + nm + ' → rule ' + rule + ', list ' + list, ['E.recommend'], () => { const r = rec(o); return [r.rule === rule && r.list === list && arr(r.suggestions).every(x => x.reason === list), fmt([r.rule, r.list, r.suggestions])]; });
}
C('mức thấp / cờ low: KHÔNG nối R8 ở mọi attempt (chấm 2 + Tự trách → chỉ [Bàn tay ấm] ở attempt 0..3)', ['E.recommend'], () => {
  const g = [0, 1, 2, 3].map(a => ids(rec({ level: 2, emotions: ['self_blame'] }, a)));
  return [g.every(x => fmt(x) === fmt(['WARM_HAND_DAY'])), fmt(g)];
});
for (const l of [4, 5]) C('AC-29: chấm ' + l + ' → thẻ two_weeks', ['E.recommend'], () => { const r = rec({ level: l, emotions: ['lo_lang'] }); return [cards(r).includes('two_weeks'), fmt(cards(r))]; });
for (const l of [6, 10, null]) C('chấm ' + l + ' → KHÔNG thẻ two_weeks (không cờ kéo dài)', ['E.recommend'], () => { const r = rec({ level: l, emotions: ['lo_lang'] }); return [!cards(r).includes('two_weeks'), fmt(cards(r))]; });
C('mức 8, thẻ Vui vẻ, không cờ → không thẻ an toàn nào', ['E.recommend'], () => { const r = rec({ level: 8, emotions: ['vui_ve'] }); return [!cards(r).some(c => SAFETY_CARDS.includes(c) || c === 'two_weeks'), fmt(cards(r))]; });

/* =========================================================
   7. AC-39b, lọc phút, Đổi gợi ý, A1/A2
   ========================================================= */
H.section('7. AC-39b, lọc phút, Đổi gợi ý (6.5 bước 1, 3, 4)');
const BANNED_LOSS = ['BREATHE_46', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN'];
for (const [nm, o] of [['after_loss', { stage: 'after_loss' }], ['thẻ Đau khổ', { emotions: ['dau_kho'] }], ['after_loss + 23 giờ', { stage: 'after_loss', hour: 23 }],
  ['Đau khổ + Lo lắng', { emotions: ['dau_kho', 'lo_lang'] }], ['after_loss + waiting chip', { stage: 'after_loss', contexts: ['waiting'] }]]) {
  C('AC-39b: ' + nm + ' → attempt 0..5 không có Thở 4–6, Đặt tên suy nghĩ, Biết chắc', ['E.recommend'], () => {
    const all = [0, 1, 2, 3, 4, 5].flatMap(a => ids(rec(o, a)));
    return [all.length > 0 && !all.some(x => BANNED_LOSS.includes(x)), fmt(all)];
  });
}
C('lọc phút: R6 + 3 phút (Âm thanh 5, Thả lỏng 5) → không còn bài → Dừng 5 giây', ['E.recommend', 'D.EXERCISES'], () => { const g = ids(rec({ emotions: ['met_moi'], minutes: 3 })); return [g[0] === 'PAUSE5' && g.every(x => minOf(x) <= 3), fmt(g)]; });
C('lọc phút: R3 + 1 phút → chỉ Dừng 5 giây', ['E.recommend', 'D.EXERCISES'], () => { const g = ids(rec({ emotions: ['lo_lang'], minutes: 1 })); return [fmt(g) === fmt(['PAUSE5']), fmt(g)]; });
C('lọc phút: R3 + 3 phút → Thở 4–6, Về với lúc này', ['E.recommend', 'D.EXERCISES'], () => { const g = ids(rec({ emotions: ['lo_lang'], minutes: 3 })); return [fmt(g) === fmt(['BREATHE_46', 'GROUND_54321']), fmt(g)]; });
C('lọc phút: mọi gợi ý có min ≤ phút đã chọn (1/3/5/10 × 9 dòng)', ['E.recommend', 'D.EXERCISES'], () => {
  const bad = [];
  for (const m of [1, 3, 5, 10]) for (const o of [{ flags: new Set(['body']) }, { emotions: ['dau_kho'] }, { emotions: ['lo_lang'] }, { emotions: ['self_blame'] }, { stage: 'waiting' }, { emotions: ['co_don'] }, { emotions: ['met_moi'] }, { hour: 22 }, {}])
    for (const a of [0, 1, 2]) for (const x of ids(rec(Object.assign({ minutes: m }, o), a))) if (!(minOf(x) <= m)) bad.push(m + ':' + x);
  return [!bad.length, bad.join(', ')];
});
C('Đổi gợi ý: R3 mức 7 → attempt 1 = [Dừng 5 giây, Đặt tên suy nghĩ] (dòng + R8, bỏ trùng, cửa sổ 2 trượt)', ['E.recommend'], () => {
  const g = [0, 1, 2].map(a => ids(rec({ emotions: ['lo_lang'] }, a)));
  const m = model({ emotions: ['lo_lang'] }).list;
  return [fmt(g) === fmt([0, 1, 2].map(a => windowOf(m, a))), fmt(g) + ' cần ' + fmt([0, 1, 2].map(a => windowOf(m, a)))];
});
C('Đổi gợi ý: R6 mức 7 (5 bài) → xoay vòng tròn đúng cửa sổ attempt × 2', ['E.recommend', 'D.EXERCISES'], () => {
  const m = model({ emotions: ['met_moi'] }).list;
  const g = [0, 1, 2, 3].map(a => ids(rec({ emotions: ['met_moi'] }, a)));
  return [fmt(g) === fmt([0, 1, 2, 3].map(a => windowOf(m, a))), fmt(g) + ' cần ' + fmt([0, 1, 2, 3].map(a => windowOf(m, a)))];
});
C('Đổi gợi ý mức thấp: chấm 2 + Mệt mỏi → attempt 1 = [Dừng 5 giây, Thở 4–6] (chỉ R3, vòng tròn)', ['E.recommend'], () => {
  const g = [0, 1].map(a => ids(rec({ level: 2, emotions: ['met_moi'], flags: new Set(['not_alone', 'low']) }, a)));
  return [fmt(g) === fmt([['BREATHE_46', 'GROUND_54321'], ['PAUSE5', 'BREATHE_46']]), fmt(g)];
});
C('AC-31: cờ body → attempt 0..4 chỉ bài R1 (Âm thanh êm dịu, Dừng 5 giây)', ['E.recommend'], () => {
  const all = [0, 1, 2, 3, 4].flatMap(a => ids(rec({ flags: new Set(['body']), emotions: ['lo_lang'] }, a)));
  return [all.length > 0 && all.every(x => ROWS.R1.includes(x)), fmt(all)];
});
C('gợi ý luôn ≤ 2, chỉ id bài B1–B8 (A1) — không bao giờ có bài đêm H1/H2 (300 tổ hợp)', ['E.recommend'], () => {
  const r = rng(11), bad = [];
  for (let k = 0; k < 300; k++) {
    const o = randomInput(r); const g = ids(rec(o, Math.floor(r() * 4)));
    if (g.length > 2 || g.some(x => !B_IDS.includes(x))) bad.push(fmt(o) + '→' + fmt(g));
  }
  return [!bad.length, bad.slice(0, 3).join(' | ')];
});

/* =========================================================
   8. Thẻ: thứ tự PRD 8.1, L-7, mất con, kéo dài
   ========================================================= */
H.section('8. Thẻ trên M09 (PRD 8.1, AC-26, 30, 31; L-7)');
C('thứ tự thẻ: need_doctor → not_alone → self_blame_ack → ask_stage_change (PRD 8.1)', ['E.recommend'], () => {
  const r = rec({ level: 4, emotions: ['self_blame'], flags: new Set(['body', 'not_alone', 'self_blame', 'loss']) });
  const c = cards(r), pos = SAFETY_CARDS.map(x => c.indexOf(x));
  return [pos.every(p => p >= 0) && pos.every((p, k) => k === 0 || p > pos[k - 1]) && c.includes('two_weeks'), fmt(c)];
});
C('AC-26: cờ not_alone (lối "đó chỉ là cách nói") → thẻ not_alone đứng đầu', ['E.recommend'], () => { const c = cards(rec({ flags: new Set(['not_alone']), emotions: ['lo_lang'] })); return [c[0] === 'not_alone', fmt(c)]; });
C('L-7: cờ self_blame (cụm "lỗi tại mình") ở dòng R6 → có câu ghi nhận', ['E.recommend'], () => { const c = cards(rec({ emotions: ['met_moi'], flags: new Set(['self_blame', 'not_alone']) })); return [c.includes('self_blame_ack'), fmt(c)]; });
C('L-7: cờ self_blame ở dòng R1 (body) → có câu ghi nhận', ['E.recommend'], () => { const c = cards(rec({ flags: new Set(['self_blame', 'body']) })); return [c.includes('self_blame_ack'), fmt(c)]; });
C('AC-30: cờ loss → thẻ ask_stage_change', ['E.recommend'], () => { const c = cards(rec({ flags: new Set(['loss', 'not_alone']) })); return [c.includes('ask_stage_change'), fmt(c)]; });
C('cờ kéo dài (prolonged) mức 8 → thẻ two_weeks', ['E.recommend'], () => { const c = cards(rec({ level: 8, flags: new Set(['prolonged', 'not_alone']) })); return [c.includes('two_weeks'), fmt(c)]; });
/* Luồng đầy đủ như app: assess → (M08 "Không") → recommend */
function flow(o) {
  const a = E.assess({ texts: o.texts || [], level: o.level === undefined ? 7 : o.level, emotions: o.emotions || [], flags: new Set(arr(o.flags)) });
  const f = new Set(arr(a.flags));
  if (a.route === 'safety_q') { f.add('not_alone'); f.add('low'); }
  return { a, r: E.recommend(IN(Object.assign({}, o, { flags: f })), o.attempt || 0) };
}
for (const [t, want] of [['tuyệt vọng quá', ['not_alone']], ['mình vừa sẩy thai', ['not_alone', 'ask_stage_change']], ['lỗi tại mình hết', ['not_alone', 'self_blame_ack']],
  ['mất ngủ cả tuần nay', ['not_alone', 'two_weeks']], ['đau bụng dữ dội', ['need_doctor']], ['mẹ chồng ép mình', ['not_alone']], ['bị bạo hành', ['not_alone']]]) {
  C('luồng: "Kể thêm" = "' + t + '", mức 8 → thẻ ' + want.join(' + '), ['E.assess', 'E.recommend'], () => { const { r } = flow({ texts: [t], level: 8 }); const c = cards(r); return [want.every(x => c.includes(x)), fmt(c)]; });
}
C('luồng: "đau bụng dữ dội" + Lo lắng → chỉ bài R1 (AC-31)', ['E.assess', 'E.recommend'], () => { const { r } = flow({ texts: ['đau bụng dữ dội'], emotions: ['lo_lang'] }); return [r.rule === 'R1' && ids(r).every(x => ROWS.R1.includes(x)), r.rule + ' ' + fmt(ids(r))]; });
C('luồng: Cô đơn + mức 5 → thẻ not_alone đứng đầu (PRD 8.1 bước 4)', ['E.assess', 'E.recommend'], () => { const { r } = flow({ emotions: ['co_don'], level: 5 }); return [cards(r)[0] === 'not_alone', fmt(cards(r))]; });
C('luồng: chấm 2 + M08 "Không" → thẻ not_alone đứng đầu (AC-27)', ['E.assess', 'E.recommend'], () => { const { a, r } = flow({ level: 2, emotions: ['met_moi'] }); return [a.route === 'safety_q' && cards(r)[0] === 'not_alone', a.route + ' ' + fmt(cards(r))]; });

/* =========================================================
   9. Không hạ mức – 1.000 tổ hợp ngẫu nhiên (6.4)
   ========================================================= */
H.section('9. Không hạ mức: 1.000 tổ hợp ngẫu nhiên (6.4, PRD 8.1)');
C('1.000 tổ hợp: thêm câu viết / thẻ / chip → cờ phiên ⊇ cờ cũ; thẻ need_doctor, self_blame_ack, ask_stage_change, two_weeks không mất; not_alone không mất khi đã có cờ', ['E.assess', 'E.recommend'], () => {
  const r = rng(20261110), bad = [];
  for (let k = 0; k < 1000 && bad.length < 5; k++) {
    const base = randomInput(r);
    const b = flow(base);
    const more = Object.assign({}, base, { texts: base.texts.concat([TEXTS[1 + Math.floor(r() * (TEXTS.length - 1))]]), contexts: [...new Set(base.contexts.concat(r() < 0.5 ? [CTX[Math.floor(r() * 3)]] : []))],
      flags: new Set(arr(b.a.flags)) });
    if (more.emotions.length < 3 && r() < 0.5) { const e = EMOS[Math.floor(r() * EMOS.length)]; if (!more.emotions.includes(e)) more.emotions = more.emotions.concat([e]); }
    const m = flow(more);
    const fb = new Set(arr(b.a.flags)), fm = new Set(arr(m.a.flags));
    const lostFlag = [...fb].filter(x => !fm.has(x));
    const cb = cards(b.r), cm = cards(m.r);
    const lostCard = ['need_doctor', 'self_blame_ack', 'ask_stage_change', 'two_weeks'].filter(x => cb.includes(x) && !cm.includes(x));
    if (fb.has('not_alone') && cb.includes('not_alone') && !cm.includes('not_alone')) lostCard.push('not_alone');
    if (lostFlag.length || lostCard.length) bad.push('#' + k + ' mất cờ ' + fmt(lostFlag) + ' mất thẻ ' + fmt(lostCard) + ' · ' + fmt(base));
  }
  return [!bad.length, bad.join(' | ')];
});
C('1.000 tổ hợp: assess(flags F) luôn trả ⊇ F', ['E.assess'], () => {
  const r = rng(77), all = ['self_harm', 'not_alone', 'self_blame', 'loss', 'body', 'prolonged', 'two_weeks', 'low'], bad = [];
  for (let k = 0; k < 1000 && bad.length < 3; k++) {
    const F = new Set(all.filter(() => r() < 0.3)), o = randomInput(r);
    const out = new Set(arr(E.assess({ texts: o.texts, level: o.level, emotions: o.emotions, flags: new Set(F) }).flags));
    const lost = [...F].filter(x => !out.has(x)); if (lost.length) bad.push(fmt(lost) + ' ' + fmt(o));
  }
  return [!bad.length, bad.join(' | ')];
});
C('recommend tất định và không sửa đầu vào (cùng vào → cùng ra; emotions/flags giữ nguyên)', ['E.recommend'], () => {
  const o = IN({ emotions: ['lo_lang', 'self_blame'], flags: new Set(['loss']) }); const before = fmt(o);
  const a = E.recommend(o, 1), b = E.recommend(o, 1);
  return [fmt(a) === fmt(b) && fmt(o) === before, fmt(a)];
});

/* =========================================================
   10. library, validate, bản thử nghiệm (AC-34, K-14, AC-50)
   ========================================================= */
H.section('10. library, validate, ALLOW_DRAFT_CONTENT (AC-34, 34b, 50)');
C('library (draft bật): đúng 8 bài B1–B8, thứ tự cố định', ['E.library'], () => { const l = arr(E.library({ stage: 'cycle', flags: new Set() })); return [fmt(l) === fmt(B_IDS), fmt(l)]; });
C('library không lọc theo giai đoạn / cờ (after_loss + loss vẫn đủ 8, kể cả Thở 4–6)', ['E.library'], () => { const l = arr(E.library({ stage: 'after_loss', flags: new Set(['loss', 'body']) })); return [fmt(l) === fmt(B_IDS), fmt(l)]; });
C('library: ALLOW_DRAFT_CONTENT=false → chỉ bài approved (đọc config LÚC GỌI)', ['E.library', 'D.EXERCISES'], () => {
  const l = withDraft(false, () => arr(E.library({ stage: 'cycle', flags: new Set() })));
  const want = B_IDS.filter(id => ex(id) && ex(id).status === 'approved');
  return [fmt(l) === fmt(want), fmt(l) + ' cần ' + fmt(want)];
});
C('validate: bỏ id lạ, giữ thứ tự', ['E.validate'], () => { const v = arr(E.validate(['FOO', 'GROUND_54321', 'PAUSE5', '<script>'], { available: A1 })); return [fmt(v) === fmt(['GROUND_54321', 'PAUSE5']), fmt(v)]; });
C('validate A1: bỏ THREE_QUESTIONS, SEND_WORDS (màn chưa có)', ['E.validate'], () => { const v = arr(E.validate(['THREE_QUESTIONS', 'SEND_WORDS', 'WARM_HAND_DAY'], { available: A1 })); return [fmt(v) === fmt(['WARM_HAND_DAY']), fmt(v)]; });
C('validate A2: giữ THREE_QUESTIONS, SEND_WORDS nếu có trong danh mục', ['E.validate', 'D.EXERCISES'], () => {
  const v = arr(E.validate(['THREE_QUESTIONS', 'SEND_WORDS', 'WARM_HAND_DAY'], { available: A2 }));
  const want = ['THREE_QUESTIONS', 'SEND_WORDS', 'WARM_HAND_DAY'].filter(id => !!ex(id));
  return [fmt(v) === fmt(want), fmt(v) + ' cần ' + fmt(want)];
});
C('validate: ALLOW_DRAFT_CONTENT=false bỏ bài draft', ['E.validate', 'D.EXERCISES'], () => {
  const v = withDraft(false, () => arr(E.validate(B_IDS, { available: A1 })));
  return [v.every(id => ex(id) && ex(id).status === 'approved'), fmt(v)];
});
C('K-14 / AC-34b: draft TẮT, mức 2 + body → thẻ need_doctor, not_alone vẫn có; gợi ý chỉ bài approved', ['E.recommend', 'D.EXERCISES'], () => {
  const r = withDraft(false, () => rec({ level: 2, flags: new Set(['body', 'not_alone', 'low']) }));
  const c = cards(r), g = ids(r);
  return [c.includes('need_doctor') && c.includes('not_alone') && g.every(id => ex(id) && ex(id).status === 'approved'), fmt(c) + ' ' + fmt(g)];
});

/* =========================================================
   11. Bài đêm (AC-40, 41, 42; V1, V2)
   ========================================================= */
H.section('11. nightList / nightGate / gateOutcome (AC-40–42)');
const NL = { start: ['NIGHT_HOME', 'NIGHT_TOGETHER'], cycle: ['NIGHT_HOME', 'NIGHT_TOGETHER'], waiting: ['NIGHT_HOME_SHORT', 'NIGHT_TOGETHER'],
  pause: ['NIGHT_TOGETHER', 'NIGHT_WARM_HAND', 'NIGHT_HOME'], positive: ['NIGHT_HOME', 'NIGHT_HOME_SHORT'], none: ['NIGHT_TOGETHER', 'NIGHT_HOME'],
  after_loss: ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER'] };
for (const [st, want] of Object.entries(NL)) {
  C('nightList ' + st + ' → gợi ý ' + want.join(', '), ['E.nightList', 'SC.SCRIPTS'], () => { const r = E.nightList({ stage: st, flags: new Set() }); return [fmt(arr(r.suggested)) === fmt(want), fmt(r)]; });
}
for (const st of ['start', 'cycle', 'waiting', 'pause', 'positive', 'none']) {
  C('chặn bài em bé: ' + st + ' + cờ loss → [Bàn tay ấm, Hai ta], không H1/H2 (V2, AC-30)', ['E.nightList', 'SC.SCRIPTS'], () => {
    const s = arr(E.nightList({ stage: st, flags: new Set(['loss']) }).suggested); return [fmt(s) === fmt(['NIGHT_WARM_HAND', 'NIGHT_TOGETHER']), fmt(s)];
  });
}
C('AC-41: after_loss → H4 đứng đầu, không H1/H2 (cả khi có cờ khác)', ['E.nightList', 'SC.SCRIPTS'], () => { const s = arr(E.nightList({ stage: 'after_loss', flags: new Set(['body', 'not_alone']) }).suggested); return [s[0] === 'NIGHT_WARM_HAND' && !s.some(x => BABY.includes(x)), fmt(s)]; });
C('nightList.all = 4 bài khi draft bật ("Mọi bài" vẫn mở H1/H2 qua hộp xác nhận)', ['E.nightList', 'SC.SCRIPTS'], () => { const a = arr(E.nightList({ stage: 'after_loss', flags: new Set(['loss']) }).all); return [fmt([...a].sort()) === fmt([...NIGHT].sort()), fmt(a)]; });
C('nightList draft TẮT → all/suggested chỉ bài approved', ['E.nightList', 'SC.SCRIPTS'], () => {
  const r = withDraft(false, () => E.nightList({ stage: 'cycle', flags: new Set() }));
  const S = (W.HTDC_SCRIPTS || {}).SCRIPTS || {};
  return [arr(r.all).concat(arr(r.suggested)).every(id => S[id] && S[id].status === 'approved'), fmt(r)];
});
const NG = (id, st, f) => E.nightGate(id, { stage: st, flags: new Set(f || []) });
C('AC-40: H1 ở cycle → gate, không confirmLoss; mở lại lần 2 vẫn gate (V1 mỗi lần)', ['E.nightGate', 'SC.SCRIPTS'], () => { const a = NG('NIGHT_HOME', 'cycle'), b = NG('NIGHT_HOME', 'cycle'); return [a.gate === true && a.confirmLoss === false && b.gate === true, fmt([a, b])]; });
C('AC-40: H2 ở waiting → gate', ['E.nightGate', 'SC.SCRIPTS'], () => { const a = NG('NIGHT_HOME_SHORT', 'waiting'); return [a.gate === true && a.confirmLoss === false, fmt(a)]; });
C('AC-42: H1 ở after_loss → confirmLoss + gate (xác nhận chạy trước cổng)', ['E.nightGate', 'SC.SCRIPTS'], () => { const a = NG('NIGHT_HOME', 'after_loss'); return [a.gate === true && a.confirmLoss === true, fmt(a)]; });
C('AC-42: H2 ở cycle + cờ loss trong phiên → confirmLoss + gate', ['E.nightGate', 'SC.SCRIPTS'], () => { const a = NG('NIGHT_HOME_SHORT', 'cycle', ['loss']); return [a.gate === true && a.confirmLoss === true, fmt(a)]; });
for (const id of ['NIGHT_TOGETHER', 'NIGHT_WARM_HAND']) C(id + ' (không em bé) ở after_loss + loss → không gate, không confirmLoss', ['E.nightGate', 'SC.SCRIPTS'], () => { const a = NG(id, 'after_loss', ['loss']); return [a.gate === false && a.confirmLoss === false, fmt(a)]; });
C('gateOutcome warm → play', ['E.gateOutcome'], () => { const r = E.gateOutcome('warm'); return [r.play === true, fmt(r)]; });
C('gateOutcome heavy → không play, gợi ý [Bàn tay ấm, Hai ta] (AC-40)', ['E.gateOutcome'], () => { const r = E.gateOutcome('heavy'); return [r.play === false && fmt(arr(r.suggest)) === fmt(['NIGHT_WARM_HAND', 'NIGHT_TOGETHER']), fmt(r)]; });
C('gateOutcome unsure → không play, gợi ý [Hai ta] (AC-40)', ['E.gateOutcome'], () => { const r = E.gateOutcome('unsure'); return [r.play === false && fmt(arr(r.suggest)) === fmt(['NIGHT_TOGETHER']), fmt(r)]; });
C('gateOutcome giá trị lạ → không play (an toàn mặc định)', ['E.gateOutcome'], () => { const r = E.gateOutcome('xyz') || {}; return [r.play !== true, fmt(r)]; });

/* =========================================================
   12. check.* (5.5 kiểm shape; AC-23, AC-56), stageCard
   ========================================================= */
H.section('12. check.* – dữ liệu từ máy là không tin được (5.5; AC-23, AC-56)');
const F = require('./lib/fixture');
const NEVER = ['flags', 'selfHarm', 'self_harm', 'safety', 'safetyAnswer', 'answer', 'gate', 'gateAnswer', 'urgent', 'route', 'groups', 'order', 'shuffle'];
const CK = (k, r) => E.check[k](JSON.parse(JSON.stringify(r)));
// N-1 (lượt 3): StopRec lưu xuống máy không còn rule → không đòi check.stop giữ rule (store bỏ qua FIELDS; unit-store kiểm)
C('check.stop: bản ghi hợp lệ → giữ đủ trường', ['E.check.stop'], () => { const r0 = F.stopRec({ note: 'ghi chú' }); const r = CK('stop', r0); return [r && ['id', 'at', 'day', 'tz', 'before', 'after', 'fit', 'stage', 'origin', 'minutes'].every(k => fmt(r[k]) === fmt(r0[k])) && fmt(arr(r.emotions)) === fmt(r0.emotions) && arr(r.done).length === 1, fmt(r)]; });
C('AC-23: check.stop bỏ mọi trường an toàn lạ (flags, selfHarm, gate, answer…)', ['E.check.stop'], () => {
  const r = CK('stop', Object.assign(F.stopRec(), Object.fromEntries(NEVER.map(k => [k, k === 'flags' ? ['self_harm', 'loss'] : 'yes']))));
  return [r === null || NEVER.every(k => !(k in r)), fmt(r)];
});
for (const [nm, bad] of [['null', null], ['chuỗi', 'x'], ['mảng', []], ['kind sai (night vào check.stop)', F.nightRec()], ['id ngắn', F.stopRec({ id: 'abc' })],
  ['id chữ hoa', F.stopRec({ id: 'ABCDEFGHIJ0123456789' })], ['at là chuỗi', F.stopRec({ at: '2026-11-10' })], ['thiếu at', Object.assign(F.stopRec(), { at: undefined })], ['v = 99', F.stopRec({ v: 99 })]]) {
  C('check.stop hỏng (' + nm + ') → null', ['E.check.stop'], () => { let r; try { r = E.check.stop(bad === null ? null : JSON.parse(JSON.stringify(bad))); } catch (e) { return [false, 'ném lỗi: ' + e.message]; } return [r === null, fmt(r)]; });
}
for (const [nm, patch, ok] of [['before 0', { before: 0 }, r => r.before == null], ['before 11', { before: 11 }, r => r.before == null], ['before "5"', { before: '5' }, r => r.before === 5 || r.before == null],
  ['4 thẻ cảm xúc', { emotions: ['lo_lang', 'co_don', 'met_moi', 'dau_kho'] }, r => arr(r.emotions).length <= 3], ['thẻ lạ "<img>"', { emotions: ['<img src=x>'] }, r => !arr(r.emotions).includes('<img src=x>')],
  ['note 1001 ký tự', { note: 'a'.repeat(1001) }, r => !r.note || r.note.length <= 1000], ['note là object', { note: { x: 1 } }, r => !r.note || typeof r.note === 'string'],
  ['rule "R99"', { rule: 'R99' }, r => r.rule == null], ['fit "great"', { fit: 'great' }, r => r.fit == null], ['done 11 mục', { done: Array.from({ length: 11 }, () => ({ ex: 'PAUSE5', at: 1, end: 'complete' })) }, r => arr(r.done).length <= 10],
  ['done.ex lạ', { done: [{ ex: 'EVIL', at: 1, end: 'complete' }] }, r => !arr(r.done).some(d => d.ex === 'EVIL')], ['minutes 7', { minutes: 7 }, r => r.minutes == null],
  ['texts.know 6 mục', { texts: { know: ['1', '2', '3', '4', '5', '6'] } }, r => !r.texts || arr(r.texts.know).length <= 5], ['texts.thought 201 ký tự', { texts: { thought: 'x'.repeat(201) } }, r => !r.texts || !r.texts.thought || r.texts.thought.length <= 200]]) {
  C('check.stop sai trường (' + nm + ') → null hoặc đã làm sạch', ['E.check.stop'], () => { const r = CK('stop', F.stopRec(patch)); return [r === null || ok(r), fmt(r)]; });
}
C('check.night hợp lệ → giữ; script lạ → null', ['E.check.night'], () => { const a = CK('night', F.nightRec()), b = CK('night', F.nightRec({ script: 'NIGHT_EVIL' })); return [a && a.script === 'NIGHT_TOGETHER' && a.outcome === 'better' && b === null, fmt([a, b])]; });
C('AC-23: check.night không giữ câu trả lời cổng hỏi (gate / gateAnswer)', ['E.check.night'], () => { const r = CK('night', Object.assign(F.nightRec(), { gate: 'heavy', gateAnswer: 'warm', confirmLoss: true })); return [r === null || (!('gate' in r) && !('gateAnswer' in r) && !('confirmLoss' in r)), fmt(r)]; });
C('check.night how/end/outcome lạ → null hoặc làm sạch', ['E.check.night'], () => { const r = CK('night', F.nightRec({ how: 'tts', end: 'boom', outcome: 'x' })); return [r === null || (r.how !== 'tts' && r.end !== 'boom' && r.outcome !== 'x'), fmt(r)]; });
C('AC-56: check.together chỉ giữ {v, kind, id, at, day, tz, exercise}', ['E.check.together'], () => {
  const r = CK('together', Object.assign(F.togetherRec(), { emotions: ['co_don'], text: 'riêng tư', turns: [1, 2], who: 'vợ' }));
  return [r === null || Object.keys(r).every(k => ['v', 'kind', 'id', 'at', 'day', 'tz', 'exercise'].includes(k)), fmt(r)];
});
C('check.together hợp lệ → giữ; exercise "C4"/"C9" → null (C4 Gửi lời không ghi)', ['E.check.together'], () => { const a = CK('together', F.togetherRec()), b = CK('together', F.togetherRec({ exercise: 'C9' })), c = CK('together', F.togetherRec({ exercise: 'C4' })); return [a && a.exercise === 'C1' && b === null && c === null, fmt([a, b, c])]; });
C('check.stage hợp lệ → giữ; to lạ → null; via ngoài stage|mydata|result → null (AC-17)', ['E.check.stage'], () => {
  const a = CK('stage', F.stageRec()), b = CK('stage', F.stageRec({ to: 'hacked' })), c = CK('stage', F.stageRec({ via: 'auto' }));
  return [a && a.to === 'waiting' && a.via === 'stage' && b === null && c === null, fmt([a, b, c])];
});
C('check.habitDay hợp lệ → giữ; dấu lạ → null hoặc làm sạch', ['E.check.habitDay'], () => {
  const a = CK('habitDay', F.habitDay('2026-11-10', { sleep: 'x', move: 'a' })), b = CK('habitDay', F.habitDay('2026-11-10', { sleep: '<b>' })), c = CK('habitDay', F.habitDay('2026-02-30'));
  return [a && a.marks.sleep === 'x' && a.marks.move === 'a' && (b === null || b.marks.sleep !== '<b>') && c === null, fmt([a, b, c])];
});
C('check.kv: role hợp lệ giữ; role lạ, khóa lạ → null', ['E.check.kv'], () => {
  const a = CK('kv', { k: 'role', v: 'wife' }), b = CK('kv', { k: 'role', v: 'admin' }), c = CK('kv', { k: 'evil', v: 1 }), d = CK('kv', { k: 'stage', v: { code: 'waiting', at: 1 } });
  return [a && a.v === 'wife' && b === null && c === null && d && d.v.code === 'waiting', fmt([a, b, c, d])];
});
C('check.kv: không lưu cờ phiên / câu trả lời an toàn ở kv (k "flags", "session", "safety")', ['E.check.kv'], () => { const r = ['flags', 'session', 'safety', 'gate'].map(k => CK('kv', { k, v: ['self_harm'] })); return [r.every(x => x === null), fmt(r)]; });
C('stageCard("none") → null; giai đoạn khác → null hoặc {id, text, review}; ≥ 1 giai đoạn có thẻ', ['E.stageCard'], () => {
  const r = STAGES.map(s => [s, E.stageCard(s)]);
  const shapeOk = r.every(([s, x]) => (s === 'none' ? x === null : x === null || (typeof x.text === 'string' && x.text && 'id' in x && 'review' in x)));
  return [shapeOk && r.some(([, x]) => x), fmt(r)];
});

/* =========================================================
   13. Danh mục data.js (AC-36, 38, 50, 60)
   ========================================================= */
H.section('13. Danh mục data.js (AC-36, 38, 50)');
C('D.EXERCISES có đủ B1–B8 đúng mã (B1 PAUSE5 … B8 WARM_HAND_DAY)', ['D.EXERCISES'], () => { const bad = B_IDS.filter((id, k) => !ex(id) || ex(id).code !== 'B' + (k + 1)); return [!bad.length, 'sai/thiếu: ' + bad.map(id => id + '=' + (ex(id) && ex(id).code)).join(', ')]; });
C('AC-50: mỗi bài có goal, safety, min, max, type, status, reviewer, reviewedAt', ['D.EXERCISES'], () => {
  const bad = B_IDS.filter(id => { const x = ex(id); return !x || typeof x.goal !== 'string' || !x.goal || typeof x.safety !== 'string' || typeof x.min !== 'number' || typeof x.max !== 'number' || x.max < x.min || typeof x.type !== 'string' || !['draft', 'approved'].includes(x.status) || typeof x.reviewer !== 'string' || typeof x.reviewedAt !== 'string'; });
  return [!bad.length, bad.join(', ')];
});
C('AC-50: dòng an toàn có chữ ở B2–B8 (B1 PRD ghi "—")', ['D.EXERCISES'], () => { const bad = B_IDS.slice(1).filter(id => !(ex(id) && String(ex(id).safety).trim())); return [!bad.length, bad.join(', ')]; });
C('phút tối thiểu đúng PRD 6.4 (B1 0,5 · B2 2 · B3 3 · B4 5 · B5 3 · B6 3 · B7 5 · B8 3–4)', ['D.EXERCISES'], () => {
  const bad = B_IDS.filter(id => { const m = ex(id) && ex(id).min; return id === 'WARM_HAND_DAY' ? !(m >= 3 && m <= 4) : m !== PRD_MIN[id]; });
  return [!bad.length, bad.map(id => id + '=' + (ex(id) && ex(id).min)).join(', ')];
});
C('AC-36: không bài nào có holdsBreath (trường không tồn tại hoặc false)', ['D.EXERCISES'], () => { const bad = exList().filter(x => x && 'holdsBreath' in x && x.holdsBreath !== false).map(x => x.id); return [!bad.length, bad.join(', ')]; });
C('B5, B6 đánh dấu needsWriting (để mức 1–3 bỏ bài cần viết)', ['D.EXERCISES'], () => [ex('THOUGHT_CLOUD') && ex('THOUGHT_CLOUD').needsWriting === true && ex('KNOW_UNKNOWN') && ex('KNOW_UNKNOWN').needsWriting === true, fmt([ex('THOUGHT_CLOUD'), ex('KNOW_UNKNOWN')].map(x => x && x.needsWriting))]);
const emoList = () => (Array.isArray(D.EMOTIONS) ? D.EMOTIONS : Object.entries(D.EMOTIONS || {}).map(([k, v]) => Object.assign({ code: k }, v)));
const codeOf = x => x && (x.code || x.id || x.key);
C('AC-38: D.EMOTIONS có đúng 11 thẻ (9 capybara + Tự trách + Chưa rõ)', ['D.EMOTIONS'], () => { const c = emoList().map(codeOf); return [fmt([...c].sort()) === fmt([...EMOS].sort()), fmt(c)]; });
C('9 ảnh capybara đúng tên file của Check-in Mẹ Bầu (R3 tech design); Tự trách, Chưa rõ không ảnh (emoji)', ['D.EMOTIONS'], () => {
  const m = Object.fromEntries(emoList().map(x => [codeOf(x), x.img || '']));
  const ok = IMGS.every(f => m[f.replace('.png', '')] === f) && !m.self_blame && !m.unsure;
  return [ok, fmt(m)];
});
C('mỗi thẻ có tên (aria-label) và emoji dự phòng', ['D.EMOTIONS'], () => { const bad = emoList().filter(x => !(x.name || x.label) || !x.emoji).map(codeOf); return [!bad.length, bad.join(', ')]; });
const codes = v => (Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : codeOf(x))) : Object.keys(v || {}));
C('D.STAGES: 6 giai đoạn + none', ['D.STAGES'], () => { const c = codes(D.STAGES); return [STAGES.every(s => c.includes(s)), fmt(c)]; });
C('D.ROLES: wife, husband, solo, none (AC-14)', ['D.ROLES'], () => { const c = codes(D.ROLES); return [['wife', 'husband', 'solo', 'none'].every(s => c.includes(s)), fmt(c)]; });
C('D.CONTEXTS có chip couple (R5) và sleep (R7); không bối cảnh NVYT (ca trực, bệnh nhân)', ['D.CONTEXTS'], () => { const c = codes(D.CONTEXTS); const txt = JSON.stringify(D.CONTEXTS); return [c.includes('couple') && c.includes('sleep') && !/ca trực|bệnh nhân|ca làm/i.test(txt), fmt(c)]; });
C('D.MINUTES = 1, 3, 5, 10', ['D.MINUTES'], () => { const c = arr(D.MINUTES).map(x => (typeof x === 'object' ? x.value || x.min : x)); return [fmt(c) === fmt([1, 3, 5, 10]), fmt(c)]; });

/* =========================================================
   14. Hàm thuần (6.1)
   ========================================================= */
H.section('14. Hàm thuần (6.1)');
H.ok('engine/data/keywords/scripts/pacer không tự lấy giờ (Date.now()/new Date() không tham số: 0 lần sau toàn bộ ca)', app.clock.calls === 0, 'gọi ' + app.clock.calls + ' lần');

H.done();
