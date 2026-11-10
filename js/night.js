/* Hành Trình Đón Con – js/night.js · module "Trước khi ngủ" (A1) · Chủ: FE-5 Trước khi ngủ
   Đặc tả: tech design 4 + 4.1 (M13 `night` + hộp M13a/M13b, M13c `night_how`, M14/M14r `night_play`, L12 `night_heavy`),
   6.6, 7.3, 7.4; UX 4.5, mục 5 (chế độ đêm), 8 (phím), 9; PRD 6.5, V1–V8, AC-40…49d; ADR 0012.
   - KHÔNG giọng đọc máy: bài đêm là chữ hiện từng khối theo pacer.js (giờ thật), chạm để sang, ⏸, hoặc cả bài cuộn.
   - Bài có em bé (H1, H2) LUÔN qua hộp cổng hỏi mỗi lần mở; sau tin buồn có hộp xác nhận chạy trước (api.openNight).
     Hộp chỉ mở khi đang ở màn `night` (mở từ ngoài thì sang `night` trước) để luôn có nền đêm (AC-49c).
   - Câu trả lời cổng hỏi không ghi đi đâu (tech design 5.3). Bản ghi NightRec chỉ có bài, cách nghe, nhạc, kết, cảm nhận.
   - Ẩn tab → chữ tự tạm dừng, chờ bấm "Tiếp tục" (K-9, AC-47b). Giữ màn sáng bằng Wake Lock nếu có.
   - Nhạc nền chỉ bật trong cú bấm "Bắt đầu" (AC-48); rời màn, dừng bài, "nặng lòng" → SOUND.stopAll(800) (AC-45).
   - Màn đêm không toast, không rung (UX 5). Hình hai bé capybara: chờ T-06 (đang dùng 🐾🐾 như UX 12 khi SVG lỗi). */
(() => {
  'use strict';
  const isFn = f => typeof f === 'function';
  let N = null;            // bộ helper dựng một lần cho api (screens và provides dùng chung)
  let music = null;        // { handle, kind, minutes } — nhạc bật ở M13c, sống qua M14 tới khi rời bài

  function build(api) {
    const { C, U, S, SC, PC, esc } = api;
    const T = SC.UI || {}, SOUND = api.SOUND || {};
    const ui = () => api.state.ui.night || (api.state.ui.night = { dim: false, setup: null, pending: null, busy: false });
    const tx = (k, ctx) => esc(api.say(T[k] || '', ctx));
    const script = id => (SC.SCRIPTS || {})[id] || null;
    // Bài đêm hiện được: có trong danh mục, không phải bản ngày, đã duyệt hoặc cho phép bản nháp (AC-34)
    const allowed = id => { const s = script(id); return !!s && !s.day && (C.ALLOW_DRAFT_CONTENT || s.status === 'approved'); };
    const flags = () => api.state.session.flags || new Set();
    const stageCode = () => api.stage() || 'none';
    const loss = () => stageCode() === 'after_loss' || flags().has('loss');
    const topName = () => { const st = api.state.stack; return st.length ? st[st.length - 1].name : ''; };
    const rm = () => api.reduceMotion();

    /* ===== Luật bài đêm: dùng engine (T-02); engine chưa có thì theo đúng bảng tech design 6.6 ===== */
    const E = () => api.E || {};
    const BY_STAGE = { start: ['NIGHT_HOME', 'NIGHT_TOGETHER'], cycle: ['NIGHT_HOME', 'NIGHT_TOGETHER'], waiting: ['NIGHT_HOME_SHORT', 'NIGHT_TOGETHER'],
      pause: ['NIGHT_TOGETHER', 'NIGHT_WARM_HAND', 'NIGHT_HOME'], positive: ['NIGHT_HOME', 'NIGHT_HOME_SHORT'], none: ['NIGHT_TOGETHER', 'NIGHT_HOME'] };
    function nightList() {
      const r = isFn(E().nightList) ? E().nightList({ stage: stageCode(), flags: flags() }) : null;
      const all = ((r && r.all) || SC.NIGHT_ORDER || []).filter(allowed);
      const sug = ((r && r.suggested) || (loss() ? ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER'] : BY_STAGE[stageCode()] || BY_STAGE.none)).filter(allowed);
      return { suggested: sug, all };
    }
    function nightGate(id) {
      if (isFn(E().nightGate)) return E().nightGate(id, { stage: stageCode(), flags: flags() });
      const baby = !!(script(id) || {}).hasBaby;
      return { gate: baby, confirmLoss: baby && loss() };
    }
    function gateOutcome(v) {
      if (isFn(E().gateOutcome)) return E().gateOutcome(v);
      return v === 'warm' ? { play: true, suggest: [] } : { play: false, suggest: v === 'heavy' ? ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER'] : ['NIGHT_TOGETHER'] };
    }

    /* ===== Xưng hô trong bài (AC-07, AC-49d) ===== */
    const defaultListener = () => ({ wife: 'anh', husband: 'chị' })[api.role()] || 'bạn';   // ngược vai chủ máy (U4)
    function sayCtx(id, how, listener, from) {
      const s = script(id) || {};
      if (s.xungMode === 'pair' && (how === 'read' || from === 'together')) return { xung: 'hai bạn', nt: 'người thương' };
      if (how === 'read') return { xung: ['anh', 'chị', 'bạn'].includes(listener) ? listener : defaultListener(), nt: 'người thương' };
      const x = api.xung();
      return { xung: x, nt: api.role() === 'solo' ? PC.fill('một người thương {xung}', { xung: x }) : 'người thương' };
    }
    const minutesOf = id => { const p = PC.plan(id, { xung: 'bạn' }); return p ? Math.max(1, Math.round(p.totalMs / 60000)) : 0; };
    const draftOf = ids => api.draftLine(ids.length && ids.every(id => (script(id) || {}).status === 'approved') ? { status: 'approved' } : null);

    /* ===== Âm thanh (sound.js của T-04; chưa có thì ẩn phần nhạc, UX 12) ===== */
    const soundOk = () => isFn(SOUND.ambient) && isFn(SOUND.unlock) && (!isFn(SOUND.supported) || SOUND.supported());
    function stopSound(ms = 800) { music = null; try { if (isFn(SOUND.stopAll)) SOUND.stopAll(ms); } catch (e) { /* bỏ qua */ } }
    const musicLive = () => !!(music && music.handle && !music.handle.stopped);

    /* ===== Giữ màn sáng (Wake Lock) — không có API thì im lặng ===== */
    const wakeOk = () => typeof navigator !== 'undefined' && !!navigator.wakeLock && isFn(navigator.wakeLock.request);
    function wakeLock() {
      let lock = null, want = false;
      const on = () => {
        want = true;
        if (!wakeOk() || lock || document.visibilityState !== 'visible') return;
        navigator.wakeLock.request('screen').then(l => {
          if (!want) { l.release().catch(() => {}); return; }
          lock = l; l.addEventListener('release', () => { if (lock === l) lock = null; });
        }).catch(() => { /* máy không cho: màn có thể tự tắt, đã nói ở M13c */ });
      };
      const off = () => { want = false; const l = lock; lock = null; if (l) l.release().catch(() => {}); };
      // Trình duyệt tự nhả khi ẩn tab: hiện lại thì xin lại nếu còn cần
      api.lifecycle.on(document, 'visibilitychange', () => { if (document.visibilityState === 'visible' && want) on(); });
      api.lifecycle.onCleanup(off);
      return { on, off };
    }

    /* ===== Bản ghi NightRec (tech design 5.3) ===== */
    function addRec(id, how, mus) {
      try {
        if (!S || !S.journal || !isFn(S.journal.add)) return null;
        const at = api.now(), tz = U.tzAt(at);
        const rec = { v: 1, kind: 'night', id: U.randomId(), at, day: U.dayOf(at, tz), tz, stage: api.stage() || null,
          script: id, how, music: mus ? mus.kind : null, end: 'left', outcome: null };
        return S.journal.add(rec) === null ? null : rec.id;
      } catch (e) { return null; }
    }
    const updRec = (rid, patch) => { try { if (rid && isFn(S.journal.update)) S.journal.update(rid, patch); } catch (e) { /* bỏ qua */ } };

    /* ===== Trình chiếu chữ theo nhịp: dùng chung M14 và B8 ban ngày (api.paced) ===== */
    function readerHtml(o) {
      return `<div class="reader-stage"><p class="reader-block" aria-live="polite"></p>` +
        `<button type="button" class="reader-tap" aria-label="Sang đoạn kế"></button></div>` +
        `<div class="reader-progress" aria-hidden="true"><span></span></div><p class="fine reader-note" aria-live="polite"></p>` +
        (o && o.ctl ? `<div class="reader-ctl"><button type="button" class="btn ghost" data-act="${esc(o.ctl)}">${esc(T.pause)}</button></div>` : '');
    }
    // root chứa .reader-block, .reader-progress span, .reader-note; trả {next, pause, resume, toggle, stop, st}
    function makeReader(root, o) {
      const pl = o.plan, blockEl = root.querySelector('.reader-block'), bar = root.querySelector('.reader-progress span'),
        note = root.querySelector('.reader-note'), wake = wakeLock();
      let st = PC.start(pl, api.now()), shown = -1, auto = false, timer = null, sleepT = null, alive = true;
      function draw() {
        if (st.i !== shown) {
          shown = st.i; blockEl.textContent = pl.blocks[st.i].text;
          if (!rm() && isFn(blockEl.animate)) blockEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, easing: 'ease' });
          if (o.onBlock) o.onBlock(st.i);
        }
        if (bar) bar.style.width = (PC.progress(st, pl, api.now()) * 100).toFixed(1) + '%';
        if (note) {
          const n = st.paused ? T.paused : (st.i < 2 && !st.done ? T.tapHint : (o.note || ''));
          if (note.textContent !== n) note.textContent = n;
        }
        if (o.onState) o.onState(st, auto);
      }
      const halt = () => { clearInterval(timer); timer = null; clearTimeout(sleepT); };
      function finish() { halt(); wake.off(); alive = false; if (o.onDone) o.onDone(); }
      const step = () => { st = PC.tick(st, pl, api.now()); draw(); if (st.done) finish(); };
      const ctl = {
        get st() { return st; },
        next() { if (!alive) return; st = PC.next(st, pl, api.now()); draw(); if (st.done) finish(); },
        pause(isAuto) {
          if (!alive || st.paused) return;
          st = PC.pause(st, api.now()); auto = !!isAuto; draw();
          clearTimeout(sleepT); sleepT = setTimeout(wake.off, 120000);   // tạm dừng quá 2 phút thì nhả màn (UX M14)
        },
        resume() { if (!alive || !st.paused) return; clearTimeout(sleepT); st = PC.resume(st, api.now()); auto = false; wake.on(); draw(); },
        toggle() { if (st.paused) ctl.resume(); else ctl.pause(); },
        stop() { halt(); wake.off(); alive = false; }
      };
      // K-9, AC-47b: ẩn tab / tắt màn → tự tạm dừng; hiện lại vẫn dừng, chờ người dùng bấm "Tiếp tục"
      api.lifecycle.on(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') ctl.pause(true); });
      api.lifecycle.onCleanup(ctl.stop);
      api.lifecycle.on(root.querySelector('.reader-tap'), 'click', () => ctl.next());
      draw(); wake.on(); timer = setInterval(step, 250);
      return ctl;
    }

    /* ===== Mở một bài đêm: M13a → M13b → M13c (mọi lối vào gọi hàm này) ===== */
    function openNight(id, opts) {
      const from = (opts && opts.from) || null;
      if (!allowed(id)) return false;
      const g = nightGate(id) || {};
      if (!g.gate && !g.confirmLoss) return goHow(id, from);
      if (topName() !== 'night') { ui().pending = { id, from }; return api.go('night'); }
      flow(id, g, from);
      return true;
    }
    async function flow(id, g, from) {
      const u = ui();
      if (u.busy) return;
      u.busy = true;
      try {
        if (g.confirmLoss) {   // AC-42: chạy TRƯỚC cổng; nút nổi + focus + Esc = "Để lúc khác"
          const v = await api.dialog({ title: api.say(T.confirmTitle), body: `<p>${tx('confirmBody')}</p>`,
            actions: [{ label: T.confirmLater, value: 'later', kind: 'primary', safe: true }, { label: T.confirmGo, value: 'go', kind: 'link' }] });
          if (v !== 'go' || topName() !== 'night') return;
        }
        if (g.gate) {          // AC-40, V1: mỗi lần mở; ba nút ngang hàng, focus vào tiêu đề; Esc = ở lại M13
          const v = await api.dialog({ title: api.say(T.gateQ), defaultFocus: -1, actions: [
            { label: T.gateWarm, value: 'warm', kind: 'ghost big' }, { label: T.gateHeavy, value: 'heavy', kind: 'ghost big' },
            { label: T.gateUnsure, value: 'unsure', kind: 'ghost big' }, { label: T.gateClose, value: 'close', kind: 'link', safe: true }] });
          if (topName() !== 'night') return;
          if (v === 'warm' && gateOutcome('warm').play) goHow(id, from);
          else if (v === 'heavy' || v === 'unsure') api.go('night', { gate: v }, { replace: true });
          return;
        }
        goHow(id, from);
      } finally { u.busy = false; }
    }

    // Vé: bài có cổng chỉ vào M13c / M14 qua openNight; ‹ / Tiến thì hỏi lại (G-4)
    const goHow = (id, from) => { ui().ok = id; return api.go('night_how', from ? { id, from } : { id }); };
    // n-5: render và mount cùng một điều kiện; chưa có vé → render chỉ vẽ khung rỗng, không chớp chữ bài
    const locked = id => { const g = nightGate(id) || {}; return !!(g.gate || g.confirmLoss) && ui().ok !== id; };
    const blank = () => '<h1 class="sr-only">Trước khi ngủ</h1>';
    const shut = (id, from) => { if (!locked(id)) return false;
      ui().pending = { id, from }; api.lifecycle.later(() => api.go('night', {}, { replace: true }), 0); return true; };

    /* ===== M13 Trước khi ngủ ===== */
    function card(id) {
      const s = script(id);
      return `<button type="button" class="night-card" data-act="pick" data-id="${esc(id)}"><span class="night-card-title">${esc(s.icon)} ${esc(s.title)}</span>` +
        `<span class="night-card-meta">${esc(s.goal)} · ~${minutesOf(id)} phút · ${s.hasBaby ? tx('tagBaby') : tx('tagNoBaby')}</span></button>`;
    }
    // Hai bé capybara (T-06): sleep ở M13 + kết M14; blanket cho H4, "nặng lòng". Trang trí: alt="", aria-hidden; lỗi → 🐾🐾 (app.js)
    const capy = (pose = 'sleep', px = 96) => `<img class="night-art" src="assets/art/capy-pair-${pose === 'blanket' ? 'blanket' : 'sleep'}.svg" ` +
      `width="${px}" height="${px}" alt="" aria-hidden="true" decoding="async" data-fallback="🐾🐾" data-fb-class="night-capy">`;
    const night = {
      title: 'Trước khi ngủ', theme: 'night',
      render(p = {}) {
        const list = nightList();
        let body;
        if (p.gate === 'heavy' || p.gate === 'unsure') {
          const ids = (gateOutcome(p.gate).suggest || []).filter(allowed);
          body = `<div class="card night-soft"><p>${tx(p.gate === 'heavy' ? 'afterHeavy' : 'afterUnsure')}</p>${ids.map(card).join('')}` +
            `<button type="button" class="link" data-act="relist">${tx('gateClose')}</button></div>`;
        } else if (!list.all.length) {
          body = `<p class="notice">${tx('empty')}</p><button type="button" class="link" data-act="home">${tx('home')}</button>`;
        } else {
          const others = list.all.filter(id => !list.suggested.includes(id));
          body = (list.suggested.length ? `<h2>${tx('suggested')}</h2>${list.suggested.map(card).join('')}` : '');
          if (others.length) {
            body += loss() && others.some(id => script(id).hasBaby)
              ? `<details class="night-more"><summary>${tx('othersLoss')}</summary>${others.map(card).join('')}</details>`   // AC-41: đóng sẵn
              : `<h2>${tx('others')}</h2>${others.map(card).join('')}`;
          }
        }
        return `${capy()}<h1>Trước khi ngủ</h1><p class="lead">${tx('nightLead')}</p><p class="notice night-promise">${tx('noPromise')}</p>` +
          `${body}${draftOf(list.all)}`;
      },
      mount() {
        api.screenActions({ pick: b => openNight(b.dataset.id), relist: () => api.go('night', {}, { replace: true }) });
        ui().ok = null;
        const pend = ui().pending;
        ui().pending = null;
        if (pend && allowed(pend.id)) { const g = nightGate(pend.id) || {}; if (g.gate || g.confirmLoss) flow(pend.id, g, pend.from); }
      }
    };

    /* ===== M13c Cách nghe ===== */
    function setup() {
      const u = ui();
      if (!u.setup) {
        let vol = 30;
        try { const sv = S.prefs.get('sound'); if (sv && Number.isFinite(+sv.volume)) vol = U.clamp(+sv.volume, 0, 100); } catch (e) { /* bỏ qua */ }
        u.setup = { how: 'pace', listener: defaultListener(), music: { on: false, kind: 'waves', volume: vol, minutes: 20 } };
      }
      return u.setup;
    }
    const chip = (act, val, label, on, extra = '') =>
      `<button type="button" class="chip" data-act="${act}" data-v="${esc(val)}" aria-pressed="${on ? 'true' : 'false'}"${extra}>${esc(label)}</button>`;
    const listenerChips = cur => `<div class="chips listener" role="group" aria-label="${tx('listener')}"><span class="chips-label">${tx('listener')}</span>` +
      ['anh', 'chị', 'bạn'].map(x => chip('listener', x, x, cur === x)).join('') + '</div>';
    const opt = (v, cur, title, sub) => `<label class="how-opt"><input type="radio" name="how" value="${v}"${cur === v ? ' checked' : ''}>` +
      `<span><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
    const night_how = {
      title: 'Cách nghe', theme: 'night',
      render(p = {}) {
        const s = script(p.id);
        if (!s || !allowed(p.id)) return `<h1>${tx('howTitle')}</h1><p><button type="button" class="link" data-go="night">‹ ${tx('others')}</button></p>`;
        if (locked(p.id)) return blank();
        const su = setup(), pair = s.xungMode === 'pair', m = su.music;
        if (su.how === 'voice' && !s.audio.length) su.how = 'pace';
        let html = `${capy(p.id === 'NIGHT_WARM_HAND' ? 'blanket' : 'sleep', 72)}<p class="eyebrow">${esc(s.icon)} ${esc(s.title)}</p><h1>${tx('howTitle')}</h1>` +
          `<fieldset class="how-list"><legend class="sr-only">${tx('howTitle')}</legend>` +
          opt('pace', su.how, T.howPace, T.howPaceSub) + opt('read', su.how, T.howRead, T.howReadSub) +
          (pair ? '' : `<div class="listener-wrap"${su.how === 'read' ? '' : ' hidden'}>${listenerChips(su.listener)}</div>`) +
          (s.audio.length ? opt('voice', su.how, T.howVoice, '') : '') + '</fieldset>';   // AC-49b
        if (soundOk()) {
          html += `<div class="music-box"><div class="music-row"><span id="nMusic">${tx('music')}</span>` +
            `<button type="button" class="switch" role="switch" aria-checked="${m.on}" aria-labelledby="nMusic" data-act="musicOn"></button></div>` +
            `<div class="music-more"${m.on ? '' : ' hidden'}><div class="chips" role="group" aria-label="${tx('music')}">` +
            Object.keys(T.musicKinds).map(k => chip('musicKind', k, T.musicKinds[k], m.kind === k)).join('') + '</div>' +
            `<label class="label" for="nVol">${tx('volume')} <span class="vol-val">${m.volume}</span></label>` +
            `<input id="nVol" type="range" min="0" max="100" step="5" value="${m.volume}">` +
            `<span class="label">${tx('timer')}</span><div class="chips" role="group" aria-label="${tx('timer')}">` +
            [10, 20, 30].map(n => chip('musicMin', n, n + ' phút', m.minutes === n)).join('') + '</div>' +
            `<p class="fine">${tx('musicIos')}</p></div></div>`;
        }
        html += `<p class="fine">${esc(s.posture)}</p>${wakeOk() ? '' : `<p class="fine">${tx('noWake')}</p>`}` +
          `<button type="button" class="btn primary block" data-act="start">${tx('start')}</button>${draftOf([p.id])}`;
        return html;
      },
      mount(root, p = {}) {
        const s = script(p.id);
        if (!s || !allowed(p.id) || shut(p.id, p.from)) return;
        const su = setup(), $ = q => root.querySelector(q);
        const press = (act, v) => root.querySelectorAll(`[data-act="${act}"]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
        root.querySelectorAll('input[name="how"]').forEach(r => api.lifecycle.on(r, 'change', () => {
          su.how = r.value;
          const lw = $('.listener-wrap'); if (lw) lw.hidden = su.how !== 'read';
        }));
        const vol = $('#nVol');
        if (vol) api.lifecycle.on(vol, 'input', () => {
          su.music.volume = U.clamp(+vol.value || 0, 0, 100); $('.vol-val').textContent = su.music.volume;
          try { S.prefs.set('sound', { volume: su.music.volume }); } catch (e) { /* bỏ qua */ }
        });
        api.screenActions({
          listener: b => { su.listener = b.dataset.v; press('listener', su.listener); },
          musicOn: b => { su.music.on = !su.music.on; b.setAttribute('aria-checked', String(su.music.on)); $('.music-more').hidden = !su.music.on; },
          musicKind: b => { su.music.kind = b.dataset.v; press('musicKind', su.music.kind); },
          musicMin: b => { su.music.minutes = +b.dataset.v; press('musicMin', su.music.minutes); },
          // Cú bấm của người dùng: chỉ ở đây mới mở âm thanh (AC-48)
          start: () => {
            stopSound(0);
            let mus = null, fail = false;
            if (su.music.on && soundOk()) {
              try {
                SOUND.unlock();
                const h = SOUND.ambient(su.music.kind, { volume: su.music.volume, minutes: su.music.minutes });
                if (h) { music = { handle: h, kind: su.music.kind, minutes: su.music.minutes }; mus = { kind: su.music.kind, minutes: su.music.minutes }; } else fail = true;
              } catch (e) { fail = true; }
            }
            const prm = { id: p.id, how: su.how, music: mus };
            if (su.how === 'read' && s.xungMode !== 'pair') prm.listener = su.listener;
            if (p.from) prm.from = p.from;
            if (fail) prm.soundFail = true;
            api.go('night_play', prm);
          }
        });
      }
    };

    /* ===== M14 / M14r Trình chiếu đêm ===== */
    const foot = extra => `<div class="reader-foot">${extra || ''}` +
      `<button type="button" class="btn soft block" data-act="natural">${tx('natural')}</button>` +
      `<button type="button" class="btn ghost block" data-act="heavy">${tx('heavy')}</button></div>`;
    const calm = () => `<div class="reader-calm" role="status" hidden><p>${tx('naturalText')}</p>` +
      `<button type="button" class="btn primary block" data-act="readOn">${tx('readOn')}</button>` +
      `<button type="button" class="link" data-act="endNow">${tx('endNow')}</button></div>`;
    function readText(pl) {
      return PC.readView(pl).map(b => `<p>${esc(b.text)}</p>` + (b.pauseLabel ? `<span class="pause-mark">${esc(b.pauseLabel)}</span>` : '')).join('');
    }
    const night_play = {
      title: '', docTitle: 'Trước khi ngủ', theme: 'night',
      render(p = {}) {
        const s = script(p.id);
        if (!s || !allowed(p.id)) return `<h1>Trước khi ngủ</h1><p><button type="button" class="link" data-go="night">${tx('others')} ›</button></p>`;
        if (locked(p.id)) return blank();
        const dim = ui().dim ? ' dim' : '', end = '<div class="reader-end" hidden></div>';
        if (p.how === 'read') {
          const pair = s.xungMode === 'pair', pl = PC.plan(p.id, sayCtx(p.id, 'read', p.listener, p.from));
          return `<div class="reader night-read${dim}"><h1>${esc(s.title)}</h1>` +
            `<details class="read-how"><summary>${tx('readHowTitle')}</summary><p>${tx('readHow')}</p></details>` +
            (pair ? '' : listenerChips(sayCtx(p.id, 'read', p.listener).xung)) +
            `<div class="read-aloud">${readText(pl)}</div>${calm()}${end}` +
            foot(`<button type="button" class="btn primary block" data-act="readDone">${tx('readDone')}</button>`) + '</div>';
        }
        const voice = p.how === 'voice' && s.audio.length;
        return `<h1 class="sr-only">${esc(s.title)}</h1><div class="reader night-reader${dim}">` +
          (voice ? `<div class="reader-stage voice"><button type="button" class="btn primary" data-act="voicePlay">${tx('play')}</button></div>`
            : readerHtml()) +
          (p.soundFail ? `<p class="fine reader-warn">${tx('soundFail')}</p>` : '') +
          `${calm()}${end}` +
          foot(`<div class="reader-ctl">${voice ? '' : `<button type="button" class="btn ghost" data-act="pp">${tx('pause')}</button>`}` +
            `<button type="button" class="btn ghost" data-act="musicStop" hidden></button>` +
            `<button type="button" class="btn ghost" data-act="dim" aria-pressed="${ui().dim}">${tx('dim')}</button></div>`) + '</div>';
      },
      mount(root, p = {}) {
        const s = script(p.id);
        if (!s || !allowed(p.id) || shut(p.id, p.from)) return;
        const $ = q => root.querySelector(q), rdEl = $('.reader');
        const how = p.how === 'read' ? 'read' : (p.how === 'voice' && s.audio.length ? 'voice' : 'pace');
        const rid = addRec(p.id, how, p.music);
        let reader = null, finished = false, audioEl = null;
        api.lifecycle.onCleanup(() => stopSound(800));   // rời màn → tắt nhạc (AC-48)
        const wake = how === 'pace' ? null : wakeLock();
        if (wake) wake.on();                             // đọc cho nhau nghe / giọng thật: vẫn giữ màn sáng
        const ppBtn = $('[data-act="pp"]'), mBtn = $('[data-act="musicStop"]');
        function syncMusic() {
          if (!mBtn) return;
          const live = musicLive();
          mBtn.hidden = !live;
          if (live) {
            const left = music.handle.endsAt ? Math.max(1, Math.ceil((music.handle.endsAt - Date.now()) / 60000)) : 0;
            const t = `🎵 ${T.musicOff}${left ? ` · ${left}'` : ''}`;
            if (mBtn.textContent !== t) mBtn.textContent = t;
          }
        }
        const showFoot = on => { const f = $('.reader-foot'); if (f) f.hidden = !on; };
        function hideBody() { ['.reader-stage', '.reader-progress', '.reader-note', '.read-aloud', '.listener', '.read-how', '.reader-warn'].forEach(q => { const el = $(q); if (el) el.hidden = true; }); }
        // Check-out một chạm (PRD M14)
        function checkout() {
          if ($('.reader-end').dataset.on) return;
          hideBody(); $('.reader-calm').hidden = true; showFoot(false);
          const box = $('.reader-end');
          box.dataset.on = '1'; box.hidden = false;
          box.innerHTML = `<div class="night-end">${capy(p.id === 'NIGHT_WARM_HAND' ? 'blanket' : 'sleep')}<h2 tabindex="-1">${tx('endQ')}</h2><div class="chips" role="group" aria-label="${tx('endQ')}">` +
            chip('out', 'better', T.better, false) + chip('out', 'same', T.same, false) + chip('out', 'heavier', T.heavier, false) +
            `</div><button type="button" class="link" data-act="out" data-v="skip">${tx('skip')}</button>${draftOf([p.id])}</div>`;
          box.querySelector('h2').focus({ preventScroll: true });
        }
        function finish() {   // hết bài: ghi một lần, báo care.js (A2) tự tick "ngủ"
          if (finished) return;
          finished = true;
          updRec(rid, { end: 'finished' });
          api.emit('done', { kind: 'night', id: p.id });
        }
        function toHeavy() {   // AC-45: tắt âm ≤ 1 s, chữ dừng, màn dịu không đỏ
          stopSound(800); if (reader) reader.stop(); if (audioEl) try { audioEl.pause(); } catch (e) { /* bỏ qua */ }
          if (!finished) updRec(rid, { end: 'heavy' });
          api.go('night_heavy', { from: p.id }, { replace: true });
        }
        api.screenActions({
          pp: () => { if (reader) reader.toggle(); },
          dim: b => { const on = !ui().dim; ui().dim = on; rdEl.classList.toggle('dim', on); b.setAttribute('aria-pressed', String(on)); },
          musicStop: () => { if (music && music.handle) try { music.handle.stop(800); } catch (e) { /* bỏ qua */ } music = null; syncMusic(); },
          natural: () => {
            if (reader) reader.pause(); stopSound(800); syncMusic();
            if (audioEl) try { audioEl.pause(); } catch (e) { /* bỏ qua */ }
            if (wake) wake.off();
            if (!finished) updRec(rid, { end: 'stopped' });
            hideBody(); $('.reader-calm').hidden = false; $('[data-act="natural"]').hidden = true;
            const c = $('.reader-ctl'); if (c) c.hidden = true;
            $('.reader-calm p').setAttribute('tabindex', '-1'); $('.reader-calm p').focus({ preventScroll: true });
          },
          readOn: () => {
            $('.reader-calm').hidden = true; $('[data-act="natural"]').hidden = false;
            const c = $('.reader-ctl'); if (c) c.hidden = false;
            ['.reader-stage', '.reader-progress', '.reader-note', '.read-aloud', '.listener', '.read-how', '.reader-warn'].forEach(q => { const el = $(q); if (el) el.hidden = false; });
            if (reader) reader.resume(); if (wake) wake.on();
          },
          endNow: () => { if (reader) reader.stop(); checkout(); },
          heavy: toHeavy,
          readDone: () => { if (wake) wake.off(); finish(); checkout(); },
          listener: b => {   // AC-49d: đổi chip → chữ bài đổi xưng hô ngay, app không đổi
            ui().setup = Object.assign(setup(), { listener: b.dataset.v });
            p.listener = b.dataset.v;
            $('.read-aloud').innerHTML = readText(PC.plan(p.id, sayCtx(p.id, 'read', b.dataset.v, p.from)));
            root.querySelectorAll('[data-act="listener"]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === b.dataset.v)));
          },
          voicePlay: b => {
            if (audioEl) return;
            audioEl = document.createElement('audio');
            audioEl.preload = 'none'; audioEl.controls = true; audioEl.src = s.audio[0].url;
            b.replaceWith(audioEl);
            if (isFn(SOUND.media)) SOUND.media(audioEl, { onEnd: () => { finish(); checkout(); } });
            else api.lifecycle.on(audioEl, 'ended', () => { finish(); checkout(); });
            api.lifecycle.onCleanup(() => { try { audioEl.pause(); } catch (e) { /* bỏ qua */ } });
            audioEl.play().catch(() => {});
          },
          out: b => {
            const v = b.dataset.v, outcome = { better: 'better', same: 'same', heavier: 'heavier' }[v] || 'skip';
            updRec(rid, { outcome });
            if (outcome === 'heavier') { toHeavy(); return; }
            const box = $('.night-end');
            box.innerHTML = `<p class="night-bye" tabindex="-1">${tx('bye')}</p>` +
              (musicLive() ? `<p><button type="button" class="link" data-act="musicStop">${tx('musicOff')}</button></p>` : '') +
              `<p><button type="button" class="link" data-act="home">${tx('home')}</button></p>${draftOf([p.id])}`;
            box.querySelector('.night-bye').focus({ preventScroll: true });
          }
        });
        syncMusic();
        if (how !== 'pace') return;

        const pl = PC.plan(p.id, sayCtx(p.id, 'pace', null, p.from));
        reader = makeReader(rdEl, {
          plan: pl,
          onState: (st, auto) => {
            if (ppBtn) { const t = st.paused ? (auto ? T.resumeAuto : T.resume) : T.pause; if (ppBtn.textContent !== t) ppBtn.textContent = t; }
            syncMusic();
          },
          // Kết bài: chữ tối dần 10 s (giảm chuyển động: ba bậc độ mờ) rồi check-out; chạm màn để hiện ngay
          onDone: () => {
            finish();
            const c = $('.reader-ctl'); if (c) c.hidden = true;
            $('[data-act="natural"]').hidden = true;
            const blk = $('.reader-block');
            if (rm()) [0, 3300, 6600].forEach((ms, k) => api.lifecycle.later(() => { blk.style.opacity = String([0.66, 0.33, 0.12][k]); }, ms));
            else blk.classList.add('ending');
            api.lifecycle.on($('.reader-tap'), 'click', checkout);
            api.lifecycle.later(checkout, 10000);
            api.lifecycle.every(syncMusic, 15000);   // nhạc chạy tiếp tới hết hẹn giờ: cập nhật số phút còn lại
          }
        });
        // Phím (UX 8): Space = tạm dừng/đọc tiếp, → / Enter = đoạn kế, Esc = Dừng, về thở tự nhiên
        api.lifecycle.on(document, 'keydown', e => {
          if (finished || !$('.reader-calm').hidden || document.querySelector('.dlg-backdrop')) return;
          const t = e.target, onCtl = t && t.closest && t.closest('button, a, input, summary, select, textarea, label') && !t.classList.contains('reader-tap');
          if (onCtl) return;
          if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); reader.toggle(); }
          else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); reader.next(); }
          else if (e.key === 'Escape') { e.preventDefault(); $('[data-act="natural"]').click(); }
        });
      }
    };

    /* ===== L12 "Bài này làm mình nặng lòng" (kịch bản 0.5): dịu, không đỏ, không tự chuyển bài ===== */
    const night_heavy = {
      title: '', docTitle: 'Mình dừng ở đây', theme: 'night',
      render(p = {}) {
        const H = SC.HEAVY || {}, s = script(p.from), baby = !s || s.hasBaby;
        const lines = baby ? H.lines : [H.noBabyLine, H.lines[1]];
        const warm = p.from !== 'NIGHT_WARM_HAND' && allowed('NIGHT_WARM_HAND');
        return `<div class="night-heavy">${capy('blanket')}<h1>${esc(H.title)}</h1>${lines.map(l => `<p>${esc(api.say(l))}</p>`).join('')}` +
          (warm ? `<button type="button" class="btn primary block" data-act="warm">${esc(H.warmHand)}</button>` : '') +
          `<p><button type="button" class="link" data-go="support">${esc(H.support)}</button></p></div>`;
      },
      mount() { ui().ok = null; stopSound(800); api.screenActions({ warm: () => openNight('NIGHT_WARM_HAND') }); }
    };

    /* ===== api.paced (7.4): trình chiếu chữ cho B8 "Bàn tay ấm – bản ngày" trong trình phát ngày ===== */
    const paced = {
      mount(root, o = {}) {
        const noop = { pause() {}, resume() {}, stop() {} };
        const ctx = o.sayCtx || { xung: api.xung(), nt: 'người thương' };
        const pl = PC.plan(o.scriptId, ctx);
        if (!pl || !root) return noop;
        root.innerHTML = `<div class="reader embed${o.theme === 'night' ? ' night-embed' : ''}">${readerHtml({ ctl: 'pacedPP' })}</div>`;
        const box = root.querySelector('.reader'), pp = root.querySelector('[data-act="pacedPP"]');
        const rd = makeReader(box, {
          plan: pl, onBlock: o.onBlock,
          onState: (st, auto) => { const t = st.paused ? (auto ? T.resumeAuto : T.resume) : T.pause; if (pp.textContent !== t) pp.textContent = t; },
          onDone: () => { pp.hidden = true; if (isFn(o.onEnd)) o.onEnd('finished'); }
        });
        api.screenActions({ pacedPP: () => rd.toggle() });
        return { pause: () => rd.pause(), resume: () => rd.resume(), stop: () => rd.stop() };
      }
    };

    return { screens: { night, night_how, night_play, night_heavy }, paced, openNight, tx };
  }

  const get = api => N || (N = build(api));
  (window.HTDC_MODULES = window.HTDC_MODULES || []).push({
    name: 'night',
    screens: api => get(api).screens,
    provides: api => ({ paced: get(api).paced, openNight: get(api).openNight }),
    // Ô 🌙 ở Trang chính; sau NIGHT_FROM_HOUR lên đầu (PRD M05)
    homeTiles: api => [{
      id: 'night',
      get order() { return api.hour() >= api.C.NIGHT_FROM_HOUR ? 5 : 20; },
      render: () => `<button type="button" class="tile night" data-go="night"><strong>🌙 Trước khi ngủ</strong>` +
        `<span class="tile-sub">${get(api).tx(api.stage() === 'after_loss' ? 'tileSubLoss' : 'tileSub')}</span></button>`
    }]
  });
})();
