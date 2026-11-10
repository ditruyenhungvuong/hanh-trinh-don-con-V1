@echo off
chcp 65001 >nul
setlocal

rem ============================================================
rem  upload.bat - day app "Hanh Trinh Don Con" len GitHub Pages (Windows)
rem  Chu: devops (T-07). Ban Ubuntu tuong duong: upload.sh
rem  Nguon: apps/sung-suc/upload.bat @ 10/11/2026 (ADR 0008). Doi so voi Sung Suc:
rem    - app khong goi mang (ADR 0011): bo phan GOOGLE_SCRIPT_URL / MOCK / ACCOUNT_ENABLED / ID Apps Script cu,
rem      thay bang chan moi dia chi script.google.com va localhost trong code;
rem    - soat CSP con connect-src 'none' + worker-src 'none' (check-static --strict soat nguyen van);
rem    - soat APP_URL trong js\config.js khop repo; chan file bi mat (.env, khoa, chung chi);
rem    - them  --dry-run : chi soat + liet ke file se len GitHub, khong dung Git.
rem  Ngan sach (tech design 11.1): chua nen 480 KB, gzip 175 KB, lan tai dau 560 KB.
rem  Cach dung: bam dup file nay. Moi lan chay = mot lan cap nhat.
rem  Co the truyen loi commit:  upload.bat "Sua mau nut"
rem  Chi soat, khong day:       upload.bat --dry-run
rem  Repo: https://github.com/ditruyenhungvuong/hanh-trinh-don-con-V1
rem  Web:  https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/
rem  Can Node (tu ban 18 tro len) de chay buoc soat tinh truoc khi day.
rem
rem  Thong bao viet khong dau vi cua so cmd mac dinh khong hien
rem  tieng Viet co dau (theo docs/style/architecture-pattern.md muc 12).
rem ============================================================

rem Luon chay dung thu muc chua file nay, du bam dup tu dau
cd /d "%~dp0"

set "OWNER=ditruyenhungvuong"
set "REPONAME=hanh-trinh-don-con-V1"
set "REPO=ditruyenhungvuong/hanh-trinh-don-con-V1"
set "BRANCH=main"
set "PAGES=https://ditruyenhungvuong.github.io/hanh-trinh-don-con-V1/"
set "CONFIG=js\config.js"
set "CHECK_STATIC=tests\check-static.js"
set "MSG=Cap nhat app Hanh Trinh Don Con"
rem Khong day len GitHub: ghi vao .git\info\exclude (chi tren may nay), bo khoi repo neu lo co
rem *.conflict* = ban trung do dong bo Drive ^(rclone bisync^) sinh ra; ghi rieng ben duoi vi for cua cmd bung dau *
set "EXCLUDE=NGUON.md .claude/ qa-out/ tests/out/ node_modules/"
set "DRY="
if /i "%~1"=="--dry-run" (
    set "DRY=1"
) else (
    if not "%~1"=="" set "MSG=%~1"
)

echo.
if defined DRY (
    echo ======== SOAT THU --dry-run, KHONG DAY: %REPO% ========
) else (
    echo ======== DANG TAI CODE LEN GITHUB: %REPO% ========
)
echo Thu muc: %CD%
echo.

rem ---------- [0/5] Soat truoc khi day ----------
echo [0/5] Kiem tra cau hinh va code...
if not exist "%CONFIG%" goto :noconfig
if not exist "index.html" goto :noconfig
rem Dia chi may local trong config (tru dong comment)
findstr /N /R /C:"localhost" /C:"127\.0\.0\.1" /C:"0\.0\.0\.0" "%CONFIG%" 2>nul | findstr /V /R /C:"^[0-9]*: *//" /C:"^[0-9]*: */\*" /C:"^[0-9]*: *\*" >nul 2>&1
if %errorlevel% equ 0 goto :otherlocal
rem APP_URL phai khop trang web cua repo nay
findstr /R /C:"^ *APP_URL *:" "%CONFIG%" 2>nul | findstr /L /C:"%PAGES%" >nul 2>&1
if %errorlevel% neq 0 goto :appurl
rem CSP trong index.html phai con chan mang (ADR 0011)
findstr /L /C:"Content-Security-Policy" index.html >nul 2>&1
if %errorlevel% neq 0 goto :cspgone
findstr /L /C:"connect-src 'none'" index.html >nul 2>&1
if %errorlevel% neq 0 goto :cspbroken
findstr /L /C:"worker-src 'none'" index.html >nul 2>&1
if %errorlevel% neq 0 goto :cspbroken
findstr /L /C:"unsafe-eval" index.html >nul 2>&1
if %errorlevel% equ 0 goto :cspbroken

rem Chuoi URL tro vao may local trong code (vi du 'http://127.0.0.1:8774/...') cung chan.
findstr /N /R /C:"https*://localhost" /C:"https*://127\.0\.0\.1" /C:"https*://0\.0\.0\.0" index.html styles.css css\*.css js\*.js >nul 2>&1
if %errorlevel% equ 0 goto :codelocal
rem App khong gui gi len mang: khong duoc co dia chi Apps Script / Google Sheet
findstr /N /R /C:"script\.google\.com" /C:"script\.googleusercontent\.com" /C:"docs\.google\.com/spreadsheets" /C:"googleapis\.com" index.html styles.css css\*.css js\*.js >nul 2>&1
if %errorlevel% equ 0 goto :codenet
rem File bi mat khong bao gio duoc len GitHub (repo cong khai)
dir /s /b /a-d .env .env.* *.pem *.key *.p12 *.pfx id_rsa* id_ed25519* .git-credentials credentials*.json service-account*.json client_secret*.json 2>nul | findstr /V /I /L /E /C:".env.example" >nul 2>&1
if %errorlevel% equ 0 goto :secrets
echo       Cau hinh on: APP_URL dung repo, CSP chan mang, khong dia chi local, khong file bi mat.

rem ---------- Soat tinh: CSP nguyen van, API cam, cum cam, ngan sach ----------
if not exist "%CHECK_STATIC%" goto :nocheck
rem Tim Node: bien NODE ^> node trong PATH ^> Node di kem Codex tren may anh
set "NODEBIN="
if defined NODE set "NODEBIN=%NODE%"
if not defined NODEBIN (
    where node >nul 2>&1 && set "NODEBIN=node"
)
if not defined NODEBIN if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODEBIN=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODEBIN if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node.exe" set "NODEBIN=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node.exe"
if not defined NODEBIN goto :nonode
echo       Soat tinh ^(%CHECK_STATIC% --strict^)...
set "CSOUT=%TEMP%\hanh-trinh-don-con-check-static.txt"
"%NODEBIN%" "%CHECK_STATIC%" --strict > "%CSOUT%" 2>&1
if %errorlevel% neq 0 goto :staticfail
for /f "delims=" %%l in ('findstr /B /C:"check-static:" "%CSOUT%"') do echo       %%l
del "%CSOUT%" >nul 2>&1

rem Ban trung do dong bo Drive: rclone bisync sinh *.conflict1, *.conflict2... khi mot file
rem bi sua o ca hai phia. Khong tu xoa vi co khi ban .conflict moi la ban dung. Dung de anh xem.
set "HASCONF="
for /f "delims=" %%f in ('dir /s /b /a-d "*.conflict*" 2^>nul') do set "HASCONF=1"
if defined HASCONF goto :conflicts

if defined DRY goto :dryrun

rem ---------- [1/5] Kiem tra da cai Git chua ----------
git --version >nul 2>&1
if %errorlevel% neq 0 goto :nogit

rem ---------- [2/5] Khoi tao / noi Git trong thu muc app ----------
if exist ".git\" goto :hasgit
echo [2/5] Khoi tao Git lan dau...
git init >nul
git branch -M %BRANCH%
git remote add origin https://github.com/%REPO%.git
rem File chep tu Windows/Drive co xuong dong CRLF: commit len GitHub dang LF
git config core.autocrlf input
rem Repo tren GitHub da co code thi noi vao lich su do, khong tao lich su moi.
rem ls-remote: 0 = co nhanh, 2 = repo co nhung con trong, khac = chua co repo / khong vao duoc.
git ls-remote --exit-code --heads origin %BRANCH% >nul 2>&1
if %errorlevel% equ 2 goto :emptyrepo
if %errorlevel% neq 0 goto :norepo
echo       Repo tren GitHub da co code, dang noi vao lich su nhanh %BRANCH%...
git fetch -q origin %BRANCH%
if %errorlevel% neq 0 goto :fetchfail
git reset -q origin/%BRANCH%
git branch -q --set-upstream-to=origin/%BRANCH% %BRANCH%
goto :identity

:emptyrepo
echo       Repo tren GitHub con trong, day la lan day dau tien.
goto :identity

:hasgit
echo [2/5] Git da co san, cap nhat dia chi repo...
git remote set-url origin https://github.com/%REPO%.git 2>nul || git remote add origin https://github.com/%REPO%.git
git branch -M %BRANCH%

:identity
rem Git can biet ten + email nguoi commit. Chua co thi hoi mot lan, luu rieng cho thu muc nay.
set "GITNAME="
set "GITEMAIL="
for /f "delims=" %%n in ('git config user.name 2^>nul') do set "GITNAME=%%n"
for /f "delims=" %%e in ('git config user.email 2^>nul') do set "GITEMAIL=%%e"
if not defined GITNAME call :askname
if not defined GITEMAIL call :askemail

rem ---------- [3/5] Gom file ----------
echo [3/5] Dang gom toan bo file...
rem File khong duoc len GitHub: ghi vao .git\info\exclude (chi tren may nay, khong commit)
if not exist ".git\info\" mkdir ".git\info"
if not exist ".git\info\exclude" type nul > ".git\info\exclude"
for %%p in (%EXCLUDE%) do (
    findstr /X /L /C:"%%p" ".git\info\exclude" >nul 2>&1 || >>".git\info\exclude" echo %%p
)
findstr /X /L /C:"*.conflict*" ".git\info\exclude" >nul 2>&1 || >>".git\info\exclude" echo *.conflict*
git -c core.safecrlf=false add -A
rem Lo co trong lich su tu lan truoc thi bo khoi repo (file tren may giu nguyen)
git rm -r -q --cached --ignore-unmatch -- %EXCLUDE% "*.conflict*" >nul 2>&1
rem Giu quyen chay cho cac file .sh de may Ubuntu clone ve van chay duoc
git update-index --chmod=+x upload.sh >nul 2>&1
git update-index --chmod=+x tools/serve.sh >nul 2>&1
git update-index --chmod=+x tests/run-all.sh >nul 2>&1

rem Chot an toan: lan nay co XOA file nao tren GitHub khong.
rem Thu muc chi la ban chep thieu hinh thi se hien o day: DUNG LAI, chep du file roi chay lai.
set "HASDEL="
for /f "delims=" %%f in ('git diff --cached --diff-filter=D --name-only') do set "HASDEL=1"
if not defined HASDEL goto :commit
echo.
echo [!] Lan day nay se XOA cac file sau khoi GitHub va khoi trang web:
for /f "delims=" %%f in ('git diff --cached --diff-filter=D --name-only') do echo       - %%f
set "OK="
set /p "OK=    Go  co  de dong y xoa, Enter de dung lai: "
if /i not "%OK%"=="co" goto :stopdel

:commit
rem ---------- [4/5] Commit ----------
echo [4/5] Dang tao ban commit...
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo       Khong co thay doi moi so voi lan truoc, chi day lai ban hien tai.
    goto :push
)
git commit -m "%MSG%" >nul
if %errorlevel% neq 0 (
    echo [!] Tao commit that bai. Chay lai upload.bat de xem loi chi tiet o tren.
    goto :end
)
echo       Da tao commit: %MSG%

rem ---------- [5/5] Push ----------
:push
echo [5/5] Dang day code len GitHub ^(co the hien cua so dang nhap GitHub^)...
git push -u origin %BRANCH%
if %errorlevel% neq 0 goto :pushfail

echo.
echo [V] HOAN THANH.
echo     Ma nguon:  https://github.com/%REPO%
echo     Trang web: %PAGES%
echo     ^(Lan dau can bat GitHub Pages: mo https://github.com/%REPO%/settings/pages
echo      ^> Source: Deploy from a branch ^> Branch: %BRANCH% / ^(root^) ^> Save.
echo      Doi 1-2 phut roi mo link tren. Cac lan sau tu cap nhat.^)
goto :end

rem ============================================================
rem  --dry-run: liet ke file se len GitHub roi dung (khong tao .git, khong commit, khong push)
rem ============================================================
:dryrun
echo.
echo [--dry-run] Soat deu dat. KHONG day gi.
git --version >nul 2>&1
if %errorlevel% neq 0 goto :dryend
rem Dung mot kho Git tam ngoai thu muc app de hoi "git add -A" se gom nhung file nao
set "TMPG=%TEMP%\htdc-dry-%RANDOM%%RANDOM%"
set "GIT_DIR=%TMPG%"
git init -q >nul 2>&1
set "GIT_DIR="
if not exist "%TMPG%\info\" mkdir "%TMPG%\info"
type nul > "%TMPG%\info\exclude"
for %%p in (%EXCLUDE%) do >>"%TMPG%\info\exclude" echo %%p
>>"%TMPG%\info\exclude" echo *.conflict*
echo     Se len GitHub cac file sau:
git --git-dir="%TMPG%" --work-tree=. -c core.quotepath=off -c core.safecrlf=false add -A --dry-run > "%TMPG%.txt" 2>nul
type "%TMPG%.txt"
for /f %%c in ('find /c /v "" ^< "%TMPG%.txt"') do echo     Tong: %%c file.
del "%TMPG%.txt" >nul 2>&1
rmdir /s /q "%TMPG%" >nul 2>&1
:dryend
echo     Day that: bam dup upload.bat
goto :end

rem ============================================================
rem  Cac nhanh dung lai vi cau hinh chua san sang
rem ============================================================
:noconfig
echo.
echo [!] KHONG DAY. Khong thay %CONFIG% hoac index.html trong thu muc nay.
echo     Co the dang chay upload.bat o sai thu muc. Thu muc hien tai: %CD%
goto :end

:otherlocal
echo.
echo [!] KHONG DAY. %CONFIG% con dia chi may local:
findstr /N /R /C:"localhost" /C:"127\.0\.0\.1" /C:"0\.0\.0\.0" "%CONFIG%" | findstr /V /R /C:"^[0-9]*: *//" /C:"^[0-9]*: */\*" /C:"^[0-9]*: *\*"
echo     Tren web, dia chi nay tro vao may cua nguoi dang dung app nen khong chay. Sua roi chay lai.
goto :end

:appurl
echo.
echo [!] KHONG DAY. APP_URL trong %CONFIG% khong khop trang web cua repo nay.
echo     Dang la:
findstr /R /C:"^ *APP_URL *:" "%CONFIG%"
echo     Phai la:  APP_URL: '%PAGES%',
goto :end

:cspgone
echo.
echo [!] KHONG DAY. index.html khong con the meta Content-Security-Policy.
echo     The nay la lop khoa "app khong gui gi len mang" ^(ADR 0011^).
echo     Tra lai dung nguyen van tech design muc 3.1 roi chay lai.
goto :end

:cspbroken
echo.
echo [!] KHONG DAY. CSP trong index.html bi sua: phai co  connect-src 'none'  va  worker-src 'none',
echo     va khong duoc co 'unsafe-eval'. Thieu thi app co the gui du lieu ra ngoai.
echo     Tra lai CSP dung nguyen van tech design muc 3.1 roi chay lai.
goto :end

:codelocal
echo.
echo [!] KHONG DAY. Code con dia chi may local ^(tren web se khong chay^):
findstr /N /R /C:"https*://localhost" /C:"https*://127\.0\.0\.1" /C:"https*://0\.0\.0\.0" index.html styles.css css\*.css js\*.js 2>nul
echo     Sua cac dong tren roi chay lai.
goto :end

:codenet
echo.
echo [!] KHONG DAY. Code co dia chi Google Apps Script / Sheet:
findstr /N /R /C:"script\.google\.com" /C:"script\.googleusercontent\.com" /C:"docs\.google\.com/spreadsheets" /C:"googleapis\.com" index.html styles.css css\*.css js\*.js 2>nul
echo     Hanh Trinh Don Con khong gui gi len mang ^(ADR 0011^). Bo cac dong tren roi chay lai.
goto :end

:secrets
echo.
echo [!] KHONG DAY. Thu muc co file trong nhu mat khau / khoa bi mat:
dir /s /b /a-d .env .env.* *.pem *.key *.p12 *.pfx id_rsa* id_ed25519* .git-credentials credentials*.json service-account*.json client_secret*.json 2>nul | findstr /V /I /L /E /C:".env.example"
echo     Repo la cong khai, ai cung doc duoc. Chuyen cac file nay ra khoi thu muc app roi chay lai.
goto :end

:nocheck
echo.
echo [!] KHONG DAY. Khong thay %CHECK_STATIC% ^(thu muc tests bi thieu?^).
echo     Chep du thu muc app roi bam dup upload.bat lai.
goto :end

:nonode
echo.
echo [!] KHONG DAY. May nay chua co Node nen chua soat duoc app truoc khi day.
echo.
echo     Cach cai ^(lam mot lan^):
echo       1. Mo trang: https://nodejs.org/
echo       2. Tai ban "LTS" cho Windows va chay, bam Next het.
echo       3. Cai xong, DONG cua so nay, roi bam dup upload.bat lai.
goto :end

:staticfail
echo.
echo [!] KHONG DAY. Soat tinh chua dat:
findstr /B /C:"check-static:" "%CSOUT%"
findstr /B /C:"FAIL" "%CSOUT%"
echo     Vuot ngan sach ^(HTML+CSS+JS ^> 480 KB chua nen hoac ^> 175 KB gzip, lan tai dau ^> 560 KB^) thi got file truoc khi day.
echo     Xem du:  "%NODEBIN%" %CHECK_STATIC% --strict
goto :end

:conflicts
echo.
echo [!] KHONG DAY. Thu muc co file trung do dong bo Drive:
for /f "delims=" %%f in ('dir /s /b /a-d "*.conflict*" 2^>nul') do echo       - %%f
echo     Moi file .conflict la mot ban khac cua file chinh cung ten ^(bo duoi .conflictN^).
echo     Cach sua: mo so voi file chinh, giu lai ban dung ^(chep noi dung dung vao file chinh^),
echo     roi XOA file .conflict va bam dup upload.bat lai. Script khong tu xoa giup.
goto :end

rem ============================================================
rem  Cac nhanh loi
rem ============================================================
:norepo
rmdir /s /q ".git"
echo.
echo [!] KHONG DAY. Chua vao duoc repo https://github.com/%REPO%
echo     Thuong la repo "%REPONAME%" chua duoc tao ^(hoac may dang mat mang^).
echo     Lam mot lan:
call :guidecreate
goto :end

:fetchfail
echo [!] Khong tai duoc lich su tu GitHub. Xem loi o tren roi chay lai.
rmdir /s /q ".git"
goto :end

:stopdel
git reset -q
echo     Da dung, chua day gi. Chep lai cac file thieu - hinh - vao thu muc roi chay lai.
goto :end

:nogit
echo [!] May nay chua cai Git, nen chua day code len duoc.
echo.
echo     Cach cai ^(lam mot lan^):
echo       1. Mo trang: https://git-scm.com/download/win
echo       2. Tai ban "64-bit Git for Windows Setup" va chay, bam Next het.
echo       3. Cai xong, DONG cua so nay, roi bam dup upload.bat lai.
goto :end

:pushfail
echo.
echo [!] KHONG DAY DUOC. Thuong do mot trong ba ly do:
echo.
echo     1. Chua co repo "%REPONAME%" tren GitHub:
call :guidecreate
echo.
echo     2. Tai khoan Git tren may chua co quyen voi repo %REPO%:
echo        Mo https://github.com/%REPO%/settings/access
echo        bam "Add people", them tai khoan GitHub dang dung tren may nay, roi chay lai.
echo.
echo     3. Tren GitHub co thay doi ma may chua co ^(sua truc tiep tren web^):
echo        Chay lenh:  git pull --rebase origin %BRANCH%   roi bam dup upload.bat lai.
goto :end

rem ============================================================
rem  Chuong trinh con
rem ============================================================
:guidecreate
echo        a^) Mo https://github.com/new ^(dang nhap tai khoan %OWNER%^)
echo           - Repository name: %REPONAME%   ^(phai dung y ten nay^)
echo           - chon Public, KHONG tick "Add a README", khong chon .gitignore / license
echo           - bam Create repository.
echo        b^) Bam dup upload.bat lai. Day xong thi bat Pages ^(muc cuoi khi HOAN THANH^).
goto :eof

:askname
set /p "GITNAME=Nhap ten cua anh de ghi vao lich su (vi du: BS Thong): "
if not defined GITNAME set "GITNAME=ditruyenhungvuong"
git config user.name "%GITNAME%"
goto :eof

:askemail
set /p "GITEMAIL=Nhap email GitHub cua anh (Enter de bo qua): "
if not defined GITEMAIL set "GITEMAIL=ditruyenhungvuong@users.noreply.github.com"
git config user.email "%GITEMAIL%"
goto :eof

:end
echo.
pause
endlocal
