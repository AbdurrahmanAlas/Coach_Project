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
      const rows = tasks.map(t => { const [k, label] = state(t); return `<div class="sd-task ${k}"><span class="sd-pill ${k}">${label}</span><div class="sd-task-main"><strong>${esc(t.title)}</strong><small>📅 ${fmtDay(t.dueDate)}</small></div><div class="sd-task-prog"><div class="sd-bar"><i style="width:${pct(t.completedQuestions, t.targetQuestions)}%"></i></div><small>${t.completedQuestions || 0} / ${t.targetQuestions || 0} soru</small></div></div>`; }).join('') || '<p class="sd-muted">Bu planda görev yok.</p>';
      return `<article class="sd-plan"><header><div><h4>${esc(plan.title)}</h4><p>🗓️ ${fmtShort(plan.weekStart)} – ${end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${tasks.length} görev</p></div><div class="sd-plan-prog"><b>%${p}</b><div class="sd-bar"><i style="width:${p}%"></i></div><small>${sv} / ${tg} soru</small></div></header><div class="sd-tasks">${rows}</div></article>`;
    }).join('');
    return head + `<div class="sd-plans">${cards}</div>`;
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
    return `<div class="sd-card-head"><div><h3>Ders ve konu ilerlemesi</h3><span class="sd-note">${missing ? `${missing} konu takip gerektiriyor` : 'Tüm konular güncel görünüyor'}</span></div><div class="sd-actions"><button type="button" class="sd-btn" id="export-subject-progress">CSV indir</button><button type="button" class="sd-btn main" id="add-subject-progress">＋ Konu ekle</button></div></div>${sorted.length ? `<div class="sd-subjects">${sorted.map(i => { const v = Number(i.completionPercent || 0); return `<div class="sd-subj"><div class="sd-subj-main"><strong>${esc(i.subject)} <span>· ${esc(i.topic)}</span></strong><div class="sd-bar ${v < 70 ? 'low' : 'ok'}"><i style="width:${v}%"></i></div></div><span class="sd-pct ${v < 70 ? 'low' : 'ok'}">%${v}</span><button type="button" class="sd-btn subject-edit" data-id="${i.id}">Düzenle</button><button type="button" class="sd-btn danger subject-delete" data-id="${i.id}">Sil</button></div>`; }).join('')}</div>` : '<p class="sd-muted">Henüz konu ilerlemesi girilmedi. "＋ Konu ekle" ile başlayabilirsin.</p>'}`;
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
      const share = items.length ? `<div class="sd-share"><div><b>Sonuçları paylaş</b><span>Deneme raporunu WhatsApp ile gönder.</span></div><div class="sd-share-actions"><label>Gönderilecek kişi<select id="sd-to"><option value="guardian" ${state.shareTo !== 'student' ? 'selected' : ''}>Veli</option><option value="student" ${state.shareTo === 'student' ? 'selected' : ''}>Öğrenci</option></select></label><button type="button" class="sd-btn wa" data-share="image">🖼️ Görsel</button><button type="button" class="sd-btn" data-share="pdf">📄 PDF</button></div>${state.msg ? `<div class="sd-msg ${state.err ? 'err' : 'ok'}">${esc(state.msg)}</div>` : ''}</div>` : '';
      const visible = sorted.slice(0, state.limit);
      const table = items.length ? `<div class="sd-table"><div class="sd-thead"><span>Tarih</span><span>Deneme</span><span>Doğru / Yanlış / Boş</span><span>Net</span><span>Puan</span><span></span></div>${visible.map(e => `<div class="sd-trow"><span class="sd-date">${fmtDate(e.examDate)}</span><strong>${esc(e.title)}</strong><span class="sd-dyb"><i class="ok">${e.correct} D</i><i class="bad">${e.wrong} Y</i><i class="blank">${e.blank} B</i></span><span class="sd-net"><b>${fmtNum(e.net)}</b><div class="sd-bar"><i style="width:${pct(e.net, e.total)}%"></i></div></span><span class="sd-score">${fmtNum(e.scoreN)}</span><span class="sd-row-actions"><button type="button" class="sd-btn" data-edit="${e.id}">Düzenle</button><button type="button" class="sd-btn danger" data-del="${e.id}">Sil</button></span></div>`).join('')}</div>${sorted.length > visible.length ? `<div class="sd-more"><button type="button" class="sd-btn" data-more>Tümünü göster (${sorted.length - visible.length} kalan)</button></div>` : ''}` : '<div class="sd-empty"><strong>Henüz deneme sonucu yok</strong><p>İlk deneme sonucunu ekleyerek net gelişimini takip etmeye başla.</p><button type="button" class="sd-btn main" data-add>＋ Deneme ekle</button></div>';
      root.innerHTML = `<div class="sd-exam-head"><div><h3>Deneme sonuçları</h3><p>${esc(student.firstName)} ${esc(student.lastName || '')} için tüm denemeler ve net gelişimi</p></div><div class="sd-actions"><button type="button" class="sd-btn" data-csv>CSV indir ↓</button><button type="button" class="sd-btn main" data-add>＋ Deneme ekle</button></div></div>${stats}${trend}${share}${table}`;
    }
    const say = (m, err) => { state.msg = m; state.err = !!err; render(); };
    async function shareExams(asPdf) {
      if (!window.KoclukShare) return say('Paylaşım modülü yüklenemedi. Sayfayı yenileyin.', true);
      const series = [...items].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
      if (!series.length) return say('Paylaşılacak deneme yok.', true);
      say('Hazırlanıyor…');
      try {
        const name = `${student.firstName} ${student.lastName || ''}`.trim(), last = series[series.length - 1], prev = series[series.length - 2], best = series.reduce((m, e) => e.net > m.net ? e : m, series[0]), diff = prev ? last.net - prev.net : null;
        const canvas = KoclukShare.examReportCanvas({
          name, sub: `${series.length} deneme · Tüm zamanlar`, dateLabel: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }), coach: document.getElementById('profile-name')?.textContent?.trim() || '',
          stats: [{ label: 'Toplam deneme', value: String(series.length) }, { label: 'Ortalama net', value: fmtNum(series.reduce((s, e) => s + e.net, 0) / series.length) }, { label: 'En yüksek net', value: fmtNum(best.net) }, { label: 'Son deneme neti', value: fmtNum(last.net) }],
          delta: diff === null ? null : { up: diff >= 0, text: `${diff >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(diff))} net son denemede` },
          points: series.slice(-12).map(e => ({ net: e.net, label: fmtNum(e.net), date: fmtShort(e.examDate) })),
          rows: [...series].reverse().slice(0, 12).map(e => ({ date: fmtDate(e.examDate), title: e.title, d: String(e.correct), y: String(e.wrong), b: String(e.blank), net: fmtNum(e.net), score: fmtNum(e.scoreN) }))
        });
        const blob = asPdf ? await KoclukShare.toPdf(canvas) : await KoclukShare.toBlob(canvas, 'image/png');
        const g = student.guardian || {}, phone = state.shareTo === 'student' ? (student.phoneNumber || g.phoneNumber || '') : (g.phoneNumber || student.phoneNumber || '');
        const res = await KoclukShare.deliver({ blob, filename: `deneme-raporu-${slug(name)}${asPdf ? '.pdf' : '.png'}`, text: `${name} - deneme sonuç raporu (${series.length} deneme, son net: ${fmtNum(last.net)})`, phone });
        say(KoclukShare.describe ? KoclukShare.describe(res, asPdf) : 'Hazırlandı.');
      } catch (e) { console.warn(e); say('Rapor hazırlanamadı. Tekrar deneyin.', true); }
    }
    root.addEventListener('change', e => { if (e.target.id === 'sd-to') state.shareTo = e.target.value; });
    root.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.more !== undefined) { state.limit += 8; render(); }
      else if (t.dataset.share) shareExams(t.dataset.share === 'pdf');
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

  window.StudentDetailUI = { plans, questionSummary, insights, subjects, mountExams };
})();
