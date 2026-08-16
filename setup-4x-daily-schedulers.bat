@echo off
chcp 65001 > nul
echo ===================================================
echo   [ReturnPick] 하루 4회 피크타임 초공격적 무인 스케줄러 등록
echo ===================================================

:: 1. 오전 08:30 (출근길 모바일 쇼핑 타겟)
schtasks /create /tn "ReturnPick_Pipeline_0830_Morning" /tr "C:\projects\returnpick\run-daily-pipeline.bat" /sc daily /st 08:30 /f

:: 2. 오후 12:30 (점심시간 직장인 핫딜 타겟)
schtasks /create /tn "ReturnPick_Pipeline_1230_Lunch" /tr "C:\projects\returnpick\run-daily-pipeline.bat" /sc daily /st 12:30 /f

:: 3. 오후 18:30 (퇴근길 저녁 쇼핑 & VIP 가전 타겟)
schtasks /create /tn "ReturnPick_Pipeline_1830_Evening" /tr "C:\projects\returnpick\run-daily-pipeline.bat" /sc daily /st 18:30 /f

:: 4. 오후 21:30 (야간 로켓프레시 자정 마감 타겟)
schtasks /create /tn "ReturnPick_Pipeline_2130_Night" /tr "C:\projects\returnpick\run-daily-pipeline.bat" /sc daily /st 21:30 /f

echo.
echo ✅ [성공] 하루 4회 피크타임 초공격적 스케줄러 등록 완료!
echo   1) 08:30 -> 출근길 모바일 핫딜
echo   2) 12:30 -> 점심시간 실시간 핫딜
echo   3) 18:30 -> 퇴근길 VIP 초고단가 가전
echo   4) 21:30 -> 야간 로켓프레시 24시 마감
echo ===================================================
timeout /t 3 > nul
