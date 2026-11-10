/* =========================================================
   e2e A1 – Hành Trình Đón Con (Chủ: qa-tester; T-Q2 10/11/2026).
   Viết TỪ ĐẶC TẢ: PRD v0.3 mục 9 (AC A1), tech design 3.3, 4, 5.5, 6, 11, 14.3; UX hiem-muon-ux.md.
   Chrome headless qua CDP (tests/lib/cdp.js), server tĩnh trong tiến trình (tests/lib/static-server.js), cổng 8775 + 8776.
   Mỗi kịch bản mở MỘT tab trong browser context riêng ("máy sạch"); trước kịch bản gieo khóa lạ của app khác.
   Tất định: giờ của trang cố định bằng shim Date (10:00 sáng 10/11/2026, múi Asia/Ho_Chi_Minh) + __tick/__freeze để tua;
   mọi request ra github.io bị chặn (Network.setBlockedURLs) — không phụ thuộc mạng ngoài.
   Kịch bản (tên ca có mã AC để gom bảng cuối):
     A  luồng chính 3 vai × 2 chế độ lưu (AC-01…03, 05, 07, 10–12, 14, 16, 21, 22, 25–29, 35, 37–39e, 40–46, 49c, 11)
     B  check-in: 5 giây, 10 chấm không mặc định, thẻ xáo, thẻ thứ 4, bỏ qua hết (AC-02, 37, 38)
     C  an toàn qua ô Kể thêm: bộ câu khẩn / không khẩn, nhóm 8.2, 8.2b, PII, kênh hỗ trợ trống (AC-25, 30–33)
     D  trình phát B5, B6, B7, Khó chịu hơn (AC-35, 39c, 51–53)
     E  Trước khi ngủ: nhịp ±0,5 s, H2 chạy hết, kết bài chờ 10 s THẬT, ẩn tab thật, nhạc, đọc cho nhau nghe (AC-40…49d)
     F  dữ liệu: xuất JSON/CSV, xóa 2 lần, xóa toàn bộ, tắt chữ (Xóa luôn / Giữ chữ cũ), L-3, M02 bỏ hai ô (AC-13, 18–20, 23, 24)
     G  none ↔ local, hai tab (BroadcastChannel, onversionchange)
     H  sự kiện store giả lập: quota (warn / đầy), unsaved, corrupt (bản ghi hỏng, khóa hỏng), versionTooNew
     I  file://, 3.000 bản ghi ≤ 1,5 s ở 4× CPU, giảm chuyển động, tương phản sáng + đêm, 320/375/768, mạng + CSP + SW
     J  nghi vấn header "lơ lửng" ở ảnh chụp cả trang (M07, M13): đo thật
     K  ALLOW_DRAFT_CONTENT = false (AC-34, 34b)
     L  lượt 3 sau code review A1: bỏ ngang / sửa giữa chừng / quay lại — C-1, C-2, C-3, N-1 (so khác biệt DB), n-1, n-2, n-3,
        lối vào bài đêm, n-5 Tiến không chớp chữ bài (AC-23, 25, 33, 40, 51, 52).
        T-Q3: ca N-1 tổng quát chạy thêm Hai ta (C3), Gửi lời, Chăm mình, Hành trình → so cả bản ghi together + kv habits + kho habits.
     M…S  A2 (T-Q3, tests/e2e/a2.js): M Hai ta C1–C3 · N Gửi lời (share + sao chép) · O Chăm mình · P Hành trình M17 · Q R5 có A2 ·
        R Không lưu gì với A2 · S cỡ màn / máy tối / vùng chạm / tương phản (AC-03, 05, 08, 11, 19, 23, 25, 33, 55–64)
   Chạy (Ubuntu, Node ≥ 22; KHÔNG chạy song song e2e khác):
     export NODE=/home/adminpc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
     export TMPDIR=/tmp/claude-1000/qa-htdc; mkdir -p $TMPDIR
     flock /tmp/claude-1000/e2e.lock $NODE tests/e2e.js [--out=$TMPDIR/out] [--only=A,E] [--shots]
   Ảnh chụp minh họa ở <out>/shots/. Có FAIL → exit 1.
   ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { launch, sleep } = require('./lib/cdp');
const { startStatic } = require('./lib/static-server');
const F = require('./lib/fixture');
const SAFETY_BANK = require('./lib/safety-bank');
const HTDC_BANK = require('./lib/safety-bank-htdc');

const argv = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true]; }));
const OUT = path.resolve(argv.out || path.join(os.tmpdir(), 'htdc-qa'));
const SHOTS = path.join(OUT, 'shots');
const ONLY = argv.only ? String(argv.only).split(',') : null;
const APP_DIR = path.resolve(__dirname, '..');
const APP_NAME = 'Hành Trình Đón Con';
const FOREIGN = ['stop4p_x', 'lstp_v1_local', 'ss_v1_device', 'checkin_me_bau_y', 'myJourneys'];
const BASE_MS = Date.UTC(2026, 10, 10, 3, 0, 0);   // 10:00 sáng 10/11/2026 giờ Việt Nam
const CAPY = ['vui_ve', 'dau_kho', 'lo_lang', 'tuc_gian', 'hoang_hot', 'kho_chiu', 'met_moi', 'binh_an', 'co_don'];
fs.mkdirSync(SHOTS, { recursive: true });

let passes = 0, fails = 0, waits = 0;
const results = [];
const T = (name, ok, detail) => {
  ok ? passes++ : fails++;
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 500) : ''));
  return !!ok;
};
const section = s => console.log('\n=== ' + s + ' ===');
/* CHỜ ANH: câu chữ / nội dung cần anh Thông quyết — không xanh, không đỏ (in riêng, ghi ở báo cáo QA) */
const WAIT = (name, detail) => { waits++; console.log('CHỜ  ' + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 300) : '')); };

/* Script chạy trước mọi script của trang: giờ cố định, ghi CSP, stub share / wakeLock / tải tệp, đếm AudioContext, đo lúc vào home */
const INIT = base => `(() => {
  const RD = Date, t0 = RD.now(); let off = 0, frozen = null;
  const real = () => ${base} + (RD.now() - t0);
  const now = () => (frozen !== null ? frozen : real() + off);
  window.__tick = ms => { if (frozen !== null) frozen += ms; else off += ms; };
  window.__freeze = on => { if (on) { if (frozen === null) frozen = now(); } else if (frozen !== null) { off = frozen - real(); frozen = null; } };
  class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(now()); } static now() { return now(); } }
  window.Date = FD;
  window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  window.__share = []; try { Object.defineProperty(navigator, 'share', { configurable: true, value: d => { window.__share.push(d); return Promise.resolve(); } }); } catch (e) {}
  window.__clip = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__clip.push(t); return Promise.resolve(); } } }); } catch (e) {}
  window.__wake = 0; try { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: () => { window.__wake++;
    return Promise.resolve({ release: () => Promise.resolve(), addEventListener() {} }); } } }); } catch (e) {}
  if (window.AudioContext) { const AC = window.AudioContext; window.__ac = 0; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ac++; } }; }
  window.__dl = []; window.__blobs = {};
  const oc = URL.createObjectURL; URL.createObjectURL = function (b) { const u = oc.call(URL, b); window.__blobs[u] = b; return u; };
  const ck = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl.push({ name: this.download, blob: window.__blobs[this.href] }); return; } return ck.call(this); };
  window.__homeAt = null;
  new MutationObserver(() => { const m = document.getElementById('main'); if (m && m.dataset.screen === 'home' && window.__homeAt === null) window.__homeAt = performance.now(); })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ['data-screen'] });
})();`;

let browser = null, kill = null, srv = null, srv404 = null, srvReal = null;

/* ===== Mở một "máy" (tab trong context riêng) ===== */
async function open(tag, o = {}) {
  const page = await browser.newTarget(null, o.context ? { context: o.context } : { isolated: true });
  const errors = [], requests = [], failed = [];
  page.on('Runtime.exceptionThrown', p => errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
  page.on('Runtime.consoleAPICalled', p => { if (p.type === 'error' || p.type === 'warning') errors.push('console.' + p.type + ': ' + p.args.map(a => a.value ?? a.description).join(' ')); });
  page.on('Log.entryAdded', p => { if (p.entry.level === 'error' && !/ERR_BLOCKED_BY_CLIENT|net::ERR_FILE_NOT_FOUND/.test(p.entry.text + ' ' + (p.entry.url || ''))) errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
  page.on('Network.requestWillBeSent', p => requests.push(p.request.url));
  page.on('Network.loadingFailed', p => failed.push(p.errorText));
  await page.send('Network.setBlockedURLs', { urls: ['*ditruyenhungvuong.github.io*', '*example.com*'] });
  await page.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Ho_Chi_Minh' });
  await page.send('Emulation.setDeviceMetricsOverride', { width: o.width || 375, height: o.height || 812, deviceScaleFactor: 1, mobile: true });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: o.dark ? 'dark' : 'light' },
    { name: 'prefers-reduced-motion', value: o.reduce ? 'reduce' : 'no-preference' }] });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT(o.base || BASE_MS) });
  if (o.preInit) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: o.preInit });
  const ev = e => page.evaluate(e);
  const scr = () => ev("document.querySelector('#main') ? document.querySelector('#main').dataset.screen : ''");
  const wait = async (name, ms = 3000) => { for (let i = 0; i < ms / 50; i++) { if (await scr() === name) return true; await sleep(50); } return false; };
  const until = async (expr, ms = 3000) => { for (let i = 0; i < ms / 50; i++) { if (await ev(expr)) return true; await sleep(50); } return false; };
  const click = async (sel, ms = 120) => { await page.click(sel); await sleep(ms); };
  const has = sel => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
  const text = (sel = '#main') => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).innerText || ''`);
  const dlg = async i => { for (let k = 0; k < 60 && !(await has('.dlg')); k++) await sleep(50); await click(`.dlg [data-dlg="${i}"]`, 200); };
  const shot = async (name, full) => { if (argv.shots || o.shots) await page.screenshot(path.join(SHOTS, tag + '-' + name + '.png'), full).catch(() => {}); };
  const focusData = () => ev("document.activeElement ? (document.activeElement.dataset.dlg ?? document.activeElement.className) + '|' + document.activeElement.textContent.trim().slice(0, 40) : ''");
  const x = { tag, page, errors, requests, failed, ev, scr, wait, until, click, has, text, dlg, shot, focusData };
  x.close = async () => { try { await page.closeTab(); } catch (e) { /* đã đóng */ } };
  x.go = async (url) => { await page.navigate(url || srv.url); await sleep(350); };
  x.seed = () => ev(`(${JSON.stringify(FOREIGN)}).forEach(k => localStorage.setItem(k, 'giu-nguyen'))`);
  x.foreignOk = async () => (await ev(`JSON.stringify((${JSON.stringify(FOREIGN)}).map(k => localStorage.getItem(k)))`)) === JSON.stringify(FOREIGN.map(() => 'giu-nguyen'));
  x.htdcKeys = () => ev("JSON.stringify(Object.keys(localStorage).filter(k => !" + JSON.stringify(FOREIGN) + ".includes(k)).concat(Object.keys(sessionStorage).map(k => 'session:' + k)).concat(document.cookie ? ['cookie'] : []))");
  x.dbs = () => ev("indexedDB.databases().then(l => JSON.stringify(l.map(d => d.name)))");
  x.noErr = async (label, allow) => {
    const csp = await ev('window.__csp ? window.__csp.join(" | ") : ""').catch(() => '');
    const errs = errors.filter(e => !(allow && allow.test(e)));
    T(`[${tag}] ${label || ''}không lỗi console / exception / CSP`, !errs.length && !csp, errs.concat(csp ? ['CSP: ' + csp] : []).join(' || '));
  };
  /* Kiểm chung mỗi màn: AC-01, 03, 07, 22 + chữ thô */
  x.check = async (label, o2 = {}) => {
    const r = JSON.parse(await ev(`JSON.stringify((() => {
      const d = document.documentElement, cw = d.clientWidth, main = document.querySelector('#main'), t = document.body.innerText;
      const vis = el => { const b = el.getBoundingClientRect(), s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && !el.closest('[hidden]'); };
      const over = [...document.querySelectorAll('#header *, #main *, #banners *')].filter(e => vis(e) && e.getBoundingClientRect().right > cw + 1).slice(0, 3)
        .map(e => e.tagName + '.' + String(e.className).slice(0, 30));
      const small = [...document.querySelectorAll('#header button, #main button, #main a[href], #main [role=radio], #main [role=switch], #main summary, #main input[type=checkbox], #main input[type=radio]')]
        .filter(vis).map(e => { const lab = e.closest('label') || e; const b = lab.getBoundingClientRect(); return { e, w: b.width, h: b.height }; })
        .filter(z => z.w < 43.5 || z.h < 43.5).map(z => (z.e.dataset.act || z.e.dataset.go || z.e.className || z.e.tagName) + ' ' + Math.round(z.w) + '×' + Math.round(z.h));
      const appName = ${JSON.stringify(APP_NAME)};
      const inMain = (main.innerText.match(new RegExp(appName, 'g')) || []).length, eyebrow = !!main.querySelector('.eyebrow') && main.querySelector('.eyebrow').innerText.includes(appName);
      return { sw: d.scrollWidth, cw, over, small, raw: /\\{(xung|Xung|nt|x|URL|n|label|before|after|a|v)\\}/.test(t), bad: /\\bundefined\\b|\\bNaN\\b|\\[object Object\\]|\\bnull\\b/.test(main.innerText),
        sup: !!document.querySelector('#header [data-go=support]'), h1: !!main.querySelector('h1'), title: document.title,
        hdrName: document.querySelector('#header').innerText.includes(appName), inMain, eyebrow, screen: main.dataset.screen };
    })())`));
    const n = `[${tag}] ${label} (${r.screen})`;
    T(`${n} AC-03 không cuộn ngang (${r.sw}/${r.cw})`, r.sw <= r.cw && !r.over.length, r.over.join(', '));
    T(`${n} AC-07 không còn {xung}/{nt}/biến thô, không undefined/NaN/null`, !r.raw && !r.bad, (await text()).slice(0, 200));
    T(`${n} AC-01 header có Hỗ trợ; có h1`, r.sup && r.h1);
    if (!o2.skipTap) T(`${n} AC-03 vùng chạm ≥ 44×44`, !r.small.length, r.small.join(' · '));
    const loss = (await ev('HTDC_APP.stage && HTDC_APP.stage()')) === 'after_loss';
    const wantTitle = loss || o2.noAppName ? !r.title.includes(APP_NAME) : r.title.endsWith(' · ' + APP_NAME) || r.title === APP_NAME;
    T(`${n} AC-22 tên app: không ở header, ở #main chỉ dòng nhỏ M01; tên tab "${r.title}"`,
      !r.hdrName && (r.screen === 'welcome' ? r.inMain === 1 && r.eyebrow : r.inMain === 0) && wantTitle, JSON.stringify(r));
  };
  x.goHome = async () => { await ev("HTDC_APP.resetTo('home')"); await x.wait('home'); };
  /* Một lượt check-in qua giao diện: { level, emotions, note, ctx, min } → bấm "Xem gợi ý" */
  x.checkin = async (c = {}) => {
    await x.goHome();
    await click('#main .tile[data-go=pause5]'); await x.wait('pause5');
    await click('#main [data-act=p5Go]'); await x.wait('checkin');
    if (c.level) await click(`#main [data-dot="${c.level}"]`, 60);
    for (const e of c.emotions || []) await click(`#main [data-capy=${e}]`, 60);
    for (const e of c.ctx || []) await click(`#main [data-ctx=${e}]`, 60);
    if (c.min) await click(`#main [data-min="${c.min}"]`, 60);
    if (c.note) { await click('#ck-note', 60); await page.type(c.note); }
    await click('#main [data-act=ckNext]', 200);
    return scr();
  };
  x.sgIds = () => ev("JSON.stringify([...document.querySelectorAll('#sg [data-go=player]')].map(b => JSON.parse(b.dataset.params).ex))").then(JSON.parse);
  // text: giải mã UTF-8 (Blob.text() tự bỏ BOM) · bom: 3 byte đầu có phải EF BB BF
  x.blobs = () => ev('Promise.all(window.__dl.map(d => d.blob.arrayBuffer().then(b => { const u = new Uint8Array(b); return { name: d.name, text: new TextDecoder().decode(u), bom: u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF }; })))');
  x.dbDump = () => ev(`new Promise(res => { const r = indexedDB.open('htdc_v1_db'); r.onerror = () => res('{}');
    r.onsuccess = () => { const d = r.result, out = {}, names = [...d.objectStoreNames]; if (!names.length) { d.close(); return res('{}'); }
      const t = d.transaction(names); let n = names.length; names.forEach(s => { const q = t.objectStore(s).getAll(); q.onsuccess = () => { out[s] = q.result; if (!--n) { d.close(); res(JSON.stringify(out)); } }; }); }; })`).then(JSON.parse);
  return x;
}

/* Thiết lập nhanh qua giao diện: chọn cách dùng, vai, giai đoạn */
async function setup(x, { mode = 'local', writing = false, role = 'wife', stage = 'waiting', url } = {}) {
  await x.go(url); await x.seed();
  if (mode === 'local') {
    await x.click('#main [data-go=consent]'); await x.wait('consent');
    if (writing) await x.click('#cs-writing');
    await x.click('#main [data-act=consentGo]', 300);
  } else await x.click('#main [data-act=useNone]');
  await x.wait('role');
  if (role) await x.click(`#main [data-pick=${role}]`);
  await x.click('#main [data-act=roleNext]'); await x.wait('stage');
  if (stage) await x.click(`#main [data-pick=${stage}]`);
  await x.click('#main [data-act=stageNext]'); await x.wait('home');
}
const XUNG = { wife: 'chị', husband: 'anh', solo: 'bạn' };
const cap = s => s[0].toUpperCase() + s.slice(1);

/* =====================================================================
   A. Luồng chính: 3 vai × 2 chế độ lưu
   ===================================================================== */
async function mainFlow(role, mode) {
  const x = await open(`A-${role}-${mode}`, { shots: role === 'wife' && mode === 'local' });
  const tg = `[${x.tag}]`, xung = XUNG[role];
  try {
    await x.go(); await x.seed();
    T(`${tg} mở app → M01 welcome`, await x.scr() === 'welcome');
    await x.check('M01');
    const ab = JSON.parse(await x.ev(`JSON.stringify((() => { const a = document.querySelector('#main [data-go=consent]'), b = document.querySelector('#main [data-act=useNone]');
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return { ca: a.className, cb: b.className, wa: ra.width, wb: rb.width, ha: ra.height, hb: rb.height, sameRow: Math.abs(ra.top - rb.top) < 2, stack: Math.abs(ra.left - rb.left) < 2 }; })())`));
    T(`${tg} AC-10 hai nút "Lưu trên máy này" / "Không lưu gì" cùng kiểu, cùng cỡ, cùng hàng hoặc chồng dọc cùng rộng`,
      ab.ca === ab.cb && /primary/.test(ab.ca) && Math.abs(ab.wa - ab.wb) < 1 && (ab.sameRow ? Math.abs(ab.ha - ab.hb) < 1 : ab.stack), JSON.stringify(ab));
    const w = await x.text();
    T(`${tg} AC-21 M01: không tài khoản, không gửi mạng, dùng chung máy → "Không lưu gì", câu địa chỉ dùng chung`,
      /không có tài khoản/i.test(w) && /không gửi gì lên mạng/i.test(w) && /chung một điện thoại[\s\S]*Không lưu gì/.test(w) && /cùng địa chỉ web/.test(w), w.slice(0, 400));
    await x.shot('01-welcome');
    if (mode === 'local') {
      await x.click('#main [data-go=consent]'); await x.wait('consent'); await x.check('M02');
      T(`${tg} AC-12 M02: "Lưu hành trình" bật sẵn, "Lưu cả chữ tự viết" tắt sẵn`, await x.ev("document.querySelector('#cs-journey').checked && !document.querySelector('#cs-writing').checked"));
      T(`${tg} AC-12 M02: chưa bấm "Đồng ý" thì chưa ghi gì (không khóa htdc, không DB)`, (await x.htdcKeys()) === '[]' && !(await x.dbs()).includes('htdc'), (await x.htdcKeys()) + (await x.dbs()));
      await x.click('#cs-journey');
      T(`${tg} AC-24 M02: tắt "Lưu hành trình" → ô chữ tự viết không bật được`, await x.ev("document.querySelector('#cs-writing').disabled && !document.querySelector('#cs-writing').checked"));
      await x.click('#cs-journey');
      await x.click('#main [data-act=consentGo]', 300);
    } else await x.click('#main [data-act=useNone]');
    T(`${tg} → M03 role, chế độ store = ${mode}`, await x.wait('role') && await x.ev('HTDC_APP.S.mode()') === mode, await x.ev('HTDC_APP.S.mode()'));
    if (mode === 'local') T(`${tg} có khóa htdc_v1_device + DB htdc_v1_db sau khi đồng ý`, (await x.htdcKeys()) === '["htdc_v1_device"]' && (await x.dbs()).includes('htdc_v1_db'), (await x.htdcKeys()) + (await x.dbs()));
    await x.check('M03');
    await x.click(`#main [data-pick=${role}]`); await x.click('#main [data-act=roleNext]');
    T(`${tg} → M04 stage (lần đầu)`, await x.wait('stage')); await x.check('M04');
    await x.click('#main [data-pick=waiting]'); await x.click('#main [data-act=stageNext]');
    T(`${tg} → M05 home`, await x.wait('home')); await x.check('M05');
    const h1 = await x.text('#main h1');
    T(`${tg} AC-14 lời chào M05 xưng "${xung}"`, new RegExp('(^|\\s)' + xung + '(\\s|[,.!]|$)', 'i').test(h1), h1);
    // T-Q3 (A2 đã code): M05 có thêm ô 🤝 Hai ta, 🌱 Chăm mình và link 📖 Hành trình của mình (UX 4.2, tech design 3.2 homeTiles/homeLinks)
    T(`${tg} M05: ô Dừng lại + Trước khi ngủ + "Mình vừa có kết quả ›" (waiting) + ô A2 🤝 Hai ta, 🌱 Chăm mình, link 📖 Hành trình`,
      await x.has('#main .tile[data-go=pause5]') && await x.has('#main .tile[data-go=night]') && await x.has('#main [data-go=result]')
      && await x.has('#main .tile[data-go=together]') && await x.has('#main .tile[data-go=care]') && await x.has('#main [data-go=journal]'));
    T(`${tg} AC-34 M05 có dòng bản thử nghiệm`, /Bản thử nghiệm: nội dung chưa được hội đồng chuyên môn phê duyệt/.test(await x.text()));
    if (mode === 'none') T(`${tg} L07 dải "Không lưu gì" dưới header`, /Không lưu gì/.test(await x.text('#banners')));
    await x.shot('05-home');

    /* --- Dừng lại 1: chấm 5 + Tự trách (phiên chưa có cờ low) → không M08 (AC-28), R3b + câu ghi nhận + hai tuần (AC-29, AC-39e) --- */
    const s2 = await x.checkin({ level: 5, emotions: ['self_blame'] });
    T(`${tg} AC-28 chấm 5 → M09 thẳng (không M08)`, s2 === 'suggest' || await x.wait('suggest'), s2);
    await x.check('M09 R3b');
    T(`${tg} AC-39e câu ghi nhận "Chuyện này làm ${xung} nặng lòng lắm phải không?"`, (await x.text('#sg .st-ack')).includes(`Chuyện này làm ${xung} nặng lòng lắm phải không?`), await x.text('#sg .st-ack'));
    T(`${tg} AC-29 chấm 5 → dòng "kéo dài hơn hai tuần … bác sĩ điều trị"`, /kéo dài hơn hai tuần, \S+ nói với bác sĩ điều trị/.test(await x.text('#sg')), await x.text('#sg'));
    const g2 = await x.sgIds();
    T(`${tg} AC-39e R3b: [Bàn tay ấm – bản ngày, Đặt tên suy nghĩ]`, JSON.stringify(g2) === '["WARM_HAND_DAY","THOUGHT_CLOUD"]', g2.join(','));
    await x.shot('09-suggest-r3b');
    await x.click('#sg [data-go=player][data-params*=THOUGHT_CLOUD]'); await x.wait('player'); await x.check('M10-B5');
    await x.click('#cl-t'); await x.page.type('Lần này lại không được.');
    await x.click('#cl-name', 200);
    T(`${tg} AC-51 B5 "Mình đang có suy nghĩ rằng lần này lại không được"`, (await x.text('#cl-x')).trim() === 'Mình đang có suy nghĩ rằng lần này lại không được', await x.text('#cl-x'));
    await x.click('#main [data-act=plDone]'); await x.wait('checkout');
    await x.click('#main [data-act=coSkip]'); await x.wait('home');

    /* --- Dừng lại 2: chấm 2 + Đau khổ → M08 → Không → M09 (thẻ "không một mình" đầu, R2 mức thấp) → B8 → check-out → M12 --- */
    await x.goHome(); await x.click('#main .tile[data-go=pause5]'); await x.wait('pause5'); await x.check('M06');
    await x.click('#main [data-act=p5Go]'); await x.wait('checkin'); await x.check('M07');
    await x.click('#main [data-dot="2"]'); await x.click('#main [data-capy=dau_kho]');
    T(`${tg} AC-38 dòng "${cap(xung)} chọn: Đau khổ"`, (await x.text('#main .capy-picked')).trim() === cap(xung) + ' chọn: Đau khổ', await x.text('#main .capy-picked'));
    await x.shot('07-checkin');
    await x.click('#main [data-act=ckNext]');
    T(`${tg} AC-27 chấm 2 → M08 trước M09`, await x.wait('safety_q')); await x.check('M08');
    T(`${tg} M08 có ba nút ngang hàng (Có / Không / Không muốn trả lời), không nút chính`, await x.ev("document.querySelectorAll('#main [data-act^=sq]').length === 3 && !document.querySelector('#main .btn.primary')"));
    await x.click('#main [data-act=sqNo]');
    T(`${tg} AC-27 "Không" → M09`, await x.wait('suggest')); await x.check('M09 mức thấp');
    T(`${tg} AC-27 thẻ "${cap(xung)} không phải một mình" đứng đầu M09`, await x.ev("(() => { const s = document.querySelector('#sg'), h = s.querySelector('.human-card'), a = s.querySelector('.st-sg'); return !!h && (!a || (h.compareDocumentPosition(a) & 4) > 0); })()")
      && (await x.text('#sg .human-card')).includes(cap(xung) + ' không phải một mình'), await x.text('#sg .human-card'));
    const g1 = await x.sgIds();
    T(`${tg} AC-27/AC-39b chấm 2 + Đau khổ → R2: [Bàn tay ấm, Âm thanh êm dịu], không Thở 4–6 / bài viết`, JSON.stringify(g1) === '["WARM_HAND_DAY","CALM_SOUND"]', g1.join(','));
    await x.click('#main [data-act=sgSwap]', 200);
    const g1b = await x.sgIds();
    T(`${tg} AC-27 "Đổi gợi ý" mức thấp: chỉ ứng viên R2, không R8, không bài viết`, g1b.length >= 1 && g1b.every(i => ['WARM_HAND_DAY', 'CALM_SOUND', 'PAUSE5'].includes(i)), g1b.join(','));
    // N-1 (Team Lead chốt lượt 3): StopRec lưu xuống máy KHÔNG có trường rule (R1 ⇔ cờ từ khóa 8.2b); engine vẫn trả rule trong bộ nhớ
    if (mode === 'local') T(`${tg} N-1 StopRec không có trường rule (bộ nhớ + DB)`, await x.ev("!('rule' in HTDC_APP.S.journal.list({kind:'stop'})[0])") && (await x.dbDump()).journal.every(j => !('rule' in j)), await x.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'stop'})[0])"));
    await x.shot('09-suggest-low');
    await x.click('#sg [data-go=player][data-params*=WARM_HAND_DAY]');
    T(`${tg} → M10 Bàn tay ấm – bản ngày`, await x.wait('player')); await sleep(400); await x.check('M10-B8');
    T(`${tg} AC-35 M10 luôn có "Trở về thở tự nhiên" + "Mình thấy khó chịu"; AC-34 dòng bản thử nghiệm`, await x.has('#main [data-act=plNatural]') && await x.has('#main [data-act=plUneasy]') && /Bản thử nghiệm/.test(await x.text()));
    T(`${tg} B8 chữ chạy theo nhịp (api.paced)`, (await x.ev("document.querySelector('#pl-body .reader-block').textContent.trim().length")) > 5);
    // Vừa "Đổi gợi ý" (toast 3,2 s) rồi mở bài ngay: nút an toàn ở chân màn phải bấm được (AC-35 "luôn hiện")
    const cover = await x.ev(`JSON.stringify(['plNatural', 'plUneasy', 'plDone'].map(a => { const b = document.querySelector('#main [data-act=' + a + ']').getBoundingClientRect();
      const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return a + ':' + (el && el.closest('[data-act=' + a + ']') ? 'ok' : (el && (el.id || el.className || el.tagName))); }))`);
    await x.shot('10-toast-che-nut-an-toan');
    T(`${tg} AC-35 ngay sau "Đổi gợi ý", nút "Trở về thở tự nhiên" / "Mình thấy khó chịu" ở chân M10 không bị toast che`, !/:(?!ok)/.test(JSON.parse(cover).join(' ')), cover + ' · toast: ' + await x.text('#toast'));
    await x.until("!document.querySelector('#toast').classList.contains('show')", 5000);
    await x.click('#main [data-act=plNatural]');
    T(`${tg} AC-35 "Trở về thở tự nhiên" → lớp thở tự nhiên (L10), thân bài ẩn`, await x.has('.st-calm:not(.uneasy)') && await x.ev("document.querySelector('#pl-body').hidden"));
    await x.click('.st-calm [data-calm=resume]');
    await x.click('#main [data-act=plDone]');
    T(`${tg} Xong → M11 check-out`, await x.wait('checkout')); await x.check('M11');
    await x.click('#co [data-dot="4"]'); await x.click('#main [data-fit=fit]'); await x.click('#main [data-act=coDone]');
    T(`${tg} → M12`, await x.wait('done')); await x.check('M12');
    T(`${tg} AC-39d M12 "Trước 2 → Sau 4"`, /Trước\s*2\s*→\s*Sau\s*4/.test(await x.text('#main .st-ba')), await x.text());
    T(`${tg} AC-04 M12 không pháo hoa (không canvas, không animation chạy)`, await x.ev("!document.querySelector('canvas') && document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).length === 0"));
    if (mode === 'local') {
      const r = JSON.parse(await x.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'stop'})[0])"));
      T(`${tg} StopRec: before 2, after 4, fit, emotions [dau_kho], done B8; không cờ an toàn (AC-23)`, r.before === 2 && r.after === 4 && r.fit === 'fit' && JSON.stringify(r.emotions) === '["dau_kho"]'
        && r.done.some(d => d.ex === 'WARM_HAND_DAY') && !/flag|not_alone|low|safety|answer/.test(JSON.stringify(r)), JSON.stringify(r));
    }

    // Không hạ mức (6.5): phiên đã có cờ low → lượt sau chấm 5 + Tự trách vẫn gợi ý như mức thấp (chỉ Bàn tay ấm), câu ghi nhận vẫn có
    await x.checkin({ level: 5, emotions: ['self_blame'] }); await x.wait('suggest');
    T(`${tg} 6.5 không hạ mức: sau lượt chấm 2, chấm 5 + Tự trách → chỉ [Bàn tay ấm]; thẻ "không một mình" + câu ghi nhận vẫn có`,
      JSON.stringify(await x.sgIds()) === '["WARM_HAND_DAY"]' && await x.has('#sg .human-card') && await x.has('#sg .st-ack'), JSON.stringify(await x.sgIds()));

    /* --- Dừng lại 3: chấm 8 + câu tự hại ở Kể thêm → M20 → "chỉ là cách nói" → M09 thẻ đầu (AC-25, 26, 23) --- */
    const s3 = await x.checkin({ level: 8, note: 'mình không muốn sống nữa' });
    T(`${tg} AC-25 câu tự hại → M20 trước mọi gợi ý`, s3 === 'urgent' || await x.wait('urgent'), s3);
    await x.check('M20');
    T(`${tg} M20 có tel:115 và câu "Cơ sở chưa công bố kênh hỗ trợ" (AC-32)`, await x.has('#main a[href="tel:115"]') && /Cơ sở chưa công bố kênh hỗ trợ trong app/.test(await x.text()));
    await x.shot('20-urgent');
    await x.click('#main [data-act=urgentSafe]');
    T(`${tg} AC-26 "chỉ là cách nói" → M09, thẻ "không một mình" đứng đầu`, await x.wait('suggest') && await x.ev("(() => { const h = document.querySelector('#sg .human-card'), a = document.querySelector('#sg .st-sg'); return !!h && (!a || (h.compareDocumentPosition(a) & 4) > 0); })()"));
    const g3 = await x.sgIds();
    T(`${tg} sau M20 (cờ self_harm): gợi ý theo mức thấp — không Đặt tên suy nghĩ / Biết chắc`, g3.length >= 1 && !g3.some(i => /THOUGHT|KNOW/.test(i)), g3.join(','));
    await x.click('#sg [data-go=player]'); await x.wait('player'); await sleep(200);
    await x.click('#main [data-act=plUneasy]');
    T(`${tg} AC-35 "Mình thấy khó chịu" → lớp L11 có nút Hỗ trợ`, await x.has('.st-calm.uneasy [data-go=support]'));
    await x.goHome();
    if (mode === 'local') {
      const all = JSON.stringify(await x.dbDump());
      T(`${tg} AC-23 chữ dẫn tới M20 không lưu; không cờ / câu trả lời an toàn trong DB`, !/muốn sống|self_harm|not_alone|"low"|safety_q|urgent/.test(all), all.slice(0, 300));
    }

    /* --- Thư viện (AC-50) --- */
    await x.ev("HTDC_APP.go('library', {from:'home'})"); await x.wait('library'); await x.check('M09b');
    const lib = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main .st-ex:not(.st-ex-night)')].map(b => ({ id: JSON.parse(b.dataset.params).ex, g: !!b.querySelector('.st-ex-g'), s: !!b.querySelector('.st-ex-s'), tag: !!b.querySelector('.st-tag'), min: /phút/.test(b.innerText) })))"));
    T(`${tg} AC-50 thư viện có đúng 8 bài B1–B8, mỗi bài có mục tiêu + thời lượng + trạng thái duyệt; B2–B8 có dòng an toàn`,
      lib.length === 8 && lib.every(b => b.g && b.min && b.tag) && lib.filter(b => b.s).length >= 7, JSON.stringify(lib));
    T(`${tg} thư viện có nhóm "Trước khi ngủ" 4 bài`, await x.ev("document.querySelectorAll('#main .st-ex-night').length") === 4);
    await x.shot('09b-library');

    /* --- Trước khi ngủ: cổng hỏi mỗi lần (AC-40), nặng lòng (AC-45), V6 (AC-46), đêm (AC-49c) --- */
    await x.goHome();
    await x.click('#main .tile[data-go=night]'); await x.wait('night'); await sleep(500); await x.check('M13');
    T(`${tg} AC-49c M13 data-mode=night dù máy sáng`, await x.ev("document.documentElement.dataset.mode") === 'night');
    T(`${tg} AC-46 dòng cố định V6 trên M13`, (await x.text()).includes('Bài hình dung là để lòng dịu lại trước khi ngủ. Nó không làm tăng hay giảm khả năng có thai.'));
    const sugW = await x.ev("JSON.stringify((() => { const out = []; let e = document.querySelector('#main h2'); for (e = e && e.nextElementSibling; e && e.tagName !== 'H2' && e.tagName !== 'DETAILS'; e = e.nextElementSibling) if (e.dataset.id) out.push(e.dataset.id); return out; })())");
    T(`${tg} M13 waiting: "Gợi ý tối nay" = H2, H3`, sugW === '["NIGHT_HOME_SHORT","NIGHT_TOGETHER"]', sugW);
    await x.shot('13-night');
    await x.click('#main [data-act=pick][data-id=NIGHT_HOME]', 250);
    T(`${tg} AC-40 H1 → hộp cổng hỏi M13b (trong M13, focus tiêu đề)`, await x.has('.dlg') && await x.scr() === 'night' && await x.ev("document.activeElement && document.activeElement.classList.contains('dlg-title')"));
    T(`${tg} AC-49c hộp M13b vẫn chế độ đêm`, await x.ev("document.documentElement.dataset.mode") === 'night');
    await x.shot('13b-gate');
    await x.dlg(0);
    T(`${tg} AC-40 "Ấm lòng" → M13c`, await x.wait('night_how')); await x.check('M13c');
    T(`${tg} AC-34 M14 (màn bắt đầu M13c) có dòng bản thử nghiệm`, /Bản thử nghiệm/.test(await x.text()));
    T(`${tg} AC-48 nhạc nền mặc định tắt; chưa tạo AudioContext`, await x.ev("document.querySelector('[data-act=musicOn]') ? document.querySelector('[data-act=musicOn]').getAttribute('aria-checked') === 'false' : true") && await x.ev('window.__ac || 0') === 0);
    T(`${tg} AC-49b bài không có audio → không có lựa chọn "Nghe giọng thật"`, !(await x.has('#main input[name=how][value=voice]')));
    await x.click('#main [data-act=start]');
    T(`${tg} → M14`, await x.wait('night_play')); await sleep(500); await x.check('M14', { noAppName: false });
    T(`${tg} AC-45 M14 luôn có "Dừng, về thở tự nhiên" và "Bài này làm mình nặng lòng"`, await x.has('#main [data-act=natural]') && await x.has('#main [data-act=heavy]'));
    await x.shot('14-play');
    await x.click('#main [data-act=heavy]');
    T(`${tg} AC-45 "nặng lòng" → màn dịu L12 (Bàn tay ấm + Hỗ trợ)`, await x.wait('night_heavy') && await x.has('#main [data-act=warm]') && await x.has('#main [data-go=support]'));
    await x.check('L12');
    await x.shot('l12-heavy');
    await x.ev("HTDC_APP.resetTo('night')"); await x.wait('night');
    await x.click('#main [data-act=pick][data-id=NIGHT_HOME]', 250);
    T(`${tg} AC-40/V1 mở lại H1 trong cùng tối → cổng hỏi lại`, await x.has('.dlg'));
    await x.dlg(1);
    const soft = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('.night-soft .night-card')].map(b => b.dataset.id))"));
    T(`${tg} AC-40 "Nặng lòng" → ở M13, gợi H4, H3 (không vào H1)`, await x.scr() === 'night' && JSON.stringify(soft) === '["NIGHT_WARM_HAND","NIGHT_TOGETHER"]', soft.join(','));
    await x.ev("HTDC_APP.resetTo('night')"); await x.wait('night');
    await x.click('#main [data-act=pick][data-id=NIGHT_HOME_SHORT]', 250); await x.dlg(2);
    const soft2 = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('.night-soft .night-card')].map(b => b.dataset.id))"));
    T(`${tg} AC-40 "Chưa chắc" → gợi H3`, JSON.stringify(soft2) === '["NIGHT_TOGETHER"]', soft2.join(','));

    /* --- Kết quả: "Không muốn nói" không đổi; "Chưa như mong đợi" → after_loss (AC-16, 22, 41, 42) --- */
    await x.goHome();
    await x.click('#main [data-go=result]'); await x.wait('result'); await x.check('M21');
    await x.click('#main [data-act=res_none]');
    T(`${tg} AC-16 "Không muốn nói" → giai đoạn không đổi (waiting)`, await x.wait('home') && await x.ev('HTDC_APP.stage()') === 'waiting');
    await x.click('#main [data-go=result]'); await x.wait('result');
    await x.click('#main [data-act=res_loss]');
    T(`${tg} AC-16 "Chưa như mong đợi" → M21b, giai đoạn after_loss`, await x.wait('loss_soft') && await x.ev('HTDC_APP.stage()') === 'after_loss');
    await x.check('M21b');
    const ls = await x.text();
    T(`${tg} AC-16 M21b có "Mình rất tiếc." và "${cap(xung)} không cần làm gì lúc này cả."`, ls.includes('Mình rất tiếc.') && ls.includes(cap(xung) + ' không cần làm gì lúc này cả.'), ls.slice(0, 200));
    T(`${tg} AC-16 M21b không hoạt hình, không pháo hoa`, await x.ev("!document.querySelector('canvas') && document.getAnimations().length === 0"));
    T(`${tg} AC-22 after_loss: tên tab không có tên app ("${await x.ev('document.title')}")`, !(await x.ev('document.title')).includes(APP_NAME));
    await x.shot('21b-loss');
    await x.click('#main [data-go=player]'); await x.wait('player'); await sleep(300);
    const plan = await x.ev(`JSON.stringify(['WARM_HAND_DAY', 'NIGHT_WARM_HAND', 'NIGHT_TOGETHER'].map(id => HTDC_APP.PC.plan(id, { xung: HTDC_APP.xung(), nt: 'người thương' }).blocks.map(b => b.text).join(' ')))`);
    // "con" nghĩa con cái (bỏ "con đường" — loại từ); "con đường" có ở H3-09 → CHỜ ANH (AC-22 viết theo chữ)
    const CON = /(^|[^\p{L}])con(?![\p{L}])(?!\s+đường)/giu, ROAD = /(^|[^\p{L}])con\s+đường/giu;
    const conHits = JSON.parse(plan).map((s, i) => [['B8', 'H4', 'H3'][i], (s.match(CON) || []).length]).filter(z => z[1]);
    T(`${tg} AC-22 bài thay thế (B8 bản ngày, H4, H3) và màn B8 không có chữ "con" (nghĩa con cái)`, !conHits.length && !CON.test(await x.text()), JSON.stringify(conHits));
    const road = JSON.parse(plan).map((s, i) => [['B8', 'H4', 'H3'][i], (s.match(ROAD) || []).length]).filter(z => z[1]);
    if (road.length && role === 'wife' && mode === 'local') WAIT(`${tg} AC-22 chữ "con" theo nghĩa đen: "một con đường" ở H3-09 (kịch bản nguyên văn) — anh quyết giữ hay đổi`, JSON.stringify(road));
    await x.goHome(); await x.check('M05 after_loss');
    await x.click('#main .tile[data-go=night]'); await x.wait('night'); await sleep(300); await x.check('M13 after_loss');
    const sl = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main > .night-card')].map(b => b.dataset.id))"));
    T(`${tg} AC-41 after_loss: "Gợi ý tối nay" H4 đứng đầu, không H1/H2`, sl[0] === 'NIGHT_WARM_HAND' && !sl.some(i => /NIGHT_HOME/.test(i)), sl.join(','));
    T(`${tg} AC-41 H1, H2 nằm trong mục đóng sẵn`, await x.ev("!!document.querySelector('details.night-more:not([open]) [data-id=NIGHT_HOME]')"));
    await x.ev("document.querySelector('details.night-more').open = true");
    await x.click('#main [data-act=pick][data-id=NIGHT_HOME]', 250);
    const cf = await x.text('.dlg');
    T(`${tg} AC-42 after_loss H1 → hộp xác nhận M13a "Bài này nói về con…" TRƯỚC cổng`, /Bài này nói về con/.test(cf) && /Để lúc khác/.test(cf), cf);
    T(`${tg} AC-42 focus mặc định "Để lúc khác"`, /Để lúc khác/.test(await x.focusData()), await x.focusData());
    await x.shot('13a-confirm');
    await x.dlg(1);
    T(`${tg} AC-42 "Vẫn nghe" → hộp cổng hỏi M13b`, await x.has('.dlg') && /ấm lòng|nặng lòng/i.test(await x.text('.dlg')), await x.text('.dlg'));
    await x.dlg(1);
    T(`${tg} cổng "Nặng lòng" → không vào H1`, await x.scr() === 'night');
    await x.ev("HTDC_APP.go('library', {from:'home'})"); await x.wait('library');
    await x.click('#main .st-ex-night[data-id=NIGHT_HOME_SHORT]', 300);
    T(`${tg} AC-42 after_loss mở H2 từ thư viện → sang M13 + hộp xác nhận trước`, await x.scr() === 'night' && /Bài này nói về con/.test(await x.text('.dlg')), await x.text('.dlg'));
    await x.dlg(0);
    T(`${tg} "Để lúc khác" → ở M13, không vào bài`, await x.scr() === 'night' && !(await x.has('.dlg')));
    await x.click('#main [data-act=pick][data-id=NIGHT_WARM_HAND]');
    T(`${tg} H4 → M13c thẳng (không cổng)`, await x.wait('night_how'));
    await x.click('#main [data-act=start]'); await x.wait('night_play'); await sleep(300); await x.check('M14-H4');
    await x.click('#main [data-act=natural]');
    T(`${tg} AC-45 "Dừng, về thở tự nhiên" → lớp thở tự nhiên`, await x.ev("!document.querySelector('.reader-calm').hidden"));
    await x.goHome();
    T(`${tg} AC-08 rời mục Trước khi ngủ → màn ngày bỏ data-mode`, !(await x.ev('document.documentElement.dataset.mode')));

    /* --- Hỗ trợ (AC-01, 32), about, never, mydata (AC-21) --- */
    await x.click('#header [data-go=support]');
    T(`${tg} AC-01 Hỗ trợ 1 chạm → M19; 115 ở màn đầu (≤ 2 chạm)`, await x.wait('support') && await x.has('#main a[href="tel:115"]'));
    await x.check('M19');
    T(`${tg} AC-32 M19 "Cơ sở chưa công bố kênh hỗ trợ…", không tel: nào khác 115`, /Cơ sở chưa công bố kênh hỗ trợ trong app/.test(await x.text()) && await x.ev("[...document.querySelectorAll('a[href^=\"tel:\"]')].every(a => a.getAttribute('href') === 'tel:115')"));
    T(`${tg} M19 "Không ai theo dõi app này lúc ${xung === 'bạn' ? 'bạn' : '…'} dùng"`, /Không ai theo dõi app này/.test(await x.text()));
    await x.shot('19-support');
    await x.ev("HTDC_APP.go('about')"); await x.wait('about'); await x.check('about');
    await x.ev("HTDC_APP.go('never')"); await x.wait('never'); await x.check('M18b');
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata'); await x.check('M18');
    const md = await x.text();
    T(`${tg} AC-21 M18: không tài khoản, không gửi mạng, dùng chung máy → Không lưu gì, địa chỉ dùng chung`, /không có tài khoản/i.test(md) && /không gửi gì lên mạng/i.test(md) && /Không lưu gì/.test(md) && /chung địa chỉ web/.test(md), md.slice(0, 300));
    await x.shot('18-mydata');

    if (mode === 'local') {
      const kinds = await x.ev("HTDC_APP.S.journal.list().map(r => r.kind).join(',')");
      T(`${tg} journal local có stop + night + stage`, /stop/.test(kinds) && /night/.test(kinds) && /stage/.test(kinds), kinds);
      const db = await x.dbDump();
      const nightRecs = (db.journal || []).filter(r => r.kind === 'night');
      T(`${tg} AC-23 NightRec không có câu trả lời cổng hỏi / xác nhận`, nightRecs.length >= 1 && nightRecs.every(r => Object.keys(r).every(k => ['v', 'kind', 'id', 'at', 'day', 'tz', 'stage', 'script', 'how', 'music', 'end', 'outcome'].includes(k))), JSON.stringify(nightRecs[0]));
      T(`${tg} AC-13 lưu chữ tắt: không bản ghi nào có note / texts (B5 đã gọi tên)`, (db.journal || []).every(r => !('note' in r) && !('texts' in r)), JSON.stringify(db.journal).slice(0, 300));
      await x.click('#main [data-act=delAll]', 250);
      T(`${tg} hộp xóa toàn bộ: focus "Thôi, giữ lại"`, /Thôi, giữ lại/.test(await x.focusData()), await x.focusData());
      await x.dlg(0); await sleep(400);
      T(`${tg} AC-20 xóa toàn bộ → M01; không còn khóa htdc / DB; khóa app khác còn nguyên`, await x.wait('welcome') && (await x.htdcKeys()) === '[]' && !(await x.dbs()).includes('htdc') && await x.foreignOk(), (await x.htdcKeys()) + (await x.dbs()));
    } else {
      T(`${tg} AC-11 none sau trọn vòng Dừng lại (có chữ) + bài đêm: không khóa mới, không sessionStorage/cookie`, (await x.htdcKeys()) === '[]' && await x.foreignOk(), await x.htdcKeys());
      T(`${tg} AC-11 none: không có IndexedDB htdc_v1_db (không DB nào)`, (await x.dbs()) === '[]', await x.dbs());
      await x.go();
      T(`${tg} AC-11 none: tải lại → M01`, await x.scr() === 'welcome');
    }
    await x.noErr();
  } catch (e) {
    T(`${tg} chạy hết luồng`, false, e.stack + ' · màn ' + await x.scr().catch(() => '?'));
    await x.page.screenshot(path.join(SHOTS, x.tag + '-ERROR.png'), true).catch(() => {});
  } finally { await x.close(); }
}

/* =====================================================================
   B. Check-in: 5 giây, chấm, thẻ, bỏ qua hết (AC-02, 37, 38)
   ===================================================================== */
async function scenarioB() {
  const x = await open('B-checkin'); const tg = '[B]';
  try {
    await setup(x, { mode: 'local', role: 'husband', stage: 'cycle' });
    await x.click('#main .tile[data-go=pause5]'); await x.wait('pause5');
    const t0 = await x.ev("document.querySelector('#p5btn').textContent.trim()");
    T(`${tg} AC-37 M06 nút ban đầu là "Bỏ qua", bấm được ngay`, t0 === 'Bỏ qua' && !(await x.ev("document.querySelector('#p5btn').disabled")), t0);
    await sleep(4300);
    const t1 = await x.ev("document.querySelector('#p5btn').textContent.trim()");
    await sleep(1100);
    const t2 = await x.ev("document.querySelector('#p5btn').textContent.trim()");
    T(`${tg} AC-37 trước 5 s vẫn "Bỏ qua", sau 5 s thành "Tiếp tục"`, t1 === 'Bỏ qua' && /^Tiếp tục/.test(t2), t1 + ' → ' + t2);
    T(`${tg} AC-37 đổi chữ không cướp focus (focus vẫn ở h1)`, await x.ev("document.activeElement && document.activeElement.tagName === 'H1'"));
    await x.click('#p5btn'); await x.wait('checkin');
    T(`${tg} AC-38 10 chấm không mức nào chọn sẵn`, await x.ev("document.querySelectorAll('#main .dots [role=radio]').length === 10 && document.querySelectorAll('#main .dots [aria-checked=true]').length === 0"));
    const cards = JSON.parse(await x.ev(`JSON.stringify([...document.querySelectorAll('#main .capy-card')].map(c => ({ c: c.dataset.capy, img: !!c.querySelector('img'),
      name: !c.querySelector('.capy-name').hidden && c.querySelector('.capy-name').getBoundingClientRect().height > 0, aria: c.getAttribute('aria-label') })))`));
    const photos = cards.filter(c => CAPY.includes(c.c));
    T(`${tg} AC-38 lưới 11 thẻ: 9 capybara + Tự trách + Chưa rõ`, cards.length === 11 && photos.length === 9 && cards.some(c => c.c === 'self_blame'), JSON.stringify(cards.map(c => c.c)));
    T(`${tg} AC-38 9 thẻ capybara chỉ hình (ảnh, không chữ dưới ảnh), tên ở aria-label`, photos.every(c => c.img && !c.name && c.aria), JSON.stringify(photos));
    T(`${tg} AC-38 "Tự trách" và "Chưa rõ" có chữ dưới thẻ`, cards.filter(c => ['self_blame', 'unsure'].includes(c.c)).every(c => c.name), JSON.stringify(cards.filter(c => !CAPY.includes(c.c))));
    T(`${tg} AC-38 "Chưa rõ" ở ô cuối`, cards[10].c === 'unsure');
    const ord1 = cards.map(c => c.c).join();
    const orders = [ord1];
    for (let k = 0; k < 3; k++) { await x.ev("HTDC_APP.go('pause5')"); await x.wait('pause5'); await x.click('#p5btn'); await x.wait('checkin');
      orders.push(await x.ev("[...document.querySelectorAll('#main .capy-card')].map(c => c.dataset.capy).join()")); }
    T(`${tg} AC-38 thứ tự 10 thẻ đầu xáo khác nhau giữa các lượt, "Chưa rõ" luôn cuối`, new Set(orders.map(o => o.split(',').slice(0, 10).join())).size > 1 && orders.every(o => o.endsWith('unsure')), orders.join(' | '));
    for (const c of ['lo_lang', 'co_don', 'met_moi']) await x.click(`#main [data-capy=${c}]`, 60);
    await x.click('#main [data-capy=tuc_gian]');
    T(`${tg} AC-38 chạm thẻ thứ 4 → nhắc nhẹ, không bật thẻ`, await x.ev("document.querySelector('#main [data-capy=tuc_gian]').getAttribute('aria-pressed') === 'false' && !document.querySelector('#main .capy-note').hidden")
      && /tối đa ba/.test(await x.text('#main .capy-note')), await x.text('#main .capy-note'));
    T(`${tg} AC-38 thẻ đã chọn có aria-pressed=true (3 thẻ)`, await x.ev("document.querySelectorAll('#main .capy-card[aria-pressed=true]').length") === 3);
    // Bàn phím cho 10 chấm (UX 8)
    await x.ev("document.querySelector('#main [data-dot=\"1\"]').focus()"); await x.page.key('ArrowRight'); await sleep(80);
    T(`${tg} 10 chấm: mũi tên phải chọn mức 2`, await x.ev("document.querySelector('#main [data-dot=\"2\"]').getAttribute('aria-checked')") === 'true');
    // AC-02: bỏ qua hết
    await x.ev("HTDC_APP.go('pause5')"); await x.wait('pause5'); await x.click('#p5btn'); await x.wait('checkin');
    await x.click('#main [data-act=ckNext]');
    T(`${tg} AC-02 check-in không nhập gì → vẫn tới M09`, await x.wait('suggest'));
    const g = await x.sgIds();
    T(`${tg} AC-39 bỏ qua hết, cycle, 10 giờ → R8 [Thở 4–6, Về với lúc này]`, JSON.stringify(g) === '["BREATHE_46","GROUND_54321"]', g.join(','));
    await x.click('#sg [data-go=player]'); await x.wait('player');
    await x.click('#main [data-act=plDone]'); await x.wait('checkout');
    await x.click('#main [data-act=coDone]');
    T(`${tg} AC-02/39d check-out không chấm → M12, không dòng "Trước → Sau", không lỗi`, await x.wait('done') && !(await x.has('#main .st-ba')));
    const r = JSON.parse(await x.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'stop'})[0])"));
    T(`${tg} StopRec bỏ qua hết: before/after null, không có rule (N-1); thứ tự xáo không lưu`, r.before === null && r.after === null && !('rule' in r) && !/order|shuffle/.test(JSON.stringify(r)), JSON.stringify(r));
    // AC-39: R4 (waiting), R6 (Mệt mỏi), R7 (chip Khó ngủ), lọc phút qua giao diện
    await x.ev("HTDC_APP.setStage('waiting', 'stage')");
    await x.checkin({ level: 7 }); await x.wait('suggest');
    T(`${tg} AC-39 R4 qua giao diện: waiting → [Đặt tên suy nghĩ, Biết chắc – Chưa biết]`, JSON.stringify(await x.sgIds()) === '["THOUGHT_CLOUD","KNOW_UNKNOWN"]', JSON.stringify(await x.sgIds()));
    await x.ev("HTDC_APP.setStage('cycle', 'stage')");
    await x.checkin({ level: 7, emotions: ['met_moi'], min: 3 }); await x.wait('suggest');
    const g6 = await x.sgIds();
    T(`${tg} AC-39 R6 + 3 phút → bài ≤ 3 phút (Dừng 5 giây trước)`, g6[0] === 'PAUSE5' && g6.every(i => ['PAUSE5', 'BREATHE_46', 'GROUND_54321', 'THOUGHT_CLOUD'].includes(i)), g6.join(','));
    await x.checkin({ level: 7, ctx: ['sleep'] }); await x.wait('suggest');
    T(`${tg} AC-39 R7 chip Khó ngủ → thẻ "Sang 🌙 Trước khi ngủ ›" + Thả lỏng từng vùng`, await x.has('#sg [data-go=night]') && (await x.sgIds())[0] === 'RELEASE', JSON.stringify(await x.sgIds()));
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
}

/* =====================================================================
   C. An toàn qua ô Kể thêm (AC-25, 30, 31, 32, 33)
   ===================================================================== */
async function scenarioC() {
  const x = await open('C-safety'); const tg = '[C]';
  try {
    await setup(x, { mode: 'local', role: 'solo', stage: 'cycle' });
    const fresh = async () => { await x.go(); await x.wait('home'); };   // tải lại = phiên mới (cờ phiên chỉ cộng, không ghi xuống máy)
    const urg = SAFETY_BANK.filter(([, e]) => e === 'urgent').slice(0, 10), nou = SAFETY_BANK.filter(([, e]) => e === 'noturgent').slice(0, 10);
    const badU = [], badN = [];
    for (const [t] of urg) { const s = await x.checkin({ level: 8, note: t }); if (s !== 'urgent') badU.push(t + '→' + s); }
    for (const [t] of nou) { await fresh(); const s = await x.checkin({ level: 8, note: t }); if (s === 'urgent') badN.push(t); }
    T(`${tg} AC-25 ${urg.length} câu "phải khẩn" (STOP-4P) ở Kể thêm → M20`, !badU.length, badU.join(' | '));
    T(`${tg} AC-25 ${nou.length} câu "không được khẩn" không tới M20`, !badN.length, badN.join(' | '));
    // AC-30: mỗi nhóm 8.2 ≥ 1 câu bắt + ≥ 1 câu không bắt, qua giao diện
    const groups = ['hopeless', 'selfblame', 'home', 'loss', 'prolonged'];
    for (const g of groups) {
      const yes = HTDC_BANK.find(r => r[1] === g && r[2] === 'yes'), no = HTDC_BANK.find(r => r[1] === g && r[2] === 'no');
      await fresh(); await x.checkin({ level: 8, note: yes[0] }); await x.wait('suggest');
      const ok1 = await x.has('#sg .human-card');
      const extra = g === 'loss' ? await x.has('#sg #sg-loss') : g === 'selfblame' ? await x.has('#sg .st-ack') : g === 'prolonged' ? /hai tuần/.test(await x.text('#sg')) : true;
      T(`${tg} AC-30 [${g}] "${yes[0]}" → thẻ "không một mình"${g === 'loss' ? ' + thẻ đổi chặng đường' : g === 'selfblame' ? ' + câu ghi nhận' : g === 'prolonged' ? ' + hai tuần' : ''}`, ok1 && extra, await x.text('#sg'));
      if (g === 'loss') {
        await x.click('#sg #sg-loss [data-go=stage]');
        T(`${tg} AC-30/K-13 nút đổi chặng đường → M04 có 🌧️ tô sẵn nhưng CHƯA chọn; giai đoạn chưa đổi`, await x.wait('stage') && await x.has('#main .choice.suggested[data-pick=after_loss]') && await x.ev('HTDC_APP.stage()') === 'cycle');
        await x.click('#header [data-act=back]', 300);
        await x.click('#sg [data-act=sgKeep]');
        T(`${tg} AC-30 "Để như cũ" → thẻ biến mất, giai đoạn không đổi`, !(await x.has('#sg #sg-loss')) && await x.ev('HTDC_APP.stage()') === 'cycle');
        await x.ev("HTDC_APP.go('night')"); await x.wait('night');
        const sl = await x.ev("JSON.stringify([...document.querySelectorAll('#main > .night-card')].map(b => b.dataset.id))");
        T(`${tg} AC-30/V2 phiên có nhóm Mất con: M13 không gợi ý H1/H2`, !/NIGHT_HOME/.test(sl), sl);
        await x.ev("document.querySelector('details.night-more') && (document.querySelector('details.night-more').open = true)");
        await x.click('#main [data-act=pick][data-id=NIGHT_HOME]', 250);
        T(`${tg} AC-42 phiên có Mất con: mở H1 → hộp xác nhận trước`, /Bài này nói về con/.test(await x.text('.dlg')));
        await x.dlg(0);
      }
      await fresh(); const sN = await x.checkin({ level: 8, note: no[0] }); await x.wait('suggest');
      T(`${tg} AC-30 [${g}] câu không được bắt "${no[0]}" → không thẻ "không một mình"`, sN !== 'urgent' && !(await x.has('#sg .human-card')), await x.text('#sg'));
    }
    // "bị đánh thức": nhóm home không bắt, human STOP-4P vẫn bắt (giới hạn đã biết) → vẫn có thẻ
    await fresh(); await x.checkin({ level: 8, note: 'mình bị đánh thức lúc ba giờ sáng' }); await x.wait('suggest');
    T(`${tg} "bị đánh thức": không phải nhóm home; human STOP-4P nguyên văn → vẫn có thẻ "không một mình" (giới hạn chờ anh)`, await x.has('#sg .human-card'));
    // AC-31: nhóm cơ thể
    await fresh(); await x.checkin({ level: 8, emotions: ['lo_lang'], note: 'từ sáng đau bụng dữ dội' }); await x.wait('suggest');
    const ids = await x.sgIds();
    await x.click('#main [data-act=sgSwap]', 200);
    const ids2 = await x.sgIds();
    T(`${tg} AC-31 cụm 8.2b → thẻ "Chuyện này cần bác sĩ" có tel:115, chỉ bài R1 (kể cả sau Đổi gợi ý)`, await x.has('#sg .body-card a[href="tel:115"]') && ids.concat(ids2).every(i => ['CALM_SOUND', 'PAUSE5'].includes(i)), ids.concat(ids2).join(','));
    T(`${tg} PRD 8.1 thứ tự thẻ: "cần bác sĩ" đứng trên "không một mình"`, await x.ev("(() => { const b = document.querySelector('#sg .body-card'), h = document.querySelector('#sg .human-card'); return !!b && (!h || (b.compareDocumentPosition(h) & 4) > 0); })()"));
    await x.shot('31-body');
    // AC-33: PII (chỉ khi lưu: none không kiểm) → mở máy lưu + chữ
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }

  const y = await open('C-pii'); const tp = '[C-pii]';
  try {
    await setup(y, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
    for (const s of ['0912 345 678', 'mã IVF 2611234', 'chồng mình là anh Trần Minh Quân']) {
      const r = await y.checkin({ level: 7, note: 'hôm nay ' + s });
      const panel = await y.text('#ck-pii');
      T(`${tp} AC-33 "${s}" → bảng nhận diện: Sửa / Bỏ / Vẫn giữ + "Bộ lọc không thể phát hiện mọi thông tin."`, r === 'checkin' && (await y.ev("document.querySelectorAll('#ck-pii [data-pii]').length")) === 3
        && panel.includes('Bộ lọc không thể phát hiện mọi thông tin.') && panel.includes(s.replace(/^.*anh /, 'anh ').slice(0, 6)), panel.slice(0, 200));
      if (s.startsWith('0912')) {
        await y.click('#ck-pii [data-pii=drop]');
        T(`${tp} AC-33 "Bỏ đoạn đó" xóa đoạn khỏi ô`, !(await y.ev("document.querySelector('#ck-note').value")).includes('345'), await y.ev("document.querySelector('#ck-note').value"));
        await y.click('#main [data-act=ckNext]', 200);
        T(`${tp} sau khi bỏ → M09`, await y.wait('suggest'));
      } else if (s.startsWith('mã')) {
        await y.click('#ck-pii [data-pii=keep]', 200);
        T(`${tp} AC-33 "Vẫn giữ" → M09, chữ được lưu nguyên (đã đồng ý chữ)`, await y.wait('suggest') && (await y.ev("HTDC_APP.S.journal.list({kind:'stop'})[0].note")).includes('2611234'));
      } else {
        await y.click('#ck-pii [data-pii=edit]');
        T(`${tp} AC-33 "Sửa lại" → ở lại M07, focus ô, chọn đoạn nhận diện`, await y.scr() === 'checkin' && await y.ev("document.activeElement.id === 'ck-note' && document.activeElement.selectionEnd > document.activeElement.selectionStart"));
      }
    }
    // AC-05: XSS ở Kể thêm (lưu chữ bật) + B5
    await y.checkin({ level: 7, note: '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>' });
    await y.wait('suggest');
    await y.ev("HTDC_APP.go('player', {ex:'THOUGHT_CLOUD', origin:'library'})"); await y.wait('player');
    await y.click('#cl-t'); await y.page.type('<img src=x onerror="window.__xss=3">'); await y.click('#cl-name', 200);
    await y.ev("HTDC_APP.go('mydata')"); await y.wait('mydata'); await sleep(200);
    T(`${tp} AC-05 chuỗi <img onerror> ở Kể thêm, B5, M18 không chạy, không thành thẻ img`, (await y.ev('window.__xss || 0')) === 0 && !(await y.has('img[src="x"]')) && (await y.text('#cl-x').catch(() => '')) !== null);
    // AC-05: dữ liệu IndexedDB bị sửa tay
    await y.ev(`new Promise(res => { const r = indexedDB.open('htdc_v1_db'); r.onsuccess = () => { const d = r.result, t = d.transaction('journal', 'readwrite');
      t.objectStore('journal').put(${JSON.stringify(F.stopRec({ id: 'xssxssxssxssxssxss01', note: '<img src=x onerror="window.__xss=4">', emotions: ['<img src=x onerror="window.__xss=5">'] }))});
      t.oncomplete = () => { d.close(); res(1); }; }; })`);
    await y.go(); await y.ev("HTDC_APP.go('mydata')"); await y.wait('mydata'); await sleep(200);
    T(`${tp} AC-05 bản ghi IndexedDB bị sửa tay (<img onerror>) không chạy khi đọc lại / vẽ M18`, (await y.ev('window.__xss || 0')) === 0 && !(await y.has('img[src="x"]')));
    await y.noErr();
  } catch (e) { T(`${tp} chạy hết`, false, e.stack); } finally { await y.close(); }
}

/* =====================================================================
   D. Trình phát B5, B6, B7; Khó chịu hơn (AC-35, 39c, 51–53)
   ===================================================================== */
async function scenarioD() {
  const x = await open('D-players', { reduce: false }); const tg = '[D]';
  try {
    await setup(x, { mode: 'local', writing: false, role: 'solo', stage: 'cycle' });
    // B5: chữ lên mây và trôi; cụm tự hại → M20, chữ không lên mây / không lưu (AC-51)
    await x.ev("HTDC_APP.go('player', {ex:'THOUGHT_CLOUD', origin:'library'})"); await x.wait('player');
    await x.click('#cl-t'); await x.page.type('lần này lại không được'); await x.click('#cl-name', 200);
    await x.click('#cl-fly', 200);
    T(`${tg} AC-51 chạm → mây trôi (class fly)`, await x.ev("document.querySelector('#cl-c').classList.contains('fly')"));
    await x.goHome(); await x.ev("HTDC_APP.go('player', {ex:'THOUGHT_CLOUD', origin:'library'})"); await x.wait('player');
    await x.click('#cl-t'); await x.page.type('mệt muốn chết'); await x.click('#cl-name', 250);
    T(`${tg} AC-51 B5 nhập cụm tự hại → M20 trước khi lên mây`, await x.wait('urgent'));
    await x.click('#main [data-act=urgentSafe]', 250);
    T(`${tg} 6.4 lối "chỉ là cách nói" từ B5 → quay lại bài, có thẻ "không một mình", chữ không lên mây`, await x.wait('player') && await x.has('#main .human-card') && !(await x.ev("document.querySelector('#cl-x').textContent.includes('chết')")));
    T(`${tg} AC-23 chữ tự hại ở B5 không lưu`, !JSON.stringify(await x.dbDump()).includes('chết'));
    // B6 (AC-52)
    await x.ev("HTDC_APP.go('player', {ex:'KNOW_UNKNOWN', origin:'library'})"); await x.wait('player'); await x.check('M10-B6');
    const boxes = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main .pl-box')].map(b => b.querySelectorAll('[data-kx]').length))"));
    T(`${tg} AC-52 B6 có ba ô, mỗi ô có ví dụ chạm chọn`, boxes.length === 3 && boxes.every(n => n >= 1), JSON.stringify(boxes));
    await x.click('#main [data-act=plDone]');
    T(`${tg} AC-52 để trống cả ba vẫn hoàn thành được`, await x.wait('checkout'));
    await x.ev("HTDC_APP.go('player', {ex:'KNOW_UNKNOWN', origin:'library'})"); await x.wait('player');
    await x.click('[data-kx=todo]');
    await x.click('#kn-send', 150);
    const prev = await x.text('#kn-prev');
    await x.click('#kn-go', 300);
    const sh = JSON.parse(await x.ev('JSON.stringify(window.__share)'));
    T(`${tg} AC-52 "Gửi việc này cho người thương" → bảng chia sẻ với đúng chữ đã xem`, sh.length === 1 && prev.includes(sh[0].text.split('\n')[0].trim()) && /Việc mình làm được/.test(sh[0].text), JSON.stringify(sh) + ' | xem: ' + prev);
    // B7 (AC-53)
    await x.ev("HTDC_APP.go('player', {ex:'CALM_SOUND', origin:'library'})"); await x.wait('player'); await sleep(300);
    T(`${tg} AC-53 B7 âm không tự phát (chưa tạo AudioContext), âm lượng mặc định 30, có hẹn giờ`, (await x.ev('window.__ac || 0')) === 0 && await x.ev("document.querySelector('#avol').value") === '30' && (await x.ev("document.querySelectorAll('#main [data-am]').length")) >= 2);
    await x.click('#aplay', 400);
    T(`${tg} AC-53 bấm Phát → có âm`, await x.ev('HTDC_APP.SOUND.playing()') > 0);
    await x.goHome(); await sleep(1000);
    T(`${tg} AC-53 rời màn → tắt âm (≤ 1 s)`, await x.ev('HTDC_APP.SOUND.playing()') === 0, await x.ev('HTDC_APP.SOUND.playing()'));
    await x.ev("HTDC_APP.go('player', {ex:'CALM_SOUND', origin:'library'})"); await x.wait('player');
    await x.click('#aplay', 300);
    await x.click('#main [data-act=plUneasy]'); await sleep(900);
    T(`${tg} AC-35 "Mình thấy khó chịu" → dừng, tắt âm ≤ 1 s, lớp L11`, await x.ev('HTDC_APP.SOUND.playing()') === 0 && await x.has('.st-calm.uneasy'));
    // AC-39c: Khó chịu hơn
    await x.checkin({ level: 6 }); await x.wait('suggest');
    await x.click('#sg [data-go=player]'); await x.wait('player'); await x.click('#main [data-act=plDone]'); await x.wait('checkout');
    await x.click('#main [data-fit=worse]', 200);
    T(`${tg} AC-39c "Khó chịu hơn" → "Mình dừng ở đây nhé. Thở tự nhiên thôi." + liên kết Hỗ trợ, không M12, không bài khác`,
      await x.scr() === 'checkout' && /Mình dừng ở đây nhé\. Thở tự nhiên thôi\./.test(await x.text()) && await x.has('#co [data-go=support]') && !(await x.has('#main [data-go=player]')), await x.text());
    // AC-36 (giao diện): B2 không có pha giữ hơi
    await x.ev("HTDC_APP.go('player', {ex:'BREATHE_46', origin:'library'})"); await x.wait('player'); await sleep(300);
    T(`${tg} AC-36 B2 không có chữ "nín" / "giữ hơi"`, !/nín thở|giữ hơi/i.test((await x.text()).replace(/không (cần )?(nín|giữ)[^.]*\./gi, '')), await x.text('#pl-body'));
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
}

/* =====================================================================
   E. Trước khi ngủ (AC-40…49d)
   ===================================================================== */
async function scenarioE() {
  /* E1: H2 chạy theo nhịp (giờ đứng yên, chỉ tua) → từng khối đúng ±0,5 s; ẩn tab thật; kết bài chờ 10 s thật */
  const x = await open('E-pace'); const tg = '[E-pace]';
  try {
    await setup(x, { mode: 'local', role: 'husband', stage: 'waiting' });
    const tot = JSON.parse(await x.ev(`JSON.stringify(['wife','husband','solo'].flatMap(r => { const ctx = { xung: { wife: 'chị', husband: 'anh', solo: 'bạn' }[r], nt: r === 'solo' ? 'một người thương bạn' : 'người thương' };
      return [['H1', HTDC_APP.PC.plan('NIGHT_HOME', ctx).totalMs], ['H2', HTDC_APP.PC.plan('NIGHT_HOME_SHORT', ctx).totalMs]]; }))`));
    T(`${tg} AC-47 tổng thời gian H1 8–11 phút, H2 2,5–4 phút (3 vai)`, tot.every(([k, ms]) => (k === 'H1' ? ms >= 480000 && ms <= 660000 : ms >= 150000 && ms <= 240000)), JSON.stringify(tot));
    await x.click('#main .tile[data-go=night]'); await x.wait('night');
    await x.click('#main [data-act=pick][data-id=NIGHT_HOME_SHORT]', 250); await x.dlg(0); await x.wait('night_how');
    await x.ev('__freeze(true)');
    await x.click('#main [data-act=start]'); await x.wait('night_play'); await sleep(300);
    const pl = JSON.parse(await x.ev("JSON.stringify(HTDC_APP.PC.plan('NIGHT_HOME_SHORT', { xung: 'anh', nt: 'người thương' }))"));
    const blk = () => x.ev("document.querySelector('.reader-block').textContent");
    T(`${tg} khối đầu đúng kịch bản, xưng "anh"`, (await blk()) === pl.blocks[0].text, await blk());
    const timing = [];
    let el = 0, end = 0;   // el: thời gian đã tua kể từ lúc bắt đầu; end: mốc hết khối k (cộng dồn blockMs)
    for (let k = 0; k < 3; k++) {
      end += pl.blocks[k].ms;
      await x.ev(`__tick(${end - 500 - el})`); el = end - 500; await sleep(400);
      const before = await blk();
      await x.ev('__tick(1000)'); el += 1000; await sleep(400);
      const after = await blk();
      timing.push([k, before === pl.blocks[k].text, after === pl.blocks[k + 1].text]);
    }
    T(`${tg} AC-47 mỗi khối hiện đúng blockMs ±0,5 s (3 khối đầu)`, timing.every(z => z[1] && z[2]), JSON.stringify(timing));
    await x.click('.reader-tap', 200);
    T(`${tg} AC-47 chạm màn → khối kế`, (await blk()) === pl.blocks[4].text, await blk());
    await x.click('#main [data-act=pp]', 150); await x.ev('__tick(60000)'); await sleep(400);
    T(`${tg} AC-47 ⏸ giữ khối (tua 60 s vẫn khối cũ)`, (await blk()) === pl.blocks[4].text);
    await x.click('#main [data-act=pp]', 150);
    // AC-47b: ẩn tab THẬT (tab khác cùng máy lên trước) → tự tạm dừng; quay lại vẫn dừng tới khi bấm Tiếp tục
    const other = await browser.newTarget(null, { context: x.page.contextId });
    await other.navigate('about:blank'); await other.send('Page.bringToFront'); await sleep(300);
    const hidden = await x.ev('document.visibilityState');
    await x.ev('__tick(90000)');
    await x.page.send('Page.bringToFront'); await sleep(500);
    const b1 = await blk(), btn = await x.ev("document.querySelector('[data-act=pp]').textContent.trim()");
    await x.ev('__tick(60000)'); await sleep(400);
    T(`${tg} AC-47b ẩn tab (${hidden}) → chữ tự tạm dừng ở khối đang hiện; quay lại có nút "Tiếp tục", chưa tự chạy`,
      hidden === 'hidden' && b1 === pl.blocks[4].text && (await blk()) === b1 && /Tiếp tục/.test(btn), `${hidden} · ${b1.slice(0, 30)} · nút ${btn}`);
    await other.closeTab();
    await x.click('#main [data-act=pp]', 150);
    await x.ev(`__tick(${pl.blocks[4].ms + 200})`); await sleep(400);
    T(`${tg} AC-47b bấm "Tiếp tục" mới chạy tiếp`, (await blk()) === pl.blocks[5].text, await blk());
    // Tua tới hết bài
    for (let k = 0; k < 80 && !(await x.has('.reader-block.ending')); k++) { await x.ev('__tick(5000)'); await sleep(280); }
    const tEnd = Date.now();
    T(`${tg} hết khối cuối → chữ tối dần (ending, transition 10 s)`, await x.has('.reader-block.ending') && /10s/.test(await x.ev("getComputedStyle(document.querySelector('.reader-block.ending')).transitionDuration")), await x.ev("getComputedStyle(document.querySelector('.reader-block')).transitionDuration"));
    await x.ev('__freeze(false)');
    let tOut = null;
    for (let k = 0; k < 140 && tOut === null; k++) { if (await x.has('.night-end')) tOut = Date.now(); else await sleep(100); }
    const waited = tOut === null ? null : (tOut - tEnd) / 1000;
    T(`${tg} kết bài chờ 10 s THẬT rồi mới hiện check-out một chạm (đo ${waited} s)`, waited !== null && waited >= 9.3 && waited <= 11.5, waited);
    T(`${tg} AC-34 màn kết M14 có dòng bản thử nghiệm`, /Bản thử nghiệm/.test(await x.text('.night-end')));
    await x.shot('h2-end');
    await x.click('.night-end [data-act=out][data-v=better]', 200);
    const rec = JSON.parse(await x.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'night'})[0])"));
    T(`${tg} NightRec end=finished, outcome=better, how=pace, script H2`, rec.end === 'finished' && rec.outcome === 'better' && rec.how === 'pace' && rec.script === 'NIGHT_HOME_SHORT', JSON.stringify(rec));
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }

  /* E2: nhạc nền chỉ sau bấm; "nặng lòng" → âm tắt ≤ 1 s, không đỏ (AC-45, 48) */
  const m = await open('E-music'); const tm = '[E-music]';
  try {
    await setup(m, { mode: 'none', role: 'wife', stage: 'cycle' });
    await m.ev("HTDC_APP.go('night')"); await m.wait('night');
    await m.click('#main [data-act=pick][data-id=NIGHT_TOGETHER]'); await m.wait('night_how');
    await m.click('#main [data-act=musicOn]'); await m.click('#main [data-act=musicKind][data-v=rain]');
    T(`${tm} AC-48 bật công tắc nhạc nhưng chưa bấm Bắt đầu → chưa có âm, chưa AudioContext; hẹn giờ 10/20/30`, (await m.ev('window.__ac || 0')) === 0 && await m.ev('HTDC_APP.SOUND.playing()') === 0
      && (await m.ev("[...document.querySelectorAll('[data-act=musicMin]')].map(b => b.dataset.v).join()")) === '10,20,30', await m.ev("[...document.querySelectorAll('[data-act=musicMin]')].map(b => b.dataset.v).join()"));
    T(`${tm} AC-48 âm lượng mặc định 30`, await m.ev("document.querySelector('#nVol').value") === '30');
    await m.click('#main [data-act=start]', 400); await m.wait('night_play');
    T(`${tm} AC-48 bấm Bắt đầu → nhạc phát`, await m.ev('HTDC_APP.SOUND.playing()') > 0);
    await m.click('#main [data-act=heavy]');
    const t0 = Date.now(); let off = null;
    for (let k = 0; k < 30 && off === null; k++) { if (await m.ev('HTDC_APP.SOUND.playing()') === 0) off = Date.now() - t0; else await sleep(50); }
    T(`${tm} AC-45 "nặng lòng" → âm tắt trong ≤ 1 s (đo ${off} ms)`, off !== null && off <= 1000, off);
    await m.wait('night_heavy'); await sleep(600);
    const reds = await m.ev(`(() => { const out = []; for (const el of document.querySelectorAll('#main *, #main')) { const s = getComputedStyle(el);
      for (const c of [s.color, s.backgroundColor, s.borderTopColor]) { const v = (c.match(/[\\d.]+/g) || []).map(Number); if (v.length >= 3 && (v[3] === undefined || v[3] > 0.1) && v[0] > 150 && v[0] > v[1] * 1.6 && v[0] > v[2] * 1.6) out.push(el.tagName + '.' + el.className + ' ' + c); } } return out.slice(0, 5).join(' | '); })()`);
    T(`${tm} AC-45 màn "nặng lòng" không có màu đỏ, chế độ đêm`, !reds && await m.ev('document.documentElement.dataset.mode') === 'night', reds);
    await m.shot('heavy');
    // AC-48: rời màn → tắt nhạc
    await m.ev("HTDC_APP.go('night')"); await m.wait('night');
    await m.click('#main [data-act=pick][data-id=NIGHT_TOGETHER]'); await m.wait('night_how');
    await m.click('#main [data-act=start]', 400); await m.wait('night_play');
    const on2 = await m.ev('HTDC_APP.SOUND.playing()');
    await m.goHome(); await sleep(1000);
    T(`${tm} AC-48 rời màn bài → tắt nhạc`, on2 > 0 && await m.ev('HTDC_APP.SOUND.playing()') === 0, on2);
    await m.noErr();
  } catch (e) { T(`${tm} chạy hết`, false, e.stack); } finally { await m.close(); }

  /* E3: Đọc cho nhau nghe — người nghe mặc định ngược vai; đổi chip đổi chữ; H3 "hai bạn" (AC-49, 49d) */
  for (const role of ['wife', 'husband', 'solo']) {
    const r = await open('E-read-' + role); const tr = `[E-read-${role}]`;
    const want = { wife: 'anh', husband: 'chị', solo: 'bạn' }[role];
    try {
      await setup(r, { mode: 'local', role, stage: 'start' });
      for (const id of ['NIGHT_HOME', 'NIGHT_WARM_HAND']) {
        await r.go(); await r.wait('home');   // phiên mới: chip người nghe đã đổi được nhớ trong phiên, nên kiểm mặc định ở phiên mới
        await r.ev(`HTDC_APP.resetTo('night')`); await r.wait('night');
        await r.click(`#main [data-act=pick][data-id=${id}]`, 250);
        if (id === 'NIGHT_HOME') await r.dlg(0);
        await r.wait('night_how');
        await r.click('#main input[name=how][value=read]');
        const def = await r.ev("(document.querySelector('[data-act=listener][aria-pressed=true]') || {}).dataset?.v");
        T(`${tr} AC-49d ${id}: chip người nghe mặc định "${want}" (ngược vai chủ máy)`, def === want, def);
        await r.click('#main [data-act=start]'); await r.wait('night_play'); await sleep(300);
        await r.check('M14r ' + id);
        const pl = JSON.parse(await r.ev(`JSON.stringify(HTDC_APP.PC.plan('${id}', { xung: '${want}', nt: 'người thương' }).blocks.map(b => b.text))`));
        const txt = await r.text('.read-aloud');
        T(`${tr} AC-49 ${id}: cả bài hiện cuộn được, đúng xưng hô người nghe`, pl.every(b => txt.includes(b)) && !/\{xung\}|\{Xung\}|\{nt\}/.test(txt), txt.slice(0, 120));
        const st = JSON.parse(await r.ev(`JSON.stringify((() => { const p = document.querySelector('.read-aloud p'), m = document.querySelector('.read-aloud .pause-mark'); const ms = m ? getComputedStyle(m) : null;
          return { fs: parseFloat(getComputedStyle(p).fontSize), it: ms && ms.fontStyle, op: ms ? parseFloat(ms.opacity) : 1, col: ms && ms.color, pcol: getComputedStyle(p).color }; })())`));
        T(`${tr} AC-49 chữ ≥ 20 px, dấu dừng in nghiêng mờ`, st.fs >= 20 && st.it === 'italic' && (st.op < 1 || st.col !== st.pcol), JSON.stringify(st));
        T(`${tr} AC-49 không hẹn giờ tự chạy (không nút ⏸, không thanh tiến độ)`, !(await r.has('#main [data-act=pp]')) && !(await r.has('#main .reader-progress')));
        const other = want === 'anh' ? 'chị' : 'anh';
        await r.click(`#main [data-act=listener][data-v="${other}"]`);
        const pl2 = JSON.parse(await r.ev(`JSON.stringify(HTDC_APP.PC.plan('${id}', { xung: '${other}', nt: 'người thương' }).blocks.map(b => b.text))`));
        const txt2 = await r.text('.read-aloud');
        T(`${tr} AC-49d ${id}: đổi chip → chữ bài đổi xưng hô ngay ("${other}"), xưng hô app không đổi`, pl2.every(b => txt2.includes(b)) && txt2 !== txt && await r.ev('HTDC_APP.xung()') === XUNG[role], txt2.slice(0, 80));
        T(`${tr} AC-49c Đọc cho nhau nghe ở chế độ đêm dù máy sáng`, await r.ev('document.documentElement.dataset.mode') === 'night');
        await r.click('#main [data-act=readDone]');
        T(`${tr} "Xong bài" → check-out một chạm`, await r.has('.night-end'));
      }
      await r.ev("HTDC_APP.resetTo('night')"); await r.wait('night');
      await r.click('#main [data-act=pick][data-id=NIGHT_TOGETHER]'); await r.wait('night_how');
      await r.click('#main input[name=how][value=read]');
      T(`${tr} AC-49d H3: không chip người nghe (cố định "hai bạn")`, !(await r.has('#main [data-act=listener]')));
      await r.click('#main [data-act=start]'); await r.wait('night_play');
      T(`${tr} AC-49d H3 đọc cho nhau nghe xưng "hai bạn"`, /hai bạn/i.test(await r.text('.read-aloud')) && !(await r.has('#main [data-act=listener]')));
      await r.noErr();
    } catch (e) { T(`${tr} chạy hết`, false, e.stack); } finally { await r.close(); }
  }
}

/* =====================================================================
   F. Dữ liệu của mình (AC-13, 18, 19, 20, 23, 24)
   ===================================================================== */
async function scenarioF() {
  const x = await open('F-data', { shots: true }); const tg = '[F]';
  try {
    await setup(x, { mode: 'local', writing: false, role: 'wife', stage: 'waiting' });
    // AC-13: lưu chữ tắt → không có chữ
    await x.checkin({ level: 6, emotions: ['lo_lang'], ctx: ['waiting'], note: 'ghi chú riêng' }); await x.wait('suggest');
    let r = JSON.parse(await x.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'stop'})[0])"));
    T(`${tg} AC-13 lưu hành trình bật, chữ tắt: bản ghi có mức, thẻ, tình huống, không có chữ`, r.before === 6 && JSON.stringify(r.emotions) === '["lo_lang"]' && JSON.stringify(r.contexts) === '["waiting"]' && !('note' in r), JSON.stringify(r));
    await x.click('#sg [data-go=player]'); await x.wait('player'); await x.click('#main [data-act=plDone]'); await x.wait('checkout');
    await x.click('#co [data-dot="7"]'); await x.click('#main [data-fit=fit]'); await x.click('#main [data-act=coDone]'); await x.wait('done');
    // Bật chữ ở M18, viết, rồi tắt → hộp thoại (AC-24)
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
    await x.click('#main [data-act=swWriting]', 250);
    T(`${tg} M18 bật "Lưu cả chữ tự viết"`, await x.ev('HTDC_APP.S.consent().writing') === true);
    await x.checkin({ level: 6, note: 'chữ thứ nhất' }); await x.wait('suggest');
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
    await x.click('#main [data-act=swWriting]', 250);
    T(`${tg} AC-24 tắt chữ → hộp thoại, focus mặc định "Xóa luôn chữ đã lưu"`, /Xóa luôn chữ đã lưu/.test(await x.focusData()), await x.focusData());
    await x.shot('dlg-writing');
    await x.dlg(1);
    T(`${tg} AC-24 "Giữ chữ cũ" → chữ cũ còn`, JSON.stringify(await x.dbDump()).includes('chữ thứ nhất'));
    await x.checkin({ level: 6, note: 'chữ thứ hai' }); await x.wait('suggest'); await sleep(200);
    T(`${tg} AC-24 "Giữ chữ cũ" → chữ mới không lưu`, !JSON.stringify(await x.dbDump()).includes('chữ thứ hai'));
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
    await x.click('#main [data-act=swWriting]', 250); await sleep(150);   // bật lại
    await x.click('#main [data-act=swWriting]', 250); await x.dlg(0); await sleep(300);
    T(`${tg} AC-24 "Xóa luôn chữ đã lưu" → không bản ghi nào còn chữ (DB)`, (await x.dbDump()).journal.every(j => !('note' in j) && !('texts' in j)), JSON.stringify((await x.dbDump()).journal.filter(j => j.note)));
    // AC-18 xuất
    await x.click('#main [data-act=dlJson]', 300); await x.click('#main [data-act=dlCsv]', 300);
    const files = await x.blobs();
    const js = files.find(f => /\.json$/.test(f.name)), csv = files.find(f => /\.csv$/.test(f.name));
    T(`${tg} L-2 tên tệp "du-lieu-cua-minh-YYYY-MM-DD.json" / "du-lieu-cua-minh-dung-lai-….csv" (không tên app); ngày theo giờ máy`, js && csv && js.name === 'du-lieu-cua-minh-2026-11-10.json' && csv.name === 'du-lieu-cua-minh-dung-lai-2026-11-10.csv', files.map(f => f.name).join(', '));
    const J = JSON.parse(js.text), db = await x.dbDump();
    T(`${tg} AC-18 JSON chứa mọi bản ghi journal của htdc_v1_db + prefs vai/giai đoạn + đồng ý`, J.journal.length === db.journal.length && J.prefs.role === 'wife' && J.prefs.stage && J.prefs.stage.code === 'waiting' && J.consent && J.consent.journey === true && J.app === 'hanh-trinh-don-con',
      `JSON ${J.journal.length} / DB ${db.journal.length} · ${JSON.stringify(J.prefs)}`);
    const head = csv.text.split(/\r\n/)[0];
    T(`${tg} AC-18 CSV có BOM + cột ngày, giờ, giai đoạn, mức trước, thẻ, (tình huống), bài, mức sau, phù hợp`, csv.bom && ['Ngày', 'Giờ', 'Giai đoạn', 'Mức trước', 'Thẻ cảm xúc', 'Tình huống', 'Bài', 'Mức sau', 'Phù hợp'].every(h => head.includes(h)), head);
    T(`${tg} AC-18 CSV có dòng mức trước 6 → sau 7, phù hợp`, csv.text.split(/\r\n/).some(l => /"6"|,6,/.test(l) && /"7"|,7,/.test(l) && /Phù hợp/i.test(l)), csv.text.slice(0, 400));
    T(`${tg} AC-23 tệp xuất không có cờ / câu trả lời an toàn`, !/self_harm|not_alone|safety_q|"flags"|gateAnswer/.test(js.text));
    // AC-19 xóa một mục bấm 2 lần. T-Q3 (A2): M18 không còn danh sách gọn, có link sang M17 (tech design 5.6); xóa ở M17 (.jr-del, data-act=jrDel)
    T(`${tg} AC-19 M18 (A2): link "Xóa từng lần ở Hành trình của mình ›" sang M17, không còn danh sách gọn`, await x.has('#main [data-go=journal]') && !(await x.has('#main .data-del')) && /Xóa từng lần ở Hành trình của mình/.test(await x.text()), await x.text());
    await x.click('#main [data-go=journal]'); await x.wait('journal');
    const n0 = await x.ev('HTDC_APP.S.journal.list().length'), id0 = await x.ev("document.querySelector('#main .jr-del').dataset.id");
    T(`${tg} AC-19 M17: mỗi mục có nút Xóa (data-act=jrDel)`, n0 >= 2 && await x.ev("document.querySelectorAll('#main .jr-del[data-act=jrDel]').length") === n0, n0);
    await x.click('#main .jr-del', 150);
    T(`${tg} AC-19 bấm "Xóa" lần 1 → "Bấm lần nữa để xóa", chưa xóa`, (await x.ev("document.querySelector('#main .jr-del').textContent")) === 'Bấm lần nữa để xóa' && await x.ev('HTDC_APP.S.journal.list().length') === n0);
    await x.click('#main .jr-del', 400);
    T(`${tg} AC-19 lần 2 → xóa (bộ nhớ + DB), toast "Đã xóa."`, await x.ev('HTDC_APP.S.journal.list().length') === n0 - 1 && (await x.text('#toast')).includes('Đã xóa.')
      && !(await x.dbDump()).journal.some(r => r.id === id0) && !(await x.has(`#main .jr-item[data-id="${id0}"]`)), await x.text('#toast'));
    await x.click('#main .jr-del', 150); await sleep(4300);
    T(`${tg} AC-19 bấm 1 lần rồi để yên 4 s → nút trở lại "Xóa", không xóa`, (await x.ev("document.querySelector('#main .jr-del').textContent")) === 'Xóa' && await x.ev('HTDC_APP.S.journal.list().length') === n0 - 1);
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
    // L-3 / AC-24: tắt "Lưu hành trình" = xóa toàn bộ + Không lưu gì (Esc = giữ)
    await x.click('#main [data-act=swJourney]', 250);
    T(`${tg} L-3 tắt "Lưu hành trình" → hộp thoại, focus nút an toàn "Thôi, vẫn lưu"`, /Thôi, vẫn lưu/.test(await x.focusData()), await x.focusData());
    await x.page.key('Escape'); await sleep(250);
    T(`${tg} L-3 Esc → vẫn lưu`, await x.ev('HTDC_APP.S.mode()') === 'local' && !(await x.has('.dlg')));
    await x.click('#main [data-act=swJourney]', 250); await x.dlg(0); await sleep(500);
    T(`${tg} AC-24 xác nhận → dữ liệu xóa như AC-20, chạy "Không lưu gì", khóa app khác còn`, await x.ev('HTDC_APP.S.mode()') === 'none' && (await x.htdcKeys()) === '[]' && !(await x.dbs()).includes('htdc') && await x.foreignOk(), (await x.htdcKeys()) + (await x.dbs()));
    T(`${tg} L-3 vai / giai đoạn giữ trong bộ nhớ`, await x.ev('HTDC_APP.role()') === 'wife' && await x.ev('HTDC_APP.stage()') === 'waiting');
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
    T(`${tg} M18 none: nói rõ không có gì để tải về, có "Lưu trên máy này"`, /Chị đang dùng Không lưu gì, nên không có gì để tải về\./.test(await x.text()) && await x.has('#main [data-go=consent]'));
    // AC-24: M02 bỏ cả hai ô → toast, không ghi khóa nào
    await x.click('#main [data-go=consent]'); await x.wait('consent');
    await x.click('#cs-journey'); await x.click('#main [data-act=consentGo]', 200);
    T(`${tg} AC-24 M02 bỏ cả hai ô + "Đồng ý" → toast "Mình sẽ không lưu gì nhé.", không ghi khóa`, (await x.text('#toast')).includes('Mình sẽ không lưu gì nhé.') && (await x.htdcKeys()) === '[]' && await x.ev('HTDC_APP.S.mode()') === 'none', await x.text('#toast'));
    // AC-14: đổi vai ở M18 → đổi ngay
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
    await x.click('#main [data-go=role]'); await x.wait('role');
    await x.click('#main [data-pick=husband]'); await x.click('#main [data-act=roleNext]', 250);
    T(`${tg} AC-14 đổi vai ở M18 → xưng hô đổi ngay ("anh")`, await x.ev('HTDC_APP.xung()') === 'anh' && /Anh đang dùng Không lưu gì/.test(await x.text()), await x.text());
    // AC-15: Đổi chặng đường 2 chạm
    await x.goHome();
    const k0 = await x.text('#main .know-card').catch(() => '');
    await x.click('#main .stage-line [data-go=stage]'); await x.wait('stage');
    await x.click('#main [data-pick=pause]', 250);
    T(`${tg} AC-15 "Đổi" → chạm giai đoạn → về trang chính (2 chạm), giai đoạn đổi`, await x.wait('home') && await x.ev('HTDC_APP.stage()') === 'pause');
    T(`${tg} AC-15 thẻ "Điều nên biết" đổi theo giai đoạn`, (await x.text('#main .know-card').catch(() => '')) !== k0, k0.slice(0, 60));
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
}

/* =====================================================================
   G. none ↔ local, hai tab
   ===================================================================== */
async function scenarioG() {
  const x = await open('G-carry'); const tg = '[G-carry]';
  try {
    await setup(x, { mode: 'none', role: 'wife', stage: 'waiting' });
    await x.checkin({ level: 7 }); await x.wait('suggest');
    await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
    await x.click('#main [data-go=consent]'); await x.wait('consent'); await x.click('#main [data-act=consentGo]', 300);
    T(`${tg} PRD 8.7 none → local: hỏi mang theo phiên, mặc định (focus) "Không"`, await x.has('.dlg') && /Không/.test(await x.focusData()), await x.focusData());
    await x.dlg(0);
    T(`${tg} chọn "Không" → local, không mang bản ghi stop; vai, giai đoạn vẫn giữ`, await x.wait('mydata') && await x.ev('HTDC_APP.S.mode()') === 'local'
      && !(await x.ev("HTDC_APP.S.journal.list().some(r => r.kind === 'stop')")) && await x.ev('HTDC_APP.role()') === 'wife' && await x.ev('HTDC_APP.stage()') === 'waiting', await x.ev("HTDC_APP.S.journal.list().map(r => r.kind).join()"));
    await x.go();
    T(`${tg} tải lại → vào thẳng trang chính (local)`, await x.scr() === 'home');
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }

  const y = await open('G-carry-yes'); const ty = '[G-carry-yes]';
  try {
    await setup(y, { mode: 'none', role: 'husband', stage: 'cycle' });
    await y.checkin({ level: 7, note: 'chữ trong phiên none' }); await y.wait('suggest');
    await y.ev("HTDC_APP.go('mydata')"); await y.wait('mydata');
    await y.click('#main [data-go=consent]'); await y.wait('consent'); await y.click('#main [data-act=consentGo]', 300);
    await y.dlg(1);
    T(`${ty} "Mang theo" → bản ghi stop + stage của phiên vào DB; chữ (đồng ý chữ tắt) không mang`, await y.wait('mydata') && (await y.dbDump()).journal.some(r => r.kind === 'stop') && !JSON.stringify(await y.dbDump()).includes('chữ trong phiên'));
    await y.noErr();
  } catch (e) { T(`${ty} chạy hết`, false, e.stack); } finally { await y.close(); }

  const a = await open('G-tabs'); const tt = '[G-tabs]';
  try {
    await setup(a, { mode: 'local', role: 'husband', stage: 'waiting' });
    const b = await open('G-tabs-2', { context: a.page.contextId });
    await b.go();
    T(`${tt} tab 2 cùng máy vào thẳng trang chính`, await b.scr() === 'home');
    await b.click('#main .stage-line [data-go=stage]'); await b.wait('stage');
    await b.click('#main [data-pick=cycle]', 300);
    await sleep(2500);
    T(`${tt} tab 1 (trang chính) thấy giai đoạn tab 2 vừa đổi, vẽ lại`, await a.ev('HTDC_APP.stage()') === 'cycle' && /Đang trong chu kỳ|chu kỳ/i.test(await a.text('#main .stage-line')), await a.text('#main .stage-line'));
    await a.click('#main .tile[data-go=pause5]'); await a.wait('pause5'); await a.click('#p5btn'); await a.wait('checkin');
    await a.click('#ck-note'); await a.page.type('đang gõ dở');
    await b.ev("HTDC_APP.S.prefs.set('role', 'wife')"); await sleep(2500);
    T(`${tt} tab 1 đang gõ ở Kể thêm: tab 2 ghi → không vẽ lại, chữ còn nguyên`, await a.scr() === 'checkin' && await a.ev("document.querySelector('#ck-note').value") === 'đang gõ dở');
    await b.ev("HTDC_APP.go('mydata')"); await b.wait('mydata');
    await b.click('#main [data-act=delAll]', 250); await b.dlg(0); await sleep(1500);
    T(`${tt} tab 2 xóa toàn bộ → tab 1 hiện "Tải lại trang" (mọi màn)`, /Tải lại trang/.test(await a.text('#banners')), await a.text('#banners'));
    await a.noErr(); await b.noErr();
    await b.close();
  } catch (e) { T(`${tt} chạy hết`, false, e.stack); } finally { await a.close(); }
}

/* =====================================================================
   H. Sự kiện store giả lập: quota, unsaved, corrupt, versionTooNew (tech design 5.5, UX L13)
   ===================================================================== */
async function scenarioH() {
  const ESTIMATE = "try { Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: () => Promise.resolve({ usage: 90, quota: 100 }), persist: () => Promise.resolve(false), persisted: () => Promise.resolve(false) } }); } catch (e) {}";
  const q = await open('H-quotaWarn', { preInit: ESTIMATE }); const t1 = '[H-quotaWarn]';
  try {
    await setup(q, { mode: 'local', role: 'wife', stage: 'cycle' });
    await q.go(); await sleep(300);
    T(`${t1} chỗ lưu ≥ 80 % → thẻ L13 "Chỗ lưu trên máy sắp đầy…" ở trang chính, role=alert, có link Dữ liệu`, /Chỗ lưu trên máy sắp đầy/.test(await q.text('#banners')) && await q.has('#banners [role=alert] [data-go=mydata]'), await q.text('#banners'));
    await q.click('#main .tile[data-go=pause5]'); await q.wait('pause5');
    T(`${t1} L13 chỉ ở M05, M18 (không ở M06)`, !/sắp đầy/.test(await q.text('#banners')));
    await q.goHome(); await q.click('#banners [data-act=closeStore]');
    T(`${t1} đóng thẻ L13 được`, !/sắp đầy/.test(await q.text('#banners')));
    await q.noErr();
  } catch (e) { T(`${t1} chạy hết`, false, e.stack); } finally { await q.close(); }

  const FAILPUT = name => `(() => { const p = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...a) { if (window.__failPut) throw new DOMException('giả lập', '${name}'); return p.apply(this, a); }; })();`;
  for (const [name, want, label] of [['QuotaExceededError', /Máy đã đầy chỗ lưu/, 'quota (đầy)'], ['DataError', /Lần này mình chưa lưu được vào máy/, 'unsaved']]) {
    const u = await open('H-' + name, { preInit: FAILPUT(name) }); const tu = `[H-${label}]`;
    try {
      await setup(u, { mode: 'local', role: 'solo', stage: 'cycle' });
      await u.ev('window.__failPut = true');
      await u.checkin({ level: 7 });
      T(`${tu} ghi lỗi giữa lượt → app vẫn chạy tiếp tới M09`, await u.wait('suggest'));
      await u.goHome();
      T(`${tu} trang chính hiện thẻ L13 đúng câu`, want.test(await u.text('#banners')), await u.text('#banners'));
      await u.ev('window.__failPut = false');
      await u.noErr(label + ' ', /giả lập|QuotaExceeded|DataError/);
    } catch (e) { T(`${tu} chạy hết`, false, e.stack); } finally { await u.close(); }
  }

  const c = await open('H-corrupt'); const tc = '[H-corrupt]';
  try {
    await setup(c, { mode: 'local', role: 'wife', stage: 'cycle' });
    await c.ev(`new Promise(res => { const r = indexedDB.open('htdc_v1_db'); r.onsuccess = () => { const d = r.result, t = d.transaction('journal', 'readwrite');
      t.objectStore('journal').put({ v: 1, kind: 'stop', id: 'hong0000000000000001', at: 'không phải số' }); t.oncomplete = () => { d.close(); res(1); }; }; })`);
    await c.go(); await sleep(300);
    T(`${tc} bản ghi hỏng → thẻ "Có một phần dữ liệu cũ mình không đọc được…" ở trang chính`, /không đọc được nên đã bỏ qua/.test(await c.text('#banners')), await c.text('#banners'));
    await c.checkin({ level: 7 }); await c.wait('suggest'); await sleep(200);
    T(`${tc} bản ghi hỏng vẫn nằm nguyên trong DB (không ghi đè)`, (await c.dbDump()).journal.some(r => r.id === 'hong0000000000000001' && r.at === 'không phải số'));
    await c.ev("HTDC_APP.go('mydata')"); await c.wait('mydata');
    T(`${tc} M18 có "Xuất bản sao nguyên văn"`, await c.has('#main [data-act=dlRaw]'));
    await c.click('#main [data-act=dlRaw]', 300);
    const raw = (await c.blobs()).find(f => /ban-sao-nguyen-van/.test(f.name));
    T(`${tc} bản sao nguyên văn chứa cả bản ghi hỏng`, raw && raw.text.includes('hong0000000000000001'), raw && raw.name);
    // khóa đánh dấu hỏng
    await c.ev("localStorage.setItem('htdc_v1_device', '{hỏng')"); await c.go(); await sleep(300);
    T(`${tc} khóa đánh dấu hỏng → vẫn mở, báo L13, KHÔNG ghi đè khóa`, /không đọc được/.test(await c.text('#banners')) && await c.ev("localStorage.getItem('htdc_v1_device')") === '{hỏng', await c.text('#banners'));
    await c.noErr();
  } catch (e) { T(`${tc} chạy hết`, false, e.stack); } finally { await c.close(); }

  const v = await open('H-newer'); const tv = '[H-newer]';
  try {
    await setup(v, { mode: 'local', role: 'wife', stage: 'cycle' });
    const dev = JSON.stringify({ schema: 99, consent: { journey: true, writing: false, version: '9', at: 1 } });
    await v.ev(`localStorage.setItem('htdc_v1_device', ${JSON.stringify(dev)})`); await v.go(); await sleep(300);
    T(`${tv} DB do bản app mới hơn tạo → chạy Không lưu gì, thẻ "bản app mới hơn", không ghi đè khóa`, await v.ev('HTDC_APP.S.mode()') === 'none'
      && /bản app mới hơn/.test(await v.text('#banners')) && await v.ev("localStorage.getItem('htdc_v1_device')") === dev, (await v.text('#banners')) + ' · ' + await v.ev('HTDC_APP.S.mode()'));
    await v.noErr();
  } catch (e) { T(`${tv} chạy hết`, false, e.stack); } finally { await v.close(); }
}

/* =====================================================================
   I. file://, hiệu năng, giảm chuyển động, tương phản, cỡ màn, mạng
   ===================================================================== */
/* Đo tương phản chữ (WCAG 2.1) trên mọi phần tử có chữ đang hiện; nền = trộn các lớp nền tổ tiên (bỏ ảnh nền) */
const CONTRAST = `(() => {
  const P = c => { const v = (c.match(/[\\d.]+/g) || []).map(Number); return { r: v[0] || 0, g: v[1] || 0, b: v[2] || 0, a: v.length > 3 ? v[3] : 1 }; };
  const mix = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const L = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Nền: trộn các lớp nền tổ tiên tới lớp đục đầu tiên; lớp gradient → mỗi điểm màu là một nền ứng viên (lấy tỉ lệ thấp nhất)
  const bgsOf = el => { const layers = []; let grad = null;
    for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e);
      if (/gradient/.test(s.backgroundImage)) { grad = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(P).filter(c => c.a > 0); if (grad.length) break; grad = null; }
      const c = P(s.backgroundColor); if (c.a > 0) layers.push(c); if (c.a >= 1) break; }
    const bases = grad ? grad.map(g => ({ r: g.r, g: g.g, b: g.b, a: 1 })) : [layers.length && layers[layers.length - 1].a >= 1 ? layers.pop() : { r: 255, g: 255, b: 255, a: 1 }];
    return bases.map(b0 => { let bg = b0; for (let i = layers.length - 1; i >= 0; i--) bg = mix(layers[i], bg); return bg; }); };
  const opa = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!['#text'].some(() => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) continue;
    const s = getComputedStyle(el), b = el.getBoundingClientRect();
    if (!b.width || !b.height || s.visibility === 'hidden' || el.closest('[hidden], [aria-hidden=true], .sr-only, .skip-link, [inert]') && !el.closest('.dlg-backdrop')) continue;
    if (el.closest('[inert]') && document.querySelector('.dlg-backdrop')) continue;
    if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') continue;
    const fg = P(s.color); fg.a *= opa(el); const r = Math.min(...bgsOf(el).map(bg => ratio(mix(fg, bg), bg)));
    const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
    if (r < (large ? 3 : 4.5)) out.push((el.tagName + '.' + String(el.className).split(' ')[0]).slice(0, 30) + ' "' + el.textContent.trim().slice(0, 24) + '" ' + r.toFixed(2));
  }
  return out;
})()`;
async function scenarioI() {
  /* I1: file:// (K-10) */
  const f = await open('I-file'); const tf = '[I-file]';
  try {
    await f.go('file://' + path.join(APP_DIR, 'index.html'));
    T(`${tf} file:// → M01`, await f.scr() === 'welcome');
    await f.click('#main [data-act=useNone]'); await f.wait('role'); await f.click('#main [data-act=roleNext]'); await f.wait('stage'); await f.click('#main [data-act=home]');
    await f.checkin({ level: 6, emotions: ['lo_lang'] });
    T(`${f.tag} file:// none: check-in → M09`, await f.wait('suggest'));
    await f.ev("HTDC_APP.go('night')"); await f.wait('night');
    await f.click('#main [data-act=pick][data-id=NIGHT_TOGETHER]'); await f.wait('night_how'); await f.click('#main [data-act=start]');
    T(`${tf} file:// bài đêm chạy`, await f.wait('night_play'));
    await f.ev("HTDC_APP.go('mydata')"); await f.wait('mydata');
    await f.click('#main [data-go=consent]'); await f.wait('consent'); await f.click('#main [data-act=consentGo]', 400);
    if (await f.has('.dlg')) await f.dlg(0);   // hỏi "mang theo phiên" (đang none, đã có bản ghi) → Không
    await sleep(300);
    const mode = await f.ev('HTDC_APP.S.mode()');
    T(`${tf} file:// "Lưu trên máy này" → local, hoặc báo chặn lưu rồi chạy none (không vỡ)`, mode === 'local' || (mode === 'none' && /chặn lưu/.test(await f.text('#toast') + await f.text('#banners'))), mode);
    await f.noErr('', /ditruyenhungvuong|Failed to load resource/);
  } catch (e) { T(`${tf} chạy hết`, false, e.stack); } finally { await f.close(); }

  /* I2: 3.000 bản ghi + 400 ngày, mở tới M05 ≤ 1,5 s ở 4× CPU (11.2) */
  const p = await open('I-perf'); const tp = '[I-perf]';
  try {
    await setup(p, { mode: 'local', role: 'wife', stage: 'waiting' });
    const big = F.big('2026-11-10', 7);
    await p.ev(`new Promise((res, rej) => { const r = indexedDB.open('htdc_v1_db'); r.onsuccess = () => { const d = r.result, t = d.transaction(['journal', 'habits'], 'readwrite');
      const J = ${JSON.stringify(big.journal)}, H = ${JSON.stringify(big.habits)}; J.forEach(x => t.objectStore('journal').put(x)); H.forEach(x => t.objectStore('habits').put(x));
      t.oncomplete = () => { d.close(); res(1); }; t.onerror = () => rej(t.error); }; })`);
    await p.page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const times = [];
    for (let k = 0; k < 3; k++) { await p.go(); for (let i = 0; i < 100 && (await p.ev('window.__homeAt')) === null; i++) await sleep(50); times.push(await p.ev('window.__homeAt')); }
    await p.page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const n = await p.ev('HTDC_APP.S.journal.list().length');
    const best = Math.min(...times.filter(t => t !== null)), med = times.slice().sort((a, b) => a - b)[1];
    T(`${tp} 11.2 mở app tới M05 với 3.000 bản ghi + 400 ngày, 4× CPU ≤ 1,5 s (3 lần: ${times.map(t => Math.round(t)).join(' / ')} ms)`, med !== null && med <= 1500, times.join(','));
    T(`${tp} đọc đủ 3.000 bản ghi fixture + bản ghi của lượt, không bản nào bị coi là hỏng`, n >= 3000 && !/không đọc được/.test(await p.text('#banners')), n + ' · ' + await p.text('#banners'));
    console.log(`      [I-perf] tốt nhất ${Math.round(best)} ms, trung vị ${Math.round(med)} ms`);
    await p.ev("HTDC_APP.go('mydata')"); await p.wait('mydata', 5000);
    T(`${tp} M18 với 3.000 bản ghi: không vẽ danh sách (A2: xóa từng lần ở M17)`, (await p.ev("document.querySelectorAll('#main .data-entry, #main .data-del').length")) === 0);
    await p.noErr();
  } catch (e) { T(`${tp} chạy hết`, false, e.stack); } finally { await p.close(); }

  /* I3: giảm chuyển động (AC-04) */
  const r = await open('I-reduce', { reduce: true }); const tr = '[I-reduce]';
  try {
    await setup(r, { mode: 'none', role: 'wife', stage: 'cycle' });
    const runs = () => r.ev("document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().duration > 50).map(a => (a.animationName || a.constructor.name) + ':' + (a.effect.target && a.effect.target.className)).join(', ')");
    await r.click('#main .tile[data-go=pause5]'); await r.wait('pause5'); await sleep(300);
    T(`${tr} AC-04 M06: không vòng tròn co giãn (orb .still, không animation chạy)`, await r.has('#main .st-orb.still') && !(await runs()), await runs());
    await r.ev("HTDC_APP.go('player', {ex:'BREATHE_46', origin:'library'})"); await r.wait('player'); await sleep(300);
    const sc = await r.ev("(() => { const o = document.querySelector('#pl-body .pl-orb, #pl-body .orb'); return o ? getComputedStyle(o).transform : 'none'; })()");
    T(`${tr} AC-04 B2: không animation chạy`, !(await runs()), await runs() + ' ' + sc);
    await r.ev("HTDC_APP.go('player', {ex:'THOUGHT_CLOUD', origin:'library'})"); await r.wait('player');
    await r.click('#cl-t'); await r.page.type('lần này lại không được'); await r.click('#cl-name', 200); await r.click('#cl-fly', 200);
    T(`${tr} AC-04 B5: mây mờ dần (fade), không trôi`, await r.ev("document.querySelector('#cl-c').classList.contains('fade') && !document.querySelector('#cl-c').classList.contains('fly')"));
    await r.ev("HTDC_APP.go('night')"); await r.wait('night'); await r.click('#main [data-act=pick][data-id=NIGHT_TOGETHER]'); await r.wait('night_how');
    await r.click('#main [data-act=start]'); await r.wait('night_play'); await sleep(400);
    T(`${tr} AC-04 M14 khối chữ không animation`, !(await runs()), await runs());
    await r.noErr();
  } catch (e) { T(`${tr} chạy hết`, false, e.stack); } finally { await r.close(); }

  /* I4: tương phản sáng + đêm (AC-08, AC-49c), chờ ≥ 0,5 s sau đổi màu */
  for (const dark of [false, true]) {
    const c = await open('I-contrast-' + (dark ? 'dem' : 'sang'), { dark }); const tc = `[I-contrast-${dark ? 'máy tối' : 'máy sáng'}]`;
    try {
      await setup(c, { mode: 'local', role: 'wife', stage: 'waiting' });
      const bad = [], badNight = [], modeBad = [], white = [];
      const pages = [['home'], ['checkin', null, 'pause5'], ['support'], ['urgent', { from: 'support' }], ['mydata'], ['library', { from: 'home' }], ['player', { ex: 'BREATHE_46', origin: 'library' }],
        ['result'], ['loss_soft'], ['about'], ['never'], ['night'], ['night_how', { id: 'NIGHT_TOGETHER' }], ['night_play', { id: 'NIGHT_TOGETHER', how: 'pace', music: null }],
        ['night_play', { id: 'NIGHT_TOGETHER', how: 'read', music: null }], ['night_heavy', { from: 'NIGHT_HOME' }]];
      for (const [k, prm] of pages) {
        await c.ev(`HTDC_APP.go(${JSON.stringify(k)}, ${JSON.stringify(prm || {})})`); await sleep(650);
        const o = await c.ev(CONTRAST);
        if (o.length) (/^night/.test(k) ? badNight : bad).push(k + (prm && prm.how ? ':' + prm.how : '') + ' → ' + o.slice(0, 4).join(' ; '));
        const m = await c.ev("document.documentElement.dataset.mode || ''");
        const night = /^night/.test(k);
        if ((dark || night) && m !== 'night') modeBad.push(k);
        if (!dark && !night && m === 'night') modeBad.push(k + '(sáng mà tối)');
        if (dark || night) { const bg = await c.ev("getComputedStyle(document.body).backgroundColor"); const v = (bg.match(/\d+/g) || []).map(Number); if (v[0] > 200 && v[1] > 200 && v[2] > 200) white.push(k + ' ' + bg); }
      }
      // Hộp M13b, M13a trên nền đêm
      await c.ev("HTDC_APP.go('night')"); await c.wait('night'); await c.click('#main [data-act=pick][data-id=NIGHT_HOME_SHORT]', 650);
      const od = await c.ev(CONTRAST); if (od.length) badNight.push('hộp M13b → ' + od.slice(0, 4).join(' ; '));
      await c.dlg(3);
      if (dark) T(`${tc} AC-08 máy tối: tương phản chữ ≥ 4,5:1 (chữ lớn ≥ 3:1) trên ${pages.length} màn + hộp M13b`, !bad.length && !badNight.length, bad.concat(badNight).join(' || '));
      else {
        T(`${tc} AC-49c màn đêm (M13, M13c, M14, M14r, L12, hộp M13b) dù máy sáng: tương phản chữ ≥ 4,5:1`, !badNight.length, badNight.join(' || '));
        T(`${tc} UX 13 checklist / WCAG 1.4.3 màn ngày chế độ sáng: tương phản chữ ≥ 4,5:1 (chữ lớn ≥ 3:1)`, !bad.length, bad.join(' || '));
      }
      T(`${tc} ${dark ? 'AC-08 máy tối → mọi màn tối' : 'AC-08/49c máy sáng: chỉ màn đêm tối, màn ngày sáng'}`, !modeBad.length, modeBad.join(','));
      T(`${tc} AC-49c không nền trắng ở chế độ đêm`, !white.length, white.join(','));
      await c.noErr();
    } catch (e) { T(`${tc} chạy hết`, false, e.stack); } finally { await c.close(); }
  }

  /* I5: không cuộn ngang 320 / 375 / 768 trên mọi màn A1 */
  for (const w of [320, 375, 768]) {
    const z = await open('I-w' + w, { width: w, height: w === 768 ? 1024 : 700 }); const tz = `[I-w${w}]`;
    try {
      await setup(z, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      const keys = ['welcome', 'consent', 'role', 'stage', 'home', 'pause5', 'checkin', 'safety_q', 'suggest', 'library', 'checkout', 'done', 'support', 'urgent', 'about', 'result', 'loss_soft', 'good_news', 'mydata', 'never', 'night', 'night_heavy'];
      const P = { player: ['PAUSE5', 'BREATHE_46', 'GROUND_54321', 'RELEASE', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN', 'CALM_SOUND', 'WARM_HAND_DAY'].map(ex => ({ ex, origin: 'library' })),
        night_how: ['NIGHT_HOME', 'NIGHT_TOGETHER'].map(id => ({ id })), night_play: [{ id: 'NIGHT_HOME', how: 'pace', music: null }, { id: 'NIGHT_HOME', how: 'read', music: null }] };
      const list = keys.map(k => [k, {}]).concat(...Object.entries(P).map(([k, a]) => a.map(p2 => [k, p2])));
      const bad = [];
      for (const [k, p2] of list) {
        await z.ev(`HTDC_APP.go(${JSON.stringify(k)}, ${JSON.stringify(p2)})`); await sleep(200);
        const o = JSON.parse(await z.ev("JSON.stringify({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over: [...document.querySelectorAll('#header *, #main *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > document.documentElement.clientWidth + 1; }).slice(0, 3).map(e => e.tagName + '.' + e.className).join(' ') })"));
        if (o.sw > o.cw || o.over) bad.push(`${k}${p2.ex || p2.id ? ':' + (p2.ex || p2.id) : ''}${p2.how ? ':' + p2.how : ''} ${o.sw}/${o.cw} ${o.over}`);
        if (w === 320 && ['checkin', 'home', 'night_play'].includes(k)) await z.page.screenshot(path.join(SHOTS, `w320-${k}${p2.how ? '-' + p2.how : ''}.png`)).catch(() => {});
      }
      T(`${tz} AC-03 ${list.length} màn không cuộn ngang`, !bad.length, bad.join(' | '));
      await z.noErr();
    } catch (e) { T(`${tz} chạy hết`, false, e.stack); } finally { await z.close(); }
  }

  /* I6: mạng (AC-09, K-3): config THẬT (ASSET_BASE github.io), chặn ảnh → emoji + tên */
  const n = await open('I-net'); const tn = '[I-net]';
  try {
    await setup(n, { mode: 'local', role: 'wife', stage: 'waiting', url: srvReal.url });
    await n.click('#main .tile[data-go=pause5]'); await n.wait('pause5'); await n.click('#p5btn'); await n.wait('checkin'); await sleep(800);
    const cards = JSON.parse(await n.ev("JSON.stringify([...document.querySelectorAll('#main .capy-card')].map(c => ({ c: c.dataset.capy, emoji: !!c.querySelector('.capy-emoji'), img: !!c.querySelector('img'), name: !c.querySelector('.capy-name').hidden })))"));
    T(`${tn} ảnh capybara bị chặn → 11 thẻ đều emoji + tên (AC-38)`, cards.length === 11 && cards.every(c => c.emoji && !c.img && c.name), JSON.stringify(cards.filter(c => !(c.emoji && c.name))));
    await n.click('#main [data-dot="5"]'); await n.click('#main [data-capy=lo_lang]'); await n.click('#main [data-act=ckNext]'); await n.wait('suggest');
    await n.click('#sg [data-go=player]'); await n.wait('player');
    await n.ev("HTDC_APP.go('night')"); await n.wait('night'); await n.click('#main [data-act=pick][data-id=NIGHT_TOGETHER]'); await n.wait('night_how'); await n.click('#main [data-act=start]'); await n.wait('night_play');
    await n.ev("HTDC_APP.go('mydata')"); await n.wait('mydata'); await n.click('#main [data-act=dlJson]', 200);
    const ext = n.requests.filter(u => !u.startsWith(srvReal.url) && !/^(data|blob|about):/.test(u));
    const capy = ext.filter(u => /^https:\/\/ditruyenhungvuong\.github\.io\/checkin-V2\/(vui_ve|dau_kho|lo_lang|tuc_gian|hoang_hot|kho_chiu|met_moi|binh_an|co_don)\.png$/.test(u));
    T(`${tn} AC-09 mọi request chỉ tới server cục bộ, trừ đúng 9 ảnh capybara ASSET_BASE (${capy.length} request ảnh)`, ext.length === capy.length && new Set(capy).size === 9, ext.filter(u => !capy.includes(u)).join(' '));
    const fonts = n.requests.filter(u => /\.woff2?$/.test(u));
    T(`${tn} font tự host (cùng origin)`, fonts.every(u => u.startsWith(srvReal.url)), fonts.join(' '));
    const csp = await n.ev("document.querySelector('meta[http-equiv=Content-Security-Policy]').content");
    T(`${tn} AC-09 CSP có connect-src 'none', worker-src 'none'`, /connect-src 'none'/.test(csp) && /worker-src 'none'/.test(csp), csp);
    T(`${tn} AC-09 không service worker`, await n.ev("navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(l => l.length === 0) : true"));
    await n.noErr('', /ditruyenhungvuong/);
    const fx = await n.ev("Promise.all([fetch('https://example.com/').then(() => 'đi', () => 'chặn'), fetch('/index.html').then(() => 'đi', () => 'chặn')]).then(a => a.join(','))");
    T(`${tn} AC-09 fetch ra ngoài và cùng origin đều bị CSP chặn (vi phạm CSP ở đây là mong đợi)`, fx === 'chặn,chặn', fx);
  } catch (e) { T(`${tn} chạy hết`, false, e.stack); } finally { await n.close(); }

  /* I7: ảnh 404 → emoji + tên (AC-38 "ảnh lỗi") */
  const e4 = await open('I-404'); const t4 = '[I-404]';
  try {
    await setup(e4, { mode: 'none', role: 'wife', stage: 'waiting', url: srv404.url });
    await e4.click('#main .tile[data-go=pause5]'); await e4.wait('pause5'); await e4.click('#p5btn'); await e4.wait('checkin'); await sleep(600);
    T(`${t4} ảnh 404 → emoji kèm tên`, await e4.ev("[...document.querySelectorAll('#main .capy-card')].every(c => c.querySelector('.capy-emoji') && !c.querySelector('img') && !c.querySelector('.capy-name').hidden)"));
    await e4.noErr('', /404|Failed to load resource/);
  } catch (e) { T(`${t4} chạy hết`, false, e.stack); } finally { await e4.close(); }
}

/* =====================================================================
   J. Nghi vấn: header "lơ lửng" giữa trang ở ảnh chụp cả trang (M07, M13)
   ===================================================================== */
async function scenarioJ() {
  const x = await open('J-header', { shots: true }); const tg = '[J-header]';
  try {
    await setup(x, { mode: 'local', role: 'wife', stage: 'waiting' });
    await x.click('#main .tile[data-go=pause5]'); await x.wait('pause5'); await x.click('#p5btn'); await x.wait('checkin');
    const hdr = () => x.ev("JSON.stringify((() => { const b = document.querySelector('#header').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), docTop: Math.round(b.top + scrollY), scrollY: Math.round(scrollY), pos: getComputedStyle(document.querySelector('#header')).position }; })())").then(JSON.parse);
    const h0 = await hdr();
    await x.ev('scrollTo(0, 700)'); await sleep(200);
    const h1 = await hdr();
    T(`${tg} header sticky: cuộn 700 px → header vẫn dính đỉnh khung nhìn (top 0), vị trí trong tài liệu = scrollY`, h0.pos === 'sticky' && h0.top === 0 && h1.top === 0 && h1.docTop === h1.scrollY, JSON.stringify([h0, h1]));
    await x.page.screenshot(path.join(SHOTS, 'J-M07-khung-nhin-cuon-700.png'));
    await x.page.screenshot(path.join(SHOTS, 'J-M07-ca-trang-cuon-700.png'), true);
    await x.ev('scrollTo(0, 0)'); await sleep(200);
    await x.page.screenshot(path.join(SHOTS, 'J-M07-ca-trang-cuon-0.png'), true);
    // Ảnh cả trang chụp lúc đang cuộn: dải header nằm ở y = scrollY trong ảnh → đúng hiện tượng ảnh của architect (page.click cuộn phần tử vào giữa)
    const rows = await x.ev(`(async () => { scrollTo(0, 700); await new Promise(r => setTimeout(r, 150)); const el = document.elementFromPoint(187, 20); const r = el && el.closest('#header') ? 'header' : el && el.tagName; scrollTo(0, 0); return r; })()`);
    T(`${tg} ở khung nhìn thật, điểm (187, 20) khi cuộn là header (dính đỉnh), không phải giữa trang`, rows === 'header', rows);
    // Header che phần tử đang focus khi đi bằng bàn phím? (WCAG 2.4.11) — Tab xuôi rồi Shift+Tab ngược trên M07
    await x.ev('scrollTo(0, document.body.scrollHeight)'); await sleep(150);
    await x.ev("document.querySelector('[data-act=ckLib]').focus()");
    const hidden = [];
    for (let k = 0; k < 40; k++) {
      await x.page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      await x.page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      await sleep(40);
      const r = JSON.parse(await x.ev(`JSON.stringify((() => { const a = document.activeElement, hb = document.querySelector('#header').getBoundingClientRect().bottom; if (!a || a === document.body || a.closest('#header')) return null;
        const b = a.getBoundingClientRect(); return { id: (a.dataset.capy || a.dataset.dot || a.dataset.ctx || a.id || a.className).slice(0, 20), top: Math.round(b.top), bottom: Math.round(b.bottom), hb: Math.round(hb) }; })())`));
      if (r && r.bottom <= r.hb + 1) { if (!hidden.some(h => !h.startsWith('một phần'))) await x.page.screenshot(path.join(SHOTS, 'J-M07-focus-bi-header-che.png')); hidden.push(r.id + ' (bottom ' + r.bottom + ' ≤ header ' + r.hb + ')'); }
      else if (r && r.top < r.hb - 1) hidden.push('một phần: ' + r.id + ' (top ' + r.top + ' < header ' + r.hb + ')');
    }
    T(`${tg} WCAG 2.4.11: Shift+Tab ngược trên M07 — phần tử đang focus không bị header dính che`, !hidden.length, hidden.slice(0, 6).join(' | '));
    await x.page.screenshot(path.join(SHOTS, 'J-M07-shift-tab.png'));
    // Hộp thoại trên M13 sau khi cuộn: hộp ở trên header, header inert, điểm giữa tiêu đề hộp thuộc hộp
    await x.ev("HTDC_APP.go('night')"); await x.wait('night'); await sleep(500);
    await x.ev('scrollTo(0, 400)'); await sleep(100);
    await x.click('#main [data-act=pick][data-id=NIGHT_HOME_SHORT]', 300);
    const d = JSON.parse(await x.ev(`JSON.stringify((() => { const t = document.querySelector('.dlg-title').getBoundingClientRect(), dl = document.querySelector('.dlg').getBoundingClientRect(), hb = document.querySelector('#header').getBoundingClientRect();
      const at = document.elementFromPoint(t.left + 10, t.top + t.height / 2), atHdr = document.elementFromPoint(20, hb.top + hb.height / 2);
      return { inDlg: !!(at && at.closest('.dlg')), hdrCovered: !(atHdr && atHdr.closest('#header')), inert: document.querySelector('#header').inert, dlgTop: Math.round(dl.top), dlgBottom: Math.round(dl.bottom), vh: innerHeight,
        zH: getComputedStyle(document.querySelector('#header')).zIndex, zD: getComputedStyle(document.querySelector('.dlg-backdrop')).zIndex }; })())`));
    T(`${tg} hộp M13b nằm trên header (z ${d.zD} > ${d.zH}), header inert + bị nền hộp phủ, hộp trọn trong khung nhìn`, d.inDlg && d.hdrCovered && d.inert && d.dlgTop >= 0 && d.dlgBottom <= d.vh, JSON.stringify(d));
    await x.page.screenshot(path.join(SHOTS, 'J-M13-hop-cong-hoi.png'));
    await x.dlg(3);
    await x.ev('scrollTo(0, 0)'); await sleep(100);
    await x.page.screenshot(path.join(SHOTS, 'J-M13-ca-trang.png'), true);
    console.log('      [J] ảnh: ' + ['J-M07-khung-nhin-cuon-700', 'J-M07-ca-trang-cuon-700', 'J-M07-ca-trang-cuon-0', 'J-M07-focus-bi-header-che', 'J-M13-hop-cong-hoi', 'J-M13-ca-trang'].map(s => path.join(SHOTS, s + '.png')).join(' '));
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
}

/* =====================================================================
   K. ALLOW_DRAFT_CONTENT = false (AC-34, AC-34b)
   ===================================================================== */
async function scenarioK() {
  const NODRAFT = "Object.defineProperty(window, 'HTDC_CONFIG', { configurable: true, set(v) { v.ALLOW_DRAFT_CONTENT = false; Object.defineProperty(window, 'HTDC_CONFIG', { value: v, writable: true, configurable: true }); } });";
  const x = await open('K-nodraft', { preInit: NODRAFT }); const tg = '[K-nodraft]';
  try {
    await setup(x, { mode: 'none', role: 'wife', stage: 'cycle' });
    T(`${tg} cấu hình ALLOW_DRAFT_CONTENT = false đã áp`, await x.ev('HTDC_APP.C.ALLOW_DRAFT_CONTENT') === false);
    await x.ev("HTDC_APP.go('library', {from:'home'})"); await x.wait('library');
    T(`${tg} AC-34 không còn bài nào (mọi bài draft) → thư viện có lời giải thích, không trống trơn`, (await x.ev("document.querySelectorAll('#main .st-ex').length")) === 0 && (await x.text()).replace(/\s+/g, ' ').length > 40, await x.text());
    await x.ev("HTDC_APP.go('night')"); await x.wait('night');
    T(`${tg} AC-34 M13 không bài draft → câu giải thích`, (await x.ev("document.querySelectorAll('#main .night-card').length")) === 0 && /notice/.test(await x.ev("document.querySelector('#main .notice:not(.night-promise)') ? 'notice' : ''")), await x.text());
    const s = await x.checkin({ level: 2, note: 'đau bụng dữ dội' });
    T(`${tg} AC-34b M08 vẫn hiện đủ chữ và nút, kèm dòng bản thử nghiệm`, s === 'safety_q' && (await x.ev("document.querySelectorAll('#main [data-act^=sq]').length")) === 3 && /Bản thử nghiệm/.test(await x.text()), await x.text());
    await x.click('#main [data-act=sqNo]'); await x.wait('suggest');
    T(`${tg} AC-34b M09: thẻ "không một mình" + "Chuyện này cần bác sĩ" (115) vẫn hiện đủ, kèm dòng bản thử nghiệm`, await x.has('#sg .human-card [data-go=support]') && await x.has('#sg .body-card a[href="tel:115"]') && /Bản thử nghiệm/.test(await x.text()), await x.text('#sg'));
    await x.ev("HTDC_APP.go('support')"); await x.wait('support');
    T(`${tg} AC-34b M19 vẫn đủ (115, kênh trống), kèm dòng bản thử nghiệm`, await x.has('#main a[href="tel:115"]') && /Cơ sở chưa công bố/.test(await x.text()) && /Bản thử nghiệm/.test(await x.text()));
    await x.ev("HTDC_APP.go('urgent', {from:'support'})"); await x.wait('urgent');
    T(`${tg} AC-34b M20 vẫn đủ (115, nút an toàn), kèm dòng bản thử nghiệm`, await x.has('#main a[href="tel:115"]') && await x.has('#main [data-act=urgentSafe]') && /Bản thử nghiệm/.test(await x.text()));
    await x.goHome();
    T(`${tg} AC-34 thẻ "Điều nên biết" draft bị ẩn`, !(await x.has('#main .know-card')));
    // T-Q3 (A2): C1–C4, câu mẫu Gửi lời đều draft → không hiện; M15 không trống trơn (như thư viện, AC-34)
    await x.ev("HTDC_APP.go('together')"); await x.wait('together');
    const kc = await x.ev("document.querySelectorAll('#main [data-act=tgStart], #main [data-go=together_breathe], #main [data-go=together_talk], #main [data-go=send_words]').length");
    T(`${tg} AC-34 (A2) M15: bài Hai ta draft không hiện`, kc === 0, kc);
    T(`${tg} AC-34 (A2) M15 không còn bài nào → có lời giải thích (không trống trơn)`, kc > 0 || await x.has('#main .notice') || /chưa (có|được duyệt)|đang chờ duyệt/i.test(await x.text()), await x.text());
    await x.noErr();
  } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
}

/* =====================================================================
   L. Lượt 3 (sau code review A1, 10/11/2026): bỏ ngang / sửa giữa chừng / quay lại.
   Theo đúng tình huống của docs/qa/hanh-trinh-don-con-code-review-a1.md (C-1, C-2, C-3, N-1, n-1, n-2, n-3, G-4)
   cộng các đường cùng họ. Mỗi ca kiểm CẢ IndexedDB (dbDump) lẫn màn hình. Quy tắc chung (review): mọi chữ sắp lưu
   hoặc sắp hiện ra phải là đúng chuỗi vừa qua luật an toàn + bảng nhận diện ở lượt bấm đó.
   N-1 (Team Lead chốt): StopRec lưu xuống máy KHÔNG có trường rule; không trường nào để suy ra cờ từ khóa 8.2 / 8.2b.
   ===================================================================== */
// Ghi lại chuỗi màn đã đi qua + số lần bảng nhận diện hiện (để biết "có đi qua M20 / bảng nhận diện không")
const SEEN = `(() => { window.__seen = []; window.__piiN = 0;
  new MutationObserver(() => { const m = document.getElementById('main'), s = m && m.dataset.screen;
    if (s && window.__seen[window.__seen.length - 1] !== s) window.__seen.push(s);
    document.querySelectorAll('.pii-panel').forEach(p => { if (!p.__c) { p.__c = 1; window.__piiN++; } }); })
  .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-screen'] }); })();`;
// Giả lập xóa IndexedDB thất bại (n-3): window.__failDrop = 'error' (onerror) | 'blocked' (không bao giờ xong → hết 5 s)
const FAILDROP = `(() => { const F = IDBFactory.prototype, orig = F.deleteDatabase;
  F.deleteDatabase = function (n) { if (!window.__failDrop) return orig.call(this, n);
    const r = { onsuccess: null, onerror: null, onblocked: null }; window.__dropCalls = (window.__dropCalls || 0) + 1;
    if (window.__failDrop === 'error') setTimeout(() => { if (typeof r.onerror === 'function') r.onerror({ target: r }); }, 20);
    return r; }; })();`;
const BAD = 'Tôi muốn chết. Gọi chồng mình anh Trần Minh Quân 0912345678';
const LEAK = /muốn chết|0912345678|Trần Minh Quân/;
const STOP_KEYS = ['v', 'kind', 'id', 'at', 'day', 'tz', 'origin', 'stage', 'before', 'emotions', 'contexts', 'minutes', 'done', 'after', 'fit', 'note', 'texts'];

async function scenarioL() {
  /* ---- tiện ích dùng chung ---- */
  const retype = async (x, sel, text) => {   // chọn hết chữ trong ô rồi gõ đè (sinh sự kiện input như bàn phím)
    await x.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); })()`);
    await x.page.type(text); await sleep(80);
  };
  const back = async x => { await x.click('#header [data-act=back]', 350); };
  const all = async x => JSON.stringify(await x.dbDump()) + '\n' + await x.ev('JSON.stringify(HTDC_APP.S.journal.list())');
  const seen = x => x.ev('JSON.stringify(window.__seen || [])').then(JSON.parse);
  const resetSeen = x => x.ev('(window.__seen = [], window.__piiN = 0, 1)');
  const shares = x => x.ev('JSON.stringify((window.__share || []).map(s => s.text || s.url || "").concat(window.__clip || []))').then(JSON.parse);
  // Bảng nhận diện còn mở thì bấm "Vẫn giữ" (đúng tình huống review); bảng đã tự đóng khi sửa chữ thì bấm lại nút chính
  const keepOr = async (x, box, fallback) => {
    if (await x.has(box + ' [data-pii=keep]')) { await x.click(box + ' [data-pii=keep]', 350); return 'Vẫn giữ'; }
    await x.click(fallback, 350); return 'bảng đã đóng → bấm ' + fallback;
  };
  const toCheckin = async x => {
    await x.goHome(); await x.click('#main .tile[data-go=pause5]'); await x.wait('pause5');
    await x.click('#main [data-act=p5Go]'); await x.wait('checkin');
  };
  const libOpen = async (x, id) => {   // từ trang chính: "📚 Thư viện bài" → chạm một bài
    await x.goHome(); await x.click('#main [data-go=library]'); await x.wait('library');
    await x.click(id ? `#main .st-ex[data-params*="${id}"]` : '#main .st-ex:not(.st-ex-night)', 350);
  };
  const stopRecs = async x => ((await x.dbDump()).journal || []).filter(r => r.kind === 'stop');
  // Mỗi bước: tải lại trang = phiên mới (cờ phiên chỉ cộng) để các bước không ảnh hưởng nhau; lỗi một bước không dừng bước sau
  const step = async (tg, name, fn, x) => {
    try { if (x) { await x.go(); await x.wait('home'); } await fn(); } catch (e) { T(`${tg} ${name}: chạy hết`, false, e.stack); }
  };

  /* ================= C-1: chữ "Kể thêm" bỏ dở ================= */
  {
    const x = await open('L-c1', { preInit: SEEN }); const tg = '[L-C1]'; const st = (n, f) => step(tg, n, f, x);
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      await st('a ‹', async () => {
        await toCheckin(x);
        await x.click('#main [data-dot="3"]', 60); await x.click('#main [data-capy=lo_lang]', 60);
        await retype(x, '#ck-note', BAD);
        await back(x);
        T(`${tg} C-1a gõ "Kể thêm", KHÔNG bấm Tiếp, bấm ‹ → về trang chính`, await x.wait('home'), await x.scr());
        await resetSeen(x);
        await libOpen(x);
        await sleep(300);
        const sc = await x.scr(), d = await all(x);
        T(`${tg} C-1a rồi mở một bài từ Thư viện → M10 (không lỗi)`, sc === 'player' || sc === 'urgent', sc);
        T(`${tg} C-1a AC-23/AC-33 DB + bộ nhớ KHÔNG có chữ bỏ dở (câu tự hại, SĐT, tên) sau khi mở bài từ Thư viện`, !LEAK.test(d), d.slice(0, 500));
        const lib = (await stopRecs(x)).find(r => r.origin === 'library');
        T(`${tg} C-1a lượt mở từ Thư viện là lượt mới: không mang mức 3 / thẻ Lo lắng của check-in đã bỏ`, lib && lib.before == null && !(lib.emotions || []).length, JSON.stringify(lib));
        await x.click('#main [data-act=plDone]'); await x.wait('checkout'); await x.click('#main [data-act=coSkip]'); await x.wait('home');
        T(`${tg} C-1a sau check-out (Bỏ qua) vẫn không có chữ bỏ dở trong DB`, !LEAK.test(await all(x)));
      });
      await st('b Hỗ trợ', async () => {
        await toCheckin(x); await retype(x, '#ck-note', BAD);
        await x.click('#header [data-go=support]', 300);
        T(`${tg} C-1b 🤝 Hỗ trợ từ M07 khi đang gõ → M19`, await x.wait('support'));
        await back(x); await x.wait('checkin');
        const still = await x.ev("(document.querySelector('#ck-note') || {}).value || ''");
        await back(x); await x.wait('home');
        await libOpen(x); await sleep(300);
        const d = await all(x);
        T(`${tg} C-1b Hỗ trợ → ‹ → ‹ → Thư viện → mở bài: DB + bộ nhớ không có chữ bỏ dở`, !LEAK.test(d), 'ô khi quay lại: "' + still + '" · ' + d.slice(0, 400));
        await x.goHome();
      });
      await st('c forward', async () => {
        // Đã bấm Tiếp (chấm 2 → M08) rồi ‹ về M07, sửa thành câu tự hại, đi tiếp bằng nút Tiến của trình duyệt
        await toCheckin(x); await x.click('#main [data-dot="2"]', 60);
        await x.click('#main [data-act=ckNext]', 300);
        const s0 = await x.scr();
        await back(x); await x.wait('checkin');
        await retype(x, '#ck-note', BAD);
        await resetSeen(x);
        await x.ev('history.forward()'); await sleep(500);
        const s1 = await x.scr();
        if (s1 === 'safety_q') { await x.click('#main [data-act=sqNo]', 400); }
        await sleep(300);
        const d = await all(x), sn = await seen(x);
        T(`${tg} C-1c M07 → Tiếp (${s0}) → ‹ → sửa thành câu tự hại → nút Tiến → (M08 "Không"): chữ chưa qua kiểm KHÔNG được lưu`, !LEAK.test(d), 'màn: ' + sn.join('→') + ' · ' + d.slice(0, 300));
        await x.goHome();
      });
      await st('d sửa sau khi đã qua Tiếp', async () => {
        await toCheckin(x); await x.click('#main [data-dot="7"]', 60);
        await retype(x, '#ck-note', 'hôm nay hơi mệt');
        await x.click('#main [data-act=ckNext]', 300); await x.wait('suggest');
        await back(x); await x.wait('checkin');
        await retype(x, '#ck-note', BAD);
        await back(x); await x.wait('home');
        await libOpen(x); await sleep(300);
        let d = await all(x);
        T(`${tg} C-1d qua Tiếp với chữ lành → ‹ → sửa thành câu tự hại → ‹ → Thư viện: DB không có câu mới`, !LEAK.test(d), d.slice(0, 400));
        // Sửa rồi bấm Tiếp → M20; chữ dẫn tới M20 không lưu (AC-23)
        await toCheckin(x); await x.click('#main [data-dot="7"]', 60);
        await retype(x, '#ck-note', 'hôm nay hơi mệt');
        await x.click('#main [data-act=ckNext]', 300); await x.wait('suggest');
        await back(x); await x.wait('checkin');
        await retype(x, '#ck-note', BAD);
        await x.click('#main [data-act=ckNext]', 300);
        T(`${tg} C-1d qua Tiếp → ‹ → sửa thành câu tự hại → Tiếp → M20`, await x.wait('urgent'), await x.scr());
        await sleep(200); d = await all(x);
        T(`${tg} C-1d AC-23 chữ sửa dẫn tới M20 không ghi đè vào StopRec`, !LEAK.test(d), d.slice(0, 400));
        await x.goHome();
      });
      await st('e bảng nhận diện + sửa', async () => {
        // M07: bảng nhận diện đang mở, sửa ô thành câu tự hại, "Vẫn giữ" → phải M20
        await toCheckin(x); await x.click('#main [data-dot="7"]', 60);
        await retype(x, '#ck-note', 'Gọi chồng 0912345678');
        await x.click('#main [data-act=ckNext]', 300);
        T(`${tg} C-1e M07 SĐT → bảng nhận diện`, await x.has('#ck-pii .pii-panel'), await x.scr());
        await retype(x, '#ck-note', 'Tôi muốn chết');
        const how = await keepOr(x, '#ck-pii', '#main [data-act=ckNext]');
        T(`${tg} C-1e bảng nhận diện mở, sửa ô thành câu tự hại, ${how} → M20`, await x.wait('urgent'), await x.scr());
        await sleep(200);
        T(`${tg} C-1e DB không có câu tự hại / SĐT chưa đồng ý`, !LEAK.test(await all(x)), (await all(x)).slice(0, 300));
      });
      await st('e2 bảng nhận diện + SĐT khác', async () => {
        // Bảng mở, sửa thành SĐT KHÁC rồi "Vẫn giữ": SĐT mới chưa ai thấy thì không được lưu
        await toCheckin(x); await x.click('#main [data-dot="7"]', 60);
        await retype(x, '#ck-note', 'Gọi 0912345678');
        await x.click('#main [data-act=ckNext]', 300);
        await retype(x, '#ck-note', 'Gọi 0987 654 321');
        const how2 = await keepOr(x, '#ck-pii', '#main [data-act=ckNext]');
        await sleep(250);
        const p2 = await x.text('#ck-pii').catch(() => '');
        const shown = /0987|654 321/.test(p2);
        if (shown) await x.click('#ck-pii [data-pii=keep]', 350);
        await x.wait('suggest'); await sleep(200);
        const d = await all(x);
        T(`${tg} C-1e bảng mở, sửa thành SĐT khác, ${how2}: SĐT mới chỉ được lưu khi bảng nhận diện đã nêu nó`, shown || !/654 321/.test(d), 'bảng lần 2: ' + p2.slice(0, 80) + ' · ' + d.slice(0, 300));
        await x.goHome();
      });
      await st('f M21b', async () => {
        // Cuối cùng (đổi giai đoạn): gõ, ‹, rồi "Mình vừa có kết quả" → "Chưa như mong đợi" → M21b → Bàn tay ấm
        await toCheckin(x); await retype(x, '#ck-note', BAD);
        await back(x); await x.wait('home');
        await x.click('#main [data-go=result]'); await x.wait('result');
        await x.click('#main [data-act=res_loss]'); await x.wait('loss_soft');
        await x.click('#main [data-go=player]', 350);
        T(`${tg} C-1f M21b "Bàn tay ấm" → M10`, await x.wait('player'), await x.scr());
        await sleep(300);
        const d = await all(x);
        T(`${tg} C-1f gõ "Kể thêm" → ‹ → M21b → mở bài: DB + bộ nhớ không có chữ bỏ dở`, !LEAK.test(d), d.slice(0, 400));
      });
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* ================= C-2: B5 "Đặt tên suy nghĩ" ================= */
  {
    const x = await open('L-c2', { preInit: SEEN, reduce: true }); const tg = '[L-C2]'; const st = (n, f) => step(tg, n, f, x);
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      const toB5 = async () => { await libOpen(x, 'THOUGHT_CLOUD'); await x.wait('player'); };
      const cloud = () => x.ev("(document.querySelector('#cl-x') || {}).textContent || ''");
      await st('a', async () => {
        await toB5();
        await retype(x, '#cl-t', 'Gọi 0912345678'); await x.click('#cl-name', 250);
        T(`${tg} C-2 B5 "Gọi 0912345678" → bảng nhận diện`, await x.has('#cl-pii .pii-panel'));
        await retype(x, '#cl-t', 'Tôi muốn chết');
        const how = await keepOr(x, '#cl-pii', '#cl-name');
        const c0 = await cloud(), sc0 = await x.scr();
        T(`${tg} C-2 bảng mở, sửa ô thành "Tôi muốn chết", ${how} → mây KHÔNG hiện câu`, !/muốn chết/i.test(c0), 'mây: ' + c0 + ' · màn ' + sc0);
        T(`${tg} C-2 → M20 (AC-51: luật an toàn trước khi lên mây)`, sc0 === 'urgent' || await x.wait('urgent'), sc0);
        await sleep(200);
        const recs = await stopRecs(x), d = await all(x);
        T(`${tg} C-2 AC-23 không lưu texts.thought câu tự hại (DB + bộ nhớ)`, !/muốn chết/i.test(d) && !recs.some(r => r.texts && /chết/i.test(r.texts.thought || '')), d.slice(0, 300));
        if (await x.scr() === 'urgent') {
          await x.click('#main [data-act=urgentSafe]', 300);
          if (await x.wait('player', 1500)) T(`${tg} C-2 "chỉ là cách nói" → về bài, mây không có câu`, !/muốn chết/i.test(await cloud()), await cloud());
        }
      });
      await st('b SĐT khác', async () => {
        await toB5();
        await retype(x, '#cl-t', 'Gọi 0912345678'); await x.click('#cl-name', 250);
        await retype(x, '#cl-t', 'Gọi 0987 654 321');
        const how = await keepOr(x, '#cl-pii', '#cl-name');
        await sleep(200);
        const p2 = await x.text('#cl-pii').catch(() => ''), shown = /0987|654 321/.test(p2);
        if (shown) await x.click('#cl-pii [data-pii=keep]', 300);
        const c = await cloud(), d = await all(x);
        T(`${tg} C-2b bảng mở, sửa thành SĐT khác, ${how}: mây / DB chỉ có SĐT mới khi bảng đã nêu nó`, shown || (!/654 321/.test(c) && !/654 321/.test(d)), 'mây: ' + c + ' · bảng 2: ' + p2.slice(0, 60));
      });
      await st('c guard', async () => {
        // Đã gọi tên một câu, "Gọi tên thêm", gõ câu tự hại nhưng KHÔNG gọi tên, bấm "Xong" ở chân → M20
        await toB5();
        await retype(x, '#cl-t', 'lần này lại không được'); await x.click('#cl-name', 250);
        await x.click('#cl-fly', 100);
        await x.until("!document.querySelector('#cl-end').hidden", 3000);
        await x.click('#cl-again', 200);
        await retype(x, '#cl-t', 'tôi muốn chết');
        await x.click('#main [data-act=plDone]', 300);
        T(`${tg} C-2c gọi tên câu 1 → "Gọi tên thêm" → gõ câu tự hại, không gọi tên → "Xong" ở chân → M20`, await x.wait('urgent'), await x.scr());
        T(`${tg} C-2c DB không có câu tự hại`, !/muốn chết/i.test(await all(x)));
      });
      await st('d bỏ ngang', async () => {
        // Bỏ ngang: gõ câu tự hại + SĐT, KHÔNG gọi tên, bấm ‹ → không lưu gì của chữ đó
        await toB5();
        await retype(x, '#cl-t', 'tôi muốn chết, gọi 0912345678');
        await back(x); await sleep(300);
        const d = await all(x);
        T(`${tg} C-2d B5 gõ rồi bấm ‹ (không gọi tên) → DB không có chữ đó`, !LEAK.test(d), (await x.scr()) + ' · ' + d.slice(0, 300));
      });
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* ================= C-3: B6 "Biết chắc – Chưa biết" ================= */
  {
    const x = await open('L-c3', { preInit: SEEN }); const tg = '[L-C3]'; const st = (n, f) => step(tg, n, f, x);
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      const toB6 = async () => { await libOpen(x, 'KNOW_UNKNOWN'); await x.wait('player'); };
      const add = async (k, v) => { await retype(x, '#kn-' + k, v); await x.click(`#main [data-kadd=${k}]`, 120); };
      const verdict = async (label) => {
        const sc = await x.scr(); const ok = sc === 'urgent' || await x.wait('urgent', 1500);
        T(`${tg} ${label} → M20`, ok, 'màn: ' + (await seen(x)).join('→'));
        await sleep(200);
        const recs = await stopRecs(x), d = await all(x), sh = await shares(x);
        T(`${tg} ${label}: không lưu mục tự hại (texts.*), không gửi`, !/muốn chết/i.test(d) && !recs.some(r => r.texts && /chết/i.test(JSON.stringify(r.texts))) && !sh.some(s => /chết/i.test(s)), d.slice(0, 300) + ' · gửi ' + JSON.stringify(sh));
      };
      await st('a', async () => {
        await toB6(); await resetSeen(x);
        await add('know', 'Gọi 0912345678'); await x.click('#kn-done', 250);
        T(`${tg} C-3 ô 1 "Gọi 0912345678" → Xong › → bảng nhận diện`, await x.has('#kn-pii .pii-panel'));
        await add('todo', 'tôi muốn chết');
        const how = await keepOr(x, '#kn-pii', '#kn-done');
        await verdict(`C-3 bảng mở, thêm ô 3 "tôi muốn chết", ${how}`);
      });
      await st('b chân', async () => {
        await toB6(); await resetSeen(x);
        await add('know', 'Gọi 0912345678'); await x.click('#main [data-act=plDone]', 250);
        T(`${tg} C-3b "Xong" ở chân → bảng nhận diện`, await x.has('#kn-pii .pii-panel'));
        await add('todo', 'tôi muốn chết');
        const how = await keepOr(x, '#kn-pii', '#main [data-act=plDone]');
        await verdict(`C-3b (nút chân) bảng mở, thêm ô 3 câu tự hại, ${how}`);
      });
      await st('c ô chưa Thêm', async () => {
        // Cùng họ: chữ còn trong ô (chưa bấm Thêm) — own() có tính, luật phải chạy lại khi "Vẫn giữ"
        await toB6(); await resetSeen(x);
        await add('know', 'Gọi 0912345678'); await x.click('#kn-done', 250);
        await retype(x, '#kn-unknown', 'tôi muốn chết');
        const how = await keepOr(x, '#kn-pii', '#kn-done');
        await verdict(`C-3c bảng mở, gõ câu tự hại vào ô 2 (chưa bấm Thêm), ${how}`);
      });
      await st('d Gửi', async () => {
        // Bảng nhận diện của "Gửi" đang mở, thêm mục tự hại ở ô 3, "Vẫn giữ": không được gửi câu tự hại
        await toB6(); await resetSeen(x); await x.ev('(window.__share = [], window.__clip = [], 1)');
        await add('todo', 'Gọi 0912345678 hỏi kết quả');
        await x.click('#kn-send', 150); await x.click('#kn-go', 250);
        T(`${tg} C-3d Gửi → bảng nhận diện (kn-pii2)`, await x.has('#kn-pii2 .pii-panel'));
        await add('todo', 'tôi muốn chết');
        const how = await keepOr(x, '#kn-pii2', '#kn-go');
        await sleep(300);
        const sh = await shares(x);
        T(`${tg} C-3d bảng Gửi mở, thêm ô 3 câu tự hại, ${how}: không gửi câu tự hại`, !sh.some(s => /chết/i.test(s)), JSON.stringify(sh));
        if (await x.scr() === 'player') { await x.click('#kn-done', 300); }
        await verdict('C-3d rồi Xong ›');
      });
      await st('e bỏ ngang', async () => {
        // Bỏ ngang: đã Thêm mục tự hại + mục có SĐT, KHÔNG bấm Xong, bấm ‹ → không lưu, không gửi
        await toB6(); await x.ev('(window.__share = [], window.__clip = [], 1)');
        await add('todo', 'tôi muốn chết'); await add('know', 'Gọi 0912345678');
        await back(x); await sleep(300);
        const d = await all(x), sh = await shares(x);
        T(`${tg} C-3e B6 Thêm mục tự hại + SĐT rồi bấm ‹ (không Xong) → DB không có, không gửi`, !LEAK.test(d) && !sh.length, (await x.scr()) + ' · ' + d.slice(0, 300));
      });
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* ================= N-1: không trường nào để lộ cờ từ khóa 8.2 / 8.2b ================= */
  {
    const tg = '[L-N1]';
    const x = await open('L-n1');
    try {
      await setup(x, { mode: 'local', writing: false, role: 'solo', stage: 'cycle' });
      const s = await x.checkin({ level: 7, note: 'Hôm nay ra máu nhiều' });
      T(`${tg} tắt lưu chữ, "ra máu nhiều" → M09 có thẻ "cần bác sĩ"`, (s === 'suggest' || await x.wait('suggest')) && await x.has('#sg .body-card'), s);
      await x.click('#main [data-act=sgSwap]', 250); await sleep(200);
      const recs = await stopRecs(x), mem = JSON.parse(await x.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'stop'}))"));
      T(`${tg} N-1 mọi StopRec (DB + bộ nhớ) không có trường rule`, recs.length >= 1 && recs.concat(mem).every(r => !('rule' in r)), JSON.stringify(recs));
      T(`${tg} N-1 StopRec chỉ có trường trong danh sách cho phép (5.3 trừ rule), không note`, recs.every(r => Object.keys(r).every(k => STOP_KEYS.includes(k)) && !('note' in r)), JSON.stringify(recs.map(Object.keys)));
      const js = await x.ev('HTDC_APP.S.exportJson()');
      T(`${tg} N-1 tệp JSON xuất không có "rule"`, !/"rule"/.test(js), js.slice(0, 300));
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }

    // So sánh khác biệt: phiên có từ khóa nhóm 8.2 / 8.2b vs phiên đối chứng (cùng mức, cùng thẻ, không chữ).
    // Tắt lưu chữ → mọi thứ ghi xuống máy phải GIỐNG HỆT nhau (bỏ id / giờ). Lượt sau trong cùng phiên (cờ phiên còn) cũng vậy.
    const DROP = new Set(['id', 'at', 'day', 'tz']);
    const norm = dump => {
      const clean = v => Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).filter(k => !DROP.has(k)).sort().map(k => [k, clean(v[k])])) : v;
      const out = {};
      for (const s of Object.keys(dump).sort()) out[s] = (dump[s] || []).map(clean).map(r => JSON.stringify(r)).sort();
      return out;
    };
    const run = async (tag, note) => {
      const y = await open('L-n1-' + tag);
      try {
        await setup(y, { mode: 'local', writing: false, role: 'solo', stage: 'cycle' });
        const s1 = await y.checkin({ level: 7, emotions: ['lo_lang'], ctx: ['waiting'], note });
        if (s1 !== 'suggest') await y.wait('suggest');
        await y.click('#main [data-act=sgSwap]', 250);
        await y.click('#sg [data-go=player]', 300); await y.wait('player');
        await y.click('#main [data-act=plDone]', 250); await y.wait('checkout');
        await y.click('#co [data-dot="6"]'); await y.click('#main [data-act=coDone]', 250); await y.wait('done');
        await y.checkin({ level: 7, emotions: ['lo_lang'] }); await y.wait('suggest'); await sleep(250);
        // T-Q3 (A2): cùng phiên làm Hai ta C3, Gửi lời (câu mẫu), tick Chăm mình, bật no_smoke, mở Hành trình (đủ trang) → mọi thứ ghi xuống phải giống phiên đối chứng
        await y.ev("HTDC_APP.go('together_talk')"); await y.wait('together_talk');
        await y.click('#tg-talk [data-tk=go]', 150); await y.click('#tg-talk [data-tk=swap]', 150); await y.click('#tg-talk [data-tk=done]', 300);
        await y.ev("HTDC_APP.go('send_words')"); await y.wait('send_words'); await y.click('#tg-send', 200);
        await y.ev("HTDC_APP.go('care')"); await y.wait('care'); await y.click('#main input[data-h=food]', 200);
        await y.ev("document.querySelector('#main details.cr-set').open = true"); await y.click('#main [role=switch][data-h=no_smoke]', 200);
        await y.ev("HTDC_APP.go('journal')"); await y.wait('journal'); await sleep(250);
        const dump = await y.dbDump(), keys = await y.htdcKeys(), ex = JSON.parse(await y.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'stop'}).map(r => (r.done || []).map(d => d.ex)))"));
        return { s1, dump, keys, ex };
      } finally { await y.close(); }
    };
    try {
      const ctl = await run('ctl', '');
      const groups = ['hopeless', 'selfblame', 'home', 'loss', 'prolonged', 'body'];
      for (const g of groups) {
        const yes = (HTDC_BANK.find(r => r[1] === g && r[2] === 'yes') || [])[0];
        const r = await run(g, yes);
        // Bài đã mở (done[].ex) do người dùng chọn — cùng vị trí bấm nên chỉ khác khi danh sách gợi ý khác; so phần còn lại
        const strip = d => { const n = norm(d); n.journal = (n.journal || []).map(j => JSON.stringify(Object.assign(JSON.parse(j), { done: '…' }))).sort(); return n; };
        const a = JSON.stringify(strip(r.dump)), b = JSON.stringify(strip(ctl.dump));
        T(`${tg} N-1/AC-23 [${g}] "${yes}" (tắt lưu chữ): mọi bản ghi (stop, together, stage) + kho habits + kv trên máy GIỐNG HỆT phiên đối chứng (không trường nào lộ cờ), cả lượt sau + A2 trong phiên`,
          r.s1 === 'suggest' && a === b && JSON.stringify(r.keys) === JSON.stringify(ctl.keys), `s1=${r.s1} · ${a.slice(0, 350)} ≠ ${b.slice(0, 350)}`);
        T(`${tg} N-1 [${g}] không bản ghi nào có rule`, (r.dump.journal || []).every(j => !('rule' in j)), JSON.stringify(r.dump.journal));
        const did = d => (d.journal || []).some(j => j.kind === 'together' && j.exercise === 'C3') && (d.habits || []).some(h => h.marks && h.marks.food === 'x' && h.marks.connect === 'a')
          && JSON.stringify((d.kv || []).find(k => k.k === 'habits') || {}).includes('no_smoke');
        T(`${tg} N-1 [${g}] phần A2 thật sự đã ghi ở cả hai phiên (together C3, habits food 'x' + connect 'a', kv habits có no_smoke) nên phép so có nghĩa`, did(r.dump) && did(ctl.dump), JSON.stringify({ j: (r.dump.journal || []).map(j => j.kind), h: r.dump.habits, kv: r.dump.kv }).slice(0, 400));
      }
    } catch (e) { T(`${tg} so sánh khác biệt: chạy hết`, false, e.stack); }
  }

  /* ================= n-1: M08 trước bảng nhận diện ================= */
  {
    const x = await open('L-n1o', { preInit: SEEN }); const tg = '[L-n1]';
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      await toCheckin(x); await resetSeen(x);
      await x.click('#main [data-dot="2"]', 60);
      await retype(x, '#ck-note', 'Gọi chồng 0912 345 678 nhé');
      await x.click('#main [data-act=ckNext]', 350);
      const s1 = await x.scr(), n1 = await x.ev('window.__piiN');
      T(`${tg} n-1 PRD 8.1 chấm 2 + "Kể thêm" có SĐT → câu hỏi an toàn M08 TRƯỚC bảng nhận diện`, s1 === 'safety_q' && n1 === 0, `màn ${s1}, bảng nhận diện đã hiện ${n1} lần`);
      // Đi tiếp: M08 "Không" → bảng nhận diện (ở đâu cũng được) trước khi chữ được lưu → M09; M08 chỉ hỏi một lần
      let panel = n1 > 0;
      for (let i = 0; i < 8 && await x.scr() !== 'suggest'; i++) {
        if (await x.has('.pii-panel [data-pii=keep]')) { panel = true; await x.click('.pii-panel [data-pii=keep]', 350); continue; }
        if (await x.scr() === 'safety_q') { await x.click('#main [data-act=sqNo]', 350); continue; }
        if (await x.scr() === 'checkin') { await x.click('#main [data-act=ckNext]', 350); continue; }
        await sleep(200);
      }
      const m08 = (await seen(x)).filter(v => v === 'safety_q').length;
      const d = await all(x), sn = await seen(x);
      T(`${tg} n-1 sau M08 → M09; M08 chỉ hỏi một lần`, await x.scr() === 'suggest' && m08 === 1, sn.join('→') + ' · M08 ' + m08);
      T(`${tg} n-1 AC-33 chữ có SĐT chỉ được lưu sau khi bảng nhận diện đã hiện`, panel ? true : !/345 678/.test(d), 'bảng: ' + panel + ' · ' + d.slice(0, 300));
      // Cùng họ: bảng nhận diện đang mở (chấm 7), đổi mức xuống 2 rồi "Vẫn giữ" → vẫn phải hỏi M08 trước M09
      await x.go(); await x.wait('home');
      await toCheckin(x); await x.click('#main [data-dot="7"]', 60);
      await retype(x, '#ck-note', 'Gọi chồng 0912 345 678 nhé');
      await x.click('#main [data-act=ckNext]', 350);
      const pb = await x.has('#ck-pii .pii-panel');
      await x.click('#main [data-dot="2"]', 100); await resetSeen(x);
      const howB = await keepOr(x, '#ck-pii', '#main [data-act=ckNext]');
      for (let i = 0; i < 8 && await x.scr() !== 'suggest'; i++) {
        if (await x.has('.pii-panel [data-pii=keep]')) { await x.click('.pii-panel [data-pii=keep]', 350); continue; }
        if (await x.scr() === 'safety_q') { await x.click('#main [data-act=sqNo]', 350); continue; }
        if (await x.scr() === 'checkin') { await x.click('#main [data-act=ckNext]', 350); continue; }
        await sleep(200);
      }
      const snB = await seen(x);
      T(`${tg} n-1b chấm 7 + SĐT → bảng nhận diện; đổi sang chấm 2, ${howB} → M08 trước M09 (PRD 8.1)`, pb && snB.includes('safety_q') && snB.indexOf('safety_q') < snB.indexOf('suggest'), 'bảng ' + pb + ' · ' + snB.join('→'));
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* ================= n-2: B6 Gửi "Bỏ đoạn đó" ================= */
  {
    const x = await open('L-n2'); const tg = '[L-n2]';
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      await libOpen(x, 'KNOW_UNKNOWN'); await x.wait('player');
      await retype(x, '#kn-todo', 'Gọi 0912345678 hỏi kết quả'); await x.click('#main [data-kadd=todo]', 120);
      await x.click('#kn-send', 150); await x.click('#kn-go', 250);
      T(`${tg} n-2 Gửi mục có SĐT → bảng nhận diện`, await x.has('#kn-pii2 .pii-panel'));
      await x.click('#kn-pii2 [data-pii=drop]', 300);
      const items = await x.text('#kn-todo-l'), toast = await x.text('#toast'), sh0 = await shares(x);
      T(`${tg} n-2 "Bỏ đoạn đó" → mục ở ô 3 không còn SĐT (bỏ đoạn thật, không chỉ báo)`, !items.includes('0912345678'), 'mục: ' + items + ' · toast: ' + toast);
      T(`${tg} n-2 "Bỏ đoạn đó" chưa gửi gì`, !sh0.length, JSON.stringify(sh0));
      if (await x.ev("document.querySelector('#kn-prev').hidden")) await x.click('#kn-send', 150);
      const prev = await x.text('#kn-q');
      await x.click('#kn-go', 300);
      const sh = await shares(x);
      T(`${tg} n-2 gửi lại → xem trước + chữ gửi đi không có SĐT`, !prev.includes('0912345678') && sh.length === 1 && !sh[0].includes('0912345678'), 'xem trước: ' + prev + ' · gửi: ' + JSON.stringify(sh));
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* ================= n-3: xóa DB thất bại ================= */
  for (const [mode, act, wait] of [['error', 'delAll', 800], ['blocked', 'swJourney', 5800]]) {
    const x = await open('L-n3-' + mode, { preInit: SEEN + FAILDROP }); const tg = `[L-n3 ${act}/${mode}]`;
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      await x.checkin({ level: 6, note: 'chữ riêng tư của mình' }); await x.wait('suggest');
      await x.ev("HTDC_APP.go('mydata')"); await x.wait('mydata');
      await x.ev(`(window.__failDrop = ${JSON.stringify(mode)}, 1)`);
      await x.click(`#main [data-act=${act}]`, 250); await x.dlg(0); await sleep(wait);
      const toast = await x.text('#toast'), keys = await x.htdcKeys(), calls = await x.ev('window.__dropCalls || 0');
      T(`${tg} n-3 giả lập xóa IndexedDB ${mode === 'error' ? 'lỗi' : 'bị chặn (hết 5 s)'} → có gọi xóa`, calls >= 1, calls);
      T(`${tg} n-3 không báo "Đã xóa toàn bộ." khi chưa xóa được; có câu báo lỗi`, !/Đã xóa toàn bộ/.test(toast) && toast.trim().length > 0, 'toast: "' + toast + '" · khóa ' + keys);
      // Không để dữ liệu "ma": hoặc vẫn ở chế độ lưu (khóa còn, dữ liệu thấy ở M18), hoặc lần chọn "Lưu trên máy này" sau KHÔNG mở lại chữ cũ
      await x.ev('(window.__failDrop = null, 1)');
      await x.go(); await sleep(300);
      const sc = await x.scr();
      let ghost = false;
      if (sc === 'welcome') {
        await x.click('#main [data-go=consent]'); await x.wait('consent'); await x.click('#main [data-act=consentGo]', 400);
        await sleep(300); ghost = /chữ riêng tư/.test(await all(x));
      }
      T(`${tg} n-3 tải lại: ${sc === 'welcome' ? 'về M01 → "Lưu trên máy này" (tắt chữ) không hiện lại chữ cũ' : 'vẫn ở chế độ lưu, đúng như câu báo'}`,
        sc === 'welcome' ? !ghost : (await x.ev('HTDC_APP.S.mode()')) === 'local' && !/Đã xóa toàn bộ/.test(toast), 'màn ' + sc + ' · ghost ' + ghost);
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* ================= Lối vào bài đêm H1 / H2: luôn qua cổng hỏi (AC-40, G-4) ================= */
  {
    const x = await open('L-night', { preInit: SEEN }); const tg = '[L-night]';
    try {
      await setup(x, { mode: 'local', writing: false, role: 'wife', stage: 'waiting' });
      const nst = (n, f) => step(tg, n, f, x);
      for (const id of ['NIGHT_HOME_SHORT', 'NIGHT_HOME']) await nst('thư viện ' + id, async () => {
        await x.click('#main [data-go=library]'); await x.wait('library'); await resetSeen(x);
        await x.click(`#main [data-act=openNight][data-id=${id}]`, 400);
        await x.until("!!document.querySelector('.dlg')", 1500);
        const sn = await seen(x);
        T(`${tg} AC-40 Thư viện → ${id} → M13 + hộp cổng hỏi, không vào thẳng night_how`, await x.scr() === 'night' && await x.has('.dlg') && !sn.includes('night_how'), sn.join('→'));
        if (await x.has('.dlg')) await x.dlg(3);
      });
      const toHow = async () => {
        await x.click('#main .tile[data-go=night]'); await x.wait('night'); await sleep(300);
        await x.click('#main [data-act=pick][data-id=NIGHT_HOME_SHORT]', 250); await x.dlg(0); await x.wait('night_how');
      };
      // Ấm lòng → M13c → ‹ → nút Tiến của trình duyệt: phải hỏi lại, không vào thẳng M13c
      await nst('forward', async () => {
        await toHow(); await back(x); await x.wait('night');
        await x.ev('history.forward()'); await sleep(500);
        const f1 = await x.scr();
        T(`${tg} AC-40 M13c H2 → ‹ → nút Tiến: không vào thẳng night_how khi chưa hỏi lại`, f1 !== 'night_how' || await x.has('.dlg'), f1);
      });
      // n-5: Tiến vào M13c / M14 của bài có cổng mà không có vé → render chỉ vẽ khung rỗng (không chớp chữ bài một khung hình).
      // MutationObserver ghi MỌI nút được vẽ vào #main (kể cả nút bị thay ngay sau đó) kèm tên màn lúc vẽ.
      await nst('n-5 Tiến không chớp chữ', async () => {
        await toHow();
        await x.ev("(document.querySelector('#main input[name=how][value=read]').click(), 1)"); await sleep(100);
        await x.click('#main [data-act=start]'); await x.wait('night_play'); await sleep(300);
        const r0 = await x.has('#main .read-aloud');
        await back(x); await x.wait('night_how'); await back(x); await x.wait('night'); await sleep(300);
        await x.ev(`(() => { const m = document.querySelector('#main'); window.__drawn = [];
          window.__mo = new MutationObserver(rs => rs.forEach(r => r.addedNodes.forEach(n =>
            window.__drawn.push({ scr: m.dataset.screen, html: n.nodeType === 1 ? n.outerHTML : String(n.textContent) }))));
          window.__mo.observe(m, { childList: true, subtree: true }); return 1; })()`);
        await x.ev('history.forward()'); await sleep(600);   // → night_how (chưa có vé) → về M13 + cổng hỏi
        await x.ev('history.forward()'); await sleep(600);   // → night_play (chưa có vé) → về M13 + cổng hỏi
        const drawn = JSON.parse(await x.ev('(window.__mo.disconnect(), JSON.stringify(window.__drawn))'));
        const hit = drawn.filter(d => d.scr === 'night_how' || d.scr === 'night_play');
        const LEAK = [/read-aloud/, /how-list/, /reader/, /eyebrow/, /Nằm hoặc ngồi tựa/, /Hình dung một buổi sáng có nắng/, /data-act="start"/];
        const bad = hit.filter(d => LEAK.some(re => re.test(d.html)));
        T(`${tg} n-5 (AC-40, G-4) Tiến vào night_how rồi night_play của H2 khi chưa có vé: có vẽ hai màn (đọc được ở M14 trước đó: ${r0})`,
          r0 && hit.some(d => d.scr === 'night_how') && hit.some(d => d.scr === 'night_play'), hit.map(d => d.scr).join(','));
        T(`${tg} n-5 DOM lúc render night_how / night_play không chứa chữ bài (chỉ khung rỗng)`, hit.length > 0 && !bad.length,
          bad.map(d => d.scr + ': ' + d.html.slice(0, 120)).join(' | '));
        T(`${tg} n-5 sau khi Tiến: về M13 + hộp cổng hỏi`, await x.scr() === 'night' && await x.has('.dlg'), await x.scr());
        if (await x.has('.dlg')) await x.dlg(3);
      });
      // Nặng lòng ở M14 → L12 → ‹ : không quay lại M13c / M14 của bài có em bé mà không hỏi
      await nst('nặng lòng ‹', async () => {
        await toHow();
        await x.click('#main [data-act=start]'); await x.wait('night_play'); await sleep(300);
        await x.click('#main [data-act=heavy]'); await x.wait('night_heavy');
        await back(x); await sleep(300);
        const f2 = await x.scr();
        T(`${tg} AC-40/AC-45 "nặng lòng" → L12 → ‹: không về thẳng M13c / M14 của H2 (phải qua cổng hỏi)`, !['night_how', 'night_play'].includes(f2) || await x.has('.dlg'), f2);
      });
      // Tải lại trang khi đang ở M13c → không ở lại night_how
      await nst('tải lại', async () => {
        await toHow(); await x.go(); await sleep(300);
        T(`${tg} tải lại ở M13c H2 → không ở lại night_how`, await x.scr() !== 'night_how', await x.scr());
      });
      console.log(`      ${tg} ghi chú: "Gửi lời cho người thương" (C4, màn send_words) ${await x.ev("HTDC_APP.has('send_words')") ? 'CÓ' : 'chưa có'} trong A1.`);
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }
}

/* ===================================================================== */
(async () => {
  const t0 = Date.now();
  try {
    srv = await startStatic({ port: 8775, appDir: APP_DIR, assetBase: '/__capy/' });
    srv404 = await startStatic({ port: 8776, appDir: APP_DIR, assetBase: '/__404/' });
    srvReal = await startStatic({ port: 8777, appDir: APP_DIR });
    const L = await launch({ userDataDir: path.join(OUT, 'chrome-e2e'), width: 375, height: 812 });
    browser = L.browser; kill = L.kill;
    const want = k => !ONLY || ONLY.includes(k);
    if (want('A')) { section('A. Luồng chính 3 vai × 2 chế độ'); for (const r of ['wife', 'husband', 'solo']) for (const m of ['local', 'none']) await mainFlow(r, m); }
    if (want('B')) { section('B. Check-in'); await scenarioB(); }
    if (want('C')) { section('C. An toàn qua ô viết'); await scenarioC(); }
    if (want('D')) { section('D. Trình phát'); await scenarioD(); }
    if (want('E')) { section('E. Trước khi ngủ'); await scenarioE(); }
    if (want('F')) { section('F. Dữ liệu của mình'); await scenarioF(); }
    if (want('G')) { section('G. Chế độ lưu, hai tab'); await scenarioG(); }
    if (want('H')) { section('H. Sự kiện store'); await scenarioH(); }
    if (want('I')) { section('I. file://, hiệu năng, chuyển động, tương phản, cỡ màn, mạng'); await scenarioI(); }
    if (want('J')) { section('J. Header dính / ảnh chụp cả trang'); await scenarioJ(); }
    if (want('K')) { section('K. ALLOW_DRAFT_CONTENT = false'); await scenarioK(); }
    if (want('L')) { section('L. Lượt 3: bỏ ngang / sửa giữa chừng / quay lại (review A1)'); await scenarioL(); }
    // A2 (T-Q3): kịch bản M…S ở tests/e2e/a2.js, dùng chung trình duyệt + T + bảng AC
    await require('./e2e/a2')({ open, setup, T, WAIT, section, sleep, CONTRAST, SEEN, F, HTDC_BANK, path, SHOTS, XUNG, cap, want }).run();
  } catch (e) {
    T('e2e chạy hết', false, e.stack);
  } finally {
    if (kill) kill();
    for (const s of [srv, srv404, srvReal]) if (s) await s.close();
  }
  // Bảng theo AC
  const by = {};
  for (const r of results) for (const m of new Set(r.name.match(/AC-\d+[a-z]?/g) || [])) { by[m] = by[m] || [0, 0]; by[m][r.ok ? 0 : 1]++; }
  const keys = Object.keys(by).sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3)) || a.localeCompare(b));
  console.log('\nTheo AC: ' + keys.map(k => k + (by[k][1] ? ' ĐỎ ' + by[k][1] + '/' + (by[k][0] + by[k][1]) : ' ' + by[k][0])).join(' · '));
  console.log('Ảnh: ' + SHOTS + ' · thời gian ' + Math.round((Date.now() - t0) / 1000) + ' s');
  console.log('\ne2e: ' + passes + ' PASS · ' + fails + ' FAIL · ' + waits + ' CHỜ ANH');
  process.exitCode = fails ? 1 : 0;
})();
