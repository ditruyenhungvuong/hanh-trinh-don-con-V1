/* =========================================================
   Bộ ghi kết quả dùng chung cho test Node – Hành Trình Đón Con (Chủ: qa-tester; T-00 chép 10/11/2026).
   Nguồn: apps/sung-suc/tests/lib/harness.js @ 10/11/2026 (gốc apps/lifestyle-thai-phu, ADR 0008). Chỗ khác bản gốc ghi "HTDC: …".
   Ba trạng thái, không lẫn vào nhau:
   - PASS / FAIL: ca đã chạy được, so với giá trị cụ thể (không có ca "luôn xanh").
   - CHỜ: phần app chưa có (hàm/màn chưa viết). KHÔNG tính xanh, KHÔNG tính đỏ.
     Chỉ được đánh CHỜ khi hàm/module thật sự vắng mặt; hàm đã có thì mọi ca phải chạy.
   - GIỚI HẠN ĐÃ BIẾT: câu trong bộ câu có dấu * (hành vi đã ghi ở báo cáo), in riêng, không cộng vào số xanh.
     Hành vi đổi khác ghi nhận → FAIL để người đổi bộ luật cập nhật báo cáo.
   Thoát: có FAIL → process.exitCode = 1. Lỗi khung test (ném ngoài ca) → exitCode = 2.
   Chạy nhiều múi giờ: runInTimezones(__filename, TZS) chạy lại chính file với biến TZ khác nhau,
   so kết quả từng ca giữa các múi giờ (lệch → FAIL), cộng số.
   ========================================================= */
'use strict';
const { spawnSync } = require('child_process');

const TZS = ['Asia/Ho_Chi_Minh', 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC'];
const MARK = '@@HTDC_RESULTS ';  // HTDC: đổi tiền tố SS → HTDC

function fmt(v) {
  try {
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return JSON.stringify(v);
    return JSON.stringify(v, (k, x) => (x instanceof Set ? [...x] : x instanceof RegExp ? String(x) : x));
  } catch (e) { return String(v); }
}
function deepEq(a, b) { return fmt(a) === fmt(b); }

function createHarness(title) {
  const results = [];     // { name, status: 'PASS'|'FAIL'|'CHỜ'|'GIỚI HẠN', detail }
  const quiet = !!process.env.HTDC_QUIET;
  let group = '';
  const log = s => { if (!quiet) console.log(s); };
  const rec = (status, name, detail) => {
    const full = (group ? group + ' · ' : '') + name;
    results.push({ name: full, status, detail: detail === undefined ? '' : String(detail).slice(0, 400) });
    const tag = status === 'PASS' ? 'PASS ' : status === 'FAIL' ? 'FAIL ' : status === 'CHỜ' ? 'CHỜ  ' : 'GHB  ';
    log(tag + full + (status !== 'PASS' && detail !== undefined && detail !== '' ? '  → ' + String(detail).slice(0, 300) : ''));
  };
  const H = {
    title,
    results,
    section(t) { group = t; log('\n— ' + t + ' —'); },
    ok(name, cond, detail) { rec(cond ? 'PASS' : 'FAIL', name, cond ? '' : detail); return !!cond; },
    eq(name, actual, expected) {
      const ok = deepEq(actual, expected);
      rec(ok ? 'PASS' : 'FAIL', name, ok ? '' : 'nhận ' + fmt(actual) + ' · cần ' + fmt(expected));
      return ok;
    },
    wait(name, reason) { rec('CHỜ', name, reason || 'chưa có'); },
    limit(name, detail) { rec('GIỚI HẠN', name, detail); },
    /* Chạy một ca, bắt lỗi ném ra → FAIL (không để một ca sập cả file) */
    run(name, fn) {
      try { return fn(); } catch (e) { rec('FAIL', name, 'ném lỗi: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); return undefined; }
    },
    /* Có đủ hàm chưa? Trả true/false; KHÔNG tự ghi gì (người gọi ghi CHỜ cho từng ca để số ca không đổi khi dev xong) */
    /* Tên có thể là 'evaluate' (hàm), 'kick' (nhánh API là object) hoặc đường dẫn 'kick.save' */
    has(obj, ...fns) {
      return !!obj && fns.every(f => {
        const v = String(f).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
        return typeof v === 'function' || (!!v && typeof v === 'object');
      });
    },
    counts() {
      const c = { PASS: 0, FAIL: 0, 'CHỜ': 0, 'GIỚI HẠN': 0 };
      results.forEach(r => { c[r.status]++; });
      return c;
    },
    done() {
      const c = H.counts();
      if (process.env.HTDC_TZ_CHILD) {
        process.stdout.write('\n' + MARK + JSON.stringify(results) + '\n');
      } else {
        const lim = results.filter(r => r.status === 'GIỚI HẠN');
        if (lim.length) {
          console.log('\nGiới hạn đã biết (không tính vào số xanh): ' + lim.length);
          lim.forEach(r => console.log('  · ' + r.name + (r.detail ? ' — ' + r.detail : '')));
        }
        console.log('\n' + title + ': ' + c.PASS + ' PASS · ' + c.FAIL + ' FAIL · ' + c['CHỜ'] + ' CHỜ · ' + c['GIỚI HẠN'] + ' giới hạn đã biết');
      }
      if (c.FAIL) process.exitCode = 1;
      return c;
    }
  };
  process.on('uncaughtException', e => { console.log('LỖI KHUNG TEST: ' + (e && e.stack || e)); process.exitCode = 2; });
  return H;
}

/* Chạy lại file test dưới nhiều múi giờ. Trả true nếu đang ở tiến trình con (người gọi chạy test bình thường).
   Ở tiến trình cha: chạy hết, in kết quả múi giờ đầu đủ, các múi sau chỉ in ca khác PASS, so từng ca, đặt exitCode. */
function runInTimezones(file, title, tzs) {
  if (process.env.HTDC_TZ_CHILD) return true;
  const list = tzs || TZS;
  const all = [];
  let crashed = false;
  for (const tz of list) {
    const r = spawnSync(process.execPath, [file, ...process.argv.slice(2)], {
      encoding: 'utf8', env: Object.assign({}, process.env, { TZ: tz, HTDC_TZ_CHILD: '1' }), maxBuffer: 64 * 1024 * 1024
    });
    const out = r.stdout || '';
    const idx = out.lastIndexOf(MARK);
    if (idx < 0 || r.status === 2) {
      crashed = true;
      console.log('=== TZ=' + tz + ' — LỖI KHUNG TEST (exit ' + r.status + ') ===\n' + out.slice(-3000) + '\n' + (r.stderr || '').slice(-3000));
      continue;
    }
    const results = JSON.parse(out.slice(idx + MARK.length).split('\n')[0]);
    all.push({ tz, results });
    const offH = -new Date(Date.UTC(2026, 9, 29, 12)).getTimezoneOffset() / 60;
    if (all.length === 1) {
      console.log('=== TZ=' + tz + ' (in đủ) ===');
      console.log(out.slice(0, idx).trimEnd());
    } else {
      const bad = results.filter(x => x.status === 'FAIL');
      console.log('=== TZ=' + tz + ': ' + results.filter(x => x.status === 'PASS').length + ' PASS · ' + bad.length + ' FAIL · ' +
        results.filter(x => x.status === 'CHỜ').length + ' CHỜ' + (bad.length ? '' : ' (chỉ in ca FAIL)') + ' ===');
      bad.forEach(x => console.log('FAIL ' + x.name + '  → ' + x.detail));
    }
    void offH;
  }
  /* So từng ca giữa các múi giờ: cùng tên phải cùng trạng thái và cùng chi tiết */
  let mismatch = 0;
  if (all.length > 1) {
    const base = all[0];
    const map = new Map(base.results.map(x => [x.name, x]));
    for (const o of all.slice(1)) {
      if (o.results.length !== base.results.length) { mismatch++; console.log('FAIL số ca khác nhau giữa TZ=' + base.tz + ' (' + base.results.length + ') và TZ=' + o.tz + ' (' + o.results.length + ')'); }
      for (const x of o.results) {
        const b = map.get(x.name);
        if (!b || b.status !== x.status || b.detail !== x.detail) {
          mismatch++;
          console.log('FAIL kết quả khác nhau giữa múi giờ: "' + x.name + '" — TZ=' + base.tz + ': ' + (b ? b.status + ' ' + b.detail : 'không có') + ' · TZ=' + o.tz + ': ' + x.status + ' ' + x.detail);
        }
      }
    }
  }
  const sum = { PASS: 0, FAIL: 0, 'CHỜ': 0, 'GIỚI HẠN': 0 };
  all.forEach(o => o.results.forEach(x => { sum[x.status]++; }));
  const one = all[0] ? all[0].results : [];
  const c1 = { PASS: 0, FAIL: 0, 'CHỜ': 0, 'GIỚI HẠN': 0 };
  one.forEach(x => { c1[x.status]++; });
  const lim = one.filter(x => x.status === 'GIỚI HẠN');
  if (lim.length) {
    console.log('\nGiới hạn đã biết (không tính vào số xanh): ' + lim.length);
    lim.forEach(r => console.log('  · ' + r.name + (r.detail ? ' — ' + r.detail : '')));
  }
  console.log('\n' + title + ': mỗi múi giờ ' + one.length + ' ca (' + c1.PASS + ' PASS · ' + c1.FAIL + ' FAIL · ' + c1['CHỜ'] + ' CHỜ)' +
    ' × ' + all.length + ' múi giờ [' + all.map(o => o.tz).join(', ') + '] → tổng ' + sum.PASS + ' PASS · ' + (sum.FAIL + mismatch) + ' FAIL · ' + sum['CHỜ'] + ' CHỜ' +
    (all.length > 1 ? ' · so giữa múi giờ: ' + (mismatch ? mismatch + ' ca lệch' : 'giống hệt nhau') : ''));
  if (crashed) process.exitCode = 2;
  else if (sum.FAIL + mismatch) process.exitCode = 1;
  return false;
}

/* Bộ sinh số giả ngẫu nhiên có hạt giống (test tất định) */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

module.exports = { createHarness, runInTimezones, TZS, fmt, deepEq, rng };
