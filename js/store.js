/* =========================================================
   Hành Trình Đón Con – js/store.js · window.HTDC_STORE · Chủ: FE-3 Lưu trữ & Dữ liệu của mình
   Nguồn: apps/sung-suc/js/store.js @ 10/11/2026 (khung: guard khóa, khóa đánh dấu trước khi mở DB, ghi nối tiếp có
   hàng chờ khi lỗi, bản hỏng không ghi đè, migrate có bản chụp, BroadcastChannel, clearAll) — ADR 0008.
   Chỗ khác bản gốc: bỏ hồ sơ, hai pha, mã khóa, nhập, Bước B; đọc HẾT vào bộ nhớ lúc boot; thêm chế độ 'unset',
   đồng ý tách đôi (hành trình / chữ tự viết), journal + habits + prefs (kho kv), CSV theo tech design 5.5.
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 5 (interface 5.5), ADR 0010, 0011; PRD AC-11, 13, 18–20, 23, 24.
   - File DUY NHẤT chạm localStorage, và CHỈ khóa htdc_v1_* (guard). Không clear(). IndexedDB đi qua HTDC_IDB.
   - Chưa có htdc_v1_device thì KHÔNG mở IndexedDB. "Không lưu gì" = HTDC_IDB.memory(), không ghi Web Storage (AC-11).
   - Bản ghi chỉ giữ trường có tên trong FIELDS, rồi qua E.check.<kind>: không có chỗ cho câu trả lời an toàn,
     cờ từ khóa, việc mở trang khẩn (AC-23). Chữ tự viết (note, texts) chỉ vào bản ghi khi canSave('writing') (AC-13).
   - Dữ liệu đọc lại là không tin được: bản hỏng bỏ khỏi bộ nhớ, giữ nguyên trong DB, không bao giờ ghi đè (bad).
   - Trả ra bản sao (sửa bản trả về không đổi kho).
   Sự kiện S.on: change {store:'kv'|'journal'|'habits'|'mode'|'consent'|'all'} · blocked · quota {warn?} ·
   unsaved {error} (lỗi ghi khác) · corrupt {what?, n} · versionTooNew · otherTab {reload?}.
   ========================================================= */
window.HTDC_STORE = (() => {
  'use strict';
  const C = window.HTDC_CONFIG || {}, U = window.HTDC_UTIL, I = window.HTDC_IDB;
  const E = () => window.HTDC_ENGINE || {}, D = () => window.HTDC_DATA || {};
  const PREFIX = 'htdc_v1_', DEVICE_KEY = 'htdc_v1_device', DB_NAME = 'htdc_v1_db', BACKUP = 'htdc_v1_backup_v';
  const SCHEMA = () => C.SCHEMA || 1;
  const MIGRATIONS = {};   // { 2: async m => {…} }; m có getAll/put/del, chạy trong transaction nâng version

  /* ===== Trường được phép (lớp chặn thứ nhất; E.check kiểm giá trị). Tech design 5.3 ===== */
  // StopRec không có 'rule' (R1 ⇔ cờ 8.2b; N-1, Team Lead chốt 10/11/2026)
  const BASE = ['v', 'kind', 'id', 'at', 'day', 'tz'];
  const FIELDS = {
    stop: BASE.concat(['origin', 'stage', 'before', 'emotions', 'contexts', 'minutes', 'done', 'after', 'fit', 'note', 'texts']),
    night: BASE.concat(['stage', 'script', 'how', 'music', 'end', 'outcome']),
    together: BASE.concat(['exercise']),
    stage: BASE.concat(['from', 'to', 'via']),
    habitDay: ['v', 'day', 'marks', 'at']
  };
  const KINDS = ['stop', 'night', 'together', 'stage'];
  const KV_KEYS = ['role', 'stage', 'habits', 'closedCards', 'sound'];   // khóa khác chỉ sống trong bộ nhớ
  const WRITING = ['note', 'texts'];
  const HABITS = ['sleep', 'move', 'food', 'connect', 'pause', 'screen', 'no_smoke'];
  const MARKS = ['', 'x', 'a'];
  const ID_RE = /^[0-9a-z]{20}$/;

  /* ===== localStorage: chỉ khóa htdc_v1_ ===== */
  const guard = k => { if (typeof k !== 'string' || !k.startsWith(PREFIX)) throw new Error('store: khóa ngoài tiền tố htdc_v1_: ' + k); return k; };
  const ls = () => { try { return window.localStorage || null; } catch (e) { return null; } };
  const wsGet = k => { guard(k); try { return ls().getItem(k); } catch (e) { return null; } };
  const wsSet = (k, v) => { guard(k); try { ls().setItem(k, v); return true; } catch (e) { return false; } };
  const wsDel = k => { guard(k); try { ls().removeItem(k); } catch (e) { /* bị chặn */ } };
  function wsKeys() {
    const out = [];
    try { const a = ls(); for (let i = 0; i < a.length; i++) { const k = a.key(i); if (typeof k === 'string' && k.startsWith(PREFIX)) out.push(k); } } catch (e) { /* bị chặn */ }
    return out;
  }

  /* ===== Tiện ích ===== */
  const now = () => Date.now();
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const cl = v => (v === undefined ? v : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
  const hasText = r => WRITING.some(k => r[k] !== undefined);
  const strip = r => { WRITING.forEach(k => { delete r[k]; }); return r; };
  const byAt = (a, b) => a.at - b.at;
  const NONE_CONSENT = () => ({ journey: true, writing: false, version: null, at: null });

  /* ===== Kiểm một bản ghi: khung chung ở đây, giá trị ở E.check.<kind> (engine, FE-2) ===== */
  function checkRec(kind, r) {
    if (!isObj(r)) return null;
    let x;
    if (kind === 'kv') {
      if (typeof r.k !== 'string' || !KV_KEYS.includes(r.k) || r.v === undefined) return null;
      x = { k: r.k, v: r.v };
    } else if (kind === 'habitDay') {
      if (r.v !== 1 || !U.isDay(r.day) || !isObj(r.marks)) return null;
      x = pick(r, FIELDS.habitDay);
    } else {
      if (!FIELDS[kind] || r.kind !== kind || r.v !== 1 || !ID_RE.test(r.id) || !Number.isFinite(r.at) ||
        !Number.isInteger(r.tz) || !U.isDay(r.day)) return null;
      x = pick(r, FIELDS[kind]);
    }
    const f = E().check && E().check[kind];
    if (typeof f !== 'function') return fallback(kind, x);
    let y = null;
    try { y = f(cl(x)); } catch (e) { y = null; }
    if (!isObj(y)) return null;
    return kind === 'kv' ? (y.k === x.k && y.v !== undefined ? { k: x.k, v: y.v } : null) : pick(y, FIELDS[kind]);
  }
  // Khi engine chưa có E.check (đang làm song song): chỉ kiểm kiểu thô, cắt chữ theo NOTE_MAX
  function fallback(kind, x) {
    if (kind === 'stop') {
      if (x.note !== undefined) { if (typeof x.note === 'string') x.note = x.note.slice(0, C.NOTE_MAX || 1000); else delete x.note; }
      if (x.texts !== undefined && !isObj(x.texts)) delete x.texts;
    }
    if (kind === 'habitDay') x.marks = pick(x.marks, HABITS.filter(h => MARKS.includes(x.marks[h])));
    try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; }
  }

  /* ===== Trạng thái ===== */
  let mode = 'unset', db = null, consent = null, problems = 0, writes = 0, bc = null, bcT = null;
  const mem = { journal: new Map(), habits: new Map(), kv: new Map() };   // kv: khóa → giá trị
  const bad = new Set();       // 'kho|khóa' hỏng: không bao giờ ghi đè
  const pending = new Map();   // 'kho|khóa' → {s, key, rec | del}: chờ ghi; failed = đã lỗi một lần
  const listeners = [];
  const emit = ev => listeners.slice().forEach(fn => { try { fn(ev); } catch (e) { /* bỏ qua */ } });
  let chain = Promise.resolve();
  const run = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };   // việc DB nối tiếp, đúng thứ tự
  const post = () => { try { if (bc) bc.postMessage({ w: 1 }); } catch (e) { /* bỏ qua */ } };

  /* ===== Đồng ý ===== */
  // canSave: bản ghi có được giữ chữ / hành trình không. none: hành trình sống trong bộ nhớ, chữ thì không (tech design 5.1)
  function canSave(what) {
    if (mode === 'unset' || !consent || !consent.journey) return false;
    return what === 'journey' || (what === 'writing' && !!consent.writing);
  }
  const normConsent = c => (isObj(c) && c.journey === true ? {
    journey: true, writing: c.writing === true,
    version: typeof c.version === 'string' ? c.version : null, at: Number.isFinite(c.at) ? c.at : null,
    writingAt: Number.isFinite(c.writingAt) ? c.writingAt : null
  } : null);

  /* ===== Ghi: một transaction gồm các bản chưa lưu trước đó + bản mới ===== */
  function save(ops) {
    if (!db || mode === 'unset') return Promise.resolve(false);
    ops.filter(o => !bad.has(o.s + '|' + o.key)).forEach(o => { const k = o.s + '|' + o.key; pending.delete(k); pending.set(k, o); });
    return run(async () => {
      const all = [...pending.values()];
      if (!all.length) return true;
      if (!db) return false;
      try {
        await db.tx([...new Set(all.map(o => o.s))], t => all.forEach(o => (o.del ? t.del(o.s, o.key) : t.put(o.s, o.rec))));
      } catch (e) {
        all.forEach(o => { o.failed = true; });
        emit(e && e.name === 'QuotaExceededError' ? { type: 'quota', unsaved: pending.size } : { type: 'unsaved', error: e && e.name, unsaved: pending.size });
        return false;
      }
      all.forEach(o => { const k = o.s + '|' + o.key; if (pending.get(k) === o) pending.delete(k); });
      if (mode === 'local') { post(); if (++writes % 50 === 0) warnSpace(); }
      return true;
    });
  }

  /* ===== Đọc hết vào bộ nhớ (tech design 5.4), phủ các bản chưa lưu ===== */
  function clean(s, arr, kindOf) {
    const out = new Map();
    let n = 0;
    const kp = I.STORES[s][0];
    for (const r of Array.isArray(arr) ? arr : []) {
      const key = isObj(r) ? r[kp] : undefined;
      const x = key != null && !bad.has(s + '|' + key) && checkRec(kindOf(r), r);
      if (x) out.set(key, x); else { n++; if (key != null) bad.add(s + '|' + key); }
    }
    return { out, n };
  }
  async function readAll() {
    const snap = [...pending.values()];
    const [j, h, k] = await Promise.all(['journal', 'habits', 'kv'].map(s => db.getAll(s)));
    const rj = clean('journal', j, r => r.kind), rh = clean('habits', h, () => 'habitDay'), rk = clean('kv', k, () => 'kv');
    mem.journal = rj.out; mem.habits = rh.out; mem.kv = new Map([...rk.out].map(([key, r]) => [key, r.v]));
    snap.forEach(o => {
      const m = mem[o.s];
      if (!m) return;
      if (o.del) m.delete(o.key); else m.set(o.key, o.s === 'kv' ? o.rec.v : o.rec);
    });
    return rj.n + rh.n + rk.n;
  }

  /* ===== Khởi động, chế độ ===== */
  const info = () => ({ mode, problems });
  function closeDb() {
    if (db) { try { db.close(); } catch (e) { /* đã đóng */ } }
    db = null; pending.clear(); clearTimeout(bcT);
    if (bc) { try { bc.close(); } catch (e) { /* bỏ qua */ } bc = null; }
  }
  // Về "Không lưu gì": bộ nhớ, giữ những gì đang có trong phiên (bỏ chữ tự viết). type → phát sự kiện lỗi
  function toNone(type) {
    closeDb();
    mode = 'none'; db = I.memory(); consent = NONE_CONSENT();
    mem.journal.forEach((r, id) => { if (hasText(r)) mem.journal.set(id, strip(Object.assign({}, r))); });
    if (type) emit({ type });
  }
  async function boot() {
    closeDb(); problems = 0; bad.clear();
    mem.journal.clear(); mem.habits.clear(); mem.kv.clear();
    const raw = wsGet(DEVICE_KEY);
    if (raw === null) { mode = 'unset'; consent = null; return info(); }
    let dev = null;
    try { dev = JSON.parse(raw); } catch (e) { /* hỏng */ }
    const cons = isObj(dev) ? normConsent(dev.consent) : null;
    let devBad = false;
    if (!isObj(dev) || !Number.isInteger(dev.schema) || dev.schema < 1 || !cons) {
      // Khóa đánh dấu hỏng: KHÔNG ghi đè (exportRaw còn lấy được). Có DB thì vẫn mở, chữ tự viết coi như tắt
      problems++; emit({ type: 'corrupt', what: 'device' });
      if ((await I.exists(DB_NAME)) === false) { mode = 'unset'; consent = null; return info(); }
      devBad = true;
    } else if (dev.schema > SCHEMA()) { toNone('versionTooNew'); return info(); }
    consent = cons || { journey: true, writing: false, version: null, at: null, writingAt: null };
    await openLocal(dev, devBad);
    return info();
  }
  async function openLocal(dev, devBad) {
    try { db = await I.open(DB_NAME, SCHEMA(), MIGRATIONS); } catch (e) { db = null; toNone(e && e.name === 'VersionError' ? 'versionTooNew' : 'blocked'); return false; }
    mode = 'local';
    // Tab khác xóa toàn bộ / nâng schema: DB đã đóng → mọi lần ghi sau trả false; app báo "tải lại trang"
    db.onVersionChange(() => { db = null; emit({ type: 'otherTab', reload: true }); });
    const old = db.upgradedFrom;
    if (old) {
      // Vừa nâng version: chép khóa đánh dấu sang htdc_v1_backup_v{cũ} trước khi đổi schema
      if (!devBad && wsSet(BACKUP + old, JSON.stringify(dev))) wsSet(DEVICE_KEY, JSON.stringify(Object.assign({}, dev, { schema: SCHEMA() })));
    } else {
      // Lần mở thành công kế tiếp: xóa bản chụp cũ
      db.keys('backups').then(k => k.length && db.del('backups', k)).catch(() => {});
      wsKeys().filter(k => k.startsWith(BACKUP)).forEach(wsDel);
    }
    let n = 0;
    try { n = await readAll(); } catch (e) { n = 1; }
    if (n) { problems += n; emit({ type: 'corrupt', n }); }
    listenTabs();
    warnSpace();
    return true;
  }
  function startNone() {
    toNone();
    emit({ type: 'change', store: 'mode', mode });
  }
  // M02 "Đồng ý và tiếp tục": ghi htdc_v1_device, mở DB, xin persist. Lỗi → 'blocked', chạy none, trả false.
  // journey tắt → như "Không lưu gì": không ghi gì, trả false, không phát 'blocked' (K-8; app.js báo "Mình sẽ không lưu gì nhé.")
  // carry: mang bản ghi của phiên "Không lưu gì" vào máy (mặc định không). Vai, giai đoạn đang chọn luôn mang theo.
  async function startLocal(c, o) {
    const cc = isObj(c) ? c : {};
    if (cc.journey === false) { startNone(); return false; }
    const prevRaw = wsGet(DEVICE_KEY);
    if (prevRaw !== null) {
      let p = null;
      try { p = JSON.parse(prevRaw); } catch (e) { /* hỏng: ghi đè bằng đồng ý mới */ }
      if (isObj(p) && Number.isInteger(p.schema) && p.schema > SCHEMA()) { toNone('versionTooNew'); return false; }
    }
    // Không có khóa mà DB cũ còn (lần xóa trước chưa xong): xóa trước, dữ liệu cũ không hiện lại (n-3)
    if (prevRaw === null && (await I.exists(DB_NAME)) === true && !(await I.drop(DB_NAME))) { toNone('blocked'); return false; }
    const carry = !!(o && o.carry);
    const keep = { kv: new Map(mem.kv), journal: carry ? [...mem.journal.values()] : [], habits: carry ? [...mem.habits.values()] : [] };
    const t = now();
    const cons = { journey: true, writing: cc.writing === true, version: String(C.PRIVACY_VERSION || ''), at: t, writingAt: t };
    const dev = { schema: SCHEMA(), consent: cons };
    closeDb();
    if (!wsSet(DEVICE_KEY, JSON.stringify(dev))) { toNone('blocked'); return false; }
    consent = cons; problems = 0; bad.clear();
    if (!(await openLocal(dev, false))) {
      if (prevRaw !== null) wsSet(DEVICE_KEY, prevRaw); else wsDel(DEVICE_KEY);
      return false;
    }
    const ops = [];
    keep.kv.forEach((v, k) => { const x = checkRec('kv', { k, v }); if (x && !bad.has('kv|' + k)) { mem.kv.set(k, x.v); ops.push({ s: 'kv', key: k, rec: x }); } });
    keep.journal.forEach(r => {
      const x = checkRec(r.kind, cons.writing ? r : strip(Object.assign({}, r)));
      if (x && !bad.has('journal|' + x.id)) { mem.journal.set(x.id, x); ops.push({ s: 'journal', key: x.id, rec: x }); }
    });
    keep.habits.forEach(r => { const x = checkRec('habitDay', r); if (x && !bad.has('habits|' + x.day)) { mem.habits.set(x.day, x); ops.push({ s: 'habits', key: x.day, rec: x }); } });
    if (ops.length) await save(ops);
    I.persist();
    emit({ type: 'change', store: 'mode', mode });
    return true;
  }
  // Tắt / bật "Lưu cả chữ tự viết". purge → xóa note/texts khỏi mọi bản ghi (K-8; cũng dùng cho "Xóa mọi chữ đã viết")
  async function setWriting(on, o) {
    if (mode !== 'local' || !consent) return false;
    const prev = consent;
    consent = Object.assign({}, consent, { writing: !!on, writingAt: now() });
    if (!wsSet(DEVICE_KEY, JSON.stringify({ schema: SCHEMA(), consent }))) { consent = prev; emit({ type: 'blocked' }); return false; }
    emit({ type: 'change', store: 'consent' });
    if (o && o.purge) {
      const ops = [];
      mem.journal.forEach((r, id) => { if (hasText(r)) { const x = strip(Object.assign({}, r)); mem.journal.set(id, x); ops.push({ s: 'journal', key: id, rec: x }); } });
      if (ops.length) { emit({ type: 'change', store: 'journal', op: 'purge' }); return save(ops).then(() => true); }
    }
    return true;
  }

  /* ===== Nhiều tab: tab kia ghi xong thì báo; tab này đọc lại kho ===== */
  function listenTabs() {
    if (bc || typeof BroadcastChannel !== 'function') return;
    try { bc = new BroadcastChannel(DB_NAME); } catch (e) { return; }
    bc.onmessage = () => {
      clearTimeout(bcT);
      bcT = setTimeout(async () => {
        if (!db || mode !== 'local') return;
        let c2 = null;
        try { c2 = normConsent((JSON.parse(wsGet(DEVICE_KEY)) || {}).consent); } catch (e) { /* giữ đồng ý cũ */ }
        if (c2) consent = c2;
        try { await readAll(); } catch (e) { return; }
        emit({ type: 'otherTab' });
        emit({ type: 'change', store: 'all' });
      }, 200);
    };
  }
  // navigator.storage ≥ 80 % → nhắc xuất (tech design 5.4)
  async function warnSpace() {
    if (mode !== 'local' || !db) return;
    const e = await db.estimate().catch(() => null);
    if (e && e.quota && e.usage / e.quota >= 0.8) emit({ type: 'quota', warn: true, ratio: e.usage / e.quota });
  }

  /* ===== prefs (kho kv). Khóa ngoài KV_KEYS hoặc chưa đồng ý → chỉ bộ nhớ ===== */
  const prefs = {
    get: k => cl(mem.kv.get(k)),
    set(k, v) {
      if (typeof k !== 'string') return false;
      const known = KV_KEYS.includes(k);
      if (v === undefined || v === null) {
        mem.kv.delete(k);
        emit({ type: 'change', store: 'kv', k });
        if (known && canSave('journey')) save([{ s: 'kv', key: k, del: true }]);
        return true;
      }
      const x = known ? checkRec('kv', { k, v }) : null;
      if (known && !x) return false;
      mem.kv.set(k, x ? x.v : cl(v));
      emit({ type: 'change', store: 'kv', k });
      if (x && canSave('journey')) save([{ s: 'kv', key: k, rec: x }]);
      return true;
    }
  };

  /* ===== journal: mọi mốc của dòng thời gian (Dừng lại, bài đêm, Hai ta, đổi giai đoạn) ===== */
  const list = ({ kind, limit } = {}) => {
    const out = [...mem.journal.values()].filter(r => !kind || r.kind === kind).sort((a, b) => b.at - a.at);
    return (limit ? out.slice(0, limit) : out).map(cl);
  };
  const journal = {
    // at, tz, day tính MỘT lần lúc ghi theo giờ máy; id hợp lệ, chưa dùng thì giữ (luồng cần biết trước id)
    add(rec) {
      if (!isObj(rec) || !KINDS.includes(rec.kind) || !canSave('journey')) return null;
      const at = Number.isFinite(rec.at) ? rec.at : now(), tz = Number.isInteger(rec.tz) ? rec.tz : U.tzAt(at);
      const free = typeof rec.id === 'string' && ID_RE.test(rec.id) && !mem.journal.has(rec.id) && !bad.has('journal|' + rec.id);
      const r = Object.assign({}, cl(rec), { v: 1, id: free ? rec.id : U.randomId(), at, tz, day: U.dayOf(at, tz) });
      if (!canSave('writing')) strip(r);
      const x = checkRec(r.kind, r);
      if (!x) return null;
      mem.journal.set(x.id, x);
      emit({ type: 'change', store: 'journal', op: 'add', id: x.id });
      save([{ s: 'journal', key: x.id, rec: x }]);
      return cl(x);
    },
    // patch gộp nông; trường = undefined → bỏ trường. Không đổi kind, id, at, tz, day. Chữ mới chỉ nhận khi canSave('writing')
    update(id, patch) {
      const old = mem.journal.get(id);
      if (!old || !isObj(patch) || !canSave('journey')) return null;
      const r = Object.assign({}, old, cl(patch));
      Object.keys(patch).forEach(k => { if (patch[k] === undefined) delete r[k]; });
      if (!canSave('writing')) WRITING.forEach(k => { if (patch[k] !== undefined) { if (old[k] !== undefined) r[k] = old[k]; else delete r[k]; } });
      Object.assign(r, { v: 1, kind: old.kind, id: old.id, at: old.at, tz: old.tz, day: old.day });
      const x = checkRec(r.kind, r);
      if (!x) return null;
      mem.journal.set(id, x);
      emit({ type: 'change', store: 'journal', op: 'update', id });
      save([{ s: 'journal', key: id, rec: x }]);
      return cl(x);
    },
    list,
    remove(id) {
      if (!mem.journal.has(id)) return Promise.resolve(false);
      mem.journal.delete(id);
      emit({ type: 'change', store: 'journal', op: 'remove', id });
      return save([{ s: 'journal', key: id, del: true }]).then(() => true);
    }
  };

  /* ===== habits: một bản ghi mỗi ngày (A2). '' bỏ · 'x' tự tick · 'a' app đánh dấu ===== */
  const habits = {
    get: day => cl(mem.habits.get(day) || null),
    set(day, code, val) {
      if (!U.isDay(day) || !HABITS.includes(code) || !MARKS.includes(val) || !canSave('journey') || bad.has('habits|' + day)) return null;
      const old = mem.habits.get(day);
      const x = checkRec('habitDay', { v: 1, day, marks: Object.assign({}, old && old.marks, { [code]: val }), at: now() });
      if (!x) return null;
      mem.habits.set(day, x);
      emit({ type: 'change', store: 'habits', day });
      save([{ s: 'habits', key: day, rec: x }]);
      return cl(x);
    },
    range: (from, to) => [...mem.habits.values()].filter(r => r.day >= from && r.day <= to).sort((a, b) => (a.day < b.day ? -1 : 1)).map(cl),
    removeDay(day) {
      if (!mem.habits.has(day)) return Promise.resolve(false);
      mem.habits.delete(day);
      emit({ type: 'change', store: 'habits', day });
      return save([{ s: 'habits', key: day, del: true }]).then(() => true);
    }
  };

  /* ===== Xuất (PRD 8.7, AC-18) ===== */
  const allHabits = () => [...mem.habits.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  const consentOut = () => (consent ? { journey: consent.journey, writing: consent.writing, version: consent.version, at: consent.at, writingAt: consent.writingAt } : null);
  function exportJson() {
    const kv = k => (mem.kv.has(k) ? cl(mem.kv.get(k)) : null);
    return JSON.stringify({ app: 'hanh-trinh-don-con', schema: SCHEMA(), exportedAt: now(), consent: consentOut(),
      prefs: { role: kv('role'), stage: kv('stage'), habits: kv('habits') },
      journal: [...mem.journal.values()].sort(byAt), habits: allHabits() }, null, 1);
  }
  // Nhãn: E.label (engine) nếu có; không thì tìm trong danh mục data.js ({code|id, label|title}); không thấy → mã
  function lab(kind, src, code) {
    if (code == null || code === '') return '';
    if (typeof E().label === 'function') { try { return String(E().label(kind, code)); } catch (e) { /* dùng danh mục */ } }
    const x = Array.isArray(src) ? src.find(o => isObj(o) && (o.code === code || o.id === code)) : isObj(src) ? src[code] : null;
    return isObj(x) ? String(x.label || x.title || code) : String(code);
  }
  const pad = n => String(n).padStart(2, '0');
  const hhmm = (at, tz) => { const d = new Date(at + tz * 60000); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
  const MARK = { x: 'Có', a: 'Tự đánh dấu' };
  const csv = rows => '﻿' + rows.map(r => r.map(U.csvCell).join(',')).join('\r\n') + '\r\n';
  function exportCsv(what) {
    const d = D();
    if (what === 'habits') {
      return csv([['Ngày'].concat(HABITS.map(h => lab('habit', d.HABITS, h)))].concat(allHabits().map(r =>
        [U.fmtDay(r.day)].concat(HABITS.map(h => MARK[r.marks[h]] || '—')))));
    }
    const ex = id => lab('exercise', d.EXERCISES, id);
    const rows = [...mem.journal.values()].filter(r => r.kind === 'stop').sort(byAt).map(r => [
      U.fmtDay(r.day), hhmm(r.at, r.tz), lab('stage', d.STAGES, r.stage), r.before == null ? '' : r.before,
      (r.emotions || []).map(e => lab('emotion', d.EMOTIONS, e)).join(', '), (r.contexts || []).map(c => lab('context', d.CONTEXTS, c)).join(', '),
      (r.done || []).map(x => ex(x && x.ex)).join(', '), r.after == null ? '' : r.after, lab('fit', d.FITS, r.fit)]);
    return csv([['Ngày (dd/mm/yyyy)', 'Giờ (HH:MM)', 'Giai đoạn', 'Mức trước', 'Thẻ cảm xúc', 'Tình huống', 'Bài', 'Mức sau', 'Phù hợp']].concat(rows));
  }
  // Bản sao nguyên văn: khóa đánh dấu dạng chuỗi gốc + mọi kho (kể cả bản hỏng) + bản chưa lưu
  async function exportRaw() {
    const out = { app: 'hanh-trinh-don-con', raw: true, schema: SCHEMA(), exportedAt: now(), device: wsGet(DEVICE_KEY), stores: {},
      unsaved: [...pending.values()].map(o => ({ s: o.s, key: o.key, rec: o.rec, del: !!o.del })) };
    if (db) for (const s of I.NAMES) out.stores[s] = await db.getAll(s).catch(e => ({ error: e && e.name }));
    return JSON.stringify(out);
  }

  /* ===== Xóa toàn bộ: chỉ htdc_v1_db + các khóa htdc_v1_* (AC-20). Không clear(). Sau đó: 'unset' (về M01) ===== */
  // false = chưa xóa được DB (tab khác chặn / quá 5 s): giữ khóa đánh dấu + bộ nhớ, mở lại DB ở nền (n-3)
  async function clearAll() {
    await chain;
    const had = mode === 'local' || wsGet(DEVICE_KEY) !== null;   // "Không lưu gì" thuần: không chạm IndexedDB (AC-11)
    const wasLocal = mode === 'local';
    closeDb();
    const dropped = had ? await I.drop(DB_NAME) : true;
    if (!dropped) {
      let dev = null;
      try { dev = JSON.parse(wsGet(DEVICE_KEY)); } catch (e) { /* hỏng */ }
      if (wasLocal && isObj(dev)) {
        // Lệnh xóa còn treo thì lần mở chờ nó; xóa xong → DB trống, bộ nhớ trống
        openLocal(dev, false).then(ok => { if (ok) emit({ type: 'change', store: 'all' }); }, () => {});
      }
      return false;
    }
    wsKeys().forEach(wsDel);
    mem.journal.clear(); mem.habits.clear(); mem.kv.clear(); bad.clear();
    mode = 'unset'; consent = null; problems = 0;
    emit({ type: 'change', store: 'all', what: 'clear' });
    return dropped;
  }

  return {
    boot, startNone, startLocal, mode: () => mode,
    consent: () => (mode === 'unset' || !consent ? null : cl(consent)),
    setWriting, canSave, prefs, journal, habits,
    exportJson, exportCsv, exportRaw, clearAll,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    MIGRATIONS
  };
})();
