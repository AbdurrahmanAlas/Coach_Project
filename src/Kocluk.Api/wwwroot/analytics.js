/* Performans & analiz sayfası (koç / yönetici).
   Veri kaynakları: question-attempts, plans, subjects, exams, sessions. Sunucuya yeni yazma yapmaz;
   alarm durumları ve veli görüşü tarayıcıda (localStorage) tutulur. */
(() => {
  const DAY = 86400000;
  const TABS = [['perf', '📊 Performans'], ['topic', '🔬 Konu analizi'], ['week', '🗓️ Haftalık program'], ['alarms', '🔔 Alarmlar'], ['report', '👪 Veli raporu']];
  const RANGES = [['7', 'Son 7 gün'], ['30', 'Son 30 gün'], ['all', 'Tüm zamanlar']];
  const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const key = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const r1 = v => (Math.round(v * 10) / 10).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const weekStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
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
    const st = { students: [], studentId: localStorage.getItem('perfStudent') || '', range: '30', tab: 'perf', weekOffset: 0, topicKey: '', alarmFilter: 'active', data: null, lessonExamType: 'TYT', lessonSubject: '', lessonTopic: '', lessonDate: '', lessonStart: '', lessonEnd: '', lessonMsg: '', lessonMsgErr: false, curriculum: null };
    content.innerHTML = '<div class="welcome"><div><h1>Performans & analiz</h1><p>Öğrencinin çalışma, soru çözümü ve plan verilerini tek ekranda izle.</p></div></div><div id="perf-root" class="perf"><div class="perf-empty">Yükleniyor…</div></div>';
    const root = document.getElementById('perf-root');

    const get = async path => { try { const r = await authRequest('/api/tenants/' + tenantId + path); return r.ok ? await r.json() : []; } catch { return []; } };
    const sRes = await get('/students'); st.students = Array.isArray(sRes) ? sRes : [];
    if (!st.students.length) { root.innerHTML = '<div class="perf-empty"><div class="perf-emoji">🎓</div><strong>Henüz öğrenci yok</strong><p>Öğrenci ekledikten sonra analizleri burada görürsün.</p></div>'; return; }
    if (!st.students.some(s => s.id === st.studentId)) st.studentId = st.students[0].id;

    // Müfredat verisi yükle (API'den)
    async function loadCurriculum() {
      try {
        const exams = await (await fetch('/api/curriculum/exams')).json();
        const curriculum = { exams: {}, subjects: {}, topics: {} };
        for (const exam of exams) {
          curriculum.exams[exam.id] = exam;
          const subjs = await (await fetch('/api/curriculum/exams/' + exam.id + '/subjects')).json();
          for (const subj of subjs) {
            curriculum.subjects[subj.id] = { ...subj, examId: exam.id };
            const tops = await (await fetch('/api/curriculum/subjects/' + subj.id + '/topics')).json();
            curriculum.topics[subj.id] = tops;
          }
        }
        st.curriculum = curriculum;
      } catch { console.error('Müfredat yüklenemedi'); }
    }
    await loadCurriculum();

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
      if (!st.curriculum) return;
      const exams = Object.values(st.curriculum.exams);
      if (!exams.some(e => e.id === st.lessonExamType)) st.lessonExamType = exams[0]?.id || 'TYT';
      const subjects = Object.values(st.curriculum.subjects).filter(s => s.examId === st.lessonExamType);
      if (!subjects.some(s => s.id === st.lessonSubject)) { st.lessonSubject = subjects[0]?.id || ''; st.lessonTopic = ''; }
      const topics = st.curriculum.topics[st.lessonSubject] || [];
      if (st.lessonTopic && !topics.map(t => t.name).includes(st.lessonTopic)) st.lessonTopic = '';
    }
    const lessonStore = () => st.data?.lessons || [];
    const api = async (method, path, body) => {
      try {
        const r = await authRequest('/api/tenants/' + tenantId + path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
        return { ok: r.ok, data: r.status === 204 ? null : await r.json().catch(() => null) };
      } catch { return { ok: false, data: null }; }
    };
    const withSeconds = t => (t && t.length === 5 ? t + ':00' : t || null);
    const lessonBody = l => ({ date: l.date, startTime: withSeconds(l.startTime), endTime: withSeconds(l.endTime), examType: l.examType, subject: l.subject, topic: l.topic || null, note: l.note || null });
    async function importLegacyLessons() {
      const legacyKey = 'kocluk-lessons-' + st.studentId;
      let legacy = []; try { legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]'); } catch { }
      if (!Array.isArray(legacy) || !legacy.length) { localStorage.removeItem(legacyKey); return; }
      for (const l of legacy) await api('POST', '/students/' + st.studentId + '/lesson-slots', lessonBody({ ...l, examType: l.examType || 'Özel' }));
      localStorage.setItem('kocluk-lessons-imported-' + st.studentId, JSON.stringify(legacy));
      localStorage.removeItem(legacyKey);
    }
    function viewWeek() {
      const start = weekStart(Date.now() + st.weekOffset * 7 * DAY), days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
      const keys = days.map(key), todayKey = key(new Date());
      const tasks = st.data.tasks.filter(t => keys.includes(t.dueDate)), sessions = st.data.sessions.filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected' && keys.includes(key(s.startsAtUtc)));
      const lessons = lessonStore().filter(l => keys.includes(l.date));
      const done = tasks.filter(t => t.isCompleted).length, pct = tasks.length ? Math.round(done * 100 / tasks.length) : 0;
      const target = tasks.reduce((s, t) => s + (t.targetQuestions || 0), 0), solved = tasks.reduce((s, t) => s + (t.completedQuestions || 0), 0);
      const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const cls = t => t.isCompleted ? 'done' : (t.dueDate < todayKey ? 'late' : (t.completedQuestions > 0 ? 'part' : 'todo'));
      return `<div class="week-nav"><button type="button" data-week="-1">‹</button><span>${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}</span><button type="button" data-week="1">›</button>${st.weekOffset ? '<button type="button" data-week="0" class="today">Bu hafta</button>' : ''}</div>
      <div class="perf-stats compact">${stat('🗒️', 'Toplam görev', tasks.length, 'indigo')}${stat('✅', 'Tamamlanan', done, 'teal')}${stat('📊', 'Tamamlanma', '%' + pct, 'amber')}${stat('✏️', 'Çözülen / hedef soru', solved + ' / ' + target, 'violet')}</div>
      <div id="week-form-container"></div>
      <div class="week-grid" id="week-grid-root">${days.map((d, i) => { const k = keys[i], ts = tasks.filter(t => t.dueDate === k), ss = sessions.filter(s => key(s.startsAtUtc) === k), ls = lessons.filter(l => l.date === k).sort((a, b) => a.startTime.localeCompare(b.startTime)); return `<div class="week-col ${k === todayKey ? 'today' : ''}" data-date-key="${k}"><div class="week-head"><b>${DAYS[i]}</b><span>${d.getDate()}</span></div>${ls.map(l => `<div class="chip lesson" draggable="true" data-lesson-id="${esc(l.id)}" data-lesson-date="${k}" title="${esc(lessonLabel(l) + (l.topic ? ' · ' + l.topic : '') + ' · ' + l.startTime)}"><b>${new Date('2000-01-01T'+l.startTime).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</b><span>${esc(lessonLabel(l))}</span>${l.topic ? '<small class="chip-topic">' + esc(l.topic.replace(/^.* - /, '')) + '</small>' : ''}<button type="button" class="chip-del" data-del-lesson="${esc(l.id)}" style="position:absolute;right:4px;top:4px;width:16px;height:16px;padding:0;font-size:11px;line-height:1">✕</button></div>`).join('')}${ss.map(s => `<div class="chip session"><b>${new Date(s.startsAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b><span>Koçluk görüşmesi · ${s.durationMinutes} dk</span></div>`).join('')}${ts.map(t => `<div class="chip ${cls(t)}" title="${esc(t.planTitle || '')}"><b>${esc(t.title)}</b><span>${t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru'}</span></div>`).join('')}${!ts.length && !ss.length && !ls.length ? '<div class="week-none">—</div>' : ''}</div>`; }).join('')}</div>
      <div class="week-legend"><span class="d done"></span>Tamamlandı<span class="d part"></span>Devam ediyor<span class="d todo"></span>Bekliyor<span class="d late"></span>Geciken<span class="d session"></span>Görüşme<span class="d session" style="background:#dbeafe"></span>Ders</div>`;
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
    function viewReport() {
      const list = ranged(), t = agg(list), topics = byTopic(list).filter(x => x.total >= 3);
      const strong = [...topics].sort((a, b) => b.rate - a.rate).slice(0, 3), weak = [...topics].sort((a, b) => a.rate - b.rate).filter(x => x.rate < 75).slice(0, 3);
      const tasks = st.data.tasks, done = tasks.filter(x => x.isCompleted).length, ex = [...st.data.exams].sort((x, y) => String(y.examDate).localeCompare(String(x.examDate)))[0];
      const rangeLabel = RANGES.find(r => r[0] === st.range)[1], coach = document.getElementById('profile-name')?.textContent?.trim() || 'Eğitim koçu';
      const li = x => `<li><b>${esc(x.subject)} · ${esc(x.topic)}</b> <span>%${r1(x.rate)} · ${x.total} soru</span></li>`;
      return `<div class="report-tools"><div class="card-lite"><label for="report-comment">💬 Öğretmen görüşü <small>(isteğe bağlı, rapora eklenir)</small></label><textarea id="report-comment" rows="3" placeholder="Örn: ${esc(student().firstName || 'Öğrenci')} son zamanlarda çok iyi gidiyor. Bu istikrarı sürdürelim.">${esc(localStorage.getItem(commentKey()) || '')}</textarea></div><button type="button" class="primary" id="report-print">📄 PDF raporu paylaş / yazdır</button></div>
      <div id="perf-report" class="report"><div class="report-head"><div><small>Öğrenci gelişim raporu</small><h2>${esc(studentName())}</h2><p>${rangeLabel} · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div class="report-brand">K<span>Koçluk</span></div></div>
        <div class="perf-stats">${stat('📅', 'Çalışma günü', t.days, 'indigo')}${stat('📄', 'Toplam soru', t.total, 'violet')}${stat('🎯', 'Başarı oranı', '%' + r1(t.rate), 'teal')}${stat('📈', 'Toplam net', r1(t.net), 'amber')}</div>
        <div class="report-cols"><div><h4>💪 Güçlü konular</h4><ul>${strong.length ? strong.map(li).join('') : '<li class="perf-muted">Yeterli veri yok</li>'}</ul></div><div><h4>🎯 Geliştirilecek konular</h4><ul>${weak.length ? weak.map(li).join('') : '<li class="perf-muted">Belirgin bir zayıf konu yok</li>'}</ul></div></div>
        <div class="report-cols"><div><h4>🗒️ Plan uyumu</h4><p class="report-big">${tasks.length ? done + ' / ' + tasks.length + ' görev tamamlandı' : 'Henüz plan görevi yok'}</p></div><div><h4>📝 Son deneme</h4><p class="report-big">${ex ? esc(ex.title) + ' · ' + r1(ex.correct - ex.wrong / 4) + ' net' : 'Deneme kaydı yok'}</p></div></div>
        <div class="report-comment" id="report-comment-view" ${localStorage.getItem(commentKey()) ? '' : 'hidden'}><h4>Öğretmen görüşü</h4><p>${esc(localStorage.getItem(commentKey()) || '')}</p><small>— ${esc(coach)}</small></div></div>`;
    }

    /* ---------- Çerçeve ---------- */
    function renderWeekForm() {
      const cnt = document.getElementById('week-form-container');
      if (!cnt || !st.curriculum) return;
      const start = weekStart(Date.now() + st.weekOffset * 7 * DAY), days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
      const dayKeys = days.map(key);
      if (!dayKeys.includes(st.lessonDate)) st.lessonDate = dayKeys.includes(key(new Date())) ? key(new Date()) : dayKeys[0];
      ensureLessonSelection();

      // API'den yüklenen müfredat verisi kullan
      const exams = Object.values(st.curriculum.exams).map(e => ({ code: e.id, name: e.name }));
      const subjects = (Object.values(st.curriculum.subjects).filter(s => s.examId === st.lessonExamType) || []).map(s => ({ code: s.id, name: s.name }));
      const topics = st.curriculum.topics[st.lessonSubject] || [];
      const groups = topics.length ? [{ unit: 'Konular', topics: topics.map(t => t.name) }] : [];

      const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;
      cnt.innerHTML = `<div id="lesson-form" class="lesson-form">
        <div class="lf-head"><b>Ders programına ekle</b><span>Sınav türünü seç, dersi ve konuyu belirle; ardından gün ve saati ver. Eklenen dersleri takvimde sürükleyerek günler arasında taşıyabilirsin.</span></div>
        <div class="lf-label">Sınav türü</div>
        <div class="exam-pills">${exams.map(e => `<button type="button" class="exam-type-btn ${e.code === st.lessonExamType ? 'on' : ''}" data-exam="${esc(e.code)}" title="${esc(e.name)}">${esc(e.code === 'YÖS' ? 'TR-YÖS' : e.code)}</button>`).join('')}</div>
        <div class="lf-grid">
          <label class="lf-field lf-wide"><span>Ders</span><select id="lesson-subject">${subjects.map(s => opt(s.code, s.name, s.code === st.lessonSubject)).join('')}</select></label>
          <label class="lf-field lf-wide"><span>Konu</span><select id="lesson-topic"><option value="">Konu seç (isteğe bağlı)</option>${groups.map(g => `<optgroup label="${esc(g.unit)}">${g.topics.map(t => opt(t, t.slice(g.unit.length + 3), t === st.lessonTopic)).join('')}</optgroup>`).join('')}</select></label>
          <label class="lf-field"><span>Gün</span><select id="lesson-date">${days.map((d, i) => opt(dayKeys[i], DAYS[i] + ' · ' + d.getDate() + ' ' + d.toLocaleDateString('tr-TR', { month: 'short' }), dayKeys[i] === st.lessonDate)).join('')}</select></label>
          <label class="lf-field"><span>Başlangıç</span><input id="lesson-start" type="time" value="${esc(st.lessonStart)}"></label>
          <label class="lf-field"><span>Bitiş</span><input id="lesson-end" type="time" value="${esc(st.lessonEnd)}"></label>
        </div>
        <div class="lf-actions"><button type="button" id="add-lesson" class="primary">＋ Derse ekle</button><button type="button" id="week-publish" class="lf-pub">📣 Öğrenci ve veliye gönder</button><button type="button" id="week-share" class="lf-wa">📱 WhatsApp ile paylaş</button><span class="lf-msg ${st.lessonMsgErr ? 'err' : ''}">${esc(st.lessonMsg || '')}</span></div>
      </div>`;
      const bind = (id, fn) => document.getElementById(id)?.addEventListener('change', fn);
      bind('lesson-subject', e => { st.lessonSubject = e.target.value; st.lessonTopic = ''; renderWeekForm(); });
      bind('lesson-topic', e => { st.lessonTopic = e.target.value; });
      bind('lesson-date', e => { st.lessonDate = e.target.value; });
      bind('lesson-start', e => { st.lessonStart = e.target.value; });
      bind('lesson-end', e => { st.lessonEnd = e.target.value; });
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
      const start = weekStart(Date.now() + st.weekOffset * 7 * DAY), days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
      const lessons = lessonStore().filter(l => days.some(d => l.date === key(d)));
      if (!lessons.length) { st.lessonMsg = 'Bu hafta paylaşılacak ders yok.'; st.lessonMsgErr = true; renderWeekForm(); return; }
      const range = days[0].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' - ' + days[6].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      const blocks = days.map(d => {
        const ls = lessons.filter(l => l.date === key(d)).sort((a, b) => a.startTime.localeCompare(b.startTime));
        if (!ls.length) return '';
        return '*' + d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }) + '*\n' + ls.map(l => '🕐 ' + l.startTime.slice(0, 5) + (l.endTime ? ' - ' + l.endTime.slice(0, 5) : '') + '  ' + lessonLabel(l) + (l.topic ? '\n     ▫️ ' + l.topic : '')).join('\n');
      }).filter(Boolean);
      const text = '📚 *' + studentName() + ' - Haftalık Ders Programı*\n' + range + '\n\n' + blocks.join('\n\n') + '\n\n_Koçluk panelinden gönderildi_';
      const url = 'https://wa.me/?text=' + encodeURIComponent(text);
      window.open(url, '_blank');
    }
    function render() {
      const views = { perf: viewPerf, topic: viewTopic, week: viewWeek, alarms: viewAlarms, report: viewReport };
      root.innerHTML = `<div class="perf-bar"><label>Öğrenci<select id="perf-student">${st.students.map(s => `<option value="${s.id}" ${s.id === st.studentId ? 'selected' : ''}>${esc(s.firstName + ' ' + (s.lastName || ''))}</option>`).join('')}</select></label>${['perf', 'topic', 'report'].includes(st.tab) ? `<label>Dönem<select id="perf-range">${RANGES.map(r => `<option value="${r[0]}" ${r[0] === st.range ? 'selected' : ''}>${r[1]}</option>`).join('')}</select></label>` : ''}</div>
        <div class="perf-tabs">${TABS.map(([id, label]) => `<button type="button" class="${st.tab === id ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('')}</div><div class="perf-body">${views[st.tab]()}</div>`;
      if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0);
    }
    root.addEventListener('click', async event => {
      const t = event.target.closest('[data-tab],[data-week],[data-alarm-filter],[data-alarm],[data-open-topic],#report-print,[data-del-lesson],#add-lesson,#week-share,#week-publish,.exam-type-btn'); if (!t) return;
      if (t.classList.contains('exam-type-btn')) { st.lessonExamType = t.dataset.exam; st.lessonSubject = ''; st.lessonTopic = ''; renderWeekForm(); }
      else if (t.dataset.tab) { st.tab = t.dataset.tab; render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
      else if (t.dataset.week !== undefined) { st.weekOffset = t.dataset.week === '0' ? 0 : st.weekOffset + Number(t.dataset.week); render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
      else if (t.dataset.alarmFilter) { st.alarmFilter = t.dataset.alarmFilter; render(); }
      else if (t.dataset.openTopic) { st.topicKey = t.dataset.openTopic; st.tab = 'topic'; render(); }
      else if (t.dataset.alarm) { const store = alarmStore(), a = store[t.dataset.alarm] || { firstSeen: Date.now() }; if (t.dataset.act === 'resolve') a.status = 'resolved'; else if (t.dataset.act === 'snooze') { a.status = 'snoozed'; a.until = Date.now() + DAY; } else delete a.status; store[t.dataset.alarm] = a; saveAlarms(store); render(); }
      else if (t.id === 'report-print') window.print();
      else if (t.dataset.delLesson) {
        if (!confirm('Bu ders programdan silinsin mi?')) return;
        const id = t.dataset.delLesson, r = await api('DELETE', '/lesson-slots/' + id);
        if (r.ok) { st.data.lessons = st.data.lessons.filter(l => l.id !== id); st.lessonMsg = 'Ders silindi.'; st.lessonMsgErr = false; }
        else { st.lessonMsg = 'Ders silinemedi.'; st.lessonMsgErr = true; }
        render();
      }
      else if (t.id === 'week-publish') {
        const r = await api('POST', '/students/' + st.studentId + '/lesson-slots/publish', { weekStart: key(weekStart(Date.now() + st.weekOffset * 7 * DAY)) });
        st.lessonMsgErr = !r.ok;
        st.lessonMsg = r.ok ? (r.data.notified ? r.data.notified + ' kişiye bildirim gönderildi.' : 'Program öğrencinin takviminde görünüyor; bağlı öğrenci/veli hesabı olmadığı için bildirim gitmedi.') : (r.data?.error || 'Program gönderilemedi.');
        renderWeekForm();
      }
      else if (t.id === 'add-lesson') {
        st.lessonDate = document.getElementById('lesson-date')?.value || st.lessonDate;
        st.lessonStart = document.getElementById('lesson-start')?.value || '';
        st.lessonEnd = document.getElementById('lesson-end')?.value || '';
        const subj = st.curriculum?.subjects?.[st.lessonSubject];
        const fail = msg => { st.lessonMsg = msg; st.lessonMsgErr = true; };
        if (!subj) fail('Önce bir ders seç.');
        else if (!st.lessonStart) fail('Başlangıç saatini gir.');
        else if (st.lessonEnd && st.lessonEnd <= st.lessonStart) fail('Bitiş saati başlangıçtan sonra olmalı.');
        else {
          const r = await api('POST', '/students/' + st.studentId + '/lesson-slots', lessonBody({ date: st.lessonDate, examType: st.lessonExamType, subject: subj.name, topic: st.lessonTopic, startTime: st.lessonStart, endTime: st.lessonEnd }));
          if (r.ok) { st.data.lessons.push(r.data); st.lessonMsg = 'Ders eklendi.'; st.lessonMsgErr = false; }
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
