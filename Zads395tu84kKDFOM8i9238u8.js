const departments = [
    // Norte
    "Artigas", "Rivera", "Salto", "Tacuarembó", "Cerro Largo",
    // Centro / Litoral
    "Paysandú", "Río Negro", "Durazno", "Treinta y Tres",
    // Sur / Oeste
    "Soriano", "Flores", "Florida", "Lavalleja", "Rocha",
    // Costa Sur
    "Colonia", "San José", "Canelones", "Maldonado", "Montevideo"
];

let crimeData = JSON.parse(localStorage.getItem('uruguayCrimeData')) || {};
let demoData = JSON.parse(localStorage.getItem('uruguayDemoData')) || { men: 0, women: 0, minors: 0 };

// ===== ESTRUCTURA DE DATOS =====
// Antes: crimeData["Montevideo"] = 5
// Ahora: crimeData["Montevideo"] = { total: 5, barrios: { "Centro": 2 } }

// ===== SEGURIDAD CLIENTE =====
function checkLogin() {
    const input = document.getElementById('login-pass');
    const errorMsg = document.getElementById('login-error');

    // SERVER_PASS se define mas abajo, pero JS lo eleva si es var, si es const depende.
    // Asumimos que SERVER_PASS es global.
    if (input.value === SERVER_PASS) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-container').style.display = 'flex';
        init();
    } else {
        errorMsg.style.display = 'block';
        input.value = '';
        input.focus();
    }
}

function normalizeData() {
    departments.forEach(dept => {
        let val = crimeData[dept];
        // Si es número antiguo o undefined, convertir a objeto nuevo
        if (typeof val !== 'object' || val === null) {
            crimeData[dept] = { total: (typeof val === 'number' ? val : 0), barrios: {} };
        }
    });
}

// ===== MANEJO DE DATOS Y UI BASICA =====
let debounceTimer;

function triggerSave() {
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');

    // Feedback inmediato de "Escribiendo..."
    if (statusText) {
        statusText.innerText = "Esperando...";
        statusText.style.color = "#d29922"; // Naranja
        statusIcon.innerText = "⏳";
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        saveAll();
    }, 1000); // Guardar 1 segundo después de dejar de escribir
}

function init() {
    // Intentar leer data.json del servidor principal
    fetch('data.json?nocache=' + Date.now())
        .then(r => r.json())
        .then(data => {
            if (data.crimes) crimeData = data.crimes;
            if (data.demographics) demoData = data.demographics;
            if (data.incidents) incidentsData = data.incidents || [];

            // Actualizar LocalStorage para consistencia
            localStorage.setItem('uruguayCrimeData', JSON.stringify(crimeData));
            localStorage.setItem('uruguayDemoData', JSON.stringify(demoData));
            localStorage.setItem('uruguayIncidentsData', JSON.stringify(incidentsData));

            // Render Lista de Incidentes
            renderIncidentsList();

            // Actualizar contador incidentes
            const countEl = document.getElementById('incidents-count');
            if (countEl) countEl.innerText = incidentsData.length;

            // Obtener Visitas Reales
            fetch('counter.php?action=get')
                .then(r => r.json())
                .then(v => {
                    const vEl = document.getElementById('visits-count');
                    if (vEl) vEl.innerText = v.count || 0;
                })
                .catch(e => console.warn("No se pudo leer contador visitas:", e));
        })
        .catch(e => {
            console.warn("Carga remota fallida, usando local:", e);
            loadIncidents();
        })
        .finally(() => {
            normalizeData();
            initAdminMap();
            // Si existe función para actualizar marcadores, ejecutarla
            if (typeof updateMarkers === 'function') updateMarkers();
        });
}

// ===== LOGICA DEL MODAL ======
let currentDeptEditing = null;

function openModal(dept) {
    currentDeptEditing = dept;
    document.getElementById('barrios-modal').style.display = 'flex';
    document.getElementById('modal-title').innerText = `Editando: ${dept}`;
    renderBarriosList();
}

function closeModal() {
    document.getElementById('barrios-modal').style.display = 'none';
    currentDeptEditing = null;
    triggerSave(); // Guardar al cerrar por si acaso
}

function renderBarriosList() {
    const list = document.getElementById('modal-list');
    list.innerHTML = '';

    const barrios = crimeData[currentDeptEditing].barrios || {};
    const names = Object.keys(barrios);

    if (names.length === 0) {
        list.innerHTML = '<div style="padding:15px; color:#666; text-align:center;">No hay barrios registrados</div>';
        return;
    }

    names.forEach(name => {
        const row = document.createElement('div');
        row.className = 'barrio-row';
        row.innerHTML = `
            <span>${name}</span>
            <div style="display:flex; align-items:center; gap:10px;">
                <strong>${barrios[name]}</strong>
                <button class="delete-btn" onclick="deleteBarrio('${name}')">×</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function addBarrio() {
    const nameInput = document.getElementById('new-barrio-name');
    const countInput = document.getElementById('new-barrio-count');

    const name = nameInput.value.trim();
    const count = parseInt(countInput.value) || 1;

    if (!name) return alert("Escribe un nombre");

    if (!crimeData[currentDeptEditing].barrios) crimeData[currentDeptEditing].barrios = {};

    // Guardar barrio
    crimeData[currentDeptEditing].barrios[name] = count;

    // Recalcular Total Automático
    recalculateTotal(currentDeptEditing);

    // Reset inputs
    nameInput.value = '';
    countInput.value = 1;
    nameInput.focus();

    renderBarriosList();
}

function deleteBarrio(name) {
    delete crimeData[currentDeptEditing].barrios[name];
    recalculateTotal(currentDeptEditing);
    renderBarriosList();
}

function recalculateTotal(dept) {
    const barrios = crimeData[dept].barrios;
    let sum = Object.values(barrios).reduce((a, b) => a + b, 0);

    // Validar: Si el usuario borra todos los barrios, ¿el total vuelve a 0 o se queda como estaba?
    // Lógica: Si hay barrios, el total DEBE ser la suma.

    if (Object.keys(barrios).length > 0) {
        crimeData[dept].total = sum;
    }

    // Actualizar UI visual del admin (el input numérico de atrás)
    const input = document.getElementById(`input-${dept}`);
    if (input) input.value = crimeData[dept].total;
}

// ===== UPDATE MANUAL ======
function manualUpdate(dept) {
    const input = document.getElementById(`input-${dept}`);
    crimeData[dept].total = parseInt(input.value) || 0;
    triggerSave();
}

function update(dept, change) {
    const input = document.getElementById(`input-${dept}`);
    let val = parseInt(input.value) + change;
    if (val < 0) val = 0;
    input.value = val;
    crimeData[dept].total = val; // Actualizar estructura nueva
    triggerSave();
}

// ===== GESTION DE INCIDENTES (PUNTOS MAPA) =====
let incidentsData = []; // Array de { id, lat, lon, address, date, desc }
let adminMap, adminMarker;

function initAdminMap() {
    if (adminMap) return; // Ya iniciado

    // El contenedor principal ya es visible tras el login.

    adminMap = L.map('admin-map').setView([-34.9011, -56.1645], 13); // Montevideo default

    // Usar CartoDB Dark Matter (Nativo Oscuro)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        detectRetina: true // IMPORTANTE: Ayuda a evitar líneas blancas en pantallas con zoom
    }).addTo(adminMap);

    // Evento Click en Mapa -> Mover marcador manual
    adminMap.on('click', function (e) {
        placeAdminMarker(e.latlng.lat, e.latlng.lng);
    });
}

function placeAdminMarker(lat, lng) {
    if (adminMarker) {
        adminMarker.setLatLng([lat, lng]);
    } else {
        adminMarker = L.marker([lat, lng], { draggable: true }).addTo(adminMap);
        adminMarker.on('dragend', function (e) {
            // Actualizar si quisiéramos inputs de lat/lon, por ahora visual
        });
    }
}

function searchAddress() {
    const query = document.getElementById('inc-address').value;
    if (!query) return alert("Ingresa una dirección");

    const btn = document.querySelector('button[onclick="searchAddress()"]');
    const originalText = btn.innerText;
    btn.innerText = "Buscando...";

    // Usar Nominatim (OpenStreetMap Geocoding)
    // viewbox=-58.4,-30.0,-53.0,-35.8 limita aprox a Uruguay (no estricto pero ayuda)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=uy&limit=1`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            btn.innerText = originalText;
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                placeAdminMarker(lat, lon);
                adminMap.setView([lat, lon], 16);
            } else {
                alert("No se encontró la dirección. Intenta ser más específico (Ej: 18 de Julio, Montevideo)");
            }
        })
        .catch(err => {
            btn.innerText = originalText;
            alert("Error de conexión con servicio de mapas.");
            console.error(err);
        });
}

function addIncident() {
    if (!adminMarker) return alert("Primero busca una dirección o haz clic en el mapa para marcar el punto.");

    const latlng = adminMarker.getLatLng();
    const dept = document.getElementById('inc-dept').value;
    const address = document.getElementById('inc-address').value || "Ubicación Marcada";
    const date = document.getElementById('inc-date').value || new Date().toISOString().split('T')[0];
    const desc = document.getElementById('inc-desc').value || "";
    const gender = document.getElementById('inc-gender').value;
    const age = document.getElementById('inc-age').value;
    const weapon = document.getElementById('inc-weapon').value;
    const source = document.getElementById('inc-source').value || "";

    const newIncident = {
        id: editingId ? editingId : Date.now(),
        lat: latlng.lat,
        lon: latlng.lng,
        dept: dept,
        address: address,
        date: date,
        desc: desc,
        source: source,
        gender: gender,
        age: age,
        weapon: weapon
    };

    if (editingId) {
        // Actualizar existente
        const index = incidentsData.findIndex(i => i.id === editingId);
        if (index !== -1) incidentsData[index] = newIncident;
        editingId = null;
        document.querySelector('.save-btn').innerText = "📌 Confirmar y Publicar Punto";
        document.querySelector('.save-btn').style.background = ""; // Reset color
    } else {
        // Agregar al inicio
        incidentsData.unshift(newIncident);
    }

    // Guardar
    triggerSave();

    // Reset UI
    document.getElementById('inc-dept').value = 'Montevideo';
    document.getElementById('inc-address').value = '';
    document.getElementById('inc-desc').value = '';
    document.getElementById('inc-source').value = '';
    document.getElementById('inc-age').value = '';
    renderIncidentsList();

    // Feedback visual
    const countEl = document.getElementById('incidents-count');
    if (countEl) countEl.innerText = incidentsData.length;
}

function deleteIncident(id) {
    if (!confirm("¿Borrar este punto?")) return;
    incidentsData = incidentsData.filter(i => i.id !== id);
    triggerSave();
    renderIncidentsList();
}

let editingId = null;

function editIncident(id) {
    const inc = incidentsData.find(i => i.id === id);
    if (!inc) return;

    // Cargar datos en el form
    document.getElementById('inc-dept').value = inc.dept || 'Montevideo';
    document.getElementById('inc-address').value = inc.address;
    document.getElementById('inc-date').value = inc.date;
    document.getElementById('inc-desc').value = inc.desc || '';
    document.getElementById('inc-source').value = inc.source || '';
    document.getElementById('inc-gender').value = inc.gender || 'Hombre';
    document.getElementById('inc-age').value = inc.age || '';
    document.getElementById('inc-weapon').value = inc.weapon || 'Arma de Fuego';

    // Mover marcador
    placeAdminMarker(inc.lat, inc.lon);
    adminMap.setView([inc.lat, inc.lon], 16);

    // Setear estado de edición
    editingId = id;
    const btn = document.querySelector('.save-btn');
    btn.innerText = "💾 Guardar Cambios";
    btn.style.background = "#e67e22"; // Naranja para indicar edición

    // Scroll arriba
    document.querySelector('.glass-panel').scrollIntoView({ behavior: 'smooth' });
}

function renderIncidentsList() {
    const list = document.getElementById('incidents-list');
    list.innerHTML = '';

    incidentsData.forEach((inc, index) => {
        const li = document.createElement('li');
        li.style.cssText = "background:rgba(255,255,255,0.05); padding:8px; margin-bottom:5px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;";
        li.innerHTML = `
            <div style="margin-right:10px; font-family:monospace; font-weight:bold; color:#555; background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:4px;">#${incidentsData.length - index}</div>
            <div style="flex:1;">
                <div style="font-weight:bold; color:#ddd;">${inc.address}</div>
                <div style="font-size:0.75rem; color:#aaa;">${inc.date} • ${inc.gender || '-'} (${inc.age || '-'}) • ${inc.weapon || '-'}</div>
            </div>
            <div style="display:flex; gap:5px;">
                <button onclick="editIncident(${inc.id})" style="background:transparent; color:#3498db; border:none; cursor:pointer;" title="Editar">✏️</button>
                <button onclick="deleteIncident(${inc.id})" style="background:transparent; color:#ff4757; border:none; cursor:pointer;" title="Borrar">🗑️</button>
            </div>
        `;
        list.appendChild(li);
    });

    const countEl = document.getElementById('incidents-count');
    if (countEl) countEl.innerText = incidentsData.length;
}

// =========================================================

// CONFIGURACION DEL SERVIDOR
const SERVER_URL = "save.php";
const SERVER_PASS = "Carlos145";

function saveAll() {
    // 2. Guardar Demografia
    const menInput = document.getElementById('demo-men');
    if (menInput) {
        demoData.men = parseInt(menInput.value) || 0;
        demoData.women = parseInt(document.getElementById('demo-women').value) || 0;
        demoData.minors = parseInt(document.getElementById('demo-minors').value) || 0;
        localStorage.setItem('uruguayDemoData', JSON.stringify(demoData));
    }

    // 3. Guardar Local
    const now = new Date().toISOString();
    localStorage.setItem('uruguayCrimeData', JSON.stringify(crimeData));
    localStorage.setItem('uruguayLastUpdate', now);

    // Guardar Incidentes Local
    localStorage.setItem('uruguayIncidentsData', JSON.stringify(incidentsData));

    // 4. Feedback Visual
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');

    if (statusText) {
        statusText.innerText = "Sincronizando...";
        statusText.style.color = "#2f81f7"; // Azul
        statusIcon.innerText = "🔄";
    }

    // 5. INTENTAR SUBIDA AL SERVIDOR
    uploadToServer(statusText, statusIcon, now);
}

function uploadToServer(textEl, iconEl, timestamp) {
    const payload = {
        secret: SERVER_PASS,
        crimes: crimeData,
        demographics: demoData,
        incidents: incidentsData,
        lastUpdate: timestamp
    };

    fetch(SERVER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                textEl.innerText = "Guardado en Nube";
                textEl.style.color = "#2ea44f"; // Verde
                iconEl.innerText = "☁️";
            } else {
                console.error("Error servidor:", data.message);
                textEl.innerText = "Error Servidor";
                textEl.style.color = "#cb2431"; // Rojo
                iconEl.innerText = "⚠️";
            }
        })
        .catch(error => {
            console.warn("No se pudo conectar al servidor", error);
            textEl.innerText = "Guardado Local";
            textEl.style.color = "#d29922"; // Naranja
            iconEl.innerText = "🏠";
        });
}

function downloadData() {
    const dataToSave = {
        crimes: crimeData,
        demographics: demoData,
        incidents: incidentsData,
        lastUpdate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Init Load Incidents
function loadIncidents() {
    const local = localStorage.getItem('uruguayIncidentsData');
    if (local) {
        incidentsData = JSON.parse(local);
        renderIncidentsList();
    }
}


// Auto-run init
// Auto-run init DESACTIVADO POR SEGURIDAD
// window.onload = init;
// Ahora se inicia al loguearse corretamente.

// ===== BACKUP & RESTORE UTILS =====
function downloadBackup() {
    // Generate full snapshot
    const snapshot = {
        crimes: crimeData,
        demographics: demoData,
        incidents: incidentsData,
        lastUpdate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(snapshot, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `backup_admin_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Feedback
    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.innerText = "Backup Descargado";
        setTimeout(() => statusText.innerText = "Sincronizado", 3000);
    }
}

function triggerImport() {
    document.getElementById('import-file').click();
}

function importBackup(input) {
    const file = input.files[0];
    if (!file) return;

    if (!confirm("⚠️ ATENCIÓN: Esta acción SOBRESCRIBIRÁ todos los datos actuales del mapa con los del archivo seleccionado.\n\n¿Estás seguro de continuar?")) {
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);

            // Validate structure
            if (!json.crimes || !json.incidents) {
                throw new Error("El archivo no tiene la estructura correcta (faltan crimes o incidents).");
            }

            // Apply Data
            crimeData = json.crimes;
            demoData = json.demographics || demoData;
            incidentsData = json.incidents || [];

            // Refresh Markers & UI
            renderIncidentsList();
            updateMarkers();

            // Save to Persistence (Local & Server)
            saveAll();

            alert(`✅ Datos restaurados exitosamente.\nSe han cargado ${incidentsData.length} incidentes.`);

        } catch (err) {
            console.error(err);
            alert("❌ Error al importar: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset
}
