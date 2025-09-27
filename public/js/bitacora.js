// /public/js/bitacora.js
let me = null;
let page = 1, pageSize = 20, total = 0;

function headersAuth(json=false){
  const token = localStorage.getItem('token');
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return json ? { 'Content-Type': 'application/json', ...h } : h;
}
function redirectLogin(){ localStorage.removeItem('token'); localStorage.removeItem('user'); location.href='/views/login.html'; }
function roleName(r){ return ({1:'ADMIN',2:'TECNICO',3:'CONSULTA'})[r]||r; }
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function msg(t, type='info'){ const m=document.getElementById('msg'); m.textContent=t||''; m.className=`msg ${type}`; }

async function apiGET(url){ const r=await fetch(url,{headers:headersAuth(false)}); if(r.status===401)return redirectLogin(); return r; }

async function cargarPerfil(){
  const r = await apiGET('/api/auth/me');
  me = await r.json();
  localStorage.setItem('user', JSON.stringify(me));
  return me;
}

function construirTopbar(user){
  const nav=document.getElementById('nav');
  if(nav){
    nav.innerHTML='';
    const mk=(href,txt,act)=>{ const a=document.createElement('a'); a.href=href; a.textContent=txt; if(act) a.className='active'; return a; };
    nav.appendChild(mk('index.html','Monitoreo',false));
    nav.appendChild(mk('alertas.html','Alertas',false));
    if (Number(user.rol_id)===1){ // ADMIN
      nav.appendChild(mk('usuarios.html','Usuarios',false));
      nav.appendChild(mk('umbrales.html','Umbrales',false));
    }
    nav.appendChild(mk('reportes.html','Reportes',false));
    nav.appendChild(mk('bitacora.html','Bitácora',true));
  }
  const session=document.getElementById('session');
  if(session){
    session.innerHTML=`<span class="whoami">${escapeHtml(user?.nombre||user?.email)} · ${escapeHtml(roleName(user?.rol_id))}</span>
      <button id="btnSalir" class="btn-salir">Salir</button>`;
    document.getElementById('btnSalir').onclick=()=>redirectLogin();
  }
}

function toLocalInputValue(d){const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function initDefaults(){
  const to=new Date(); const from=new Date(to.getTime()-7*24*3600*1000);
  document.getElementById('from').value=toLocalInputValue(from);
  document.getElementById('to').value=toLocalInputValue(to);
}

function renderRows(items){
  const tbody=document.getElementById('rows');
  if(!Array.isArray(items) || items.length===0){
    tbody.innerHTML=`<tr><td colspan="4" style="text-align:center; opacity:.8">Sin eventos para el filtro actual.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(it=>{
    const fecha = new Date(it.creado_en).toLocaleString();
    const usuario = it.usuario_nombre ? `${escapeHtml(it.usuario_nombre)} (${escapeHtml(it.usuario_email||'')})` : `ID ${it.usuario_id||'-'}`;
    return `<tr>
      <td>${escapeHtml(fecha)}</td>
      <td>${usuario}</td>
      <td><span class="badge">${escapeHtml(it.accion||'')}</span></td>
      <td>${escapeHtml(it.detalle||'')}</td>
    </tr>`;
  }).join('');
}

function renderPager(){
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  document.getElementById('pageInfo').textContent = `Página ${page} de ${totalPages} · ${total} eventos`;
  document.getElementById('prev').disabled = page <= 1;
  document.getElementById('next').disabled = page >= totalPages;
}

async function cargarBitacora(goPage=1){
  page = goPage;
  const from = new Date(document.getElementById('from').value);
  const to   = new Date(document.getElementById('to').value);
  const usuario_id = document.getElementById('usuario_id').value.trim();
  const q = document.getElementById('q').value.trim();

  const qs = new URLSearchParams({
    page: String(page), pageSize: String(pageSize),
    from: new Date(from.getTime()-from.getTimezoneOffset()*60000).toISOString(),
    to:   new Date(to.getTime()-to.getTimezoneOffset()*60000).toISOString()
  });
  if (usuario_id) qs.set('usuario_id', usuario_id);
  if (q) qs.set('q', q);

  msg('Cargando…');
  const r = await apiGET(`/api/audit/bitacora?${qs.toString()}`);
  const j = await r.json().catch(()=>({}));
  if (!r.ok) { msg(j?.error || 'Error al consultar bitácora', 'error'); return; }
  msg('');

  total = j.total || 0;
  renderRows(j.items || []);
  renderPager();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!localStorage.getItem('token')) return redirectLogin();
  const u = await cargarPerfil(); if(!u) return;
  construirTopbar(u);
  initDefaults();

  document.getElementById('btnBuscar').onclick = () => cargarBitacora(1);
  document.getElementById('btnLimpiar').onclick = () => {
    document.getElementById('usuario_id').value = '';
    document.getElementById('q').value = '';
    initDefaults();
    cargarBitacora(1);
  };
  document.getElementById('prev').onclick = () => { if(page>1) cargarBitacora(page-1); };
  document.getElementById('next').onclick = () => { cargarBitacora(page+1); };

  await cargarBitacora(1);
});
