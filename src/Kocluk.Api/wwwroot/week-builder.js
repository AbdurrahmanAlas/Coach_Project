/* Sürükle & bırak haftalık program oluşturucu: bugünden başlayan 7 gün, konu kütüphanesi, ders kartları, haftalık özet ve paylaşım. */
(() => {
  const DOWL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const windowDays = offset => { const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() + offset * 7); return [...Array(7)].map((_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; }); };
  const hm = t => String(t || '').slice(0, 5);
  const toMin = t => { const [h, m] = hm(t).split(':').map(Number); return h * 60 + m; };
  const fromMin = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const secs = t => (t && t.length === 5 ? t + ':00' : t || null);
  const dur = l => (l.endTime ? Math.max(0, toMin(l.endTime) - toMin(l.startTime)) : 0);
  const fmtDur = m => m >= 60 ? Math.floor(m / 60) + ' sa' + (m % 60 ? ' ' + (m % 60) + ' dk' : '') : m + ' dk';
  const lessonLabel = l => (l.examType ? (l.examType === 'YÖS' ? 'TR-YÖS' : l.examType) + ' · ' : '') + l.subject;
  /* Ders durumu: öğrenci işaretlediyse 'done', günü geçtiyse 'late', aksi halde 'todo'. */
  const lessonState = l => l.isCompleted ? 'done' : (l.date < key(new Date()) ? 'late' : 'todo');
  window.lessonState = lessonState;
  function buildModel({ student, lessons, sessions: sessions0, tasks, offset }) {
  const days = windowDays(offset), keys = days.map(key), todayKey = key(new Date());
  const clock = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const sessions = sessions0.filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected');
  let total = 0;
  const out = days.map((d, i) => {
    const k = keys[i];
    const items = [
      ...lessons.filter(l => l.date === k).sort((a, b) => hm(a.startTime).localeCompare(hm(b.startTime))).map(l => ({ kind: 'lesson', status: lessonState(l), time: hm(l.startTime) + (l.endTime ? ' – ' + hm(l.endTime) : ''), title: lessonLabel(l), topic: l.topic ? String(l.topic).replace(/^.* - /, '') : '', meta: l.questionCount ? '✏️ ' + l.questionCount + ' soru' : '', note: l.note || '' })),
      ...sessions.filter(s => key(new Date(s.startsAtUtc)) === k).map(s => ({ kind: 'session', time: clock(s.startsAtUtc), title: 'Koçluk görüşmesi', topic: s.durationMinutes + ' dk', meta: '', note: '' })),
      ...tasks.filter(t => String(t.dueDate).slice(0, 10) === k).map(t => ({ kind: 'task', status: t.isCompleted ? 'done' : (k < todayKey ? 'late' : 'todo'), time: 'Görev', title: t.title, topic: '', meta: t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru', note: '' }))
    ];
    total += items.length;
    return { label: DOWL[d.getDay()], date: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }), today: k === todayKey, items };
  });
  const sessionList = sessions.filter(s => keys.includes(key(new Date(s.startsAtUtc)))).sort((a, b) => new Date(a.startsAtUtc) - new Date(b.startsAtUtc)).map(s => ({ day: new Date(s.startsAtUtc).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }), time: clock(s.startsAtUtc) + (s.status === 'Confirmed' || s.status === 'Completed' ? '' : ' (onay bekliyor)'), dur: s.durationMinutes + ' dk' }));
  const range = days[0].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' – ' + days[6].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  return { name: `${student.firstName} ${student.lastName || ''}`.trim(), range, coach: document.getElementById('profile-name')?.textContent?.trim() || '', days: out, total, sessions: sessionList };
  }
  window.KoclukWeek = { buildModel, lessonState };
  const TONE = { LGS: '#16a34a', TYT: '#2563eb', AYT: '#7c3aed', KPSS: '#d97706', DGS: '#0d9488', 'YÖS': '#e11d48' };
  const slug = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ogrenci';

  window.mountWeekBuilder = async function (host, ctx) {
    const { tenantId, authRequest, student, escapeHtml: esc } = ctx;
    const st = { offset: 0, lessons: [], sessions: [], tasks: [], exam: 'TYT', q: '', open: new Set(), shareTo: 'guardian', msg: '', err: false, toast: '' };
    const base = '/api/tenants/' + tenantId + '/students/' + student.id;
    const root = document.createElement('div'); root.className = 'wb' + (ctx.big ? ' wb-big' : ''); host.replaceChildren(root);
    root.innerHTML = '<p class="wb-loading">Haftalık program yükleniyor…</p>';

    const get = async path => { try { const r = await authRequest(base + path); return r.ok ? await r.json() : []; } catch { return []; } };
    async function load() {
      const [lessons, sessions, plans] = await Promise.all([get('/lesson-slots'), get('/sessions'), get('/plans')]);
      st.lessons = Array.isArray(lessons) ? lessons : []; st.sessions = Array.isArray(sessions) ? sessions : [];
      st.tasks = (Array.isArray(plans) ? plans : []).flatMap(p => (p.tasks || []).map(t => ({ ...t, planTitle: p.title })));
    }
    const body = l => ({ date: l.date, startTime: secs(hm(l.startTime)), endTime: l.endTime ? secs(hm(l.endTime)) : null, examType: l.examType, subject: l.subject, topic: l.topic || null, note: l.note || null, questionCount: l.questionCount ? Number(l.questionCount) : null });
    const say = (m, err) => { st.msg = m; st.err = !!err; };
    const toast = text => { const el = document.createElement('div'); el.className = 'wb-toast'; el.textContent = text; document.body.appendChild(el); setTimeout(() => el.remove(), 3500); };

    async function addLesson(data) {
      const r = await authRequest(base + '/lesson-slots', { method: 'POST', body: JSON.stringify(body(data)) });
      const res = await r.json().catch(() => null);
      if (r.ok && res) { st.lessons.push(res); return res; }
      say((res && res.error) || 'Ders kaydedilemedi.', true); return null;
    }
    async function saveLesson(l) {
      const r = await authRequest('/api/tenants/' + tenantId + '/lesson-slots/' + l.id, { method: 'PUT', body: JSON.stringify(body(l)) });
      const res = await r.json().catch(() => null);
      if (r.ok && res) { Object.assign(l, res); return true; }
      say((res && res.error) || 'Değişiklik kaydedilemedi.', true); return false;
    }
    async function removeLesson(id) {
      const r = await authRequest('/api/tenants/' + tenantId + '/lesson-slots/' + id, { method: 'DELETE' });
      if (r.ok) { st.lessons = st.lessons.filter(l => l.id !== id); return true; }
      say('Ders silinemedi.', true); return false;
    }
    function defaultSlot(dateKey) {
      const day = st.lessons.filter(l => l.date === dateKey).sort((a, b) => hm(a.startTime).localeCompare(hm(b.startTime)));
      let start = 16 * 60;
      if (day.length) { const last = day[day.length - 1]; start = last.endTime ? toMin(last.endTime) : toMin(last.startTime) + 60; }
      start = Math.min(start, 22 * 60 + 30);
      return { startTime: fromMin(start), endTime: fromMin(Math.min(start + 60, 23 * 60 + 59)) };
    }

    /* ---------- Görünüm ---------- */
    function libraryHtml() {
      const exams = getExamTypes(), subjects = getSubjectsByExam(st.exam), term = st.q.trim().toLocaleLowerCase('tr-TR');
      const days = windowDays(st.offset), keys = days.map(key);
      const used = new Set(st.lessons.filter(l => keys.includes(l.date) && l.examType === st.exam).map(l => l.subject + '||' + (l.topic || '')));
      const groups = subjects.map(s => {
        const topics = getTopicsByExamAndSubject(st.exam, s.code).filter(t => !term || t.toLocaleLowerCase('tr-TR').includes(term) || s.name.toLocaleLowerCase('tr-TR').includes(term));
        return { s, topics };
      }).filter(g => g.topics.length);
      return `<div class="wb-lib-head"><b>Konu kütüphanesi</b><small>Konuyu sürükleyip güne bırak</small></div>
        <div class="wb-lib-tools"><select id="wb-exam" aria-label="Sınav türü">${exams.map(e => `<option value="${esc(e.code)}" ${e.code === st.exam ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
        <div class="wb-search"><span aria-hidden="true">🔎</span><input id="wb-q" type="search" placeholder="Konu veya ders ara…" value="${esc(st.q)}" autocomplete="off"></div></div>
        <div class="wb-lib-list">${groups.length ? groups.map((g, i) => `<details class="wb-subject" data-sub="${esc(g.s.code)}" ${(term || st.open.has(g.s.code) || (!st.open.size && i === 0)) ? 'open' : ''}><summary><span class="wb-dot" style="background:${TONE[st.exam] || '#4f46e5'}"></span><strong>${esc(g.s.name)}</strong><em>${g.topics.length}</em></summary>${g.topics.map(t => `<div class="wb-topic" draggable="true" data-kind="topic" data-sub-code="${esc(g.s.code)}" data-topic="${esc(t)}" title="Güne sürükle"><span class="wb-grip">⠿</span><span class="wb-tname">${esc(t)}</span>${used.has(g.s.name + '||' + t) ? '<span class="wb-added">Eklendi ✓</span>' : ''}</div>`).join('')}</details>`).join('') : '<p class="wb-none">Aramaya uyan konu yok.</p>'}</div>`;
    }
    function itemHtml(l) {
      const tone = TONE[l.examType] || '#4f46e5', d = dur(l), ls = lessonState(l);
      return `<div class="wb-item st-${ls}" draggable="true" data-kind="lesson" data-id="${esc(l.id)}" style="--tone:${tone}" title="Taşımak için sürükle · düzenlemek için tıkla"><div class="wb-item-top"><span class="wb-pill" style="background:${tone}">${esc(l.examType === 'YÖS' ? 'TR-YÖS' : l.examType)}</span>${d ? `<span class="wb-dur">⏱ ${fmtDur(d)}</span>` : ''}${ls === 'done' ? '<span class="st-badge done">✓ Çözüldü</span>' : ls === 'late' ? '<span class="st-badge late">Yapılmadı</span>' : ''}<button type="button" class="wb-x" data-del="${esc(l.id)}" aria-label="Dersi sil" title="Sil">✕</button></div><strong>${esc(l.subject)}</strong>${l.topic ? `<small>${esc(String(l.topic).replace(/^.* - /, ''))}</small>` : ''}<div class="wb-item-meta"><span>🕐 ${esc(hm(l.startTime))}${l.endTime ? ' – ' + esc(hm(l.endTime)) : ''}</span>${l.questionCount ? `<span>✏️ ${l.questionCount} soru</span>` : ''}</div>${l.note ? `<div class="wb-inote">📝 ${esc(l.note)}</div>` : ''}</div>`;
    }
    function render() {
      if (typeof getExamTypes !== 'function') { root.innerHTML = '<p class="wb-loading">Müfredat verisi yüklenemedi. Sayfayı yenileyin.</p>'; return; }
      const days = windowDays(st.offset), keys = days.map(key), todayKey = key(new Date());
      const lessons = st.lessons.filter(l => keys.includes(l.date));
      const sessions = st.sessions.filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected' && keys.includes(key(new Date(s.startsAtUtc))));
      const tasks = st.tasks.filter(t => keys.includes(String(t.dueDate).slice(0, 10)));
      const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      const perDay = keys.map(k => lessons.filter(l => l.date === k).reduce((s, l) => s + dur(l), 0));
      const totalMin = perDay.reduce((a, b) => a + b, 0), maxMin = Math.max(60, ...perDay), filled = keys.filter(k => lessons.some(l => l.date === k)).length;
      const totalQ = lessons.reduce((s, l) => s + (l.questionCount || 0), 0);
      const dayCard = (d, i) => {
        const k = keys[i], isToday = k === todayKey;
        const ls = lessons.filter(l => l.date === k).sort((a, b) => hm(a.startTime).localeCompare(hm(b.startTime)));
        const ss = sessions.filter(s => key(new Date(s.startsAtUtc)) === k).sort((a, b) => new Date(a.startsAtUtc) - new Date(b.startsAtUtc));
        const ts = tasks.filter(t => String(t.dueDate).slice(0, 10) === k);
        return `<div class="wb-day ${isToday ? 'today' : ''}" data-date="${k}"><div class="wb-dayhead"><div><b>${DOWL[d.getDay()]}</b><small>${fmt(d)}</small></div>${isToday ? '<em>Bugün</em>' : ''}${perDay[i] ? `<span class="wb-total">⏱ ${fmtDur(perDay[i])}</span>` : ''}</div>
          <div class="wb-list">${ls.map(itemHtml).join('')}${ss.map(s => `<div class="wb-item session"><div class="wb-item-top"><span class="wb-pill" style="background:#7c3aed">Görüşme</span></div><strong>Koçluk görüşmesi</strong><div class="wb-item-meta"><span>🕐 ${new Date(s.startsAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span><span>${s.durationMinutes} dk</span></div></div>`).join('')}${ts.map(t => `<div class="wb-item task ${t.isCompleted ? 'done' : ''}"><div class="wb-item-top"><span class="wb-pill" style="background:#d97706">Görev</span></div><strong>${esc(t.title)}</strong><div class="wb-item-meta"><span>${t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru'}</span></div></div>`).join('')}${!ls.length && !ss.length && !ts.length ? '<div class="wb-drop">Konu sürükleyip buraya bırak</div>' : ''}</div>
          <button type="button" class="wb-add" data-add-day="${k}">＋ Ders ekle</button></div>`;
      };
      const bars = keys.map((k, i) => `<div class="wb-bar" title="${DOWL[days[i].getDay()]}: ${perDay[i] ? fmtDur(perDay[i]) : 'ders yok'}"><div class="wb-bar-col"><i style="height:${perDay[i] ? Math.max(10, Math.round(perDay[i] / maxMin * 100)) : 0}%"></i></div><span>${SHORT[days[i].getDay()]}</span></div>`).join('');
      root.innerHTML = `<div class="wb-top"><div><h3>Sürükle &amp; Bırak Program Oluşturucu</h3><p>${esc(student.firstName)} ${esc(student.lastName || '')} · değişiklikler otomatik kaydedilir</p></div>
          <div class="wb-share"><label>Gönderilecek kişi<select id="wb-to"><option value="guardian" ${st.shareTo !== 'student' ? 'selected' : ''}>Veli</option><option value="student" ${st.shareTo === 'student' ? 'selected' : ''}>Öğrenci</option></select></label><button type="button" class="wb-btn main" data-share="image">🖼️ Görsel</button><button type="button" class="wb-btn" data-share="pdf">📄 PDF</button><button type="button" class="wb-btn" data-share="text">💬 Metin</button><button type="button" class="wb-btn" data-share="publish">📣 Bildir</button></div></div>
        ${st.msg ? `<div class="wb-msg ${st.err ? 'err' : 'ok'}">${esc(st.msg)}</div>` : ''}
        <div class="wb-body"><aside class="wb-lib">${libraryHtml()}</aside>
          <section class="wb-main"><div class="wb-nav"><button type="button" data-w="-1">‹ Önceki 7 gün</button><span>${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}</span><button type="button" data-w="1">Sonraki 7 gün ›</button>${st.offset ? '<button type="button" data-w="0" class="today">Bugüne dön</button>' : ''}</div>
            <div class="wb-grid">${days.map(dayCard).join('')}
              <div class="wb-summary"><div class="wb-sum-title">📊 Haftalık özet</div><div class="wb-stats"><div><small>Ders</small><b>${lessons.length}</b></div><div><small>Toplam süre</small><b>${totalMin ? fmtDur(totalMin) : '—'}</b></div><div><small>Dolu gün</small><b>${filled}/7</b></div><div><small>Soru hedefi</small><b>${totalQ || '—'}</b></div></div><div class="wb-bars">${bars}</div></div>
            </div></section></div>`;
    }

    /* ---------- Ders penceresi (yeni / düzenle) ---------- */
    function openDialog(lesson, dateKey) {
      document.getElementById('wb-dialog')?.remove();
      const days = windowDays(st.offset), keys = days.map(key), exams = getExamTypes();
      const isNew = !lesson, slot = isNew ? defaultSlot(dateKey) : { startTime: hm(lesson.startTime), endTime: lesson.endTime ? hm(lesson.endTime) : '' };
      const examCode = isNew ? st.exam : lesson.examType;
      const overlay = document.createElement('div'); overlay.id = 'wb-dialog'; overlay.className = 'wb-backdrop';
      const dateOptions = (keys.includes(isNew ? dateKey : lesson.date) ? keys : [...keys, lesson.date]).map(k => { const d = new Date(k + 'T00:00:00'); return `<option value="${k}" ${k === (isNew ? dateKey : lesson.date) ? 'selected' : ''}>${DOWL[d.getDay()]} · ${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'long' })}</option>`; }).join('');
      overlay.innerHTML = `<div class="wb-dialog" role="dialog" aria-modal="true"><div class="wb-dhead"><h4>${isNew ? 'Ders ekle' : 'Dersi düzenle'}</h4><button type="button" class="wb-dx" data-close aria-label="Kapat">✕</button></div>
        <form class="wb-dform" novalidate>
          ${isNew ? `<div class="wb-dgrid"><label>Sınav türü<select id="wbd-exam">${exams.map(e => `<option value="${esc(e.code)}" ${e.code === examCode ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label><label>Ders<select id="wbd-subject"></select></label><label class="full">Konu <em>(isteğe bağlı)</em><select id="wbd-topic"></select></label></div>` : `<div class="wb-dsum"><b>${esc(lessonLabel(lesson))}</b><small>${esc(String(lesson.topic || 'Konu seçilmedi').replace(/^.* - /, ''))}</small></div>`}
          <div class="wb-dgrid"><label>Gün<select id="wbd-date">${dateOptions}</select></label><label>Başlangıç<input type="time" id="wbd-start" value="${esc(slot.startTime)}"></label><label>Bitiş<input type="time" id="wbd-end" value="${esc(slot.endTime)}"></label>
          <label>Soru sayısı <em>(isteğe bağlı)</em><input type="number" id="wbd-q" min="1" max="1000" inputmode="numeric" value="${lesson && lesson.questionCount ? lesson.questionCount : ''}" placeholder="Örn: 40"></label><label class="full2">Not <em>(isteğe bağlı)</em><input type="text" id="wbd-note" maxlength="500" value="${esc(lesson ? lesson.note || '' : '')}" placeholder="Örn: Önce konu özetini oku"></label></div>
          <div class="wb-dmsg" id="wbd-msg"></div>
          <div class="wb-dfoot">${isNew ? '' : '<button type="button" class="wb-btn danger" data-delete>Dersi sil</button>'}<span></span><button type="button" class="wb-btn" data-close>İptal</button><button type="submit" class="wb-btn main">${isNew ? 'Ekle' : 'Kaydet'}</button></div></form></div>`;
      document.body.appendChild(overlay);
      const $ = id => overlay.querySelector('#' + id);
      const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = e => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      overlay.addEventListener('click', async e => {
        if (e.target === overlay || e.target.closest('[data-close]')) close();
        else if (e.target.closest('[data-delete]') && lesson) { if (confirm('Bu ders programdan silinsin mi?')) { if (await removeLesson(lesson.id)) { say('Ders silindi.'); close(); render(); } } }
      });
      if (isNew) {
        const fillSubjects = () => { const subs = getSubjectsByExam($('wbd-exam').value); $('wbd-subject').innerHTML = subs.map(s => `<option value="${esc(s.code)}">${esc(s.name)}</option>`).join(''); fillTopics(); };
        const fillTopics = () => { const tops = getTopicsByExamAndSubject($('wbd-exam').value, $('wbd-subject').value); $('wbd-topic').innerHTML = '<option value="">Konu seçilmedi</option>' + tops.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join(''); };
        $('wbd-exam').addEventListener('change', fillSubjects); $('wbd-subject').addEventListener('change', fillTopics); fillSubjects();
      }
      overlay.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const start = $('wbd-start').value, end = $('wbd-end').value, qc = $('wbd-q').value ? Number($('wbd-q').value) : null, msg = $('wbd-msg');
        const fail = m => { msg.textContent = m; };
        if (!start) return fail('Başlangıç saatini gir.');
        if (end && end <= start) return fail('Bitiş saati başlangıçtan sonra olmalı.');
        if (qc !== null && !(Number.isInteger(qc) && qc >= 1 && qc <= 1000)) return fail('Soru sayısı 1 ile 1000 arasında olmalı.');
        const common = { date: $('wbd-date').value, startTime: start, endTime: end || null, note: $('wbd-note').value.trim() || null, questionCount: qc };
        if (isNew) {
          const sub = getSubjectsByExam($('wbd-exam').value).find(s => s.code === $('wbd-subject').value);
          if (!sub) return fail('Önce bir ders seç.');
          const created = await addLesson({ ...common, examType: $('wbd-exam').value, subject: sub.name, topic: $('wbd-topic').value || null });
          if (!created) { fail(st.msg); return; }
        } else {
          Object.assign(lesson, common);
          if (!await saveLesson(lesson)) { fail(st.msg); return; }
        }
        say(isNew ? 'Ders eklendi.' : 'Ders güncellendi.'); close(); render();
      });
    }

    /* ---------- Paylaşım ---------- */
    const model = () => buildModel({ student, lessons: st.lessons, sessions: st.sessions, tasks: st.tasks, offset: st.offset });
    const phoneFor = () => { const g = student.guardian || {}; return st.shareTo === 'student' ? (student.phoneNumber || g.phoneNumber || '') : (g.phoneNumber || student.phoneNumber || ''); };
    async function share(kind) {
      if (kind === 'publish') {
        const first = key(windowDays(st.offset)[0]);
        const r = await authRequest(base + '/lesson-slots/publish', { method: 'POST', body: JSON.stringify({ weekStart: first }) });
        const res = await r.json().catch(() => null);
        say(r.ok ? (res && res.notified ? res.notified + ' kişiye bildirim gönderildi.' : 'Program öğrencinin takviminde görünüyor; bağlı hesap olmadığı için bildirim gitmedi.') : ((res && res.error) || 'Program gönderilemedi.'), !r.ok);
        return render();
      }
      const m = model();
      if (!m.total) { say('Bu 7 günde paylaşılacak program yok.', true); return render(); }
      if (!window.KoclukShare) { say('Paylaşım modülü yüklenemedi. Sayfayı yenileyin.', true); return render(); }
      if (kind === 'text') {
        const icon = k => k === 'task' ? '📌 ' : k === 'session' ? '💬 ' : '🕐 ';
        const blocks = m.days.filter(d => d.items.length).map(d => '*' + d.label + ', ' + d.date + '*\n' + d.items.map(i => icon(i.kind) + i.time + '  ' + i.title + (i.topic ? '\n     ▫️ ' + i.topic : '') + (i.meta ? '\n     ' + i.meta : '') + (i.note ? '\n     📝 ' + i.note : '')).join('\n'));
        const sess = m.sessions.length ? '\n\n*Koçluk görüşmeleri*\n' + m.sessions.map(s => '💬 ' + s.day + ' · ' + s.time + ' · ' + s.dur).join('\n') : '';
        const text = '📚 *' + m.name + ' - Haftalık Ders Programı*\n' + m.range + '\n\n' + blocks.join('\n\n') + sess + '\n\n_Alas Eğitim Koçluk panelinden gönderildi_';
        window.open(KoclukShare.whatsappUrl(KoclukShare.normalizePhone(phoneFor()), text), '_blank'); return;
      }
      say('Görsel hazırlanıyor…'); render();
      try {
        const canvas = KoclukShare.scheduleCanvas(m), asPdf = kind === 'pdf';
        const blob = asPdf ? await KoclukShare.toPdf(canvas) : await KoclukShare.toBlob(canvas, 'image/png');
        const res = await KoclukShare.deliver({ blob, filename: 'haftalik-program-' + slug(m.name) + (asPdf ? '.pdf' : '.png'), text: m.name + ' - haftalık ders programı (' + m.range + ')', phone: phoneFor() });
        say(KoclukShare.describe ? KoclukShare.describe(res, asPdf) : 'Hazırlandı.');
      } catch (e) { console.warn(e); say('Program görseli hazırlanamadı. Tekrar deneyin.', true); }
      render();
    }

    /* ---------- Olaylar ---------- */
    let dragData = null;
    root.addEventListener('change', e => {
      if (e.target.id === 'wb-exam') { st.exam = e.target.value; st.open = new Set(); render(); }
      else if (e.target.id === 'wb-to') st.shareTo = e.target.value;
    });
    root.addEventListener('input', e => {
      if (e.target.id !== 'wb-q') return;
      st.q = e.target.value; const pos = e.target.selectionStart; render();
      const el = root.querySelector('#wb-q'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* */ } }
    });
    root.addEventListener('toggle', e => { const d = e.target; if (d.classList && d.classList.contains('wb-subject')) { d.open ? st.open.add(d.dataset.sub) : st.open.delete(d.dataset.sub); } }, true);
    root.addEventListener('click', async e => {
      const t = e.target.closest('button, .wb-item[data-kind="lesson"]'); if (!t || !root.contains(t)) return;
      if (t.dataset.w !== undefined) { st.offset = t.dataset.w === '0' ? 0 : st.offset + Number(t.dataset.w); st.msg = ''; render(); }
      else if (t.dataset.addDay) openDialog(null, t.dataset.addDay);
      else if (t.dataset.del) { e.stopPropagation(); if (confirm('Bu ders programdan silinsin mi?')) { if (await removeLesson(t.dataset.del)) say('Ders silindi.'); render(); } }
      else if (t.dataset.share) share(t.dataset.share);
      else if (t.classList.contains('wb-item')) { const l = st.lessons.find(x => x.id === t.dataset.id); if (l) openDialog(l); }
    });
    root.addEventListener('dragstart', e => {
      const el = e.target.closest('[draggable="true"]'); if (!el) return;
      dragData = el.dataset.kind === 'topic' ? { kind: 'topic', code: el.dataset.subCode, topic: el.dataset.topic } : { kind: 'lesson', id: el.dataset.id };
      e.dataTransfer.effectAllowed = dragData.kind === 'topic' ? 'copy' : 'move'; e.dataTransfer.setData('text/plain', JSON.stringify(dragData)); el.classList.add('dragging');
    });
    root.addEventListener('dragend', () => { dragData = null; root.querySelectorAll('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); });
    root.addEventListener('dragover', e => { const day = e.target.closest('.wb-day'); if (!day || !dragData) return; e.preventDefault(); e.dataTransfer.dropEffect = dragData.kind === 'topic' ? 'copy' : 'move'; root.querySelectorAll('.wb-day.over').forEach(x => x !== day && x.classList.remove('over')); day.classList.add('over'); });
    root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) root.querySelectorAll('.wb-day.over').forEach(x => x.classList.remove('over')); });
    root.addEventListener('drop', async e => {
      const day = e.target.closest('.wb-day'); if (!day || !dragData) return; e.preventDefault();
      const dateKey = day.dataset.date, data = dragData; dragData = null; root.querySelectorAll('.wb-day.over').forEach(x => x.classList.remove('over'));
      if (data.kind === 'topic') {
        const sub = getSubjectsByExam(st.exam).find(s => s.code === data.code); if (!sub) return;
        const created = await addLesson({ date: dateKey, ...defaultSlot(dateKey), examType: st.exam, subject: sub.name, topic: data.topic, note: null, questionCount: null });
        if (created) { say(''); toast('✓ Ders eklendi — süreyi düzenlemek için karta tıkla'); }
        render();
      } else {
        const l = st.lessons.find(x => x.id === data.id); if (!l || l.date === dateKey) return;
        const prev = l.date; l.date = dateKey; render();
        if (!await saveLesson(l)) { l.date = prev; render(); }
      }
    });

    await load(); render();
  };

  /* ---------- Büyük pencere ve özet kartı ---------- */
  window.openWeekBuilderPopup = function (ctx) {
    document.getElementById('wb-popup')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'wb-popup'; overlay.className = 'wb-popup';
    overlay.innerHTML = `<div class="wb-popup-card" role="dialog" aria-modal="true" aria-label="Haftalık program"><div class="wb-popup-head"><div><b>🗓️ Haftalık program</b><span>Konuyu sürükleyip güne bırak · değişiklikler otomatik kaydedilir</span></div><button type="button" class="wb-popup-close" data-close aria-label="Kapat">✕ Kapat</button></div><div class="wb-popup-body"></div></div>`;
    document.body.appendChild(overlay);
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const sidebarWas = window.isSidebarCollapsed ? window.isSidebarCollapsed() : false;
    if (window.setSidebarCollapsed) window.setSidebarCollapsed(true, false);
    document.body.classList.add('wb-open');
    const sidebarEl = document.querySelector('.sidebar');
    const onNav = e => { if (e.target.closest('.nav a, .brand')) close(); };
    let closed = false;
    const close = () => { if (closed) return; closed = true; overlay.remove(); document.body.classList.remove('wb-open'); document.body.style.overflow = previousOverflow; if (sidebarEl) sidebarEl.removeEventListener('click', onNav, true); window.removeEventListener('hashchange', close); if (window.setSidebarCollapsed) window.setSidebarCollapsed(sidebarWas, false); document.removeEventListener('keydown', onKey); if (ctx.onClose) ctx.onClose(); };
    const onKey = e => { if (e.key === 'Escape' && !document.getElementById('wb-dialog')) close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    if (sidebarEl) sidebarEl.addEventListener('click', onNav, true);
    window.addEventListener('hashchange', close);
    window.mountWeekBuilder(overlay.querySelector('.wb-popup-body'), { ...ctx, big: true });
  };

  window.mountWeekOverview = async function (host, ctx) {
    const { tenantId, authRequest, student, escapeHtml: esc } = ctx;
    const base = '/api/tenants/' + tenantId + '/students/' + student.id;
    const root = document.createElement('div'); root.className = 'wo'; host.replaceChildren(root);
    root.innerHTML = '<p class="wb-loading">Haftalık program yükleniyor…</p>';
    const get = async path => { try { const r = await authRequest(base + path); return r.ok ? await r.json() : []; } catch { return []; } };
    let data = { lessons: [], sessions: [], tasks: [] };
    async function load() {
      const [lessons, sessions, plans] = await Promise.all([get('/lesson-slots'), get('/sessions'), get('/plans')]);
      data = { lessons: Array.isArray(lessons) ? lessons : [], sessions: Array.isArray(sessions) ? sessions : [], tasks: (Array.isArray(plans) ? plans : []).flatMap(p => p.tasks || []) };
    }
    function render() {
      const days = windowDays(0), keys = days.map(key), todayKey = key(new Date());
      const lessons = data.lessons.filter(l => keys.includes(l.date));
      const sessions = data.sessions.filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected' && keys.includes(key(new Date(s.startsAtUtc))));
      const total = lessons.reduce((s, l) => s + dur(l), 0), filled = keys.filter(k => lessons.some(l => l.date === k)).length, questions = lessons.reduce((s, l) => s + (l.questionCount || 0), 0);
      const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      const dayHtml = (d, i) => {
        const k = keys[i], ls = lessons.filter(l => l.date === k).sort((a, b) => hm(a.startTime).localeCompare(hm(b.startTime)));
        const chips = ls.slice(0, 3).map(l => `<div class="wo-chip st-${lessonState(l)}" style="--tone:${TONE[l.examType] || '#4f46e5'}"><b>${lessonState(l) === 'done' ? '✓ ' : ''}${esc(hm(l.startTime))}</b><span>${esc(l.subject)}</span>${l.topic ? `<small>${esc(String(l.topic).replace(/^.* - /, ''))}</small>` : ''}</div>`).join('');
        return `<div class="wo-day ${k === todayKey ? 'today' : ''}"><div class="wo-dayhead"><b>${SHORT[d.getDay()]}</b><span>${d.getDate()}</span></div>${chips || '<div class="wo-empty">Boş</div>'}${ls.length > 3 ? `<div class="wo-more">+${ls.length - 3} ders daha</div>` : ''}</div>`;
      };
      root.innerHTML = `<div class="wo-card" role="button" tabindex="0" aria-label="Haftalık programı aç">
        <div class="wo-head"><div><h3>Haftalık program</h3><p>${esc(student.firstName)} ${esc(student.lastName || '')} · ${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}</p></div><button type="button" class="wo-open" data-open>🗓️ Programı aç ve düzenle <b>→</b></button></div>
        <div class="wo-stats"><div><small>Ders</small><b>${lessons.length}</b></div><div><small>Toplam süre</small><b>${total ? fmtDur(total) : '—'}</b></div><div><small>Dolu gün</small><b>${filled}/7</b></div><div><small>Koçluk görüşmesi</small><b>${sessions.length}</b></div><div><small>Soru hedefi</small><b>${questions || '—'}</b></div></div>
        <div class="wo-grid">${days.map(dayHtml).join('')}</div>
        <div class="wo-hint">Programı sürükle &amp; bırak ile oluşturmak, düzenlemek ve WhatsApp'tan paylaşmak için tıkla</div></div>`;
    }
    const open = () => window.openWeekBuilderPopup({ tenantId, authRequest, student, escapeHtml: esc, onClose: async () => { await load(); render(); } });
    root.addEventListener('click', e => { if (e.target.closest('.wo-card')) open(); });
    root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('wo-card')) { e.preventDefault(); open(); } });
    await load(); render();
  };
})();
