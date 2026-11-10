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
    const st = { students: [], studentId: localStorage.getItem('perfStudent') || '', range: '30', tab: 'perf', weekOffset: 0, topicKey: '', alarmFilter: 'active', data: null, lessonExamType: 'TYT', lessonSubject: 'Matematik', lessonTopic: 'Cebir' };
    content.innerHTML = '<div class="welcome"><div><h1>Performans & analiz</h1><p>Öğrencinin çalışma, soru çözümü ve plan verilerini tek ekranda izle.</p></div></div><div id="perf-root" class="perf"><div class="perf-empty">Yükleniyor…</div></div>';
    const root = document.getElementById('perf-root');

    const get = async path => { try { const r = await authRequest('/api/tenants/' + tenantId + path); return r.ok ? await r.json() : []; } catch { return []; } };
    const sRes = await get('/students'); st.students = Array.isArray(sRes) ? sRes : [];
    if (!st.students.length) { root.innerHTML = '<div class="perf-empty"><div class="perf-emoji">🎓</div><strong>Henüz öğrenci yok</strong><p>Öğrenci ekledikten sonra analizleri burada görürsün.</p></div>'; return; }
    if (!st.students.some(s => s.id === st.studentId)) st.studentId = st.students[0].id;

    async function loadData() {
      localStorage.setItem('perfStudent', st.studentId);
      root.querySelector('.perf-body')?.classList.add('loading');
      const [attempts, plans, subjects, exams, sessions] = await Promise.all(['question-attempts', 'plans', 'subjects', 'exams', 'sessions'].map(p => get('/students/' + st.studentId + '/' + p)));
      st.data = {
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
    const EXAM_TYPES = ['TYT', 'AYT', 'KPSS', 'YÖS', 'DGS', 'Özel'];
    const FALLBACK_TOPICS = { 'Matematik': ['Konu seç', 'Limit - Limit Kavramı', 'Limit - Limit Kuralları', 'Limit - Özel Limitler', 'Limit - Sonsuzda Limit', 'Süreklilik - Süreklilik Tanımı', 'Süreklilik - Ara Değer Teoremi', 'Türev - Türev Tanımı ve Geometrik Anlamı', 'Türev - Türev Alma Kuralları', 'Türev - Zincir Kuralı', 'Türev - Ters Fonksiyonun Türevi', 'Türev - Kapalı Fonksiyon Türevi', 'Türev - Yüksek Mertebeden Türevler', 'Türevin Uygulamaları - Artan Azalan Fonksiyonlar', 'Türevin Uygulamaları - Ekstremum Değerler', 'Türevin Uygulamaları - Konkavlık ve İnfleksiyon', 'İntegral - Belirsiz İntegral', 'İntegral - İntegral Alma Kuralları', 'İntegral - Değişken Değiştirme', 'İntegral - Belirli İntegral', 'Cebir', 'Geometri', 'Trigonometri', 'Analiz', 'Olasılık', 'Fonksiyonlar'], 'Türkçe': ['Konu seç', 'Gramer', 'Sözcük', 'Metin Anlama', 'Yazı', 'Edebiyat', 'Şiir', 'Edebiyat Tarihi', 'Makaleler'], 'İngilizce': ['Konu seç', 'Gramer', 'Vocabulary', 'Listening', 'Reading', 'Speaking', 'Writing', 'Phrasal Verbs'], 'Fen Bilgisi': ['Konu seç', 'Fizik', 'Kimya', 'Biyoloji', 'Elektrik'], 'Sosyal Bilgiler': ['Konu seç', 'Tarih', 'Coğrafya', 'İnsan Hakları', 'Kültür'], 'Fizik': ['Konu seç', 'Mekanik', 'Elektrik', 'Dalgalar', 'Termodinamik', 'Işık', 'Akustik'], 'Kimya': ['Konu seç', 'Genel', 'Organic', 'Analitik', 'Reaksiyon', 'Bağlar', 'Gazlar'], 'Biyoloji': ['Konu seç', 'Hücre', 'Genetik', 'Ekoloji', 'Fizyoloji', 'Evrim', 'Ekosistem'], 'Tarih': ['Konu seç', 'Osmanlı', 'Cumhuriyet', 'Dünya Tarihi', 'Eski Çağlar', 'Orta Çağ', 'Modern Çağ'], 'Coğrafya': ['Konu seç', 'Fiziki Coğrafya', 'Beşeri Coğrafya', 'Bölge Coğrafyası', 'Demografi'], 'Geometri': ['Konu seç', 'Açılar', 'Üçgenler', 'Daireler', 'Katı Cisimler', 'Alan', 'Hacim'], 'Yurttaşlık': ['Konu seç', 'İnsan Hakları', 'Demokrasi', 'Anayasa', 'Hukuk'] };
    function getTopicsMap(subjects) {
      const map = {};
      (subjects || []).forEach(s => {
        if (!map[s.subject]) map[s.subject] = [];
        if (s.topic && !map[s.subject].includes(s.topic)) map[s.subject].push(s.topic);
      });
      Object.keys(map).forEach(k => map[k].sort());
      return Object.keys(map).length ? map : FALLBACK_TOPICS;
    }
    function getAllSubjects(subjects) {
      const set = new Set((subjects || []).map(s => s.subject));
      if (set.size === 0) return Object.keys(FALLBACK_TOPICS).sort();
      return [...set].sort();
    }
    const lessonStore = () => { try { return JSON.parse(localStorage.getItem('kocluk-lessons-' + st.studentId) || '[]'); } catch { return []; } };
    const saveLesson = v => localStorage.setItem('kocluk-lessons-' + st.studentId, JSON.stringify(v));
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
      <div class="week-grid" id="week-grid-root">${days.map((d, i) => { const k = keys[i], ts = tasks.filter(t => t.dueDate === k), ss = sessions.filter(s => key(s.startsAtUtc) === k), ls = lessons.filter(l => l.date === k); return `<div class="week-col ${k === todayKey ? 'today' : ''}" data-date-key="${k}"><div class="week-head"><b>${DAYS[i]}</b><span>${d.getDate()}</span></div>${ls.map(l => `<div class="chip lesson" draggable="true" data-lesson-id="${esc(l.id)}" data-lesson-date="${k}" title="${esc((l.examType || l.subject) + ' · ' + l.topic + ' - ' + l.startTime)}"><b>${new Date('2000-01-01T'+l.startTime).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</b><span>${esc(l.examType || l.subject)}</span><button type="button" class="chip-del" data-del-lesson="${esc(l.id)}" style="position:absolute;right:4px;top:4px;width:16px;height:16px;padding:0;font-size:11px;line-height:1">✕</button></div>`).join('')}${ss.map(s => `<div class="chip session"><b>${new Date(s.startsAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b><span>Koçluk görüşmesi · ${s.durationMinutes} dk</span></div>`).join('')}${ts.map(t => `<div class="chip ${cls(t)}" title="${esc(t.planTitle || '')}"><b>${esc(t.title)}</b><span>${t.isCompleted ? '✓ Tamamlandı' : t.completedQuestions + ' / ' + t.targetQuestions + ' soru'}</span></div>`).join('')}${!ts.length && !ss.length && !ls.length ? '<div class="week-none">—</div>' : ''}</div>`; }).join('')}</div>
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
      const start = weekStart(Date.now() + st.weekOffset * 7 * DAY), days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
      const cnt = document.getElementById('week-form-container');
      if (!cnt) return;
      const curExam = st.lessonExamType;
      const allSubjects = getAllSubjects(st.data.subjects);
      const topicsMap = getTopicsMap(st.data.subjects);
      const curSubject = st.lessonSubject || allSubjects[0] || 'Matematik';
      const curTopic = st.lessonTopic;
      const topicOpts = topicsMap[curSubject] || [];
      cnt.innerHTML = `<div style="background:#f6f7fd;border-radius:18px;padding:18px;margin-bottom:14px"><div style="margin-bottom:16px"><label style="font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;display:block;margin-bottom:10px">1. SINAV TÜRÜ SEÇ</label><div style="display:flex;gap:8px;flex-wrap:wrap">${EXAM_TYPES.map(t => `<button type="button" class="exam-type-btn" data-exam="${t}" style="padding:10px 18px;border-radius:10px;border:2px solid ${curExam === t ? '#4f46e5' : '#d4d8f5'};background:${curExam === t ? '#4f46e5' : '#fff'};color:${curExam === t ? '#fff' : '#475569'};font-weight:650;font-size:13px;cursor:pointer;transition:all .2s">${t}</button>`).join('')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px"><div><label style="font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;display:block;margin-bottom:6px">2. DERS SEÇ</label><select id="lesson-subject" style="width:100%;padding:10px 12px;border:1px solid #d4d8f5;border-radius:12px;background:#fff;font:600 13px inherit">${allSubjects.map(s => `<option value="${s}" ${s === curSubject ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div><label style="font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;display:block;margin-bottom:6px">3. KONU SEÇ</label><select id="lesson-topic" style="width:100%;padding:10px 12px;border:1px solid #d4d8f5;border-radius:12px;background:#fff;font:600 13px inherit">${topicOpts.map(t => `<option value="${t}" ${t === curTopic ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div><label style="font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;display:block;margin-bottom:6px">TARIH</label><select id="lesson-date" style="width:100%;padding:10px 12px;border:1px solid #d4d8f5;border-radius:12px;background:#fff;font:600 13px inherit">${days.map((d, i) => `<option value="${key(d)}">${DAYS[i]} ${d.getDate()}</option>`).join('')}</select></div><div><label style="font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;display:block;margin-bottom:6px">BAŞLANGIÇ</label><input id="lesson-start" type="time" style="width:100%;padding:10px 12px;border:1px solid #d4d8f5;border-radius:12px;background:#fff;font:600 13px inherit"/></div><div><label style="font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;display:block;margin-bottom:6px">BİTİŞ</label><input id="lesson-end" type="time" style="width:100%;padding:10px 12px;border:1px solid #d4d8f5;border-radius:12px;background:#fff;font:600 13px inherit"/></div></div><div style="display:flex;gap:10px"><button type="button" id="add-lesson" style="padding:12px 24px;border-radius:12px;background:#4f46e5;color:#fff;font-weight:650;font-size:13px;border:0;cursor:pointer;flex:0">+ Ders Ekle</button><button type="button" id="week-share" style="padding:12px 24px;border-radius:12px;background:#0f766e;color:#fff;font-weight:650;font-size:13px;border:0;cursor:pointer;flex:0">📱 WhatsApp Paylaş</button></div></div>`;
      document.getElementById('lesson-date')?.addEventListener('change', e => { });
      document.getElementById('lesson-subject')?.addEventListener('change', e => { const tm = getTopicsMap(st.data.subjects); st.lessonSubject = e.target.value; st.lessonTopic = tm[e.target.value]?.[0] || ''; renderWeekForm(); });
      document.getElementById('lesson-topic')?.addEventListener('change', e => { st.lessonTopic = e.target.value; });
      setupDragDrop();
    }
    function setupDragDrop() {
      const grid = document.getElementById('week-grid-root');
      if (!grid) return;
      grid.addEventListener('dragstart', e => { if (e.target.classList.contains('lesson')) { e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = '0.5'; e.dataTransfer.setData('lessonId', e.target.dataset.lessonId); } });
      grid.addEventListener('dragend', e => { if (e.target.classList.contains('lesson')) e.target.style.opacity = '1'; });
      grid.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const col = e.target.closest('.week-col'); if (col) col.style.background = '#eef2ff'; });
      grid.addEventListener('dragleave', e => { const col = e.target.closest('.week-col'); if (col && col.style.background === '#eef2ff') col.style.background = ''; });
      grid.addEventListener('drop', e => { e.preventDefault(); const col = e.target.closest('.week-col'); if (col) col.style.background = ''; const lessonId = e.dataTransfer.getData('lessonId'); if (!lessonId || !col) return; const newDate = col.dataset.dateKey; const lessons = lessonStore(); const l = lessons.find(x => x.id === lessonId); if (l && l.date !== newDate) { l.date = newDate; saveLesson(lessons); render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); } });
    }
    function shareWeekSchedule() {
      const start = weekStart(Date.now() + st.weekOffset * 7 * DAY), days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
      const lessons = lessonStore().filter(l => days.some(d => l.date === key(d)));
      if (!lessons.length) { alert('Paylaşılacak ders yok'); return; }
      const sName = studentName();
      const text = '📚 *' + sName + ' - Haftalık Ders Programı*\n\n' + days.map((d, i) => { const ls = lessons.filter(l => l.date === key(d)); return (ls.length ? '*' + DAYS[i] + ' · ' + d.getDate() + '. gün*\n' + ls.map(l => '  🕐 ' + l.startTime.slice(0, 5) + (l.endTime ? ' - ' + l.endTime.slice(0, 5) : '') + ': ' + (l.examType || l.subject) + (l.topic ? ' · ' + l.topic : '')).join('\n') + '\n' : ''); }).join('\n') + '\n📅 ' + new Date().toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'});
      const url = 'https://wa.me/?text=' + encodeURIComponent(text);
      window.open(url, '_blank');
    }
    function render() {
      const views = { perf: viewPerf, topic: viewTopic, week: viewWeek, alarms: viewAlarms, report: viewReport };
      root.innerHTML = `<div class="perf-bar"><label>Öğrenci<select id="perf-student">${st.students.map(s => `<option value="${s.id}" ${s.id === st.studentId ? 'selected' : ''}>${esc(s.firstName + ' ' + (s.lastName || ''))}</option>`).join('')}</select></label>${['perf', 'topic', 'report'].includes(st.tab) ? `<label>Dönem<select id="perf-range">${RANGES.map(r => `<option value="${r[0]}" ${r[0] === st.range ? 'selected' : ''}>${r[1]}</option>`).join('')}</select></label>` : ''}</div>
        <div class="perf-tabs">${TABS.map(([id, label]) => `<button type="button" class="${st.tab === id ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('')}</div><div class="perf-body">${views[st.tab]()}</div>`;
      if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0);
    }
    root.addEventListener('click', event => {
      const t = event.target.closest('[data-tab],[data-week],[data-alarm-filter],[data-alarm],[data-open-topic],#report-print,[data-del-lesson],#add-lesson,#week-share,.exam-type-btn'); if (!t) return;
      if (t.classList.contains('exam-type-btn')) { st.lessonExamType = t.dataset.exam; renderWeekForm(); }
      else if (t.dataset.tab) { st.tab = t.dataset.tab; render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
      else if (t.dataset.week !== undefined) { st.weekOffset = t.dataset.week === '0' ? 0 : st.weekOffset + Number(t.dataset.week); render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
      else if (t.dataset.alarmFilter) { st.alarmFilter = t.dataset.alarmFilter; render(); }
      else if (t.dataset.openTopic) { st.topicKey = t.dataset.openTopic; st.tab = 'topic'; render(); }
      else if (t.dataset.alarm) { const store = alarmStore(), a = store[t.dataset.alarm] || { firstSeen: Date.now() }; if (t.dataset.act === 'resolve') a.status = 'resolved'; else if (t.dataset.act === 'snooze') { a.status = 'snoozed'; a.until = Date.now() + DAY; } else delete a.status; store[t.dataset.alarm] = a; saveAlarms(store); render(); }
      else if (t.id === 'report-print') window.print();
      else if (t.dataset.delLesson) { const lessons = lessonStore().filter(l => l.id !== t.dataset.delLesson); saveLesson(lessons); render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
      else if (t.id === 'add-lesson') { const d = document.getElementById('lesson-date')?.value || key(new Date()); const l = { id: Date.now().toString(), date: d, examType: st.lessonExamType, subject: st.lessonSubject, topic: st.lessonTopic, startTime: document.getElementById('lesson-start')?.value || '', endTime: document.getElementById('lesson-end')?.value || '' }; if (!l.subject || !l.startTime) { alert('Ders, konu ve başlangıç saati gerekli'); return; } const lessons = lessonStore(); lessons.push(l); saveLesson(lessons); render(); if (st.tab === 'week') setTimeout(() => renderWeekForm(), 0); }
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
