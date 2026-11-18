/* Öğrenci sayfaları: Çalışma planlarım ve Deneme sonuçlarım (koç sayfalarıyla aynı görsel dil). */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : 0;
  const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const day = iso => new Date(String(iso).slice(0, 10) + 'T00:00:00');
  const fmtDay = iso => day(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
  const fmtWeek = iso => { const s = day(iso), e = new Date(s); e.setDate(e.getDate() + 6); return `${s.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`; };
  const stateOf = (t, today) => t.isCompleted ? ['done', 'Tamamlandı'] : String(t.dueDate).slice(0, 10) < today ? ['late', 'Gecikti'] : t.completedQuestions > 0 ? ['going', 'Devam ediyor'] : ['wait', 'Bekliyor'];
  const kpi = (icon, label, value, foot, tone) => `<div class="sd-kpi ${tone}"><span class="sd-kpi-ico">${icon}</span><div><small>${label}</small><b>${value}</b>${foot ? `<em>${foot}</em>` : ''}</div></div>`;

  /* ---------- Çalışma planlarım ---------- */
  function plans(content, detail, { authRequest, reload }) {
    const list = detail.plans || [], today = key(new Date()), tenantId = detail.student.tenantId;
    const all = list.flatMap(p => p.tasks || []);
    const done = all.filter(t => t.isCompleted).length, late = all.filter(t => !t.isCompleted && String(t.dueDate).slice(0, 10) < today).length;
    const target = all.reduce((s, t) => s + Number(t.targetQuestions || 0), 0), solved = all.reduce((s, t) => s + Number(t.completedQuestions || 0), 0);
    const counts = { all: all.length, late, going: all.filter(t => stateOf(t, today)[0] === 'going').length, wait: all.filter(t => stateOf(t, today)[0] === 'wait').length, done };
    const chips = [['all', 'Tümü'], ['late', 'Geciken'], ['going', 'Devam eden'], ['wait', 'Bekleyen'], ['done', 'Tamamlanan']];
    const actions = (plan, t) => `<div class="pl-actions"><button type="button" class="pl-btn main sp-progress" data-plan="${plan.id}" data-task="${t.id}">İlerleme gir</button>${t.isCompleted ? `<button type="button" class="pl-btn icon sp-undo" data-plan="${plan.id}" data-task="${t.id}" title="Tamamlandı işaretini kaldır" aria-label="Geri al">↩</button>` : `<button type="button" class="pl-btn icon ok sp-done" data-plan="${plan.id}" data-task="${t.id}" title="Tamamlandı olarak işaretle" aria-label="Tamamlandı">✓</button>`}</div>`;
    const cards = [...list].sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart))).map(plan => {
      const tasks = [...(plan.tasks || [])].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
      const tg = tasks.reduce((s, t) => s + Number(t.targetQuestions || 0), 0), sv = tasks.reduce((s, t) => s + Number(t.completedQuestions || 0), 0), p = pct(sv, tg);
      if (tasks.length === 1) {
        const t = tasks[0], [k, label] = stateOf(t, today), tp = pct(t.completedQuestions, t.targetQuestions);
        return `<article class="pl-plan pl-one ${k}"><span class="pl-avatar">🗒️</span><div class="pl-one-who"><h3>${fmtWeek(plan.weekStart)}</h3><p>${esc(plan.title)}</p></div><div class="pl-one-task"><strong>${esc(t.title)}</strong><span><span class="pl-pill ${k}">${label}</span><small>📅 ${fmtDay(t.dueDate)}</small></span></div><div class="pl-one-prog"><div class="pl-bar"><i style="width:${tp}%"></i></div><small><b>%${tp}</b> · ${t.completedQuestions || 0} / ${t.targetQuestions || 0} soru</small></div>${actions(plan, t)}</article>`;
      }
      const rows = tasks.map(t => { const [k, label] = stateOf(t, today); return `<div class="pl-task ${k}"><span class="pl-pill ${k}">${label}</span><div class="pl-task-main"><strong>${esc(t.title)}</strong><small>📅 ${fmtDay(t.dueDate)}</small></div><div class="pl-task-prog"><div class="pl-bar"><i style="width:${pct(t.completedQuestions, t.targetQuestions)}%"></i></div><small>${t.completedQuestions || 0} / ${t.targetQuestions || 0} soru</small></div>${actions(plan, t)}</div>`; }).join('') || '<p class="pl-empty">Bu planda görev yok.</p>';
      return `<article class="pl-plan"><header class="pl-plan-head"><span class="pl-avatar">🗒️</span><div class="pl-plan-info"><h3>${fmtWeek(plan.weekStart)}</h3><p>${esc(plan.title)} · ${tasks.length} görev</p></div><div class="pl-plan-prog"><b>%${p}</b><div class="pl-bar"><i style="width:${p}%"></i></div><small>${sv} / ${tg} soru</small></div></header><div class="pl-tasks">${rows}</div></article>`;
    }).join('');
    content.innerHTML = `<div class="welcome"><div><h1>Çalışma Planlarım</h1><p>Koçunun verdiği görevleri takip et, ilerlemeni gir veya tamamladıklarını işaretle.</p></div><a class="primary" href="#schedule">Randevularım →</a></div>
      <div class="sd-kpis sp-kpis">${kpi('📋', 'Aktif plan', list.length, '', 'indigo')}${kpi('✅', 'Tamamlanan görev', `${done} / ${all.length}`, all.length ? `%${pct(done, all.length)} tamamlandı` : '', 'teal')}${kpi('✏️', 'Çözülen / hedef soru', `${solved} / ${target}`, target ? `%${pct(solved, target)}` : '', 'amber')}${kpi('⏰', 'Geciken görev', late, late ? 'Önce bunlara bak' : 'Her şey yolunda', late ? 'rose' : 'green')}</div>
      <div class="card section"><div class="section-title"><div><h2>Planlarım</h2></div><button type="button" class="pl-btn" id="sp-pdf">📄 PDF indir</button></div>
      ${all.length ? `<div class="pl-filter"><div></div><div class="pl-chips">${chips.map(([k, l]) => `<button type="button" class="pl-chip ${k} ${k === 'all' ? 'on' : ''}" data-status="${k}">${l}<b>${counts[k]}</b></button>`).join('')}</div></div>` : ''}
      <div id="sp-list" class="pl-list">${cards || '<div class="pl-empty-state"><strong>Henüz çalışma planı yok</strong><p>Koçun bir plan atadığında görevlerin burada görünecek.</p></div>'}</div></div>`;

    const listEl = content.querySelector('#sp-list'), chipsEl = content.querySelector('.pl-chips');
    if (chipsEl) chipsEl.addEventListener('click', e => {
      const c = e.target.closest('.pl-chip'); if (!c) return; const status = c.dataset.status;
      chipsEl.querySelectorAll('.pl-chip').forEach(x => x.classList.toggle('on', x === c));
      listEl.querySelectorAll('.pl-plan').forEach(card => {
        let shown = 0;
        if (card.classList.contains('pl-one')) shown = (status === 'all' || card.classList.contains(status)) ? 1 : 0;
        else card.querySelectorAll('.pl-task').forEach(row => { const ok = status === 'all' || row.classList.contains(status); row.classList.toggle('hidden', !ok); if (ok) shown++; });
        card.classList.toggle('hidden', status !== 'all' && !shown);
      });
    });
    const save = async (plan, task, completedQuestions, isCompleted) => {
      const r = await authRequest(`/api/tenants/${tenantId}/plans/${plan.id}/tasks/${task.id}/progress`, { method: 'PUT', body: JSON.stringify({ completedQuestions, isCompleted }) });
      if (!r.ok) { alert('İlerleme kaydedilemedi. Tekrar dene.'); return; }
      await reload();
    };
    const find = el => { const plan = list.find(p => p.id === el.dataset.plan), task = plan && (plan.tasks || []).find(t => t.id === el.dataset.task); return plan && task ? { plan, task } : null; };
    listEl.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return; const f = find(b); if (!f) return; const { plan, task } = f, tg = Number(task.targetQuestions || 0);
      if (b.classList.contains('sp-progress')) {
        const v = await CoachUI.progress({ title: 'İlerlemeni gir', subtitle: task.title, current: Number(task.completedQuestions || 0), target: tg });
        if (v !== null) await save(plan, task, v, tg > 0 && v >= tg);
      } else if (b.classList.contains('sp-done')) await save(plan, task, Math.max(Number(task.completedQuestions || 0), tg), true);
      else if (b.classList.contains('sp-undo')) await save(plan, task, 0, false);
    });
    content.querySelector('#sp-pdf')?.addEventListener('click', () => {
      if (!window.StudentDetailUI) return;
      StudentDetailUI.setContext({ student: detail.student, tenantId, authRequest, preload: { '/plans': list } });
      document.getElementById('sp-pdf-hook')?.remove();
      const h = document.createElement('button'); h.id = 'sp-pdf-hook'; h.hidden = true; h.dataset.sdPdf = 'plans'; document.body.appendChild(h); h.click(); h.remove();
    });
  }

  /* ---------- Deneme sonuçlarım ---------- */
  function exams(content, detail, { authRequest, reload }) {
    const student = detail.student, tenantId = student.tenantId, list = detail.exams || [];
    content.innerHTML = `<div class="welcome"><div><h1>Deneme &amp; Sınavlarım</h1><p>Sonuçlarını, net gelişimini ve otomatik analizini takip et.</p></div></div><div class="card section" id="sp-exams-card"><div id="sp-exams"></div></div>`;
    if (!window.StudentDetailUI) return;
    StudentDetailUI.setContext({ student, tenantId, authRequest, preload: { '/exams': list, '/plans': detail.plans || [], '/subjects': detail.subjects || [], '/question-summary': detail.questionSummary || {}, '/sessions': detail.sessions || [], '/lesson-slots': detail.lessonSlots || [] } });
    StudentDetailUI.mountExams(content.querySelector('#sp-exams'), { student, exams: list, tenantId, authRequest, readOnly: true, refresh: reload });
  }

  window.StudentPages = { plans, exams };
})();
