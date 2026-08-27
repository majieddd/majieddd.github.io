@echo off
REM ---------------------------------------------------------------------
REM  Media MCP setup: Artlist and Higgsfield. Double-click this file.
REM
REM  WHY THIS EXISTS: `claude mcp login` needs a real terminal. An agent
REM  shell has no TTY, so the OAuth flow refuses with "stdin isn't a
REM  terminal" and will not even print the URL with --no-browser. This
REM  script IS a real console, so the identical command works here.
REM
REM  DO ARTLIST FIRST. Its MCP has been reported working on the FREE
REM  plan, so the style question can be answered at zero cost. Paying
REM  before knowing whether a provider can paint the house style is the
REM  mistake this whole exercise keeps circling.
REM ---------------------------------------------------------------------
title Media MCP setup
:menu
cls
echo.
echo  ================================================================
echo   MEDIA MCP SETUP
echo  ================================================================
echo.
echo   Current status:
echo.
call claude mcp list 2>nul | findstr /i "artlist higgsfield"
echo.
echo  ----------------------------------------------------------------
echo    [1]  Artlist    - RECOMMENDED FIRST. Free plan reportedly
echo                      works, so testing costs nothing. Also the
echo                      only option covering music, SFX and
echo                      voiceover, which is this game's real gap.
echo.
echo    [2]  Higgsfield - 30+ image models. Confirm with support
echo                      whether unlimited applies through the MCP
echo                      before paying; their page says plan credits
echo                      still apply.
echo.
echo    [3]  Open Artlist pricing in browser
echo    [4]  Open Higgsfield pricing in browser
echo    [5]  Re-check status
echo    [0]  Done / quit
echo  ----------------------------------------------------------------
echo.
set "choice="
set /p choice="  Choose: "

if "%choice%"=="1" goto artlist
if "%choice%"=="2" goto higgsfield
if "%choice%"=="3" start "" "https://artlist.io/page/pricing/max" & goto menu
if "%choice%"=="4" start "" "https://higgsfield.ai/pricing" & goto menu
if "%choice%"=="5" goto menu
if "%choice%"=="0" goto done
goto menu

:artlist
echo.
echo   A browser window will open. Sign in to Artlist and approve.
echo.
call claude mcp login artlist
echo.
pause
goto menu

:higgsfield
echo.
echo   A browser window will open. Sign in to Higgsfield and approve.
echo.
call claude mcp login higgsfield
echo.
pause
goto menu

:done
echo.
echo  ----------------------------------------------------------------
call claude mcp list
echo.
echo   Anything showing "Connected" is ready -- but RESTART your
echo   Claude Code session. MCP tools only load at session start, so
echo   the running session still cannot see them.
echo  ----------------------------------------------------------------
echo.
pause
