/* Ortak pencereler: prompt()/confirm() yerine düzenli form ve onay pencereleri. */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function open({ title, subtitle, icon, body, submit, danger, onMount }) {
    return new Promise(resolve => {
      document.getElementById('cu-dialog')?.remove();
      const overlay = document.createElement('div'); overlay.id = 'cu-dialog'; overlay.className = 'cu-backdrop';
      overlay.innerHTML = `<form class="cu-card" role="dialog" aria-modal="true" novalidate><header><span class="cu-ico ${danger ? 'danger' : ''}">${icon || '✎'}</span><div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><button type="button" class="cu-x" data-cancel aria-label="Kapat">✕</button></header><div class="cu-body">${body}</div><div class="cu-error" id="cu-error" role="alert"></div><footer><button type="button" class="cu-btn" data-cancel>Vazgeç</button><button type="submit" class="cu-btn ${danger ? 'danger' : 'main'}">${esc(submit || 'Kaydet')}</button></footer></form>`;
      document.body.appendChild(overlay);
      const form = overlay.querySelector('form'), err = overlay.querySelector('#cu-error');
      const close = value => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(null); });
      overlay.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => close(null)));
      if (onMount) onMount(form);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const data = {}; form.querySelectorAll('[data-field]').forEach(el => { data[el.dataset.field] = el.value; });
        const check = form.__validate ? form.__validate(data) : null;
        if (check) { err.textContent = check; return; }
        close(data);
      });
      const first = form.querySelector('[data-field]'); if (first) { first.focus(); if (first.select) first.select(); }
    });
  }

  /* Soru ilerlemesi: sayı kutusu + kaydırıcı + hızlı seçimler */
  function progress({ title, subtitle, current, target }) {
    const t = Number(target) || 0;
    return open({ title: title || 'İlerlemeyi gir', subtitle, icon: '📈', submit: 'Kaydet',
      body: `<div class="cu-prog"><div class="cu-prog-top"><label for="cu-num">Çözülen soru</label><div class="cu-num"><input id="cu-num" data-field="value" type="number" min="0" max="${t}" step="1" value="${Number(current) || 0}" inputmode="numeric"><span>/ ${t}</span></div></div><input id="cu-range" type="range" min="0" max="${t}" step="1" value="${Number(current) || 0}"><div class="cu-bar"><i id="cu-fill"></i></div><div class="cu-quick"><button type="button" data-set="0">Sıfırla</button><button type="button" data-set="${Math.round(t / 2)}">Yarısı</button><button type="button" data-set="${t}">Tamamı ✓</button></div></div>`,
      onMount: form => {
        const num = form.querySelector('#cu-num'), range = form.querySelector('#cu-range'), fill = form.querySelector('#cu-fill');
        const sync = v => { v = Math.max(0, Math.min(t, Math.round(Number(v) || 0))); num.value = v; range.value = v; fill.style.width = (t ? v / t * 100 : 0) + '%'; };
        num.addEventListener('input', () => { range.value = Math.min(t, Number(num.value) || 0); fill.style.width = (t ? Math.min(100, (Number(num.value) || 0) / t * 100) : 0) + '%'; });
        range.addEventListener('input', () => sync(range.value));
        form.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => sync(b.dataset.set)));
        sync(num.value);
        form.__validate = d => { const v = Number(d.value); return Number.isInteger(v) && v >= 0 && v <= t ? '' : `0 ile ${t} arasında bir tam sayı girin.`; };
      } }).then(d => d ? Number(d.value) : null);
  }

  /* Görev düzenle */
  function task({ title, dueDate, target }) {
    return open({ title: 'Görevi düzenle', icon: '✎', submit: 'Kaydet',
      body: `<label class="cu-field">Görev adı<input data-field="title" type="text" maxlength="200" value="${esc(title)}" placeholder="Örn: Matematik soru çözümü"></label><div class="cu-row"><label class="cu-field">Görev tarihi<input data-field="dueDate" type="date" value="${esc(String(dueDate).slice(0, 10))}"></label><label class="cu-field">Soru hedefi<input data-field="target" type="number" min="0" step="1" value="${Number(target) || 0}"></label></div>`,
      onMount: form => { form.__validate = d => !d.title.trim() ? 'Görev adı boş olamaz.' : !d.dueDate ? 'Görev tarihi seçin.' : (!Number.isInteger(Number(d.target)) || Number(d.target) < 0) ? 'Soru hedefi 0 veya daha büyük bir tam sayı olmalı.' : ''; } })
      .then(d => d ? { title: d.title.trim(), dueDate: d.dueDate, targetQuestions: Number(d.target) } : null);
  }

  /* Plan adı */
  function plan({ title }) {
    return open({ title: 'Planı düzenle', icon: '🗒️', submit: 'Kaydet',
      body: `<label class="cu-field">Plan adı<input data-field="title" type="text" maxlength="200" value="${esc(title)}"></label>`,
      onMount: form => { form.__validate = d => d.title.trim() ? '' : 'Plan adı boş olamaz.'; } }).then(d => d ? d.title.trim() : null);
  }

  /* Onay */
  function confirmBox({ title, text, confirm, danger = true, icon }) {
    return open({ title, icon: icon || (danger ? '🗑' : '❓'), danger, submit: confirm || 'Evet', body: `<p class="cu-text">${esc(text)}</p>` }).then(d => d !== null);
  }

  window.CoachUI = { open, progress, task, plan, confirm: confirmBox };
})();
