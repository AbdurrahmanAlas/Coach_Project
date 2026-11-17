/* Sol menüyü dar bir ikon şeridine daraltır / tekrar genişletir. Büyük pencereler (haftalık program) bunu otomatik kullanır. */
(() => {
  const KEY = 'sbCollapsed';
  const apply = collapsed => {
    document.body.classList.toggle('sb-collapsed', collapsed);
    const button = document.getElementById('sidebar-collapse');
    if (!button) return;
    button.querySelector('.sb-ico').textContent = collapsed ? '»' : '«';
    button.setAttribute('aria-label', collapsed ? 'Menüyü genişlet' : 'Menüyü daralt');
    button.title = collapsed ? 'Menüyü genişlet' : 'Menüyü daralt';
  };
  window.isSidebarCollapsed = () => document.body.classList.contains('sb-collapsed');
  window.setSidebarCollapsed = (collapsed, persist = true) => { apply(collapsed); if (persist) localStorage.setItem(KEY, collapsed ? '1' : '0'); };
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar .nav a').forEach(a => { if (!a.title) a.title = a.textContent.trim(); });
    apply(localStorage.getItem(KEY) === '1');
    document.getElementById('sidebar-collapse')?.addEventListener('click', () => window.setSidebarCollapsed(!window.isSidebarCollapsed()));
  });
})();
