/* Hành Trình Đón Con – js/together.js · module "Hai ta" (A2) · Chủ: FE-7 Hai ta (T-08)
   Đặc tả: tech design 4.1, 5.3, 6.4, 9; UX 4.6, 8, 9; PRD 6.6, AC-55…59, A.7. Không Web Speech.
   C1–C3 không ô gõ, thẻ / câu / lượt nói không ghi; xong → tối đa MỘT bản ghi 7 trường (AC-56). C4: chỉ chuỗi
   VỪA qua safetyGate + bảng nhận diện được hiện / gửi; không lưu chữ, người nhận. TX: bản nháp chờ anh duyệt. */
(() => {
  'use strict';
  const HOLD = 3000, TURN = 120000;   // giữ chuông 3 s · lượt nói 2 phút
  const STAGES = [['🔔', 'Cùng dừng lại'], ['🌬️', 'Thở cùng nhịp'], ['🐾', 'Gọi tên cảm xúc'], ['💬', 'Nói – nghe'], ['🫙', 'Hũ bình an chung']];
  const TX = {
    lead: 'Hai bạn ngồi cạnh nhau, dùng một điện thoại. Không có chữ hay cảm xúc nào được ghi lại.',
    c1Sub: 'Năm chặng nhỏ: dừng, thở, gọi tên, nói và nghe, hũ bình an.',
    solo: 'Những bài này làm cùng một người thương hoặc người đồng hành. Gửi lời thì làm một mình được.',
    saving: 'Chỉ ghi một dòng "đã làm cùng nhau" vào Hành trình của mình.',
    linkBtn: '📨 Gửi link app cho người thương ›',
    linkMsg: 'Mình đang dùng một app nhỏ để dừng lại, thở và chăm lòng mình. Gửi bạn link nhé: {URL}',
    mapL: 'Năm chặng', mapAria: 'Chặng {n}: {name}', mapDone: ', đã xong', mapSkip: ', đã bỏ qua',
    stageH: 'Chặng {n}/5 · {icon} {name}', next: 'Sang chặng {n} ›', toEnd: 'Xong ›', skip: 'Bỏ qua chặng này',
    s1: 'Một người nhấn và giữ chuông trong ba giây. Người kia đặt tay lên tay người giữ.', s1done: 'Hai bạn đã cùng dừng lại.',
    bellAria: 'Chuông. Nhấn và giữ', bellHint: 'Giữ ba giây', bellProg: 'Số giây đã giữ', bellEasy: 'Khó nhấn giữ? Chạm vào đây',
    holdShort: 'Thử lại, giữ chuông lâu hơn một chút nhé.',
    s2: 'Ngồi cạnh nhau. Cùng hít vào khi vòng tròn nở, thở ra khi nó thu lại. Lệch nhịp một chút cũng không sao.',
    breathSafety: 'Không nín hơi. Thấy chóng mặt thì thở tự nhiên.', rounds: 'Số vòng', nRounds: '{n} vòng',
    c2EndH: 'Hai bạn vừa thở cùng nhau.', c2End: 'Vậy là đủ rồi.',
    s3: 'Mỗi người chọn một bé giống mình nhất. Người kia quay đi một chút nhé.', p1: 'Người thứ nhất', p2: 'Người thứ hai',
    cover: 'Úp thẻ ›', flip: 'Lật cho nhau xem', shield: 'Đến lượt người thứ hai. Người thứ nhất quay đi một chút nhé.',
    ready: 'Người thứ hai sẵn sàng ›', picked: 'Đã chọn: ', noPick: 'Chưa chọn',
    s3after: 'Đây là lòng hai bạn lúc này. Không cần giống nhau.',
    qs: ['Hôm nay điều làm mình nặng lòng nhất là…', 'Lúc này mình cần ở người kia một điều là…', 'Một điều mình trân trọng ở người kia là…'],
    qL: 'Chọn một câu', c3lead: 'Chọn một câu. Một người nói, người kia chỉ nghe.',
    startTurn: 'Bắt đầu lượt 1 ›', swap: 'Đổi lượt ›', done: 'Xong ✓', turn: 'Lượt {n} · Người nói',
    rule: 'Người nói nói. Người nghe chỉ nghe, không sửa, không khuyên.', short: 'Không cần nói đủ hai phút.',
    left: 'Còn khoảng {m} phút', timeUp: 'Hết hai phút rồi. Đổi lượt khi hai bạn sẵn sàng nhé.',
    thanks: 'Người nghe nói: "Cảm ơn đã kể cho mình nghe."', bell: '🔔 Chuông nhẹ khi hết giờ',
    c3EndH: 'Hai bạn vừa nói và nghe nhau.', c3End: 'Vậy là đủ rồi.',
    s5: 'Mỗi người nói thành lời một câu tử tế cho người kia, hoặc cho chính mình. Rồi chạm thả trái tim vào hũ.',
    ideasL: 'Chưa nghĩ ra thì mượn một câu nhé:', ideas: ['Cảm ơn đã đi cùng mình.', 'Hôm nay mình đã cố hết sức rồi.', 'Mình được phép mệt.'],
    heartA: '💗 Tim của người thứ nhất', heartB: '💗 Tim của người thứ hai', heartIn: 'Đã thả vào hũ ✓',
    c1EndH: 'Hai bạn đã dành mười phút cho nhau.', c1End: 'Chừng đó là đủ cho hôm nay.',
    endSend: 'Gửi một lời cho nhau 💌', backTo: 'Về Hai ta',
    c4h1: 'Gửi lời cho người thương', c4lead: 'Chọn một câu, hoặc tự viết. Xem lại rồi mới gửi.',
    pron: 'Mình xưng:', tabsL: 'Cách chọn lời', tab0: 'Câu có sẵn', tab1: 'Tự viết',
    ownL: 'Lời của mình', ph: 'Tối nay mình muốn được ôm một chút…', notSaved: 'Chữ này không lưu. Rời trang là mất.',
    review: 'Xem lại ›', empty: 'Viết vài chữ trước nhé. Không muốn viết thì chọn một câu có sẵn.',
    pvL: 'Lời sẽ gửi', need: 'Bấm "Xem lại" để thấy nguyên văn trước khi gửi nhé.',
    send: 'Gửi qua ứng dụng nhắn tin ›', copy: 'Sao chép lời này', noRecipient: 'App không biết, không lưu người nhận.',
    dur: ['~10 phút', '2–3 phút', '4–6 phút', '1 phút']
  };

  /* ===== Dùng chung ===== */
  let api, C, S, U, esc, lc;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const D = () => api.D || {}, P = () => api.P || {};
  const tx = (k, v) => { let s = String(TX[k] != null ? TX[k] : k); if (v) Object.keys(v).forEach(n => { s = s.split('{' + n + '}').join(String(v[n])); }); return s; };
  const h = (k, v) => esc(tx(k, v));
  const btn = (cls, attr, label) => `<button type="button" class="${cls}"${attr ? ' ' + attr : ''}>${label}</button>`;
  const ui = () => api.state.ui.together || (api.state.ui.together = { c1: null, bell: false, rounds: 6 });
  const ex = id => (D().EXERCISES || {})[id] || null;
  const okEx = id => !!ex(id) && (typeof api.E.validate !== 'function' || api.E.validate([id], { available: api.has }).length > 0);
  const focus = el => { if (!el) return; if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus(); };
  // Ảnh trang trí; lỗi → emoji (app.js)
  const img = (f, w, ht, fb, fc, cls) => `<img${cls ? ` class="${cls}"` : ''} src="assets/art/${f}.svg" width="${w}" height="${ht}" alt="" aria-hidden="true" data-fallback="${fb}" data-fb-class="${fc}">`;
  const art = (f, px, fb) => img(f, px, px, fb || '🐾🐾', `pair-fb s${px}`, `pair s${px}`);
  const radios = (attr, items, on) => items.map(([v, label]) =>
    btn(attr === 'data-pron' ? 'chip' : 'choice', `role="radio" ${attr}="${v}" aria-checked="${v === on}" tabindex="${v === on ? 0 : -1}"`, label)).join('');
  // Chọn radio tại chỗ, không vẽ lại (giữ focus bàn phím)
  const check = (root, attr, el) => $$(`[${attr}]`, root).forEach(z => { const on = z === el; z.setAttribute('aria-checked', String(on)); z.tabIndex = on ? 0 : -1; });

  /* ===== Phạm vi dọn theo chặng (đổi chặng dừng hẹn giờ cũ); rời màn: lifecycle dọn + tắt âm ===== */
  function scope() {
    let list = [];
    const s = {
      every(fn, ms) { const id = setInterval(fn, ms); list.push(() => clearInterval(id)); return id; },
      on(el, ty, fn, o) { el.addEventListener(ty, fn, o); list.push(() => el.removeEventListener(ty, fn, o)); },
      onCleanup(fn) { list.push(fn); },
      clear() { const l = list; list = []; l.forEach(f => { try { f(); } catch (e) { } }); }
    };
    lc.onCleanup(s.clear);
    lc.onCleanup(() => { try { if (P().stopAll) P().stopAll(); else api.SOUND.stopAll(800); } catch (e) { } });
    return s;
  }

  /* ===== Bản ghi Hai ta (5.3, AC-56): đúng 7 trường ===== */
  function record(code) {
    const at = api.now(), tz = U.tzAt(at);
    let rec = null;
    try { rec = S.journal.add({ v: 1, kind: 'together', id: U.randomId(), at, day: U.dayOf(at, tz), tz, exercise: code }); } catch (e) {}
    api.emit('done', { kind: 'together', id: rec && rec.id ? rec.id : null, exercise: code });
  }

  /* ===== Vòng tiến độ (chuông, lượt nói) ===== */
  const CIRC = 339.3;   // 2π × 54
  const ring = cls => `<svg class="tg-ring ${cls || ''}" viewBox="0 0 120 120" aria-hidden="true"><circle class="tg-ring-bg" cx="60" cy="60" r="54"/>` +
    `<circle class="tg-ring-fg" cx="60" cy="60" r="54" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" transform="rotate(-90 60 60)"/></svg>`;
  const setRing = (el, p) => { const c = el && $('.tg-ring-fg', el); if (c) c.setAttribute('stroke-dashoffset', (CIRC * (1 - Math.max(0, Math.min(1, p)))).toFixed(1)); };

  // "Về Hai ta": vào từ M15 thì lùi; vào từ M09 (R5) thì thay màn bằng M15 (T-I2)
  const toHub = () => { const st = api.state.stack, pv = st[st.length - 2]; if (pv && pv.name === 'together') api.back(); else api.go('together', {}, { replace: true }); };
  /* ===== L10 / L11 qua api.calmLayer: dừng hẹn giờ, tắt âm ===== */
  const foot = () => `<div class="player-foot tg-foot">${btn('btn ghost', 'data-act="tgUneasy"', api.t('player.uneasy'))}${btn('btn soft block', 'data-act="tgNatural"', api.t('player.natural'))}</div>`;
  function calm(get) {
    let close = null;
    const layer = kind => {
      const c = get() || {};
      if (c.pause) c.pause();
      if (close) close();
      close = api.calmLayer(c.box, kind, { xung: 'hai bạn', endLabel: tx('backTo'), onEnd: toHub, onResume: () => { close = null; if (c.resume) c.resume(); } });
    };
    api.screenActions({ tgNatural: () => layer('natural'), tgUneasy: () => layer('uneasy'), tgHub: toHub });
  }
  // Màn kết: không pháo hoa, không chấm điểm
  const endHTML = (k, extra = '') => `<section class="card tg-end">${art('capy-pair-side', 96)}${k === 'c1' ? art('jar-hearts', 96, '🫙') : ''}
    <h1>${h(k + 'EndH')}</h1><p class="lead">${h(k + 'End')}</p>${btn('btn primary block', 'data-act="home"', api.t('homeGo'))}${extra}
    <p class="center">${btn('link', 'data-act="tgHub"', h('backTo'))}</p></section>`;
  const showEnd = (root, sc, k) => { sc.clear(); root.innerHTML = endHTML(k); focus($('h1', root)); scrollTo(0, 0); };

  /* ===== Nói – nghe (C1 chặng 4, C3), AC-58: giờ theo api.now(), không đếm interval ===== */
  function talk(box, sc, o) {
    let q = 0, n = 0, acc = 0, t0 = 0, run = false, up = false, shown = '';
    const bell = () => `<div class="chips">${btn('chip', `data-bell aria-pressed="${!!ui().bell}"`, h('bell'))}</div>`;
    const turn = k => {
      n = k; acc = 0; t0 = api.now(); run = true; up = false; shown = '';
      box.innerHTML = `<h2 class="st-h" id="tg-turn">${h('turn', { n })}</h2><blockquote class="pl-quote">${esc(TX.qs[q])}</blockquote>
        <div class="tg-rule"><p>${h('rule')}</p><p class="fine">${h('short')}</p></div>
        <div class="tg-timer">${ring()}<p role="timer" aria-live="off" id="tg-left"></p></div>
        <p class="tg-msg" id="tg-up" aria-live="polite"></p><p class="fine">${h('thanks')}</p>${bell()}
        ${btn('btn primary block', `data-tk="${n === 1 ? 'swap' : 'done'}"`, esc(n === 1 ? tx('swap') : o.doneLabel))}`;
      tick(); focus($('#tg-turn', box));
    };
    function tick() {
      if (!n || up) return;
      const left = TURN - acc - (run ? api.now() - t0 : 0);
      setRing($('.tg-timer', box), 1 - left / TURN);
      if (left > 0) { const s = tx('left', { m: Math.ceil(left / 60000) }); if (s !== shown) $('#tg-left', box).textContent = shown = s; return; }
      // Hết giờ: chữ + rung + chuông nếu bật; không tự chuyển lượt
      up = true; run = false;
      $('#tg-left', box).textContent = '';
      $('#tg-up', box).textContent = tx('timeUp');
      api.vibrate(30);
      if (ui().bell && api.SOUND.chime) api.SOUND.chime();
    }
    sc.every(tick, 500);
    sc.on(box, 'click', e => {
      const r = e.target.closest('[data-q]'), b = e.target.closest('[data-bell]'), k = e.target.closest('[data-tk]');
      if (r) { q = +r.dataset.q; check(box, 'data-q', r); api.vibrate(15); }
      else if (b) {
        // Bật chuông = cú chạm → mở âm thanh (không tự phát)
        ui().bell = !ui().bell;
        if (ui().bell && api.SOUND.unlock) api.SOUND.unlock();
        b.setAttribute('aria-pressed', String(ui().bell));
      } else if (k) {
        if (k.dataset.tk === 'go') turn(1); else if (k.dataset.tk === 'swap') turn(2); else { n = 0; run = false; o.onDone(); }
      }
    });
    box.innerHTML = `<div class="choices" role="radiogroup" aria-label="${h('qL')}">${radios('data-q', TX.qs.map((x, i) => [i, esc(x)]), q)}</div>
      ${bell()}${btn('btn primary block', 'data-tk="go"', h('startTurn'))}`;
    return { pause: () => { if (run) { acc += api.now() - t0; run = false; } }, resume: () => { if (n && !up && !run) { t0 = api.now(); run = true; } } };
  }

  /* ===== Thở cùng nhịp (C1 chặng 2, C2): P.breath46 + cycles ===== */
  function breath(pl, sc, cycles, o) {
    const pb = P().breath46;
    if (!pb) return {};
    const e = Object.assign({}, ex('BREATHE_TOGETHER'), { icon: '🌬️' });
    const papi = Object.assign(Object.create(api), { lifecycle: sc, finishLabel: o.label || '', finish: o.finish || (() => {}) });
    pl.innerHTML = pb.render(e, papi, { cycles });
    const pause = pb.mount(pl, e, papi, { cycles });
    // Đủ vòng: players.js vẽ [data-pfin] vào #bend
    const bend = $('#bend', pl);
    if (bend && window.MutationObserver) {
      const mo = new MutationObserver(() => { if ($('[data-pfin]', bend)) o.onComplete(); });
      mo.observe(bend, { childList: true });
      sc.onCleanup(() => mo.disconnect());
    }
    return { pause };
  }

  /* ===== C1 (AC-55, 57): state.ui.together.c1 = {i, done[], skipped[], end, rec} ===== */
  const c1 = () => ui().c1 || (ui().c1 = { i: 0, done: [], skipped: [], end: false, rec: false });
  const mapHTML = () => { const s = c1();
    return STAGES.map((g, n) => { const d = s.done.includes(n), k = !d && s.skipped.includes(n);
      return `<li>${btn('jmap-node' + (d ? ' done' : k ? ' skipped' : ''), `data-act="tgMap" data-i="${n}"${n === s.i ? ' aria-current="step"' : ''}` +
        ` aria-label="${h('mapAria', { n: n + 1, name: g[1] })}${d ? h('mapDone') : k ? h('mapSkip') : ''}"`, `<span aria-hidden="true">${g[0]}</span>`)}</li>`; }).join(''); };
  // Chặng: html(done), mount(box, sc, x) → {pause, resume}
  const VIEW = [
    { html: d => `${art('capy-pair-bell', 96)}<p>${h('s1')}</p><div class="tg-bell-wrap">${btn('tg-bell' + (d ? ' is-done' : ''), `id="tg-bell" aria-label="${h('bellAria')}" aria-describedby="tg-bell-h"`,
        ring() + img('bell', 72, 72, '🔔', 'tg-bell-fb'))}</div>
        <p class="fine center" id="tg-bell-h">${h('bellHint')}</p>
        <span class="sr-only" id="tg-bell-p" role="progressbar" aria-label="${h('bellProg')}" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${d ? 3 : 0}"></span>
        <p class="center">${btn('link', 'id="tg-easy"', h('bellEasy'))}</p><p class="tg-msg center" id="tg-msg" aria-live="polite">${d ? h('s1done') : ''}</p>`,
      mount(box, sc, x) {
        const bell = $('#tg-bell', box), pb = $('#tg-bell-p', box), msg = $('#tg-msg', box);
        let t0 = 0, iv = null, sec = 0;
        if (x.done()) setRing(bell, 1);
        const stop = () => { clearInterval(iv); iv = null; bell.classList.remove('is-holding'); };
        const secs = n => { if (n !== sec) pb.setAttribute('aria-valuenow', String(sec = n)); };
        const ok = () => { stop(); setRing(bell, 1); secs(3); bell.classList.add('is-done'); msg.textContent = tx('s1done'); x.mark(); };
        const start = () => {
          if (iv || x.done()) return;
          t0 = performance.now(); msg.textContent = ''; bell.classList.add('is-holding');
          iv = setInterval(() => { const p = (performance.now() - t0) / HOLD; setRing(bell, p); secs(Math.min(3, Math.floor(p * 3))); if (p >= 1) ok(); }, 50);
        };
        // Thả sớm: vòng về 0, nhắc nhẹ
        const release = () => { if (!iv) return; stop(); setRing(bell, 0); secs(0); msg.textContent = tx('holdShort'); };
        sc.on(bell, 'pointerdown', e => { if (e.button > 0) return; e.preventDefault(); try { bell.setPointerCapture(e.pointerId); } catch (er) { } focus(bell); start(); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ty => sc.on(bell, ty, release));
        sc.on(bell, 'contextmenu', e => e.preventDefault());
        const key = e => e.key === 'Enter' || e.key === ' ';
        sc.on(bell, 'keydown', e => { if (key(e)) { e.preventDefault(); if (!e.repeat) start(); } });
        sc.on(bell, 'keyup', e => { if (key(e)) { e.preventDefault(); release(); } });
        sc.on($('#tg-easy', box), 'click', ok);
        sc.onCleanup(stop);
        return { pause: release };
      } },
    { html: () => `<p>${h('s2')}</p><p class="safety-line"><b>${api.t('player.safety')}</b>${h('breathSafety')}</p><div id="tg-pl"></div>`,
      mount: (box, sc, x) => breath($('#tg-pl', box), sc, 6, { onComplete: x.mark }) },
    { html: () => `<p>${h('s3')}</p><div id="tg-flip" class="tg-flip"></div>`,
      mount(box, sc, x) {
        const f = $('#tg-flip', box), EMO = D().EMOTIONS || [], emo = c => EMO.find(e => e.code === c);
        let picks = [null, null];   // không lưu; lật xong là bỏ
        const turn = k => {
          const w = api.capyCards({ max: 1, label: tx(k ? 'p2' : 'p1'), onChange: v => {
            picks[k] = v[0] || null;
            $('.capy-picked', f).textContent = picks[k] ? tx('picked') + emo(picks[k]).label : '';
          } });
          f.innerHTML = `<p class="label" id="tg-who">${h(k ? 'p2' : 'p1')}</p>${w.html}${btn('btn primary block', 'id="tg-fb"', h(k ? 'flip' : 'cover'))}`;
          w.mount(f);
          sc.on($('#tg-fb', f), 'click', k ? reveal : shield);
          if (k) focus($('#tg-who', f));
        };
        const shield = () => {
          f.innerHTML = `<div class="tg-shield"><p id="tg-sh">${h('shield')}</p>${btn('btn primary block', 'id="tg-fb"', h('ready'))}</div>`;
          sc.on($('#tg-fb', f), 'click', () => turn(1));
          focus($('#tg-sh', f));
        };
        const base = /^(https:\/\/|\/(?!\/))[^\s"'<>]*$/.test(String(C.ASSET_BASE || '')) ? String(C.ASSET_BASE) : '';
        const card = (c, k) => {
          const e = emo(c);
          return `<figure class="tg-pick">${e && e.img && base ? `<img src="${esc(base + e.img)}" width="120" height="120" alt="" decoding="async" data-fallback="${esc(e.emoji)}" data-fb-class="capy-emoji">`
            : `<span class="capy-emoji" aria-hidden="true">${esc(e ? e.emoji : '💭')}</span>`}<figcaption>${h(k ? 'p2' : 'p1')} · ${esc(e ? e.label : tx('noPick'))}</figcaption></figure>`;
        };
        const reveal = () => {
          f.innerHTML = `<div class="tg-reveal">${card(picks[0], 0)}${card(picks[1], 1)}</div><p class="lead" id="tg-rv">${h('s3after')}</p>`;
          picks = [null, null];
          x.mark(); focus($('#tg-rv', f));
        };
        turn(0);
      } },
    { html: () => '<div id="tg-talk"></div>',
      mount: (box, sc, x) => talk($('#tg-talk', box), sc, { doneLabel: tx('done'), onDone: () => { x.mark(); x.go(4); } }) },
    { html: d => `<p>${h('s5')}</p><p class="label">${h('ideasL')}</p><ul class="plain-list tg-ideas">${TX.ideas.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        <div class="tg-jar" aria-hidden="true">${img('jar', 120, 140, '🫙', 'pair-fb s96')}${['a', 'b'].map(c =>
          `<span class="tg-heart ${c}${d ? ' in' : ''}">${img('heart', 32, 32, '💗', 'tg-heart-fb')}</span>`).join('')}</div>
        <div class="btn-row">${[0, 1].map(n => btn('btn peach', `data-heart="${n}"${d ? ' disabled' : ''}`, h(d ? 'heartIn' : n ? 'heartB' : 'heartA'))).join('')}</div>`,
      mount(box, sc, x) {
        sc.on(box, 'click', e => {
          const b = e.target.closest('[data-heart]');
          if (!b || b.disabled) return;
          $('.tg-heart.' + (b.dataset.heart === '1' ? 'b' : 'a'), box).classList.add('in');
          b.disabled = true; b.textContent = tx('heartIn'); api.vibrate(15);
          if ($$('[data-heart]', box).every(z => z.disabled)) { x.mark(); focus($('#tg-next .btn')); }
        });
      } }
  ];
  function c1HTML() {
    const s = c1();
    if (s.end) return endHTML('c1', `<p class="center">${btn('link', 'data-go="send_words"', h('endSend'))}</p>`);
    const g = STAGES[s.i], d = s.done.includes(s.i);
    return `<section class="card tg-c1" id="tg-box"><ol class="jmap tg-map" aria-label="${h('mapL')}">${mapHTML()}</ol>
      <h1>${h('stageH', { n: s.i + 1, icon: g[0], name: g[1] })}</h1><div id="tg-st">${VIEW[s.i].html(d)}</div>
      <div id="tg-next"${d ? '' : ' hidden'}>${btn('btn primary block', 'data-act="tgNext"', h(s.i < 4 ? 'next' : 'toEnd', { n: s.i + 2 }))}</div>
      <p class="center" id="tg-skip"${d ? ' hidden' : ''}>${btn('link', 'data-act="tgSkip"', h('skip'))}</p>${api.draftLine(ex('STOP5_TOGETHER'))}</section>${foot()}`;
  }
  function mountC1(root) {
    const s = c1(), sc = scope();
    let cur = {};
    const stage = () => { cur = s.end ? {} : VIEW[s.i].mount($('#tg-st', root), sc, x) || {}; };
    // j ≥ 5 → màn kết; có chặng xong → một bản ghi C1 mỗi lượt
    const go = j => {
      if (j >= 5) { s.end = true; if (!s.rec && s.done.length) { s.rec = true; record('C1'); } } else s.i = j;
      sc.clear(); root.innerHTML = c1HTML(); stage(); focus($('h1', root)); scrollTo(0, 0);
    };
    const x = {
      done: () => s.done.includes(s.i),
      mark: () => {
        if (!s.done.includes(s.i)) s.done.push(s.i);
        s.skipped = s.skipped.filter(n => n !== s.i);
        $('.tg-map', root).innerHTML = mapHTML();
        $('#tg-next', root).hidden = false; $('#tg-skip', root).hidden = true;
        api.vibrate(30);
      },
      go
    };
    api.screenActions({
      tgMap: b => go(+b.dataset.i),
      tgNext: () => go(s.i + 1),
      tgSkip: () => { if (!s.done.includes(s.i) && !s.skipped.includes(s.i)) s.skipped.push(s.i); go(s.i + 1); }
    });
    calm(() => ({ box: $('#tg-box', root), pause: cur.pause, resume: cur.resume }));
    stage();
  }

  /* ===== C4 (AC-59): câu mẫu (hằng) hoặc tự viết đã qua kiểm → nguyên văn → shareText ===== */
  const SMAX = () => C.SEND_MAX || 300;
  function sendHTML() {
    const PR = (D().SEND_WORDS || {}).pronoun || {}, r = api.role(), pron = r === 'wife' || r === 'husband' ? r : 'shared', max = SMAX();
    return `<section class="card tg-c4"><h1>${h('c4h1')}</h1><p class="lead">${h('c4lead')}</p>
      <p class="label" id="tg-prl">${h('pron')}</p><div class="chips" role="radiogroup" aria-labelledby="tg-prl">${radios('data-pron', ['wife', 'husband', 'shared'].map(k => [k, esc(PR[k] || k)]), pron)}</div>
      <div class="tg-tabs" role="tablist" aria-label="${h('tabsL')}">${[0, 1].map(i =>
        btn('', `role="tab" id="tg-t${i}" aria-controls="tg-p${i}" aria-selected="${!i}" tabindex="${i ? -1 : 0}" data-tab="${i}"`, h('tab' + i))).join('')}</div>
      <div role="tabpanel" id="tg-p0" aria-labelledby="tg-t0"><div class="choices" role="radiogroup" aria-labelledby="tg-t0" id="tg-pre"></div></div>
      <div role="tabpanel" id="tg-p1" aria-labelledby="tg-t1" hidden><label class="label" for="tg-ta">${h('ownL')}</label>
        <textarea id="tg-ta" rows="3" maxlength="${max}" placeholder="${h('ph')}" autocomplete="off" aria-describedby="tg-ns"></textarea>
        <p class="fine"><span id="tg-cnt">0/${max}</span> · <span id="tg-ns">${h('notSaved')}</span></p>
        <p class="error-text" id="tg-em" aria-live="polite"></p><div id="tg-pii"></div>${btn('btn soft block', 'id="tg-rv"', h('review'))}</div>
      <div class="tg-preview" id="tg-pv" hidden><p class="label">${h('pvL')}</p><p class="tg-pv-text" id="tg-pvt"></p></div>
      <p class="fine" id="tg-need" hidden>${h('need')}</p>${btn('btn primary block', 'id="tg-send" aria-describedby="tg-need"', h(navigator.share ? 'send' : 'copy'))}
      <p class="fine">${h('noRecipient')}</p>${api.draftLine(ex('SEND_WORDS'))}</section>`;
  }
  function mountSend(root) {
    const sc = scope(), SW = D().SEND_WORDS || {}, max = SMAX();
    const ta = $('#tg-ta', root), pvt = $('#tg-pvt', root), send = $('#tg-send', root), need = $('#tg-need', root), box = $('#tg-pii', root);
    let pron = $('[data-pron][aria-checked="true"]', root).dataset.pron, pick = 0, own = false;
    let okText = null;   // chuỗi tự viết VỪA qua kiểm; chỉ chuỗi này được hiện / gửi
    const list = () => (Array.isArray(SW[pron]) ? SW[pron] : []).filter(s => typeof s === 'string');
    const text = () => (own ? okText || '' : list()[pick] || '');
    const paint = () => { const s = text(); $('#tg-pv', root).hidden = !s; pvt.textContent = s; need.hidden = true; send.setAttribute('aria-disabled', String(!s)); };
    const presets = () => { $('#tg-pre', root).innerHTML = radios('data-pick', list().map((s, i) => [i, `<span class="choice-title">${esc(s)}</span>`]), pick); paint(); };
    const closePanel = () => { box.innerHTML = ''; };
    const accept = v => { okText = v; paint(); focus(pvt); };
    // Tự hại trước (→ M20), rồi bảng nhận diện; "Vẫn giữ" mà ô đã đổi → kiểm lại
    function review() {
      closePanel(); okText = null; paint();
      const v = ta.value.trim().slice(0, max), em = $('#tg-em', root);
      em.textContent = '';
      if (!v) { em.textContent = tx('empty'); focus(ta); return; }
      const g = api.safetyGate(v, { from: 'send_words', kind: 'send' }) || {};
      if (g.route === 'urgent') return;   // đã sang M20, chữ bỏ
      if (g.route === 'pii') api.piiPanel(box, g.pii, { input: ta, onDrop: review, onKeep: () => { if (ta.value.trim() !== v) review(); else accept(v); } });
      else accept(v);
    }
    const setTab = i => {
      own = i === 1;
      $$('[role="tab"]', root).forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      $('#tg-p0', root).hidden = own; $('#tg-p1', root).hidden = !own;
      paint();
    };
    sc.on(root, 'click', e => {
      const p = e.target.closest('[data-pron]'), c = e.target.closest('[data-pick]'), tb = e.target.closest('[data-tab]');
      if (p) { pron = p.dataset.pron; check(root, 'data-pron', p); if (pick >= list().length) pick = 0; presets(); api.vibrate(15); }
      else if (c) { pick = +c.dataset.pick; check(root, 'data-pick', c); paint(); api.vibrate(15); }
      else if (tb) setTab(+tb.dataset.tab);
    });
    sc.on($('.tg-tabs', root), 'keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); const i = own ? 0 : 1; setTab(i); $('#tg-t' + i, root).focus();
    });
    // Sửa ô: đóng bảng, bỏ bản xem lại
    sc.on(ta, 'input', () => {
      closePanel(); $('#tg-cnt', root).textContent = ta.value.length + '/' + max;
      if (okText !== null && ta.value.trim() !== okText) { okText = null; paint(); }
    });
    sc.on($('#tg-rv', root), 'click', review);
    sc.on(send, 'click', () => {
      const s = text();
      if (!s || (own && ta.value.trim() !== okText)) { if (own) okText = null; paint(); need.hidden = false; focus(need); return; }
      api.shareText(s).then(r => {
        // Chép không được: chọn sẵn đoạn để chạm giữ
        if (r !== 'cancel' || !pvt.isConnected) return;
        try { const rg = document.createRange(), sel = getSelection(); rg.selectNodeContents(pvt); sel.removeAllRanges(); sel.addRange(rg); } catch (er) { }
      });
    });
    presets();
  }

  /* ============================== Màn ============================== */
  const frame = (t, body, id) => `<section class="card" id="tg-box"><h1>${t}</h1>${body}${api.draftLine(ex(id))}</section>${foot()}`;
  const SCREENS = {
    /* ----- M15 Hai ta ----- */
    together: { title: 'Hai ta', render: () => {
      const card = (id, i) => {
        const e = ex(id);
        if (!okEx(id)) return '';
        const t = `<span class="choice-title"><span aria-hidden="true">${esc(e.icon || '')}</span> ${esc(e.title)} · ${TX.dur[i]} ›</span>`;
        return i ? btn('choice', `data-go="${esc(e.screen)}"`, `${t}<span class="choice-sub">${esc(e.goal || '')}</span>`)
          : btn('choice tg-card', 'data-act="tgStart"', `${t}<span class="choice-sub">${h('c1Sub')}</span>`);
      };
      const cards = ['STOP5_TOGETHER', 'BREATHE_TOGETHER', 'THREE_QUESTIONS', 'SEND_WORDS'].map(card).join('');
      // Bài chưa duyệt bị ẩn hết (ALLOW_DRAFT_CONTENT tắt): giải thích, không để màn trống (AC-34)
      return `${art('capy-pair-side', 96)}<h1>Hai ta</h1><p class="lead">${h('lead')}</p>
        ${cards ? `<div class="choices tg-list">${cards}</div>` : `<p class="notice">${esc(api.t('library.empty'))}</p>`}
        <p>${btn('link', 'data-act="tgLink"', h('linkBtn'))}</p>${api.role() === 'solo' ? `<p class="fine">${h('solo')}</p>` : ''}
        ${S.mode() === 'local' ? `<p class="fine">${h('saving')}</p>` : ''}${api.draftLine(ex('STOP5_TOGETHER'))}`;
    },
    mount: () => api.screenActions({
      // Từ M15: lượt mới; Lùi / Tiến: giữ chặng
      tgStart: () => { ui().c1 = null; api.go('together_stop5'); },
      tgLink: () => api.shareApp(tx('linkMsg'))
    }) },
    /* ----- C1 DỪNG 5 cho hai ta (M15a) ----- */
    together_stop5: { title: 'DỪNG 5 cho hai ta', render: () => c1HTML(), mount: mountC1 },
    /* ----- C2 Thở cùng nhịp (M15b): 3 / 6 / 10 vòng, mặc định 6 ----- */
    together_breathe: { title: 'Thở cùng nhịp', render: () => frame('🌬️ Thở cùng nhịp', `<p class="lead">${h('s2')}</p>
        <p class="safety-line"><b>${api.t('player.safety')}</b>${h('breathSafety')}</p>
        <p class="label" id="tg-rl">${h('rounds')}</p><div class="chips" role="group" aria-labelledby="tg-rl">${[3, 6, 10].map(n =>
          btn('chip', `data-rounds="${n}" aria-pressed="${n === ui().rounds}"`, h('nRounds', { n }))).join('')}</div>
        <div id="tg-pl"></div>`, 'BREATHE_TOGETHER'),
    mount(root) {
      const sc = scope();
      let cur = {}, rec = false;
      const play = () => {
        sc.clear();
        cur = breath($('#tg-pl', root), sc, ui().rounds, { onComplete: () => { if (!rec) { rec = true; record('C2'); } }, label: tx('done'), finish: () => showEnd(root, sc, 'c2') });
      };
      lc.on($('.chips', root), 'click', e => {
        const b = e.target.closest('[data-rounds]');
        if (!b) return;
        ui().rounds = +b.dataset.rounds;
        $$('[data-rounds]', root).forEach(z => z.setAttribute('aria-pressed', String(z === b)));
        play();
      });
      calm(() => ({ box: $('#tg-box', root), pause: cur.pause }));
      play();
    } },
    /* ----- C3 Ba câu cho nhau (M15c) ----- */
    together_talk: { title: 'Ba câu cho nhau', render: () => frame('💬 Ba câu cho nhau', `<p class="lead">${h('c3lead')}</p><div id="tg-talk"></div>`, 'THREE_QUESTIONS'),
    mount(root) {
      const sc = scope(), cur = talk($('#tg-talk', root), sc, { doneLabel: tx('done'), onDone: () => { record('C3'); showEnd(root, sc, 'c3'); } });
      calm(() => ({ box: $('#tg-box', root), pause: cur.pause, resume: cur.resume }));
    } },
    /* ----- C4 Gửi lời cho người thương (M15d) ----- */
    send_words: { title: 'Gửi lời', render: sendHTML, mount: mountSend }
  };

  (window.HTDC_MODULES = window.HTDC_MODULES || []).push({
    name: 'together',
    screens: a => { api = a; C = a.C || {}; S = a.S; U = a.U; esc = a.esc; lc = a.lifecycle; return SCREENS; },
    homeTiles: a => [{ id: 'together', order: 30, render: () =>
      `<button type="button" class="tile together" data-go="together"><strong>${a.t('home.together')}</strong><span class="tile-sub">${a.t('home.togetherSub')}</span></button>` }]
  });
})();
