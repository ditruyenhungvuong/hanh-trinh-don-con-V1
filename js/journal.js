/* Hành Trình Đón Con – js/journal.js · module "Hành trình của mình" (A2) · Chủ: FE-8 Chăm mình & Hành trình
   Đặc tả: tech design 4.1, 5.3, 5.6, 9, 11.2; UX 4.8 (M17); PRD A.8; AC-19, 64. T-09 (FE-8, 10/11/2026).
   - S.journal.list() mới nhất trên cùng, nhóm theo ngày, vẽ dần 40 mục một trang (3.000 bản ghi, 11.2).
   - Chỉ hiện trường đã lưu (5.3): không câu trả lời an toàn, cờ từ khóa, luật gợi ý (K-7, N-1). Chữ tự viết ẩn trong <details>.
   - Sau tin buồn (after_loss hoặc phiên có nhóm "Mất con"): tên bài đêm nói về con cất vào <details> "Tên bài (ẩn)".
   - Xóa: bấm 2 lần (AC-19). Không lưu gì: không nút xóa (5.6). Mọi chữ qua esc (AC-05). [N] = chữ mới, draft. */
(() => {
  'use strict';

  /* ===== Câu chữ (PRD A.8; UX 4.8, 10.5) ===== */
  const TX = {
    title: 'Hành trình', h1: 'Hành trình của mình', link: '📖 Hành trình của mình',
    none: '{Xung} đang dùng \'Không lưu gì\', nên ở đây chỉ có những gì trong lần mở này.',
    empty: 'Chưa có gì ở đây. Bắt đầu một lần Dừng lại nhé.', emptyGo: '🌬️ Dừng lại một chút ›',
    emptyKind: 'Chưa có lần nào ở mục này.',                                        // [N]
    filter: 'Lọc theo loại', all: 'Tất cả', today: 'Hôm nay', yesterday: 'Hôm qua',
    more: 'Xem thêm ›', count: 'Đang hiện {a}/{n} mục.',                             // [N]
    del: 'Xóa', armed: 'Bấm lần nữa để xóa', tDel: 'Đã xóa.', tDelFail: 'Mình chưa xóa được. Thử lại nhé.',   // [N] tDelFail
    texts: 'Chữ đã viết (ẩn)', hidden: 'Tên bài (ẩn)',                              // [N] hidden
    before: 'Trước {b} → Sau {a}', stopped: 'Dừng giữa chừng', together: 'Đã làm cùng nhau', stageTo: 'Đổi chặng đường',   // [N] stopped
    note: 'Kể thêm', thought: 'Suy nghĩ', know: 'Biết chắc', unknown: 'Chưa biết', todo: 'Việc mình làm được'
  };
  const KINDS = [['stop', '🌬️', 'Dừng lại'], ['night', '🌙', 'Trước khi ngủ'], ['together', '🤝', 'Hai ta'], ['stage', '🧭', 'Chặng đường']];
  const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const PAGE = 40, BABY = ['NIGHT_HOME', 'NIGHT_HOME_SHORT'];   // BABY: dự phòng khi scripts.js thiếu hasBaby
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

  function make(api) {
    const { S, D, U, esc } = api;
    const fill = (s, v) => { let o = String(s || ''); if (v) for (const k of Object.keys(v)) o = o.split('{' + k + '}').join(String(v[k])); return o; };
    const tx = (s, v) => esc(api.say(fill(s, v)));
    const ui = () => (api.state.ui.journal = api.state.ui.journal || { filter: 'all' });

    /* ===== Nhãn (mã lạ → bỏ, không hiện mã thô) ===== */
    const find = (list, c) => (Array.isArray(list) ? list.find(x => x && x.code === c) : null) || {};
    const stageLab = c => { const x = find(D.STAGES, c); return x.label ? (x.icon ? x.icon + ' ' : '') + x.label : ''; };
    const labOf = (list, c) => find(list, c).label || '';
    const exLab = id => (own(D.EXERCISES, id) ? D.EXERCISES[id].short || D.EXERCISES[id].title : '');
    const script = id => { const sc = (api.SC || {}).SCRIPTS; return own(sc, id) ? sc[id] : null; };
    // Chỉ đọc trong bộ nhớ để ẩn bớt, không ghi gì (N-1)
    const lossNow = () => { const f = api.state.session.flags; return api.stage() === 'after_loss' || !!(f && f.has && f.has('loss')); };

    const pad = n => String(n).padStart(2, '0');
    const hhmm = r => { const d = new Date(r.at + r.tz * 60000); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
    function dayHead(day) {
      const t = api.today();
      return day === t ? TX.today : day === U.dayAdd(t, -1) ? TX.yesterday : WD[((U.dayNum(day) + 4) % 7 + 7) % 7] + ', ' + U.fmtDay(day);
    }

    /* ===== Một mục (TimelineItem) ===== */
    const hide = (sum, ps) => `<details class="jr-text"><summary>${tx(sum)}</summary>${ps.map(([h, s]) => `<p>${h ? `<strong>${esc(h)}:</strong> ` : ''}${esc(s)}</p>`).join('')}</details>`;
    function written(r) {
      const ps = [], w = r.texts || {}, str = s => typeof s === 'string' && s;
      if (str(r.note)) ps.push([TX.note, r.note]);
      if (str(w.thought)) ps.push([TX.thought, w.thought]);
      ['know', 'unknown', 'todo'].forEach(k => { if (Array.isArray(w[k]) && w[k].length) ps.push([TX[k], w[k].join(' · ')]); });
      return ps.length ? hide(TX.texts, ps) : '';
    }
    function item(r, local, loss) {
      const k = KINDS.find(x => x[0] === r.kind);
      if (!k) return '';
      let head = [k[2]], extra = '';
      const lines = [];
      if (r.kind === 'stop') {
        head.push(stageLab(r.stage));
        if (Number.isInteger(r.before) && Number.isInteger(r.after)) lines.push(fill(TX.before, { b: r.before, a: r.after }));
        (r.done || []).forEach(d => { const l = exLab(d && d.ex); if (l && !lines.includes(l)) lines.push(l); });
        lines.push(labOf(D.FITS, r.fit));
        const emo = (r.emotions || []).map(c => labOf(D.EMOTIONS, c)).filter(Boolean);
        extra = (emo.length ? `<p class="jr-emo">${esc(emo.join(', '))}</p>` : '') + written(r);
      } else if (r.kind === 'night') {
        const s = script(r.script) || {};
        if (loss && (BABY.includes(r.script) || s.hasBaby)) { if (s.title) extra = hide(TX.hidden, [['', s.title]]); } else if (s.title) head = [s.title];
        lines.push(r.end !== 'finished' ? TX.stopped : r.outcome === 'skip' ? '' : labOf(D.NIGHT_OUTCOMES, r.outcome));
      } else if (r.kind === 'together') {
        head = [TX.together, (Object.values(D.EXERCISES || {}).find(x => x && x.code === r.exercise) || {}).title];
      } else {
        head = [TX.stageTo];
        lines.push((r.from ? stageLab(r.from) + ' → ' : '') + stageLab(r.to));
      }
      const id = 'jr-' + r.id, ln = lines.filter(Boolean);
      return `<li class="jr-item" tabindex="-1" data-id="${esc(r.id)}" data-day="${esc(r.day)}"><p class="jr-head" id="${esc(id)}">` +
        `<span aria-hidden="true">${esc(k[1])}</span> ${esc([hhmm(r)].concat(head.filter(Boolean)).join(' · '))}</p>` +
        (ln.length ? `<p class="jr-line">${esc(ln.join(' · '))}</p>` : '') + extra +
        (local ? `<button type="button" class="btn danger-soft jr-del" data-act="jrDel" data-id="${esc(r.id)}" aria-describedby="${esc(id)}">${tx(TX.del)}</button>` : '') + '</li>';
    }
    // Đoạn [from, to); tiêu đề ngày chỉ khi đổi ngày (nối trang không lặp)
    function chunk(recs, from, to, day, local, loss) {
      let out = '';
      for (let i = from; i < Math.min(to, recs.length); i++) {
        const r = recs[i];
        if (r.day !== day) { out += `<li class="jr-day" data-day="${esc(r.day)}"><h2>${tx(dayHead(r.day))}</h2></li>`; day = r.day; }
        out += item(r, local, loss);
      }
      return out;
    }

    const journal = {
      title: TX.title,
      render() {
        const all = S.journal.list(), have = KINDS.filter(k => all.some(r => r.kind === k[0]));
        const f = ui().filter = have.some(k => k[0] === ui().filter) ? ui().filter : 'all';
        let out = `<div class="journal"><h1>${tx(TX.h1)}</h1>` + (S.mode() === 'local' ? '' : `<p class="fine">${tx(TX.none)}</p>`);
        if (!all.length) return out + `<p>${tx(TX.empty)}</p><button type="button" class="btn primary block" data-go="pause5">${tx(TX.emptyGo)}</button></div>`;
        // Lọc chọn một (radiogroup: app.js lo phím mũi tên); chỉ khi có ≥ 2 loại
        if (have.length > 1) out += `<div class="chips jr-chips" role="radiogroup" aria-label="${tx(TX.filter)}">` + [['all', '', TX.all]].concat(have)
          .map(k => `<button type="button" class="chip" role="radio" data-act="jrFilter" data-k="${esc(k[0])}" aria-checked="${k[0] === f}" tabindex="${k[0] === f ? 0 : -1}">${esc(k[2])}</button>`).join('') + '</div>';
        return out + '<div class="jr-box"></div></div>';
      },
      mount(root) {
        const box = root.querySelector('.jr-box');
        if (!box) return;
        const local = S.mode() === 'local', loss = lossNow();
        let recs = [], shown = 0;
        const foot = () => (shown < recs.length ? `<p class="fine jr-count" aria-live="polite">${tx(TX.count, { a: shown, n: recs.length })}</p>` +
          `<button type="button" class="btn ghost block" data-act="jrMore">${tx(TX.more)}</button>` : '');
        function paint() {
          const f = ui().filter;
          recs = S.journal.list().filter(r => f === 'all' || r.kind === f); shown = Math.min(PAGE, recs.length);
          box.innerHTML = recs.length ? `<ol class="jr-list">${chunk(recs, 0, shown, null, local, loss)}</ol><div class="jr-foot">${foot()}</div>` : `<p>${tx(TX.emptyKind)}</p>`;
        }
        // "Xem thêm": nối trang kế, focus mục đầu của trang mới
        function more() {
          const list = box.querySelector('.jr-list'), from = shown, tpl = document.createElement('template');
          if (!list || !from) return;
          shown = Math.min(shown + PAGE, recs.length);
          tpl.innerHTML = chunk(recs, from, shown, recs[from - 1].day, local, loss);
          const first = tpl.content.querySelector('.jr-item');
          list.append(tpl.content);
          box.querySelector('.jr-foot').innerHTML = foot();
          if (first) first.focus();
        }
        // Xóa xong: bỏ mục (và tiêu đề ngày nếu hết mục), focus nút Xóa kế hoặc h1
        function drop(id) {
          const i = recs.findIndex(r => r.id === id), q = s => box.querySelector(s);
          if (i >= 0) { recs.splice(i, 1); if (i < shown) shown--; }
          if (!recs.length) { api.go('journal', {}, { replace: true }); return; }
          const li = q(`.jr-item[data-id="${CSS.escape(id)}"]`);
          if (!li) return;
          let nx = li.nextElementSibling;
          while (nx && !nx.classList.contains('jr-item')) nx = nx.nextElementSibling;
          const day = CSS.escape(li.dataset.day);
          li.remove();
          if (!q(`.jr-item[data-day="${day}"]`)) { const h = q(`.jr-day[data-day="${day}"]`); if (h) h.remove(); }
          q('.jr-foot').innerHTML = foot();
          const to = (nx && nx.querySelector('.jr-del')) || q('.jr-del') || root.querySelector('h1');
          if (to) to.focus({ preventScroll: true });
        }
        paint();
        api.screenActions({
          jrFilter: b => {
            if (ui().filter === b.dataset.k) return;
            ui().filter = b.dataset.k;
            root.querySelectorAll('[data-act="jrFilter"]').forEach(x => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
            paint();
          },
          jrMore: more,
          // AC-19: lần 1 đổi chữ "Bấm lần nữa để xóa" (4 s), lần 2 mới xóa
          jrDel: b => api.confirmTwice(b, { label2: TX.armed, ms: 4000 }, async () => {
            const id = b.dataset.id;
            try { await S.journal.remove(id); } catch (e) { /* store báo lỗi ghi qua S.on (L13) */ }
            if (S.journal.list().some(r => r.id === id)) { api.toast(TX.tDelFail); return; }
            drop(id);
            api.toast(TX.tDel);
          })
        });
        // Tab khác vừa ghi → vẽ lại từ đầu
        api.lifecycle.onCleanup(S.on(ev => { if (ev && ev.type === 'otherTab' && !ev.reload) api.go('journal', {}, { replace: true }); }));
      }
    };
    return journal;
  }

  const cache = new WeakMap();
  const get = api => { if (!cache.has(api)) cache.set(api, make(api)); return cache.get(api); };
  (window.HTDC_MODULES = window.HTDC_MODULES || []).push({
    name: 'journal',
    screens: api => ({ journal: get(api) }),
    homeLinks: () => [{ id: 'journal', order: 10, label: TX.link, go: 'journal' }]   // đứng đầu hàng link M05; app.js thêm " ›"
  });
})();
