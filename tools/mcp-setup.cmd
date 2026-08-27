@echo off
REM ---------------------------------------------------------------------
REM  Media MCP setup. Double-click this file.
REM
REM  WHY THIS EXISTS: `claude mcp login` needs a real terminal. An agent
REM  shell has no TTY, so the OAuth flow refuses with "stdin isn't a
REM  terminal" and will not even print the URL with --no-browser. This
REM  script IS a real console, so the identical command works here.
REM
REM  ARTLIST IS NOT IN THIS MENU, AND CANNOT BE. Measured 2026-08-27:
REM  its Auth0 tenant answers "dynamic client registration is disabled".
REM  `claude mcp login` holds no pre-issued client_id, so it MUST register
REM  dynamically, and Artlist refuses. Higgsfield allows it and returns a
REM  client_id instantly, which is the control that proves the cause.
REM  Artlist therefore has to go in through claude.ai as a custom
REM  connector instead -- see option [3].
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
echo    [1]  Authorise Higgsfield  (works from here)
echo.
echo    [2]  Open Higgsfield pricing in browser
echo.
echo    [3]  Artlist instructions  (cannot be done from here)
echo.
echo    [4]  Re-check status
echo    [0]  Done / quit
echo  ----------------------------------------------------------------
echo.
set "choice="
set /p choice="  Choose: "

if "%choice%"=="1" goto higgsfield
if "%choice%"=="2" start "" "https://higgsfield.ai/pricing" & goto menu
if "%choice%"=="3" goto artlist
if "%choice%"=="4" goto menu
if "%choice%"=="0" goto done
goto menu

:higgsfield
echo.
echo   A browser window will open. Sign in to Higgsfield and approve.
echo.
call claude mcp login higgsfield
echo.
pause
goto menu

:artlist
cls
echo.
echo  ================================================================
echo   ARTLIST - must be added through claude.ai, not the CLI
echo  ================================================================
echo.
echo   WHY: Artlist's auth server has dynamic client registration
echo   turned off. `claude mcp login` has no pre-issued client_id, so
echo   it cannot register itself and the flow can never complete. This
echo   is Artlist's server config; nothing local can change it.
echo.
echo   THE WAY IN - claude.ai custom connector:
echo.
echo     1. Open claude.ai  (opening it now)
echo     2. Settings  ^>  Connectors  ^>  Add custom connector
echo     3. Name:  Artlist
echo     4. URL :  https://mcp.artlist.io/mcp
echo     5. Sign in and approve access
echo.
echo   Account connectors show up in `claude mcp list` the same way
echo   "claude.ai Adobe for creativity" already does.
echo.
echo   HONEST CAVEAT: whether an account connector's tools reach a
echo   Claude Code CLI session is UNCONFIRMED. The Adobe one connects
echo   but its tools have never loaded here. If Artlist behaves the
echo   same way, it will be usable on claude.ai but not from this
echo   pipeline.
echo.
start "" "https://claude.ai/settings/connectors"
echo.
pause
goto menu

:done
echo.
echo  ----------------------------------------------------------------
call claude mcp list
echo.
echo   Anything showing "Connected" is ready -- but FULLY QUIT Claude
echo   Code and start a NEW session. Resuming is not enough: MCP tools
echo   load only at session start.
echo  ----------------------------------------------------------------
echo.
pause
