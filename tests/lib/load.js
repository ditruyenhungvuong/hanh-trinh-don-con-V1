/* =========================================================
   Nạp file JS thuần của app vào vm với `window` giả – Hành Trình Đón Con (Chủ: qa-tester; T-00 chép 10/11/2026).
   Nguồn: apps/sung-suc/tests/lib/load.js @ 10/11/2026 (gốc apps/lifestyle-thai-phu, ADR 0008). Chỗ khác bản gốc ghi "HTDC: …".
   - Không DOM. `window` chính là global của context (file IIFE gán window.HTDC_* hay biến toàn cục đều thấy).
   - Đồng hồ giả: Date.now() và new Date() không tham số trả giờ giả; đếm số lần gọi để kiểm hàm thuần
     KHÔNG tự lấy giờ (engine, charts nhận now/tz qua tham số; tech design 6.1: engine phải 0 lần).
   - Web Storage giả (localStorage, sessionStorage): Object.keys(storage) ra danh sách khóa như trình duyệt,
     ghi lại số lần clear(); tùy chọn chặn ghi (giả lập trình duyệt chặn lưu / đầy bộ nhớ).
   Dùng: const app = loadApp(['js/config.js','js/util.js'], { now: Date.UTC(2026,9,29,1) });
         app.win.HTDC_UTIL … · app.clock.set(ms) · app.clock.calls · app.local / app.session
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.resolve(__dirname, '..', '..');
// HTDC: chuỗi file thuần theo tech design 14.1 (keywords, scripts, engine, pacer không DOM)
const PURE_CHAIN = ['js/config.js', 'js/util.js', 'js/data.js', 'js/keywords.js', 'js/scripts.js', 'js/engine.js', 'js/pacer.js'];
// HTDC: unit-store nạp thêm idb.js + store.js rồi dùng app.win.HTDC_IDB.memory() (không IndexedDB thật trong Node)
const STORE_CHAIN = PURE_CHAIN.concat(['js/idb.js', 'js/store.js']);

class FakeStorage {
  constructor(opts) {
    Object.defineProperty(this, '_o', { value: Object.assign({ blockSet: false, blockGet: false }, opts), enumerable: false });
    Object.defineProperty(this, 'clearCalls', { value: 0, writable: true, enumerable: false });
    Object.defineProperty(this, 'log', { value: [], enumerable: false });
  }
  get length() { return Object.keys(this).length; }
  key(i) { return Object.keys(this)[i] ?? null; }
  getItem(k) { if (this._o.blockGet) throw new Error('SecurityError: storage bị chặn'); this.log.push(['get', String(k)]); return Object.prototype.hasOwnProperty.call(this, String(k)) ? this[String(k)] : null; }
  setItem(k, v) { if (this._o.blockSet) throw new Error('QuotaExceededError'); this.log.push(['set', String(k)]); this[String(k)] = String(v); }
  removeItem(k) { this.log.push(['del', String(k)]); delete this[String(k)]; }
  clear() { this.clearCalls++; Object.keys(this).forEach(k => delete this[k]); }
  dump() { const o = {}; Object.keys(this).forEach(k => { o[k] = this[k]; }); return o; }
}

function makeClock(start) {
  const c = { now: start == null ? Date.UTC(2026, 9, 29, 1, 0, 0) : start, calls: 0 };
  c.set = ms => { c.now = ms; };
  c.add = ms => { c.now += ms; };
  c.reset = () => { c.calls = 0; };
  return c;
}

function loadApp(files, opts) {
  const o = opts || {};
  const clock = makeClock(o.now);
  const local = o.local || new FakeStorage(o.localOpts);
  const session = o.session || new FakeStorage(o.sessionOpts);
  const ctx = {
    console, crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, Intl, setTimeout, clearTimeout,
    setInterval, clearInterval, queueMicrotask, structuredClone
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  if (!o.noStorage) { ctx.localStorage = local; ctx.sessionStorage = session; }
  vm.createContext(ctx);
  /* Đồng hồ giả trong context (Date riêng của context để instanceof vẫn đúng) */
  vm.runInContext(`(() => {
    const RealDate = Date;
    const clock = globalThis.__qaClock;
    class FakeDate extends RealDate {
      constructor(...a) { if (a.length === 0) { clock.calls++; super(clock.now); } else super(...a); }
      static now() { clock.calls++; return clock.now; }
    }
    FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
    globalThis.Date = FakeDate;
  })();`, Object.assign(ctx, { __qaClock: clock }));
  if (o.config) {
    /* Ghi đè vài khóa config sau khi nạp config.js (vd FEATURES) — áp dụng ngay sau file config */
  }
  const loaded = [];
  for (const f of files) {
    const file = path.isAbsolute(f) ? f : path.join(APP, f);
    const code = fs.readFileSync(file, 'utf8');
    vm.runInContext(code, ctx, { filename: f });
    loaded.push(f);
    if (/config\.js$/.test(f) && o.config && ctx.HTDC_CONFIG) deepAssign(ctx.HTDC_CONFIG, o.config);
  }
  clock.reset();
  return { win: ctx, clock, local, session, loaded };
}

function deepAssign(t, s) {
  for (const k of Object.keys(s)) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object') deepAssign(t[k], s[k]);
    else t[k] = s[k];
  }
}

/* Đọc nhanh: file có còn là stub T-00 không (để in CHỜ đúng lý do) */
function isStub(rel) {
  try { return /STUB của T-00/.test(fs.readFileSync(path.join(APP, rel), 'utf8')); } catch (e) { return true; }
}

module.exports = { loadApp, FakeStorage, makeClock, isStub, APP, PURE_CHAIN, STORE_CHAIN };
