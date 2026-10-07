# Para a aplicação no Windows: backend, frontend e base de dados (os dados ficam guardados).
. (Join-Path $PSScriptRoot 'common.ps1')

Write-Step 'Parar backend e frontend'
foreach ($port in 3000, 5173) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
    foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Ok "Porta $port libertada"
  } catch {
    Write-Ok "Nada a correr na porta $port"
  }
}

Write-Step 'Parar a base de dados'
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $code = Invoke-Compose @('stop', 'db')
  if ($code -eq 0) { Write-Ok 'Base de dados parada (os dados ficam guardados)' } else { Write-Warn 'Não foi possível parar a base de dados (o Docker Desktop está aberto?)' }
}
Write-Host ''
Write-Host 'Aplicação parada.' -ForegroundColor Green
