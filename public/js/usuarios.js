// /public/js/usuarios.js
// Gestión de usuarios con protección por rol ADMIN, UX y manejo de errores,
// ahora con topbar y layout consistente al de Umbrales.

const API = {
  base: '/api/usuarios',
  async getMe() {
    const r = await fetch('/api/auth/me', { headers: headersAuth() });
    if (r.status === 401) return redirectLogin();
    if (!r.ok) throw new Error('No se pudo obtener el perfil');
    return r.json();
  }
};

function headersAuth(json = true) {
  const token = localStorage.getItem('token');
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return json ? { 'Content-Type': 'application/json', ...h } : h;
}

function redirectLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/views/login.html';
  return null;
}

function roleName(rol_id) {
  return ({ 1: 'ADMIN', 2: 'TECNICO', 3: 'CONSULTA' })[rol_id] || String(rol_id);
}

function notify(msg, type = 'info') {
  const box = document.getElementById('msg');
  if (!box) return;
  box.textContent = msg;
  box.className = `msg ${type}`;
  setTimeout(() => {
    if (box.textContent === msg) { box.textContent = ''; box.className = 'msg'; }
  }, 3000);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

// --------- NUEVO: topbar consistente ----------
function construirTopbar(user){
  const nav = document.getElementById('nav');
  if (nav){
    nav.innerHTML = '';
    const aMon = Object.assign(document.createElement('a'), { href:'index.html', textContent:'Monitoreo' });
    const aAle = Object.assign(document.createElement('a'), { href:'alertas.html', textContent:'Alertas' });
    nav.appendChild(aMon);
    nav.appendChild(aAle);
    if (Number(user.rol_id) === 1) {
      const aUsu = Object.assign(document.createElement('a'), { href:'usuarios.html', textContent:'Usuarios' });
      const aUmb = Object.assign(document.createElement('a'), { href:'umbrales.html', textContent:'Umbrales' });
      aUsu.className = 'active';
      nav.appendChild(aUsu);
      nav.appendChild(aUmb);
    }
  }
  const session = document.getElementById('session');
  if (session){
    const nombre = user?.nombre || user?.email || 'Usuario';
    const rol = roleName(user?.rol_id);
    session.innerHTML = `
      <span class="whoami">${escapeHtml(nombre)} · ${escapeHtml(rol)}</span>
      <button id="btnSalir" class="btn-salir" title="Cerrar sesión">Salir</button>
    `;
    document.getElementById('btnSalir').onclick = () => redirectLogin();
  }
}
// ----------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Debe existir token
  const token = localStorage.getItem('token');
  if (!token) return redirectLogin();

  // 2) Verificá que el usuario sea ADMIN
  try {
    const me = await API.getMe(); // ya maneja 401 internamente
    if (!me) return; // redirigido
    if (Number(me.rol_id) !== 1) {
      notify('No tenés permisos para acceder a Usuarios.', 'warn');
      setTimeout(() => (window.location.href = '/views/index.html'), 800);
      return;
    }

    // Topbar y UI
    construirTopbar(me);
    bindUI();
    await cargarUsuarios();
  } catch (e) {
    console.error(e);
    notify('Error al cargar la vista de usuarios.', 'error');
  }
});

function bindUI() {
  const btnCrear = document.getElementById('btnCrearUsuario');
  if (btnCrear) btnCrear.addEventListener('click', () => {
    setModalUsuario({
      titulo: 'Crear Usuario',
      id: '',
      nombre: '',
      email: '',
      rol_id: '2',
      showPassword: true
    });
  });

  const form = document.getElementById('formUsuario');
  if (form) form.addEventListener('submit', onSubmitUsuario);
}

async function apiRequest(url, opt = {}) {
  const res = await fetch(url, opt);
  if (res.status === 401) return redirectLogin();
  if (res.status === 403) {
    notify('No autorizado para realizar esta acción.', 'warn');
    throw new Error('403 Forbidden');
  }
  return res;
}

async function cargarUsuarios() {
  try {
    const res = await apiRequest(API.base, { headers: headersAuth(false) });
    if (!res.ok) throw new Error('No se pudo listar usuarios');
    const usuarios = await res.json();
    renderUsuarios(usuarios);
  } catch (err) {
    console.error(err);
    notify('Error al cargar usuarios.', 'error');
  }
}

function renderUsuarios(usuarios) {
  const tbody = document.querySelector('#tablaUsuarios tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  (usuarios || []).forEach(u => {
    const tr = document.createElement('tr');
    tr.dataset.id = u.id;
    tr.innerHTML = `
      <td>${escapeHtml(u.nombre)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${roleName(u.rol_id)}</td>
      <td>${escapeHtml(u.estado)}</td>
      <td class="acciones">
        <button class="btn sm" data-action="edit">Editar</button>
        <button class="btn sm" data-action="estado">${u.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}</button>
        <button class="btn sm" data-action="reset">ResetPass</button>
        <button class="btn sm danger" data-action="del">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.onclick = async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = Number(tr?.dataset?.id);
    if (!id) return;

    const action = btn.dataset.action;
    if (action === 'edit') return editarUsuario(id);
    if (action === 'estado') {
      const estadoActual = tr.children[3].textContent.trim();
      const nuevoEstado = estadoActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      return cambiarEstadoUsuario(id, nuevoEstado);
    }
    if (action === 'reset') return resetearPassword(id);
    if (action === 'del') return eliminarUsuario(id);
  };
}

function setModalUsuario({ titulo, id, nombre, email, rol_id, showPassword }) {
  document.getElementById('tituloModalUsuario').innerText = titulo;
  document.getElementById('usuarioId').value = id || '';
  document.getElementById('nombreUsuario').value = nombre || '';
  document.getElementById('emailUsuario').value = email || '';
  document.getElementById('rolUsuario').value = rol_id || '2';

  const labelPass = document.getElementById('labelPassword');
  const inputPass = document.getElementById('passwordUsuario');
  if (showPassword) {
    labelPass.style.display = '';
    inputPass.style.display = '';
    inputPass.value = '';
    inputPass.required = true;
  } else {
    labelPass.style.display = 'none';
    inputPass.style.display = 'none';
    inputPass.value = '';
    inputPass.required = false;
  }

  document.getElementById('modalUsuario').style.display = 'flex';
}

function cerrarModalUsuario() {
  const modal = document.getElementById('modalUsuario');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('formUsuario');
  if (form) form.reset();
}

async function editarUsuario(id) {
  try {
    const res = await apiRequest(API.base, { headers: headersAuth(false) });
    const usuarios = await res.json();
    const u = usuarios.find(x => x.id === id);
    if (!u) return notify('Usuario no encontrado.', 'warn');

    setModalUsuario({
      titulo: 'Editar Usuario',
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol_id: String(u.rol_id),
      showPassword: false
    });
  } catch {
    notify('No se pudo cargar el usuario.', 'error');
  }
}

async function onSubmitUsuario(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarUsuario');
  btn.disabled = true;

  const id = document.getElementById('usuarioId').value.trim();
  const nombre = document.getElementById('nombreUsuario').value.trim();
  const email = document.getElementById('emailUsuario').value.trim();
  const rol_id = document.getElementById('rolUsuario').value;
  const password = document.getElementById('passwordUsuario').value;

  if (!nombre || !email || !rol_id || (!id && !password)) {
    btn.disabled = false;
    return notify('Campos incompletos.', 'warn');
  }

  try {
    let res;
    if (id) {
      res = await apiRequest(`${API.base}/${id}`, {
        method: 'PUT',
        headers: headersAuth(),
        body: JSON.stringify({ nombre, email, rol_id })
      });
    } else {
      res = await apiRequest(API.base, {
        method: 'POST',
        headers: headersAuth(),
        body: JSON.stringify({ nombre, email, rol_id, password })
      });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409) notify(data?.error || 'El email ya existe.', 'warn');
      else notify(data?.error || 'Error en la operación.', 'error');
      btn.disabled = false;
      return;
    }

    notify(id ? 'Usuario actualizado.' : 'Usuario creado.', 'success');
    cerrarModalUsuario();
    await cargarUsuarios();
  } catch (err) {
    console.error(err);
    notify('Error de red.', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function cambiarEstadoUsuario(id, nuevoEstado) {
  try {
    const res = await apiRequest(`${API.base}/${id}/estado`, {
      method: 'PATCH',
      headers: headersAuth(),
      body: JSON.stringify({ estado: nuevoEstado })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notify(data?.error || 'No se pudo cambiar el estado.', 'error');
    notify('Estado actualizado.', 'success');
    await cargarUsuarios();
  } catch {
    notify('Error de red al cambiar estado.', 'error');
  }
}

async function resetearPassword(id) {
  const nueva = prompt('Nueva contraseña para el usuario:');
  if (!nueva) return;
  try {
    const res = await apiRequest(`${API.base}/${id}/resetpass`, {
      method: 'PATCH',
      headers: headersAuth(),
      body: JSON.stringify({ password: nueva })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notify(data?.error || 'No se pudo resetear la contraseña.', 'error');
    notify('Contraseña reseteada.', 'success');
  } catch {
    notify('Error de red al resetear la contraseña.', 'error');
  }
}

async function eliminarUsuario(id) {
  if (!confirm('¿Eliminar definitivamente este usuario?')) return;
  try {
    const res = await apiRequest(`${API.base}/${id}`, {
      method: 'DELETE',
      headers: headersAuth(false)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notify(data?.error || 'No se pudo eliminar.', 'error');
    notify(data?.mensaje || 'Operación realizada.', 'success');
    await cargarUsuarios();
  } catch {
    notify('Error de red al eliminar.', 'error');
  }
}