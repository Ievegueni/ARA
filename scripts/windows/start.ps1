# Arranca a aplicação no Windows: base de dados (Docker), backend e frontend; abre o navegador.
. (Join-Path $PSScriptRoot 'common.ps1')

Write-Host ''
Write-Host 'Assistente de Avarias (Unitel) — a iniciar' -ForegroundColor White

if (-not (Test-Path (Join-Path $Backend '.env')) -or -not (Test-Path (Join-Path $Backend 'node_modules')) -or -not (Test-Path (Join-Path $Frontend 'node_modules'))) {
  Fail 'A instalação ainda não foi feita. Corra primeiro  instalar-windows.bat'
}

Write-Step 'Verificar requisitos'
Assert-Node
Assert-Docker

Write-Step 'Base de dados'
Start-Db

Write-Step 'Backend e frontend'
$opened = $false
if (Wait-Http 'http://127.0.0.1:3000/api/health' 1) {
  Write-Warn 'O backend já está a correr (porta 3000) — não foi aberta outra janela'
} else {
  $opened = $true
  Start-Process powershell -WorkingDirectory $Backend -ArgumentList @(
    '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
    "`$Host.UI.RawUI.WindowTitle = 'ARA - backend (API) - nao fechar'; & $Npm run dev")
}
if (Wait-Http 'http://127.0.0.1:5173' 1) {
  Write-Warn 'O frontend já está a correr (porta 5173) — não foi aberta outra janela'
} else {
  $opened = $true
  Start-Process powershell -WorkingDirectory $Frontend -ArgumentList @(
    '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
    "`$Host.UI.RawUI.WindowTitle = 'ARA - frontend - nao fechar'; & $Npm run dev -- --host 127.0.0.1")
}

if ($opened) { Write-Host '    A aguardar que arranquem (abriram janelas novas: não as feche enquanto usa a aplicação)...' }
if (-not (Wait-Http 'http://127.0.0.1:3000/api/health' 90)) { Fail 'O backend não arrancou. Veja a janela "ARA - backend" para o erro.' }
Write-Ok 'Backend: http://127.0.0.1:3000'
if (-not (Wait-Http 'http://127.0.0.1:5173' 60)) { Fail 'O frontend não arrancou. Veja a janela "ARA - frontend" para o erro.' }
Write-Ok 'Frontend: http://localhost:5173'

Write-Host ''
try {
  Start-Process 'http://localhost:5173'
  Write-Host 'Aplicação aberta no navegador: http://localhost:5173' -ForegroundColor Green
} catch {
  Write-Host 'Abra no navegador: http://localhost:5173' -ForegroundColor Green
}
Write-Host 'Para parar: parar-windows.bat (ou feche as janelas "ARA - backend" e "ARA - frontend").'
