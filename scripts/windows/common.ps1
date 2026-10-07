# Funções partilhadas pelos scripts do Windows (instalar, iniciar, parar).
# Compatível com o Windows PowerShell 5.1 (o que vem com o Windows) e com o PowerShell 7.

$Root     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Backend  = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$DbPort   = if ($env:ARA_DB_PORT) { $env:ARA_DB_PORT } else { '5433' }
# npm.cmd evita o bloqueio do npm.ps1 pela política de execução do PowerShell
$Npm      = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }

function Write-Step([string]$Text) { Write-Host ''; Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text)   { Write-Host "    OK  $Text" -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "    !   $Text" -ForegroundColor Yellow }
function Fail([string]$Text) {
  Write-Host ''
  Write-Host "ERRO: $Text" -ForegroundColor Red
  exit 1
}

function Assert-Node {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js não encontrado. Instale a versão LTS em https://nodejs.org (feche e volte a abrir esta janela depois).'
  }
  $v = ((& node -v) | Out-String).Trim().TrimStart('v')
  $p = $v.Split('.')
  $major = [int]$p[0]; $minor = [int]$p[1]
  if ($major -lt 20 -or ($major -eq 20 -and $minor -lt 19)) {
    Fail "Node.js $v é antigo. É preciso a versão 20.19 ou superior (recomendado: LTS) — https://nodejs.org"
  }
  Write-Ok "Node.js $v"
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker não encontrado. Instale o Docker Desktop (https://www.docker.com/products/docker-desktop/) — é usado para a base de dados PostgreSQL com pgvector.'
  }
  & docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    Fail 'O Docker Desktop não está a correr. Abra o Docker Desktop, espere que diga "Engine running" e volte a correr este script.'
  }
  Write-Ok 'Docker a correr'
}

function Invoke-Compose([string[]]$ComposeArgs) {
  $env:ARA_DB_PORT = $DbPort
  Push-Location $Root
  & docker compose @ComposeArgs
  $code = $LASTEXITCODE
  Pop-Location
  return $code
}

function Start-Db {
  $code = Invoke-Compose @('up', '-d', 'db')
  if ($code -ne 0) {
    Fail "Não foi possível arrancar a base de dados. Se a porta $DbPort estiver ocupada, escolha outra antes de correr o script: set ARA_DB_PORT=5434"
  }
  Write-Host '    A aguardar pela base de dados...'
  for ($i = 0; $i -lt 60; $i++) {
    Push-Location $Root
    & docker compose exec -T db pg_isready -U ara -d ara *> $null
    $ready = ($LASTEXITCODE -eq 0)
    Pop-Location
    if ($ready) { Write-Ok "Base de dados pronta (porta $DbPort)"; return }
    Start-Sleep -Seconds 2
  }
  Fail 'A base de dados não ficou pronta a tempo. Veja o contentor "ara-db" no Docker Desktop.'
}

function Invoke-Npm([string]$Dir, [string[]]$NpmArgs, [string]$What) {
  Push-Location $Dir
  & $Npm @NpmArgs
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail "$What falhou (ver as mensagens acima)." }
}

function New-Secret {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

# Substitui (ou acrescenta) uma linha CHAVE=valor no conteúdo do .env
function Set-EnvLine([string]$Content, [string]$Key, [string]$Value) {
  $pattern = '(?m)^' + [regex]::Escape($Key) + '=.*$'
  $line = "$Key=$Value"
  if ([regex]::IsMatch($Content, $pattern)) {
    return [regex]::Replace($Content, $pattern, $line.Replace('$', '$$'))
  }
  return $Content.TrimEnd() + "`n" + $line + "`n"
}

# O .env tem de ficar em UTF-8 SEM BOM (com BOM o backend não lê a primeira variável)
function Write-TextNoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding $false))
}

function Wait-Http([string]$Url, [int]$Seconds) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -lt 500) { return $true }
    } catch { }
    Start-Sleep -Seconds 1
  }
  return $false
}
