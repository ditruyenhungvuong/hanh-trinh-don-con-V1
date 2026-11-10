#!/usr/bin/env bash
# =========================================================
#  Chạy toàn bộ test của Hành Trình Đón Con (Chủ: qa-tester; T-00 architect dựng khung 10/11/2026, T-Q1/T-Q2 hoàn thiện).
#  Nguồn: apps/sung-suc/tests/run-all.sh @ 10/11/2026 (ADR 0008). HTDC: bỏ bước Apps Script (app không có server).
#  Thứ tự (tech design 14.5): check-static → unit-* → smoke → e2e. File nào chưa có thì bỏ qua.
#  Smoke/e2e (Chrome headless) TỰ lấy khóa flock /tmp/claude-1000/e2e.lock vì agent khác có thể chạy e2e song song.
#  KHÔNG bọc thêm flock bên ngoài script này (sẽ tự khóa chính mình).
#  Cần Node ≥ 22. Ví dụ:
#    export NODE=/home/adminpc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
#    TMPDIR=/tmp/claude-1000/qa-htdc tests/run-all.sh [--strict]   (tham số chỉ chuyển cho check-static)
#  Thư mục tạm phải ngắn (Chrome báo "Socket path too long" nếu dài). Có bước đỏ → exit 1.
# =========================================================
set -u
cd "$(dirname "$0")/.."
DEFAULT_NODE=/home/adminpc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
if [ -z "${NODE:-}" ]; then if [ -x "$DEFAULT_NODE" ]; then NODE="$DEFAULT_NODE"; else NODE=node; fi; fi
"$NODE" -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' || { echo "Cần Node >= 22 (đang dùng $("$NODE" -v)). Đặt biến NODE."; exit 2; }
export TMPDIR="${TMPDIR:-/tmp/claude-1000/qa-htdc}"; mkdir -p "$TMPDIR"
LOCK=/tmp/claude-1000/e2e.lock; mkdir -p "$(dirname "$LOCK")"
FAIL=0
SUMMARY=()
step() {   # step <tên> <lệnh…>
  local name="$1"; shift
  echo; echo "=== $name ==="
  local out; out="$("$@" 2>&1)"; local code=$?
  echo "$out"
  local last; last="$(printf '%s\n' "$out" | grep -E 'PASS ·' | tail -1)"
  if [ $code -ne 0 ]; then FAIL=1; SUMMARY+=("ĐỎ   $name (exit $code) — $last"); else SUMMARY+=("XANH $name — $last"); fi
}
step "check-static" "$NODE" tests/check-static.js "$@"
for f in tests/unit-*.js; do [ -e "$f" ] || continue; step "$(basename "$f" .js)" "$NODE" "$f"; done
for f in tests/smoke.js tests/e2e.js; do
  [ -e "$f" ] || continue
  step "$(basename "$f" .js) (Chrome headless)" flock "$LOCK" "$NODE" "$f" --out="$TMPDIR/out"
done
echo; echo "=== TÓM TẮT ==="
printf '%s\n' "${SUMMARY[@]}"
echo
if [ "$FAIL" = 1 ]; then echo "KẾT QUẢ: CÓ TEST ĐỎ"; exit 1; else echo "KẾT QUẢ: TẤT CẢ XANH (CHỜ không tính)"; fi
