/* Hành Trình Đón Con – js/app.js · lõi · Chủ: FE-1 Lõi
   Nguồn: apps/sung-suc/js/app.js @ 10/11/2026 (lifecycle, router stack + history gen/depth, delegation, registry,
   toast, dialog, confirmTwice, download, copyText) — ADR 0008. Chỗ khác bản gốc: bỏ tab bar, hồ sơ, banner nhắc.
   Nguồn: apps/checkin-me-bau/script.js:370–433 @ 10/11/2026 (ảnh lỗi → emoji, xáo thẻ) → capyCards.
   Đặc tả: tech design 3.2–3.4, 4, 4.1, 5.1, 6.4, 10; UX 2.2–2.4, 4.0–4.4, 5, 8–10, 12; PRD 3.6, 3.8, 8.5, phụ lục A.
   Khung T-00 (architect, 10/11/2026). FE-1 (T-01, 10/11/2026): màn chung, capyCards, dots10, safetyGate, piiPanel,
   shareText/shareApp, setStage ghi StageRec, L13 lỗi bộ nhớ.
   Câu chữ màn chung nằm ở D.TEXT (data.js; T-I1 chuyển CT sang), TRẠNG THÁI DRAFT (PRD phụ lục A, chờ van-phong-bs-thong
   + anh duyệt). Câu ghi [FE] là chữ mới của FE-1.
   Không Web Speech, Notification, alert/confirm, mạng. */
(() => {
  'use strict';
  const C = window.HTDC_CONFIG, U = window.HTDC_UTIL, S = window.HTDC_STORE;
  const D = window.HTDC_DATA || {}, K = window.HTDC_KEYWORDS || {}, SC = window.HTDC_SCRIPTS || {}, E = window.HTDC_ENGINE || {};
  const PC = window.HTDC_PACER || {}, SOUND = window.HTDC_SOUND || {}, P = window.HTDC_PLAYERS || {};
  const esc = U.esc, isFn = f => typeof f === 'function';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // session: cờ an toàn của phiên, KHÔNG BAO GIỜ ghi xuống máy (tech design 5.3); module chỉ ghi state.ui.<tên module>
  const state = { stack: [], session: { flags: new Set(), stopId: null, attempt: 0, gateAnswered: {} }, ui: {}, blocked: false };
  const TX = D.TEXT || {};
  const DRAFT = 'Bản thử nghiệm: nội dung chưa được hội đồng chuyên môn phê duyệt. Không phải công cụ chẩn đoán hay điều trị.';
  const DRAFT_REV = { status: 'draft', reviewer: '', reviewedAt: '' };

  /* ===== Câu chữ màn chung: mọi chữ ở D.TEXT (data.js). T-I1 (10/11/2026): CT cũ đã chuyển sang D.TEXT (tech design 11.1) ===== */

  /* ===== Danh mục (data.js, FE-2) ===== */
  const ROLE_ICON = { wife: '👩', husband: '👨', solo: '🙂', none: '🤍' };
  const roles = () => (D.ROLES || []).map(r => ({ code: r.code, label: (ROLE_ICON[r.code] || '') + ' ' + r.label, sub: r.hint || '' }));
  const STAGE_CODES = ['start', 'cycle', 'waiting', 'after_loss', 'pause', 'positive', 'none'];
  const stages = () => (D.STAGES || []).filter(x => STAGE_CODES.includes(x.code)).map(x => ({ code: x.code, icon: x.icon || '', label: String(x.label || ''), sub: String(x.desc || '') }));
  const stageLabel = x => (x.icon && !x.label.startsWith(x.icon) ? x.icon + ' ' : '') + x.label;
  const emotions = () => (D.EMOTIONS || []).filter(e => e && e.code && e.label).map(e => ({ code: e.code, label: String(e.label), emoji: e.emoji || '🙂', img: e.img || null }));
  // Tư thế hai bé capybara có file assets/art/capy-pair-<tư thế>.svg (T-06, 10/11/2026); tư thế lạ → 🐾🐾 (không request 404)
  const ART = ['side', 'blanket', 'look_up', 'sleep', 'bell'];

  /* ===== Lifecycle: dọn khi đổi màn ===== */
  let cleanups = [], currentActions = null;
  const lifecycle = {
    later(fn, ms) { const id = setTimeout(fn, ms); cleanups.push(() => clearTimeout(id)); return id; },
    every(fn, ms) { const id = setInterval(fn, ms); cleanups.push(() => clearInterval(id)); return id; },
    loop(fn) {
      let alive = true, last = performance.now();
      const step = t => { if (!alive) return; fn(Math.min(0.1, (t - last) / 1000), t); last = t; requestAnimationFrame(step); };
      requestAnimationFrame(step);
      cleanups.push(() => { alive = false; });
    },
    on(el, type, fn, o) { el.addEventListener(type, fn, o); cleanups.push(() => el.removeEventListener(type, fn, o)); },
    onCleanup(fn) { cleanups.push(fn); }
  };
  const lifecycleGlobal = { on(el, type, fn, o) { el.addEventListener(type, fn, o); }, every: (fn, ms) => setInterval(fn, ms) };
  function runCleanups() {
    const list = cleanups; cleanups = []; currentActions = null;
    list.forEach(fn => { try { fn(); } catch (e) { /* bỏ qua */ } });
  }

  /* ===== Sự kiện app: done, stage, store, visible ===== */
  const bus = {};
  const on = (ev, fn) => { (bus[ev] = bus[ev] || []).push(fn); };
  const emit = (ev, x) => (bus[ev] || []).slice().forEach(fn => { try { fn(x); } catch (e) { /* bỏ qua */ } });

  /* ===== Giờ, vai, giai đoạn, xưng hô (mọi màn lấy giờ qua đây; e2e shim Date) ===== */
  const now = () => Date.now();
  const hour = () => U.hourOf(now(), U.tzAt(now()));
  const today = () => U.dayOf(now(), U.tzAt(now()));
  const pref = k => { try { return S.prefs.get(k); } catch (e) { return undefined; } };
  const role = () => { const r = pref('role'); return ROLE_ICON[r] ? r : null; };
  const stage = () => { const c = (pref('stage') || {}).code; return STAGE_CODES.includes(c) ? c : null; };
  // AC-14: vợ → chị, chồng → anh, còn lại → bạn
  const xung = () => ({ wife: 'chị', husband: 'anh' })[role()] || 'bạn';
  // {nt}: "Mình đi một mình" → "một người thương {xung}" (kịch bản H3, chờ anh duyệt câu ghép), còn lại "người thương"
  const ntOf = () => (role() === 'solo' ? 'một người thương {xung}' : 'người thương');
  const say = (str, ctx) => U.say(str, { xung: (ctx && ctx.xung) || xung(), nt: (ctx && ctx.nt) || ntOf() });
  // Chữ thô (chưa esc): D.TEXT[key] → key; thay xưng hô rồi {biến} khác trong vars
  function tr(key, vars) {
    let s = TX[key];
    if (typeof s !== 'string') s = String(key);
    s = say(s, vars);
    if (vars) for (const k of Object.keys(vars)) if (k !== 'xung' && k !== 'nt') s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }
  const t = (key, vars) => esc(tr(key, vars));

  /* ===== Router: stack + history {gen, depth} ===== */
  const SCREENS = {};
  // Màn KHÔNG cần đã chọn cách dùng (M01); mọi màn khác chưa chọn → về welcome (tech design 3.4)
  const FREE = ['welcome', 'consent', 'support', 'urgent', 'about', 'never'];
  let gen = 0, fwd = [];
  const home = () => (S.mode() === 'unset' ? 'welcome' : 'home');
  const histState = () => ({ gen, depth: state.stack.length });
  const pushHist = () => { try { history.pushState(histState(), ''); } catch (e) { /* file:, sandbox */ } };
  const replaceHist = () => { try { history.replaceState(histState(), ''); } catch (e) { /* bỏ qua */ } };
  const current = () => state.stack[state.stack.length - 1] || { name: 'welcome', params: {} };
  function go(name, params = {}, opts = {}) {
    const top = state.stack[state.stack.length - 1];
    if (opts.replace && top) { state.stack.splice(-1, 1, { name, params }); replaceHist(); }
    else {
      if (top && top.name === name && JSON.stringify(top.params || {}) === JSON.stringify(params || {})) return false; // bấm đúp
      state.stack.push({ name, params }); fwd = []; pushHist();
    }
    render();
    return true;
  }
  function back() { if (state.stack.length > 1) history.back(); else resetTo(home()); }
  window.addEventListener('popstate', e => {
    const s = e.state;
    if (!s || s.gen !== gen) { replaceHist(); return; }
    const d = Math.max(1, s.depth | 0);
    if (d < state.stack.length) { fwd = state.stack.splice(d).concat(fwd); render(); }
    else if (d > state.stack.length && fwd.length >= d - state.stack.length) { state.stack.push(...fwd.splice(0, d - state.stack.length)); render(); }
    else replaceHist();
  });
  function resetTo(name, params = {}) { gen++; state.stack = []; fwd = []; return go(name, params); }
  const has = name => !!SCREENS[name];

  /* ===== Chế độ đêm: data-mode="night" (token Hừng Đông). Màn theme 'night' luôn tối; U1: máy để tối → cả app tối ===== */
  const darkMQ = (() => { try { return matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return null; } })();
  function applyMode(scr) {
    const night = (scr && scr.theme === 'night') || !!(darkMQ && darkMQ.matches);
    if (night) document.documentElement.dataset.mode = 'night'; else delete document.documentElement.dataset.mode;
  }
  // Tên tab: sau tin buồn hoặc màn noAppName → không có tên app (UX T-1, T-4; K-12, AC-22)
  function appTitle(scr) {
    const name = (scr && (scr.docTitle || scr.title)) || '';
    const hide = stage() === 'after_loss' || (scr && scr.noAppName);
    document.title = hide ? (name || 'Trang chính') : (name ? name + ' · ' : '') + C.APP_NAME;
  }

  /* ===== Vẽ màn, focus h1 ===== */
  function render() {
    runCleanups(); closeDialog();
    if (inputN !== toastN) hideToast();   // B-01: toast của màn trước không theo sang màn mới (giữ toast gọi ngay trước khi chuyển màn)
    let top = current(), scr = SCREENS[top.name];
    const to = !scr ? home() : (S.mode() === 'unset' && !FREE.includes(top.name)) ? 'welcome' : null;
    if (to && SCREENS[to] && to !== top.name) {
      top = { name: to, params: {} }; scr = SCREENS[to];
      state.stack[Math.max(0, state.stack.length - 1)] = top;
      replaceHist();
    }
    if (!scr) return;
    const params = top.params || {}, main = $('#main');
    applyMode(scr);
    renderHeader(top.name, scr);
    renderBanners();
    let okDraw = true;
    try { main.innerHTML = scr.render(params); } catch (e) {
      okDraw = false; console.error('HTDC: lỗi vẽ màn ' + top.name, e);
      main.innerHTML = '<h1>Màn này chưa mở được</h1><p>Mình quay lại trang trước nhé.</p>';
    }
    main.dataset.screen = top.name;
    appTitle(scr);
    if (okDraw && isFn(scr.mount)) scr.mount(main, params);
    scrollTo(0, 0);
    if ($('#toast').classList.contains('show')) placeToast();
    const h1 = main.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }
  // Header mọi màn (UX 4.0): [‹ hoặc hai bé capybara] · tên màn · [🤝 Hỗ trợ] (AC-01). M01, M05 không có ‹. Không tên app (T-2)
  function renderHeader(name, scr) {
    let left = '<span class="icon-btn" aria-hidden="true"></span>';
    if (name === 'home') left = `<span class="brand-mark" aria-hidden="true">${art('capy-mark', 44, '🐾🐾')}</span>`;
    else if (name !== 'welcome' && state.stack.length > 1) left = '<button type="button" class="icon-btn" data-act="back" aria-label="Quay lại">‹</button>';
    $('#header').innerHTML = `<div class="bar">${left}<span class="bar-title">${esc(scr.title || '')}</span>` +
      `<button type="button" class="pill-support" data-go="support"${name === 'support' ? ' aria-current="page"' : ''}>🤝 Hỗ trợ</button></div>`;
  }

  /* ===== Dưới header: L07 dải "Không lưu gì" + banner(id, html|fn, only[]) (L13 chỉ ở M05, M18) ===== */
  const banners = new Map();
  function renderBanners() {
    const parts = [], name = current().name;
    if (S.mode() === 'none') parts.push(`<p class="mode-strip">${t('modeStripNone')}</p>`);
    banners.forEach(b => { if (!b.only || b.only.includes(name)) parts.push(isFn(b.html) ? b.html() : b.html); });
    $('#banners').innerHTML = parts.join('');
  }
  function banner(id, html, only) { if (html == null) banners.delete(id); else banners.set(id, { html, only }); renderBanners(); }
  // L13: thẻ lỗi bộ nhớ ở đầu M05, M18 (UX 2.3, 12); key = khóa chữ. "Tải lại" (DB đổi version ở tab khác) hiện ở mọi màn
  function storeAlert(key) {
    const reload = key === 'store.reload', toData = /quota|corrupt/i.test(key);
    banner('store', () => `<div class="store-wrap"><div class="store-alert" role="alert"><p>${t(key)}</p>` +
      (toData ? `<button type="button" class="link" data-go="mydata">${t('store.toData')}</button>` : '') +
      (reload ? `<button type="button" class="link" data-act="reload">${t('store.reloadBtn')}</button>` : '') +
      `<button type="button" class="icon-btn store-close" data-act="closeStore" aria-label="${t('store.close')}">✕</button></div></div>`, reload ? null : ['home', 'mydata']);
  }

  /* ===== Toast (L01). Không hiện ở màn đêm M13–M14 (UX 4.0, mục 9) ===== */
  let toastT = null, inputN = 0, toastN = -1;
  // B-01: đếm lần chạm/bấm phím. Toast gọi trong cùng lần chạm với lệnh chuyển màn thì đi theo; chạm mới rồi đổi màn thì ẩn
  ['click', 'keydown'].forEach(ty => document.addEventListener(ty, () => { inputN++; }, true));
  // B-01: đặt toast phía trên chân màn dính (.player-foot, .reader-foot), không đè nút an toàn
  function placeToast() {
    let h = 0;
    $$('.player-foot, .reader-foot').forEach(f => { const b = f.getBoundingClientRect(); if (b.height && b.bottom > innerHeight - 80) h = Math.max(h, innerHeight - b.top); });
    $('#toast').style.bottom = h > 0 ? Math.round(h + 12) + 'px' : '';
  }
  function hideToast() { clearTimeout(toastT); const el = $('#toast'); el.classList.remove('show'); el.innerHTML = ''; }
  function toast(msg, o = {}) {
    const scr = SCREENS[current().name];
    if (scr && scr.theme === 'night' && !o.night) return;
    const el = $('#toast'), act = o.action || null;
    el.innerHTML = `<span>${esc(msg)}</span>` + (act ? `<button type="button" class="toast-act" data-toast="1">${esc(act.label)}</button>` : '');
    el.onclick = e => { if (act && e.target.closest('[data-toast]')) { hideToast(); if (isFn(act.run)) act.run(); } };
    el.classList.add('show'); toastN = inputN; placeToast();
    clearTimeout(toastT); toastT = setTimeout(hideToast, o.ms || (act ? 5000 : 3200));
  }

  /* ===== alertdialog (L08, M13a, M13b): dialog({title, body (HTML đã esc), actions:[{label, value, kind, safe}]}) → Promise<value>
     Focus + Esc = nút an toàn (safe, mặc định nút cuối); defaultFocus: chỉ số nút, -1 = tiêu đề (câu hỏi ngang hàng) ===== */
  let dlg = null, dlgN = 0;
  function dialog({ title, body = '', actions = [], defaultFocus } = {}) {
    closeDialog();
    return new Promise(resolve => {
      const prev = document.activeElement, id = 'dlg' + (++dlgN);
      let safe = actions.findIndex(a => a.safe);
      if (safe < 0) safe = actions.length - 1;
      const val = i => (actions[i] && actions[i].value !== undefined ? actions[i].value : i < 0 ? null : i);
      const wrap = document.createElement('div');
      wrap.className = 'dlg-backdrop';
      wrap.innerHTML = `<div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="${id}"${body ? ` aria-describedby="${id}b"` : ''}>` +
        `<h2 id="${id}" class="dlg-title" tabindex="-1">${esc(title)}</h2>${body ? `<div id="${id}b" class="dlg-body">${body}</div>` : ''}` +
        `<div class="btn-col">${actions.map((a, i) => `<button type="button" class="btn ${esc(a.kind || 'ghost')}" data-dlg="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
      const outside = $$('#header, #banners, #main, #toast');
      const ctl = {};
      const done = v => {
        if (dlg !== ctl) return;
        dlg = null;
        document.removeEventListener('keydown', onKey, true);
        wrap.remove();
        outside.forEach(el => { el.inert = false; });
        if (prev && prev.isConnected && isFn(prev.focus)) prev.focus({ preventScroll: true });
        resolve(v);
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(val(safe)); return; }
        if (e.key !== 'Tab') return;
        const f = $$('button', wrap), i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      };
      wrap.addEventListener('click', e => { const b = e.target.closest('[data-dlg]'); if (b) done(val(+b.dataset.dlg)); });
      ctl.close = () => done(val(safe));
      dlg = ctl;
      document.body.appendChild(wrap);
      outside.forEach(el => { el.inert = true; });
      document.addEventListener('keydown', onKey, true);
      ($$('[data-dlg]', wrap)[defaultFocus ?? safe] || $('.dlg-title', wrap)).focus();
    });
  }
  function closeDialog() { if (dlg) dlg.close(); }

  /* ===== Helper UI ===== */
  // AC-19: bấm lần hai trong ms mới chạy
  function confirmTwice(btn, o, fn) {
    const reset = () => { delete btn.dataset.armed; btn.classList.remove('is-armed'); btn.textContent = btn.dataset.label1; };
    if (btn.dataset.armed) { reset(); fn(); return; }
    btn.dataset.armed = '1'; btn.dataset.label1 = btn.textContent; btn.classList.add('is-armed');
    btn.textContent = (o && o.label2) || 'Bấm lần nữa để xóa';
    lifecycle.later(() => { if (btn.isConnected && btn.dataset.armed) reset(); }, (o && o.ms) || 4000);
  }
  function download(name, mime, text) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    } catch (e) { return false; }
  }
  function copyText(text) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.readOnly = true; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); return ok;
    };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, fallback);
    return Promise.resolve(fallback());
  }
  // AC-59: bảng chia sẻ của máy; không có thì sao chép + toast. Không ghi gì về người nhận
  function shareText(text) {
    const copy = () => copyText(text).then(ok => { toast(tr(ok ? 'toast.copied' : 'err.copy')); return ok ? 'copied' : 'cancel'; }, () => 'cancel');
    if (navigator.share) return navigator.share({ text }).then(() => 'shared', e => (e && e.name === 'AbortError' ? 'cancel' : copy()));
    return copy();
  }
  // "Gửi link app" (A2): lời trung tính + link (UX T-8). text có {URL} thì thay, không thì gửi kèm url
  function shareApp(text) {
    const url = httpsUrl(C.APP_URL);
    if (!url) return Promise.resolve('cancel');
    const msg = text ? (text.includes('{URL}') ? text.split('{URL}').join(url) : text + ' ' + url) : url;
    if (navigator.share) return navigator.share(text ? { text: msg } : { url }).then(() => 'shared', e => (e && e.name === 'AbortError' ? 'cancel' : shareText(msg)));
    return shareText(msg);
  }
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  // Rung nhẹ khi chạm; tắt ở chế độ đêm và màn dịu M21b (UX 9)
  function vibrate(ms) {
    const scr = SCREENS[current().name];
    if ((scr && scr.theme === 'night') || current().name === 'loss_soft' || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (e) { /* bỏ qua */ }
  }
  // Số điện thoại hợp lệ mới thành tel:, URL phải https: (tech design 10) — sai thì bỏ mục, không vỡ màn
  const telHref = n => (/^[0-9+ .]{3,16}$/.test(String(n || '')) ? 'tel:' + String(n).replace(/[ .]/g, '') : '');
  const httpsUrl = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : '');
  // Trạng thái duyệt theo nhóm nội dung (D.CONTENT_GROUPS: safety, text, …); không có → draft
  const review = code => (D.CONTENT_GROUPS || []).find(g => g.code === code) || DRAFT_REV;
  // L06 dòng bản thử nghiệm (AC-34)
  const draftLine = item => (item && item.status === 'approved' ? '' : `<p class="draft-note">${esc(TX.draftLine || DRAFT)}</p>`);
  // Hai bé capybara (UX 1.2), trang trí aria-hidden; ảnh lỗi → 🐾🐾 cùng cỡ
  const art = (file, px, fb) => `<img class="pair s${px}" src="assets/art/${esc(file)}.svg" width="${px}" height="${px}" alt="" aria-hidden="true" data-fallback="${fb}" data-fb-class="pair-fb s${px}">`;
  const pair = (pose, px) => (ART.includes(pose) ? art('capy-pair-' + pose, px, '🐾🐾') : `<span class="pair-fb s${px}" aria-hidden="true">🐾🐾</span>`);
  // Hình theo giai đoạn: after_loss → tựa đầu chung chăn (UX 1.2, 2.4)
  const pairNow = px => pair(stage() === 'after_loss' ? 'blanket' : 'side', px);

  // Chỗ DUY NHẤT đổi giai đoạn (AC-17): via 'stage' (M04) | 'mydata' (M18) | 'result' (M21). Ghi prefs + StageRec (5.3)
  function setStage(code, via) {
    if (!STAGE_CODES.includes(code) || !['stage', 'mydata', 'result'].includes(via)) return false;
    const from = stage(), at = now(), tz = U.tzAt(at);
    if (from === code) return false;
    S.prefs.set('stage', { code, at });
    try { S.journal.add({ v: 1, kind: 'stage', id: U.randomId(), at, day: U.dayOf(at, tz), tz, from: from || null, to: code, via }); } catch (e) { /* store báo lỗi qua S.on */ }
    if (code === 'after_loss') state.session.gateAnswered = {};
    emit('stage', { from, to: code, via });
    appTitle(SCREENS[current().name]);   // AC-22: tên tab đổi ngay
    return true;
  }

  /* ===== An toàn (tech design 6.4): safetyGate + piiPanel ===== */
  // Cờ phiên CHỈ cộng (Set union), không bao giờ hạ, không ghi xuống máy (AC-23)
  const GROUP_FLAG = { selfblame: 'self_blame', loss: 'loss', prolonged: 'prolonged' };
  function safetyGate(text, o = {}) {
    const s = String(text || ''), flags = state.session.flags;
    let check = { selfHarm: false, human: false, groups: [], body: false }, pii = [];
    if (s.trim() && isFn(E.safetyCheck)) {
      check = E.safetyCheck(s) || check;
      if (isFn(E.assess)) {
        const r = E.assess({ texts: [s], level: null, emotions: [], flags: new Set(flags) });
        if (r && r.flags) r.flags.forEach(f => flags.add(f));
      } else {   // dự phòng khi engine chưa có assess
        if (check.selfHarm) flags.add('self_harm');
        if (check.human || (check.groups || []).length) flags.add('not_alone');
        (check.groups || []).forEach(g => { if (GROUP_FLAG[g]) flags.add(GROUP_FLAG[g]); });
        if (check.body) flags.add('body');
      }
    }
    if (check.selfHarm) { go('urgent', { from: o.from || 'checkin' }); return { route: 'urgent', check, pii }; }
    if ((o.kind === 'save' || o.kind === 'send') && s.trim() && isFn(E.detectPII)) pii = E.detectPII(s) || [];
    return { route: pii.length ? 'pii' : 'ok', check, pii };
  }
  // L02 (AC-33): root = khối chứa; opts.input (ô viết) → app tự "Sửa lại" (chọn đoạn đầu) và "Bỏ đoạn đó" (xóa đoạn)
  let piiSeen = false;
  function piiPanel(root, hits, o = {}) {
    const close = () => { if (root) root.innerHTML = ''; };
    if (!root || !hits || !hits.length) { close(); return { close }; }
    const roleAttr = piiSeen ? 'status' : 'alert'; piiSeen = true;   // role="alert" chỉ lần đầu (UX 7)
    root.innerHTML = `<div class="pii-panel" role="${roleAttr}"><p class="pii-title">${t('pii.title')}</p><ul>` +
      hits.map(h => `<li><mark>«${esc(h.text)}»</mark> – ${esc((D.PII_WHY || {})[h.why] || tr('pii.other'))}</li>`).join('') +
      `</ul><p>${t('pii.fix')}</p><p class="fine">${t('pii.limit')}</p><div class="btn-row">` +
      ['edit', 'drop', 'keep'].map(k => `<button type="button" class="btn ghost" data-pii="${k}">${t('pii.' + k)}</button>`).join('') + '</div></div>';
    $('.pii-panel', root).addEventListener('click', e => {
      const b = e.target.closest('[data-pii]'), inp = o.input;
      if (!b) return;
      const k = b.dataset.pii;
      close();
      if (k === 'edit') {
        if (inp) { const i = inp.value.indexOf(hits[0].text); inp.focus(); if (i >= 0) inp.setSelectionRange(i, i + hits[0].text.length); }
        if (isFn(o.onEdit)) o.onEdit(hits);
      } else if (k === 'drop') {
        let v = inp ? inp.value : '';
        if (inp) {
          hits.forEach(h => { v = v.split(h.text).join(''); });
          inp.value = v.replace(/[ \t]{2,}/g, ' ').trim();
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
        toast(tr('pii.toastDrop'));
        if (isFn(o.onDrop)) o.onDrop(hits, inp ? inp.value : null);
      } else if (isFn(o.onKeep)) o.onKeep(hits);
    });
    return { close };
  }

  /* ===== Thẻ capybara (AC-38, L-1, L14): 9 ảnh + Tự trách xáo mỗi lần gọi, "Chưa rõ" luôn cuối; thứ tự không lưu ===== */
  let uid = 0;
  const assetBase = () => { const b = String(C.ASSET_BASE || ''); return /^(https:\/\/|\/(?!\/))[^\s"'<>]*$/.test(b) ? b : ''; };
  function capyCards(o = {}) {
    const max = Math.max(1, o.max || 3), id = 'cc' + (++uid), all = emotions(), base = assetBase();
    const list = U.shuffle(all.filter(e => e.code !== 'unsure'), o.rand || U.randInt).concat(all.filter(e => e.code === 'unsure'));
    let sel = (o.selected || []).filter(c => all.some(e => e.code === c)).slice(0, max);
    const label = c => (all.find(e => e.code === c) || {}).label || c;
    const picked = () => (sel.length ? tr('checkin.chosen') + sel.map(label).join(', ') : '');
    const card = e => {
      const photo = !!(e.img && base);
      const pic = photo ? `<img src="${esc(base + e.img)}" width="480" height="480" alt="" decoding="async" data-fallback="${esc(e.emoji)}" data-fb-class="capy-emoji">`
        : `<span class="capy-emoji" aria-hidden="true">${esc(e.emoji)}</span>`;
      // 9 ảnh chỉ hình (tên ở aria-label); thẻ emoji và ảnh lỗi thì hiện tên dưới thẻ
      return `<button type="button" class="capy-card" data-capy="${esc(e.code)}" aria-pressed="${sel.includes(e.code)}" aria-label="${esc(e.label)}">` +
        `${pic}<span class="capy-name"${photo ? ' hidden' : ''}>${esc(e.label)}</span><span class="tick" aria-hidden="true">✓</span></button>`;
    };
    const html = `<div class="capy-grid" id="${id}" role="group" aria-label="${o.label ? esc(o.label) : t('capy.group')}">${list.map(card).join('')}</div>` +
      `<p class="capy-picked" id="${id}p" aria-live="polite">${esc(picked())}</p><p class="gentle capy-note" id="${id}n" aria-live="polite" hidden></p>`;
    function mount(root) {
      const grid = root && root.querySelector('#' + id);
      if (!grid) return;
      const out = root.querySelector('#' + id + 'p'), note = root.querySelector('#' + id + 'n');
      lifecycle.on(grid, 'click', e => {
        const b = e.target.closest('[data-capy]');
        if (!b) return;
        const c = b.dataset.capy, i = sel.indexOf(c);
        note.hidden = true; note.textContent = '';
        if (i >= 0) sel.splice(i, 1);
        else if (sel.length < max) sel.push(c);
        else if (max === 1) sel = [c];
        else { note.textContent = tr('checkin.max3'); note.hidden = false; return; }   // thẻ thứ 4: nhắc nhẹ, không bật
        $$('[data-capy]', grid).forEach(x => x.setAttribute('aria-pressed', String(sel.includes(x.dataset.capy))));
        out.textContent = picked();
        vibrate(15);
        if (isFn(o.onChange)) o.onChange(sel.slice());
      });
    }
    return { html, mount, value: () => sel.slice(), order: () => list.map(e => e.code) };
  }

  /* ===== 10 chấm (PRD 6.3, UX 8): radiogroup, KHÔNG mặc định, MỘT màu, mũi tên đổi mức; allowSkip → "Không muốn trả lời" ===== */
  function dots10(o = {}) {
    const id = 'd' + (++uid);
    let val = o.value >= 1 && o.value <= 10 ? Math.round(o.value) : null, skip = false;
    const aria = n => tr('dots.aria', { n }) + (n === 1 ? ', ' + tr('checkin.low').toLowerCase() : n === 10 ? ', ' + tr('checkin.high').toLowerCase() : '');
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const lab = o.labelledby ? `aria-labelledby="${esc(o.labelledby)}"` : `aria-label="${o.label ? esc(o.label) : t('dots.group')}"`;
    const html = `<div class="dots10" id="${id}"><p class="dots-val" aria-hidden="true">${val ? t('dots.val', { n: val }) : ''}</p>` +
      `<div class="dots" role="radiogroup" ${lab}>` +
      nums.map(n => `<button type="button" class="dot" role="radio" data-dot="${n}" aria-checked="${n === val}" aria-label="${esc(aria(n))}" tabindex="${(val ? n === val : n === 1) ? 0 : -1}">${n}</button>`).join('') +
      `</div><div class="dots-ends" aria-hidden="true"><span>${t('checkin.low')}</span><span>${t('checkin.high')}</span></div>` +
      (o.allowSkip ? `<div class="chips"><button type="button" class="chip" data-dotskip aria-pressed="false">${t('checkin.noAnswer')}</button></div>` : '') +
      `<p class="fine">${t('checkin.selfRated')}</p></div>`;
    function mount(root) {
      const box = root && root.querySelector('#' + id);
      if (!box) return;
      const group = $('.dots', box), out = $('.dots-val', box), chip = $('[data-dotskip]', box);
      const paint = () => {
        $$('.dot', box).forEach(d => {
          const n = +d.dataset.dot;
          d.setAttribute('aria-checked', String(n === val));
          d.tabIndex = (val ? n === val : n === 1) ? 0 : -1;
        });
        out.textContent = val ? tr('dots.val', { n: val }) : '';
        if (chip) chip.setAttribute('aria-pressed', String(skip));
        if (skip) group.setAttribute('aria-disabled', 'true'); else group.removeAttribute('aria-disabled');
      };
      lifecycle.on(box, 'click', e => {
        const d = e.target.closest('[data-dot]'), sk = e.target.closest('[data-dotskip]');
        if (d) { val = +d.dataset.dot; skip = false; vibrate(15); }
        else if (sk) { skip = !skip; if (skip) val = null; }
        else return;
        paint();
        if (isFn(o.onChange)) o.onChange(val, { skip });
      });
    }
    return { html, mount, value: () => val, skipped: () => skip };
  }

  /* ===== Delegation: data-go (+ data-params) · data-act ===== */
  // Chọn cách dùng "Không lưu gì": từ M01 → M03; từ M02 mở ở M18 → quay lại M18 (vẫn none)
  function useNone() {
    if ((current().params || {}).from === 'mydata') { back(); return; }
    S.startNone(); resetTo('role', { first: true });
  }
  const afterConsent = fromData => (fromData ? resetTo('mydata') : resetTo('role', { first: true }));
  const actions = {
    back,
    home: () => resetTo(home()),
    useNone,
    // M01 khi trình duyệt chặn lưu: nút "Lưu trên máy này" aria-disabled, chạm thì nói lý do
    blockedInfo: () => toast(tr('err.blocked')),
    closeStore: () => banner('store', null),
    reload: () => location.reload(),
    // M02 "Đồng ý và tiếp tục": đọc hai ô; bỏ cả hai = Không lưu gì (K-8); startLocal lỗi → báo và chạy none
    consentGo: btn => {
      if (btn.getAttribute('aria-busy') === 'true') return;
      const j = $('#cs-journey'), w = $('#cs-writing');
      const journey = !!(j && j.checked), writing = journey && !!(w && w.checked);
      const fromData = (current().params || {}).from === 'mydata';
      if (!journey) {
        toast(tr('consent.toastNone'));
        if (fromData) back(); else { S.startNone(); resetTo('role', { first: true }); }
        return;
      }
      btn.setAttribute('aria-busy', 'true');
      // Chuyển none → local: hỏi mang theo phiên, mặc định Không (PRD 8.7, tech design 5.1)
      const ask = fromData && S.mode() === 'none' && S.journal.list({ limit: 1 }).length
        ? dialog({ title: tr('carry.title'), body: `<p>${t('carry.body')}</p>`,
          actions: [{ label: tr('carry.no'), value: false, kind: 'primary', safe: true }, { label: tr('carry.yes'), value: true, kind: 'ghost' }] })
        : Promise.resolve(false);
      ask.then(carry => S.startLocal({ journey, writing }, { carry: !!carry }))
        .then(ok => ok, () => false)
        .then(ok => {
          if (!ok) { state.blocked = true; S.startNone(); storeAlert('err.blocked'); toast(tr('err.blocked')); }
          afterConsent(fromData);
        });
    }
  };
  const screenActions = obj => { currentActions = Object.assign({}, currentActions, obj); };
  document.addEventListener('click', e => {
    const goEl = e.target.closest('[data-go]'), actEl = e.target.closest('[data-act]');
    if (goEl && !(actEl && actEl !== goEl && goEl.contains(actEl))) {
      e.preventDefault();
      let params = {};
      if (goEl.dataset.params) { try { params = JSON.parse(goEl.dataset.params); } catch (err) { params = {}; } }
      go(goEl.dataset.go, params);
      return;
    }
    if (actEl) {
      const fn = (currentActions && currentActions[actEl.dataset.act]) || actions[actEl.dataset.act];
      if (fn) { e.preventDefault(); fn(actEl, e); }
    }
  });
  // Bàn phím cho mọi radiogroup (chấm, thẻ chọn, chip chọn một): mũi tên / Home / End → chọn theo focus (UX 8)
  document.addEventListener('keydown', e => {
    const r = e.target.closest && e.target.closest('[role="radio"]'), g = r && r.closest('[role="radiogroup"]');
    if (!g) return;
    const items = $$('[role="radio"]', g).filter(x => !x.disabled), k = e.key;
    let i = items.indexOf(r);
    if (k === 'ArrowRight' || k === 'ArrowDown') i = (i + 1) % items.length;
    else if (k === 'ArrowLeft' || k === 'ArrowUp') i = (i - 1 + items.length) % items.length;
    else if (k === 'Home') i = 0;
    else if (k === 'End') i = items.length - 1;
    else return;
    e.preventDefault(); items[i].focus(); items[i].click();
  });
  // Ảnh lỗi (thiếu file, mạng yếu, ASSET_BASE hỏng) → emoji cùng cỡ; thẻ capybara hiện tên (UX 4.3, 12)
  document.addEventListener('error', e => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-fallback')) return;
    const sp = document.createElement('span');
    sp.className = img.dataset.fbClass || 'capy-emoji'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = img.dataset.fallback || '🐾🐾';
    const card = img.closest('.capy-card'), name = card && $('.capy-name', card);
    if (name) name.hidden = false;
    img.replaceWith(sp);
  }, true);
  const onVisible = () => { if (document.visibilityState === 'visible') emit('visible'); };
  document.addEventListener('visibilitychange', onVisible);

  /* ===== api (tech design 3.3) — đổi shape phải qua architect ===== */
  const modules = [], tiles = [], links = [], sections = [];
  const api = {
    C, D, K, SC, E, PC, S, U, SOUND, P,
    state, lifecycle, lifecycleGlobal, go, back, resetTo, screenActions, esc, t, say, xung, role, stage, setStage,
    now, hour, today, toast, banner, dialog, confirmTwice, download, copyText, shareText, shareApp, reduceMotion, vibrate, telHref,
    draftLine, appTitle: () => appTitle(SCREENS[current().name]), on, emit, has,
    capyCards, dots10, safetyGate, piiPanel,
    markHabit: () => {},   // care.js (A2) thay qua provides; A1 rỗng
    homeTiles: () => tiles.slice().sort((a, b) => a.order - b.order),
    homeLinks: () => links.slice().sort((a, b) => a.order - b.order),
    dataSections: () => sections.slice()
  };
  const goAttr = (name, params) => `data-go="${esc(name)}"${params ? ` data-params="${esc(JSON.stringify(params))}"` : ''}`;
  const call115 = () => { const tel = telHref(C.EMERGENCY_NUMBER);
    return tel ? `<a class="btn danger big" href="${esc(tel)}">${t('safety.call115')}</a>` : `<p><strong>${esc(C.EMERGENCY_NUMBER)}</strong></p>`; };
  // Kênh hỗ trợ của cơ sở (config); trống → câu PRD 8.5 (AC-32)
  function channels() {
    const list = (Array.isArray(C.SUPPORT_CHANNELS) ? C.SUPPORT_CHANNELS : []).filter(c => c && c.name);
    if (!list.length) return `<p>${t('safety.support.noChannels')}</p>`;
    return '<ul class="ch-list">' + list.map(c => { const tel = telHref(c.phone);
      return `<li><span><strong>${esc(c.name)}</strong>${c.hours ? `<br><small>${esc(c.hours)}</small>` : ''}</span>` +
        (tel ? `<a class="btn teal" href="${esc(tel)}">${t('sup.callTo')} ${esc(c.phone)}</a>` : '') + '</li>'; }).join('') + '</ul>';
  }
  // Thẻ chọn (radio card, M03, M04): role="radio" khi chọn rồi bấm Tiếp tục; kiểu "change" là nút lưu ngay
  const choice = (code, title, sub, o = {}) => {
    const attrs = o.radio ? `role="radio" aria-checked="${!!o.on}" tabindex="${o.tab ? 0 : -1}"` : (o.on ? 'aria-current="true"' : '');
    return `<button type="button" class="choice${o.suggested ? ' suggested' : ''}" data-pick="${esc(code)}" ${attrs}>` +
      `<span class="choice-title">${esc(title)}${o.badge ? ` <span class="badge">${esc(o.badge)}</span>` : ''}</span>` +
      (sub ? `<span class="choice-sub">${esc(sub)}</span>` : '') + '</button>';
  };
  // Gắn chọn một cho nhóm radio card; trả hàm đọc mã đang chọn
  function pickOne(root, initial) {
    let v = initial || null;
    const g = $('[role="radiogroup"]', root);
    if (g) lifecycle.on(g, 'click', e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      v = b.dataset.pick;
      $$('[data-pick]', g).forEach(x => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
      vibrate(15);
    });
    return () => v;
  }
  // Sau khi đổi sang after_loss: màn dịu M21b, "‹" về trang chính
  const toLoss = () => { resetTo('home'); go('loss_soft'); };

  /* ===== Màn chung (app.js, FE-1). Khóa theo tech design mục 4 ===== */
  const CORE = {
    // M01 – hai cách dùng cùng cỡ cùng kiểu nút chính (AC-10, ngoại lệ "một nút chính" có chủ ý), AC-21
    welcome: { title: '', docTitle: 'Chào bạn', render: () => {
      const local = state.blocked
        ? `<button type="button" class="btn primary big" aria-disabled="true" data-act="blockedInfo">${t('welcome.local')}<small>${t('welcome.blocked')}</small></button>`
        : `<button type="button" class="btn primary big" ${goAttr('consent')}>${t('welcome.local')}<small>${t('welcome.localSub')}</small></button>`;
      return `${pair('side', 120)}<p class="center"><span class="eyebrow">🤝 ${esc(C.APP_NAME)}</span></p>
        <h1>${t('welcome.h1')}</h1><p class="lead">${t('welcome.lead')}</p>
        <div class="btn-col choose">${local}<button type="button" class="btn primary big" data-act="useNone">${t('welcome.none')}<small>${t('welcome.noneSub')}</small></button></div>
        <p class="fine">${t('welcome.fine')}</p>${C.SHARED_ORIGIN ? `<p class="fine">${t('welcome.shared')}</p>` : ''}
        <p><button type="button" class="link" ${goAttr('never')}>${t('safety.support.never')}</button></p><p class="fine">${t('welcome.notDiag')}</p>`;
    } },
    // M02 · params {from?: 'mydata'} — chưa bấm nút thì chưa ghi gì (AC-12); ô chữ chỉ bật khi ô hành trình bật (AC-24)
    consent: { title: 'Đồng ý lưu', render: p => {
      const c = S.mode() === 'local' && isFn(S.consent) ? S.consent() || {} : { journey: true, writing: false };
      return `<h1>${t('consent.h1')}</h1><p class="lead">${t('consent.lead')}</p><div class="card">
        <label class="check"><input type="checkbox" id="cs-journey"${c.journey !== false ? ' checked' : ''}><span><strong>${t('consent.journey')}</strong></span></label>
        <hr class="section-divider">
        <label class="check"><input type="checkbox" id="cs-writing" aria-describedby="cs-wnote"${c.writing && c.journey !== false ? ' checked' : ''}><span><strong>${t('consent.writing')}</strong><br><small>${t('consent.writingSub')}</small></span></label>
        <p class="fine" id="cs-wnote" hidden>${t('consent.writingOff')}</p></div>
        <p class="fine">${t('consent.fine')}</p>
        <button type="button" class="btn primary block" data-act="consentGo">${t(p.from === 'mydata' ? 'consent.goFromData' : 'consent.go')}</button>
        <p class="center"><button type="button" class="link" data-act="useNone">${t('consent.useNone')}</button></p>`;
    }, mount: root => {
      const j = $('#cs-journey', root), w = $('#cs-writing', root), note = $('#cs-wnote', root);
      const sync = () => { w.disabled = !j.checked; if (!j.checked) w.checked = false; note.hidden = j.checked; };
      lifecycle.on(j, 'change', sync); sync();
    } },
    // M03 · params {first?} (AC-14). Lần đầu: chọn rồi Tiếp tục, "Bỏ qua" → M04. Đổi (từ M18): "Lưu" → toast → quay lại
    role: { title: 'Bạn là…', render: p => {
      const cur = role();
      return `<h1 id="role-h1">${t('role.h1')}</h1><p class="lead">${t('role.lead')}</p>
        <div class="choices" role="radiogroup" aria-labelledby="role-h1">${roles().map((r, i) =>
          choice(r.code, r.label, r.sub, { radio: true, on: cur === r.code, tab: cur ? cur === r.code : i === 0 })).join('')}</div>
        <button type="button" class="btn primary block" data-act="roleNext">${t(p.first ? 'next' : 'role.save')}</button>
        ${p.first ? `<p class="center"><button type="button" class="link" ${goAttr('stage', { first: true })}>${t('skip')}</button></p>` : ''}`;
    }, mount: (root, p) => {
      const val = pickOne(root, role());
      screenActions({ roleNext: () => {
        const v = val();
        if (v) S.prefs.set('role', v);
        if (p.first) { go('stage', { first: true }); return; }
        toast(tr('role.toast')); back();
      } });
    } },
    // M04 · params {first?, suggest?, from?} (AC-15, 17, K-13). Lần đầu: chọn + Tiếp tục / Bỏ qua. Đổi: chạm thẻ là lưu (2 chạm)
    stage: { title: 'Chặng đường', render: p => {
      const cur = stage(), list = stages(), fine = S.mode() === 'none' ? `<p class="fine">${t('stage.noneMode')}</p>` : '';
      if (p.first) {
        return `<h1 id="stage-h1">${t('stage.h1')}</h1><p class="lead">${t('stage.lead')}</p>
          <div class="choices" role="radiogroup" aria-labelledby="stage-h1">${list.map((s, i) =>
            choice(s.code, stageLabel(s), s.sub, { radio: true, on: cur === s.code, tab: cur ? cur === s.code : i === 0 })).join('')}</div>${fine}
          <button type="button" class="btn primary block" data-act="stageNext">${t('next')}</button>
          <p class="center"><button type="button" class="link" data-act="home">${t('skip')}</button></p>`;
      }
      return `<h1>${t('stage.h1Change')}</h1><p class="lead">${t('stage.lead')}</p><div class="choices">${list.map(s =>
        choice(s.code, stageLabel(s), s.sub, { on: cur === s.code, badge: cur === s.code ? tr('stage.current') : p.suggest === s.code ? tr('stage.suggest') : '',
          suggested: p.suggest === s.code && cur !== s.code })).join('')}</div>${fine}`;
    }, mount: (root, p) => {
      if (p.first) {
        const val = pickOne(root, stage());
        screenActions({ stageNext: () => {
          const v = val();
          if (v && v !== stage()) setStage(v, 'stage');
          if (v === 'after_loss') toLoss(); else resetTo('home');
        } });
        return;
      }
      lifecycle.on($('.choices', root), 'click', e => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        const v = b.dataset.pick;
        if (v === stage()) { back(); return; }
        setStage(v, p.from === 'mydata' ? 'mydata' : 'stage');
        if (v === 'after_loss') { go('loss_soft', {}, { replace: true }); return; }   // M21b, không toast (UX 4.1)
        toast(tr('stage.toast')); back();
      });
    } },
    // M05 – lời chào theo giai đoạn + giờ; ô lớn từ homeTiles (sau NIGHT_FROM_HOUR ô 🌙 lên đầu); dòng nhỏ từ homeLinks
    home: { title: 'Trang chính', render: () => {
      const st = stage(), late = hour() >= C.NIGHT_FROM_HOUR, GR = D.GREETINGS || {}, g = GR[st || 'none'] || GR.none || {};
      const s = st && stages().find(x => x.code === st);
      let tl = api.homeTiles();
      if (late) tl = tl.filter(x => x.id === 'night').concat(tl.filter(x => x.id !== 'night'));
      const tilesHtml = tl.map(x => { try { return x.render(); } catch (e) { return ''; } }).filter(Boolean);
      const ln = api.homeLinks().map(x => `<li><button type="button" class="link" ${goAttr(x.go, x.params)}>${esc(x.label)} ›</button></li>`).join('');
      const line = s ? `<span>${t('home.stageLine', { label: stageLabel(s) })}</span><button type="button" class="link" data-go="stage" aria-label="${t('home.changeAria')}">${t('home.stageChange')}</button>`
        : `<span>${t('home.unset')}</span><button type="button" class="link" data-go="stage">${t('home.pick')}</button>`;
      return `${pairNow(96)}<h1>${esc(say(g.h1 || 'Chào {xung}'))}</h1>
        <p class="lead">${esc(say(g.text || ''))}</p><div class="stage-line">${line}</div>
        ${st === 'waiting' && has('result') ? `<button type="button" class="btn soft block" data-go="result">${t('home.result')}</button>` : ''}
        ${knowCard(st)}${late && GR.evening ? `<p class="late-line">${esc(say(GR.evening))}</p>` : ''}
        ${tilesHtml.length ? `<div class="tiles${late ? ' late' : ''}" data-n="${tilesHtml.length}">${tilesHtml.join('')}</div>` : ''}
        ${ln ? `<nav aria-label="${t('home.links')}"><ul class="link-list">${ln}</ul></nav>` : ''}${draftLine(review('text'))}`;
    }, mount: () => screenActions({ closeKnow: btn => {
      const st = stage(), closed = Object.assign({}, pref('closedCards') || {});
      closed[st] = now(); S.prefs.set('closedCards', closed);
      const card = btn.closest('.know-card');
      if (card) card.remove();
      const h1 = $('#main h1'); if (h1) h1.focus();
    } }) },
    // M21 (UX `news`): 4 lựa chọn ngang hàng, không nút chính (AC-16)
    result: { title: 'Kết quả', render: () => `<h1>${t('result.h1')}</h1><p class="lead">${t('result.lead')}</p><div class="btn-col">
      ${(D.RESULTS || []).map(r => `<button type="button" class="btn ghost big" data-act="res_${esc(r.code)}">${esc((r.icon ? r.icon + ' ' : '') + r.label)}</button>`).join('')}</div>
      <p class="fine">${t('result.fine')}</p>`,
    mount: () => screenActions({
      res_good: () => { setStage('positive', 'result'); resetTo('home'); go('good_news'); },
      res_loss: () => { setStage('after_loss', 'result'); toLoss(); },
      res_wait: () => { toast(tr('result.toastWait')); resetTo('home'); },
      res_none: () => resetTo('home')
    }) },
    // M21b – không tên màn ở header (UX T-5), không hoạt hình, không âm, không rung
    loss_soft: { title: '', docTitle: 'Mình ở đây', noAppName: true, render: () => {
      const warm = has('player') && (!isFn(E.validate) || E.validate(['WARM_HAND_DAY'], {}).length);
      return `${pair('blanket', 120)}<h1>${t('loss.h1')}</h1><p class="lead">${t('loss.lead')}</p><p>${t('loss.more')}</p>
        <div class="human-card"><button type="button" class="link" data-go="support">${t('loss.human')}</button></div>
        ${warm ? `<button type="button" class="btn primary big" ${goAttr('player', { ex: 'WARM_HAND_DAY', origin: 'library' })}>${t('loss.warm')}<small>${t('loss.warmSub')}</small></button>` : ''}
        <p class="center"><button type="button" class="link" data-act="home">${t('home')}</button></p><p class="fine">${t('loss.fine')}</p>`;
    } },
    // M21c – không pháo hoa, không "chúc mừng"
    good_news: { title: 'Tin vui', render: () => { const link = httpsUrl(C.LINK_ME_BAU_AN_YEN);
      return `${pair('side', 96)}<h1>${t('good.h1')}</h1><p class="lead">${t('good.lead')}</p>
        ${link ? `<p><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${t('good.link')}</a></p>` : ''}
        <button type="button" class="btn primary block" data-act="home">${t('homeGo')}</button>`; } },
    // M19 – 115 ngay màn đầu (≤ 2 chạm, AC-01), kênh cơ sở (AC-32); câu chữ an toàn luôn hiện (K-14)
    support: { title: 'Hỗ trợ', render: () => { const cl = C.CLINIC_CONTACT || {}, ctel = telHref(cl.phone);
      return `<h1>${t('safety.support.h1')}</h1><div class="urgent-box"><h2>${t('safety.support.dangerH2')}</h2>${call115()}<p>${t('safety.support.near')}</p></div>
        <h2>${t('safety.support.channelsH2')}</h2>${channels()}
        ${cl.name || ctel ? `<h2>${t('safety.support.clinicH2')}</h2><p>${esc(cl.name || '')}${ctel ? ` <a class="btn teal" href="${esc(ctel)}">${t('sup.callTo')} ${esc(cl.phone)}</a>` : ''}</p><p>${t('safety.support.clinic')}</p>` : ''}
        <h2>${t('safety.support.trustH2')}</h2><p>${t('safety.support.trust')}</p>
        <h2>${t('safety.support.whenH2')}</h2><ul class="plain-list">${[1, 2, 3, 4].map(i => `<li>${t('safety.support.when' + i)}</li>`).join('')}</ul><p>${t('safety.support.invite')}</p>
        <p class="notice">${t('safety.support.nobody')}</p><h2>${t('safety.support.aboutH2')}</h2><p>${t('safety.support.about')}</p>
        <ul class="link-list"><li><button type="button" class="link" ${goAttr('never')}>${t('safety.support.never')}</button></li>
        <li><button type="button" class="link" ${goAttr('about')}>${t('sup.aboutLink')}</button></li></ul>${draftLine(review('safety'))}`; } },
    // M20 · params {from, back?} — không lưu gì (AC-23); "chỉ là cách nói" → về theo from + cờ not_alone (AC-26)
    urgent: { title: 'Hỗ trợ khẩn', render: p => `<h1>${t(p.from === 'safety_q' ? 'safety.urgent.h1Answer' : 'safety.urgent.h1Text')}</h1><p class="lead">${t('safety.urgent.lead')}</p>
      <div class="urgent-box"><h2>${t('safety.urgent.boxH2')}</h2>${call115()}<ul class="plain-list"><li>${t('safety.urgent.near')}</li>
      ${(C.SUPPORT_CHANNELS || []).length ? '' : `<li>${t('safety.support.noChannels')}</li>`}</ul>${(C.SUPPORT_CHANNELS || []).length ? channels() : ''}</div>
      <p>${t('safety.urgent.wait')}</p><button type="button" class="btn teal block" data-go="support">${t('safety.urgent.help')}</button>
      <button type="button" class="btn soft block" data-act="urgentSafe">${t('safety.urgent.safe')}</button>${draftLine(review('safety'))}`,
    mount: (root, p) => screenActions({ urgentSafe: () => {
      state.session.flags.add('not_alone');
      if (p.back && SCREENS[p.back.name]) { go(p.back.name, p.back.params || {}, { replace: true }); return; }
      if (p.from === 'checkin' || p.from === 'safety_q') { go('suggest', {}, { replace: true }); return; }
      back();   // B5, B6, send_words, support: quay lại đúng chỗ, chữ vừa nhập do module bỏ
    } }) },
    // Giới thiệu + bằng chứng nói thật (PRD 8.4) + trạng thái duyệt từng nhóm (tech design 13). UX chưa vẽ → khung chung
    about: { title: 'Về app này', render: () => {
      const SRC = { exercises: D.EXERCISES, scripts: SC.SCRIPTS, stage_cards: D.STAGE_CARDS, send_words: D.SEND_WORDS, keywords: [K.groups, K.body] };
      const rows = (D.CONTENT_GROUPS || []).map(g => `<li><span>${esc(g.label)}</span><span>${esc(revText(SRC[g.code] || g))}</span></li>`).join('');
      return `<h1>${t('about.h1')}</h1><p class="lead">${t('about.p')}</p><h2>${t('about.evH')}</h2>
        <ul class="plain-list">${[1, 2, 3, 4, 5].map(i => `<li>${t('about.ev' + i)}</li>`).join('')}</ul>
        <h2>${t('about.revH')}</h2><ul class="rev-list">${rows}</ul>
        <p class="fine">${t('about.revNote')}</p><p class="fine">${t('about.ver', { v: C.VERSION })}</p>
        <ul class="link-list"><li><button type="button" class="link" ${goAttr('never')}>${t('safety.support.never')}</button></li></ul>`;
    } }
  };
  // L05 thẻ "Điều nên biết" theo giai đoạn (E.stageCard); đóng → kv.closedCards, hiện lại khi đổi giai đoạn
  function knowCard(st) {
    if (!st || !isFn(E.stageCard)) return '';
    const c = E.stageCard(st);
    if (!c || !c.text) return '';
    const rv = c.review || DRAFT_REV;
    if (!C.ALLOW_DRAFT_CONTENT && rv.status !== 'approved') return '';
    const closedAt = (pref('closedCards') || {})[st], since = (pref('stage') || {}).at || 0;
    if (closedAt && closedAt >= since) return '';
    const paras = (Array.isArray(c.text) ? c.text : [c.text]).map(x => `<p>${esc(say(x))}</p>`).join('');
    return `<div class="know-card"><p class="know-title">${t('home.know')}</p>${paras}` +
      `<button type="button" class="icon-btn know-close" data-act="closeKnow" aria-label="${t('home.knowClose')}">✕</button></div>`;
  }
  // Đếm mục có status trong một nhóm nội dung (mảng, đối tượng, lồng một tầng)
  function revText(src) {
    let a = 0, n = 0;
    const walk = (x, d) => {
      if (!x || typeof x !== 'object' || d > 2) return;
      if (typeof x.status === 'string') { n++; if (x.status === 'approved') a++; return; }
      Object.values(x).forEach(v => walk(v, d + 1));
    };
    (Array.isArray(src) ? src : [src]).forEach(x => walk(x, 0));
    return !n ? tr('about.draft') : a === n ? tr('about.ok') : !a ? tr('about.draft') : tr('about.part', { a, n });
  }

  /* ===== Registry (3.2, ADR 0004): trùng màn / provides → throw ===== */
  function addScreens(owner, scr) {
    for (const key of Object.keys(scr)) {
      if (SCREENS[key]) throw new Error('Trùng tên màn "' + key + '" (module ' + owner + ')');
      SCREENS[key] = scr[key];
    }
  }
  function registerModules() {
    addScreens('core', CORE);
    for (const mod of window.HTDC_MODULES || []) {
      if (!mod) continue;
      modules.push(mod);
      addScreens(mod.name, isFn(mod.screens) ? mod.screens(api) || {} : {});
      const pr = isFn(mod.provides) ? mod.provides(api) || {} : {};
      for (const k of Object.keys(pr)) {
        if (k in api && k !== 'markHabit') throw new Error('Trùng tên provides "' + k + '" (module ' + mod.name + ')');
        api[k] = pr[k];
      }
      if (isFn(mod.homeTiles)) tiles.push(...(mod.homeTiles(api) || []));
      if (isFn(mod.homeLinks)) links.push(...(mod.homeLinks(api) || []));
      if (isFn(mod.dataSections)) sections.push(...(mod.dataSections(api) || []));
    }
    modules.forEach(m => { if (isFn(m.init)) m.init(api); });
  }

  // Cho smoke/e2e; module dùng api, không dùng HTDC_APP
  window.HTDC_APP = Object.assign(Object.create(api), { screens: () => Object.keys(SCREENS), current: () => current().name });

  /* ===== Khởi động ===== */
  // Sự kiện S.on → khóa chữ L13 (tech design 5.5 + T-03: quota{warn}, unsaved{error}, otherTab{reload})
  const storeKey = ev => ({ blocked: 'err.blocked', corrupt: 'err.corrupt', versionTooNew: 'store.newer', unsaved: 'store.unsaved',
    quota: ev.warn ? 'store.quotaWarn' : 'err.quota', otherTab: ev.reload ? 'store.reload' : '' })[ev.type] || '';
  function boot() {
    registerModules();
    S.on(ev => {
      if (!ev) return;
      emit('store', ev);
      if (ev.type === 'blocked') state.blocked = true;
      const key = storeKey(ev);
      if (key) storeAlert(key);   // L13
      // Tab khác vừa ghi: trang chính vẽ lại số liệu mới (màn có ô nhập thì để yên, tránh mất chữ đang gõ)
      else if (ev.type === 'otherTab' && current().name === 'home' && !dlg) render();
    });
    if (darkMQ && isFn(darkMQ.addEventListener)) darkMQ.addEventListener('change', () => applyMode(SCREENS[current().name]));
    // Đọc bộ nhớ quá 300 ms → "Đang mở…" tĩnh (UX 12)
    const slow = setTimeout(() => { if (!state.stack.length) $('#main').innerHTML = `<p class="fine" aria-busy="true">${t('loading')}</p>`; }, 300);
    Promise.resolve(S.boot()).then(r => {
      clearTimeout(slow);
      if (r && r.problems > 0) storeAlert('err.corrupt');
      resetTo(r && r.mode !== 'unset' ? 'home' : 'welcome');
    }, () => { clearTimeout(slow); resetTo('welcome'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
