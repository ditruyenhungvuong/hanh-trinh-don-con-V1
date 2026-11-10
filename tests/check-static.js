/* =========================================================
   Rà tĩnh – Hành Trình Đón Con (Chủ: qa-tester; T-00 architect dựng KHUNG 10/11/2026, T-Q1 viết đủ luật tech design 14.2).
   Nguồn khung: apps/sung-suc/tests/check-static.js @ 10/11/2026 (ADR 0008); luật viết lại cho HTDC.
   Chạy: node tests/check-static.js [--strict]
     --strict: dùng trước khi phát hành (upload.sh / upload.bat gọi): ASSET_BASE https hoặc rỗng, APP_URL đúng repo,
               không localhost / 127.0.0.1 trong file phát hành.
   Định dạng ra (upload.* đọc): mỗi lỗi một dòng bắt đầu "FAIL", dòng tóm tắt cuối bắt đầu "check-static:",
   một dòng thụt lề bắt đầu "HTML+CSS+JS" cho ngân sách. Có FAIL → exit 1.
   Trạng thái: PASS · FAIL · WARN (không chặn) · CHỜ (phần app chưa có: không xanh, không đỏ).
   Khung T-00 kiểm:
   1. node --check mọi .js (app, tests); không file *.conflict*.
   2. Dòng "Chủ:" ở header mọi file js/, css/, styles.css, index.html, tests/ (bản đồ file mục 2).
   3. index.html: lang, viewport không chặn phóng to, referrer, khung #header #banners #main #toast, thứ tự 18 <script> và
      6 <link> CSS (3.1), không script nội tuyến, không <script>/<link> ra ngoài origin, CSP đúng NGUYÊN VĂN (ADR 0011).
   4. API cấm (3.5, AC-06) trong js/: Web Speech, mạng, service worker, Notification, eval, alert/confirm/prompt, onclick=,
      localStorage.clear, document.cookie. Không URL http(s) ngoài trong CSS.
   5. Lưu trữ (5.2): chuỗi khóa/DB chỉ tiền tố htdc_v1_; indexedDB chỉ trong js/idb.js.
   6. config.js đủ khóa mục 10.
   7. Ngân sách 11.1: ba trần cứng (FAIL) + trần mục tiêu từng file (WARN).
   T-Q1 (qa-tester 10/11/2026) thêm mục 8–13: cụm cấm PRD 6.2 + UX 10.6, AC-44, câu hứa có thai (chỉ V6), giọng (WARN),
   số điện thoại ngoài 115 (AC-32), trạng thái duyệt mọi nội dung (PRD 8.8), AC-36/43/50, esc() trong template (AC-05),
   file thuần (6.1), ai được ghi giai đoạn (AC-17). Danh sách cụm cấm ở tests/lib/forbidden.js.
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { scan } = require('./lib/jsscan');

const APP = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const exists = f => fs.existsSync(path.join(APP, f));
const size = f => fs.statSync(path.join(APP, f)).size;
let fails = 0, warns = 0, passes = 0, waits = 0;
const short = d => String(d).replace(/\s+/g, ' ').slice(0, 300);
const T = (name, ok, detail) => { ok ? passes++ : fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined && !ok ? '  → ' + short(detail) : '')); return ok; };
const W = (name, ok, detail) => { ok ? passes++ : warns++; console.log((ok ? 'PASS ' : 'WARN ') + name + (detail !== undefined && !ok ? '  → ' + short(detail) : '')); return ok; };
const section = s => console.log('\n=== ' + s + ' ===');
const lineOf = (txt, idx) => txt.slice(0, idx).split('\n').length;

function listFiles(dir, ext) {
  const d = path.join(APP, dir);
  if (!fs.existsSync(d)) return [];
  const out = [];
  for (const n of fs.readdirSync(d)) {
    const rel = (dir ? dir + '/' : '') + n;
    if (n === '.git' || n === 'node_modules' || n === 'out') continue;
    if (fs.statSync(path.join(APP, rel)).isDirectory()) out.push(...listFiles(rel, ext));
    else if (!ext || n.endsWith(ext)) out.push(rel);
  }
  return out;
}
const JS = listFiles('js', '.js');
const TEST_JS = listFiles('tests', '.js');
const CSS = ['styles.css', ...listFiles('css', '.css')];
const SRC = Object.fromEntries(JS.map(f => [f, scan(read(f))]));
const grep = (view, re, files) => {
  const hits = [];
  for (const f of files || JS) { const s = SRC[f][view]; const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); let m; while ((m = g.exec(s))) hits.push(f + ':' + lineOf(s, m.index)); }
  return hits;
};

/* ===== 1. Cú pháp ===== */
section('1. Cú pháp');
const NODE = process.execPath;
const bad = [];
for (const f of [...JS, ...TEST_JS]) { const r = spawnSync(NODE, ['--check', path.join(APP, f)], { encoding: 'utf8' }); if (r.status !== 0) bad.push(f + ': ' + (r.stderr || '').split('\n').slice(0, 3).join(' ')); }
T('node --check mọi .js (' + (JS.length + TEST_JS.length) + ' file)', !bad.length, bad.join(' | '));
const conflicts = listFiles('', '').filter(f => /\.conflict/.test(f));
T('không file *.conflict* (bản trùng do đồng bộ Drive)', !conflicts.length, conflicts.join(', '));

/* ===== 2. Dòng Chủ: ===== */
section('2. Header "Chủ:"');
const owned = [...JS, ...CSS.filter(exists), 'index.html', ...TEST_JS];
const noOwner = owned.filter(f => !/Chủ:/.test(read(f).split('\n').slice(0, 12).join('\n')));
T('mỗi file có dòng "Chủ:" trong 12 dòng đầu (bản đồ file mục 2)', !noOwner.length, noOwner.join(', '));

/* ===== 3. index.html ===== */
section('3. index.html, CSP');
const html = read('index.html');
const CSP = "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://ditruyenhungvuong.github.io; media-src 'self'; connect-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'";
const cspM = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html);
T('CSP đúng nguyên văn tech design 3.1 / ADR 0011 (connect-src none, worker-src none)', cspM && cspM[1] === CSP, cspM ? cspM[1] : 'không thấy CSP');
T('<html lang="vi">', /<html lang="vi">/.test(html));
T('viewport không chặn phóng to', /name="viewport"/.test(html) && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?![.\d])/.test(html));
T('meta referrer no-referrer', /name="referrer" content="no-referrer"/.test(html));
T('khung #header #banners #main #toast', ['id="header"', 'id="banners"', 'id="main"', 'id="toast"'].every(s => html.includes(s)));
const SCRIPTS = ['config', 'util', 'data', 'keywords', 'scripts', 'engine', 'pacer', 'idb', 'store', 'sound', 'players',
  'stop', 'night', 'mydata', 'together', 'care', 'journal', 'app'].map(n => 'js/' + n + '.js');
const gotScripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => (/src="([^"]+)"/.exec(m[1]) || [])[1] || '(nội tuyến)');
T('thứ tự 18 <script> đúng mục 3.1 (A2 nạp sẵn)', JSON.stringify(gotScripts) === JSON.stringify(SCRIPTS), gotScripts.join(', '));
const STYLES = ['styles.css', 'css/stop.css', 'css/night.css', 'css/data.css', 'css/together.css', 'css/care.css'];
const gotCss = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
T('thứ tự 6 <link> CSS đúng mục 3.1', JSON.stringify(gotCss) === JSON.stringify(STYLES), gotCss.join(', '));
const missing = [...SCRIPTS, ...STYLES].filter(f => !exists(f));
T('mọi file được nạp đều tồn tại', !missing.length, missing.join(', '));
T('không <script> / <link> / <img> trỏ ra ngoài origin', !/<(script|link|img)\b[^>]*(src|href)="(https?:)?\/\//i.test(html));
T('không thuộc tính on…= trong index.html', !/\son[a-z]+\s*=/i.test(html));

/* ===== 4. API cấm ===== */
section('4. API cấm (3.5, AC-06)');
const BAN = [
  [/\bspeechSynthesis\b|SpeechSynthesisUtterance|webkitSpeech/, 'Web Speech'],
  [/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\bWebSocket\b|\bEventSource\b/, 'mạng'],
  [/serviceWorker|importScripts|\bNotification\b|PushManager/, 'service worker / thông báo'],
  [/\beval\s*\(|new\s+Function\b/, 'eval / new Function'],
  [/(^|[^.\w])(alert|confirm|prompt)\s*\(/, 'alert / confirm / prompt'],
  [/localStorage\s*\.\s*clear|sessionStorage\b|document\s*\.\s*cookie/, 'Web Storage clear / sessionStorage / cookie']
];
for (const [re, name] of BAN) { const h = grep('bare', re); T('không dùng ' + name, !h.length, h.join(', ')); }
const onAttr = [];
for (const f of JS) for (const s of SRC[f].strings) if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(s.text)) onAttr.push(f + ':' + s.line);
T('không thuộc tính on…= (onclick=…) trong template HTML', !onAttr.length, onAttr.join(', '));
const cssExt = CSS.filter(exists).filter(f => /url\(\s*['"]?(https?:)?\/\//i.test(read(f)));
T('CSS không url() ra ngoài origin', !cssExt.length, cssExt.join(', '));

/* ===== 5. Lưu trữ ===== */
section('5. Lưu trữ (5.2)');
const keyHits = [];
for (const f of JS) for (const s of scan(read(f)).strings) if (/^(htdc|ss|lstp|stop4p|checkin)[_a-z0-9]*$/i.test(s.text) && /_/.test(s.text) && !/^htdc_v1_/.test(s.text)) keyHits.push(f + ':' + s.line + ' "' + s.text + '"');
T('tên khóa / DB trong js/ chỉ tiền tố htdc_v1_', !keyHits.length, keyHits.join(', '));
const idbOut = grep('bare', /\bindexedDB\b/, JS.filter(f => f !== 'js/idb.js' && f !== 'js/store.js'));
T('indexedDB chỉ trong js/idb.js (store.js gọi qua HTDC_IDB; deleteDatabase cho phép ở store)', !idbOut.length, idbOut.join(', '));
const openOut = grep('bare', /indexedDB\s*\.\s*open\s*\(/, JS.filter(f => f !== 'js/idb.js'));
T('indexedDB.open( chỉ trong js/idb.js', !openOut.length, openOut.join(', '));

/* ===== 5b. Lối vào bài đêm (AC-40, review A1 G-4; QA lượt 3) =====
   Mọi lối vào H1/H2 phải qua api.openNight (night.js) để có cổng hỏi / hộp xác nhận sau tin buồn.
   Không file nào khác được đi thẳng tới 'night_how' (go(...) / data-go / goA / goAttr / data-params), kể cả nhánh dự phòng. */
section('5b. Lối vào bài đêm chỉ qua openNight (AC-40)');
const NAV_HOW = /(?:\bgo\s*\(|\bgoA(?:ttr)?\s*\(|data-go\s*=\s*\\?["'])\s*['"`]?night_how\b/g;
const howOut = [];
for (const f of JS.filter(f => f !== 'js/night.js')) { const s = read(f); let m; NAV_HOW.lastIndex = 0; while ((m = NAV_HOW.exec(s))) howOut.push(f + ':' + lineOf(s, m.index)); }
T('ngoài js/night.js không có chỗ nào đi thẳng tới night_how (kể cả nhánh dự phòng khi thiếu api.openNight)', !howOut.length, howOut.join(', '));
{
  const ns = read('js/night.js'), a = ns.indexOf('function openNight('), b = ns.indexOf('/* ===== M13 Trước khi ngủ');
  const hits = []; let m; NAV_HOW.lastIndex = 0; while ((m = NAV_HOW.exec(ns))) hits.push(m.index);
  const outside = hits.filter(i => a < 0 || b < 0 || i < a || i > b).map(i => 'js/night.js:' + lineOf(ns, i));
  T('trong js/night.js, mọi go(\'night_how\') nằm trong openNight / flow (sau cổng hỏi)', a >= 0 && b > a && hits.length > 0 && !outside.length, outside.join(', ') || ('openNight ' + a + ', mốc M13 ' + b));
}

/* ===== 6. config.js ===== */
section('6. config.js (mục 10)');
const cfgSrc = read('js/config.js');
let C = null;
try { const ctx = { window: {} }; require('vm').runInNewContext(cfgSrc, ctx); C = ctx.window.HTDC_CONFIG; } catch (e) { C = null; }
const KEYS = ['APP_NAME', 'VERSION', 'PRIVACY_VERSION', 'SCHEMA', 'APP_URL', 'ASSET_BASE', 'SHARED_ORIGIN', 'ALLOW_DRAFT_CONTENT', 'EMERGENCY_NUMBER',
  'SUPPORT_CHANNELS', 'CLINIC_CONTACT', 'CLINIC_WARNING_SIGNS', 'LINK_ME_BAU_AN_YEN', 'NIGHT_FROM_HOUR', 'LATE_HOUR', 'NOTE_MAX', 'SEND_MAX'];
T('config.js chạy được, đủ ' + KEYS.length + ' khóa', C && KEYS.every(k => k in C), C ? KEYS.filter(k => !(k in C)).join(', ') : 'không chạy được');
T('EMERGENCY_NUMBER = 115', C && C.EMERGENCY_NUMBER === '115');
T('ASSET_BASE một dòng riêng (static-server vá dòng này)', /^\s*ASSET_BASE:\s*'[^']*',\s*$/m.test(cfgSrc));
if (STRICT) {
  T('--strict: ASSET_BASE là https:// hoặc rỗng', C && (C.ASSET_BASE === '' || /^https:\/\//.test(C.ASSET_BASE)), C && C.ASSET_BASE);
  T('--strict: APP_URL khớp repo hanh-trinh-don-con-V1', C && C.APP_URL === 'https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/', C && C.APP_URL);
  const local = ['index.html', ...CSS.filter(exists), ...JS].filter(f => /localhost|127\.0\.0\.1/.test(read(f)));
  T('--strict: không localhost / 127.0.0.1 trong file phát hành', !local.length, local.join(', '));
}

/* =========================================================
   T-Q1 (qa-tester, 10/11/2026): mục 8–14 viết TỪ ĐẶC TẢ (tech design 3.5, 6.1, 13, 14.2; PRD 6.1, 6.2, 8.4, 8.8,
   AC-05, 06, 17, 32, 36, 43, 44, 46, 50). Phần app chưa có → CHỜ (không xanh, không đỏ).
   ========================================================= */
const { visible } = require('./lib/jsscan');
const FB = require('./lib/forbidden');
const WAIT = (name, reason) => { waits++; console.log('CHỜ  ' + name + '  → ' + short(reason)); };
const vm = require('vm');
/* Chuỗi hiển thị: mọi chuỗi literal js/*.js (trừ keywords.js: từ khóa nhận diện, không hiển thị) + chữ index.html
   (bỏ comment, thẻ; giữ title, alt, aria-label, placeholder, content của meta) + <title>/<text>/<desc> của SVG + content: của CSS */
const SHOWN = [];
for (const f of JS.filter(f => f !== 'js/keywords.js')) for (const s of SRC[f].strings) {
  const t = visible(s.text.replace(/\u0000/g, ' '));
  if (t && /[\p{L}]/u.test(t)) SHOWN.push({ where: f + ':' + s.line, f, text: t, raw: s.text });
}
{
  const h = html.replace(/<!--[\s\S]*?-->/g, ' ');
  SHOWN.push({ where: 'index.html', f: 'index.html', text: visible(h) });
  for (const m of h.matchAll(/\s(?:title|alt|aria-label|placeholder|content)="([^"]*)"/g)) if (/[\p{L}]{2}/u.test(m[1]) && !/default-src|width=|no-referrer/.test(m[1])) SHOWN.push({ where: 'index.html (thuộc tính)', f: 'index.html', text: m[1] });
  for (const f of listFiles('assets', '.svg')) for (const m of read(f).matchAll(/<(title|text|desc)[^>]*>([\s\S]*?)<\/\1>/g)) SHOWN.push({ where: f, f, text: visible(m[2]) });
  for (const f of CSS.filter(exists)) for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/content\s*:\s*(['"])(.*?)\1/g)) if (/[\p{L}]/u.test(m[2])) SHOWN.push({ where: f, f, text: m[2] });
}

/* ===== 8. Cụm cấm (PRD 6.2 + UX 10.6, AC-06; tests/lib/forbidden.js) ===== */
section('8. Cụm cấm, hứa có thai, giọng (PRD 6.1, 6.2, 8.4; AC-06, 44, 46)');
{
  const hits = [];
  for (const s of SHOWN) for (const w of FB.findPhrases(s.text, FB.BANNED)) hits.push(s.where + ' "' + w + '"');
  T('AC-06: không cụm cấm PRD 6.2 + UX 10.6 (' + FB.BANNED.length + ' cụm, so có dấu / bỏ dấu theo từ) trong ' + SHOWN.length + ' chuỗi hiển thị', !hits.length, hits.join(', '));
}
if (exists('js/scripts.js') && SRC['js/scripts.js'].strings.length > 5) {
  const hits = [];
  for (const s of SHOWN.filter(x => x.f === 'js/scripts.js')) for (const w of FB.findPhrases(s.text, FB.SCRIPT_BANNED)) hits.push(s.where + ' "' + w + '"');
  T('AC-44: scripts.js không có phôi, tử cung, làm tổ, bám, xét nghiệm, beta, que thử, con trai, con gái, chắc chắn sẽ', !hits.length, hits.join(', '));
} else WAIT('AC-44: scripts.js không có từ y khoa / giới tính / hứa', 'CHỜ T-05 — scripts.js chưa có nội dung');
{
  const hits = [], neg = [];
  for (const s of SHOWN) for (const p of FB.findPromises(s.text)) (/(^|\s)(không|chưa|chẳng)\s/.test(p) ? neg : hits).push(s.where + ' "' + p.slice(0, 80) + '"');
  T('V6: không câu nào hứa có thai (giúp/tăng/dễ/khả năng… + có thai/đậu thai/thụ thai/mang thai), trừ đúng câu V6', !hits.length, hits.join(' | '));
  W('V6: câu PHỦ ĐỊNH / dẫn chứng có nhắc khả năng có thai ngoài câu V6 — người viết nội dung xem lại (PRD 8.4 cho phép nói thật bằng chứng)', !neg.length, neg.join(' | '));
  const v6 = SHOWN.filter(s => s.raw && s.raw.normalize('NFC').includes(FB.V6));
  if (exists('js/night.js') && (SRC['js/scripts.js'].strings.length > 5 || SRC['js/night.js'].strings.length > 5)) T('AC-46: câu V6 nguyên văn có trong mã ("' + FB.V6.slice(0, 40) + '…")', v6.length >= 1, 'không thấy');
  else WAIT('AC-46: câu V6 nguyên văn có trong mã', 'CHỜ T-05');
}
{
  const soft = [], a = [];
  for (const s of SHOWN) { for (const w of FB.findPhrases(s.text, FB.SOFT)) soft.push(s.where + ' "' + w + '"'); if (FB.VN_MARK.test(s.text) && / /.test(s.text) && /(?<![\p{L}])ạ(?![\p{L}])/u.test(s.text.normalize('NFC'))) a.push(s.where); }
  W('giọng (QA đề xuất, CHỜ ANH duyệt danh sách): không từ y khoa / ép tích cực (' + FB.SOFT.length + ' cụm)', !soft.length, soft.join(', '));
  W('PRD 6.1: không dùng "ạ" (giọng Xanh dịu)', !a.length, a.join(', '));
}

/* ===== 9. Số điện thoại (AC-32, PRD 8.5) ===== */
section('9. Số điện thoại (AC-32): không số nào ngoài 115');
{
  const ALLOWED = ['115'];   // anh xác nhận số khác thì thêm vào đây (kèm ngày, nguồn)
  const digitsOf = s => s.replace(/[^\d]/g, '');
  const PHONE = /(?<![\d.,])(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){7,9}(?![\d])|(?<![\d.,])1[89]00[\s.-]?\d{3,4}(?:[\s.-]?\d{2,3})?(?![\d])|(?<![\d.,/:-])11[0-9](?![\d.,/:%-])|(?<![\d.,])\d{7,}(?![\d])/g;
  const hits = [];
  for (const f of ['js/config.js', 'js/data.js', 'js/scripts.js'].filter(exists)) for (const s of scan(read(f)).strings) for (const m of s.text.matchAll(PHONE)) if (!ALLOWED.includes(digitsOf(m[0]))) hits.push(f + ':' + s.line + ' "' + m[0] + '"');
  T('config.js, data.js, scripts.js: không dãy số dạng điện thoại ngoài 115', !hits.length, hits.join(', '));
  const tel = [];
  for (const f of JS) for (const s of SRC[f].strings) for (const m of s.text.matchAll(/tel:([+\d\s.-]+)/g)) if (!ALLOWED.includes(digitsOf(m[1]))) tel.push(f + ':' + s.line + ' tel:' + m[1]);
  for (const m of html.matchAll(/tel:([+\d\s.-]+)/g)) if (!ALLOWED.includes(digitsOf(m[1]))) tel.push('index.html tel:' + m[1]);
  T('không liên kết tel: nào ngoài 115 cố định trong mã (số cơ sở lấy từ config)', !tel.length, tel.join(', '));
  if (C) {
    const ph = [].concat((C.SUPPORT_CHANNELS || []).map(x => x && x.phone), [C.CLINIC_CONTACT && C.CLINIC_CONTACT.phone]).filter(Boolean).map(String);
    T('config: SUPPORT_CHANNELS, CLINIC_CONTACT chưa có số nào (CHỜ ANH xác nhận, câu 7)', ph.every(p => ALLOWED.includes(digitsOf(p))), ph.join(', '));
  }
}

/* ===== 10. Nội dung có trạng thái duyệt (PRD 8.8, tech design 13; AC-34, 43, 50) ===== */
section('10. Nội dung: trạng thái duyệt, bài, kịch bản (PRD 8.8; AC-36, 43, 50)');
const box = { console }; box.window = box; vm.createContext(box);
for (const f of ['js/config.js', 'js/util.js', 'js/data.js', 'js/keywords.js', 'js/scripts.js']) { try { vm.runInContext(read(f), box, { filename: f }); } catch (e) { T('nạp ' + f + ' trong vm', false, e.message); } }
const D = box.HTDC_DATA || {}, K = box.HTDC_KEYWORDS || {}, SC = box.HTDC_SCRIPTS || {};
const filled = o => o && typeof o === 'object' && Object.keys(o).length > 0;
const reviewBad = (label, it) => {
  if (!it || typeof it !== 'object') return label + ' (không phải object)';
  if (!['draft', 'approved'].includes(it.status)) return label + ' status=' + it.status;
  if (typeof it.reviewer !== 'string' || typeof it.reviewedAt !== 'string') return label + ' thiếu reviewer/reviewedAt';
  if (it.status === 'approved' && (!it.reviewer.trim() || !/^\d{4}-\d{2}-\d{2}/.test(it.reviewedAt))) return label + ' approved mà thiếu người duyệt / ngày';
  return null;
};
const items = v => (Array.isArray(v) ? v.map((x, k) => [(x && (x.id || x.code)) || k, x]) : Object.entries(v || {}));
const GROUPS = [
  ['D.EXERCISES', D.EXERCISES, 'T-02'], ['SC.SCRIPTS', SC.SCRIPTS, 'T-05'], ['D.STAGE_CARDS', D.STAGE_CARDS, 'T-02'],
  ['K.groups', K.groups, 'T-02'], ['D.CARDS', D.CARDS, 'T-02'], ['D.SEND_WORDS', D.SEND_WORDS, 'T-02 / T-08']
];
for (const [label, v, task] of GROUPS) {
  if (!filled(v)) { WAIT(label + ': mỗi mục có status / reviewer / reviewedAt', 'CHỜ ' + task + ' — chưa có ' + label); continue; }
  const bad = 'status' in v ? [reviewBad(label, v)].filter(Boolean) : items(v).map(([k, x]) => reviewBad(label + '.' + k, x)).filter(Boolean);
  T(label + ': ' + ('status' in v ? 'nhóm' : 'mỗi mục') + ' có status draft|approved, reviewer, reviewedAt (PRD 8.8)', !bad.length, bad.join(', '));
}
if (filled(K.body)) { const b = reviewBad('K.body', K.body); T('K.body (8.2b): có status / reviewer / reviewedAt', !b, b); } else WAIT('K.body có status', 'CHỜ T-02');
{
  const t = D.TEXT && D.TEXT.safety;
  if (!filled(D.TEXT)) WAIT('D.TEXT.safety (câu an toàn M08, M19, M20, thẻ): có status / reviewer / reviewedAt', 'CHỜ T-02 — chưa có D.TEXT');
  else {
    /* T-Q2: chốt T-I1 (tech design 13) — câu an toàn là khóa phẳng 'safety.*' của D.TEXT, duyệt theo NHÓM ở
       D.CONTENT_GROUPS mục code:'safety'; D.REVIEW chỉ là mặc định, không có trường con. */
    const flat = Object.keys(D.TEXT).filter(k => /^safety\./.test(k));
    const grp = Array.isArray(D.CONTENT_GROUPS) ? D.CONTENT_GROUPS : [];
    const gOf = c => grp.find(g => g && g.code === c);
    if (!t && flat.length) {
      const b = reviewBad('D.CONTENT_GROUPS.safety', gOf('safety'));
      T('D.TEXT "safety.*" (' + flat.length + ' câu an toàn): duyệt theo nhóm D.CONTENT_GROUPS code:"safety" có status / reviewer / reviewedAt (tech design 13, K-14)', !!gOf('safety') && !b, b || 'không có nhóm safety');
      const miss = ['safety', 'text', 'exercises', 'scripts', 'keywords', 'stage_cards', 'send_words'].filter(c => !gOf(c) || reviewBad(c, gOf(c)));
      T('D.CONTENT_GROUPS đủ nhóm safety, text, exercises, scripts, keywords, stage_cards, send_words, mỗi nhóm có trạng thái duyệt', !miss.length, miss.join(', '));
      T('D.REVIEW chỉ là giá trị mặc định (draft, không trường con) — tech design 13', !!D.REVIEW && D.REVIEW.status === 'draft' && Object.keys(D.REVIEW).sort().join() === 'reviewedAt,reviewer,status', JSON.stringify(D.REVIEW));
      const appSrc = read('js/app.js'), stopSrc = read('js/stop.js');
      T('app.js (M19, M20) và stop.js (M08, M09) đọc trạng thái câu an toàn từ nhóm "safety" của CONTENT_GROUPS', /review\(\s*'safety'\s*\)/.test(appSrc) && /CONTENT_GROUPS[\s\S]{0,80}code\s*===\s*'safety'/.test(stopSrc), 'không thấy review(\'safety\') hoặc safetyRev');
    }
    else {
    const b = t && (reviewBad('D.TEXT.safety', t) === null ? null : items(t).filter(([k]) => !['status', 'reviewer', 'reviewedAt'].includes(k)).map(([k, x]) => (typeof x === 'object' ? reviewBad('D.TEXT.safety.' + k, x) : 'D.TEXT.safety.' + k + ' là chuỗi mà nhóm không có status')).filter(Boolean).join(', '));
    T('D.TEXT.safety (câu an toàn): có status / reviewer / reviewedAt ở nhóm hoặc từng câu (K-14 vẫn hiện khi draft)', !!t && !b, t ? b : 'không có D.TEXT.safety');
    }
  }
}
if (filled(D.EXERCISES)) {
  const list = Array.isArray(D.EXERCISES) ? D.EXERCISES : Object.entries(D.EXERCISES).map(([k, x]) => Object.assign({ id: k }, x));
  const B = ['PAUSE5', 'BREATHE_46', 'GROUND_54321', 'RELEASE', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN', 'CALM_SOUND', 'WARM_HAND_DAY'];
  const bad = B.filter(id => { const x = list.find(y => y && y.id === id); return !x || !x.goal || typeof x.safety !== 'string' || typeof x.min !== 'number' || typeof x.max !== 'number' || !x.type; });
  T('AC-50: B1–B8 đủ goal, safety, min, max, type', !bad.length, bad.join(', '));
} else WAIT('AC-50: B1–B8 đủ trường', 'CHỜ T-02');
if (filled(SC.SCRIPTS)) {
  const bad = ['NIGHT_HOME', 'NIGHT_HOME_SHORT', 'NIGHT_TOGETHER', 'NIGHT_WARM_HAND'].filter(id => { const b = (SC.SCRIPTS[id] || {}).blocks || []; const tags = b.flatMap(x => x.tags || []); return !tags.includes('safety_open') || !tags.includes('close_whatever'); });
  T('AC-43: mỗi bài H1–H4 có khối safety_open và close_whatever', !bad.length, bad.join(', '));
} else WAIT('AC-43: tag safety_open / close_whatever', 'CHỜ T-05');
{
  const hb = grep('code', /holdsBreath['"]?\s*:|\.holdsBreath\s*=(?!=)|\[['"]holdsBreath['"]\]\s*=(?!=)/);
  T('AC-36: không nơi nào khai báo / gán trường holdsBreath (đọc để loại trừ thì được)', !hb.length, hb.join(', '));
  const bodyFiles = ['js/data.js', 'js/players.js', 'js/stop.js', 'js/scripts.js'].filter(exists);
  const squeeze = [], hold = [], b3 = [];
  for (const f of bodyFiles) for (const s of scan(read(f)).strings) {
    const t = s.text.normalize('NFC').toLowerCase();
    for (const m of t.matchAll(/siết/g)) { const win = t.slice(Math.max(0, m.index - 40), m.index + 40); if (/bụng/.test(win) && !/không\s+(cần\s+)?siết/.test(t.slice(Math.max(0, m.index - 12), m.index + 4))) squeeze.push(f + ':' + s.line); }
    for (const m of t.matchAll(/nín\s+(thở|hơi)|giữ\s+hơi|giữ\s+hơi\s+thở/g)) if (!/không(\s+cần)?\s*$/.test(t.slice(Math.max(0, m.index - 12), m.index))) hold.push(f + ':' + s.line + ' "' + m[0] + '"');
    if (f === 'js/players.js' && /bụng/.test(t) && !/thả lỏng|không siết/.test(t)) b3.push(f + ':' + s.line);
  }
  T('AC-36: B4 không có "siết" gần "bụng" (trừ "không siết")', !squeeze.length, squeeze.join(', '));
  T('style guide 6 / V7: không câu bảo nín thở / giữ hơi (trừ "không nín", "không cần giữ hơi")', !hold.length, hold.join(', '));
  W('B3 không có bước cảm giác trong bụng (PRD 6.4): chuỗi có "bụng" trong players.js cần người xem lại', !b3.length, b3.join(', '));
}
if (filled(D.EMOTIONS)) {
  const imgs = JSON.stringify(D.EMOTIONS);
  const miss = ['vui_ve', 'dau_kho', 'lo_lang', 'tuc_gian', 'hoang_hot', 'kho_chiu', 'met_moi', 'binh_an', 'co_don'].map(x => x + '.png').filter(x => !imgs.includes('"' + x + '"'));
  T('9 ảnh capybara đúng tên file của checkin-V2 (tech design 16 R3)', !miss.length, 'thiếu: ' + miss.join(', '));
} else WAIT('9 ảnh capybara đúng tên file', 'CHỜ T-02');

/* ===== 11. Chèn HTML (AC-05) ===== */
section('11. Chèn HTML: chuỗi người dùng / máy qua esc() (AC-05, tech design 3.3)');
{
  const RISKY = /\.(?:name|text|note|label|value|thought|know|unknown|todo|title|body|msg|message|detail|reason|words|line)\b|\b(?:note|thought|draft|input|userText|raw|typed)\b/;
  const SAFE = /(?:\b[\w$]+\.)?\b(?:esc|t|tt|encodeURIComponent|String\(Number|Number|Math\.\w+|draftLine|fmtDay|toFixed)\s*\(/g;
  const strip = expr => { let s = expr, g = 0; for (let m; (m = SAFE.exec(s)) && g++ < 200;) { let i = m.index + m[0].length, d = 1; while (i < s.length && d) { if (s[i] === '(') d++; else if (s[i] === ')') d--; i++; } s = s.slice(0, m.index) + 'SAFE' + s.slice(i); SAFE.lastIndex = m.index + 4; } return s; };
  const part = expr => { let e = strip(expr).replace(/[\w$.]+\.length\b/g, 'NUM'); for (let k = 0; k < 5; k++) e = e.replace(/`[^`]*`/g, 'TPL'); e = e.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, 'STR'); for (let k = 0; k < 5; k++) e = e.replace(/\{[^{}]*\}/g, 'BLK'); const q = e.indexOf('?'); if (q >= 0) e = e.slice(q + 1); const a = e.lastIndexOf('&&'); if (a >= 0) e = e.slice(a + 2); return e; };
  const raw = [];
  /* Hàm trợ giúp cùng file có thân gọi esc( (vd X = (api, s) => api.esc(api.say(s)), choice(...) esc từng tham số) → coi là an toàn */
  /* Đã xem tay từng hàm (QA 10/11/2026): mọi tham số chữ đều qua esc() bên trong. Hàm mới muốn vào danh sách thì QA xem lại. */
  const SAFE_HELPERS = { 'js/app.js': ['choice'] };
  const helpers = f => { const out = (SAFE_HELPERS[f] || []).slice(); for (const m of SRC[f].code.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>\s*(?:[\w$]+\.)?esc\s*\(/g)) out.push(m[1]); return out; };
  for (const f of JS) { const hs = helpers(f); const re = hs.length ? new RegExp('(?<![\\w$.])(?:' + hs.map(h => h.replace(/\$/g, '\\$')).join('|') + ')\\s*\\(', 'g') : null;
    for (const it of SRC[f].interps) { let e = it.expr; if (re) { let g = 0; for (let m; (re.lastIndex = 0, m = re.exec(e)) && g++ < 50;) { let i = m.index + m[0].length, d = 1; while (i < e.length && d) { if (e[i] === '(') d++; else if (e[i] === ')') d--; i++; } e = e.slice(0, m.index) + 'SAFE' + e.slice(i); } }
      if (it.tplHasTag && RISKY.test(part(e))) raw.push(f + ':' + it.line + ' ${' + it.expr.slice(0, 50) + '}'); } }
  T('template HTML không chèn .text/.note/.label/.value/.thought… mà không qua esc() / t()', !raw.length, raw.join(' | '));
  const adj = grep('bare', /insertAdjacentHTML|outerHTML\s*=|document\s*\.\s*write\s*\(/);
  T('không insertAdjacentHTML / outerHTML= / document.write', !adj.length, adj.join(', '));
  const ih = [];
  for (const f of JS) { const c = SRC[f].code; const g = /\.innerHTML\s*\+?=\s*([^;\n]*)/g; let m; while ((m = g.exec(c))) if (/getItem\s*\(|JSON\.parse\s*\(|location\.|\.value\b|\.note\b|\.thought\b/.test(m[1])) ih.push(f + ':' + lineOf(c, m.index)); }
  T('innerHTML không nhận thẳng dữ liệu storage / ô nhập / URL', !ih.length, ih.join(', '));
}

/* ===== 12. File thuần (6.1) ===== */
section('12. File thuần (tech design 6.1, 7.2)');
for (const f of ['js/util.js', 'js/data.js', 'js/keywords.js', 'js/scripts.js', 'js/engine.js', 'js/pacer.js'].filter(exists)) {
  const b = SRC[f].bare, why = [];
  if (/\bdocument\s*\.|\bwindow\s*\.\s*(?:addEventListener|location|document|navigator)|\bnavigator\s*\./.test(b)) why.push('DOM / navigator');
  if (/localStorage|sessionStorage|indexedDB/.test(b)) why.push('storage');
  if (/Date\s*\.\s*now\s*\(|new\s+Date\s*\(\s*\)/.test(b)) why.push('tự lấy giờ');
  if (f !== 'js/util.js' && /Math\s*\.\s*random\s*\(/.test(b)) why.push('Math.random (xáo dùng U.randInt / crypto)');
  if (f !== 'js/util.js' && /getTimezoneOffset|\bIntl\b/.test(b)) why.push('đọc múi giờ (chỉ U.tzAt)');
  if (/setTimeout|setInterval|requestAnimationFrame/.test(b)) why.push('hẹn giờ');
  T(f + ' thuần: không DOM, storage, tự lấy giờ, hẹn giờ' + (f === 'js/util.js' ? '' : ', Math.random, múi giờ'), !why.length, why.join(', '));
}

/* ===== 13. Lưu trữ, giai đoạn (AC-11, 17, 20) ===== */
section('13. Ai được ghi gì (AC-11, AC-17, AC-20)');
{
  const ws = grep('bare', /\b(?:localStorage|sessionStorage)\b/).filter(h => !h.startsWith('js/store.js:'));
  T('chỉ js/store.js chạm thẳng localStorage (sessionStorage cấm ở mục 4)', !ws.length, ws.join(', '));
  const st = [];
  for (const f of JS) { const c = SRC[f].code; for (const m of c.matchAll(/prefs\s*\.\s*set\s*\(\s*['"`]stage['"`]/g)) if (!['js/app.js', 'js/mydata.js'].includes(f)) st.push(f + ':' + lineOf(c, m.index)); for (const m of c.matchAll(/\bsetStage\s*\(/g)) if (!['js/app.js', 'js/mydata.js'].includes(f)) st.push(f + ':' + lineOf(c, m.index) + ' setStage('); }
  T('AC-17: chỉ app.js (M04, M21) và mydata.js (M18) đổi giai đoạn (setStage / prefs.set("stage"))', !st.length, st.join(', '));
  const auto = grep('bare', /setStage\s*\([^)]*\b(?:now|today|Date|day)\b/);
  T('AC-17: không đổi giai đoạn theo thời gian (setStage không nhận giờ / ngày)', !auto.length, auto.join(', '));
  if (exists('js/mydata.js') && SRC['js/mydata.js'].strings.length > 5) {
    const named = []; for (const f of JS) for (const x of SRC[f].strings) if (/hanh-trinh-don-con[^/]*\.(json|csv)|Hanh.?Trinh.*\.(json|csv)/i.test(x.text)) named.push(f + ':' + x.line);
    T('L-2: tên tệp xuất không có tên app; mydata.js dùng tiền tố "du-lieu-cua-minh-"', !named.length && SRC['js/mydata.js'].strings.some(x => x.text.startsWith('du-lieu-cua-minh-')), named.join(', ') || 'không thấy "du-lieu-cua-minh-"');
  } else WAIT('L-2: tên tệp xuất "du-lieu-cua-minh-…"', 'CHỜ T-03');
}


/* ===== 7. Ngân sách (11.1) ===== */
section('7. Ngân sách (11.1)');
const KB = 1024, kb = n => (n / KB).toFixed(1) + ' KB';
const code = ['index.html', ...STYLES, ...SCRIPTS].filter(exists);
const codeBytes = code.reduce((a, f) => a + size(f), 0);
const gzBytes = code.reduce((a, f) => a + zlib.gzipSync(fs.readFileSync(path.join(APP, f)), { level: 9 }).length, 0);
const fonts = [...new Set([...read('styles.css').matchAll(/url\(\s*['"]?([^'")]+\.woff2?)['"]?\s*\)/g)].map(m => m[1]))];
const fontMissing = fonts.filter(f => !exists(f));
T('font được @font-face tham chiếu đều tồn tại', !fontMissing.length, fontMissing.join(', '));
const fontBytes = fonts.filter(exists).reduce((a, f) => a + size(f), 0);
const art = [...listFiles('assets/art', '.svg'), ...(exists('assets/icon.svg') ? ['assets/icon.svg'] : [])];
const artBytes = art.reduce((a, f) => a + size(f), 0);
console.log('      HTML+CSS+JS ' + kb(codeBytes) + ' chưa nén · ' + kb(gzBytes) + ' gzip (' + code.length + ' file) · font ' + kb(fontBytes) + ' (' + fonts.length + ') · hình ' + kb(artBytes) + ' (' + art.length + ') · lần tải đầu ' + kb(codeBytes + fontBytes + artBytes));
T('HTML + CSS + JS chưa nén ≤ 480 KB (trần cứng, A1 + A2)', codeBytes <= 480 * KB, kb(codeBytes));
T('HTML + CSS + JS gzip ≤ 175 KB (trần cứng; zlib level 9 từng file rồi cộng)', gzBytes <= 175 * KB, kb(gzBytes));
T('lần tải đầu ≤ 560 KB (trần cứng; code + font + assets/art + icon; không tính 9 ảnh capybara)', codeBytes + fontBytes + artBytes <= 560 * KB, kb(codeBytes + fontBytes + artBytes));
W('hình SVG ≤ 45 KB (mục tiêu)', artBytes <= 45 * KB, kb(artBytes));
// T-Q2: bảng 11.1 chia lại ở T-I1 (10/11/2026); chia lại lần 2 ở n-6 (architect, 10/11/2026) theo số đo A1 sau review lượt 2:
// file A1 đang sửa nhiều chừa ≥ 2 KB, file A1 khác ≥ 0,1 KB, A2 giữ 72 KB; cộng đúng 480 KB = trần cứng (dự phòng chung 0)
const TARGET = { 'index.html': 3, 'styles.css': 36, 'css/stop.css': 8, 'css/night.css': 7, 'css/data.css': 3, 'css/together.css': 7, 'css/care.css': 6,
  'js/config.js': 2, 'js/util.js': 6, 'js/data.js': 44, 'js/keywords.js': 15, 'js/scripts.js': 20, 'js/engine.js': 25, 'js/pacer.js': 5,
  'js/idb.js': 11, 'js/store.js': 28, 'js/sound.js': 10, 'js/players.js': 39, 'js/app.js': 57, 'js/stop.js': 35, 'js/night.js': 37,
  'js/mydata.js': 17, 'js/together.js': 33, 'js/care.js': 13, 'js/journal.js': 13 };
const A2F = ['css/together.css', 'css/care.css', 'js/together.js', 'js/care.js', 'js/journal.js'];
const tSum = Object.values(TARGET).reduce((a, b) => a + b, 0), tA2 = A2F.reduce((a, f) => a + (TARGET[f] || 0), 0);
T('bảng TARGET cộng = 480 KB và ≤ trần cứng 480 KB (11.1, chia lại n-6)', tSum === 480, tSum);
T('bảng TARGET chừa cho A2 (together/care/journal) = 72 KB (11.1)', tA2 === 72, tA2);
{ const nf = code.filter(f => !(f in TARGET)); T('mọi file index.html nạp đều có trần mục tiêu trong TARGET', !nf.length, nf.join(', ')); }
const over = Object.entries(TARGET).filter(([f, n]) => exists(f) && size(f) > n * KB).map(([f, n]) => f + ' ' + kb(size(f)) + ' > ' + n + ' KB');
W('trần mục tiêu từng file (bảng 11.1; chủ file tự gọt)', !over.length, over.join(', '));

console.log('\nngân sách: ' + kb(codeBytes) + ' chưa nén · ' + kb(gzBytes) + ' gzip · lần tải đầu ' + kb(codeBytes + fontBytes + artBytes));
console.log('check-static: ' + passes + ' PASS · ' + fails + ' FAIL · ' + warns + ' WARN · ' + waits + ' CHỜ' + (STRICT ? ' (--strict)' : ''));
process.exitCode = fails ? 1 : 0;
