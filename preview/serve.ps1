# Servidor HTTP estático concorrente baseado em runspace pool.
# Funciona em qualquer Windows com PowerShell 5+, sem Node/Python.

param([int]$Port = 5173)

$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) { $root = (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Falha ao bindar em $prefix - $($_.Exception.Message)"
  exit 1
}

# Pool com 8 runspaces para atender requests em paralelo
$pool = [RunspaceFactory]::CreateRunspacePool(1, 8)
$pool.Open()

$worker = {
  param($context, $root)

  $req = $context.Request
  $res = $context.Response

  $mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"  = "font/ttf"
    ".pdf"  = "application/pdf"
    ".txt"  = "text/plain; charset=utf-8"
  }

  try {
    $relPath = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($relPath)) { $relPath = "index.html" }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relPath))
    if (-not $fullPath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      return
    }

    if (Test-Path $fullPath -PathType Container) {
      $fullPath = Join-Path $fullPath "index.html"
    }

    if (Test-Path $fullPath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
      $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($fullPath)

      $res.StatusCode = 200
      $res.ContentType = $contentType
      $res.ContentLength64 = $bytes.Length
      $res.AddHeader("Cache-Control", "no-cache")
      $res.AddHeader("Access-Control-Allow-Origin", "*")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - $relPath nao encontrado")
      $res.StatusCode = 404
      $res.ContentType = "text/plain; charset=utf-8"
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}

Write-Host "SAL Hub preview em $prefix (root: $root)"
Write-Host "Pool: 8 workers concorrentes. Ctrl+C para parar."

$activeJobs = New-Object System.Collections.Generic.List[object]

try {
  while ($listener.IsListening) {
    try {
      $context = $listener.GetContext()
    } catch {
      break
    }

    $ps = [PowerShell]::Create()
    $ps.RunspacePool = $pool
    [void]$ps.AddScript($worker).AddArgument($context).AddArgument($root)
    $handle = $ps.BeginInvoke()
    $activeJobs.Add(@{ PS = $ps; Handle = $handle })

    # Limpa jobs concluídos para não acumular memória
    $done = $activeJobs.FindAll([Predicate[object]]{ param($j) $j.Handle.IsCompleted })
    foreach ($j in $done) {
      try { $j.PS.EndInvoke($j.Handle) } catch {}
      $j.PS.Dispose()
      [void]$activeJobs.Remove($j)
    }
  }
} finally {
  foreach ($j in $activeJobs) {
    try { $j.PS.EndInvoke($j.Handle) } catch {}
    $j.PS.Dispose()
  }
  $pool.Close()
  $pool.Dispose()
  $listener.Stop()
}
