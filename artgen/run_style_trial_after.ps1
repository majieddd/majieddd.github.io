# Waits for the running pcut_ planet-cutscene render to finish, then runs the
# 15-plate style trial. Owner chose this sequencing (this session): do not
# disturb the planet render, queue the trial behind it.
#
# WHY A DETACHED SCRIPT AND NOT A BACKGROUND SHELL. A backgrounded shell in the
# agent session dies when the session is interrupted -- that already happened
# once here and cost twenty minutes of apparent progress that was actually a
# dead process. Start-Process detaches this from the session entirely, so the
# trial still runs if the conversation is interrupted or closed.
#
# WHY THE BASE INTERPRETER AND NOT THE VENV. artgen-env\Scripts\python.exe is a
# uv trampoline that fails to spawn ("entity not found (os error 3)") from both
# Git Bash and PowerShell on this machine, even though the base install it
# points at resolves fine. Calling the base interpreter with PYTHONPATH set to
# the venv's site-packages loads the identical torch 2.11.0+cu128 / diffusers
# 0.40.0 stack -- verified: cuda True, RTX 5090 Laptop GPU detected.

$ErrorActionPreference = 'Continue'
$repo = 'D:\ClaudeProjects\RemoteWorkspace\TowerDefense'
$base = 'C:\Users\Majied\AppData\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\python.exe'
$site = 'D:\ClaudeProjects\RemoteWorkspace\artgen-env\Lib\site-packages'
$log  = Join-Path $repo 'artgen\style_trial\run.log'
$watchPid = 31060

New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
"[$(Get-Date -Format 'HH:mm:ss')] waiting for pcut_ render (PID $watchPid) to finish" | Out-File -FilePath $log -Encoding utf8

# Poll rather than Wait-Process: Wait-Process throws if the pid is already gone,
# and "already gone" is a perfectly good reason to start immediately.
while (Get-Process -Id $watchPid -ErrorAction SilentlyContinue) {
    Start-Sleep -Seconds 60
}

"[$(Get-Date -Format 'HH:mm:ss')] pcut_ render finished; starting style trial" | Out-File -FilePath $log -Append -Encoding utf8

# Give the driver a moment to release VRAM before loading a second 4-bit model.
Start-Sleep -Seconds 20

$env:PYTHONPATH = $site
Set-Location $repo
& $base -u 'artgen\style_trial.py' *>> $log

"[$(Get-Date -Format 'HH:mm:ss')] style trial exited with code $LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8
