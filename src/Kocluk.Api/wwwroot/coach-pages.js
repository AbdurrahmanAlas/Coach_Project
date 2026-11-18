/* Koç paneli: Genel bakış panosu ve sayfalardaki "PDF indir" raporları (planlar, deneme sonuçları, konu analizi). */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : 0;
  const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parseDay = iso => new Date(String(iso).slice(0, 10) + 'T00:00:00');
  const fmtDay = iso => parseDay(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
  const fmtDate = iso => parseDay(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  const longDate = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const coachName = () => document.getElementById('profile-name')?.textContent?.trim() || '';
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toLocaleUpperCase('tr-TR')).join('');
  const server = iso => { const s = String(iso || ''); return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z'); };
  const stateOf = (t, today) => t.isCompleted ? ['done', 'Tamamlandı'] : String(t.dueDate).slice(0, 10) < today ? ['late', 'Gecikti'] : t.completedQuestions > 0 ? ['going', 'Devam ediyor'] : ['wait', 'Bekliyor'];

  async function savePdf(canvas, filename) {
    const blob = await KoclukShare.toPdf(canvas);
    KoclukShare.download(blob, filename);
  }
  const base = () => ({ name: coachName() || 'Koçluk paneli', dateLabel: longDate(), coach: '' });
  const guard = fn => async (...a) => { if (!window.KoclukShare) { alert('Rapor modülü yüklenemedi. Sayfayı yenileyin.'); return; } try { await fn(...a); } catch (e) { console.warn(e); alert('PDF hazırlanamadı. Tekrar deneyin.'); } };

  /* ---------- PDF raporları ---------- */
  const plansPdf = guard(async ({ plans, studentName }) => {
    const today = dayKey(new Date()), all = plans.flatMap(p => p.tasks || []);
    const done = all.filter(t => t.isCompleted).length, late = all.filter(t => !t.isCompleted && String(t.dueDate).slice(0, 10) < today).length;
    const target = all.reduce((s, t) => s + Number(t.targetQuestions || 0), 0), solved = all.reduce((s, t) => s + Number(t.completedQuestions || 0), 0);
    const sections = [...plans].sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart))).slice(0, 12).map(p => ({
      title: `${studentName(p.studentId) || p.title}  ·  ${fmtDate(p.weekStart)}`,
      empty: 'Bu planda görev yok.',
      rows: [...(p.tasks || [])].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).map(t => { const [tone, label] = stateOf(t, today); return { title: t.title, sub: `${fmtDay(t.dueDate)} · ${t.completedQuestions || 0} / ${t.targetQuestions || 0} soru`, value: (tone === 'done' ? '✓ ' : '') + label, tone }; })
    }));
    const canvas = KoclukShare.summaryCanvas({ ...base(), kicker: 'ÇALIŞMA PLANLARI RAPORU', sub: longDate() + ' · ' + plans.length + ' plan',
      stats: [{ label: 'Aktif plan', value: String(plans.length) }, { label: 'Tamamlanan görev', value: `${done} / ${all.length}` }, { label: 'Çözülen / hedef soru', value: `${solved} / ${target}` }, { label: 'Geciken görev', value: String(late) }], sections, note: late ? `${late} görevin tarihi geçti; öğrencilerle takip önerilir.` : '' });
    await savePdf(canvas, 'calisma-planlari.pdf');
  });

  const examsPdf = guard(async ({ rows, title }) => {
    if (!rows.length) { alert('İndirilecek deneme sonucu yok.'); return; }
    const avg = rows.reduce((s, e) => s + e.net, 0) / rows.length, best = rows.reduce((m, e) => e.net > m.net ? e : m, rows[0]);
    const byStudent = {}; rows.forEach(e => { (byStudent[e.studentName] = byStudent[e.studentName] || []).push(e); });
    const sections = Object.entries(byStudent).slice(0, 12).map(([name, list]) => ({ title: `${name}  ·  ${list.length} deneme`, empty: '', rows: [...list].sort((a, b) => String(b.examDate).localeCompare(String(a.examDate))).slice(0, 10).map(e => ({ title: e.title || 'Deneme', sub: `${fmtDate(e.examDate)} · ${e.correct} D / ${e.wrong} Y / ${e.blank} B`, value: `${fmtNum(e.net)} net`, tone: 'info' })) }));
    const canvas = KoclukShare.summaryCanvas({ ...base(), kicker: 'DENEME SONUÇLARI RAPORU', sub: title || longDate(),
      stats: [{ label: 'Toplam deneme', value: String(rows.length) }, { label: 'Ortalama net', value: fmtNum(avg) }, { label: 'En yüksek net', value: fmtNum(best.net) }, { label: 'Öğrenci', value: String(Object.keys(byStudent).length) }], sections, note: `En yüksek net ${fmtNum(best.net)} ile ${best.studentName} (${best.title || 'Deneme'}).` });
    await savePdf(canvas, 'deneme-sonuclari.pdf');
  });

  const questionsPdf = guard(async ({ summary }) => {
    const sections = [
      { title: 'Ders bazlı başarı', empty: 'Henüz çözülmüş soru yok.', rows: (summary.subjects || []).map(i => ({ title: i.subject, sub: `${i.correct} / ${i.total} doğru`, value: `%${Math.round(i.rate || 0)}`, tone: i.rate >= 70 ? 'up' : i.rate >= 50 ? 'going' : 'down' })) },
      { title: 'Öğrenci bazlı başarı', empty: 'Henüz öğrenci soru çözümü yok.', rows: (summary.students || []).slice(0, 15).map(i => ({ title: i.studentName, sub: `${i.correct} / ${i.total} doğru`, value: `%${Math.round(i.rate || 0)}`, tone: i.rate >= 70 ? 'up' : i.rate >= 50 ? 'going' : 'down' })) }
    ];
    const canvas = KoclukShare.summaryCanvas({ ...base(), kicker: 'KONU BAZLI ANALİZ RAPORU', sub: longDate(),
      stats: [{ label: 'Çözülen soru', value: String(summary.total || 0) }, { label: 'Doğru cevap', value: String(summary.correct || 0) }, { label: 'Genel başarı', value: `%${Math.round(summary.rate || 0)}` }, { label: 'Bekleyen ödev', value: String(summary.pendingAssignments || 0) }], sections });
    await savePdf(canvas, 'konu-analizi.pdf');
  });

  /* ---------- Genel bakış panosu ---------- */
  function dashboardData(d) {
    const today = dayKey(new Date()), students = d.students, plans = d.plans, now = new Date();
    const per = students.map(s => {
      const mine = plans.filter(p => p.studentId === s.id), tasks = mine.flatMap(p => p.tasks || []);
      const target = tasks.reduce((a, t) => a + Number(t.targetQuestions || 0), 0), solved = tasks.reduce((a, t) => a + Number(t.completedQuestions || 0), 0);
      const late = tasks.filter(t => !t.isCompleted && String(t.dueDate).slice(0, 10) < today);
      return { s, name: `${s.firstName} ${s.lastName || ''}`.trim(), plans: mine.length, tasks: tasks.length, done: tasks.filter(t => t.isCompleted).length, late, target, solved, percent: pct(solved, target) };
    });
    const upcoming = d.sessions.filter(x => x.status !== 'Cancelled' && x.status !== 'Rejected' && server(x.startsAtUtc) >= now).sort((a, b) => server(a.startsAtUtc) - server(b.startsAtUtc));
    return { per, upcoming, today };
  }
  function render(host, d) {
    if (!host) return;
    const { per, upcoming } = dashboardData(d);
    const attention = per.filter(p => p.late.length || !p.plans).sort((a, b) => b.late.length - a.late.length);
    const tile = (icon, title, text, page, tone) => `<button type="button" class="dash-tile ${tone}" data-go="${page}"><span class="dash-tile-ico">${icon}</span><span><b>${title}</b><small>${text}</small></span><i>→</i></button>`;
    const sessionRow = x => { const s = server(x.startsAtUtc), soon = s - new Date() < 86400000; return `<div class="dash-row"><div class="dash-date ${soon ? 'soon' : ''}"><b>${s.getDate()}</b><small>${s.toLocaleDateString('tr-TR', { month: 'short' })}</small></div><div class="dash-row-main"><strong>${esc(x.studentName || 'Öğrenci')}</strong><small>${s.toLocaleDateString('tr-TR', { weekday: 'long' })} · ${s.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · ${x.durationMinutes} dk</small></div><span class="dash-chip ${x.status === 'Confirmed' || x.status === 'Completed' ? 'ok' : 'wait'}">${x.status === 'Confirmed' || x.status === 'Completed' ? 'Onaylı' : 'Onay bekliyor'}</span></div>`; };
    const attRow = p => `<div class="dash-row"><span class="dash-avatar ${p.late.length ? 'bad' : 'warn'}">${esc(initials(p.name))}</span><div class="dash-row-main"><strong>${esc(p.name)}</strong><small>${p.late.length ? `${p.late.length} görev gecikti · en eski: ${fmtDay([...p.late].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0].dueDate)}` : 'Henüz çalışma planı yok'}</small></div><button type="button" class="dash-link" data-go="${p.late.length ? 'plans' : 'plans'}">${p.late.length ? 'Planı gör' : 'Plan oluştur'} →</button></div>`;
    const progRow = p => `<div class="dash-prog"><span class="dash-avatar">${esc(initials(p.name))}</span><div class="dash-prog-main"><div class="dash-prog-top"><strong>${esc(p.name)}</strong><span>${p.target ? `%${p.percent}` : '—'}</span></div><div class="dash-bar ${p.percent >= 70 ? 'ok' : p.percent >= 40 ? 'mid' : 'low'}"><i style="width:${p.percent}%"></i></div><small>${p.plans ? `${p.done}/${p.tasks} görev · ${p.solved}/${p.target} soru` : 'Plan atanmamış'}</small></div></div>`;
    host.innerHTML = `<div class="dash-actions">${tile('👤', 'Öğrenci ekle', 'Yeni öğrenci profili', 'students', 'indigo')}${tile('📋', 'Plan oluştur', 'Haftalık hedef belirle', 'plans', 'teal')}${tile('🗓️', 'Haftalık program', 'Sürükle-bırak program', 'performance', 'violet')}${tile('📝', 'Deneme ekle', 'Sonuç ve net takibi', 'exams', 'amber')}</div>
      <div class="dash-cols">
        <section class="dash-card"><header><div><h2>Dikkat gerektirenler</h2><p>Geciken görevi olan ya da planı olmayan öğrenciler</p></div><span class="dash-chip ${attention.length ? 'bad' : 'ok'}">${attention.length ? attention.length + ' öğrenci' : 'Hepsi yolunda'}</span></header>
          ${attention.length ? attention.slice(0, 6).map(attRow).join('') : '<div class="dash-empty ok"><b>✓ Her şey yolunda</b><small>Geciken görev ya da plansız öğrenci yok.</small></div>'}</section>
        <section class="dash-card"><header><div><h2>Yaklaşan görüşmeler</h2><p>Takvimindeki sıradaki randevular</p></div><button type="button" class="dash-link" data-go="schedule">Takvim →</button></header>
          ${upcoming.length ? upcoming.slice(0, 5).map(sessionRow).join('') : '<div class="dash-empty"><b>Yaklaşan görüşme yok</b><small>Ders Takvimi sayfasından yeni görüşme planlayabilirsin.</small></div>'}</section>
      </div>
      <section class="dash-card"><header><div><h2>Öğrenci ilerleme özeti</h2><p>Planlardaki soru hedefine göre tamamlanma oranı</p></div><div class="dash-head-actions"><button type="button" class="dash-btn" id="dash-pdf">📄 PDF indir</button><button type="button" class="dash-link" data-go="students">Öğrencileri yönet →</button></div></header>
        ${per.length ? `<div class="dash-progs">${[...per].sort((a, b) => a.percent - b.percent).map(progRow).join('')}</div>` : '<div class="dash-empty"><b>Henüz öğrenci yok</b><small>Öğrenci ekleyerek başla.</small></div>'}</section>`;
    host.onclick = e => {
      const go = e.target.closest('[data-go]'); if (go) { document.querySelector(`[data-page="${go.dataset.go}"]`)?.click(); return; }
      if (e.target.closest('#dash-pdf')) dashboardPdf(d);
    };
  }
  const dashboardPdf = guard(async d => {
    const { per, upcoming } = dashboardData(d), late = per.reduce((s, p) => s + p.late.length, 0);
    const canvas = KoclukShare.summaryCanvas({ ...base(), kicker: 'KOÇLUK GENEL BAKIŞ RAPORU', sub: longDate(),
      stats: [{ label: 'Aktif öğrenci', value: String(d.students.length) }, { label: 'Aktif plan', value: String(d.plans.length) }, { label: 'Geciken görev', value: String(late) }, { label: 'Yaklaşan görüşme', value: String(upcoming.length) }],
      sections: [{ title: 'Öğrenci ilerleme özeti', empty: 'Henüz öğrenci yok.', rows: [...per].sort((a, b) => a.percent - b.percent).map(p => ({ title: p.name, sub: p.plans ? `${p.done}/${p.tasks} görev · ${p.solved}/${p.target} soru${p.late.length ? ' · ' + p.late.length + ' geciken' : ''}` : 'Plan atanmamış', value: p.target ? `%${p.percent}` : '—', tone: p.late.length ? 'late' : p.percent >= 70 ? 'up' : p.percent >= 40 ? 'going' : 'down' })) },
        { title: 'Yaklaşan görüşmeler', empty: 'Yaklaşan görüşme yok.', rows: upcoming.slice(0, 8).map(x => { const s = server(x.startsAtUtc); return { title: x.studentName || 'Öğrenci', sub: s.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + x.durationMinutes + ' dk', value: s.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), tone: 'info' }; }) }] });
    await savePdf(canvas, 'genel-bakis-raporu.pdf');
  });

  window.CoachReports = { plansPdf, examsPdf, questionsPdf };
  window.CoachDashboard = { render };
})();
