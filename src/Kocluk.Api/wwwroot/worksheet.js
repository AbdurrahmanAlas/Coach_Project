/*
 * Koçluk · Çalışma kâğıdı (optik form) modülü
 *
 * Öğrenci: koçun gönderdiği PDF/görsel solda, optik form (A-E) sağda. Süre, otomatik taslak kaydı,
 *          gönderim onayı ve gönderince net/doğru/yanlış/boş sonucu.
 * Koç:     dosya + soru/şık sayısı + (isteğe bağlı) cevap anahtarı ile birden çok öğrenciye gönderim,
 *          gönderilenler listesi, öğrenci bazlı ve soru bazlı analiz, "yeniden aç".
 *          Ayrıca PDF'den soru/şıkları ayıklayıp koç onayıyla soru kartı olarak gönderme.
 *
 * Saf mantık (parseKeyInput, compareSheets, parseWorksheetText ...) DOM'dan bağımsızdır ve
 * tests/worksheet.test.js ile Node altında test edilir. Cevap anahtarı yalnızca sunucuda puanlanır;
 * bu dosyadaki karşılaştırma sadece gönderim sonrası gösterim içindir.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KoclukWorksheet = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const LETTERS = 'ABCDE';
  const MAX_QUESTIONS = 200; // sunucudaki ResourceWorksheet.MaxQuestions ile aynı
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

  /* ------------------------------------------------------------------ */
  /* Saf mantık                                                          */
  /* ------------------------------------------------------------------ */

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Net: doğru − yanlış / (şık sayısı − 1). Sunucudaki WorksheetGrader ile aynı formül (yalnızca gösterim). */
  function computeNet(correct, wrong, optionCount) {
    const divisor = Math.max(1, optionCount - 1);
    return Math.round((correct - wrong / divisor) * 100) / 100;
  }

  function formatNet(value) {
    if (value === null || value === undefined) return '—';
    return Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  /**
   * Cevap anahtarı/cevap metnini cevap dizgesine çevirir. Desteklenen biçimler:
   *   "ABCDEABCDE"            (sıralı)
   *   "1-A 2-B 3.C 4) D 5:E"  (numaralı; eksik sorular '-' kalır)
   * Dönüş: { answers, filled, extra, errors }.
   */
  function parseKeyInput(text, count, optionCount) {
    const last = LETTERS[Math.min(5, Math.max(2, optionCount)) - 1];
    const raw = String(text || '');
    const out = new Array(count).fill('-');
    const errors = [];
    let filled = 0, extra = 0;
    const place = (index, letter) => {
      if (letter > last) { errors.push(`Soru ${index + 1}: ${letter} şıkkı bu formda yok (en fazla ${last}).`); return; }
      if (out[index] === '-') filled++;
      out[index] = letter;
    };
    const numbered = [...raw.matchAll(/(\d{1,3})\s*[-.):=,]*\s*([A-Ea-e])(?![A-Za-z])/g)];
    if (numbered.length >= 2) {
      for (const m of numbered) {
        const no = parseInt(m[1], 10);
        if (no < 1 || no > count) continue;
        place(no - 1, m[2].toUpperCase());
      }
    } else {
      const letters = raw.toUpperCase().replace(/[^A-E-]/g, '');
      for (let i = 0; i < letters.length && i < count; i++) if (letters[i] !== '-') place(i, letters[i]);
      extra = Math.max(0, letters.length - count);
    }
    return { answers: out.join(''), filled, extra, errors };
  }

  /** {1:'A', 3:'C'} veya dizi → "A-C---" biçimi. */
  function answersToString(source, count) {
    let out = '';
    for (let i = 0; i < count; i++) {
      const value = Array.isArray(source) ? source[i] : source[i + 1];
      out += value && LETTERS.includes(value) ? value : '-';
    }
    return out;
  }

  /** Cevap dizgesi + (varsa) anahtar → soru bazlı durum listesi. */
  function compareSheets(answers, key, count) {
    const rows = [];
    for (let i = 0; i < count; i++) {
      const picked = answers && answers[i] && answers[i] !== '-' ? answers[i] : null;
      const correct = key && key[i] && key[i] !== '-' ? key[i] : null;
      let status;
      if (key && !correct) status = 'void';
      else if (!picked) status = 'blank';
      else if (!key) status = 'answered';
      else status = picked === correct ? 'correct' : 'wrong';
      rows.push({ no: i + 1, picked, correct, status });
    }
    return rows;
  }

  /** Her öğrencinin son gönderimine göre soru başına doğru yüzdesi. */
  function questionStats(submissions, key, count) {
    const latest = new Map();
    for (const s of submissions) if (s.answers && !latest.has(s.studentId)) latest.set(s.studentId, s);
    const stats = Array.from({ length: count }, (_, i) => ({ no: i + 1, correct: 0, wrong: 0, blank: 0, total: latest.size }));
    for (const s of latest.values()) {
      compareSheets(s.answers, key, count).forEach((row, i) => {
        if (row.status === 'correct') stats[i].correct++;
        else if (row.status === 'wrong') stats[i].wrong++;
        else if (row.status === 'blank') stats[i].blank++;
      });
    }
    return stats.map(x => ({ ...x, percent: x.total ? Math.round((x.correct / x.total) * 100) : 0 }));
  }

  /* ---------- PDF metninden soru/şık ayıklama ---------- */

  /** Metnin sonundaki "Cevap Anahtarı" bölümünü ayırır. Yalnızca metnin ikinci yarısında ve yeterince numaralı cevap varsa. */
  function splitAnswerKeySection(text) {
    const re = /(cevap|yanıt|yanit)\s*anahtar[ıi]?/gi;
    let match, found = null;
    while ((match = re.exec(text)) !== null) found = match;
    if (!found || found.index < text.length * 0.4) return { body: text, keyText: '' };
    const keyText = text.slice(found.index + found[0].length, found.index + found[0].length + 4000);
    const tokens = [...keyText.matchAll(/(\d{1,3})\s*[-.):=,]*\s*([A-Ea-e])(?![A-Za-z])/g)];
    if (tokens.length < 5) return { body: text, keyText: '' };
    return { body: text.slice(0, found.index), keyText };
  }

  /** "A) ... B) ... C) ..." biçimini sırayla (A→B→C...) bulur; sıra bozulursa durur. */
  function splitOptions(text) {
    const markerFrom = (letter, from) => {
      const re = new RegExp('(?:^|\\s)\\(?' + letter + '[.)]\\s*', 'g');
      re.lastIndex = from;
      const m = re.exec(text);
      return m ? { start: m.index, end: m.index + m[0].length } : null;
    };
    const markers = [];
    let from = 0;
    for (const letter of LETTERS) {
      const m = markerFrom(letter, from);
      if (!m) break;
      markers.push({ letter, ...m });
      from = m.end;
    }
    if (markers.length < 2) return { stem: text.trim(), options: [] };
    const options = markers.map((m, i) => ({
      letter: m.letter,
      text: text.slice(m.end, i + 1 < markers.length ? markers[i + 1].start : text.length).trim()
    }));
    return { stem: text.slice(0, markers[0].start).trim(), options };
  }

  function scanBlocks(lines, startNo) {
    const blocks = [];
    let current = null, expected = startNo;
    for (const line of lines) {
      const m = /^(\d{1,3})\s*[.)]\s*(.*)$/.exec(line);
      if (m && parseInt(m[1], 10) === expected) {
        current = { no: expected, parts: [m[2]] };
        blocks.push(current);
        expected++;
      } else if (current) {
        current.parts.push(line);
      }
    }
    return blocks;
  }

  /**
   * Düz metinden soru listesi çıkarır: { questions:[{no, stem, options:[{letter,text}], warnings}], optionCount, answerKey }.
   * Sonuç bir TASLAKTIR; koç göndermeden önce düzeltir. Taranmış/karışık sayfalarda hatalı olabilir.
   */
  function parseWorksheetText(text) {
    const { body, keyText } = splitAnswerKeySection(String(text || ''));
    const lines = body.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let blocks = scanBlocks(lines, 1);
    if (blocks.length < 2) {
      const first = lines.map(l => /^(\d{1,3})\s*[.)]\s*\S/.exec(l)).find(Boolean);
      if (first) blocks = scanBlocks(lines, parseInt(first[1], 10));
    }
    const questions = blocks.map(block => {
      const joined = block.parts.join(' ').replace(/\s+/g, ' ').trim();
      const { stem, options } = splitOptions(joined);
      const warnings = [];
      if (!stem || stem.length < 5) warnings.push('Soru metni kısa/boş');
      if (options.length === 0) warnings.push('Şıklar algılanamadı');
      else if (options.length < 4) warnings.push('Şık sayısı eksik görünüyor');
      if (options.some(o => !o.text)) warnings.push('Boş şık var');
      return { no: block.no, stem, options, warnings };
    });
    const maxOptions = questions.reduce((max, q) => Math.max(max, q.options.length), 0);
    const optionCount = Math.min(5, Math.max(4, maxOptions || 4));
    let answerKey = null;
    if (keyText && questions.length) {
      const parsed = parseKeyInput(keyText, questions.length, optionCount);
      if (parsed.filled >= Math.ceil(questions.length * 0.5)) answerKey = parsed.answers;
    }
    return { questions, optionCount, answerKey };
  }

  /* ---------- PDF'deki testleri ve soru numaralarını bulma ---------- */

  // "7.D 8.B 9.E" gibi sayfa altı cevap şeritleri soru sanılmasın (en az iki numara-harf çifti).
  const KEY_LINE = /^(?:\s*\d{1,3}\s*[.)\-]?\s*[A-Ea-e](?![A-Za-zÇĞİÖŞÜçğıöşü0-9])){2,}\s*$/;
  // "9. En küçüğü", "12." veya "3) ..." — "2.5" gibi ondalıklar hariç.
  const QUESTION_LINE = /^(\d{1,3})\s*[.)](?!\d)/;
  const TEST_TITLE = /\btest\s*[-–:]?\s*(\d{1,3})\b|\b(\d{1,3})\s*\.?\s*test\b/i;

  /**
   * Sayfa sayfa satırlardan testleri çıkarır. Numara 1'e döndüğünde yeni test başlar; sıra 1-2 numara
   * atlarsa (metin katmanında kaybolan soru) arası doldurulur. Soru metni içindeki "1. öncül" gibi kısa
   * listeler önceki test sürerse geri alınır.
   * pages: [{ page, lines: [string] }] → { sections: [{ title, count, page, pages:[sayfa/soru] }], total, firstPage }
   */
  function detectTests(pages, maxTotal) {
    const limit = maxTotal || MAX_QUESTIONS;
    const sections = [];
    let cur = null;
    const fits = (section, n) => section && n > section.last && n <= section.last + 2;
    const add = (section, n, page) => { for (let k = section.last + 1; k <= n; k++) section.pages.push(page); section.last = n; };
    for (const { page, lines } of pages || []) {
      const pageTitle = (lines || []).map(l => TEST_TITLE.exec(l)).find(Boolean);
      for (const raw of lines || []) {
        const line = String(raw || '').trim();
        if (!line || KEY_LINE.test(line)) continue;
        const m = QUESTION_LINE.exec(line);
        if (!m) continue;
        const n = parseInt(m[1], 10);
        // Önceki test sürüyorsa ve yeni "test" çok kısaysa, o kısa liste soru içi numaralandırma ya da
        // derleme sayfalarındaki kaynak numarasıdır (ör. siyah 3. yanında pembe 1.): yeni test sayılmaz.
        const prev = sections[sections.length - 2];
        if (cur && cur.last <= 4 && fits(prev, n)) { sections.pop(); cur = prev; add(cur, n, page); continue; }
        if (fits(cur, n)) { add(cur, n, page); continue; }
        if (n === 1 && (!cur || cur.last >= 2)) {
          cur = { last: 1, pages: [page], page, titleNo: pageTitle ? parseInt(pageTitle[1] || pageTitle[2], 10) : null };
          sections.push(cur);
        }
      }
    }
    const found = sections.filter(s => s.last >= 2);
    const titleNos = found.map(s => s.titleNo);
    const useTitles = titleNos.every(Boolean) && new Set(titleNos).size === titleNos.length;
    const result = [];
    let total = 0;
    for (const [i, s] of found.entries()) {
      const count = Math.min(s.last, limit - total);
      if (count < 1) break;
      result.push({ title: `Test ${useTitles ? s.titleNo : i + 1}`, count, page: s.page, pages: s.pages.slice(0, count) });
      total += count;
    }
    return { sections: result, total, firstPage: result.length ? result[0].page : null };
  }

  /* ------------------------------------------------------------------ */
  /* Yardımcılar (DOM / ağ)                                              */
  /* ------------------------------------------------------------------ */

  const isPdf = r => /pdf/i.test(String(r?.contentType || '')) || /\.pdf$/i.test(String(r?.fileName || ''));
  const isImage = r => /^image\//i.test(String(r?.contentType || '')) || /\.(png|jpe?g|webp)$/i.test(String(r?.fileName || ''));

  let pdfjsPromise = null;
  function loadPdfJs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS_URL).then(lib => { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return lib; });
      pdfjsPromise.catch(() => { pdfjsPromise = null; });
    }
    return pdfjsPromise;
  }

  async function readError(response) {
    try { const body = await response.json(); if (body && body.error) return body.error; } catch { /* yoksay */ }
    return `İşlem başarısız (${response.status}).`;
  }

  function storage(action, key, value) {
    try {
      if (action === 'get') return root.localStorage.getItem(key);
      if (action === 'set') root.localStorage.setItem(key, value);
      if (action === 'remove') root.localStorage.removeItem(key);
    } catch { /* gizli sekme vb. */ }
    return null;
  }

  function injectStyles() {
    if (root.document.getElementById('ws-styles')) return;
    const style = root.document.createElement('style');
    style.id = 'ws-styles';
    style.textContent = STYLES;
    root.document.head.appendChild(style);
  }

  function bubbleRow(no, optionCount, selected, extraClass, label, page) {
    const bubbles = Array.from({ length: optionCount }, (_, i) => {
      const letter = LETTERS[i];
      const on = selected === letter;
      return `<button type="button" class="ws-bubble${on ? ' on' : ''}" data-q="${no}" data-l="${letter}" aria-pressed="${on}" aria-label="Soru ${no}, ${letter} şıkkı">${letter}</button>`;
    }).join('');
    const number = page
      ? `<button type="button" class="ws-no ws-goto" data-goto="${page}" title="Soruyu PDF'de göster (sayfa ${page})">${label ?? no}</button>`
      : `<span class="ws-no">${label ?? no}</span>`;
    return `<div class="ws-row${extraClass ? ' ' + extraClass : ''}" data-row="${no}">${number}<div class="ws-opts">${bubbles}</div></div>`;
  }

  /**
   * Bir cevap kâğıdı bileşeni: tıklama olaylarını toplar. sections verilirse form testlere bölünür
   * (her testte numara 1'den başlar; cevaplar yine genel sıra numarasıyla tutulur). onGoto(sayfa) verilirse
   * soru numarasına tıklamak PDF'de o sayfaya gider.
   */
  function mountBubbleSheet(host, { count, optionCount, answers, onChange, sections, onGoto }) {
    if (sections && sections.length) {
      let no = 0;
      host.innerHTML = sections.map(section => {
        const rows = Array.from({ length: section.count }, (_, i) => {
          no++;
          return bubbleRow(no, optionCount, answers[no], '', i + 1, onGoto ? section.pages[i] || section.page : null);
        }).join('');
        const go = onGoto ? `<button type="button" class="ws-link" data-goto="${section.page}">Sayfa ${section.page} ↗</button>` : '';
        return `<div class="ws-sec"><div class="ws-sec-head"><strong>${esc(section.title)}</strong><small>${section.count} soru</small>${go}</div>${rows}</div>`;
      }).join('');
    } else {
      host.innerHTML = Array.from({ length: count }, (_, i) => bubbleRow(i + 1, optionCount, answers[i + 1])).join('');
    }
    // onclick ataması: aynı host yeniden çizildiğinde dinleyici birikmez.
    host.onclick = event => {
      const goto = event.target.closest('[data-goto]');
      if (goto && onGoto && host.contains(goto)) { onGoto(Number(goto.dataset.goto)); return; }
      const button = event.target.closest('.ws-bubble');
      if (!button || !host.contains(button)) return;
      const no = Number(button.dataset.q), letter = button.dataset.l;
      const next = answers[no] === letter ? null : letter;
      if (next) answers[no] = next; else delete answers[no];
      host.querySelectorAll(`.ws-bubble[data-q="${no}"]`).forEach(b => {
        const on = b.dataset.l === next;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      onChange(no, next);
    };
  }

  /* ------------------------------------------------------------------ */
  /* Doküman görüntüleyici (PDF / görsel / metin)                         */
  /* ------------------------------------------------------------------ */

  async function mountDocument(host, ctx, resource, base) {
    const scroll = host.querySelector('.ws-doc-scroll');
    const label = host.querySelector('[data-ws-zoom]');
    const pageLabel = host.querySelector('[data-ws-page]');
    const setMessage = html => { scroll.innerHTML = `<div class="ws-doc-msg">${html}</div>`; };
    const fileResponse = await ctx.authRequest(resource.downloadUrl);
    if (!fileResponse.ok) { setMessage('Dosya yüklenemedi. Sayfayı yenilemeyi dene.'); return; }

    if (isImage(resource)) {
      const url = URL.createObjectURL(await fileResponse.blob());
      scroll.innerHTML = `<img class="ws-doc-img" alt="Çalışma kâğıdı" src="${url}">`;
      host.querySelector('.ws-zoom')?.remove();
      return;
    }
    if (!isPdf(resource)) {
      const blob = await fileResponse.blob();
      const url = URL.createObjectURL(blob);
      const textResponse = await ctx.authRequest(`${base}/text`);
      const data = textResponse.ok ? await textResponse.json() : { supported: false };
      scroll.innerHTML = `<div class="ws-doc-msg"><p>Bu dosya türü sayfada doğrudan gösterilemiyor. ${data.supported ? 'Metni aşağıda.' : ''} Dosyayı indirip açabilir, cevaplarını sağdaki optik forma işaretleyebilirsin.</p><p><a class="ws-btn" href="${url}" download="${esc(resource.fileName || 'calisma')}">Dosyayı indir</a></p>${data.supported ? `<pre class="ws-doc-text">${esc(data.text)}</pre>` : ''}</div>`;
      host.querySelector('.ws-zoom')?.remove();
      return;
    }

    // Gövde yalnızca bir kez okunur; hem pdf.js hem de iframe yedeği aynı blob'u kullanır.
    const pdfBlob = await fileResponse.blob();
    let pdf;
    try {
      const lib = await loadPdfJs();
      pdf = await lib.getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) }).promise;
    } catch (error) {
      const url = URL.createObjectURL(pdfBlob);
      scroll.innerHTML = `<iframe class="ws-doc-frame" title="Çalışma kâğıdı" src="${url}"></iframe>`;
      host.querySelector('.ws-zoom')?.remove();
      return;
    }

    const first = await pdf.getPage(1);
    const baseWidth = first.getViewport({ scale: 1 }).width;
    let scale = Math.max(0.6, Math.min(2, ((scroll.clientWidth || 700) - 32) / baseWidth));
    let observer = null, generation = 0;
    pageLabel.textContent = `1 / ${pdf.numPages}`;

    const build = () => {
      generation++;
      const mine = generation;
      observer?.disconnect();
      scroll.innerHTML = '';
      label.textContent = Math.round(scale * 100) + '%';
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) renderPage(entry.target, mine);
        }
      }, { root: scroll, rootMargin: '900px 0px' });
      for (let n = 1; n <= pdf.numPages; n++) {
        const holder = root.document.createElement('div');
        holder.className = 'ws-page';
        holder.dataset.page = String(n);
        const ratio = first.getViewport({ scale: 1 }).height / baseWidth;
        holder.style.width = Math.round(baseWidth * scale) + 'px';
        holder.style.height = Math.round(baseWidth * scale * ratio) + 'px';
        scroll.appendChild(holder);
        observer.observe(holder);
      }
    };

    const renderPage = async (holder, mine) => {
      if (holder.dataset.done === String(mine)) return;
      holder.dataset.done = String(mine);
      try {
        const page = await pdf.getPage(Number(holder.dataset.page));
        if (mine !== generation) return;
        const dpr = Math.min(2, root.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale });
        const canvas = root.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);
        canvas.style.width = Math.ceil(viewport.width) + 'px';
        canvas.style.height = Math.ceil(viewport.height) + 'px';
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0] }).promise;
        if (mine !== generation) return;
        holder.style.width = canvas.style.width;
        holder.style.height = canvas.style.height;
        holder.replaceChildren(canvas);
      } catch { holder.dataset.done = ''; }
    };

    host.querySelector('[data-ws-zoom-in]').addEventListener('click', () => { scale = Math.min(3, scale + 0.2); build(); });
    host.querySelector('[data-ws-zoom-out]').addEventListener('click', () => { scale = Math.max(0.4, scale - 0.2); build(); });
    scroll.addEventListener('scroll', () => {
      const probe = scroll.scrollTop + scroll.clientHeight / 3;
      let current = 1;
      for (const holder of scroll.children) { if (holder.offsetTop <= probe) current = Number(holder.dataset.page); else break; }
      pageLabel.textContent = `${current} / ${pdf.numPages}`;
    }, { passive: true });
    build();
    const goToPage = n => {
      const holder = scroll.querySelector(`.ws-page[data-page="${n}"]`);
      if (!holder) return;
      const top = holder.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 8;
      scroll.scrollTo({ top, behavior: 'smooth' });
    };
    return { pdf, goToPage };
  }

  /* ------------------------------------------------------------------ */
  /* Öğrenci: çöz                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Çalışma ekranını açar. Kaynağın optik formu yoksa false döner (çağıran eski akışa devam eder).
   * ctx: { tenantId, resource:{id,subject,topic,fileName,contentType,downloadUrl}, authRequest, userKey?, onBack? }
   */
  async function openStudent(host, ctx) {
    injectStyles();
    const base = `/api/tenants/${ctx.tenantId}/resources/${ctx.resource.id}`;
    const response = await ctx.authRequest(`${base}/worksheet`);
    if (response.status === 404) return false;
    if (!response.ok) { host.innerHTML = `<div class="ws-root"><div class="ws-alert">${esc(await readError(response))}</div></div>`; return true; }
    const sheet = await response.json();
    if (sheet.assignmentStatus === 'Completed') {
      const mine = await ctx.authRequest(`${base}/my-submission`);
      if (mine.ok) { renderResult(host, ctx, sheet, await mine.json(), base); return true; }
    }
    renderSolve(host, ctx, sheet, base);
    return true;
  }

  function renderSolve(host, ctx, sheet, base) {
    const { resource } = ctx;
    // isDefault: koç form tanımlamamış; öğrenci soru sayısını kendisi ayarlar (ilk gönderimde kaydedilir).
    const adjustable = !!sheet.isDefault;
    let count = sheet.questionCount;
    const optionCount = sheet.optionCount;
    const draftKey = `kocluk:ws-draft:${ctx.tenantId}:${resource.id}:${ctx.userKey || ''}`;
    let answers = {}, elapsedBase = 0;
    try {
      const draft = JSON.parse(storage('get', draftKey) || 'null');
      if (draft && adjustable && draft.count >= 1 && draft.count <= MAX_QUESTIONS) count = draft.count;
      if (draft && draft.count === count) { answers = draft.answers || {}; elapsedBase = Number(draft.elapsed) || 0; }
    } catch { /* bozuk taslak */ }
    const startedAt = Date.now();
    const elapsed = () => elapsedBase + Math.floor((Date.now() - startedAt) / 1000);

    host.innerHTML = `
      <div class="ws-root ws-solve" data-pane="doc">
        <div class="ws-tabs" role="tablist">
          <button type="button" class="ws-tab on" data-pane-btn="doc">Soru kâğıdı</button>
          <button type="button" class="ws-tab" data-pane-btn="sheet">Optik form <span class="ws-pill" data-ws-mini>0/${count}</span></button>
        </div>
        <section class="ws-doc">
          <div class="ws-doc-bar">
            <div class="ws-doc-title"><strong>${esc(resource.subject || 'Çalışma')}</strong><span>${esc(resource.topic || '')}</span></div>
            <div class="ws-zoom"><button type="button" class="ws-icon" data-ws-zoom-out aria-label="Uzaklaştır">−</button><span data-ws-zoom>100%</span><button type="button" class="ws-icon" data-ws-zoom-in aria-label="Yakınlaştır">+</button></div>
            <span class="ws-pageno" data-ws-page></span>
          </div>
          <div class="ws-doc-scroll"><div class="ws-doc-msg">Dosya yükleniyor…</div></div>
        </section>
        <aside class="ws-sheet">
          <div class="ws-sheet-head">
            <div><strong>Optik form</strong><small data-ws-shape>${count} soru · ${optionCount} şık</small></div>
            <div class="ws-timer" data-ws-timer title="Geçen süre">00:00</div>
          </div>
          ${adjustable ? `<div class="ws-adjust"><span>Soru sayısı</span><button type="button" class="ws-icon" data-ws-less aria-label="Soru azalt">−</button><input type="number" min="1" max="${MAX_QUESTIONS}" value="${count}" data-ws-qcount aria-label="Soru sayısı"><button type="button" class="ws-icon" data-ws-more aria-label="Soru ekle">+</button></div>` : ''}
          <div class="ws-scan" data-ws-scan hidden></div>
          <div class="ws-progress"><div class="ws-progress-bar" data-ws-bar></div></div>
          <div class="ws-count" data-ws-count></div>
          <div class="ws-rows" data-ws-rows></div>
          <div class="ws-sheet-foot">
            <button type="button" class="ws-btn" data-ws-clear>Temizle</button>
            <button type="button" class="ws-btn ws-primary" data-ws-submit>Koça gönder</button>
          </div>
        </aside>
        <div class="ws-modal-host" data-ws-modal></div>
      </div>`;

    const rootEl = host.querySelector('.ws-solve');
    const $ = selector => rootEl.querySelector(selector);
    const countEl = $('[data-ws-count]'), barEl = $('[data-ws-bar]'), miniEl = $('[data-ws-mini]'), timerEl = $('[data-ws-timer]');
    const answered = () => Object.keys(answers).length;

    const save = () => storage('set', draftKey, JSON.stringify({ count, answers, elapsed: elapsed(), savedAt: Date.now() }));
    const refresh = () => {
      const n = answered();
      countEl.textContent = `${n} / ${count} işaretlendi · ${count - n} boş`;
      barEl.style.width = `${Math.round((n / count) * 100)}%`;
      miniEl.textContent = `${n}/${count}`;
    };
    // sections: PDF taramasından gelen test düzeni; docApi: PDF görüntüleyici (sayfaya gitme).
    let sections = null, docApi = null;
    const remount = () => mountBubbleSheet($('[data-ws-rows]'), {
      count, optionCount, answers, sections,
      onChange: () => { refresh(); save(); },
      onGoto: docApi?.goToPage ? page => { docApi.goToPage(page); rootEl.dataset.pane = 'doc'; rootEl.querySelectorAll('[data-pane-btn]').forEach(b => b.classList.toggle('on', b.dataset.paneBtn === 'doc')); } : null
    });
    const setShape = () => {
      $('[data-ws-shape]').textContent = sections ? `${sections.length} test · ${count} soru · ${optionCount} şık` : `${count} soru · ${optionCount} şık`;
      const input = $('[data-ws-qcount]'); if (input) input.value = String(count);
    };
    remount();
    refresh();

    if (adjustable) {
      const input = $('[data-ws-qcount]');
      const setCount = value => {
        const next = Math.max(1, Math.min(MAX_QUESTIONS, Math.round(Number(value)) || count));
        input.value = String(next);
        if (next === count) return;
        count = next;
        sections = null; // elle değiştirilen sayı otomatik test düzenini geçersiz kılar
        for (const key of Object.keys(answers)) if (Number(key) > count) delete answers[key];
        setShape(); remount(); refresh(); save();
      };
      $('[data-ws-less]').addEventListener('click', () => setCount(count - 1));
      $('[data-ws-more]').addEventListener('click', () => setCount(count + 1));
      input.addEventListener('change', () => setCount(input.value));
    }

    const tick = () => {
      if (!rootEl.isConnected) { clearInterval(timerId); return; }
      const seconds = elapsed();
      if (sheet.durationMinutes) {
        const remaining = sheet.durationMinutes * 60 - seconds;
        timerEl.textContent = remaining >= 0 ? formatDuration(remaining) : '+' + formatDuration(-remaining);
        timerEl.classList.toggle('warn', remaining <= 300 && remaining >= 0);
        timerEl.classList.toggle('over', remaining < 0);
        timerEl.title = remaining >= 0 ? 'Kalan süre' : 'Süre doldu';
      } else {
        timerEl.textContent = formatDuration(seconds);
      }
      if (seconds % 15 === 0) save();
    };
    const timerId = setInterval(tick, 1000);
    tick();

    rootEl.querySelectorAll('[data-pane-btn]').forEach(button => button.addEventListener('click', () => {
      rootEl.dataset.pane = button.dataset.paneBtn;
      rootEl.querySelectorAll('[data-pane-btn]').forEach(b => b.classList.toggle('on', b === button));
    }));

    $('[data-ws-clear]').addEventListener('click', () => {
      if (!answered()) return;
      openModal({
        title: 'İşaretleri temizle?', body: 'Tüm işaretlerin silinecek.', confirm: 'Temizle',
        onConfirm: () => { for (const key of Object.keys(answers)) delete answers[key]; remount(); refresh(); save(); }
      });
    });

    const openModal = ({ title, body, confirm, onConfirm, busy }) => {
      const modalHost = $('[data-ws-modal]');
      modalHost.innerHTML = `<div class="ws-modal-back"><div class="ws-modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${body}</p><div class="ws-modal-actions"><button type="button" class="ws-btn" data-m-cancel>Vazgeç</button><button type="button" class="ws-btn ws-primary" data-m-ok>${esc(confirm)}</button></div></div></div>`;
      const close = () => { modalHost.innerHTML = ''; };
      modalHost.querySelector('[data-m-cancel]').addEventListener('click', close);
      modalHost.querySelector('[data-m-ok]').addEventListener('click', async event => {
        event.target.disabled = true;
        const keep = await onConfirm(modalHost);
        if (!keep) close();
      });
      modalHost.querySelector('[data-m-ok]').focus();
    };

    $('[data-ws-submit]').addEventListener('click', () => {
      const n = answered(), blank = count - n;
      openModal({
        title: 'Çalışmayı koça gönder?',
        body: `${count} sorudan <strong>${n}</strong> tanesini işaretledin${blank ? `, <strong>${blank}</strong> soru boş` : ''}.<br>Gönderdikten sonra cevaplarını değiştiremezsin.`,
        confirm: 'Gönder',
        onConfirm: async modalHost => {
          const response = await ctx.authRequest(`${base}/submissions`, {
            method: 'POST',
            body: JSON.stringify({ answers: answersToString(answers, count), timeSpentSeconds: elapsed(), optionCount }),
            timeoutMs: 30000
          });
          if (!response.ok) {
            modalHost.querySelector('.ws-modal').insertAdjacentHTML('beforeend', `<div class="ws-alert">${esc(await readError(response))}</div>`);
            modalHost.querySelector('[data-m-ok]').disabled = false;
            return true;
          }
          storage('remove', draftKey);
          clearInterval(timerId);
          renderResult(host, ctx, sheet, await response.json(), base);
          return false;
        }
      });
    });

    const scanEl = $('[data-ws-scan]');
    const status = (text, tone) => { scanEl.hidden = !text; scanEl.textContent = text || ''; scanEl.className = 'ws-scan' + (tone ? ' ' + tone : ''); };
    const applyLayout = layout => {
      if (!layout || layout.total < 2) {
        status(adjustable ? 'Testler otomatik bulunamadı. Soru sayısını PDF\'e göre ayarlayabilirsin.' : '', 'warn');
        return;
      }
      if (adjustable && count !== layout.total) {
        if (answered() > 0) { status(`PDF'de ${layout.sections.length} test, ${layout.total} soru bulundu. İşaretlerin silinmesin diye form değiştirilmedi.`, 'warn'); return; }
        count = layout.total;
      }
      if (count !== layout.total) { status(''); return; } // koçun tanımladığı form PDF ile uyuşmuyor: düz liste kalır
      sections = layout.sections;
      setShape(); remount(); refresh(); save();
      status(`PDF'de ${layout.sections.length} test, ${layout.total} soru bulundu. Soru numarasına tıklayınca PDF o sayfaya gider.`, 'ok');
      const scroller = $('.ws-doc-scroll');
      if (layout.firstPage > 1 && scroller && scroller.scrollTop < 40) docApi?.goToPage(layout.firstPage);
    };

    mountDocument(rootEl.querySelector('.ws-doc'), ctx, resource, base).then(async api => {
      docApi = api || null;
      if (!docApi?.pdf || !rootEl.isConnected) return;
      remount();
      status('PDF taranıyor…');
      try {
        const layout = await scanPdfLayout(docApi.pdf, `kocluk:ws-layout:${ctx.tenantId}:${resource.id}`, text => rootEl.isConnected && status(text));
        if (rootEl.isConnected) applyLayout(layout);
      } catch { status(adjustable ? 'PDF taranamadı. Soru sayısını elle ayarlayabilirsin.' : '', 'warn'); }
    }).catch(() => {
      $('.ws-doc-scroll').innerHTML = '<div class="ws-doc-msg">Dosya açılamadı. Optik formu yine de doldurabilirsin.</div>';
    });
  }

  /* ------------------------------------------------------------------ */
  /* Öğrenci: sonuç                                                       */
  /* ------------------------------------------------------------------ */

  function renderResult(host, ctx, sheet, result, base) {
    const graded = !!result.graded;
    const rows = compareSheets(result.answers, result.answerKey, result.questionCount);
    const chip = (row, shownNo, prefix) => {
      const label = row.status === 'wrong' ? `${row.picked}→${row.correct}` : (row.picked || '—');
      const title = { correct: 'Doğru', wrong: `Yanlış (doğru cevap ${row.correct})`, blank: 'Boş', void: 'Puanlanmadı', answered: 'İşaretlendi' }[row.status];
      return `<div class="ws-chip ${row.status}" title="${esc(prefix || '')}Soru ${shownNo}: ${esc(title)}"><span>${shownNo}</span><b>${esc(label)}</b></div>`;
    };
    // Öğrenci ekranında PDF taranıp testler bulunduysa sonuç da testlere göre gruplanır.
    const layout = (() => { try { return JSON.parse(storage('get', `kocluk:ws-layout:${ctx.tenantId}:${ctx.resource.id}`) || 'null')?.layout; } catch { return null; } })();
    let chips;
    if (layout && layout.total === rows.length && layout.sections?.length > 1) {
      let offset = 0;
      chips = layout.sections.map(section => {
        const part = rows.slice(offset, offset + section.count);
        offset += section.count;
        return `<div class="ws-chip-group"><h4>${esc(section.title)}</h4><div class="ws-chips">${part.map((row, i) => chip(row, i + 1, section.title + ' · ')).join('')}</div></div>`;
      }).join('');
    } else {
      chips = `<div class="ws-chips">${rows.map(row => chip(row, row.no)).join('')}</div>`;
    }
    host.innerHTML = `
      <div class="ws-root ws-result">
        <div class="ws-result-head"><div><h2>${esc(ctx.resource.subject || 'Çalışma')} · ${esc(ctx.resource.topic || '')}</h2><p>${graded ? 'Sonucun hazır.' : 'Cevapların koçuna gönderildi. Koçun değerlendirince net burada görünecek.'}</p></div></div>
        ${graded ? `<div class="ws-cards">
          <div class="ws-card big"><small>Net</small><strong>${esc(formatNet(result.net))}</strong></div>
          <div class="ws-card ok"><small>Doğru</small><strong>${result.correct ?? 0}</strong></div>
          <div class="ws-card bad"><small>Yanlış</small><strong>${result.wrong ?? 0}</strong></div>
          <div class="ws-card"><small>Boş</small><strong>${result.blank ?? 0}</strong></div>
          <div class="ws-card"><small>Süre</small><strong>${esc(formatDuration(result.timeSpentSeconds))}</strong></div>
        </div>` : `<div class="ws-cards"><div class="ws-card"><small>İşaretlenen</small><strong>${count(result.answers)}</strong></div><div class="ws-card"><small>Boş</small><strong>${result.blank ?? 0}</strong></div><div class="ws-card"><small>Süre</small><strong>${esc(formatDuration(result.timeSpentSeconds))}</strong></div></div>`}
        <div class="ws-legend"><span class="ws-dot correct"></span>Doğru <span class="ws-dot wrong"></span>Yanlış <span class="ws-dot blank"></span>Boş</div>
        ${chips}
        <div class="ws-result-actions">
          ${graded ? '<button type="button" class="ws-btn" data-ws-wrong>Sadece yanlışlarım</button>' : ''}
          <button type="button" class="ws-btn ws-primary" data-ws-back>Ödevlerime dön</button>
        </div>
      </div>`;
    function count(answers) { return String(answers || '').replace(/-/g, '').length; }
    const rootEl = host.querySelector('.ws-result');
    rootEl.querySelector('[data-ws-wrong]')?.addEventListener('click', event => {
      const on = rootEl.classList.toggle('only-wrong');
      event.target.textContent = on ? 'Tüm soruları göster' : 'Sadece yanlışlarım';
    });
    rootEl.querySelector('[data-ws-back]').addEventListener('click', () => (ctx.onBack ? ctx.onBack() : (root.location.hash = '#question-bank')));
  }

  /* ------------------------------------------------------------------ */
  /* Koç paneli                                                           */
  /* ------------------------------------------------------------------ */

  /** Tek bir koç ekranını sekmesiz çizer: 'send' | 'cards' | 'results'. */
  function mountCoachView(parent, ctx, view) {
    injectStyles();
    const card = root.document.createElement('section');
    card.className = 'card section ws-root ws-coach';
    card.innerHTML = '<div class="ws-tabbody" data-body></div>';
    parent.appendChild(card);
    const body = card.querySelector('[data-body]');
    const state = { students: null };
    ({ send: renderSendTab, cards: renderCardsTab, results: renderResultsTab }[view] || renderSendTab)(body, ctx, state);
    return card;
  }

  function mountCoachPanel(parent, ctx) {
    injectStyles();
    const card = root.document.createElement('section');
    card.className = 'card section ws-root ws-coach';
    card.innerHTML = `
      <div class="ws-coach-head">
        <div><h2>Optik formlu çalışma</h2><p>PDF veya görseli yükle, öğrencilerine gönder. Öğrenci soruyu görerek optik forma işaretler, sonuç sana gelir.</p></div>
      </div>
      <div class="ws-subtabs" role="tablist">
        <button type="button" class="ws-subtab on" data-tab="send">Çalışma gönder</button>
        <button type="button" class="ws-subtab" data-tab="cards">PDF'den soru kartı</button>
        <button type="button" class="ws-subtab" data-tab="results">Gönderilenler ve sonuçlar</button>
      </div>
      <div class="ws-tabbody" data-body></div>`;
    parent.appendChild(card);
    const body = card.querySelector('[data-body]');
    const state = { students: null };
    const tabs = {
      send: () => renderSendTab(body, ctx, state),
      cards: () => renderCardsTab(body, ctx, state),
      results: () => renderResultsTab(body, ctx, state)
    };
    card.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
      card.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === button));
      tabs[button.dataset.tab]();
    }));
    tabs.send();
    return card;
  }

  async function loadStudents(ctx, state) {
    if (state.students) return state.students;
    const response = await ctx.authRequest(`/api/tenants/${ctx.tenantId}/students`);
    state.students = response.ok ? await response.json() : [];
    return state.students;
  }

  function studentPicker(students) {
    if (!students.length) return '<p class="ws-hint">Henüz öğrencin yok. Önce Öğrenciler sayfasından öğrenci ekle.</p>';
    return `<div class="ws-students"><label class="ws-check all"><input type="checkbox" data-all> Tümünü seç</label>${students.map(s => `<label class="ws-check"><input type="checkbox" value="${esc(s.id)}" data-student> ${esc(s.firstName)} ${esc(s.lastName)}</label>`).join('')}</div>`;
  }

  /* ---------- Sekme: çalışma gönder ---------- */

  async function renderSendTab(body, ctx, state) {
    body.innerHTML = '<p class="ws-hint">Yükleniyor…</p>';
    const students = await loadStudents(ctx, state);
    const key = { count: 40, options: 5, answers: {} };
    body.innerHTML = `
      <div class="ws-form">
        <div class="ws-col">
          <h3>1 · Öğrenciler</h3>${studentPicker(students)}
          <h3>2 · Dosya</h3>
          <div class="ws-grid2">
            <label>Ders<input data-f="subject" placeholder="Matematik" maxlength="100"></label>
            <label>Konu<input data-f="topic" placeholder="Fonksiyonlar - Deneme 1" maxlength="180"></label>
          </div>
          <label>Soru dosyası (PDF, görsel, Word)<input type="file" data-f="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"></label>
          <div class="ws-scan" data-scan hidden></div>
        </div>
        <div class="ws-col">
          <h3>3 · Optik form</h3>
          <div class="ws-grid3">
            <label>Soru sayısı<input type="number" data-f="count" min="1" max="200" value="40"></label>
            <label>Şık sayısı<select data-f="options"><option value="5">5 (A-E)</option><option value="4">4 (A-D)</option></select></label>
            <label>Süre (dk, isteğe bağlı)<input type="number" data-f="duration" min="1" max="600" placeholder="örn. 40"></label>
          </div>
          <label>Son teslim tarihi (isteğe bağlı)<input type="date" data-f="due"></label>
          <details class="ws-keybox">
            <summary>Cevap anahtarı gir (isteğe bağlı: otomatik puanlama)</summary>
            <p class="ws-hint">Anahtarı girersen öğrencinin neti anında hesaplanır, soru bazlı analiz görürsün. Anahtar öğrenciye çalışmayı gönderene kadar gösterilmez. Sonradan da ekleyebilirsin.</p>
            <textarea data-f="keytext" rows="2" placeholder="ABCDEABCDE… veya 1-A 2-C 3-B …"></textarea>
            <div class="ws-keystat" data-keystat></div>
            <div class="ws-keygrid" data-keygrid></div>
          </details>
        </div>
      </div>
      <div class="ws-send-foot"><button type="button" class="ws-btn ws-primary" data-send>Öğrencilere gönder</button><span class="ws-status" data-status></span></div>`;
    const $ = s => body.querySelector(s);
    const field = name => body.querySelector(`[data-f="${name}"]`);
    const status = (text, kind) => { const el = $('[data-status]'); el.textContent = text; el.className = 'ws-status ' + (kind || ''); };

    body.querySelector('[data-all]')?.addEventListener('change', e => body.querySelectorAll('[data-student]').forEach(c => { c.checked = e.target.checked; }));

    const renderGrid = () => {
      key.count = Math.max(1, Math.min(200, parseInt(field('count').value, 10) || 1));
      key.options = parseInt(field('options').value, 10);
      for (const no of Object.keys(key.answers)) if (Number(no) > key.count || LETTERS.indexOf(key.answers[no]) >= key.options) delete key.answers[no];
      const useSections = layout && layout.total === key.count ? layout.sections : null;
      mountBubbleSheet($('[data-keygrid]'), { count: key.count, optionCount: key.options, answers: key.answers, onChange: stat, sections: useSections });
      Object.entries(key.answers).forEach(([no, letter]) => $(`[data-keygrid] .ws-bubble[data-q="${no}"][data-l="${letter}"]`)?.classList.add('on'));
      stat();
    };
    const stat = () => { $('[data-keystat]').textContent = `Anahtar: ${Object.keys(key.answers).length} / ${key.count} soru girildi`; };
    let gridHost = $('[data-keygrid]');
    // mountBubbleSheet her çağrıda yeni dinleyici eklediği için ızgarayı yeniden yaratırız.
    const resetGrid = () => { const fresh = gridHost.cloneNode(false); gridHost.replaceWith(fresh); gridHost = fresh; renderGrid(); };
    field('count').addEventListener('change', resetGrid);
    field('options').addEventListener('change', resetGrid);

    // Dosya seçilince PDF taranır: testler ve soru sayısı bulunur, optik form ve anahtar ızgarası buna göre
    // hazırlanır. Öğrenci ekranı aynı PDF'yi aynı yöntemle taradığı için aynı test düzenini görür.
    let layout = null, scanRun = 0;
    const scanEl = $('[data-scan]');
    const scanStatus = (text, tone) => { scanEl.hidden = !text; scanEl.textContent = text || ''; scanEl.className = 'ws-scan' + (tone ? ' ' + tone : ''); };
    field('file').addEventListener('change', async () => {
      const file = field('file').files[0];
      const run = ++scanRun;
      layout = null;
      if (!file) { scanStatus(''); return; }
      if (!field('topic').value.trim()) field('topic').value = file.name.replace(/\.[^.]+$/, '').slice(0, 180);
      if (!/\.pdf$/i.test(file.name) && !/pdf/i.test(file.type)) { scanStatus('PDF olmayan dosyada soru sayısını elle gir.', 'warn'); return; }
      scanStatus('PDF taranıyor…');
      try {
        const lib = await loadPdfJs();
        const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const found = await scanPdfLayout(pdf, null, text => run === scanRun && scanStatus(text));
        if (run !== scanRun) return;
        if (found.total < 2) { scanStatus('Sorular otomatik bulunamadı. Soru sayısını elle gir.', 'warn'); return; }
        layout = found;
        field('count').value = String(found.total);
        resetGrid();
        const parts = found.sections.map(s => `${s.title}: ${s.count}`).join(' · ');
        scanStatus(`${found.sections.length} test, ${found.total} soru bulundu (${parts}). Sorular ${found.firstPage}. sayfadan başlıyor; öğrenci PDF'yi oradan açacak.`, 'ok');
      } catch {
        if (run === scanRun) scanStatus('PDF taranamadı. Soru sayısını elle gir.', 'warn');
      }
    });
    field('keytext').addEventListener('input', () => {
      const parsed = parseKeyInput(field('keytext').value, key.count, key.options);
      key.answers = {};
      [...parsed.answers].forEach((letter, i) => { if (letter !== '-') key.answers[i + 1] = letter; });
      resetGrid();
      if (parsed.errors.length) $('[data-keystat]').textContent += ' · ' + parsed.errors[0];
      else if (parsed.extra) $('[data-keystat]').textContent += ` · ${parsed.extra} fazla harf yok sayıldı`;
    });
    resetGrid();

    $('[data-send]').addEventListener('click', async () => {
      const subject = field('subject').value.trim(), topic = field('topic').value.trim(), file = field('file').files[0];
      const studentIds = [...body.querySelectorAll('[data-student]:checked')].map(c => c.value);
      if (!studentIds.length) return status('En az bir öğrenci seç.', 'err');
      if (!subject || !topic) return status('Ders ve konu zorunlu.', 'err');
      if (!file) return status('Bir dosya seç.', 'err');
      const filled = Object.keys(key.answers).length;
      if (filled > 0 && filled < key.count && !root.confirm(`Cevap anahtarında ${key.count - filled} soru boş. Boş sorular puanlanmaz. Devam edilsin mi?`)) return;
      const button = $('[data-send]');
      button.disabled = true;
      try {
        status('Dosya yükleniyor…');
        const form = new FormData();
        form.append('subject', subject); form.append('topic', topic); form.append('file', file);
        const upload = await fetch(`/api/tenants/${ctx.tenantId}/resources`, { method: 'POST', body: form, credentials: 'include' });
        if (!upload.ok) return status(await readError(upload), 'err');
        const resource = await upload.json();
        status('Optik form hazırlanıyor…');
        const put = await ctx.authRequest(`/api/tenants/${ctx.tenantId}/resources/${resource.id}/worksheet`, {
          method: 'PUT',
          body: JSON.stringify({ questionCount: key.count, optionCount: key.options, answerKey: filled ? answersToString(key.answers, key.count) : null, durationMinutes: parseInt(field('duration').value, 10) || null })
        });
        if (!put.ok) return status(await readError(put), 'err');
        const dueValue = field('due').value;
        const dueDateUtc = dueValue ? new Date(dueValue + 'T23:59:00').toISOString() : null;
        let sent = 0;
        for (const studentId of studentIds) {
          const assigned = await ctx.authRequest(`/api/tenants/${ctx.tenantId}/resource-assignments`, {
            method: 'POST', body: JSON.stringify({ resourceId: resource.id, studentId, dueDateUtc, note: 'Teslim şekli: platformda çöz (optik form).' })
          });
          if (assigned.ok) sent++;
        }
        status(sent === studentIds.length ? `${sent} öğrenciye gönderildi ✓` : `${sent}/${studentIds.length} öğrenciye gönderildi. Kalanlar için tekrar dene.`, sent ? 'ok' : 'err');
        if (sent) { field('file').value = ''; }
      } catch (error) {
        status('Gönderilemedi. Bağlantını kontrol edip tekrar dene.', 'err');
      } finally { button.disabled = false; }
    });
  }

  /* ---------- Sekme: sonuçlar ---------- */

  async function renderResultsTab(body, ctx) {
    body.innerHTML = '<p class="ws-hint">Yükleniyor…</p>';
    const response = await ctx.authRequest(`/api/tenants/${ctx.tenantId}/worksheets/overview`);
    if (!response.ok) { body.innerHTML = `<div class="ws-alert">${esc(await readError(response))}</div>`; return; }
    const list = await response.json();
    if (!list.length) { body.innerHTML = '<p class="ws-hint">Henüz optik formlu çalışma göndermedin. "Çalışma gönder" sekmesinden başlayabilirsin.</p>'; return; }
    body.innerHTML = list.map(item => {
      const submitted = item.students.filter(s => s.attempts > 0).length;
      const rows = item.students.map(s => {
        const last = s.last;
        const stateTag = s.attempts > 0 && s.status === 'Completed' ? '<span class="ws-tag ok">Teslim etti</span>' : s.attempts > 0 ? '<span class="ws-tag warn">Yeniden açıldı</span>' : s.openedAtUtc ? '<span class="ws-tag">Açtı</span>' : '<span class="ws-tag muted">Açmadı</span>';
        return `<tr data-student="${esc(s.studentId)}"><td>${esc(s.firstName)} ${esc(s.lastName)}</td><td>${stateTag}</td>
          <td>${last ? (item.hasKey ? `<strong>${esc(formatNet(last.net))}</strong> net` : '—') : '—'}</td>
          <td>${last && item.hasKey ? `${last.correct} D · ${last.wrong} Y · ${last.blank} B` : last ? `${last.blank} boş` : ''}</td>
          <td>${last ? esc(formatDuration(last.timeSpentSeconds)) : ''}</td>
          <td class="ws-actions">${last ? '<button type="button" class="ws-link" data-detail>Detay</button>' : ''}${s.attempts > 0 && s.status === 'Completed' ? '<button type="button" class="ws-link" data-reopen>Yeniden aç</button>' : ''}</td></tr>`;
      }).join('');
      return `<article class="ws-ws" data-resource="${esc(item.resourceId)}" data-count="${item.questionCount}" data-options="${item.optionCount}">
        <header><div><strong>${esc(item.subject)} · ${esc(item.topic)}</strong><small>${esc(item.fileName)} · ${item.questionCount} soru · ${item.optionCount} şık · ${item.hasKey ? 'anahtar var' : '<em>anahtar yok</em>'}${item.durationMinutes ? ` · ${item.durationMinutes} dk` : ''}</small></div>
        <div class="ws-head-actions"><span class="ws-tag">${submitted}/${item.students.length} teslim</span><button type="button" class="ws-link" data-analysis>Soru analizi</button><button type="button" class="ws-link" data-key>${item.hasKey ? 'Anahtarı düzenle' : 'Anahtar ekle'}</button></div></header>
        <div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Öğrenci</th><th>Durum</th><th>Net</th><th>Sonuç</th><th>Süre</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="ws-hint">Öğrenci atanmamış.</td></tr>'}</tbody></table></div>
        <div class="ws-detail" data-detail-box></div></article>`;
    }).join('');

    body.onclick = async event => {
      const article = event.target.closest('.ws-ws');
      if (!article) return;
      const resourceId = article.dataset.resource, count = Number(article.dataset.count), optionCount = Number(article.dataset.options);
      const box = article.querySelector('[data-detail-box]');
      const base = `/api/tenants/${ctx.tenantId}/resources/${resourceId}`;
      const loadAll = async () => {
        const [s, w] = await Promise.all([ctx.authRequest(`${base}/submissions`), ctx.authRequest(`${base}/worksheet`)]);
        return { submissions: s.ok ? await s.json() : [], sheet: w.ok ? await w.json() : null };
      };
      if (event.target.matches('[data-reopen]')) {
        const row = event.target.closest('tr');
        if (!root.confirm('Öğrenci çalışmayı yeniden çözebilsin mi? Önceki sonuç geçmişte kalır.')) return;
        const r = await ctx.authRequest(`${base}/students/${row.dataset.student}/reopen`, { method: 'POST' });
        if (r.ok) renderResultsTab(body, ctx); else box.innerHTML = `<div class="ws-alert">${esc(await readError(r))}</div>`;
      } else if (event.target.matches('[data-detail]')) {
        const row = event.target.closest('tr');
        const { submissions, sheet } = await loadAll();
        const mine = submissions.filter(x => x.studentId === row.dataset.student && x.answers);
        if (!mine.length) { box.innerHTML = '<p class="ws-hint">Gönderim bulunamadı.</p>'; return; }
        const latest = mine[0];
        const rows = compareSheets(latest.answers, sheet?.answerKey || null, count);
        box.innerHTML = `<h4>${esc(latest.firstName)} ${esc(latest.lastName)} · ${new Date(latest.submittedAtUtc).toLocaleString('tr-TR')}${mine.length > 1 ? ` · ${mine.length}. deneme` : ''}</h4>
          <div class="ws-chips">${rows.map(r => `<div class="ws-chip ${r.status}" title="Soru ${r.no}"><span>${r.no}</span><b>${esc(r.status === 'wrong' ? r.picked + '→' + r.correct : (r.picked || '—'))}</b></div>`).join('')}</div>
          ${mine.length > 1 ? `<p class="ws-hint">Önceki denemeler: ${mine.slice(1).map(m => `${new Date(m.submittedAtUtc).toLocaleDateString('tr-TR')} (${m.net == null ? '—' : formatNet(m.net)} net)`).join(', ')}</p>` : ''}`;
      } else if (event.target.matches('[data-analysis]')) {
        const { submissions, sheet } = await loadAll();
        if (!sheet?.hasKey) { box.innerHTML = '<p class="ws-hint">Soru analizi için önce cevap anahtarı ekle.</p>'; return; }
        const stats = questionStats(submissions, sheet.answerKey, count);
        if (!stats[0]?.total) { box.innerHTML = '<p class="ws-hint">Henüz teslim eden öğrenci yok.</p>'; return; }
        box.innerHTML = `<h4>Soru bazlı analiz (${stats[0].total} öğrenci)</h4><div class="ws-bars">${stats.map(x => `<div class="ws-bar" title="Soru ${x.no}: %${x.percent} doğru"><div class="ws-bar-fill ${x.percent < 40 ? 'low' : x.percent < 70 ? 'mid' : 'high'}" style="height:${Math.max(4, x.percent)}%"></div><span>${x.no}</span></div>`).join('')}</div><p class="ws-hint">Çubuk yüksekliği o soruyu doğru yapan öğrenci yüzdesidir. Kırmızı çubuklar tekrar edilmesi gereken sorulardır.</p>`;
      } else if (event.target.matches('[data-key]')) {
        const { sheet } = await loadAll();
        box.innerHTML = `<h4>Cevap anahtarı</h4><textarea rows="2" data-keyedit placeholder="ABCDEABCDE… veya 1-A 2-C …">${esc(sheet?.answerKey && sheet.answerKey.replace(/-/g, '') ? sheet.answerKey : '')}</textarea><div class="ws-keystat" data-keyinfo></div><div class="ws-send-foot"><button type="button" class="ws-btn ws-primary" data-keysave>Kaydet ve yeniden puanla</button><span class="ws-status" data-keystatus></span></div>`;
        const area = box.querySelector('[data-keyedit]');
        const info = box.querySelector('[data-keyinfo]');
        const update = () => { const p = parseKeyInput(area.value, count, optionCount); info.textContent = `${p.filled} / ${count} soru girildi${p.errors[0] ? ' · ' + p.errors[0] : ''}`; return p; };
        area.addEventListener('input', update); update();
        box.querySelector('[data-keysave]').addEventListener('click', async () => {
          const p = update();
          const st = box.querySelector('[data-keystatus]');
          const r = await ctx.authRequest(`${base}/worksheet`, { method: 'PUT', body: JSON.stringify({ questionCount: count, optionCount, answerKey: p.filled ? p.answers : null, durationMinutes: sheet?.durationMinutes ?? null }) });
          if (r.ok) { st.textContent = 'Kaydedildi ✓ Sonuçlar yeniden hesaplandı.'; st.className = 'ws-status ok'; setTimeout(() => renderResultsTab(body, ctx), 900); }
          else { st.textContent = await readError(r); st.className = 'ws-status err'; }
        });
      }
    };
  }

  /* ---------- Sekme: PDF'den soru kartı ---------- */

  /** pdf.js metin katmanından satır satır metin üretir; iki sütunlu sayfalarda önce sol sonra sağ sütunu okur. */
  async function extractPdfText(pdf, maxPages, onProgress) {
    let text = '';
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      onProgress?.(`Sayfa ${n}/${Math.min(pdf.numPages, maxPages)} okunuyor…`);
      text += '\n' + (await pdfPageLines(await pdf.getPage(n))).join('\n');
    }
    return text;
  }

  /** Bir PDF sayfasının metin satırları (iki sütunlu sayfada önce sol, sonra sağ sütun). */
  async function pdfPageLines(page) {
    const width = page.getViewport({ scale: 1 }).width;
    const items = (await page.getTextContent()).items
      .map(i => ({ str: String(i.str || '').trim(), x: i.transform[4], y: i.transform[5] }))
      .filter(i => i.str);
    const left = items.filter(i => i.x < width * 0.5), right = items.filter(i => i.x >= width * 0.5);
    const twoColumns = items.length > 20 && left.length >= items.length * 0.3 && right.length >= items.length * 0.3;
    const toLines = group => {
      const rows = [];
      for (const item of group) {
        let row = rows.find(r => Math.abs(r.y - item.y) < 3);
        if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
        row.items.push(item);
      }
      rows.sort((a, b) => b.y - a.y);
      return rows.map(r => r.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' '));
    };
    return twoColumns ? [...toLines(left), ...toLines(right)] : toLines(items);
  }

  /**
   * Öğrenci ekranı için PDF'nin test/soru düzenini çıkarır. Önce metin katmanı; yeterli soru yoksa ve
   * Tesseract yüklüyse OCR. Sonuç kaynağa göre önbelleğe alınır, aynı PDF ikinci kez taranmaz.
   */
  async function scanPdfLayout(pdf, cacheKey, onProgress) {
    const cached = cacheKey ? (() => { try { return JSON.parse(storage('get', cacheKey) || 'null'); } catch { return null; } })() : null;
    if (cached && cached.v === 1) return cached.layout;
    const maxPages = Math.min(pdf.numPages, 80);
    const pages = [];
    for (let n = 1; n <= maxPages; n++) {
      onProgress?.(`PDF taranıyor… ${n}/${maxPages}`);
      pages.push({ page: n, lines: await pdfPageLines(await pdf.getPage(n)) });
    }
    let layout = detectTests(pages);
    if (layout.total < 3 && root.Tesseract) {
      const ocrPages = [];
      const worker = await root.Tesseract.createWorker('tur', 1);
      try {
        for (let n = 1; n <= Math.min(maxPages, 40); n++) {
          onProgress?.(`Taranmış sayfa okunuyor… ${n}/${Math.min(maxPages, 40)}`);
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = root.document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          // Soru kitapları çoğunlukla iki sütunlu: tüm sayfayı tek seferde okutmak sütunları karıştırıyor.
          // Sol ve sağ yarı ayrı okunur; soru numaraları her sütunun satır başında olduğu için yeterli.
          const lines = [];
          for (const half of [0, 1]) {
            const part = root.document.createElement('canvas');
            part.width = Math.ceil(canvas.width / 2); part.height = canvas.height;
            part.getContext('2d').drawImage(canvas, -half * Math.floor(canvas.width / 2), 0);
            lines.push(...((await worker.recognize(part))?.data?.text || '').split('\n'));
          }
          ocrPages.push({ page: n, lines });
        }
      } finally { await worker.terminate(); }
      const ocrLayout = detectTests(ocrPages);
      if (ocrLayout.total > layout.total) layout = ocrLayout;
    }
    if (cacheKey && (layout.total > 0 || root.Tesseract)) storage('set', cacheKey, JSON.stringify({ v: 1, layout }));
    return layout;
  }

  async function ocrPdf(pdf, maxPages, onProgress) {
    if (!root.Tesseract) return '';
    const worker = await root.Tesseract.createWorker('tur', 1);
    let text = '';
    try {
      for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
        onProgress?.(`Taranmış sayfa ${n}/${Math.min(pdf.numPages, maxPages)} okunuyor (OCR)…`);
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 1.7 });
        const canvas = root.document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        text += '\n' + ((await worker.recognize(canvas))?.data?.text || '');
      }
    } finally { await worker.terminate(); }
    return text;
  }

  async function renderCardsTab(body, ctx, state) {
    body.innerHTML = '<p class="ws-hint">Yükleniyor…</p>';
    const students = await loadStudents(ctx, state);
    body.innerHTML = `
      <p class="ws-hint">Metin katmanlı bir PDF seç; sorular ve şıklar ayıklanır. <strong>Gönderilmeden önce sen kontrol edip düzeltirsin</strong> (taranmış veya karışık sayfalarda ayıklama hata yapabilir). Öğrenci soruları tek tek kart olarak çözer.</p>
      <div class="ws-form">
        <div class="ws-col"><h3>1 · Öğrenciler</h3>${studentPicker(students)}</div>
        <div class="ws-col"><h3>2 · PDF</h3>
          <div class="ws-grid2"><label>Ders<input data-c="subject" maxlength="100"></label><label>Konu<input data-c="topic" maxlength="180"></label></div>
          <div class="ws-grid2"><label>Zorluk<select data-c="difficulty"><option>Kolay</option><option selected>Orta</option><option>Zor</option></select></label><label>Sınav türü<input data-c="exam" value="TYT" maxlength="40"></label></div>
          <label>PDF dosyası<input type="file" data-c="file" accept=".pdf"></label>
          <button type="button" class="ws-btn" data-extract>Soruları ayıkla</button> <span class="ws-status" data-cstatus></span>
        </div>
      </div>
      <div data-review></div>`;
    body.querySelector('[data-all]')?.addEventListener('change', e => body.querySelectorAll('[data-student]').forEach(c => { c.checked = e.target.checked; }));
    const c = name => body.querySelector(`[data-c="${name}"]`);
    const status = (text, kind) => { const el = body.querySelector('[data-cstatus]'); el.textContent = text; el.className = 'ws-status ' + (kind || ''); };
    const review = body.querySelector('[data-review]');
    let draft = null;

    body.querySelector('[data-extract]').addEventListener('click', async () => {
      const file = c('file').files[0];
      if (!file) return status('Bir PDF seç.', 'err');
      try {
        status('PDF açılıyor…');
        const lib = await loadPdfJs();
        const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        let text = await extractPdfText(pdf, 60, status);
        if (text.replace(/\s+/g, '').length < 120) {
          status('Metin katmanı yok, OCR deneniyor (yavaş olabilir)…');
          text = await ocrPdf(pdf, 30, status);
        }
        draft = parseWorksheetText(text);
        if (!draft.questions.length) { review.innerHTML = ''; return status('Soru bulunamadı. PDF numaralı sorular ("1.", "2)") içermiyor olabilir. Bunun yerine "Çalışma gönder" sekmesindeki optik formu kullan.', 'err'); }
        status(`${draft.questions.length} soru bulundu. Kontrol edip gönder.`, 'ok');
        renderReview();
      } catch (error) {
        status('PDF okunamadı. Dosya bozuk veya bağlantı sorunu olabilir.', 'err');
      }
    });

    const renderReview = () => {
      const keyArr = draft.answerKey ? [...draft.answerKey] : [];
      review.innerHTML = `
        <div class="ws-review-bar"><strong>${draft.questions.length} soru</strong>
          <label>Cevap anahtarını yapıştır <input data-keypaste placeholder="ABCDE… veya 1-A 2-C …"></label>
          <span class="ws-hint">Her soruda doğru şık zorunludur.</span></div>
        <div class="ws-qlist">${draft.questions.map((q, i) => `
          <div class="ws-q${q.warnings.length ? ' warn' : ''}" data-i="${i}">
            <div class="ws-q-head"><strong>Soru ${q.no}</strong>${q.warnings.map(w => `<span class="ws-tag warn">${esc(w)}</span>`).join('')}<button type="button" class="ws-link danger" data-del>Sil</button></div>
            <textarea rows="3" data-stem>${esc(q.stem)}</textarea>
            <div class="ws-opts-edit">${LETTERS.slice(0, draft.optionCount).split('').map((letter, k) => `
              <label class="ws-optline"><input type="radio" name="ok-${i}" value="${letter}" ${keyArr[i] === letter ? 'checked' : ''} aria-label="Doğru şık ${letter}"><b>${letter}</b><input data-opt="${k}" value="${esc(q.options[k]?.text || '')}"></label>`).join('')}</div>
          </div>`).join('')}</div>
        <div class="ws-send-foot"><button type="button" class="ws-btn ws-primary" data-publish>Öğrencilere soru kartı olarak gönder</button><span class="ws-status" data-pstatus></span></div>`;
      review.querySelector('[data-keypaste]').addEventListener('input', e => {
        const parsed = parseKeyInput(e.target.value, draft.questions.length, draft.optionCount);
        [...parsed.answers].forEach((letter, i) => {
          if (letter === '-') return;
          const radio = review.querySelector(`input[name="ok-${i}"][value="${letter}"]`);
          if (radio) radio.checked = true;
        });
      });
      review.addEventListener('click', e => {
        if (!e.target.matches('[data-del]')) return;
        const i = Number(e.target.closest('.ws-q').dataset.i);
        syncDraft();
        draft.questions.splice(i, 1);
        if (draft.answerKey) draft.answerKey = draft.answerKey.slice(0, i) + draft.answerKey.slice(i + 1);
        renderReview();
      });
      review.querySelector('[data-publish]').addEventListener('click', publish);
    };

    // Ekrandaki düzenlemeleri taslağa yazar.
    const syncDraft = () => {
      const keyChars = [];
      review.querySelectorAll('.ws-q').forEach((el, i) => {
        const q = draft.questions[i];
        q.stem = el.querySelector('[data-stem]').value.trim();
        q.options = [...el.querySelectorAll('[data-opt]')].map((input, k) => ({ letter: LETTERS[k], text: input.value.trim() }));
        keyChars[i] = el.querySelector('input[type="radio"]:checked')?.value || '-';
      });
      draft.answerKey = keyChars.join('');
    };

    const publish = async () => {
      const pstatus = review.querySelector('[data-pstatus]');
      const say = (text, kind) => { pstatus.textContent = text; pstatus.className = 'ws-status ' + (kind || ''); };
      syncDraft();
      const studentIds = [...body.querySelectorAll('[data-student]:checked')].map(x => x.value);
      const subject = c('subject').value.trim(), topic = c('topic').value.trim();
      if (!studentIds.length) return say('En az bir öğrenci seç.', 'err');
      if (!subject || !topic) return say('Ders ve konu zorunlu.', 'err');
      for (const [i, q] of draft.questions.entries()) {
        const filled = q.options.filter(o => o.text);
        if (!q.stem) return say(`Soru ${q.no}: metin boş.`, 'err');
        if (filled.length < 2) return say(`Soru ${q.no}: en az 2 şık gerekli.`, 'err');
        if (draft.answerKey[i] === '-' || !q.options[LETTERS.indexOf(draft.answerKey[i])]?.text) return say(`Soru ${q.no}: doğru şıkkı seç.`, 'err');
      }
      const button = review.querySelector('[data-publish]');
      button.disabled = true;
      let created = 0, assigned = 0;
      try {
        for (const [i, q] of draft.questions.entries()) {
          say(`Gönderiliyor… ${i + 1}/${draft.questions.length}`);
          const options = q.options.filter(o => o.text).map(o => o.text.replace(/\|/g, '/'));
          const correct = q.options[LETTERS.indexOf(draft.answerKey[i])].text.replace(/\|/g, '/');
          const response = await ctx.authRequest(`/api/tenants/${ctx.tenantId}/question-bank`, {
            method: 'POST',
            body: JSON.stringify({ subject, topic, prompt: q.stem, answer: correct, explanation: null, difficulty: c('difficulty').value, examType: c('exam').value.trim() || 'TYT', isPublished: true, questionType: 'MultipleChoice', optionsJson: options.join('|'), resourceId: null, points: 1 })
          });
          if (!response.ok) { say(`Soru ${q.no} kaydedilemedi: ${await readError(response)}`, 'err'); button.disabled = false; return; }
          const item = await response.json();
          created++;
          for (const studentId of studentIds) {
            const a = await ctx.authRequest(`/api/tenants/${ctx.tenantId}/question-assignments`, { method: 'POST', body: JSON.stringify({ questionBankItemId: item.id, studentId, dueDateUtc: null, note: null }) });
            if (a.ok) assigned++;
          }
        }
        say(`${created} soru oluşturuldu, ${assigned} görev öğrencilere gönderildi ✓`, 'ok');
      } catch { say('Gönderim yarıda kesildi. Soru bankasını kontrol edip tekrar dene.', 'err'); button.disabled = false; }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Stiller                                                              */
  /* ------------------------------------------------------------------ */

  const STYLES = `
  .ws-root{--ws-ink:#173452;--ws-muted:#5d7088;--ws-line:#dbe7f1;--ws-bg:#f6f9fc;--ws-blue:#2563eb;--ws-green:#15803d;--ws-red:#c62828;--ws-amber:#b45309;color:var(--ws-ink);text-align:left}
  .ws-root *{box-sizing:border-box}
  .ws-btn{border:1px solid var(--ws-line);background:#fff;color:var(--ws-ink);border-radius:10px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
  .ws-btn:hover{background:#f1f6fb}.ws-btn:disabled{opacity:.55;cursor:default}
  .ws-primary{background:var(--ws-blue);border-color:var(--ws-blue);color:#fff}.ws-primary:hover{background:#1d4ed8}
  .ws-alert{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fdecec;color:#8a1c1c;font-weight:600}
  .ws-hint{color:var(--ws-muted);font-size:13px;margin:6px 0}
  /* Öğrenci çözüm ekranı */
  .ws-solve{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;height:calc(100vh - 150px);min-height:540px}
  .ws-doc,.ws-sheet{background:#fff;border:1px solid var(--ws-line);border-radius:16px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
  .ws-doc-bar{display:flex;align-items:center;gap:14px;padding:10px 14px;border-bottom:1px solid var(--ws-line);background:var(--ws-bg)}
  .ws-doc-title{display:flex;flex-direction:column;min-width:0;margin-right:auto}.ws-doc-title span{color:var(--ws-muted);font-size:12px}
  .ws-zoom{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px}
  .ws-scan{margin:0 0 10px;padding:8px 10px;border-radius:10px;background:#eef5ff;color:#1f4f86;font-size:12.5px;line-height:1.45}.ws-scan.ok{background:#e9f9f0;color:#16683c}.ws-scan.warn{background:#fff6e5;color:#8a5a00}
  .ws-sec{margin-bottom:8px}.ws-sec-head{position:sticky;top:0;z-index:1;display:flex;align-items:baseline;gap:8px;padding:8px 8px 6px;background:#fff;border-bottom:1px solid var(--ws-line)}.ws-sec-head small{color:var(--ws-muted)}.ws-sec-head .ws-link{margin-left:auto;font-size:12px;padding:0}
  .ws-goto{border:0;background:none;padding:0;font:inherit;font-weight:700;cursor:pointer;color:var(--ws-blue);text-decoration:underline dotted}
  .ws-adjust{display:flex;align-items:center;gap:6px;margin:4px 0 10px;font-size:13px;color:var(--ws-muted,#5b7088)}
  .ws-adjust span{margin-right:auto;font-weight:600}
  .ws-adjust input{width:58px;height:30px;box-sizing:border-box;text-align:center;border:1px solid var(--ws-line);border-radius:8px;font-size:14px}
  .ws-icon{width:30px;height:30px;border-radius:8px;border:1px solid var(--ws-line);background:#fff;font-size:18px;line-height:1;cursor:pointer}
  .ws-pageno{font-size:13px;color:var(--ws-muted);min-width:56px;text-align:right}
  .ws-doc-scroll{flex:1;overflow:auto;background:#e8eef5;padding:16px;min-height:0}
  .ws-page{margin:0 auto 14px;background:#fff;box-shadow:0 2px 10px rgba(20,50,90,.2)}.ws-page canvas{display:block}
  .ws-doc-img{display:block;max-width:100%;margin:0 auto;background:#fff;box-shadow:0 2px 10px rgba(20,50,90,.2)}
  .ws-doc-frame{width:100%;height:100%;min-height:480px;border:0;background:#fff}
  .ws-doc-msg{padding:28px;color:var(--ws-muted);text-align:center}.ws-doc-text{white-space:pre-wrap;text-align:left;background:#fff;padding:14px;border-radius:10px;max-height:50vh;overflow:auto}
  .ws-sheet-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 6px}.ws-sheet-head small{display:block;color:var(--ws-muted)}
  .ws-timer{font-variant-numeric:tabular-nums;font-weight:800;font-size:20px;padding:4px 10px;border-radius:10px;background:var(--ws-bg)}
  .ws-timer.warn{background:#fff4e0;color:var(--ws-amber)}.ws-timer.over{background:#fdecec;color:var(--ws-red)}
  .ws-progress{height:6px;margin:6px 16px 0;background:#e7eef6;border-radius:99px;overflow:hidden}.ws-progress-bar{height:100%;width:0;background:var(--ws-blue);transition:width .2s}
  .ws-count{padding:6px 16px 8px;color:var(--ws-muted);font-size:13px}
  .ws-rows{flex:1;overflow:auto;padding:4px 10px 10px;min-height:0}
  .ws-row{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:10px}.ws-row:nth-child(even){background:#fafcfe}
  .ws-no{width:28px;text-align:right;font-weight:700;color:var(--ws-muted);font-variant-numeric:tabular-nums}
  .ws-opts{display:flex;gap:7px}
  .ws-bubble{width:36px;height:36px;border-radius:50%;border:2px solid #b9cadb;background:#fff;color:#4a617a;font:inherit;font-weight:800;cursor:pointer;transition:transform .08s}
  .ws-bubble:hover{border-color:var(--ws-blue)}.ws-bubble:active{transform:scale(.92)}
  .ws-bubble.on{background:#1b2b3f;border-color:#1b2b3f;color:#fff}
  .ws-sheet-foot{display:flex;gap:10px;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--ws-line);background:var(--ws-bg)}
  .ws-sheet-foot .ws-primary{flex:1}
  .ws-tabs{display:none}
  .ws-modal-back{position:fixed;inset:0;background:rgba(15,30,50,.45);display:grid;place-items:center;z-index:1000;padding:16px}
  .ws-modal{background:#fff;border-radius:16px;padding:22px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)}.ws-modal h3{margin:0 0 8px}.ws-modal p{margin:0 0 16px;line-height:1.5}
  .ws-modal-actions{display:flex;justify-content:flex-end;gap:10px}
  @media (max-width:900px){
    .ws-solve{grid-template-columns:1fr;height:calc(100vh - 110px)}
    .ws-tabs{display:flex;gap:8px}
    .ws-tab{flex:1;border:1px solid var(--ws-line);background:#fff;border-radius:10px;padding:10px;font:inherit;font-weight:700;color:var(--ws-ink)}
    .ws-tab.on{background:var(--ws-ink);color:#fff;border-color:var(--ws-ink)}
    .ws-pill{background:rgba(255,255,255,.22);border-radius:99px;padding:1px 8px;font-size:12px;margin-left:4px}
    .ws-tab:not(.on) .ws-pill{background:var(--ws-bg);color:var(--ws-muted)}
    .ws-solve{grid-template-rows:auto minmax(0,1fr)}
    .ws-solve[data-pane="doc"] .ws-sheet,.ws-solve[data-pane="sheet"] .ws-doc{display:none}
    .ws-bubble{width:42px;height:42px}
  }
  /* Sonuç */
  .ws-result{max-width:980px;margin:0 auto}.ws-result-head h2{margin:0 0 4px}.ws-result-head p{margin:0 0 14px;color:var(--ws-muted)}
  .ws-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px}
  .ws-card{background:#fff;border:1px solid var(--ws-line);border-radius:14px;padding:14px}.ws-card small{display:block;color:var(--ws-muted);font-weight:600}.ws-card strong{font-size:26px}
  .ws-card.big{background:var(--ws-ink);color:#fff;border-color:var(--ws-ink)}.ws-card.big small{color:#b8c8da}.ws-card.ok strong{color:var(--ws-green)}.ws-card.bad strong{color:var(--ws-red)}
  .ws-legend{display:flex;gap:14px;align-items:center;color:var(--ws-muted);font-size:13px;margin:6px 0 10px}
  .ws-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:-8px}.ws-dot.correct{background:#22c55e}.ws-dot.wrong{background:#ef4444}.ws-dot.blank{background:#cbd5e1}
  .ws-chip-group{margin-bottom:14px}.ws-chip-group h4{margin:0 0 8px;font-size:14px}
  .ws-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px}
  .ws-chip{border-radius:10px;padding:6px 4px;text-align:center;border:1px solid var(--ws-line);background:#fff}
  .ws-chip span{display:block;font-size:11px;color:var(--ws-muted)}.ws-chip b{font-size:15px}
  .ws-chip.correct{background:#e8f8ee;border-color:#9bdfb4}.ws-chip.wrong{background:#fdecec;border-color:#f3a6a6;color:#8a1c1c}
  .ws-chip.blank{background:#f1f5f9}.ws-chip.void{background:#fff8e6;border-color:#f1d38a}.ws-chip.answered{background:#eef4ff;border-color:#b6ccf5}
  .ws-result.only-wrong .ws-chip:not(.wrong){display:none}
  .ws-result-actions{display:flex;gap:10px;margin-top:18px}
  /* Koç paneli */
  .ws-coach{background:#fff}.ws-coach-head h2{margin:0}.ws-coach-head p{margin:4px 0 12px;color:var(--ws-muted)}
  .ws-subtabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--ws-line);margin-bottom:14px}
  .ws-subtab{border:0;background:none;padding:10px 14px;font:inherit;font-weight:700;color:var(--ws-muted);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}
  .ws-subtab.on{color:var(--ws-blue);border-bottom-color:var(--ws-blue)}
  .ws-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}
  .ws-col h3{margin:12px 0 8px;font-size:15px}
  .ws-coach label{display:block;font-size:12px;font-weight:700;color:#52627a;margin-bottom:10px}
  .ws-coach input:not([type=checkbox]):not([type=radio]),.ws-coach select,.ws-coach textarea{display:block;width:100%;margin-top:4px;padding:9px;border:1px solid #c9dceb;border-radius:8px;font:inherit;font-weight:400;color:var(--ws-ink);background:#fff}
  .ws-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ws-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .ws-students{max-height:190px;overflow:auto;border:1px solid var(--ws-line);border-radius:10px;padding:6px 10px}
  .ws-check{display:flex!important;align-items:center;gap:8px;margin:0!important;padding:5px 0;font-weight:600!important;font-size:14px!important;color:var(--ws-ink)!important}.ws-check.all{border-bottom:1px solid var(--ws-line);margin-bottom:4px!important}
  .ws-keybox{margin-top:6px;border:1px solid var(--ws-line);border-radius:10px;padding:10px 12px;background:var(--ws-bg)}.ws-keybox summary{cursor:pointer;font-weight:700}
  .ws-keygrid{max-height:440px;overflow:auto;margin-top:8px;background:#fff;border-radius:10px;border:1px solid var(--ws-line)}
  .ws-keygrid .ws-bubble{width:30px;height:30px;font-size:13px}.ws-keystat{font-size:12px;color:var(--ws-muted);margin:6px 0}
  .ws-send-foot{display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap}
  .ws-status{font-weight:600;font-size:13px}.ws-status.ok{color:var(--ws-green)}.ws-status.err{color:var(--ws-red)}
  .ws-ws{border:1px solid var(--ws-line);border-radius:14px;margin-bottom:14px;overflow:hidden}
  .ws-ws>header{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 14px;background:var(--ws-bg);flex-wrap:wrap}.ws-ws small{display:block;color:var(--ws-muted)}
  .ws-head-actions{display:flex;gap:12px;align-items:center}
  .ws-table-wrap{overflow:auto}.ws-table{width:100%;border-collapse:collapse;font-size:14px}.ws-table th{text-align:left;color:var(--ws-muted);font-size:12px;padding:8px 14px}.ws-table td{padding:9px 14px;border-top:1px solid var(--ws-line)}
  .ws-actions{white-space:nowrap}.ws-link{border:0;background:none;color:var(--ws-blue);font:inherit;font-weight:700;cursor:pointer;padding:0 8px 0 0}.ws-link.danger{color:var(--ws-red);margin-left:auto}
  .ws-tag{display:inline-block;padding:3px 9px;border-radius:99px;background:#eef2f7;font-size:12px;font-weight:700;color:#41566f}.ws-tag.ok{background:#e8f8ee;color:var(--ws-green)}.ws-tag.warn{background:#fff4e0;color:var(--ws-amber)}.ws-tag.muted{color:#8a99ab}
  .ws-detail{padding:0 14px}.ws-detail:not(:empty){padding:12px 14px;border-top:1px solid var(--ws-line)}.ws-detail h4{margin:0 0 10px}
  .ws-bars{display:flex;align-items:flex-end;gap:3px;height:120px;padding:6px 0}
  .ws-bar{flex:1;min-width:8px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:9px;color:var(--ws-muted)}
  .ws-bar-fill{width:100%;border-radius:3px 3px 0 0}.ws-bar-fill.high{background:#22c55e}.ws-bar-fill.mid{background:#f59e0b}.ws-bar-fill.low{background:#ef4444}
  .ws-review-bar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:14px 0 8px}.ws-review-bar label{margin:0}
  .ws-q{border:1px solid var(--ws-line);border-radius:12px;padding:12px;margin-bottom:10px}.ws-q.warn{border-color:#f1d38a;background:#fffdf6}
  .ws-q-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
  .ws-optline{display:flex!important;align-items:center;gap:8px;margin:6px 0!important}.ws-optline b{width:18px}.ws-optline input[data-opt]{flex:1;margin:0!important}
  @media (max-width:600px){.ws-grid3{grid-template-columns:1fr}.ws-grid2{grid-template-columns:1fr}}
  `;

  return {
    LETTERS, computeNet, formatNet, formatDuration, parseKeyInput, answersToString, compareSheets, questionStats,
    splitAnswerKeySection, splitOptions, parseWorksheetText, detectTests, openStudent, mountCoachPanel, mountCoachView
  };
});
