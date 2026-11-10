#!/usr/bin/env bash
# ============================================================
#  upload.sh - đẩy app "Hành Trình Đón Con" lên GitHub Pages (Ubuntu/Linux)
#  Chủ: devops (T-07). Bản Windows tương đương: upload.bat
#  Nguồn: apps/sung-suc/upload.sh @ 10/11/2026 (ADR 0008). Đổi so với Sung Sức:
#    - app không gọi mạng (ADR 0011): bỏ phần GOOGLE_SCRIPT_URL / MOCK / ACCOUNT_ENABLED / ID Apps Script cũ,
#      thay bằng chặn mọi địa chỉ script.google.com và localhost trong code;
#    - soát CSP còn connect-src 'none' + worker-src 'none' (check-static --strict soát nguyên văn);
#    - soát APP_URL trong js/config.js khớp repo; chặn file bí mật (.env, khóa, chứng chỉ);
#    - thêm  --dry-run : chỉ soát + liệt kê file sẽ lên GitHub, không đụng Git.
#  Ngân sách (tech design 11.1): HTML+CSS+JS chưa nén ≤ 480 KB, gzip ≤ 175 KB, lần tải đầu ≤ 560 KB.
#  Mỗi lần chạy = một lần cập nhật.
#  Cách dùng (trong Terminal):   ./upload.sh
#  Có thể truyền lời commit:      ./upload.sh "Sua mau nut"
#  Chỉ soát, không đẩy:           ./upload.sh --dry-run
#  Repo: https://github.com/ditruyenhungvuong/hanh-trinh-don-con-V1
#  Web:  https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/
#  Cần Node (bản nào cũng được, từ 18 trở lên) để chạy bước soát tĩnh trước khi đẩy.
# ============================================================

# ===== Cấu hình riêng của app (chỉ sửa khối này khi chép sang app khác) =====
REPO="ditruyenhungvuong/hanh-trinh-don-con-V1"
BRANCH="main"
PAGES="https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/"
MSG="Cap nhat app Hanh Trinh Don Con"
# File cấu hình công khai: soát APP_URL khớp repo, không có địa chỉ máy local.
CONFIG="js/config.js"
# File code phát hành: không được có URL trỏ vào máy local, không được có địa chỉ Apps Script (app không gọi mạng).
CODE_FILES="index.html styles.css css js"
# CSP trong index.html phải còn hai khóa này (ADR 0011). Soát nguyên văn do check-static --strict làm.
CSP_MUST="connect-src 'none'|worker-src 'none'"
# Soát tĩnh chạy trước khi đẩy: CSP nguyên văn, API cấm, cụm cấm, ngân sách, APP_URL... Trống = bỏ bước này.
CHECK_STATIC="tests/check-static.js"
# Không đẩy lên GitHub (thêm vào .git/info/exclude trên máy, bỏ khỏi repo nếu lỡ có).
# Trùng với .gitignore (chặn hai lớp). *.conflict* = bản trùng do đồng bộ Drive (rclone bisync) sinh ra.
EXCLUDE="NGUON.md .claude/ qa-out/ tests/out/ node_modules/ *.conflict*"
# Dòng in thêm khi xong. Để trống nếu không cần.
EXTRA_DONE=""

# ===== Chuẩn bị =====
DRY=0
for a in "$@"; do
  case "$a" in
    --dry-run|-n) DRY=1 ;;
    *)            [ -n "$a" ] && MSG="$a" ;;
  esac
done
# Luôn chạy đúng thư mục chứa file này, dù gọi từ đâu
cd "$(dirname "$(readlink -f "$0")")" || exit 1
SELF="$(basename "$0")"

echo
if [ "$DRY" = 1 ]; then
  echo "======== SOÁT THỬ (--dry-run, không đẩy): $REPO ========"
else
  echo "======== ĐANG TẢI CODE LÊN GITHUB: $REPO ========"
fi
echo "Thư mục: $PWD"
echo

# Hướng dẫn tạo repo + bật Pages (dùng khi chưa có repo hoặc đẩy lỗi)
guide_create() {
  echo "       a) Mở https://github.com/new (đăng nhập tài khoản ${REPO%%/*})"
  echo "          - Repository name: ${REPO#*/}   (phải đúng y tên này)"
  echo "          - chọn Public, KHÔNG tick \"Add a README\", không chọn .gitignore / license"
  echo "          - bấm Create repository."
  echo "          (Đã cài gh thì làm nhanh:  gh repo create $REPO --public )"
  echo "       b) Chạy lại ./$SELF. Đẩy xong thì bật Pages (mục cuối khi HOÀN THÀNH)."
}

# ===== [0/5] Soát trước khi đẩy =====
echo "[0/5] Kiểm tra cấu hình và code..."

# --- js/config.js: có file, không địa chỉ local, APP_URL đúng repo ---
if [ ! -f "$CONFIG" ] || [ ! -f index.html ]; then
  echo
  echo "[!] KHÔNG ĐẨY. Không thấy $CONFIG hoặc index.html trong thư mục này."
  echo "    Có thể đang chạy $SELF ở sai thư mục. Thư mục hiện tại: $PWD"
  exit 1
fi
LOCAL_LINES="$(grep -nE 'localhost|127\.0\.0\.1|0\.0\.0\.0' "$CONFIG" \
  | grep -vE '^[0-9]+:[[:space:]]*(//|/\*|\*)')"
if [ -n "$LOCAL_LINES" ]; then
  echo
  echo "[!] KHÔNG ĐẨY. $CONFIG còn địa chỉ máy local:"
  printf '%s\n' "$LOCAL_LINES" | head -5 | cut -c1-160 | sed 's/^/      dòng /'
  echo "    Trên web, địa chỉ này trỏ vào máy của người đang dùng app nên không chạy. Sửa rồi chạy lại."
  exit 1
fi
APP_URL_LINE="$(grep -E "^[[:space:]]*APP_URL[[:space:]]*:" "$CONFIG" | head -1)"
if ! printf '%s' "$APP_URL_LINE" | grep -qF "'$PAGES'" \
   && ! printf '%s' "$APP_URL_LINE" | grep -qF "\"$PAGES\""; then
  echo
  echo "[!] KHÔNG ĐẨY. APP_URL trong $CONFIG không khớp trang web của repo này."
  echo "    Đang là:  ${APP_URL_LINE:-(không thấy dòng APP_URL)}"
  echo "    Phải là:  APP_URL: '$PAGES',"
  exit 1
fi

# --- index.html: CSP còn chặn mạng (ADR 0011) ---
CSP_LINE="$(tr '\n' ' ' < index.html | grep -oE 'Content-Security-Policy"[^>]*' | head -1)"
if [ -z "$CSP_LINE" ]; then
  echo
  echo "[!] KHÔNG ĐẨY. index.html không còn thẻ <meta http-equiv=\"Content-Security-Policy\">."
  echo "    Thẻ này là lớp khóa \"app không gửi gì lên mạng\" (ADR 0011). Trả lại đúng nguyên văn tech design mục 3.1."
  exit 1
fi
IFS='|' read -r -a CSP_KEYS <<< "$CSP_MUST"
for K in "${CSP_KEYS[@]}"; do
  if ! printf '%s' "$CSP_LINE" | grep -qF "$K"; then
    echo
    echo "[!] KHÔNG ĐẨY. CSP trong index.html bị sửa: thiếu  $K"
    echo "    Thiếu khóa này thì app có thể gửi dữ liệu ra ngoài. Trả lại CSP đúng nguyên văn tech design mục 3.1."
    exit 1
  fi
done
if printf '%s' "$CSP_LINE" | grep -qF "unsafe-eval"; then
  echo
  echo "[!] KHÔNG ĐẨY. CSP trong index.html có 'unsafe-eval'. Bỏ đi rồi chạy lại."
  exit 1
fi

# --- Code: không URL local, không Apps Script / Google Sheet (app không gọi mạng) ---
# Chỉ bắt chuỗi URL thật (có http:// hoặc https://), không bắt comment nhắc tới cổng.
# shellcheck disable=SC2086
CODE_LOCAL="$(grep -rnE --include='*.js' --include='*.css' --include='*.html' \
  'https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)' $CODE_FILES 2>/dev/null)"
if [ -n "$CODE_LOCAL" ]; then
  echo
  echo "[!] KHÔNG ĐẨY. Code còn địa chỉ máy local (trên web sẽ không chạy):"
  printf '%s\n' "$CODE_LOCAL" | head -10 | cut -c1-160 | sed 's/^/      /'
  echo "    Sửa các dòng trên rồi chạy lại."
  exit 1
fi
# shellcheck disable=SC2086
CODE_NET="$(grep -rnE --include='*.js' --include='*.css' --include='*.html' \
  'script\.google\.com|script\.googleusercontent\.com|docs\.google\.com/spreadsheets|googleapis\.com' $CODE_FILES 2>/dev/null)"
if [ -n "$CODE_NET" ]; then
  echo
  echo "[!] KHÔNG ĐẨY. Code có địa chỉ Google Apps Script / Sheet:"
  printf '%s\n' "$CODE_NET" | head -10 | cut -c1-160 | sed 's/^/      /'
  echo "    Hành Trình Đón Con không gửi gì lên mạng (ADR 0011). Bỏ các dòng trên rồi chạy lại."
  exit 1
fi

# --- File bí mật không bao giờ được lên GitHub (repo công khai) ---
SECRETS="$(find . -path ./.git -prune -o -type f \( \
    \( -name '.env' -o -name '.env.*' \) ! -name '.env.example' \
    -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' \
    -o -name 'id_rsa*' -o -name 'id_ed25519*' -o -name '.git-credentials' \
    -o -name 'credentials*.json' -o -name 'service-account*.json' -o -name 'client_secret*.json' \
  \) -print 2>/dev/null | sed 's#^\./##' | sort)"
if [ -n "$SECRETS" ]; then
  echo
  echo "[!] KHÔNG ĐẨY. Thư mục có file trông như mật khẩu / khóa bí mật:"
  printf '%s\n' "$SECRETS" | head -20 | sed 's/^/      - /'
  echo "    Repo là công khai, ai cũng đọc được. Chuyển các file này ra khỏi thư mục app rồi chạy lại."
  exit 1
fi
echo "      Cấu hình ổn: APP_URL đúng repo, CSP chặn mạng, không địa chỉ local, không file bí mật."

# ===== Soát tĩnh: CSP nguyên văn, API cấm, cụm cấm, ngân sách (tests/check-static.js --strict) =====
if [ -n "$CHECK_STATIC" ]; then
  echo "      Soát tĩnh ($CHECK_STATIC --strict)..."
  if [ ! -f "$CHECK_STATIC" ]; then
    echo
    echo "[!] KHÔNG ĐẨY. Không thấy $CHECK_STATIC (thư mục tests/ bị thiếu?)."
    echo "    Chép đủ thư mục app rồi chạy lại ./$SELF"
    exit 1
  fi
  # Tìm Node: biến NODE > node trong PATH > Node đi kèm Codex trên máy anh
  NODE_BIN="${NODE:-}"
  [ -z "$NODE_BIN" ] && command -v node >/dev/null 2>&1 && NODE_BIN="node"
  CODEX_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  [ -z "$NODE_BIN" ] && [ -x "$CODEX_NODE" ] && NODE_BIN="$CODEX_NODE"
  if [ -z "$NODE_BIN" ]; then
    echo
    echo "[!] KHÔNG ĐẨY. Máy này chưa có Node nên chưa soát được app trước khi đẩy."
    echo "    Cài một lần:  sudo apt install -y nodejs"
    echo "    rồi chạy lại ./$SELF"
    exit 1
  fi
  CS_OUT="$("$NODE_BIN" "$CHECK_STATIC" --strict 2>&1)"
  CS_CODE=$?
  CS_SUM="$(printf '%s\n' "$CS_OUT" | grep -E '^check-static:' | tail -1)"
  if [ "$CS_CODE" != 0 ]; then
    echo
    echo "[!] KHÔNG ĐẨY. Soát tĩnh chưa đạt: ${CS_SUM:-không chạy được (exit $CS_CODE)}"
    if printf '%s\n' "$CS_OUT" | grep -q '^FAIL'; then
      printf '%s\n' "$CS_OUT" | grep -E '^FAIL' | head -15 | cut -c1-200 | sed 's/^/      /'
    else
      printf '%s\n' "$CS_OUT" | tail -15 | sed 's/^/      /'
    fi
    if printf '%s\n' "$CS_OUT" | grep -E '^FAIL' | grep -q 'KB'; then
      echo "    Vượt ngân sách (HTML+CSS+JS > 480 KB chưa nén hoặc > 175 KB gzip, lần tải đầu > 560 KB) thì gọt file trước khi đẩy."
    fi
    echo "    Xem đủ:  $NODE_BIN $CHECK_STATIC --strict"
    exit 1
  fi
  echo "      ${CS_SUM:-check-static: đạt}"
  printf '%s\n' "$CS_OUT" | grep -E '^[[:space:]]+HTML\+CSS\+JS' | head -1
fi

# Bản trùng do đồng bộ Drive (rclone bisync sinh *.conflict1, *.conflict2... khi một file bị sửa
# ở cả hai phía). Không tự xóa: có khi bản .conflict mới là bản đúng. Dừng để anh xem.
CONFLICTS="$(find . -path ./.git -prune -o -name '*.conflict*' -print 2>/dev/null | sed 's#^\./##' | sort)"
if [ -n "$CONFLICTS" ]; then
  echo
  echo "[!] KHÔNG ĐẨY. Thư mục có $(printf '%s\n' "$CONFLICTS" | wc -l) file trùng do đồng bộ Drive:"
  printf '%s\n' "$CONFLICTS" | head -20 | sed 's/^/      - /'
  echo "    Mỗi file .conflict là một bản khác của file chính cùng tên (bỏ đuôi .conflictN)."
  echo "    Cách sửa: mở so với file chính, giữ lại bản đúng (chép nội dung đúng vào file chính),"
  echo "    rồi XÓA file .conflict và chạy lại ./$SELF. Script không tự xóa giúp."
  exit 1
fi

# ===== --dry-run: liệt kê file sẽ lên GitHub rồi dừng (không tạo .git, không commit, không push) =====
if [ "$DRY" = 1 ]; then
  echo
  echo "[--dry-run] Soát đều đạt. KHÔNG đẩy gì."
  if command -v git >/dev/null 2>&1; then
    # Dùng một kho Git tạm ngoài thư mục app để hỏi "git add -A" sẽ gom những file nào
    # (theo .gitignore + EXCLUDE), không đụng .git thật của app.
    TMPG="$(mktemp -d)"
    GIT_DIR="$TMPG" git init -q 2>/dev/null
    mkdir -p "$TMPG/info"
    set -f
    for P in $EXCLUDE; do printf '%s\n' "$P"; done > "$TMPG/info/exclude"
    set +f
    LIST="$(git --git-dir="$TMPG" --work-tree=. -c core.quotepath=off -c core.safecrlf=false \
      add -A --dry-run 2>/dev/null | sed -E "s/^add '(.*)'$/\1/")"
    rm -rf "$TMPG"
    N="$(printf '%s\n' "$LIST" | grep -c .)"
    SIZE="$(printf '%s\n' "$LIST" | grep . | tr '\n' '\0' | xargs -0 -r du -cb 2>/dev/null | tail -1 | cut -f1)"
    echo "    Sẽ lên GitHub $N file, tổng $(( ${SIZE:-0} / 1024 )) KB:"
    printf '%s\n' "$LIST" | head -80 | sed 's/^/      /'
    [ "$N" -gt 80 ] && echo "      ... (còn $(( N - 80 )) file)"
  fi
  echo "    Đẩy thật: ./$SELF"
  exit 0
fi

# ===== [1/5] Kiểm tra đã cài Git chưa =====
if ! command -v git >/dev/null 2>&1; then
  echo "[!] Máy này chưa cài Git. Cài một lần bằng lệnh:"
  echo "      sudo apt install -y git"
  echo "    rồi chạy lại ./$SELF"
  exit 1
fi

# ===== [2/5] Khởi tạo / nối Git trong thư mục app =====
if [ -d .git ]; then
  echo "[2/5] Git đã có sẵn, cập nhật địa chỉ repo..."
  git remote set-url origin "https://github.com/$REPO.git" 2>/dev/null \
    || git remote add origin "https://github.com/$REPO.git"
  git branch -M "$BRANCH"
else
  echo "[2/5] Khởi tạo Git lần đầu..."
  git init -q
  git branch -M "$BRANCH"
  git remote add origin "https://github.com/$REPO.git"
  # File chép từ Windows/Drive có xuống dòng CRLF: commit lên GitHub dạng LF như bên Surface
  git config core.autocrlf input
  # Repo trên GitHub đã có code (đẩy từ Surface) thì nối vào lịch sử đó, không tạo lịch sử mới.
  # ls-remote: 0 = có nhánh, 2 = repo có nhưng còn trống, khác = chưa có repo / không vào được.
  git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1
  LS=$?
  if [ "$LS" = 0 ]; then
    echo "      Repo trên GitHub đã có code, đang nối vào lịch sử nhánh $BRANCH..."
    if git fetch -q origin "$BRANCH" && git reset -q "origin/$BRANCH"; then
      git branch -q --set-upstream-to="origin/$BRANCH" "$BRANCH"
    else
      echo "[!] Không tải được lịch sử từ GitHub. Xem lỗi ở trên rồi chạy lại."
      rm -rf .git
      exit 1
    fi
  elif [ "$LS" = 2 ]; then
    echo "      Repo trên GitHub còn trống, đây là lần đẩy đầu tiên."
  else
    rm -rf .git
    echo
    echo "[!] KHÔNG ĐẨY. Chưa vào được repo https://github.com/$REPO"
    echo "    Thường là repo \"${REPO#*/}\" chưa được tạo (hoặc máy đang mất mạng)."
    echo "    Làm một lần:"
    guide_create
    exit 1
  fi
fi

# Git cần biết tên + email người commit. Chưa có thì hỏi một lần, lưu riêng cho thư mục này.
if [ -z "$(git config user.name)" ]; then
  read -r -p "Nhập tên của anh để ghi vào lịch sử (ví dụ: BS Thong): " GITNAME
  git config user.name "${GITNAME:-ditruyenhungvuong}"
fi
if [ -z "$(git config user.email)" ]; then
  read -r -p "Nhập email GitHub của anh (Enter để bỏ qua): " GITEMAIL
  git config user.email "${GITEMAIL:-ditruyenhungvuong@users.noreply.github.com}"
fi

# ===== [3/5] Gom file =====
echo "[3/5] Đang gom toàn bộ file..."
# File không được lên GitHub: ghi vào .git/info/exclude (chỉ trên máy này, không commit)
mkdir -p .git/info
touch .git/info/exclude
set -f   # EXCLUDE có mẫu *.conflict*: không để shell tự bung thành tên file
for P in $EXCLUDE; do
  grep -qxF "$P" .git/info/exclude || printf '%s\n' "$P" >> .git/info/exclude
done
git -c core.safecrlf=false add -A
# Lỡ có trong lịch sử từ lần trước thì bỏ khỏi repo (file trên máy giữ nguyên)
# shellcheck disable=SC2086
git rm -r -q --cached --ignore-unmatch -- $EXCLUDE >/dev/null 2>&1
set +f
# Giữ quyền chạy cho upload.sh, tools/serve.sh, tests/run-all.sh để clone về máy khác vẫn chạy được
git update-index --chmod=+x "$SELF" 2>/dev/null
for X in tools/serve.sh tests/run-all.sh; do
  [ -f "$X" ] && git update-index --chmod=+x "$X" 2>/dev/null
done

# Chốt an toàn: lần này có XÓA file nào trên GitHub không (ví dụ thư mục chỉ là bản chép thiếu hình)
DELETED="$(git diff --cached --diff-filter=D --name-only)"
if [ -n "$DELETED" ]; then
  echo
  echo "[!] Lần đẩy này sẽ XÓA $(printf '%s\n' "$DELETED" | wc -l) file khỏi GitHub (và khỏi trang web):"
  printf '%s\n' "$DELETED" | head -20 | sed 's/^/      - /'
  [ "$(printf '%s\n' "$DELETED" | wc -l)" -gt 20 ] && echo "      ..."
  read -r -p "    Gõ  co  để đồng ý xóa, Enter để dừng lại: " OK
  if [ "$OK" != "co" ]; then
    git reset -q
    echo "    Đã dừng, chưa đẩy gì. Chép lại các file thiếu vào thư mục rồi chạy lại."
    exit 1
  fi
fi

# ===== [4/5] Commit =====
echo "[4/5] Đang tạo bản commit..."
if git diff --cached --quiet; then
  echo "      Không có thay đổi mới so với lần trước, chỉ đẩy lại bản hiện tại."
elif git commit -q -m "$MSG"; then
  echo "      Đã tạo commit: $MSG"
else
  echo "[!] Tạo commit thất bại. Xem lỗi chi tiết ở trên."
  exit 1
fi

# ===== [5/5] Push =====
echo "[5/5] Đang đẩy code lên GitHub..."
if git push -u origin "$BRANCH"; then
  echo
  echo "[V] HOÀN THÀNH."
  echo "    Mã nguồn:  https://github.com/$REPO"
  echo "    Trang web: $PAGES"
  [ -n "$EXTRA_DONE" ] && echo "    $EXTRA_DONE"
  echo "    (Lần đầu cần bật GitHub Pages: mở https://github.com/$REPO/settings/pages"
  echo "     > Source: Deploy from a branch > Branch: $BRANCH / (root) > Save."
  echo "     Đợi 1-2 phút rồi mở link trên. Các lần sau tự cập nhật.)"
  exit 0
fi

echo
echo "[!] KHÔNG ĐẨY ĐƯỢC. Thường do một trong bốn lý do:"
echo
echo "    1. Máy này chưa đăng nhập GitHub (GitHub không nhận mật khẩu thường khi đẩy code)."
echo "       Làm một lần:"
echo "         sudo apt install -y gh"
echo "         gh auth login        (chọn GitHub.com > HTTPS > Login with a web browser)"
echo "         gh auth setup-git"
echo "       rồi chạy lại ./$SELF"
echo
echo "    2. Chưa có repo \"${REPO#*/}\" trên GitHub:"
guide_create
echo
echo "    3. Tài khoản đang đăng nhập chưa có quyền với repo $REPO:"
echo "       Mở https://github.com/$REPO/settings/access"
echo "       bấm \"Add people\", thêm tài khoản GitHub đang dùng trên máy này, rồi chạy lại."
echo
echo "    4. Trên GitHub có thay đổi mà máy chưa có (đẩy từ Surface hoặc sửa trên web):"
echo "       Chạy lệnh:  git pull --rebase origin $BRANCH   rồi chạy lại ./$SELF"
echo
exit 1
