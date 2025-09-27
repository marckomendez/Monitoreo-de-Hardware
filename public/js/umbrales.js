// /public/js/umbrales.js
let currentUser = null;

function headersAuth(json = false) {
  const token = localStorage.getItem('token');
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return json ? { 'Content-Type': 'application/json', ...h } : h;
}
function redirectLogin() {
  localStorage.removeItem('token'); localStorage.removeItem('user');
  window.location.href = '/views/login.html'; return null;
}
function roleName(r){return ({1:'ADMIN',2:'TECNICO',3:'CONSULTA'})[r]||r;}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function notify(msg, type='info'){ const b=document.getElementById('msg'); b.textContent=msg; b.className=`msg ${type}`; }

async function apiGET(url){
  const r = await fetch(url, { headers: headersAuth(false) });
  if (r.status === 401) return redirectLogin(); return r;
}
async function apiPOST(url, body){
  const r = await fetch(url, { method:'POST', headers: headersAuth(true), body: JSON.stringify(body||{}) });
  if (r.status === 401) return redirectLogin(); return r;
}
async function apiPUT(url, body){
  const r = await fetch(url, { method:'PUT', headers: headersAuth(true), body: JSON.stringify(body||{}) });
  if (r.status === 401) return redirectLogin(); return r;
}
async function apiDELETE(url){
  const r = await fetch(url, { method:'DELETE', headers: headersAuth(false) });
  if (r.status === 401) return redirectLogin(); return r;
}

async function cargarPerfil(){
  const r = await apiGET('/api/auth/me');
  const user = await r.json(); currentUser = user;
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

function construirTopbar(user){
  const nav = document.getElementById('nav');
  if (nav){
    nav.innerHTML='';
    const aMon = Object.assign(document.createElement('a'), { href:'index.html', textContent:'Monitoreo' });
    const aAle = Object.assign(document.createElement('a'), { href:'alertas.html', textContent:'Alertas' });
    nav.appendChild(aMon); nav.appendChild(aAle);
    if (Number(user.rol_id) === 1) {
      const aUsu = Object.assign(document.createElement('a'), { href:'usuarios.html', textContent:'Usuarios' });
      const aUmb = Object.assign(document.createElement('a'), { href:'umbrales.html', textContent:'Umbrales' });
      aUmb.className = 'active';
      nav.appendChild(aUsu); nav.appendChild(aUmb);
    }
  }
  const session = document.getElementById('session');
  if (session){
    session.innerHTML = `
      <span class="whoami">${escapeHtml(user.nombre || user.email)} · ${escapeHtml(roleName(user.rol_id))}</span>
      <button id="btnSalir" class="btn-salir">Salir</button>
    `;
    document.getElementById('btnSalir').onclick = () => redirectLogin();
  }
}

function bindUI(){
  document.getElementById('btnBuscar').onclick = buscar;
  document.getElementById('btnNuevo').onclick = () => {
    setModalUmbral({ titulo: 'Nuevo Umbral' });
  };
  document.getElementById('formUmbral').addEventListener('submit', onSubmitUmbral);
}

async function buscar(){
  const metrica = document.getElementById('fMetrica').value.trim();
  const qs = metrica ? `?metrica=${encodeURIComponent(metrica)}` : '';
  const r = await apiGET('/api/umbrales' + qs);
  if (!r.ok) return notify('No se pudo obtener umbrales', 'error');
  const data = await r.json();
  render(data);
}

function render(rows){
  const tb = document.querySelector('#tblUmbrales tbody');
  tb.innerHTML = '';
  if (!Array.isArray(rows) || rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" class="muted">No hay registros.</td>`;
    tb.appendChild(tr);
    return;
  }
  rows.forEach(u=>{
    const tr = document.createElement('tr');
    tr.dataset.id = u.id;
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${escapeHtml(u.metrica)}</td>
      <td>${escapeHtml(u.operador)}</td>
      <td>${Number(u.valor).toFixed(2)}</td>
      <td><span class="pill ${u.severidad==='CRITICA'?'critica':'adv'}">${escapeHtml(u.severidad)}</span></td>
      <td title="${escapeHtml(u.creado_por_email||'')}">${escapeHtml(u.creado_por_nombre || ('Usuario #' + u.creado_por))}</td>
      <td>${new Date(u.creado_en).toLocaleString()}</td>
      <td class="acciones">
        <button class="btn sm" data-action="edit">Editar</button>
        <button class="btn sm danger" data-action="del">Eliminar</button>
      </td>
    `;
    tb.appendChild(tr);
  });

  tb.onclick = async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = Number(tr.dataset.id);
    if (btn.dataset.action === 'edit') return editar(id);
    if (btn.dataset.action === 'del')  return eliminar(id);
  };
}

async function editar(id){
  const r = await apiGET(`/api/umbrales/${id}`);
  if (!r.ok) return notify('Umbral no encontrado', 'warn');
  const u = await r.json();
  setModalUmbral({
    titulo: 'Editar Umbral',
    id: u.id,
    metrica: u.metrica,
    operador: u.operador,
    valor: u.valor,
    severidad: u.severidad
  });
}

function setModalUmbral({ titulo, id='', metrica='', operador='>', valor='', severidad='ADVERTENCIA' }){
  document.getElementById('tituloModalUmbral').textContent = titulo || 'Umbral';
  document.getElementById('umbralId').value = id;
  document.getElementById('metrica').value = metrica;
  document.getElementById('operador').value = operador;
  document.getElementById('valor').value = valor;
  document.getElementById('severidad').value = severidad;
  document.getElementById('modalUmbral').style.display = 'flex';
}
function cerrarModalUmbral(){
  document.getElementById('modalUmbral').style.display = 'none';
  document.getElementById('formUmbral').reset();
}

async function onSubmitUmbral(ev){
  ev.preventDefault();
  const id = document.getElementById('umbralId').value.trim();
  const metrica = document.getElementById('metrica').value.trim();
  const operador = document.getElementById('operador').value;
  const valor = document.getElementById('valor').value;
  const severidad = document.getElementById('severidad').value;

  if (!metrica || !operador || !valor || !severidad) return notify('Campos incompletos', 'warn');

  document.getElementById('btnGuardarUmbral').disabled = true;
  try{
    let r;
    if (id) {
      r = await apiPUT(`/api/umbrales/${id}`, { metrica, operador, valor, severidad });
    } else {
      r = await apiPOST(`/api/umbrales`, { metrica, operador, valor, severidad });
    }
    const j = await r.json().catch(()=>({}));
    if (!r.ok) return notify(j?.error || 'Operación no realizada', 'error');
    notify(id ? 'Umbral actualizado' : 'Umbral creado', 'success');
    cerrarModalUmbral();
    await buscar();
  } finally {
    document.getElementById('btnGuardarUmbral').disabled = false;
  }
}

async function eliminar(id){
  if (!confirm(`¿Eliminar umbral #${id}?`)) return;
  const r = await apiDELETE(`/api/umbrales/${id}`);
  const j = await r.json().catch(()=>({}));
  if (!r.ok) {
    return notify(j?.error || 'No se pudo eliminar', 'warn');
  }
  notify('Umbral eliminado', 'success');
  await buscar();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if (!localStorage.getItem('token')) return redirectLogin();
  const me = await cargarPerfil(); if (!me) return;
  if (Number(me.rol_id) !== 1) { notify('Solo ADMIN puede gestionar umbrales', 'warn'); return window.location.href='index.html'; }
  construirTopbar(me);
  bindUI();
  await buscar();
});
