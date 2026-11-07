// Çalıştırma: node tests/worksheet.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const W = require('../src/Kocluk.Api/wwwroot/worksheet.js');

test('net: 5 şıkta 4 yanlış 1 doğruyu götürür', () => {
  assert.equal(W.computeNet(30, 8, 5), 28);
  assert.equal(W.computeNet(10, 1, 5), 9.75);
});
test('net: 4 şıkta 3 yanlış 1 doğruyu götürür', () => {
  assert.equal(W.computeNet(9, 3, 4), 8);
});
test('süre biçimi', () => {
  assert.equal(W.formatDuration(65), '01:05');
  assert.equal(W.formatDuration(3725), '1:02:05');
  assert.equal(W.formatDuration(-5), '00:00');
});
test('anahtar: sıralı harfler', () => {
  const r = W.parseKeyInput('abcde abcde', 10, 5);
  assert.equal(r.answers, 'ABCDEABCDE'); assert.equal(r.filled, 10);
});
test('anahtar: numaralı biçim, eksikler boş kalır', () => {
  const r = W.parseKeyInput('1-A 2.B 4) D 5:E', 6, 5);
  assert.equal(r.answers, 'AB-DE-'); assert.equal(r.filled, 4);
});
test('anahtar: aralık dışı şık hata verir', () => {
  const r = W.parseKeyInput('ABCDE', 5, 4);
  assert.equal(r.errors.length, 1); assert.equal(r.answers, 'ABCD-');
});
test('anahtar: fazla harf yok sayılır ve bildirilir', () => {
  const r = W.parseKeyInput('ABCABC', 4, 5);
  assert.equal(r.answers, 'ABCA'); assert.equal(r.extra, 2);
});
test('anahtar: tek numaralı eşleşme sıralı sayılmaz', () => {
  assert.equal(W.parseKeyInput('A', 3, 5).answers, 'A--');
});
test('cevap dizgesi', () => {
  assert.equal(W.answersToString({ 1: 'A', 3: 'C' }, 4), 'A-C-');
  assert.equal(W.answersToString({ 2: 'Z' }, 2), '--');
});
test('karşılaştırma durumları', () => {
  const rows = W.compareSheets('AB-C', 'ACB-', 4).map(r => r.status);
  assert.deepEqual(rows, ['correct', 'wrong', 'blank', 'void']);
  assert.deepEqual(W.compareSheets('A-', null, 2).map(r => r.status), ['answered', 'blank']);
});
test('soru istatistiği: her öğrencinin son gönderimi sayılır', () => {
  const subs = [
    { studentId: 's1', answers: 'AB' }, { studentId: 's1', answers: 'BB' }, // ilk (en yeni) olan sayılır
    { studentId: 's2', answers: 'A-' }
  ];
  const st = W.questionStats(subs, 'AB', 2);
  assert.equal(st[0].total, 2); assert.equal(st[0].percent, 100); assert.equal(st[1].percent, 50);
});

const sample = `
TYT Matematik Deneme
1. 2+2 işleminin sonucu kaçtır?
A) 3 B) 4 C) 5 D) 6 E) 7
2. Başkent neresidir?
A) Ankara
B) İzmir
C) Bursa
D) Adana
E) Van
3) f(x)=x+1 ise f(2) kaçtır?
A. 1
B. 2
C. 3
D. 4
CEVAP ANAHTARI
1-B 2-A 3-C
`;
test('metin ayıklama: soru, şık, aynı satırda şık', () => {
  const r = W.parseWorksheetText(sample.replace('CEVAP ANAHTARI\n1-B 2-A 3-C', ''));
  assert.equal(r.questions.length, 3);
  assert.equal(r.questions[0].stem, '2+2 işleminin sonucu kaçtır?');
  assert.deepEqual(r.questions[0].options.map(o => o.text), ['3', '4', '5', '6', '7']);
  assert.equal(r.questions[1].options[0].text, 'Ankara');
  assert.equal(r.questions[2].options.length, 4);
  assert.ok(r.questions[2].warnings.includes('Şık sayısı eksik görünüyor') === false);
});
test('metin ayıklama: uyarılar', () => {
  const r = W.parseWorksheetText('1. Sadece soru metni var burada\n2. Başka soru\nA) x\nB) y');
  assert.ok(r.questions[0].warnings.includes('Şıklar algılanamadı'));
  assert.ok(r.questions[1].warnings.includes('Şık sayısı eksik görünüyor'));
});
test('metin ayıklama: cevap anahtarı bölümü ayrılır (yeterli veri varsa)', () => {
  let text = '';
  for (let i = 1; i <= 8; i++) text += `${i}. Soru ${i} metni burada yazıyor\nA) a B) b C) c D) d\n`;
  text += 'CEVAP ANAHTARI\n1-A 2-B 3-C 4-D 5-A 6-B 7-C 8-D\n';
  const r = W.parseWorksheetText(text);
  assert.equal(r.questions.length, 8);
  assert.equal(r.answerKey, 'ABCDABCD');
  assert.ok(!r.questions[7].options[3].text.includes('CEVAP'));
});
test('metin ayıklama: anahtar bölümü az veriyle yok sayılır', () => {
  const r = W.splitAnswerKeySection('1. soru\nA) a\n'.repeat(5) + 'cevap anahtarı yok demek gerek 1-A');
  assert.equal(r.keyText, '');
});
test('metin ayıklama: sıra bozulursa yeni soru sayılmaz', () => {
  const r = W.parseWorksheetText('1. Soru bir\nA) a\nB) b\n7. yıl önce olmuş bir şey\n2. Soru iki\nA) a\nB) b');
  assert.equal(r.questions.length, 2);
  assert.ok(r.questions[0].options.length >= 2);
});
test('metin ayıklama: boş metin', () => {
  assert.equal(W.parseWorksheetText('').questions.length, 0);
});

test('test ayıklama: numara 1e dönünce yeni test başlar, sayfalar tutulur', () => {
  const r = W.detectTests([
    { page: 1, lines: ['İÇİNDEKİLER', 'Önsöz'] },
    { page: 2, lines: ['TEST 1', '1. Birinci soru', 'A) 1 B) 2', '2. İkinci soru', '3. Üçüncü soru'] },
    { page: 3, lines: ['4. Dördüncü', '7.D 8.B 9.E 10.B', '5. Beşinci'] },
    { page: 4, lines: ['TEST 2', '1. Yeni test', '2) ikinci', '3. üçüncü'] }
  ]);
  assert.equal(r.total, 8);
  assert.equal(r.firstPage, 2);
  assert.deepEqual(r.sections.map(s => [s.title, s.count, s.page]), [['Test 1', 5, 2], ['Test 2', 3, 4]]);
  assert.deepEqual(r.sections[0].pages, [2, 2, 2, 3, 3]);
});
test('test ayıklama: kaybolan tek soru doldurulur, ondalık sayı soru sayılmaz', () => {
  const r = W.detectTests([{ page: 1, lines: ['1. a', '2.5 kg un', '2. b', '4. d', '5. e'] }]);
  assert.equal(r.total, 5);
  assert.equal(r.sections.length, 1);
});
test('test ayıklama: soru içindeki kısa numaralı liste yeni test açmaz', () => {
  const r = W.detectTests([{ page: 1, lines: ['1. a', '2. b', '3. Aşağıdakilerden', '1. öncül', '2. öncül', '4. d', '5. e'] }]);
  assert.equal(r.sections.length, 1);
  assert.equal(r.total, 5);
});
test('test ayıklama: soru yoksa boş sonuç', () => {
  const r = W.detectTests([{ page: 1, lines: ['Kapak'] }]);
  assert.equal(r.total, 0); assert.equal(r.firstPage, null);
});
