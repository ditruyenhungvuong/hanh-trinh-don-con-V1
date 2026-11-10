/* =========================================================
   Smoke test khung – Hành Trình Đón Con (Chủ: qa-tester; T-00 architect viết bản đầu 10/11/2026, QA mở rộng ở T-Q1/T-Q2).
   Nguồn khung: apps/sung-suc/tests/smoke.js @ 10/11/2026 (ADR 0008).
   Chrome headless qua CDP (tests/lib/cdp.js), server tĩnh trong tiến trình (tests/lib/static-server.js), cổng 8775.
   Kiểm (tech design 4, 14; T-00):
   - Registry đủ ĐÚNG 32 khóa: 25 khóa A1 + 7 khóa A2 (tech design mục 4, bảng ánh xạ mã UX), không khóa lạ.
     (T-Q3, 10/11/2026: A2 đã code — bỏ ca "chưa có khóa A2", viết theo bản có A2.)
   - welcome: h1 focus, hai cách dùng, Hỗ trợ ở header; chưa chọn thì không khóa / IndexedDB / cookie.
   - "Không lưu gì" → role → stage → home (ô Dừng lại + Trước khi ngủ + ô A2 🤝 Hai ta, 🌱 Chăm mình, link 📖 Hành trình), dải L07;
     sau cả luồng KHÔNG khóa Web Storage, KHÔNG IndexedDB, KHÔNG cookie (AC-11).
   - Mỗi khóa (A1 + A2) mở được: đúng màn, có h1, header có Hỗ trợ; màn đêm có data-mode="night", màn ngày không (máy sáng);
     máy để tối → cả app tối (U1). Support có tel:115. Quay lại (history) chạy. Hộp thoại: Esc = nút an toàn.
   - after_loss: tên tab không có tên app (K-12, UX T-4).
   - Mọi request chỉ tới 127.0.0.1; không lỗi console / exception / CSP; fetch ra ngoài bị CSP chặn (ADR 0011).
   - Module trùng tên màn → throw "Trùng tên màn". Mở bằng file:// (Chrome) → welcome, không lỗi.
   Chạy (Ubuntu, Node ≥ 22):
     export NODE=/home/adminpc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
     export TMPDIR=/tmp/claude-1000/t; mkdir -p $TMPDIR
     flock /tmp/claude-1000/e2e.lock $NODE tests/smoke.js [--port=8775] [--out=$TMPDIR/out]
   ========================================================= */
'use strict';
const path = require('path');
const os = require('os');
const { launch, sleep } = require('./lib/cdp');
const { startStatic } = require('./lib/static-server');

const argv = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true]; }));
const PORT = +(argv.port || 8775);
const OUT = path.resolve(argv.out || path.join(os.tmpdir(), 'htdc-qa'));
const APP_DIR = path.resolve(__dirname, '..');
let fails = 0, passes = 0;
const T = (name, ok, detail) => { ok ? passes++ : fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && detail !== undefined ? '  → ' + String(detail).slice(0, 400) : '')); };

// Tech design mục 4 (chốt T-00, 10/11/2026): 25 khóa A1, 7 khóa A2
const ROUTES_A1 = ['welcome', 'consent', 'role', 'stage', 'home', 'result', 'loss_soft', 'good_news', 'support', 'urgent', 'about',
  'pause5', 'checkin', 'safety_q', 'suggest', 'library', 'player', 'checkout', 'done',
  'night', 'night_how', 'night_play', 'night_heavy', 'mydata', 'never'];
const ROUTES_A2 = ['together', 'together_stop5', 'together_breathe', 'together_talk', 'send_words', 'care', 'journal'];
const NIGHT = ['night', 'night_how', 'night_play', 'night_heavy'];
// Tham số mẫu theo bảng "Tham số route chốt"
const PARAMS = { stage: { first: true }, urgent: { from: 'support' }, library: { from: 'home' }, player: { ex: 'BREATHE_46', origin: 'library' },
  night_how: { id: 'NIGHT_TOGETHER' }, night_play: { id: 'NIGHT_TOGETHER', how: 'pace', music: null }, night_heavy: { from: 'NIGHT_TOGETHER' } };

function watch(page) {
  const errors = [], requests = [];
  page.on('Runtime.exceptionThrown', p => errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
  page.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push('console.error: ' + p.args.map(a => a.value ?? a.description).join(' ')); });
  page.on('Log.entryAdded', p => { if (p.entry.level === 'error') errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
  page.on('Network.requestWillBeSent', p => requests.push(p.request.url));
  return { errors, requests };
}

(async () => {
  const srv = await startStatic({ port: PORT, appDir: APP_DIR, assetBase: '/__capy/' });
  const { page, kill } = await launch({ userDataDir: path.join(OUT, 'chrome-smoke'), width: 375, height: 812 });
  const { errors, requests } = watch(page);
  const scr = () => page.evaluate("document.querySelector('#main').dataset.screen");
  const storage = () => page.evaluate('JSON.stringify([Object.keys(localStorage), Object.keys(sessionStorage), document.cookie])');
  const dbs = () => page.evaluate('indexedDB.databases().then(l => JSON.stringify(l.map(d => d.name)))');
  const mode = () => page.evaluate("document.documentElement.dataset.mode || ''");
  const scheme = v => page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: v }] });
  try {
    await scheme('light');
    await page.navigate(srv.url);
    await sleep(300);
    T('màn chào hiện (welcome)', await scr() === 'welcome', await scr());
    const keys = await page.evaluate('HTDC_APP.screens()');
    const miss = ROUTES_A1.filter(k => !keys.includes(k));
    T('registry có đủ 25 khóa A1 (tech design mục 4)', !miss.length, 'thiếu: ' + miss.join(', '));
    const missA2 = ROUTES_A2.filter(k => !keys.includes(k));
    T('A2: registry có đủ 7 khóa A2 (together, together_stop5, together_breathe, together_talk, send_words, care, journal)', !missA2.length, 'thiếu: ' + missA2.join(', '));
    const extra = keys.filter(k => !ROUTES_A1.includes(k) && !ROUTES_A2.includes(k));
    T('không có khóa màn lạ ngoài bảng mục 4 (tổng đúng 32 khóa)', !extra.length && keys.length === 32, extra.join(', ') + ' · tổng ' + keys.length);
    T('welcome: h1 được focus', await page.evaluate("document.activeElement && document.activeElement.tagName === 'H1'"));
    T('welcome: hai cách dùng "Lưu trên máy này" và "Không lưu gì"', await page.evaluate("!!document.querySelector('#main [data-go=consent]') && !!document.querySelector('#main [data-act=useNone]')"));
    T('welcome: header có nút Hỗ trợ, không nút Quay lại', await page.evaluate("!!document.querySelector('#header [data-go=support]') && !document.querySelector('#header [data-act=back]')"));
    T('welcome: tên tab có tên app', (await page.evaluate('document.title')).includes('Hành Trình Đón Con'), await page.evaluate('document.title'));
    T('trước khi chọn: không khóa, không IndexedDB, không cookie', await storage() === '[[],[],""]' && await dbs() === '[]', (await storage()) + ' ' + (await dbs()));

    await page.click('#main [data-act=useNone]'); await sleep(150);
    T('"Không lưu gì" → role, store ở chế độ none', await scr() === 'role' && await page.evaluate('HTDC_APP.S.mode()') === 'none', await scr());
    T('dải L07 "Không lưu gì · đóng trang là xóa sạch"', await page.evaluate("document.querySelector('#banners .mode-strip') && document.querySelector('#banners').innerText.includes('Không lưu gì')"));
    await page.click('#main [data-go=stage]'); await sleep(150);
    T('role "Bỏ qua" → stage', await scr() === 'stage', await scr());
    await page.click('#main [data-act=home]'); await sleep(150);
    T('stage "Bỏ qua" → home', await scr() === 'home', await scr());
    T('home: có ô Dừng lại (pause5) và Trước khi ngủ (night)', await page.evaluate("!!document.querySelector('#main .tile[data-go=pause5]') && !!document.querySelector('#main .tile[data-go=night]')"));
    T('home: có ô A2 🤝 Hai ta + 🌱 Chăm mình hôm nay và link 📖 Hành trình của mình (A2 đăng ký qua homeTiles / homeLinks)',
      await page.evaluate("!!document.querySelector('#main .tile[data-go=together]') && !!document.querySelector('#main .tile[data-go=care]') && !!document.querySelector('#main [data-go=journal]')"));
    T('home: không nút Quay lại, h1 focus', await page.evaluate("!document.querySelector('#header [data-act=back]') && document.activeElement.tagName === 'H1'"));
    T('chế độ none: không khóa Web Storage, không cookie (AC-11)', await storage() === '[[],[],""]', await storage());
    T('chế độ none: không mở IndexedDB (AC-11)', await dbs() === '[]', await dbs());

    await page.click('#main .tile[data-go=pause5]'); await sleep(150);
    T('ô Dừng lại → pause5, header có Quay lại', await scr() === 'pause5' && await page.evaluate("!!document.querySelector('#header [data-act=back]')"), await scr());
    await page.click('#header [data-act=back]'); await sleep(250);
    T('Quay lại (history) → home', await scr() === 'home', await scr());

    // Mỗi khóa (A1 + A2) mở được
    const bad = [];
    for (const k of ROUTES_A1.concat(ROUTES_A2)) {
      await page.evaluate(`HTDC_APP.go(${JSON.stringify(k)}, ${JSON.stringify(PARAMS[k] || {})})`); await sleep(60);
      const r = JSON.parse(await page.evaluate(`JSON.stringify({ s: document.querySelector('#main').dataset.screen, h1: !!document.querySelector('#main h1'),
        sup: !!document.querySelector('#header [data-go=support]'), m: document.documentElement.dataset.mode || '' })`));
      const wantNight = NIGHT.includes(k);
      if (r.s !== k || !r.h1 || !r.sup || (r.m === 'night') !== wantNight) bad.push(k + ':' + JSON.stringify(r));
    }
    T('32 khóa (25 A1 + 7 A2) mở được: đúng màn, có h1, header có Hỗ trợ, chế độ đêm đúng (đêm chỉ ở 4 màn night*)', !bad.length, bad.join(' | '));

    await page.evaluate("HTDC_APP.resetTo('home')"); await sleep(100);
    await page.click('#header [data-go=support]'); await sleep(150);
    T('Hỗ trợ → support, aria-current, có tel:115 (≤ 2 chạm, AC-01)', await scr() === 'support' &&
      await page.evaluate("document.querySelector('#header [data-go=support]').getAttribute('aria-current') === 'page' && !!document.querySelector('#main a[href=\"tel:115\"]')"), await scr());

    await page.evaluate("HTDC_APP.go('night')"); await sleep(100);
    const nm = await mode();
    await page.click('#header [data-act=back]'); await sleep(250);
    T('vào màn đêm → data-mode="night"; quay lại màn ngày → gỡ', nm === 'night' && await mode() === '', nm + ' → ' + await mode());
    await scheme('dark'); await sleep(100);
    T('U1: máy để tối → cả app tối (data-mode="night" ở màn ngày)', await mode() === 'night', await mode());
    await scheme('light'); await sleep(100);
    T('U1: máy về sáng → màn ngày sáng lại', await mode() === '', await mode());

    // Hộp thoại (L08, M13a/b): Esc = nút an toàn
    const dv = await page.evaluate(`(async () => { const p = HTDC_APP.dialog({ title: 'Thử', actions: [{ label: 'Xóa', value: 'del', kind: 'danger' }, { label: 'Thôi', value: 'keep', safe: true }] });
      await new Promise(r => setTimeout(r, 50)); const f = document.activeElement && document.activeElement.textContent;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return f + '|' + await p; })()`);
    T('dialog: focus nút an toàn, Esc → giá trị nút an toàn', dv === 'Thôi|keep', dv);

    // after_loss: tên tab không có tên app (K-12)
    await page.evaluate("HTDC_APP.setStage('after_loss', 'stage'); HTDC_APP.resetTo('home')"); await sleep(100);
    const ttl = await page.evaluate('document.title');
    T('after_loss: tên tab không có "Hành Trình Đón Con"', !ttl.includes('Hành Trình Đón Con'), ttl);
    T('sau cả lượt (đổi giai đoạn trong none): vẫn không khóa, không IndexedDB', await storage() === '[[],[],""]' && await dbs() === '[]', (await storage()) + ' ' + (await dbs()));

    const foreign = requests.filter(u => !u.startsWith(srv.url) && !/^(data|about|blob):/.test(u));
    T('mọi request chỉ tới server cục bộ (không font/ảnh/script bên thứ ba)', !foreign.length, foreign.join(' '));
    T('không lỗi console / exception / CSP', errors.length === 0, errors.join(' | '));

    // CSP connect-src 'none': fetch ra ngoài và cùng origin đều bị chặn (lỗi CSP sinh ra ở đây là mong đợi, không tính)
    const fx = await page.evaluate("Promise.all([fetch('https://example.com/').then(() => 'đi', () => 'chặn'), fetch('/index.html').then(() => 'đi', () => 'chặn')]).then(a => a.join(','))");
    T('CSP chặn fetch ra ngoài và cả cùng origin (connect-src none)', fx === 'chặn,chặn', fx);
    T('không request nào tới example.com', !requests.some(u => u.includes('example.com')), requests.filter(u => u.includes('example.com')).join(' '));

    // Module trùng tên màn → boot throw (tech design 3.2)
    const errs2 = [];
    page.on('Runtime.exceptionThrown', p => errs2.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
    const inj = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.HTDC_MODULES = [{ name: 'qa_dup', screens: () => ({ home: { title: 'x', render: () => '' } }) }];" });
    await page.navigate(srv.url); await sleep(300);
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
    T('module trùng tên màn "home" → throw "Trùng tên màn"', errs2.some(e => /Trùng tên màn "home"/.test(e)), errs2.join(' | '));

    // Mở bằng file:// (Chrome, K-10)
    const before = errors.length, beforeExc = errs2.length;
    await page.navigate('file://' + path.join(APP_DIR, 'index.html')); await sleep(400);
    T('file://: welcome hiện', await scr() === 'welcome', await scr());
    await page.click('#main [data-act=useNone]'); await sleep(150);
    T('file://: "Không lưu gì" → role', await scr() === 'role', await scr());
    const newErr = errors.slice(before).filter(e => !/qa_dup|Trùng tên màn/.test(e)).concat(errs2.slice(beforeExc));
    T('file://: không lỗi console / exception / CSP', !newErr.length, newErr.join(' | '));
  } catch (e) {
    T('smoke chạy hết', false, e.stack);
  } finally {
    kill();
    await srv.close();
  }
  console.log('\nsmoke: ' + passes + ' PASS · ' + fails + ' FAIL');
  process.exitCode = fails ? 1 : 0;
})();
