@echo off
setlocal
rem ============================================================
rem   BAT ^> COM Converter v4        Iron Claw
rem ============================================================
rem   v4: detection and conversion both live in debug2com.ps1 so
rem       the two can never disagree. The old findstr probe is
rem       gone - it relied on the undocumented /r + /c: mix, and
rem       its "|debug" alternative was a dead literal match that
rem       nothing ever used.
rem   Helper exit codes:
rem     0 = converted ok          4 = not a debug script
rem     1 = input file missing    2 = bad address / bad byte
rem     3 = image exceeds 64 KB
rem ============================================================

if "%~1"=="" goto help
set "IN=%~1"
set "OUT=%~dpn1.com"

if not exist "%IN%" (
  echo [ERROR] File not found: %IN%
  pause
  endlocal
  exit /b 1
)

echo Converting: %~nx1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0debug2com.ps1" "%IN%" "%OUT%"
set "RC=%errorlevel%"

if "%RC%"=="0" goto end
if "%RC%"=="4" goto normal
echo [ERROR] conversion failed - helper exit code %RC%
pause
endlocal
exit /b 1

:normal
echo Type: normal BAT  ^(no DEBUG "e" lines^)
echo.
echo A plain .bat is a text file that only COMMAND.COM can run.
echo Turning it into a .COM would just make the CPU run the text as
echo machine code, so this converter will not fake one.
echo Copying it as a DOS-ready .bat instead:
set "DOSBAT=%~dpn1_dos.bat"
copy /y "%IN%" "%DOSBAT%" >nul
if errorlevel 1 (
  echo [ERROR] copy failed
  pause
  endlocal
  exit /b 1
)
echo   [OK] %DOSBAT%
echo.
echo Run it in DOSBox with:
echo   mount c "%~d1%~p1"
echo   c:
echo   %~n1_dos.bat
goto end

:help
echo.
echo    ==============================
echo       BAT ^> COM Converter v4
echo       Iron Claw
echo    ==============================
echo.
echo    Usage: Drag a .bat file onto this file
echo       or: bat2com.bat file.bat
echo.
echo    DEBUG script  -^> real .COM image
echo    normal .bat   -^> copied to _dos.bat + DOSBox hints
echo.

:end
pause
endlocal
