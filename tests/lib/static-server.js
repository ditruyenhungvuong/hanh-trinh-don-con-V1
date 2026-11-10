/* =========================================================
   Server tĩnh cho test Hành Trình Đón Con (Chủ: qa-tester; T-00 chép 10/11/2026). KHÔNG sửa file gốc trên đĩa.
   Nguồn: apps/sung-suc/tests/lib/static-server.js @ 10/11/2026 (gốc apps/lifestyle-thai-phu, ADR 0008). Chỗ khác bản gốc ghi "HTDC: …".
   Cổng: smoke/e2e 8775 (tech design 14), server dev của devops 8774.
   - Đọc toàn bộ file app (đệ quy, bỏ tests/ và .git/) vào bộ nhớ một lần lúc khởi động.
   - HTDC: không có mock Apps Script (app không gọi mạng). Tùy chọn assetBase: vá dòng ASSET_BASE trong js/config.js
     (ví dụ '/__capy/' để ảnh capybara lấy từ server test, '' để chỉ emoji, '/__404/' để thử ảnh lỗi → emoji).
   - HTDC: /__capy/<tên>.png trả một PNG 1×1 (ảnh giả, tech design 14.3); /__404/… trả 404.
   - Chỉ nghe 127.0.0.1.
   Dùng: const { startStatic } = require('./lib/static-server');
         const srv = await startStatic({ port, appDir, assetBase: '/__capy/' }); … await srv.close();
   ========================================================= */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
// PNG 1×1 trong suốt
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/* Sửa config.js trong bộ nhớ; tách hàm để test được */
function patchConfig(src, o) {
  let out = src;
  const setLine = (key, value) => {
    const re = new RegExp('^(\\s*' + key + ':\\s*)[^,\\n]+,', 'm');
    if (!re.test(out)) throw new Error('config.js: không thấy dòng ' + key);
    out = out.replace(re, '$1' + value + ',');
  };
  // HTDC: chỉ cho trỏ ảnh về server test (đường dẫn tương đối) hoặc rỗng — không bao giờ host ngoài
  if (typeof o.assetBase === 'string') {
    if (o.assetBase && !/^\/__[a-z0-9]+\/$/.test(o.assetBase)) throw new Error('assetBase phải dạng /__xxx/ hoặc rỗng: ' + o.assetBase);
    setLine('ASSET_BASE', JSON.stringify(o.assetBase));
  }
  return out;
}

function readTree(dir, base, files) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'tests' || name === '.git' || name === 'node_modules') continue;
    const f = path.join(dir, name);
    const rel = path.relative(base, f).split(path.sep).join('/');
    const st = fs.statSync(f);
    if (st.isDirectory()) readTree(f, base, files);
    else files[rel] = fs.readFileSync(f);
  }
  return files;
}

function startStatic(opts) {
  const appDir = path.resolve(opts.appDir);
  const files = readTree(appDir, appDir, {});
  if (!files['index.html'] || !files['js/config.js']) throw new Error('Thiếu index.html hoặc js/config.js ở ' + appDir);
  files['js/config.js'] = Buffer.from(patchConfig(files['js/config.js'].toString('utf8'), opts), 'utf8');
  const log = [];
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { rel = '/'; }
    rel = rel === '/' ? 'index.html' : rel.replace(/^\/+/, '');
    log.push(req.method + ' ' + rel);
    let data = Object.prototype.hasOwnProperty.call(files, rel) ? files[rel] : null;
    if (!data && /^__capy\/[a-z_]+\.png$/.test(rel)) data = PNG_1PX;   // HTDC: ảnh capybara giả
    if (!data) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
    res.end(data);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(opts.port, '127.0.0.1', () => resolve({
      url: 'http://127.0.0.1:' + opts.port + '/',
      servedConfig: files['js/config.js'].toString('utf8'),
      requestLog: log,
      close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(() => r()); })
    }));
  });
}

module.exports = { startStatic, patchConfig };
