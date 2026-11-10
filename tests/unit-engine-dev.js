/* =========================================================
   Tự kiểm của dev cho T-02 – Hành Trình Đón Con · Chủ: FE-2 Luật & nội dung (frontend-dev, T-02)
   KHÔNG phải unit chính thức (qa-tester viết tests/unit-engine.js). Chạy nhanh khi sửa data/keywords/engine:
     $NODE tests/unit-engine-dev.js [-v]
   Kiểm: bộ câu STOP-4P (selfHarm/human trùng engine Mẹ Bầu An Yên từng câu), nhóm mới 8.2/8.2b hai chiều,
   detectPII (AC-33), assess, recommend R1–R8 + R3b + K-6 + AC-39b + phút + xoay vòng + A1/A2, thẻ đơn điệu
   (1.000 tổ hợp), nightList/nightGate/gateOutcome, validate draft, check.*, không holdsBreath, hàm thuần (không đọc giờ).
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadApp, PURE_CHAIN } = require('./lib/load');
const BANK = require('./lib/safety-bank');

let fails = 0, passes = 0;
const V = process.argv.includes('-v');
const T = (name, ok, detail) => { ok ? passes++ : fails++; if (!ok || V) console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && detail !== undefined ? '  → ' + String(detail).slice(0, 300) : '')); };
const section = s => console.log('=== ' + s);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Kịch bản đêm giả (scripts.js của FE-5 có thể chưa xong): đủ 5 id, H1/H2 hasBaby
const FAKE_SC = { SCRIPTS: {
  NIGHT_HOME: { hasBaby: true, status: 'draft' }, NIGHT_HOME_SHORT: { hasBaby: true, status: 'draft' },
  NIGHT_TOGETHER: { hasBaby: false, status: 'draft' }, NIGHT_WARM_HAND: { hasBaby: false, status: 'draft' },
  WARM_HAND_DAY: { hasBaby: false, status: 'draft' } } };
const app = loadApp(PURE_CHAIN);
const W = app.win, E = W.HTDC_ENGINE, D = W.HTDC_DATA, K = W.HTDC_KEYWORDS, C = W.HTDC_CONFIG;
if (!W.HTDC_SCRIPTS || !W.HTDC_SCRIPTS.SCRIPTS) W.HTDC_SCRIPTS = FAKE_SC;

/* ----- Engine Mẹ Bầu An Yên để so từng câu (nguồn chép) ----- */
const LS = path.resolve(__dirname, '..', '..', 'lifestyle-thai-phu', 'js');
let LE = null;
try {
  const ctx = { window: {}, console }; vm.createContext(ctx);
  for (const f of ['config', 'data', 'engine']) vm.runInContext(fs.readFileSync(path.join(LS, f + '.js'), 'utf8'), ctx);
  Object.assign(ctx.window.LSTP_CONFIG.FEATURES || (ctx.window.LSTP_CONFIG.FEATURES = {}), { pregnancyHarm: false, lossGroup: false });
  LE = ctx.window.LSTP_ENGINE;
} catch (e) { console.log('(không nạp được engine lifestyle: ' + e.message + ')'); }

section('1. Bộ câu STOP-4P (safety-bank.js)');
let nb = 0;
for (const [t, exp] of BANK) {
  const e = String(exp || '').replace('*', ''), r = E.safetyCheck(t);
  const ok = { urgent: r.selfHarm, noturgent: !r.selfHarm, human: !r.selfHarm && r.human, nothuman: !r.selfHarm && !r.human }[e];
  if (ok === undefined) continue;
  nb++; T(`bank "${t}" → ${exp}`, ok, JSON.stringify(r));
}
if (LE) {
  const diff = BANK.map(b => b[0]).filter(t => E.safetyCheck(t).selfHarm !== LE.safetyCheck(t).selfHarm || E.safetyCheck(t).human !== LE.safetyCheck(t).human);
  T(`so engine lifestyle từng câu (${BANK.length} câu): selfHarm + human trùng 100%`, !diff.length, diff.join(' | '));
}
const src = fs.readFileSync(path.join(LS, 'data.js'), 'utf8').split('\n').slice(376, 439).join('\n');
const mine = fs.readFileSync(path.join(__dirname, '..', 'js', 'keywords.js'), 'utf8');
T('keywords.js chứa NGUYÊN VĂN lifestyle data.js:377–439', mine.includes(src));

section('2. Nhóm mới 8.2, 8.2b (bắt / không bắt)');
const G = {
  hopeless: [['Mình thấy tuyệt vọng quá', 'hết hy vọng rồi', 'khong con hy vong gi nua'], ['Hy vọng lần này ổn', 'tuyệt vời quá']],
  selfblame: [['Lỗi tại mình hết', 'mình là gánh nặng của nhà này', 'toi vo dung'], ['Tại tôi bận nên chưa đi khám', 'Lời của mình hôm qua']],
  home: [['Mẹ chồng ép mình đi khám', 'chồng đòi ly hôn', 'bi chui suot'], ['Bị ép tiến độ ở công ty', 'đồi bò xanh']],
  loss: [['Mình vừa bị sẩy thai', 'thai lưu tuần trước', 'mất bé rồi', 'say thai'], ['Mất công đi khám', 'mắt bé xinh']],
  prolonged: [['Mất ngủ cả tuần nay', 'khóc suốt', 'khong lam duoc gi'], ['Khóc một chút rồi thôi']]
};
// Ghi chú: 'Tại tôi bận' VẪN bắt (PRD ghi cụm "tại tôi"); 'Bị ép tiến độ' VẪN bắt (cụm "bị ép"). Dòng dưới in rõ.
for (const [g, [yes, no]] of Object.entries(G)) {
  for (const t of yes) T(`${g} bắt: "${t}"`, E.safetyCheck(t).groups.includes(g), JSON.stringify(E.safetyCheck(t)));
  for (const t of no) {
    const hit = E.safetyCheck(t).groups.includes(g);
    if (/Tại tôi bận|Bị ép tiến độ/.test(t)) console.log(`  (biết trước) ${g} "${t}" → ${hit ? 'bắt (cụm PRD, chờ anh duyệt)' : 'không bắt'}`);
    else T(`${g} không bắt: "${t}"`, !hit);
  }
}
for (const t of ['Đau bụng dữ dội từ sáng', 'sốt cao 39 độ', 'hôm qua mình bị ngất', 'ra mau nhieu']) T(`body bắt: "${t}"`, E.safetyCheck(t).body);
for (const t of ['ngất ngây vì vui', 'sốt ruột quá', 'đau bụng nhẹ', 'hương thơm ngát']) T(`body không bắt: "${t}"`, !E.safetyCheck(t).body);
T('chuỗi rỗng → không gì', eq(E.safetyCheck(''), { selfHarm: false, human: false, groups: [], body: false }));

section('3. detectPII (AC-33)');
const pii = s => E.detectPII(s).map(h => h.why + ':' + h.text);
T('SĐT 0912 345 678', pii('gọi 0912 345 678 nhé').includes('phone:0912 345 678'), pii('gọi 0912 345 678 nhé'));
T('mã IVF 2611234 (một mục, không lặp dãy số)', eq(pii('mã IVF 2611234'), ['code:mã IVF 2611234']), pii('mã IVF 2611234'));
T('anh Trần Minh Quân', pii('chồng mình là anh Trần Minh Quân').includes('name:anh Trần Minh Quân'), pii('chồng mình là anh Trần Minh Quân'));
T('email, địa chỉ', pii('mail a.b@x.vn, nhà 12 đường Lê Lợi').length === 2, pii('mail a.b@x.vn, nhà 12 đường Lê Lợi'));
T('câu thường không có PII ("chặng đường này", "con đường dài")', !E.detectPII('Chặng đường này dài quá, con đường dài lắm. Sáng nay lại thấy đau.').length, pii('Chặng đường này dài quá, con đường dài lắm.'));

section('4. assess');
const A = o => { const r = E.assess(o); return { route: r.route, flags: [...r.flags].sort() }; };
T('mức 2 → safety_q, cờ low + not_alone', eq(A({ level: 2 }), { route: 'safety_q', flags: ['low', 'not_alone'] }), JSON.stringify(A({ level: 2 })));
T('mức 4 → next + two_weeks', eq(A({ level: 4 }), { route: 'next', flags: ['two_weeks'] }));
T('mức 7 → next, không cờ', eq(A({ level: 7 }), { route: 'next', flags: [] }));
T('tự hại → urgent trước M08', A({ texts: ['mình muốn chết'], level: 2 }).route === 'urgent');
T('mất con → cờ loss + not_alone', ['loss', 'not_alone'].every(f => A({ texts: ['vừa sẩy thai'] }).flags.includes(f)));
T('cờ cũ giữ nguyên (chỉ cộng)', A({ level: 8, flags: new Set(['body']) }).flags.includes('body'));
T('Cô đơn + mức 5 → not_alone', A({ level: 5, emotions: ['co_don'] }).flags.includes('not_alone'));
T('Cô đơn + mức 6 → không not_alone', !A({ level: 6, emotions: ['co_don'] }).flags.includes('not_alone'));

section('5. recommend R1–R8, R3b, K-6, AC-39b');
const R = (o, a = 0) => { const r = E.recommend(o, a); return { rule: r.rule, ids: r.suggestions.map(s => s.id), cards: r.cards }; };
const cases = [
  ['R1 body', { level: 7, flags: ['body'] }, 'R1', ['CALM_SOUND', 'PAUSE5']],
  ['R2 Đau khổ', { level: 7, emotions: ['dau_kho'] }, 'R2', ['WARM_HAND_DAY', 'CALM_SOUND']],
  ['R2 after_loss', { level: 7, stage: 'after_loss' }, 'R2', ['WARM_HAND_DAY', 'CALM_SOUND']],
  ['R3 Lo lắng', { level: 7, emotions: ['lo_lang'] }, 'R3', ['BREATHE_46', 'GROUND_54321']],
  ['R3b Tự trách', { level: 7, emotions: ['self_blame'] }, 'R3b', ['WARM_HAND_DAY', 'THOUGHT_CLOUD']],
  ['R4 waiting', { level: 7, stage: 'waiting' }, 'R4', ['THOUGHT_CLOUD', 'KNOW_UNKNOWN']],
  ['R5 Cô đơn (A1)', { level: 7, emotions: ['co_don'] }, 'R5', ['WARM_HAND_DAY', 'BREATHE_46']],
  ['R6 Mệt mỏi', { level: 7, emotions: ['met_moi'] }, 'R6', ['CALM_SOUND', 'RELEASE']],
  ['R7 Khó ngủ', { level: 7, contexts: ['sleep'] }, 'R7', ['RELEASE', 'BREATHE_46']],
  ['R7 sau 21 giờ', { level: 7, hour: 22 }, 'R7', ['RELEASE', 'BREATHE_46']],
  ['R8 mặc định', { level: 7 }, 'R8', ['BREATHE_46', 'GROUND_54321']],
  ['R8 "Chưa rõ"', { level: 7, emotions: ['unsure'] }, 'R8', ['BREATHE_46', 'GROUND_54321']],
  ['AC-27 mức 2 + Mệt mỏi → danh sách R3', { level: 2, emotions: ['met_moi'] }, 'R6', ['BREATHE_46', 'GROUND_54321']],
  ['AC-27 mức 2 + waiting → danh sách R3', { level: 2, stage: 'waiting' }, 'R4', ['BREATHE_46', 'GROUND_54321']],
  ['AC-27 mức 2 + Tự trách → chỉ Bàn tay ấm', { level: 2, emotions: ['self_blame'] }, 'R3b', ['WARM_HAND_DAY']],
  ['12.2 mức 2 + Đau khổ', { level: 2, emotions: ['dau_kho'] }, 'R2', ['WARM_HAND_DAY', 'CALM_SOUND']],
  ['Tự trách + Lo lắng → R3', { level: 7, emotions: ['self_blame', 'lo_lang'] }, 'R3', ['BREATHE_46', 'GROUND_54321']],
  ['Tự trách + Đau khổ → R2', { level: 7, emotions: ['self_blame', 'dau_kho'] }, 'R2', ['WARM_HAND_DAY', 'CALM_SOUND']],
  ['lọc phút: R4 + 1 phút → Dừng 5 giây', { level: 7, stage: 'waiting', minutes: 1 }, 'R4', ['PAUSE5']],
  ['lọc phút: R3 + 3 phút', { level: 7, emotions: ['lo_lang'], minutes: 3 }, 'R3', ['BREATHE_46', 'GROUND_54321']]
];
for (const [name, o, rule, ids] of cases) { const r = R(o); T(name, r.rule === rule && eq(r.ids, ids), JSON.stringify(r)); }
T('AC-39e: Tự trách có câu ghi nhận', R({ level: 7, emotions: ['self_blame'] }).cards.includes('self_blame_ack'));
T('AC-39e: Tự trách + Lo lắng vẫn có câu ghi nhận', R({ level: 7, emotions: ['self_blame', 'lo_lang'] }).cards.includes('self_blame_ack'));
T('AC-39e: chỉ "Chưa rõ" → không câu ghi nhận', !R({ level: 7, emotions: ['unsure'] }).cards.includes('self_blame_ack'));
T('R5 A2 (có C3, C4) → Ba câu, Gửi lời; không thẻ not_alone ở mức 7', eq(R({ level: 7, emotions: ['co_don'], available: () => true }).ids, ['THREE_QUESTIONS', 'SEND_WORDS'])
  && !R({ level: 7, emotions: ['co_don'], available: () => true }).cards.includes('not_alone'));
T('R5 A1 → thẻ not_alone', R({ level: 7, emotions: ['co_don'] }).cards.includes('not_alone'));
// Không bài cần viết + không R8 ở mức thấp, mọi lượt đổi
for (let a = 0; a < 6; a++) {
  const r = E.recommend({ level: 2, emotions: ['met_moi'] }, a);
  T(`mức thấp lượt đổi ${a}: chỉ ứng viên R3`, r.suggestions.every(s => ['BREATHE_46', 'GROUND_54321', 'PAUSE5'].includes(s.id)), JSON.stringify(r.suggestions));
}
for (const o of [{ stage: 'after_loss' }, { emotions: ['dau_kho'] }, { stage: 'after_loss', emotions: ['lo_lang'] }]) {
  for (let a = 0; a < 5; a++) {
    const ids = E.recommend(Object.assign({ level: 8 }, o), a).suggestions.map(s => s.id);
    T(`AC-39b ${JSON.stringify(o)} lượt ${a}: không Thở 4–6, Đặt tên, Biết chắc`, !ids.some(i => ['BREATHE_46', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN'].includes(i)), ids);
  }
}
T('R1 lượt đổi không nối R8', E.recommend({ level: 7, flags: ['body'] }, 1).suggestions.every(s => ['CALM_SOUND', 'PAUSE5'].includes(s.id)));
T('xoay vòng R3 lượt 1 → [PAUSE5, GROUND? / R8]', R({ level: 7, emotions: ['lo_lang'] }, 1).ids.length === 2 && !eq(R({ level: 7, emotions: ['lo_lang'] }, 1).ids, R({ level: 7, emotions: ['lo_lang'] }, 0).ids), JSON.stringify(R({ level: 7, emotions: ['lo_lang'] }, 1)));
T('mức 4 → thẻ two_weeks', R({ level: 4 }).cards.includes('two_weeks'));
T('mức 2 → not_alone đứng đầu (không body)', R({ level: 2, flags: ['low', 'not_alone'] }).cards[0] === 'not_alone');
T('thứ tự thẻ: need_doctor → not_alone → ack → ask_stage → two_weeks', eq(R({ level: 4, flags: ['body', 'not_alone', 'self_blame', 'loss'] }).cards, ['need_doctor', 'not_alone', 'self_blame_ack', 'ask_stage_change', 'two_weeks']));
T('after_loss không hỏi đổi chặng đường', !R({ level: 7, stage: 'after_loss', flags: ['loss'] }).cards.includes('ask_stage_change'));
T('self_harm (qua M20) → not_alone + cách gợi ý mức thấp', R({ level: 8, flags: ['self_harm'], stage: 'waiting' }).cards.includes('not_alone') && eq(R({ level: 8, flags: ['self_harm'], stage: 'waiting' }).ids, ['BREATHE_46', 'GROUND_54321']));
T('≤ 2 bài mọi lúc', [0, 1, 2, 3].every(a => E.recommend({ level: 9 }, a).suggestions.length <= 2));

section('6. Tính chất không hạ mức (1.000 tổ hợp)');
let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const pick = (list, p) => list.filter(() => rnd(100) < p);
const EMO = D.EMOTIONS.map(e => e.code), CTX = D.CONTEXTS.map(c => c.code), FL = ['self_harm', 'not_alone', 'self_blame', 'loss', 'body', 'prolonged', 'two_weeks', 'low'];
const STG = [null, ...D.STAGES.map(s => s.code)];
let mono = 0;
for (let i = 0; i < 1000; i++) {
  const base = { level: rnd(11) || null, emotions: pick(EMO, 15), contexts: pick(CTX, 15), flags: pick(FL, 15), stage: STG[rnd(STG.length)], hour: rnd(24), minutes: [null, 1, 3, 5, 10][rnd(5)] };
  const more = Object.assign({}, base, { emotions: [...new Set([...base.emotions, ...pick(EMO, 20)])], contexts: [...new Set([...base.contexts, ...pick(CTX, 20)])], flags: [...new Set([...base.flags, ...pick(FL, 20)])] });
  const c0 = E.recommend(base).cards, c1 = E.recommend(more).cards;
  if (c0.every(c => c1.includes(c))) mono++; else if (mono >= 0) { T('đơn điệu ' + JSON.stringify(base), false, JSON.stringify({ c0, c1, more })); mono = -1e9; }
  const a1 = E.assess({ level: base.level, emotions: base.emotions, flags: base.flags }).flags;
  if (!base.flags.every(f => a1.has(f))) { T('assess giữ cờ cũ', false, JSON.stringify(base)); }
}
T('1.000 tổ hợp: thêm thông tin không làm mất thẻ', mono === 1000, mono);

section('7. Bài đêm (AC-40–42)');
T('after_loss → gợi ý H4, H3, không H1/H2', eq(E.nightList({ stage: 'after_loss' }).suggested, ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER']));
T('cờ loss → như after_loss', eq(E.nightList({ stage: 'waiting', flags: new Set(['loss']) }).suggested, ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER']));
T('waiting → H2, H3', eq(E.nightList({ stage: 'waiting' }).suggested, ['NIGHT_HOME_SHORT', 'NIGHT_TOGETHER']));
T('pause → H3, H4, H1', eq(E.nightList({ stage: 'pause' }).suggested, ['NIGHT_TOGETHER', 'NIGHT_WARM_HAND', 'NIGHT_HOME']));
T('chưa chọn → như none', eq(E.nightList({}).suggested, ['NIGHT_TOGETHER', 'NIGHT_HOME']));
T('all = 4 bài', eq(E.nightList({ stage: 'after_loss' }).all, E.NIGHT));
T('H1 → cổng mỗi lần, không xác nhận', eq(E.nightGate('NIGHT_HOME', { stage: 'waiting' }), { confirmLoss: false, gate: true }));
T('H2 after_loss → xác nhận trước cổng', eq(E.nightGate('NIGHT_HOME_SHORT', { stage: 'after_loss' }), { confirmLoss: true, gate: true }));
T('H3 → không cổng', eq(E.nightGate('NIGHT_TOGETHER', { stage: 'after_loss' }), { confirmLoss: false, gate: false }));
T('gateOutcome', E.gateOutcome('warm').play && eq(E.gateOutcome('heavy').suggest, ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER']) && eq(E.gateOutcome('unsure').suggest, ['NIGHT_TOGETHER']) && !E.gateOutcome('x').play);

section('8. Draft, validate, thư viện, danh mục');
T('thư viện B1–B8 đủ 8 bài khi draft bật', E.library().length === 8);
C.ALLOW_DRAFT_CONTENT = false;
T('draft tắt → thư viện rỗng, gợi ý rỗng, nightList rỗng, stageCard null', !E.library().length && !E.recommend({ level: 7 }).suggestions.length && !E.nightList({}).suggested.length && E.stageCard('waiting') === null);
T('draft tắt → thẻ an toàn vẫn trả (K-14)', E.recommend({ level: 2, flags: ['body'] }).cards.includes('not_alone') && E.recommend({ level: 2, flags: ['body'] }).cards.includes('need_doctor'));
C.ALLOW_DRAFT_CONTENT = true;
T('validate bỏ id lạ, id A2 khi chưa có màn', eq(E.validate(['X', 'PAUSE5', 'SEND_WORDS', 'PAUSE5']), ['PAUSE5']));
T('validate A2 có màn', eq(E.validate(['SEND_WORDS'], { available: ['send_words'] }), ['SEND_WORDS']));
T('không bài nào có holdsBreath (AC-36)', Object.values(D.EXERCISES).every(x => !('holdsBreath' in x)));
T('mỗi bài đủ goal, safety, min, max, type, status, reviewer, reviewedAt (AC-50)', Object.values(D.EXERCISES).every(x => ['goal', 'safety', 'min', 'max', 'type', 'status', 'reviewer', 'reviewedAt'].every(k => k in x && x[k] !== undefined)));
T('B3 không có chữ "bụng"', !/bụng/i.test(JSON.stringify(D.EXERCISES.GROUND_54321)));
T('B4 không có pha siết ở vùng nào', D.EXERCISES.RELEASE.zones.every(z => !/siết|gồng lên|nắm chặt/.test(z.text)));
T('stageCard waiting có chữ, none → null', !!E.stageCard('waiting') && E.stageCard('none') === null);
T('11 thẻ cảm xúc, "Chưa rõ" cuối không xáo', D.EMOTIONS.length === 11 && D.EMOTIONS[10].code === 'unsure' && D.EMOTIONS[10].shuffle === false);
T('24 câu mẫu, không chữ "con"', ['wife', 'husband', 'shared'].every(k => D.SEND_WORDS[k].length === 8) && !/\bcon\b/.test([...D.SEND_WORDS.wife, ...D.SEND_WORDS.husband, ...D.SEND_WORDS.shared].join(' ')));
const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const phones = dataSrc.match(/\b0\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4}\b|\b1[89]00[\s.-]?\d{3,4}\b|\b\d{4,}[\s.-]\d{3,}\b/g) || [];
T('data.js không số điện thoại nào (ngoài 115) (AC-32)', !phones.length, phones.join(','));

section('9. check.*');
const base = { v: 1, id: 'abcdefghij0123456789', at: 1762700000000, day: '2026-11-10', tz: 420 };
const stop = Object.assign({}, base, { kind: 'stop', origin: 'stop', stage: 'waiting', before: 3, emotions: ['lo_lang', 'zzz'], contexts: ['sleep'], minutes: 5, rule: 'R3b',
  done: [{ ex: 'BREATHE_46', at: 1, end: 'complete', x: 1 }], after: null, fit: null, note: 'a', evil: '<img>' });
const cs = E.check.stop(stop);
T('check.stop sạch: bỏ trường lạ, mã lạ', cs && !('evil' in cs) && eq(cs.emotions, ['lo_lang']) && eq(cs.done, [{ ex: 'BREATHE_46', at: 1, end: 'complete' }]) && cs.note === 'a', JSON.stringify(cs));
T('check.stop sai mức → null', E.check.stop(Object.assign({}, stop, { before: 11 })) === null);
T('check.stop sai id → null', E.check.stop(Object.assign({}, stop, { id: '<x>' })) === null);
T('check.night', !!E.check.night(Object.assign({}, base, { kind: 'night', stage: null, script: 'NIGHT_HOME', how: 'pace', music: null, end: 'left', outcome: null })));
T('check.together chỉ đúng trường (AC-56)', eq(Object.keys(E.check.together(Object.assign({}, base, { kind: 'together', exercise: 'C1', emotion: 'lo_lang' }))).sort(), ['at', 'day', 'exercise', 'id', 'kind', 'tz', 'v']));
T('check.stage', !!E.check.stage(Object.assign({}, base, { kind: 'stage', from: null, to: 'after_loss', via: 'result' })) && !E.check.stage(Object.assign({}, base, { kind: 'stage', to: 'x', via: 'result' })));
T('check.habitDay', eq(E.check.habitDay({ v: 1, day: '2026-11-10', at: 1, marks: { sleep: 'x', move: 'a' } }).marks.food, '') && !E.check.habitDay({ v: 1, day: '2026-11-10', at: 1, marks: { sleep: 'y' } }));
T('check.kv', !!E.check.kv({ k: 'role', v: 'wife' }) && !E.check.kv({ k: 'role', v: 'x' }) && !E.check.kv({ k: 'evil', v: 1 }) && eq(E.check.kv({ k: 'sound', v: { volume: 30 } }), { k: 'sound', v: { volume: 30 } }));
T('check.journal chọn theo kind', !!E.check.journal(stop) && !E.check.journal({ kind: 'x' }));

section('10. Hàm thuần');
app.clock.reset();
E.recommend({ level: 3, emotions: ['lo_lang'], hour: 22 }); E.assess({ texts: ['abc'], level: 2 }); E.safetyCheck('mình muốn chết'); E.nightList({}); E.detectPII('0912345678');
T('engine không đọc giờ (Date.now / new Date)', app.clock.calls === 0, app.clock.calls);

console.log(`unit-engine-dev: ${passes} PASS · ${fails} FAIL (bank ${nb} câu)`);
process.exitCode = fails ? 1 : 0;
