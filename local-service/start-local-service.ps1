$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Se creó .env. Edita BOT_PC_TOKEN y BOT_PC_ALLOWED_ROOTS antes de iniciar." -ForegroundColor Yellow
  exit 1
}
if (-not (Test-Path "node_modules")) { npm install }
npm start
