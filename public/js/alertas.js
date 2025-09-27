// /public/js/alertas.js
let currentUser = null;

function headersAuth(json = false) {
  const token = localStorage.getItem('token');
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return json ? { 'Content-Type': 'application/json', ...h } : h;
}
function redirectLogin() {
  localStorage.removeItem('token'); localStorage.removeItem('user');
  window.location.href = '/views/login.html';
  return null;
}
function roleName(rol_id) { return ({1:'ADMIN',2:'TECNICO',3:'CONSULTA'})[rol_id] || String(rol_id); }
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function notify(msg,type='info'){const box=document.getElementById('msg'); if(!box) return; box.textContent=msg; box.className=`msg ${type}`;}

async function apiGET(url){
  const r = await fetch(url, { headers: headersAuth(false) });
  if (r.status === 401) return redirectLogin();
  return r;
}
async function apiPATCH(url, body){
  const r = await fetch(url, { method:'PATCH', headers: headersAuth(true), body: JSON.stringify(body||{}) });
  if (r.status === 401) return redirectLogin();
  return r;
}

async function cargarPerfil() {
  const me = await apiGET('/api/auth/me');
  const user = await me.json();
  localStorage.setItem('user', JSON.stringify(user));
  currentUser = user;
  return user;
}

function construirTopbar(user){
  const nav = document.getElementById('nav');
  if (nav){
    nav.innerHTML='';
    const a1 = Object.assign(document.createElement('a'), { href:'index.html', textContent:'Monitoreo' });
    const a2 = Object.assign(document.createElement('a'), { href:'alertas.html', textContent:'Alertas' });
    a2.className = 'active';
    nav.appendChild(a1);

    if (Number(user.rol_id) === 1) {
      const aU = Object.assign(document.createElement('a'), { href:'usuarios.html', textContent:'Usuarios' });
      nav.appendChild(aU);
      if (Number(user.rol_id) === 1) {
      const aU = Object.assign(document.createElement('a'), { href:'usuarios.html', textContent:'Usuarios' });
      const aUmb = Object.assign(document.createElement('a'), { href:'umbrales.html', textContent:'Umbrales' });
  nav.appendChild(aU); nav.appendChild(aUmb);
}

    }
    nav.appendChild(a2);
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

function renderAlertas(data){
  const tb = document.querySelector('#tblAlertas tbody');
  tb.innerHTML = '';
  const puedeCerrar = [1,2].includes(Number(currentUser?.rol_id));
  if (!Array.isArray(data) || data.length===0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="muted">No hay resultados.</td>`;
    tb.appendChild(tr);
    return;
  }
  data.forEach(a=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${escapeHtml(a.metrica)}</td>
      <td>${escapeHtml(a.operador)} ${a.umbral_valor}</td>
      <td>${a.lectura_valor} ${escapeHtml(a.unidad||'')}</td>
      <td><span class="pill ${a.severidad==='CRITICA'?'critica':'adv'}">${escapeHtml(a.severidad)}</span></td>
      <td>${new Date(a.creado_en).toLocaleString()}</td>
      <td>${(a.estado==='ABIERTA' && puedeCerrar) ? `<button class="btn sm" data-id="${a.id}">Cerrar</button>` : '-'}</td>
    `;
    tb.appendChild(tr);
  });

  tb.onclick = async (ev)=>{
    const btn = ev.target.closest('button[data-id]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (!confirm(`¿Cerrar alerta #${id}?`)) return;
    btn.disabled = true;
    try{
      const r = await apiPATCH(`/api/monitor/alertas/${id}/cerrar`, { comentario: 'Cerrada desde Alertas' });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) return notify(j?.error || 'No se pudo cerrar la alerta', 'error');
      notify('Alerta cerrada.', 'success');
      await buscar();
    }finally{ btn.disabled = false; }
  };
}

async function buscar(){
  const estado = document.getElementById('fEstado').value;
  const host = document.getElementById('fHost').value.trim();
  const qs = new URLSearchParams();
  if (estado !== 'TODAS') qs.set('estado', estado);
  if (host) qs.set('host_id', host);
  const r = await apiGET(`/api/monitor/alertas?${qs.toString()}`);
  if (!r.ok) return notify('No se pudo obtener alertas', 'error');
  const data = await r.json();
  renderAlertas(data);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if (!localStorage.getItem('token')) return redirectLogin();
  const user = await cargarPerfil(); if (!user) return;
  construirTopbar(user);

  document.getElementById('btnBuscar').onclick = buscar;
  await buscar();
});
