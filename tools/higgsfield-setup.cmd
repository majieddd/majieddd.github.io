@echo off
REM ---------------------------------------------------------------------
REM  Higgsfield MCP setup. Double-click this file.
REM
REM  WHY THIS EXISTS: `claude mcp login` needs a real terminal. An agent
REM  shell has no TTY, so the OAuth flow refuses with "stdin isn't a
REM  terminal". This script IS a real console, so the same command works.
REM ---------------------------------------------------------------------
title Higgsfield MCP setup
echo.
echo  ================================================================
echo   HIGGSFIELD MCP SETUP
echo  ================================================================
echo.
echo   STEP 1 of 2 - Account and plan
echo.
echo   Opening the Higgsfield pricing page in your browser.
echo   You need an active plan BEFORE authorising, and for unlimited
echo   image models that is the Plus tier.
echo.
echo   ASK THEM FIRST, in support chat, whether unlimited applies
echo   through the MCP - their own page says "existing plan credits
echo   work seamlessly", which reads like credits still meter it.
echo   That one question decides whether this is worth the money.
echo.
start "" "https://higgsfield.ai/pricing"
echo.
echo   Press any key here ONCE you have an active plan...
pause >nul
echo.
echo  ----------------------------------------------------------------
echo   STEP 2 of 2 - Authorise Claude Code
echo.
echo   A browser window will open for you to sign in to Higgsfield.
echo   Sign in, approve the access request, and come back here.
echo  ----------------------------------------------------------------
echo.
call claude mcp login higgsfield
echo.
echo  ----------------------------------------------------------------
echo   Result:
echo  ----------------------------------------------------------------
call claude mcp list
echo.
echo   If higgsfield shows "Connected", you are done. RESTART your
echo   Claude Code session - MCP tools only load at session start, so
echo   the current session still cannot see them.
echo.
echo   If it still shows "Needs authentication", run this file again.
echo.
pause
