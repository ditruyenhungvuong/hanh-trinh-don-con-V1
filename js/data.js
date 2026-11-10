/* =========================================================
   Hành Trình Đón Con – js/data.js · window.HTDC_DATA · Chủ: FE-2 Luật & nội dung (T-02)
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 2, 5.3, 8, 13; PRD v0.3 mục 3.6, 6.1–6.7, 8, phụ lục A;
           UX docs/specs/hiem-muon-ux.md mục 4, 10.
   Nguồn bài B1–B4, B7: apps/lifestyle-thai-phu/js/data.js @ 10/11/2026 (đổi lời cho người đang điều trị hiếm muộn).
   Mọi nội dung là 'draft' (status, reviewer, reviewedAt) tới khi anh Thông và Tổ tâm lý duyệt (PRD câu 21).
   Câu chữ an toàn (CARDS có safety:true, TEXT 'safety.*') LUÔN hiện dù draft (K-14).
   {xung} / {Xung} = chị / anh / bạn (api.say thay). Không số điện thoại nào ngoài 115 (AC-32).
   Không DOM, không storage. Nạp sau util.js, trước keywords.js, engine.js.
   ========================================================= */
window.HTDC_DATA = (() => {
  'use strict';

  /* ===== Trạng thái duyệt mặc định (PRD 8.8) ===== */
  const REVIEW = { status: 'draft', reviewer: '', reviewedAt: '' };
  const rv = o => Object.assign({}, REVIEW, o);

  /* ===== Giai đoạn (PRD 3.6) — desc là cột "Gồm" ===== */
  const STAGES = [
    { code: 'start', icon: '🌱', label: 'Mới bắt đầu tìm hiểu', desc: 'Mới khám, làm xét nghiệm, chờ quyết định điều trị' },
    { code: 'cycle', icon: '💉', label: 'Đang trong chu kỳ', desc: 'Kích trứng, chọc hút, IUI, chuyển phôi' },
    { code: 'waiting', icon: '⏳', label: 'Đang chờ kết quả', desc: 'Hai tuần chờ sau chuyển phôi hoặc IUI; chờ một kết quả khác' },
    { code: 'after_loss', icon: '🌧️', label: 'Sau một tin buồn', desc: 'Âm tính, sẩy, không có phôi chuyển, chu kỳ dừng giữa chừng' },
    { code: 'pause', icon: '🍃', label: 'Đang tạm nghỉ', desc: 'Nghỉ giữa các chu kỳ, đang cân nhắc làm tiếp hay dừng' },
    { code: 'positive', icon: '🌤️', label: 'Có tin vui, mà vẫn lo', desc: 'Có thai sau điều trị' },
    { code: 'none', icon: '🤍', label: 'Không muốn nói', desc: '' }
  ];

  /* ===== Vai → xưng hô (PRD 6.1 phương án B; UX A.2) ===== */
  const ROLES = [
    { code: 'wife', label: 'Vợ', xung: 'chị', hint: 'mình sẽ gọi là "chị"' },
    { code: 'husband', label: 'Chồng', xung: 'anh', hint: 'mình sẽ gọi là "anh"' },
    { code: 'solo', label: 'Mình đi một mình', xung: 'bạn', hint: 'gọi là "bạn"' },
    { code: 'none', label: 'Không muốn nói', xung: 'bạn', hint: 'gọi là "bạn"' }
  ];

  /* ===== Thẻ cảm xúc (PRD 3.7, 6.3; U2) =====
     img: ảnh capybara qua C.ASSET_BASE (Check-in Mẹ Bầu); null → thẻ emoji có chữ.
     group (luật 8.3): calm_first = làm dịu trước · grief = đồng hành đau buồn · connect = kết nối · tired · easy · self_blame · unsure.
     shuffle:false → "Chưa rõ" luôn ở ô cuối, không xáo (L-1). */
  const EMOTIONS = [
    { code: 'vui_ve', label: 'Vui vẻ', img: 'vui_ve.png', emoji: '😊', group: 'easy' },
    { code: 'dau_kho', label: 'Đau khổ', img: 'dau_kho.png', emoji: '😢', group: 'grief' },
    { code: 'lo_lang', label: 'Lo lắng', img: 'lo_lang.png', emoji: '😟', group: 'calm_first' },
    { code: 'tuc_gian', label: 'Tức giận', img: 'tuc_gian.png', emoji: '😠', group: 'calm_first' },
    { code: 'hoang_hot', label: 'Hoảng hốt', img: 'hoang_hot.png', emoji: '😨', group: 'calm_first' },
    { code: 'kho_chiu', label: 'Khó chịu', img: 'kho_chiu.png', emoji: '😣', group: 'calm_first' },
    { code: 'met_moi', label: 'Mệt mỏi', img: 'met_moi.png', emoji: '😩', group: 'tired' },
    { code: 'binh_an', label: 'Bình an', img: 'binh_an.png', emoji: '😌', group: 'easy' },
    { code: 'co_don', label: 'Cô đơn', img: 'co_don.png', emoji: '🥺', group: 'connect' },
    { code: 'self_blame', label: 'Tự trách', img: null, emoji: '😔', group: 'self_blame', showLabel: true },
    { code: 'unsure', label: 'Chưa rõ', img: null, emoji: '💭', group: 'unsure', showLabel: true, shuffle: false }
  ];

  /* ===== Chip tình huống ở M07 (PRD M07). engine dùng: couple (R5), sleep (R7) ===== */
  const CONTEXTS = [
    { code: 'visit', label: 'Vừa đi khám' },
    { code: 'procedure', label: 'Sắp làm thủ thuật' },
    { code: 'waiting', label: 'Đang chờ kết quả' },
    { code: 'news', label: 'Sau khi nghe tin' },
    { code: 'relatives', label: 'Họ hàng hỏi han' },
    { code: 'money', label: 'Chuyện tiền bạc' },
    { code: 'couple', label: 'Giữa hai vợ chồng' },
    { code: 'sleep', label: 'Khó ngủ' },
    { code: 'other', label: 'Khác' }
  ];

  const MINUTES = [1, 3, 5, 10];
  const FITS = [
    { code: 'fit', label: 'Phù hợp' }, { code: 'unfit', label: 'Không phù hợp' },
    { code: 'worse', label: 'Khó chịu hơn' }, { code: 'unsure', label: 'Chưa chắc' }
  ];
  // Check-out một chạm cuối bài đêm (PRD M14)
  const NIGHT_OUTCOMES = [
    { code: 'better', label: 'Dễ chịu hơn' }, { code: 'same', label: 'Như cũ' },
    { code: 'heavier', label: 'Nặng lòng hơn' }, { code: 'skip', label: 'Bỏ qua, đi ngủ' }
  ];
  // M21 "Mình vừa có kết quả": 4 lựa chọn ngang hàng; to = giai đoạn mới (null = giữ nguyên)
  const RESULTS = [
    { code: 'good', icon: '🌤️', label: 'Tin vui', to: 'positive' },
    { code: 'loss', icon: '🌧️', label: 'Chưa như mong đợi', to: 'after_loss' },
    { code: 'wait', icon: '⏳', label: 'Phải chờ thêm', to: null },
    { code: 'none', icon: '', label: 'Không muốn nói', to: null }
  ];

  /* ===== Thư viện bài (PRD 6.4, UX M09b, M10) =====
     type = tên trình phát trong players.js (FE-4). screen = route mở bài (validate kiểm màn có thật, A1/A2).
     needsWriting: bài cần viết → bỏ khỏi gợi ý khi mức 1–3 (K-6). KHÔNG bài nào có holdsBreath (AC-36). */
  const POSTURE = 'Ngồi tựa hoặc nằm, kiểu nào thoải mái.';
  const EXERCISES = {
    PAUSE5: rv({
      id: 'PAUSE5', code: 'B1', title: 'Dừng 5 giây', short: 'Dừng 5 giây', icon: '✋', type: 'pause5', screen: 'player',
      min: 0.5, max: 0.5, group: 'calm', needsWriting: false,
      goal: 'Ngắt vòng lo một nhịp.',
      safety: 'Bước nào không hợp thì bỏ qua nhé.',
      steps: [
        { icon: '✋', title: 'Dừng lại', text: '{Xung} tạm dừng việc đang làm vài giây.' },
        { icon: '😌', title: 'Thả lỏng vai và hàm', text: 'Vai hạ xuống, hàm mềm ra, răng không chạm nhau.' },
        { icon: '🌬️', title: 'Một hơi thở tự nhiên', text: 'Chỉ cần biết một hơi vào, một hơi ra. Không cần đổi gì.' },
        { icon: '👀', title: 'Nhìn quanh', text: 'Lúc này mình đang ở đâu, đang thấy gì?' },
        { icon: '🧭', title: 'Chọn bước tiếp', text: 'Mình cần gì: nghỉ một chút, kể với ai đó, hay một bài dài hơn?' }
      ],
      end: '{Xung} vừa dừng lại một nhịp. Vậy là đủ rồi.'
    }),
    BREATHE_46: rv({
      id: 'BREATHE_46', code: 'B2', title: 'Thở chậm 4 vào – 6 ra', short: 'Thở chậm 4–6', icon: '🐉', type: 'breath46', screen: 'player',
      min: 2, max: 5, group: 'calm', needsWriting: false,
      goal: 'Nhịp thở chậm, đều.',
      safety: 'Không nín hơi. Thấy chóng mặt thì thở tự nhiên.',
      lead: ['Hít vào nhẹ bằng mũi, như bé rồng lấy hơi.', 'Thở ra chậm, như thổi cho chong chóng quay thật lâu.',
        'Hơi thở ra hết thì thôi. Không giữ hơi lại, không cố thêm.'],
      // Hai pha, không có pha giữ (AC-36). Không có "Chậm hơn" (PRD 3.7).
      phases: [{ code: 'in', label: 'Hít vào nhẹ…', sec: 4 }, { code: 'out', label: 'Thở ra thật chậm…', sec: 6 }],
      paces: [{ code: 'short', label: 'Ngắn hơn', factor: 0.75 }, { code: 'suggest', label: 'Gợi ý', factor: 1 }],
      durations: [2, 3, 5],
      fine: 'Vòng tròn chỉ là gợi ý. Nhịp không hợp thì chọn Ngắn hơn, hoặc thở theo nhịp của mình.',
      end: 'Xong rồi. {Xung} thở tự nhiên thêm vài hơi nhé.'
    }),
    GROUND_54321: rv({
      id: 'GROUND_54321', code: 'B3', title: 'Về với lúc này 5-4-3-2-1', short: 'Về với lúc này', icon: '🌿', type: 'grounding', screen: 'player',
      min: 3, max: 3, group: 'calm', needsWriting: false,
      goal: 'Kéo chú ý về các giác quan.',
      safety: 'Bước nào khó thì bỏ qua.',
      // Không có bước tìm cảm giác bên trong người (PRD 8.4, câu Forsyth & Eifert)
      steps: [
        { n: 5, icon: '👀', title: 'Nhìn', text: 'Tìm 5 thứ {xung} nhìn thấy: một màu, một hình dạng, một vệt nắng…' },
        { n: 4, icon: '✋', title: 'Chạm', text: '4 đồ vật quanh mình: vải áo, tay ghế, mặt bàn, bàn chân chạm sàn…' },
        { n: 3, icon: '👂', title: 'Nghe', text: '3 âm thanh quanh {xung}, gần hoặc xa.' },
        { n: 2, icon: '👃', title: 'Ngửi', text: '2 mùi. Hoặc chỉ để ý không khí mát đi qua mũi.' },
        { n: 1, icon: '🍵', title: 'Nếm, hoặc một điều dễ chịu', text: '1 vị trong miệng, hoặc một điều nhỏ làm {xung} dễ chịu lúc này.' }
      ],
      skip: 'Bước này khó? Bỏ qua',
      fine: 'Chạm một chấm mỗi khi {xung} nhận ra một điều. Không cần tìm cho đủ.',
      end: '{Xung} đang ở đây, lúc này. Khác hay không khác đều ổn.'
    }),
    RELEASE: rv({
      id: 'RELEASE', code: 'B4', title: 'Thả lỏng từng vùng', short: 'Thả lỏng từng vùng', icon: '💆', type: 'release', screen: 'player',
      min: 5, max: 8, group: 'calm', needsWriting: false,
      goal: 'Thả cơ đang gồng.',
      safety: 'Bụng chỉ thả lỏng, không siết, nhất là quanh ngày chọc hút, chuyển phôi.',
      // Mọi vùng CHỈ thả lỏng (không pha gồng): hợp với người vừa làm thủ thuật. Thứ tự theo UX M10.
      zones: [
        { code: 'shoulders', title: 'Vai', text: 'Để vai rơi xuống, rời xa tai.' },
        { code: 'jaw', title: 'Hàm và mặt', text: 'Thả lỏng trán, mắt, hàm. Răng không chạm nhau.' },
        { code: 'hands', title: 'Tay', text: 'Mở bàn tay ra, để cánh tay nặng xuống.' },
        { code: 'legs', title: 'Chân', text: 'Để hai chân nặng xuống, bàn chân thả tự nhiên.' },
        { code: 'belly', title: 'Bụng', text: 'Để bụng mềm ra. Không hóp, không gồng. Thở tự nhiên.' }
      ],
      next: 'Tiếp ›', skipZone: 'Bỏ qua vùng này',
      end: 'Xong rồi. {Xung} để cả người nghỉ thêm vài hơi thở nhé.'
    }),
    THOUGHT_CLOUD: rv({
      id: 'THOUGHT_CLOUD', code: 'B5', title: 'Đặt tên suy nghĩ', short: 'Đặt tên suy nghĩ', icon: '☁️', type: 'cloud', screen: 'player',
      min: 3, max: 3, group: 'thought', needsWriting: true, maxLen: 200,
      goal: 'Nhìn suy nghĩ là suy nghĩ, không cãi.',
      safety: 'Không cần đuổi suy nghĩ đi.',
      chips: ['Lần này lại không được', 'Tại mình', 'Mình làm sai gì rồi'],
      placeholder: 'Mình cứ nghĩ…',
      nameBtn: 'Gọi tên ›',
      frame: 'Mình đang có suy nghĩ rằng {x}',
      releaseBtn: 'Thả lên mây ☁️',
      end: 'Suy nghĩ ấy vẫn có thể quay lại. Mỗi lần quay lại, mình lại gọi tên nó nhé.',
      again: 'Gọi tên thêm một suy nghĩ'
    }),
    KNOW_UNKNOWN: rv({
      id: 'KNOW_UNKNOWN', code: 'B6', title: 'Biết chắc – Chưa biết – Việc mình làm được', short: 'Biết chắc – Chưa biết', icon: '🧭',
      type: 'knowUnknown', screen: 'player', min: 3, max: 5, group: 'thought', needsWriting: true, maxItems: 5, maxLen: 120,
      goal: 'Tách điều đã biết khỏi điều chưa biết; chọn một việc nhỏ hôm nay.',
      safety: 'Không cần trả lời đủ ba ô.',
      boxes: [
        { code: 'know', title: 'Biết chắc', chips: ['Ngày … mình sẽ biết kết quả', 'Ai sẽ báo cho mình'] },
        { code: 'unknown', title: 'Chưa biết', chips: ['Kết quả'] },
        { code: 'todo', title: 'Việc mình làm được hôm nay', chips: ['Nấu một bữa cùng nhau', 'Đi bộ nhẹ mười phút nếu bác sĩ cho phép', 'Gọi cho một người bạn tin'] }
      ],
      searchCard: 'Tra mạng giúp {xung} yên được bao lâu? Thử chọn một hai nguồn bác sĩ giới thiệu, đặt một khung giờ, và nhờ người thương trả lời giúp những lời hỏi thăm.',
      sendBtn: 'Gửi việc này cho người thương 💌',
      end: 'Xong rồi. Ô nào để trống cũng không sao.'
    }),
    CALM_SOUND: rv({
      id: 'CALM_SOUND', code: 'B7', title: 'Âm thanh êm dịu', short: 'Âm thanh êm dịu', icon: '🎧', type: 'calmSound', screen: 'player',
      min: 5, max: 15, group: 'rest', needsWriting: false,
      goal: 'Nghỉ, không cần làm gì.',
      safety: 'Âm lượng vừa phải.',
      sounds: [{ code: 'waves', icon: '🌊', label: 'Sóng' }, { code: 'rain', icon: '🌧️', label: 'Mưa' }, { code: 'wind', icon: '🍃', label: 'Gió êm' }],
      timers: [5, 10, 15], defaultTimer: 10, defaultVolume: 30,
      fine: 'Âm lượng vừa phải nhé.',
      end: 'Hết giờ rồi. {Xung} nằm thêm một chút nếu thích nhé.'
    }),
    // Bản ngày của H4 (khối H4-01…H4-10 + một câu kết, scripts.js WARM_HAND_DAY), nền sáng, qua api.paced
    WARM_HAND_DAY: rv({
      id: 'WARM_HAND_DAY', code: 'B8', title: 'Bàn tay ấm – bản ngày', short: 'Bàn tay ấm', icon: '🫶', type: 'warmHandDay', screen: 'player',
      scriptId: 'WARM_HAND_DAY', min: 4, max: 4, group: 'rest', needsWriting: false,
      goal: 'Ở cạnh nỗi buồn một lúc, với một bàn tay ấm.',
      safety: 'Không cần làm gì đúng. Muốn dừng lúc nào cũng được.'
    }),
    /* ----- A2: Hai ta (PRD 6.6). Chưa có màn ở A1 → validate bỏ. ----- */
    STOP5_TOGETHER: rv({ id: 'STOP5_TOGETHER', code: 'C1', title: 'DỪNG 5 cho hai ta', icon: '🧭', type: 'together', screen: 'together_stop5',
      min: 10, max: 10, group: 'together', needsWriting: false,
      goal: 'Năm chặng nhỏ: dừng, thở, gọi tên, nói và nghe, hũ bình an.', safety: 'Chặng nào cũng bỏ qua được.' }),
    BREATHE_TOGETHER: rv({ id: 'BREATHE_TOGETHER', code: 'C2', title: 'Thở cùng nhịp', icon: '🌬️', type: 'together', screen: 'together_breathe',
      min: 2, max: 3, group: 'together', needsWriting: false,
      goal: 'Ngồi cạnh nhau, thở chậm theo một vòng tròn.', safety: 'Không nín hơi. Lệch nhịp một chút cũng không sao.' }),
    THREE_QUESTIONS: rv({ id: 'THREE_QUESTIONS', code: 'C3', title: 'Ba câu cho nhau', icon: '💬', type: 'together', screen: 'together_talk',
      min: 4, max: 6, group: 'together', needsWriting: false,
      goal: 'Một người nói, người kia chỉ nghe.', safety: 'Không cần nói đủ hai phút.' }),
    SEND_WORDS: rv({ id: 'SEND_WORDS', code: 'C4', title: 'Gửi lời cho người thương', icon: '💌', type: 'together', screen: 'send_words',
      min: 1, max: 1, group: 'together', needsWriting: false,
      goal: 'Chọn một câu hoặc tự viết, xem lại rồi mới gửi.', safety: 'App không biết, không lưu người nhận.' })
  };
  const LIBRARY_ORDER = ['PAUSE5', 'BREATHE_46', 'GROUND_54321', 'RELEASE', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN', 'CALM_SOUND', 'WARM_HAND_DAY'];
  const LIBRARY_GROUPS = [
    { code: 'calm', title: 'Khi lòng đang chạy' },
    { code: 'thought', title: 'Khi suy nghĩ cứ lặp' },
    { code: 'rest', title: 'Nghỉ một chút' }
  ];

  /* ===== Thẻ trên M09 (engine trả mã, theo thứ tự PRD 8.1) — safety:true = luôn hiện dù draft (K-14) ===== */
  const CARDS = {
    need_doctor: rv({ safety: true, title: 'Chuyện này cần bác sĩ',
      text: 'Nếu cơ thể có dấu hiệu bất thường mà bác sĩ đã dặn phải báo, {xung} gọi ngay cơ sở điều trị. Nguy hiểm ngay thì gọi 115.',
      call: '📞 Gọi 115', callClinic: 'Gọi khoa điều trị' }),
    not_alone: rv({ safety: true, title: '{Xung} không phải một mình.',
      text: 'Điều {xung} đang trải qua có thể nặng hơn mức một app đỡ được. Bệnh viện có người sẵn lòng nghe.',
      btn: 'Xem các cách tìm hỗ trợ ›' }),
    self_blame_ack: rv({ safety: true, text: 'Chuyện này làm {xung} nặng lòng lắm phải không?' }),
    ask_stage_change: rv({ safety: true,
      text: 'Có vẻ {xung} vừa đi qua một mất mát. {Xung} có muốn đổi chặng đường sang 🌧️ Sau một tin buồn không? Khi đó mình sẽ cất các bài nói về con đi.',
      btn: 'Đổi sang 🌧️', keep: 'Để như cũ' }),
    two_weeks: rv({ safety: true, text: 'Nếu cảm giác này kéo dài hơn hai tuần, {xung} nói với bác sĩ điều trị nhé.' }),
    go_night: rv({ safety: false, text: '🌙 Sắp tới giờ ngủ rồi. Sang Trước khi ngủ ›' })
  };

  /* ===== Thẻ "Điều nên biết" theo giai đoạn (PRD 3.6; "bạn" của PRD → {xung}) ===== */
  const STAGE_CARDS = {
    start: rv({ id: 'know_start', text: 'Buồn, lo, giận là thường gặp, ở cả vợ lẫn chồng. Mỗi người chịu đựng một cách; khác nhau không có nghĩa là không thương nhau.' }),
    cycle: rv({ id: 'know_cycle', text: 'Những ngày chọc hút, chuyển phôi thường là lúc căng nhất. Thấy căng là phản ứng dễ hiểu. Vận động, nghỉ ngơi quanh ngày thủ thuật: theo dặn của bác sĩ điều trị nhé.' }),
    waiting: rv({ id: 'know_waiting', text: 'Chờ mà chưa biết là lúc khó nhất với nhiều người. Căng thẳng không phải lỗi của {xung}. Nghiên cứu chưa thấy lo âu trước điều trị làm giảm khả năng có thai. Căng thẳng vẫn đáng được chăm sóc.' }),
    after_loss: rv({ id: 'know_after_loss', text: '{Xung} có quyền nghỉ, hỏi lại, và chưa quyết ngay chặng tiếp theo. Nỗi buồn sau tin này có thể kéo dài nhiều tuần. Nếu nặng quá, có người sẵn lòng nghe {xung}.' }),
    pause: rv({ id: 'know_pause', text: 'Nghỉ, làm tiếp hay dừng đều là lựa chọn được bàn với bác sĩ. Hôm nay chưa cần quyết.' }),
    positive: rv({ id: 'know_positive', text: 'Có thai sau chặng đường dài mà vẫn lo là chuyện nhiều người gặp.' })
  };

  /* ===== Lời chào M05 theo giai đoạn (PRD A.3, UX 10.2) — không chữ "con" ở after_loss ===== */
  const GREETINGS = rv({
    start: { h1: 'Chào {xung}', text: 'Mới bắt đầu thì có nhiều điều chưa rõ. Mình đi từng bước nhỏ thôi nhé.' },
    cycle: { h1: 'Chào {xung}', text: 'Những ngày này cơ thể và lòng {xung} đều làm việc nhiều. Mình nghỉ một chút nhé.' },
    waiting: { h1: 'Chào {xung}', text: 'Hôm nay là một ngày chờ nữa. Mình làm một việc nhỏ cho lòng nhẹ hơn nhé.' },
    after_loss: { h1: 'Mình ở đây với {xung}', text: 'Hôm nay {xung} không cần làm gì cả. Muốn thì mình ngồi cạnh nhau một chút.' },
    pause: { h1: 'Chào {xung}', text: 'Nghỉ cũng là một phần của chặng đường. Hôm nay chưa cần quyết gì đâu.' },
    positive: { h1: 'Chào {xung}', text: 'Vui mà vẫn lo là chuyện nhiều người gặp. Mình thở chậm cùng {xung} nhé.' },
    none: { h1: 'Chào {xung}', text: 'Lúc này mình làm một việc nhỏ cho lòng nhẹ hơn nhé.' },
    evening: 'Tối rồi. Nếu muốn, mình cùng chuẩn bị đi ngủ nhé.'
  });

  /* ===== Thói quen (PRD 6.7) — A2 dùng. no_smoke tắt mặc định (câu 17). auto: sự kiện tự đánh dấu (AC-62) ===== */
  const HABITS = [
    { code: 'sleep', icon: '🌙', label: 'Đi ngủ sớm hơn một chút', on: true, auto: 'night' },
    { code: 'move', icon: '🚶', label: 'Vận động nhẹ hôm nay', on: true, note: 'Quanh ngày chọc hút, chuyển phôi: vận động theo dặn của bác sĩ điều trị.' },
    { code: 'food', icon: '🥗', label: 'Một bữa có rau, trái cây, đậu hạt', on: true },
    { code: 'connect', icon: '🤝', label: 'Nói chuyện, ôm người thương hoặc gọi một người bạn', on: true, auto: 'together' },
    { code: 'pause', icon: '🌬️', label: 'Một lần Dừng lại', on: true, auto: 'stop' },
    { code: 'screen', icon: '📵', label: 'Cất điện thoại, thôi tra mạng trước giờ ngủ', on: true },
    { code: 'no_smoke', icon: '🚭', label: 'Không thuốc lá, rượu bia hôm nay', on: false }
  ];

  /* ===== Câu mẫu "Gửi lời cho người thương" (PRD A.7, UX 10.4) — A2. Không câu nào có chữ "con".
     Khóa theo người gửi: wife (xưng "em"), husband ("anh"), shared ("mình", cho solo / none / bỏ qua). ===== */
  const SEND_WORDS = rv({
    pronoun: { wife: 'em', husband: 'anh', shared: 'mình' },
    wife: ['Hôm nay em thấy nặng lòng. Tối nay mình ôm nhau một chút nhé.', 'Cảm ơn anh hôm nay đã ở cạnh em.',
      'Em không cần anh nói gì đâu. Chỉ cần ngồi với em một lúc thôi.', 'Em đang lo. Tối nay em kể anh nghe nhé.',
      'Hôm nay em mệt. Em xin nghỉ một chút nhé.', 'Ai hỏi han chuyện nhà mình, anh trả lời giúp em nhé.',
      'Em biết anh cũng mệt. Mình cùng nghỉ một chút nhé.', 'Dù thế nào, em vẫn ở đây với anh.'],
    husband: ['Hôm nay anh thấy nặng lòng. Tối nay mình ngồi với nhau một chút nhé.', 'Cảm ơn em hôm nay đã ở cạnh anh.',
      'Anh ở đây. Em muốn kể thì anh nghe, chưa muốn thì mình ngồi im cũng được.', 'Anh cũng đang lo. Tối nay mình nói với nhau một chút nhé.',
      'Hôm nay em nghỉ đi, việc nhà để anh lo.', 'Ai hỏi han chuyện nhà mình, để anh trả lời.',
      'Anh không biết nói gì cho đúng, nhưng anh thương em.', 'Dù thế nào, anh vẫn ở đây với em.'],
    shared: ['Hôm nay mình thấy nặng lòng. Tối nay ngồi với mình một chút nhé.', 'Cảm ơn đã ở cạnh mình hôm nay.',
      'Mình không cần lời khuyên đâu. Chỉ cần nghe mình một lúc thôi.', 'Mình đang lo. Tối nay mình kể nghe nhé.',
      'Hôm nay mình mệt. Mình xin nghỉ một chút nhé.', 'Ai hỏi han, trả lời giúp mình nhé.',
      'Mình không nói được nhiều, nhưng mình thương lắm.', 'Dù thế nào, mình vẫn ở đây.']
  });

  /* ===== Nhãn lý do của bộ lọc thông tin nhận diện (engine trả mã why) ===== */
  const PII_WHY = { phone: 'số điện thoại', digits: 'dãy số dài', email: 'email', name: 'tên người', code: 'mã hồ sơ', address: 'địa chỉ' };

  /* ===== Mọi chữ hiển thị khác (khóa phẳng, api.t(key) thay {xung}) — PRD M01…M21, phụ lục A, UX 10 =====
     'safety.*' là câu chữ an toàn: luôn hiện (K-14). */
  const TEXT = {
    draftLine: 'Bản thử nghiệm: nội dung chưa được hội đồng chuyên môn phê duyệt. Không phải công cụ chẩn đoán hay điều trị.',
    loading: 'Đang mở…',
    back: 'Quay lại', support: 'Hỗ trợ', skip: 'Bỏ qua', next: 'Tiếp tục ›', home: 'Về trang chính', homeGo: 'Về trang chính ›',
    modeStripNone: '🔒 Không lưu gì · đóng trang là xóa sạch',
    // M01
    'welcome.eyebrow': '🤝 Hành Trình Đón Con',
    'welcome.h1': 'Chào bạn, mình ở đây rồi.',
    'welcome.lead': 'Một chỗ nhỏ để dừng lại, thở, và chăm lòng mình trên chặng đường chờ con.',
    'welcome.local': '💾 Lưu trên máy này', 'welcome.localSub': 'Xem lại được, xóa được',
    'welcome.none': '🫥 Không lưu gì', 'welcome.noneSub': 'Đóng trang là xóa sạch',
    'welcome.fine': 'App không có tài khoản, không gửi gì lên mạng. Nếu hai người dùng chung một điện thoại, chọn \'Không lưu gì\' nhé.',
    'welcome.shared': 'Các app khác của cùng địa chỉ web trên máy này có thể đọc được dữ liệu lưu. Xem thêm ở Dữ liệu của mình.',
    'welcome.blocked': 'Máy này đang chặn lưu. Bạn vẫn dùng được kiểu Không lưu gì.',
    'welcome.notDiag': 'Không phải công cụ chẩn đoán hay điều trị.',
    // M02
    'consent.h1': 'Mình lưu gì trên máy này?',
    'consent.lead': 'Chỉ trên máy này. Không gửi đi đâu cả.',
    'consent.journey': 'Lưu hành trình trên máy này (giai đoạn, mức lòng mình, cảm xúc, bài đã làm, thói quen)',
    'consent.writing': 'Lưu cả những gì mình tự viết',
    'consent.writingSub': 'Ô "Kể thêm", suy nghĩ thả lên mây, lời tự viết. Tắt thì chữ chỉ dùng để gợi ý, rồi bỏ đi.',
    'consent.fine': 'Đổi ý lúc nào cũng được ở "Dữ liệu của mình".',
    'consent.go': 'Đồng ý và tiếp tục ›', 'consent.goFromData': 'Lưu từ bây giờ ›',
    'consent.useNone': 'Thôi, mình dùng Không lưu gì',
    'consent.toastNone': 'Mình sẽ không lưu gì nhé.',
    // M03, M04
    'role.h1': 'Để mình nói chuyện cho đúng, bạn là…', 'role.lead': 'Mình chỉ dùng để gọi bạn cho đúng.',
    'role.save': 'Lưu', 'role.toast': 'Từ giờ mình gọi là {xung} nhé.',
    'stage.h1': '{Xung} đang ở chặng nào?', 'stage.h1Change': 'Đổi chặng đường', 'stage.lead': 'Đổi lúc nào cũng được nhé.',
    'stage.current': 'Đang chọn', 'stage.toast': 'Đã đổi chặng đường.', 'stage.noneMode': 'Chỉ nhớ trong lần mở này.',
    // M05
    'home.title': 'Trang chính',
    'home.stageLine': 'Chặng đường: {label}', 'home.stageChange': 'Đổi ›', 'home.stageUnset': 'Chưa chọn chặng đường · Chọn ›',
    'home.result': '⏳ Mình vừa có kết quả ›', 'home.know': '💡 Điều nên biết', 'home.knowClose': 'Đóng thẻ này',
    'home.stop': '🌬️ Dừng lại một chút', 'home.stopSub': 'Dừng 5 giây, rồi một bài nhỏ hợp với lúc này · 3–10 phút',
    'home.stopSubLoss': 'Dừng 5 giây, rồi một bài nhẹ. Không cần làm gì đúng.',
    'home.night': '🌙 Trước khi ngủ', 'home.nightSub': 'Một bài dịu cho tối nay', 'home.nightSubLoss': 'Bàn tay ấm cho tối nay',
    'home.together': '🤝 Hai ta', 'home.togetherSub': 'Cùng làm, gửi lời cho người thương',
    'home.care': '🌱 Chăm mình hôm nay', 'home.careEmpty': 'Vài việc nhỏ cho hôm nay',
    'home.journal': '📖 Hành trình của mình ›', 'home.library': '📚 Thư viện bài ›', 'home.mydata': '🔒 Dữ liệu của mình ›',
    // M21, M21b, M21c
    'result.h1': 'Mình vừa có kết quả', 'result.lead': '{Xung} muốn kể với mình không? Không kể cũng được.',
    'result.fine': 'Chọn gì thì chặng đường đổi theo. Không chọn thì giữ nguyên.',
    'result.toastWait': 'Mình vẫn ở đây trong những ngày chờ.',
    'loss.h1': 'Mình rất tiếc.', 'loss.lead': '{Xung} không cần làm gì lúc này cả.',
    'loss.more': 'Buồn, giận, trống rỗng, hay chẳng thấy gì cả, đều là phản ứng dễ hiểu.',
    'loss.human': 'Nếu nặng quá, có người sẵn lòng nghe {xung}. Mở trang Hỗ trợ ›',
    'loss.warm': '🫶 Bàn tay ấm ›', 'loss.warmSub': '4 phút, không cần làm gì đúng',
    'loss.fine': 'Các bài nói về con đã được cất đi. Khi nào {xung} muốn, đổi chặng đường ở trang chính là được.',
    'good.h1': 'Mừng cho {xung}.', 'good.lead': 'Có thai sau chặng đường dài mà vẫn lo là chuyện nhiều người gặp. Mình vẫn ở đây.',
    'good.link': 'Mẹ Bầu An Yên – app cho những tháng mang thai ›',
    // M06, M07
    'pause5.title': 'Dừng lại một chút', 'pause5.h1': 'Dừng lại.', 'pause5.line1': 'Mình đang ở đây, trong khoảnh khắc này.',
    'pause5.line2': 'Thả vai xuống. Thở như bình thường thôi.', 'pause5.ready': 'Đã sẵn sàng. Tiếp tục.',
    'checkin.title': 'Check-in', 'checkin.h1': 'Lòng {xung} lúc này',
    'checkin.q1': 'Lòng {xung} lúc này thế nào?', 'checkin.q1Hint': 'Chạm một chấm. Mức nào cũng được nhé.',
    'checkin.low': 'Rất nặng nề', 'checkin.high': 'Bình an', 'checkin.noAnswer': 'Không muốn trả lời',
    'checkin.selfRated': 'Tự đánh giá, không phải thang chẩn đoán.',
    'checkin.q2': 'Bé capybara nào giống {xung} nhất?', 'checkin.q2Hint': 'Chọn một đến ba bé. Không chọn cũng được.',
    'checkin.chosen': '{Xung} chọn: ', 'checkin.max3': 'Mình chọn tối đa ba bé thôi nhé. Bỏ một bé để chọn bé khác.',
    'checkin.q3': 'Điều gì đang ở trong lòng?', 'checkin.q4': '{Xung} có bao nhiêu phút?', 'checkin.minUnit': 'phút',
    'checkin.q5': 'Muốn kể thêm không?', 'checkin.placeholder': 'Sáng nay lại thấy đau lâm râm, mình cứ nghĩ mãi…',
    'checkin.noId': '🔒 Không cần ghi tên, số điện thoại hay mã hồ sơ nhé.',
    'checkin.notSaved': 'Chữ này chỉ dùng để gợi ý, không lưu.', 'checkin.saved': 'Chữ này được lưu trên máy này.',
    'checkin.tooLong': 'Mình chỉ nhận 1.000 ký tự thôi nhé. Phần dư đã được cắt.',
    'checkin.go': 'Xem gợi ý ›', 'checkin.library': 'Vào thẳng thư viện',
    // M08 (an toàn)
    'safety.q.title': 'Một câu hỏi', 'safety.q.h1': 'Một câu mình hỏi thật',
    'safety.q.normal': 'Mình hỏi câu này với mọi người chấm 1 đến 3. Trả lời thế nào cũng được.',
    'safety.q.ask': 'Mấy hôm nay, có lúc nào {xung} nghĩ đến chuyện làm hại bản thân, hay không muốn sống nữa không?',
    'safety.q.yes': 'Có', 'safety.q.no': 'Không', 'safety.q.skip': 'Không muốn trả lời',
    // M09, thư viện
    'suggest.title': 'Gợi ý', 'suggest.h1': 'Mình gợi ý cho lúc này',
    'suggest.lead': 'Với lúc này, mình gợi ý hai bài. Không hợp thì đổi nhé.',
    'suggest.start': 'Bắt đầu ›', 'suggest.swap': 'Đổi gợi ý', 'suggest.toastSwap': 'Đã đổi sang gợi ý khác.',
    'suggest.library': '📚 Tự chọn trong thư viện',
    'suggest.empty': 'Các bài đang chờ duyệt nội dung. Trong lúc chờ, {xung} có thể thở tự nhiên, hoặc mở trang Hỗ trợ.',
    'library.title': 'Thư viện', 'library.h1': 'Thư viện bài', 'library.night': 'Trước khi ngủ',
    'library.babyTag': '💭 Có nhắc về con', 'library.empty': 'Các bài đang chờ duyệt nội dung. Mình sẽ có bài sớm thôi.',
    // M10, M11, M12
    'player.posture': POSTURE, 'player.safety': 'An toàn: ',
    'player.natural': '🍃 Trở về thở tự nhiên', 'player.uneasy': 'Mình thấy khó chịu', 'player.done': 'Xong → Check-out',
    'player.naturalText': 'Mình dừng ở đây nhé. Thở như bình thường thôi, không cần đếm.', 'player.resume': 'Tiếp tục bài',
    'safety.uneasy': 'Mình dừng bài ở đây. {Xung} thở tự nhiên thôi. Nếu khó chịu trong người không đỡ, gọi cơ sở điều trị. Nguy hiểm ngay thì gọi 115.',
    'player.findHelp': 'Tìm hỗ trợ ›', 'player.toCheckout': 'Về check-out',
    'checkout.title': 'Check-out', 'checkout.h1': 'Giờ lòng {xung} thế nào?', 'checkout.q': 'Bài vừa rồi với {xung} thế nào?',
    'checkout.go': 'Xong ›', 'checkout.skip': 'Bỏ qua, về trang chính',
    'checkout.worse': 'Mình dừng ở đây nhé. Thở tự nhiên thôi.',
    'safety.worse': 'Nếu khó chịu không đỡ, có người sẵn lòng nghe {xung}.', 'checkout.openSupport': 'Mở trang Hỗ trợ ›',
    'done.title': 'Xong rồi', 'done.h1': 'Cảm ơn {xung} đã ở lại với mình',
    'done.beforeAfter': 'Trước {before} → Sau {after}',
    'done.text': '{Xung} đã dành vài phút cho chính mình. Khác hay không khác đều ổn.',
    'done.more': 'Làm thêm một bài', 'done.night': '🌙 Sang Trước khi ngủ ›',
    'done.toastCare': 'Đã đánh dấu \'Một lần Dừng lại\' trong Chăm mình.',
    // M19, M20 (an toàn)
    'safety.support.h1': 'Hỗ trợ', 'safety.support.dangerH2': 'Nếu đang nguy hiểm ngay', 'safety.call115': '📞 Gọi 115',
    'safety.support.near': 'Hoặc nói ngay với một người ở gần.',
    'safety.support.channelsH2': 'Kênh hỗ trợ của cơ sở',
    'safety.support.noChannels': 'Cơ sở chưa công bố kênh hỗ trợ trong app. Nguy hiểm ngay: gọi 115, hoặc nói với người ở gần.',
    'safety.support.clinicH2': 'Khoa điều trị',
    'safety.support.clinic': 'Câu hỏi về thuốc, thủ thuật, dấu hiệu cơ thể: {xung} hỏi bác sĩ điều trị nhé.',
    'safety.support.trustH2': 'Một người tin cậy',
    'safety.support.trust': 'Kể với người thương, một người bạn, hay một người nhà mà {xung} thấy an toàn. Không cần kể hết.',
    'safety.support.whenH2': 'Khi nào nên tìm thêm người hỗ trợ',
    'safety.support.when1': 'Buồn, mất ngủ, không làm được việc thường ngày, kéo dài nhiều ngày.',
    'safety.support.when2': 'Hai vợ chồng không nói được với nhau.',
    'safety.support.when3': 'Thấy không còn hy vọng.',
    'safety.support.when4': 'Có ý nghĩ làm hại bản thân: gọi ngay.',
    'safety.support.invite': 'Điều {xung} đang trải qua có thể nặng hơn mức một app đỡ được. Bệnh viện có người sẵn lòng nghe.',
    'safety.support.nobody': 'Không ai theo dõi app này lúc {xung} dùng. Muốn có người nghe, hãy gọi.',
    'safety.support.aboutH2': 'Về các bài trong app',
    'safety.support.about': 'Các bài ở đây để {xung} có chỗ dừng lại và thở. Chúng không thay khám, không làm tăng hay giảm khả năng có thai, và hiệu quả chưa được kiểm chứng.',
    'safety.support.never': 'Những điều app không bao giờ làm ›',
    'safety.urgent.h1Text': 'Cảm ơn {xung} đã nói ra', 'safety.urgent.h1Answer': 'Cảm ơn {xung} đã trả lời thật.',
    'safety.urgent.lead': 'Điều {xung} vừa viết có thể liên quan đến sự an toàn của {xung}. App không biết chắc được, và {xung} không phải đối diện chuyện này một mình.',
    'safety.urgent.boxH2': 'Nếu {xung} đang nghĩ đến việc làm hại bản thân, hoặc đang gặp nguy hiểm ngay',
    'safety.urgent.near': 'Nói ngay với một người ở gần: người thương, người nhà, một người bạn. Đừng ở một mình lúc này.',
    'safety.urgent.wait': 'Trong lúc chờ, {xung} đặt chân chạm sàn và thở theo nhịp tự nhiên. Bài tập không thay được sự giúp đỡ của con người.',
    'safety.urgent.help': 'Xem các cách tìm hỗ trợ ›',
    'safety.urgent.safe': 'Mình đang an toàn — đó chỉ là cách nói. Tiếp tục',
    // L02 thông tin nhận diện
    'pii.title': '⚠ Có thể có thông tin nhận diện:', 'pii.fix': '{Xung} sửa lại nếu cần nhé.',
    'pii.limit': 'Bộ lọc không thể phát hiện mọi thông tin.',
    'pii.edit': 'Sửa lại', 'pii.drop': 'Bỏ đoạn đó', 'pii.keep': 'Vẫn giữ', 'pii.toastDrop': 'Đã bỏ các đoạn đó.',
    // M18b
    'never.h1': 'Những điều app không bao giờ làm',
    'never.1': 'Không hỏi tên, số điện thoại.', 'never.2': 'Không gửi gì lên mạng.',
    'never.3': 'Không cho người thương xem nhật ký của {xung}. Chỉ gửi khi {xung} bấm.',
    'never.4': 'Không xếp hạng, không so sánh.', 'never.5': 'Không có giọng đọc máy, không có AI.',
    // M18 (chữ chung; mydata.js có thể dùng)
    'data.downloadNote': 'Tệp nằm trong thư mục Tải về. Ai mở được máy là đọc được tệp, nhớ cất kỹ nhé.',
    'data.safari': 'Trình duyệt có thể tự xóa dữ liệu nếu lâu không mở app. Thỉnh thoảng tải tệp về để giữ nhé.',
    'data.truthH2': 'Nói thật về chỗ lưu',
    'data.truth': 'Ai cầm máy này và mở app là thấy những gì đã lưu. Dùng chung máy thì chọn Không lưu gì nhé.',
    'data.shared': 'App nằm chung địa chỉ web với vài app khác của bệnh viện. Trên cùng một máy, các app đó về kỹ thuật đọc được dữ liệu của nhau. Không app nào gửi đi.',
    'data.noneMode': '{Xung} đang dùng Không lưu gì, nên không có gì để tải về.',
    'data.toastDownload': 'Đã tải tệp về máy.', 'data.downloadFail': 'Chưa tạo được tệp. Thử lại nhé.',
    'data.deleteAll': 'Mình hiểu, xóa toàn bộ', 'data.toastDeleted': 'Đã xóa.', 'data.toastDeletedAll': 'Đã xóa toàn bộ.',
    // Lỗi bộ nhớ, âm thanh, sao chép (UX 10.5)
    'err.blocked': 'Máy này đang chặn lưu dữ liệu. {Xung} vẫn dùng được, nhưng đóng trang là mất nhé.',
    'err.quota': 'Máy đã đầy chỗ lưu nên lần này mình chưa lưu được. {Xung} tải tệp về rồi xóa bớt ở Dữ liệu của mình nhé.',
    'err.corrupt': 'Có một phần dữ liệu cũ mình không đọc được nên đã bỏ qua. Phần còn lại vẫn nguyên.',
    'err.sound': 'Máy này chưa phát được âm thanh. Bài vẫn chạy bình thường, không có nhạc nhé.',
    'err.copy': 'Chạm giữ để sao chép đoạn này nhé.', 'toast.copied': 'Đã sao chép.',
    // ----- Chữ màn chung của app.js (FE-1), chuyển từ CT ở T-I1 10/11/2026 (tech design 11.1). [FE] = chữ mới của FE-1, draft -----
    'consent.writingOff': 'Ô này bật được khi đang lưu hành trình.',   // [FE] giải thích ô bị khóa (style guide 3)
    'carry.title': 'Mang theo những gì vừa làm?', 'carry.body': 'Lần mở này {xung} đã làm vài việc. Lưu luôn vào máy không?',
    'carry.no': 'Không, bắt đầu từ bây giờ', 'carry.yes': 'Có, lưu luôn',   // UX L08 dòng 4
    'stage.suggest': 'Gợi ý',   // [FE] nhãn thẻ 🌧️ tô sẵn (K-13)
    'home.unset': 'Chưa chọn chặng đường', 'home.pick': 'Chọn ›', 'home.changeAria': 'Đổi chặng đường', 'home.links': 'Lối tắt',
    'sup.callTo': 'Gọi', 'sup.aboutLink': 'Về app này ›', 'pii.other': 'thông tin nhận diện',
    'capy.group': 'Thẻ cảm xúc', 'dots.group': 'Lòng mình lúc này, từ 1 đến 10', 'dots.val': 'Mức {n}', 'dots.aria': 'Mức {n} trên 10',
    'store.newer': 'Dữ liệu trên máy này do một bản app mới hơn tạo, nên lần này mình chưa đọc được. Mình không ghi đè gì cả.',   // [FE]
    'store.quotaWarn': 'Chỗ lưu trên máy sắp đầy. {Xung} tải tệp về ở Dữ liệu của mình để giữ nhé.',   // [FE] estimate ≥ 80 %
    'store.unsaved': 'Lần này mình chưa lưu được vào máy. Việc đang làm vẫn tiếp tục nhé.',   // [FE] lỗi ghi khác hết chỗ
    'store.reload': 'App vừa được mở ở một tab khác. Tải lại trang này để thấy dữ liệu mới nhất nhé.', 'store.reloadBtn': 'Tải lại trang',   // [FE]
    'store.toData': 'Mở Dữ liệu của mình ›', 'store.close': 'Đóng thông báo này',
    // about [FE] (UX chưa vẽ; ý theo PRD 8.4, 8.8)
    'about.h1': 'Về app này',
    'about.p': 'Một chỗ nhỏ để dừng lại, thở, và chăm lòng mình. App chạy ngay trên máy, không có tài khoản, không gửi gì lên mạng.',
    'about.evH': 'Nói thật về bằng chứng',
    'about.ev1': 'Các bài ở đây để có chỗ dừng lại và thở. Chúng không thay khám, không làm tăng hay giảm khả năng có thai.',
    'about.ev2': 'Nghiên cứu về chăm sóc tâm lý và chuyện có thai cho kết quả chưa thống nhất, nên app không hứa gì về kết quả điều trị.',
    'about.ev3': 'Lo lắng trước điều trị không làm giảm khả năng có thai. Lo lắng vẫn đáng được chăm sóc.',
    'about.ev4': 'Chưa có nghiên cứu về bài hình dung trước khi ngủ cho người đang điều trị hiếm muộn. Vì vậy bài đêm luôn hỏi trước, và bỏ qua được.',
    'about.ev5': 'Hiệu quả của từng bài trong app chưa được kiểm chứng.',
    'about.revH': 'Trạng thái duyệt nội dung',
    'about.revNote': 'Người duyệt: bác sĩ phụ trách và một chuyên viên tâm lý. Phần chưa duyệt vẫn dùng được, kèm dòng "Bản thử nghiệm".',
    'about.ok': 'đã duyệt', 'about.draft': 'đang chờ duyệt', 'about.part': 'đã duyệt {a}/{n}', 'about.ver': 'Phiên bản {v}.'
  };

  /* ===== Nhóm nội dung và trạng thái duyệt (màn about liệt kê; PRD 8.8) ===== */
  const CONTENT_GROUPS = [
    rv({ code: 'safety', label: 'Câu chữ an toàn (câu hỏi an toàn, Hỗ trợ, trang khẩn, thẻ hỗ trợ)', safety: true }),
    rv({ code: 'keywords', label: 'Từ khóa nhóm cần người hỗ trợ và nhóm cơ thể' }),
    rv({ code: 'exercises', label: 'Tám bài trong thư viện' }),
    rv({ code: 'scripts', label: 'Bài trước khi ngủ' }),
    rv({ code: 'stage_cards', label: 'Thẻ "Điều nên biết"' }),
    rv({ code: 'send_words', label: 'Câu mẫu "Gửi lời cho người thương"' }),
    rv({ code: 'text', label: 'Câu chữ trên các màn' })
  ];

  return {
    REVIEW, STAGES, ROLES, EMOTIONS, CONTEXTS, MINUTES, FITS, NIGHT_OUTCOMES, RESULTS,
    EXERCISES, LIBRARY_ORDER, LIBRARY_GROUPS, POSTURE, CARDS, STAGE_CARDS, GREETINGS, HABITS, SEND_WORDS,
    PII_WHY, TEXT, CONTENT_GROUPS
  };
})();
