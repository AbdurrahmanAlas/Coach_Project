# Koçluk SaaS yayın kılavuzu

Bu kılavuz staging ve production kurulumu içindir. Canlıya geçmeden önce `PRODUCTION_READINESS.md` listesini tamamlayın.

## Ortam değişkenleri ve secret'lar

`.env.example` yerel şablondur. Production secret'larını sunucunun secret store'unda saklayın; `.env` dosyasını Git'e göndermeyin. Zorunlu API ayarları:

```text
ASPNETCORE_ENVIRONMENT=Production
DatabaseProvider=Postgres
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=kocluk;Username=...;Password=...
APP_PUBLIC_URL=https://app.example.com
DATA_PROTECTION_KEYS_PATH=/keys
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=<uzun-ve-rastgele>
```

Gerçek ödeme webhook'u açılınca `BILLING_PROVIDER`, `BILLING_WEBHOOK_SECRET` ve sağlayıcı API anahtarları da secret store'a eklenmelidir. SMTP ve hata izleme için `.env.example` içindeki `SMTP_*` ve `SENTRY_DSN` değerleri gerekir.

Production öncesi yapılandırmayı kontrol edin:

```powershell
.\scripts\validate-production.ps1 -EnvFile .env
```

## Domain, HTTPS ve reverse proxy

DNS alan adını sunucunun 443 portuna yönlendirir. Nginx, Caddy veya cloud load balancer TLS sonlandırıp istekleri API container'ının 8080 portuna yollar. Sertifika yenilemesini otomatikleştirin. `/api/health/live` canlılık; `/api/health/ready` veritabanı dahil hazır olma kontrolüdür.

## İlk kurulum ve staging

Production Compose için:

```powershell
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml logs -f api
```

API başlangıçta migration'ları uygular. İlk yönetici hesabı yalnızca secret ile oluşturulur; kurulumdan sonra ilk şifreyi değiştirip seed secret'larını kaldırın.

Staging için `.github/workflows/deploy-staging.yml` `workflow_dispatch` ile çalıştırılır. GitHub `staging` environment altında `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_PRIVATE_KEY` ve `STAGING_APP_DIRECTORY` tanımlanmalıdır. Hedef sunucuda staging branch ve Compose dosyası bulunmalıdır.

## Yedekleme ve geri yükleme provası

Windows görev zamanlayıcıyla `scripts/backup-postgres.ps1`, Linux cron ile `scripts/backup-postgres.sh` günlük çalıştırılır. Backup'ı ayrı disk/nesne depolamaya kopyalayın. Linux cron kurulumu:

```bash
./scripts/install-backup-cron.sh /opt/kocluk
```

Backup bütünlüğünü kontrol edin:

```powershell
.\scripts\verify-backup.ps1 -BackupFile .\backups\kocluk-YYYYMMDD-HHMMSS.dump
```

Periyodik geri yükleme provasını production'dan ayrı, geçici PostgreSQL veritabanına yapın. Backup dosyasını production'a geri yükleyerek prova yapmayın.

## Yayın sonrası kontroller

```powershell
.\scripts\verify-deployment.ps1 -BaseUrl https://app.example.com
```

Ardından giriş/rolleri, tenant izolasyonunu, e-posta davetini, ödeme sağlayıcısının test modundaki webhook'unu, backup geri yüklemesini ve hata izleme alarmını doğrulayın. KVKK ve kullanım metinleri hukuk danışmanı tarafından onaylanmalıdır.
