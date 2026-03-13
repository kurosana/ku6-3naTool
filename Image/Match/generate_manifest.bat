@echo off
chcp 65001 > nul
cd /d "%~dp0"

set OUTFILE=..\..\Data\match_manifest.txt

(
  for %%f in (Normal\*.png) do echo Normal/%%~nxf
  for %%f in (Shadow\*.png) do echo Shadow/%%~nxf
  for %%f in (Light\*.png) do echo Light/%%~nxf
) > "%OUTFILE%"

echo.
echo match_manifest.txt を更新しました！
echo （Normal: 通常ポケモン画像 / Shadow: シャドウポケモン画像）
echo.
pause
