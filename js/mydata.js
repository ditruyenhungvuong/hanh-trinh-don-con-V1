/* Hành Trình Đón Con – js/mydata.js · module "Dữ liệu của mình" (A1) · Chủ: FE-3 Lưu trữ & Dữ liệu của mình
   Đặc tả: tech design 4.1 (mydata = M18, never = M18b), 5.1 (L-3), 5.5 (L-2), 5.6; UX 4.9, L08, 10.5; PRD 8.7, A.9; AC-18–21, 24.
   Chỉ gọi S.* và api.*. Tắt "Lưu hành trình" = xóa toàn bộ + Không lưu gì (L-3). M18 không hiện chữ người dùng đã viết. */
(() => {
  'use strict';

  /* ===== Câu chữ (UX 4.9, 10.5; PRD A.9) ===== */
  const TX = {
    swJ: ['Lưu hành trình', 'Giai đoạn, mức lòng mình, cảm xúc, bài đã làm, thói quen.'],
    swW: ['Lưu cả chữ tự viết', 'Ô "Kể thêm", suy nghĩ thả lên mây, lời tự viết. Tắt thì chữ chỉ dùng để gợi ý, rồi bỏ đi.'],
    raw: 'Có một phần dữ liệu cũ mình không đọc được. Bản sao nguyên văn giữ cả phần đó.',
    dlNote: 'Tệp nằm trong thư mục Tải về. Ai mở được máy là đọc được tệp, nhớ cất kỹ nhé.',
    dlKeep: 'Trình duyệt có thể tự xóa dữ liệu nếu lâu không mở app. Thỉnh thoảng tải tệp về để giữ nhé.',
    dlNone: '{Xung} đang dùng Không lưu gì, nên không có gì để tải về.',
    warn: 'Máy sắp đầy chỗ lưu. {Xung} tải tệp về để giữ nhé.',
    full: 'Máy đã đầy chỗ lưu nên lần này mình chưa lưu được. {Xung} tải tệp về rồi xóa bớt ở đây nhé.',
    empty: 'Chưa có gì ở đây. Bắt đầu một lần Dừng lại nhé.',
    truth: ['App không có tài khoản, không gửi gì lên mạng.', 'Ai cầm máy này và mở app là thấy những gì đã lưu. Dùng chung máy thì chọn Không lưu gì nhé.'],
    shared: 'App nằm chung địa chỉ web với vài app khác của bệnh viện. Trên cùng một máy, các app đó về kỹ thuật đọc được dữ liệu của nhau. Không app nào gửi đi.',
    armed: 'Bấm lần nữa để xóa',
    // Hộp thoại L08: [tiêu đề, thân, nút làm, nút an toàn]
    dAll: ['Xóa toàn bộ dữ liệu trên máy này?', 'Mọi lần dừng lại, bài đã làm, thói quen, chữ đã viết, cách gọi và chặng đường sẽ bị xóa. Không lấy lại được. Dữ liệu của các app khác vẫn giữ nguyên.',
      'Mình hiểu, xóa toàn bộ', 'Thôi, giữ lại'],
    dOff: ['Không lưu nữa nhé?', 'Tắt lưu là mình xóa toàn bộ những gì đã lưu trên máy này, rồi chuyển sang Không lưu gì. Không lấy lại được. Muốn giữ thì {xung} tải tệp về trước nhé.',
      'Xóa toàn bộ và chuyển sang Không lưu gì', 'Thôi, vẫn lưu'],
    dTxt: ['Những chữ đã lưu thì sao?', 'Từ giờ mình không lưu chữ nữa.', 'Xóa luôn chữ đã lưu', 'Giữ chữ cũ'],
    // Toast
    tOk: 'Đã tải tệp về máy.', tFail: 'Chưa tạo được tệp. Thử lại nhé.', tDel: 'Đã xóa.', tDelAll: 'Đã xóa toàn bộ.',
    tDelFail: 'Mình chưa xóa xong. {Xung} đóng các tab khác của app rồi thử lại nhé.',
    tOn: 'Từ giờ mình lưu cả chữ {xung} tự viết nhé.', tOff: 'Từ giờ mình không lưu chữ nữa nhé.', tErr: 'Lần này mình chưa đổi được. Thử lại nhé.',
    // M18b
    nList: ['Không hỏi tên, tuổi, số điện thoại.', 'Không gửi gì lên mạng.', 'Không cho người thương xem nhật ký của {xung}. Chỉ gửi khi {xung} bấm.',
      'Không xếp hạng, không so sánh.', 'Không có giọng đọc máy, không AI.'],
    nRows: [['Hỏi gì', 'Cách gọi và chặng đường, nếu {xung} muốn chọn.', 'Như bên cạnh, chỉ nhớ trong lần mở này.'],
      ['Ghi xuống máy', 'Chỉ những mục {xung} đồng ý, nằm trong trình duyệt của máy này.', 'Không gì cả.'],
      ['Gửi lên mạng', 'Không.', 'Không.'], ['Tải về', 'Tệp đầy đủ và bảng tính.', 'Không có gì để tải.'],
      ['Xóa', 'Từng lần, hoặc xóa toàn bộ.', 'Đóng trang là xóa sạch.']],
    nNever: ['Câu trả lời khi mình hỏi {xung} có an toàn không.', 'Việc {xung} đã mở trang hỗ trợ khẩn.', 'Những từ làm mình lo cho {xung} trong chữ {xung} viết.',
      'Lựa chọn trước bài nghe ban đêm.', 'Lời gửi cho người thương, và người nhận.', 'Cảm xúc, lượt nói của từng người ở mục Hai ta.']
  };
  const KIND = { stop: '🌬️ Dừng lại', night: '🌙 Trước khi ngủ', together: '🤝 Hai ta', stage: '🧭 Đổi chặng đường' };

  // Sự kiện bộ nhớ đã thấy (L13)
  const seen = { corrupt: false, quota: false, warn: false };

  /* ===== Tiện ích ===== */
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  // Nhãn trong danh mục data.js; icon → thêm biểu tượng; không thấy → mã
  function lab(src, code, icon) {
    const x = Array.isArray(src) ? src.find(o => isObj(o) && (o.code === code || o.id === code)) : isObj(src) ? src[code] : null;
    if (!isObj(x)) return String(code ?? '');
    return (icon && x.icon ? x.icon + ' ' : '') + (x.label || x.title || code);
  }
  const pad = n => String(n).padStart(2, '0');
  // 'HH:MM, dd/mm/yyyy' theo tz đã lưu
  const when = (U, at, tz) => { const d = new Date(at + tz * 60000); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ', ' + U.fmtDay(U.dayOf(at, tz)); };

  /* ===== M18 – Dữ liệu của mình ===== */
  function dataScreen(api) {
    const { S, C, D, U, esc } = api;
    const say = s => esc(api.say(s));
    const p = (s, c) => `<p${c ? ` class="${c}"` : ''}>${say(s)}</p>`;
    const btn = (act, label, kind) => `<button type="button" class="btn ${kind || 'ghost'} block" data-act="${act}">${say(label)}</button>`;
    const sec = (h, inner) => `<section class="card data-sec"><h2>${say(h)}</h2>${inner}</section>`;
    // Công tắc role="switch", có chữ Bật/Tắt (không chỉ màu)
    const sw = (act, on, [label, sub]) => `<div class="data-sw"><div class="data-sw-text"><span id="lb-${act}">${say(label)}</span><span class="fine" id="ds-${act}">${say(sub)}</span></div>` +
      `<button type="button" class="data-sw-btn" role="switch" data-act="${act}" aria-checked="${on}" aria-labelledby="lb-${act}" aria-describedby="ds-${act}">` +
      `<span class="switch" aria-hidden="true"></span><span aria-hidden="true">${on ? 'Bật' : 'Tắt'}</span></button></div>`;
    // T-I1: kèm {from:'mydata'} để màn Chặng đường ghi StageRec via 'mydata' (AC-17)
    const row = (txt, go, aria) => `<div class="data-row"><span>${esc(txt)}</span><button type="button" class="link" data-go="${go}" data-params="${esc(JSON.stringify({ from: 'mydata' }))}" aria-label="${say(aria)}">Đổi ›</button></div>`;

    // Dòng gọn (A1): giờ · loại · tóm tắt, không chữ tự viết
    function entry(r) {
      let t = '';
      if (r.kind === 'stop') t = [r.before != null && r.after != null ? `Trước ${r.before} → Sau ${r.after}` : '', ...(r.done || []).map(x => lab(D.EXERCISES, x && x.ex))].filter(Boolean).join(' · ');
      else if (r.kind === 'night') t = lab((api.SC || {}).SCRIPTS, r.script);
      else if (r.kind === 'stage') t = (r.from ? lab(D.STAGES, r.from, 1) + ' → ' : '') + lab(D.STAGES, r.to, 1);
      return `<li class="data-entry"><div><span class="data-entry-when">${esc(when(U, r.at, r.tz) + ' · ' + (KIND[r.kind] || ''))}</span>${t ? `<span class="fine">${esc(t)}</span>` : ''}</div>` +
        `<button type="button" class="btn danger-soft data-del" data-act="delOne" data-id="${esc(r.id)}">Xóa</button></li>`;
    }

    function body() {
      const local = S.mode() === 'local', cs = S.consent() || {};
      const role = S.prefs.get('role'), st = (S.prefs.get('stage') || {}).code, x = api.xung();
      const recs = local ? S.journal.list() : [];
      const out = ['<h1 tabindex="-1">Dữ liệu của mình</h1>'];
      // Đang dùng
      out.push(sec('Đang dùng', local ? p('💾 Lưu trên máy này', 'data-mode') + btn('toNone', 'Chuyển sang Không lưu gì')
        : p('🫥 Không lưu gì', 'data-mode') + p('Đóng trang là xóa sạch.', 'fine') +
          `<button type="button" class="btn ghost block" data-go="consent" data-params="${esc(JSON.stringify({ from: 'mydata' }))}">💾 Lưu trên máy này ›</button>`));
      // Đồng ý (chỉ khi lưu trên máy)
      if (local) {
        const at = Number.isFinite(cs.at) ? `Đồng ý lúc ${when(U, cs.at, U.tzAt(cs.at))}${cs.version ? ' · bản ' + cs.version : ''}` : '';
        out.push(sec('Mình đồng ý lưu', sw('swJourney', true, TX.swJ) + (at ? `<p class="fine">${esc(at)}</p>` : '') + sw('swWriting', !!cs.writing, TX.swW)));
      }
      // Cách gọi, chặng đường → M03, M04 chế độ đổi
      out.push(sec('Cách mình gọi {xung}', row(role ? x.charAt(0).toUpperCase() + x.slice(1) + ' (' + lab(D.ROLES, role) + ')' : 'Chưa chọn', 'role', 'Đổi cách mình gọi {xung}') +
        `<h2>Chặng đường</h2>` + row(st ? lab(D.STAGES, st, 1) : 'Chưa chọn chặng đường', 'stage', 'Đổi chặng đường')));
      // Phần của module khác (A2: thói quen)
      api.dataSections().forEach(s => { try { out.push(`<div class="data-ext" data-sec="${esc(s.id)}">${s.render()}</div>`); } catch (e) { /* bỏ qua */ } });
      // Tải về (AC-18)
      out.push(sec('Tải về', !local ? p(TX.dlNone) : (seen.quota ? `<p class="notice" role="alert">${say(TX.full)}</p>` : seen.warn ? `<p class="notice">${say(TX.warn)}</p>` : '') +
        btn('dlJson', 'Tải tệp đầy đủ (JSON)') + btn('dlCsv', 'Tải bảng Dừng lại (CSV)') +
        (seen.corrupt ? p(TX.raw, 'fine') + btn('dlRaw', 'Tải bản sao nguyên văn') : '') + p(TX.dlNote, 'fine') + p(TX.dlKeep, 'fine')));
      // Xóa (chỉ khi lưu trên máy; Không lưu gì: đóng trang là xóa). AC-19, 20
      if (local) {
        out.push(sec('Xóa', (api.has('journal') ? '<p><button type="button" class="link" data-go="journal">Xóa từng lần ở Hành trình của mình ›</button></p>'
          : '<h3>Những lần gần đây</h3>' + (recs.length ? `<ul class="data-list">${recs.slice(0, 20).map(entry).join('')}</ul>` : p(TX.empty))) +
          (recs.some(r => r.note !== undefined || r.texts !== undefined) ? btn('delTexts', 'Xóa mọi chữ đã viết', 'danger-soft') : '') + btn('delAll', 'Xóa toàn bộ', 'danger-soft')));
      }
      // Nói thật (AC-21)
      out.push(sec('Nói thật về chỗ lưu', p(TX.truth[0]) + p(TX.truth[1]) + (C.SHARED_ORIGIN ? p(TX.shared, 'fine') : '') +
        '<p><button type="button" class="link" data-go="never">Những điều app không bao giờ làm ›</button></p>'));
      return out.join('');
    }

    return {
      title: 'Dữ liệu',
      render: () => `<div class="mydata">${body()}</div>`,
      mount(root) {
        let busy = false;
        const mountExt = () => api.dataSections().forEach(s => {
          const el = root.querySelector(`.data-ext[data-sec="${CSS.escape(String(s.id))}"]`);
          if (el && typeof s.mount === 'function') { try { s.mount(el); } catch (e) { /* bỏ qua */ } }
        });
        // Vẽ lại thân, đưa focus về chỗ vừa bấm
        const paint = sel => {
          const b = root.querySelector('.mydata');
          if (!b) return;
          b.innerHTML = body(); mountExt();
          const el = sel && b.querySelector(sel);
          if (el) el.focus({ preventScroll: true });
        };
        mountExt();
        const once = fn => async (...a) => { if (busy) return; busy = true; try { await fn(...a); } finally { busy = false; } };
        const ask = (d, o) => api.dialog(Object.assign({ title: d[0], body: p(d[1]), actions: [
          { label: d[2], value: 'yes', kind: 'danger' }, { label: d[3], value: 'no', kind: 'ghost', safe: true }] }, o));
        // Tên tệp không có tên app (L-2)
        const dl = (kind, ext, mime, get) => Promise.resolve().then(get)
          .then(text => api.toast(api.download('du-lieu-cua-minh-' + (kind ? kind + '-' : '') + api.today() + ext, mime, text) ? TX.tOk : TX.tFail), () => api.toast(TX.tFail));
        // L-3: xóa toàn bộ + Không lưu gì; vai, giai đoạn mang sang bộ nhớ
        const toNone = once(async sel => {
          if (await ask(TX.dOff) !== 'yes') { paint(sel); return; }
          const role = S.prefs.get('role'), stage = S.prefs.get('stage');
          // Xóa chưa xong thì báo thật, vẫn ở chế độ lưu trên máy (n-3)
          if (await S.clearAll() === false) { paint(sel); api.toast(api.say(TX.tDelFail)); return; }
          S.startNone();
          if (role) S.prefs.set('role', role);
          if (stage) S.prefs.set('stage', stage);
          api.toast(TX.tDelAll);
          api.resetTo('home');
        });
        api.screenActions({
          toNone: () => toNone('[data-act="toNone"]'),
          swJourney: () => toNone('[data-act="swJourney"]'),
          swWriting: once(async () => {
            let ok, msg;
            if (!(S.consent() || {}).writing) { ok = await S.setWriting(true); msg = TX.tOn; }
            else {
              const purge = await ask(TX.dTxt, { defaultFocus: 0 }) === 'yes';   // AC-24: focus "Xóa luôn chữ đã lưu"; Esc = Giữ chữ cũ
              ok = await S.setWriting(false, { purge });
              msg = purge ? TX.tDel : TX.tOff;
            }
            paint('[data-act="swWriting"]');
            api.toast(api.say(ok ? msg : TX.tErr));
          }),
          dlJson: () => dl('', '.json', 'application/json', () => S.exportJson()),
          dlCsv: () => dl('dung-lai', '.csv', 'text/csv;charset=utf-8', () => S.exportCsv('stops')),
          dlRaw: () => dl('ban-sao-nguyen-van', '.json', 'application/json', () => S.exportRaw()),
          // AC-19: bấm 2 lần
          delOne: b => api.confirmTwice(b, { label2: TX.armed, ms: 4000 }, async () => { await S.journal.remove(b.dataset.id); paint('h1'); api.toast(TX.tDel); }),
          delTexts: b => api.confirmTwice(b, { label2: TX.armed, ms: 4000 }, async () => {
            const ok = await S.setWriting(!!(S.consent() || {}).writing, { purge: true });
            paint('[data-act="delAll"]'); api.toast(ok ? TX.tDel : TX.tErr);
          }),
          // AC-20: xóa toàn bộ → về M01
          delAll: once(async () => {
            if (await ask(TX.dAll) !== 'yes') return;
            // Xóa chưa xong: không báo "Đã xóa", ở lại M18 (dữ liệu vẫn còn, khóa đánh dấu giữ nguyên) (n-3)
            if (await S.clearAll() === false) { paint('[data-act="delAll"]'); api.toast(api.say(TX.tDelFail)); return; }
            api.toast(TX.tDelAll);
            api.resetTo('welcome');
          })
        });
        // Tab khác ghi / đổi đồng ý → vẽ lại
        api.lifecycle.onCleanup(S.on(ev => { if (ev && ev.type === 'otherTab' && !ev.reload) paint(); }));
      }
    };
  }

  /* ===== M18b – Những điều app không bao giờ làm ===== */
  function neverScreen(api) {
    const { S, C, esc } = api;
    const say = s => esc(api.say(s));
    const ul = list => `<ul class="never-list">${list.map(s => `<li><span aria-hidden="true">✕</span> ${say(s)}</li>`).join('')}</ul>`;
    return {
      title: 'Quyền riêng tư',
      render: () => `<div class="never"><h1>Những điều app không bao giờ làm</h1>${ul(TX.nList)}<section class="card"><h2>App lưu gì, ở đâu</h2>` +
        TX.nRows.map(r => `<div class="cmp-row"><h3>${say(r[0])}</h3><p><span class="cmp-k">💾 Lưu trên máy này:</span> ${say(r[1])}</p><p><span class="cmp-k">🫥 Không lưu gì:</span> ${say(r[2])}</p></div>`).join('') +
        `</section><section class="card"><h2>${say('Không bao giờ lưu, kể cả khi {xung} đồng ý')}</h2>${ul(TX.nNever)}</section>` +
        `<p>${say(TX.truth[0])}</p>${C.SHARED_ORIGIN ? `<p class="fine">${say(TX.shared)}</p>` : ''}<p>` +
        (S.mode() !== 'unset' ? '<button type="button" class="link" data-go="mydata">Dữ liệu của mình ›</button> · ' : '') +
        '<button type="button" class="link" data-go="about">Về app này ›</button></p></div>'
    };
  }

  (window.HTDC_MODULES = window.HTDC_MODULES || []).push({
    name: 'mydata',
    screens: api => ({ mydata: dataScreen(api), never: neverScreen(api) }),
    homeLinks: () => [{ id: 'mydata', order: 30, label: '🔒 Dữ liệu của mình', go: 'mydata' }],
    init(api) {
      api.S.on(ev => {
        if (!ev) return;
        if (ev.type === 'corrupt') seen.corrupt = true;
        else if (ev.type === 'quota') seen[ev.warn ? 'warn' : 'quota'] = true;
        else if (ev.type === 'change' && ev.what === 'clear') seen.corrupt = seen.quota = seen.warn = false;
      });
    }
  });
})();
