param([string]$OutputDirectory = ".\backups", [int]$RetentionDays = 30)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $OutputDirectory "kocluk-$stamp.dump"
if (-not $env:PGHOST) { $env:PGHOST = "localhost" }
if (-not $env:PGPORT) { $env:PGPORT = "5432" }
if (-not $env:PGDATABASE) { $env:PGDATABASE = "kocluk" }
if (-not $env:PGUSER) { $env:PGUSER = "kocluk" }
if (-not $env:PGPASSWORD) { throw "PGPASSWORD ortam değişkeni tanımlı değil." }
pg_dump --format=custom --file=$file
if (-not (Test-Path $file) -or (Get-Item $file).Length -eq 0) { throw "Backup dosyası oluşturulamadı veya boş." }
Get-ChildItem $OutputDirectory -Filter "kocluk-*.dump" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force
Write-Host "Backup oluşturuldu: $file"
