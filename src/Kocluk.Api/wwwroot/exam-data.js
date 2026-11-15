// Sınav türleri, dersler ve konular (TYT, AYT, KPSS, TR-YÖS, DGS).
// Soru Bankası ekranları ve Haftalık program aynı kaynağı kullanır.
// Yapı: sınav -> ders -> ünite -> konu. Konu metni "Ünite - Konu" biçiminde düz listeye de çevrilir.
// Not: TYT/AYT ÖSYM kılavuz ünite adlarına göre hazırlanmıştır; Maarif Modeli müfredatı kademeli
// uygulandığı için 2026 kapsamı mevcut ünitelerle aynıdır. KPSS ve TR-YÖS dağılımlarını her yıl
// ÖSYM'nin güncel kılavuzuyla karşılaştırın.

(() => {
const flattenTopics = groups => Object.entries(groups).flatMap(([unit, items]) => items.map(item => `${unit} - ${item}`));
const flat = groups => Object.values(groups).flat();
const makeSubject = (name, groups) => ({ name, groups, topics: flattenTopics(groups) });

// ---------- Ortak ders içerikleri ----------
const turkceDilBilgisi = {
  "Sözcükte Anlam": ["Gerçek, Mecaz ve Terim Anlam", "Sözcükler Arası Anlam İlişkileri (Eş, Zıt, Yakın Anlam, Eş Sesli)", "Deyimler ve Atasözleri", "Söz Gruplarında Anlam"],
  "Cümlede Anlam": ["Cümle Yorumlama ve Çıkarım", "Neden-Sonuç, Koşul, Amaç Cümleleri", "Kesinlik ve Olasılık Bildiren Cümleler", "Cümle Tamamlama", "Anlamca Yakın / Karşıt Cümleler"],
  "Paragraf": ["Ana Düşünce ve Konu", "Yardımcı Düşünce", "Başlık ve Paragraf Yapısı", "Anlatım Teknikleri (Tanımlama, Karşılaştırma, Örnekleme, Tanık Gösterme)", "Düşünceyi Geliştirme Yolları", "Paragraf Tamamlama, Bölme ve Akışı Bozan Cümle", "Cümle Sıralama"],
  "Ses Bilgisi": ["Ünlü ve Ünsüzler", "Ses Olayları (Uyum, Benzeşme, Türeme, Düşme, Daralma)"],
  "Yapı Bilgisi": ["Kök ve Ekler", "Sözcük Türetme ve Birleşik Sözcükler"],
  "Sözcük Türleri": ["İsimler", "Sıfatlar", "Zamirler", "Zarflar", "Edat, Bağlaç, Ünlem", "Fiiller (Kip, Ek Fiil, Fiilimsi, Çatı)"],
  "Cümle Bilgisi": ["Cümlenin Ögeleri", "Cümle Türleri (Yapı, Anlam, Yüklemin Türü)"],
  "Yazım Kuralları": ["Büyük Harf, Birleşik ve Ayrı Yazım, Ek Yazımı"],
  "Noktalama İşaretleri": ["Nokta, Virgül, İki Nokta, Noktalı Virgül ve Diğer İşaretler"],
  "Anlatım Bozuklukları": ["Sözcük ve Anlam Düzeyinde Bozukluk", "Yapı ve Mantık Düzeyinde Bozukluk"]
};

const temelMatematik = {
  "Temel Kavramlar": ["Sayı Kümeleri, Tek-Çift, Ardışık Sayılar", "Basamak Kavramı ve Çözümleme"],
  "Sayılar": ["Bölme ve Bölünebilme", "EBOB - EKOK", "Asal Çarpanlara Ayırma", "Rasyonel Sayılar", "Ondalık Sayılar"],
  "Eşitsizlik ve Mutlak Değer": ["Basit Eşitsizlikler", "Mutlak Değer"],
  "Üslü ve Köklü İfadeler": ["Üslü Sayılar", "Köklü Sayılar"],
  "Cebir": ["Çarpanlara Ayırma ve Özdeşlikler", "Oran - Orantı", "Birinci Dereceden Denklemler", "İkinci Dereceden Denklemler", "Denklem Sistemleri"],
  "Problemler": ["Sayı ve Kesir Problemleri", "Yaş Problemleri", "Yüzde, Kâr-Zarar ve Faiz Problemleri", "Karışım Problemleri", "İşçi - Havuz Problemleri", "Hareket Problemleri", "Grafik ve Tablo Problemleri"],
  "Kümeler ve Mantık": ["Kümeler", "Önermeler ve Mantık"],
  "Fonksiyonlar": ["Fonksiyon Kavramı ve Gösterimi", "Fonksiyon Türleri ve İşlemleri"],
  "Polinomlar": ["Polinom Kavramı ve İşlemleri", "Kalan Bulma"],
  "Sayma ve Olasılık": ["Permütasyon ve Kombinasyon", "Olasılık"],
  "Veri": ["Tablo ve Grafik Yorumlama", "Ortalama ve Yayılım Ölçüleri"],
  "Geometri": ["Temel Geometri Kavramları", "Doğruda ve Üçgende Açılar", "Özel Üçgenler", "Açı - Kenar Bağıntıları", "Üçgende Alan ve Benzerlik", "Çokgenler ve Dörtgenler", "Çember ve Daire", "Katı Cisimler", "Analitik Geometri (Doğrunun Analitiği)"]
};

const tarihTYT = {
  "Tarih ve Zaman": ["Tarih Bilimi ve Kaynakları", "Zaman ve Takvim"],
  "İlk ve Orta Çağlar": ["İnsanlığın İlk Dönemleri", "Orta Çağ'da Dünya", "İlk ve Orta Çağlarda Türk Dünyası"],
  "İslam ve Türk-İslam": ["İslam Medeniyetinin Doğuşu", "Türklerin İslamiyet'i Kabulü ve İlk Türk-İslam Devletleri"],
  "Selçuklu Türkiyesi": ["Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi"],
  "Osmanlı Kuruluş ve Yükselme": ["Beylikten Devlete Osmanlı Siyaseti", "Devletleşme Sürecinde Savaşçılar ve Askerler", "Beylikten Devlete Osmanlı Medeniyeti", "Dünya Gücü Osmanlı", "Sultan ve Osmanlı Merkez Teşkilatı", "Klasik Çağda Osmanlı Toplum Düzeni"],
  "Değişen Dünya ve Osmanlı": ["Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti", "Değişim Çağında Avrupa ve Osmanlı", "Uluslararası İlişkilerde Denge Stratejisi (1774-1914)", "Devrimler Çağında Değişen Devlet-Toplum İlişkileri", "Sermaye ve Emek", "XIX. ve XX. Yüzyılda Değişen Gündelik Hayat"],
  "Milli Mücadele ve Cumhuriyet": ["XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya", "Milli Mücadele", "Atatürkçülük ve Türk İnkılabı"]
};
const cografyaTYT = {
  "Doğa ve İnsan": ["Doğa ve İnsan Etkileşimi", "Coğrafi Konum"],
  "Dünya ve Harita": ["Dünya'nın Şekli ve Hareketleri", "Harita Bilgisi", "Koordinat Sistemi ve Zaman"],
  "Atmosfer ve İklim": ["Atmosfer ve Sıcaklık", "Basınç ve Rüzgârlar", "Nem, Yağış ve Buharlaşma", "İklim Tipleri"],
  "Yerin Şekillenmesi": ["İç Kuvvetler", "Dış Kuvvetler", "Türkiye'nin Yerşekilleri"],
  "Su, Toprak ve Bitki": ["Su Kaynakları", "Toprak Çeşitleri", "Bitki Örtüsü ve Biyomlar"],
  "Beşeri Coğrafya": ["Nüfus", "Göç", "Yerleşme"],
  "Ekonomik Faaliyetler": ["Tarım ve Hayvancılık", "Madenler ve Enerji Kaynakları", "Sanayi, Ticaret ve Ulaşım", "Turizm"],
  "Bölgeler ve Afetler": ["Türkiye'nin Coğrafi Bölgeleri", "Doğal Afetler"]
};
const felsefeTYT = {
  "Felsefeye Giriş": ["Felsefenin Konusu ve Alanları"],
  "Felsefe Disiplinleri": ["Bilgi Felsefesi", "Varlık Felsefesi", "Ahlak Felsefesi", "Sanat Felsefesi", "Din Felsefesi", "Siyaset Felsefesi", "Bilim Felsefesi"]
};
const dinTYT = {
  "İnanç ve Din": ["Bilgi ve İnanç", "Din ve İslam", "İslam ve İbadet"],
  "Vahiy ve Peygamberlik": ["Vahiy ve Akıl", "Hz. Muhammed (s.a.v.)", "Allah - İnsan İlişkisi"],
  "Din ve Toplum": ["Gençlik ve Değerler", "Din, Kültür ve Medeniyet", "Yaşayan Dinler"]
};

const fizikTYT = {
  "Fizik Bilimi": ["Fizik Bilimine Giriş ve Ölçme"],
  "Madde": ["Madde ve Özellikleri (Öz Kütle, Yoğunluk)"],
  "Hareket ve Kuvvet": ["Hareket ve Kuvvet", "İş, Güç ve Enerji"],
  "Isı ve Basınç": ["Isı, Sıcaklık ve Genleşme", "Basınç ve Kaldırma Kuvveti"],
  "Elektrik ve Manyetizma": ["Elektrostatik", "Elektrik Akımı ve Devreler", "Manyetizma"],
  "Dalgalar ve Optik": ["Dalgalar", "Optik (Aynalar, Mercekler, Kırılma)"]
};
const kimyaTYT = {
  "Kimya Bilimi": ["Kimya Bilimi ve Laboratuvar Güvenliği"],
  "Atom ve Periyodik Sistem": ["Atom ve Periyodik Sistem"],
  "Kimyasal Türler": ["Kimyasal Türler Arası Etkileşimler"],
  "Maddenin Halleri": ["Maddenin Halleri ve Özellikleri"],
  "Kimyasal Hesaplamalar": ["Kimyanın Temel Kanunları", "Mol Kavramı", "Kimyasal Tepkimeler ve Hesaplamalar"],
  "Karışımlar ve Çevre": ["Karışımlar", "Asitler, Bazlar ve Tuzlar", "Kimya Her Yerde"]
};
const biyolojiTYT = {
  "Canlıların Yapısı": ["Canlıların Ortak Özellikleri", "Canlıların Temel Bileşenleri", "Hücre ve Organelleri", "Madde Geçişleri"],
  "Canlıların Çeşitliliği": ["Canlıların Sınıflandırılması"],
  "Hücre Bölünmeleri ve Kalıtım": ["Mitoz ve Mayoz", "Kalıtımın Genel İlkeleri"],
  "Ekoloji": ["Ekosistem Ekolojisi ve Güncel Çevre Sorunları"]
};

// ---------- AYT içerikleri ----------
const edebiyatAYT = {
  "Edebiyat Bilgisi": ["Güzel Sanatlar ve Edebiyat", "Şiir Bilgisi (Ölçü, Uyak, Nazım Biçimleri)", "Söz Sanatları", "Anlatma ve Öğretici Metin Türleri", "Tiyatro"],
  "İslamiyet Öncesi ve Halk Edebiyatı": ["İslamiyet Öncesi Türk Edebiyatı", "Geçiş Dönemi Eserleri", "Halk Edebiyatı"],
  "Divan Edebiyatı": ["Divan Şiiri (Nazım Biçimleri ve Şairler)", "Divan Edebiyatında Nesir"],
  "Batı Etkisinde Türk Edebiyatı": ["Tanzimat Edebiyatı", "Servet-i Fünun ve Fecr-i Âti", "Millî Edebiyat"],
  "Cumhuriyet Dönemi": ["Cumhuriyet Dönemi Şiiri", "Cumhuriyet Dönemi Roman ve Hikâyesi", "Cumhuriyet Dönemi Tiyatrosu ve Diğer Türler"],
  "Dünya Edebiyatı": ["Batı Edebiyatı Akımları", "Dünya Edebiyatından Seçmeler"]
};
const matematikAYT = {
  "Fonksiyonlar": ["Fonksiyonlarda Dönüşümler", "Bileşke ve Ters Fonksiyon", "Fonksiyon Grafikleri"],
  "Polinomlar": ["Polinomlarda Bölme ve Kalan", "Çarpanlara Ayırma"],
  "Denklem ve Eşitsizlikler": ["İkinci Dereceden Denklemler", "Eşitsizlikler ve Mutlak Değer", "Parabol"],
  "Karmaşık Sayılar": ["Karmaşık Sayılarda İşlemler ve Gösterimler"],
  "Sayma ve Olasılık": ["Permütasyon, Kombinasyon ve Binom", "Koşullu Olasılık"],
  "Üstel ve Logaritma": ["Üstel Fonksiyon", "Logaritma Fonksiyonu ve Denklemleri"],
  "Diziler": ["Aritmetik ve Geometrik Diziler", "Dizilerde Limit"],
  "Trigonometri": ["Trigonometrik Oranlar ve Fonksiyonlar", "Toplam-Fark ve Dönüşüm Formülleri", "Trigonometrik Denklemler ve Grafikler"],
  "Limit ve Süreklilik": ["Limit", "Süreklilik"],
  "Türev": ["Türev Alma Kuralları", "Türevin Uygulamaları (Artan-Azalan, Ekstremum, Grafik)", "Maksimum - Minimum Problemleri"],
  "İntegral": ["Belirsiz İntegral", "Belirli İntegral", "İntegral ile Alan Hesabı"],
  "Geometri": ["Üçgenler ve Çokgenler", "Çember ve Daire", "Dörtgenler", "Analitik Geometri (Doğru ve Çember)", "Dönüşümler", "Katı Cisimler"]
};
const fizikAYT = {
  "Vektörler ve Hareket": ["Vektörler", "Bağıl Hareket", "Newton'un Hareket Yasaları", "Bir Boyutta Sabit İvmeli Hareket", "İki Boyutta Hareket (Atışlar)"],
  "Enerji ve Momentum": ["İş, Güç ve Enerji", "İtme ve Momentum", "Tork ve Denge", "Kütle Merkezi", "Basit Makineler"],
  "Çembersel ve Dönme Hareketi": ["Düzgün Çembersel Hareket", "Dönerek Öteleme ve Açısal Momentum", "Kütle Çekim ve Kepler Yasaları", "Basit Harmonik Hareket"],
  "Elektrik ve Manyetizma": ["Elektriksel Kuvvet ve Alan", "Elektriksel Potansiyel, Sığa", "Manyetik Alan ve Kuvvet", "İndüksiyon", "Alternatif Akım ve Transformatörler"],
  "Dalga Mekaniği": ["Dalgalar, Kırınım ve Girişim", "Doppler Etkisi", "Elektromanyetik Dalgalar"],
  "Modern Fizik": ["Atom Fiziğine Giriş ve Radyoaktivite", "Özel Görelilik", "Kuantum Fiziğine Giriş", "Fotoelektrik ve Compton Olayı", "Modern Fiziğin Teknolojideki Uygulamaları"]
};
const kimyaAYT = {
  "Modern Atom Teorisi": ["Atomun Kuantum Modeli", "Periyodik Özellikler"],
  "Gazlar": ["Gaz Yasaları ve İdeal Gaz Denklemi", "Gaz Karışımları"],
  "Sıvı Çözeltiler": ["Çözelti Derişimleri", "Koligatif Özellikler", "Çözünürlük"],
  "Tepkimelerde Enerji, Hız ve Denge": ["Tepkimelerde Isı Değişimi (Entalpi)", "Tepkimelerde Hız", "Kimyasal Denge"],
  "Asit-Baz ve Çözünürlük Dengesi": ["Asit-Baz Dengesi ve pH", "Çözünürlük Dengesi (KÇD)"],
  "Kimya ve Elektrik": ["Redoks Tepkimeleri", "Pil ve Elektroliz"],
  "Organik Kimya": ["Karbon Kimyasına Giriş", "Hidrokarbonlar", "Fonksiyonel Gruplar (Alkol, Eter, Aldehit, Keton, Asit, Ester)"],
  "Enerji Kaynakları": ["Enerji Kaynakları ve Bilimsel Gelişmeler"]
};
const biyolojiAYT = {
  "İnsan Fizyolojisi": ["Sinir Sistemi", "Endokrin Sistem ve Hormonlar", "Duyu Organları", "Destek ve Hareket Sistemi", "Sindirim Sistemi", "Dolaşım ve Bağışıklık Sistemi", "Solunum Sistemi", "Boşaltım Sistemi", "Üreme Sistemi ve Embriyonik Gelişim"],
  "Genden Proteine": ["Nükleik Asitler", "Genetik Şifre ve Protein Sentezi"],
  "Genetik Mühendisliği ve Biyoteknoloji": ["Genetik Mühendisliği ve Biyoteknoloji"],
  "Canlılarda Enerji": ["Fotosentez ve Kemosentez", "Hücresel Solunum ve Fermantasyon"],
  "Bitki Biyolojisi": ["Bitkisel Dokular", "Bitkilerde Taşıma, Büyüme ve Gelişme", "Bitkilerde Üreme"],
  "Ekoloji": ["Komünite ve Popülasyon Ekolojisi", "Canlılar ve Çevre"]
};
const tarihAYT = {
  "İlk Uygarlıklar ve Türk Tarihi": ["Uygarlığın Doğuşu ve İlk Uygarlıklar", "İlk Türk Devletleri", "İslam Tarihi ve Uygarlığı", "Türk-İslam Devletleri", "Selçuklu Türkiyesi"],
  "Osmanlı Devleti": ["Beylikten Devlete (Kuruluş)", "Dünya Gücü Osmanlı (Yükselme)", "Osmanlı Kültür ve Medeniyeti", "XVII. Yüzyılda Arayış", "XVIII. Yüzyılda Değişim ve Diplomasi", "XIX. Yüzyılda Değişim ve Reformlar", "XX. Yüzyıl Başlarında Osmanlı"],
  "Yeni ve Yakın Çağ": ["Yeni Çağ Avrupası ve Keşifler", "Yakın Çağ Avrupası (Devrimler)", "XX. Yüzyıl Başlarında Dünya", "II. Dünya Savaşı", "Soğuk Savaş Dönemi", "Yumuşama Dönemi ve Küreselleşen Dünya"],
  "Milli Mücadele ve Atatürk Dönemi": ["Milli Mücadele (Hazırlık ve Cepheler)", "Atatürk İlke ve İnkılapları", "Atatürk Dönemi İç ve Dış Politika"],
  "Cumhuriyet Dönemi": ["II. Dünya Savaşı'nda Türkiye", "Çok Partili Hayat", "Cumhuriyet Dönemi Dış Politikası"]
};
const cografyaAYT = {
  "Doğal Sistemler": ["Ekosistem ve Madde Döngüleri", "Biyoçeşitlilik ve Biyomlar", "Kayaçlar ve Mineraller", "Su, Toprak ve Bitki Örtüsü (Ayrıntılı)"],
  "Beşeri Sistemler": ["Nüfus Politikaları ve Göç", "Yerleşmeler ve Şehirleşme", "Ekonomik Faaliyetler (Tarım, Sanayi, Hizmet)", "Türkiye'de Tarım, Sanayi ve Enerji"],
  "Mekânsal Sentez": ["Türkiye'de Ulaşım, Ticaret ve Turizm", "Küresel Ortam: Bölgeler ve Ülkeler", "Doğal Afetler ve Çevre Sorunları", "Kültür Bölgeleri ve Jeopolitik", "Türkiye'nin İşlevsel Bölgeleri ve Kalkınma Projeleri"]
};
const felsefeGrubuAYT = {
  "Felsefe": ["MÖ 6. - MS 2. Yüzyıl Felsefesi", "MS 2. - MS 15. Yüzyıl Felsefesi", "15. - 17. Yüzyıl Felsefesi", "18. - 19. Yüzyıl Felsefesi", "20. Yüzyıl Felsefesi"],
  "Psikoloji": ["Psikolojinin Temel Süreçleri", "Öğrenme, Bellek ve Düşünme", "Ruh Sağlığı ve Kişilik"],
  "Sosyoloji": ["Sosyolojiye Giriş", "Birey ve Toplum", "Toplumsal Yapı ve Değişme", "Toplum ve Kültür", "Toplumsal Kurumlar"],
  "Mantık": ["Mantığa Giriş", "Klasik Mantık", "Mantık ve Dil", "Sembolik Mantık"]
};
const dinAYT = {
  "Dünya ve Ahiret": ["Dünya ve Ahiret"],
  "Kur'an Merkezli Konular": ["Kur'an'a Göre Hz. Muhammed", "Kur'an'da Bazı Kavramlar"],
  "İnanç ve Yorumlar": ["İnançla İlgili Meseleler", "İslam Düşüncesinde Yorumlar ve Mezhepler", "İslam Düşüncesinde Tasavvufi Yorumlar"],
  "Din ve Toplum": ["İslam ve Bilim", "Anadolu'da İslam", "Güncel Dini Meseleler", "Yahudilik ve Hristiyanlık", "Hint ve Çin Dinleri"]
};
const yabanciDilAYT = {
  "Kelime Bilgisi": ["Vocabulary", "Phrasal Verbs ve Collocations"],
  "Dilbilgisi": ["Tenses", "Modals", "Passive Voice", "Conditionals", "Relative Clauses", "Noun Clauses", "Gerund ve Infinitive", "Reported Speech"],
  "Cloze Test": ["Cloze Test (Boşluk Doldurma)"],
  "Cümle ve Paragraf": ["Cümle Tamamlama", "Diyalog Tamamlama", "Paragraf Tamamlama", "Anlam Bütünlüğünü Bozan Cümle"],
  "Okuma ve Çeviri": ["Reading Comprehension", "İngilizce - Türkçe Çeviri", "Türkçe - İngilizce Çeviri", "Anlamca Yakın Cümle"]
};

// ---------- KPSS ----------
const matematikKPSS = {
  "Sayılar": ["Temel Kavramlar ve Sayı Kümeleri", "Bölme ve Bölünebilme", "EBOB - EKOK", "Rasyonel Sayılar", "Üslü ve Köklü Sayılar", "Mutlak Değer ve Eşitsizlikler"],
  "Cebir": ["Çarpanlara Ayırma ve Özdeşlikler", "Oran - Orantı", "Denklem Çözme", "Denklem Sistemleri"],
  "Problemler": ["Sayı ve Kesir Problemleri", "Yaş Problemleri", "Yüzde, Kâr-Zarar ve Faiz Problemleri", "Karışım Problemleri", "İşçi - Havuz Problemleri", "Hareket Problemleri"],
  "Kümeler ve İşlem": ["Kümeler", "İşlem ve Modüler Aritmetik"],
  "Sayma ve Olasılık": ["Permütasyon ve Kombinasyon", "Olasılık"],
  "Veri": ["Tablo ve Grafik Yorumlama"],
  "Sayısal Mantık": ["Sayısal Mantık ve Akıl Yürütme"],
  "Geometri": ["Açılar ve Üçgenler", "Çokgenler ve Dörtgenler", "Çember ve Daire", "Katı Cisimler", "Analitik Geometri"]
};
const turkceKPSS = { ...turkceDilBilgisi, "Sözel Mantık": ["Sözel Mantık ve Akıl Yürütme"] };
const tarihKPSS = {
  "İslamiyet Öncesi ve Türk-İslam": ["İslamiyet Öncesi Türk Tarihi", "İlk Türk-İslam Devletleri", "Anadolu Selçuklu Devleti ve Beylikler"],
  "Osmanlı Devleti": ["Osmanlı Kuruluş Dönemi", "Osmanlı Yükselme Dönemi", "Osmanlı Duraklama Dönemi", "Osmanlı Gerileme ve Dağılma Dönemleri", "Osmanlı Kültür ve Medeniyeti", "XIX. Yüzyılda Osmanlı (Islahat ve Tanzimat)", "XX. Yüzyıl Başlarında Osmanlı"],
  "Kurtuluş Savaşı": ["Kurtuluş Savaşı Hazırlık Dönemi", "Kurtuluş Savaşı Muharebeler Dönemi", "Mudanya, Lozan ve Cumhuriyet'in İlanı"],
  "Atatürk Dönemi": ["Atatürk İlkeleri", "Atatürk İnkılapları", "Atatürk Dönemi İç Politika", "Atatürk Dönemi Dış Politika"],
  "Çağdaş Türk ve Dünya Tarihi": ["II. Dünya Savaşı ve Soğuk Savaş", "Çağdaş Türk ve Dünya Tarihi"]
};
const cografyaKPSS = {
  "Türkiye'nin Coğrafi Konumu": ["Matematik ve Özel Konum", "Türkiye'nin Jeopolitiği"],
  "Fiziki Coğrafya": ["Yerşekilleri", "İklim", "Su Varlığı", "Toprak ve Bitki Örtüsü"],
  "Beşeri Coğrafya": ["Nüfus", "Göç", "Yerleşme"],
  "Ekonomik Coğrafya": ["Tarım ve Hayvancılık", "Madenler ve Enerji", "Sanayi", "Ticaret ve Ulaşım", "Turizm"],
  "Bölgeler ve Afetler": ["Türkiye'nin Coğrafi Bölgeleri", "Doğal Afetler"]
};
const vatandaslikKPSS = {
  "Hukukun Temel Kavramları": ["Hukukun Temel Kavramları ve Kaynakları"],
  "Devlet ve Anayasa": ["Devlet Biçimleri ve Demokrasi", "Anayasa Hukukuna Giriş", "1982 Anayasası'nın Temel İlkeleri"],
  "Temel Organlar": ["Yasama", "Yürütme", "Yargı (Anayasa Mahkemesi ve Yüksek Mahkemeler)"],
  "Hak ve İdare": ["Temel Hak ve Özgürlükler", "İdare Hukuku", "Uluslararası Kuruluşlar"]
};
const guncelKPSS = {
  "Güncel Bilgiler": ["Türkiye ve Dünya Güncel Olayları", "Uluslararası Kuruluşlar ve Anlaşmalar", "Kültür, Sanat ve Bilim", "Türkiye'nin Ekonomik ve Sosyal Yapısı"]
};

// ---------- DGS ----------
const turkceDGS = { ...turkceDilBilgisi, "Sözel Mantık": ["Sözel Mantık ve Akıl Yürütme"] };
const matematikDGS = {
  "Sayılar": ["Temel Kavramlar", "Bölme ve Bölünebilme", "EBOB - EKOK", "Rasyonel Sayılar", "Üslü ve Köklü Sayılar", "Mutlak Değer ve Eşitsizlikler"],
  "Cebir": ["Çarpanlara Ayırma ve Özdeşlikler", "Oran - Orantı", "Denklem Çözme", "Denklem Sistemleri"],
  "Problemler": ["Sayı ve Kesir Problemleri", "Yaş Problemleri", "Yüzde, Kâr-Zarar ve Faiz Problemleri", "Karışım Problemleri", "İşçi - Havuz Problemleri", "Hareket Problemleri"],
  "Kümeler ve Sayma": ["Kümeler", "Permütasyon, Kombinasyon ve Olasılık"],
  "Veri ve Mantık": ["Tablo ve Grafik Yorumlama", "Sayısal Mantık"],
  "Geometri": ["Doğruda ve Üçgende Açılar", "Üçgenler (Alan ve Benzerlik)", "Dörtgenler ve Çokgenler", "Çember ve Daire", "Katı Cisimler", "Analitik Geometri"]
};

// ---------- TR-YÖS ----------
const sayisalYetenekYOS = {
  "Sayısal Akıl Yürütme": ["Sayı Dizileri ve Örüntüler", "Sayısal İşlem ve Sayı İlişkileri", "Sayısal Mantık Problemleri"],
  "Şekil ve Uzamsal Zeka": ["Şekil Dizileri ve Örüntüler", "Katlama - Açma", "Döndürme ve Yansıma", "Küp ve Katı Cisimler (Görsel)", "Şekil Tamamlama"],
  "Mantık ve Çıkarım": ["Sıralama ve Eleme Problemleri", "Doğru - Yanlış (Önerme) Problemleri", "Mantıksal Çıkarım"],
  "Veri Yorumlama": ["Tablo ve Grafik Yorumlama"]
};
const temelMatematikYOS = {
  "Sayılar": ["Sayı Kümeleri ve Basamak Kavramı", "Bölme ve Bölünebilme", "EBOB - EKOK", "Rasyonel Sayılar", "Üslü ve Köklü Sayılar", "Mutlak Değer"],
  "Cebir": ["Cebirsel İfadeler ve Özdeşlikler", "Denklemler", "Eşitsizlikler", "Oran - Orantı", "Fonksiyonlar", "Polinomlar"],
  "Problemler": ["Sayı ve Kesir Problemleri", "Yaş Problemleri", "Yüzde, Kâr-Zarar Problemleri", "Karışım Problemleri", "İşçi - Havuz Problemleri", "Hareket Problemleri"],
  "Geometri": ["Açılar ve Üçgenler", "Dörtgenler ve Çokgenler", "Çember ve Daire", "Alan ve Çevre", "Katı Cisimler", "Analitik Geometri"],
  "Veri ve Olasılık": ["Permütasyon ve Kombinasyon", "Olasılık", "Ortalama ve Yayılım Ölçüleri"]
};

const examData = {
  TYT: {
    name: "TYT (Temel Yeterlilik Testi)",
    subjects: {
      turkce: makeSubject("Türkçe", turkceDilBilgisi),
      sosyal: makeSubject("Sosyal Bilimler", { Tarih: flat(tarihTYT), "Coğrafya": flat(cografyaTYT), Felsefe: flat(felsefeTYT), "Din Kültürü": flat(dinTYT) }),
      matematik: makeSubject("Matematik", temelMatematik),
      fen: makeSubject("Fen Bilimleri", { Fizik: flat(fizikTYT), Kimya: flat(kimyaTYT), Biyoloji: flat(biyolojiTYT) })
    }
  },
  AYT: {
    name: "AYT (Alan Yeterlilik Testi)",
    subjects: {
      turkce: makeSubject("Türk Dili ve Edebiyatı", edebiyatAYT),
      matematik: makeSubject("Matematik", matematikAYT),
      fizik: makeSubject("Fizik", fizikAYT),
      kimya: makeSubject("Kimya", kimyaAYT),
      biyoloji: makeSubject("Biyoloji", biyolojiAYT),
      tarih: makeSubject("Tarih", tarihAYT),
      cografya: makeSubject("Coğrafya", cografyaAYT),
      felsefe: makeSubject("Felsefe Grubu (Felsefe, Psikoloji, Sosyoloji, Mantık)", felsefeGrubuAYT),
      din: makeSubject("Din Kültürü ve Ahlak Bilgisi", dinAYT),
      ingilizce: makeSubject("Yabancı Dil (İngilizce - YDT)", yabanciDilAYT)
    }
  },
  KPSS: {
    name: "KPSS (Kamu Personeli Seçme Sınavı)",
    subjects: {
      turkce: makeSubject("Türkçe", turkceKPSS),
      matematik: makeSubject("Matematik", matematikKPSS),
      tarih: makeSubject("Tarih", tarihKPSS),
      cografya: makeSubject("Coğrafya", cografyaKPSS),
      vatandaslik: makeSubject("Vatandaşlık", vatandaslikKPSS),
      guncel: makeSubject("Güncel Bilgiler", guncelKPSS)
    }
  },
  YÖS: {
    name: "TR-YÖS (Yabancı Uyruklu Öğrenci Sınavı)",
    subjects: {
      sayisal: makeSubject("Sayısal Yetenek", sayisalYetenekYOS),
      matematik: makeSubject("Temel Matematik", temelMatematikYOS)
    }
  },
  DGS: {
    name: "DGS (Dikey Geçiş Sınavı)",
    subjects: {
      turkce: makeSubject("Türkçe (Sözel)", turkceDGS),
      matematik: makeSubject("Matematik ve Geometri (Sayısal)", matematikDGS)
    }
  }
};

// Dropdown'lar için yardımcı fonksiyonlar
window.getExamTypes = function getExamTypes() {
  return Object.keys(examData).map(key => ({ code: key, name: examData[key].name }));
};

window.getSubjectsByExam = function getSubjectsByExam(examType) {
  if (!examData[examType]) return [];
  return Object.keys(examData[examType].subjects).map(key => ({ code: key, name: examData[examType].subjects[key].name }));
};

window.getTopicsByExamAndSubject = function getTopicsByExamAndSubject(examType, subject) {
  if (!examData[examType]?.subjects[subject]) return [];
  return examData[examType].subjects[subject].topics;
};

// <optgroup> için ünite bazlı liste: [{ unit, topics: ["Ünite - Konu", ...] }]
window.getTopicGroupsByExamAndSubject = function getTopicGroupsByExamAndSubject(examType, subject) {
  const entry = examData[examType]?.subjects[subject];
  if (!entry) return [];
  return Object.entries(entry.groups).map(([unit, items]) => ({ unit, topics: items.map(item => `${unit} - ${item}`) }));
};
})();