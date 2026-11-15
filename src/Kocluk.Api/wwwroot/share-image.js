/* Rapor ve haftalık programı görsel (PNG) veya PDF olarak üretir ve WhatsApp'a iletir. Dış kütüphane kullanmaz. */
(() => {
  const FONT = '"Segoe UI","Inter",system-ui,-apple-system,Roboto,sans-serif';
  const COL = { ink: '#1e1b4b', muted: '#64748b', line: '#e6e8f5', bg: '#f4f5fb', indigo: '#4f46e5', violet: '#7c3aed', teal: '#0d9488', amber: '#d97706', green: '#16a34a', rose: '#e11d48' };
  const f = (px, weight = 500) => `${weight} ${px}px ${FONT}`;
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function card(ctx, x, y, w, h, o = {}) {
    roundRect(ctx, x, y, w, h, o.r ?? 26);
    ctx.fillStyle = o.fill || '#fff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = o.stroke || COL.line; ctx.stroke();
  }
  function text(ctx, s, x, y, o = {}) {
    ctx.font = o.font || f(24); ctx.fillStyle = o.color || COL.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = o.spacing || '0px';
    ctx.fillText(String(s ?? ''), x, y); ctx.letterSpacing = '0px';
  }
  function fit(ctx, s, maxW, size, weight) {
    let px = size; ctx.font = f(px, weight);
    while (px > 24 && ctx.measureText(s).width > maxW) { px -= 2; ctx.font = f(px, weight); }
    return f(px, weight);
  }
  function wrap(ctx, str, maxW) {
    const out = [];
    String(str || '').split('\n').forEach(par => {
      let line = '';
      par.split(/\s+/).filter(Boolean).forEach(word => {
        let w = word;
        while (ctx.measureText(w).width > maxW) {
          let i = w.length; while (i > 1 && ctx.measureText(w.slice(0, i)).width > maxW) i--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        const test = line ? line + ' ' + w : w;
        if (line && ctx.measureText(test).width > maxW) { out.push(line); line = w; } else line = test;
      });
      out.push(line);
    });
    return out;
  }

  function drawLogo(ctx, x, y, size) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 64, size / 64);
    const bg = ctx.createLinearGradient(6, 4, 58, 62); bg.addColorStop(0, '#4f46e5'); bg.addColorStop(.55, '#7c3aed'); bg.addColorStop(1, '#0d9488');
    roundRect(ctx, 0, 0, 64, 64, 16); ctx.fillStyle = bg; ctx.fill();
    const a = new Path2D('M32 22.5 48.5 55h-6.6l-3.3-7H25.4l-3.3 7h-6.6ZM32 35.1l-3.1 6.6h6.2Z');
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.fill(a, 'evenodd'); ctx.stroke(a);
    const cap = ctx.createLinearGradient(0, 7, 0, 19.4); cap.addColorStop(0, '#fde68a'); cap.addColorStop(1, '#f59e0b');
    const top = new Path2D('M32 7 46.5 13.2 32 19.4 17.5 13.2Z'); ctx.fillStyle = cap; ctx.fill(top); ctx.lineWidth = 1.2; ctx.stroke(top);
    ctx.globalAlpha = .92; ctx.fillStyle = '#fff'; ctx.fill(new Path2D('M24.5 16.4v5.2c0 1.6 3.4 3 7.5 3s7.5-1.4 7.5-3v-5.2L32 19.6Z')); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(46.5, 13.2); ctx.lineTo(46.5, 21.4); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(46.5, 23, 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function header(ctx, W, h, kicker, title, sub) {
    const g = ctx.createLinearGradient(0, 0, W, h); g.addColorStop(0, '#4f46e5'); g.addColorStop(.55, '#7c3aed'); g.addColorStop(1, '#0d9488');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
    const pad = 64, mid = h / 2;
    drawLogo(ctx, pad, mid - 40, 80);
    text(ctx, 'Alas', pad + 100, mid - 2, { font: f(42, 850), color: '#fff' });
    text(ctx, 'EĞİTİM KOÇLUK', pad + 102, mid + 30, { font: f(17, 750), color: 'rgba(255,255,255,.82)', spacing: '3px' });
    text(ctx, kicker, W - pad, mid - 40, { font: f(20, 800), color: 'rgba(255,255,255,.85)', align: 'right', spacing: '2px' });
    text(ctx, title, W - pad, mid + 14, { font: fit(ctx, title, W - pad * 2 - 380, 52, 850), color: '#fff', align: 'right' });
    text(ctx, sub, W - pad, mid + 56, { font: f(24), color: 'rgba(255,255,255,.92)', align: 'right' });
  }
  function footer(ctx, W, H, label) {
    ctx.fillStyle = COL.line; ctx.fillRect(64, H - 96, W - 128, 2);
    text(ctx, 'Alas Eğitim Koçluk', 64, H - 50, { font: f(24, 800), color: COL.indigo });
    text(ctx, label, W - 64, H - 50, { font: f(21), color: COL.muted, align: 'right' });
  }

  /* ---------- Veli raporu ---------- */
  function listCard(ctx, x, y, w, title, items, emptyText, color, o = {}) {
    const inner = w - 56, rows = items.map(it => { ctx.font = f(26, 750); const lines = wrap(ctx, it.title, inner - 120); return { it, lines, h: lines.length * 34 + 40 + 14 }; });
    const h = 86 + (rows.length ? rows.reduce((s, r) => s + r.h, 0) : 60) + 14;
    const H = Math.max(h, o.minH || 0);
    if (o.measureOnly) return h;
    card(ctx, x, y, w, H);
    text(ctx, title, x + 28, y + 56, { font: f(28, 850), color: COL.ink });
    let cy = y + 86;
    if (!rows.length) text(ctx, emptyText, x + 28, cy + 36, { font: f(24), color: COL.muted });
    rows.forEach(r => {
      ctx.fillStyle = color; roundRect(ctx, x + 28, cy + 6, 8, r.h - 22, 4); ctx.fill();
      r.lines.forEach((l, i) => text(ctx, l, x + 52, cy + 32 + i * 34, { font: f(26, 750), color: COL.ink }));
      text(ctx, r.it.sub, x + 52, cy + 32 + r.lines.length * 34 - 2 + 2, { font: f(22), color: COL.muted });
      text(ctx, r.it.value, x + w - 28, cy + 36, { font: f(30, 850), color, align: 'right' });
      cy += r.h;
    });
    return H;
  }
  function infoCard(ctx, x, y, w, title, body, H, measureOnly) {
    ctx.font = f(30, 800); const lines = wrap(ctx, body, w - 56), h = 84 + lines.length * 40 + 26;
    if (measureOnly) return h;
    card(ctx, x, y, w, H || h);
    text(ctx, title.toUpperCase(), x + 28, y + 50, { font: f(19, 800), color: COL.muted, spacing: '2px' });
    lines.forEach((l, i) => text(ctx, l, x + 28, y + 96 + i * 40, { font: f(30, 800), color: COL.ink }));
    return H || h;
  }
  function paintReport(ctx, W, d) {
    const pad = 64, gap = 26;
    header(ctx, W, 270, 'ÖĞRENCİ GELİŞİM RAPORU', d.name, d.rangeLabel + ' · ' + d.dateLabel);
    let y = 270 + 46;
    const cw = (W - pad * 2 - gap * 3) / 4, tones = [COL.indigo, COL.violet, COL.teal, COL.amber];
    d.stats.forEach((s, i) => {
      const x = pad + i * (cw + gap);
      card(ctx, x, y, cw, 150);
      ctx.fillStyle = tones[i]; roundRect(ctx, x + 22, y + 30, 8, 90, 4); ctx.fill();
      text(ctx, s.value, x + 48, y + 84, { font: f(50, 850), color: COL.ink });
      text(ctx, s.label, x + 48, y + 122, { font: f(21), color: COL.muted });
    });
    y += 150 + 40;
    const colW = (W - pad * 2 - gap) / 2;
    const minH = Math.max(listCard(ctx, 0, 0, colW, '', d.strong, '', COL.green, { measureOnly: true }), listCard(ctx, 0, 0, colW, '', d.weak, '', COL.rose, { measureOnly: true }));
    listCard(ctx, pad, y, colW, 'Güçlü konular', d.strong, 'Yeterli veri yok', COL.green, { minH });
    listCard(ctx, pad + colW + gap, y, colW, 'Geliştirilecek konular', d.weak, 'Belirgin bir zayıf konu yok', COL.rose, { minH });
    y += minH + gap + 14;
    const ih = Math.max(infoCard(ctx, 0, 0, colW, '', d.plan, 0, true), infoCard(ctx, 0, 0, colW, '', d.exam, 0, true));
    infoCard(ctx, pad, y, colW, 'Plan uyumu', d.plan, ih);
    infoCard(ctx, pad + colW + gap, y, colW, 'Son deneme', d.exam, ih);
    y += ih + gap + 14;
    if (d.comment) {
      ctx.font = f(28); const lines = wrap(ctx, d.comment, W - pad * 2 - 80), h = 150 + lines.length * 42;
      card(ctx, pad, y, W - pad * 2, h, { fill: '#faf8ff', stroke: '#ddd6fe' });
      ctx.fillStyle = COL.violet; roundRect(ctx, pad + 24, y + 28, 8, h - 56, 4); ctx.fill();
      text(ctx, 'Öğretmen görüşü', pad + 56, y + 62, { font: f(26, 850), color: COL.violet });
      lines.forEach((l, i) => text(ctx, l, pad + 56, y + 112 + i * 42, { font: f(28), color: COL.ink }));
      text(ctx, '— ' + d.coach, pad + 56, y + h - 30, { font: f(22), color: COL.muted });
      y += h + gap;
    }
    return y;
  }
  function reportCanvas(d) {
    const W = 1240, bottom = paintReport(makeCanvas(W, 10).getContext('2d'), W, d), H = Math.max(1754, Math.round(bottom + 150));
    const c = makeCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
    paintReport(ctx, W, d); footer(ctx, W, H, 'Koçluk panelinden hazırlandı · ' + d.dateLabel);
    return c;
  }

  /* ---------- Haftalık program ---------- */
  const KIND = { lesson: { fill: '#eff6ff', stroke: '#bfdbfe', bar: '#3b82f6', ink: '#1d4ed8' }, session: { fill: '#f5f3ff', stroke: '#ddd6fe', bar: '#7c3aed', ink: '#5b21b6' }, task: { fill: '#fffbeb', stroke: '#fde68a', bar: '#f59e0b', ink: '#92400e' } };
  function measureItem(ctx, it, w) {
    const tw = w - 222 - 24;
    ctx.font = f(26, 800); const title = wrap(ctx, it.title, tw);
    ctx.font = f(22); const note = it.note ? wrap(ctx, '📝 ' + it.note, tw) : [];
    return { it, title, note, h: 24 + title.length * 34 + (it.topic ? 30 : 0) + (it.meta ? 30 : 0) + note.length * 30 + 20 };
  }
  function sessionsCard(ctx, x, y, w, list) {
    const h = 96 + Math.max(1, list.length) * 44;
    card(ctx, x, y, w, h, { fill: '#f5f3ff', stroke: '#ddd6fe' });
    ctx.fillStyle = COL.violet; roundRect(ctx, x + 24, y + 26, 8, h - 52, 4); ctx.fill();
    text(ctx, 'Koçluk görüşmeleri', x + 56, y + 58, { font: f(28, 850), color: COL.violet });
    if (!list.length) text(ctx, 'Bu 7 günde planlı koçluk görüşmesi yok.', x + 56, y + 104, { font: f(24), color: COL.muted });
    list.forEach((r, i) => {
      const ry = y + 104 + i * 44;
      text(ctx, r.day, x + 56, ry, { font: f(25, 750), color: COL.ink });
      text(ctx, r.time + (r.dur ? ' · ' + r.dur : ''), x + w - 40, ry, { font: f(25, 850), color: COL.violet, align: 'right' });
    });
    return h;
  }
  function paintSchedule(ctx, W, d) {
    const pad = 56, dayW = 200, cardW = W - pad * 2;
    header(ctx, W, 260, 'HAFTALIK DERS PROGRAMI', d.name, d.range);
    let y = 260 + 40;
    if (d.sessions) y += sessionsCard(ctx, pad, y, cardW, d.sessions) + 22;
    d.days.forEach(day => {
      const itemX = pad + dayW + 18, itemW = cardW - dayW - 38;
      const blocks = day.items.map(it => measureItem(ctx, it, itemW));
      const h = Math.max(104, 36 + blocks.reduce((s, b) => s + b.h, 0) + Math.max(0, blocks.length - 1) * 14);
      card(ctx, pad, y, cardW, h, { fill: day.today ? '#f5f6ff' : '#fff', stroke: day.today ? '#a5b4fc' : COL.line });
      text(ctx, day.label, pad + 28, y + 52, { font: f(30, 850), color: COL.ink });
      text(ctx, day.date, pad + 28, y + 86, { font: f(22), color: COL.muted });
      if (day.today) { roundRect(ctx, pad + 28, y + 100, 92, 30, 15); ctx.fillStyle = COL.indigo; ctx.fill(); text(ctx, 'BUGÜN', pad + 74, y + 122, { font: f(16, 850), color: '#fff', align: 'center', spacing: '1px' }); }
      if (!blocks.length) text(ctx, 'Boş gün', itemX + 10, y + h / 2 + 8, { font: f(24), color: '#94a3b8' });
      let iy = y + 18;
      blocks.forEach(b => {
        const k = KIND[b.it.kind] || KIND.lesson;
        card(ctx, itemX, iy, itemW, b.h, { fill: k.fill, stroke: k.stroke, r: 18 });
        ctx.fillStyle = k.bar; roundRect(ctx, itemX + 14, iy + 14, 7, b.h - 28, 3.5); ctx.fill();
        text(ctx, b.it.time, itemX + 38, iy + 44, { font: f(22, 850), color: k.ink });
        let ty = iy + 44;
        b.title.forEach(l => { text(ctx, l, itemX + 222, ty, { font: f(26, 800), color: COL.ink }); ty += 34; });
        ty -= 6;
        if (b.it.topic) { text(ctx, b.it.topic, itemX + 222, ty + 6, { font: f(22), color: COL.muted }); ty += 30; }
        if (b.it.meta) { text(ctx, b.it.meta, itemX + 222, ty + 6, { font: f(22, 800), color: k.ink }); ty += 30; }
        b.note.forEach(l => { text(ctx, l, itemX + 222, ty + 6, { font: f(22), color: '#475569' }); ty += 30; });
        iy += b.h + 14;
      });
      y += h + 18;
    });
    return y;
  }
  function scheduleCanvas(d) {
    const W = 1200, bottom = paintSchedule(makeCanvas(W, 10).getContext('2d'), W, d), H = Math.round(bottom + 130);
    const c = makeCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
    paintSchedule(ctx, W, d); footer(ctx, W, H, (d.coach ? d.coach + ' · ' : '') + 'Alas Eğitim Koçluk');
    return c;
  }

  /* ---------- Dosya üretimi ve paylaşım ---------- */
  const toBlob = (canvas, type = 'image/png', quality = 0.92) => new Promise(res => canvas.toBlob(res, type, quality));
  async function toPdf(canvas) {
    const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
    const pw = 595.28, ph = +(pw * canvas.height / canvas.width).toFixed(2), enc = s => new TextEncoder().encode(s);
    const chunks = [], offs = []; let pos = 0;
    const add = u => { chunks.push(u); pos += u.length; };
    const obj = (n, head, stream) => { offs[n] = pos; add(enc(n + ' 0 obj\n' + head + '\n')); if (stream) { add(enc('stream\n')); add(stream); add(enc('\nendstream\n')); } add(enc('endobj\n')); };
    add(enc('%PDF-1.4\n'));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    obj(4, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
    const content = enc(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
    obj(5, `<< /Length ${content.length} >>`, content);
    const xref = pos; let table = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) table += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    add(enc(table + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
    return new Blob(chunks, { type: 'application/pdf' });
  }
  function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) d = '90' + d.slice(1);
    else if (d.length === 10 && d.startsWith('5')) d = '90' + d;
    return d;
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function deliver({ blob, filename, text: caption, phone }) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: caption, title: filename }); return { mode: 'share' }; }
      catch (e) { if (e && e.name === 'AbortError') return { mode: 'cancel' }; }
    }
    let copied = false;
    if (blob.type === 'image/png' && navigator.clipboard && window.ClipboardItem) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); copied = true; } catch { /* pano izni yok */ }
    }
    download(blob, filename);
    const number = normalizePhone(phone);
    window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(caption || ''), '_blank');
    return { mode: 'fallback', copied, hasNumber: !!number };
  }

  window.KoclukShare = { reportCanvas, scheduleCanvas, toBlob, toPdf, deliver, normalizePhone };
})();
