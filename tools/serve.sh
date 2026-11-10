#!/usr/bin/env bash
# ============================================================
#  tools/serve.sh - chạy web server tĩnh cho app "Hành Trình Đón Con" trên máy mình (Ubuntu/Linux)
#  Chủ: devops (T-07). Bản Windows tương đương: tools/serve.ps1 (bấm đúp tools/serve.bat)
#  Nguồn: apps/sung-suc/tools/serve.sh @ 10/11/2026 (ADR 0008), đổi cổng và tên, bỏ dòng mock (app không gọi mạng).
#
#  Cách chạy (Terminal, đứng ở đâu cũng được):
#      tools/serve.sh                 cổng mặc định 8774, tự mở trình duyệt
#      tools/serve.sh 9000            đổi cổng
#      tools/serve.sh --no-browser    không mở trình duyệt (cho kiểm thử tự động)
#
#  Cổng 8774 riêng cho app này, không trùng app khác trên máy:
#    8765 checkin-vao-ca · 8766 tra-loi-an-danh · 8767 server e2e (STOP-4P, smoke)
#    8768 checkin-me-bau · 8770/8771 Mẹ Bầu An Yên · 8772/8773 Sung Sức
#    8775 server e2e của app này · 8787/8788/8790/8792 mock của app khác.
#
#  Script nằm trong tools/ nhưng phục vụ thư mục cha (chính là thư mục app).
#  Thử lần lượt: python3 -> python -> php. Server CHỈ nghe 127.0.0.1 (chỉ máy này mở
#  được), không mở ra mạng LAN.
#  Safari/Firefox nên mở qua server này; Chrome/Edge mở thẳng index.html (file://) cũng chạy.
#  Bấm Ctrl+C để tắt server.
# ============================================================
set -u

PORT=8774
OPEN=1
for a in "$@"; do
  case "$a" in
    --no-browser) OPEN=0 ;;
    ''|*[!0-9]*)  echo "[!] Không hiểu tham số: $a  (dùng: tools/serve.sh [cổng] [--no-browser])"; exit 2 ;;
    *)            PORT="$a" ;;
  esac
done

BIND=127.0.0.1
ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
URL="http://$BIND:$PORT/"

# Cổng đang có chương trình khác dùng thì báo ngay, không để server chết giữa chừng
if (exec 3<>"/dev/tcp/$BIND/$PORT") 2>/dev/null; then
  echo "[!] Cổng $PORT đang có chương trình khác dùng."
  echo "    Tắt chương trình đó, hoặc chạy cổng khác:  tools/serve.sh 8776"
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  TOOL=python3; CMD=(python3 -m http.server "$PORT" --bind "$BIND" --directory "$ROOT")
elif command -v python >/dev/null 2>&1; then
  TOOL=python;  CMD=(python -m http.server "$PORT" --bind "$BIND" --directory "$ROOT")
elif command -v php >/dev/null 2>&1; then
  TOOL=php;     CMD=(php -S "$BIND:$PORT" -t "$ROOT")
else
  echo "[!] Máy này chưa có Python hay PHP nên chưa chạy server được."
  echo "    Cài một lần:  sudo apt install -y python3"
  exit 1
fi

echo
echo "Thư mục phục vụ : $ROOT"
echo "Dùng công cụ    : $TOOL"
echo "Mở app          : $URL"
echo "Chỉ máy này truy cập được ($BIND), không mở ra mạng LAN."
echo "Bấm Ctrl+C để tắt server."
echo

# Đợi cổng mở rồi mới mở trình duyệt (chạy nền, tối đa 10 giây)
if [ "$OPEN" = 1 ] && command -v xdg-open >/dev/null 2>&1; then
  (
    for _ in $(seq 1 40); do
      sleep 0.25
      if (exec 3<>"/dev/tcp/$BIND/$PORT") 2>/dev/null; then
        xdg-open "$URL" >/dev/null 2>&1
        exit 0
      fi
    done
  ) &
fi

exec "${CMD[@]}"
