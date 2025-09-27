// /public/js/topbar_common.js
// Inyecta el topbar en cualquier vista que tenga <nav id="nav"> y <div id="session">

(function injectTopbar(){
  const userRaw = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  if (!userRaw || !token) return; // la página que cargue este archivo ya hará el redirect

  const user = JSON.parse(userRaw);
  const roleMap = {1:'ADMIN', 2:'TECNICO', 3:'CONSULTA'};
  const role = roleMap[Number(user.rol_id)] || user.rol_id || '';

  const nav = document.getElementById('nav');
  const session = document.getElementById('session');
  if (!nav || !session) return;

  // Determinar página activa por path
  const path = (location.pathname || '').toLowerCase();
  const isActive = (file) => path.endsWith(`/views/${file}`);

  // Construcción del menú
  nav.innerHTML = '';
  const mk = (href, txt, active) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = txt;
    if (active) a.className = 'active';
    return a;
  };

  nav.appendChild(mk('index.html',      'Monitoreo', isActive('index.html')));
  nav.appendChild(mk('alertas.html',    'Alertas',   isActive('alertas.html')));

  // Solo ADMIN
  if (Number(user.rol_id) === 1) {
    nav.appendChild(mk('usuarios.html',  'Usuarios',  isActive('usuarios.html')));
    nav.appendChild(mk('umbrales.html',  'Umbrales',  isActive('umbrales.html')));
  }

  // Todos autenticados
  nav.appendChild(mk('reportes.html',   'Reportes',  isActive('reportes.html')));

  // Bitácora: ADMIN y TECNICO (coincide con la ruta protegida)
  if (Number(user.rol_id) === 1 || Number(user.rol_id) === 2) {
    nav.appendChild(mk('bitacora.html',  'Bitácora',  isActive('bitacora.html')));
  }

  // Lado derecho de sesión
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  session.innerHTML = `
    <span class="whoami">${escapeHtml(user?.nombre || user?.email)} · ${escapeHtml(role)}</span>
    <button id="btnSalir" class="btn-salir">Salir</button>
  `;
  document.getElementById('btnSalir').onclick = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/views/login.html';
  };
})();
