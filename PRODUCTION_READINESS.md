# Üretime Çıkış Durumu

Durum: 27.10.2026 itibarıyla uygulama kaynakları GitHub'daki private `AbdurrahmanAlas/Coach_Project` deposunun `main` dalına gönderildi. CI ve staging workflow dosyaları depoda; Actions çalışmasının başarılı olduğu ayrıca doğrulanmalıdır.

## Tamamlananlar

- ASP.NET Core 9 Onion Architecture
- SQLite geliştirme ve PostgreSQL üretim desteği
- Docker Compose ile PostgreSQL
- EF Core migration zinciri
- Identity giriş, kayıt, şifre ve profil yönetimi
- Student, Parent, Coach ve Admin rolleri
- Tenant üyelik izolasyonu
- Öğrenci ve veli profilleri
- Davet oluşturma, kabul ve iptal akışı
- SMTP yapılandırıldığında tıklanabilir davet bağlantısı gönderimi
- Çalışma planları ve görev ilerlemesi
- Ders/konu ilerlemesi
- Deneme sonuçları ve CSV raporları
- Koçluk görüşmeleri, öğrenci talebi, onay, iptal ve çakışma kontrolü
- Bildirim merkezi
- Audit log
- Rate limiting
- Admin kullanıcı ve rol yönetimi
- Health ve readiness endpoint’leri
- Canlılık (`/api/health/live`), standart problem detayları ve korelasyon ID’li istek logları
- Tarayıcı güvenlik başlıkları ve production HSTS
- Production Compose PostgreSQL healthcheck ve API’nin sağlıklı veritabanı bekleme koşulu
- Identity/Data Protection anahtarlarının production ve staging volume’da kalıcı tutulması
- Production başlangıç yapılandırma doğrulaması (PostgreSQL, parola ve HTTPS public URL)
- PostgreSQL transient bağlantı retry ve komut timeout ayarları
- Koç haftalık müsaitlik saatleri ve öğrenci takvim talep altyapısı
- Öğrenci görüşme taleplerinde koç müsaitlik ve saat dilimi kontrolü
- Abonelik süresi ve paket değiştirme yetkisi kontrolleri
- Abonelik iptal endpoint’i ve audit kaydı
- Responsive rol bazlı arayüz
- KVKK onay kaydı, kullanıcı veri dışa aktarma ve yönetici kontrollü silme talebi akışı
- Staging için ayrı Docker Compose ve PostgreSQL volume yapılandırması
- GitHub Actions Release build, Docker image ve EF migration kontrolü
- PostgreSQL dump backup scripti ve retention temizliği
- Sağlayıcıdan bağımsız, HMAC imzalı ve idempotent abonelik webhook altyapısı
- Tenant içi koç-öğrenci-veli mesajlaşma ve okundu takibi API'si
- Ders, konu, zorluk ve sınav türü filtreli tenant soru bankası
- Kayıt ekranında gizlilik ve kullanım taslaklarına bağlantı, onay kaydı ve domain davranış kontrolleri
- CI içinde 8 domain davranış kontrolü ve tarayıcı JavaScript sözdizimi doğrulaması

## Yayın öncesi kalan ticari/operasyonel işler

1. Gerçek SMTP/e-posta sağlayıcısı bağlanmalı. Production API artık SMTP bilgileri yoksa başlamaz.
2. Gerçek Stripe/iyzico adaptörü, checkout ve fatura ekranları eklenmeli; ortak imzalı webhook altyapısı hazırdır.
3. KVKK, gizlilik, açık rıza ve veri saklama metinleri hukuk danışmanı ile sonlandırılmalı; uygulamadaki onay akışı hazırdır.
4. Production secret yönetimi ve HTTPS/domain yapılandırılmalı.
5. PostgreSQL yedekleme, merkezi loglama ve hata izleme kurulmalı.
6. GitHub Actions içindeki ilk CI çalışmasının başarılı olduğu doğrulanmalı. Staging deploy workflow'u için GitHub `staging` environment secret'ları ve gerçek staging sunucusu henüz tanımlanmadı; production deploy hedefi de kurulmalı.
7. Rol bazlı entegrasyon ve tarayıcı kabul testleri yazılmalı. CI içindeki 8 domain davranış kontrolü ve JavaScript sözdizimi kontrolü uçtan uca testlerin yerine geçmez. Özellikle tenant izolasyonu, veli-öğrenci erişimi, davet, randevu onayı ve giriş/çıkış akışları kapsanmalı.
8. Gerçek SMTP sağlayıcısı, ödeme adaptörü, hosting ve izleme servisi için hesap/anahtarlar bağlanmalı; test modundaki uçtan uca akışlar doğrulanmalı.
9. Uygulamadaki KVKK ve kullanım metinleri taslaktır. Hukuk danışmanı incelemesi ve reşit olmayan öğrenciler için veli onayı akışının hukuki/ürün gereksinimlerine göre netleştirilmesi gerekir.
10. Backup zamanlayıcısı gerçek sunucuda kurulmalı ve ayrı bir geçici veritabanına geri yükleme provası tamamlanmalı.

Üretim container’ı PostgreSQL migration’larını başlangıçta uygular ve gerekli Identity rollerini otomatik oluşturur. Yönetici hesabı production’da otomatik seed edilmez; güvenli davet/kurulum akışı kullanılmalıdır.

## Kontrol uçları

```text
GET /api/health
GET /api/health/ready
GET /api/health/live
```

Üretimde `DatabaseProvider=Postgres`, `ConnectionStrings__DefaultConnection` ve secret değerleri ortam değişkenlerinden verilmelidir. Docker Compose parolası yalnızca yerel geliştirme içindir.
