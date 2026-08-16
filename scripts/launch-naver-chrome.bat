@echo off
chcp 65001 > nul
echo ===================================================
echo   [ReturnPick] 사용자 화면 전용 네이버 크롬 브라우저 실행
echo ===================================================

set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set USER_DIR="C:\projects\returnpick\.naver_chrome_profile"

start "" %CHROME_PATH% --remote-debugging-port=9222 --user-data-dir=%USER_DIR% --window-size=1280,900 "https://nid.naver.com/nidlogin.login"

echo ✅ 크롬 브라우저가 화면에 실행되었습니다!
