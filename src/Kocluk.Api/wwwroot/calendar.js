/* Öğrenci ve veli takvim sayfaları */
(() => {
  const DAY = 86400000;
  const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const key = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const r1 = v => (Math.round(v * 10) / 10).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const weekStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  window.loadStudentCalendar = async function (ctx) {
    const { authRequest, escapeHtml, tenantId } = ctx;
    const root = document.getElementById('student-calendar-root');
    if (!root) return;

    // Öğrencinin kendi verilerini getir
    const me = await authRequest('/api/auth/me').then(r => r.ok ? r.json() : null);
    if (!me) return root.innerHTML = '<div class="perf-empty"><strong>Yükleme hatası</strong></div>';

    const studentId = me.id;
    const get = async path => { try { const r = await authRequest('/api/tenants/' + tenantId + path); return r.ok ? await r.json() : []; } catch { return []; } };

    const [attempts, plans, tasks, sessions, lessons] = await Promise.all([
      get('/students/' + studentId + '/question-attempts'),
      get('/students/' + studentId + '/plans'),
      (async () => { const p = await get('/students/' + studentId + '/plans'); return p.flatMap(x => x.tasks || []); })(),
      get('/students/' + studentId + '/sessions'),
      (async () => {
        try { return JSON.parse(localStorage.getItem('kocluk-lessons-' + studentId) || '[]'); } catch { return []; }
      })()
    ]);

    root.innerHTML = renderCalendar(studentId, attempts, plans, tasks, sessions, lessons, 'student');
  };

  window.loadParentCalendar = async function (ctx) {
    const { authRequest, escapeHtml, tenantId } = ctx;
    const root = document.getElementById('parent-calendar-root');
    if (!root) return;

    // Veli kullanıcısının çocuklarını getir
    const get = async path => { try { const r = await authRequest('/api/tenants/' + tenantId + path); return r.ok ? await r.json() : []; } catch { return []; } };
    const students = await get('/students');
    if (!students.length) return root.innerHTML = '<div class="perf-empty"><strong>Takip ettiğiniz öğrenci yok</strong></div>';

    const studentId = students[0].id;
    const [attempts, plans, tasks, sessions, lessons] = await Promise.all([
      get('/students/' + studentId + '/question-attempts'),
      get('/students/' + studentId + '/plans'),
      (async () => { const p = await get('/students/' + studentId + '/plans'); return p.flatMap(x => x.tasks || []); })(),
      get('/students/' + studentId + '/sessions'),
      (async () => {
        try { return JSON.parse(localStorage.getItem('kocluk-lessons-' + studentId) || '[]'); } catch { return []; }
      })()
    ]);

    root.innerHTML = renderCalendar(studentId, attempts, plans, tasks, sessions, lessons, 'parent');
  };

  function renderCalendar(studentId, attempts, plans, tasks, sessions, lessons, role) {
    const start = weekStart(new Date());
    const days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
    const keys = days.map(key);
    const todayKey = key(new Date());

    const taskList = tasks.filter(t => keys.includes(t.dueDate));
    const sessionList = sessions.filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected' && keys.includes(key(s.startsAtUtc)));
    const lessonList = lessons.filter(l => keys.includes(l.date));

    const attemptsByTopic = new Map();
    attempts.forEach(a => {
      const k = a.subject + '||' + a.topic;
      if (!attemptsByTopic.has(k)) attemptsByTopic.set(k, []);
      attemptsByTopic.get(k).push(a);
    });

    const topicStats = [...attemptsByTopic.entries()].map(([k, items]) => {
      const correct = items.filter(a => a.isCorrect).length;
      return {
        key: k,
        subject: k.split('||')[0],
        topic: k.split('||')[1],
        total: items.length,
        correct,
        rate: items.length ? Math.round(correct * 100 / items.length) : 0
      };
    }).sort((a, b) => b.total - a.total).slice(0, 5);

    const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

    return `
      <div style="margin-bottom:24px">
        <div style="background:#f6f7fd;border-radius:18px;padding:16px;margin-bottom:14px">
          <h3 style="margin:0 0 12px;color:#1e1b4b">📅 ${fmt(days[0])} – ${fmt(days[6])}</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
            ${[
              ['🗒️', 'Görev', taskList.length],
              ['🕐', 'Ders', lessonList.length],
              ['💬', 'Koçluk', sessionList.length]
            ].map(([emoji, label, count]) => `
              <div style="background:#fff;border-radius:12px;padding:12px;text-align:center">
                <div style="font-size:20px;margin-bottom:4px">${emoji}</div>
                <div style="font-size:11px;color:#64748b;margin-bottom:4px">${label}</div>
                <div style="font-size:18px;font-weight:700;color:#1e1b4b">${count}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="week-grid" style="margin-bottom:24px">
        ${days.map((d, i) => {
          const k = keys[i];
          const ts = taskList.filter(t => t.dueDate === k);
          const ss = sessionList.filter(s => key(s.startsAtUtc) === k);
          const ls = lessonList.filter(l => l.date === k);
          return `
            <div class="week-col ${k === todayKey ? 'today' : ''}">
              <div class="week-head">
                <b>${DAYS[i]}</b>
                <span>${d.getDate()}</span>
              </div>
              ${ls.map(l => `
                <div class="chip lesson" style="background:#dbeafe;border-color:#93c5fd;color:#1e40af;position:relative" title="${esc((l.examType || l.subject) + ' · ' + l.topic)}">
                  <b>${new Date('2000-01-01T'+l.startTime).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</b>
                  <span>${esc(l.examType || l.subject)}</span>
                </div>
              `).join('')}
              ${ss.map(s => `
                <div class="chip session">
                  <b>${new Date(s.startsAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b>
                  <span>Koçluk · ${s.durationMinutes} dk</span>
                </div>
              `).join('')}
              ${ts.map(t => `
                <div class="chip ${t.isCompleted ? 'done' : 'todo'}">
                  <b>${esc(t.title.slice(0, 15))}</b>
                  <span>${t.completedQuestions || 0} / ${t.targetQuestions || 0}</span>
                </div>
              `).join('')}
              ${!ts.length && !ss.length && !ls.length ? '<div class="week-none">—</div>' : ''}
            </div>
          `;
        }).join('')}
      </div>

      <div style="background:#fff;border-radius:20px;padding:24px;margin-bottom:24px">
        <h3 style="margin:0 0 16px;color:#1e1b4b;display:flex;align-items:center;gap:10px">
          <span>📊 Konu Bazlı Başarı</span>
          <span style="font-size:12px;background:#eef2ff;color:#4338ca;padding:4px 8px;border-radius:8px;font-weight:600">${topicStats.length} konu</span>
        </h3>
        ${topicStats.length ? `
          <div style="display:grid;gap:12px">
            ${topicStats.map(t => `
              <div style="display:grid;grid-template-columns:1fr 60px;gap:12px;align-items:center;padding:12px;background:#f6f7fd;border-radius:12px">
                <div>
                  <div style="font-weight:600;color:#1e1b4b;margin-bottom:4px">${esc(t.subject)} · ${esc(t.topic)}</div>
                  <div style="font-size:12px;color:#64748b">${t.total} soru</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:20px;font-weight:700;color:${t.rate >= 75 ? '#16a34a' : t.rate >= 50 ? '#d97706' : '#e11d48'};margin-bottom:2px">%${t.rate}</div>
                  <div style="height:4px;background:#e6e8f5;border-radius:2px;overflow:hidden">
                    <div style="height:100%;background:${t.rate >= 75 ? '#16a34a' : t.rate >= 50 ? '#d97706' : '#e11d48'};width:${t.rate}%"></div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="perf-empty">Henüz veri yok</div>'}
      </div>
    `;
  }
})();
