// Sınav Türleri, Dersler ve Konuları - Maarif Modeline Uygun
const examData = {
  TYT: {
    name: "TYT (Temel Yeterlilik Testi)",
    subjects: {
      turkce: {
        name: "Türkçe",
        topics: [
          "Sözcük Anlamı ve Kullanımı",
          "Cümle Anlamı",
          "Paragrafta Anlam",
          "Yazım Kuralları",
          "Noktalama İşaretleri",
          "Sözcük Türleri",
          "Cümle Öğeleri"
        ]
      },
      sosyal: {
        name: "Sosyal Bilgiler",
        topics: [
          "Tarih - Eski Çağlar",
          "Tarih - Ortaçağ",
          "Tarih - Modern Çağ",
          "Tarih - Türk Tarihi",
          "Coğrafya - Fiziki",
          "Coğrafya - Beşeri",
          "Din Kültürü ve Ahlak",
          "Felsefe"
        ]
      },
      matematik: {
        name: "Matematik",
        topics: [
          "Sayılar ve Sayı Sistemleri",
          "Kümeler",
          "Fonksiyonlar",
          "Polinom ve Rasyonal Fonksiyonlar",
          "Üstel ve Logaritmik Fonksiyonlar",
          "Trigonometri",
          "Denklemler ve Eşitsizlikler",
          "Analitik Geometri",
          "İstatistik ve Olasılık"
        ]
      },
      fen: {
        name: "Fen Bilgisi",
        topics: [
          "Fizik - Mekanik",
          "Fizik - Elektrik ve Manyetizma",
          "Fizik - Enerji",
          "Kimya - Atom Yapısı",
          "Kimya - Kimyasal Bağlar",
          "Kimya - Reaksiyonlar",
          "Biyoloji - Hücre ve Genetik",
          "Biyoloji - Canlılar Dünyası",
          "Biyoloji - İnsan ve Sağlık"
        ]
      }
    }
  },
  AYT: {
    name: "AYT (Alan Yeterlilik Testi)",
    subjects: {
      turkce: {
        name: "Türkçe",
        topics: [
          "Edebiyat Tarihi",
          "Şiir Bilgisi ve Sanat",
          "Yazılı Anlatım",
          "Okuduğunu Anlama",
          "Hikaye ve Roman",
          "Drama ve Tiyatro"
        ]
      },
      ingilizce: {
        name: "İngilizce",
        topics: [
          "Kelime Bilgisi",
          "Dilbilgisi - Zamanlar",
          "Dilbilgisi - Modaller",
          "Okuduğunu Anlama",
          "Konuşma ve İletişim",
          "Yazı Türleri"
        ]
      },
      matematik: {
        name: "Matematik",
        topics: [
          "Limit ve Süreklilik",
          "Türev",
          "Türevin Uygulamaları",
          "İntegral",
          "İntegralin Uygulamaları",
          "Diziler ve Seriler"
        ]
      },
      fizik: {
        name: "Fizik",
        topics: [
          "Dalgalar",
          "Optik",
          "Termodinamik",
          "Kuantum Fiziği",
          "Nükleer Fizik",
          "Evren ve Gezegen"
        ]
      },
      kimya: {
        name: "Kimya",
        topics: [
          "Gazlar",
          "Çözeltiler",
          "Asit-Baz Titrasyon",
          "Elektrokimya",
          "Organik Kimya Temelleri",
          "Polimer Kimyası"
        ]
      },
      biyoloji: {
        name: "Biyoloji",
        topics: [
          "Hücre Bölünmesi",
          "Genetik",
          "Evrim",
          "Ekoloji",
          "Fizyoloji",
          "Mikrobiyoloji"
        ]
      },
      tarih: {
        name: "Tarih",
        topics: [
          "Osmanlı Devleti",
          "Tanzimat Dönemi",
          "Son Osmanlı Dönemi",
          "Atatürk İlkeleri",
          "Cumhuriyet Dönemi"
        ]
      },
      cografya: {
        name: "Coğrafya",
        topics: [
          "Jeomorfoloji",
          "İklim Coğrafyası",
          "Bitki Coğrafyası",
          "Nüfus Coğrafyası",
          "Yerleşim Coğrafyası",
          "Ekonomik Coğrafya"
        ]
      }
    }
  },
  KPSS: {
    name: "KPSS (Kamu Personeli Seçme Sınavı)",
    subjects: {
      turkce: {
        name: "Türkçe",
        topics: [
          "Sözcük Anlamı",
          "Cümle Anlamı",
          "Paragrafta Anlam",
          "Yazım ve Noktalama",
          "Sözcük Türleri"
        ]
      },
      matematik: {
        name: "Matematik",
        topics: [
          "Sayılar",
          "Oran ve Orantı",
          "Yüzde ve Kar-Zarar",
          "Denklemler",
          "İstatistik ve Olasılık"
        ]
      },
      mantik: {
        name: "Mantık",
        topics: [
          "Önerme ve Bağlacı",
          "Mantık Kuralları",
          "Söz Dizimi"
        ]
      },
      agirlik: {
        name: "Ağırlık Alanı Testi (GKMY)",
        topics: [
          "İnsan Kaynakları",
          "Muhasebe",
          "Yönetim",
          "Mali Müşavirlik"
        ]
      }
    }
  },
  YÖS: {
    name: "YÖS (Yabancı Uyruklu Öğrenci Sınavı)",
    subjects: {
      turkce: {
        name: "Türkçe",
        topics: [
          "Temel Kelime Bilgisi",
          "Dilbilgisi Temelleri",
          "Okuduğunu Anlama",
          "Yazılı İfade"
        ]
      },
      matematik: {
        name: "Matematik",
        topics: [
          "Sayılar",
          "Cebir",
          "Geometri",
          "Veri Analizi"
        ]
      },
      akıl: {
        name: "Akıl Yürütme",
        topics: [
          "Mantıksal Akıl Yürütme",
          "Sayısal Akıl Yürütme",
          "Grafik Yorumlama"
        ]
      }
    }
  },
  DGS: {
    name: "DGS (Dikey Geçiş Sınavı)",
    subjects: {
      turkce: {
        name: "Türkçe",
        topics: [
          "Sözcük Anlamı",
          "Cümle Anlamı",
          "Paragrafta Anlam"
        ]
      },
      matematik: {
        name: "Matematik",
        topics: [
          "Sayılar",
          "Cebir",
          "Geometri",
          "İstatistik"
        ]
      }
    }
  }
};

// Dropdown'lar için utility fonksiyonları
function getExamTypes() {
  return Object.keys(examData).map(key => ({
    code: key,
    name: examData[key].name
  }));
}

function getSubjectsByExam(examType) {
  if (!examData[examType]) return [];
  return Object.keys(examData[examType].subjects).map(key => ({
    code: key,
    name: examData[examType].subjects[key].name
  }));
}

function getTopicsByExamAndSubject(examType, subject) {
  if (!examData[examType]?.subjects[subject]) return [];
  return examData[examType].subjects[subject].topics;
}
