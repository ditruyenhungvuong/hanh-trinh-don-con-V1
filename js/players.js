/* =========================================================
   Hành Trình Đón Con – js/players.js · window.HTDC_PLAYERS · Chủ: FE-4 Dừng lại & Thư viện (T-04)
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 8; UX M10 (bảng "Biến thể thân bài"); PRD 6.4, AC-35, 36, 50–53.
   Nguồn: apps/lifestyle-thai-phu/js/players.js @ 10/11/2026 (ADR 0008) — pause5, paced('breath46'), grounding, release,
   calmAudio → calmSound, register/stopAll/timers, chips. Đã bỏ pha nín, nhịp "Chậm hơn", hum, bellyBreath, music, layer.
   Chỗ khác bản gốc: B3 không có bước cảm nhận trong người; B4 chỉ thả lỏng (không vùng nào có pha gồng, bụng chỉ
   "để mềm ra"); thêm B5 cloud (ý mây của Nhật Ký Mẹ Bầu), B6 knowUnknown, B8 warmHandDay (qua api.paced của night.js).

   Interface: P[type].render(ex, api, opts) → HTML · P[type].mount(body, ex, api, opts) → pause().
   Chữ bài lấy từ ex (data.js EXERCISES: steps, phases, zones, chips, frame, boxes, sounds…); hằng ở đây chỉ là dự phòng.
   `api` là api của app; stop.js truyền bản con có thêm finish(end), saveTexts(patch) và nhận lại api.guard (kiểm chữ trước
   khi rời bài bằng chân trang). Chữ có {xung} qua api.say rồi api.esc. Nút [data-pfin] "Xong → Check-out" gọi api.finish.
   Chung: P.stopAll() dừng đồng hồ bài đang mở NGAY và nhỏ dần âm ≤ 0,8 s.
   ========================================================= */
window.HTDC_PLAYERS = (() => {
  'use strict';
  const SOUND = window.HTDC_SOUND;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mmss = sec => { const s = Math.max(0, Math.ceil(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const focusTo = el => { if (!el) return; el.setAttribute('tabindex', '-1'); try { el.focus({ preventScroll: false }); } catch (e) { /* bỏ qua */ } };
  const str = (v, fb) => (typeof v === 'string' && v.trim() ? v : fb);
  const arr = (v, fb) => (Array.isArray(v) && v.length ? v : fb);
  // Thay {xung} theo vai rồi escape (mọi chữ hiển thị của player đi qua đây)
  const tt = (api, s) => api.esc(api.say(s));
  const fin = api => `<button type="button" class="btn primary block" data-pfin>${api.esc(api.finishLabel || 'Xong → Check-out')}</button>`;
  // Nút [data-pfin] trong thân bài → api.finish('complete')
  const wire = (body, api) => api.lifecycle.on(body, 'click', e => {
    if (e.target.closest('[data-pfin]') && typeof api.finish === 'function') api.finish('complete');
  });
  const canWrite = api => !!(api.S && typeof api.S.canSave === 'function' && api.S.canSave('writing'));

  /* ===== Bài đang mở: để P.stopAll() dừng được đồng hồ ngay ===== */
  let current = null;
  function register(api, halt) {
    const me = { halt };
    current = me;
    api.lifecycle.onCleanup(() => { if (current === me) current = null; });
  }
  function stopAll() {
    if (current) { try { current.halt(); } catch (e) { /* bỏ qua */ } }
    if (SOUND) SOUND.stopAll(800);
  }
  // Bộ đếm giờ riêng của một bài (dọn từng cái khi tạm dừng, dọn hết khi rời màn)
  function timers(api) {
    const ids = new Set();
    api.lifecycle.onCleanup(() => { ids.forEach(id => clearInterval(id)); ids.clear(); });
    return {
      every(fn, ms) { const id = setInterval(fn, ms); ids.add(id); return id; },
      clear(id) { if (id != null) { clearInterval(id); ids.delete(id); } return null; }
    };
  }

  /* ===== Chip chọn một (aria-pressed) ===== */
  function chips(api, name, labelId, items, on) {
    return `<div class="chips" role="group" aria-labelledby="${labelId}">${items.map(it =>
      `<button type="button" class="chip" data-${name}="${api.esc(it.v)}" aria-pressed="${String(it.v) === String(on)}">${api.esc(it.label)}</button>`).join('')}</div>`;
  }
  function bindChips(api, body, name, onPick) {
    $$(`[data-${name}]`, body).forEach(b => api.lifecycle.on(b, 'click', () => {
      $$(`[data-${name}]`, body).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset[name]);
    }));
  }

  /* ===== Lớp an toàn cho ô viết (PRD 8.1; tech design 6.4) — api.safetyGate tự chuyển sang M20 khi có ý tự hại ===== */
  const gate = (api, text, o) => (String(text || '').trim() ? api.safetyGate(String(text), o) || { route: 'ok', pii: [] } : { route: 'ok', pii: [] });
  // Bỏ các đoạn nhận diện khỏi chữ
  const dropHits = (text, hits) => (hits || []).reduce((t, h) => (h && h.text ? t.split(h.text).join('') : t), String(text)).replace(/[ \t]{2,}/g, ' ').trim();

  /* ================= B1 – Dừng 5 giây (5 bước STOP-4P, bỏ lời "nhiệm vụ, công việc") ================= */
  const pause5 = {
    render: () => `<p class="pl-prog" id="p5-prog"></p><div class="pl-step" id="p5-card"></div>
      <div class="btn-row"><button type="button" class="btn ghost" id="p5-prev">‹ Trước</button>
      <button type="button" class="btn primary" id="p5-next">Tiếp ›</button></div><div id="p5-end"></div>`,
    mount(body, ex, api) {
      let i = 0;
      const STEPS = arr(ex && ex.steps, [{ icon: '✋', title: 'Dừng lại', text: '{Xung} tạm dừng việc đang làm vài giây.' }]);
      const show = focus => {
        const s = STEPS[i];
        $('#p5-prog', body).textContent = `Bước ${i + 1}/${STEPS.length}`;
        $('#p5-card', body).innerHTML = `<div class="pl-icon" aria-hidden="true">${api.esc(s.icon || '•')}</div><h2>${tt(api, s.title || '')}</h2><p>${tt(api, s.text || '')}</p>`;
        $('#p5-prev', body).disabled = i === 0;
        $('#p5-next', body).textContent = i === STEPS.length - 1 ? 'Xong ›' : 'Tiếp ›';
        if (focus) focusTo($('#p5-card h2', body));
      };
      const end = () => {
        $('#p5-card', body).hidden = true; $('#p5-prog', body).textContent = '';
        $('#p5-next', body).parentElement.hidden = true;
        $('#p5-end', body).innerHTML = `<div class="pl-step"><h2>${tt(api, str(ex && ex.end, 'Xong rồi.'))}</h2>${fin(api)}</div>`;
        focusTo($('#p5-end h2', body));
      };
      wire(body, api);
      // Chặn cú thứ hai của chạm đúp (bài học STOP-4P N-03)
      api.lifecycle.on($('#p5-next', body), 'click', e => {
        if (e.detail > 1) return;
        if (i < STEPS.length - 1) { i++; show(true); } else end();
      });
      api.lifecycle.on($('#p5-prev', body), 'click', e => { if (e.detail > 1) return; if (i > 0) { i--; show(true); } });
      show(false);
      register(api, () => {});
      return () => {};
    }
  };

  /* ================= B2 – Thở chậm 4 vào – 6 ra (không pha giữ, không nhịp chậm hơn) =================
     opts.minutes: phút người dùng có (chọn sẵn thời lượng vừa); opts.cycles: số vòng cố định (C2 Hai ta, A2). */
  const PATTERN = [['in', 4, 'Hít vào nhẹ…'], ['out', 6, 'Thở ra thật chậm…']];
  // Hai nhịp duy nhất: "Ngắn hơn" ×0,75 và "Gợi ý" ×1. Không có hệ số > 1.
  const TEMPOS = [{ v: '0.75', label: 'Ngắn hơn' }, { v: '1', label: 'Gợi ý' }];
  const DURS = [2, 3, 5];
  // Lưới an toàn: chỉ nhận pha vào/ra (pha giữ hơi bị bỏ, AC-36), 0 < giây ≤ 8, thời lượng 1–5 phút
  function pacedCfg(ex) {
    const ph = arr(ex && ex.phases, null);
    let pattern = ph ? ph.map(p => [p.code, +p.sec, String(p.label || '')]) : PATTERN;
    pattern = pattern.filter(p => (p[0] === 'in' || p[0] === 'out') && p[1] > 0 && p[1] <= 8);
    if (!pattern.some(p => p[0] === 'in') || !pattern.some(p => p[0] === 'out')) pattern = PATTERN;
    const durs = arr(ex && ex.durations, DURS).map(Number).filter(m => m >= 1 && m <= 5);
    return { pattern, durs: durs.length ? durs : DURS, guide: arr(ex && ex.lead, []), end: str(ex && ex.end, 'Xong rồi.'), fine: str(ex && ex.fine, '') };
  }
  const breath46 = {
    render(ex, api, opts = {}) {
      const cfg = pacedCfg(ex), want = +opts.minutes || 0;
      const def = want ? (cfg.durs.filter(m => m <= want).pop() || cfg.durs[0]) : (cfg.durs.includes(2) ? 2 : cfg.durs[0]);
      return `${cfg.guide.length ? `<div class="pl-guide"><h2 class="pl-h">Trước khi bắt đầu</h2><ol>${cfg.guide.map(g => `<li>${tt(api, g)}</li>`).join('')}</ol></div>` : ''}
        <div class="pl-orb-wrap"><div class="orb pl-orb" id="orb" aria-hidden="true"><span>${api.esc(str(ex && ex.icon, '🐉'))}</span></div>
          <p class="pl-phase"><span id="phase" aria-live="polite">Sẵn sàng</span> <span id="count" aria-hidden="true"></span></p></div>
        <p class="label" id="tempo-l">Nhịp</p>${chips(api, 'tempo', 'tempo-l', TEMPOS, '1')}
        ${opts.cycles ? '' : `<p class="label" id="dur-l">Thời lượng</p>${chips(api, 'dur', 'dur-l', cfg.durs.map(m => ({ v: m, label: m + ' phút' })), def)}`}
        <div class="btn-row"><button type="button" class="btn primary" id="bplay">▶ Bắt đầu</button>
          <button type="button" class="btn ghost" id="bstop" hidden>■ Dừng</button></div>
        <p class="pl-timer" id="remain" role="timer" aria-live="off"></p><div id="bend"></div>
        ${cfg.fine ? `<p class="fine">${tt(api, cfg.fine)}</p>` : ''}`;
    },
    mount(body, ex, api, opts = {}) {
      const cfg = pacedCfg(ex), pattern = cfg.pattern, T = timers(api), cycles = +opts.cycles || 0;
      let durMin = +((($('[data-dur][aria-pressed="true"]', body) || {}).dataset || {}).dur) || 2;
      let tempo = 1, running = false, t = 0, total = 0, lastPhase = -1, timer = null, lastTs = 0;
      const orb = $('#orb', body), phaseEl = $('#phase', body), countEl = $('#count', body), remainEl = $('#remain', body);
      const play = $('#bplay', body), stopBtn = $('#bstop', body), rm = api.reduceMotion();
      const cycle = () => pattern.reduce((s, p) => s + p[1] * tempo, 0);
      // Giảm chuyển động: không đổi cỡ, chỉ đổi độ đậm + nhãn pha (AC-04)
      const setScale = s => {
        if (rm) { orb.style.transform = 'none'; orb.style.opacity = String(0.4 + 0.6 * (s - 0.55) / 0.45); }
        else { orb.style.transform = `scale(${s})`; orb.style.opacity = ''; }
      };
      setScale(0.55);
      wire(body, api);
      bindChips(api, body, 'tempo', v => { tempo = Math.min(1, +v || 1); if (cycles && total) total = cycles * cycle(); });
      bindChips(api, body, 'dur', v => { durMin = +v || 2; if (running || t > 0) total = durMin * 60; });
      function tick() {
        const now = performance.now(); t += Math.min(1, (now - lastTs) / 1000); lastTs = now;
        if (t >= total) { finish(); return; }
        const c = cycle(); let inC = t % c, idx = 0;
        while (idx < pattern.length - 1 && inC >= pattern[idx][1] * tempo) { inC -= pattern[idx][1] * tempo; idx++; }
        const [kind, sec, label] = pattern[idx], len = sec * tempo, frac = Math.min(1, inC / len);
        if (idx !== lastPhase) { lastPhase = idx; phaseEl.textContent = label; }
        countEl.textContent = String(Math.max(1, Math.ceil(len - inC)));
        setScale(kind === 'in' ? 0.55 + 0.45 * frac : 1 - 0.45 * frac);
        remainEl.textContent = cycles ? `Vòng ${Math.min(cycles, Math.floor(t / c) + 1)}/${cycles}` : 'Còn khoảng ' + mmss(total - t);
      }
      function start() {
        if (!total || t >= total) { t = 0; total = cycles ? cycles * cycle() : durMin * 60; lastPhase = -1; }
        $('#bend', body).innerHTML = '';
        running = true; lastTs = performance.now();
        timer = T.every(tick, 100);
        play.textContent = '❚❚ Tạm dừng'; stopBtn.hidden = false;
      }
      function pause() {
        if (!running) return;
        running = false; timer = T.clear(timer);
        play.textContent = '▶ Tiếp tục';
      }
      function reset(label) {
        running = false; timer = T.clear(timer);
        t = 0; total = 0; lastPhase = -1; setScale(0.55); countEl.textContent = ''; remainEl.textContent = '';
        phaseEl.textContent = label;
        play.textContent = '▶ Bắt đầu'; stopBtn.hidden = true;
      }
      function finish() {
        reset(api.say(cfg.end));
        // Nút Check-out là phần tử MỚI (không đổi chính nút đang bấm – lỗi T-05 STOP-4P)
        $('#bend', body).innerHTML = fin(api);
      }
      api.lifecycle.on(play, 'click', () => (running ? pause() : start()));
      api.lifecycle.on(stopBtn, 'click', () => { reset('Đã dừng'); focusTo(play); });
      // Ẩn tab (khóa màn hình, chuyển app) → tạm dừng, quay lại tự bấm Tiếp tục
      api.lifecycle.on(document, 'visibilitychange', () => { if (document.hidden && running) pause(); });
      register(api, pause);
      return pause;
    }
  };

  /* ================= B3 – Về với lúc này 5-4-3-2-1 (không có bước tìm cảm giác trong người, PRD 8.4) ================= */
  const grounding = {
    render: () => '<p class="pl-prog" id="g-prog"></p><div class="pl-step" id="ground"></div>',
    mount(body, ex, api) {
      let i = 0;
      const STEPS = arr(ex && ex.steps, [{ n: 5, icon: '👀', title: 'Nhìn', text: 'Tìm 5 thứ {xung} nhìn thấy.' }]);
      const SKIP = str(ex && ex.skip, 'Bước này khó? Bỏ qua');
      const box = $('#ground', body);
      wire(body, api);
      const show = focus => {
        if (i >= STEPS.length) {
          $('#g-prog', body).textContent = '';
          box.innerHTML = `<div class="pl-icon" aria-hidden="true">🌿</div><h2>${tt(api, str(ex && ex.end, 'Xong rồi.'))}</h2>${fin(api)}`;
          focusTo($('h2', box));
          return;
        }
        const s = STEPS[i], n = Math.max(1, Math.min(+s.n || 1, 9));
        $('#g-prog', body).textContent = `Bước ${i + 1}/${STEPS.length}`;
        box.innerHTML = `<div class="pl-icon" aria-hidden="true">${api.esc(s.icon || '•')}</div><h2>${n} · ${tt(api, s.title || '')}</h2><p>${tt(api, s.text || '')}</p>
          ${ex && ex.fine ? `<p class="fine">${tt(api, ex.fine)}</p>` : ''}
          <div class="pl-taps">${Array.from({ length: n }, (_, k) => `<button type="button" class="pl-tap" aria-pressed="false" aria-label="Đã nhận ra điều thứ ${k + 1}"></button>`).join('')}</div>
          <div class="btn-row"><button type="button" class="btn primary" data-gnext>${i < STEPS.length - 1 ? 'Tiếp ›' : 'Xong ›'}</button></div>
          <button type="button" class="link" data-gnext>${tt(api, SKIP)}</button>`;
        if (focus) focusTo($('h2', box));
      };
      api.lifecycle.on(box, 'click', e => {
        const d = e.target.closest('.pl-tap');
        if (d) { d.setAttribute('aria-pressed', String(d.getAttribute('aria-pressed') !== 'true')); api.vibrate(15); return; }
        if (e.target.closest('[data-gnext]') && e.detail <= 1) { i++; show(true); }
      });
      show(false);
      register(api, () => {});
      return () => {};
    }
  };

  /* ================= B4 – Thả lỏng từng vùng: vai → hàm → tay → chân → bụng; CHỈ thả lỏng (AC-36) =================
     Hình người ngồi trung tính vẽ nội tuyến (T-06 không vẽ hình này); vùng đang làm sáng lên + tên vùng bằng chữ. */
  const ZONE_Z = { shoulders: 0, jaw: 1, hands: 2, legs: 3, belly: 4 };
  const SIT = `<svg viewBox="0 0 160 176" class="pl-fig" aria-hidden="true" focusable="false">
    <rect x="22" y="96" width="14" height="72" rx="7" class="pl-chair"/><rect x="22" y="126" width="104" height="12" rx="6" class="pl-chair"/>
    <circle cx="80" cy="30" r="18" class="pl-skin z" data-z="1"/>
    <path d="M56 56 Q80 46 104 56 L106 72 L54 72 Z" class="pl-shirt z" data-z="0"/>
    <path d="M56 72 L104 72 L100 124 L60 124 Z" class="pl-shirt z" data-z="4"/>
    <path d="M56 62 Q42 92 58 114 M104 62 Q118 92 102 114" class="pl-limb z" data-z="2"/>
    <path d="M62 124 L120 124 L122 166 L110 166 L106 136 L62 136 Z" class="pl-shirt z" data-z="3"/></svg>`;
  const release = {
    render: (ex, api) => `<div class="pl-fig-wrap">${SIT}</div><p class="pl-prog" id="rprog"></p>
      <div class="pl-step" id="rcard" aria-live="polite"></div>
      <div class="btn-row" id="rbtns"><button type="button" class="btn primary" id="rnext">${tt(api, str(ex && ex.next, 'Tiếp ›'))}</button></div>
      <button type="button" class="link" id="rskip">${tt(api, str(ex && ex.skipZone, 'Bỏ qua vùng này'))}</button><div id="rend"></div>`,
    mount(body, ex, api) {
      // Vùng chỉ có tên + câu thả lỏng; dữ liệu không có trường gồng nên không thể có pha gồng
      const Z = arr(ex && ex.zones, [{ code: 'shoulders', title: 'Vai', text: 'Để vai rơi xuống, rời xa tai.' }])
        .map((z, k) => ({ z: z.code in ZONE_Z ? ZONE_Z[z.code] : k, name: String(z.title || z.name || ''), text: String(z.text || '') }));
      const HINT = str(ex && ex.hint, 'Ở lại vùng này vài hơi thở, hoặc bao lâu {xung} thấy thoải mái.');
      const NEXT = api.say(str(ex && ex.next, 'Tiếp ›'));
      let gi = 0;
      wire(body, api);
      const show = focus => {
        $$('.pl-fig .z', body).forEach(n => n.classList.toggle('on', !!Z[gi] && +n.dataset.z === Z[gi].z));
        if (gi >= Z.length) {
          $('#rprog', body).textContent = '';
          $('#rcard', body).hidden = true; $('#rbtns', body).hidden = true; $('#rskip', body).hidden = true;
          $('#rend', body).innerHTML = `<div class="pl-step"><h2>${tt(api, str(ex && ex.end, 'Xong rồi.'))}</h2>${fin(api)}</div>`;
          focusTo($('#rend h2', body));
          return;
        }
        $('#rprog', body).textContent = `Vùng ${gi + 1}/${Z.length} · ${Z[gi].name}`;
        $('#rcard', body).innerHTML = `<h2>${tt(api, Z[gi].text)}</h2><p class="fine">${tt(api, HINT)}</p>`;
        $('#rnext', body).textContent = gi === Z.length - 1 ? 'Xong ›' : NEXT;
        if (focus) focusTo($('#rcard h2', body));
      };
      const next = e => { if (e.detail > 1) return; gi++; show(true); };
      api.lifecycle.on($('#rnext', body), 'click', next);
      api.lifecycle.on($('#rskip', body), 'click', next);
      show(false);
      register(api, () => {});
      return () => {};
    }
  };

  /* ================= B5 – Đặt tên suy nghĩ (mây) – PRD 6.4, AC-51 ================= */
  // "Lần này lại không được." → "lần này lại không được" (giữ chữ hoa của tên riêng / viết tắt)
  const tidy = s => { s = String(s).trim().replace(/[.…\s]+$/u, ''); return s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s; };
  const cloud = {
    render: (ex, api) => `<div id="cl-in">
        <p class="label" id="cl-l">Suy nghĩ nào cứ quay lại?</p>
        <p class="section-hint">Chạm một câu có sẵn, hoặc tự viết.</p>
        ${chips(api, 'th', 'cl-l', arr(ex && ex.chips, []).map(v => ({ v, label: v })), null)}
        <label class="sr-only" for="cl-t">Suy nghĩ của mình</label>
        <textarea id="cl-t" rows="2" maxlength="${+(ex && ex.maxLen) || 200}" placeholder="${tt(api, str(ex && ex.placeholder, 'Mình cứ nghĩ…'))}" aria-describedby="cl-n"></textarea>
        <p class="fine" id="cl-n">${api.t(canWrite(api) ? 'checkin.saved' : 'checkin.notSaved')}</p>
        <p class="error-text" id="cl-m" aria-live="polite"></p><div id="cl-pii"></div>
        <button type="button" class="btn primary block" id="cl-name">${tt(api, str(ex && ex.nameBtn, 'Gọi tên ›'))}</button></div>
      <div id="cl-show" hidden><div class="pl-cloud" id="cl-c"><img src="assets/art/cloud.svg" alt="" aria-hidden="true" data-fallback="☁️" data-fb-class="pl-cloud-fb"><p id="cl-x"></p></div>
        <button type="button" class="btn soft block" id="cl-fly">${tt(api, str(ex && ex.releaseBtn, 'Thả lên mây ☁️'))}</button></div>
      <div id="cl-end" hidden><p>${tt(api, str(ex && ex.end, ''))}</p>
        ${fin(api)}<button type="button" class="link" id="cl-again">${tt(api, str(ex && ex.again, 'Gọi tên thêm một suy nghĩ'))}</button></div>`,
    mount(body, ex, api) {
      const ta = $('#cl-t', body), msg = $('#cl-m', body), cl = $('#cl-c', body), max = +(ex && ex.maxLen) || 200;
      const FRAME = str(ex && ex.frame, 'Mình đang có suy nghĩ rằng {x}');
      let named = null, flyT = null;
      const box = $('#cl-pii', body);
      wire(body, api);
      // Đổi chữ khi bảng nhận diện đang mở → đóng bảng; muốn đi tiếp phải bấm "Gọi tên" lại (C-2)
      const closePanel = () => { box.innerHTML = ''; };
      bindChips(api, body, 'th', v => { ta.value = v; msg.textContent = ''; closePanel(); });
      api.lifecycle.on(ta, 'input', closePanel);
      const step = id => ['cl-in', 'cl-show', 'cl-end'].forEach(k => { $('#' + k, body).hidden = k !== id; });
      const showThought = text => {
        named = text;
        // {x} thay SAU api.say để chữ người dùng không bị đổi xưng hô
        $('#cl-x', body).textContent = api.say(FRAME).split('{x}').join(tidy(text));
        cl.classList.remove('fly', 'fade');
        step('cl-show');
        focusTo($('#cl-x', body));
        // Chữ chỉ được lưu khi đã đồng ý lưu chữ tự viết (stop.js kiểm lại)
        if (typeof api.saveTexts === 'function') api.saveTexts({ thought: text.slice(0, max) });
      };
      // Chỉ chuỗi VỪA qua gate mới được lên mây / lưu (C-2): "Vẫn giữ" mà ô đã đổi thì kiểm lại từ đầu
      const nameIt = () => {
        closePanel();
        const text = ta.value.trim();
        if (!text) { msg.textContent = 'Chạm một câu có sẵn, hoặc viết vài chữ nhé.'; return; }
        // Luật an toàn TRƯỚC khi lên mây (AC-51): tự hại → M20; chữ không lên mây, không lưu
        const g = gate(api, text, { from: 'B5', kind: canWrite(api) ? 'save' : 'none' });
        if (g.route === 'urgent') return;
        if (g.route === 'pii') {
          api.piiPanel(box, g.pii, { input: ta, onKeep: () => { if (ta.value.trim() !== text) nameIt(); else showThought(text); } });
          return;
        }
        showThought(text);
      };
      api.lifecycle.on($('#cl-name', body), 'click', nameIt);
      api.lifecycle.on($('#cl-fly', body), 'click', () => {
        const rm = api.reduceMotion();
        cl.classList.add(rm ? 'fade' : 'fly');
        $('#cl-fly', body).hidden = true;
        // Mây trôi 6 s; giảm chuyển động: mờ dần 1 s (AC-04)
        flyT = api.lifecycle.later(() => { step('cl-end'); $('#cl-fly', body).hidden = false; focusTo($('#cl-end p', body)); }, rm ? 1000 : 6000);
      });
      api.lifecycle.on($('#cl-again', body), 'click', () => { clearTimeout(flyT); ta.value = ''; named = null; step('cl-in'); focusTo(ta); });
      // Rời bài bằng "Xong → Check-out" ở chân: chữ đang gõ (chưa gọi tên) vẫn qua luật tự hại; không lưu
      api.guard = () => {
        const text = ta.value.trim();
        return !text || text === named || gate(api, text, { from: 'B5', kind: 'none' }).route !== 'urgent';
      };
      register(api, () => {});
      return () => {};
    }
  };

  /* ================= B6 – Biết chắc – Chưa biết – Việc mình làm được (AC-52) ================= */
  const BOXES = [{ code: 'know', title: 'Biết chắc', chips: [] }, { code: 'unknown', title: 'Chưa biết', chips: [] }, { code: 'todo', title: 'Việc mình làm được hôm nay', chips: [] }];
  const knowUnknown = {
    render: (ex, api) => `${arr(ex && ex.boxes, BOXES).map((b, n) => `<section class="pl-box">
        <h2 class="section-title" id="kn-${api.esc(b.code)}-t"><span class="step-num" aria-hidden="true">${n + 1}</span> ${tt(api, b.title)}</h2>
        <div class="chips" role="group" aria-labelledby="kn-${api.esc(b.code)}-t">${arr(b.chips, []).map(v =>
          `<button type="button" class="chip" data-kx="${api.esc(b.code)}" data-v="${api.esc(v)}">+ ${tt(api, v)}</button>`).join('')}</div>
        <div class="pl-add"><label class="sr-only" for="kn-${api.esc(b.code)}">Tự viết vào ô ${tt(api, b.title)}</label>
          <input type="text" id="kn-${api.esc(b.code)}" maxlength="${+(ex && ex.maxLen) || 120}" placeholder="Tự viết…" autocomplete="off">
          <button type="button" class="btn ghost" data-kadd="${api.esc(b.code)}">Thêm</button></div>
        <ul class="pl-items" id="kn-${api.esc(b.code)}-l"></ul><p class="error-text" id="kn-${api.esc(b.code)}-m" aria-live="polite"></p></section>`).join('')}
      ${ex && ex.searchCard ? `<p class="notice">${tt(api, ex.searchCard)}</p>` : ''}
      <div id="kn-pii"></div>
      <button type="button" class="btn primary block" id="kn-done">Xong ›</button>
      <div class="pl-share"><button type="button" class="btn ghost block" id="kn-send" aria-describedby="kn-why">${tt(api, str(ex && ex.sendBtn, 'Gửi việc này cho người thương 💌'))}</button>
        <p class="fine" id="kn-why">Thêm một việc ở ô 3 rồi gửi nhé.</p>
        <div id="kn-prev" hidden><p class="label">Mình sẽ gửi đúng đoạn này:</p><blockquote class="pl-quote" id="kn-q"></blockquote>
          <div id="kn-pii2"></div>
          <div class="btn-row"><button type="button" class="btn soft" id="kn-go">Gửi ›</button>
          <button type="button" class="link" id="kn-no">Thôi</button></div></div></div>`,
    mount(body, ex, api) {
      const boxes = arr(ex && ex.boxes, BOXES), codes = boxes.map(b => b.code);
      const MAXN = +(ex && ex.maxItems) || 5, MAXL = +(ex && ex.maxLen) || 120;
      const items = Object.fromEntries(codes.map(k => [k, []])), typed = new Set();
      const input = k => $('#kn-' + CSS.escape(k), body);
      wire(body, api);
      const paint = k => {
        $(`#kn-${CSS.escape(k)}-l`, body).innerHTML = items[k].map((v, i) =>
          `<li><span>${api.esc(v)}</span><button type="button" class="link" data-krm="${api.esc(k)}" data-i="${i}" aria-label="Bỏ: ${api.esc(v)}">Bỏ</button></li>`).join('');
        const none = !(items.todo || []).length;
        $('#kn-send', body).setAttribute('aria-disabled', String(none));
        $('#kn-why', body).hidden = !none;
        if (none) $('#kn-prev', body).hidden = true;
      };
      const add = (k, v, own) => {
        v = String(v || '').trim().slice(0, MAXL);
        const m = $(`#kn-${CSS.escape(k)}-m`, body);
        if (!v || !items[k]) return false;
        if (items[k].length >= MAXN) { m.textContent = 'Mỗi ô tối đa năm mục thôi nhé.'; return false; }
        if (!items[k].includes(v)) items[k].push(v);
        if (own) typed.add(v);
        m.textContent = ''; paint(k); return true;
      };
      // Chữ đổi (gõ, thêm, bỏ mục) khi bảng nhận diện đang mở → đóng bảng (C-3)
      const closePanel = () => { $('#kn-pii', body).innerHTML = ''; };
      api.lifecycle.on(body, 'click', e => {
        const x = e.target.closest('[data-kx]'), a = e.target.closest('[data-kadd]'), r = e.target.closest('[data-krm]');
        if (x || a || r) closePanel();
        if (x) add(x.dataset.kx, api.say(x.dataset.v), false);
        else if (a) { const inp = input(a.dataset.kadd); if (add(a.dataset.kadd, inp.value, true)) inp.value = ''; inp.focus(); }
        else if (r) { items[r.dataset.krm].splice(+r.dataset.i, 1); paint(r.dataset.krm); }
      });
      api.lifecycle.on(body, 'input', e => { if (e.target.closest('.pl-add input')) closePanel(); });
      api.lifecycle.on(body, 'keydown', e => {
        const inp = e.target.closest('.pl-add input');
        if (inp && e.key === 'Enter') { e.preventDefault(); closePanel(); if (add(inp.id.slice(3), inp.value, true)) inp.value = ''; }
      });
      // Bỏ các đoạn nhận diện khỏi mục của các ô ks (all: cả mục chạm chọn, không thì chỉ mục tự gõ);
      // chuỗi mới vẫn tính là chữ tự gõ (vẫn qua luật lần sau)
      const dropOwn = (ks, hits, all) => ks.forEach(k => {
        items[k] = [...new Set(items[k].map(v => { if (!all && !typed.has(v)) return v; const d = dropHits(v, hits); if (d && d !== v) typed.add(d); return d; }).filter(Boolean))];
        paint(k);
      });
      // Chữ tự viết (cả chữ còn trong ô chưa bấm Thêm) qua luật an toàn; chữ ví dụ là hằng nên không cần
      const own = () => Object.values(items).flat().filter(v => typed.has(v)).concat(codes.map(k => input(k).value.trim())).filter(Boolean).join('\n');
      const save = () => { if (typeof api.saveTexts === 'function') api.saveTexts(Object.fromEntries(codes.map(k => [k, items[k].slice()]))); };
      // onOk: chữ qua luật; onKeep: chọn "Vẫn giữ" ở bảng nhận diện (mặc định như onOk).
      // "Vẫn giữ" chỉ cho qua khi chữ tự viết KHÔNG đổi so với lúc hiện bảng; đổi rồi thì chạy lại check (C-3)
      const check = (box, onOk, onKeep = onOk) => {
        const text = own();
        const g = gate(api, text, { from: 'B6', kind: canWrite(api) ? 'save' : 'none' });
        if (g.route === 'urgent') return false;
        if (g.route === 'pii') {
          api.piiPanel($(box, body), g.pii, {
            onEdit: () => { const f = $('.pl-add input', body); if (f) f.focus(); },
            onDrop: () => { dropOwn(codes, g.pii); codes.forEach(k => { input(k).value = dropHits(input(k).value, g.pii); }); },
            onKeep: () => { if (own() !== text) check(box, onOk, onKeep); else onKeep(); }
          });
          return false;
        }
        onOk(); return true;
      };
      const leave = () => { save(); if (typeof api.finish === 'function') api.finish('complete'); };
      // Để trống cả ba vẫn "Xong" được (AC-52)
      api.lifecycle.on($('#kn-done', body), 'click', () => check('#kn-pii', leave));
      // Rời bài bằng "Xong → Check-out" ở chân trang: vẫn qua luật; qua thì lưu và để stop.js chuyển màn
      api.guard = () => check('#kn-pii', save, leave);

      // "Gửi việc này cho người thương 💌": xem nguyên văn → luật (kind send) → bảng chia sẻ / sao chép. Không ghi gì về người nhận.
      api.lifecycle.on($('#kn-send', body), 'click', () => {
        if (!(items.todo || []).length) { focusTo($('#kn-why', body)); return; }
        $('#kn-q', body).textContent = 'Việc mình làm được hôm nay:\n- ' + items.todo.join('\n- ');
        $('#kn-prev', body).hidden = false;
        focusTo($('#kn-q', body));
      });
      api.lifecycle.on($('#kn-no', body), 'click', () => { $('#kn-prev', body).hidden = true; $('#kn-send', body).focus(); });
      api.lifecycle.on($('#kn-go', body), 'click', () => {
        const t = $('#kn-q', body).textContent, share = () => api.shareText(t);
        const g = gate(api, t, { from: 'B6', kind: 'send' });
        if (g.route === 'urgent') return;
        // PII: "Sửa" → đóng xem trước để sửa ở ô; "Bỏ đoạn đó" → bỏ thật khỏi mục tự gõ ở ô 3 rồi vẽ lại xem trước (n-2);
        // "Vẫn giữ" → gửi đúng chữ đã xem (chuỗi t vừa qua gate)
        if (g.route === 'pii') {
          api.piiPanel($('#kn-pii2', body), g.pii, {
            onEdit: () => $('#kn-no', body).click(),
            onDrop: () => { dropOwn(['todo'], g.pii, true); if (items.todo.length) $('#kn-send', body).click(); },
            onKeep: share
          });
          return;
        }
        share();
      });
      codes.forEach(paint);
      register(api, () => {});
      return () => {};
    }
  };

  /* ================= B7 – Âm thanh êm dịu: không tự phát, hẹn giờ, âm lượng 30, rời màn tắt (AC-53) ================= */
  const KINDS = [{ code: 'waves', icon: '🌊', label: 'Sóng' }, { code: 'rain', icon: '🌧️', label: 'Mưa' }, { code: 'wind', icon: '🍃', label: 'Gió êm' }];
  const MINS = [5, 10, 15];
  const NO_AUDIO = 'Máy này chưa phát được âm thanh. Bài vẫn chạy bình thường, không có nhạc nhé.';
  // Âm lượng mặc định 30; dữ liệu có defaultVolume thì theo nhưng không quá 50
  const defVol = ex => { const v = +(ex && ex.defaultVolume); return v >= 0 && v <= 50 && ex.defaultVolume != null ? v : (SOUND ? SOUND.DEFAULT_VOLUME : 30); };
  const minList = ex => { const l = arr(ex && ex.timers, MINS).map(Number).filter(m => MINS.includes(m)); return l.length ? l : MINS; };
  const calmSound = {
    render(ex, api, opts = {}) {
      const ok = !!(SOUND && SOUND.supported()), v = defVol(ex), ml = minList(ex);
      const kinds = arr(ex && ex.sounds, KINDS).filter(k => ['waves', 'rain', 'wind'].includes(k.code));
      const def = ml.includes(+opts.minutes) ? +opts.minutes : ml.includes(+(ex && ex.defaultTimer)) ? +ex.defaultTimer : ml[0];
      return `<p class="label" id="ak-l">Âm nền</p>${chips(api, 'ak', 'ak-l', (kinds.length ? kinds : KINDS).map(k => ({ v: k.code, label: (k.icon ? k.icon + ' ' : '') + k.label })), (kinds[0] || KINDS[0]).code)}
        <p class="label" id="am-l">Hẹn giờ</p>${chips(api, 'am', 'am-l', ml.map(m => ({ v: m, label: m + ' phút' })), def)}
        <label class="label" for="avol">Âm lượng</label>
        <div class="pl-vol"><span aria-hidden="true">🔈</span><input type="range" id="avol" min="0" max="100" step="5" value="${v}" aria-valuetext="Âm lượng ${v}"><span aria-hidden="true">🔊</span></div>
        ${ex && ex.fine ? `<p class="fine">${tt(api, ex.fine)}</p>` : ''}
        <div class="btn-row"><button type="button" class="btn primary" id="aplay"${ok ? '' : ' aria-disabled="true" aria-describedby="anone"'}>▶ Phát</button></div>
        <p class="error-text" id="anone"${ok ? ' hidden' : ''}>${api.esc(NO_AUDIO)}</p>
        <p class="pl-timer" id="aleft" role="timer" aria-live="off"></p><div id="aend" aria-live="polite"></div>`;
    },
    mount(body, ex, api) {
      const T = timers(api);
      const pick = n => ((($(`[data-${n}][aria-pressed="true"]`, body) || {}).dataset || {})[n]);
      let h = null, timer = null, kind = pick('ak') || 'waves', mins = +pick('am') || 10;
      const play = $('#aplay', body), left = $('#aleft', body), volEl = $('#avol', body);
      const paint = () => { if (h && h.endsAt) left.textContent = 'Còn ' + mmss((h.endsAt - Date.now()) / 1000); };
      wire(body, api);
      function ended() {
        if (!h) return;
        h = null; timer = T.clear(timer);
        play.textContent = '▶ Phát'; left.textContent = '';
        $('#aend', body).innerHTML = `<p>${tt(api, str(ex && ex.end, 'Hết giờ rồi.'))}</p>${fin(api)}`;
      }
      function start(minutes) {
        $('#aend', body).innerHTML = '';
        // Chỉ tạo âm trong handler của cú chạm (không tự phát)
        h = SOUND ? SOUND.ambient(kind, { volume: +volEl.value, minutes, onEnd: ended }) : null;
        if (!h) { $('#anone', body).hidden = false; play.setAttribute('aria-disabled', 'true'); return; }
        play.textContent = '■ Dừng';
        paint();
        timer = T.every(() => { paint(); if (h && h.endsAt && Date.now() >= h.endsAt + 1500) { try { h.stop(0); } catch (e) { /* bỏ qua */ } ended(); } }, 1000);
      }
      function stop(fade = 800) {
        timer = T.clear(timer);
        if (h) { try { h.stop(fade); } catch (e) { /* bỏ qua */ } h = null; }
        play.textContent = '▶ Phát'; left.textContent = '';
      }
      const restart = () => { if (!h) return; const rest = Math.max(0.2, (h.endsAt - Date.now()) / 60000); stop(400); start(rest); };
      api.lifecycle.on(play, 'click', () => { if (play.getAttribute('aria-disabled') === 'true') return; if (h) stop(); else start(mins); });
      bindChips(api, body, 'am', v => { mins = +v || 10; if (h) { stop(400); start(mins); } });
      bindChips(api, body, 'ak', v => { kind = v; restart(); });
      api.lifecycle.on(volEl, 'input', () => { volEl.setAttribute('aria-valuetext', 'Âm lượng ' + volEl.value); if (h) h.setVolume(+volEl.value); });
      api.lifecycle.on(document, 'visibilitychange', () => { if (!document.hidden) paint(); });
      const pause = () => stop(800);
      register(api, pause);
      return pause;
    }
  };

  /* ================= B8 – Bàn tay ấm – bản ngày: trình chiếu chữ nền sáng qua api.paced (night.js, mục 7.4) ================= */
  const warmHandDay = {
    render: () => '<div class="pl-reader" id="wh"></div><div id="wh-end" aria-live="polite"></div>',
    mount(body, ex, api) {
      const box = $('#wh', body);
      wire(body, api);
      if (!api.paced || typeof api.paced.mount !== 'function') { register(api, () => {}); return () => {}; }
      const h = api.paced.mount(box, {
        scriptId: str(ex && ex.scriptId, 'WARM_HAND_DAY'), theme: 'day',
        onEnd: end => { if (end === 'finished') { const e = $('#wh-end', body); if (e && !e.firstChild) e.innerHTML = fin(api); } }
      }) || {};
      const call = k => { try { if (typeof h[k] === 'function') h[k](); } catch (e) { /* bỏ qua */ } };
      api.lifecycle.onCleanup(() => call('stop'));
      // "Trở về thở tự nhiên" chỉ tạm dừng chữ (bấm "Tiếp tục bài" rồi chạm ▶ để đọc tiếp); rời màn mới stop
      const pause = () => call('pause');
      register(api, pause);
      return pause;
    }
  };

  return {
    pause5, breath46, grounding, release, cloud, knowUnknown, calmSound, warmHandDay,
    stopAll, gate, dropHits,
    TYPES: ['pause5', 'breath46', 'grounding', 'release', 'cloud', 'knowUnknown', 'calmSound', 'warmHandDay']
  };
})();
