/* =========================================================
   Hành Trình Đón Con – js/config.js · window.HTDC_CONFIG · Chủ: FE-1 Lõi
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 10. Khung T-00 (architect, 10/11/2026): đủ khóa mục 10.
   Cấu hình do đơn vị triển khai chỉnh. MỌI THỨ Ở ĐÂY CÔNG KHAI với trình duyệt.
   Không số điện thoại nào ngoài 115 khi chưa được xác nhận. Không khóa bí mật (app không có server).
   Khóa ASSET_BASE nằm MỘT dòng riêng: tests/lib/static-server.js vá dòng này trong bộ nhớ lúc test.
   ========================================================= */
window.HTDC_CONFIG = {
  APP_NAME: 'Hành Trình Đón Con', VERSION: '0.1.0', PRIVACY_VERSION: '0.1', SCHEMA: 1,
  APP_URL: 'https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/',
  ASSET_BASE: 'https://ditruyenhungvuong.github.io/checkin-V2/',
  SHARED_ORIGIN: true,               // hiện câu "các trang cùng địa chỉ ditruyenhungvuong.github.io…" ở M01, M18 (AC-21)
  ALLOW_DRAFT_CONTENT: true,         // false khi anh và Tổ tâm lý đã duyệt (PRD câu 21)
  EMERGENCY_NUMBER: '115',
  SUPPORT_CHANNELS: [],              // [{name, phone, hours}] — CHỜ ANH (câu 7). Để trống thì M19 hiện câu "Cơ sở chưa công bố…"
  CLINIC_CONTACT: { name: '', phone: '' },   // khoa hiếm muộn — CHỜ ANH
  CLINIC_WARNING_SIGNS: [],          // dấu hiệu sau thủ thuật cần gọi ngay — CHỜ KHOA (câu 8)
  LINK_ME_BAU_AN_YEN: 'https://ditruyenhungvuong.github.io/mebauanyen-V1/',   // giai đoạn "Có tin vui" (K-11, L-4: điền sẵn, Team Lead chốt 10/11/2026)
  NIGHT_FROM_HOUR: 20, LATE_HOUR: 21,
  NOTE_MAX: 1000, SEND_MAX: 300
};
