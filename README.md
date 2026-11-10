# Hành Trình Đón Con

App hỗ trợ tinh thần cho cặp vợ chồng đang điều trị hiếm muộn. Web tĩnh (HTML/CSS/JS, không build), chạy hoàn toàn trên máy:
không tài khoản, không gửi gì lên mạng (CSP `connect-src 'none'`).

> **Trạng thái: khung T-00 (10/11/2026).** Các màn đang là bản giữ chỗ. README đầy đủ do tech-writer viết cuối Bước A1.

- Đặc tả: `docs/specs/hiem-muon-prd.md`, `docs/specs/hiem-muon-tech-design.md`, `docs/specs/hiem-muon-ux.md`, ADR 0010–0012.
- Web (khi phát hành): https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/

## Chạy thử trên máy

- Chrome / Edge: mở thẳng `index.html`.
- Safari, Firefox: `tools/serve.sh` (Ubuntu) hoặc `tools/serve.bat` (Windows), rồi mở http://127.0.0.1:8774/

## Test

```bash
export NODE=/home/adminpc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
TMPDIR=/tmp/claude-1000/qa-htdc tests/run-all.sh        # check-static → unit-* → smoke → e2e
```

Windows: `tests\run-all.cmd`.

## Đẩy lên GitHub

`./upload.sh` (Ubuntu) hoặc `upload.bat` (Windows). Script chạy `tests/check-static.js --strict` trước, chưa đạt thì không đẩy.

## Bản đồ file

Mỗi file có một chủ (dòng `Chủ:` ở đầu file), xem tech design mục 2 và 15.
