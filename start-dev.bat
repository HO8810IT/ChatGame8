@echo off
REM Windows用にVite devサーバとElectronを同時起動するバッチファイル
cd /d %~dp0
start "Vite Dev Server" cmd /k "npm run dev"
start "Electron App" cmd /k "npm run start"
exit
