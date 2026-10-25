param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$PgRestore = "pg_restore"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $BackupFile)) { throw "Backup dosyası bulunamadı: $BackupFile" }
if ((Get-Item -LiteralPath $BackupFile).Length -le 0) { throw "Backup dosyası boş." }
$listing = & $PgRestore --list $BackupFile 2>&1
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($listing -join "`n"))) { throw "pg_restore backup listesini okuyamadı." }
Write-Host "Backup doğrulandı: $BackupFile" -ForegroundColor Green
Write-Host "Geri yükleme provası için ayrı bir PostgreSQL veritabanında pg_restore --clean --if-exists kullanılmalıdır." -ForegroundColor Yellow
