@echo off
chcp 65001 > nul
echo ===================================================
echo   [ReturnPick] 주간/야간 2회 분할 무인 자동 스케줄러 등록
echo ===================================================

:: 1. 오전 09:00 주간 핫딜 & 반품특가 자동 갱신
schtasks /create /tn "ReturnPick_Daily_Day_Pipeline" /tr "C:\projects\returnpick\run-daily-pipeline.bat" /sc daily /st 09:00 /f

:: 2. 오후 21:30 야간 로켓프레시 자정 마감특가 자동 갱신
schtasks /create /tn "ReturnPick_Daily_Night_RocketFresh" /tr "node C:\projects\returnpick\scripts\publish-rocket-fresh-night-deals.mjs" /sc daily /st 21:30 /f

echo.
echo ✅ [성공] 주간(09:00) 및 야간(21:30) 2회 분할 스케줄러 등록 완료!
echo   1) 오전 09:00 -> 주간 핫딜 / 반품 전자기기 특가 갱신
echo   2) 오후 21:30 -> 야간 로켓프레시 자정 마감 특가 갱신
echo ===================================================
timeout /t 3 > nul
