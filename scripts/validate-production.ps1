param(
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Env dosyası bulunamadı: $EnvFile" }
$required = @("ASPNETCORE_ENVIRONMENT", "DatabaseProvider", "ConnectionStrings__DefaultConnection", "APP_PUBLIC_URL", "INITIAL_ADMIN_EMAIL", "INITIAL_ADMIN_PASSWORD", "SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM")
$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { $values[$matches[1].Trim()] = $matches[2].Trim().Trim('"') } }
$missing = $required | Where-Object { [string]::IsNullOrWhiteSpace($values[$_]) }
if ($missing) { throw "Eksik production değişkenleri: $($missing -join ', ')" }
if ($values["ASPNETCORE_ENVIRONMENT"] -ne "Production") { throw "ASPNETCORE_ENVIRONMENT Production olmalı." }
if ($values["DatabaseProvider"] -ne "Postgres") { throw "DatabaseProvider Postgres olmalı." }
if ($values["ConnectionStrings__DefaultConnection"] -match "change-this|Password=;") { throw "PostgreSQL parolası örnek/değiştirilmemiş görünüyor." }
if ($values["APP_PUBLIC_URL"] -notmatch '^https://') { throw "APP_PUBLIC_URL HTTPS olmalı." }
if ($values["SMTP_HOST"] -match 'example\.com' -or $values["SMTP_FROM"] -match 'example\.com') { throw "Örnek SMTP adresleri gerçek sağlayıcı bilgileriyle değiştirilmelidir." }
if ($values["INITIAL_ADMIN_PASSWORD"].Length -lt 12) { throw "İlk admin parolası en az 12 karakter olmalı." }
Write-Host "Production yapılandırması temel kontrollerden geçti." -ForegroundColor Green
