// --- Exportar PDF de los reportes y alertas ---
async function exportarPDFReportes() {
  const lecturas = document.getElementById('reporte-captura');
  const alertas = document.getElementById('alertas-captura');
  if (!lecturas || !alertas) return msg('No se encontró el área de reporte para exportar', 'error');
  msg('Generando PDF, espera...');
  setTimeout(async () => {
    // Captura lecturas
    const canvasLecturas = await html2canvas(lecturas, { backgroundColor: '#222' });
    const imgLecturas = canvasLecturas.toDataURL('image/png');
    // Captura alertas
    const canvasAlertas = await html2canvas(alertas, { backgroundColor: '#222' });
    const imgAlertas = canvasAlertas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    // Lecturas
    let y = 20;
    let imgWidth = pageWidth - 40;
    let imgHeight = canvasLecturas.height * (imgWidth / canvasLecturas.width);
    pdf.addImage(imgLecturas, 'PNG', 20, y, imgWidth, imgHeight);
    y += imgHeight + 20;
    // Alertas (nueva página si no cabe)
    imgHeight = canvasAlertas.height * (imgWidth / canvasAlertas.width);
    if (y + imgHeight > pdf.internal.pageSize.getHeight()) {
      pdf.addPage();
      y = 20;
    }
    pdf.addImage(imgAlertas, 'PNG', 20, y, imgWidth, imgHeight);
    pdf.save('reporte-monitoreo.pdf');
    msg('PDF generado.', 'success');
  }, 500);
}
// /public/js/reportes.js
let currentUser = null;
let chLecturas, chSeveridad, chMetrica, chSerie;
let currentSeries = null; // guarda el último dataset para CSV (métrica)

const METRICAS_TODAS = ['CPU_TEMP_C','RAM_USED_GB','DISK_READ_MBPS','DISK_WRITE_MBPS','UPTIME_SEC'];

function headersAuth(json=false){
  const token = localStorage.getItem('token');
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return json ? { 'Content-Type': 'application/json', ...h } : h;
}
function redirectLogin(){ localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href='/views/login.html'; }
function roleName(r){ return ({1:'ADMIN',2:'TECNICO',3:'CONSULTA'})[r]||r; }
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function msg(t, type='info'){ const m=document.getElementById('msg'); m.textContent=t||''; m.className=`msg ${type}`; }

async function apiGET(url){ const r=await fetch(url,{headers:headersAuth(false)}); if(r.status===401)return redirectLogin(); return r; }

async function cargarPerfil(){ const r=await apiGET('/api/auth/me'); const u=await r.json(); localStorage.setItem('user',JSON.stringify(u)); currentUser=u; return u; }

function construirTopbar(user){
  const nav=document.getElementById('nav');
  if (nav){
    nav.innerHTML='';
    const mk = (href,txt,act)=>{ const a=document.createElement('a'); a.href=href; a.textContent=txt; if(act) a.className='active'; return a; };
    nav.appendChild(mk('index.html','Monitoreo',false));
    nav.appendChild(mk('alertas.html','Alertas',false));
    if (Number(user.rol_id)===1){ nav.appendChild(mk('usuarios.html','Usuarios',false)); nav.appendChild(mk('umbrales.html','Umbrales',false)); }
    nav.appendChild(mk('reportes.html','Reportes',true));
  }
  const session=document.getElementById('session');
  if(session){
    session.innerHTML=`<span class="whoami">${escapeHtml(user?.nombre||user?.email)} · ${escapeHtml(roleName(user?.rol_id))}</span>
      <button id="btnSalir" class="btn-salir">Salir</button>`;
    document.getElementById('btnSalir').onclick=()=>redirectLogin();
  }
}

// Convierte un Date a string para input datetime-local en UTC
function toUTCInputValue(d){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function initDefaults(){
  const to=new Date(); const from=new Date(to.getTime()-24*3600*1000);
  document.getElementById('from').value=toUTCInputValue(from);
  document.getElementById('to').value=toUTCInputValue(to);
  const toA=new Date(); const fromA=new Date(toA.getTime()-30*24*3600*1000);
  document.getElementById('fromA').value=toUTCInputValue(fromA);
  document.getElementById('toA').value=toUTCInputValue(toA);
}
function destroyCharts(){ [chLecturas,chSeveridad,chMetrica,chSerie].forEach(c=>c&&c.destroy()); chLecturas=chSeveridad=chMetrica=chSerie=null; }

// ---------- Utilidades de datos ----------
function tzToISO(d){ return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString(); }
function bucketTs(ts, resol){
  const d=new Date(ts);
  if (resol==='raw') return d.toISOString();
  if (['1m','5m','15m'].includes(resol)) {
    const step = { '1m':1, '5m':5, '15m':15 }[resol];
    d.setSeconds(0,0);
    const m=d.getMinutes();
    d.setMinutes(m - (m % step));
    return d.toISOString();
  }
  if (resol==='1h'){ d.setMinutes(0,0,0); return d.toISOString(); }
  return d.toISOString();
}
function aggregate(points, resol){
  if (resol==='raw') return points.slice();
  const map=new Map();
  for(const p of points){
    const key=bucketTs(new Date(p.tomado_en),resol);
    const arr=map.get(key)||[];
    arr.push(Number(p.valor));
    map.set(key,arr);
  }
  const out=[];
  for(const [k,vals] of map.entries()){
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    out.push({ tomado_en:k, valor:Number(avg.toFixed(2)), unidad:points[0]?.unidad, host_id:points[0]?.host_id });
  }
  out.sort((a,b)=>new Date(a.tomado_en)-new Date(b.tomado_en));
  return out;
}
function movingAverage(vals, window=5){
  if (window<=1) return vals.slice();
  const res=[]; let sum=0;
  for(let i=0;i<vals.length;i++){
    sum+=vals[i];
    if(i>=window) sum-=vals[i-window];
    const denom = i<window-1 ? (i+1) : window;
    res.push(Number((sum/denom).toFixed(2)));
  }
  return res;
}
// -----------------------------------------

async function cargarLecturas(){
  const metrica=document.getElementById('metrica').value;
  const host=document.getElementById('host').value.trim();
  // Siempre interpreta los valores como UTC
  const from = new Date(document.getElementById('from').value + 'Z');
  const to = new Date(document.getElementById('to').value + 'Z');
  const resol=document.getElementById('resolucion').value;
  const tipo=document.getElementById('tipoGrafico').value;
  const suavizar=document.getElementById('suavizar').checked;

  const qs=new URLSearchParams({ metrica, from:tzToISO(from), to:tzToISO(to) });
  if (host) qs.set('host_id', host);

  msg('Cargando lecturas…');
  const r=await apiGET(`/api/report/lecturas?${qs.toString()}`);
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ msg(j?.error||'No se pudieron cargar las lecturas','error'); return; }
  msg('');

  // agrega/agrupa
  let puntos = aggregate(j.puntos || [], resol);

  // guarda serie actual para CSV (métrica)
  currentSeries = { metrica, host_id: j.host_id || host || null, unidad: puntos[0]?.unidad || '', puntos };

  // prepara datos de gráfica
  let labels = puntos.map(p => new Date(p.tomado_en).toLocaleString());
  let data = puntos.map(p => Number(p.valor));
  if (suavizar) data = movingAverage(data, 5);

  if (chLecturas) chLecturas.destroy();
  const ctx=document.getElementById('chartLecturas').getContext('2d');

  const dataset = {
    label: `${metrica}${currentSeries.unidad ? ' ('+currentSeries.unidad+')' : ''}`,
    data,
    tension: 0.15,
    fill: (tipo==='area'),
  };

  const config = {
    type: (tipo==='bar') ? 'bar' : 'line',
    data: { labels, datasets: [dataset] },
    options: {
      responsive:true,
      plugins:{ legend:{ display:true } },
      scales:{
        x:{ ticks:{ maxRotation:0, autoSkip:true } },
        y:{ beginAtZero:false }
      }
    }
  };

  chLecturas = new Chart(ctx, config);
}

async function descargarCSVActual(){
  if (!currentSeries || !Array.isArray(currentSeries.puntos) || currentSeries.puntos.length===0) {
    msg('No hay datos para exportar.', 'warn'); return;
  }
  const { metrica, host_id, puntos } = currentSeries;
  const header='tomado_en,metrica,valor,unidad,host_id\n';
  const body=puntos.map(p=>`${p.tomado_en},${metrica},${p.valor},${p.unidad??''},${host_id??p.host_id??''}`).join('\n');
  const blob=new Blob([header+body],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`lecturas_${metrica}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function descargarCSVTodo(){
  // Rango y host actuales
  const host=document.getElementById('host').value.trim();
  const from=new Date(document.getElementById('from').value);
  const to=new Date(document.getElementById('to').value);
  const qsBase = (m)=> {
    const qs = new URLSearchParams({ metrica:m, from:tzToISO(from), to:tzToISO(to) });
    if (host) qs.set('host_id', host);
    return qs.toString();
  };

  msg('Generando CSV completo…');
  const rows=[];
  for(const m of METRICAS_TODAS){
    const r=await apiGET(`/api/report/lecturas?${qsBase(m)}`);
    if(!r.ok) continue;
    const j=await r.json().catch(()=>({}));
    (j.puntos||[]).forEach(p=>{
      rows.push(`${p.tomado_en},${m},${p.valor},${p.unidad??''},${p.host_id??host??''}`);
    });
  }
  if (rows.length===0){ msg('No hay datos en el rango indicado.','warn'); return; }

  const header='tomado_en,metrica,valor,unidad,host_id\n';
  const blob=new Blob([header+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`lecturas_completo_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  msg('CSV generado.', 'success');
}

async function cargarResumenAlertas(){
  const estado=document.getElementById('estadoA').value;
  // Siempre interpreta los valores como UTC
  const from = new Date(document.getElementById('fromA').value + 'Z');
  const to = new Date(document.getElementById('toA').value + 'Z');

  const qs=new URLSearchParams({ estado, from:tzToISO(from), to:tzToISO(to) });
  const r=await apiGET(`/api/report/alertas/resumen?${qs.toString()}`);
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ console.error(j); return; }

  chSeveridad = new Chart(document.getElementById('chartSeveridad'), {
    type:'doughnut',
    data:{ labels:j.porSeveridad.map(x=>x.severidad), datasets:[{ data:j.porSeveridad.map(x=>x.total) }] },
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  chMetrica = new Chart(document.getElementById('chartMetrica'), {
    type:'bar',
    data:{ labels:j.porMetrica.map(x=>x.metrica), datasets:[{ label:'Alertas', data:j.porMetrica.map(x=>x.total) }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });

  chSerie = new Chart(document.getElementById('chartSerie'), {
    type:'line',
    data:{ labels:j.serie.map(x=>new Date(x.dia).toLocaleDateString()), datasets:[{ label:`Alertas (${estado})`, data:j.serie.map(x=>x.total), tension:.15, fill:true }] },
    options:{ scales:{ y:{ beginAtZero:true } } }
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if (!localStorage.getItem('token')) return redirectLogin();
  const me = await cargarPerfil(); if (!me) return;
  construirTopbar(me);
  initDefaults();

  document.getElementById('btnAplicar').onclick = async ()=>{ if(chLecturas) chLecturas.destroy(); await cargarLecturas(); };
  document.getElementById('btnCSV').onclick = descargarCSVActual;
  document.getElementById('btnCSVAll').onclick = descargarCSVTodo;
  document.getElementById('btnPDF').onclick = exportarPDFReportes;
  document.getElementById('btnAplicarA').onclick = async ()=>{ destroyCharts(); await cargarResumenAlertas(); };

  await cargarLecturas();
  await cargarResumenAlertas();

  // --- WebSocket para lecturas en tiempo real ---
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('nueva_lectura', (data) => {
      // Solo actualiza si la métrica y host coinciden con el filtro actual
      const metricaActual = document.getElementById('metrica').value;
      const hostActual = document.getElementById('host').value.trim();
      if (data.metrica === metricaActual && (!hostActual || String(data.host_id) === hostActual)) {
        if (chLecturas) {
          chLecturas.data.labels.push(new Date(data.tomado_en).toLocaleString());
          chLecturas.data.datasets[0].data.push(Number(data.valor));
          // Limita a los últimos 100 puntos
          if (chLecturas.data.labels.length > 100) {
            chLecturas.data.labels.shift();
            chLecturas.data.datasets[0].data.shift();
          }
          chLecturas.update();
        }
      }
    });
  }
});
