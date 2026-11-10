/* Hành Trình Đón Con – js/scripts.js · window.HTDC_SCRIPTS · Chủ: FE-5 Trước khi ngủ
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 7.1, ADR 0012; PRD 6.5, A.6; UX 4.5.
   Nguồn câu: docs/specs/hiem-muon-kich-ban-hinh-dung.md @ 10/11/2026 (bản nháp 09/11/2026) — CHÉP NGUYÊN VĂN, không sửa câu.
   Quy ước: {bạn} / {Bạn} của kịch bản ghi thành {xung} / {Xung}. {nt} = "người thương" (H3-03; người đi một mình:
   "một người thương {xung}"). pause: 'short' 5 s · 'breath3' 15 s · 'long' 20 s · null (kịch bản mục 0.3).
   Tag 'safety_open' / 'close_whatever' đặt theo "Phần" kịch bản ghi (AC-43).
   Mọi bài status 'draft' cho tới khi anh Thông duyệt (PRD 8.8). audio: [] → ẩn "Nghe giọng thật" (AC-49b).
   Thêm file ghi âm: điền audio: [{ url: 'assets/audio/h1-nam.m4a', label: 'Giọng nam' }], không sửa mã. */
window.HTDC_SCRIPTS = (() => {
  'use strict';
  const REVIEW = () => ({ status: 'draft', reviewer: '', reviewedAt: '' });
  // Khối: [id, chữ, dừng, tags?]
  const B = (rows, open, close) => rows.map(([id, text, pause]) => {
    const tags = [];
    if (open.includes(id)) tags.push('safety_open');
    if (close.includes(id)) tags.push('close_whatever');
    return { id, text, pause, tags };
  });

  /* ===== H1 🏡 Ngôi nhà có tiếng cười (~10 phút) ===== */
  const H1 = B([
    // Phần 1 – Vào bài (safety_open)
    ['H1-01', 'Chào {xung}. Mình ở đây với {xung} một lúc trước khi ngủ nhé.', 'short'],
    ['H1-02', 'Bài này là để lòng dịu lại. Nó không phải một lời hứa, và không làm thay đổi kết quả điều trị.', 'short'],
    ['H1-03', '{Xung} không cần thấy rõ hình ảnh nào. Mờ cũng được. Chỉ là một cảm giác ấm cũng được.', 'short'],
    ['H1-04', 'Nếu có hình ảnh làm {xung} đau, {xung} cứ mở mắt, thở tự nhiên, hoặc dừng bài. Không sao cả.', 'breath3'],
    ['H1-05', 'Giờ {xung} nằm xuống, hoặc ngồi tựa, kiểu nào thoải mái nhất. Nếu người thương đang nằm cạnh, hai người có thể nắm tay nhau.', 'short'],
    ['H1-06', 'Thở bình thường thôi. Không cần thở sâu, không cần giữ hơi.', 'breath3'],
    // Phần 2 – Thả lỏng
    ['H1-07', 'Để đôi vai rơi xuống một chút. Như vừa đặt xuống một chiếc ba lô nặng sau một ngày dài.', 'breath3'],
    ['H1-08', 'Để hàm mềm ra. Để hai bàn tay nằm yên, nặng dần.', 'breath3'],
    ['H1-09', 'Những việc của hôm nay, cứ để chúng ở ngoài cửa phòng. Sáng mai chúng vẫn ở đó, chưa cần lo bây giờ.', 'breath3'],
    // Phần 3 – Ngôi nhà
    ['H1-10', 'Giờ {xung} hình dung một buổi sáng, ở một ngôi nhà nào đó trong tương lai. Có thể là nhà của {xung} bây giờ, có thể là một nơi khác.', 'long'],
    ['H1-11', 'Nắng sớm lọt qua cửa sổ, rơi thành một vệt vàng trên sàn. Ngoài kia có tiếng xe xa xa, tiếng chim.', 'breath3'],
    ['H1-12', 'Trong nhà có mùi cơm mới, hay mùi trà ấm. Không khí chậm và yên.', 'long'],
    // Phần 4 – Gặp con
    ['H1-13', 'Rồi ở đâu đó trong nhà, có một tiếng động nhỏ. Tiếng một đứa trẻ vừa thức dậy.', 'breath3'],
    ['H1-14', 'Con có thể còn là một hình ảnh mờ. {Xung} không cần biết con trông thế nào. Chỉ cần biết con ở đó.', 'long'],
    ['H1-15', '{Xung} đi lại gần. Có thể con đang dụi mắt. Có thể con đang cười, cái cười chưa có lý do gì cả.', 'breath3'],
    ['H1-16', 'Một bàn tay rất nhỏ nắm lấy ngón tay {xung}. Nắm chặt hơn {xung} nghĩ.', 'long'],
    ['H1-17', '{Xung} cảm thấy hơi ấm của con. Có thể là mùi tóc, có thể là tiếng thở đều đều.', 'long'],
    ['H1-18', 'Không cần làm gì cả. Chỉ ở đó cùng con, một chút thôi.', 'long'],
    // Phần 5 – Gia đình mình
    ['H1-19', 'Rồi người thương của {xung} bước vào. Hai người nhìn nhau. Không cần nói gì.', 'breath3'],
    ['H1-20', 'Có thể cả nhà ngồi xuống sàn, trong vệt nắng ấy. Có thể là một bữa sáng vụng về, đồ ăn rơi vãi, ai cũng cười.', 'long'],
    ['H1-21', 'Những người thương {xung} ở quanh đó, gần hay xa. Ngôi nhà ồn hơn trước một chút. Ấm hơn trước một chút.', 'breath3'],
    // Phần 6 – Lời gửi
    ['H1-22', 'Nếu muốn, {xung} nói thầm một câu với con. Câu gì cũng được. Câu đó là của riêng {xung}.', 'long'],
    ['H1-23', 'Và nếu muốn, một câu với người đang đi cùng {xung} trên chặng đường này.', 'breath3'],
    // Phần 7 – Dù thế nào (close_whatever)
    ['H1-24', 'Hình ảnh vừa rồi là điều {xung} mong. Nó cũng cho thấy trong {xung} đang có rất nhiều thương yêu.', 'breath3'],
    ['H1-25', 'Dù chặng đường phía trước đi thế nào, tình thương ấy vẫn ở đây. Trong {xung}, và giữa hai người.', 'breath3'],
    ['H1-26', '{Xung} không cần giữ chặt hình ảnh. Cứ để nó nhạt dần, như ánh đèn ngủ.', 'long'],
    // Phần 8 – Ra bài
    ['H1-27', 'Giờ không còn việc gì phải làm nữa. {Xung} có thể ngủ, khi nào cơ thể sẵn sàng.', 'short'],
    ['H1-28', 'Chúc {xung} một đêm bình an nhé.', null]
  ], ['H1-01', 'H1-02', 'H1-03', 'H1-04', 'H1-05', 'H1-06'], ['H1-24', 'H1-25', 'H1-26']);

  /* ===== H2 🌙 Ngôi nhà có tiếng cười – bản ngắn (~3 phút) ===== */
  const H2 = B([
    ['H2-01', 'Mình cùng {xung} vài phút trước khi ngủ nhé. Đây không phải lời hứa. Hình ảnh mờ cũng được, đau thì cứ dừng.', 'short'],
    ['H2-02', 'Nằm thoải mái. Thở bình thường, không cần giữ hơi. Để vai rơi xuống.', 'breath3'],
    ['H2-03', 'Hình dung một buổi sáng có nắng, trong một ngôi nhà yên.', 'long'],
    ['H2-04', 'Có một đứa trẻ vừa thức dậy. Một bàn tay nhỏ nắm lấy ngón tay {xung}.', 'long'],
    ['H2-05', 'Có tiếng con cười khe khẽ. Không cần thấy rõ, chỉ cần nghe.', 'long'],
    ['H2-06', 'Người thương của {xung} ở ngay bên cạnh. Ngôi nhà ấm hơn một chút.', 'long'],
    ['H2-07', 'Đó là điều {xung} mong, và là thương yêu {xung} đang có. Dù chặng đường đi thế nào, thương yêu ấy vẫn ở đây.', 'breath3'],
    ['H2-08', 'Để hình ảnh nhạt dần. Chúc {xung} ngủ ngon nhé.', null]
  ], ['H2-01'], ['H2-07']);

  /* ===== H3 🤝 Hai ta bên nhau (~5 phút 30) — không có em bé ===== */
  const H3 = B([
    // Phần 1 – Vào bài (safety_open)
    ['H3-01', 'Tối nay mình không nói về kết quả, không nói về chu kỳ. Chỉ có hai người, và một chút yên.', 'short'],
    ['H3-02', 'Hình ảnh mờ cũng được. Thấy khó chịu thì mở mắt, thở tự nhiên, hoặc dừng. Không sao cả.', 'short'],
    ['H3-03', 'Nằm cạnh nhau, hoặc tựa vào nhau. Nếu muốn, nắm tay nhau. Nếu {nt} không ở cạnh, {xung} chỉ cần nghĩ tới họ.', 'breath3'],
    ['H3-04', 'Thở bình thường. Không cần thở theo nhau. Cứ để mỗi người một nhịp.', 'breath3'],
    // Phần 2 – Một nơi hai người từng thấy yên
    ['H3-05', 'Nhớ lại một lúc hai người từng thấy bình yên bên nhau. Một chuyến đi, một buổi chiều, một bữa ăn vỉa hè. Lúc nào cũng được.', 'long'],
    ['H3-06', 'Lúc đó trời thế nào? Có gió không, có nắng không?', 'breath3'],
    ['H3-07', 'Lúc đó hai người nói chuyện gì, hay chỉ ngồi im? Có tiếng cười nào không?', 'long'],
    ['H3-08', 'Hai người lúc ấy vẫn là hai người bây giờ. Chặng đường dài thêm, nhưng vẫn là hai ta.', 'long'],
    // Phần 3 – Đi cùng nhau
    ['H3-09', 'Giờ hình dung hai người đang đi trên một con đường. Có đoạn bằng, có đoạn dốc.', 'breath3'],
    ['H3-10', 'Đến đoạn dốc, một người đi chậm lại. Người kia cũng chậm lại theo. Không ai bỏ ai đi trước.', 'long'],
    ['H3-11', 'Có lúc một người mệt hơn. Có lúc người kia mệt hơn. Mệt khác nhau, buồn khác nhau, không có nghĩa là thương nhau ít hơn.', 'long'],
    // Phần 4 – Dù thế nào (close_whatever)
    ['H3-12', 'Dù chặng đường phía trước đi thế nào, tối nay hai người vẫn ở đây, cạnh nhau.', 'breath3'],
    ['H3-13', 'Nếu muốn, siết nhẹ tay người kia một cái. Không cần nói gì.', 'long'],
    ['H3-14', 'Giờ không còn việc gì phải làm nữa. Ngủ ngon nhé, hai bạn.', null]
  ], ['H3-01', 'H3-02', 'H3-03', 'H3-04'], ['H3-12', 'H3-13', 'H3-14']);

  /* ===== H4 🫶 Bàn tay ấm (~7 phút; bản ngày = H4-01…H4-10 + một câu) — không có em bé ===== */
  const H4 = B([
    // Phần 1 – Vào bài (safety_open)
    ['H4-01', 'Mình ở đây với {xung}. Hôm nay có thể là một ngày rất khó.', 'breath3'],
    ['H4-02', '{Xung} không cần làm gì đúng cả. Không cần thấy khá hơn sau bài này.', 'short'],
    ['H4-03', 'Nếu có lúc {xung} muốn dừng, cứ dừng. Nếu có ý nghĩ làm hại bản thân, hãy mở trang Hỗ trợ, hoặc gọi 115, hoặc nói với người ở gần.', 'short'],
    ['H4-04', 'Nằm hoặc ngồi, kiểu nào cũng được. Thở bình thường thôi.', 'breath3'],
    // Phần 2 – Bàn tay
    ['H4-05', 'Nếu thấy hợp, đặt một bàn tay lên ngực, chỗ giữa ngực. Hoặc đặt lên má, lên cánh tay mình. Chỗ nào cũng được.', 'breath3'],
    ['H4-06', 'Cảm nhận hơi ấm của bàn tay. Chỉ vậy thôi. Như một người đang ngồi cạnh {xung}.', 'long'],
    // Phần 3 – Gọi tên
    ['H4-07', 'Nói thầm với mình: "Đây là lúc rất khó."', 'breath3'],
    ['H4-08', '"Mình đang buồn." Hay "mình đang giận", "mình đang trống rỗng". Từ nào đúng với {xung} thì dùng từ đó.', 'long'],
    ['H4-09', 'Buồn, giận, trống rỗng, hay chẳng thấy gì cả, đều là phản ứng dễ hiểu sau một tin như thế. Không có cách buồn nào là sai.', 'breath3'],
    ['H4-10', 'Nhiều người trên chặng đường này cũng đã từng ngồi ở đúng chỗ {xung} đang ngồi. {Xung} không phải một mình.', 'long'],
    // Phần 4 – Một chỗ ấm
    ['H4-11', 'Hình dung một tấm chăn mỏng, ấm, phủ nhẹ lên vai {xung}. Không nặng. Vừa đủ ấm.', 'long'],
    ['H4-12', 'Hay một ánh đèn vàng nhỏ trong căn phòng tối. Không chói. Chỉ đủ để biết mình không ở trong bóng tối hoàn toàn.', 'long'],
    ['H4-13', 'Nếu có một người thương {xung} vô điều kiện, người đó sẽ nói gì với {xung} lúc này? Có thể không nói gì, chỉ ngồi cạnh.', 'long'],
    ['H4-14', 'Thử nói câu đó với chính mình. Hoặc câu này: "Mình được phép buồn. Mình được phép nghỉ."', 'long'],
    // Phần 5 – Ra bài (close_whatever)
    ['H4-15', 'Đêm nay {xung} không cần mạnh mẽ. Không cần quyết định gì cả.', 'breath3'],
    ['H4-16', 'Sáng mai thức dậy, nếu nỗi buồn vẫn còn, nó được phép còn. Mình vẫn ở đây.', 'breath3'],
    ['H4-17', 'Nếu nỗi buồn nặng quá, hay kéo dài nhiều ngày, hãy tìm một người để nói. Trang Hỗ trợ luôn ở góc trên màn hình.', 'short'],
    ['H4-18', 'Giờ để bàn tay nghỉ. Ngủ được thì ngủ, chưa ngủ được cũng không sao.', null]
  ], ['H4-01', 'H4-02', 'H4-03', 'H4-04'], ['H4-15', 'H4-16', 'H4-17', 'H4-18']);

  const POSTURE = 'Nằm hoặc ngồi tựa, kiểu nào thoải mái nhất.';
  const SCRIPTS = {
    NIGHT_HOME: Object.assign({ id: 'NIGHT_HOME', code: 'H1', title: 'Ngôi nhà có tiếng cười', icon: '🏡', hasBaby: true, minutes: 10,
      goal: 'Một buổi sáng yên, có con và người thương.', posture: POSTURE, blocks: H1, audio: [] }, REVIEW()),
    NIGHT_HOME_SHORT: Object.assign({ id: 'NIGHT_HOME_SHORT', code: 'H2', title: 'Ngôi nhà có tiếng cười – bản ngắn', icon: '🌙', hasBaby: true, minutes: 3,
      goal: 'Một buổi sáng yên, có con và người thương.', posture: POSTURE, blocks: H2, audio: [] }, REVIEW()),
    // xungMode 'pair': {xung} = "hai bạn" khi Đọc cho nhau nghe hoặc mở từ mục Hai ta (kịch bản H3)
    NIGHT_TOGETHER: Object.assign({ id: 'NIGHT_TOGETHER', code: 'H3', title: 'Hai ta bên nhau', icon: '🤝', hasBaby: false, minutes: 5.5, xungMode: 'pair',
      goal: 'Nhớ lại một lúc hai người từng thấy yên.', posture: POSTURE, blocks: H3, audio: [] }, REVIEW()),
    NIGHT_WARM_HAND: Object.assign({ id: 'NIGHT_WARM_HAND', code: 'H4', title: 'Bàn tay ấm', icon: '🫶', hasBaby: false, minutes: 7,
      goal: 'Cho những ngày rất khó', posture: POSTURE, blocks: H4, audio: [] }, REVIEW()),
    // B8 ban ngày (players.js qua api.paced): khối H4-01…H4-10 + một câu kết của kịch bản. Không phải bài đêm, không có trong M13.
    WARM_HAND_DAY: Object.assign({ id: 'WARM_HAND_DAY', code: 'H4d', title: 'Bàn tay ấm – bản ngày', icon: '🫶', hasBaby: false, minutes: 4, day: true,
      from: 'NIGHT_WARM_HAND', range: ['H4-01', 'H4-10'],
      extra: [{ id: 'H4-D1', text: 'Mình được phép buồn. Khi nào sẵn sàng, mình làm việc tiếp theo nhé.', pause: null, tags: [] }],
      blocks: null, audio: [] }, REVIEW())
  };
  // Bản ngày: dựng khối từ H4 theo range + extra (một nguồn câu, không chép hai lần)
  (d => {
    const src = SCRIPTS[d.from].blocks, a = src.findIndex(b => b.id === d.range[0]), z = src.findIndex(b => b.id === d.range[1]);
    d.blocks = src.slice(a, z + 1).map(b => Object.assign({}, b, { tags: b.tags.slice() })).concat(d.extra);
  })(SCRIPTS.WARM_HAND_DAY);

  return {
    PACE: { WPS: 2.5, short: 5000, breath3: 15000, long: 20000 },
    // "Đọc cho nhau nghe": dấu dừng thành chữ (PRD A.6, UX M14r)
    PAUSE_LABEL: { short: '· dừng một hơi thở ·', breath3: '· dừng ba hơi thở ·', long: '· dừng lâu, không cần vội ·' },
    // Thứ tự bài đêm trong M13 "Mọi bài"
    NIGHT_ORDER: ['NIGHT_HOME', 'NIGHT_HOME_SHORT', 'NIGHT_TOGETHER', 'NIGHT_WARM_HAND'],
    SCRIPTS,
    // Màn "Bài này làm mình nặng lòng" (kịch bản 0.5; câu thay cho bài không có em bé: PRD A.6)
    HEAVY: Object.assign({
      title: 'Mình dừng ở đây nhé.',
      lines: ['Có những tối, nghĩ về con lại làm lòng nặng thêm. Điều đó không có gì sai.', '{Xung} thở tự nhiên thôi. Không cần làm gì thêm.'],
      noBabyLine: 'Có những tối, lòng nặng hơn mình nghĩ. Điều đó không có gì sai.',
      warmHand: 'Nghe bài "Bàn tay ấm" ›', support: 'Mở trang Hỗ trợ'
    }, REVIEW()),
    // Chữ các màn đêm (PRD 6.5, A.6; UX 4.5). Câu [N] của UX chờ anh duyệt qua van-phong-bs-thong.
    UI: {
      nightLead: 'Tối nay mình nằm xuống, để ngày trôi qua nhé.',
      // V6, AC-46 — câu cố định duy nhất được nhắc "khả năng có thai"
      noPromise: 'Bài hình dung là để lòng dịu lại trước khi ngủ. Nó không làm tăng hay giảm khả năng có thai.',
      suggested: 'Gợi ý tối nay', others: 'Các bài khác', othersLoss: 'Các bài khác (có bài nói về con)',
      tagBaby: '💭 Có nhắc về con', tagNoBaby: 'Không nhắc về con',
      empty: 'Các bài đang chờ duyệt nội dung. Trong lúc chờ, {xung} có thể thở tự nhiên, hoặc mở trang Hỗ trợ.',
      confirmTitle: 'Bài này nói về con', confirmBody: 'Bài này nói về con. {Xung} có muốn nghe lúc này không?',
      confirmLater: 'Để lúc khác', confirmGo: 'Vẫn nghe',
      gateQ: 'Tối nay, nghĩ về con làm {xung} thấy ấm lòng hay nặng lòng?',
      gateWarm: 'Ấm lòng ›', gateHeavy: 'Nặng lòng', gateUnsure: 'Chưa chắc', gateClose: 'Quay lại danh sách',
      afterHeavy: 'Cảm ơn {xung} đã nói thật. Tối nay mình chọn một bài không nhắc về con nhé.',
      afterUnsure: 'Vậy tối nay mình thử một bài nhẹ hơn nhé.',
      howTitle: 'Mình nghe thế nào?',
      howPace: '📖 Tự đọc theo nhịp', howPaceSub: 'Chữ hiện từng đoạn. Chạm để sang sớm.',
      howRead: '🤝 Đọc cho nhau nghe', howReadSub: 'Một người đọc chậm, người kia nhắm mắt nghe. Chỗ có dấu ‹dừng› thì im lặng đếm hơi thở.',
      howVoice: '🎧 Nghe giọng thật',
      listener: 'Gọi người nghe là:',
      music: 'Nhạc nền', musicKinds: { waves: '🌊 Sóng', rain: '🌧️ Mưa', wind: '🍃 Gió êm' }, volume: 'Âm lượng', timer: 'Hẹn giờ tắt:',
      soundFail: 'Máy này chưa phát được âm thanh. Bài vẫn chạy bình thường, không có nhạc nhé.',
      musicIos: 'Trên một số điện thoại, nhạc có thể tự tắt khi khóa màn.',
      noWake: 'Màn có thể tự tắt khi đang đọc. Chạm màn để sang đoạn kế là được nhé.',
      start: 'Bắt đầu ›',
      tapHint: 'Chạm màn để sang đoạn kế', paused: 'Đang tạm dừng.',
      pause: '❚❚ Tạm dừng', resume: '▶ Đọc tiếp', resumeAuto: '▶ Tiếp tục', dim: '🌗 Chữ dịu hơn', musicOff: 'Tắt nhạc',
      natural: 'Dừng, về thở tự nhiên', heavy: 'Bài này làm mình nặng lòng',
      naturalText: 'Mình dừng ở đây. Thở như bình thường thôi.', readOn: 'Đọc tiếp từ đoạn này', endNow: 'Kết thúc bài',
      readHowTitle: 'Cách đọc',
      readHow: 'Đọc chậm bằng nửa tốc độ nói thường, giọng nhỏ, như kể chuyện cho người sắp ngủ. Không cần đúng từng chữ. Chỗ ‹dừng› thì im. Người nghe ngủ thiếp đi giữa chừng cũng được, đọc tiếp thật nhỏ hoặc dừng.',
      readDone: 'Đọc xong ✓', play: '▶ Nghe',
      endQ: 'Tối nay thế nào?', better: 'Dễ chịu hơn', same: 'Như cũ', heavier: 'Nặng lòng hơn', skip: 'Bỏ qua, đi ngủ',
      bye: 'Chúc {xung} ngủ ngon nhé.', home: 'Về trang chính',
      tileSub: 'Một bài dịu cho tối nay', tileSubLoss: 'Bàn tay ấm cho tối nay'
    }
  };
})();
