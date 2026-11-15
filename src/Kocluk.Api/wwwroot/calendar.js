/* Öğrenci ve veli takvim sayfaları: koçun hazırladığı ders programı, görevler, koçluk görüşmeleri ve konu başarısı. */
(() => {
  const DAY = 86400000;
  const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const key = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const weekStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
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
      const start = weekStart(Date.now() + st.weekOffset * 7 * DAY);
      const days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
      const keys = days.map(key), todayKey = key(new Date());
      const lessons = (o.lessonSlots || []).filter(l => keys.includes(l.date));
      const tasks = (o.plans || []).flatMap(p => p.tasks || []).filter(t => keys.includes(String(t.dueDate).slice(0, 10)));
      const sessions = (o.sessions || []).filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected' && keys.includes(key(s.startsAtUtc)));
      const doneTasks = tasks.filter(t => t.isCompleted).length;
      const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const topics = ((st.summary && st.summary.byTopic) || []).slice().sort((a, b) => b.total - a.total).slice(0, 6);
      const rate = st.summary ? st.summary.rate : 0;
      const tone = r => r >= 75 ? 'good' : r >= 50 ? 'mid' : 'low';

      const picker = st.kids.length > 1
        ? `<div class="perf-bar"><label>Öğrenci<select id="cal-kid">${st.kids.map(k => `<option value="${esc(k.id)}" ${k.id === st.kidId ? 'selected' : ''}>${esc(k.firstName + ' ' + (k.lastName || ''))}</option>`).join('')}</select></label></div>`
        : '';
      const who = o.student ? esc((o.student.firstName + ' ' + (o.student.lastName || '')).trim()) : '';

      return `${picker}
      <div class="week-nav"><button type="button" data-cal-week="-1">‹</button><span>${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}</span><button type="button" data-cal-week="1">›</button>${st.weekOffset ? '<button type="button" data-cal-week="0" class="today">Bu hafta</button>' : ''}</div>
      <div class="perf-stats compact">${stat('📚', 'Bu haftaki ders', lessons.length, 'indigo')}${stat('🗒️', 'Görev (biten / toplam)', doneTasks + ' / ' + tasks.length, 'teal')}${stat('💬', 'Koçluk görüşmesi', sessions.length, 'violet')}${stat('🎯', 'Genel soru başarısı', '%' + Math.round(rate), 'amber')}</div>
      <div class="week-grid">${days.map((d, i) => {
        const k = keys[i];
        const ls = lessons.filter(l => l.date === k).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const ss = sessions.filter(s => key(s.startsAtUtc) === k);
        const ts = tasks.filter(t => String(t.dueDate).slice(0, 10) === k);
        const body = ls.map(l => `<div class="chip lesson" title="${esc(lessonLabel(l) + (l.topic ? ' · ' + l.topic : ''))}"><b>${hhmm(l.startTime)}${l.endTime ? ' – ' + hhmm(l.endTime) : ''}</b><span>${esc(lessonLabel(l))}</span>${l.topic ? '<small class="chip-topic">' + esc(l.topic.replace(/^.* - /, '')) + '</small>' : ''}</div>`).join('')
          + ss.map(s => `<div class="chip session"><b>${new Date(s.startsAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b><span>Koçluk görüşmesi · ${s.durationMinutes} dk</span></div>`).join('')
          + ts.map(t => `<div class="chip ${t.isCompleted ? 'done' : (k < todayKey ? 'late' : 'todo')}"><b>${esc(t.title)}</b><span>${t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru'}</span></div>`).join('');
        return `<div class="week-col ${k === todayKey ? 'today' : ''}"><div class="week-head"><b>${DAYS[i]}</b><span>${d.getDate()}</span></div>${body || '<div class="week-none">—</div>'}</div>`;
      }).join('')}</div>
      <div class="week-legend"><span class="d lesson"></span>Ders<span class="d done"></span>Tamamlandı<span class="d todo"></span>Bekliyor<span class="d late"></span>Geciken<span class="d session"></span>Görüşme</div>
      <h3 class="perf-h">Konu bazlı başarı ${who ? '<span class="tag">' + who + '</span>' : ''}</h3>
      ${topics.length ? `<div class="perf-topics">${topics.map(t => `<div class="topic-card ${tone(t.rate)}"><div class="topic-top"><div><strong>${esc(t.subject)}</strong><small>${esc(t.topic)}</small></div><span class="topic-rate">%${Math.round(t.rate)}</span></div><div class="topic-bar"><span style="width:${Math.min(100, t.rate)}%"></span></div><small>${t.correct} doğru / ${t.total} soru</small></div>`).join('')}</div>` : empty('Henüz çözülmüş soru yok', 'Koçun atadığı soruları çözdükçe konu bazlı başarı burada görünür.')}`;
    }

    function render() {
      if (!st.overview) { root.innerHTML = empty('Takvim yüklenemedi', 'Sayfayı yenileyip tekrar deneyin.'); return; }
      root.innerHTML = view();
    }

    root.addEventListener('click', event => {
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
