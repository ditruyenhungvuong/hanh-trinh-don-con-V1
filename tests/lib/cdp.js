/* =========================================================
   Thư viện Chrome DevTools Protocol tối giản cho test E2E – Hành Trình Đón Con (Chủ: qa-tester; T-00 chép 10/11/2026).
   Nguồn: apps/sung-suc/tests/lib/cdp.js @ 10/11/2026 (gốc apps/lifestyle-thai-phu, ADR 0008). Chỗ khác bản gốc ghi "HTDC: …".
   Không dependency ngoài Node ≥ 22 (dùng WebSocket và fetch có sẵn).
   - launch(): mở Chrome headless với --remote-debugging-port=0, user-data-dir riêng,
     chỉ tắt đúng tiến trình Chrome do test sinh ra (child.kill), KHÔNG đụng Chrome của người dùng.
   - Page: send(method, params), on(event, fn), evaluate(expr), navigate(url), click(selector),
     type(text), key(name), screenshot(file).
   - Sung Sức (T-Q2, 02/11/2026): launch() trả thêm `browser`:
       browser.newTarget(url, { isolated }) → Page của một tab mới (isolated: browser context riêng = "máy sạch",
       không chung Web Storage / IndexedDB với tab đầu); page.closeTab() đóng tab và context.
       browser.userAgent() → User-Agent gốc (để trả lại sau Emulation.setUserAgentOverride).
   - HTDC (T-Q2, 10/11/2026): newTarget(url, { context: id }) mở tab trong context CÓ SẴN (hai tab cùng "máy" cho ca
       BroadcastChannel); page.contextId = id context của tab; closeTab() chỉ hủy context do chính nó tạo.
   ========================================================= */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message + ' (' + m.error.data + ')')) : resolve(m.result);
      } else if (m.method) {
        (this.listeners.get(m.method) || []).forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  once(method) { return new Promise(r => this.on(method, r)); }

  /* Chạy biểu thức trong trang, trả về giá trị JSON. Biểu thức có thể là Promise. */
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('evaluate: ' + (d.exception && d.exception.description || d.text));
    }
    return r.result.value;
  }
  async navigate(url) {
    const loaded = this.once('Page.loadEventFired');
    await this.send('Page.navigate', { url });
    await loaded;
  }
  /* Tọa độ tâm phần tử (theo viewport) để click thật bằng chuột */
  async center(selector) {
    const r = await this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    if (!r) throw new Error('không thấy ' + selector);
    return r;
  }
  async click(selector, clickCount) {
    const { x, y } = await this.center(selector);
    const n = clickCount || 1;
    for (let i = 1; i <= n; i++) {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: i });
      await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: i });
    }
  }
  /* Gõ chữ thật vào phần tử đang focus (sinh sự kiện input như bàn phím) */
  async type(text) { await this.send('Input.insertText', { text }); }
  /* Bấm một phím thật: 'Tab' | 'Enter' | 'Space' | 'Home' | 'End' | 'ArrowLeft' | 'ArrowRight' | 'Backspace' | 'Escape' */
  async key(name) {
    const map = {
      Tab: { key: 'Tab', code: 'Tab', vk: 9 },
      Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
      Space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
      Home: { key: 'Home', code: 'Home', vk: 36 },
      End: { key: 'End', code: 'End', vk: 35 },
      ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
      ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
      Backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
      Escape: { key: 'Escape', code: 'Escape', vk: 27 }
    };
    const k = map[name];
    if (!k) throw new Error('phím lạ ' + name);
    const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk };
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: k.text ? 'keyDown' : 'rawKeyDown' }, base, k.text ? { text: k.text, unmodifiedText: k.text } : {}));
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
  }
  async screenshot(file, fullPage) {
    const params = { format: 'png' };
    if (fullPage) {
      const m = await this.send('Page.getLayoutMetrics');
      const cs = m.cssContentSize || m.contentSize;
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: Math.ceil(cs.width), height: Math.ceil(cs.height), scale: 1 };
    }
    const r = await this.send('Page.captureScreenshot', params);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  }
  close() { try { this.ws.close(); } catch (e) { /* bỏ qua */ } }
}

/* Mở Chrome headless; trả { page, kill } */
async function launch(opts) {
  const o = opts || {};
  const ud = o.userDataDir;
  fs.rmSync(ud, { recursive: true, force: true });
  fs.mkdirSync(ud, { recursive: true });
  const args = [
    '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + ud,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--mute-audio', '--hide-scrollbars',
    '--window-size=' + (o.width || 375) + ',' + (o.height || 900)
  ].concat(o.extraArgs || [], ['about:blank']);
  const child = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d; });
  try {
    const portFile = path.join(ud, 'DevToolsActivePort');
    let port = '';
    for (let i = 0; i < 300 && !port; i++) {
      /* Chrome ghi file này trong lúc khởi động; có lúc tồn tại nhưng còn khóa/rỗng → đọc lại */
      try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim(); } catch (e) { port = ''; }
      if (!/^\d+$/.test(port)) { port = ''; await sleep(100); }
    }
    if (!port) throw new Error('Chrome không mở cổng debug:\n' + stderr);
    let targets = [];
    for (let i = 0; i < 50; i++) {
      try { targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); } catch (e) { /* chờ */ }
      if (targets.some(t => t.type === 'page')) break;
      await sleep(100);
    }
    const target = targets.find(t => t.type === 'page');
    if (!target) throw new Error('Chrome không có target page');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const page = new Page(ws);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Network.enable');
    await page.send('Log.enable');
    const kill = () => { page.close(); try { child.kill(); } catch (e) { /* đã tắt */ } };
    const base = 'http://127.0.0.1:' + port;
    const browser = {
      async userAgent() { return (await (await fetch(base + '/json/version')).json())['User-Agent']; },
      async newTarget(url, opt) {
        const ver = await (await fetch(base + '/json/version')).json();
        const bws = new WebSocket(ver.webSocketDebuggerUrl);
        await new Promise((res, rej) => { bws.onopen = res; bws.onerror = rej; });
        const bp = new Page(bws);
        const own = !!(opt && opt.isolated && !opt.context);
        const ctx = opt && opt.context ? opt.context : own ? (await bp.send('Target.createBrowserContext', { disposeOnDetach: false })).browserContextId : undefined;
        const { targetId } = await bp.send('Target.createTarget', Object.assign({ url: 'about:blank' }, ctx ? { browserContextId: ctx } : {}));
        const tws = new WebSocket('ws://127.0.0.1:' + port + '/devtools/page/' + targetId);
        await new Promise((res, rej) => { tws.onopen = res; tws.onerror = rej; });
        const p = new Page(tws);
        for (const d of ['Page', 'Runtime', 'Network', 'Log']) await p.send(d + '.enable');
        p.contextId = ctx;
        p.closeTab = async () => {
          p.close();
          try { await bp.send('Target.closeTarget', { targetId }); } catch (e) { /* đã đóng */ }
          if (ctx && own) { try { await bp.send('Target.disposeBrowserContext', { browserContextId: ctx }); } catch (e) { /* bỏ qua */ } }
          bp.close();
        };
        if (url) await p.navigate(url);
        return p;
      }
    };
    return { page, kill, child, browser };
  } catch (e) {
    try { child.kill(); } catch (e2) { /* đã tắt */ }
    throw e;
  }
}

module.exports = { launch, sleep, CHROME };
