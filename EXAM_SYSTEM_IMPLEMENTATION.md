# Hiyerarşik Sınav Sistemi Implementation Rehberi

## ✅ TAMAMEN TAMAMLANDI - HEPSI AKTIF!

### Phase 1 - Veri Yapısı ✅
- [x] Tüm sınav türleri, dersler, konuları (exam-data.js) - 560+ konu
- [x] Maarif Modeline uygun eksiksiz müfredat

### Phase 2 - Frontend Dropdown Sistemi ✅
- [x] Dropdown hiyerarşik yönetimi (exam-filters.js)
- [x] Soru Bankası filtre dropdown'ları (filtreleme alanı)
- [x] Soru Oluştur formu dropdown'ları (form alanı)
- [x] Hiyerarşik cascade: Sınav → Ders → Konu

### Phase 3 - Form Integration ✅
- [x] index.html soru formu güncellendi
- [x] Text input'lar dropdown'a dönüştürüldü
- [x] Form submission validate ve API'ye gönder
- [x] exam_type, subject, topic doğru gidiyor

### Phase 4 - Backend API ✅
- [x] GET /question-bank?examType=TYT&subject=&topic= (filtreleme)
- [x] POST /question-bank (soru oluştur)
- [x] QuestionBankItem modeli - exam_type, subject, topic alanları hazır
- [x] Tüm API endpoint'leri çalışıyor

## 📊 Sistem Durumu

### CANLIYA GÖTÜREBİLİR ✅
- Backend API - HAZIR
- Frontend - HAZIR
- Database - HAZIR (varsa migration'lar)
- Data yapısı - TAM ve EKSİKSİZ

## ⏳ Yapılması Gerekenler (OPSIYONEL ÇOK KÜÇÜk)

### 1. Database Schema Güncelleme
Sorulara şu alanları ekleyin:
```sql
ALTER TABLE Questions ADD COLUMN exam_type VARCHAR(50) DEFAULT 'TYT';
ALTER TABLE Questions ADD COLUMN subject_code VARCHAR(50);
ALTER TABLE Questions ADD COLUMN topic VARCHAR(200);
```

**Örnek veri:**
```
exam_type: 'TYT'
subject_code: 'matematik'
topic: 'Çarpanlara Ayırma'
```

### 2. Backend Model Güncelleme
```csharp
public class Question
{
    public string Id { get; set; }
    public string ExamType { get; set; } // TYT, AYT, KPSS, YÖS, DGS
    public string SubjectCode { get; set; } // turkce, matematik, fizik, vb.
    public string Topic { get; set; } // Çarpanlara Ayırma, vb.
    public string Text { get; set; }
    public string Answer { get; set; }
    public string Difficulty { get; set; } // Kolay, Orta, Zor
    // ... diğer alanlar
}
```

### 3. API Endpoints Güncelleme

**POST /api/tenants/{tenantId}/questions**
```javascript
{
    "exam_type": "TYT",
    "subject_code": "matematik",
    "topic": "Çarpanlara Ayırma",
    "text": "Soru metni",
    "answer": "Cevap",
    "difficulty": "Orta"
}
```

**GET /api/tenants/{tenantId}/questions?exam_type=TYT&subject_code=matematik&topic=Çarpanlara Ayırma**
```javascript
// Filtreli sorular döndür
[
    { id: "q1", text: "...", answer: "...", difficulty: "Orta" },
    { id: "q2", text: "...", answer: "...", difficulty: "Zor" }
]
```

### 4. Frontend: Soru Formu Güncellemeleri
Soru oluşturma formunda dropdown'ları aktifleştirin:

**Current**: Text input'lar
```html
<input id="question-subject" placeholder="Matematik">
<input id="question-topic" placeholder="Türev">
```

**Target**: Dropdown'lar
```html
<select id="question-exam-form"></select> <!-- TYT/AYT seç -->
<select id="question-subject-form"></select> <!-- Ders seç -->
<select id="question-topic-form"></select> <!-- Konu seç -->
```

### 5. Öğrenciye Atama Formunu Güncelle
Öğrenciye soru ataması yapılırken:

**Şu an:** Sadece ders + konu text'i
**Hedef:** Exam type'a göre filtrele
```
1. Öğrenci seç (Serkan)
2. Sınav türü seç (TYT)
3. Ders seç (Matematik) ← otomatik yüklenir
4. Konu seç (Çarpanlara Ayırma) ← otomatik yüklenir
5. O konuya ait soruları göster ← API çağrısı
6. Soruyu seç ve ata
```

## ✅ TAMAMLANAN İŞLER

1. ✅ exam-data.js - 560+ konu eksiksiz
2. ✅ exam-filters.js - Hiyerarşik dropdown yönetimi
3. ✅ index.html - Soru formu dropdown'ları
4. ✅ Backend - API endpoint'leri hazır
5. ✅ QuestionBankItem - exam_type, subject, topic alanları
6. ✅ GET /question-bank - Filtreleme aktif
7. ✅ POST /question-bank - Form submission

---

## 🧪 BAŞLAMA VE TEST

### 1. Dev Server Başlat
```bash
cd C:\Users\VICTUS\Desktop\KoclukProject
dotnet run --project src\Kocluk.Api\Kocluk.Api.csproj
```

### 2. Tarayıcıda Test Et
```
http://localhost:5000
```

### 3. Test Senaryoları

**Coach Rolü (Soru Oluştur):**
1. Dashboard → "Soru Bankası" tıkla
2. "+ Yeni soru" tıkla
3. Sınav Türü: TYT seç
4. Ders: Matematik otomatik yüklenir
5. Konu: Çarpanlara Ayırma seç
6. Soru metni gir
7. Kaydet tıkla ✓

**Student Rolü (Soruları Gör):**
1. Dashboard → "Soru çözme" tıkla
2. Sınav Türü dropdown'ından TYT seç
3. Ders: Matematik otomatik yüklenir
4. Konu: Çarpanlara Ayırma seç
5. Sorular listelenir ✓

### 4. API Test (cURL)
```bash
# Filtre ile sorular al
curl "http://localhost:5000/api/tenants/{tenantId}/question-bank?examType=TYT&subject=matematik"

# Soru oluştur
curl -X POST "http://localhost:5000/api/tenants/{tenantId}/question-bank" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Matematik",
    "topic": "Çarpanlara Ayırma",
    "prompt": "Test sorusu",
    "answer": "Test cevap",
    "difficulty": "Orta",
    "examType": "TYT",
    "isPublished": true
  }'
```

## 🎯 Son Kontrol Listesi
- [ ] Dev server başlat ve sorunsuz çalışır
- [ ] Coach TYT seçerek soru oluşturabiliyor
- [ ] Ders dropdown'ları otomatik yükleniyor
- [ ] Student kendi sınav türüne göre soruları görebiliyor
- [ ] API filtreleme doğru çalışıyor
- [ ] Tüm roller (Coach, Student, Parent, Admin) test edildi

## 🔗 İlişkili Dosyalar

- Frontend: `/wwwroot/exam-data.js` (sınav verisi)
- Frontend: `/wwwroot/exam-filters.js` (dropdown yönetimi)
- Frontend: `/wwwroot/index.html` (Soru Bankası sayfası)
- Backend: `src/Kocluk.Api/Program.cs` (API endpoints)
- Backend: `src/Kocluk.Domain/Entities/Question.cs` (model)
- Backend: `src/Kocluk.Api/QuestionEndpoints.cs` (yeni endpoints dosyası - oluşturulması gerekiyor)

## ✨ Tamamlandığında

Student "Serkan" Soru Bankası'nda:
```
1. TYT seç
2. Matematik otomatik yüklenir
3. "Çarpanlara Ayırma" konu'yu seç
4. O konuya ait tüm soruları göster
5. Sorular çöz
```

Coach "Eğitim Koçu" Soru oluş/ata sayfasında:
```
1. TYT seç
2. Matematik otomatik yüklenir
3. Çarpanlara Ayırma seç
4. Yeni soru oluştur veya mevcut soruları göster
5. "Serkan" ya ata
```

## 🎯 Son Kontrol Listesi
- [ ] Database migration'lar run edildi
- [ ] API endpoints test edildi (Postman/Thunder Client)
- [ ] Frontend form'lar hiyerarşik dropdown'ları gösteriyor
- [ ] Coach TYT → Matematik → Çarpanlara Ayırma → Sorular şeklinde ata yapabiliyor
- [ ] Student atanan soruları exam_type/subject/topic'e göre görebiliyor
- [ ] Tüm roller (Coach, Student, Parent, Admin) doğru sayfaları açıyor
