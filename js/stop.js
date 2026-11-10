/* =========================================================
   Hành Trình Đón Con – js/stop.js · "Dừng lại" (A1) · Chủ: FE-4 (T-04). Đặc tả: tech design 4, 6.4, 8; UX 4.3; PRD 8.1, 8.3.
   Nguồn: apps/lifestyle-thai-phu/js/relax.js @ 10/11/2026 (ADR 0008) — luồng, lớp "thở tự nhiên" / "khó chịu".
   Khác bản gốc: dots10, capyCards, safety_q, E.recommend, api.calmLayer (A2 dùng lại).
   Lượt ở api.state.ui.stop; cờ ở api.state.session.flags (chỉ cộng, không ghi). StopRec 5.3 ghi xuyên. Không Web Speech.
   ========================================================= */
(() => {
  'use strict';
  const GRP_OF = { pause5: 'calm', breath46: 'calm', grounding: 'calm', release: 'calm', cloud: 'thought', knowUnknown: 'thought', calmSound: 'rest', warmHandDay: 'rest' };
  const POSTURE_TYPES = ['breath46', 'release', 'calmSound', 'warmHandDay'];
  // Một lượt M06–M12. noteOk: chữ đã qua đủ luật, chỉ chữ này được ghi (C-1); pend: chữ chờ M08 / bảng nhận diện
  const fresh = () => ({ before: null, emotions: [], contexts: [], minutes: null, note: '', noteOk: '', piiOk: null, pend: null,
    sqDone: false, editHit: null, next: 'suggest', checked: false, recId: null, attempt: 0, done: [], ex: null, after: null,
    fit: null, texts: {}, finished: false, keepStage: false, toasted: false, marked: false });
  const isLv = v => Number.isInteger(v) && v >= 1 && v <= 10;

  function make(api) {
    const C = api.C || {}, S = api.S, U = api.U, esc = api.esc, lc = api.lifecycle;
    const D = () => api.D || {}, E = () => api.E || {}, P = () => api.P || window.HTDC_PLAYERS || {};
    const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const t = (k, v) => api.t(k, v);
    // Chữ thô của D.TEXT, không có thì fb
    const raw = (k, fb = '', v) => { const T = D().TEXT || {}; return typeof T[k] === 'string' ? api.say(T[k], v) : api.say(fb, v); };
    const tt = s => esc(api.say(s));
    const goA = (name, p) => `data-go="${esc(name)}"${p ? ` data-params="${esc(JSON.stringify(p))}"` : ''}`;
    const flags = () => api.state.session.flags;
    const st = () => api.state.ui.stop || (api.state.ui.stop = fresh());
    const canWrite = () => !!(S && typeof S.canSave === 'function' && S.canSave('writing'));
    const card = k => (D().CARDS || {})[k] || {};
    // Trạng thái duyệt câu chữ an toàn (nhóm 'safety')
    const safetyRev = () => (D().CONTENT_GROUPS || []).find(g => g && g.code === 'safety') || null;
    // Hai bé capybara (T-06): trang trí; ảnh lỗi → 🐾🐾
    const pair = (pose, px, cls = '') => `<span class="st-pair ${cls}"><img src="assets/art/capy-pair-${pose}.svg" width="${px}" height="${px}" alt="" aria-hidden="true" data-fallback="🐾🐾" data-fb-class="st-paws"></span>`;
    const pairNow = px => pair(api.stage() === 'after_loss' ? 'blanket' : 'side', px);

    /* ===== Danh mục bài ===== */
    const exMap = () => D().EXERCISES || {};
    const plOf = ex => (ex && P()[ex.type] && typeof P()[ex.type].mount === 'function' ? P()[ex.type] : null);
    // Bài mở được: có trình phát, không nín thở, draft chỉ khi ALLOW_DRAFT_CONTENT (AC-34, 36)
    const findEx = id => {
      const ex = Object.prototype.hasOwnProperty.call(exMap(), id) ? exMap()[id] : null;
      return ex && !ex.holdsBreath && (ex.screen || 'player') === 'player' && plOf(ex) && (C.ALLOW_DRAFT_CONTENT || ex.status === 'approved') ? ex : null;
    };
    // M09 (R5, T-I2): bài có màn riêng (C3 together_talk, C4 send_words) mở được khi màn đã đăng ký; còn lại như findEx
    const ownScr = ex => (ex && ex.screen && ex.screen !== 'player' && api.has(ex.screen) ? ex.screen : '');
    const findSg = id => {
      const ex = Object.prototype.hasOwnProperty.call(exMap(), id) ? exMap()[id] : null;
      return findEx(id) || (ex && !ex.holdsBreath && ownScr(ex) && (C.ALLOW_DRAFT_CONTENT || ex.status === 'approved') ? ex : null);
    };
    const fmtMin = ex => {
      const lo = +ex.min || 0, hi = Math.max(lo, +ex.max || lo);
      if (hi <= 0.5) return 'nửa phút';
      return lo === hi ? hi + ' phút' : Math.max(1, lo) + '–' + hi + ' phút';
    };
    const libIds = () => {
      const ids = typeof E().library === 'function' ? E().library({ stage: api.stage(), flags: flags(), available: api.has }) : Object.keys(exMap());
      return (ids || []).filter(findEx);
    };

    /* ===== StopRec (5.3): tạo một lần mỗi lượt ===== */
    function ensureRec(origin) {
      const s = st();
      if (s.recId || !S || !S.journal) return;
      const at = api.now(), tz = U.tzAt(at);
      const rec = { v: 1, kind: 'stop', id: U.randomId(), at, day: U.dayOf(at, tz), tz, origin: origin === 'library' ? 'library' : 'stop',
        stage: api.stage() || null, before: isLv(s.before) ? s.before : null, emotions: s.emotions.slice(0, 3), contexts: s.contexts.slice(),
        minutes: s.minutes || null, done: [], after: null, fit: null };
      // Chữ: chỉ noteOk (C-1), khi đồng ý lưu chữ (AC-13). Không ghi rule: R1 ⇔ cờ 8.2b (N-1)
      if (s.noteOk.trim() && canWrite()) rec.note = s.noteOk.slice(0, C.NOTE_MAX || 1000);
      const r = S.journal.add(rec);
      s.recId = r && r.id ? r.id : null;
      api.state.session.stopId = s.recId;
    }
    const upd = patch => { const s = st(); if (s.recId) S.journal.update(s.recId, patch); };

    /* ===== PRD 8.1 "Kể thêm": tự hại → M08 → nhận diện → gợi ý (n-1) =====
       ui = { from, box, input (M07), leave(), replace, onEdit (M08) } */
    function runCheck(text, ui) {
      const s = st(), out = () => { if (ui.leave) ui.leave(); };
      s.note = text; s.checked = true; s.pend = null;
      const g = P().gate(api, text, { from: ui.from, kind: canWrite() && text.trim() ? 'save' : 'none' });
      if (g.route === 'urgent') { s.note = s.noteOk = ''; return; }   // chữ dẫn tới M20 không lưu (AC-23)
      const a = E().assess({ texts: [text], level: isLv(s.before) ? s.before : null, emotions: s.emotions.slice(), flags: new Set(flags()) }) || {};
      if (a.flags) a.flags.forEach(f => flags().add(f));
      if (a.route === 'urgent') { s.note = s.noteOk = ''; out(); api.go('urgent', { from: ui.from }); return; }
      s.pend = { text, pii: g.pii || [] };
      if (a.route === 'safety_q' && !s.sqDone) { out(); api.go('safety_q'); return; }
      piiThenGo(ui);
    }
    function piiThenGo(ui) {
      const s = st(), p = s.pend, nx = s.next === 'library' ? 'library' : 'suggest';
      const go = () => {
        s.pend = null;
        if (p) {   // nhớ noteOk; lượt đã có StopRec (quay lại M07 sửa) thì cập nhật
          s.note = s.noteOk = p.text;
          if (s.recId && canWrite()) upd({ note: p.text.trim() ? p.text.slice(0, C.NOTE_MAX || 1000) : undefined });
        }
        if (ui.leave) ui.leave();
        api.go(nx, nx === 'library' ? { from: 'suggest' } : {}, ui.replace ? { replace: true } : {});
      };
      if (!p || !p.pii.length || s.piiOk === p.text) { go(); return; }
      // M07 "Vẫn giữ": kiểm lại từ đầu (mức có thể đã đổi); M08 "Bỏ đoạn đó": bỏ rồi kiểm lại
      api.piiPanel(ui.box, p.pii, { input: ui.input, onEdit: ui.onEdit,
        onDrop: ui.input ? undefined : hits => runCheck(P().dropHits(p.text, hits), ui),
        onKeep: () => { const cur = ui.input ? ui.input.value : p.text; if (cur === p.text) s.piiOk = cur; if (ui.input) runCheck(cur, ui); else go(); } });
    }
    // Kết lượt: lưu mức sau / phù hợp, phát 'done' (AC-62)
    function finishRound(save) {
      const s = st();
      if (s.finished) return;
      if (save) upd({ after: isLv(s.after) ? s.after : null, fit: s.fit || null });
      s.finished = true;
      if (!s.ex) return;
      // Toast M12 chỉ khi care.js VỪA đánh dấu 'a' (thói quen bật, ô hôm nay đang trống) — T-I2
      const code = ((D().HABITS || []).find(h => h && h.auto === 'stop') || {}).code || 'pause';
      const mark = () => { try { const r = S && S.habits && S.habits.get(api.today()); return (r && r.marks && r.marks[code]) || ''; } catch (e) { return ''; } };
      const was = mark();
      api.emit('done', { kind: 'stop', id: s.recId, ex: s.ex });
      s.marked = was !== 'a' && mark() === 'a';
    }

    /* ===== Thẻ an toàn M09 (L03, L04, L09): luôn hiện dù draft (K-14) ===== */
    const humanCard = () => `<div class="human-card"><h2 class="st-h">${tt(card('not_alone').title || '')}</h2><p>${tt(card('not_alone').text || '')}</p>
      <button type="button" class="btn teal block" data-go="support">${tt(card('not_alone').btn || 'Xem các cách tìm hỗ trợ ›')}</button></div>`;
    function doctorCard() {
      const c = card('need_doctor'), tel = api.telHref(C.EMERGENCY_NUMBER), cc = C.CLINIC_CONTACT || {}, ctel = api.telHref(cc.phone);
      const signs = (C.CLINIC_WARNING_SIGNS || []).filter(x => typeof x === 'string' && x.trim());
      return `<div class="body-card"><h2 class="st-h">${tt(c.title || '')}</h2>${signs.length ? `<ul>${signs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <p>${tt(c.text || '')}</p><div class="btn-row">${tel ? `<a class="btn danger" href="${esc(tel)}">${tt(c.call || '📞 Gọi 115')}</a>` : ''}
        ${ctel ? `<a class="btn ghost" href="${esc(ctel)}">${tt(c.callClinic || 'Gọi khoa điều trị')}</a>` : ''}</div></div>`;
    }
    const TOP = {
      need_doctor: doctorCard,
      not_alone: humanCard,
      self_blame_ack: () => `<p class="st-ack">${tt(card('self_blame_ack').text || '')}</p>`,
      ask_stage_change: () => (st().keepStage || api.stage() === 'after_loss' ? '' : `<div class="card st-loss" id="sg-loss"><p>${tt(card('ask_stage_change').text || '')}</p>
        <div class="btn-row"><button type="button" class="btn soft" ${goA('stage', { suggest: 'after_loss' })}>${tt(card('ask_stage_change').btn || '')}</button>
        <button type="button" class="link" data-act="sgKeep">${tt(card('ask_stage_change').keep || '')}</button></div></div>`)
    };

    /* ===== Gợi ý (E.recommend, 6.5) ===== */
    function compute() {
      const s = st();
      const r = E().recommend({ level: isLv(s.before) ? s.before : null, emotions: s.emotions.slice(), contexts: s.contexts.slice(), stage: api.stage(),
        minutes: s.minutes, hour: api.hour(), flags: flags(), available: api.has }, s.attempt) || {};
      r.cards = Array.isArray(r.cards) ? r.cards : [];
      r.suggestions = (Array.isArray(r.suggestions) ? r.suggestions : []).filter(x => x && findSg(x.id)).slice(0, 2);
      return r;   // r.rule / r.list chỉ dùng trong bộ nhớ, không ghi xuống máy (N-1)
    }
    function suggestHTML() {
      const r = compute(), n = r.suggestions.length;
      const top = r.cards.filter(c => TOP[c]).map(c => TOP[c]()).join('');
      const sg = r.suggestions.map((x, i) => {
        const ex = findSg(x.id), sc = ownScr(ex);
        return `<article class="st-sg"><h2 class="st-h"><span aria-hidden="true">${esc(ex.icon || '')}</span> ${tt(ex.title)} <span class="st-meta">· ${fmtMin(ex)}</span></h2>
          <p>${tt(ex.goal || '')}</p><button type="button" class="btn ${i ? 'ghost' : 'primary'} block" ${sc ? goA(sc) : goA('player', { ex: ex.id, origin: 'stop' })}>${t('suggest.start')}</button></article>`;
      }).join('');
      return `<h1>${t('suggest.h1')}</h1>${top}
        ${n ? `<p class="lead">${n === 1 ? esc(raw('suggest.lead1', 'Với lúc này, mình gợi ý một bài. Không hợp thì đổi nhé.')) : t('suggest.lead')}</p>` : ''}
        ${r.cards.includes('two_weeks') ? `<p class="gentle">${tt(card('two_weeks').text || '')}</p>` : ''}
        ${n ? sg : `<p>${t('suggest.empty')}</p><button type="button" class="btn primary block" data-act="home">${t('home')}</button>`}
        ${r.cards.includes('go_night') ? `<p><button type="button" class="link" data-go="night">${tt(card('go_night').text || '')}</button></p>` : ''}
        ${n ? `<button type="button" class="btn ghost block" data-act="sgSwap">${t('suggest.swap')}</button>` : ''}
        <p class="st-center"><button type="button" class="link" ${goA('library', { from: 'suggest' })}>${t('suggest.library')}</button></p>
        ${api.draftLine(n ? findSg(r.suggestions[0].id) : safetyRev())}`;
    }

    /* ===== Lớp L10 ('natural') / L11 ('uneasy') thay thân bài (api.calmLayer, A2 dùng lại) =====
       o = { onResume(), onEnd(kind), endLabel?, xung? }. Trả close(). Âm tắt ≤ 0,8 s (AC-35). */
    function calmLayer(root, kind, o = {}) {
      if (api.SOUND && typeof api.SOUND.stopAll === 'function') api.SOUND.stopAll(800);
      if (!root) return () => {};
      const nx = root.nextElementSibling;
      if (nx && nx.classList.contains('st-calm')) nx.remove();
      const un = kind === 'uneasy', ctx = o.xung ? { xung: o.xung } : undefined;
      const el = document.createElement('div');
      el.className = 'st-calm' + (un ? ' uneasy' : '');
      el.setAttribute('role', un ? 'alert' : 'status');
      el.innerHTML = un
        ? `<h2 class="st-h" tabindex="-1">${t('player.uneasy')}</h2><p>${t('safety.uneasy', ctx)}</p>
          <button type="button" class="btn teal block" data-go="support">${t('player.findHelp')}</button>
          ${o.onEnd ? `<button type="button" class="link" data-calm="end">${esc(o.endLabel || raw('player.toCheckout', 'Về check-out'))}</button>` : ''}`
        : `<div class="st-calm-dot" aria-hidden="true"></div><h2 class="st-h" tabindex="-1">${t('player.natural')}</h2><p>${t('player.naturalText', ctx)}</p>
          <div class="btn-row"><button type="button" class="btn primary" data-calm="resume">${t('player.resume')}</button>
          ${o.onEnd ? `<button type="button" class="btn ghost" data-calm="end">${esc(o.endLabel || raw('player.done', 'Xong → Check-out'))}</button>` : ''}</div>`;
      root.hidden = true;
      root.after(el);
      const close = () => { if (!el.isConnected) return; el.remove(); root.hidden = false; };
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-calm]');
        if (!b) return;
        if (b.dataset.calm === 'resume') { close(); if (typeof o.onResume === 'function') o.onResume(); }
        else if (typeof o.onEnd === 'function') o.onEnd(kind);
      });
      try { $('h2', el).focus({ preventScroll: false }); } catch (e) { /* bỏ qua */ }
      return close;
    }

    /* ============================== Màn ============================== */
    let ckW = null, coW = null;
    const screens = {
      /* ----- M06 Dừng 5 giây (AC-37): sau 5 s "Bỏ qua" thành "Tiếp tục ›", không cướp focus ----- */
      pause5: {
        title: 'Dừng lại một chút',
        render: () => `<section class="card st-pause"><div class="orb st-orb" aria-hidden="true"></div>
          <h1>${t('pause5.h1')}</h1><p class="lead">${t('pause5.line1')}</p><p>${t('pause5.line2')}</p>
          <button type="button" class="btn ghost block" data-act="p5Go" id="p5btn">${t('skip')}</button>
          <p class="sr-only" id="p5live" aria-live="polite"></p></section>`,
        mount(root) {
          api.state.ui.stop = fresh();   // lượt mới
          const orb = $('.st-orb', root);
          if (api.reduceMotion()) orb.classList.add('still');   // giảm chuyển động: không co giãn, chỉ đậm dần
          api.screenActions({ p5Go: () => api.go('checkin', {}, { replace: true }) });
          lc.later(() => {
            const b = $('#p5btn', root);
            if (!b) return;
            b.textContent = raw('next', 'Tiếp tục ›');
            b.classList.replace('ghost', 'primary');
            orb.classList.add('ready');
            $('#p5live', root).textContent = raw('pause5.ready', 'Đã sẵn sàng. Tiếp tục.');
          }, 5000);
        }
      },

      /* ----- M07 Check-in (AC-13, 38): mọi phần bỏ qua được ----- */
      checkin: {
        title: 'Check-in',
        render: () => {
          let s = st();
          if (s.finished) s = api.state.ui.stop = fresh();
          const ctxs = D().CONTEXTS || [], mins = D().MINUTES || [1, 3, 5, 10], max = C.NOTE_MAX || 1000;
          ckW = {
            lv: api.dots10({ value: s.before, allowSkip: true, labelledby: 'ck-q1',
              onChange: v => { s.before = isLv(v) ? v : null; } }),
            cp: api.capyCards({ max: 3, selected: s.emotions, onChange: l => { s.emotions = l; } })
          };
          const num = n => `<span class="step-num" aria-hidden="true">${n}</span>`;
          return `<section class="card st-ck"><h1>${t('checkin.h1')}</h1>
            <h2 class="section-title" id="ck-q1">${num(1)} ${t('checkin.q1')}</h2><p class="section-hint">${t('checkin.q1Hint')}</p>
            <div class="st-lv">${pairNow(96)}</div>${ckW.lv.html}
            <hr class="section-divider">
            <h2 class="section-title" id="ck-q2">${num(2)} ${t('checkin.q2')}</h2><p class="section-hint">${t('checkin.q2Hint')}</p>${ckW.cp.html}
            <hr class="section-divider">
            <h2 class="section-title" id="ck-q3">${num(3)} ${t('checkin.q3')}</h2>
            <div class="chips" role="group" aria-labelledby="ck-q3">${ctxs.map(c => `<button type="button" class="chip" data-ctx="${esc(c.code)}" aria-pressed="${s.contexts.includes(c.code)}">${esc(c.label)}</button>`).join('')}</div>
            <h2 class="section-title" id="ck-q4">${num(4)} ${t('checkin.q4')}</h2>
            <div class="chips" role="group" aria-labelledby="ck-q4">${mins.map(m => `<button type="button" class="chip" data-min="${+m}" aria-pressed="${s.minutes === +m}">${+m} ${t('checkin.minUnit')}</button>`).join('')}</div>
            <hr class="section-divider">
            <h2 class="section-title">${num(5)} <label for="ck-note">${t('checkin.q5')}</label></h2>
            <textarea id="ck-note" rows="4" placeholder="${t('checkin.placeholder')}" aria-describedby="ck-id ck-sv">${esc(s.note)}</textarea>
            <p class="fine st-row"><span id="ck-id">${t('checkin.noId')}</span><span id="ck-cnt" aria-live="off">${Number(s.note.length)} / ${max}</span></p>
            <p class="fine" id="ck-sv">${t(canWrite() ? 'checkin.saved' : 'checkin.notSaved')}</p>
            <p class="error-text" id="ck-long" aria-live="polite"></p><div id="ck-pii"></div>
            <button type="button" class="btn primary block" data-act="ckNext">${t('checkin.go')}</button>
            <p class="st-center"><button type="button" class="link" data-act="ckLib">${t('checkin.library')}</button></p></section>`;
        },
        mount(root) {
          const s = st(), ta = $('#ck-note', root), max = C.NOTE_MAX || 1000, box = $('#ck-pii', root);
          ckW.lv.mount(root); ckW.cp.mount(root);
          // Rời M07 không qua Tiếp: bỏ chữ đang gõ (C-1). Sửa ô → đóng bảng nhận diện
          let left = false;
          lc.onCleanup(() => { if (!left) { s.note = s.noteOk; s.pend = null; } });
          lc.on(ta, 'input', () => {
            if (ta.value.length > max) { ta.value = ta.value.slice(0, max); $('#ck-long', root).textContent = raw('checkin.tooLong'); }
            s.note = ta.value;
            $('#ck-cnt', root).textContent = ta.value.length + ' / ' + max;
            box.innerHTML = '';
          });
          if (s.editHit) {   // về từ M08 "Sửa lại": chọn sẵn đoạn
            const i = ta.value.indexOf(s.editHit), n = s.editHit.length;
            s.editHit = null;
            lc.later(() => { ta.focus(); if (i >= 0) ta.setSelectionRange(i, i + n); }, 0);
          }
          lc.on(root, 'click', e => {
            const cx = e.target.closest('[data-ctx]'), mn = e.target.closest('[data-min]');
            if (cx) {
              const c = cx.dataset.ctx;
              s.contexts = s.contexts.includes(c) ? s.contexts.filter(x => x !== c) : s.contexts.concat(c);
              cx.setAttribute('aria-pressed', String(s.contexts.includes(c)));
            } else if (mn) {
              const v = +mn.dataset.min;
              s.minutes = s.minutes === v ? null : v;
              $$('[data-min]', root).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.min === s.minutes)));
            }
          });
          const ui = { from: 'checkin', box, input: ta, leave: () => { left = true; } };
          const proceed = target => { s.next = target; box.innerHTML = ''; runCheck(ta.value, ui); };
          api.screenActions({ ckNext: () => proceed('suggest'), ckLib: () => proceed('library') });
        }
      },

      /* ----- M08 Câu hỏi an toàn (AC-27): câu trả lời KHÔNG ghi (K-7) ----- */
      safety_q: {
        title: 'Một câu hỏi',
        render: () => `<section class="card st-sq"><h1>${t('safety.q.h1')}</h1><p>${t('safety.q.normal')}</p>
          <p class="st-q">${t('safety.q.ask')}</p>
          <div class="btn-col"><button type="button" class="btn ghost big" data-act="sqYes">${t('safety.q.yes')}</button>
          <button type="button" class="btn ghost big" data-act="sqNo">${t('safety.q.no')}</button>
          <button type="button" class="btn ghost big" data-act="sqNo">${t('safety.q.skip')}</button></div>
          <div id="sq-pii"></div>
          ${api.draftLine(safetyRev())}</section>`,
        mount(root) {
          api.screenActions({
            sqYes: () => { ['self_harm', 'not_alone', 'low'].forEach(f => flags().add(f)); api.go('urgent', { from: 'safety_q' }, { replace: true }); },
            sqNo: () => {
              ['not_alone', 'low'].forEach(f => flags().add(f));
              const s = st();
              s.sqDone = true;
              // Rồi mới tới bảng nhận diện (n-1); ẩn ba nút
              const col = $('.btn-col', root);
              if (col && s.pend && s.pend.pii.length && s.piiOk !== s.pend.text) col.hidden = true;
              piiThenGo({ from: 'safety_q', box: $('#sq-pii', root), replace: true,
                onEdit: hits => { s.editHit = hits && hits[0] ? hits[0].text : null; api.back(); } });
            }
          });
        }
      },

      /* ----- M09 Gợi ý (AC-26–31, 39): thẻ an toàn trước, ≤ 2 bài ----- */
      suggest: {
        title: 'Gợi ý',
        render: () => `<section class="card st-sg-wrap" id="sg">${suggestHTML()}</section>`,
        mount(root) {
          const s = st();
          if (s.checked && !s.finished) ensureRec('stop');
          api.screenActions({
            sgSwap: () => {
              s.attempt++; api.state.session.attempt = s.attempt;
              $('#sg', root).innerHTML = suggestHTML();
              const b = $('[data-act=sgSwap]', root); if (b) b.focus();
              api.toast(raw('suggest.toastSwap'));
            },
            sgKeep: () => { s.keepStage = true; const c = $('#sg-loss', root); if (c) c.remove(); const h = $('h1', root); if (h) h.focus(); }
          });
        }
      },

      /* ----- M09b Thư viện (AC-34, 50) ----- */
      library: {
        title: 'Thư viện',
        render: p => {
          const items = libIds().map(findEx), groups = D().LIBRARY_GROUPS || [];
          // Từ M07/M09: bài của lượt; nơi khác: bài lẻ (C-1)
          const origin = p && p.from === 'suggest' ? 'stop' : 'library';
          const exCard = ex => `<button type="button" class="st-ex" ${goA('player', { ex: ex.id, origin })}>
              <span class="st-ex-t"><span aria-hidden="true">${esc(ex.icon || '')}</span> ${tt(ex.title)}</span>
              <span class="st-ex-g">${tt(ex.goal || '')} · ${fmtMin(ex)}</span>
              ${ex.safety ? `<span class="st-ex-s">${t('player.safety')}${tt(ex.safety)}</span>` : ''}
              ${ex.status === 'approved' ? '' : '<span class="st-tag">Bản thử nghiệm</span>'}<span class="st-ex-a" aria-hidden="true">›</span></button>`;
          const grp = ex => ex.group || GRP_OF[ex.type] || 'rest';
          let body = groups.map(g => {
            const inG = items.filter(ex => grp(ex) === g.code);
            return inG.length ? `<h2 class="st-h2">${tt(g.title)}</h2><div class="st-list">${inG.map(exCard).join('')}</div>` : '';
          }).join('');
          const rest = items.filter(ex => !groups.some(g => g.code === grp(ex)));
          if (rest.length) body += `<div class="st-list">${rest.map(exCard).join('')}</div>`;
          // Nhóm "Trước khi ngủ"
          const SC = (api.SC && api.SC.SCRIPTS) || {};
          const nl = typeof E().nightList === 'function' ? E().nightList({ stage: api.stage(), flags: flags() }) : null;
          const nights = ((nl && nl.all) || []).filter(k => SC[k]);
          if (nights.length) {
            body += `<h2 class="st-h2">${t('library.night')}</h2><div class="st-list">${nights.map(k => { const sc = SC[k];
              return `<button type="button" class="st-ex st-ex-night" data-act="openNight" data-id="${esc(k)}">
                <span class="st-ex-t"><span aria-hidden="true">${esc(sc.icon || '🌙')}</span> ${tt(sc.title || '')}</span>
                <span class="st-ex-g">${sc.minutes ? esc(sc.minutes) + ' phút' : ''}${sc.hasBaby ? ` · ${t('library.babyTag')}` : ''}</span>
                ${sc.status === 'approved' ? '' : '<span class="st-tag">Bản thử nghiệm</span>'}<span class="st-ex-a" aria-hidden="true">›</span></button>`; }).join('')}</div>`;
          }
          const all = items.concat(nights.map(k => SC[k]));
          return `<section class="card st-lib"><h1>${t('library.h1')}</h1>
            ${all.length ? body : `<p>${t('library.empty')}</p><button type="button" class="btn primary block" data-act="home">${t('home')}</button>`}
            ${api.draftLine(all.find(x => x.status !== 'approved') || (all.length ? { status: 'approved' } : null))}</section>`;
        },
        mount(root, p) {
          const s = st();
          if (p && p.from === 'suggest' && s.checked && !s.finished) ensureRec('stop');
          // Bài đêm chỉ qua api.openNight, có cổng hỏi (AC-40, G-4)
          api.screenActions({ openNight: b => { if (typeof api.openNight === 'function') api.openNight(b.dataset.id, { from: 'library' }); else api.go('night'); } });
        }
      },

      /* ----- M10 Trình phát (AC-35, 36, 51–53) ----- */
      player: {
        get title() {
          const top = api.state.stack[api.state.stack.length - 1];
          const ex = top && top.name === 'player' ? findEx(top.params && top.params.ex) : null;
          return ex ? api.say(ex.short || ex.title) : 'Bài';
        },
        render: p => {
          const ex = findEx(p && p.ex);
          if (!ex) {
            return `<section class="card"><h1>Không tìm thấy bài này</h1><p>Bài này chưa có trong thư viện, hoặc đang chờ duyệt nội dung.</p>
              <button type="button" class="btn primary block" ${goA('library', { from: 'home' })}>Mở thư viện</button></section>`;
          }
          // B5, B6 sau M20 "chỉ là cách nói": thẻ "không một mình" trên bài
          const human = (ex.type === 'cloud' || ex.type === 'knowUnknown') && (flags().has('not_alone') || flags().has('self_harm'));
          return `<section class="card st-pl" data-type="${esc(ex.type)}">
              <h1><span aria-hidden="true">${esc(ex.icon || '')}</span> ${tt(ex.title)}</h1>
              <p class="lead">${tt(ex.goal || '')} · ${fmtMin(ex)}</p>
              ${POSTURE_TYPES.includes(ex.type) ? `<p class="fine">${t('player.posture')}</p>` : ''}
              ${ex.safety ? `<p class="safety-line"><b>${t('player.safety')}</b>${tt(ex.safety)}</p>` : ''}
              ${human ? humanCard() : ''}
              <div class="st-pl-body" id="pl-body">${plOf(ex).render(ex, api, { minutes: st().minutes })}</div>
              ${api.draftLine(ex)}</section>
            <div class="player-foot st-foot"><div class="st-foot-row">
              <button type="button" class="btn ghost" data-act="plUneasy">${t('player.uneasy')}</button>
              <button type="button" class="btn ghost" data-act="plDone">${t('player.done')}</button></div>
              <button type="button" class="btn soft block" data-act="plNatural">${t('player.natural')}</button></div>`;
        },
        mount(root, p) {
          const ex = findEx(p && p.ex);
          if (!ex) return;
          let s = st();
          // Lượt mới (C-1) trừ khi: bài của lượt check-in, hoặc bài lẻ đang dở (quay lại từ M20)
          const inRound = p.origin === 'stop' ? s.checked : !s.checked && !!s.recId;
          if (s.finished || !inRound) s = api.state.ui.stop = fresh();
          ensureRec(s.checked ? 'stop' : 'library');
          // Mỗi bài một mục done[] (≤ 10), end 'left' tới khi biết cách kết thúc
          const entry = { ex: ex.id, at: api.now(), end: 'left' };
          s.done = s.done.concat(entry).slice(-10); s.ex = ex.id;
          const saveDone = () => upd({ done: s.done.map(d => Object.assign({}, d)) });
          saveDone();
          const body = $('#pl-body', root);
          let layerEnd = null, close = null;
          const papi = Object.create(api);
          papi.finish = (end = 'complete') => { entry.end = end; saveDone(); api.go('checkout', {}, { replace: true }); };
          papi.saveTexts = patch => { if (!canWrite()) return; s.texts = Object.assign({}, s.texts, patch); upd({ texts: s.texts }); };
          // Rời màn: đồng hồ dừng, âm nhỏ dần ≤ 0,8 s
          lc.onCleanup(() => { try { P().stopAll(); } catch (e) { /* bỏ qua */ } });
          const pause = plOf(ex).mount(body, ex, papi, { minutes: s.minutes }) || (() => {});
          const halt = () => { try { pause(); } catch (e) { /* bỏ qua */ } };
          api.screenActions({
            plNatural: () => {
              halt(); if (close) close();
              layerEnd = 'natural';
              close = api.calmLayer(body, 'natural', { onResume: () => { close = null; layerEnd = null; }, onEnd: () => papi.finish('natural') });
            },
            plUneasy: () => {
              halt(); if (close) close();
              layerEnd = entry.end = 'uneasy'; saveDone();
              close = api.calmLayer(body, 'uneasy', { onEnd: () => papi.finish('uneasy') });
            },
            // Chữ đang gõ ở B5/B6 qua luật trước khi rời bài (papi.guard)
            plDone: () => { if (!layerEnd && typeof papi.guard === 'function' && !papi.guard()) return; papi.finish(layerEnd || 'complete'); }
          });
        }
      },

      /* ----- M11 Check-out (AC-39c) ----- */
      checkout: {
        title: 'Check-out',
        render: () => {
          const s = st();
          coW = api.dots10({ value: s.after, allowSkip: true, labelledby: 'co-h1', onChange: v => { s.after = isLv(v) ? v : null; } });
          return `<section class="card st-co" id="co"><h1 id="co-h1">${t('checkout.h1')}</h1>${coW.html}
            <h2 class="section-title" id="co-q">${t('checkout.q')}</h2>
            <div class="chips" role="group" aria-labelledby="co-q">${(D().FITS || []).map(f => `<button type="button" class="chip" data-fit="${esc(f.code)}" aria-pressed="${s.fit === f.code}">${esc(f.label)}</button>`).join('')}</div>
            <button type="button" class="btn primary block" data-act="coDone">${t('checkout.go')}</button>
            <p class="st-center"><button type="button" class="link" data-act="coSkip">${t('checkout.skip')}</button></p></section>`;
        },
        mount(root) {
          const s = st();
          coW.mount(root);
          lc.on(root, 'click', e => {
            const b = e.target.closest('[data-fit]');
            if (!b) return;
            s.fit = s.fit === b.dataset.fit ? null : b.dataset.fit;
            $$('[data-fit]', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fit === s.fit)));
            if (s.fit !== 'worse') return;
            // "Khó chịu hơn": chỉ tới Hỗ trợ, không bài khác, không M12
            finishRound(true);
            $('#co', root).innerHTML = `<h1 tabindex="-1">${t('checkout.worse')}</h1>
              <div class="human-card"><p>${t('safety.worse')}</p><button type="button" class="btn teal block" data-go="support">${t('checkout.openSupport')}</button></div>
              <p class="st-center"><button type="button" class="link" data-act="home">${t('home')}</button></p>`;
            $('#co h1', root).focus();
          });
          api.screenActions({
            coDone: () => { finishRound(true); api.go('done', {}, { replace: true }); },
            coSkip: () => { finishRound(false); api.resetTo('home'); }
          });
        }
      },

      /* ----- M12 Hoàn tất (AC-39d) ----- */
      done: {
        title: 'Xong rồi',
        render: () => {
          const s = st(), both = isLv(s.before) && isLv(s.after);
          return `<section class="card st-done">${pair('look_up', 120, 'st-nod')}<h1>${t('done.h1')}</h1>
            ${both ? `<p class="st-ba">${t('done.beforeAfter', { before: s.before, after: s.after })}</p>` : ''}
            <p>${t('done.text')}</p>
            <button type="button" class="btn primary block" data-act="home">${t('homeGo')}</button>
            <p class="st-center"><button type="button" class="link" ${goA('library', { from: 'home' })}>${t('done.more')}</button></p>
            ${api.hour() >= (C.LATE_HOUR || 21) ? `<p class="st-center"><button type="button" class="link" data-go="night">${t('done.night')}</button></p>` : ''}</section>`;
        },
        mount() {
          const s = st();
          // A2: care.js nghe 'done' tự đánh dấu; chỉ báo khi lượt này vừa đánh dấu (s.marked)
          if (s.marked && !s.toasted) { s.toasted = true; api.toast(raw('done.toastCare')); }
        }
      }
    };
    return { screens, calmLayer, raw };
  }

  // Một bộ màn cho mỗi api
  const cache = new WeakMap();
  const get = api => { if (!cache.has(api)) cache.set(api, make(api)); return cache.get(api); };
  (window.HTDC_MODULES = window.HTDC_MODULES || []).push({
    name: 'stop',
    screens: api => get(api).screens,
    provides: api => ({ calmLayer: get(api).calmLayer }),
    homeTiles: api => [{ id: 'stop', order: 10, render: () =>
      `<button type="button" class="tile main" data-go="pause5"><strong>${api.t('home.stop')}</strong><span class="tile-sub">${api.t(api.stage() === 'after_loss' ? 'home.stopSubLoss' : 'home.stopSub')}</span></button>` }],
    // app.js tự thêm " ›" vào nhãn dòng nhỏ
    homeLinks: api => [{ id: 'library', order: 20, label: get(api).raw('home.library', '📚 Thư viện bài').replace(/\s*›$/, ''), go: 'library', params: { from: 'home' } }]
  });
})();
