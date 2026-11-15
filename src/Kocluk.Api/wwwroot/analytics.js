/* Performans & analiz sayfası (koç / yönetici).
   Veri kaynakları: question-attempts, plans, subjects, exams, sessions. Sunucuya yeni yazma yapmaz;
   alarm durumları ve veli görüşü tarayıcıda (localStorage) tutulur. */
(() => {
  const DAY = 86400000;
  const TABS = [['perf', '📊 Performans'], ['topic', '🔬 Konu analizi'], ['week', '🗓️ Haftalık program'], ['alarms', '🔔 Alarmlar'], ['report', '👪 Veli raporu']];
  const RANGES = [['7', 'Son 7 gün'], ['30', 'Son 30 gün'], ['all', 'Tüm zamanlar']];
  const key = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const r1 = v => (Math.round(v * 10) / 10).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const windowStart = offset => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + (offset || 0) * 7); return x; };
  const windowDays = offset => { const s = windowStart(offset); return [...Array(7)].map((_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; }); };
  const tone = rate => rate >= 80 ? 'good' : rate >= 60 ? 'mid' : 'low';

  function agg(list) {
    const total = list.length, correct = list.filter(a => a.isCorrect).length, blank = list.filter(a => a.isBlank && !a.isCorrect).length;
    const wrong = total - correct - blank;
    return { total, correct, wrong, blank, net: correct - wrong / 4, rate: total ? correct * 100 / total : 0, days: new Set(list.map(a => key(a.attemptedAtUtc))).size };
  }
  function byTopic(list) {
    const map = new Map();
    list.forEach(a => { const k = a.subject + '||' + a.topic; if (!map.has(k)) map.set(k, { subject: a.subject, topic: a.topic, items: [] }); map.get(k).items.push(a); });
    return [...map.values()].map(g => ({ ...g, ...agg(g.items) })).sort((a, b) => b.total - a.total);
  }

  window.loadPerformancePage = async function (ctx) {
    const { authRequest, escapeHtml: esc, tenantId } = ctx;
    const content = document.querySelector('.content');
    const st = { students: [], studentId: localStorage.getItem('perfStudent') || '', range: '30', tab: 'perf', weekOffset: 0, topicKey: '', alarmFilter: 'active', data: null, lessonExamType: 'TYT', lessonSubject: '', lessonTopic: '', lessonDate: '', lessonStart: '', lessonEnd: '', lessonNote: '', lessonQuestions: '', lessonMsg: '', lessonMsgErr: false };
    content.innerHTML = '<div class="welcome"><div><h1>Performans & analiz</h1><p>Öğrencinin çalışma, soru çözümü ve plan verilerini tek ekranda izle.</p></div></div><div id="perf-root" class="perf"><div class="perf-empty">Yükleniyor…</div></div>';
    const root = document.getElementById('perf-root');

    const get = async path => { try { const r = await authRequest('/api/tenants/' + tenantId + path); return r.ok ? await r.json() : []; } catch { return []; } };
    const sRes = await get('/students'); st.students = Array.isArray(sRes) ? sRes : [];
    if (!st.students.length) { root.innerHTML = '<div class="perf-empty"><div class="perf-emoji">🎓</div><strong>Henüz öğrenci yok</strong><p>Öğrenci ekledikten sonra analizleri burada görürsün.</p></div>'; return; }
    if (!st.students.some(s => s.id === st.studentId)) st.studentId = st.students[0].id;

    async function loadData() {
      localStorage.setItem('perfStudent', st.studentId);
      root.querySelector('.perf-body')?.classList.add('loading');
      await importLegacyLessons();
      const [attempts, plans, subjects, exams, sessions, lessons] = await Promise.all(['question-attempts', 'plans', 'subjects', 'exams', 'sessions', 'lesson-slots'].map(p => get('/students/' + st.studentId + '/' + p)));
      st.data = {
        lessons: Array.isArray(lessons) ? lessons : [],
        attempts: (Array.isArray(attempts) ? attempts : []).map(a => ({ ...a, d: new Date(a.attemptedAtUtc) })),
        tasks: (Array.isArray(plans) ? plans : []).flatMap(p => (p.tasks || []).map(t => ({ ...t, planTitle: p.title }))),
        subjects: Array.isArray(subjects) ? subjects : [], exams: Array.isArray(exams) ? exams : [], sessions: Array.isArray(sessions) ? sessions : []
      };
      st.topicKey = '';
    }
    const student = () => st.students.find(s => s.id === st.studentId) || {};
    const studentName = () => (student().firstName + ' ' + (student().lastName || '')).trim();
    const ranged = () => { if (st.range === 'all') return st.data.attempts; const from = Date.now() - Number(st.range) * DAY; return st.data.attempts.filter(a => a.d.getTime() >= from); };

    /* ---------- Sekme: Performans ---------- */
    function viewPerf() {
      const list = ranged(), t = agg(list), topics = byTopic(list);
      if (!list.length) return empty('📝', 'Bu dönemde çözülmüş soru yok', 'Öğrenci koçun atadığı soruları çözdükçe konu bazlı analiz burada oluşur.');
      return `<div class="perf-stats">${stat('📘', 'Çalışma günü', t.days, 'indigo')}${stat('📄', 'Toplam soru', t.total, 'violet')}${stat('🎯', 'Başarı oranı', '%' + r1(t.rate), 'teal')}${stat('📈', 'Toplam net', r1(t.net), 'amber')}</div>
      <h3 class="perf-h">Konu detayları <span class="tag">${topics.length} konu</span></h3>
      <div class="perf-topics">${topics.map(x => topicCard(x)).join('')}</div>`;
    }
    const topicCard = x => `<button type="button" class="topic-card ${tone(x.rate)}" data-open-topic="${esc(x.subject + '||' + x.topic)}"><div class="topic-top"><div><strong>${esc(x.subject)}</strong><small>${esc(x.topic)}</small></div><span class="topic-rate">%${r1(x.rate)}</span></div><div class="topic-bar"><span style="width:${Math.min(100, x.rate)}%"></span></div><div class="topic-nums">${num(x.days, 'Çalışma')}${num(x.total, 'Soru')}${num(x.correct, 'Doğru', 'ok')}${num(x.wrong, 'Yanlış', 'bad')}${num(x.blank, 'Boş')}${num(r1(x.net), 'Net')}</div></button>`;
    const num = (v, label, cls = '') => `<div class="n ${cls}"><b>${v}</b><span>${label}</span></div>`;
    const stat = (icon, label, value, color) => `<div class="pstat ${color}"><span class="pstat-ico">${icon}</span><div><b>${value}</b><small>${label}</small></div></div>`;
    const empty = (emoji, title, text) => `<div class="perf-empty"><div class="perf-emoji">${emoji}</div><strong>${title}</strong><p>${text}</p></div>`;

    /* ---------- Sekme: Konu analizi ---------- */
    function viewTopic() {
      const all = byTopic(st.data.attempts);
      if (!all.length) return empty('🔬', 'Analiz edilecek veri yok', 'Öğrenci soru çözdükçe konu bazlı detaylar burada görünür.');
      if (!st.topicKey || !all.some(x => x.subject + '||' + x.topic === st.topicKey)) st.topicKey = all[0].subject + '||' + all[0].topic;
      const cur = all.find(x => x.subject + '||' + x.topic === st.topicKey), t = agg(cur.items);
      const prog = st.data.subjects.find(s => s.subject === cur.subject && s.topic === cur.topic);
      const perDay = new Map(); cur.items.forEach(a => { const k = key(a.d); if (!perDay.has(k)) perDay.set(k, []); perDay.get(k).push(a); });
      const pts = [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => { const g = agg(v); return { k, y: g.total ? Math.max(0, g.net) * 100 / g.total : 0 }; });
      return `<div class="topic-picker"><label>Konu<select id="perf-topic">${all.map(x => { const k = x.subject + '||' + x.topic; return `<option value="${esc(k)}" ${k === st.topicKey ? 'selected' : ''}>${esc(x.subject)} · ${esc(x.topic)}</option>`; }).join('')}</select></label></div>
      <div class="analysis-card"><div class="an-head"><span class="star">★</span><div><h3>${esc(cur.subject)}</h3><p>${esc(cur.topic)}</p></div></div>
        <div class="an-progress"><div class="an-progress-top"><span>Konu ilerlemesi</span><b>${prog ? '%' + prog.completionPercent : 'Girilmedi'}</b></div><div class="topic-bar big"><span style="width:${prog ? prog.completionPercent : 0}%"></span></div></div>
        <div class="an-grid"><table class="an-table"><caption>Çözülen soru (tüm zamanlar)</caption><tr><th>Gün</th><td>${t.days}</td></tr><tr><th>SS</th><td>${t.total}</td></tr><tr><th>D</th><td class="ok">${t.correct}</td></tr><tr><th>Y</th><td class="bad">${t.wrong}</td></tr><tr><th>B</th><td>${t.blank}</td></tr><tr><th>N</th><td><b>${r1(t.net)}</b></td></tr></table>
          <div class="donut-wrap">${donut(t.rate)}<small>Doğru oranı</small></div></div>
        <div class="an-trend"><h4>Net / SS oranı <small>(gün bazında başarı)</small></h4>${trend(pts)}</div></div>`;
    }
    function donut(p) {
      const R = 52, C = 2 * Math.PI * R, v = Math.max(0, Math.min(100, p));
      return `<svg viewBox="0 0 140 140" class="donut"><circle cx="70" cy="70" r="${R}" fill="none" stroke="#e8eafb" stroke-width="14"/><circle cx="70" cy="70" r="${R}" fill="none" stroke="url(#dg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 70 70)"/><defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs><text x="70" y="77" text-anchor="middle" font-size="24" font-weight="800" fill="#1e1b4b">${Math.round(v)}%</text></svg>`;
    }
    function trend(pts) {
      if (pts.length < 2) return '<p class="perf-muted">Trend için en az iki farklı çalışma günü gerekir.</p>';
      const W = 360, H = 130, pad = 22, max = Math.max(100, ...pts.map(p => p.y)), min = 0;
      const x = i => pad + i * (W - pad * 2) / (pts.length - 1), y = v => H - pad - (v - min) / (max - min) * (H - pad * 2);
      const line = pts.map((p, i) => x(i).toFixed(1) + ',' + y(p.y).toFixed(1)).join(' ');
      return `<svg viewBox="0 0 ${W} ${H}" class="trend"><polygon points="${x(0)},${H - pad} ${line} ${x(pts.length - 1)},${H - pad}" fill="rgba(79,70,229,.10)"/><polyline points="${line}" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3.5" fill="#fff" stroke="#4f46e5" stroke-width="2"><title>${p.k}: %${r1(p.y)}</title></circle>`).join('')}<text x="${pad}" y="12" font-size="10" fill="#64748b">${r1(Math.max(...pts.map(p => p.y)))}</text><text x="${pad}" y="${H - 6}" font-size="10" fill="#64748b">${pts[0].k.slice(5)}</text><text x="${W - pad}" y="${H - 6}" font-size="10" text-anchor="end" fill="#64748b">${pts[pts.length - 1].k.slice(5)}</text></svg>`;
    }

    /* ---------- Sekme: Haftalık program ---------- */
    const lessonLabel = l => (l.examType ? (l.examType === 'YÖS' ? 'TR-YÖS' : l.examType) + ' · ' : '') + l.subject;
    function ensureLessonSelection() {
      const exams = getExamTypes();
      if (!exams.some(e => e.code === st.lessonExamType)) st.lessonExamType = exams[0].code;
      const subjects = getSubjectsByExam(st.lessonExamType);
      if (!subjects.some(s => s.code === st.lessonSubject)) { st.lessonSubject = subjects[0]?.code || ''; st.lessonTopic = ''; }
      if (st.lessonTopic && !getTopicsByExamAndSubject(st.lessonExamType, st.lessonSubject).includes(st.lessonTopic)) st.lessonTopic = '';
    }
    const lessonStore = () => st.data?.lessons || [];
    const api = async (method, path, body) => {
      try {
        const r = await authRequest('/api/tenants/' + tenantId + path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
        return { ok: r.ok, data: r.status === 204 ? null : await r.json().catch(() => null) };
      } catch { return { ok: false, data: null }; }
    };
    const withSeconds = t => (t && t.length === 5 ? t + ':00' : t || null);
    const lessonBody = l => ({ date: l.date, startTime: withSeconds(l.startTime), endTime: withSeconds(l.endTime), examType: l.examType, subject: l.subject, topic: l.topic || null, note: l.note || null, questionCount: l.questionCount ? Number(l.questionCount) : null });
    async function importLegacyLessons() {
      const legacyKey = 'kocluk-lessons-' + st.studentId;
      let legacy = []; try { legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]'); } catch { }
      if (!Array.isArray(legacy) || !legacy.length) { localStorage.removeItem(legacyKey); return; }
      for (const l of legacy) await api('POST', '/students/' + st.studentId + '/lesson-slots', lessonBody({ ...l, examType: l.examType || 'Özel' }));
      localStorage.setItem('kocluk-lessons-imported-' + st.studentId, JSON.stringify(legacy));
      localStorage.removeItem(legacyKey);
    }
    function viewWeek() {
      const days = windowDays(st.weekOffset), keys = days.map(key), todayKey = key(new Date());
      const tasks = st.data.tasks.filter(t => keys.includes(t.dueDate));
      const sessions = st.data.sessions.filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected' && keys.includes(key(s.startsAtUtc)));
      const lessons = lessonStore().filter(l => keys.includes(l.date));
      const done = tasks.filter(t => t.isCompleted).length, pct = tasks.length ? Math.round(done * 100 / tasks.length) : 0;
      const target = tasks.reduce((s, t) => s + (t.targetQuestions || 0), 0), solved = tasks.reduce((s, t) => s + (t.completedQuestions || 0), 0);
      const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const cls = t => t.isCompleted ? 'done' : (t.dueDate < todayKey ? 'late' : (t.completedQuestions > 0 ? 'part' : 'todo'));
      const clock = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const span = l => l.startTime.slice(0, 5) + (l.endTime ? ' – ' + l.endTime.slice(0, 5) : '');
      const overdue = st.weekOffset === 0 ? st.data.tasks.filter(t => !t.isCompleted && t.dueDate < todayKey) : [];
      const lessonChip = l => `<div class="chip lesson" draggable="true" data-lesson-id="${esc(l.id)}" data-lesson-date="${l.date}" title="${esc(lessonLabel(l) + (l.topic ? ' · ' + l.topic : '') + (l.questionCount ? ' · ' + l.questionCount + ' soru' : '') + (l.note ? ' · ' + l.note : '') + ' · ' + span(l))}"><b class="chip-time">${span(l)}</b><strong>${esc(lessonLabel(l))}</strong>${l.topic ? `<small class="chip-topic">${esc(l.topic.replace(/^.* - /, ''))}</small>` : ''}${l.questionCount ? `<small class="chip-meta">✏️ ${l.questionCount} soru</small>` : ''}${l.note ? `<small class="chip-note">📝 ${esc(l.note)}</small>` : ''}<button type="button" class="chip-del" data-del-lesson="${esc(l.id)}" aria-label="Dersi sil">✕</button></div>`;
      const sessionChip = s => `<div class="chip session"><b class="chip-time">${clock(s.startsAtUtc)}</b><strong>Koçluk görüşmesi</strong><small class="chip-topic">${s.durationMinutes} dk</small></div>`;
      const taskChip = t => `<div class="chip ${cls(t)}" title="${esc(t.planTitle || '')}"><strong>${esc(t.title)}</strong><small class="chip-topic">${t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru'}</small></div>`;
      const column = (d, i) => {
        const k = keys[i], isToday = k === todayKey;
        const items = lessons.filter(l => l.date === k).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(lessonChip).join('')
          + sessions.filter(s => key(s.startsAtUtc) === k).sort((a, b) => new Date(a.startsAtUtc) - new Date(b.startsAtUtc)).map(sessionChip).join('')
          + tasks.filter(t => t.dueDate === k).map(taskChip).join('');
        return `<div class="week-col ${isToday ? 'today' : ''}" data-date-key="${k}"><div class="week-head"><div class="wh-day"><b>${DOW[d.getDay()]}</b>${isToday ? '<em>Bugün</em>' : ''}</div><div class="wh-date"><span>${d.getDate()}</span><small>${d.toLocaleDateString('tr-TR', { month: 'short' })}</small></div></div><div class="week-items">${items || '<div class="week-none">Boş gün</div>'}</div><button type="button" class="week-add" data-add-day="${k}">＋ Ders ekle</button></div>`;
      };
      return `<div class="perf-stats compact">${stat('🗒️', 'Toplam görev', tasks.length, 'indigo')}${stat('✅', 'Tamamlanan', done, 'teal')}${stat('📊', 'Tamamlanma', '%' + pct, 'amber')}${stat('✏️', 'Çözülen / hedef soru', solved + ' / ' + target, 'violet')}</div>
      ${overdue.length ? `<div class="week-overdue"><b>⚠️ ${overdue.length} geciken görev</b><span>${overdue.slice(0, 3).map(t => esc(t.title) + ' (' + fmt(new Date(t.dueDate + 'T00:00:00')) + ')').join(' · ')}${overdue.length > 3 ? ' …' : ''}</span></div>` : ''}
      <div id="week-form-container"></div>
      <div class="week-nav"><button type="button" data-week="-1" aria-label="Önceki 7 gün">‹</button><span>${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}</span><button type="button" data-week="1" aria-label="Sonraki 7 gün">›</button>${st.weekOffset ? '<button type="button" data-week="0" class="today">Bugüne dön</button>' : '<em class="week-note">Bugünden itibaren 7 gün</em>'}</div>
      <div class="week-grid" id="week-grid-root">${days.map(column).join('')}</div>
      <div class="week-legend"><span class="d lesson"></span>Ders<span class="d session"></span>Görüşme<span class="d done"></span>Tamamlandı<span class="d part"></span>Devam ediyor<span class="d todo"></span>Bekliyor<span class="d late"></span>Geciken</div>`;
    }

    /* ---------- Sekme: Alarmlar ---------- */
    const alarmStore = () => { try { return JSON.parse(localStorage.getItem('kocluk-alarms-' + st.studentId) || '{}'); } catch { return {}; } };
    const saveAlarms = v => localStorage.setItem('kocluk-alarms-' + st.studentId, JSON.stringify(v));
    function computeAlarms() {
      const out = [], a = st.data.attempts, now = new Date(), todayKey = key(now);
      const last = a.length ? new Date(Math.max(...a.map(x => x.d.getTime()))) : null;
      const idle = last ? Math.floor((now - last) / DAY) : null;
      if (!last) out.push({ id: 'noactivity', level: 'watch', title: 'Henüz soru çözülmemiş', desc: 'Öğrenci bu alanda hiç soru çözmedi. İlk çalışmayı atamayı düşün.', date: todayKey });
      else if (idle >= 3) out.push({ id: 'inactive:' + key(last), level: idle >= 7 ? 'high' : 'watch', title: idle + ' gündür soru çözmüyor', desc: 'Son çalışma: ' + last.toLocaleDateString('tr-TR') + '. Öğrenciyle iletişime geçmek faydalı olabilir.', date: key(last) });
      const late = st.data.tasks.filter(t => !t.isCompleted && t.dueDate < todayKey);
      if (late.length) out.push({ id: 'overdue:' + late.length + ':' + late.map(t => t.dueDate).sort().pop(), level: late.length >= 3 ? 'high' : 'watch', title: late.length + ' geciken plan görevi', desc: late.slice(0, 3).map(t => t.title).join(', ') + (late.length > 3 ? ' ve diğerleri' : '') + ' zamanında tamamlanmadı.', date: late.map(t => t.dueDate).sort().pop() });
      byTopic(a).filter(t => t.total >= 10 && t.rate < 65).forEach(t => out.push({ id: 'weak:' + t.subject + '|' + t.topic, level: t.rate < 50 ? 'high' : 'watch', title: t.subject + ' · ' + t.topic + ' zayıf', desc: t.total + ' sorunun %' + r1(t.rate) + "'i doğru. Bu konuya ek çalışma planla.", date: todayKey }));
      const ex = [...st.data.exams].sort((x, y) => String(y.examDate).localeCompare(String(x.examDate)));
      if (ex.length >= 2) { const n = e => e.correct - e.wrong / 4; if (n(ex[0]) <= n(ex[1]) - 2) out.push({ id: 'examdrop:' + ex[0].id, level: n(ex[0]) <= n(ex[1]) - 5 ? 'high' : 'watch', title: 'Deneme neti düştü', desc: '"' + ex[0].title + '" denemesinde net ' + r1(n(ex[0])) + '; önceki ' + r1(n(ex[1])) + '.', date: String(ex[0].examDate) }); }
      st.data.sessions.filter(s => s.status === 'PendingStudent' || s.status === 'Pending').forEach(s => out.push({ id: 'session:' + s.id, level: 'watch', title: 'Onay bekleyen görüşme', desc: new Date(s.startsAtUtc).toLocaleString('tr-TR') + ' tarihli görüşme henüz onaylanmadı.', date: key(s.startsAtUtc) }));
      return out;
    }
    function viewAlarms() {
      const store = alarmStore(), alarms = computeAlarms(), now = Date.now(); let dirty = false;
      alarms.forEach(al => { if (!store[al.id]) { store[al.id] = { firstSeen: now }; dirty = true; } al.s = store[al.id]; al.state = al.s.status === 'resolved' ? 'resolved' : (al.s.status === 'snoozed' && al.s.until > now ? 'snoozed' : 'active'); al.isNew = al.state === 'active' && now - al.s.firstSeen < 2 * DAY; });
      if (dirty) saveAlarms(store);
      const active = alarms.filter(a => a.state === 'active'), high = active.filter(a => a.level === 'high'), fresh = active.filter(a => a.isNew);
      const f = st.alarmFilter, shown = alarms.filter(a => f === 'active' ? a.state === 'active' : f === 'new' ? a.isNew : f === 'high' ? (a.state === 'active' && a.level === 'high') : f === 'snoozed' ? a.state === 'snoozed' : a.state === 'resolved').sort((a, b) => (a.level === 'high' ? 0 : 1) - (b.level === 'high' ? 0 : 1));
      const chip = (id, label) => `<button type="button" class="fchip ${f === id ? 'on' : ''}" data-alarm-filter="${id}">${label}</button>`;
      return `<div class="alarm-stats"><div class="as new"><b>${fresh.length}</b><span>Yeni</span></div><div class="as high"><b>${high.length}</b><span>Yüksek</span></div><div class="as act"><b>${active.length}</b><span>Aktif</span></div></div>
      <div class="fchips">${chip('active', 'Aktif')}${chip('new', 'Yeni')}${chip('high', 'Yüksek')}${chip('snoozed', 'Ertelenen')}${chip('resolved', 'Çözülen')}</div>
      ${shown.length ? shown.map(a => `<div class="alarm ${a.level}"><span class="alarm-ico">${a.level === 'high' ? '🚨' : '🔔'}</span><div class="alarm-body"><strong>${esc(a.title)}</strong><p>${esc(a.desc)}</p><div class="alarm-tags"><span class="tag ${a.level === 'high' ? 'hi' : ''}">${a.level === 'high' ? 'Yüksek' : 'Takip'}</span>${a.isNew ? '<span class="tag">Yeni</span>' : ''}<span class="tag muted">${esc(a.date)}</span></div></div><div class="alarm-actions">${a.state === 'active' ? `<button type="button" data-alarm="${esc(a.id)}" data-act="snooze">Ertele</button><button type="button" data-alarm="${esc(a.id)}" data-act="resolve" class="ok">Çözüldü</button>` : `<button type="button" data-alarm="${esc(a.id)}" data-act="reopen">Geri al</button>`}</div></div>`).join('') : empty('✅', 'Bu filtrede alarm yok', 'Her şey yolunda görünüyor.')}
      <p class="perf-note">Alarmlar çalışma, plan, deneme ve görüşme verilerinden otomatik üretilir. Ertele/Çözüldü durumu bu tarayıcıda saklanır.</p>`;
    }

    /* ---------- Sekme: Veli raporu ---------- */
    const commentKey = () => 'kocluk-report-comment-' + st.studentId;
    function reportModel() {
      const list = ranged(), t = agg(list), topics = byTopic(list).filter(x => x.total >= 3);
      const strong = [...topics].sort((a, b) => b.rate - a.rate).slice(0, 3), weak = [...topics].sort((a, b) => a.rate - b.rate).filter(x => x.rate < 75).slice(0, 3);
      const tasks = st.data.tasks, done = tasks.filter(x => x.isCompleted).length, ex = [...st.data.exams].sort((x, y) => String(y.examDate).localeCompare(String(x.examDate)))[0];
      const rangeLabel = RANGES.find(r => r[0] === st.range)[1], coach = document.getElementById('profile-name')?.textContent?.trim() || 'Eğitim koçu';
      return { t, strong, weak, tasks, done, ex, rangeLabel, coach };
    }
    function viewReport() {
      const { t, strong, weak, tasks, done, ex, rangeLabel, coach } = reportModel();
      const li = x => `<li><b>${esc(x.subject)} · ${esc(x.topic)}</b> <span>%${r1(x.rate)} · ${x.total} soru</span></li>`;
      return `<div class="report-tools"><div class="card-lite"><label for="report-comment">💬 Öğretmen görüşü <small>(isteğe bağlı, rapora eklenir)</small></label><textarea id="report-comment" rows="3" placeholder="Örn: ${esc(student().firstName || 'Öğrenci')} son zamanlarda çok iyi gidiyor. Bu istikrarı sürdürelim.">${esc(localStorage.getItem(commentKey()) || '')}</textarea></div><div class="report-actions"><button type="button" class="primary" id="report-image">🖼️ Görsel olarak WhatsApp'a gönder</button><button type="button" class="lf-pub" id="report-pdf">📄 PDF olarak gönder</button><button type="button" class="lf-pub" id="report-print">🖨️ Yazdır</button><span class="lf-msg" id="report-share-msg"></span></div></div>
      <div id="perf-report" class="report"><div class="report-head"><div><small>Öğrenci gelişim raporu</small><h2>${esc(studentName())}</h2><p>${rangeLabel} · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div class="report-brand"><img src="/logo.svg" width="42" height="42" alt=""><span>Alas Eğitim Koçluk</span></div></div>
        <div class="perf-stats">${stat('📅', 'Çalışma günü', t.days, 'indigo')}${stat('📄', 'Toplam soru', t.total, 'violet')}${stat('🎯', 'Başarı oranı', '%' + r1(t.rate), 'teal')}${stat('📈', 'Toplam net', r1(t.net), 'amber')}</div>
        <div class="report-cols"><div><h4>💪 Güçlü konular</h4><ul>${strong.length ? strong.map(li).join('') : '<li class="perf-muted">Yeterli veri yok</li>'}</ul></div><div><h4>🎯 Geliştirilecek konular</h4><ul>${weak.length ? weak.map(li).join('') : '<li class="perf-muted">Belirgin bir zayıf konu yok</li>'}</ul></div></div>
        <div class="report-cols"><div><h4>🗒️ Plan uyumu</h4><p class="report-big">${tasks.length ? done + ' / ' + tasks.length + ' görev tamamlandı' : 'Henüz plan görevi yok'}</p></div><div><h4>📝 Son deneme</h4><p class="report-big">${ex ? esc(ex.title) + ' · ' + r1(ex.correct - ex.wrong / 4) + ' net' : 'Deneme kaydı yok'}</p></div></div>
        <div class="report-comment" id="report-comment-view" ${localStorage.getItem(commentKey()) ? '' : 'hidden'}><h4>Öğretmen görüşü</h4><p>${esc(localStorage.getItem(commentKey()) || '')}</p><small>— ${esc(coach)}</small></div></div>`;
    }

    /* ---------- Görsel / PDF paylaşımı ---------- */
    const slug = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dosya';
    const phoneFor = who => { const s = student(), g = s.guardian || {}; return who === 'guardian' ? (g.phoneNumber || s.phoneNumber || '') : (s.phoneNumber || g.phoneNumber || ''); };
    const deliverMsg = (res, asPdf) => {
      if (res.mode === 'cancel') return '';
      if (res.mode === 'share') return 'Paylaşım penceresi açıldı.';
      const where = res.web ? 'WhatsApp Web açıldı' : 'WhatsApp açıldı';
      const how = asPdf ? 'PDF indirildi, ' + where + '. Sohbette 📎 → Belge ile indirilen PDF dosyasını seçin.' : (res.copied ? 'Görsel panoya kopyalandı, ' + where + '. Sohbet kutusuna tıklayıp Ctrl+V ile yapıştırın ve gönderin.' : 'Görsel indirildi, ' + where + '. Sohbette 📎 → Fotoğraflar ile indirilen görseli seçin.');
      return how + (res.hasNumber ? '' : ' Kayıtlı telefon numarası yok, sohbeti kendiniz seçin.');
    };
    async function shareReport(asPdf) {
      const msg = document.getElementById('report-share-msg');
      const say = (m, err) => { if (msg) { msg.textContent = m; msg.className = 'lf-msg' + (err ? ' err' : ''); } };
      if (!window.KoclukShare) { say('Paylaşım modülü yüklenemedi. Sayfayı yenileyin.', true); return; }
      say('Hazırlanıyor…');
      try {
        const m = reportModel(), dateLabel = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        const item = x => ({ title: x.subject + ' · ' + x.topic, sub: x.total + ' soru', value: '%' + r1(x.rate) });
        const canvas = KoclukShare.reportCanvas({
          name: studentName(), rangeLabel: m.rangeLabel, dateLabel, coach: m.coach, comment: (localStorage.getItem(commentKey()) || '').trim(),
          stats: [{ label: 'Çalışma günü', value: String(m.t.days) }, { label: 'Toplam soru', value: String(m.t.total) }, { label: 'Başarı oranı', value: '%' + r1(m.t.rate) }, { label: 'Toplam net', value: r1(m.t.net) }],
          strong: m.strong.map(item), weak: m.weak.map(item),
          plan: m.tasks.length ? m.done + ' / ' + m.tasks.length + ' görev tamamlandı' : 'Henüz plan görevi yok',
          exam: m.ex ? m.ex.title + ' · ' + r1(m.ex.correct - m.ex.wrong / 4) + ' net' : 'Deneme kaydı yok'
        });
        const blob = asPdf ? await KoclukShare.toPdf(canvas) : await KoclukShare.toBlob(canvas, 'image/png');
        const res = await KoclukShare.deliver({ blob, filename: 'gelisim-raporu-' + slug(studentName()) + (asPdf ? '.pdf' : '.png'), text: studentName() + ' - öğrenci gelişim raporu (' + m.rangeLabel + ')', phone: phoneFor('guardian') });
        say(deliverMsg(res, asPdf));
      } catch (e) { console.warn(e); say('Rapor hazırlanamadı. Tekrar deneyin.', true); }
    }
    const DOWL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    function weekShareModel() {
      const days = windowDays(st.weekOffset), keys = days.map(key), todayKey = key(new Date());
      const clock = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const lessons = lessonStore(), sessions = st.data.sessions.filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected'), tasks = st.data.tasks;
      let total = 0;
      const out = days.map((d, i) => {
        const k = keys[i];
        const items = [
          ...lessons.filter(l => l.date === k).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(l => ({ kind: 'lesson', time: l.startTime.slice(0, 5) + (l.endTime ? ' – ' + l.endTime.slice(0, 5) : ''), title: lessonLabel(l), topic: l.topic ? l.topic.replace(/^.* - /, '') : '', meta: l.questionCount ? '✏️ ' + l.questionCount + ' soru' : '', note: l.note || '' })),
          ...sessions.filter(s => key(s.startsAtUtc) === k).map(s => ({ kind: 'session', time: clock(s.startsAtUtc), title: 'Koçluk görüşmesi', topic: s.durationMinutes + ' dk', meta: '', note: '' })),
          ...tasks.filter(t => t.dueDate === k).map(t => ({ kind: 'task', time: 'Görev', title: t.title, topic: '', meta: t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru', note: '' }))
        ];
        total += items.length;
        return { label: DOWL[d.getDay()], date: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }), today: k === todayKey, items };
      });
      const range = days[0].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' – ' + days[6].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      const sessionList = sessions.filter(s => keys.includes(key(s.startsAtUtc))).sort((a, b) => new Date(a.startsAtUtc) - new Date(b.startsAtUtc)).map(s => ({ day: new Date(s.startsAtUtc).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }), time: clock(s.startsAtUtc) + (s.status === 'Confirmed' || s.status === 'Completed' ? '' : ' (onay bekliyor)'), dur: s.durationMinutes + ' dk' }));
      return { name: studentName(), range, coach: document.getElementById('profile-name')?.textContent?.trim() || '', days: out, total, sessions: sessionList };
    }
    async function shareWeek(asPdf) {
      const say = (m, err) => { st.lessonMsg = m; st.lessonMsgErr = !!err; renderWeekForm(); };
      if (!window.KoclukShare) { say('Paylaşım modülü yüklenemedi. Sayfayı yenileyin.', true); return; }
      const model = weekShareModel();
      if (!model.total) { say('Bu 7 günde paylaşılacak program yok.', true); return; }
      say('Görsel hazırlanıyor…');
      try {
        const canvas = KoclukShare.scheduleCanvas(model);
        const blob = asPdf ? await KoclukShare.toPdf(canvas) : await KoclukShare.toBlob(canvas, 'image/png');
        const res = await KoclukShare.deliver({ blob, filename: 'haftalik-program-' + slug(studentName()) + (asPdf ? '.pdf' : '.png'), text: studentName() + ' - haftalık ders programı (' + model.range + ')', phone: phoneFor(st.shareTo || 'guardian') });
        say(deliverMsg(res, asPdf));
      } catch (e) { console.warn(e); say('Program görseli hazırlanamadı. Tekrar deneyin.', true); }
    }

    /* ---------- Çerçeve ---------- */
    function renderWeekForm() {
      const cnt = document.getElementById('week-form-container');
      if (!cnt) return;
      if (typeof getExamTypes !== 'function') { cnt.innerHTML = '<p class="perf-note">Müfredat verisi yüklenemedi. Sayfayı yenileyin.</p>'; return; }
      const days = windowDays(st.weekOffset), dayKeys = days.map(key), todayKey = key(new Date());
      if (!dayKeys.includes(st.lessonDate)) st.lessonDate = dayKeys[0];
      ensureLessonSelection();
      const exams = getExamTypes(), subjects = getSubjectsByExam(st.lessonExamType), groups = getTopicGroupsByExamAndSubject(st.lessonExamType, st.lessonSubject);
      const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;
      const topicOptions = groups.map(g => g.unit ? `<optgroup label="${esc(g.unit)}">${g.topics.map(t => opt(t, t.slice(g.unit.length + 3), t === st.lessonTopic)).join('')}</optgroup>` : g.topics.map(t => opt(t, t, t === st.lessonTopic)).join('')).join('');
      cnt.innerHTML = `<div id="lesson-form" class="lesson-form">
        <div class="lf-head"><b>Ders programına ekle</b><span>Sınavı, dersi ve konuyu seç; gün ve saati belirle. Eklenen dersleri takvimde sürükleyerek başka güne taşıyabilirsin.</span></div>
        <div class="lf2-grid">
          <label class="lf2-field"><span>Sınav türü</span><select id="lesson-exam">${exams.map(e => opt(e.code, e.name, e.code === st.lessonExamType)).join('')}</select></label>
          <label class="lf2-field"><span>Ders</span><select id="lesson-subject">${subjects.map(s => opt(s.code, s.name, s.code === st.lessonSubject)).join('')}</select></label>
          <label class="lf2-field"><span>Konu <em>(isteğe bağlı)</em></span><select id="lesson-topic"><option value="">Konu seçilmedi</option>${topicOptions}</select></label>
          <label class="lf2-field"><span>Gün</span><select id="lesson-date">${days.map((d, i) => opt(dayKeys[i], DOW[d.getDay()] + ' · ' + d.getDate() + ' ' + d.toLocaleDateString('tr-TR', { month: 'long' }) + (dayKeys[i] === todayKey ? ' (Bugün)' : ''), dayKeys[i] === st.lessonDate)).join('')}</select></label>
          <label class="lf2-field"><span>Başlangıç saati</span><input id="lesson-start" type="time" value="${esc(st.lessonStart)}"></label>
          <label class="lf2-field"><span>Bitiş saati</span><input id="lesson-end" type="time" value="${esc(st.lessonEnd)}"></label>
          <label class="lf2-field"><span>Soru sayısı <em>(isteğe bağlı)</em></span><input id="lesson-questions" type="number" min="1" max="1000" inputmode="numeric" placeholder="Örn: 40" value="${esc(st.lessonQuestions)}"></label>
          <label class="lf2-field lf2-wide"><span>Not / açıklama <em>(isteğe bağlı)</em></span><input id="lesson-note" type="text" maxlength="500" placeholder="Örn: Önce konu özetini oku, sonra 40 soru çöz" value="${esc(st.lessonNote)}"></label>
        </div>
        <div class="lf2-foot"><span class="lf-msg ${st.lessonMsgErr ? 'err' : ''}">${esc(st.lessonMsg || '')}</span><button type="button" id="add-lesson" class="primary">＋ Derse ekle</button></div>
        <div class="lf2-share"><div><b>Bu 7 günlük programı paylaş</b><span>Panele bildirim gönder; WhatsApp için görsel veya PDF olarak paylaş.</span></div><div class="lf2-share-actions"><label class="lf2-who"><span>Gönderilecek kişi</span><select id="week-recipient"><option value="guardian" ${(st.shareTo || 'guardian') === 'guardian' ? 'selected' : ''}>Veli</option><option value="student" ${st.shareTo === 'student' ? 'selected' : ''}>Öğrenci</option></select></label><button type="button" id="week-publish" class="lf-pub">📣 Öğrenci ve veliye bildir</button><button type="button" id="week-image" class="lf-wa">🖼️ Görsel olarak paylaş</button><button type="button" id="week-pdf" class="lf-pub">📄 PDF</button><button type="button" id="week-share" class="lf-pub">💬 Metin</button></div></div>
      </div>`;
      const bind = (id, fn) => document.getElementById(id)?.addEventListener('change', fn);
      bind('lesson-exam', e => { st.lessonExamType = e.target.value; st.lessonSubject = ''; st.lessonTopic = ''; renderWeekForm(); });
      bind('lesson-subject', e => { st.lessonSubject = e.target.value; st.lessonTopic = ''; renderWeekForm(); });
      bind('lesson-topic', e => { st.lessonTopic = e.target.value; });
      bind('lesson-date', e => { st.lessonDate = e.target.value; });
      bind('lesson-start', e => { st.lessonStart = e.target.value; });
      bind('lesson-end', e => { st.lessonEnd = e.target.value; });
      bind('lesson-questions', e => { st.lessonQuestions = e.target.value; });
      bind('lesson-note', e => { st.lessonNote = e.target.value; });
      bind('week-recipient', e => { st.shareTo = e.target.value; });
      setupDragDrop();
    }
    function setupDragDrop() {
      const grid = document.getElementById('week-grid-root');
      if (!grid || grid.dataset.dnd) return;
      grid.dataset.dnd = '1';
      const clear = () => grid.querySelectorAll('.week-col.drag-over').forEach(c => c.classList.remove('drag-over'));
      grid.addEventListener('dragstart', e => { const chip = e.target.closest?.('.chip.lesson'); if (!chip) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('lessonId', chip.dataset.lessonId); chip.classList.add('dragging'); });
      grid.addEventListener('dragend', () => { grid.querySelectorAll('.dragging').forEach(c => c.classList.remove('dragging')); clear(); });
      grid.addEventListener('dragover', e => { const col = e.target.closest('.week-col'); if (!col) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!col.classList.contains('drag-over')) { clear(); col.classList.add('drag-over'); } });
      grid.addEventListener('dragleave', e => { if (!grid.contains(e.relatedTarget)) clear(); });
      grid.addEventListener('drop', async e => {
        const col = e.target.closest('.week-col'); clear(); if (!col) return; e.preventDefault();
        const lessonId = e.dataTransfer.getData('lessonId'); if (!lessonId) return;
        const l = lessonStore().find(x => x.id === lessonId);
        if (!l || l.date === col.dataset.dateKey) return;
        const previous = l.date; l.date = col.dataset.dateKey; render();
        const r = await api('PUT', '/lesson-slots/' + l.id, lessonBody(l));
        if (!r.ok) { l.date = previous; st.lessonMsg = r.data?.error || 'Ders taşınamadı.'; st.lessonMsgErr = true; render(); }
      });
    }
    function shareWeekSchedule() {
      const m = weekShareModel();
      if (!m.total) { st.lessonMsg = 'Bu 7 günde paylaşılacak program yok.'; st.lessonMsgErr = true; renderWeekForm(); return; }
      const icon = kind => kind === 'task' ? '📌 ' : kind === 'session' ? '💬 ' : '🕐 ';
      const blocks = m.days.filter(d => d.items.length).map(d => '*' + d.label + ', ' + d.date + '*\n' + d.items.map(i => icon(i.kind) + i.time + '  ' + i.title + (i.topic ? '\n     ▫️ ' + i.topic : '') + (i.meta ? '\n     ' + i.meta : '') + (i.note ? '\n     📝 ' + i.note : '')).join('\n'));
      const sessions = m.sessions.length ? '\n\n*Koçluk görüşmeleri*\n' + m.sessions.map(s => '💬 ' + s.day + ' · ' + s.time + ' · ' + s.dur).join('\n') : '';
      const body = '📚 *' + m.name + ' - Haftalık Ders Programı*\n' + m.range + '\n\n' + blocks.join('\n\n') + sessions + '\n\n_Alas Eğitim Koçluk panelinden gönderildi_';
      const number = (window.KoclukShare && KoclukShare.normalizePhone(phoneFor(st.shareTo || 'guardian'))) || '';
      window.open(window.KoclukShare ? KoclukShare.whatsappUrl(number, body) : 'https://web.whatsapp.com/send?text=' + encodeURIComponent(body), '_blank');
    }
    function render() {
      const views = { perf: viewPerf, topic: viewTopic, week: viewWeek, alarms: viewAlarms, report: viewReport };
      root.innerHTML = `<div class="perf-bar"><label>Öğrenci<select id="perf-student">${st.students.map(s => `<option value="${s.id}" ${s.id === st.studentId ? 'selected' : ''}>${esc(s.firstName + ' ' + (s.lastName || ''))}</option>`).join('')}</select></label>${['perf', 'topic', 'report'].includes(st.tab) ? `<label>Dönem<select id="perf-range">${RANGES.map(r => `<option value="${r[0]}" ${r[0] === st.range ? 'selected' : ''}>${r[1]}</option>`).join('')}</select></label>` : ''}</div>
        <div class="perf-tabs">${TABS.map(([id, label]) => `<button type="button" class="${st.tab === id ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('')}</div><div class="perf-body">${views[st.tab]()}</div>`;
      if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0);
    }
    root.addEventListener('click', async event => {
      const t = event.target.closest('[data-tab],[data-week],[data-alarm-filter],[data-alarm],[data-open-topic],#report-print,[data-del-lesson],#add-lesson,#week-share,#week-publish,[data-add-day],#report-image,#report-pdf,#week-image,#week-pdf'); if (!t) return;
      if (t.dataset.addDay) { st.lessonDate = t.dataset.addDay; renderWeekForm(); document.getElementById('lesson-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else if (t.dataset.tab) { st.tab = t.dataset.tab; render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
      else if (t.dataset.week !== undefined) { st.weekOffset = t.dataset.week === '0' ? 0 : st.weekOffset + Number(t.dataset.week); render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
      else if (t.dataset.alarmFilter) { st.alarmFilter = t.dataset.alarmFilter; render(); }
      else if (t.dataset.openTopic) { st.topicKey = t.dataset.openTopic; st.tab = 'topic'; render(); }
      else if (t.dataset.alarm) { const store = alarmStore(), a = store[t.dataset.alarm] || { firstSeen: Date.now() }; if (t.dataset.act === 'resolve') a.status = 'resolved'; else if (t.dataset.act === 'snooze') { a.status = 'snoozed'; a.until = Date.now() + DAY; } else delete a.status; store[t.dataset.alarm] = a; saveAlarms(store); render(); }
      else if (t.id === 'report-image' || t.id === 'report-pdf') await shareReport(t.id === 'report-pdf');
      else if (t.id === 'week-image' || t.id === 'week-pdf') await shareWeek(t.id === 'week-pdf');
      else if (t.id === 'report-print') window.print();
      else if (t.dataset.delLesson) {
        if (!confirm('Bu ders programdan silinsin mi?')) return;
        const id = t.dataset.delLesson, r = await api('DELETE', '/lesson-slots/' + id);
        if (r.ok) { st.data.lessons = st.data.lessons.filter(l => l.id !== id); st.lessonMsg = 'Ders silindi.'; st.lessonMsgErr = false; }
        else { st.lessonMsg = 'Ders silinemedi.'; st.lessonMsgErr = true; }
        render();
      }
      else if (t.id === 'week-publish') {
        const r = await api('POST', '/students/' + st.studentId + '/lesson-slots/publish', { weekStart: key(windowStart(st.weekOffset)) });
        st.lessonMsgErr = !r.ok;
        st.lessonMsg = r.ok ? (r.data.notified ? r.data.notified + ' kişiye bildirim gönderildi.' : 'Program öğrencinin takviminde görünüyor; bağlı öğrenci/veli hesabı olmadığı için bildirim gitmedi.') : (r.data?.error || 'Program gönderilemedi.');
        renderWeekForm();
      }
      else if (t.id === 'add-lesson') {
        st.lessonDate = document.getElementById('lesson-date')?.value || st.lessonDate;
        st.lessonStart = document.getElementById('lesson-start')?.value || '';
        st.lessonEnd = document.getElementById('lesson-end')?.value || '';
        st.lessonQuestions = document.getElementById('lesson-questions')?.value || '';
        st.lessonNote = (document.getElementById('lesson-note')?.value || '').trim();
        const questionCount = st.lessonQuestions ? Number(st.lessonQuestions) : null;
        const subj = getSubjectsByExam(st.lessonExamType).find(s => s.code === st.lessonSubject);
        const fail = msg => { st.lessonMsg = msg; st.lessonMsgErr = true; };
        if (!subj) fail('Önce bir ders seç.');
        else if (!st.lessonStart) fail('Başlangıç saatini gir.');
        else if (st.lessonEnd && st.lessonEnd <= st.lessonStart) fail('Bitiş saati başlangıçtan sonra olmalı.');
        else if (questionCount !== null && !(Number.isInteger(questionCount) && questionCount >= 1 && questionCount <= 1000)) fail('Soru sayısı 1 ile 1000 arasında bir sayı olmalı.');
        else {
          const r = await api('POST', '/students/' + st.studentId + '/lesson-slots', lessonBody({ date: st.lessonDate, examType: st.lessonExamType, subject: subj.name, topic: st.lessonTopic, startTime: st.lessonStart, endTime: st.lessonEnd, note: st.lessonNote, questionCount }));
          if (r.ok) { st.data.lessons.push(r.data); st.lessonMsg = 'Ders eklendi.'; st.lessonMsgErr = false; st.lessonNote = ''; st.lessonQuestions = ''; }
          else fail(r.data?.error || 'Ders kaydedilemedi.');
        }
        render();
      }
      else if (t.id === 'week-share') shareWeekSchedule();
    });
    root.addEventListener('change', async event => {
      if (event.target.id === 'perf-student') { st.studentId = event.target.value; root.querySelector('.perf-body').innerHTML = '<div class="perf-empty">Yükleniyor…</div>'; await loadData(); render(); }
      else if (event.target.id === 'perf-range') { st.range = event.target.value; render(); }
      else if (event.target.id === 'perf-topic') { st.topicKey = event.target.value; render(); }
    });
    root.addEventListener('input', event => {
      if (event.target.id !== 'report-comment') return;
      localStorage.setItem(commentKey(), event.target.value);
      const view = document.getElementById('report-comment-view'); if (view) { view.hidden = !event.target.value.trim(); view.querySelector('p').textContent = event.target.value; }
    });
    await loadData(); render();
  };
})();
