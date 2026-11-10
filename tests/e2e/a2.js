/* =========================================================
   e2e A2 – Hành Trình Đón Con (Chủ: qa-tester; T-Q3 10/11/2026). Nạp từ tests/e2e.js (dùng chung trình duyệt, T, bảng AC).
   Viết TỪ ĐẶC TẢ: PRD v0.3 mục 6.6, 6.7, 8.1, 8.3 (R5), 8.7, AC-19, 55–64; UX 4.6 (M15–M15d), 4.7 (M16), 4.8 (M17), 10.4;
   tech design 3.3 (markHabit, shareText), 5.3 (TogetherRec 7 trường, HabitDay, kv habits), 9, 11.2.
   Kịch bản (chạy với --only=M,N,…):
     M  Hai ta C1 (5 chặng, bỏ qua, nhảy, chuông giữ 3 s chuột / phím / link), C2 thở cùng nhịp, C3 lượt nói 2 phút (tua giờ),
        Đổi lượt, rung; bản ghi together đúng 7 trường; tự đánh dấu connect (AC-55…58, 62)
     N  C4 Gửi lời: câu mẫu 3 bộ, nguyên văn, share / sao chép, tự viết ≤ 300, XSS, CÙNG HỌ LỖI REVIEW A1 (tự hại → M20, bảng
        nhận diện đang mở mà sửa ô, "Vẫn giữ" sau khi sửa, "Bỏ đoạn đó", Lùi / Tiến / tải lại; chỉ gửi đúng chuỗi đã qua kiểm;
        DB + Web Storage không có chữ, người nhận, cảm xúc) (AC-23, 25, 33, 59)
     O  Chăm mình: bật / tắt, tick tay 'x', tự đánh dấu 'a' từ 'done' (stop / night / together), bỏ tick, 7 chấm, CSV thói quen,
        toast "Đã đánh dấu…" chỉ khi thật sự vừa đánh dấu (AC-60…63)
     P  Hành trình M17: nhóm ngày, mới nhất trên cùng, lọc, xóa bấm 2 lần, phân trang 40, sau tin buồn tên bài H1/H2 cất vào
        <details>, chữ tự viết ẩn, XSS, 3.000 bản ghi ≤ 1,5 s ở 4× CPU (AC-05, 19, 64)
     Q  R5 khi có A2: thẻ Cô đơn / chip "Giữa hai vợ chồng" → M09 có Ba câu cho nhau, Gửi lời, mở đúng màn riêng, không rỗng (PRD 8.3)
     R  "Không lưu gì" cho A2: không khóa, không DB, không cookie; M02 bỏ hai ô cũng vậy (AC-11, 24, 56)
     S  320 / 375 / 768 px, máy tối, vùng chạm ≥ 44, tương phản sáng + tối trên mọi màn A2 (AC-03, 07, 08, 22)
   Luồng chéo N-1 mở rộng cho A2 (bản ghi together + kv habits) nằm ở kịch bản L của tests/e2e.js (run() trong ca N-1 tổng quát).
   ========================================================= */
'use strict';

/* Gắn trước trang: rung giả (đếm), performance.now tua được (__ptick), ghi mọi toast */
const A2INIT = `(() => {
  window.__vib = []; try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: ms => { window.__vib.push(ms); return true; } }); } catch (e) {}
  const pn = performance.now.bind(performance); let po = 0; performance.now = () => pn() + po; window.__ptick = ms => { po += ms; };
  // Mỗi lần app gọi toast(): nội dung được viết lại (childList) rồi thêm class show → ghi một lần
  window.__toasts = [];
  document.addEventListener('DOMContentLoaded', () => { const t = document.getElementById('toast'); if (!t) return; let fresh = false;
    new MutationObserver(ms => { if (ms.some(m => m.type === 'childList')) fresh = true;
      if (fresh && t.classList.contains('show')) { fresh = false; const s = t.textContent.trim(); if (s) window.__toasts.push(s); } })
      .observe(t, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); });
})();`;
const NOSHARE = "try { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); } catch (e) {}";
const TOG_KEYS = 'at,day,exercise,id,kind,tz,v';
const TODAY = '2026-11-10';

/* UX 10.4 – 24 câu mẫu (nguyên văn đặc tả) */
const SW = {
  wife: ['Hôm nay em thấy nặng lòng. Tối nay mình ôm nhau một chút nhé.', 'Cảm ơn anh hôm nay đã ở cạnh em.', 'Em không cần anh nói gì đâu. Chỉ cần ngồi với em một lúc thôi.',
    'Em đang lo. Tối nay em kể anh nghe nhé.', 'Hôm nay em mệt. Em xin nghỉ một chút nhé.', 'Ai hỏi han chuyện nhà mình, anh trả lời giúp em nhé.',
    'Em biết anh cũng mệt. Mình cùng nghỉ một chút nhé.', 'Dù thế nào, em vẫn ở đây với anh.'],
  husband: ['Hôm nay anh thấy nặng lòng. Tối nay mình ngồi với nhau một chút nhé.', 'Cảm ơn em hôm nay đã ở cạnh anh.',
    'Anh ở đây. Em muốn kể thì anh nghe, chưa muốn thì mình ngồi im cũng được.', 'Anh cũng đang lo. Tối nay mình nói với nhau một chút nhé.',
    'Hôm nay em nghỉ đi, việc nhà để anh lo.', 'Ai hỏi han chuyện nhà mình, để anh trả lời.', 'Anh không biết nói gì cho đúng, nhưng anh thương em.',
    'Dù thế nào, anh vẫn ở đây với em.'],
  shared: ['Hôm nay mình thấy nặng lòng. Tối nay ngồi với mình một chút nhé.', 'Cảm ơn đã ở cạnh mình hôm nay.', 'Mình không cần lời khuyên đâu. Chỉ cần nghe mình một lúc thôi.',
    'Mình đang lo. Tối nay mình kể nghe nhé.', 'Hôm nay mình mệt. Mình xin nghỉ một chút nhé.', 'Ai hỏi han, trả lời giúp mình nhé.',
    'Mình không nói được nhiều, nhưng mình thương lắm.', 'Dù thế nào, mình vẫn ở đây.']
};

module.exports = function a2(ctx) {
  const { open, setup, T, section, sleep, CONTRAST, SEEN, F, path, SHOTS, want } = ctx;

  /* ===== tiện ích ===== */
  const openA2 = (tag, o = {}) => open(tag, Object.assign({}, o, { preInit: A2INIT + (o.noShare ? NOSHARE : '') + (o.preInit || '') }));
  const kd = (x, type, name) => {
    const m = { Space: [' ', 'Space', 32, ' '], Enter: ['Enter', 'Enter', 13, '\r'] }[name];
    return x.page.send('Input.dispatchKeyEvent', Object.assign({ type, key: m[0], code: m[1], windowsVirtualKeyCode: m[2], nativeVirtualKeyCode: m[2] },
      type === 'keyDown' ? { text: m[3], unmodifiedText: m[3] } : {}));
  };
  const mouse = async (x, sel, type) => { const { x: cx, y } = await x.page.center(sel); await x.page.send('Input.dispatchMouseEvent', { type, x: cx, y, button: 'left', clickCount: 1 }); };
  const vis = (x, sel) => x.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.closest('[hidden]')) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; })()`);
  const shares = x => x.ev('JSON.stringify((window.__share || []).map(s => s.text != null ? s.text : (s.url || "")).concat(window.__clip || []))').then(JSON.parse);
  const toasts = x => x.ev('JSON.stringify(window.__toasts || [])').then(JSON.parse);
  const retype = async (x, sel, text) => {
    await x.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); })()`);
    if (text) await x.page.type(text); else await x.page.key('Backspace');
    await sleep(80);
  };
  // Mọi thứ trên máy + bộ nhớ: DB, Web Storage, cookie, journal trong bộ nhớ, state.ui
  const everything = async x => JSON.stringify(await x.dbDump()) + '\n' + await x.ev("JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie])")
    + '\n' + await x.ev("JSON.stringify(HTDC_APP.S.journal.list())") + '\n' + await x.ev('JSON.stringify(HTDC_APP.S.exportJson ? HTDC_APP.S.exportJson() : "")');
  const togRecs = async x => ((await x.dbDump()).journal || []).filter(r => r.kind === 'together');
  const habitsToday = async x => (((await x.dbDump()).habits || []).find(h => h.day === TODAY) || { marks: {} }).marks;
  const memMarks = x => x.ev(`JSON.stringify((HTDC_APP.S.habits.get('${TODAY}') || {}).marks || {})`).then(JSON.parse);
  // Ghi thẳng vào IndexedDB (dữ liệu mẫu tất định) rồi tải lại trang
  const seedDB = async (x, { journal = [], habits = [] }) => {
    await x.ev(`new Promise((res, rej) => { const r = indexedDB.open('htdc_v1_db'); r.onsuccess = () => { const d = r.result, t = d.transaction(['journal', 'habits'], 'readwrite');
      const J = ${JSON.stringify(journal)}, H = ${JSON.stringify(habits)}; J.forEach(v => t.objectStore('journal').put(v)); H.forEach(v => t.objectStore('habits').put(v));
      t.oncomplete = () => { d.close(); res(1); }; t.onerror = () => rej(t.error); }; r.onerror = () => rej(r.error); })`);
    await x.go(); await x.wait('home');
  };
  const goTo = async (x, name, params) => { await x.ev(`HTDC_APP.go(${JSON.stringify(name)}, ${JSON.stringify(params || {})})`); return x.wait(name); };
  const ptickUntil = async (x, expr, max = 90) => { for (let i = 0; i < max; i++) { if (await x.ev(expr)) return true; await x.ev('__ptick(1000)'); await sleep(110); } return x.ev(expr); };
  const noTextInputs = x => x.ev("!document.querySelector('#main textarea, #main input[type=text], #main input:not([type]), #main [contenteditable=true]')");

  /* =====================================================================
     M. Hai ta: M15, C1, C2, C3
     ===================================================================== */
  async function scenarioM() {
    const x = await openA2('M-hai-ta', { shots: true }); const tg = '[M]';
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      T(`${tg} M05 có ô 🤝 Hai ta`, await x.has('#main .tile[data-go=together]'));
      await x.click('#main .tile[data-go=together]'); await x.wait('together'); await x.check('M15');
      const t15 = await x.text();
      T(`${tg} AC-56 M15 câu "Hai bạn ngồi cạnh nhau, dùng một điện thoại. Không có chữ hay cảm xúc nào được ghi lại." (U6)`,
        t15.includes('Hai bạn ngồi cạnh nhau, dùng một điện thoại. Không có chữ hay cảm xúc nào được ghi lại.'), t15.slice(0, 300));
      T(`${tg} M15: 4 bài (DỪNG 5 cho hai ta, Thở cùng nhịp, Ba câu cho nhau, Gửi lời cho người thương) + "Gửi link app" + dòng bản thử nghiệm (AC-34)`,
        ['DỪNG 5 cho hai ta', 'Thở cùng nhịp', 'Ba câu cho nhau', 'Gửi lời cho người thương', 'Gửi link app'].every(s => t15.includes(s)) && /Bản thử nghiệm/.test(t15), t15);
      T(`${tg} M15 (đang lưu): dòng "Chỉ ghi một dòng 'đã làm cùng nhau' vào Hành trình của mình."; vai Vợ → không dòng "Mình đi một mình"`,
        t15.includes('Chỉ ghi một dòng "đã làm cùng nhau" vào Hành trình của mình.') && !t15.includes('Những bài này làm cùng một người thương'), t15);
      T(`${tg} AC-56 M15 không ô gõ chữ`, await noTextInputs(x));
      await x.shot('M15');
      await x.click('#main [data-act=tgLink]', 300);
      const lk = await shares(x);
      T(`${tg} "Gửi link app": lời trung tính + link app (UX T-8, không in tên app)`, lk.length === 1 && lk[0].startsWith('Mình đang dùng một app nhỏ để dừng lại, thở và chăm lòng mình. Gửi bạn link nhé:')
        && lk[0].includes('https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/') && !lk[0].includes('Hành Trình Đón Con'), JSON.stringify(lk));

      /* ---------- C1 ---------- */
      await x.click('#main [data-act=tgStart]'); await x.wait('together_stop5'); await x.check('C1 chặng 1');
      const map = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main .jmap .jmap-node, #main .tg-map button')].map(b => ({ i: b.dataset.i, cur: b.getAttribute('aria-current'), l: b.getAttribute('aria-label') })))"));
      T(`${tg} AC-55 bản đồ 5 chặng, chặng 1 đang làm (aria-current), mỗi nút có tên chặng`, map.length === 5 && map[0].cur === 'step' && map.every(m => /Chặng \d/.test(m.l || '')), JSON.stringify(map));
      T(`${tg} C1 chặng 1: h1 "Chặng 1/5 · 🔔 Cùng dừng lại", focus h1`, /Chặng 1\/5/.test(await x.text('#main h1')) && /Cùng dừng lại/.test(await x.text('#main h1')) && await x.ev("document.activeElement === document.querySelector('#main h1')"), await x.text('#main h1'));
      T(`${tg} AC-35 (Hai ta) chân màn luôn có "Trở về thở tự nhiên" + "Mình thấy khó chịu"`, await vis(x, '#main [data-act=tgNatural]') && await vis(x, '#main [data-act=tgUneasy]'));
      T(`${tg} AC-02 chặng 1 có "Bỏ qua chặng này"`, await vis(x, '#main [data-act=tgSkip]'));
      T(`${tg} AC-56 C1 không ô gõ chữ`, await noTextInputs(x));
      await x.shot('C1-1');
      // Chuột: nhấn rồi thả ngay (một cú bấm) → chưa xong
      await x.click('#tg-bell', 200);
      T(`${tg} AC-57 bấm chuông một cái (không giữ) → chưa xong`, !(await vis(x, '#tg-next')));
      // Chuột: giữ 1 s (tua performance.now) rồi thả → chưa xong, vòng về 0, nhắc nhẹ
      await mouse(x, '#tg-bell', 'mouseMoved'); await mouse(x, '#tg-bell', 'mousePressed'); await sleep(80);
      await x.ev('__ptick(1100)'); await sleep(200);
      const mid = await x.ev("document.querySelector('#tg-bell-p, #main [role=progressbar]') ? document.querySelector('#tg-bell-p, #main [role=progressbar]').getAttribute('aria-valuenow') : ''");
      await mouse(x, '#tg-bell', 'mouseReleased'); await sleep(200);
      T(`${tg} AC-57 giữ chuột ~1 s: tiến độ đọc được (aria-valuenow 1), thả sớm → chưa xong, nhắc giữ lâu hơn`, mid === '1' && !(await vis(x, '#tg-next')) && /lâu hơn/.test(await x.text('#tg-msg')), mid + ' · ' + await x.text('#tg-msg'));
      // Chuột: giữ đủ 3 s → xong
      await mouse(x, '#tg-bell', 'mousePressed'); await sleep(80); await x.ev('__ptick(3050)'); await sleep(250); await mouse(x, '#tg-bell', 'mouseReleased'); await sleep(150);
      T(`${tg} AC-57 giữ chuột 3 s → "Hai bạn đã cùng dừng lại." + nút "Sang chặng 2 ›"`, (await x.text('#tg-msg')).includes('Hai bạn đã cùng dừng lại.') && await vis(x, '#tg-next') && /Sang chặng 2/.test(await x.text('#tg-next')), await x.text('#tg-box'));
      T(`${tg} AC-55 chặng 1 xong có ✓ (class done, nhãn "đã xong"), "Bỏ qua" ẩn`, await x.ev("(() => { const b = document.querySelector('#main .tg-map [data-i=\"0\"]'); return b.classList.contains('done') && /đã xong/.test(b.getAttribute('aria-label')); })()") && !(await vis(x, '#main [data-act=tgSkip]')));
      T(`${tg} UX 9 rung 30 ms khi xong chặng`, await x.ev('window.__vib.includes(30)'), await x.ev('JSON.stringify(window.__vib)'));
      // Chặng 2: thở cùng nhịp 6 vòng — xong thì đánh dấu chặng
      await x.click('#main [data-act=tgNext]'); await sleep(150);
      T(`${tg} C1 chặng 2: h1 "Chặng 2/5", quả cầu + dòng an toàn "Không nín hơi."`, /Chặng 2\/5/.test(await x.text('#main h1')) && await x.has('#tg-st .orb') && (await x.text()).includes('Không nín hơi.'), await x.text('#main h1'));
      await x.check('C1 chặng 2');
      await x.click('#tg-st #bplay', 200);
      T(`${tg} C1 chặng 2: "Vòng 1/6" (6 vòng 4 vào – 6 ra, PRD 6.6)`, /Vòng 1\/6/.test(await x.text('#tg-st #remain')), await x.text('#tg-st #remain'));
      const s2ok = await ptickUntil(x, "!document.querySelector('#tg-next').hidden", 90);
      T(`${tg} C1 chặng 2 chạy đủ 6 vòng → chặng xong, nút "Sang chặng 3 ›"`, s2ok && /Sang chặng 3/.test(await x.text('#tg-next')), await x.text('#tg-st'));
      // Bỏ qua chặng 3 → chặng 4; chặng 3 mờ
      await x.click('#main [data-act=tgNext]'); await sleep(100);
      await x.click('#main [data-act=tgSkip]'); await sleep(150);
      const sk = JSON.parse(await x.ev("JSON.stringify((() => { const b = document.querySelector('#main .tg-map [data-i=\"2\"]'), s = getComputedStyle(b); return { c: b.className, l: b.getAttribute('aria-label'), o: +s.opacity, bs: s.borderStyle }; })())"));
      T(`${tg} AC-55 bỏ qua chặng 3 → sang chặng 4; chặng 3 mờ (class skipped, nhãn "đã bỏ qua", mờ hoặc viền đứt)`, /Chặng 4\/5/.test(await x.text('#main h1')) && /skipped/.test(sk.c) && /bỏ qua/.test(sk.l) && (sk.o < 1 || /dashed/.test(sk.bs)), JSON.stringify(sk));
      // Nhảy tự do về chặng 3 bằng bản đồ: lật thẻ, không lưu
      await x.click('#main .tg-map [data-i="2"]'); await sleep(150);
      T(`${tg} AC-55 chạm bản đồ → nhảy về chặng 3`, /Chặng 3\/5/.test(await x.text('#main h1')), await x.text('#main h1'));
      await x.check('C1 chặng 3');
      const n3 = await x.ev("document.querySelectorAll('#tg-flip [data-capy]').length");
      T(`${tg} C1 chặng 3: lưới thẻ capybara (${n3} thẻ), "Người thứ nhất"`, n3 >= 9 && /Người thứ nhất/.test(await x.text('#tg-flip')), n3);
      await x.click('#tg-flip [data-capy=lo_lang]'); await x.click('#tg-flip [data-capy=met_moi]');
      T(`${tg} C1 chặng 3: mỗi người chọn MỘT thẻ (tối đa một thẻ được chọn)`, await x.ev("document.querySelectorAll('#tg-flip [data-capy][aria-pressed=true]').length") <= 1);
      const p1 = await x.ev("(document.querySelector('#tg-flip [data-capy][aria-pressed=true]') || {}).dataset ? document.querySelector('#tg-flip [data-capy][aria-pressed=true]').dataset.capy : ''");
      await x.click('#tg-fb', 200);
      T(`${tg} C1 chặng 3 "Úp thẻ" → màn chắn "Đến lượt người thứ hai…", thẻ lượt 1 không còn trên màn`, /Đến lượt người thứ hai/.test(await x.text('#tg-flip')) && !(await x.has('#tg-flip [data-capy]')), await x.text('#tg-flip'));
      await x.click('#tg-fb', 200);
      T(`${tg} C1 chặng 3 lượt 2: lưới mới, chưa chọn gì`, (await x.text('#tg-flip')).includes('Người thứ hai') && await x.ev("!document.querySelector('#tg-flip [aria-pressed=true]')"));
      await x.click('#tg-flip [data-capy=co_don]'); await x.click('#tg-fb', 250);
      const rv = await x.text('#tg-flip');
      T(`${tg} C1 chặng 3 "Lật cho nhau xem": hai thẻ cạnh nhau + "Đây là lòng hai bạn lúc này. Không cần giống nhau."`, /Cô đơn/.test(rv) && rv.includes('Không cần giống nhau.'), rv);
      T(`${tg} AC-56 thẻ cảm xúc chặng 3 KHÔNG nằm trong state.ui / DB`, !new RegExp(`${p1 || 'lo_lang'}|co_don`).test(await x.ev('JSON.stringify(HTDC_APP.state.ui)') + JSON.stringify(await x.dbDump())), await x.ev('JSON.stringify(HTDC_APP.state.ui)'));
      // Chặng 4: nói – nghe
      await x.click('#main [data-act=tgNext]'); await sleep(150);
      await x.check('C1 chặng 4');
      await x.click('#tg-talk [data-q="2"]');
      await x.click('#tg-talk [data-tk=go]', 700);
      const t4 = await x.text('#tg-talk');
      T(`${tg} AC-58 chặng 4 lượt 1: "Còn khoảng 2 phút" (role=timer), câu đã chọn, luật "chỉ nghe, không sửa, không khuyên", "Cảm ơn đã kể cho mình nghe."`,
        (await x.text('#tg-left')) === 'Còn khoảng 2 phút' && await x.has('#tg-talk [role=timer]') && t4.includes('Một điều mình trân trọng ở người kia là…') && /không sửa, không khuyên/.test(t4) && t4.includes('Cảm ơn đã kể cho mình nghe.'), t4);
      await x.ev('__tick(125000)'); await sleep(800);
      T(`${tg} AC-58 hết 2 phút: "Hết hai phút rồi…", KHÔNG tự đổi lượt`, (await x.text('#tg-up')).includes('Hết hai phút rồi.') && /Lượt 1/.test(await x.text('#tg-turn')), await x.text('#tg-talk'));
      await x.click('#tg-talk [data-tk=swap]', 300); await x.click('#tg-talk [data-tk=done]', 300);
      T(`${tg} C1 chặng 4 xong 2 lượt → chặng 5, chặng 4 ✓`, /Chặng 5\/5/.test(await x.text('#main h1')) && await x.ev("document.querySelector('#main .tg-map [data-i=\"3\"]').classList.contains('done')"));
      await x.check('C1 chặng 5'); await x.shot('C1-5');
      T(`${tg} C1 chặng 5: gợi ý câu tử tế chỉ để đọc, không ô gõ`, (await x.text()).includes('Cảm ơn đã đi cùng mình.') && await noTextInputs(x));
      await x.click('#main [data-heart="0"]', 300);
      T(`${tg} C1 chặng 5: một tim vào hũ → chưa xong`, !(await vis(x, '#tg-next')));
      await x.click('#main [data-heart="1"]', 300);
      T(`${tg} C1 chặng 5: hai tim → xong, nút "Xong ›"`, await vis(x, '#tg-next'));
      T(`${tg} AC-56 chưa tới màn kết thì chưa ghi bản ghi Hai ta`, (await togRecs(x)).length === 0);
      await x.click('#main [data-act=tgNext]', 400);
      const te = await x.text();
      T(`${tg} AC-55 màn kết "Hai bạn đã dành mười phút cho nhau." "Chừng đó là đủ cho hôm nay." + link "Gửi một lời cho nhau 💌"`,
        te.includes('Hai bạn đã dành mười phút cho nhau.') && te.includes('Chừng đó là đủ cho hôm nay.') && await x.has('#main [data-go=send_words]'), te);
      T(`${tg} AC-04 màn kết không pháo hoa (không canvas)`, !(await x.has('canvas')));
      await x.check('C1 màn kết'); await sleep(300);
      let tr = await togRecs(x);
      T(`${tg} AC-56 DB: đúng 1 bản ghi together, ĐÚNG 7 trường {v,kind,id,at,day,tz,exercise}, exercise C1, day ${TODAY}`,
        tr.length === 1 && Object.keys(tr[0]).sort().join() === TOG_KEYS && tr[0].v === 1 && tr[0].exercise === 'C1' && tr[0].day === TODAY && tr[0].tz === 420, JSON.stringify(tr));
      T(`${tg} AC-56 DB không có cảm xúc / câu nói / lượt của Hai ta`, !/lo_lang|met_moi|co_don|trân trọng|Lượt|turn/.test(JSON.stringify(await x.dbDump())), JSON.stringify(await x.dbDump()).slice(0, 300));
      T(`${tg} AC-62 xong bài Hai ta → thói quen connect tự đánh dấu 'a'`, (await habitsToday(x)).connect === 'a', JSON.stringify(await habitsToday(x)));
      // Lùi / Tiến lại màn kết → không thêm bản ghi
      await x.ev('history.back()'); await sleep(400); await x.ev('history.forward()'); await sleep(500);
      T(`${tg} AC-56 Lùi / Tiến lại màn kết: vẫn 1 bản ghi (tối đa một bản ghi mỗi lượt)`, (await togRecs(x)).length === 1, (await togRecs(x)).length);
      // Lượt mới: bỏ qua hết → vẫn tới màn kết, KHÔNG ghi
      await goTo(x, 'together'); await x.click('#main [data-act=tgStart]'); await x.wait('together_stop5');
      T(`${tg} lượt mới từ M15 → chặng 1, bản đồ sạch`, /Chặng 1\/5/.test(await x.text('#main h1')) && !(await x.has('#main .tg-map .done, #main .tg-map .skipped')));
      for (let i = 0; i < 5; i++) await x.click('#main [data-act=tgSkip]', 150);
      T(`${tg} AC-55 bỏ qua cả 5 chặng → vẫn tới màn kết`, (await x.text()).includes('Hai bạn đã dành mười phút cho nhau.'));
      T(`${tg} AC-56 bỏ qua hết (không làm chặng nào) → không thêm bản ghi`, (await togRecs(x)).length === 1, (await togRecs(x)).length);
      // Bàn phím: Space giữ 3 s → xong; Enter thả sớm → chưa; link "Khó nhấn giữ?"
      await goTo(x, 'together'); await x.click('#main [data-act=tgStart]'); await x.wait('together_stop5');
      T(`${tg} chuông nằm trong thứ tự Tab (là button, tabIndex 0)`, await x.ev("(() => { const b = document.querySelector('#tg-bell'); return b.tagName === 'BUTTON' && b.tabIndex === 0; })()"));
      await x.ev("document.querySelector('#tg-bell').focus()");
      await kd(x, 'keyDown', 'Enter'); await sleep(80); await x.ev('__ptick(1500)'); await sleep(200); await kd(x, 'keyUp', 'Enter'); await sleep(150);
      T(`${tg} AC-57 giữ Enter 1,5 s rồi thả → chưa xong`, !(await vis(x, '#tg-next')));
      await x.ev("document.querySelector('#tg-bell').focus()");
      await kd(x, 'keyDown', 'Space'); await sleep(80); await x.ev('__ptick(3050)'); await sleep(250); await kd(x, 'keyUp', 'Space'); await sleep(150);
      T(`${tg} AC-57 giữ phím Space 3 s → xong chặng 1`, await vis(x, '#tg-next') && (await x.text('#tg-msg')).includes('Hai bạn đã cùng dừng lại.'));
      await goTo(x, 'together'); await x.click('#main [data-act=tgStart]'); await x.wait('together_stop5');
      await x.ev("document.querySelector('#tg-bell').focus()");
      await kd(x, 'keyDown', 'Enter'); await sleep(80); await x.ev('__ptick(3050)'); await sleep(250); await kd(x, 'keyUp', 'Enter'); await sleep(150);
      T(`${tg} AC-57 giữ phím Enter 3 s → xong chặng 1`, await vis(x, '#tg-next'));
      await goTo(x, 'together'); await x.click('#main [data-act=tgStart]'); await x.wait('together_stop5');
      T(`${tg} AC-57 link "Khó nhấn giữ? Chạm vào đây"`, (await x.text('#tg-easy')).trim() === 'Khó nhấn giữ? Chạm vào đây', await x.text('#tg-easy'));
      await x.click('#tg-easy', 200);
      T(`${tg} AC-57 chạm "Khó nhấn giữ?" → xong chặng 1`, await vis(x, '#tg-next') && (await x.text('#tg-msg')).includes('Hai bạn đã cùng dừng lại.'));
      // L10 / L11 trong C1 (chặng 2 đang thở)
      await x.click('#main [data-act=tgNext]'); await x.click('#tg-st #bplay', 300);
      await x.click('#main [data-act=tgNatural]', 300);
      T(`${tg} AC-35 (Hai ta) "Trở về thở tự nhiên" → lớp thở tự nhiên, thân bài ẩn`, await vis(x, '.st-calm') && !(await vis(x, '#tg-box')), await x.text());
      await x.click('.st-calm [data-calm=resume]', 200);
      await x.click('#main [data-act=tgUneasy]', 300);
      const un = await x.text('.st-calm');
      T(`${tg} AC-35 "Mình thấy khó chịu" → lớp L11 có Hỗ trợ, không chữ {xung} thô`, await x.has('.st-calm.uneasy [data-go=support]') && !/\{/.test(un), un);
      await x.click('.st-calm [data-calm=end]', 300);
      T(`${tg} L11 nút kết → về M15`, await x.wait('together'), await x.scr());

      /* ---------- C2 ---------- */
      await x.click('#main [data-go=together_breathe]'); await x.wait('together_breathe'); await x.check('C2');
      T(`${tg} C2: chọn 3 / 6 / 10 vòng, mặc định 6; dòng an toàn "Không nín hơi."`, await x.ev("['3','6','10'].every(n => !!document.querySelector('#main [data-rounds=\"' + n + '\"]')) && document.querySelector('#main [data-rounds=\"6\"]').getAttribute('aria-pressed') === 'true'")
        && (await x.text()).includes('Không nín hơi.'));
      T(`${tg} AC-56 C2 không ô gõ chữ`, await noTextInputs(x));
      await x.click('#main [data-rounds="3"]', 150); await x.click('#tg-pl #bplay', 200);
      T(`${tg} C2 3 vòng: "Vòng 1/3"`, /Vòng 1\/3/.test(await x.text('#tg-pl #remain')), await x.text('#tg-pl #remain'));
      const c2ok = await ptickUntil(x, "!!document.querySelector('#tg-pl #bend [data-pfin]')", 80);
      T(`${tg} C2 đủ 3 vòng → nút xong`, c2ok, await x.text('#tg-pl'));
      await sleep(300);
      tr = await togRecs(x);
      T(`${tg} AC-56 C2 xong → thêm đúng 1 bản ghi C2, 7 trường`, tr.filter(r => r.exercise === 'C2').length === 1 && tr.every(r => Object.keys(r).sort().join() === TOG_KEYS), JSON.stringify(tr));
      await x.click('#tg-pl #bend [data-pfin]', 300);
      T(`${tg} C2 màn kết "Hai bạn vừa thở cùng nhau." "Vậy là đủ rồi."`, (await x.text()).includes('Hai bạn vừa thở cùng nhau.') && (await x.text()).includes('Vậy là đủ rồi.'));

      /* ---------- C3 ---------- */
      await goTo(x, 'together'); await x.click('#main [data-go=together_talk]'); await x.wait('together_talk'); await x.check('C3');
      const t3 = await x.text();
      T(`${tg} C3: "Chọn một câu. Một người nói, người kia chỉ nghe." + đúng 3 câu của PRD 6.6`, t3.includes('Chọn một câu. Một người nói, người kia chỉ nghe.')
        && ['Hôm nay điều làm mình nặng lòng nhất là…', 'Lúc này mình cần ở người kia một điều là…', 'Một điều mình trân trọng ở người kia là…'].every(q => t3.includes(q))
        && await x.ev("document.querySelectorAll('#tg-talk [role=radio]').length") === 3, t3);
      T(`${tg} AC-56 C3 không ô gõ chữ`, await noTextInputs(x));
      const ac0 = await x.ev('window.__ac || 0');
      await x.click('#tg-talk [data-tk=go]', 600);
      T(`${tg} AC-58 C3 lượt 1 "Còn khoảng 2 phút", nút "Đổi lượt ›"`, (await x.text('#tg-left')) === 'Còn khoảng 2 phút' && /Đổi lượt/.test(await x.text('#tg-talk [data-tk=swap]')), await x.text('#tg-talk'));
      await x.ev('__tick(61000)'); await sleep(700);
      T(`${tg} AC-58 sau 61 s: "Còn khoảng 1 phút" (không đếm giây lớn)`, (await x.text('#tg-left')) === 'Còn khoảng 1 phút', await x.text('#tg-left'));
      // Thở tự nhiên giữa lượt → hẹn giờ dừng
      await x.click('#main [data-act=tgNatural]', 200); await x.ev('__tick(130000)'); await sleep(700); await x.click('.st-calm [data-calm=resume]', 700);
      T(`${tg} C3 "Trở về thở tự nhiên" giữa lượt → hẹn giờ dừng, tiếp tục vẫn còn giờ`, !(await x.text('#tg-up')) && /^Còn khoảng/.test(await x.text('#tg-left')), await x.text('#tg-talk'));
      const v0 = await x.ev('window.__vib.length');
      await x.ev('__tick(61000)'); await sleep(800);
      T(`${tg} AC-58 hết giờ: chữ "Hết hai phút rồi. Đổi lượt khi hai bạn sẵn sàng nhé.", rung nhẹ 30 ms`, (await x.text('#tg-up')).includes('Hết hai phút rồi. Đổi lượt khi hai bạn sẵn sàng nhé.') && await x.ev(`window.__vib.slice(${v0}).includes(30)`), await x.text('#tg-talk') + ' vib ' + await x.ev('JSON.stringify(window.__vib)'));
      T(`${tg} AC-58 hết giờ KHÔNG tự chuyển lượt (vẫn "Lượt 1" sau thêm 2 phút)`, await (async () => { await x.ev('__tick(120000)'); await sleep(700); return /Lượt 1/.test(await x.text('#tg-turn')); })());
      T(`${tg} AC-58 chuông nhẹ tắt sẵn → hết giờ không tạo âm thanh`, (await x.ev('window.__ac || 0')) === ac0, await x.ev('window.__ac'));
      await x.click('#tg-talk [data-tk=swap]', 400);
      T(`${tg} AC-58 "Đổi lượt" → Lượt 2, đếm lại 2 phút`, /Lượt 2/.test(await x.text('#tg-turn')) && (await x.text('#tg-left')) === 'Còn khoảng 2 phút' && !(await x.text('#tg-up')), await x.text('#tg-talk'));
      // Bật chuông → chỉ tạo âm thanh sau cú chạm; hết giờ có chuông
      await x.click('#tg-talk [data-bell]', 200);
      T(`${tg} AC-58 bật "Chuông nhẹ khi hết giờ" (aria-pressed)`, await x.ev("document.querySelector('#tg-talk [data-bell]').getAttribute('aria-pressed')") === 'true');
      await x.click('#tg-talk [data-tk=done]', 400);
      T(`${tg} C3 Xong → màn kết "Hai bạn vừa nói và nghe nhau."`, (await x.text()).includes('Hai bạn vừa nói và nghe nhau.'));
      await sleep(300);
      tr = await togRecs(x);
      T(`${tg} AC-56 C3 → đúng 1 bản ghi C3, mọi bản ghi together đúng 7 trường; không câu nói trong DB`, tr.filter(r => r.exercise === 'C3').length === 1 && tr.every(r => Object.keys(r).sort().join() === TOG_KEYS)
        && !/nặng lòng nhất|trân trọng|cần ở người kia/.test(JSON.stringify(await x.dbDump())), JSON.stringify(tr));
      // Rời màn khi lượt đang chạy → không rung sau đó
      await x.goHome(); await goTo(x, 'together_talk'); await x.click('#tg-talk [data-tk=go]', 200); await x.goHome();
      const v1 = await x.ev('window.__vib.length'); await x.ev('__tick(200000)'); await sleep(1200);
      T(`${tg} C3 rời màn giữa lượt → hẹn giờ dọn, không rung sau khi rời`, await x.ev('window.__vib.length') === v1);
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }

    // Vai Chồng: M15 không dòng "một mình"; vai solo: có dòng
    const y = await openA2('M-solo'); const ty = '[M-solo]';
    try {
      await setup(y, { mode: 'local', role: 'solo', stage: 'pause' });
      await goTo(y, 'together');
      T(`${ty} vai "Mình đi một mình": M15 có dòng "Những bài này làm cùng một người thương hoặc người đồng hành. Gửi lời thì làm một mình được."`,
        (await y.text()).includes('Những bài này làm cùng một người thương hoặc người đồng hành. Gửi lời thì làm một mình được.'), await y.text());
      await y.noErr();
    } catch (e) { T(`${ty} chạy hết`, false, e.stack); } finally { await y.close(); }
  }

  /* =====================================================================
     N. C4 Gửi lời cho người thương — cùng họ lỗi review A1
     ===================================================================== */
  async function scenarioN(noShare) {
    const tag = noShare ? 'N-copy' : 'N-share', tg = `[${tag}]`;
    const x = await openA2(tag, { noShare, preInit: SEEN });
    const BADS = 'Mình muốn chết cho xong';
    const LEAK = /muốn chết|0912345678|0987654321|Trần Minh Quân|Tối nay ôm em|onerror|mã IVF|ngồi với nhau đi/;
    const accepted = new Set(Object.values(SW).flat());
    const sentOk = async label => { const s = await shares(x); T(`${tg} ${label}: mọi lời đã gửi / sao chép đều là câu mẫu hoặc chuỗi đã qua kiểm`, s.every(v => accepted.has(v) || /^Mình đang dùng một app nhỏ/.test(v)), JSON.stringify(s)); };
    const nShare = async () => (await shares(x)).length;
    const toOwn = async () => { if (await x.scr() !== 'send_words') await goTo(x, 'send_words'); await x.click('#tg-t1', 120); };
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
      await goTo(x, 'together'); await x.click('#main [data-go=send_words]'); await x.wait('send_words'); await x.check('M15d câu có sẵn');
      const W = JSON.parse(await x.ev('JSON.stringify(HTDC_APP.D.SEND_WORDS)'));
      T(`${tg} AC-59 24 câu mẫu đúng nguyên văn UX 10.4 (8 × 3 bộ: em / anh / mình)`, ['wife', 'husband', 'shared'].every(k => JSON.stringify(W[k]) === JSON.stringify(SW[k])), JSON.stringify(W).slice(0, 300));
      const conHit = Object.values(W).filter(Array.isArray).flat().filter(s => /(^|[\s,.!?…])con([\s,.!?…]|$)/i.test(s));
      T(`${tg} PRD 6.6 / UX T-6 không câu mẫu nào có chữ "con"`, !conHit.length, conHit.join(' | '));
      T(`${tg} AC-59 vai Vợ → chip "Mình xưng" mặc định "em", 8 câu, câu 1 hiện nguyên văn`, await x.ev("document.querySelector('#main [data-pron=wife]').getAttribute('aria-checked')") === 'true'
        && await x.ev("document.querySelectorAll('#tg-pre [role=radio]').length") === 8 && (await x.text('#tg-pvt')) === SW.wife[0], await x.text('#tg-pvt'));
      T(`${tg} M15d dòng "App không biết, không lưu người nhận." + nút ${noShare ? '"Sao chép lời này"' : '"Gửi qua ứng dụng nhắn tin ›"'}`,
        (await x.text()).includes('App không biết, không lưu người nhận.') && (await x.text('#tg-send')).includes(noShare ? 'Sao chép lời này' : 'Gửi qua ứng dụng nhắn tin'), await x.text('#tg-send'));
      await x.click('#main [data-pron=husband]'); await x.click('#tg-pre [data-pick="3"]');
      T(`${tg} đổi xưng "anh", chọn câu 4 → nguyên văn đúng câu 4 bộ chồng`, (await x.text('#tg-pvt')) === SW.husband[3], await x.text('#tg-pvt'));
      await x.click('#tg-send', 300);
      const s1 = await shares(x);
      T(`${tg} AC-59 ${noShare ? 'không có navigator.share → sao chép' : 'có navigator.share → bảng chia sẻ'} ĐÚNG nguyên văn đã xem`, s1.length === 1 && s1[0] === SW.husband[3], JSON.stringify(s1));
      if (noShare) T(`${tg} AC-59 toast "Đã sao chép."`, (await toasts(x)).some(t => t.includes('Đã sao chép.')), JSON.stringify(await toasts(x)));

      /* --- Tự viết --- */
      await toOwn(); await x.check('M15d tự viết');
      T(`${tg} tab Tự viết: ô ≤ 300 ký tự, dòng "Chữ này không lưu. Rời trang là mất.", chưa có nguyên văn, nút gửi aria-disabled`,
        await x.ev("document.querySelector('#tg-ta').maxLength") === 300 && (await x.text()).includes('Chữ này không lưu. Rời trang là mất.') && !(await vis(x, '#tg-pv'))
        && await x.ev("document.querySelector('#tg-send').getAttribute('aria-disabled')") === 'true');
      let n0 = await nShare();
      await x.click('#tg-send', 200);
      T(`${tg} bấm gửi khi chưa "Xem lại" → nhắc "Bấm 'Xem lại'…", không gửi`, await vis(x, '#tg-need') && await nShare() === n0);
      await x.click('#tg-rv', 200);
      T(`${tg} AC-02 "Xem lại" khi ô trống → nhắc nhẹ, không bắt buộc (vẫn chọn câu có sẵn được)`, (await x.text('#tg-em')).includes('Viết vài chữ trước nhé'), await x.text('#tg-em'));
      await retype(x, '#tg-ta', 'a'.repeat(320));
      T(`${tg} AC-59 tự viết ≤ 300 ký tự (gõ 320 → còn 300, bộ đếm 300/300)`, await x.ev("document.querySelector('#tg-ta').value.length") === 300 && /300\/300/.test(await x.text('#tg-cnt')), await x.text('#tg-cnt'));
      // XSS
      const XSS = '<img src=x onerror="window.__xss=1">Tối nay ôm em nhé';
      await retype(x, '#tg-ta', XSS); await x.click('#tg-rv', 250);
      T(`${tg} AC-05 XSS: nguyên văn hiện đúng chữ, không có <img>, không chạy`, (await x.text('#tg-pvt')) === XSS && !(await x.has('#tg-pv img')) && !(await x.ev('window.__xss')), await x.text('#tg-pvt'));
      accepted.add(XSS);
      await x.click('#tg-send', 300);
      T(`${tg} AC-59 gửi đúng chuỗi đã xem (kể cả ký tự đặc biệt)`, (await shares(x)).slice(-1)[0] === XSS, JSON.stringify((await shares(x)).slice(-1)));
      // Sửa ô sau khi đã xem lại → mất bản xem lại, gửi bị chặn
      await x.click('#tg-ta'); await x.page.type(' thêm'); await sleep(100);
      n0 = await nShare(); await x.click('#tg-send', 250);
      T(`${tg} sửa ô sau khi "Xem lại" → bản xem lại mất, bấm gửi không gửi chữ chưa kiểm`, !(await vis(x, '#tg-pv')) && await nShare() === n0, await x.text('#tg-pv'));

      /* --- Tự hại → M20 trước mọi thứ --- */
      await x.ev('(window.__seen = [], window.__piiN = 0, 1)');
      await retype(x, '#tg-ta', BADS + ' 0912345678'); await x.click('#tg-rv', 350);
      T(`${tg} AC-25 câu tự hại (kèm SĐT) → M20 TRƯỚC bảng nhận diện`, await x.wait('urgent') && await x.ev('window.__piiN') === 0, await x.scr() + ' pii ' + await x.ev('window.__piiN'));
      await x.check('M20 từ Gửi lời');
      await x.click('#main [data-act=urgentSafe]', 350);
      T(`${tg} M20 "chỉ là cách nói" → về Gửi lời, ô trống, không nguyên văn câu tự hại, không gửi`, await x.wait('send_words') && await x.ev("document.querySelector('#tg-ta').value") === ''
        && !(await x.text('#tg-pvt')).includes('muốn chết') && !(await shares(x)).some(s => /muốn chết/.test(s)), await x.text());

      /* --- Họ lỗi review: bảng nhận diện đang mở mà sửa ô thành câu tự hại --- */
      await toOwn(); await x.ev('(window.__seen = [], 1)');
      await retype(x, '#tg-ta', 'Gọi chồng mình anh Trần Minh Quân 0912345678 nhé'); await x.click('#tg-rv', 250);
      T(`${tg} AC-33 SĐT + tên → bảng nhận diện (sửa / bỏ / vẫn giữ + "Bộ lọc không thể phát hiện mọi thông tin."), chưa có nguyên văn`,
        await x.has('#tg-pii .pii-panel [data-pii=keep]') && await x.has('#tg-pii [data-pii=drop]') && await x.has('#tg-pii [data-pii=edit]') && /Bộ lọc không thể phát hiện mọi thông tin/.test(await x.text('#tg-pii')) && !(await vis(x, '#tg-pv')), await x.text('#tg-pii'));
      n0 = await nShare(); await x.click('#tg-send', 200);
      T(`${tg} bảng nhận diện đang mở, bấm nút gửi ở dưới → không gửi gì`, await nShare() === n0);
      await retype(x, '#tg-ta', BADS);
      const how1 = await x.has('#tg-pii [data-pii=keep]') ? (await x.click('#tg-pii [data-pii=keep]', 350), 'Vẫn giữ') : (await x.click('#tg-rv', 350), 'bảng đã đóng → Xem lại');
      T(`${tg} bảng đang mở, sửa ô thành câu tự hại rồi ${how1} → M20; không hiện / gửi câu tự hại`, await x.wait('urgent') && !(await shares(x)).some(s => /muốn chết/.test(s)), await x.scr());
      await x.click('#main [data-act=urgentSafe]', 350); await x.wait('send_words');
      /* --- Bảng đang mở, sửa thành SĐT khác rồi "Vẫn giữ" → phải kiểm lại --- */
      await toOwn(); await x.ev('(window.__piiN = 0, 1)');
      await retype(x, '#tg-ta', 'Gọi số 0912345678 nhé'); await x.click('#tg-rv', 250);
      await retype(x, '#tg-ta', 'Gọi số 0987654321 nhé');
      let how2 = 'Vẫn giữ';
      if (await x.has('#tg-pii [data-pii=keep]')) await x.click('#tg-pii [data-pii=keep]', 300); else { how2 = 'bảng đã đóng → Xem lại'; await x.click('#tg-rv', 300); }
      const pv2 = (await vis(x, '#tg-pv')) ? await x.text('#tg-pvt') : '';
      T(`${tg} bảng đang mở, sửa thành SĐT khác, ${how2} → bảng nhận diện hiện LẠI cho SĐT mới (không đi thẳng ra nguyên văn), không còn SĐT cũ`,
        await x.has('#tg-pii [data-pii=keep]') && /0987654321/.test(await x.text('#tg-pii')) && !pv2.includes('0912345678') && !pv2.includes('0987654321'), `pii=${await x.text('#tg-pii')} pv=${pv2}`);
      await x.click('#tg-pii [data-pii=keep]', 300);
      T(`${tg} "Vẫn giữ" lần này (ô không đổi) → nguyên văn đúng chuỗi mới`, (await x.text('#tg-pvt')) === 'Gọi số 0987654321 nhé', await x.text('#tg-pvt'));
      accepted.add('Gọi số 0987654321 nhé');
      // "Vẫn giữ" sau khi ô đổi KHÔNG qua bàn phím (sự kiện input không bắn) → vẫn phải kiểm lại chữ mới
      await retype(x, '#tg-ta', 'Gọi số 0912345678 nhé'); await x.click('#tg-rv', 250);
      await x.ev("document.querySelector('#tg-ta').value = '" + BADS + "'");
      await x.click('#tg-pii [data-pii=keep]', 350);
      T(`${tg} ô bị đổi mà bảng còn mở, "Vẫn giữ" → kiểm lại chữ đang có trong ô (tự hại → M20), không gửi chữ cũ`, await x.wait('urgent') && !(await shares(x)).some(s => /0912345678|muốn chết/.test(s)), await x.scr());
      await x.click('#main [data-act=urgentSafe]', 350); await x.wait('send_words');
      /* --- "Bỏ đoạn đó" --- */
      await toOwn();
      await retype(x, '#tg-ta', 'Mai mình đi khám, gọi số 0912345678 nhé'); await x.click('#tg-rv', 250);
      await x.click('#tg-pii [data-pii=drop]', 350);
      const dv = await x.ev("document.querySelector('#tg-ta').value"), dp = (await vis(x, '#tg-pv')) ? await x.text('#tg-pvt') : '';
      T(`${tg} AC-33 "Bỏ đoạn đó" → ô và nguyên văn (nếu có) không còn SĐT`, !/0912345678/.test(dv + dp), dv + ' | ' + dp);
      if (!dp) await x.click('#tg-rv', 250);
      const dp2 = await x.text('#tg-pvt'); accepted.add(dp2);
      await x.click('#tg-send', 300);
      T(`${tg} gửi sau "Bỏ đoạn đó" → lời gửi không có SĐT, đúng nguyên văn đang hiện`, (await shares(x)).slice(-1)[0] === dp2 && !/0912345678/.test(dp2), JSON.stringify((await shares(x)).slice(-1)));
      /* --- Bảng đang mở, chuyển sang "Câu có sẵn" rồi gửi → chỉ câu mẫu --- */
      await retype(x, '#tg-ta', 'Gọi chồng mình anh Trần Minh Quân nhé'); await x.click('#tg-rv', 250);
      await x.click('#tg-t0', 150); await x.click('#tg-pre [data-pick="1"]'); await x.click('#tg-send', 300);
      T(`${tg} bảng đang mở, sang tab "Câu có sẵn" và gửi → chỉ gửi câu mẫu, không chữ tự viết`, (await shares(x)).slice(-1)[0] === (await x.text('#tg-pvt')) && accepted.has((await shares(x)).slice(-1)[0]), JSON.stringify((await shares(x)).slice(-1)));
      /* --- Lùi / Tiến / tải lại --- */
      await toOwn(); await retype(x, '#tg-ta', 'Tối nay mình ngồi với nhau đi'); await x.click('#tg-rv', 250);
      await x.click('#header [data-act=back]', 350); await x.ev('history.forward()'); await x.wait('send_words'); await sleep(200);
      T(`${tg} Lùi rồi Tiến lại Gửi lời: ô trống, không nguyên văn tự viết cũ`, await x.ev("document.querySelector('#tg-ta').value") === '' && !(await x.text('#tg-pvt')).includes('ngồi với nhau đi'), await x.text('#tg-pvt'));
      await toOwn(); await retype(x, '#tg-ta', BADS);
      await x.click('#header [data-act=back]', 350);
      T(`${tg} gõ câu tự hại, KHÔNG "Xem lại", bấm ‹ → rời màn, không gửi`, await x.scr() !== 'send_words' && !(await shares(x)).some(s => /muốn chết/.test(s)), await x.scr());
      await x.ev('history.forward()'); await x.wait('send_words'); await sleep(150);
      T(`${tg} … rồi Tiến lại: ô trống`, await x.ev("document.querySelector('#tg-ta').value") === '');
      await toOwn(); await retype(x, '#tg-ta', 'mã IVF 2611234 gọi 0912345678'); await x.click('#tg-rv', 250);
      await x.go(); await sleep(200);
      T(`${tg} tải lại khi bảng nhận diện đang mở → không ở lại màn có chữ cũ; không gì lưu`, !(await x.has('#tg-ta')) || await x.ev("document.querySelector('#tg-ta').value") === '', await x.scr());
      await sleep(400);
      const all = await everything(x);
      T(`${tg} AC-23 / AC-59 DB + localStorage + sessionStorage + cookie + bộ nhớ + JSON xuất KHÔNG có chữ Gửi lời, người nhận, SĐT, tên`, !LEAK.test(all), (all.match(LEAK) || [''])[0] + ' … ' + all.slice(0, 300));
      T(`${tg} AC-59 không bản ghi nào về Gửi lời (không kind/trường người nhận, không C4)`, !/"C4"|recipient|nguoi_nhan|send_words|SEND_WORDS/.test(JSON.stringify(await x.dbDump())), JSON.stringify((await x.dbDump()).journal));
      T(`${tg} AC-23 không lưu cờ tự hại / đã mở M20`, !/self_harm|urgent|not_alone/.test(JSON.stringify(await x.dbDump())));
      await sentOk('tổng kết');
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* =====================================================================
     O. Chăm mình hôm nay (M16) + markHabit
     ===================================================================== */
  async function scenarioO() {
    const x = await openA2('O-care', { shots: true }); const tg = '[O]';
    const setDots = async () => JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main .cr-item')].map(li => ({ h: (li.querySelector('input[data-h]') || {}).dataset ? li.querySelector('input[data-h]').dataset.h : '', n: (li.querySelector('.cr-n') || {}).textContent || '', dots: [...li.querySelectorAll('.cr-week li')].map(d => d.classList.contains('on') ? 1 : 0).join('') })))"));
    try {
      await setup(x, { mode: 'local', role: 'husband', stage: 'cycle' });
      // 7 ngày gần nhất có sẵn dữ liệu (một ngày ngoài cửa sổ không được tính)
      await seedDB(x, { habits: [F.habitDay('2026-11-03', { move: 'x', food: 'x' }), F.habitDay('2026-11-04', { move: 'x', sleep: 'a' }), F.habitDay('2026-11-06', { move: 'a' }), F.habitDay('2026-11-09', { food: 'x', no_smoke: 'x' })] });
      T(`${tg} M05 ô 🌱 khi hôm nay chưa tick: "Vài việc nhỏ cho hôm nay" (không "0/6")`, /Vài việc nhỏ cho hôm nay/.test(await x.text('#main .tile[data-go=care]')) && !/0\/\d/.test(await x.text('#main .tile[data-go=care]')), await x.text('#main .tile[data-go=care]'));
      await x.click('#main .tile[data-go=care]'); await x.wait('care'); await x.check('M16');
      const t = await x.text();
      const codes = await x.ev("JSON.stringify([...document.querySelectorAll('#main .cr-list input[data-h]')].map(i => i.dataset.h))").then(JSON.parse);
      T(`${tg} AC-60 M16 mặc định 6 thói quen bật (sleep, move, food, connect, pause, screen), no_smoke tắt`, JSON.stringify(codes) === '["sleep","move","food","connect","pause","screen"]', JSON.stringify(codes));
      T(`${tg} AC-61 dòng cố định của move "Quanh ngày chọc hút, chuyển phôi: vận động theo dặn của bác sĩ điều trị."`, t.includes('Quanh ngày chọc hút, chuyển phôi: vận động theo dặn của bác sĩ điều trị.'));
      T(`${tg} AC-61 thẻ cố định "Thuốc, thực phẩm chức năng, thuốc nam, kiêng cữ: anh hỏi bác sĩ điều trị trước nhé. App không khuyên về những điều này."`,
        t.includes('Thuốc, thực phẩm chức năng, thuốc nam, kiêng cữ: anh hỏi bác sĩ điều trị trước nhé. App không khuyên về những điều này.'), t);
      T(`${tg} PRD 6.7 không thói quen "uống đủ nước"; lead "Một việc nhỏ cũng là chăm mình."; ngày "Thứ Ba, 10/11"`, !/uống đủ nước/i.test(t) && t.includes('Một việc nhỏ cũng là chăm mình.') && t.includes('Thứ Ba, 10/11'), t.slice(0, 200));
      const d0 = await setDots();
      const dm = Object.fromEntries(d0.map(r => [r.h, r]));
      T(`${tg} AC-63 mỗi thói quen 7 chấm (cũ → mới, hôm nay cuối) + "{n}/7 ngày"; ngày ngoài 7 ngày không tính`,
        d0.every(r => r.dots.length === 7 && /^\d\/7 ngày$/.test(r.n)) && dm.move.dots === '1010000' && dm.move.n === '2/7 ngày' && dm.food.dots === '0000010' && dm.food.n === '1/7 ngày' && dm.sleep.n === '1/7 ngày' && dm.pause.n === '0/7 ngày',
        JSON.stringify(d0));
      T(`${tg} AC-63 chấm đọc được bằng trình đọc màn hình ("Thứ Tư 4/11: có")`, /Thứ Tư 4\/11: có/.test(await x.ev("document.querySelector('#main .cr-item:nth-child(2) .cr-week').textContent")), await x.ev("document.querySelector('#main .cr-item:nth-child(2) .cr-week').textContent"));
      const red = await x.ev(`[...document.querySelectorAll('#main .care *')].filter(e => { const s = getComputedStyle(e); return [s.color, s.backgroundColor, s.borderTopColor].some(c => { const v = (c.match(/[\\d.]+/g) || []).map(Number); return (v[3] === undefined || v[3] > 0.1) && v[0] > 170 && v[1] < 90 && v[2] < 90; }); }).map(e => e.className).join(',')`);
      T(`${tg} AC-63 không màu đỏ, không chữ "chuỗi" / "mất chuỗi"`, !red && !/chuỗi/i.test(t), red);
      await x.shot('M16');
      // Tick tay → 'x'; bỏ tick → ''
      await x.ev('(window.__toasts = [], 1)');
      await x.click('#main input[data-h=food]', 250);
      T(`${tg} AC-60 tick tay "food" → ô tick, lưu 'x' (DB), số ngày cập nhật 2/7`, (await habitsToday(x)).food === 'x' && await x.ev("document.querySelector('#main input[data-h=food]').checked")
        && (await setDots()).find(r => r.h === 'food').n === '2/7 ngày', JSON.stringify(await habitsToday(x)));
      T(`${tg} UX 4.7 tick thường không hiện toast`, !(await toasts(x)).length, JSON.stringify(await toasts(x)));
      await x.click('#main input[data-h=food]', 250);
      T(`${tg} bỏ tick → '' (DB), số ngày về 1/7`, (await habitsToday(x)).food === '' && (await setDots()).find(r => r.h === 'food').n === '1/7 ngày', JSON.stringify(await habitsToday(x)));
      // Bật / tắt thói quen
      await x.ev("document.querySelector('#main details.cr-set').open = true"); await sleep(100);
      const sw0 = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main [role=switch][data-h]')].map(b => b.dataset.h + ':' + b.getAttribute('aria-checked')))"));
      T(`${tg} AC-60 phần cài: 7 công tắc role=switch, no_smoke tắt`, sw0.length === 7 && sw0.includes('no_smoke:false') && sw0.filter(s => s.endsWith(':true')).length === 6, JSON.stringify(sw0));
      await x.check('M16 phần cài');
      await x.click('#main [role=switch][data-h=no_smoke]', 250); await x.click('#main [role=switch][data-h=screen]', 250);
      const codes2 = await x.ev("JSON.stringify([...document.querySelectorAll('#main .cr-list input[data-h]')].map(i => i.dataset.h))").then(JSON.parse);
      T(`${tg} AC-60 bật no_smoke, tắt screen → danh sách đổi ngay`, codes2.includes('no_smoke') && !codes2.includes('screen'), JSON.stringify(codes2));
      T(`${tg} no_smoke có lời không phán xét`, /Hôm nào chưa được cũng không sao nhé/.test(await x.text('#main .cr-list')), await x.text('#main .cr-list'));
      T(`${tg} AC-18 lựa chọn thói quen lưu ở kv habits (DB)`, JSON.stringify(((await x.dbDump()).kv || []).find(k => k.k === 'habits')).includes('no_smoke') && !JSON.stringify(((await x.dbDump()).kv || []).find(k => k.k === 'habits')).includes('screen'), JSON.stringify((await x.dbDump()).kv));
      await x.go(); await goTo(x, 'care');
      T(`${tg} tải lại → lựa chọn thói quen còn nguyên`, await x.ev("!!document.querySelector('#main input[data-h=no_smoke]') && !document.querySelector('#main input[data-h=screen]')"));
      // Tắt hết → lời mời bật lại
      await x.ev("document.querySelector('#main details.cr-set').open = true");
      for (const h of ['sleep', 'move', 'food', 'connect', 'pause', 'no_smoke']) await x.click(`#main [role=switch][data-h=${h}]`, 150);
      T(`${tg} tắt hết → "Anh đã tắt hết thói quen. Khi nào muốn, bật lại một việc nhỏ nhé."`, (await x.text()).includes('Anh đã tắt hết thói quen. Khi nào muốn, bật lại một việc nhỏ nhé.'), await x.text('#main .cr-card'));
      for (const h of ['sleep', 'move', 'food', 'connect', 'pause', 'screen']) await x.click(`#main [role=switch][data-h=${h}]`, 150);

      /* --- Tự đánh dấu 'a' + toast chỉ khi thật sự vừa đánh dấu --- */
      const tc = 'Đã đánh dấu';
      const stopRound = async () => {
        await x.checkin({ level: 6, emotions: ['lo_lang'] }); await x.wait('suggest');
        await x.click('#sg [data-go=player]', 250); await x.wait('player');
        await x.click('#main [data-act=plDone]'); await x.wait('checkout');
        await x.ev('(window.__toasts = [], 1)');
        await x.click('#main [data-act=coDone]', 200); await x.wait('done'); await sleep(500);
        return toasts(x);
      };
      let ts = await stopRound();
      T(`${tg} AC-62 tới Check-out (pause đang trống) → pause tự đánh dấu 'a' + toast "Đã đánh dấu 'Một lần Dừng lại' trong Chăm mình."`,
        (await habitsToday(x)).pause === 'a' && ts.some(s => s.includes("Đã đánh dấu 'Một lần Dừng lại' trong Chăm mình.")), JSON.stringify(ts) + JSON.stringify(await habitsToday(x)));
      await goTo(x, 'care');
      T(`${tg} M16: pause đã tick, có nhãn "tự đánh dấu"`, await x.ev("document.querySelector('#main input[data-h=pause]').checked") && /tự đánh dấu/.test(await x.ev("document.querySelector('#main input[data-h=pause]').closest('.cr-item').textContent")));
      await x.click('#main input[data-h=pause]', 250);
      T(`${tg} AC-62 bỏ tick ô tự đánh dấu → '' (DB), ô bỏ tick`, (await habitsToday(x)).pause === '' && !(await x.ev("document.querySelector('#main input[data-h=pause]').checked")), JSON.stringify(await habitsToday(x)));
      // pause đã tick tay 'x' → Check-out không đổi thành 'a', KHÔNG toast "Đã đánh dấu"
      await x.click('#main input[data-h=pause]', 250);
      ts = await stopRound();
      T(`${tg} pause đã tick tay → tới Check-out giữ 'x' và KHÔNG hiện toast "Đã đánh dấu…" (không đánh dấu gì)`, (await habitsToday(x)).pause === 'x' && !ts.some(s => s.includes(tc)), JSON.stringify(ts) + JSON.stringify(await habitsToday(x)));
      // pause đang tắt → không đánh dấu, không toast
      await goTo(x, 'care'); await x.click('#main input[data-h=pause]', 200);
      await x.ev("document.querySelector('#main details.cr-set').open = true"); await x.click('#main [role=switch][data-h=pause]', 200);
      ts = await stopRound();
      T(`${tg} thói quen pause đang TẮT → tới Check-out không đánh dấu, KHÔNG toast "Đã đánh dấu…"`, !(await habitsToday(x)).pause && !ts.some(s => s.includes(tc)), JSON.stringify(ts) + JSON.stringify(await habitsToday(x)));
      await goTo(x, 'care'); await x.ev("document.querySelector('#main details.cr-set').open = true"); await x.click('#main [role=switch][data-h=pause]', 200);
      // Check-out bỏ qua (coSkip) không phải "tới Check-out xong": chỉ ghi nhận, không đòi
      // Bài đêm xong → sleep 'a'
      await goTo(x, 'night_play', { id: 'NIGHT_TOGETHER', how: 'read', music: null }); await sleep(300);
      await x.click('#main [data-act=readDone]', 400);
      T(`${tg} AC-62 xong một bài đêm → sleep tự đánh dấu 'a'`, (await habitsToday(x)).sleep === 'a', JSON.stringify(await habitsToday(x)));
      // Hai ta (C3) xong → connect 'a'
      await goTo(x, 'together_talk'); await x.click('#tg-talk [data-tk=go]', 200); await x.click('#tg-talk [data-tk=swap]', 200); await x.click('#tg-talk [data-tk=done]', 400);
      T(`${tg} AC-62 xong bài Hai ta → connect tự đánh dấu 'a'`, (await habitsToday(x)).connect === 'a', JSON.stringify(await habitsToday(x)));
      // M05 ô 🌱 có số
      await x.goHome();
      T(`${tg} M05 ô 🌱 khi đã có tick: "{n}/{m} việc nhỏ"`, /\d\/\d việc nhỏ/.test(await x.text('#main .tile[data-go=care]')), await x.text('#main .tile[data-go=care]'));

      /* --- M18: CSV thói quen + JSON --- */
      await goTo(x, 'mydata');
      T(`${tg} M18 có phần "Thói quen" + nút "Tải bảng thói quen (CSV)"`, /Thói quen/.test(await x.text()) && await x.has('#main [data-act=crCsv]'));
      await x.ev('(window.__dl = [], 1)');
      await x.click('#main [data-act=crCsv]', 300); await x.click('#main [data-act=dlJson]', 300);
      const files = await x.blobs();
      const csv = files.find(f => /\.csv$/.test(f.name)), js = files.find(f => /\.json$/.test(f.name));
      T(`${tg} AC-18 / L-2 tệp "du-lieu-cua-minh-thoi-quen-2026-11-10.csv" (không tên app)`, csv && csv.name === 'du-lieu-cua-minh-thoi-quen-2026-11-10.csv', files.map(f => f.name).join(', '));
      const lines = csv ? csv.text.split(/\r\n/).filter(Boolean).map(l => l.replace(/"/g, '')) : [];   // ô CSV có thể có ngoặc kép
      const head = lines[0] || '';
      const today = lines.find(l => l.startsWith('10/11/2026')) || '';
      T(`${tg} AC-18 CSV thói quen có BOM, cột Ngày + 7 thói quen, mỗi ngày một dòng (5 ngày)`, csv && csv.bom && /^Ngày/.test(head) && ['Đi ngủ sớm hơn một chút', 'Vận động nhẹ hôm nay', 'Một lần Dừng lại', 'Không thuốc lá, rượu bia hôm nay'].every(h => head.includes(h)) && lines.length === 6, csv && csv.text.slice(0, 400));
      T(`${tg} CSV dòng hôm nay ghi "Tự đánh dấu" cho sleep / connect`, /Tự đánh dấu/.test(today), today);
      const J = js ? JSON.parse(js.text) : {};
      T(`${tg} AC-18 JSON có habits (mọi ngày) + prefs.habits (thói quen đang bật)`, Array.isArray(J.habits) && J.habits.length === 5 && J.prefs && J.prefs.habits && Array.isArray(J.prefs.habits.enabled), JSON.stringify(J.prefs));
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }

    // Không lưu gì: chỉ tick trong phiên, không 7 chấm
    const y = await openA2('O-none'); const ty = '[O-none]';
    try {
      await setup(y, { mode: 'none', role: 'wife', stage: 'cycle' });
      await goTo(y, 'care'); await y.check('M16 none');
      T(`${ty} M16 none: "Chỉ tick trong lần mở này. Đóng trang là mất.", không 7 chấm`, (await y.text()).includes('Chỉ tick trong lần mở này. Đóng trang là mất.') && !(await y.has('#main .cr-week')), await y.text());
      T(`${ty} M16 none: thẻ thuốc dùng "chị"`, (await y.text()).includes('kiêng cữ: chị hỏi bác sĩ điều trị trước nhé.'));
      await y.click('#main input[data-h=move]', 250);
      T(`${ty} tick trong phiên chạy (bộ nhớ)`, await y.ev("document.querySelector('#main input[data-h=move]').checked") && (await memMarks(y)).move === 'x', JSON.stringify(await memMarks(y)));
      T(`${ty} AC-11 không khóa htdc, không IndexedDB, không cookie`, (await y.htdcKeys()) === '[]' && (await y.dbs()) === '[]', (await y.htdcKeys()) + (await y.dbs()));
      await y.noErr();
    } catch (e) { T(`${ty} chạy hết`, false, e.stack); } finally { await y.close(); }
  }

  /* =====================================================================
     P. Hành trình của mình (M17)
     ===================================================================== */
  async function scenarioP() {
    const x = await openA2('P-journal', { shots: true }); const tg = '[P]';
    try {
      await setup(x, { mode: 'local', writing: true, role: 'wife', stage: null });
      await goTo(x, 'journal'); await x.check('M17 rỗng');
      T(`${tg} AC-64 rỗng → "Chưa có gì ở đây. Bắt đầu một lần Dừng lại nhé." + nút Dừng lại`, (await x.text()).includes('Chưa có gì ở đây. Bắt đầu một lần Dừng lại nhé.') && await x.has('#main [data-go=pause5]'), await x.text());
      await x.click('#main [data-go=pause5]');
      T(`${tg} nút rỗng → M06`, await x.wait('pause5'));
      // Dữ liệu mẫu: hôm nay, hôm qua, 07/11
      const XSS = '<img src=x onerror="window.__xss=1">ghi chú';
      const J = [
        F.stopRec({ id: 'p0000000000000000001', day: TODAY, at: F.atLocal(TODAY, 9, 30, 0, 420), stage: 'waiting', before: 3, after: 5, fit: 'fit', emotions: ['lo_lang', 'met_moi'], note: XSS, texts: { thought: 'lần này lại không được' } }),
        F.nightRec({ id: 'p0000000000000000002', day: TODAY, at: F.atLocal(TODAY, 22, 0, 0, 420), script: 'NIGHT_HOME', outcome: 'better' }),
        F.togetherRec({ id: 'p0000000000000000003', day: TODAY, at: F.atLocal(TODAY, 20, 0, 0, 420), exercise: 'C1' }),
        F.stageRec({ id: 'p0000000000000000004', day: TODAY, at: F.atLocal(TODAY, 8, 0, 0, 420), from: 'cycle', to: 'waiting' }),
        F.stopRec({ id: 'p0000000000000000005', day: '2026-11-09', at: F.atLocal('2026-11-09', 21, 4, 0, 420), before: 4, after: null, fit: null, emotions: [], note: undefined }),
        F.nightRec({ id: 'p0000000000000000006', day: '2026-11-07', at: F.atLocal('2026-11-07', 22, 30, 0, 420), script: 'NIGHT_WARM_HAND', outcome: 'same' }),
        F.nightRec({ id: 'p0000000000000000007', day: '2026-11-07', at: F.atLocal('2026-11-07', 21, 0, 0, 420), script: 'NIGHT_HOME_SHORT', outcome: 'skip', end: 'stopped' })
      ].map(r => { if (r.note === undefined) delete r.note; return r; });
      await seedDB(x, { journal: J });
      await goTo(x, 'journal'); await sleep(200); await x.check('M17');
      await x.shot('M17');
      const g = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main .jr-day h2, #main .jr-item')].map(e => e.tagName === 'H2' ? 'H:' + e.textContent.trim() : e.dataset.id))"));
      T(`${tg} AC-64 nhóm ngày "Hôm nay" / "Hôm qua" / "Thứ Bảy, 07/11/2026", mới nhất trên cùng`,
        JSON.stringify(g) === JSON.stringify(['H:Hôm nay', 'p0000000000000000002', 'p0000000000000000003', 'p0000000000000000001', 'p0000000000000000004', 'H:Hôm qua', 'p0000000000000000005', 'H:Thứ Bảy, 07/11/2026', 'p0000000000000000006', 'p0000000000000000007']), JSON.stringify(g));
      const it = id => x.text(`#main .jr-item[data-id="${id}"]`);
      const exS = await x.ev("(e => e.short || e.title)(HTDC_APP.D.EXERCISES.BREATHE_46)");
      const s1 = await it('p0000000000000000001');
      T(`${tg} AC-64 mục Dừng lại: giờ, giai đoạn, "Trước 3 → Sau 5", bài, "Phù hợp", thẻ cảm xúc`, /09:30/.test(s1) && /Dừng lại/.test(s1) && /Đang chờ kết quả/.test(s1) && s1.includes('Trước 3 → Sau 5') && s1.includes(exS) && /Phù hợp/.test(s1) && /Lo lắng, Mệt mỏi/.test(s1), s1);
      T(`${tg} UX 4.8 chữ tự viết ẨN mặc định (<details> đóng, "Chữ đã viết (ẩn)")`, await x.ev("(() => { const d = document.querySelector('#main .jr-item[data-id=\"p0000000000000000001\"] details'); return !!d && !d.open && /Chữ đã viết \\(ẩn\\)/.test(d.querySelector('summary').textContent); })()")
        && !(await x.ev("document.querySelector('#main .jr-item[data-id=\"p0000000000000000001\"]').innerText")).includes('lần này lại không được'));
      await x.ev("document.querySelector('#main .jr-item[data-id=\"p0000000000000000001\"] details').open = true"); await sleep(100);
      T(`${tg} AC-05 XSS trong chữ đã lưu: hiện nguyên văn, không <img>, không chạy`, (await it('p0000000000000000001')).includes(XSS) && !(await x.has('#main .jr-item img')) && !(await x.ev('window.__xss')), await it('p0000000000000000001'));
      const s5 = await it('p0000000000000000005');
      T(`${tg} AC-39d/AC-64 thiếu mức sau → không dòng "Trước → Sau", không undefined / null`, !/Trước|Sau/.test(s5) && !/undefined|null|NaN/.test(s5), s5);
      T(`${tg} AC-64 bài đêm: tên bài + kết quả ("Ngôi nhà có tiếng cười", "Dễ chịu hơn")`, /Ngôi nhà có tiếng cười/.test(await it('p0000000000000000002')) && /Dễ chịu hơn/.test(await it('p0000000000000000002')), await it('p0000000000000000002'));
      T(`${tg} AC-64 Hai ta: "Đã làm cùng nhau · DỪNG 5 cho hai ta"`, /Đã làm cùng nhau · DỪNG 5 cho hai ta/.test(await it('p0000000000000000003')), await it('p0000000000000000003'));
      T(`${tg} AC-64 đổi giai đoạn: "Đổi chặng đường" + "💉 Đang trong chu kỳ → ⏳ Đang chờ kết quả"`, /Đổi chặng đường/.test(await it('p0000000000000000004')) && /Đang trong chu kỳ → ⏳ Đang chờ kết quả/.test(await it('p0000000000000000004')), await it('p0000000000000000004'));
      T(`${tg} UX 4.8 không biểu đồ, không điểm trung bình`, !(await x.has('#main canvas, #main svg.chart')) && !/trung bình|điểm/i.test(await x.text()));
      // Lọc
      const chips = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main [data-act=jrFilter]')].map(b => b.dataset.k + ':' + b.getAttribute('aria-checked')))"));
      T(`${tg} AC-64 / UX 4.8 chip lọc chọn một: Tất cả, Dừng lại, Trước khi ngủ, Hai ta, Chặng đường (role=radio)`, JSON.stringify(chips) === '["all:true","stop:false","night:false","together:false","stage:false"]'
        && await x.ev("document.querySelector('#main .jr-chips').getAttribute('role') === 'radiogroup'"), JSON.stringify(chips));
      await x.click('#main [data-act=jrFilter][data-k=together]', 200);
      T(`${tg} lọc "Hai ta" → chỉ mục Hai ta`, JSON.stringify(await x.ev("JSON.stringify([...document.querySelectorAll('#main .jr-item')].map(e => e.dataset.id))").then(JSON.parse)) === '["p0000000000000000003"]'
        && await x.ev("document.querySelector('#main [data-k=together]').getAttribute('aria-checked')") === 'true');
      await x.click('#main [data-act=jrFilter][data-k=night]', 200);
      T(`${tg} lọc "Trước khi ngủ" → 3 mục bài đêm`, await x.ev("[...document.querySelectorAll('#main .jr-item')].length") === 3);
      await x.click('#main [data-act=jrFilter][data-k=all]', 200);
      // Xóa bấm 2 lần: mục duy nhất của "Hôm qua" → tiêu đề ngày cũng mất
      await x.click('#main .jr-item[data-id="p0000000000000000005"] .jr-del', 150);
      T(`${tg} AC-19 M17 lần 1 → "Bấm lần nữa để xóa", chưa xóa`, (await x.text('#main .jr-item[data-id="p0000000000000000005"] .jr-del')).trim() === 'Bấm lần nữa để xóa' && (await x.dbDump()).journal.some(r => r.id === 'p0000000000000000005'));
      await x.click('#main .jr-item[data-id="p0000000000000000005"] .jr-del', 500);
      T(`${tg} AC-19 lần 2 → xóa khỏi DB + màn, toast "Đã xóa.", tiêu đề "Hôm qua" mất theo`, !(await x.dbDump()).journal.some(r => r.id === 'p0000000000000000005') && !(await x.has('#main .jr-item[data-id="p0000000000000000005"]'))
        && (await toasts(x)).includes('Đã xóa.') && !/Hôm qua/.test(await x.text()), JSON.stringify(await toasts(x)));
      T(`${tg} sau khi xóa: focus còn trong danh sách (nút Xóa kế hoặc h1)`, await x.ev("!!document.activeElement && (document.activeElement.classList.contains('jr-del') || document.activeElement.tagName === 'H1')"), await x.ev('document.activeElement.className'));
      // Sau tin buồn: tên bài em bé cất vào <details>
      await goTo(x, 'stage'); await x.click('#main [data-pick=after_loss]', 300);
      await goTo(x, 'journal'); await sleep(200);
      const h2 = await x.ev("document.querySelector('#main .jr-item[data-id=\"p0000000000000000002\"] .jr-head').textContent");
      const h7 = await x.ev("document.querySelector('#main .jr-item[data-id=\"p0000000000000000007\"]').innerText");
      T(`${tg} after_loss: tên bài H1/H2 KHÔNG hiện ở dòng đầu, cất vào <details> đóng "Tên bài (ẩn)"`, !/Ngôi nhà có tiếng cười/.test(h2) && !/Ngôi nhà có tiếng cười/.test(h7)
        && await x.ev("(() => { const d = document.querySelector('#main .jr-item[data-id=\"p0000000000000000002\"] details'); return !!d && !d.open && /Tên bài \\(ẩn\\)/.test(d.textContent); })()"), h2 + ' | ' + h7);
      T(`${tg} after_loss: bài không có em bé (Bàn tay ấm) vẫn hiện tên`, /Bàn tay ấm/.test(await it('p0000000000000000006')), await it('p0000000000000000006'));
      T(`${tg} AC-22 after_loss M17: tên tab không có tên app`, !(await x.ev('document.title')).includes('Hành Trình Đón Con'), await x.ev('document.title'));
      await x.check('M17 after_loss');
      // Phân trang 40
      const more = [];
      for (let i = 0; i < 95; i++) { const day = F.dayAdd('2026-11-06', -Math.floor(i / 3)); more.push(F.stageRec({ id: 'q' + String(i).padStart(19, '0'), day, at: F.atLocal(day, 8 + (i % 3), 0, 0, 420), from: 'cycle', to: 'waiting' })); }
      await seedDB(x, { journal: more });
      await goTo(x, 'journal'); await sleep(200);
      const total = await x.ev('HTDC_APP.S.journal.list().length');
      T(`${tg} 11.2 phân trang: vẽ 40 mục đầu + "Đang hiện 40/${total} mục." + "Xem thêm ›"`, await x.ev("document.querySelectorAll('#main .jr-item').length") === 40 && (await x.text()).includes(`Đang hiện 40/${total} mục.`) && await x.has('#main [data-act=jrMore]'), await x.ev("document.querySelectorAll('#main .jr-item').length"));
      await x.click('#main [data-act=jrMore]', 250);
      const days = JSON.parse(await x.ev("JSON.stringify([...document.querySelectorAll('#main .jr-day')].map(d => d.dataset.day))"));
      T(`${tg} "Xem thêm" → 80 mục, focus mục đầu trang mới, tiêu đề ngày không lặp`, await x.ev("document.querySelectorAll('#main .jr-item').length") === 80 && await x.ev("document.activeElement && document.activeElement.classList.contains('jr-item')") && new Set(days).size === days.length, JSON.stringify(days));
      await x.click('#main [data-act=jrMore]', 250);
      T(`${tg} "Xem thêm" lần nữa → hết (${total} mục), không còn nút`, await x.ev("document.querySelectorAll('#main .jr-item').length") === total && !(await x.has('#main [data-act=jrMore]')));
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }

    // Cờ "Mất con" trong phiên (giai đoạn chưa đổi) → cũng cất tên bài em bé
    const l = await openA2('P-loss'); const tl = '[P-loss]';
    try {
      await setup(l, { mode: 'local', role: 'wife', stage: 'waiting' });
      await seedDB(l, { journal: [F.nightRec({ id: 'r0000000000000000001', day: TODAY, at: F.atLocal(TODAY, 7, 0, 0, 420), script: 'NIGHT_HOME', outcome: 'better' })] });
      await l.checkin({ level: 6, note: 'tuần trước mình bị sẩy thai' }); await l.wait('suggest');
      await goTo(l, 'journal'); await sleep(200);
      T(`${tl} phiên có cụm nhóm "Mất con" (giai đoạn vẫn waiting) → tên bài H1 cất vào <details>`, !/Ngôi nhà có tiếng cười/.test(await l.ev("document.querySelector('#main .jr-item[data-id=\"r0000000000000000001\"] .jr-head').textContent")), await l.text());
      T(`${tl} AC-23 cờ "Mất con" không ghi xuống máy`, !/loss|mất|sẩy/.test(JSON.stringify((await l.dbDump()).journal.filter(r => r.kind === 'stop'))), JSON.stringify((await l.dbDump()).journal));
      await l.noErr();
    } catch (e) { T(`${tl} chạy hết`, false, e.stack); } finally { await l.close(); }

    // 3.000 bản ghi: M17 ≤ 1,5 s ở 4× CPU, chỉ vẽ 40 mục
    const p = await openA2('P-perf'); const tp = '[P-perf]';
    try {
      await setup(p, { mode: 'local', role: 'wife', stage: 'waiting' });
      const big = F.big(TODAY, 11);
      await seedDB(p, big);
      await p.page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const times = [];
      for (let k = 0; k < 3; k++) {
        await p.goHome();
        times.push(await p.ev(`new Promise(res => { const t0 = performance.now(); HTDC_APP.go('journal');
          const chk = () => document.querySelector('#main .jr-item') ? requestAnimationFrame(() => res(performance.now() - t0)) : setTimeout(chk, 5); chk(); })`));
      }
      await p.page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const med = times.slice().sort((a, b) => a - b)[1];
      T(`${tp} 11.2 M17 với 3.000 bản ghi, 4× CPU ≤ 1,5 s (${times.map(Math.round).join(' / ')} ms)`, med <= 1500, times.join(','));
      T(`${tp} M17 chỉ vẽ 40 mục đầu (${await p.ev('HTDC_APP.S.journal.list().length')} bản ghi)`, await p.ev("document.querySelectorAll('#main .jr-item').length") === 40);
      T(`${tp} bản ghi cũ có rule (trước N-1) không lộ "R1…R8" trên M17`, !/\bR[1-8]b?\b/.test(await p.text()));
      await p.noErr();
    } catch (e) { T(`${tp} chạy hết`, false, e.stack); } finally { await p.close(); }

    // Không lưu gì: M17 chỉ có lần mở này, không nút xóa
    const n = await openA2('P-none'); const tn = '[P-none]';
    try {
      await setup(n, { mode: 'none', role: 'husband', stage: 'cycle' });
      await n.checkin({ level: 7 }); await n.wait('suggest');
      await goTo(n, 'journal'); await n.check('M17 none');
      T(`${tn} M17 none: "Anh đang dùng 'Không lưu gì', nên ở đây chỉ có những gì trong lần mở này."; có mục của phiên; không nút xóa`,
        (await n.text()).includes("Anh đang dùng 'Không lưu gì', nên ở đây chỉ có những gì trong lần mở này.") && await n.has('#main .jr-item') && !(await n.has('#main .jr-del')), await n.text());
      await n.noErr();
    } catch (e) { T(`${tn} chạy hết`, false, e.stack); } finally { await n.close(); }
  }

  /* =====================================================================
     Q. R5 khi có A2 (PRD 8.3): Cô đơn / "Giữa hai vợ chồng" → Ba câu cho nhau, Gửi lời
     ===================================================================== */
  async function scenarioQ() {
    const x = await openA2('Q-r5'); const tg = '[Q]';
    const sg = () => x.ev("JSON.stringify([...document.querySelectorAll('#sg .st-sg, #main .st-sg')].map(a => ({ t: a.innerText.split('\\n')[0], go: (a.querySelector('[data-go]') || {}).dataset ? a.querySelector('[data-go]').dataset.go : '' })))").then(JSON.parse);
    try {
      await setup(x, { mode: 'local', role: 'wife', stage: 'cycle' });
      for (const [label, c] of [['chấm 7 + thẻ Cô đơn', { level: 7, emotions: ['co_don'] }], ['chấm 8 + chip "Giữa hai vợ chồng"', { level: 8, ctx: ['couple'] }]]) {
        const s = await x.checkin(c); await x.wait('suggest'); await sleep(200);
        const l = await sg();
        T(`${tg} PRD 8.3 R5 (${label}) khi có A2 → M09 KHÔNG rỗng: 2 gợi ý "Ba câu cho nhau", "Gửi lời cho người thương"`,
          s === 'suggest' && l.length === 2 && /Ba câu cho nhau/.test(l[0].t) && /Gửi lời cho người thương/.test(l[1].t) && !/Chưa có bài|không có gợi ý/i.test(await x.text('#sg')), JSON.stringify(l) + ' · ' + (await x.text('#sg')).slice(0, 200));
        T(`${tg} PRD 8.3 R5 (${label}) có A2 → không thẻ "không một mình" của A1 (mức 7–8, không cờ)`, !(await x.has('#sg .human-card')), await x.text('#sg .human-card'));
        await x.check('M09 R5');
      }
      // Mở đúng màn riêng
      await x.click('#sg .st-sg button', 300);
      T(`${tg} R5 gợi ý 1 "Bắt đầu" → màn Ba câu cho nhau (together_talk), không phải player`, await x.wait('together_talk'), await x.scr());
      await x.click('#header [data-act=back]', 350); await x.wait('suggest');
      const second = await x.ev("(() => { const a = document.querySelectorAll('#sg .st-sg'); return a[1] ? 1 : 0; })()");
      if (second) await x.ev("document.querySelectorAll('#sg .st-sg')[1].querySelector('button').click()");
      T(`${tg} R5 gợi ý 2 → màn Gửi lời (send_words)`, second && await x.wait('send_words'), await x.scr());
      await x.click('#header [data-act=back]', 350); await x.wait('suggest');
      await x.click('#main [data-act=sgSwap]', 250);
      const sw = await sg();
      T(`${tg} R5 "Đổi gợi ý" → ứng viên kế (Bàn tay ấm – bản ngày)`, sw.length >= 1 && /Bàn tay ấm/.test(sw[0].t), JSON.stringify(sw));
      // Mức 4 + Cô đơn: thẻ "không một mình" (≤ 5) + gợi ý R5 + dòng hai tuần
      await x.checkin({ level: 4, emotions: ['co_don'] }); await x.wait('suggest'); await sleep(150);
      const l4 = await sg();
      T(`${tg} PRD 8.1 Cô đơn + mức 4 → thẻ "Chị không phải một mình" + gợi ý R5 (không rỗng) + dòng hai tuần`, await x.has('#sg .human-card') && l4.length >= 1 && /Ba câu cho nhau/.test(l4[0].t) && /kéo dài hơn hai tuần/.test(await x.text('#sg')), JSON.stringify(l4));
      // Từ M09 làm C3 tới cuối → bản ghi C3 (7 trường) + StopRec không mang chữ / cảm xúc của Hai ta
      await x.click('#sg .st-sg button', 300); await x.wait('together_talk');
      await x.click('#tg-talk [data-tk=go]', 200); await x.click('#tg-talk [data-tk=swap]', 200); await x.click('#tg-talk [data-tk=done]', 400);
      const tr = await togRecs(x);
      T(`${tg} C3 mở từ M09 xong → 1 bản ghi together C3 đúng 7 trường`, tr.length === 1 && tr[0].exercise === 'C3' && Object.keys(tr[0]).sort().join() === TOG_KEYS, JSON.stringify(tr));
      await x.noErr();
    } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
  }

  /* =====================================================================
     R. "Không lưu gì" với A2: không khóa, không DB, không cookie
     ===================================================================== */
  async function scenarioR() {
    for (const how of ['none', 'consent-off']) {
      const x = await openA2('R-' + how); const tg = `[R-${how}]`;
      try {
        if (how === 'none') await setup(x, { mode: 'none', role: 'solo', stage: 'waiting' });
        else {
          await x.go(); await x.seed(); await x.click('#main [data-go=consent]'); await x.wait('consent');
          await x.click('#cs-journey'); await x.click('#main [data-act=consentGo]', 300);
          await x.wait('role'); await x.click('#main [data-act=roleNext]'); await x.wait('stage'); await x.click('#main [data-act=stageNext]'); await x.wait('home');
        }
        await goTo(x, 'together');
        T(`${tg} M15 không có dòng "đang lưu"`, !(await x.text()).includes('Chỉ ghi một dòng'));
        await x.click('#main [data-act=tgStart]'); await x.wait('together_stop5');
        await x.click('#tg-easy', 150); await x.click('#main [data-act=tgNext]'); await x.click('#main [data-act=tgSkip]');
        await x.click('#tg-flip [data-capy=co_don]'); await x.click('#tg-fb'); await x.click('#tg-fb'); await x.click('#tg-flip [data-capy=dau_kho]'); await x.click('#tg-fb', 200);
        await x.click('#main [data-act=tgNext]', 150); await x.click('#main [data-act=tgSkip]', 150); await x.click('#main [data-act=tgSkip]', 150);
        T(`${tg} C1 tới màn kết`, (await x.text()).includes('Hai bạn đã dành mười phút cho nhau.'));
        const mem = JSON.parse(await x.ev("JSON.stringify(HTDC_APP.S.journal.list({kind:'together'}))"));
        T(`${tg} bản ghi Hai ta chỉ trong bộ nhớ, đúng 7 trường`, mem.length === 1 && Object.keys(mem[0]).sort().join() === TOG_KEYS, JSON.stringify(mem));
        await goTo(x, 'together_talk'); await x.click('#tg-talk [data-tk=go]', 150); await x.click('#tg-talk [data-tk=swap]', 150); await x.click('#tg-talk [data-tk=done]', 300);
        await goTo(x, 'send_words');
        T(`${tg} vai solo / bỏ qua → C4 xưng "mình" mặc định`, await x.ev("document.querySelector('#main [data-pron=shared]').getAttribute('aria-checked')") === 'true');
        await x.click('#tg-send', 250); await x.click('#tg-t1'); await retype(x, '#tg-ta', 'Tối nay ôm em nhé 0912345678'); await x.click('#tg-rv', 250);
        if (await x.has('#tg-pii [data-pii=keep]')) await x.click('#tg-pii [data-pii=keep]', 250);
        await x.click('#tg-send', 250);
        await goTo(x, 'care'); await x.click('#main input[data-h=food]', 200);
        await x.ev("document.querySelector('#main details.cr-set').open = true"); await x.click('#main [role=switch][data-h=no_smoke]', 200);
        await goTo(x, 'journal'); await sleep(200);
        T(`${tg} M17 có mục Hai ta của phiên (bộ nhớ)`, /Đã làm cùng nhau/.test(await x.text()), await x.text());
        await goTo(x, 'mydata');
        T(`${tg} M18 không có nút CSV thói quen (không có gì để tải về)`, !(await x.has('#main [data-act=crCsv]')));
        await sleep(300);
        T(`${tg} AC-11 / AC-24 / AC-56 sau Hai ta, Gửi lời, Chăm mình, Hành trình: KHÔNG khóa Web Storage, KHÔNG cookie, KHÔNG IndexedDB`,
          (await x.htdcKeys()) === '[]' && (await x.dbs()) === '[]' && await x.ev("document.cookie === ''"), (await x.htdcKeys()) + ' ' + (await x.dbs()));
        T(`${tg} khóa của app khác còn nguyên`, await x.foreignOk());
        await x.go();
        T(`${tg} AC-11 tải lại → về M01`, await x.scr() === 'welcome', await x.scr());
        await x.noErr();
      } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
    }
  }

  /* =====================================================================
     S. Cỡ màn 320 / 375 / 768, máy tối, vùng chạm, tương phản trên mọi màn A2
     ===================================================================== */
  async function scenarioS() {
    const STATES = [
      ['M15', "HTDC_APP.go('together')"],
      ['C1-1', "HTDC_APP.go('together'); document.querySelector('#main [data-act=tgStart]').click()"],
      ['C1-2', "document.querySelector('#main .tg-map [data-i=\"1\"]').click()"],
      ['C1-3', "document.querySelector('#main .tg-map [data-i=\"2\"]').click()"],
      ['C1-3-lat', "document.querySelector('#tg-flip [data-capy]').click(); document.querySelector('#tg-fb').click(); document.querySelector('#tg-fb').click(); document.querySelector('#tg-flip [data-capy]').click(); document.querySelector('#tg-fb').click()"],
      ['C1-4', "document.querySelector('#main .tg-map [data-i=\"3\"]').click()"],
      ['C1-4-luot', "document.querySelector('#tg-talk [data-tk=go]').click(); __tick(130000)"],
      ['C1-5', "document.querySelector('#main .tg-map [data-i=\"4\"]').click(); document.querySelector('#main [data-heart=\"0\"]').click(); document.querySelector('#main [data-heart=\"1\"]').click()"],
      ['C1-ket', "document.querySelector('#main [data-act=tgNext]').click()"],
      ['C2', "HTDC_APP.go('together_breathe')"],
      ['C3', "HTDC_APP.go('together_talk')"],
      ['C3-luot', "document.querySelector('#tg-talk [data-tk=go]').click()"],
      ['C4', "HTDC_APP.go('send_words')"],
      ['C4-tuviet', "document.querySelector('#tg-t1').click(); const t = document.querySelector('#tg-ta'); t.value = 'Gọi chồng mình anh Trần Minh Quân 0912345678'; t.dispatchEvent(new Event('input', {bubbles:true})); document.querySelector('#tg-rv').click()"],
      ['C4-xemlai', "document.querySelector('#tg-pii [data-pii=keep]').click()"],
      ['M16', "HTDC_APP.go('care'); document.querySelector('#main details.cr-set').open = true; document.querySelector('#main input[data-h=food]').click()"],
      ['M17', "HTDC_APP.go('journal'); document.querySelectorAll('#main details').forEach(d => d.open = true)"]
    ];
    for (const [w, dark] of [[320, false], [375, false], [768, false], [375, true]]) {
      const x = await openA2(`S-w${w}${dark ? '-toi' : ''}`, { width: w, height: w === 768 ? 1024 : 740, dark }); const tg = `[S-w${w}${dark ? '-tối' : ''}]`;
      try {
        await setup(x, { mode: 'local', writing: true, role: 'wife', stage: 'waiting' });
        await seedDB(x, { journal: [F.stopRec({ id: 's0000000000000000001', note: 'một ghi chú khá dài để thử xuống dòng trên màn hẹp ' .repeat(3) }), F.togetherRec({ id: 's0000000000000000002' }), F.nightRec({ id: 's0000000000000000003' }), F.stageRec({ id: 's0000000000000000004' })],
          habits: [F.habitDay('2026-11-08', { move: 'x', pause: 'a' })] });
        const bad = [], modeBad = [];
        for (const [name, js] of STATES) {
          try { await x.ev(`(() => { ${js} })()`); } catch (e) { bad.push(name + ' (không dựng được: ' + String(e.message || e).slice(0, 80) + ')'); continue; }
          await sleep(dark ? 650 : 350);
          await x.check(name);
          const o = await x.ev(CONTRAST);
          if (o.length) bad.push(name + ' → ' + o.slice(0, 4).join(' ; '));
          if (dark && await x.ev("document.documentElement.dataset.mode || ''") !== 'night') modeBad.push(name);
          if (!dark && await x.ev("document.documentElement.dataset.mode || ''") === 'night') modeBad.push(name + '(sáng mà tối)');
          if (w === 320 || dark) await x.page.screenshot(path.join(SHOTS, `S-w${w}${dark ? '-toi' : ''}-${name}.png`)).catch(() => {});
        }
        T(`${tg} ${dark ? 'AC-08 máy tối' : 'WCAG 1.4.3 / UX 11'}: tương phản chữ ≥ 4,5:1 (chữ lớn ≥ 3:1) trên ${STATES.length} trạng thái màn A2`, !bad.length, bad.join(' || '));
        T(`${tg} ${dark ? 'AC-08 máy tối → mọi màn A2 tối' : 'máy sáng → màn A2 sáng'}`, !modeBad.length, modeBad.join(','));
        await x.noErr();
      } catch (e) { T(`${tg} chạy hết`, false, e.stack); } finally { await x.close(); }
    }
  }

  return { scenarioM, scenarioN, scenarioO, scenarioP, scenarioQ, scenarioR, scenarioS,
    async run() {
      if (want('M')) { section('M. Hai ta: M15, C1, C2, C3 (A2)'); await scenarioM(); }
      if (want('N')) { section('N. Gửi lời cho người thương (A2, cùng họ lỗi review A1)'); await scenarioN(false); await scenarioN(true); }
      if (want('O')) { section('O. Chăm mình hôm nay (A2)'); await scenarioO(); }
      if (want('P')) { section('P. Hành trình của mình (A2)'); await scenarioP(); }
      if (want('Q')) { section('Q. R5 khi có A2'); await scenarioQ(); }
      if (want('R')) { section('R. Không lưu gì với A2'); await scenarioR(); }
      if (want('S')) { section('S. Cỡ màn, máy tối, vùng chạm, tương phản (A2)'); await scenarioS(); }
    } };
};
