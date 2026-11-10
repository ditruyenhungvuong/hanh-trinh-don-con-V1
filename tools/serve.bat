@echo off
rem ============================================================
rem  tools\serve.bat - bam dup de chay app "Hanh Trinh Don Con" tren may minh (Windows)
rem  Chu: devops (T-07). Goi tools\serve.ps1 (cong 8774, chi 127.0.0.1).
rem  Nguon: apps/sung-suc/tools/serve.bat @ 10/11/2026 (ADR 0008), doi ten va cong.
rem  Co the truyen tham so cua serve.ps1, vi du:  tools\serve.bat -Port 9000 -NoBrowser
rem  Ban Ubuntu: tools/serve.sh
rem ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if %errorlevel% neq 0 pause
