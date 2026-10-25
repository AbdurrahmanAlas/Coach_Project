param([Parameter(Mandatory = $true)][string]$BaseUrl)
$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd('/')
foreach ($path in @('/api/health/live', '/api/health/ready')) {
    $response = Invoke-WebRequest -Uri "$base$path" -UseBasicParsing -TimeoutSec 20
    if ($response.StatusCode -ne 200) { throw "$path 200 dönmedi: $($response.StatusCode)" }
    Write-Host "$path OK" -ForegroundColor Green
}
Write-Host "Deployment health kontrolü başarılı." -ForegroundColor Green
