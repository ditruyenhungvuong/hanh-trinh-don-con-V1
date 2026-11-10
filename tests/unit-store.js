/* =========================================================
   Unit test js/idb.js + js/store.js – Hành Trình Đón Con (Chủ: qa-tester; T-Q1 10/11/2026). Viết TỪ ĐẶC TẢ.
   Nguồn ca: tech design 5.1 (hai chế độ, quy tắc mở IndexedDB, chuyển none → local), 5.2 (khóa htdc_v1_*), 5.3 (những gì
   KHÔNG BAO GIỜ ghi), 5.4, 5.5 (interface, kiểm shape, migrate, nhiều tab, bị chặn), 5.6 (xuất, xóa), 14.1 (bảng unit-store);
   PRD AC-11, 12, 13, 18, 19, 20, 23, 24.
   Môi trường Node: HTDC_IDB.fake(true, reg) (sổ giả dùng chung giữa các lần nạp = "đĩa"), Web Storage giả của lib/load.js
   (đếm clear()), navigator.storage và BroadcastChannel giả. Ghi lại mọi lần HTDC_IDB.open / drop.
   Lệch đặc tả đã được Team Lead ghi nhận (10/11/2026), test chấp nhận: BroadcastChannel tên 'htdc_v1_db' (đặc tả 'htdc_v1'
   — test chỉ đòi tiền tố htdc_v1); có thêm sự kiện 'unsaved {error}'.
   Hàm chưa có → CHỜ T-03 (FE-3). Có FAIL → exit 1. Chạy dưới 4 múi giờ (kết quả phải trùng).
   Chạy: node tests/unit-store.js
   ========================================================= */
'use strict';
const { createHarness, runInTimezones, fmt } = require('./lib/harness');
const { loadApp, FakeStorage, STORE_CHAIN } = require('./lib/load');
const F = require('./lib/fixture');

if (runInTimezones(__filename, 'unit-store')) main().catch(e => { console.log('LỖI KHUNG TEST: ' + (e && e.stack || e)); process.exitCode = 2; });

async function main() {
  const H = createHarness('unit-store');
  const NOW = F.atLocal('2026-11-10', 9, 0, 0, 420);
  const FOREIGN = { stop4p_x: 'on', lstp_v1_local: '{"x":1}', ss_v1_device: '{"schema":1}', checkin_me_bau_y: '[1,2]', myJourneys: '[{"a":1}]' };
  const FOREIGN_S = { stop4p_active: 'abc' };
  let clearCalls = 0;
  const seed = () => { const l = new FakeStorage(), s = new FakeStorage(); for (const k in FOREIGN) l.setItem(k, FOREIGN[k]); for (const k in FOREIGN_S) s.setItem(k, FOREIGN_S[k]); l.log.length = 0; s.log.length = 0; return { l, s }; };

  /* Một lần "mở app": nạp chuỗi file thuần + idb + store; sổ giả reg dùng chung = đĩa */
  function boot(o) {
    const opts = o || {};
    const st = opts.st || seed();
    const app = loadApp(STORE_CHAIN, { now: opts.now || NOW, local: st.l, session: st.s, config: opts.config });
    const W = app.win, I = W.HTDC_IDB || {}, S = W.HTDC_STORE || {};
    const ev = [], opened = [], dropped = [], persisted = [], channels = [];
    W.navigator = { userAgent: 'node', storage: { persist: async () => { persisted.push(1); return true; }, estimate: async () => ({ usage: 1000, quota: 1e9 }) } };
    W.BroadcastChannel = class { constructor(n) { channels.push(n); this.onmessage = null; } postMessage() {} close() {} addEventListener() {} };
    /* indexedDB thật không được đụng (fake bật): bẫy mọi truy cập */
    W.indexedDB = { open: n => { opened.push('THẬT:' + n); throw new Error('indexedDB thật bị gọi'); }, deleteDatabase: n => { dropped.push('THẬT:' + n); throw new Error('indexedDB thật bị gọi'); } };
    const reg = opts.reg || {};
    if (typeof I.fake === 'function') {
      I.fake(true, reg);
      const o0 = I.open, d0 = I.drop;
      I.open = (n, ...a) => { opened.push(n); return o0(n, ...a); };
      if (typeof d0 === 'function') I.drop = n => { dropped.push(n); return d0(n); };
    }
    if (typeof S.on === 'function') S.on(e => ev.push(e));
    const x = { app, W, I, S, ev, opened, dropped, persisted, channels, reg, st };
    x.done = () => { clearCalls += st.l.clearCalls + st.s.clearCalls; };
    return x;
  }
  const T = (p, ms) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('quá ' + (ms || 3000) + ' ms (Promise treo)')), ms || 3000))]);
  const tick = () => new Promise(r => setTimeout(r, 15));
  const NEED = ['boot', 'startNone', 'startLocal', 'mode', 'consent', 'setWriting', 'canSave', 'prefs', 'journal', 'habits', 'exportJson', 'exportCsv', 'exportRaw', 'clearAll', 'on'];
  /* Một ca async: thiếu hàm → CHỜ T-03; lỗi / treo → FAIL kèm lý do */
  async function C(name, fn, need) {
    const probe = boot();
    const miss = (need || NEED).filter(f => !(f in probe.S)).concat(typeof probe.I.fake === 'function' ? [] : ['HTDC_IDB.fake']);
    probe.done();
    if (miss.length) return H.wait(name, 'CHỜ T-03 (FE-3) — chưa có ' + miss.join(', '));
    try { const r = await fn(); if (Array.isArray(r)) H.ok(name, !!r[0], r[1]); else if (r !== undefined) H.ok(name, !!r); }
    catch (e) { H.ok(name, false, 'ném lỗi: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
  }
  const sets = st => st.log.filter(x => x[0] !== 'get').map(x => x[0] + ':' + x[1]);
  const dbData = (reg, s) => { const e = reg.htdc_v1_db; const m = e && e.data && e.data[s]; return m && typeof m.values === 'function' ? [...m.values()] : []; };
  const stopIn = o => F.stopRec(Object.assign({ id: undefined, at: undefined, day: undefined, tz: undefined }, o || {}));
  const clean = r => { const x = Object.assign({}, r); for (const k of Object.keys(x)) if (x[k] === undefined) delete x[k]; return x; };
  const addStop = (S, o) => S.journal.add(clean(stopIn(o)));
  /* Đi tới chế độ local (đã đồng ý) */
  async function toLocal(x, writing) { await T(x.S.boot()); return T(x.S.startLocal({ journey: true, writing: !!writing })); }

  /* ===== 1. Mở app lần đầu, "Không lưu gì" (AC-11, ADR 0010) ===== */
  H.section('1. Lần đầu, "Không lưu gì" (5.1, AC-11)');
  await C('boot lần đầu → mode "unset", không ghi khóa nào, không mở DB', async () => {
    const x = boot(); const r = await T(x.S.boot()); x.done();
    return [r && r.mode === 'unset' && x.S.mode() === 'unset' && !sets(x.st.l).length && !sets(x.st.s).length && !x.opened.length && !x.reg.htdc_v1_db, fmt({ r, l: sets(x.st.l), opened: x.opened })];
  });
  await C('AC-11: startNone + vai + giai đoạn + bản ghi có chữ + thói quen → localStorage/sessionStorage không khóa mới, không mở/ tạo DB', async () => {
    const x = boot(); await T(x.S.boot()); x.S.startNone();
    x.S.prefs.set('role', 'wife'); x.S.prefs.set('stage', { code: 'waiting', at: NOW });
    addStop(x.S, { note: 'chữ bí mật', texts: { thought: 'tại mình' } }); x.S.journal.add(clean(F.nightRec({ id: undefined, at: undefined, day: undefined, tz: undefined })));
    try { x.S.habits.set('2026-11-10', 'sleep', 'x'); } catch (e) { /* A2 */ }
    await tick(); x.done();
    return [x.S.mode() === 'none' && !sets(x.st.l).length && !sets(x.st.s).length && !x.opened.length && !x.reg.htdc_v1_db && x.S.journal.list().length === 2,
      fmt({ l: sets(x.st.l), s: sets(x.st.s), opened: x.opened, n: x.S.journal.list().length })];
  });
  await C('none: consent() = {journey:true, writing:false}; canSave("writing") = false', async () => {
    const x = boot(); await T(x.S.boot()); x.S.startNone(); const c = x.S.consent(); x.done();
    return [c && c.journey === true && c.writing === false && x.S.canSave('writing') === false, fmt(c)];
  });
  await C('none: chữ tự viết không vào bản ghi (note, texts)', async () => {
    const x = boot(); await T(x.S.boot()); x.S.startNone(); const r = addStop(x.S, { note: 'abc', texts: { thought: 'x' } }); x.done();
    return [r && !('note' in r) && !('texts' in r) && x.S.journal.list().every(y => !('note' in y) && !('texts' in y)), fmt(r)];
  });
  await C('none: tải lại → "unset", vai/giai đoạn/bản ghi mất sạch (PRD 3.6)', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await T(a.S.boot()); a.S.startNone(); a.S.prefs.set('role', 'wife'); addStop(a.S); await tick(); a.done();
    const b = boot({ st, reg }); const r = await T(b.S.boot()); b.done();
    return [r.mode === 'unset' && b.S.prefs.get('role') == null && b.S.journal.list().length === 0, fmt({ r, role: b.S.prefs.get('role') })];
  });

  /* ===== 2. Đồng ý lưu trên máy (AC-12, 5.1, 5.2) ===== */
  H.section('2. "Lưu trên máy này" (AC-12, 5.1, 5.2)');
  await C('startLocal ghi htdc_v1_device {schema:1, consent{journey, writing, version, at}}, mở DB "htdc_v1_db", persist()', async () => {
    const x = boot(); const ok = await toLocal(x, false); await tick(); x.done();
    let dev = null; try { dev = JSON.parse(x.st.l.getItem('htdc_v1_device')); } catch (e) { dev = 'JSON hỏng'; }
    const c = dev && dev.consent;
    return [ok === true && x.S.mode() === 'local' && dev.schema === 1 && c && c.journey === true && c.writing === false && c.version === '0.1' && c.at === NOW
      && x.opened.includes('htdc_v1_db') && x.opened.every(n => n === 'htdc_v1_db') && x.persisted.length >= 1, fmt({ ok, dev, opened: x.opened, persisted: x.persisted.length })];
  });
  await C('5.2: chỉ ghi khóa htdc_v1_*; sessionStorage không đụng; khóa app khác còn nguyên', async () => {
    const x = boot(); await toLocal(x, true); x.S.prefs.set('role', 'husband'); addStop(x.S, { note: 'n' }); await x.S.setWriting(false, { purge: true }); await tick(); x.done();
    const bad = x.st.l.log.filter(([op, k]) => op !== 'get' && !k.startsWith('htdc_v1_'));
    return [!bad.length && !sets(x.st.s).length && Object.entries(FOREIGN).every(([k, v]) => x.st.l.getItem(k) === v), fmt({ bad, s: sets(x.st.s) })];
  });
  await C('boot có khóa đánh dấu → "local", đọc lại vai, bản ghi', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a); a.S.prefs.set('role', 'wife'); addStop(a.S); addStop(a.S, { before: 7 }); await tick(); a.done();
    const b = boot({ st, reg }); const r = await T(b.S.boot()); b.done();
    return [r.mode === 'local' && b.S.prefs.get('role') === 'wife' && b.S.journal.list().length === 2 && r.problems === 0, fmt({ r, n: b.S.journal.list().length })];
  });
  await C('AC-24: startLocal({journey:false, writing:false}) → như "Không lưu gì": không ghi khóa nào, không mở DB', async () => {
    const x = boot(); await T(x.S.boot()); const ok = await T(x.S.startLocal({ journey: false, writing: false })); x.done();
    return [ok === false && x.S.mode() === 'none' && x.st.l.getItem('htdc_v1_device') === null && !x.opened.length, fmt({ ok, mode: x.S.mode(), opened: x.opened })];
  });
  await C('trình duyệt chặn ghi (localStorage ném lỗi) → startLocal false, sự kiện "blocked", chạy none', async () => {
    const l = new FakeStorage({ blockSet: true }), s = new FakeStorage();
    const x = boot({ st: { l, s } }); await T(x.S.boot()); const ok = await T(x.S.startLocal({ journey: true, writing: false })); x.done();
    return [ok === false && x.S.mode() === 'none' && x.ev.some(e => e.type === 'blocked'), fmt({ ok, mode: x.S.mode(), ev: x.ev.map(e => e.type) })];
  });
  await C('DB mới hơn app (schema 9) → không mở, không ghi đè khóa, sự kiện versionTooNew', async () => {
    const st = seed(); st.l.setItem('htdc_v1_device', JSON.stringify({ schema: 9, consent: { journey: true, writing: false, version: '0.1', at: 1 } })); st.l.log.length = 0;
    const x = boot({ st }); const r = await T(x.S.boot()); await x.S.startLocal({ journey: true }); x.done();
    return [r.mode !== 'local' && x.ev.some(e => e.type === 'versionTooNew') && JSON.parse(st.l.getItem('htdc_v1_device')).schema === 9, fmt({ r, ev: x.ev.map(e => e.type) })];
  });
  await C('nhiều tab: BroadcastChannel tên tiền tố htdc_v1 (Team Lead chấp nhận "htdc_v1_db")', async () => {
    const x = boot(); await toLocal(x); addStop(x.S); await tick(); x.done();
    return [x.channels.length >= 1 && x.channels.every(n => /^htdc_v1/.test(n)), fmt(x.channels)];
  });

  /* ===== 3. Chuyển none → local (5.1) ===== */
  H.section('3. Chuyển "Không lưu gì" → "Lưu trên máy" (5.1)');
  await C('mặc định KHÔNG mang bản ghi của phiên none; vai/giai đoạn mang theo', async () => {
    const x = boot(); await T(x.S.boot()); x.S.startNone(); x.S.prefs.set('role', 'wife'); addStop(x.S);
    await T(x.S.startLocal({ journey: true, writing: false })); await tick(); x.done();
    return [x.S.journal.list().length === 0 && dbData(x.reg, 'journal').length === 0 && x.S.prefs.get('role') === 'wife', fmt({ n: x.S.journal.list().length })];
  });
  await C('{carry:true} → mang bản ghi; chưa đồng ý chữ thì bỏ note/texts', async () => {
    const x = boot(); await T(x.S.boot()); x.S.startNone(); addStop(x.S);
    await T(x.S.startLocal({ journey: true, writing: false }, { carry: true })); await tick(); x.done();
    const disk = dbData(x.reg, 'journal');
    return [x.S.journal.list().length === 1 && disk.length === 1 && disk.every(r => !('note' in r) && !('texts' in r)), fmt(disk)];
  });

  /* ===== 4. Chữ tự viết (AC-13, AC-24, K-8) ===== */
  H.section('4. Chữ tự viết (AC-13, AC-24)');
  await C('AC-13: lưu hành trình bật, chữ tắt → bản ghi có mức, thẻ, tình huống, bài; KHÔNG có chữ (bộ nhớ + đĩa)', async () => {
    const x = boot(); await toLocal(x, false); const r = addStop(x.S, { note: 'Mình lo quá', texts: { thought: 'tại mình', know: ['a'] }, contexts: ['waiting'] }); await tick(); x.done();
    const disk = dbData(x.reg, 'journal');
    return [r && r.before === 3 && r.emotions[0] === 'lo_lang' && r.contexts[0] === 'waiting' && r.done.length === 1 && !('note' in r) && !('texts' in r)
      && disk.length === 1 && !('note' in disk[0]) && !('texts' in disk[0]), fmt({ r, disk })];
  });
  await C('chữ bật → note/texts được lưu', async () => {
    const x = boot(); await toLocal(x, true); addStop(x.S, { note: 'ghi', texts: { thought: 'tại mình' } }); await tick(); x.done();
    const d = dbData(x.reg, 'journal')[0] || {};
    return [d.note === 'ghi' && d.texts && d.texts.thought === 'tại mình', fmt(d)];
  });
  await C('AC-24: setWriting(false, {purge:true}) → không bản ghi nào còn chữ (bộ nhớ + đĩa + mở lại)', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a, true); addStop(a.S, { note: 'một' }); addStop(a.S, { texts: { thought: 'hai' } });
    await T(a.S.setWriting(false, { purge: true })); await tick(); a.done();
    const b = boot({ st, reg }); await T(b.S.boot()); b.done();
    const all = [...a.S.journal.list(), ...dbData(reg, 'journal'), ...b.S.journal.list()];
    return [all.length === 6 && all.every(r => !('note' in r) && !('texts' in r)) && b.S.consent().writing === false, fmt(all.map(r => r.note || r.texts))];
  });
  await C('AC-24: setWriting(false) không purge ("Giữ chữ cũ") → chữ cũ còn, chữ mới không lưu', async () => {
    const x = boot(); await toLocal(x, true); const r1 = addStop(x.S, { note: 'cũ' }); await T(x.S.setWriting(false)); const r2 = addStop(x.S, { note: 'mới' }); await tick(); x.done();
    const disk = dbData(x.reg, 'journal'); const o = disk.find(r => r.id === r1.id), n = disk.find(r => r.id === r2.id);
    return [o && o.note === 'cũ' && n && !('note' in n), fmt(disk)];
  });

  /* ===== 5. Không bao giờ ghi (5.3, AC-23) ===== */
  H.section('5. Những gì KHÔNG BAO GIỜ ghi (5.3, AC-23)');
  const NEVER = { flags: ['self_harm', 'loss'], selfHarm: true, safetyAnswer: 'yes', answer: 'yes', urgent: true, openedUrgent: true, gate: 'heavy', gateAnswer: 'warm', groups: ['loss'], body: true, order: ['a'], recipient: 'chồng', sendText: 'gửi' };
  await C('AC-23: đồng ý đủ (hành trình + chữ) mà add/update có trường an toàn → không lưu trường nào (bộ nhớ, đĩa, JSON xuất)', async () => {
    const x = boot(); await toLocal(x, true); const r = x.S.journal.add(Object.assign(clean(stopIn()), NEVER));
    if (r) x.S.journal.update(r.id, Object.assign({ after: 6 }, NEVER));
    x.S.journal.add(Object.assign(clean(F.nightRec({ id: undefined, at: undefined, day: undefined, tz: undefined })), NEVER));
    await tick(); x.done();
    const all = [...x.S.journal.list(), ...dbData(x.reg, 'journal')];
    const leak = all.flatMap(rec => Object.keys(NEVER).filter(k => k in rec));
    const js = x.S.exportJson();
    return [all.length === 4 && !leak.length && !/self_harm|safetyAnswer|gateAnswer|openedUrgent|recipient/.test(js), fmt({ leak, n: all.length })];
  });
  /* N-1 (lượt 3, Team Lead chốt): StopRec.rule lộ cờ từ khóa nhóm cơ thể 8.2b (R1 ⇔ body) → bản ghi lưu xuống máy KHÔNG có rule */
  await C('N-1: add / update StopRec có rule (R1, R3…) → bộ nhớ, đĩa, JSON xuất, bản sao nguyên văn đều không có trường rule', async () => {
    const x = boot(); await toLocal(x, true);
    const a = addStop(x.S, { rule: 'R1' }), b = addStop(x.S, { rule: 'R3' });
    if (a) x.S.journal.update(a.id, { rule: 'R1', after: 6 });
    if (b) x.S.journal.update(b.id, { rule: 'R2' });
    await tick(); x.done();
    const all = [...x.S.journal.list({ kind: 'stop' }), ...dbData(x.reg, 'journal')];
    const js = x.S.exportJson(), raw = await T(x.S.exportRaw());
    return [all.length === 4 && all.every(r => !('rule' in r)) && !/"rule"/.test(js) && !/"rule"/.test(raw), fmt({ n: all.length, rule: all.map(r => r.rule), js: /"rule"/.test(js), raw: /"rule"/.test(raw) })];
  });
  await C('N-1: bản ghi CŨ trên đĩa còn rule (trước N-1) → đọc lên / xuất JSON không còn rule', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a); addStop(a.S, { before: 4 }); await tick(); a.done();
    for (const r of dbData(reg, 'journal')) r.rule = 'R1';   // giả lập bản ghi do bản cũ ghi
    const b = boot({ st, reg }); await T(b.S.boot()); b.done();
    const l = b.S.journal.list({ kind: 'stop' }), js = b.S.exportJson();
    return [l.length === 1 && !('rule' in l[0]) && !/"rule"/.test(js), fmt({ n: l.length, rule: l.map(r => r.rule), js: /"rule"/.test(js) })];
  });
  await C('AC-23: kho kv không nhận khóa phiên (flags, session, gate, safety) — chỉ sống trong bộ nhớ hoặc bị từ chối', async () => {
    const x = boot(); await toLocal(x); for (const k of ['flags', 'session', 'gate', 'safety']) { try { x.S.prefs.set(k, ['self_harm']); } catch (e) { /* từ chối là được */ } }
    await tick(); x.done();
    const keys = dbData(x.reg, 'kv').map(r => r.k);
    return [!keys.some(k => ['flags', 'session', 'gate', 'safety'].includes(k)) && !Object.keys(x.st.l).some(k => /flags|session|gate|safety/.test(k)), fmt(keys)];
  });
  await C('journal.add trả bản sao (sửa object trả về không đổi kho)', async () => {
    const x = boot(); await toLocal(x); const r = addStop(x.S); r.before = 10; r.emotions.push('co_don'); x.done();
    const y = x.S.journal.list()[0];
    return [y.before === 3 && y.emotions.length === 1, fmt(y)];
  });

  /* ===== 6. Dữ liệu hỏng (5.5) ===== */
  H.section('6. Bản ghi hỏng không bị ghi đè (5.5)');
  await C('bản ghi hỏng trên đĩa: bỏ khỏi bộ nhớ, đếm problems, giữ nguyên trong DB sau nhiều lần ghi/xóa/mở lại; exportRaw có nó', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a); addStop(a.S); await tick(); a.done();
    const BAD = { v: 1, kind: 'stop', id: 'zzzzzzzzzzzzzzzzzzzz', at: 'không phải số', note: '<img src=x onerror=alert(1)>' };
    reg.htdc_v1_db.data.journal.set(BAD.id, JSON.parse(JSON.stringify(BAD)));
    const b = boot({ st, reg }); const r = await T(b.S.boot());
    const keep = b.S.journal.list()[0]; addStop(b.S); if (keep) await T(b.S.journal.remove(keep.id)); await T(b.S.setWriting(true)); await tick();
    const raw = JSON.parse(await T(b.S.exportRaw())); b.done();
    const c = boot({ st, reg }); const r2 = await T(c.S.boot()); c.done();
    const still = reg.htdc_v1_db.data.journal.get(BAD.id);
    const inRaw = JSON.stringify(raw).includes(BAD.id);
    return [r.problems >= 1 && !b.S.journal.list().some(x => x.id === BAD.id) && fmt(still) === fmt(BAD) && inRaw && r2.problems >= 1 && b.ev.some(e => e.type === 'corrupt'),
      fmt({ r, r2, still, inRaw, ev: b.ev.map(e => e.type) })];
  });
  await C('khóa đánh dấu hỏng (không phải JSON) → không vỡ, không ném lỗi', async () => {
    const st = seed(); st.l.setItem('htdc_v1_device', '{hỏng'); const x = boot({ st }); const r = await T(x.S.boot()); x.done();
    return [r && ['local', 'none', 'unset'].includes(r.mode), fmt(r)];
  });

  /* ===== 7. Danh sách, sửa, xóa (AC-19) ===== */
  H.section('7. journal list / update / remove (AC-19), habits');
  await C('list mới nhất trước; lọc kind; limit', async () => {
    const x = boot(); await toLocal(x);
    x.app.clock.set(NOW); addStop(x.S); x.app.clock.set(NOW + 60000); x.S.journal.add(clean(F.nightRec({ id: undefined, at: undefined, day: undefined, tz: undefined }))); x.app.clock.set(NOW + 120000); addStop(x.S, { before: 9 });
    x.done();
    const l = x.S.journal.list(), s = x.S.journal.list({ kind: 'stop' }), one = x.S.journal.list({ limit: 1 });
    return [l.length === 3 && l[0].at >= l[1].at && l[1].at >= l[2].at && s.length === 2 && s.every(r => r.kind === 'stop') && one.length === 1 && one[0].before === 9, fmt(l.map(r => [r.kind, r.at]))];
  });
  await C('bản ghi mới có id 20 ký tự [0-9a-z], at = giờ app, day/tz đúng 5.3', async () => {
    const x = boot(); await toLocal(x); const r = addStop(x.S); x.done();
    const tz = -new Date(NOW).getTimezoneOffset();
    return [r && /^[0-9a-z]{20}$/.test(r.id) && r.at === NOW && r.tz === tz && r.day === new Date(NOW + tz * 60000).toISOString().slice(0, 10) && r.v === 1, fmt(r)];
  });
  await C('update(id, {after, fit}) → cập nhật bộ nhớ + đĩa; id lạ → null', async () => {
    const x = boot(); await toLocal(x); const r = addStop(x.S, { after: null, fit: null }); const u = x.S.journal.update(r.id, { after: 6, fit: 'fit' }); const z = x.S.journal.update('khongcoidnaocaxxxxxx', { after: 1 }); await tick(); x.done();
    const d = dbData(x.reg, 'journal').find(y => y.id === r.id);
    return [u && u.after === 6 && d && d.after === 6 && d.fit === 'fit' && z == null, fmt({ u, d, z })];
  });
  await C('update không đổi được id / kind', async () => {
    const x = boot(); await toLocal(x); const r = addStop(x.S); x.S.journal.update(r.id, { id: 'aaaaaaaaaaaaaaaaaaaa', kind: 'night' }); await tick(); x.done();
    const l = x.S.journal.list();
    return [l.length === 1 && l[0].id === r.id && l[0].kind === 'stop', fmt(l)];
  });
  await C('AC-19: remove(id) → mất ở bộ nhớ và đĩa, bản khác còn', async () => {
    const x = boot(); await toLocal(x); const a = addStop(x.S), b = addStop(x.S); await T(x.S.journal.remove(a.id)); await tick(); x.done();
    const d = dbData(x.reg, 'journal').map(r => r.id);
    return [x.S.journal.list().length === 1 && !d.includes(a.id) && d.includes(b.id), fmt(d)];
  });
  await C('habits: set/get/range/removeDay (kho habits, A2 dùng)', async () => {
    const x = boot(); await toLocal(x);
    x.S.habits.set('2026-11-09', 'sleep', 'x'); x.S.habits.set('2026-11-10', 'move', 'a'); x.S.habits.set('2026-11-10', 'evil', 'x'); x.S.habits.set('2026-11-10', 'food', 'z');
    const g = x.S.habits.get('2026-11-10'), rg = x.S.habits.range('2026-11-09', '2026-11-10');
    await T(x.S.habits.removeDay('2026-11-09')); await tick(); x.done();
    const d = dbData(x.reg, 'habits');
    return [g && g.marks.move === 'a' && !('evil' in g.marks) && g.marks.food !== 'z' && arr(rg).length === 2 && d.length === 1 && d[0].day === '2026-11-10', fmt({ g, rg, d })];
  });

  /* ===== 8. Xuất (AC-18, 5.5) ===== */
  H.section('8. Xuất JSON / CSV (AC-18, 5.5)');
  /* Ghi thẳng bản ghi mẫu (tz 420) lên đĩa rồi mở lại: kết quả không phụ thuộc múi giờ máy */
  async function withData() {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a); a.S.prefs.set('role', 'wife'); a.S.prefs.set('stage', { code: 'waiting', at: NOW }); a.S.prefs.set('habits', { enabled: ['sleep', 'move'] }); await tick(); a.done();
    const J = reg.htdc_v1_db.data.journal, Hb = reg.htdc_v1_db.data.habits;
    const s1 = F.stopRec({ id: 'a0000000000000000001', day: '2026-11-10', at: F.atLocal('2026-11-10', 21, 5, 0, 420), tz: 420, emotions: ['lo_lang', 'co_don'], contexts: ['couple'], before: 2, after: 4, fit: 'fit' });
    const s2 = F.stopRec({ id: 'a0000000000000000002', day: '2026-11-11', at: F.atLocal('2026-11-11', 7, 0, 0, 420), tz: 420, before: null, after: null, fit: null });
    for (const r of [s1, s2, F.nightRec({ id: 'a0000000000000000003' }), F.togetherRec({ id: 'a0000000000000000004' }), F.stageRec({ id: 'a0000000000000000005' })]) J.set(r.id, r);
    Hb.set('2026-11-10', F.habitDay('2026-11-10', { sleep: 'x', move: 'a' }));
    const b = boot({ st, reg }); await T(b.S.boot()); b.done();
    return { S: b.S, s1, s2 };
  }
  const parseCsv = t => {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
      if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\r' && t[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  };
  await C('AC-18: exportJson đủ: app, schema, exportedAt, consent, prefs{role, stage, habits}, journal (mọi loại), habits', async () => {
    const { S } = await withData(); const j = JSON.parse(S.exportJson());
    const kinds = [...new Set(j.journal.map(r => r.kind))].sort();
    return [j.app === 'hanh-trinh-don-con' && j.schema === 1 && typeof j.exportedAt === 'number' && j.consent && j.consent.journey === true && j.prefs.role === 'wife' && j.prefs.stage && j.prefs.stage.code === 'waiting'
      && j.prefs.habits && j.journal.length === 5 && fmt(kinds) === fmt(['night', 'stage', 'stop', 'together']) && j.habits.length === 1, fmt({ keys: Object.keys(j), prefs: j.prefs, kinds })];
  });
  await C('AC-18: CSV check-in: BOM, CRLF, 9 cột đúng thứ tự 5.5, dd/mm/yyyy + HH:MM theo tz bản ghi', async () => {
    const { S } = await withData(); const t = S.exportCsv('stops');
    const rows = parseCsv(t.replace(/^﻿/, '')); const head = rows[0] || [];
    const NAMES = ['Ngày', 'Giờ', 'Giai đoạn', 'Mức trước', 'Thẻ cảm xúc', 'Tình huống', 'Bài', 'Mức sau', 'Phù hợp'];
    const headOk = head.length === 9 && NAMES.every((n, i) => String(head[i]).startsWith(n));
    const r1 = rows.find(r => r[0] === '10/11/2026');
    return [t.charCodeAt(0) === 0xFEFF && /\r\n/.test(t) && !/[^\r]\n/.test(t) && headOk && rows.length === 3 && r1 && r1[1] === '21:05' && r1[3] === '2' && r1[7] === '4' && rows.some(r => r[0] === '11/11/2026' && r[1] === '07:00' && r[3] === '' && r[7] === ''),
      fmt(rows)];
  });
  await C('CSV: không ô nào bắt đầu bằng = + - @ (chặn công thức, qua U.csvCell)', async () => {
    const { S } = await withData(); const bad = [];
    for (const what of ['stops', 'habits']) for (const r of parseCsv(S.exportCsv(what).replace(/^﻿/, ''))) for (const c of r) if (/^[=+\-@\t\r]/.test(c)) bad.push(what + ':' + c);
    return [!bad.length, bad.join(', ')];
  });
  await C('CSV thói quen: BOM, cột Ngày + 7 thói quen, ô Có / Tự đánh dấu / —', async () => {
    const { S } = await withData(); const t = S.exportCsv('habits'); const rows = parseCsv(t.replace(/^﻿/, ''));
    const r = rows.find(x => x[0] === '10/11/2026') || [];
    return [t.charCodeAt(0) === 0xFEFF && rows[0].length === 8 && rows[0][0].startsWith('Ngày') && r.includes('Có') && r.includes('Tự đánh dấu') && r.includes('—'), fmt(rows)];
  });

  /* ===== 9. Xóa toàn bộ (AC-20) ===== */
  H.section('9. Xóa toàn bộ (AC-20, 5.6)');
  await C('AC-20: clearAll → xóa DB htdc_v1_db + mọi khóa htdc_v1_* (kể cả backup); khóa app khác còn; không clear(); về "unset"', async () => {
    const st = seed(); st.l.setItem('htdc_v1_backup_v1', '{"old":1}');
    const x = boot({ st }); await toLocal(x, true); addStop(x.S, { note: 'x' }); x.S.prefs.set('role', 'wife'); await tick();
    await T(x.S.clearAll()); x.done();
    return [!x.reg.htdc_v1_db && x.dropped.includes('htdc_v1_db') && !Object.keys(st.l).some(k => k.startsWith('htdc_')) && Object.entries(FOREIGN).every(([k, v]) => st.l.getItem(k) === v)
      && Object.entries(FOREIGN_S).every(([k, v]) => st.s.getItem(k) === v) && st.l.clearCalls === 0 && st.s.clearCalls === 0 && x.S.mode() === 'unset' && x.S.journal.list().length === 0 && x.S.prefs.get('role') == null,
      fmt({ db: !!x.reg.htdc_v1_db, dropped: x.dropped, keys: Object.keys(st.l), mode: x.S.mode() })];
  });
  /* n-3 (lượt 3): xóa DB thất bại / bị chặn → clearAll phải báo false để M18 không báo "Đã xóa toàn bộ." */
  await C('n-3: HTDC_IDB.drop thất bại → clearAll trả false (không báo thành công)', async () => {
    const x = boot(); await toLocal(x, true); addStop(x.S, { note: 'chữ riêng' }); await tick();
    x.I.drop = n => { x.dropped.push('FAIL:' + n); return Promise.resolve(false); };
    const r = await T(x.S.clearAll()); x.done();
    return [r === false, fmt({ r, dropped: x.dropped })];
  });
  await C('clearAll ở chế độ none không mở/tạo IndexedDB (AC-11)', async () => {
    const x = boot(); await T(x.S.boot()); x.S.startNone(); addStop(x.S); await T(x.S.clearAll()); x.done();
    return [!x.opened.length && !x.reg.htdc_v1_db && !sets(x.st.l).length, fmt({ opened: x.opened, l: sets(x.st.l) })];
  });
  await C('sau clearAll mở lại → "unset" (về M01)', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a); addStop(a.S); await tick(); await T(a.S.clearAll()); a.done();
    const b = boot({ st, reg }); const r = await T(b.S.boot()); b.done();
    return [r.mode === 'unset' && !b.opened.length, fmt({ r, opened: b.opened })];
  });

  /* ===== 10. Migrate (5.5) ===== */
  H.section('10. Migrate giả v1 → v2 có bản chụp (5.5)');
  await C('migrate v1 → v2: chạy MIGRATIONS[2] một lần, có bản chụp backups + khóa htdc_v1_backup_v1, khóa đánh dấu schema 2; lần mở sau xóa bản chụp', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a); addStop(a.S, { before: 4 }); await tick(); a.done();
    const b = boot({ st, reg, config: { SCHEMA: 2 } }); let ran = 0;
    b.S.MIGRATIONS[2] = async m => { ran++; const all = await m.getAll('journal'); for (const r of all) { r.before = r.before + 1; await m.put('journal', r); } };
    const r = await T(b.S.boot()); await tick(); b.done();
    const bkDb = [...((reg.htdc_v1_db.data.backups || new Map()).keys())].map(String);
    let dev = null; try { dev = JSON.parse(st.l.getItem('htdc_v1_device')); } catch (e) { dev = 'hỏng'; }
    const key2 = st.l.getItem('htdc_v1_backup_v1') !== null;
    const v = (b.S.journal.list()[0] || {}).before;
    const c = boot({ st, reg, config: { SCHEMA: 2 } }); await T(c.S.boot()); await tick(); c.done();
    const bkDb3 = [...((reg.htdc_v1_db.data.backups || new Map()).keys())].map(String), key3 = st.l.getItem('htdc_v1_backup_v1') !== null;
    return [r.mode === 'local' && ran === 1 && bkDb.some(k => /htdc_v1_backup_v1/.test(k)) && key2 && dev.schema === 2 && v === 5 && !key3 && !bkDb3.some(k => /htdc_v1_backup_v1/.test(k)),
      fmt({ ran, bkDb, key2, schema: dev && dev.schema, v, bkDb3, key3 })];
  }, NEED.concat(['MIGRATIONS']));

  /* ===== 11. Dữ liệu lớn ===== */
  H.section('11. Dữ liệu lớn (fixture 3.000 bản ghi + 400 ngày)');
  await C('3.000 bản ghi + 400 ngày: mở lại đọc đủ, xuất JSON / CSV được, < 3 s', async () => {
    const st = seed(), reg = {};
    const a = boot({ st, reg }); await toLocal(a); await tick(); a.done();
    const big = F.big('2026-11-10', 5);
    for (const r of big.journal) reg.htdc_v1_db.data.journal.set(r.id, r);
    for (const h of big.habits) reg.htdc_v1_db.data.habits.set(h.day, h);
    const t0 = Date.now(); const b = boot({ st, reg }); const r = await T(b.S.boot(), 5000);
    const n = b.S.journal.list().length; const j = JSON.parse(b.S.exportJson()); const csv = b.S.exportCsv('stops'); const ms = Date.now() - t0; b.done();
    return [r.problems === 0 && n === 3000 && j.journal.length === 3000 && j.habits.length === 400 && csv.split('\r\n').length > 2000 && ms < 3000, fmt({ problems: r.problems, n, habits: j.habits.length, ms })];
  });

  H.section('12. Tổng');
  H.ok('không lần nào gọi localStorage.clear() / sessionStorage.clear() (AC-20)', clearCalls === 0, clearCalls);
  H.done();
}
function arr(x) { return Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []; }
