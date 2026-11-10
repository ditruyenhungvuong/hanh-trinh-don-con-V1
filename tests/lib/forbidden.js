/* =========================================================
   Danh sách cụm cấm – Hành Trình Đón Con (Chủ: qa-tester; T-Q1 10/11/2026). Viết TỪ ĐẶC TẢ, không đọc mã app.
   Nguồn: PRD v0.3 mục 6.2 (+ cụm UX 10.6), AC-06, AC-44, AC-46 (V6), mục 6.1 (không "ạ"); tech design 14.2.
   Dùng ở tests/check-static.js (quét mọi chuỗi literal trong js/*.js trừ keywords.js + chữ index.html).
   Cách so (tech design 14.2 "so có dấu và bỏ dấu, theo từ"):
   - Chuẩn hóa NFC, chữ thường; ranh giới từ = không phải chữ/số Unicode ở hai bên.
   - Chuỗi CÓ dấu tiếng Việt → so cụm có dấu. Chuỗi KHÔNG có dấu nào (người gõ không dấu) → so cụm đã bỏ dấu.
     Không so bỏ dấu trên chuỗi có dấu, vì "cố lên" bỏ dấu trùng "có lên", "ngất" trùng "ngắt" (bắt nhầm).
   ========================================================= */
'use strict';

/* PRD 6.2 – trấn an giả, hứa, quy lỗi, chữ y khoa nặng nề; UX 10.6 thêm 5 cụm. FAIL khi gặp. */
const BANNED = [
  // Không trấn an giả, không hứa (PRD 6.2 gạch 2)
  'chắc không sao đâu', 'lần này chắc được', 'lần sau sẽ khác', 'còn trẻ mà', 'cứ thư giãn', 'đừng nghĩ nhiều là có',
  'có thai rồi thì vui lên',
  // Không dùng (PRD 6.2 gạch 1)
  'vô sinh', 'phôi hỏng', 'tử cung không nhận', 'thất bại',
  // Người chồng (PRD 6.2 gạch 5)
  'đàn ông phải mạnh mẽ', 'không phải lỗi của anh đâu',
  // UX 10.6 (anh duyệt 10/11/2026)
  'hừng đông', 'chúc mừng', 'đàn ông phải', 'mạnh mẽ lên', 'cố lên'
];

/* AC-44 – chỉ áp cho js/scripts.js (văn bản H1–H4, kể cả bản ngày). */
const SCRIPT_BANNED = ['phôi', 'tử cung', 'làm tổ', 'bám', 'xét nghiệm', 'beta', 'que thử', 'con trai', 'con gái', 'chắc chắn sẽ'];

/* V6 / AC-46: câu cố định duy nhất được phép nói về khả năng có thai (nguyên văn PRD 8.4). */
const V6 = 'Bài hình dung là để lòng dịu lại trước khi ngủ. Nó không làm tăng hay giảm khả năng có thai.';
/* Mẫu "hứa có thai": tech design 14.2 /(giúp|tăng|dễ)\s+(có thai|đậu thai|thụ thai)/ — QA mở rộng: một CÂU có nhắc
   có thai / đậu thai / thụ thai / mang thai mà cùng câu có động từ hứa hẹn (giúp, tăng, dễ, mau, nhanh, cải thiện, hỗ trợ,
   khả năng, tỉ lệ, cơ hội) → FAIL, trừ đúng câu V6 (bỏ câu V6 khỏi chuỗi trước khi quét). */
const PREG = /(có thai|đậu thai|thụ thai|mang thai)/u;
const PROMISE = /(giúp|tăng|dễ|mau|nhanh|cải thiện|hỗ trợ|khả năng|tỉ lệ|tỷ lệ|cơ hội)/u;
const PROMISE_STRICT = /(giúp|tăng|dễ)\s+(có thai|đậu thai|thụ thai)/u;   // nguyên văn tech design 14.2

/* QA đề xuất, CHỜ ANH DUYỆT (tech design 14.2 gạch cuối) → chỉ WARN, không chặn:
   từ y khoa / chẩn đoán và câu ép tích cực theo style guide mục 1–2. Câu bắt buộc của PRD có "chẩn đoán", "điều trị"
   ("Không phải công cụ chẩn đoán hay điều trị", "Tự đánh giá, không phải thang chẩn đoán") nên hai từ đó KHÔNG có ở đây. */
const SOFT = [
  'trầm cảm', 'rối loạn', 'lo âu lan tỏa', 'bệnh nhân', 'bệnh lý', 'liệu pháp', 'trị liệu', 'triệu chứng', 'stress',
  'hãy tích cực', 'suy nghĩ tích cực', 'luôn lạc quan', 'mọi chuyện sẽ ổn', 'sẽ ổn thôi', 'đừng buồn', 'đừng lo', 'vui lên', 'mạnh mẽ lên nào'
];
/* PRD 6.1: không dùng "ạ" (giọng Xanh dịu) → WARN. */
const PARTICLE_A = 'ạ';

/* ===== Hàm so ===== */
const VN_MARK = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const strip = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const norm = s => String(s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
const reEsc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = list => new RegExp('(?<![\\p{L}\\p{N}])(' + list.map(w => reEsc(norm(w)).replace(/ /g, '\\s+')).join('|') + ')(?![\\p{L}\\p{N}])', 'giu');

/* Trả các cụm trong list xuất hiện trong text (theo luật có dấu / bỏ dấu ở trên). */
function findPhrases(text, list) {
  const t = norm(text);
  if (!t.trim()) return [];
  const accented = VN_MARK.test(t);
  const hay = accented ? t : strip(t);
  const words = accented ? list : list.map(w => strip(norm(w)));
  const out = [];
  const re = wordRe(words);
  let m;
  while ((m = re.exec(hay))) out.push(m[1]);
  return [...new Set(out)];
}

/* Câu hứa có thai: trả các câu vi phạm (đã bỏ câu V6 nguyên văn). */
function findPromises(text) {
  const raw = String(text).normalize('NFC');
  const rest = raw.split(V6).join(' ');
  const t = norm(rest);
  const out = [];
  for (const sent of t.split(/[.!?…\n]+/)) {
    if (PREG.test(sent) && PROMISE.test(sent)) out.push(sent.trim());
    else if (PROMISE_STRICT.test(sent)) out.push(sent.trim());
  }
  // Người gõ không dấu: "giup co thai", "tang kha nang co thai"
  if (!VN_MARK.test(t) && /(giup|tang|de|mau|nhanh)\s+(\w+\s+){0,3}(co thai|dau thai|thu thai|mang thai)/.test(strip(t))) out.push(t.trim());
  return out;
}

module.exports = { BANNED, SCRIPT_BANNED, V6, SOFT, PARTICLE_A, findPhrases, findPromises, strip, norm, VN_MARK };
