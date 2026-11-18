/* Öğrenci ve veli takvim sayfaları: koçun hazırladığı ders programı, görevler, koçluk görüşmeleri ve konu başarısı. */
(() => {
  const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const key = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const windowStart = offset => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + (offset || 0) * 7); return x; };
  const windowDays = offset => { const s = windowStart(offset); return [...Array(7)].map((_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; }); };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lessonLabel = l => (l.examType ? (l.examType === 'YÖS' ? 'TR-YÖS' : l.examType) + ' · ' : '') + l.subject;
  const hhmm = t => String(t || '').slice(0, 5);
  const empty = (title, text) => `<div class="perf-empty"><div class="perf-emoji">📅</div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
  const stat = (icon, label, value, color) => `<div class="pstat ${color}"><span class="pstat-ico">${icon}</span><div><b>${value}</b><small>${label}</small></div></div>`;
  const getJson = async (authRequest, url) => { try { const r = await authRequest(url); return r.ok ? await r.json() : null; } catch { return null; } };

  async function mount(kind, ctx, rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const { authRequest } = ctx;
    const st = { weekOffset: 0, overview: null, summary: null, kids: [], kidId: null };

    async function loadOverview() {
      if (kind === 'student') st.overview = await getJson(authRequest, '/api/student/me/overview');
      else st.overview = await getJson(authRequest, '/api/parent/students/' + st.kidId + '/overview');
      if (!st.overview) { st.summary = null; return; }
      const student = st.overview.student;
      st.summary = await getJson(authRequest, '/api/tenants/' + student.tenantId + '/students/' + student.id + '/question-summary');
    }

    function view() {
      const o = st.overview;
      const days = windowDays(st.weekOffset), keys = days.map(key), todayKey = key(new Date());
      const lessons = (o.lessonSlots || []).filter(l => keys.includes(l.date));
      const tasks = (o.plans || []).flatMap(p => p.tasks || []).filter(t => keys.includes(String(t.dueDate).slice(0, 10)));
      const sessions = (o.sessions || []).filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected' && keys.includes(key(s.startsAtUtc)));
      const doneTasks = tasks.filter(t => t.isCompleted).length;
      const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const topics = ((st.summary && st.summary.byTopic) || []).slice().sort((a, b) => b.total - a.total).slice(0, 6);
      const rate = st.summary ? st.summary.rate : 0;
      const tone = r => r >= 75 ? 'good' : r >= 50 ? 'mid' : 'low';
      const clock = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      const picker = st.kids.length > 1
        ? `<div class="perf-bar"><label>Öğrenci<select id="cal-kid">${st.kids.map(k => `<option value="${esc(k.id)}" ${k.id === st.kidId ? 'selected' : ''}>${esc(k.firstName + ' ' + (k.lastName || ''))}</option>`).join('')}</select></label></div>`
        : '';
      const who = o.student ? esc((o.student.firstName + ' ' + (o.student.lastName || '')).trim()) : '';
      const lstate = l => l.isCompleted ? 'done' : (l.date < todayKey ? 'late' : 'todo');
      const lessonChip = l => `<div class="chip lesson st-${lstate(l)}" title="${esc(lessonLabel(l) + (l.topic ? ' · ' + l.topic : '') + (l.note ? ' · ' + l.note : ''))}"><b class="chip-time">${hhmm(l.startTime)}${l.endTime ? ' – ' + hhmm(l.endTime) : ''}</b><strong>${lstate(l) === 'done' ? '<span class="chip-tick">✓</span> ' : ''}${esc(lessonLabel(l))}</strong>${l.topic ? '<small class="chip-topic">' + esc(l.topic.replace(/^.* - /, '')) + '</small>' : ''}${l.questionCount ? '<small class="chip-meta">✏️ ' + l.questionCount + ' soru</small>' : ''}${l.note ? '<small class="chip-note">📝 ' + esc(l.note) + '</small>' : ''}${kind === 'student' ? `<button type="button" class="chip-done" data-lesson-done="${esc(l.id)}" data-done="${l.isCompleted ? '0' : '1'}">${l.isCompleted ? '↩ Geri al' : '✓ Çözdüm'}</button>` : (lstate(l) === 'late' ? '<small class="chip-late">Yapılmadı</small>' : '')}</div>`;
      const sessionChip = s => `<div class="chip session"><b class="chip-time">${clock(s.startsAtUtc)}</b><strong>Koçluk görüşmesi</strong><small class="chip-topic">${s.durationMinutes} dk</small></div>`;
      const taskChip = (t, k) => `<div class="chip ${t.isCompleted ? 'done' : (k < todayKey ? 'late' : 'todo')}"><strong>${esc(t.title)}</strong><small class="chip-topic">${t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru'}</small></div>`;
      const column = (d, i) => {
        const k = keys[i], isToday = k === todayKey;
        const body = lessons.filter(l => l.date === k).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(lessonChip).join('')
          + sessions.filter(s => key(s.startsAtUtc) === k).sort((a, b) => new Date(a.startsAtUtc) - new Date(b.startsAtUtc)).map(sessionChip).join('')
          + tasks.filter(t => String(t.dueDate).slice(0, 10) === k).map(t => taskChip(t, k)).join('');
        return `<div class="week-col ${isToday ? 'today' : ''}"><div class="week-head"><div class="wh-day"><b>${DOW[d.getDay()]}</b>${isToday ? '<em>Bugün</em>' : ''}</div><div class="wh-date"><span>${d.getDate()}</span><small>${d.toLocaleDateString('tr-TR', { month: 'short' })}</small></div></div><div class="week-items">${body || '<div class="week-none">Boş gün</div>'}</div></div>`;
      };

      return `${picker}
      <div class="perf-stats compact">${stat('📚', 'Bu 7 günde ders', lessons.length, 'indigo')}${stat('🗒️', 'Görev (biten / toplam)', doneTasks + ' / ' + tasks.length, 'teal')}${stat('💬', 'Koçluk görüşmesi', sessions.length, 'violet')}${stat('🎯', 'Genel soru başarısı', '%' + Math.round(rate), 'amber')}</div>
      <div class="week-nav"><button type="button" data-cal-week="-1" aria-label="Önceki 7 gün">‹</button><span>${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}</span><button type="button" data-cal-week="1" aria-label="Sonraki 7 gün">›</button>${st.weekOffset ? '<button type="button" data-cal-week="0" class="today">Bugüne dön</button>' : '<em class="week-note">Bugünden itibaren 7 gün</em>'}</div>
      <div class="week-grid">${days.map(column).join('')}</div>
      <div class="week-legend"><span class="d lesson"></span>Ders<span class="d done"></span>Çözüldü / tamamlandı<span class="d todo"></span>Bekliyor<span class="d late"></span>Günü geçti, yapılmadı<span class="d session"></span>Görüşme</div>
      <h3 class="perf-h">Konu bazlı başarı ${who ? '<span class="tag">' + who + '</span>' : ''}</h3>
      ${topics.length ? `<div class="perf-topics">${topics.map(t => `<div class="topic-card ${tone(t.rate)}"><div class="topic-top"><div><strong>${esc(t.subject)}</strong><small>${esc(t.topic)}</small></div><span class="topic-rate">%${Math.round(t.rate)}</span></div><div class="topic-bar"><span style="width:${Math.min(100, t.rate)}%"></span></div><small>${t.correct} doğru / ${t.total} soru</small></div>`).join('')}</div>` : empty('Henüz çözülmüş soru yok', 'Koçun atadığı soruları çözdükçe konu bazlı başarı burada görünür.')}`;
    }

    function render() {
      if (!st.overview) { root.innerHTML = empty('Takvim yüklenemedi', 'Sayfayı yenileyip tekrar deneyin.'); return; }
      root.innerHTML = view();
    }

    root.addEventListener('click', async event => {
      const done = event.target.closest('[data-lesson-done]');
      if (done) {
        done.disabled = true;
        const r = await authRequest('/api/student/me/lesson-slots/' + done.dataset.lessonDone + '/complete', { method: 'POST', body: JSON.stringify({ done: done.dataset.done === '1' }) });
        if (r.ok) { const l = (st.overview.lessonSlots || []).find(x => x.id === done.dataset.lessonDone); if (l) l.isCompleted = done.dataset.done === '1'; render(); } else { done.disabled = false; alert('İşaretlenemedi. Tekrar deneyin.'); }
        return;
      }
      const b = event.target.closest('[data-cal-week]');
      if (!b) return;
      st.weekOffset = b.dataset.calWeek === '0' ? 0 : st.weekOffset + Number(b.dataset.calWeek);
      render();
    });
    root.addEventListener('change', async event => {
      if (event.target.id !== 'cal-kid') return;
      st.kidId = event.target.value;
      localStorage.setItem('parentStudentId', st.kidId);
      root.innerHTML = '<div class="perf-empty">Yükleniyor…</div>';
      await loadOverview();
      render();
    });

    root.innerHTML = '<div class="perf-empty">Yükleniyor…</div>';
    if (kind === 'parent') {
      st.kids = (await getJson(authRequest, '/api/parent/students')) || [];
      if (!st.kids.length) { root.innerHTML = empty('Takip ettiğiniz öğrenci yok', 'Koçunuz öğrenciyi hesabınıza bağladığında takvim burada görünür.'); return; }
      st.kidId = (st.kids.find(k => k.id === localStorage.getItem('parentStudentId')) || st.kids[0]).id;
    }
    await loadOverview();
    render();
  }

  window.loadStudentCalendar = ctx => mount('student', ctx, 'student-calendar-root');
  window.loadParentCalendar = ctx => mount('parent', ctx, 'parent-calendar-root');
})();
