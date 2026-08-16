@echo off
chcp 65001 > nul
echo ===================================================
echo   [ReturnPick] 쿠팡 핫딜 일일 자동 포스팅 스케줄러 등록
echo ===================================================

set TASK_NAME=ReturnPick_Daily_Coupang_Blog_Automation
set SCRIPT_PATH=C:\projects\returnpick\run-daily-pipeline.bat

echo 스케줄러 태스크 등록 중... (매일 오전 09:00 및 오후 18:00 자동 실행)
schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc daily /st 09:00 /f

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ [성공] Windows 작업 스케줄러에 등록 완료되었습니다!
    echo   - 태스크 이름: %TASK_NAME%
    echo   - 실행 대상: %SCRIPT_PATH%
    echo   - 실행 주기: 매일 오전 09:00
) else (
    echo.
    echo ⚠️ 관리자 권한이 필요할 수 있습니다.
)

echo ===================================================
pause
