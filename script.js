// Map Initialization
const map = L.map('map', {
    zoomControl: false,
    attributionControl: true, // FIXED: Mostrar Copyright
    scrollWheelZoom: true,
    doubleClickZoom: true,
    preferCanvas: true,
    dragging: true,
    tap: false,
    zoomSnap: 0.1,
    zoomDelta: 0.2,
    wheelPxPerZoomLevel: 200
}).setView([-34.82, -56.16], window.innerWidth < 768 ? 10.8 : 12);
window.map = map;

// Theme Management
let currentTheme = localStorage.getItem('mapTheme') || 'light';
let darkTileLayer, lightTileLayer, activeTileLayer;

// Dark Theme Tiles
darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    crossOrigin: true,
    updateWhenIdle: false,
    keepBuffer: 25,
    detectRetina: true // FIXED: Evita líneas blancas
});

// Light Theme Tiles (...)
lightTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    crossOrigin: true,
    updateWhenIdle: false,
    keepBuffer: 25
});

// Set initial theme
if (currentTheme === 'dark') {
    activeTileLayer = darkTileLayer.addTo(map);
    document.body.classList.remove('light-theme'); // Ensure no light theme class
} else {
    activeTileLayer = lightTileLayer.addTo(map);
    document.body.classList.add('light-theme');
}


// Screenshot Plugin Init
let screenshoter = null;
try {
    screenshoter = L.simpleMapScreenshoter({
        hiddenElements: ['.leaflet-control-zoom', '#settings-toggle', '#settings-panel', '#social-bar', '#tooltip', '.leaflet-control-container', '#days-counter-panel', '.floating-logo', '#share-modal', '.dev-signature']
    }).addTo(map);
} catch (e) { console.warn("Screenshoter init fail", e); }


// Data Management
let lastUpdateDate = null;
let geoJsonLayer;
let allHistoricalIncidents = []; // For trend chart (all years combined)

// Global Data Safe Init
window.crimeData = window.crimeData || {};
window.demoData = window.demoData || { men: 0, women: 0, minors: 0 };

function normalizeCrimeData() {
    if (!window.crimeData) return;
    for (let k in window.crimeData) {
        if (typeof window.crimeData[k] !== 'object' || window.crimeData[k] === null) {
            window.crimeData[k] = { total: parseInt(window.crimeData[k]) || 0, barrios: {} };
        }
    }
}


// Developer Signature Removed
// const signatureIcon = L.divIcon({...});
// L.marker([-35.5, -53.0], ...).addTo(map);

// DEBUG MOBILE: Mostrar errores en pantalla si algo falla grave
window.onerror = function (msg, url, line) {
    // Descomentar para ver errores en el celular
    // alert("Error: " + msg + "\nLinea: " + line);
};

// Function to get total count safely (Hybrid Support)
function getCount(key) {
    const data = crimeData[key];
    if (typeof data === 'object' && data !== null) {
        return parseInt(data.total) || 0;
    }
    return parseInt(data) || 0;
}

// Function to get color based on value
function getColor(d) {
    return d > 10 ? '#ff4757' : // High
        d > 5 ? '#ffa502' : // Medium
            d > 0 ? '#ff7f50' : // Low
                '#3742fa';  // No cases (Blue/Safe)
}

function getStyle(feature) {
    // SIN PINTAR NADA - Solo bordes
    return {
        fillColor: 'transparent',
        weight: 2,
        opacity: 1,
        color: '#333', // Borde oscuro
        dashArray: '',
        fillOpacity: 0
    };
}





function onEachFeature(feature, layer) {

    if (feature.properties && feature.properties.NAME_1) {
        const deptName = feature.properties.NAME_1;

        // Excepción: Rivera se etiqueta manualmente despuÃ©s
        if (deptName === 'Rivera') return;

        layer.bindTooltip(deptName, {
            permanent: true,
            direction: 'center',
            className: 'dept-label'
        });
    }
}

// Etiqueta Manual para Rivera (Coordenada Fija)
L.marker([-31.1, -55.5], {
    icon: L.divIcon({
        className: 'dept-label',
        html: 'Rivera',
        iconSize: [100, 20],
        iconAnchor: [50, 10] // Centrado
    }),
    interactive: false
}).addTo(map);

function updateRanking() {
    const list = document.getElementById('ranking-list');
    const barriosList = document.getElementById('barrios-ranking-list');

    if (!list) return;

    // --- 1. Ranking Deptos ---
    const entries = Object.keys(crimeData).map(key => {
        return [key, getCount(key)];
    });

    const sorted = entries
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);

    list.innerHTML = '';

    if (sorted.length === 0) {
        list.innerHTML = '<li style="padding:10px; color:#aaa; font-style:italic; font-size:0.8rem;">Sin datos registrados</li>';
        // Limpiar barrios si no hay datos
        if (barriosList) barriosList.innerHTML = '<li style="padding:10px; color:#aaa; font-style:italic; font-size:0.8rem;">-</li>';
        return;
    }

    // Render Deptos (Top 5 visible, resto scroll si hubiera)
    sorted.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'ranking-item';
        li.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span class="rank-number">#${index + 1}</span>
                <span class="rank-name">${item[0]}</span>
            </div>
            <strong style="color:var(--accent);">${item[1]}</strong>
        `;
        list.appendChild(li);
    });

    // --- 2. Ranking Barrios Global ---
    if (!barriosList) return;
    barriosList.innerHTML = '';

    let allBarrios = [];

    // Recorrer todos los departamentos
    Object.keys(crimeData).forEach(deptName => {
        const data = crimeData[deptName];
        if (typeof data === 'object' && data.barrios) {
            for (const [barrioName, count] of Object.entries(data.barrios)) {
                if (count > 0) {
                    allBarrios.push({
                        name: barrioName,
                        dept: deptName,
                        count: count
                    });
                }
            }
        }
    });

    // Ordenar barrios por cantidad desc
    allBarrios.sort((a, b) => b.count - a.count);

    // Tomar solo el Top 5
    const topBarrios = allBarrios.slice(0, 5);

    if (topBarrios.length === 0) {
        barriosList.innerHTML = '<li style="padding:10px; color:#aaa; font-style:italic; font-size:0.8rem;">Sin barrios criticos</li>';
    } else {
        topBarrios.forEach((b, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            li.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <div style="display:flex; align-items:center;">
                        <span class="rank-number" style="background:rgba(255,165,2,0.1); color:#ffa502;">${index + 1}</span>
                        <span class="rank-name">${b.name}</span>
                    </div>
                    <span style="font-size:0.7rem; color:#666; margin-left:25px;">${b.dept}</span>
                </div>
                <strong style="color:#ffa502;">${b.count}</strong>
            `;
            barriosList.appendChild(li);
        });
    }
}

function updateDemographics() {
    const menEl = document.getElementById('count-men');
    const womenEl = document.getElementById('count-women');
    const minorsEl = document.getElementById('count-minors');

    if (menEl) menEl.innerText = demoData.men || 0;
    if (womenEl) womenEl.innerText = demoData.women || 0;
    if (minorsEl) minorsEl.innerText = demoData.minors || 0;
}

// Fetch Data & Map
const MAP_URL = 'uruguay.json';
// Timestamp anti-cache forzoso
const DATA_JSON_URL = 'https://homicidiosuy.com/data.json' + '?t=' + new Date().getTime();
const BARRIOS_URL = 'montevideo_barrios.json';

let barriosLayer;

function normalizeStr(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function updateBarriosVisuals() {
    if (!barriosLayer) return;
    barriosLayer.eachLayer(layer => {
        barriosLayer.resetStyle(layer);
    });
}

function getBarrioStyle(feature) {
    // Buscar datos de Montevideo
    const mvdData = crimeData['Montevideo'];
    let count = 0;

    if (mvdData && mvdData.barrios && feature.properties.nombre) {
        const geoName = normalizeStr(feature.properties.nombre);
        // BÃºsqueda insensible a mayusculas y acentos
        const matchKey = Object.keys(mvdData.barrios).find(k => normalizeStr(k) === geoName);
        if (matchKey) {
            count = mvdData.barrios[matchKey];
        }
    }

    return {
        fillColor: count > 3 ? '#ff4757' : (count > 0 ? '#ffa502' : 'transparent'),
        weight: 1,
        opacity: 0.5,
        color: '#666',
        dashArray: '2',
        fillOpacity: count > 0 ? 0.6 : 0 // Solo pintar si hay crÃ­menes
    };
}

// Determine if we're running locally or in production
const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
// Mejorado: Si estamos en un subdominio o carpeta de prueba, usar ruta relativa para no cargar datos de producción por error
const dataBaseUrl = './';

Promise.all([
    fetch(MAP_URL).then(r => r.json()),
    // Load 2026 data
    fetch('data.json?t=' + new Date().getTime()).then(r => {
        if (!r.ok) throw new Error(`HTTP Error ${r.status} al cargar data.json`);
        return r.json();
    }).catch(err => {
        console.error("Fallo carga data 2026:", err);
        return null;
    }),
    // Load 2025 data
    fetch('data_2025.json?t=' + new Date().getTime()).then(r => {
        if (!r.ok) throw new Error(`HTTP Error ${r.status} al cargar data_2025.json`);
        return r.json();
    }).catch(err => {
        console.error("Fallo carga data 2025:", err);
        return null;
    }),
    fetch(BARRIOS_URL).then(r => r.json()).catch(err => {
        console.warn("No hay mapa de barrios local:", err);
        return null;
    })
]).then(([topology, remoteData2026, remoteData2025, barriosGeo]) => {

    // Normalizar datos locales antiguos si existen
    let localCrime = JSON.parse(localStorage.getItem('uruguayCrimeData'));
    if (localCrime) {
        for (let k in localCrime) {
            if (typeof localCrime[k] !== 'object' || localCrime[k] === null) {
                localCrime[k] = { total: parseInt(localCrime[k]) || 0, barrios: {} };
            }
        }
    }

    const localDemo = JSON.parse(localStorage.getItem('uruguayDemoData'));
    const localUpdate = localStorage.getItem('uruguayLastUpdate');

    // Si el servidor tiene datos remotos, limpiar localStorage y usar siempre el servidor.
    // Esto evita que datos viejos del admin pisen el data.json actualizado.
    const remoteHasData = remoteData2026 && (
        (remoteData2026.incidents && remoteData2026.incidents.length > 0) ||
        (remoteData2026.crimes && Object.keys(remoteData2026.crimes).length > 0)
    );

    if (remoteHasData && localCrime) {
        // (log removido)
        localStorage.removeItem('uruguayCrimeData');
        localStorage.removeItem('uruguayIncidentsData');
        localStorage.removeItem('uruguayDemoData');
        localStorage.removeItem('uruguayLastUpdate');
        localCrime = null;
    }

    const hasLocalData = false; // Siempre usar datos remotos si están disponibles

    if (hasLocalData) {
        // (log removido)
        crimeData = localCrime || {};
        demoData = localDemo || {};

        // Cargar incidentes locales (Preview de Admin)
        const localIncidents = JSON.parse(localStorage.getItem('uruguayIncidentsData'));
        if (localIncidents && Array.isArray(localIncidents)) {
            renderIncidentsPublic(localIncidents);
        }

        // Combinar datos remotos 2025+2026 para el gráfico de tendencia histórica
        allHistoricalIncidents = [];
        if (remoteData2026 && remoteData2026.incidents) allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2026.incidents);
        else if (Array.isArray(remoteData2026)) allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2026);
        if (remoteData2025 && remoteData2025.incidents) allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2025.incidents);
        else if (Array.isArray(remoteData2025)) allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2025);
        window.allHistoricalIncidents = allHistoricalIncidents;
        if (allHistoricalIncidents.length > 0) generateTrendChart(allHistoricalIncidents);

        lastUpdateDate = localUpdate;
    } else if (remoteData2026 || remoteData2025) {
        // (log removido)

        // Combine incidents from both years FOR THE CHART
        allHistoricalIncidents = [];

        if (remoteData2026 && remoteData2026.incidents && Array.isArray(remoteData2026.incidents)) {
            allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2026.incidents);
        } else if (Array.isArray(remoteData2026)) {
            allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2026);
        }

        if (remoteData2025 && remoteData2025.incidents && Array.isArray(remoteData2025.incidents)) {
            allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2025.incidents);
        } else if (Array.isArray(remoteData2025)) {
            allHistoricalIncidents = allHistoricalIncidents.concat(remoteData2025);
        }

        // (log removido)
        window.allHistoricalIncidents = allHistoricalIncidents; // Ensure global availability

        // Use 2026 data for crimes and demographics (most recent)
        crimeData = (remoteData2026 && remoteData2026.crimes) || {};
        normalizeCrimeData();
        demoData = (remoteData2026 && remoteData2026.demographics) || { men: 0, women: 0, minors: 0 };

        lastUpdateDate = (remoteData2026 && remoteData2026.lastUpdate) || new Date().toISOString();

        // Renderizar 2026 en el mapa directamente con datos ya en memoria (sin nuevo fetch)
        let currentYearIncidents = [];
        if (remoteData2026 && remoteData2026.incidents) currentYearIncidents = remoteData2026.incidents;
        else if (Array.isArray(remoteData2026)) currentYearIncidents = remoteData2026;

        if (currentYearIncidents.length > 0) {
            renderIncidentsPublic(currentYearIncidents);
            generateRecentCasesFeed(currentYearIncidents);
            generateAgeChart(currentYearIncidents);
            generateWeekDayChart(currentYearIncidents);
        }

        // Marcar boton 2026 como activo
        setTimeout(() => {
            document.querySelectorAll('.year-option-btn').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById('btn-2026');
            if (btn) btn.classList.add('active');
        }, 300);

        // Generate trend chart con datos historicos completos
        generateTrendChart(allHistoricalIncidents);

    } else {
        // (log removido)
        crimeData = {};
    }

    // 2. Setup Map Country
    const geojson = topojson.feature(topology, topology.objects.uruguay);
    geoJsonLayer = L.geoJson(geojson, {
        style: getStyle,
        onEachFeature: onEachFeature
    }).addTo(map);

    // 3. Setup Barrios Layer (Montevideo)
    if (barriosGeo) {
        barriosLayer = L.geoJson(barriosGeo, {
            style: getBarrioStyle,
            onEachFeature: function (feature, layer) {
                // Tooltip para barrios
                const name = feature.properties.nombre; // Nombre en mayusculas del geojson
                // Buscar cantidad real
                let count = 0;
                let realName = name;

                if (crimeData['Montevideo'] && crimeData['Montevideo'].barrios) {
                    const matchKey = Object.keys(crimeData['Montevideo'].barrios).find(k => normalizeStr(k) === normalizeStr(name));
                    if (matchKey) {
                        count = crimeData['Montevideo'].barrios[matchKey];
                        realName = matchKey; // Usar nombre bonito (Titular)
                    }
                }

                if (count > 0) {
                    layer.bindTooltip(`<strong>${realName}</strong><br>Crimenes: ${count}`, {
                        direction: 'center',
                        className: 'dept-label' // Reusing label style
                    });
                }
            }
        }).addTo(map);
    }

    // Initial fill for missing keys
    geojson.features.forEach(f => {
        const name = f.properties.NAME_1;
        if (!crimeData[name]) crimeData[name] = { total: 0, barrios: {} };
    });

    // 4. Update UI
    // La UI se actualiza dentro de renderIncidentsPublic / updateStatsHUD
})
    .catch(err => {
        console.warn("Critical Error loading data:", err);
    });

// === RENDER PUNTOS ESPECIFICOS PUBLICO ===
const incidentIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div class="blinking-marker"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    tooltipAnchor: [12, 0]
});

let incidentsLayer;

function renderIncidentsPublic(incidents) {
    if (!incidents) return;

    // Asegurar estructura de datos antes de pintar
    normalizeCrimeData();

    if (incidentsLayer) map.removeLayer(incidentsLayer);

    // Use MarkerClusterGroup for better performance and UX
    incidentsLayer = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 50,
        iconCreateFunction: function (cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            let c = ' marker-cluster-';

            if (count < 10) {
                size = 'small';
            } else if (count < 50) {
                size = 'medium';
            } else {
                size = 'large';
            }

            return new L.DivIcon({
                html: `<div class="cluster-inner"><span>${count}</span></div>`,
                className: 'marker-cluster' + c + size,
                iconSize: new L.Point(40, 40)
            });
        }
    });

    window.incidentsLayer = incidentsLayer; // Expose globally for filtering

    incidents.forEach((inc, index) => {
        const marker = L.marker([inc.lat, inc.lon], { icon: incidentIcon });

        // Click (Popup) - Now also Hover
        let popupContent = `
            <div style="text-align:center; min-width:200px; font-family:'Outfit',sans-serif;">
                <strong style="color:#ff4757; font-size:1.2em; text-transform:uppercase;">Reporte de Homicidio</strong>
                <hr style="border:0; border-top:1px solid #ddd; margin:5px 0;">
                <div style="font-size:1em; margin-bottom:5px;">📍 ${inc.address}</div>
                <div style="font-size:0.9em; color:#666; margin-bottom:5px;">📅 ${inc.date}</div>
                
                <div style="background:rgba(255, 71, 87, 0.1); padding:8px; border-radius:6px; margin:8px 0; text-align:left; font-size:0.9em;">
                    <div><strong>👤 Sexo:</strong> ${inc.gender || 'N/A'}</div>
                    <div><strong>🎂 Edad:</strong> ${inc.age || 'N/A'}</div>
                    <div><strong>🔫 Arma:</strong> ${inc.weapon || 'N/A'}</div>
                </div>
        `;

        if (inc.desc) {
            popupContent += `<div style="background:#f8f9fa; padding:8px; border-radius:4px; margin-top:8px; font-style:italic; color:#333;">
                "${inc.desc}"
            </div>`;
        }

        if (inc.source) {
            popupContent += `<div style="margin-top:8px; text-align:center;">
                <a href="${inc.source}" target="_blank" style="display:inline-flex; align-items:center; gap:5px; color:#3498db; text-decoration:none; font-weight:bold; font-size:0.85em; background:linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(41, 128, 185, 0.2)); padding:8px 15px; border-radius:20px; transition:all 0.3s; border: 1px solid rgba(52, 152, 219, 0.3);">
                    📰 Ver Noticia Completa
                </a>
            </div>`;
        }

        const shareLink = `${window.location.origin}${window.location.pathname}?incidente=${inc.id}`;
        popupContent += `<div style="margin-top:8px; text-align:center;">
                <button onclick="navigator.clipboard.writeText('${shareLink}'); alert('Enlace copiado al portapapeles');" style="background:transparent; border:1px solid #ddd; color:#555; padding:5px 10px; border-radius:15px; cursor:pointer; font-size:0.8em;">
                    🔗 Copiar Enlace
                </button>
            </div>`;

        popupContent += `</div>`;

        marker.bindPopup(popupContent, {
            closeButton: false,
            offset: [0, -10],
            className: inc.source ? 'popup-with-news' : ''
        });

        // Hover Effect with Delay (UX Friendly)
        let closeTimeout;

        marker.on('mouseover', function (e) {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }
            this.openPopup();
        });

        marker.on('mouseout', function (e) {
            closeTimeout = setTimeout(() => {
                this.closePopup();
            }, 3000); // 3 Segundos de gracia para ir al link
        });

        // Add entrance animation with staggered delay
        setTimeout(() => {
            incidentsLayer.addLayer(marker);
        }, index * 2); // 2ms delay between each marker for smooth animation
    });

    incidentsLayer.addTo(map);

    // Actualizar EstadÃ­sticas
    updateStatsHUD(incidents);

    // Actualizar Dashboard
    updateDashboard(incidents);
}

// --- DASHBOARD FUNCTIONS ---
let dashboardCharts = {
    topDepts: null,
    weapon: null,
    gender: null
};

window.toggleDashboard = function () {
    const panel = document.getElementById('dashboard-panel');
    panel.classList.toggle('collapsed');
}

function updateDashboard(incidents) {
    if (!incidents || incidents.length === 0) return;

    // Estadísticas Rápidas
    const dashTotalEl = document.getElementById('dash-total');
    if (dashTotalEl) dashTotalEl.textContent = incidents.length;

    const dashHistEl = document.getElementById('dash-historical');
    if (dashHistEl && window.allHistoricalIncidents) {
        dashHistEl.textContent = window.allHistoricalIncidents.length;
    }

    // Average per month (last 12 months)
    const monthsCount = 12;
    const avgPerMonth = (incidents.length / monthsCount).toFixed(1);
    const dashAvgEl = document.getElementById('dash-avg');
    if (dashAvgEl) dashAvgEl.textContent = avgPerMonth;

    // Most critical zone
    const deptCounts = {};
    incidents.forEach(inc => {
        const dept = inc.dept || 'Desconocido';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0];
    const dashCriticalEl = document.getElementById('dash-critical');
    if (dashCriticalEl) dashCriticalEl.textContent = topDept ? topDept[0] : '-';

    // Most violent day
    const dateCounts = {};
    incidents.forEach(inc => {
        if (inc.date) {
            dateCounts[inc.date] = (dateCounts[inc.date] || 0) + 1;
        }
    });
    const topDayEntry = Object.entries(dateCounts).sort((a, b) => b[1] - a[1])[0];
    const topDayEl = document.getElementById('dash-top-day');
    if (topDayEl) {
        if (topDayEntry) {
            try {
                const d = new Date(topDayEntry[0] + 'T12:00:00');
                const options = { day: 'numeric', month: 'short' };
                topDayEl.textContent = d.toLocaleDateString('es-ES', options).toUpperCase() + ` (${topDayEntry[1]})`;
            } catch (e) {
                topDayEl.textContent = topDayEntry[0] + ` (${topDayEntry[1]})`;
            }
        } else {
            topDayEl.textContent = '-';
        }
    }

    // Generate Charts
    generateTopDeptsChart(incidents);
    generateWeaponChart(incidents);
    generateGenderChart(incidents);

    generateRecentCasesFeed(incidents);
    generateAgeChart(incidents);
    generateWeekDayChart(incidents);

    // Ensure trend chart is also rendered/updated
    if (typeof allHistoricalIncidents !== 'undefined') {
        generateTrendChart(allHistoricalIncidents);
    }
}

function generateTopDeptsChart(incidents) {
    const ctx = document.getElementById('topDeptsChart');
    if (!ctx) return;

    // Count by department
    const deptCounts = {};
    incidents.forEach(inc => {
        const dept = inc.dept || 'Desconocido';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    // Get top 5
    const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sorted.map(x => x[0]);
    const data = sorted.map(x => x[1]);

    // Destroy previous chart
    if (dashboardCharts.topDepts) {
        dashboardCharts.topDepts.destroy();
    }

    dashboardCharts.topDepts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Casos',
                data: data,
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Convertir a barras horizontales para mejor lectura
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#888', font: { size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#eee', font: { size: 10, weight: '600' } },
                    grid: { display: false }
                }
            }
        }
    });
}

function generateWeaponChart(incidents) {
    const ctx = document.getElementById('weaponChart');
    if (!ctx) return;

    // Count by weapon
    const weaponCounts = {};
    incidents.forEach(inc => {
        let weapon = inc.weapon || 'No especificado';
        // Simplify weapon names
        const wUpper = weapon.toUpperCase();
        if (wUpper.includes('FUEGO')) weapon = 'Arma de Fuego';
        else if (wUpper.includes('PUNZANTE') || wUpper.includes('CORTO') || wUpper.includes('BLANCA')) weapon = 'Arma Blanca';
        else if (wUpper.includes('CONTUNDENTE')) weapon = 'Objeto Contundente';
        else if (weapon === '-' || weapon === '?' || wUpper === 'DESCONOCIDO') weapon = 'No especificado';

        weaponCounts[weapon] = (weaponCounts[weapon] || 0) + 1;
    });

    const labels = Object.keys(weaponCounts);
    const data = Object.values(weaponCounts);

    // Destroy previous chart
    if (dashboardCharts.weapon) {
        dashboardCharts.weapon.destroy();
    }

    dashboardCharts.weapon = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(255, 71, 87, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(201, 203, 207, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: currentTheme === 'light' ? '#333' : '#fff',
                        font: { size: 9 },
                        padding: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff'
                }
            }
        }
    });
}

function generateGenderChart(incidents) {
    const ctx = document.getElementById('genderChart');
    if (!ctx) return;

    // Count by gender
    let men = 0, women = 0, unknown = 0;
    incidents.forEach(inc => {
        const gender = (inc.gender || '').toLowerCase();
        if (gender.includes('hombre') || gender.includes('masculino')) men++;
        else if (gender.includes('mujer') || gender.includes('femenino')) women++;
        else unknown++;
    });

    // Destroy previous chart
    if (dashboardCharts.gender) {
        dashboardCharts.gender.destroy();
    }

    dashboardCharts.gender = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Hombres', 'Mujeres', 'Desconocido'],
            datasets: [{
                data: [men, women, unknown],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // Azul (Hombre)
                    'rgba(236, 72, 153, 0.8)', // Rosa (Mujer)
                    'rgba(156, 163, 175, 0.8)'  // Gris (Desconocido)
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: currentTheme === 'light' ? '#333' : '#fff',
                        font: { size: 9 },
                        padding: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff'
                }
            }
        }
    });
}


function updateStatsHUD(data) {
    if (!data) return;

    // 1. Count Departments & Gender
    const deptCounts = {};
    let men = 0;
    let women = 0;

    data.forEach(i => {
        // Dept Check
        const d = i.dept || 'Sin Clasificar';
        deptCounts[d] = (deptCounts[d] || 0) + 1;

        // Gender Check
        const g = (i.gender || '').toLowerCase();
        if (g === 'hombre') men++;
        else if (g === 'mujer') women++;
    });

    // 2. Render Dept Ranking (Top 5)
    const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const list = document.getElementById('dept-ranking');

    if (list) {
        list.innerHTML = '';
        if (sortedDepts.length === 0) {
            list.innerHTML = '<li style="color:#888; font-style:italic;">Sin datos.</li>';
        } else {
            sortedDepts.forEach(([name, count], index) => {
                list.innerHTML += `
                    <li style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span><strong style="color:#ffa502; margin-right:5px;">${index + 1}.</strong> ${name}</span>
                        <strong style="color:#fff;">${count}</strong>
                    </li>
                `;
            });
        }
    }

    // 3. Render Victims
    const menEl = document.getElementById('stat-men');
    const womenEl = document.getElementById('stat-women');
    const totalEl = document.getElementById('stat-total');

    if (menEl) menEl.innerText = men;
    if (womenEl) womenEl.innerText = women;
    if (totalEl) totalEl.innerText = data.length;

    // --- DAYS WITHOUT INCIDENTS LOGIC ---
    calculateDaysWithoutHomicides(data);
}

function calculateDaysWithoutHomicides(data) {
    const counterEl = document.getElementById('days-count');
    if (!counterEl) return;

    if (!data || data.length === 0) {
        counterEl.innerText = "-";
        return;
    }

    // Parse dates (Handle "YYYY-MM-DD")
    const validDates = data
        .map(i => i.date ? new Date(i.date + 'T00:00:00') : null)
        .filter(d => d && !isNaN(d));

    if (validDates.length === 0) {
        counterEl.innerText = "-";
        return;
    }

    // Get max date
    const lastDate = new Date(Math.max(...validDates));
    const now = new Date();

    // Normalize (strip time)
    lastDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffTime = now - lastDate;
    // Restamos 1 para contar dÃ­as COMPLETOS sin homicidios (ayer completo, etc)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) - 1;

    counterEl.innerText = diffDays >= 0 ? diffDays : 0;

    // Visual Feedback
    if (diffDays === 0) {
        counterEl.style.color = "#ff4757"; // Hoy hubo uno
    } else {
        counterEl.style.color = "#4ade80";
    }
}


// Listener for localStorage changes
// Listener for localStorage changes
window.addEventListener('storage', (e) => {
    if (e.key === 'uruguayCrimeData') {
        const newData = JSON.parse(e.newValue);
        // Normalizar al vuelo por si acaso
        for (let k in newData) {
            if (typeof newData[k] !== 'object') newData[k] = { total: newData[k], barrios: {} };
        }
        crimeData = newData;

        if (geoJsonLayer) geoJsonLayer.eachLayer(l => l.setStyle(getStyle(l.feature)));
        updateBarriosVisuals();
    }
});




// ===== SHARE FUNCTIONALITY =====
function openShareModal() {
    document.getElementById('share-modal').style.display = 'flex';
    setTimeout(generateMapPreview, 500); // Wait for modal animation logic if any
}

function closeShareModal() {
    document.getElementById('share-modal').style.display = 'none';
}

function generateMapPreview() {
    const previewImg = document.getElementById('preview-img');
    const previewText = document.getElementById('preview-text');

    // 1. Ocultar UI fija
    if (document.getElementById('settings-toggle')) document.getElementById('settings-toggle').style.display = 'none';
    if (document.getElementById('social-bar')) document.getElementById('social-bar').style.display = 'none';

    if (!screenshoter) {
        previewText.innerText = "Plugin Error";
        return;
    }

    // 2. TRUCO DE MEMORIA: Ocultar marcadores fuera de pantalla
    const bounds = map.getBounds();
    const offScreenLayers = [];

    map.eachLayer(layer => {
        // Solo ocultar marcadores puntuales, no polÃ­gonos grandes (barrios)
        if ((layer instanceof L.Marker || layer instanceof L.CircleMarker) && layer.getLatLng) {
            if (!bounds.contains(layer.getLatLng())) {
                if (layer._icon) { layer._icon.style.display = 'none'; offScreenLayers.push(layer._icon); }
                if (layer._shadow) { layer._shadow.style.display = 'none'; offScreenLayers.push(layer._shadow); }
                if (layer._path) { layer._path.style.display = 'none'; offScreenLayers.push(layer._path); }
            }
        }
    });

    // 3. Capturar
    screenshoter.takeScreen('blob', {
        mimeType: 'image/png'
    }).then(blob => {
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        previewImg.style.display = 'block';
        previewText.style.display = 'none';

        restoreUI(offScreenLayers);
    }).catch(e => {
        console.error('Error generando imagen:', e);
        previewText.innerText = 'Error memoria/canvas.';
        restoreUI(offScreenLayers);
    });

    function restoreUI(hiddenElements) {
        if (document.getElementById('settings-toggle')) document.getElementById('settings-toggle').style.display = 'flex';
        if (document.getElementById('social-bar')) document.getElementById('social-bar').style.display = 'flex';
        hiddenElements.forEach(el => el.style.display = '');
    }
}


function downloadMapImage() {
    const previewImg = document.getElementById('preview-img');
    if (previewImg.src && previewImg.src.startsWith('data:')) {
        const link = document.createElement('a');
        link.download = 'mapa-crimenes-uruguay.png';
        link.href = previewImg.src;
        link.click();
    } else {
        alert("Generando imagen... espera un momento.");
        // Try to generate again explicitly
        generateMapPreview();
    }
}

function shareSocial(network) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent("Mapa de Homicidios Uruguay - Datos Geolocalizados ðŸ‡ºðŸ‡¾");
    let shareUrl = "";

    switch (network) {
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${text} ${url}`;
            break;
    }

    if (shareUrl) window.open(shareUrl, '_blank');
}

// --- YEAR SELECTOR LOGIC ---
window.changeYear = function (year) {
    // 1. Update Buttons
    document.querySelectorAll('.year-option-btn').forEach(b => {
        b.classList.remove('active');
        b.removeAttribute('style'); // Removing inline styles to respect CSS classes
    });
    const activeBtn = document.getElementById('btn-' + year);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 2. Fetch Data
    // Use relative path if localhost, absolute if production
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? './' : 'https://homicidiosuy.com/';
    const bust = new Date().getTime();

    if (year === 'all') {
        // Load both years - show all on map AND chart
        Promise.all([
            fetch('data.json?nocache=' + bust).then(r => r.json()).catch(() => null),
            fetch('data_2025.json?nocache=' + bust).then(r => r.json()).catch(() => null)
        ]).then(([data2026, data2025]) => {
            let allIncidents = [];

            if (data2026 && data2026.incidents && Array.isArray(data2026.incidents)) {
                allIncidents = allIncidents.concat(data2026.incidents);
            }

            if (data2025 && data2025.incidents && Array.isArray(data2025.incidents)) {
                allIncidents = allIncidents.concat(data2025.incidents);
            }

            // (log removido)

            // Show all on map
            renderIncidentsPublic(allIncidents); generateRecentCasesFeed(allIncidents); generateAgeChart(allIncidents); generateWeekDayChart(allIncidents);

            // Chart with all data
            generateTrendChart(allIncidents);
        }).catch(e => console.error("Error loading all years:", e));
    } else {
        // Load single year - show only that year on map, but chart uses historical data
        const file = year === '2025' ? 'data_2025.json' : 'data.json';

        fetch(file + '?nocache=' + bust)
            .then(r => r.json())
            .then(data => {
                let incidents = [];

                // Unify structure
                if (data.incidents && Array.isArray(data.incidents)) {
                    incidents = data.incidents;
                } else if (data.crimes) {
                    // If it is the old structure
                } else if (Array.isArray(data)) {
                    incidents = data;
                } else {
                    // Try finding any array
                    Object.values(data).forEach(v => {
                        if (Array.isArray(v)) incidents = v;
                    });
                }

                // (log removido)

                // Render only selected year on map
                renderIncidentsPublic(incidents); generateRecentCasesFeed(incidents); generateAgeChart(incidents); generateWeekDayChart(incidents);

                // Chart SIEMPRE usa ambos años combinados
                const bust2 = new Date().getTime();
                Promise.all([
                    fetch('data.json?nocache=' + bust2).then(r => r.json()).catch(() => null),
                    fetch('data_2025.json?nocache=' + bust2).then(r => r.json()).catch(() => null)
                ]).then(([d2026, d2025]) => {
                    let hist = [];
                    if (d2026 && d2026.incidents) hist = hist.concat(d2026.incidents);
                    else if (Array.isArray(d2026)) hist = hist.concat(d2026);
                    if (d2025 && d2025.incidents) hist = hist.concat(d2025.incidents);
                    else if (Array.isArray(d2025)) hist = hist.concat(d2025);
                    allHistoricalIncidents = hist;
                    window.allHistoricalIncidents = hist;
                    generateTrendChart(hist.length > 0 ? hist : incidents);
                }).catch(() => generateTrendChart(incidents));
            })
            .catch(e => console.error("Error changing year:", e));
    }
}

// --- THEME TOGGLE (Dark/Light) ---
// Actualiza el color de las etiquetas de departamentos segun el tema
function applyThemeToLabels(theme) {
    const isLight = (theme || currentTheme) === 'light';
    document.querySelectorAll('.dept-label').forEach(el => {
        el.style.setProperty('color', isLight ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.7)', 'important');
        el.style.setProperty('text-shadow', isLight ? '0 1px 3px rgba(255,255,255,0.9)' : '0 0 3px #000', 'important');
    });
}

// Reaplicar en cada evento del mapa (Leaflet recrea tooltips al mover/zoom)
map.on('moveend zoomend viewreset', function() {
    applyThemeToLabels(currentTheme);
});

// Observar cambios en el DOM del tooltip-pane para atrapar creaciones nuevas
const tooltipObserver = new MutationObserver(function() {
    applyThemeToLabels(currentTheme);
});
// Esperar a que Leaflet cree el tooltip-pane
setTimeout(() => {
    const tooltipPane = document.querySelector('.leaflet-tooltip-pane');
    if (tooltipPane) {
        tooltipObserver.observe(tooltipPane, { childList: true, subtree: true });
        applyThemeToLabels(currentTheme);
    }
}, 1500);

window.toggleTheme = function () {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    if (currentTheme === 'dark') {
        // Switch to light
        currentTheme = 'light';
        map.removeLayer(darkTileLayer);
        map.addLayer(lightTileLayer);
        document.body.classList.add('light-theme');
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Modo Oscuro';
    } else {
        // Switch to dark
        currentTheme = 'dark';
        map.removeLayer(lightTileLayer);
        map.addLayer(darkTileLayer);
        document.body.classList.remove('light-theme');
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Modo Claro';
    }

    applyThemeToLabels(currentTheme);

    // Save preference
    localStorage.setItem('mapTheme', currentTheme);
}

// Initialize theme button on load
window.addEventListener('DOMContentLoaded', () => {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    if (currentTheme === 'light') {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Modo Oscuro';
    } else {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Modo Claro';
    }

    // Aplicar color correcto a las etiquetas del mapa segun tema guardado
    // Leaflet las crea despues del DOMContentLoaded, hay que esperar un poco
    setTimeout(() => applyThemeToLabels(currentTheme), 2000);
});




// --- DANGER ZONES ---
let dangerMode = false;

window.toggleDanger = function () {
    dangerMode = !dangerMode;
    const btn = document.getElementById('btn-danger');

    // Reset styles if turning off
    if (!dangerMode) {
        btn.style.background = 'transparent';
        btn.style.boxShadow = 'none';
        btn.style.border = 'none';
        btn.classList.remove('active');
        if (barriosLayer) barriosLayer.eachLayer(l => barriosLayer.resetStyle(l)); // Revert to default

        return;
    }

    // Turn On
    btn.classList.add('active'); // Maintain hover effect
    btn.style.background = 'rgba(255, 215, 0, 0.15)';
    btn.style.border = '1px solid #FFD700';

    // Load 2025 Data for calculation
    const bust = new Date().getTime();
    fetch('data_2025.json?nocache=' + bust)
        .then(r => r.json())
        .then(data => {
            let incidents = [];
            // Unify structure
            if (data.incidents && Array.isArray(data.incidents)) {
                incidents = data.incidents;
            } else if (data.crimes) {
                // If it is the old structure
            } else if (Array.isArray(data)) {
                incidents = data;
            } else {
                Object.values(data).forEach(v => {
                    if (Array.isArray(v)) incidents = v;
                });
            }

            // 1. Barrios (Montevideo Detailed)
            if (barriosLayer) {
                barriosLayer.eachLayer(layer => {
                    const count = countInFeature(layer.feature, incidents);

                    // Styling Thresholds (Based on 2025 density)
                    if (count >= 5) {
                        // High Danger (Red Transparent)
                        layer.setStyle({
                            fillColor: '#ff0000', // Red
                            fillOpacity: 0.4,
                            color: '#ff0000',
                            weight: 2
                        });
                    } else if (count >= 2) {
                        // Medium Warning (Yellow transparent)
                        layer.setStyle({
                            fillColor: '#FFFF00', // Pure Yellow
                            fillOpacity: 0.25,
                            color: '#f1c40f',
                            weight: 1
                        });
                    } else {
                        // Safe / Low
                        layer.setStyle({
                            fillOpacity: 0,
                            opacity: 0.1 // Fade out borders of safe zones to emphasize danger
                        });
                    }
                });
            }


        })
        .catch(e => console.error(e));
}

// Geospatial Helpers
function countInFeature(feature, incidents) {
    let count = 0;
    const geom = feature.geometry;
    let polys = []; // Array of rings (arrays of [lon,lat])

    if (geom.type === 'Polygon') {
        polys.push(geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(p => polys.push(p[0]));
    }

    incidents.forEach(inc => {
        const pt = [inc.lon, inc.lat];
        for (let poly of polys) {
            if (pointInPoly(pt, poly)) {
                count++;
                break;
            }
        }
    });
    return count;
}

function pointInPoly(pt, vs) {
    let x = pt[0], y = pt[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function resetMap() {
    const isMobile = window.innerWidth < 768;
    map.setView([-34.82, -56.16], isMobile ? 10.8 : 12, {
        animate: true,
        duration: 1
    });
}

// ===== TREND CHART GENERATION =====
let trendChartInstance = null;

// El dashboard-panel tiene z-index:2000 y crea un stacking context que bloquea
// los eventos del canvas hijo. La solucion: usar un overlay canvas fuera del DOM del panel.
function generateTrendChart(incidents) {
    // Siempre usar el historico combinado 2025+2026
    const globalHistory = window.allHistoricalIncidents || allHistoricalIncidents;
    if (globalHistory && globalHistory.length > 0) {
        incidents = globalHistory;
    }

    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const labels = [];
    const monthlyData = {};
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = monthNames[d.getMonth()] + ' ' + d.getFullYear().toString().slice(-2);
        labels.push(key);
        monthlyData[key] = 0;
    }

    if (incidents && incidents.length > 0) {
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setDate(today.getDate() - 365);
        incidents.forEach(inc => {
            if (!inc.date) return;
            const incDate = new Date(inc.date + 'T12:00:00');
            if (isNaN(incDate) || incDate < oneYearAgo || incDate > today) return;
            const key = monthNames[incDate.getMonth()] + ' ' + incDate.getFullYear().toString().slice(-2);
            if (monthlyData.hasOwnProperty(key)) monthlyData[key]++;
        });
    }

    const dataPoints = labels.map(l => monthlyData[l]);

    // ---- SOLUCION AL PROBLEMA DE EVENTOS BLOQUEADOS ----
    // El dashboard-panel tiene z-index:2000 y bloquea todos los eventos del canvas hijo.
    // Solución: crear un canvas FLOTANTE en el body, posicionado sobre el widget original.

    const originalCanvas = document.getElementById('trendChart');
    if (!originalCanvas) return;

    // Canvas flotante - fuera del stacking context del dashboard
    let floatCanvas = document.getElementById('trendChartFloat');
    if (!floatCanvas) {
        floatCanvas = document.createElement('canvas');
        floatCanvas.id = 'trendChartFloat';
        floatCanvas.style.cssText = 'position:fixed; z-index:99999; pointer-events:all; cursor:crosshair; border-radius:8px;';
        // Ocultar el canvas original para que no haya doble fondo
        originalCanvas.style.opacity = '0';
        document.body.appendChild(floatCanvas);

        // Sincronizar posicion y tamaño con el canvas original
        function syncCanvas() {
            const rect = originalCanvas.getBoundingClientRect();
            if (rect.width === 0) {
                floatCanvas.style.display = 'none'; // Ocultar si el panel esta cerrado
                return;
            }
            floatCanvas.style.display = 'block';
            floatCanvas.style.left   = rect.left + 'px';
            floatCanvas.style.top    = rect.top  + 'px';
            floatCanvas.style.width  = rect.width + 'px';
            floatCanvas.style.height = rect.height + 'px';
            // Solo redimensionar si cambio el tamanio (evita loop infinito)
            if (floatCanvas.width !== Math.round(rect.width) || floatCanvas.height !== Math.round(rect.height)) {
                floatCanvas.width  = Math.round(rect.width);
                floatCanvas.height = Math.round(rect.height);
                // Redibujar el chart al cambiar tamanio
                const ch = Chart.getChart(floatCanvas);
                if (ch) ch.resize();
            }
        }

        // Sincronizar en resize y scroll del dashboard
        window.addEventListener('resize', syncCanvas);
        const dash = document.getElementById('dashboard-panel');
        if (dash) dash.addEventListener('scroll', syncCanvas);

        // Sincronizar continuamente para capturar animaciones del panel
        setInterval(syncCanvas, 200);

        syncCanvas();
    }

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    if (typeof Chart === 'undefined') {
        console.error("Chart.js missing!");
        return;
    }

    trendChartInstance = new Chart(floatCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Casos',
                data: dataPoints,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 6,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            layout: { padding: { top: 5, right: 5 } },
            interaction: { mode: 'index', intersect: false, axis: 'x' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        title: function(items) { return items[0].label; },
                        label: function(item) { return 'Casos: ' + item.parsed.y; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 0, maxTicksLimit: 7 }
                },
                y: {
                    beginAtZero: true,
                    grace: '10%',
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    border: { display: false },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 9 },
                        stepSize: Math.max(1, Math.ceil(Math.max(...dataPoints) / 4))
                    }
                }
            }
        }
    });
}
// --- TOGGLE DASHBOARD LOGIC ---
window.toggleDashboard = function () {
    const panel = document.getElementById('dashboard-panel');
    const openBtn = document.getElementById('dashboard-open-btn');

    if (!panel || !openBtn) return;

    if (panel.classList.contains('closed')) {
        // OPEN IT
        panel.classList.remove('closed');
        openBtn.style.left = '-60px'; // Slide out
        setTimeout(() => openBtn.style.display = 'none', 300);
    } else {
        // CLOSE IT
        panel.classList.add('closed');
        openBtn.style.display = 'flex';
        // Force reflow
        void openBtn.offsetWidth;
        openBtn.style.left = '0'; // Slide in
    }
}

// --- MOBILE SWIPE & INIT LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Init (Auto Close)
    if (window.innerWidth <= 768) {
        const panel = document.getElementById('dashboard-panel');
        const openBtn = document.getElementById('dashboard-open-btn');
        if (panel) {
            panel.classList.add('closed');
            panel.style.touchAction = 'pan-y'; // Allow vertical scroll, capture horizontal
            // Ensure button is visible initially
            if (openBtn) {
                openBtn.style.display = 'flex';
                openBtn.style.left = '0';
            }
        }
    }

    // 2. Swipe Logic
    // 2. Interactive Swipe (Drag) Logic
    const panel = document.getElementById('dashboard-panel');
    const openBtn = document.getElementById('dashboard-open-btn');

    if (!panel) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let currentX = 0;
    let isDragging = false;

    // Start Drag
    panel.addEventListener('touchstart', e => {
        // Only if open
        if (panel.classList.contains('closed') || panel.classList.contains('collapsed')) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        currentX = touchStartX;
        isDragging = true;

        // Remove transition for instant follow
        panel.style.transition = 'none';
    }, { passive: true });

    panel.addEventListener('touchmove', e => {
        if (!isDragging) return;

        currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        const diffX = currentX - touchStartX;
        const diffY = currentY - touchStartY;

        // If moving mainly horizontally
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Prevent vertical cancel/scroll
            if (e.cancelable) e.preventDefault();

            // Only visually move if dragging left (closing)
            if (diffX < 0) {
                panel.style.transform = `translateX(${diffX}px)`;
            }
        }
    }, { passive: false });

    // End Drag
    panel.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;

        // Restore transition for smooth snap/close
        panel.style.transition = '';

        const diff = currentX - touchStartX;

        // Threshold to close (e.g. dragged more than 80px left)
        if (diff < -80) {
            // Close it
            // Clear manual transform so class takes over
            panel.style.transform = '';
            toggleDashboard();
        } else {
            // Bounce back to open
            panel.style.transform = '';
        }
    }, { passive: true });
});

/* ====== Recent Cases Widget Feed ====== */
function generateRecentCasesFeed(incidents) {
    const listContainer = document.getElementById('recent-cases-list');
    if (!listContainer) return;

    if (!incidents || incidents.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; opacity:0.5; padding:10px;">Sin datos</p>';
        return;
    }

    // Sort by date descending (Newest first)
    const sorted = [...incidents].sort((a, b) => {
        const dA = new Date(a.date || 0);
        const dB = new Date(b.date || 0);
        return dB - dA;
    });

    // Take Top 5
    const top5 = sorted.slice(0, 5);

    // Render
    let html = '';
    top5.forEach(inc => {
        let dateStr = inc.date;
        try {
            const d = new Date(inc.date + 'T12:00:00'); // Fix TZ issues
            if (!isNaN(d)) {
                const day = d.getDate();
                const month = d.toLocaleDateString('es-ES', { month: 'short' });
                dateStr = day + ' ' + month.charAt(0).toUpperCase() + month.slice(1);
            }
        } catch (e) { }

        // Truncate desc
        let desc = inc.desc || 'Sin descripción detallada';

        // Concatenation
        html += '<div class="recent-case-item" onclick="focusIncident(' + inc.lat + ', ' + inc.lon + ')" style="cursor:pointer;">' +
            '<div class="case-header">' +
            '<span class="case-date">' + dateStr + '</span>' +
            '<span class="case-dept">' + (inc.dept || 'Uruguay') + '</span>' +
            '</div>' +
            '<div class="case-desc">' + desc + '</div>' +
            '</div>';
    });

    listContainer.innerHTML = html;
}


/* ====== Age Chart ====== */
let ageChartInstance = null;

function generateAgeChart(incidents) {
    const ctx = document.getElementById('ageChart');
    if (!ctx) return;

    // Buckets
    let groups = {
        '0-17': 0,
        '18-29': 0,
        '30-49': 0,
        '50+': 0,
        'N/A': 0
    };

    incidents.forEach(inc => {
        let ageStr = String(inc.age || '').replace(/[^0-9]/g, '');
        let age = parseInt(ageStr);
        if (isNaN(age)) {
            groups['N/A']++;
        } else {
            if (age < 18) groups['0-17']++;
            else if (age < 30) groups['18-29']++;
            else if (age < 50) groups['30-49']++;
            else groups['50+']++;
        }
    });

    const labels = Object.keys(groups);
    const values = Object.values(groups);

    if (ageChartInstance) {
        ageChartInstance.destroy();
    }

    ageChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Víctimas',
                data: values,
                backgroundColor: [
                    '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#95a5a6'
                ],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#888', font: { family: 'Outfit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#888', font: { family: 'Outfit', size: 10 } }
                }
            }
        }
    });
}


/* ====== Week Day Chart ====== */
let weekDayChartInstance = null;

function generateWeekDayChart(incidents) {
    const ctx = document.getElementById('weekDayChart');
    if (!ctx) return;

    // Ordered Mon -> Sun
    let days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let counts = [0, 0, 0, 0, 0, 0, 0];

    incidents.forEach(inc => {
        try {
            const d = new Date(inc.date + 'T12:00:00');
            if (!isNaN(d)) {
                let dayIdx = d.getDay(); // 0=Sun, 1=Mon...
                // Map: 0(Sun)->6, 1(Mon)->0, etc.
                let mappedIdx = (dayIdx === 0) ? 6 : dayIdx - 1;
                if (counts[mappedIdx] !== undefined) counts[mappedIdx]++;
            }
        } catch (e) { }
    });

    if (weekDayChartInstance) weekDayChartInstance.destroy();

    weekDayChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Casos',
                data: counts,
                backgroundColor: 'rgba(255, 71, 87, 0.2)',
                borderColor: '#ff4757',
                borderWidth: 2,
                tension: 0.3, /* Smooth line */
                fill: true,
                pointBackgroundColor: '#fff',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#888', stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#888' }
                }
            }
        }
    });
}


// Auto-load default year (2026)
// El gráfico de tendencia se genera dentro del Promise.all principal
// No llamamos changeYear acá para evitar condición de carrera con los datos históricos
document.addEventListener('DOMContentLoaded', () => {
    // Marcar botón 2026 como activo visualmente (sin recargar datos)
    setTimeout(() => {
        document.querySelectorAll('.year-option-btn').forEach(b => b.classList.remove('active'));
        const btn2026 = document.getElementById('btn-2026');
        if (btn2026) btn2026.classList.add('active');
    }, 500);
});

/* ====== Focus Incident Helper (Smoother) ====== */
window.focusIncident = function (lat, lon) {
    if (!lat || !lon) return;

    // 1. Close Dashboard (Only on Mobile)
    if (window.innerWidth <= 768) {
        const panel = document.getElementById('dashboard-panel');
        if (panel && !panel.classList.contains('collapsed')) {
            toggleDashboard();
        }
    }

    // 2. Cinematic Fly
    // Fly with slower duration (2.5s) for smooth effect
    map.flyTo([lat, lon], 16, {
        animate: true,
        duration: 2.5
    });

    // 3. Open Popup when arrival
    map.once('moveend', function () {
        if (typeof incidentsLayer !== 'undefined') {
            incidentsLayer.eachLayer(layer => {
                const lLat = layer.getLatLng().lat;
                const lLon = layer.getLatLng().lng;
                if (Math.abs(lLat - lat) < 0.000001 && Math.abs(lLon - lon) < 0.000001) {
                    // Check if clustered
                    if (incidentsLayer.getVisibleParent(layer) !== layer) {
                        incidentsLayer.zoomToShowLayer(layer, () => layer.openPopup());
                    } else {
                        layer.openPopup();
                    }
                }
            });
        }
    });
}


/* ====== Redundant Initialization Removed (Consolidated at top) ====== */



// --- COMMUNITY PANEL TOGGLE ---
// --- COMMUNITY PANEL TOGGLE ---
window.toggleMapInteractions = function (enable) {
    // DESKTOP CHECK: Do not freeze map on desktop
    if (window.innerWidth > 768) return;

    const mapContainer = document.getElementById('map');
    // Ensure both exist
    if (!window.map || !mapContainer) return;

    if (enable) {
        // Re-enable interactions
        mapContainer.classList.remove('map-frozen');
        window.map.dragging.enable();
        window.map.touchZoom.enable();
        window.map.doubleClickZoom.enable();
        window.map.scrollWheelZoom.enable();
        window.map.boxZoom.enable();
        window.map.keyboard.enable();
        if (window.map.tap) window.map.tap.enable();
    } else {
        // Disable interactions completely via CSS + Leaflet
        mapContainer.classList.add('map-frozen');
        window.map.dragging.disable();
        window.map.touchZoom.disable();
        window.map.doubleClickZoom.disable();
        window.map.scrollWheelZoom.disable();
        window.map.boxZoom.disable();
        window.map.keyboard.disable();
        if (window.map.tap) window.map.tap.disable();
    }
};

// Modified to accept forceClose argument
window.toggleCommunity = function (forceClose) {
    const panel = document.getElementById('community-panel');
    const openBtn = document.getElementById('community-open-btn');
    const dashboard = document.getElementById('dashboard-panel');

    if (!panel) return;

    // Determine target state
    let isCurrentlyClosed = panel.classList.contains('closed');
    let action = '';

    if (forceClose === true) {
        action = 'close';
    } else if (forceClose === false) {
        action = 'open';
    } else {
        action = isCurrentlyClosed ? 'open' : 'close';
    }

    if (action === 'open') {
        // OPEN IT 
        if (!isCurrentlyClosed) return; // Already open

        panel.classList.remove('closed');

        // Freeze Map
        toggleMapInteractions(false);

        if (openBtn) {
            openBtn.style.right = '-60px'; // Slide out button
            setTimeout(() => openBtn.style.display = 'none', 300);
        }

        // Close Dashboard if open (especially on mobile to prevent overlap)
        if (window.innerWidth < 768 && dashboard && !dashboard.classList.contains('closed') && !dashboard.classList.contains('collapsed')) {
            if (typeof toggleDashboard === 'function') toggleDashboard();
        }

    } else {
        // CLOSE IT
        panel.classList.add('closed');

        // Unfreeze Map
        toggleMapInteractions(true);

        // Clear inline transforms (crucial for gesture reset)
        panel.style.transform = '';

        if (openBtn) {
            openBtn.style.display = 'flex';
            openBtn.style.transform = ''; // Reset any transforms
            setTimeout(() => {
                openBtn.style.right = '20px'; // Slide in
            }, 50);
        }
    }
};

/* ====== COMMUNITY PANEL SWIPE LOGIC ====== */
document.addEventListener('DOMContentLoaded', () => {
    // Mobile: Close Community Panel by default
    if (window.innerWidth <= 768) {
        const comPanel = document.getElementById('community-panel');
        if (comPanel) comPanel.classList.add('closed');
    }

    const comPanel = document.getElementById('community-panel');

    if (!comPanel) return;

    // Mobile Init for Community Panel
    if (window.innerWidth <= 768) {
        comPanel.style.touchAction = 'pan-y';
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let currentX = 0;
    let isDragging = false;

    // Start Drag
    comPanel.addEventListener('touchstart', e => {
        // Only if open (not closed)
        if (comPanel.classList.contains('closed')) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        currentX = touchStartX;
        isDragging = true;

        // Remove transition for instant follow
        comPanel.style.transition = 'none';
    }, { passive: true });

    // Dragging
    comPanel.addEventListener('touchmove', e => {
        if (!isDragging) return;

        currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        const diffX = currentX - touchStartX;
        const diffY = currentY - touchStartY;

        // Moving horizontally
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (e.cancelable) e.preventDefault();

            // Dragging RIGHT to close (diffX > 0)
            // Limit to 0 (cannot drag left into screen)
            if (diffX > 0) {
                comPanel.style.transform = 'translateX(' + diffX + 'px)';
            }
        }
    }, { passive: false });

    // End Drag
    comPanel.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;

        // Restore transition
        comPanel.style.transition = '';

        const diff = currentX - touchStartX;

        // Threshold to close (dragged right > 50px)
        if (diff > 50) {
            // Close it
            comPanel.style.transform = '';
            toggleCommunity(); // This will add .closed class
        } else {
            // Bounce back
            comPanel.style.transform = '';
        }
    }, { passive: true });
});

/* ====== REDISEÑO INLINE DE REPORTES (TIPO X) ====== */
document.addEventListener('DOMContentLoaded', () => {
    let checkInterval = setInterval(() => {
        if (window.openNewTopicModal && window.closeNewTopicModal) {
            clearInterval(checkInterval);
            initInlineReportForm();
        }
    }, 500);
});

function initInlineReportForm() {
    const originalOpen = window.openNewTopicModal;
    const originalClose = window.closeNewTopicModal;
    const modal = document.getElementById('new-topic-modal');

    if (!modal || !originalOpen || !originalClose) return;

    const innerForm = modal.querySelector('div');
    if (innerForm) {
        modal.classList.add('inline-report-mode');
        const style = document.createElement('style');
        style.innerHTML = `
            .inline-report-mode {
                position: relative !important;
                background: transparent !important;
                backdrop-filter: none !important; /* Quita el blur del popup */
                padding: 0 !important;
                height: auto !important;
                z-index: 10 !important;
            }
            .inline-report-mode > div {
                max-height: none !important;
                box-shadow: none !important;
                border: none !important;
                background: transparent !important;
                padding: 5px 0 !important;
                border-radius: 0 !important;
            }
            /* Ocultar el boton (X) de cerrar ya que el form sera inline */
            .inline-report-mode button[onclick="closeNewTopicModal()"] {
                display: none !important;
            }
            .inline-compose-cancel {
                background: transparent;
                border: 1px solid rgba(255,255,255,0.2);
                color: #cbd5e1;
                padding: 8px 15px;
                border-radius: 12px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
                margin-top: 8px;
                transition: background 0.2s;
            }
            .inline-compose-cancel:hover { background: rgba(255,255,255,0.1); }
            
            /* Ocultamos temporalmente el header para integrarlo mejor */
            .inline-report-mode h3 { font-size: 1.1rem !important; text-align: left !important; }
            .inline-report-mode p { text-align: left !important; }
        `;
        document.head.appendChild(style);

        // Agregamos boton de cancelar al final del form
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'inline-compose-cancel';
        cancelBtn.textContent = 'Cancelar / Cerrar';
        cancelBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.closeNewTopicModal();
        };
        innerForm.appendChild(cancelBtn);
    }

    // Interceptar Open
    window.openNewTopicModal = function(e) {
        if (e) e.stopPropagation();

        const isDesktop = window.innerWidth > 768;
        const container = isDesktop ? document.querySelector('.dx-compose') : document.querySelector('.x-compose-box');

        if (container && modal) {
            // Ocultar placeholders visuales del compose box
            Array.from(container.children).forEach(c => {
                if (c.id !== 'new-topic-modal') c.style.display = 'none';
            });
            
            // Mover el modal dentro del contenedor de feed activo
            container.appendChild(modal);
            container.style.cursor = 'default';
        }

        // Ejecutar el logico original (verifica si el usuario esta logueado, baneado, y muestra el form)
        originalOpen.apply(this, arguments);

        // Forzar flex pero sin posicion fija para que ocupe el espacio
        modal.style.display = 'flex';
    };

    // Interceptar Close
    window.closeNewTopicModal = function(e) {
        if (e) e.stopPropagation();

        // Ejecutar original (limpia campos y oculta el form)
        originalClose.apply(this, arguments);
        
        // Restaurar estado visual original del compose box
        const isDesktop = window.innerWidth > 768;
        const container = isDesktop ? document.querySelector('.dx-compose') : document.querySelector('.x-compose-box');
        
        if (container) {
            Array.from(container.children).forEach(c => {
                if (c.id !== 'new-topic-modal') {
                    c.style.display = '';
                }
            });
            container.style.cursor = 'pointer';
        }
        
        // Devolver el modal a un lugar seguro para no romper nada, o simplemente dejarlo donde está pero oculto
        modal.style.display = 'none';
    };
}

