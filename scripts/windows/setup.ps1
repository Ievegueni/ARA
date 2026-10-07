# Instalação local no Windows: base de dados (Docker), .env, dependências, tabelas e administrador.
# Normalmente corre-se com "instalar-windows.bat". Pode voltar a correr-se sem perder dados.
param(
  [string]$AdminUser = '',
  [string]$AdminPassword = '',
  [switch]$ManualExemplo,
  [switch]$NaoInterativo
)

. (Join-Path $PSScriptRoot 'common.ps1')

Write-Host ''
Write-Host 'Assistente de Avarias (Unitel) — instalação local' -ForegroundColor White
Write-Host "Pasta: $Root"

Write-Step '1/6  Verificar requisitos'
Assert-Node
Assert-Docker

Write-Step '2/6  Base de dados (PostgreSQL + pgvector no Docker)'
Start-Db

Write-Step '3/6  Configuração (backend\.env)'
$envFile = Join-Path $Backend '.env'
if (Test-Path $envFile) {
  Write-Ok 'backend\.env já existe — mantido (apague-o para o recriar)'
} else {
  $c = Get-Content (Join-Path $Backend '.env.example') -Raw
  $c = Set-EnvLine $c 'DATABASE_URL' ('"postgresql://ara:ara@127.0.0.1:' + $DbPort + '/ara"')
  $c = Set-EnvLine $c 'HOST' '127.0.0.1'
  $c = Set-EnvLine $c 'PORT' '3000'
  $c = Set-EnvLine $c 'CORS_ORIGIN' 'http://localhost:5173'
  $c = Set-EnvLine $c 'JWT_SECRET' (New-Secret)
  $c = Set-EnvLine $c 'AI_ENABLED' 'false'
  Write-TextNoBom $envFile $c
  Write-Ok 'backend\.env criado (IA desligada; a chave do Claude pode ser adicionada depois)'
}

Write-Step '4/6  Instalar dependências (pode demorar alguns minutos na primeira vez)'
Invoke-Npm $Backend @('ci', '--include=dev', '--no-audit', '--no-fund') 'Instalação do backend'
Invoke-Npm $Frontend @('ci', '--include=dev', '--no-audit', '--no-fund') 'Instalação do frontend'
Write-Ok 'Dependências instaladas'

Write-Step '5/6  Criar as tabelas na base de dados'
Invoke-Npm $Backend @('run', 'db:migrate') 'Criação das tabelas'
Write-Ok 'Base de dados atualizada'

Write-Step '6/6  Administrador'
$create = $true
if (-not $AdminPassword -and -not $NaoInterativo) {
  $ans = Read-Host '    Criar (ou atualizar) um utilizador administrador? [S/n]'
  $create = -not ($ans -match '^[nN]')
} elseif (-not $AdminPassword) {
  $create = $false
}
if ($create) {
  if (-not $AdminUser) {
    if ($NaoInterativo) { $AdminUser = 'admin' }
    else { $AdminUser = Read-Host '    Utilizador [admin]'; if (-not $AdminUser) { $AdminUser = 'admin' } }
  }
  $pw = $AdminPassword
  while (-not $pw -or $pw.Length -lt 8) {
    if ($pw) { Write-Warn 'A palavra-passe tem de ter pelo menos 8 caracteres.' }
    $sec = Read-Host '    Palavra-passe (mín. 8 caracteres)' -AsSecureString
    $pw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
  # Passada por variável de ambiente: caracteres como & % " partem os argumentos no Windows
  $env:ARA_PASSWORD = $pw
  Invoke-Npm $Backend @('run', 'user:create', '--', $AdminUser, '-', 'Administrador', '--admin') 'Criação do administrador'
  Remove-Item Env:ARA_PASSWORD -ErrorAction SilentlyContinue
  Write-Ok "Administrador: $AdminUser"
} else {
  Write-Warn 'Administrador não criado (pode correr este script outra vez mais tarde)'
}

$loadExample = [bool]$ManualExemplo
if (-not $ManualExemplo -and -not $NaoInterativo) {
  $ans = Read-Host '    Carregar o manual de exemplo (fictício) para experimentar a pesquisa? [s/N]'
  $loadExample = ($ans -match '^[sS]')
}
if ($loadExample) {
  Invoke-Npm $Backend @('run', 'ingest', '--', 'fixtures/manual-exemplo.pdf', '--title', 'Manual de Exemplo', '--version', '0.1') 'Carregamento do manual de exemplo'
  Write-Ok 'Manual de exemplo carregado'
}

Write-Host ''
Write-Host 'Instalação concluída.' -ForegroundColor Green
Write-Host 'Para abrir a aplicação: faça duplo clique em  iniciar-windows.bat'
