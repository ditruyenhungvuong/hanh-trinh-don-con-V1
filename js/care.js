/* Hành Trình Đón Con – js/care.js · module "Chăm mình" (A2) · Chủ: FE-8 Chăm mình & Hành trình
   Đặc tả: tech design 3.3 (markHabit), 4.1, 5.3 (HabitDay, kv habits), 5.5, 9; UX 4.7 (M16), 4.2 (ô 🌱 ở M05); PRD 6.7, A.8;
   AC-60–63. T-09 (FE-8, 10/11/2026).
   - 7 thói quen lấy từ D.HABITS (đề cương LMHB); no_smoke tắt mặc định. Không "uống đủ nước". Chỗ quanh thủ thuật:
     "theo dặn của bác sĩ điều trị" (dòng phụ của move nằm ở data.js). Thẻ thuốc / thực phẩm chức năng cố định, không khuyên.
   - Tự đánh dấu 'a' khi nghe 'done' (stop → pause, night → sleep, together → connect), chỉ khi ô hôm nay đang trống
     và thói quen đang bật; bỏ tick được (AC-62). Tick tay = 'x'.
   - 7 chấm + "{n}/7 ngày": không chuỗi, không đỏ, không trách khi trống (AC-63). Không lưu gì: chỉ hôm nay, không 7 chấm.
   - Chỉ ghi qua S.habits.set / S.prefs.set('habits'); chế độ "Không lưu gì" thì store giữ trong bộ nhớ (AC-11).
   - Mọi chữ vào HTML qua esc (AC-05). Chữ có [N] là chữ mới của FE-8, draft chờ anh duyệt. */
(() => {
  'use strict';

  /* ===== Câu chữ (PRD 6.7, A.8; UX 4.7). [N] = chữ mới, draft ===== */
  const TX = {
    title: 'Chăm mình', h1: 'Chăm mình hôm nay', lead: 'Một việc nhỏ cũng là chăm mình.',
    none: 'Chỉ tick trong lần mở này. Đóng trang là mất.',
    off: '{Xung} đã tắt hết thói quen. Khi nào muốn, bật lại một việc nhỏ nhé.',
    meds: 'Thuốc, thực phẩm chức năng, thuốc nam, kiêng cữ: {xung} hỏi bác sĩ điều trị trước nhé. App không khuyên về những điều này.',
    set: 'Chọn thói quen hiển thị', on: 'Bật', offSw: 'Tắt',
    again: 'Bắt đầu lại lúc nào cũng được.',
    week: '7 ngày gần nhất', n: '{n}/7 ngày', yes: 'có', no: 'chưa',
    autoTag: 'tự đánh dấu',                                                   // [N]
    smoke: 'Hôm nào chưa được cũng không sao nhé.',                           // [N] lời không phán xét (câu 17)
    auto: { night: 'Tự đánh dấu khi {xung} nghe xong một bài Trước khi ngủ.',  // [N]
      together: 'Tự đánh dấu khi xong một bài Hai ta.', stop: 'Tự đánh dấu khi {xung} tới bước Check-out.' },
    tile: '🌱 Chăm mình hôm nay', tileEmpty: 'Vài việc nhỏ cho hôm nay', tileN: '{n}/{m} việc nhỏ',
    // M18: phần thói quen (dataSections). Tên tệp không có tên app (L-2)
    dataH2: 'Thói quen', dataCsv: 'Tải bảng thói quen (CSV)', dataGo: 'Chọn thói quen ở Chăm mình hôm nay ›',   // [N]
    tOk: 'Đã tải tệp về máy.', tFail: 'Chưa tạo được tệp. Thử lại nhé.',
    tErr: 'Lần này mình chưa lưu được. Thử lại nhé.'                          // [N]
  };
  const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  function make(api) {
    const { S, D, U, esc } = api;
    const HB = () => (Array.isArray(D.HABITS) ? D.HABITS : []);
    const fill = (s, v) => { let o = String(s || ''); if (v) for (const k of Object.keys(v)) o = o.split('{' + k + '}').join(String(v[k])); return o; };
    const say = (s, v) => api.say(fill(s, v));                    // chữ thô (cho toast: toast tự esc)
    const tx = (s, v) => esc(api.say(fill(s, v)));                // chữ vào HTML

    /* ===== Ngày ===== */
    const wd = day => WD[((U.dayNum(day) + 4) % 7 + 7) % 7];       // 1970-01-01 là Thứ Năm
    const dm = day => +day.slice(8, 10) + '/' + +day.slice(5, 7);
    const week = today => Array.from({ length: 7 }, (_, i) => U.dayAdd(today, i - 6));   // cũ → mới, hôm nay ở cuối

    /* ===== Thói quen đang bật (kv habits; chưa có → mặc định theo data.js, no_smoke tắt) ===== */
    function enabled() {
      const v = S.prefs.get('habits'), codes = HB().map(h => h.code);
      if (v && Array.isArray(v.enabled)) return codes.filter(c => v.enabled.includes(c));
      return HB().filter(h => h.on).map(h => h.code);
    }
    const marksOf = day => ((S.habits.get(day) || {}).marks) || {};
    const isOn = m => m === 'x' || m === 'a';

    // AC-62: how 'a' = app tự đánh dấu, chỉ khi ô trống; 'x' = tick tay; '' = bỏ tick
    function markHabit(code, how) {
      const val = how === '' ? '' : how === 'a' ? 'a' : 'x', day = api.today();
      if (!HB().some(h => h.code === code) || !enabled().includes(code)) return false;
      if (val === 'a' && marksOf(day)[code]) return false;
      return !!S.habits.set(day, code, val);
    }

    /* ===== M16: một hàng thói quen ===== */
    function row(h, today, marks, rng, local) {
      const m = marks[h.code] || '', on = isOn(m);
      const sub = [h.note ? `<span class="cr-note">${tx(h.note)}</span>` : '',
        h.code === 'no_smoke' ? `<span class="cr-note">${tx(TX.smoke)}</span>` : ''].join('');
      let wk = '';
      if (local) {
        const days = week(today), n = days.filter(d => isOn((rng[d] || {})[h.code])).length;
        wk = `<div class="cr-wk"><ol class="cr-week" aria-label="${tx(TX.week)}">` + days.map(d => {
          const yes = isOn((rng[d] || {})[h.code]);
          return `<li class="cr-dot${yes ? ' on' : ''}${d === today ? ' today' : ''}"><span class="sr-only">${esc(wd(d) + ' ' + dm(d) + ': ' + (yes ? TX.yes : TX.no))}</span></li>`;
        }).join('') + `</ol><span class="cr-n">${tx(TX.n, { n })}</span></div>`;
      }
      return `<li class="cr-item"><label class="cr-row"><input type="checkbox" data-h="${esc(h.code)}"${on ? ' checked' : ''}>` +
        `<span class="cr-label">${esc((h.icon ? h.icon + ' ' : '') + h.label)}${m === 'a' ? ` <span class="cr-auto">· ${tx(TX.autoTag)}</span>` : ''}</span></label>` +
        sub + wk + '</li>';
    }
    // Phần danh sách (vẽ lại sau mỗi tick / bật tắt, giữ nguyên phần cài)
    function list() {
      const today = api.today(), local = S.mode() === 'local', on = enabled();
      const hs = HB().filter(h => on.includes(h.code));
      if (!hs.length) return `<p class="cr-off">${tx(TX.off)}</p>`;
      const marks = marksOf(today), rng = {};
      if (local) S.habits.range(U.dayAdd(today, -6), today).forEach(r => { rng[r.day] = r.marks || {}; });
      return `<ul class="cr-list">${hs.map(h => row(h, today, marks, rng, local)).join('')}</ul>`;
    }
    // Phần cài: công tắc role="switch", có chữ Bật/Tắt (không chỉ màu)
    function settings() {
      const on = enabled();
      return HB().map(h => {
        const c = on.includes(h.code), id = 'cr-sw-' + h.code;
        const aut = h.auto && TX.auto[h.auto] && (h.auto !== 'together' || api.has('together')) ? `<span class="fine" id="${id}d">${tx(TX.auto[h.auto])}</span>` : '';
        return `<div class="cr-sw"><span class="cr-sw-text"><span id="${id}">${esc((h.icon ? h.icon + ' ' : '') + h.label)}</span>${aut}</span>` +
          `<button type="button" class="cr-sw-btn" role="switch" data-act="crSw" data-h="${esc(h.code)}" aria-checked="${c}" aria-labelledby="${id}"${aut ? ` aria-describedby="${id}d"` : ''}>` +
          `<span class="switch" aria-hidden="true"></span><span aria-hidden="true">${tx(c ? TX.on : TX.offSw)}</span></button></div>`;
      }).join('');
    }

    const care = {
      title: TX.title,
      render() {
        const today = api.today();
        return `<div class="care"><h1>${tx(TX.h1)}</h1><p class="lead">${tx(TX.lead)}</p>` +
          `<p class="fine">${esc(wd(today) + ', ' + dm(today))}</p>` +
          (S.mode() === 'local' ? '' : `<p class="fine cr-none">${tx(TX.none)}</p>`) +
          `<section class="card cr-card"><div class="cr-box">${list()}</div></section>` +
          `<p class="notice cr-meds">${tx(TX.meds)}</p>` +
          `<details class="cr-set"><summary>${tx(TX.set)} ›</summary><div class="cr-sws">${settings()}</div></details>` +
          `<p class="fine">${tx(TX.again)}</p></div>`;
      },
      mount(root) {
        const box = root.querySelector('.cr-box'), sws = root.querySelector('.cr-sws');
        // Vẽ lại danh sách, focus lại ô vừa chạm (nếu còn)
        const paint = code => {
          box.innerHTML = list();
          const el = code && box.querySelector(`input[data-h="${CSS.escape(code)}"]`);
          if (el) el.focus({ preventScroll: true });
        };
        api.lifecycle.on(box, 'change', e => {
          const el = e.target.closest('input[data-h]');
          if (!el) return;
          const ok = markHabit(el.dataset.h, el.checked ? 'x' : '');
          if (ok) api.vibrate(15); else api.toast(say(TX.tErr));
          paint(el.dataset.h);
        });
        api.screenActions({
          crSw: b => {
            const code = b.dataset.h, on = enabled();
            const next = b.getAttribute('aria-checked') === 'true' ? on.filter(c => c !== code) : on.concat(code);
            if (!S.prefs.set('habits', { enabled: HB().map(h => h.code).filter(c => next.includes(c)) })) { api.toast(say(TX.tErr)); return; }
            sws.innerHTML = settings();
            paint();
            const el = sws.querySelector(`[data-act="crSw"][data-h="${CSS.escape(code)}"]`);
            if (el) el.focus({ preventScroll: true });
          }
        });
        // Tab khác vừa ghi → vẽ lại số liệu
        api.lifecycle.onCleanup(S.on(ev => { if (ev && ev.type === 'otherTab' && !ev.reload) { sws.innerHTML = settings(); paint(); } }));
      }
    };

    // Ô 🌱 ở M05: không "0/6" khi chưa tick (UX 4.2)
    function tile() {
      const on = enabled(), marks = marksOf(api.today()), n = on.filter(c => isOn(marks[c])).length;
      return `<button type="button" class="tile care" data-go="care"><strong>${tx(TX.tile)}</strong>` +
        `<span class="tile-sub">${tx(n && on.length ? TX.tileN : TX.tileEmpty, { n, m: on.length })}</span></button>`;
    }

    // M18: tải CSV thói quen (chỉ khi lưu trên máy; Không lưu gì thì M18 đã nói "không có gì để tải về")
    const section = {
      id: 'habits',
      render: () => (S.mode() !== 'local' ? '' : `<section class="card data-sec"><h2>${tx(TX.dataH2)}</h2>` +
        `<button type="button" class="btn ghost block" data-act="crCsv">${tx(TX.dataCsv)}</button>` +
        `<p><button type="button" class="link" data-go="care">${tx(TX.dataGo)}</button></p></section>`),
      mount: () => api.screenActions({
        crCsv: () => {
          let ok = false;
          try { ok = api.download('du-lieu-cua-minh-thoi-quen-' + api.today() + '.csv', 'text/csv;charset=utf-8', S.exportCsv('habits')); } catch (e) { ok = false; }
          api.toast(ok ? TX.tOk : TX.tFail);
        }
      })
    };

    return { care, markHabit, tile, section };
  }

  const cache = new WeakMap();
  const get = api => { if (!cache.has(api)) cache.set(api, make(api)); return cache.get(api); };
  (window.HTDC_MODULES = window.HTDC_MODULES || []).push({
    name: 'care',
    screens: api => ({ care: get(api).care }),
    provides: api => ({ markHabit: get(api).markHabit }),
    // AC-62: xong một bài → tự đánh dấu thói quen có auto trùng loại (data.js HABITS[].auto)
    init(api) {
      api.on('done', ev => {
        const h = ev && (api.D.HABITS || []).find(x => x.auto && x.auto === ev.kind);
        if (h) api.markHabit(h.code, 'a');
      });
    },
    homeTiles: api => [{ id: 'care', order: 40, render: () => get(api).tile() }],
    dataSections: api => [get(api).section]
  });
})();
