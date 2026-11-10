/* =========================================================
   Bộ câu thử MỚI cho nhóm PRD 8.2 (hopeless, selfblame, home, loss, prolonged) và 8.2b (body) – Hành Trình Đón Con.
   Chủ: qa-tester (T-Q1 10/11/2026). Viết TỪ ĐẶC TẢ: PRD v0.3 mục 8.2, 8.2b, AC-30, AC-31; tech design 6.2, 14.1.
   Mỗi nhóm: ≥ 1 câu "phải bắt" + ≥ 1 câu "không được bắt" (AC-30). Câu "không được bắt" chọn theo chỗ dễ nhầm:
   chữ gần giống khi bỏ dấu (mất/mắt, ngất/ngắt, tại tôi/tại tối), cụm thiếu một từ ("còn hy vọng", "đau bụng nhẹ").
   Dòng: [câu, nhóm, kỳ vọng, ghi chú]
     nhóm: 'hopeless'|'selfblame'|'home'|'loss'|'prolonged' (so với safetyCheck().groups) · 'body' (so với .body)
     kỳ vọng: 'yes' = phải bắt · 'no' = không được bắt
              'yes?' / 'no?' = QA gợi ý, chưa có trong đặc tả (khác kỳ vọng → GIỚI HẠN, không FAIL; báo FE-2 cân nhắc)
              'no!' = cụm PRD bắt nhầm câu vô hại, CHỜ ANH quyết (Team Lead 10/11/2026) → khác kỳ vọng ghi CHỜ ANH, không FAIL
   Danh sách cụm là draft (PRD câu 7b, 8): anh đổi cụm thì QA cập nhật bộ này.
   ========================================================= */
'use strict';
module.exports = [
  /* ----- Mất hy vọng ----- */
  ['Mình thấy hết hy vọng rồi', 'hopeless', 'yes', 'PRD 8.2'],
  ['không còn hy vọng gì nữa', 'hopeless', 'yes', 'PRD 8.2'],
  ['tuyệt vọng quá', 'hopeless', 'yes', 'PRD 8.2'],
  ['Mình muốn buông xuôi hết', 'hopeless', 'yes', 'PRD 8.2'],
  ['HẾT HY VỌNG', 'hopeless', 'yes', 'chữ hoa'],
  ['hết hy vọng'.normalize('NFD'), 'hopeless', 'yes', 'chuỗi NFD (tech design 6.2: chuẩn hóa NFC)'],
  ['hết hi vọng rồi', 'hopeless', 'yes?', 'cách viết "hi vọng" rất phổ biến'],
  ['Mình vẫn còn hy vọng', 'hopeless', 'no', 'thiếu "hết / không còn"'],
  ['hy vọng lần này mọi thứ suôn sẻ', 'hopeless', 'no', ''],
  /* ----- Tự trách nặng ----- */
  ['tại tôi mà ra cả', 'selfblame', 'yes', 'PRD 8.2'],
  ['lỗi tại mình hết', 'selfblame', 'yes', 'PRD 8.2'],
  ['mình vô dụng quá', 'selfblame', 'yes', 'PRD 8.2'],
  ['mình là gánh nặng cho cả nhà', 'selfblame', 'yes', 'PRD 8.2'],
  ['tại tối qua mình ngủ muộn', 'selfblame', 'no', '"tại tối" khác "tại tôi" (bỏ dấu trùng)'],
  ['công việc là gánh nặng lớn', 'selfblame', 'no', 'không có "mình là gánh nặng"'],
  ['Tại tôi bận nên chưa gọi lại', 'selfblame', 'no!', 'cụm PRD "tại tôi" bắt nhầm câu vô hại'],
  /* ----- Áp lực, bạo lực trong nhà ----- */
  ['mẹ chồng ép mình đi khám lại', 'home', 'yes', 'PRD 8.2'],
  ['chồng đòi ly hôn', 'home', 'yes', 'PRD 8.2'],
  ['mình bị chửi suốt', 'home', 'yes', 'PRD 8.2'],
  ['mình bị ép phải làm thêm lần nữa', 'home', 'yes', 'PRD 8.2'],
  ['hôm qua mình bị đánh', 'home', 'yes', 'PRD 8.2'],
  ['anh ấy đòi bỏ mình', 'home', 'yes', 'PRD 8.2'],
  ['mình ép nước cam cho chồng', 'home', 'no', '"ép" không có "bị"'],
  ['Bị ép tiến độ ở công ty', 'home', 'no!', 'cụm PRD "bị ép" bắt nhầm áp lực công việc'],
  ['chồng chửi thề khi xem bóng đá', 'home', 'no', '"chửi" không có "bị"'],
  ['mình bị đánh thức lúc ba giờ sáng', 'home', 'no', '"bị đánh thức" (T-I1 exclude; human STOP-4P vẫn bắt — unit-engine mục 2b)'],
  ['bi danh thuc luc 3h sang', 'home', 'no', '"bi danh thuc" không dấu (T-I1 exclude)'],
  /* ----- Mất con ----- */
  ['mình vừa sẩy thai', 'loss', 'yes', 'PRD 8.2'],
  ['bác sĩ nói bé bị thai lưu', 'loss', 'yes', 'PRD 8.2'],
  ['mình mất bé rồi', 'loss', 'yes', 'PRD 8.2'],
  ['mất con lần thứ hai', 'loss', 'yes', 'PRD 8.2'],
  ['bị hư thai', 'loss', 'yes', 'PRD 8.2'],
  ['Mất Con', 'loss', 'yes', 'chữ hoa'],
  ['sẩy thai'.normalize('NFD'), 'loss', 'yes', 'chuỗi NFD'],
  ['mắt con giống chồng', 'loss', 'no', '"mắt" khác "mất" (bỏ dấu trùng)'],
  ['mất công chờ cả buổi', 'loss', 'no', '"mất công" (ranh giới từ)'],
  ['mình sợ mất ngủ', 'loss', 'no', ''],
  /* ----- Kéo dài ----- */
  ['mất ngủ cả tuần nay', 'prolonged', 'yes', 'PRD 8.2'],
  ['tối nào cũng khóc suốt', 'prolonged', 'yes', 'PRD 8.2'],
  ['mình không làm được gì cả', 'prolonged', 'yes', 'PRD 8.2'],
  ['hôm qua mất ngủ một chút', 'prolonged', 'no', 'thiếu "cả tuần"'],
  ['khóc một lúc rồi thôi', 'prolonged', 'no', ''],
  /* ----- Cơ thể (8.2b) ----- */
  ['đau bụng dữ dội sau chọc hút', 'body', 'yes', 'PRD 8.2b'],
  ['bụng chướng to quá', 'body', 'yes', 'PRD 8.2b'],
  ['mình khó thở nhiều', 'body', 'yes', 'PRD 8.2b'],
  ['ra máu nhiều', 'body', 'yes', 'PRD 8.2b'],
  ['sốt cao từ tối qua', 'body', 'yes', 'PRD 8.2b'],
  ['mình vừa bị ngất', 'body', 'yes', 'PRD 8.2b'],
  ['Ra Máu Nhiều', 'body', 'yes', 'chữ hoa'],
  ['mình hay ngắt lời chồng', 'body', 'no', '"ngắt" khác "ngất" (bỏ dấu trùng)'],
  ['sốt ruột chờ kết quả', 'body', 'no', '"sốt ruột" khác "sốt cao"'],
  ['đau bụng nhẹ thôi', 'body', 'no', 'thiếu "dữ dội"'],
  ['nói nhiều quá', 'body', 'no', '']
];
