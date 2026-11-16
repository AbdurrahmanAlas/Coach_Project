/* Koç için "Soru havuzu" sayfası: özet kartları, arama + filtre çubuğu, soru listesi ve yüklenen kaynaklar. */
(() => {
  const TYPE = { ShortAnswer: 'Kısa cevap', MultipleChoice: 'Çoktan seçmeli', TrueFalse: 'Doğru / Yanlış' };
  const DIFF_ORDER = { Kolay: 1, Orta: 2, Zor: 3 };
  const fmtDate = iso => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const examName = code => (typeof getExamTypes === 'function' && (getExamTypes().find(e => e.code === code) || {}).name) || code || '—';
  const examShort = code => code === 'YÖS' ? 'TR-YÖS' : (code || '—');
  const lower = s => String(s || '').toLocaleLowerCase('tr-TR');

  window.mountQuestionPool = async function (ctx) {
    const { shell, tenantId, authRequest, escapeHtml: esc } = ctx;
    const st = { tab: 'resources', rsubject: '', rtype: '', rsort: 'new', q: '', exam: '', subject: '', topic: '', difficulty: '', type: '', status: '', sort: 'new', limit: 20, rq: '', rlimit: 20, items: [], resources: [], students: [], open: new Set(), assign: new Set() };
    shell.style.maxWidth = ''; shell.style.padding = '';
    shell.innerHTML = '<div class="qp-root"><div class="perf-empty">Soru havuzu yükleniyor…</div></div>';
    const root = shell.querySelector('.qp-root');
    const json = async path => { try { const r = await authRequest('/api/tenants/' + tenantId + path); return r.ok ? await r.json() : []; } catch { return []; } };

    async function load() {
      const [items, resources, students] = await Promise.all([json('/question-bank'), json('/resources'), json('/students')]);
      st.items = Array.isArray(items) ? items : []; st.resources = Array.isArray(resources) ? resources : []; st.students = Array.isArray(students) ? students : [];
    }

    const distinct = (list, key) => [...new Set(list.map(x => x[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'tr'));
    const scoped = () => st.items.filter(x => (!st.exam || x.examType === st.exam));
    function filtered() {
      const term = lower(st.q);
      const rows = st.items.filter(x => (!st.exam || x.examType === st.exam) && (!st.subject || x.subject === st.subject) && (!st.topic || x.topic === st.topic)
        && (!st.difficulty || x.difficulty === st.difficulty) && (!st.type || x.questionType === st.type)
        && (!st.status || (st.status === 'published' ? x.isPublished : !x.isPublished))
        && (!term || lower(x.prompt).includes(term) || lower(x.subject).includes(term) || lower(x.topic).includes(term)));
      const sorters = { new: () => 0, old: (a, b) => String(a.createdAtUtc).localeCompare(String(b.createdAtUtc)), subject: (a, b) => String(a.subject).localeCompare(String(b.subject), 'tr') || String(a.topic).localeCompare(String(b.topic), 'tr'), difficulty: (a, b) => (DIFF_ORDER[a.difficulty] || 9) - (DIFF_ORDER[b.difficulty] || 9) };
      return [...rows].sort(sorters[st.sort] || sorters.new);
    }

    const opts = (values, current, label = v => v) => values.map(v => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(label(v))}</option>`).join('');
    const activeChips = () => {
      const chips = [];
      if (st.exam) chips.push(['exam', 'Sınav: ' + examShort(st.exam)]);
      if (st.subject) chips.push(['subject', 'Ders: ' + st.subject]);
      if (st.topic) chips.push(['topic', 'Konu: ' + st.topic]);
      if (st.difficulty) chips.push(['difficulty', 'Zorluk: ' + st.difficulty]);
      if (st.type) chips.push(['type', 'Tür: ' + TYPE[st.type]]);
      if (st.status) chips.push(['status', st.status === 'published' ? 'Yayımda' : 'Taslak']);
      if (st.q.trim()) chips.push(['q', '“' + st.q.trim() + '”']);
      return chips;
    };

    function statsHtml() {
      const total = st.items.length, published = st.items.filter(x => x.isPublished).length;
      const weekAgo = Date.now() - 7 * 86400000, newRes = st.resources.filter(r => new Date(r.createdAtUtc).getTime() >= weekAgo).length;
      const bytes = st.resources.reduce((s, r) => s + Number(r.size || 0), 0), subjects = new Set(st.resources.map(r => r.subject)).size;
      const card = (label, icon, value, foot, tab) => `<div class="card stat ${tab ? 'qp-stat-link' : ''}" ${tab ? `data-goto="${tab}" role="button" tabindex="0"` : ''}><div class="stat-head"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`;
      return card('Yüklenen kaynak', '📚', st.resources.length, `${subjects} farklı derste dosya`, 'resources') + card('Bu hafta eklenen', '＋', newRes, 'Son 7 günde yüklenen kaynak', 'resources') + card('Toplam boyut', '◍', fmtSize(bytes), 'Kaynak arşivi', 'resources') + card('Soru havuzu', '▤', total, `${published} yayımda · ${total - published} taslak`, 'questions');
    }

    function questionRow(x) {
      const open = st.open.has(x.id), assigning = st.assign.has(x.id);
      const options = x.questionType === 'MultipleChoice' && x.optionsJson ? String(x.optionsJson).split('|').map(o => o.trim()).filter(Boolean) : [];
      const studentOptions = '<option value="">Öğrenci seç</option>' + st.students.map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName || '')}</option>`).join('');
      return `<article class="qp-row ${open ? 'open' : ''}" data-id="${x.id}">
        <div class="qp-main">
          <div class="qp-meta"><span class="qp-exam" title="${esc(examName(x.examType))}">${esc(examShort(x.examType))}</span><strong>${esc(x.subject)}</strong><span class="qp-topic">${esc(String(x.topic || '').replace(/^.* - /, ''))}</span></div>
          <p class="qp-prompt">${esc(x.prompt)}</p>
          <div class="qp-tags"><span class="qp-pill d-${esc(x.difficulty)}">${esc(x.difficulty)}</span><span class="qp-pill">${esc(TYPE[x.questionType] || x.questionType)}</span><span class="qp-pill ${x.isPublished ? 'pub' : 'draft'}">${x.isPublished ? 'Yayımda' : 'Taslak'}</span>${x.resourceId ? '<span class="qp-pill">📎 Ekli dosya</span>' : ''}<span class="qp-date">${fmtDate(x.createdAtUtc)}</span></div>
        </div>
        <div class="qp-actions">
          <button type="button" class="qp-btn main" data-act="assign" data-id="${x.id}">👤 Öğrenciye ata</button>
          <button type="button" class="qp-btn" data-act="toggle" data-id="${x.id}">${open ? 'Gizle ▴' : 'Ayrıntı ▾'}</button>
          <button type="button" class="qp-btn" data-act="publish" data-id="${x.id}">${x.isPublished ? 'Taslağa al' : 'Yayımla'}</button>
          <button type="button" class="qp-btn danger" data-act="delete" data-id="${x.id}">Sil</button>
        </div>
        ${open ? `<div class="qp-detail"><div><small>Soru metni</small><p>${esc(x.prompt)}</p></div>${options.length ? `<div><small>Seçenekler</small><ul>${options.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}<div><small>Doğru cevap</small><p><b>${esc(x.answer || '—')}</b></p></div>${x.explanation ? `<div><small>Açıklama</small><p>${esc(x.explanation)}</p></div>` : ''}</div>` : ''}
        ${assigning ? `<div class="qp-assign"><select class="qp-student" data-id="${x.id}">${studentOptions}</select><label>Son tarih<input type="date" class="qp-due" data-id="${x.id}"></label><button type="button" class="qp-btn main" data-act="assign-send" data-id="${x.id}">Ata</button><span class="qp-msg" data-msg="${x.id}"></span></div>` : ''}
      </article>`;
    }

    function questionsPane() {
      const rows = filtered(), visible = rows.slice(0, st.limit), chips = activeChips();
      const subjects = distinct(scoped(), 'subject'), topics = distinct(scoped().filter(x => !st.subject || x.subject === st.subject), 'topic');
      return `<div class="qp-toolbar">
          <div class="qp-search"><span aria-hidden="true">🔎</span><input id="qp-search" type="search" placeholder="Soru metni, ders veya konu ara…" value="${esc(st.q)}" autocomplete="off"></div>
          <select id="qp-sort" aria-label="Sıralama"><option value="new" ${st.sort === 'new' ? 'selected' : ''}>En yeni önce</option><option value="old" ${st.sort === 'old' ? 'selected' : ''}>En eski önce</option><option value="subject" ${st.sort === 'subject' ? 'selected' : ''}>Ders / konu (A-Z)</option><option value="difficulty" ${st.sort === 'difficulty' ? 'selected' : ''}>Zorluk (kolaydan zora)</option></select>
        </div>
        <div class="qp-filters">
          <label><span>Sınav türü</span><select id="qp-exam"><option value="">Tümü</option>${opts(distinct(st.items, 'examType'), st.exam, examShort)}</select></label>
          <label><span>Ders</span><select id="qp-subject"><option value="">Tümü</option>${opts(subjects, st.subject)}</select></label>
          <label><span>Konu</span><select id="qp-topic"><option value="">Tümü</option>${opts(topics, st.topic, t => t.replace(/^.* - /, ''))}</select></label>
          <label><span>Zorluk</span><select id="qp-difficulty"><option value="">Tümü</option>${opts(['Kolay', 'Orta', 'Zor'], st.difficulty)}</select></label>
          <label><span>Soru türü</span><select id="qp-type"><option value="">Tümü</option>${opts(Object.keys(TYPE), st.type, t => TYPE[t])}</select></label>
          <label><span>Durum</span><select id="qp-status"><option value="">Tümü</option><option value="published" ${st.status === 'published' ? 'selected' : ''}>Yayımda</option><option value="draft" ${st.status === 'draft' ? 'selected' : ''}>Taslak</option></select></label>
        </div>
        <div class="qp-summary"><b>${rows.length}</b> soru bulundu${st.items.length >= 200 ? ' <small>(en yeni 200 soru listelenir)</small>' : ''}${chips.map(([k, label]) => `<button type="button" class="qp-chip" data-clear="${k}">${esc(label)} ✕</button>`).join('')}${chips.length ? '<button type="button" class="qp-link" data-clear="all">Tümünü temizle</button>' : ''}</div>
        <div class="qp-list">${visible.length ? visible.map(questionRow).join('') : `<div class="qp-empty"><strong>${st.items.length ? 'Filtrelere uyan soru yok' : 'Henüz soru eklenmemiş'}</strong><p>${st.items.length ? 'Arama veya filtreleri değiştirmeyi dene.' : 'Sağ üstteki "+ Yeni soru" ile ilk sorunu oluştur.'}</p></div>`}</div>
        ${rows.length > visible.length ? `<div class="qp-more"><button type="button" class="qp-btn" data-act="more">Daha fazla göster (${rows.length - visible.length} kalan)</button></div>` : ''}`;
    }

    const fileKind = r => /pdf/i.test(r.contentType) || /\.pdf$/i.test(r.fileName) ? 'pdf' : /^image\//i.test(r.contentType) ? 'image' : /word|document|\.docx?$/i.test(r.contentType + r.fileName) ? 'word' : /sheet|excel|\.xlsx?$|\.csv$/i.test(r.contentType + r.fileName) ? 'excel' : 'other';
    const KIND_LABEL = { pdf: 'PDF', image: 'Görsel', word: 'Word', excel: 'Excel', other: 'Diğer' };
    const fileExt = r => (String(r.fileName || '').split('.').pop() || '').slice(0, 4).toUpperCase() || 'DOSYA';
    function resourcesPane() {
      const term = lower(st.rq);
      const rows = st.resources.filter(r => (!st.rsubject || r.subject === st.rsubject) && (!st.rtype || fileKind(r) === st.rtype) && (!term || lower(r.subject).includes(term) || lower(r.topic).includes(term) || lower(r.fileName).includes(term)));
      const sorters = { new: () => 0, old: (a, b) => String(a.createdAtUtc).localeCompare(String(b.createdAtUtc)), subject: (a, b) => String(a.subject).localeCompare(String(b.subject), 'tr') || String(a.topic).localeCompare(String(b.topic), 'tr'), name: (a, b) => String(a.fileName).localeCompare(String(b.fileName), 'tr'), size: (a, b) => Number(b.size || 0) - Number(a.size || 0) };
      const sorted = [...rows].sort(sorters[st.rsort] || sorters.new), visible = sorted.slice(0, st.rlimit);
      const chips = [];
      if (st.rsubject) chips.push(['rsubject', 'Ders: ' + st.rsubject]);
      if (st.rtype) chips.push(['rtype', 'Tür: ' + KIND_LABEL[st.rtype]]);
      if (st.rq.trim()) chips.push(['rq', '“' + st.rq.trim() + '”']);
      const studentOptions = '<option value="">Öğrenci seç</option>' + st.students.map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName || '')}</option>`).join('');
      const kinds = [...new Set(st.resources.map(fileKind))];
      return `<div class="qp-toolbar"><div class="qp-search"><span aria-hidden="true">🔎</span><input id="qp-rsearch" type="search" placeholder="Dosya adı, ders veya konu ara…" value="${esc(st.rq)}" autocomplete="off"></div>
          <select id="qp-rsort" aria-label="Sıralama"><option value="new" ${st.rsort === 'new' ? 'selected' : ''}>En yeni yüklenen önce</option><option value="old" ${st.rsort === 'old' ? 'selected' : ''}>En eski önce</option><option value="subject" ${st.rsort === 'subject' ? 'selected' : ''}>Ders / konu (A-Z)</option><option value="name" ${st.rsort === 'name' ? 'selected' : ''}>Dosya adı (A-Z)</option><option value="size" ${st.rsort === 'size' ? 'selected' : ''}>Boyut (büyükten küçüğe)</option></select></div>
        <div class="qp-filters two">
          <label><span>Ders</span><select id="qp-rsubject"><option value="">Tüm dersler</option>${opts(distinct(st.resources, 'subject'), st.rsubject)}</select></label>
          <label><span>Dosya türü</span><select id="qp-rtype"><option value="">Tüm türler</option>${opts(kinds, st.rtype, k => KIND_LABEL[k])}</select></label>
        </div>
        <div class="qp-summary"><b>${rows.length}</b> kaynak bulundu${st.resources.length >= 200 ? ' <small>(en yeni 200 kaynak listelenir)</small>' : ''}${chips.map(([k, label]) => `<button type="button" class="qp-chip" data-clear="${k}">${esc(label)} ✕</button>`).join('')}${chips.length ? '<button type="button" class="qp-link" data-clear="rall">Tümünü temizle</button>' : ''}</div>
        <div class="qp-list">${visible.length ? visible.map(r => `<article class="qp-row res" data-id="${r.id}"><div class="qp-main res-main"><span class="qp-fileico ${fileKind(r)}">${esc(fileExt(r))}</span><div><div class="qp-meta"><strong>${esc(r.subject)}</strong><span class="qp-topic">${esc(String(r.topic || '').replace(/^.* - /, ''))}</span></div><div class="qp-tags"><span class="qp-file">${esc(r.fileName)}</span><span class="qp-pill">${fmtSize(r.size || 0)}</span><span class="qp-date">${fmtDate(r.createdAtUtc)} tarihinde yüklendi</span></div></div></div><div class="qp-actions"><button type="button" class="qp-btn" data-act="preview" data-url="${esc(r.downloadUrl)}">Önizle</button><select class="qp-student" data-rid="${r.id}">${studentOptions}</select><button type="button" class="qp-btn main" data-act="send-resource" data-id="${r.id}">Öğrenciye gönder</button><a class="qp-btn" href="${esc(r.downloadUrl)}" download>İndir</a><span class="qp-msg" data-rmsg="${r.id}"></span></div></article>`).join('') : `<div class="qp-empty"><strong>${st.resources.length ? 'Filtrelere uyan kaynak yok' : 'Henüz kaynak yüklenmemiş'}</strong><p>${st.resources.length ? 'Arama veya filtreleri değiştirmeyi dene.' : '"Dosya yükle" ile PDF, Word, Excel veya görsel ekleyebilirsin.'}</p></div>`}</div>
        ${sorted.length > visible.length ? `<div class="qp-more"><button type="button" class="qp-btn" data-act="rmore">Daha fazla göster (${sorted.length - visible.length} kalan)</button></div>` : ''}`;
    }

    function render(keepFocus) {
      const focusId = keepFocus && document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : '';
      const caret = focusId && document.activeElement.selectionStart != null ? document.activeElement.selectionStart : null;
      root.innerHTML = `<div class="welcome"><div><h1>Soru havuzu</h1><p>Yüklediğin kaynakları öğrencilerine gönder, sorularını oluştur ve ata.</p></div><div class="qp-head-actions"><button class="primary" id="qp-upload" type="button">＋ Dosya yükle</button><button class="primary ghost" id="qp-new" type="button">+ Yeni soru</button></div></div>
        <div class="grid qp-stats">${statsHtml()}</div>
        <div class="card section qp-card">
          <div class="qp-tabs" role="tablist"><button type="button" role="tab" class="${st.tab === 'resources' ? 'on' : ''}" data-tab="resources">Yüklenen kaynaklar <em>${st.resources.length}</em></button><button type="button" role="tab" class="${st.tab === 'questions' ? 'on' : ''}" data-tab="questions">Sorular <em>${st.items.length}</em></button></div>
          ${st.tab === 'questions' ? questionsPane() : resourcesPane()}
        </div>`;
      if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch { /* sayı/tarih alanı */ } } }
    }

    async function reload() { await load(); render(); }
    function openNew() {
      const qm = window.questionModal; if (!qm) return;
      if (typeof qm.init === 'function') qm.init();
      qm.open(async (data, hasFile, file) => {
        const body = { ...data };
        if (hasFile && file) {
          const form = new FormData();
          form.append('examType', data.examType); form.append('subject', data.subject); form.append('topic', data.topic); form.append('file', file);
          const upload = await fetch('/api/tenants/' + tenantId + '/resources', { method: 'POST', body: form, credentials: 'include' });
          const uploaded = await upload.json().catch(() => ({}));
          if (!upload.ok) return { success: false, error: uploaded.error || 'Dosya yüklenemedi' };
          body.resourceId = uploaded.id;
        }
        const response = await authRequest('/api/tenants/' + tenantId + '/question-bank', { method: 'POST', body: JSON.stringify(body) });
        const failure = response.ok ? null : await response.json().catch(() => ({}));
        return { success: response.ok, error: response.ok ? '' : ((failure && failure.error) || 'Soru kaydedilemedi'), callback: reload };
      });
    }
    const say = (selector, text, err) => { const el = root.querySelector(selector); if (el) { el.textContent = text; el.className = 'qp-msg' + (err ? ' err' : ' ok'); } };

    root.addEventListener('input', e => {
      if (e.target.id === 'qp-search') { st.q = e.target.value; st.limit = 20; render(true); }
      else if (e.target.id === 'qp-rsearch') { st.rq = e.target.value; st.rlimit = 20; render(true); }
    });
    root.addEventListener('change', e => {
      const id = e.target.id, map = { 'qp-exam': 'exam', 'qp-subject': 'subject', 'qp-topic': 'topic', 'qp-difficulty': 'difficulty', 'qp-type': 'type', 'qp-status': 'status', 'qp-sort': 'sort', 'qp-rsubject': 'rsubject', 'qp-rtype': 'rtype', 'qp-rsort': 'rsort' };
      if (!map[id]) return;
      st[map[id]] = e.target.value; st.limit = 20; st.rlimit = 20;
      if (id === 'qp-exam') { st.subject = ''; st.topic = ''; }
      if (id === 'qp-subject') st.topic = '';
      render();
    });
    root.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g && !e.target.closest('button, a')) { st.tab = g.dataset.goto; render(); } });
    root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-goto]')) { e.preventDefault(); st.tab = e.target.dataset.goto; render(); } });
    root.addEventListener('click', async e => {
      const t = e.target.closest('button, a'); if (!t) return;
      if (t.id === 'qp-new') { openNew(); return; }
      if (t.id === 'qp-upload') { document.querySelector('[data-qb="files"]')?.click(); return; }
      if (t.dataset.tab) { st.tab = t.dataset.tab; render(); return; }
      if (t.dataset.clear) {
        if (t.dataset.clear === 'rall') { Object.assign(st, { rq: '', rsubject: '', rtype: '' }); st.rlimit = 20; render(); return; }
        if (['rsubject', 'rtype', 'rq'].includes(t.dataset.clear)) { st[t.dataset.clear] = ''; st.rlimit = 20; render(); return; }
        if (t.dataset.clear === 'all') Object.assign(st, { q: '', exam: '', subject: '', topic: '', difficulty: '', type: '', status: '' });
        else { st[t.dataset.clear] = ''; if (t.dataset.clear === 'exam') { st.subject = ''; st.topic = ''; } if (t.dataset.clear === 'subject') st.topic = ''; }
        st.limit = 20; render(); return;
      }
      const act = t.dataset.act, id = t.dataset.id, item = st.items.find(x => x.id === id);
      if (act === 'more') { st.limit += 20; render(); }
      else if (act === 'rmore') { st.rlimit += 20; render(); }
      else if (act === 'toggle') { st.open.has(id) ? st.open.delete(id) : st.open.add(id); render(); }
      else if (act === 'assign') { st.assign.has(id) ? st.assign.delete(id) : st.assign.add(id); render(); }
      else if (act === 'assign-send') {
        const student = root.querySelector(`.qp-student[data-id="${id}"]`)?.value, due = root.querySelector(`.qp-due[data-id="${id}"]`)?.value;
        if (!student) { say(`[data-msg="${id}"]`, 'Önce öğrenci seç.', true); return; }
        t.disabled = true;
        const r = await authRequest('/api/tenants/' + tenantId + '/question-assignments', { method: 'POST', body: JSON.stringify({ questionBankItemId: id, studentId: student, dueDateUtc: due ? new Date(due + 'T23:59:00').toISOString() : null, note: null }) });
        const body = r.ok ? null : await r.json().catch(() => ({}));
        t.disabled = false;
        say(`[data-msg="${id}"]`, r.ok ? 'Atandı ✓' : ((body && body.error) || 'Atama yapılamadı.'), !r.ok);
      }
      else if (act === 'publish' && item) {
        t.disabled = true;
        const r = await authRequest('/api/tenants/' + tenantId + '/question-bank/' + id, { method: 'PUT', body: JSON.stringify({ subject: item.subject, topic: item.topic, prompt: item.prompt, answer: item.answer, explanation: item.explanation, difficulty: item.difficulty, examType: item.examType, isPublished: !item.isPublished, questionType: item.questionType, optionsJson: item.optionsJson, resourceId: item.resourceId, points: item.points }) });
        if (r.ok) item.isPublished = !item.isPublished; else alert('Durum güncellenemedi.');
        render();
      }
      else if (act === 'delete') {
        if (!confirm('Bu soruyu havuzdan silmek istiyor musunuz?')) return;
        const r = await authRequest('/api/tenants/' + tenantId + '/question-bank/' + id, { method: 'DELETE' });
        if (r.ok) { st.items = st.items.filter(x => x.id !== id); render(); } else alert('Soru silinemedi.');
      }
      else if (act === 'preview') window.open(t.dataset.url, '_blank', 'noopener');
      else if (act === 'upload') document.querySelector('[data-qb="files"]')?.click();
      else if (act === 'send-resource') {
        const student = root.querySelector(`.qp-student[data-rid="${id}"]`)?.value;
        if (!student) { say(`[data-rmsg="${id}"]`, 'Önce öğrenci seç.', true); return; }
        t.disabled = true;
        const r = await authRequest('/api/tenants/' + tenantId + '/resource-assignments', { method: 'POST', body: JSON.stringify({ resourceId: id, studentId: student, dueDateUtc: null, note: null }) });
        const body = r.ok ? null : await r.json().catch(() => ({}));
        t.disabled = false;
        say(`[data-rmsg="${id}"]`, r.ok ? 'Gönderildi ✓' : ((body && body.error) || 'Gönderilemedi.'), !r.ok);
      }
    });

    await load(); render();
  };
})();
