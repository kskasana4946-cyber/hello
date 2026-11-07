@echo off
setlocal
title Apex Grand Prix: Uncapped Next-Gen Edition
echo =====================================================================
echo   APEX GRAND PRIX: UNCAPPED NEXT-GEN EDITION - OFFLINE LAUNCHER
echo =====================================================================
echo.
echo Starting local offline server...
echo Your default web browser will open automatically at http://localhost:8080
echo.
echo Keep this terminal window open while playing. Press Ctrl+C to stop.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = 8080; ^
   $url = 'http://localhost:' + $port + '/'; ^
   $listener = New-Object System.Net.HttpListener; ^
   $listener.Prefixes.Add($url); ^
   try { $listener.Start() } catch { $port = 8088; $url = 'http://localhost:' + $port + '/'; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add($url); $listener.Start(); } ^
   Start-Process $url; ^
   Write-Host ('Game launched! Running at ' + $url); ^
   while ($listener.IsListening) { ^
     try { ^
       $ctx = $listener.GetContext(); ^
       $reqPath = $ctx.Request.Url.LocalPath.TrimStart('/'); ^
       if ([string]::IsNullOrEmpty($reqPath)) { $reqPath = 'index.html'; } ^
       $file = Join-Path (Get-Location) $reqPath; ^
       if (Test-Path $file -PathType Leaf) { ^
         $bytes = [System.IO.File]::ReadAllBytes($file); ^
         $ext = [System.IO.Path]::GetExtension($file).ToLower(); ^
         $mime = switch ($ext) { ^
           '.html' { 'text/html; charset=utf-8' } ^
           '.js'   { 'application/javascript; charset=utf-8' } ^
           '.mjs'  { 'application/javascript; charset=utf-8' } ^
           '.css'  { 'text/css; charset=utf-8' } ^
           '.json' { 'application/json' } ^
           '.webmanifest' { 'application/manifest+json' } ^
           '.png'  { 'image/png' } ^
           '.ico'  { 'image/x-icon' } ^
           '.wasm' { 'application/wasm' } ^
           '.pak'  { 'application/octet-stream' } ^
           default { 'application/octet-stream' } ^
         }; ^
         $ctx.Response.ContentType = $mime; ^
         $ctx.Response.Headers.Add('Accept-Ranges', 'bytes'); ^
         $range = $ctx.Request.Headers['Range']; ^
         if ($range -and $range.StartsWith('bytes=')) { ^
           $parts = $range.Substring(6).Split('-'); ^
           $start = [int64]::Parse($parts[0]); ^
           $end = if ($parts.Length -gt 1 -and -not [string]::IsNullOrEmpty($parts[1])) { [int64]::Parse($parts[1]) } else { $bytes.Length - 1 }; ^
           if ($end -ge $bytes.Length) { $end = $bytes.Length - 1 }; ^
           $len = $end - $start + 1; ^
           $ctx.Response.StatusCode = 206; ^
           $ctx.Response.Headers.Add('Content-Range', ('bytes ' + $start + '-' + $end + '/' + $bytes.Length)); ^
           $ctx.Response.ContentLength64 = $len; ^
           $ctx.Response.OutputStream.Write($bytes, $start, $len); ^
         } else { ^
           $ctx.Response.StatusCode = 200; ^
           $ctx.Response.ContentLength64 = $bytes.Length; ^
           $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length); ^
         } ^
       } else { ^
         $ctx.Response.StatusCode = 404; ^
       } ^
       $ctx.Response.Close(); ^
     } catch {} ^
   }"
pause
