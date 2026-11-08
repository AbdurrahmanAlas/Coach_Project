# Hiyerarşik Sınav Sistemi Implementation Rehberi

## ✅ Tamamlanan
- [x] Tüm sınav türleri, dersler, konuları (exam-data.js)
- [x] Dropdown hiyerarşik yönetimi (exam-filters.js)
- [x] Soru Bankası sayfasında dropdown UI
- [x] Form submission'a exam_type ve subject_code eklenmesi

## ⏳ Yapılması Gerekenler

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

## 📋 Implementasyon Sırası

1. ✅ exam-data.js ve exam-filters.js ekle (DONE)
2. ⏳ Database: exam_type, subject_code, topic alanları ekle
3. ⏳ API: Question model güncelle
4. ⏳ API: POST ve GET endpoints'i güncelle (filtering ile)
5. ⏳ Frontend: Soru formu dropdown'larını aktifleştir
6. ⏳ Frontend: Filtreleme JavaScript'ini API çağrısı ile bağla
7. ⏳ Frontend: Öğrenciye atama formunu hiyerarşik hale getir
8. ✅ Test et (tüm role'ler: Coach, Student, Parent, Admin)

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
