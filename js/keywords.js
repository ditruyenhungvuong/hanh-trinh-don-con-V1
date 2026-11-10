/* =========================================================
   Hành Trình Đón Con – js/keywords.js · window.HTDC_KEYWORDS · Chủ: FE-2 Luật & nội dung (T-02)
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 6.2; PRD v0.3 mục 8.1, 8.2, 8.2b, 8.6.
   Nguồn: apps/lifestyle-thai-phu/js/data.js:377–439 @ 10/11/2026 — CHÉP NGUYÊN VĂN (ADR 0008) khối urgent, human,
          humanStrict, humanPatterns; bản đó chép nguyên apps/STOP-4P-Healthcare-Staff/js/data.js:141–203
          (bản sau review lần 7). Không sửa ở đây: muốn đổi thì đổi bên STOP-4P, qua bộ câu thử, rồi chép lại.
   Mới cho app này (draft, chờ anh duyệt câu 7b, 8): groups (PRD 8.2), body (8.2b), pii (8.6).
   Nhóm mới (như lifestyle): strict so CÓ DẤU; loose chỉ khớp chữ GÕ KHÔNG DẤU. Cụm bỏ dấu chỉ thêm khi không
   trùng nghĩa thường (lý do ghi cạnh nhóm). Đây là từ khóa nhận diện, không phải chữ hiển thị.
   ========================================================= */
window.HTDC_KEYWORDS = (() => {
  'use strict';
  const REVIEW = { status: 'draft', reviewer: '', reviewedAt: '' };

  /* ===== Nhóm tự hại + cần người hỗ trợ của STOP-4P — NGUYÊN VĂN (lifestyle data.js:377–439) ===== */
  const STOP4P = {
    urgent: {
      // 'rạch tay', 'cắt tay' chuyển sang strictPatterns (có loại trừ) — review lần 4, K-1.
      strict: ['tự tử', 'tự sát', 'muốn chết', 'không muốn sống', 'kết thúc cuộc đời', 'kết liễu', 'tự hại', 'tự làm hại', 'làm hại bản thân',
        'nhảy lầu', 'chết cho xong', 'không còn lý do để sống', 'biến mất mãi mãi', 'làm hại người khác', 'uống thuốc để chết'],
      // Bản KHÔNG DẤU của chính các từ có dấu ở trên (không thêm khái niệm mới — review lần 3, G-2).
      // "tự tử" cố ý không có bản không dấu vì "tu tu" trùng "từ từ".
      loose: ['tu sat', 'muon chet', 'khong muon song', 'ket thuc cuoc doi', 'ket lieu', 'tu lam hai ban than', 'tu lam hai minh', 'lam hai ban than',
        'nhay lau', 'chet cho xong', 'khong con ly do de song', 'khong con ly do song', 'bien mat mai mai', 'lam hai nguoi khac', 'uong thuoc de chet'],
      // CÓ DẤU, có loại trừ (review lần 4, K-1): "rạch/cắt (cổ) tay" — trừ khi đứng sau "bị" hoặc theo sau là
      // "khi/lúc/do/vì/trong/tại/vào/ở/áo" (tai nạn khi làm việc, "cắt tay áo"). So trên chuỗi NFC chữ thường, tách từ.
      strictPatterns: [
        / (?<!bị )(?:rạch|cắt) (?:cổ )?tay (?!(?:khi|lúc|do|vì|trong|tại|vào|ở|áo) )/
      ],
      // KHÔNG DẤU, bắt từ gốc + loại trừ ngữ cảnh vô hại (review lần 3 C-1, lần 4 K-1/K-2 — theo bản mẫu proto4 của code-reviewer).
      // Chạy trên chuỗi NFC chữ thường KHÔNG bỏ dấu → chỉ khớp khi người dùng GÕ KHÔNG DẤU. Câu có dấu "Áp lực từ hai phía"
      // không bao giờ bị coi là "tự hại"; câu có dấu đã có strict / strictPatterns lo.
      // Bắt nhầm (chỉ với chữ không dấu mơ hồ, vd "ap luc tu hai phia") chỉ tốn một lần bấm "Tôi đang an toàn — đó chỉ là cách nói".
      //  1) "tu hai" — mẫu của code-reviewer (review lần 5, K-2), chỉnh theo quyết định của anh Thông 29/10/2026 (lượt sửa 6):
      //     "bắt '… nay' gần, bỏ qua khứ". Loại trừ (= coi là "từ hai…") khi ngay sau là:
      //     • giờ/phút/tiếng/tuổi/mười/trăm/nghìn/ngàn/triệu;
      //     • tuần/tháng/năm/ngày/buổi — trừ khi kèm "qua/ngoái" ("tu hai tuan nay", "tu hai thang truoc" KHÔNG khẩn);
      //     • hôm/đêm — trừ khi kèm "qua/ngoái/NAY" ("tự hại hôm nay / đêm nay / hôm qua" BẮT);
      //     • sáng — trừ khi kèm "nay/qua" HOẶC đứng cuối câu / trước dấu câu ("tu hai sang." BẮT, "tu hai sang roi" không);
      //       chiều/tối/trưa — trừ khi kèm "nay/qua";
      //     • số VIẾT BẰNG CHỮ + đơn vị thời gian, có thể có dấu phẩy trước ("tu hai, ba hom nay", "tu hai ba ngay" KHÔNG khẩn).
      //       CHỮ SỐ không được miễn: "tu hai 3 hom nay", "da tu hai 3 dem lien" vẫn khẩn (review lần 6, K-3);
      //     • đến/tới/hoặc/và/hay + SỐ ("từ hai đến ba");
      //     • người/đứa/lần — trừ khi kèm "rồi/nữa/đêm"; "cả" — trừ khi kèm "rồi/nữa/đêm/tuần/ngày/tháng/năm/buổi".
      //     Chạy trên chuỗi NFC giữ dấu câu ("." cho . ! ? ; …, "," cho dấu phẩy) để nhận ra "cuối câu".
      //  2) "rach/cat (co) tay" — trừ khi đứng sau "bi" hoặc theo sau là "khi/luc/do/vi/trong/tai/vao/o/ao", kể cả có dấu phẩy
      //     chen giữa ("cat tay, luc got tao" — review lần 6, R-3).
      patterns: [
        / tu hai (?!(?:gio|phut|tieng|tuoi|muoi|tram|nghin|ngan|trieu) |(?:tuan|thang|nam|ngay|buoi) (?!qua |ngoai )|(?:hom|dem) (?!qua |ngoai |nay )|sang (?=[^\s.,])(?!nay |qua )|(?:chieu|toi|trua) (?!nay |qua )|(?:, )?(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi) (?:tuan|thang|nam|ngay|hom|buoi|dem|gio|phut|tieng) |(?:den|toi|hoac|va|hay) (?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|\d+) |(?:nguoi|dua|lan) (?!roi |nua |dem )|ca (?!roi |nua |dem |tuan |ngay |thang |nam |buoi ))/,
        / (?<!bi )(?:rach|cat) (?:co )?tay (?!(?:, )?(?:khi|luc|do|vi|trong|tai|vao|o|ao) )/
      ],
      // Cách viết tắt / teen code của CHÍNH các từ đã duyệt (review lần 4, G-1) — chỉ dùng khi so nhóm khẩn, không thêm khái niệm mới.
      // Thay từng từ trên chuỗi CÓ DẤU (NFC, chữ thường) TRƯỚC khi so strict và trước khi bỏ dấu cho nhóm loose.
      // Khóa giữ dấu để không nhầm: "mún" → "muốn" nhưng "mụn" (nặn mụn) thì không đổi. "mun"/"hong" không dấu vẫn đổi
      // (người gõ không dấu) — chấp nhận "nan mun chet" bắt nhầm, có nút "Tôi đang an toàn".
      teen: {
        ko: 'không', k: 'không', kh: 'không', khg: 'không', hok: 'không', 'hông': 'không', hong: 'không', hk: 'không',
        'mún': 'muốn', mun: 'muốn', 'chít': 'chết', chit: 'chết', die: 'chết',
        'tữ': 'tử', 'tựtử': 'tự tử', 'tựtữ': 'tự tử'
      }
    },
    // T-07: 'keo dai' đứng một mình bắt cả "ca mổ kéo dài" → chỉ giữ cụm có ngữ cảnh (xem humanPatterns).
    // 'bao hanh' (trùng "bảo hành") và 'khong thiet' (trùng "không thiệt") chuyển sang humanStrict có dấu,
    // nhóm bỏ dấu giữ cụm có ngữ cảnh 'bi bao hanh', 'khong thiet song' (review lần 2, N-01).
    human: ['kiet suc', 'suy sup', 'mat hung thu', 'khong chiu noi', 'tuyet vong', 'vo vong', 'nhieu tuan', 'may tuan', 'hang thang',
      'met keo dai', 'kiet suc keo dai', 'buon keo dai', 'khong ngu keo dai', 'mat ngu keo dai',
      'bi bao hanh', 'khong thiet song', 'chang thiet song',
      'bi danh', 'quay roi', 'de doa', 'khong ai hieu', 'mot minh qua', 'bat luc'],
    humanStrict: ['bạo hành', 'không thiết'],
    // "kéo dài" có ngữ cảnh, so trên chuỗi đã bỏ dấu và tách từ (review lần 3, R-2 — mẫu của code-reviewer, 17/17 bắt, 0/10 nhầm):
    //  1) trạng thái/cảm xúc (+ "này/đó/ấy/cứ/vẫn") + kéo dài: "áp lực kéo dài", "căng thẳng cứ kéo dài", "chán kéo dài"…;
    //     trừ "kéo dài thời gian" ("lo kéo dài thời gian").
    //  2) kéo dài + ÍT NHẤT MỘT lượng từ (chữ hoặc số) + tuần/tháng/năm: "kéo dài hai tuần", "kéo dài ba tháng nay", "kéo dài 3 tuần".
    //     Bỏ dấu thì "năm" (5) trùng "năm" (12 tháng), "thang" trùng "thẳng" → bắt buộc lượng từ, và loại "năm" đi với
    //     tiếng/giờ/phút/giây/rưỡi: KHÔNG bắt "Ca mổ kéo dài năm tiếng", "tới năm giờ sáng", "kéo dài thẳng tới trưa".
    humanPatterns: [
      / (?:met|met moi|kiet suc|buon|buon ba|chan|cang|cang thang|stress|ap luc|lo|lo au|lo lang|chan nan|so hai|khong ngu|mat ngu|kho ngu|tinh trang|cam giac|tam trang)(?: nay| do| ay| cu| van)? keo dai (?!thoi gian )/,
      / keo dai (?:(?:ca|nhieu|may|vai|hang|hon|gan|suot|den|toi|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|\d+) )+(?:tuan|thang|nam)(?! (?:tieng|gio|phut|giay|ruoi) )/
    ],
  };

  /* ===== Nhóm cần người hỗ trợ riêng cho hiếm muộn (PRD 8.2) — draft. Khớp → thẻ "không một mình" (+ cờ riêng) ===== */
  const groups = {
    // loose: "tuyet vong", "buong xuoi", "het hy vong" bỏ dấu không trùng nghĩa thường nào.
    hopeless: Object.assign({
      strict: ['hết hy vọng', 'hết hi vọng', 'không còn hy vọng', 'không còn hi vọng', 'tuyệt vọng', 'buông xuôi'],
      loose: ['het hy vong', 'het hi vong', 'khong con hy vong', 'khong con hi vong', 'tuyet vong', 'buong xuoi']
    }, REVIEW),
    // loose: KHÔNG có "tai toi" (trùng "tải tới"), "loi cua minh" (trùng "lời của mình"). "vo dung", "ganh nang" không trùng.
    selfblame: Object.assign({
      strict: ['tại tôi', 'lỗi tại mình', 'lỗi tại tôi', 'lỗi tại em', 'lỗi của mình', 'lỗi của tôi', 'lỗi của em',
        'mình vô dụng', 'tôi vô dụng', 'em vô dụng', 'mình là gánh nặng', 'tôi là gánh nặng', 'em là gánh nặng'],
      loose: ['loi tai minh', 'loi tai toi', 'loi tai em', 'minh vo dung', 'toi vo dung', 'em vo dung',
        'minh la ganh nang', 'toi la ganh nang', 'em la ganh nang']
    }, REVIEW),
    // Giữ "bị bạo hành, bị đánh, quấy rối, đe dọa" ở human (STOP-4P). loose: KHÔNG có "doi bo" (trùng "dỗi bỏ", "đồi bò").
    home: Object.assign({
      strict: ['bị ép', 'bị đánh', 'đòi bỏ', 'đòi ly hôn', 'đòi li hôn', 'bị chửi', 'mẹ chồng ép', 'nhà chồng ép'],
      loose: ['bi ep', 'bi danh', 'doi ly hon', 'doi li hon', 'bi chui', 'me chong ep', 'nha chong ep'],
      // T-I1 (QA 10/11): "bị đánh thức" không phải bị đánh. Nhóm human (STOP-4P, nguyên văn) vẫn bắt câu này → chờ anh
      exclude: [/ bị đánh thức /g, / bi danh thuc /g]
    }, REVIEW),
    // loose: KHÔNG có "mat con", "mat be" (trùng "mất công" gõ vội, "mắt bé"). Như lifestyle PRD 9.4b.
    loss: Object.assign({
      strict: ['sẩy thai', 'xảy thai', 'thai lưu', 'mất bé', 'mất con', 'hư thai', 'thai mất'],
      loose: ['say thai', 'xay thai', 'thai luu', 'hu thai']
    }, REVIEW),
    // loose: "khoc suot", "mat ngu ca tuan" không trùng nghĩa thường.
    prolonged: Object.assign({
      strict: ['mất ngủ cả tuần', 'mất ngủ mấy tuần', 'mất ngủ nhiều tuần', 'khóc suốt', 'khóc cả ngày',
        'không làm được gì', 'không làm được việc gì'],
      loose: ['mat ngu ca tuan', 'mat ngu may tuan', 'mat ngu nhieu tuan', 'khoc suot', 'khoc ca ngay',
        'khong lam duoc gi', 'khong lam duoc viec gi']
    }, REVIEW)
  };

  /* ===== Nhóm cơ thể – lưới đỡ (PRD 8.2b, câu 8) — draft. Không diễn giải, không trấn an. =====
     "ngất" chỉ so có dấu ("ngat" trùng "ngát", "ngắt"); exclude bỏ "ngất ngây" trước khi so. */
  const body = Object.assign({
    strict: ['đau bụng dữ dội', 'bụng chướng to', 'khó thở nhiều', 'ra máu nhiều', 'chảy máu nhiều', 'ra huyết nhiều',
      'sốt cao', 'ngất', 'ngất xỉu'],
    loose: ['dau bung du doi', 'bung chuong to', 'kho tho nhieu', 'ra mau nhieu', 'chay mau nhieu', 'ra huyet nhieu',
      'sot cao', 'ngat xiu'],
    exclude: [/ ngất ngây /g]
  }, REVIEW);

  /* ===== Thông tin nhận diện (PRD 8.6; thuật toán tên người chép lifestyle engine.js:127–170) =====
     Danh xưng: bỏ bn, giường, phòng (bối cảnh NVYT); thêm chồng, vợ, mẹ chồng, bố chồng, bác sĩ, điều dưỡng. */
  const pii = {
    titles: ['chồng', 'vợ', 'anh', 'chị', 'em', 'mẹ chồng', 'bố chồng', 'mẹ vợ', 'bố vợ', 'bác sĩ', 'bs', 'điều dưỡng',
      'cô', 'chú', 'bác', 'ông', 'bà', 'bạn', 'người nhà'],
    abbrTitles: ['bs'],
    // Sau "BS." mà là các từ này thì là câu mới (STOP-4P review lần 4, G-2)
    sentenceStart: ['hôm', 'sáng', 'chiều', 'tối', 'trưa', 'đêm', 'nay', 'giờ', 'lúc', 'khi', 'sau', 'rồi', 'mình', 'tôi', 'em',
      'cảm', 'đã', 'cũng', 'vì', 'nhưng', 'và', 'còn', 'thấy', 'bạn', 'không', 'có'],
    // "mã hồ sơ / mã bệnh nhân / mã IVF / số hồ sơ + chuỗi"
    codes: /(?:mã\s*(?:hồ\s*sơ|bệnh\s*nhân|bệnh\s*án|ivf|bn)|số\s*hồ\s*sơ)\s*[:#]?\s*[\p{L}\p{N}-]{3,}/giu,
    // Địa chỉ: cần số hoặc Tên Viết Hoa sau "đường/phường…" (lifestyle engine.js:111–114), để "chặng đường này",
    // "con đường dài" không bị coi là địa chỉ. Không cờ i: \p{Lu} phải là chữ hoa thật.
    address: [
      /[Ss]ố nhà[\p{Zs}\t]*\d+[\p{L}\d/-]*/gu,
      /\b\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)*[\p{Zs}\t]+(?:[Đđ]ường|[Pp]hố|[Hh]ẻm|[Nn]gõ|[Nn]gách|[Kk]iệt)(?:[\p{Zs}\t]+(?:số[\p{Zs}\t]*)?\d+[\p{L}\d/]*|(?:[\p{Zs}\t]+\p{Lu}\p{Ll}*)+)/gu,
      /(?:[Đđ]ường|[Pp]hố|[Hh]ẻm|[Nn]gõ|[Nn]gách|[Kk]iệt)(?:[\p{Zs}\t]+(?:số[\p{Zs}\t]*)?\d+[\p{L}\d/]*|(?:[\p{Zs}\t]+\p{Lu}\p{Ll}*)+)/gu,
      /(?:[Pp]hường|[Xx]ã|[Qq]uận|[Hh]uyện)(?:[\p{Zs}\t]+(?:\d+|\p{Lu}\p{Ll}*))+/gu
    ],
    phone: /(?:\+?84|\b0)(?:[\s.-]?\d){9,10}\b/g,
    digits: /\b\d{6,}\b/g,
    email: /[\w.+-]+@[\w-]+\.[\w.]+/g
  };

  return {
    urgent: STOP4P.urgent,
    human: { list: STOP4P.human, strict: STOP4P.humanStrict, patterns: STOP4P.humanPatterns },
    STOP4P,                      // tên gốc (human, humanStrict, humanPatterns) để test so từng phần tử với bản STOP-4P
    groups, body, pii, REVIEW
  };
})();
