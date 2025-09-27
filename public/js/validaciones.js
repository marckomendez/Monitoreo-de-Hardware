// public/js/validaciones.js

let currentUser = null;

function headersJSON() {
  const token = localStorage.getItem('token');
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function logoutAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/views/login.html';
}

async function apiGET(url) {
  const res = await fetch(url, { headers: headersJSON() });
  if (res.status === 401) { logoutAndRedirect(); throw new Error('401'); }
  return res;
}
async function apiPATCH(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headersJSON() },
    body: JSON.stringify(body || {})
  });
  if (res.status === 401) { logoutAndRedirect(); throw new Error('401'); }
  return res;
}

function roleName(rol_id) {
  return ({ 1: 'ADMIN', 2: 'TECNICO', 3: 'CONSULTA' })[rol_id] || String(rol_id);
}

async function cargarPerfil() {
  const res = await apiGET('/api/auth/me');
  const user = await res.json();
  localStorage.setItem('user', JSON.stringify(user));
  currentUser = user;
  return user;
}

function construirTopbar(user) {
  const nav = document.getElementById('nav');
  if (nav) {
    nav.innerHTML = '';
    const aMonitoreo = document.createElement('a');
    aMonitoreo.href = 'index.html';
    aMonitoreo.textContent = 'Monitoreo';
    aMonitoreo.className = 'active';
    nav.appendChild(aMonitoreo);

    if (Number(user.rol_id) === 1) {
      const aUsuarios = document.createElement('a');
      aUsuarios.href = 'usuarios.html';
      aUsuarios.textContent = 'Usuarios';
      nav.appendChild(aUsuarios);
    }
      const aAlertas = document.createElement('a');
      aAlertas.href = 'alertas.html';
      aAlertas.textContent = 'Alertas';
      nav.appendChild(aAlertas);

      const aUmbrales = document.createElement('a');
      aUmbrales.href = 'umbrales.html';
      aUmbrales.textContent = 'Umbrales';
      nav.appendChild(aUmbrales);}

      const aRep = document.createElement('a');
      aRep.href = 'reportes.html';
      aRep.textContent = 'Reportes';
      nav.appendChild(aRep);


  const session = document.getElementById('session');
  if (session) {
    const nombre = user?.nombre || user?.email || 'Usuario';
    const rol = roleName(user?.rol_id);
    session.innerHTML = `
      <span class="whoami">${escapeHtml(nombre)} · ${escapeHtml(rol)}</span>
      <button id="btnCapturar" class="btn-salir" title="Capturar ahora">Capturar</button>
      <button id="btnSalir" class="btn-salir" title="Cerrar sesión">Salir</button>
    `;
    document.getElementById('btnSalir').onclick = logoutAndRedirect;
    document.getElementById('btnCapturar').onclick = async () => {
      const btn = document.getElementById('btnCapturar');
      btn.disabled = true;
      try {
        const r = await apiGET('/api/monitor/capturar');
        await r.json();
        await obtenerHardware();
        await cargarAlertas();
      } catch (e) {
        console.error(e);
        toast('No se pudo capturar', 'warn');
      } finally {
        btn.disabled = false;
      }
    };
  }
}

function toast(msg, type='info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => { el.textContent=''; el.className='toast'; }, 3000);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

async function obtenerHardware() {
  try {
    const [hardwareRes, tempRes, uptimeRes, diskSpeedRes] = await Promise.all([
      apiGET('/api/hardware'),
      apiGET('/api/hardware/temp'),
      apiGET('/api/hardware/uptime'),
      apiGET('/api/hardware/diskspeed')
    ]);

    const hardware = await hardwareRes.json();
    const temp = await tempRes.json();
    const uptime = await uptimeRes.json();
    const diskSpeed = await diskSpeedRes.json();

    mostrarHardware({ ...hardware, temp, uptime, diskSpeed });
  } catch (error) {
    const cont = document.getElementById('contenido');
    if (cont) cont.innerHTML = '<p>Error al obtener datos de hardware.</p>';
  }
}

function mostrarHardware(info) {
  const { cpu, ram, discos, temp, uptime, diskSpeed } = info;

  const total = ram?.total ?? 0;
  const available = ram?.available ?? 0;
  const cached = ram?.cached ?? 0;

  const ramTotalGB = (total / (1024 ** 3)).toFixed(2);
  const ramDisponibleGB = (available / (1024 ** 3)).toFixed(2);
  const ramUsadaGB = (Number(ramTotalGB) - Number(ramDisponibleGB)).toFixed(2);
  const ramPorcentajeUsada = (+ramTotalGB > 0) ? ((ramUsadaGB / ramTotalGB) * 100).toFixed(1) : '0.0';
  const ramPorcentajeDisponible = (+ramTotalGB > 0) ? ((ramDisponibleGB / ramTotalGB) * 100).toFixed(1) : '0.0';
  const ramCacheGB = (cached / (1024 ** 3)).toFixed(2);

  let discoHtml = '';
  (discos || []).forEach(disco => {
    const size = disco?.size ?? 0;
    const discoTotalGB = (size / (1024 ** 3)).toFixed(2);
    discoHtml += `<div class='detalle'>Modelo: ${escapeHtml(disco?.name)} | Tipo: ${escapeHtml(disco?.type)} | Tamaño: ${discoTotalGB} GB</div>`;
  });

  const html = `
    <div class="card cpu">
      <div class="icono">🖥️</div>
      <h2>CPU</h2>
      <div class="porcentaje">${cpu?.cores ?? 'N/A'} núcleos</div>
      <div class="detalle">Modelo: ${escapeHtml(cpu?.manufacturer)} ${escapeHtml(cpu?.brand)}</div>
      <div class="detalle">Velocidad: ${cpu?.speed ?? 'N/A'} GHz</div>
      <div class="detalle">Temperatura: ${temp?.main ?? 'N/A'} °C</div>
      <div class="detalle">Tiempo de actividad: ${formatUptime(uptime?.uptime)}</div>
      <div class="historial">No disponible el uso en tiempo real</div>
    </div>
    <div class="card ram">
      <div class="icono">💾</div>
      <h2>RAM</h2>
      <div class="porcentaje">${ramPorcentajeUsada}% usada</div>
      <div class="detalle">Usada: ${ramUsadaGB} GB</div>
      <div class="detalle">Disponible: ${ramDisponibleGB} GB (${ramPorcentajeDisponible}%)</div>
      <div class="detalle">Total: ${ramTotalGB} GB</div>
      <div class="detalle">Caché usada: ${ramCacheGB} GB</div>
      <div class="historial">Actualizado en tiempo real</div>
    </div>
    <div class="card disco">
      <div class="icono">🗄️</div>
      <h2>Disco Duro</h2>
      ${discoHtml || '<div class="detalle">Sin discos detectados</div>'}
      <div class="detalle">Velocidad lectura: ${(diskSpeed?.read ?? 0)} MB/s</div>
      <div class="detalle">Velocidad escritura: ${(diskSpeed?.write ?? 0)} MB/s</div>
      <div class="historial">Actualizado en tiempo real</div>
    </div>
  `;
  const cont = document.getElementById('contenido');
  if (cont) cont.innerHTML = html;
}

function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ---- Alertas ----
async function cargarAlertas() {
  try {
    const res = await apiGET('/api/monitor/alertas?estado=ABIERTA');
    const alertas = await res.json();
    renderAlertas(alertas);
  } catch (e) {
    console.error(e);
    renderAlertas([]);
  }
}

function renderAlertas(alertas) {
  let panel = document.getElementById('alertas');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'alertas';
    document.body.appendChild(panel);
  }
  if (!Array.isArray(alertas) || alertas.length === 0) {
    panel.innerHTML = `
      <div class="alertas-card">
        <h3>Alertas abiertas</h3>
        <p class="muted">No hay alertas abiertas.</p>
      </div>`;
    return;
  }

  const puedeCerrar = [1,2].includes(Number(currentUser?.rol_id)); // ADMIN o TECNICO
  const rows = alertas.map(a => `
    <tr>
      <td>${escapeHtml(a.metrica)}</td>
      <td>${escapeHtml(a.operador)} ${a.umbral_valor}</td>
      <td>${a.lectura_valor} ${escapeHtml(a.unidad || '')}</td>
      <td>${escapeHtml(a.severidad)}</td>
      <td>${new Date(a.creado_en).toLocaleString()}</td>
      <td>${puedeCerrar ? `<button class="btn sm" onclick="cerrarAlerta(${a.id})">Cerrar</button>` : '-'}</td>
    </tr>
  `).join('');

  panel.innerHTML = `
    <div class="alertas-card">
      <h3 id="alertas">Alertas abiertas</h3>
      <table class="tabla-usuarios">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Umbral</th>
            <th>Valor actual</th>
            <th>Severidad</th>
            <th>Creado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function cerrarAlerta(id) {
  if (!confirm('¿Cerrar esta alerta?')) return;
  try {
    const res = await apiPATCH(`/api/monitor/alertas/${id}/cerrar`, { comentario: 'Cerrada desde UI' });
    if (!res.ok) throw new Error('close');
    toast('Alerta cerrada', 'success');
    await cargarAlertas();
  } catch {
    toast('No se pudo cerrar la alerta', 'warn');
  }
}

// Menú principal
function mostrarMenuPrincipal() {
  const cont = document.getElementById('contenido');
  if (!cont) return;
  cont.innerHTML = `
    <div class="menu-principal">
      <div class="header">
        <h1>DIMO</h1>
        <p>Diagnóstico y monitoreo, sin drama.</p>
      </div>
      <div class="botones">
        <button class="boton monitor" id="btnMonitor">Iniciar Monitoreo</button>
        <button class="boton diagnostico" id="btnDiagnostico">Ejecutar Diagnóstico</button>
      </div>
    </div>
  `;
  document.getElementById('btnMonitor').onclick = iniciarMonitoreo;
  document.getElementById('btnDiagnostico').onclick = ejecutarDiagnostico;
}

function agregarLogoECG() {
  if (!document.getElementById('logoECG')) {
    const logo = document.createElement('img');
    logo.src = '/dimo_icon_ecg.svg';
    logo.alt = 'Logo ECG';
    logo.className = 'logo-ecg';
    logo.id = 'logoECG';
    document.body.appendChild(logo);
  }
}

function iniciarMonitoreo() {
  obtenerHardware();
}
function ejecutarDiagnostico() {
  Promise.all([
    apiGET('/api/hardware'),
    apiGET('/api/hardware/temp'),
    apiGET('/api/hardware/uptime'),
    apiGET('/api/hardware/diskspeed')
  ]).then(async ([hardwareRes, tempRes, uptimeRes, diskSpeedRes]) => {
    const hardware = await hardwareRes.json();
    const temp = await tempRes.json();
    const uptime = await uptimeRes.json();
    const diskSpeed = await diskSpeedRes.json();
    mostrarReporteDiagnostico({ ...hardware, temp, uptime, diskSpeed });
  }).catch(() => {
    const cont = document.getElementById('contenido');
    if (cont) cont.innerHTML = '<p>Error al ejecutar diagnóstico.</p>';
  });
}

function mostrarReporteDiagnostico(info) {
  const { cpu, ram, discos, temp, uptime, diskSpeed } = info;
  let estadoCPU = 'Óptimo';
  if ((cpu?.cores ?? 0) < 4 || (cpu?.speed ?? 0) < 2 || (temp?.main ?? 0) > 80) estadoCPU = 'Limitado';

  const total = ram?.total ?? 0;
  const available = ram?.available ?? 0;
  const cached = ram?.cached ?? 0;

  const ramTotalGB = (total / (1024 ** 3)).toFixed(2);
  const ramDisponibleGB = (available / (1024 ** 3)).toFixed(2);
  const ramUsadaGB = (Number(ramTotalGB) - Number(ramDisponibleGB)).toFixed(2);
  const ramPorcentajeUsada = (+ramTotalGB > 0) ? ((ramUsadaGB / ramTotalGB) * 100).toFixed(1) : '0.0';
  const ramCacheGB = (cached / (1024 ** 3)).toFixed(2);

  let estadoRAM = 'Óptimo';
  if (parseFloat(ramPorcentajeUsada) > 80 || parseFloat(ramCacheGB) > (parseFloat(ramTotalGB) * 0.3)) {
    estadoRAM = 'Alto uso';
  }

  let estadoDisco = 'Óptimo';
  (discos || []).forEach(d => {
    const sizeGB = (Number(d?.size ?? 0) / (1024 ** 3));
    if (sizeGB < 128) estadoDisco = 'Espacio insuficiente';
  });
  if ((diskSpeed?.read ?? 0) < 100 || (diskSpeed?.write ?? 0) < 100) estadoDisco = 'Velocidad baja';

  const html = `
    <div class="card cpu">
      <div class="icono">🖥️</div>
      <h2>CPU</h2>
      <div class="porcentaje">${cpu?.cores ?? 'N/A'} núcleos</div>
      <div class="detalle">Modelo: ${escapeHtml(cpu?.manufacturer)} ${escapeHtml(cpu?.brand)}</div>
      <div class="detalle">Velocidad: ${cpu?.speed ?? 'N/A'} GHz</div>
      <div class="detalle">Temperatura: ${temp?.main ?? 'N/A'} °C</div>
      <div class="detalle">Tiempo de actividad: ${formatUptime(uptime?.uptime)}</div>
      <div class="detalle">Estado: <span style='color:${estadoCPU === 'Óptimo' ? '#43e97b' : '#ffaf7b'};'>${estadoCPU}</span></div>
    </div>
    <div class="card ram">
      <div class="icono">💾</div>
      <h2>RAM</h2>
      <div class="porcentaje">${ramPorcentajeUsada}% usada</div>
      <div class="detalle">Usada: ${ramUsadaGB} GB</div>
      <div class="detalle">Disponible: ${ramDisponibleGB} GB</div>
      <div class="detalle">Total: ${ramTotalGB} GB</div>
      <div class="detalle">Caché usada: ${ramCacheGB} GB</div>
      <div class="detalle">Estado: <span style='color:${estadoRAM === 'Óptimo' ? '#43e97b' : '#ffaf7b'};'>${estadoRAM}</span></div>
    </div>
    <div class="card disco">
      <div class="icono">🗄️</div>
      <h2>Disco Duro</h2>
      ${(discos || []).map(d => {
        const discoTotalGB = ((Number(d?.size ?? 0)) / (1024 ** 3)).toFixed(2);
        return `<div class='detalle'>Modelo: ${escapeHtml(d?.name)} | Tipo: ${escapeHtml(d?.type)} | Tamaño: ${discoTotalGB} GB</div>`;
      }).join('') || '<div class="detalle">Sin discos detectados</div>'}
      <div class="detalle">Velocidad lectura: ${(diskSpeed?.read ?? 0)} MB/s</div>
      <div class="detalle">Velocidad escritura: ${(diskSpeed?.write ?? 0)} MB/s</div>
      <div class="detalle">Estado: <span style='color:${estadoDisco === 'Óptimo' ? '#43e97b' : '#ffaf7b'};'>${estadoDisco}</span></div>
    </div>
  `;
  const cont = document.getElementById('contenido');
  if (cont) cont.innerHTML = html;
}

// Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) return logoutAndRedirect();

  const user = await cargarPerfil();
  if (!user) return;

  construirTopbar(user);
  mostrarMenuPrincipal();
  agregarLogoECG();

  setInterval(() => {
    if (document.getElementById('contenido')) {
      obtenerHardware();
    }
  }, 5000);

  obtenerHardware();
  cargarAlertas();
  setInterval(cargarAlertas, 5000); // refresco de alertas cada 5 segundos
});