/* =========================================================
   Hành Trình Đón Con – js/idb.js · window.HTDC_IDB · Chủ: FE-3 Lưu trữ & Dữ liệu của mình
   Nguồn: apps/sung-suc/js/idb.js @ 10/11/2026 (ADR 0008). Khác bản gốc: tên global, bốn kho của htdc_v1_db,
   khóa bản chụp htdc_v1_backup_v{n}. Đặc tả: tech design 5.4, ADR 0010. File DUY NHẤT gọi indexedDB.open.
   Cùng interface: open(name, ver, mig) IndexedDB thật (nâng version → chụp mọi kho vào backups rồi chạy mig[v]) ·
   memory() Map trong bộ nhớ ("Không lưu gì", failNext giả lỗi ghi) · fake(true) sổ giả cho unit test Node.
   db: get · getAll(s, {index, only | lo, hi}) · keys · put · del · delWhere · tx · estimate · persist · close.
   Lỗi: Error.name 'QuotaExceededError' | 'VersionError' | 'InvalidStateError' | 'UnknownError'.
   ========================================================= */
window.HTDC_IDB = (() => {
  'use strict';
  /* ===== Kho của htdc_v1_db v1 (tech design 5.4): [keyPath, {index: keyPath}] ===== */
  const STORES = {
    journal: ['id', { at: 'at', kind: 'kind' }],   // StopRec, NightRec, TogetherRec, StageRec
    habits: ['day', {}],                            // HabitDay (A2; tạo sẵn từ v1)
    kv: ['k', {}],                                  // vai, giai đoạn, thói quen bật, thẻ đã đóng, âm lượng
    backups: ['k', {}]                              // bản chụp mọi kho trước khi nâng version
  };
  const NAMES = Object.keys(STORES);
  const BACKUP = 'htdc_v1_backup_v';
  const KNOWN = ['QuotaExceededError', 'VersionError', 'InvalidStateError'];
  function err(e) { const n = e && KNOWN.includes(e.name) ? e.name : 'UnknownError'; const x = new Error(n); x.name = n; return x; }
  const P = fn => new Promise((res, rej) => { try { res(fn()); } catch (e) { rej(err(e)); } });
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(err(r.error)); });
  const many = v => (Array.isArray(v) ? v : [v]);

  /* ===== Nâng version: chép mọi kho vào backups['htdc_v1_backup_v{cũ}'] rồi chạy từng bước chuyển ===== */
  async function upgrade(m, old, ver, mig) {
    if (old < 1) return;
    const snap = { k: BACKUP + old, from: old, at: Date.now(), stores: {} };
    for (const s of NAMES) if (s !== 'backups') snap.stores[s] = await m.getAll(s);
    await m.put('backups', snap);
    for (let v = old + 1; v <= ver; v++) if (typeof mig[v] === 'function') await mig[v](m);
  }

  /* ===== Bộ nhớ (chế độ "Không lưu gì", unit test) ===== */
  const cl = v => (v === undefined ? v : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  const valid = v => (Array.isArray(v) ? v.length > 0 && v.every(valid) : typeof v === 'string' || (typeof v === 'number' && v === v));
  const typ = v => (Array.isArray(v) ? 3 : typeof v === 'string' ? 2 : 1);
  function cmp(a, b) {
    const ta = typ(a), tb = typ(b);
    if (ta !== tb) return ta - tb;
    if (ta === 3) { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmp(a[i], b[i]); if (c) return c; } return a.length - b.length; }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const pick = (r, kp) => (Array.isArray(kp) ? kp.map(f => r[f]) : r[kp]);
  const inQ = (v, q) => (q.only !== undefined ? cmp(v, q.only) === 0 : (q.lo === undefined || cmp(v, q.lo) >= 0) && (q.hi === undefined || cmp(v, q.hi) <= 0));
  const mkData = () => Object.fromEntries(NAMES.map(n => [n, new Map()]));

  function memory(data) {
    const st = data || mkData();
    let fail = null, closed = false;
    const live = () => { if (closed) throw err({ name: 'InvalidStateError' }); };
    function sel(s, q) {
      live();
      const out = [];
      for (const r of st[s].values()) {
        if (q && q.index) { const v = pick(r, STORES[s][1][q.index]); if (!valid(v) || !inQ(v, q)) continue; }
        out.push(r);
      }
      return out;
    }
    // Ghi cả lô: kiểm khóa trước, lỗi thì không ghi gì (như một transaction)
    const W = ops => P(() => {
      live();
      if (fail) { const n = fail; fail = null; throw err({ name: n }); }
      const kp = s => STORES[s][0];
      ops.forEach(o => { if (!st[o[1]] || (o[0] === 'put' && !valid(o[2] && o[2][kp(o[1])]))) throw err({ name: 'DataError' }); });
      ops.forEach(([op, s, a, b]) => {
        if (op === 'put') st[s].set(a[kp(s)], cl(a));
        else if (op === 'del') st[s].delete(a);
        else for (const [k, r] of st[s]) { const v = pick(r, STORES[s][1][a]); if (valid(v) && cmp(v, b) === 0) st[s].delete(k); }
      });
      return true;
    });
    const t = ops => ({
      put: (s, r) => many(r).forEach(x => ops.push(['put', s, x])),
      del: (s, k) => many(k).forEach(x => ops.push(['del', s, x])),
      delWhere: (s, ix, v) => ops.push(['dw', s, ix, v])
    });
    return {
      kind: 'memory', upgradedFrom: 0,
      get: (s, k) => P(() => { live(); return cl(st[s].get(k)); }),
      getAll: (s, q) => P(() => sel(s, q).map(cl)),
      keys: s => P(() => { live(); return [...st[s].keys()]; }),
      put: (s, r) => { const o = []; t(o).put(s, r); return W(o); },
      del: (s, k) => { const o = []; t(o).del(s, k); return W(o); },
      delWhere: (s, ix, v) => W([['dw', s, ix, v]]),
      tx: (stores, fn) => { const o = []; try { fn(t(o)); } catch (e) { return Promise.reject(err(e)); } return W(o); },
      estimate: () => Promise.resolve(null), persist: () => Promise.resolve(false),
      close: () => { closed = true; }, onVersionChange: () => {},
      failNext: n => { fail = n || 'QuotaExceededError'; }
    };
  }

  /* ===== Sổ giả cho unit test (open/drop/exists không có IndexedDB thật) ===== */
  let FAKE = {}, fakeOn = false;
  async function openFake(name, ver, mig) {
    let e = FAKE[name];
    if (e && e.ver > ver) throw err({ name: 'VersionError' });
    if (!e) e = FAKE[name] = { ver: 0, data: mkData() };
    const old = e.ver;
    if (old < ver) {
      const snap = Object.fromEntries(NAMES.map(n => [n, new Map([...e.data[n]].map(([k, v]) => [k, cl(v)]))]));
      try { await upgrade(memory(e.data), old, ver, mig); } catch (x) { NAMES.forEach(n => { e.data[n] = snap[n]; }); throw err(x); }
      e.ver = ver;
    }
    const db = memory(e.data);
    db.kind = 'fake'; db.upgradedFrom = old < ver ? old : 0;
    return db;
  }

  /* ===== IndexedDB thật ===== */
  function wrap(d, old) {
    let onVC = null;
    d.onversionchange = () => { try { d.close(); } catch (e) { /* đã đóng */ } if (onVC) onVC(); };
    const range = q => (q.only !== undefined ? IDBKeyRange.only(q.only)
      : q.lo !== undefined && q.hi !== undefined ? IDBKeyRange.bound(q.lo, q.hi)
        : q.lo !== undefined ? IDBKeyRange.lowerBound(q.lo) : q.hi !== undefined ? IDBKeyRange.upperBound(q.hi) : undefined);
    const read = (s, f) => P(() => rq(f(d.transaction(s, 'readonly').objectStore(s))));
    function tx(stores, fn) {
      return new Promise((res, rej) => {
        let x;
        try { x = d.transaction(stores, 'readwrite'); } catch (e) { return rej(err(e)); }
        x.oncomplete = () => res(true);
        x.onabort = () => rej(err(x.error));
        const os = s => x.objectStore(s);
        const api = {
          put: (s, r) => many(r).forEach(v => os(s).put(v)),
          del: (s, k) => many(k).forEach(v => os(s).delete(v)),
          delWhere: (s, ix, v) => {
            const c = os(s).index(ix).openKeyCursor(IDBKeyRange.only(v));
            c.onsuccess = () => { const k = c.result; if (k) { os(s).delete(k.primaryKey); k.continue(); } };
          }
        };
        try { fn(api); } catch (e) { try { x.abort(); } catch (y) { /* đã hủy */ } rej(err(e)); }
      });
    }
    return {
      kind: 'idb', upgradedFrom: old,
      get: (s, k) => read(s, o => o.get(k)),
      getAll: (s, q) => read(s, o => (q && q.index ? o.index(q.index).getAll(range(q)) : o.getAll())),
      keys: s => read(s, o => o.getAllKeys()),
      put: (s, r) => tx([s], t => t.put(s, r)),
      del: (s, k) => tx([s], t => t.del(s, k)),
      delWhere: (s, ix, v) => tx([s], t => t.delWhere(s, ix, v)),
      tx, estimate, persist, onVersionChange: f => { onVC = f; }, failNext: () => {},
      close: () => { try { d.close(); } catch (e) { /* đã đóng */ } }
    };
  }
  function open(name, ver, mig) {
    if (fakeOn) return openFake(name, ver, mig || {});
    return new Promise((res, rej) => {
      let req, old = 0;
      try { req = indexedDB.open(name, ver); } catch (e) { return rej(err(e)); }
      req.onupgradeneeded = ev => {
        old = ev.oldVersion || 0;
        const d = req.result, x = req.transaction;
        for (const s of NAMES) {
          const os = d.objectStoreNames.contains(s) ? x.objectStore(s) : d.createObjectStore(s, { keyPath: STORES[s][0] });
          const ix = STORES[s][1];
          for (const i in ix) if (!os.indexNames.contains(i)) os.createIndex(i, ix[i]);
        }
        const m = { getAll: s => rq(x.objectStore(s).getAll()), put: (s, r) => rq(x.objectStore(s).put(r)), del: (s, k) => rq(x.objectStore(s).delete(k)) };
        upgrade(m, old, ver, mig || {}).catch(() => { try { x.abort(); } catch (e) { /* đã hủy */ } });
      };
      req.onsuccess = () => res(wrap(req.result, old));
      req.onerror = () => rej(err(req.error));
      req.onblocked = () => { /* tab khác còn mở bản cũ: chờ tab đó đóng (onversionchange) */ };
    });
  }
  // navigator.storage: ước tính dung lượng, xin giữ lâu dài (không chặn nếu bị từ chối)
  function estimate() {
    try { const s = navigator.storage; if (s && s.estimate) return s.estimate().then(e => ({ usage: e.usage || 0, quota: e.quota || 0 }), () => null); } catch (e) { /* không có */ }
    return Promise.resolve(null);
  }
  function persist() {
    try { const s = navigator.storage; if (s && s.persist) return s.persist().catch(() => false); } catch (e) { /* không có */ }
    return Promise.resolve(false);
  }
  // Xóa hẳn một DB (Xóa toàn bộ). Tab khác chặn quá 5 giây thì thôi chờ.
  function drop(name) {
    if (fakeOn) { delete FAKE[name]; return Promise.resolve(true); }
    return new Promise(res => {
      let r;
      try { r = indexedDB.deleteDatabase(name); } catch (e) { return res(false); }
      r.onsuccess = () => res(true);
      r.onerror = () => res(false);
      setTimeout(() => res(false), 5000);
    });
  }
  // DB đã có chưa: true | false | null (trình duyệt không cho biết)
  function exists(name) {
    if (fakeOn) return Promise.resolve(!!FAKE[name]);
    try { if (indexedDB.databases) return indexedDB.databases().then(l => l.some(d => d.name === name), () => null); } catch (e) { /* bị chặn */ }
    return Promise.resolve(null);
  }

  return {
    STORES, NAMES, open, memory, drop, exists, persist,
    fake: (on, reg) => { fakeOn = on !== false; if (reg) FAKE = reg; return FAKE; },   // reg: sổ dùng chung giữa các lần nạp (test)
    fakeData: name => FAKE[name] || null
  };
})();
