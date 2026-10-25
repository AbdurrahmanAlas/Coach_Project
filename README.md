# Koçluk SaaS

ASP.NET Core 9 ile geliştirilen öğrenci ve ders koçluğu SaaS başlangıç projesi.

## Mimari

- `Kocluk.Domain`: Tenant ve öğrenci iş modelleri.
- `Kocluk.Application`: Uygulama katmanının repository arayüzleri.
- `Kocluk.Infrastructure`: EF Core, PostgreSQL, Identity ve kalıcılık adaptörleri.
- `Kocluk.Api`: Kimlik, tenant ve koçluk API uçları.

Bağımlılıklar iç katmanlara doğrudur. ASP.NET Core Identity ile kayıt/giriş ve PostgreSQL kalıcılığı eklenmiştir. Her tenant API isteğinde kullanıcı üyeliği kontrol edilir.

## Çalıştırma

Geliştirme ortamında Docker veya ayrı bir veritabanı kurulumu gerekmez. API, `appsettings.Development.json` içindeki SQLite dosyasını (`kocluk-dev.db`) otomatik oluşturur:

```powershell
dotnet run --project src/Kocluk.Api
```

Üretim ortamında `ASPNETCORE_ENVIRONMENT` Development dışında olduğunda PostgreSQL provider kullanılır; bağlantı cümlesi `ConnectionStrings:DefaultConnection` üzerinden sağlanmalıdır.

API adresi terminalde gösterilir. Kullanıcı kaydı için:

```http
POST /api/auth/register
Content-Type: application/json

{"email":"koc@example.com","password":"GucluParola123"}
```

`POST /api/auth/login?useCookies=false` ile giriş yapıp dönen bearer token'ı sonraki isteklerde `Authorization: Bearer <token>` başlığına ekleyin. Token uçları ASP.NET Core Identity'nin uygulama token'larını kullanır; bunlar JWT değildir ve dışarı açık genel amaçlı bir kimlik sağlayıcı değildir.

Giriş yaptıktan sonra `POST /api/tenants` gövdesi `{"name":"Örnek Koçluk","slug":"ornek-kocluk"}` ile kurum oluşturun. Kurumu oluşturan kullanıcı Owner olarak eklenir.

Öğrenci ekleme: `POST /api/tenants/{tenantId}/students` gövdesi `{"firstName":"Ada","lastName":"Yılmaz","email":"ada@example.com"}`. Öğrenci, plan ve ilerleme uçları yalnızca ilgili tenant üyesi kullanıcıya açıktır.

Haftalık plan oluşturma uç noktası `POST /api/tenants/{tenantId}/students/{studentId}/plans`:

```json
{
  "title": "1. hafta çalışma planı",
  "weekStart": "2026-10-26",
  "tasks": [
    { "title": "Matematik soru çözümü", "dueDate": "2026-10-27", "targetQuestions": 40 },
    { "title": "Türkçe paragraf", "dueDate": "2026-10-28", "targetQuestions": 30 }
  ]
}
```

Planları listeleme: `GET /api/tenants/{tenantId}/students/{studentId}/plans`.
Görev ilerlemesi: `PUT /api/tenants/{tenantId}/plans/{planId}/tasks/{taskId}/progress` gövdesi `{"completedQuestions":25,"isCompleted":false}`.

Koç müsaitlik saatleri: `GET /api/tenants/{tenantId}/availability`, koç için `POST /api/tenants/{tenantId}/availability` gövdesi `{"dayOfWeek":1,"startTime":"09:00:00","endTime":"17:00:00"}`. Öğrenci talepleri ve koç takvimi bu haftalık saatleri temel alır.

Tenant içi mesajlaşma: `GET /api/tenants/{tenantId}/messages`, mesaj gönderme `POST /api/tenants/{tenantId}/messages` gövdesi `{"recipientUserId":"...","content":"Merhaba"}`, okundu işaretleme `POST /api/tenants/{tenantId}/messages/{messageId}/read`.

Soru bankası: `GET /api/tenants/{tenantId}/question-bank?subject=Matematik&difficulty=Orta`; koç/admin için oluşturma `POST /api/tenants/{tenantId}/question-bank`, güncelleme ve silme aynı kaynağın `PUT`/`DELETE` uçlarıyla yapılır. Öğrenci ve veli yalnızca yayımlanmış soruları, cevap anahtarı olmadan görür.

Öğrenci cevapları `POST /api/tenants/{tenantId}/question-bank/{questionId}/attempt` ile kaydedilir. Koç/admin ve bağlı veli, öğrencinin sonuçlarını `GET /api/tenants/{tenantId}/students/{studentId}/question-attempts` üzerinden izleyebilir.

Performans özeti `GET /api/tenants/{tenantId}/students/{studentId}/question-summary` ile toplam, doğru oranı, ders ve konu kırılımını döndürür. Öğrenci genel bakış cevabında da `questionSummary` alanı bulunur.

Koç/admin toplu raporu `GET /api/tenants/{tenantId}/question-summary` ile tüm öğrencilerin ve derslerin soru performansını döndürür; koç dashboard'unda otomatik gösterilir.

## Geliştirme notu

Development ortamında EF Core ilk şemayı `EnsureCreated` ile oluşturur. Üretimde PostgreSQL migration’ları uygulama başlangıcında çalışır. Docker Compose parolası yalnızca yerel geliştirme içindir; üretimde gizli bilgiler ortam üzerinden sağlanmalıdır. Tenant izolasyonu üyelikle yapılır. Öğrenci/veli daveti, görüşme onayı, bildirim ve rol bazlı yetkiler eklenmiştir.

## Production Docker

`.env.example` dosyasını `.env` olarak kopyalayıp güçlü değerlerle doldurun:

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.production.yml up -d --build
```

Her `main`/`master` push ve pull request için GitHub Actions Release derlemesi, Docker image doğrulaması, EF migration kontrolü ve deploy’a hazır API artifact’i üretir. Gerçek deploy adımı sunucu SSH/container registry secret’ları tanımlandıktan sonra eklenmelidir.

API sağlık kontrolü:

```text
GET http://sunucu-adresi:8080/api/health/ready
```

## Davet bağlantıları

SMTP ayarları tanımlıysa davet e-postesine `APP_PUBLIC_URL/#invite/{token}` bağlantısı eklenir. Davet alan kullanıcı bağlantıyı açıp giriş yaptıktan sonra daveti onaylayarak koçluk alanına katılır.

Production canlılık kontrolü: `GET /api/health/live`. Production ortamında demo yönetici hesabı otomatik oluşturulmaz; güvenli kurulum veya davet akışı kullanılmalıdır.

## Staging

Staging ortamı production verisinden ayrı PostgreSQL volume ve `8081` portu kullanır:

```powershell
$env:STAGING_POSTGRES_PASSWORD = "guclu-bir-staging-parolasi"
docker compose -f docker-compose.staging.yml up -d --build
```

## PostgreSQL yedekleme

`pg_dump` kurulu bir makinede `PGPASSWORD`, `PGHOST`, `PGDATABASE` ve `PGUSER` değişkenlerini tanımlayıp aşağıdaki komutu çalıştırın. Varsayılan olarak 30 günden eski dump dosyaları temizlenir:

```powershell
$env:PGPASSWORD = "postgres-parolası"
.\scripts\backup-postgres.ps1 -OutputDirectory .\backups -RetentionDays 30
```

Linux sunucuda:

```bash
export PGPASSWORD="postgres-parolası"
chmod +x ./scripts/backup-postgres.sh
./scripts/backup-postgres.sh ./backups 30
```

Production ilk admin kurulumu için `.env` içinde `INITIAL_ADMIN_EMAIL` ve `INITIAL_ADMIN_PASSWORD` tanımlanabilir. Uygulama ilk açılışta hesabı oluşturur; kurulumdan sonra bu değişkenleri kaldırın ve parolayı değiştirin.

Yayın öncesi ayrıntılı kontrol listesi için `PRODUCTION_READINESS.md` ve sunucu kurulum adımları için `DEPLOYMENT.md` dosyalarına bakın. Ödeme webhook sözleşmesi `BILLING.md` içinde açıklanmıştır.

Yerel domain davranış kontrolleri `dotnet run --project tests/Kocluk.Domain.Checks/Kocluk.Domain.Checks.csproj` ile çalıştırılır. GitHub Actions ayrıca uygulamadaki inline JavaScript sözdizimini doğrular. Bu kontroller API veritabanı entegrasyon veya gerçek tarayıcı testlerinin yerine geçmez.
