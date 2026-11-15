// Sınav Müfredatları - Güncel ÖSYM ve Mearif Modeline Uygun
// Tüm sınavların tam ders ve konu listeleri

(() => {
const makeSubject = (name, topics) => ({
  name,
  topics: Array.isArray(topics) ? topics : [],
  groups: {}
});

const examData = {
  LGS: {
    name: "LGS (Liselere Geçiş Sistemi)",
    subjects: {
      turkce: makeSubject("Türkçe", [
        "Fiilimsiler", "Sözcükte Anlam", "Söz Sanatları", "Cümlede Anlam", "Parçada Anlam",
        "Cümlenin Ögeleri", "Fiilde Çatı", "Cümle Türleri", "Yazım Kuralları",
        "Noktalama İşaretleri", "Metin Türleri", "Anlatım Bozuklukları"
      ]),
      matematik: makeSubject("Matematik", [
        "Çarpanlar ve Katlar", "Üslü İfadeler", "Kareköklü İfadeler", "Veri Analizi",
        "Basit Olayların Olma Olasılığı", "Cebirsel İfadeler ve Özdeşlikler", "Doğrusal Denklemler",
        "Eşitsizlikler", "Üçgenler", "Eşlik ve Benzerlik", "Dönüşüm Geometrisi", "Geometrik Cisimler"
      ]),
      fen: makeSubject("Fen Bilimleri", [
        "Mevsimler ve İklim", "DNA ve Genetik Kod", "Basınç", "Madde ve Endüstri",
        "Basit Makineler", "Enerji Dönüşümleri ve Çevre Bilimi", "Elektrik Yükleri ve Elektrik Enerjisi"
      ]),
      tarih: makeSubject("T.C. İnkılap Tarihi ve Atatürkçülük", [
        "Bir Kahraman Doğuyor", "Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar",
        "Millî Bir Destan: Ya İstiklal Ya Ölüm!", "Atatürkçülük ve Çağdaşlaşan Türkiye",
        "Demokratikleşme Çabaları", "Atatürk Dönemi Türk Dış Politikası", "Atatürk'ün Ölümü ve Sonrası"
      ]),
      din: makeSubject("Din Kültürü ve Ahlak Bilgisi", [
        "Kader İnancı", "Zekât ve Sadaka", "Din ve Hayat", "Hz. Muhammed'in Örnekliği", "Kur'an-ı Kerim ve Özellikleri"
      ]),
      ingilizce: makeSubject("İngilizce", [
        "Friendship", "Teen Life", "In The Kitchen", "On The Phone", "The Internet",
        "Adventures", "Tourism", "Chores", "Science", "Natural Forces"
      ])
    }
  },

  TYT: {
    name: "TYT (Temel Yeterlilik Testi)",
    subjects: {
      turkce: makeSubject("Türkçe", [
        "Sözcükte Anlam", "Sözcükler Arası Anlam İlişkileri", "Deyimler ve Atasözleri",
        "Söz Gruplarında Anlam", "Cümlede Anlam", "Cümle Yorumlama ve Çıkarım",
        "Neden-Sonuç-Koşul-Amaç Cümleleri", "Kesinlik ve Olasılık Bildiren Cümleler",
        "Cümle Tamamlama", "Anlamca Yakın Cümleler", "Paragraf Yapısı", "Ana Düşünce ve Konu",
        "Yardımcı Düşünce", "Anlatım Teknikleri", "Düşünceyi Geliştirme Yolları",
        "Ses Bilgisi", "Ünlü ve Ünsüzler", "Ses Olayları", "Yapı Bilgisi", "Kök ve Ekler",
        "Sözcük Türleri", "İsimler", "Sıfatlar", "Zamirler", "Zarflar", "Edat-Bağlaç-Ünlem",
        "Fiiller", "Ek Fiil", "Fiilimsi", "Cümlenin Ögeleri", "Cümle Türleri",
        "Anlatım Bozuklukları", "Yazım Kuralları", "Noktalama İşaretleri"
      ]),
      matematik: makeSubject("Matematik", [
        "Temel Kavramlar", "Sayı Kümeleri", "Tek-Çift Sayılar", "Ardışık Sayılar",
        "Basamak Kavramı", "Bölme ve Bölünebilme", "EBOB-EKOK", "Rasyonel Sayılar",
        "Ondalık Sayılar", "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar",
        "Köklü Sayılar", "Çarpanlara Ayırma", "Oran-Orantı", "Birinci Dereceden Denklemler",
        "İkinci Dereceden Denklemler", "Denklem Sistemleri", "Sayı Problemleri",
        "Kesir Problemleri", "Yaş Problemleri", "İşçi-Havuz Problemleri", "Hareket Problemleri",
        "Yüzde-Kâr-Zarar Problemleri", "Karışım Problemleri", "Grafik ve Tablo Problemleri",
        "Kümeler", "Kartezyen Çarpım", "Mantık", "Önerme", "Fonksiyonlar", "Polinomlar",
        "Kalan Bulma", "Permütasyon", "Kombinasyon", "Binom Açılımı", "Olasılık",
        "Tablo-Grafik Yorumlama", "Ortalama ve Yayılım Ölçüleri"
      ]),
      geometri: makeSubject("Geometri", [
        "Temel Geometri Kavramları", "Doğruda Açılar", "Üçgende Açılar", "Dik Üçgen",
        "Özel Üçgenler", "İkizkenar Üçgen", "Eşkenar Üçgen", "Açıortay", "Kenarortay",
        "Eşlik ve Benzerlik", "Üçgende Alan", "Açı-Kenar Bağıntıları", "Çokgenler",
        "Dörtgenler", "Yamuk", "Paralelkenar", "Eşkenar Dörtgen", "Dikdörtgen", "Kare",
        "Deltoid", "Çember", "Daire", "Analitik Geometri", "Noktanın Analitiği",
        "Doğrunun Analitiği", "Katı Cisimler"
      ]),
      fizik: makeSubject("Fizik", [
        "Fizik Bilimine Giriş", "Madde ve Özellikleri", "Öz Kütle", "Yoğunluk",
        "Hareket ve Kuvvet", "İş", "Güç", "Enerji", "Isı", "Sıcaklık", "Genleşme",
        "Elektrostatik", "Elektrik Akımı", "Devreler", "Manyetizma", "Dalgalar",
        "Optik", "Aynalar", "Mercekler", "Kırılma", "Basınç", "Kaldırma Kuvveti"
      ]),
      kimya: makeSubject("Kimya", [
        "Kimya Bilimi", "Laboratuvar Güvenliği", "Atom", "Periyodik Sistem",
        "Kimyasal Türler Arası Etkileşimler", "Maddenin Halleri", "Özellikleri",
        "Kimyanın Temel Kanunları", "Mol Kavramı", "Kimyasal Tepkimeler", "Hesaplamalar",
        "Karışımlar", "Asitler", "Bazlar", "Tuzlar", "Kimya Her Yerde"
      ]),
      biyoloji: makeSubject("Biyoloji", [
        "Yaşam Bilimi", "Canlıların Ortak Özellikleri", "Temel Bileşenleri", "Hücre",
        "Organelleri", "Madde Geçişleri", "Canlıların Sınıflandırılması", "Mitoz", "Mayoz",
        "Kalıtımın Genel İlkeleri", "Ekosistem Ekolojisi", "Güncel Çevre Sorunları"
      ]),
      tarih: makeSubject("Tarih", [
        "Tarih Bilimi", "Kaynakları", "Zaman ve Takvim", "İnsanlığın İlk Dönemleri",
        "Orta Çağ'da Dünya", "İlk ve Orta Çağlarda Türk Dünyası", "İslam Medeniyetinin Doğuşu",
        "Türklerin İslamiyet'i Kabulü", "İlk Türk-İslam Devletleri", "Yerleşme ve Devletleşme",
        "Selçuklu Türkiyesi", "Beylikten Devlete Osmanlı Siyaseti", "Devletleşme Sürecinde Savaşçılar",
        "Beylikten Devlete Osmanlı Medeniyeti", "Dünya Gücü Osmanlı", "Sultan ve Osmanlı Merkez Teşkilatı",
        "Klasik Çağda Osmanlı Toplum Düzeni", "Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti",
        "Değişim Çağında Avrupa ve Osmanlı", "Uluslararası İlişkilerde Denge Stratejisi",
        "Devrimler Çağında Değişen Devlet-Toplum İlişkileri", "Sermaye ve Emek",
        "XIX ve XX Yüzyılda Değişen Gündelik Hayat", "XX Yüzyıl Başlarında Osmanlı",
        "Millî Mücadele", "Atatürkçülük ve Türk İnkılabı"
      ]),
      cografya: makeSubject("Coğrafya", [
        "Doğa ve İnsan", "Doğa ve İnsan Etkileşimi", "Coğrafi Konum", "Dünya'nın Şekli",
        "Hareketleri", "Harita Bilgisi", "Koordinat Sistemi", "Zaman Sistemi", "Atmosfer",
        "Sıcaklık", "Basınç", "Rüzgârlar", "Nem", "Yağış", "Buharlaşma", "İklim Tipleri",
        "İç Kuvvetler", "Dış Kuvvetler", "Türkiye'nin Yerşekilleri", "Su Kaynakları",
        "Toprak Çeşitleri", "Bitki Örtüsü", "Biyomlar", "Nüfus", "Göç", "Yerleşme",
        "Tarım ve Hayvancılık", "Madenler ve Enerji Kaynakları", "Sanayi", "Ticaret",
        "Ulaşım", "Turizm", "Türkiye'nin Coğrafi Bölgeleri", "Doğal Afetler"
      ]),
      felsefe: makeSubject("Felsefe", [
        "Felsefenin Konusu", "Alanları", "Bilgi Felsefesi", "Varlık Felsefesi",
        "Ahlak Felsefesi", "Sanat Felsefesi", "Din Felsefesi", "Siyaset Felsefesi",
        "Bilim Felsefesi", "Antik Dönem Felsefesi", "Ortaçağ Felsefesi",
        "İslam Felsefesi", "Yeni Çağ Felsefesi", "Modern Felsefe"
      ]),
      din: makeSubject("Din Kültürü ve Ahlak Bilgisi", [
        "Bilgi ve İnanç", "Din ve İslam", "İslam ve İbadet", "Gençlik ve Değerler",
        "Gönül Coğrafyamız", "Allah-İnsan İlişkisi", "Hz. Muhammed ve Gençlik",
        "Din ve Hayat", "Ahlaki Tutum ve Davranışlar", "İslam Düşüncesi",
        "İtikadi-Siyasi-Fıkhi Yorumlar", "Yaşayan Dinler", "Vahiy ve Akıl",
        "Hz. Muhammed (s.a.v.)", "Gençlik ve Değerler"
      ])
    }
  },

  AYT: {
    name: "AYT (Alan Yeterlilik Testi)",
    subjects: {
      matematik: makeSubject("Matematik", [
        "Fonksiyonlarda Dönüşümler", "Bileşke ve Ters Fonksiyon", "Fonksiyon Grafikleri",
        "Polinomlarda Bölme", "Kalan", "Çarpanlara Ayırma", "İkinci Dereceden Denklemler",
        "Eşitsizlikler", "Mutlak Değer", "Parabol", "Trigonometri", "Trigonometrik Oranlar",
        "Trigonometrik Fonksiyonlar", "Toplam-Fark Formülleri", "Dönüşüm Formülleri",
        "Trigonometrik Denklemler", "Trigonometrik Grafikler", "Üstel Fonksiyon",
        "Logaritma Fonksiyonu", "Logaritma Denklemleri", "Aritmetik Diziler",
        "Geometrik Diziler", "Limit", "Süreklilik", "Türev", "Türev Alma Kuralları",
        "Türevin Uygulamaları", "Artan-Azalan Fonksiyonlar", "Ekstremum", "Grafik Çizimi",
        "Maksimum-Minimum Problemleri", "Belirsiz İntegral", "Belirli İntegral",
        "İntegral ile Alan Hesabı", "Karmaşık Sayılar", "Karmaşık Sayılarda İşlemler",
        "Karmaşık Sayılarda Gösterimler", "Permütasyon", "Kombinasyon", "Binom",
        "Koşullu Olasılık"
      ]),
      geometri: makeSubject("Geometri", [
        "Üçgenler", "Çokgenler", "Dörtgenler", "Çember", "Daire", "Dörtgende Açılar",
        "Özel Üçgenler", "Üçgende Alan", "Benzerlik", "Dörtgenin Analitiği",
        "Çemberin Analitik İncelenmesi", "Dönüşümlerle Geometri", "Öteleme",
        "Dönme", "Yansıma", "Silindir", "Koni", "Küre", "Katı Cisimler"
      ]),
      fizik: makeSubject("Fizik", [
        "Vektörler", "Bağıl Hareket", "Newton'un Hareket Yasaları", "Sabit İvmeli Hareket",
        "Atışlar", "İş-Güç-Enerji", "İtme ve Çizgisel Momentum", "Tork", "Denge",
        "Kütle Merkezi", "Basit Makineler", "Elektriksel Kuvvet", "Elektriksel Alan",
        "Elektriksel Potansiyel", "Sığa", "Manyetik Alan", "Manyetik Kuvvet", "İndüksiyon",
        "Alternatif Akım", "Transformatörler", "Çembersel Hareket", "Dönerek Öteleme",
        "Açısal Momentum", "Kütle Çekim", "Kepler Yasaları", "Basit Harmonik Hareket",
        "Dalga Mekaniği", "Kırınım", "Girişim", "Doppler Etkisi", "Elektromanyetik Dalgalar",
        "Atom Fiziğine Giriş", "Radyoaktivite", "Özel Görelilik", "Kuantum Fiziğine Giriş",
        "Fotoelektrik Olay", "Compton Olayı", "Modern Fiziğin Teknolojideki Uygulamaları"
      ]),
      kimya: makeSubject("Kimya", [
        "Modern Atom Teorisi", "Kuantum Modeli", "Periyodik Özellikler", "Gaz Yasaları",
        "İdeal Gaz Denklemi", "Gaz Karışımları", "Çözelti Derişimleri", "Koligatif Özellikler",
        "Çözünürlük", "Tepkimelerde Isı Değişimi", "Entalpi", "Tepkimelerde Hız",
        "Kimyasal Denge", "Asit-Baz Dengesi", "pH", "Çözünürlük Dengesi", "Redoks Tepkimeleri",
        "Pil ve Elektroliz", "Karbon Kimyasına Giriş", "Hidrokarbonlar", "Fonksiyonel Gruplar",
        "Alkol", "Eter", "Aldehit", "Keton", "Asit", "Ester", "Enerji Kaynakları",
        "Bilimsel Gelişmeler"
      ]),
      biyoloji: makeSubject("Biyoloji", [
        "Sinir Sistemi", "Endokrin Sistem", "Hormonlar", "Duyu Organları",
        "Destek ve Hareket Sistemi", "Sindirim Sistemi", "Dolaşım Sistemi", "Bağışıklık Sistemi",
        "Solunum Sistemi", "Üriner Sistem", "Üreme Sistemi", "Embriyonik Gelişim",
        "Nükleik Asitler", "Genetik Şifre", "Protein Sentezi", "Genetik Mühendisliği",
        "Biyoteknoloji", "Fotosentez", "Kemosentez", "Hücresel Solunum", "Fermantasyon",
        "Bitkisel Dokular", "Bitkilerde Taşıma", "Bitkilerde Büyüme ve Gelişme",
        "Bitkilerde Üreme", "Komünite Ekolojisi", "Popülasyon Ekolojisi", "Canlılar ve Çevre"
      ]),
      edebiyat: makeSubject("Türk Dili ve Edebiyatı", [
        "Güzel Sanatlar", "Edebiyat", "Metinlerin Sınıflandırılması", "Şiir Bilgisi",
        "Ölçü", "Uyak", "Nazım Biçimleri", "Söz Sanatları", "Anlatma Teknikleri",
        "Öğretici Metin Türleri", "Tiyatro", "İslamiyet Öncesi Türk Edebiyatı",
        "Geçiş Dönemi Eserleri", "Halk Edebiyatı", "Divan Şiiri", "Divan Edebiyatında Nesir",
        "Tanzimat Edebiyatı", "Servet-i Fünun", "Fecr-i Âti", "Millî Edebiyat",
        "Cumhuriyet Dönemi Şiiri", "Cumhuriyet Dönemi Roman", "Cumhuriyet Dönemi Hikâyesi",
        "Cumhuriyet Dönemi Tiyatrosu", "Cumhuriyet Dönemi Diğer Türler", "Batı Edebiyatı Akımları",
        "Dünya Edebiyatından Seçmeler"
      ]),
      tarih: makeSubject("Tarih", [
        "TYT Tarih Konuları", "İki Savaş Arasındaki Dönemde Türkiye", "İki Savaş Arasındaki Dönemde Dünya",
        "II. Dünya Savaşı Sürecinde Türkiye", "II. Dünya Savaşı Sürecinde Dünya",
        "II. Dünya Savaşı Sonrasında Türkiye", "II. Dünya Savaşı Sonrasında Dünya",
        "Toplumsal Devrim Çağında Dünya", "Toplumsal Devrim Çağında Türkiye",
        "XXI. Yüzyılın Eşiğinde Türkiye", "XXI. Yüzyılın Eşiğinde Dünya"
      ]),
      cografya: makeSubject("Coğrafya", [
        "Biyoçeşitlilik", "Ekosistem", "Madde Döngüleri", "Nüfus Politikaları",
        "Şehirlerin Fonksiyonları", "Türkiye'de Yerleşme", "Şehirleşme", "Üretim-Dağıtım-Tüketim",
        "Doğal Kaynaklar", "Türkiye'de Tarım", "Hayvancılık", "Madenler", "Sanayi",
        "Ulaşım", "Ticaret", "Turizm", "Bölgesel Kalkınma Projeleri", "Küresel Ticaret",
        "Uluslararası Örgütler", "Çevre ve Toplum"
      ]),
      felsefe: makeSubject("Felsefe Grubu", [
        "Psikoloji Bilimini Tanıyalım", "Psikolojinin Temel Süreçleri", "Öğrenme", "Bellek",
        "Düşünme", "Ruh Sağlığının Temelleri", "Sosyolojiye Giriş", "Birey ve Toplum",
        "Toplumsal Yapı", "Toplumsal Değişme", "Toplumsal Gelişme", "Toplum ve Kültür",
        "Toplumsal Kurumlar", "Mantığa Giriş", "Klasik Mantık", "Mantık ve Dil",
        "Sembolik Mantık", "Antik Felsefe", "Ortaçağ Felsefesi", "Yeni Çağ Felsefesi",
        "Modern Felsefe", "Çağdaş Felsefe"
      ]),
      din: makeSubject("Din Kültürü", [
        "Dünya ve Ahiret", "Kur'an'a Göre Hz. Muhammed", "Kur'an'da Bazı Kavramlar",
        "İnançla İlgili Meseleler", "İslam Düşüncesinde Yorumlar", "İslam Düşüncesinde Mezhepler",
        "İslam Düşüncesinde Tasavvufi Yorumlar", "İslam ve Bilim", "Anadolu'da İslam",
        "Güncel Dini Meseleler", "Yahudilik", "Hristiyanlık", "Hint Dinleri", "Çin Dinleri"
      ])
    }
  },

  KPSS: {
    name: "KPSS (Kamu Personeli Seçme Sınavı)",
    subjects: {
      turkce: makeSubject("Türkçe", [
        "Sözcükte Anlam", "Cümlede Anlam", "Paragraf", "Ses Bilgisi", "Yazım Kuralları",
        "Noktalama İşaretleri", "Sözcükte Yapı", "Sözcük Türleri", "Cümlenin Ögeleri",
        "Cümle Türleri", "Anlatım Bozuklukları", "Sözel Mantık"
      ]),
      matematik: makeSubject("Matematik & Geometri", [
        "Temel Kavramlar", "Sayı Basamakları", "Bölme-Bölünebilme", "EBOB-EKOK",
        "Rasyonel Sayılar", "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar",
        "Köklü Sayılar", "Çarpanlara Ayırma", "Oran-Orantı", "Denklem Çözme",
        "Sayı Problemleri", "Kesir Problemleri", "Yaş Problemleri", "Yüzde Problemleri",
        "Kâr-Zarar Problemleri", "Karışım Problemleri", "Grafik ve Tablo Yorumlama",
        "Kümeler", "Fonksiyonlar", "İşlem ve Modüler Aritmetik", "Permütasyon-Kombinasyon",
        "Olasılık", "Sayısal Mantık", "Doğruda Açılar", "Üçgende Açılar",
        "Özel Üçgenler", "Çokgenler", "Dörtgenler", "Çember ve Daire",
        "Analitik Geometri", "Katı Cisimler"
      ]),
      tarih: makeSubject("Tarih", [
        "İslamiyet Öncesi Türk Tarihi", "İlk Türk-İslam Devletleri", "Türkiye Selçuklu Tarihi",
        "Beylikler Dönemi", "Osmanlı Kuruluş Dönemi", "Osmanlı Yükselme Dönemi",
        "Osmanlı Duraklama Dönemi", "Osmanlı Gerileme ve Dağılma Dönemleri", "Osmanlı Kültür ve Medeniyeti",
        "XX. Yüzyıl Başlarında Osmanlı", "Kurtuluş Savaşı Hazırlık Dönemi", "Kurtuluş Savaşı Cepheler Dönemi",
        "İnkılap Tarihi", "Atatürk İlkeleri", "Atatürk İnkılapları", "Atatürk Dönemi İç Politika",
        "Atatürk Dönemi Dış Politika", "Çağdaş Türk Tarihi", "Çağdaş Dünya Tarihi"
      ]),
      cografya: makeSubject("Coğrafya", [
        "Türkiye'nin Coğrafi Konumu", "Matematik Konum", "Özel Konum", "Jeopolitik",
        "Yerşekilleri", "Su Varlığı", "Toprak", "Bitki Örtüsü", "İklim", "Nüfus",
        "Göç", "Yerleşme", "Tarım", "Hayvancılık", "Ormancılık", "Madenler",
        "Enerji Kaynakları", "Sanayi", "Ulaşım", "Ticaret", "Turizm", "Türkiye'nin Bölgeleri",
        "Bölgesel Kalkınma Projeleri"
      ]),
      vatandaslik: makeSubject("Vatandaşlık", [
        "Hukukun Temel Kavramları", "Hukuk Kaynakları", "Devlet Biçimleri", "Demokrasi",
        "Hükûmet Sistemleri", "Anayasa Hukukuna Giriş", "1982 Anayasası Temel İlkeleri",
        "Temel Hak ve Özgürlükler", "Yasama Organı", "Yürütme Organı", "Yargı Organı",
        "Anayasa Mahkemesi", "Yüksek Mahkemeler", "İdare Hukuku", "Uluslararası Kuruluşlar"
      ]),
      guncel: makeSubject("Güncel Bilgiler", [
        "Türkiye Güncel Olayları", "Dünya Güncel Olayları", "Uluslararası Anlaşmalar",
        "Kültür-Sanat-Bilim", "Türkiye'nin Ekonomik Yapısı", "Türkiye'nin Sosyal Yapısı"
      ])
    }
  },

  DGS: {
    name: "DGS (Dikey Geçiş Sınavı)",
    subjects: {
      sayisal: makeSubject("Sayısal (Matematik & Geometri)", [
        "Temel Kavramlar", "Sayı Basamakları", "Bölme-Bölünebilime", "EBOB-EKOK",
        "Rasyonel Sayılar", "Sıralama", "Basit Eşitsizlikler", "Mutlak Değer",
        "Üslü İfadeler", "Köklü İfadeler", "Çarpanlara Ayırma", "Oran-Orantı",
        "Denklem Çözme", "Denklem Sistemleri", "Sayı Problemleri", "Kesir Problemleri",
        "Yaş Problemleri", "İşçi-Havuz Problemleri", "Hareket Problemleri",
        "Yüzde-Kâr-Zarar Problemleri", "Karışım Problemleri", "Grafik ve Tablo Yorumlama",
        "Kümeler", "Fonksiyonlar", "İşlem ve Modüler Aritmetik", "Permütasyon",
        "Kombinasyon", "Olasılık", "Sayısal Mantık", "Şifreler", "Şekil-Sayı İlişkileri",
        "Rutin Olmayan Problemler", "Doğruda Açılar", "Üçgende Açılar", "Özel Üçgenler",
        "Çokgenler", "Dörtgenler", "Çember ve Daire", "Analitik Geometri", "Katı Cisimler"
      ]),
      sozel: makeSubject("Sözel (Türkçe)", [
        "Sözcükte Anlam", "Cümlede Anlam", "Anlatım Biçimleri", "Düşünceyi Geliştirme Yolları",
        "Paragraf Yapısı", "Paragraf Anlam", "Ana Düşünce", "Yardımcı Düşünce",
        "Sözel Mantık", "Sıralama Problemleri", "Yerleştirme Problemleri",
        "Eşleştirme Problemleri", "Tablo Kurma Problemleri"
      ])
    }
  },

  YÖS: {
    name: "TR-YÖS (Yabancı Uyruklu Öğrenci Sınavı)",
    subjects: {
      matematik: makeSubject("Temel Matematik & Geometri", [
        "Doğal Sayılar", "Tam Sayılar", "Rasyonel Sayılar", "Ondalık Sayılar",
        "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma", "Özdeşlikler",
        "Oran-Orantı", "Birinci Dereceden Denklemler", "İkinci Dereceden Denklemler",
        "Eşitsizlikler", "Mutlak Değer", "Sayı Problemleri", "Kesir Problemleri",
        "Yaş Problemleri", "Yüzde Problemleri", "Kâr-Zarar Problemleri", "Kümeler",
        "Fonksiyonlar", "Polinomlar", "Permütasyon", "Kombinasyon", "Binom Açılımı",
        "Olasılık", "Karmaşık Sayılar", "Trigonometri", "Logaritma", "Diziler ve Seriler",
        "Limit ve Süreklilik", "Türev ve Uygulamaları", "İntegral ve Uygulamaları",
        "Matris ve Determinant", "Doğruda Açılar", "Üçgende Açılar", "Özel Üçgenler",
        "Çokgenler", "Dörtgenler", "Çember ve Daire", "Analitik Geometri",
        "Vektörler", "Katı Cisimler"
      ]),
      sayisalYetenek: makeSubject("Sayısal Yetenek (IQ)", [
        "Şifreler", "Sayı Dizileri", "Harf Dizileri", "Şekil Dizileri", "Örüntüler",
        "Kurallı İşlemler", "Sayı Piramitleri", "Tablolar", "Matrisler",
        "Terazi ve Denge Problemleri", "Şekil İlişkileri", "Döndürme", "Yansıma",
        "Katlama", "Kesme", "Küp Açınımları", "Birim Küp Sayma", "Grafik Yorumlama",
        "Mantıksal Akıl Yürütme"
      ])
    }
  }
};

// Dropdown'lar için yardımcı fonksiyonlar
window.getExamTypes = function getExamTypes() {
  return Object.keys(examData).map(key => ({ code: key, name: examData[key].name }));
};

window.getSubjectsByExam = function getSubjectsByExam(examType) {
  if (!examData[examType]) return [];
  return Object.keys(examData[examType].subjects).map(key => ({
    code: key,
    name: examData[examType].subjects[key].name
  }));
};

window.getTopicsByExamAndSubject = function getTopicsByExamAndSubject(examType, subject) {
  if (!examData[examType]?.subjects[subject]) return [];
  return examData[examType].subjects[subject].topics;
};

window.getTopicGroupsByExamAndSubject = function getTopicGroupsByExamAndSubject(examType, subject) {
  const entry = examData[examType]?.subjects[subject];
  if (!entry) return [];
  if (!Object.keys(entry.groups).length) return entry.topics.length ? [{ unit: '', topics: entry.topics }] : [];
  return Object.entries(entry.groups).map(([unit, items]) => ({
    unit,
    topics: items.map(item => `${unit} - ${item}`)
  }));
};

})();
