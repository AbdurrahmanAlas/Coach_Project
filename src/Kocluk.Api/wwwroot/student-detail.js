/* Öğrenci gelişim dosyası penceresindeki sekmelerin içerikleri: planlar, denemeler, soru performansı, analiz, konu ilerlemesi. */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : 0;
  const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const day = iso => new Date(String(iso).slice(0, 10) + 'T00:00:00');
  const fmtDate = iso => day(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = iso => day(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const fmtDay = iso => day(iso).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
  const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const slug = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ogrenci';
  const kpi = (icon, label, value, foot, tone) => `<div class="sd-kpi ${tone || ''}"><span class="sd-kpi-ico">${icon}</span><div><small>${label}</small><b>${value}</b>${foot ? `<em>${foot}</em>` : ''}</div></div>`;

  /* ---------- Çalışma planları ---------- */
  function plans(items) {
    const today = todayKey(), all = items.flatMap(p => p.tasks || []);
    const done = all.filter(t => t.isCompleted).length, late = all.filter(t => !t.isCompleted && String(t.dueDate).slice(0, 10) < today).length;
    const target = all.reduce((s, t) => s + Number(t.targetQuestions || 0), 0), solved = all.reduce((s, t) => s + Number(t.completedQuestions || 0), 0);
    const state = t => t.isCompleted ? ['done', 'Tamamlandı'] : String(t.dueDate).slice(0, 10) < today ? ['late', 'Gecikti'] : t.completedQuestions > 0 ? ['going', 'Devam ediyor'] : ['wait', 'Bekliyor'];
    const head = `<div class="sd-kpis">${kpi('📋', 'Aktif plan', items.length, '', 'indigo')}${kpi('✅', 'Tamamlanan görev', `${done} / ${all.length}`, all.length ? `%${pct(done, all.length)} tamamlandı` : '', 'teal')}${kpi('✏️', 'Çözülen / hedef soru', `${solved} / ${target}`, target ? `%${pct(solved, target)}` : '', 'amber')}${kpi('⏰', 'Geciken görev', late, late ? 'Takip gerekiyor' : 'Her şey yolunda', late ? 'rose' : 'green')}</div>`;
    if (!items.length) return head + '<div class="sd-empty"><strong>Henüz çalışma planı yok</strong><p>Bu öğrenci için haftalık plan oluşturarak görevleri ve soru hedeflerini takip edebilirsin.</p><button type="button" class="sd-btn main" data-go-plans>＋ Plan oluştur</button></div>';
    const cards = [...items].sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart))).map(plan => {
      const tasks = [...(plan.tasks || [])].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
      const tg = tasks.reduce((s, t) => s + Number(t.targetQuestions || 0), 0), sv = tasks.reduce((s, t) => s + Number(t.completedQuestions || 0), 0), p = pct(sv, tg);
      const end = new Date(day(plan.weekStart)); end.setDate(end.getDate() + 6);
      if (tasks.length === 1) {
        const t = tasks[0], [k, label] = state(t), tp = pct(t.completedQuestions, t.targetQuestions);
        return `<article class="sd-one ${k}"><div class="sd-one-plan"><b>${fmtShort(plan.weekStart)} – ${end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</b><small>${esc(String(plan.title).replace(/^.*?\s[-–]\s/, ''))}</small></div><div class="sd-one-task"><strong>${esc(t.title)}</strong><span><span class="sd-pill ${k}">${label}</span><small>📅 ${fmtDay(t.dueDate)}</small></span></div><div class="sd-one-prog"><div class="sd-bar"><i style="width:${tp}%"></i></div><small><b>%${tp}</b> · ${t.completedQuestions || 0} / ${t.targetQuestions || 0} soru</small></div></article>`;
      }
      const rows = tasks.map(t => { const [k, label] = state(t); return `<div class="sd-task ${k}"><span class="sd-pill ${k}">${label}</span><div class="sd-task-main"><strong>${esc(t.title)}</strong><small>📅 ${fmtDay(t.dueDate)}</small></div><div class="sd-task-prog"><div class="sd-bar"><i style="width:${pct(t.completedQuestions, t.targetQuestions)}%"></i></div><small>${t.completedQuestions || 0} / ${t.targetQuestions || 0} soru</small></div></div>`; }).join('') || '<p class="sd-muted">Bu planda görev yok.</p>';
      return `<article class="sd-plan"><header><div><h4>${esc(plan.title)}</h4><p>🗓️ ${fmtShort(plan.weekStart)} – ${end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${tasks.length} görev</p></div><div class="sd-plan-prog"><b>%${p}</b><div class="sd-bar"><i style="width:${p}%"></i></div><small>${sv} / ${tg} soru</small></div></header><div class="sd-tasks">${rows}</div></article>`;
    }).join('');
    return head + `<div class="sd-plans compact">${cards}</div>`;
  }

  /* ---------- Soru performansı, analiz, konu ilerlemesi ---------- */
  function donut(rate) {
    const R = 44, C = 2 * Math.PI * R, v = Math.max(0, Math.min(100, Number(rate) || 0));
    return `<svg viewBox="0 0 120 120" class="sd-donut-svg" role="img" aria-label="Başarı oranı %${Math.round(v)}"><circle cx="60" cy="60" r="${R}" fill="none" stroke="#e8eafb" stroke-width="13"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="${v >= 70 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444'}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="22" font-weight="800" fill="#1e1b4b">%${Math.round(v)}</text></svg>`;
  }
  function questionSummary(s) {
    const blank = Math.max(0, (s.total || 0) - (s.correct || 0) - (s.wrong || 0));
    const bars = (s.bySubject || []).map(i => `<div class="sd-barrow"><div class="sd-barrow-top"><strong>${esc(i.subject)}</strong><span class="${i.rate >= 70 ? 'ok' : i.rate >= 50 ? 'mid' : 'low'}">%${i.rate}</span></div><div class="sd-bar ${i.rate >= 70 ? 'ok' : i.rate >= 50 ? 'mid' : 'low'}"><i style="width:${Math.min(100, i.rate)}%"></i></div><small>${i.correct}/${i.total} doğru</small></div>`).join('');
    return `<div class="sd-card-head"><h3>Soru performansı</h3><span class="sd-chip">%${s.rate || 0} başarı</span></div><div class="sd-qs"><div class="sd-donut">${donut(s.rate)}</div><div class="sd-qs-stats"><div><b>${s.total || 0}</b><small>Toplam soru</small></div><div class="ok"><b>${s.correct || 0}</b><small>Doğru</small></div><div class="bad"><b>${s.wrong || 0}</b><small>Yanlış</small></div>${blank ? `<div><b>${blank}</b><small>Boş</small></div>` : ''}</div></div>${bars ? `<div class="sd-barrows">${bars}</div>` : '<p class="sd-muted">Henüz soru çözümü yok. Öğrenci koçun atadığı soruları çözdükçe burada görünür.</p>'}`;
  }
  function insights(data) {
    const list = (data && data.insights) || [];
    return `<div class="sd-card-head"><h3>Akıllı gelişim analizi</h3><span class="sd-chip">Otomatik</span></div>${list.length ? `<div class="sd-insights">${list.map(i => `<div class="sd-insight"><span>💡</span><div><strong>${esc(i.title)}</strong><small>${esc(i.detail)}</small></div></div>`).join('')}</div>` : '<p class="sd-muted">Analiz için henüz yeterli veri yok.</p>'}`;
  }
  function subjects(list, missing) {
    const sorted = [...list].sort((a, b) => Number(a.completionPercent || 0) - Number(b.completionPercent || 0));
    return `<div class="sd-card-head"><div><h3>Ders ve konu ilerlemesi</h3><span class="sd-note">${missing ? `${missing} konu takip gerektiriyor` : 'Tüm konular güncel görünüyor'}</span></div><div class="sd-actions"><button type="button" class="sd-btn" id="export-subject-progress">CSV indir</button><button type="button" class="sd-btn" data-sd-pdf="overview">PDF indir</button><button type="button" class="sd-btn main" id="add-subject-progress">＋ Konu ekle</button></div></div>${sorted.length ? `<div class="sd-subjects">${sorted.map(i => { const v = Number(i.completionPercent || 0); return `<div class="sd-subj"><div class="sd-subj-main"><strong>${esc(i.subject)} <span>· ${esc(i.topic)}</span></strong><div class="sd-bar ${v < 70 ? 'low' : 'ok'}"><i style="width:${v}%"></i></div></div><span class="sd-pct ${v < 70 ? 'low' : 'ok'}">%${v}</span><button type="button" class="sd-btn subject-edit" data-id="${i.id}">Düzenle</button><button type="button" class="sd-btn danger subject-delete" data-id="${i.id}">Sil</button></div>`; }).join('')}</div>` : '<p class="sd-muted">Henüz konu ilerlemesi girilmedi. "＋ Konu ekle" ile başlayabilirsin.</p>'}`;
  }

  /* ---------- Deneme analizi (ekranda ve paylaşılan raporda aynı metinler) ---------- */
  const normExam = e => ({ ...e, net: Number(e.net ?? (Number(e.correct || 0) - Number(e.wrong || 0) / 4)), scoreN: Number(e.score || 0), total: Number(e.correct || 0) + Number(e.wrong || 0) + Number(e.blank || 0) });
  function analyse(list) {
    const s = [...list].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate))), out = [];
    if (!s.length) return out;
    const avg = a => a.reduce((x, e) => x + e.net, 0) / (a.length || 1), last = s[s.length - 1], prev = s[s.length - 2];
    if (prev) {
      const d = last.net - prev.net;
      out.push({ tone: d >= 0 ? 'up' : 'down', title: d >= 0 ? 'Son denemede yükseliş' : 'Son denemede düşüş', text: `Son deneme neti ${fmtNum(last.net)}; bir önceki denemeye göre ${fmtNum(Math.abs(d))} net ${d >= 0 ? 'artış' : 'azalış'} var.${d < 0 ? ' Yanlış yapılan konuların tekrarı önerilir.' : ' Bu tempoyu korumak önemli.'}` });
    }
    if (s.length >= 4) {
      const half = Math.min(3, Math.floor(s.length / 2)), recent = avg(s.slice(-half)), before = avg(s.slice(-half * 2, -half)), d = recent - before;
      out.push({ tone: d >= 0 ? 'up' : 'down', title: 'Genel eğilim', text: `Son ${half} denemenin ortalaması ${fmtNum(recent)} net; öncesindeki ${half} denemeye göre ${fmtNum(Math.abs(d))} net ${d >= 0 ? 'yüksek' : 'düşük'}.` });
    }
    const best = s.reduce((m, e) => e.net > m.net ? e : m, s[0]);
    out.push({ tone: 'info', title: 'En iyi performans', text: `${best.title} denemesinde ${fmtNum(best.net)} net ile en yüksek sonuç alındı. Ortalama net ${fmtNum(avg(s))}.` });
    const C = s.reduce((x, e) => x + Number(e.correct || 0), 0), W = s.reduce((x, e) => x + Number(e.wrong || 0), 0), B = s.reduce((x, e) => x + Number(e.blank || 0), 0), T = C + W + B;
    if (T) {
      const wr = Math.round(W / T * 100), br = Math.round(B / T * 100);
      out.push({ tone: wr > 20 ? 'down' : 'info', title: 'Doğru / yanlış / boş dağılımı', text: `Toplam soruların %${Math.round(C / T * 100)}'i doğru, %${wr}'i yanlış, %${br}'i boş. ${wr > br && wr > 15 ? 'Yanlışlar boşlardan fazla; emin olunmayan sorularda daha dikkatli karar verilmeli.' : br > 20 ? 'Boş sayısı yüksek; konu eksikleri ve süre yönetimi üzerinde çalışılmalı.' : 'Dağılım dengeli görünüyor.'}` });
    }
    return out;
  }
  const analysisCard = list => { const a = analyse(list); return a.length ? `<div class="sd-card"><div class="sd-card-head"><div><h3>Deneme analizi</h3><span class="sd-note">Sonuçlara göre otomatik yorum</span></div></div><div class="sd-insights">${a.map(i => `<div class="sd-insight ${i.tone}"><span>${i.tone === 'up' ? '📈' : i.tone === 'down' ? '📉' : '💡'}</span><div><strong>${esc(i.title)}</strong><small>${esc(i.text)}</small></div></div>`).join('')}</div></div>` : ''; };

  /* ---------- WhatsApp paylaşım çubuğu (her sekme için PDF / görsel) ---------- */
  const TITLES = { overview: 'Genel bakış raporu', plans: 'Çalışma planı raporu', exams: 'Deneme sonuç raporu', week: 'Haftalık program' };
  const longDate = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const coachName = () => document.getElementById('profile-name')?.textContent?.trim() || '';
  const getList = async (ctx, path) => { try { const r = await ctx.authRequest(`/api/tenants/${ctx.tenantId}/students/${ctx.student.id}${path}`); return r.ok ? await r.json() : null; } catch { return null; } };
  const planState = (t, today) => t.isCompleted ? ['done', 'Tamamlandı'] : String(t.dueDate).slice(0, 10) < today ? ['late', 'Gecikti'] : t.completedQuestions > 0 ? ['going', 'Devam ediyor'] : ['wait', 'Bekliyor'];
  async function buildPack(kind, ctx) {
    const st = ctx.student, name = `${st.firstName} ${st.lastName || ''}`.trim(), base = { name, dateLabel: longDate(), coach: coachName() }, today = todayKey();
    if (kind === 'exams') {
      const series = ((await getList(ctx, '/exams')) || []).map(normExam).sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
      if (!series.length) throw new Error('Paylaşılacak deneme yok.');
      const last = series[series.length - 1], prev = series[series.length - 2], best = series.reduce((m, e) => e.net > m.net ? e : m, series[0]), diff = prev ? last.net - prev.net : null;
      return { file: 'deneme-raporu', caption: `${name} - deneme sonuç raporu (${series.length} deneme, son net: ${fmtNum(last.net)})`, canvas: KoclukShare.examReportCanvas({ ...base, sub: `${series.length} deneme · Tüm zamanlar`,
        stats: [{ label: 'Toplam deneme', value: String(series.length) }, { label: 'Ortalama net', value: fmtNum(series.reduce((s, e) => s + e.net, 0) / series.length) }, { label: 'En yüksek net', value: fmtNum(best.net) }, { label: 'Son deneme neti', value: fmtNum(last.net) }],
        delta: diff === null ? null : { up: diff >= 0, text: `${diff >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(diff))} net son denemede` },
        points: series.slice(-12).map(e => ({ net: e.net, label: fmtNum(e.net), date: fmtShort(e.examDate) })), analysis: analyse(series),
        rows: [...series].reverse().slice(0, 12).map(e => ({ date: fmtDate(e.examDate), title: e.title, d: String(e.correct), y: String(e.wrong), b: String(e.blank), net: fmtNum(e.net), score: fmtNum(e.scoreN) })) }) };
    }
    if (kind === 'plans') {
      const plansList = (await getList(ctx, '/plans')) || [], all = plansList.flatMap(p => p.tasks || []);
      if (!all.length) throw new Error('Paylaşılacak plan görevi yok.');
      const done = all.filter(t => t.isCompleted).length, late = all.filter(t => !t.isCompleted && String(t.dueDate).slice(0, 10) < today).length, target = all.reduce((s, t) => s + Number(t.targetQuestions || 0), 0), solved = all.reduce((s, t) => s + Number(t.completedQuestions || 0), 0);
      const sections = [...plansList].sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart))).slice(0, 3).map(p => ({ title: p.title, rows: [...(p.tasks || [])].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).map(t => { const [tone, label] = planState(t, today); return { title: t.title, sub: `${fmtDay(t.dueDate)} · ${t.completedQuestions || 0} / ${t.targetQuestions || 0} soru`, value: (tone === 'done' ? '✓ ' : '') + label, tone }; }), empty: 'Bu planda görev yok.' }));
      return { file: 'calisma-plani', caption: `${name} - çalışma planı durumu (${done}/${all.length} görev tamamlandı)`, canvas: KoclukShare.summaryCanvas({ ...base, kicker: 'ÇALIŞMA PLANI RAPORU', sub: longDate(),
        stats: [{ label: 'Aktif plan', value: String(plansList.length) }, { label: 'Tamamlanan görev', value: `${done} / ${all.length}` }, { label: 'Çözülen / hedef soru', value: `${solved} / ${target}` }, { label: 'Geciken görev', value: String(late) }], sections,
        note: late ? `${late} görev zamanında tamamlanmadı. Takip ve destek önerilir.` : 'Tüm görevler zamanında ilerliyor.' }) };
    }
    if (kind === 'week') {
      const [lessons, sessions, plansList] = await Promise.all([getList(ctx, '/lesson-slots'), getList(ctx, '/sessions'), getList(ctx, '/plans')]);
      const model = window.KoclukWeek && window.KoclukWeek.buildModel({ student: st, lessons: lessons || [], sessions: sessions || [], tasks: (plansList || []).flatMap(p => p.tasks || []), offset: 0 });
      if (!model || !model.total) throw new Error('Bu 7 günde paylaşılacak program yok.');
      return { file: 'haftalik-program', caption: `${name} - haftalık ders programı (${model.range})`, canvas: KoclukShare.scheduleCanvas(model) };
    }
    const [summary, insightData, subjectList, plansList, examList] = await Promise.all([getList(ctx, '/question-summary'), getList(ctx, '/insights'), getList(ctx, '/subjects'), getList(ctx, '/plans'), getList(ctx, '/exams')]);
    const s = summary || {}, all = (plansList || []).flatMap(p => p.tasks || []), done = all.filter(t => t.isCompleted).length, exams = (examList || []).map(normExam).sort((a, b) => String(a.examDate).localeCompare(String(b.examDate))), lastExam = exams[exams.length - 1];
    const sections = [
      { title: 'Ders bazlı soru başarısı', empty: 'Henüz çözülmüş soru yok.', rows: (s.bySubject || []).map(i => ({ title: i.subject, sub: `${i.correct} / ${i.total} doğru`, value: `%${i.rate}`, tone: i.rate >= 70 ? 'up' : i.rate >= 50 ? 'going' : 'down' })) },
      { title: 'Konu ilerlemesi', empty: 'Henüz konu ilerlemesi girilmedi.', rows: [...(subjectList || [])].sort((a, b) => Number(a.completionPercent || 0) - Number(b.completionPercent || 0)).slice(0, 8).map(i => ({ title: `${i.subject} · ${i.topic}`, sub: '', value: `%${Number(i.completionPercent || 0)}`, tone: Number(i.completionPercent || 0) < 70 ? 'down' : 'up' })) }
    ];
    const ins = ((insightData && insightData.insights) || []).slice(0, 4);
    if (ins.length) sections.push({ title: 'Gelişim analizi', rows: ins.map(i => ({ title: i.title, sub: i.detail, value: '', tone: 'info' })) });
    return { file: 'gelisim-raporu', caption: `${name} - öğrenci gelişim raporu`, canvas: KoclukShare.summaryCanvas({ ...base, kicker: 'ÖĞRENCİ GELİŞİM RAPORU', sub: longDate(),
      stats: [{ label: 'Çözülen soru', value: String(s.total || 0) }, { label: 'Başarı oranı', value: `%${s.rate || 0}` }, { label: 'Tamamlanan görev', value: `${done} / ${all.length}` }, { label: 'Son deneme neti', value: lastExam ? fmtNum(lastExam.net) : '—' }], sections,
      note: lastExam ? `Son denemede ${fmtNum(lastExam.net)} net. ${(analyse(exams)[0] || {}).text || ''}` : '' }) };
  }
  let lastCtx = null;
  async function downloadPdf(kind) {
    if (!lastCtx || !window.KoclukShare) return;
    try { const pack = await buildPack(kind, lastCtx), st = lastCtx.student; KoclukShare.download(await KoclukShare.toPdf(pack.canvas), `${pack.file}-${slug(`${st.firstName} ${st.lastName || ''}`)}.pdf`); }
    catch (err) { console.warn(err); alert(err && err.message && !/^(TypeError|ReferenceError)/.test(err.name || '') ? err.message : 'PDF hazırlanamadı. Tekrar deneyin.'); }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-sd-pdf]'); if (b) downloadPdf(b.dataset.sdPdf); });
  function shareBar(body, tab, ctx) {
    lastCtx = ctx || lastCtx;
    body.querySelector('#sd-share')?.remove();
    if (!ctx || !ctx.student || !TITLES[tab]) return;
    const st = ctx.student, bar = document.createElement('div'); bar.id = 'sd-share'; bar.className = 'sd-share';
    const hasG = !!((st.guardian || {}).phoneNumber), hasS = !!st.phoneNumber;
    bar.innerHTML = `<div><b>${TITLES[tab]} — WhatsApp ile paylaş</b><span>PDF veya görsel olarak veliye ya da öğrenciye gönder.</span></div><div class="sd-share-actions"><label>Gönderilecek kişi<select id="sd-to"><option value="guardian" ${hasG || !hasS ? 'selected' : ''}>Veli</option><option value="student" ${!hasG && hasS ? 'selected' : ''}>Öğrenci</option></select></label><button type="button" class="sd-btn wa" data-sd-share="image">🖼️ Görsel</button><button type="button" class="sd-btn" data-sd-share="pdf">📄 PDF</button><button type="button" class="sd-btn" data-sd-pdf="${tab}" title="WhatsApp açmadan yalnızca indir">⬇ PDF indir</button></div><div class="sd-msg hidden" id="sd-share-msg"></div>`;
    body.prepend(bar);
    const msg = (m, err) => { const el = bar.querySelector('#sd-share-msg'); el.textContent = m; el.className = 'sd-msg ' + (err ? 'err' : 'ok') + (m ? '' : ' hidden'); };
    bar.addEventListener('click', async e => {
      const b = e.target.closest('[data-sd-share]'); if (!b) return;
      if (!window.KoclukShare) return msg('Paylaşım modülü yüklenemedi. Sayfayı yenileyin.', true);
      const asPdf = b.dataset.sdShare === 'pdf'; bar.querySelectorAll('button').forEach(x => x.disabled = true); msg('Hazırlanıyor…');
      try {
        const pack = await buildPack(tab, ctx), blob = asPdf ? await KoclukShare.toPdf(pack.canvas) : await KoclukShare.toBlob(pack.canvas, 'image/png');
        const g = st.guardian || {}, toStudent = bar.querySelector('#sd-to').value === 'student', phone = toStudent ? (st.phoneNumber || g.phoneNumber || '') : (g.phoneNumber || st.phoneNumber || '');
        const res = await KoclukShare.deliver({ blob, filename: `${pack.file}-${slug(`${st.firstName} ${st.lastName || ''}`)}${asPdf ? '.pdf' : '.png'}`, text: pack.caption, phone });
        msg(KoclukShare.describe ? KoclukShare.describe(res, asPdf) : 'Hazırlandı.');
      } catch (err) { console.warn(err); msg(err && err.message && !/^(TypeError|ReferenceError)/.test(err.name || '') ? err.message : 'Rapor hazırlanamadı. Tekrar deneyin.', true); }
      bar.querySelectorAll('button').forEach(x => x.disabled = false);
    });
  }

  /* ---------- Denemeler ---------- */
  function mountExams(host, ctx) {
    const { student, tenantId, authRequest } = ctx;
    const items = (ctx.exams || []).map(e => ({ ...e, net: Number(e.net ?? (Number(e.correct || 0) - Number(e.wrong || 0) / 4)), scoreN: Number(e.score || 0), total: Number(e.correct || 0) + Number(e.wrong || 0) + Number(e.blank || 0) }));
    const sorted = [...items].sort((a, b) => String(b.examDate).localeCompare(String(a.examDate)));
    const state = { limit: 8, shareTo: 'guardian', msg: '', err: false };
    const root = document.createElement('div'); root.className = 'sd-exams'; host.replaceChildren(root);
    const trendSvg = pts => {
      const W = 640, H = 190, padX = 44, top = 34, bottom = 52, base = H - bottom, values = pts.map(p => p.net), max = Math.max(...values), min = Math.min(0, ...values);
      const x = i => padX + (pts.length === 1 ? (W - padX * 2) / 2 : i * (W - padX * 2) / (pts.length - 1)), y = v => top + (1 - (v - min) / ((max - min) || 1)) * (base - top);
      const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(' '), every = Math.ceil(pts.length / 9);
      return `<svg viewBox="0 0 ${W} ${H}" class="sd-trend-svg" role="img" aria-label="Net gelişimi"><line x1="14" y1="${base}" x2="${W - 14}" y2="${base}" stroke="#e2e8f0" stroke-width="1.5"/>${pts.length > 1 ? `<polygon points="${x(0)},${base} ${line} ${x(pts.length - 1)},${base}" fill="rgba(79,70,229,.10)"/><polyline points="${line}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-linejoin="round"/>` : ''}${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.net).toFixed(1)}" r="4.5" fill="#fff" stroke="#4f46e5" stroke-width="2.5"><title>${esc(p.title)} · ${fmtDate(p.examDate)} · ${fmtNum(p.net)} net</title></circle><text x="${x(i).toFixed(1)}" y="${(y(p.net) - 10).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#3730a3">${fmtNum(p.net)}</text>${i % every === 0 || i === pts.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${base + 22}" text-anchor="middle" font-size="11.5" font-weight="600" fill="#64748b">${fmtShort(p.examDate)}</text>` : ''}`).join('')}</svg>`;
    };
    function render() {
      const series = [...items].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
      const best = items.length ? items.reduce((m, e) => e.net > m.net ? e : m, items[0]) : null, last = series[series.length - 1], prev = series[series.length - 2];
      const diff = last && prev ? last.net - prev.net : null;
      const stats = `<div class="sd-kpis">${kpi('📝', 'Toplam deneme', items.length, '', 'indigo')}${kpi('📊', 'Ortalama net', items.length ? fmtNum(items.reduce((s, e) => s + e.net, 0) / items.length) : '—', '', 'violet')}${kpi('🏆', 'En yüksek net', best ? fmtNum(best.net) : '—', best ? esc(best.title) : '', 'amber')}${kpi(diff === null || diff >= 0 ? '📈' : '📉', 'Son deneme neti', last ? fmtNum(last.net) : '—', diff === null ? '' : `${diff >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(diff))} net`, diff === null ? 'teal' : diff >= 0 ? 'green' : 'rose')}</div>`;
      const trend = series.length >= 2 ? `<div class="sd-card"><div class="sd-card-head"><div><h3>Net gelişimi</h3><span class="sd-note">${series.length} deneme · son 12 gösterilir</span></div></div>${trendSvg(series.slice(-12))}</div>` : '';
      const visible = sorted.slice(0, state.limit);
      const table = items.length ? `<div class="sd-table"><div class="sd-thead"><span>Tarih</span><span>Deneme</span><span>Doğru / Yanlış / Boş</span><span>Net</span><span>Puan</span><span></span></div>${visible.map(e => `<div class="sd-trow"><span class="sd-date">${fmtDate(e.examDate)}</span><strong>${esc(e.title)}</strong><span class="sd-dyb"><i class="ok">${e.correct} D</i><i class="bad">${e.wrong} Y</i><i class="blank">${e.blank} B</i></span><span class="sd-net"><b>${fmtNum(e.net)}</b><div class="sd-bar"><i style="width:${pct(e.net, e.total)}%"></i></div></span><span class="sd-score">${fmtNum(e.scoreN)}</span><span class="sd-row-actions"><button type="button" class="sd-btn" data-edit="${e.id}">Düzenle</button><button type="button" class="sd-btn danger" data-del="${e.id}">Sil</button></span></div>`).join('')}</div>${sorted.length > visible.length ? `<div class="sd-more"><button type="button" class="sd-btn" data-more>Tümünü göster (${sorted.length - visible.length} kalan)</button></div>` : ''}` : '<div class="sd-empty"><strong>Henüz deneme sonucu yok</strong><p>İlk deneme sonucunu ekleyerek net gelişimini takip etmeye başla.</p><button type="button" class="sd-btn main" data-add>＋ Deneme ekle</button></div>';
      root.innerHTML = `<div class="sd-exam-head"><div><h3>Deneme sonuçları</h3><p>${esc(student.firstName)} ${esc(student.lastName || '')} için tüm denemeler ve net gelişimi</p></div><div class="sd-actions"><button type="button" class="sd-btn" data-csv>CSV indir ↓</button><button type="button" class="sd-btn" data-sd-pdf="exams">PDF indir ↓</button><button type="button" class="sd-btn main" data-add>＋ Deneme ekle</button></div></div>${state.msg ? `<div class="sd-msg ${state.err ? 'err' : 'ok'}">${esc(state.msg)}</div>` : ''}${stats}${trend}${analysisCard(series)}${table}`;
    }
    const say = (m, err) => { state.msg = m; state.err = !!err; render(); };
    root.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.more !== undefined) { state.limit += 8; render(); }
      else if (t.dataset.add !== undefined) { if (window.__openExamModal) window.__openExamModal([student], null); }
      else if (t.dataset.edit) { const ex = items.find(x => x.id === t.dataset.edit); if (ex && window.__openExamModal) window.__openExamModal([student], { ...ex, studentId: ex.studentId || student.id }); }
      else if (t.dataset.del) {
        if (!confirm('Bu deneme sonucunu silmek istiyor musunuz?')) return;
        const r = await authRequest('/api/tenants/' + tenantId + '/students/' + student.id + '/exams/' + t.dataset.del, { method: 'DELETE' });
        if (r.ok) { if (ctx.refresh) ctx.refresh(); } else say('Deneme silinemedi.', true);
      }
      else if (t.dataset.csv !== undefined) {
        const r = await authRequest('/api/tenants/' + tenantId + '/students/' + student.id + '/exams/export'); if (!r.ok) return say('CSV hazırlanamadı.', true);
        const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = `${slug(student.firstName + ' ' + (student.lastName || ''))}-denemeler.csv`; a.click(); URL.revokeObjectURL(url);
      }
    });
    render();
  }

  window.StudentDetailUI = { shareBar, plans, questionSummary, insights, subjects, mountExams };
})();
