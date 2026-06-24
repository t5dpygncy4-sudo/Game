@echo off
chcp 65001 >nul
title 中国象棋 · 楚河汉界
cd /d "%~dp0"

echo ╔══════════════════════════════════════════╗
echo ║                                          ║
echo ║          中  国  象  棋                  ║
echo ║          楚 河 漢 界                     ║
echo ║                                          ║
echo ╚══════════════════════════════════════════╝
echo.
echo  正在启动游戏...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "$port=5173;" ^
 "$root=Join-Path $PSScriptRoot 'web';" ^
 "Add-Type -AssemblyName System.Web;" ^
 "$listener=New-Object System.Net.HttpListener;" ^
 "$listener.Prefixes.Add('http://localhost:'+${port}+'/');" ^
 "try{$listener.Start()}catch{Write-Host '端口被占用，尝试其他端口...' -ForegroundColor Yellow; $port=5180; $listener=New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:'+${port}+'/'); $listener.Start()};" ^
 "Write-Host ('游戏已启动！浏览器地址: http://localhost:'+$port) -ForegroundColor Green;" ^
 "Write-Host '正在打开浏览器...' -ForegroundColor Cyan;" ^
 "Start-Process ('http://localhost:'+$port);" ^
 "Write-Host '';" ^
 "Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor DarkGray;" ^
 "Write-Host '  游戏运行中，请勿关闭此窗口！' -ForegroundColor Yellow;" ^
 "Write-Host '  关闭窗口即可退出游戏。' -ForegroundColor DarkGray;" ^
 "Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor DarkGray;" ^
 "while($listener.IsListening){" ^
   "try{$ctx=$listener.GetContext()}catch{break};" ^
   "$req=$ctx.Request;" ^
   "$res=$ctx.Response;" ^
   "$raw=$req.Url.AbsolutePath;" ^
   "if($raw -eq '/'){$raw='/index.html'};" ^
   "$raw=[System.Web.HttpUtility]::UrlDecode($raw);" ^
   "$path=Join-Path $root $raw.Substring(1);" ^
   "if((Test-Path $path -PathType Leaf)){$bytes=[System.IO.File]::ReadAllBytes($path);$ext=[System.IO.Path]::GetExtension($path).ToLower();$mime=@{'.html'='text/html; charset=utf-8';'.css'='text/css; charset=utf-8';'.js'='application/javascript; charset=utf-8';'.svg'='image/svg+xml';'.ico'='image/x-icon';'.png'='image/png';'.jpg'='image/jpeg';'.woff'='font/woff';'.woff2'='font/woff2';'.json'='application/json; charset=utf-8'};$ct=$mime[$ext];if(-not $ct){$ct='application/octet-stream'};$res.ContentType=$ct;$res.ContentLength64=$bytes.Length;$res.OutputStream.Write($bytes,0,$bytes.Length)}else{$res.StatusCode=404;$msg=[System.Text.Encoding]::UTF8.GetBytes('404 Not Found');$res.ContentLength64=$msg.Length;$res.OutputStream.Write($msg,0,$msg.Length)};" ^
   "$res.Close()" ^
 "}"

echo.
echo 游戏已退出。按任意键关闭窗口...
pause >nul
