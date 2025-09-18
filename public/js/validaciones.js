function validarInformacion() {
    console.log("Validando información del sistema...");
}

window.onload = validarInformacion;

async function obtenerHardware() {
    try {
        const [hardwareRes, tempRes, uptimeRes, diskSpeedRes] = await Promise.all([
            fetch('http://localhost:3000/api/hardware'),
            fetch('http://localhost:3000/api/hardware/temp'),
            fetch('http://localhost:3000/api/hardware/uptime'),
            fetch('http://localhost:3000/api/hardware/diskspeed')
        ]);
        const hardware = await hardwareRes.json();
        const temp = await tempRes.json();
        const uptime = await uptimeRes.json();
        const diskSpeed = await diskSpeedRes.json();
        mostrarHardware({ ...hardware, temp, uptime, diskSpeed });
    } catch (error) {
        document.getElementById('contenido').innerHTML = '<p>Error al obtener datos de hardware.</p>';
    }
}

function mostrarHardware(info) {
    const { cpu, ram, discos, temp, uptime, diskSpeed } = info;
    const ramTotalGB = (ram.total / (1024 ** 3)).toFixed(2);
    const ramDisponibleGB = (ram.available / (1024 ** 3)).toFixed(2);
    const ramUsadaGB = (ramTotalGB - ramDisponibleGB).toFixed(2);
    const ramPorcentajeUsada = ((ramUsadaGB / ramTotalGB) * 100).toFixed(1);
    const ramPorcentajeDisponible = ((ramDisponibleGB / ramTotalGB) * 100).toFixed(1);
    const ramCacheGB = ram.cached ? (ram.cached / (1024 ** 3)).toFixed(2) : 'N/A';
    let discoHtml = '';
    discos.forEach(disco => {
        const discoTotalGB = (disco.size / (1024 ** 3)).toFixed(2);
        discoHtml += `<div class='detalle'>Modelo: ${disco.name} | Tipo: ${disco.type} | Tamaño: ${discoTotalGB} GB</div>`;
    });
    let html = `
        <div class="card cpu">
            <div class="icono">🖥️</div>
            <h2>CPU<br><span style='font-size:0.9rem;'></span></h2>
            <div class="porcentaje">${cpu.cores} núcleos</div>
            <div class="detalle">Modelo: ${cpu.manufacturer} ${cpu.brand}</div>
            <div class="detalle">Velocidad: ${cpu.speed} GHz</div>
            <div class="detalle">Temperatura: ${temp.main} °C</div>
            <div class="detalle">Tiempo de actividad: ${formatUptime(uptime.uptime)}</div>
            <div class="historial">No disponible el uso en tiempo real</div>
        </div>
        <div class="card ram">
            <div class="icono">💾</div>
            <h2>RAM<br><span style='font-size:0.9rem;'></span></h2>
            <div class="porcentaje">${ramPorcentajeUsada}% usada</div>
            <div class="detalle">Usada: ${ramUsadaGB} GB</div>
            <div class="detalle">Disponible: ${ramDisponibleGB} GB (${ramPorcentajeDisponible}%)</div>
            <div class="detalle">Total: ${ramTotalGB} GB</div>
            <div class="detalle">Caché usada: ${ramCacheGB} GB</div>
            <div class="historial">Actualizado en tiempo real</div>
        </div>
        <div class="card disco">
            <div class="icono">🗄️</div>
            <h2>Disco Duro<br><span style='font-size:0.9rem;'></span></h2>
            ${discoHtml}
            <div class="detalle">Velocidad lectura: ${diskSpeed.read} MB/s</div>
            <div class="detalle">Velocidad escritura: ${diskSpeed.write} MB/s</div>
            <div class="historial">Actualizado en tiempo real</div>
        </div>
    `;
    document.getElementById('contenido').innerHTML = html;
}

function formatUptime(seconds) {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

window.addEventListener('DOMContentLoaded', () => {
    const btnDiagnostico = document.querySelector('.boton.diagnostico');
    if (btnDiagnostico) {
        btnDiagnostico.addEventListener('click', ejecutarDiagnostico);
    }
});

function ejecutarDiagnostico() {
    Promise.all([
        fetch('http://localhost:3000/api/hardware'),
        fetch('http://localhost:3000/api/hardware/temp'),
        fetch('http://localhost:3000/api/hardware/uptime'),
        fetch('http://localhost:3000/api/hardware/diskspeed')
    ])
    .then(async ([hardwareRes, tempRes, uptimeRes, diskSpeedRes]) => {
        const hardware = await hardwareRes.json();
        const temp = await tempRes.json();
        const uptime = await uptimeRes.json();
        const diskSpeed = await diskSpeedRes.json();
        mostrarReporteDiagnostico({ ...hardware, temp, uptime, diskSpeed });
    });
}

function mostrarReporteDiagnostico(info) {
    const { cpu, ram, discos, temp, uptime, diskSpeed } = info;
    let estadoCPU = 'Óptimo';
    if (cpu.cores < 4 || cpu.speed < 2 || temp.main > 80) estadoCPU = 'Limitado';
    let estadoRAM = 'Óptimo';
    const ramTotalGB = (ram.total / (1024 ** 3)).toFixed(2);
    const ramDisponibleGB = (ram.available / (1024 ** 3)).toFixed(2);
    const ramUsadaGB = (ramTotalGB - ramDisponibleGB).toFixed(2);
    const ramPorcentajeUsada = ((ramUsadaGB / ramTotalGB) * 100).toFixed(1);
    const ramCacheGB = ram.cached ? (ram.cached / (1024 ** 3)).toFixed(2) : 'N/A';
    if (ramPorcentajeUsada > 80 || ramCacheGB > ramTotalGB * 0.3) estadoRAM = 'Alto uso';
    let estadoDisco = 'Óptimo';
    discos.forEach(disco => {
        if (disco.size < 128 * 1024 ** 3) estadoDisco = 'Espacio insuficiente';
    });
    if (diskSpeed.read < 100 || diskSpeed.write < 100) estadoDisco = 'Velocidad baja';
    let html = `
        <div class="card cpu">
            <div class="icono">🖥️</div>
            <h2>CPU<br><span style='font-size:0.9rem;'>Procesador</span></h2>
            <div class="porcentaje">${cpu.cores} núcleos</div>
            <div class="detalle">Modelo: ${cpu.manufacturer} ${cpu.brand}</div>
            <div class="detalle">Velocidad: ${cpu.speed} GHz</div>
            <div class="detalle">Temperatura: ${temp.main} °C</div>
            <div class="detalle">Tiempo de actividad: ${formatUptime(uptime.uptime)}</div>
            <div class="detalle">Estado: <span style='color:${estadoCPU === 'Óptimo' ? '#43e97b' : '#ffaf7b'};'>${estadoCPU}</span></div>
        </div>
        <div class="card ram">
            <div class="icono">💾</div>
            <h2>RAM<br><span style='font-size:0.9rem;'>Memoria</span></h2>
            <div class="porcentaje">${ramPorcentajeUsada}% usada</div>
            <div class="detalle">Usada: ${ramUsadaGB} GB</div>
            <div class="detalle">Disponible: ${ramDisponibleGB} GB</div>
            <div class="detalle">Total: ${ramTotalGB} GB</div>
            <div class="detalle">Caché usada: ${ramCacheGB} GB</div>
            <div class="detalle">Estado: <span style='color:${estadoRAM === 'Óptimo' ? '#43e97b' : '#ffaf7b'};'>${estadoRAM}</span></div>
        </div>
        <div class="card disco">
            <div class="icono">🗄️</div>
            <h2>Disco Duro<br><span style='font-size:0.9rem;'>Almacenamiento</span></h2>
            ${discos.map(disco => {
                const discoTotalGB = (disco.size / (1024 ** 3)).toFixed(2);
                return `<div class='detalle'>Modelo: ${disco.name} | Tipo: ${disco.type} | Tamaño: ${discoTotalGB} GB</div>`;
            }).join('')}
            <div class="detalle">Velocidad lectura: ${diskSpeed.read} MB/s</div>
            <div class="detalle">Velocidad escritura: ${diskSpeed.write} MB/s</div>
            <div class="detalle">Estado: <span style='color:${estadoDisco === 'Óptimo' ? '#43e97b' : '#ffaf7b'};'>${estadoDisco}</span></div>
        </div>
    `;
    document.getElementById('contenido').innerHTML = html;
}

// Mostrar menú principal
function mostrarMenuPrincipal() {
    // Eliminar menú si existe
    const menuExistente = document.getElementById('menuPrincipal');
    if (menuExistente) menuExistente.remove();
    // Eliminar monitoreo y diagnóstico
    document.getElementById('contenido').innerHTML = '';
    // Mostrar menú principal
    const menuDiv = document.createElement('div');
    menuDiv.className = 'menu-principal';
    menuDiv.id = 'menuPrincipal';
    menuDiv.innerHTML = `
        <div class="header">
            <h1>DIMO</h1>
            <p>Diagnóstico y monitoreo, sin drama.</p>
        </div>
        <div class="botones">
            <button class="boton monitor" id="btnMonitor">Iniciar Monitoreo</button>
            <button class="boton diagnostico" id="btnDiagnostico">Ejecutar Diagnóstico</button>
        </div>
    `;
    document.body.appendChild(menuDiv);
    // Reasignar eventos
    document.getElementById('btnMonitor').onclick = () => {
        cerrarMenuPrincipal();
        iniciarMonitoreo();
    };
    document.getElementById('btnDiagnostico').onclick = () => {
        cerrarMenuPrincipal();
        ejecutarDiagnostico();
    };
    agregarLogoECG();
}

function cerrarMenuPrincipal() {
    const menu = document.getElementById('menuPrincipal');
    if (menu) menu.remove();
}

// Botón regresar
function agregarBotonRegresar() {
    let btn = document.getElementById('btnRegresar');
    if (!btn) {
        btn = document.createElement('button');
        btn.className = 'boton regresar';
        btn.id = 'btnRegresar';
        btn.innerText = 'Menú Principal';
        document.body.appendChild(btn);
    }
    btn.onclick = mostrarMenuPrincipal;
}

function agregarLogoECG() {
    if (!document.getElementById('logoECG')) {
        const logo = document.createElement('img');
        logo.src = '../dimo_icon_ecg.svg';
        logo.alt = 'Logo ECG';
        logo.className = 'logo-ecg';
        logo.id = 'logoECG';
        document.body.appendChild(logo);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    mostrarMenuPrincipal();
    agregarBotonRegresar();
    agregarLogoECG();
});

// Actualizar cada 5 segundos
setInterval(obtenerHardware, 5000);
obtenerHardware();
