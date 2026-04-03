/* Pixel War Logic - Standard JS (Fixed) */
// NO IMPORTS HERE, USES GLOBAL WINDOW OBJECT FROM firebase-logic-v2.js

let isPixelWarActive = false;
let selectedColor = '#ef4444';
let pixelWarLayer;
let tempPixelPreviewLayer;
let unsubscribePixels = null;
// const PIXEL_GRID_SIZE = 0.00015; // Grid Original
const PIXEL_GRID_SIZE = 0.00018; // Grid Ajustado

const PIXEL_COLORS = [
    '#ef4444', '#000000', '#ffffff', '#3b82f6', '#0ea5e9',
    '#ffff66', '#22c55e', '#86efac', '#a855f7', '#ec4899',
    '#78350f', '#f97316'
];

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error("Leaflet not loaded!");
        return;
    }

    pixelWarLayer = L.layerGroup();
    tempPixelPreviewLayer = L.layerGroup();

    checkLastPixelBtn();
});

// Main Toggle Function
window.togglePixelWar = function (active) {
    if (typeof window.db === 'undefined' || typeof window.setDoc === 'undefined') {
        alert("Firebase aún no ha cargado. Espera unos segundos e intenta nuevamente.");
        return;
    }

    isPixelWarActive = active;
    const ui = document.getElementById('pixel-war-ui');
    const selectors = [
        '#dashboard-panel', '#community-panel', '#days-counter-panel', '.floating-logo',
        '#dashboard-open-btn', '#community-open-btn', '.leaflet-control-zoom', '.leaflet-control-container'
    ];

    if (active) {
        // --- ANIMACIÓN DE SALIDA DE UI ---
        selectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
                // Forzar cierre de paneles específicos en móvil
                if (sel === '#community-panel') {
                    el.classList.add('closed'); // Usar la clase del tema
                }

                el.style.transition = 'opacity 0.8s ease';
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
                // Esperar a que termine la animación para ocultar del todo (opcional, pero mejor dejarlo invisible)
                setTimeout(() => { if (isPixelWarActive) el.style.display = 'none'; }, 800);
            }
        });

        // Mostrar UI del juego con Fade In
        ui.style.display = 'flex';
        ui.style.opacity = '0';

        // Mostrar Feed
        const feed = document.getElementById('pixel-feed');
        if (feed) {
            feed.style.display = 'block';
            feed.style.opacity = '0';
            requestAnimationFrame(() => {
                feed.style.transition = 'opacity 1s ease 1s'; // Delay extra
                feed.style.opacity = '1';
            });
        }

        requestAnimationFrame(() => {
            ui.style.transition = 'opacity 1.5s ease 0.5s'; // Delay pequeño
            ui.style.opacity = '1';
        });

        checkLastPixelBtn();

        // --- MODO CLARO ---
        document.body.classList.add('light-theme');
        if (typeof window.lightTileLayer !== 'undefined' && typeof window.map !== 'undefined') {
            if (window.darkTileLayer) window.map.removeLayer(window.darkTileLayer);
            window.lightTileLayer.addTo(window.map);
        } else {
            if (window.map) {
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '',
                    maxZoom: 19
                }).addTo(window.map);
            }
        }

        if (window.incidentsLayer && window.map.hasLayer(window.incidentsLayer)) {
            window.map.removeLayer(window.incidentsLayer);
        }

        pixelWarLayer.addTo(window.map);
        tempPixelPreviewLayer.addTo(window.map);
        window.map.on('click', onPixelMapClick);

        // --- ZOOM CINEMÁTICO SUAVE ---
        // Si el zoom está muy lejos (<13), hacemos un vuelo lento
        if (window.map.getZoom() < 13) {
            window.map.flyTo(window.map.getCenter(), 14, {
                animate: true,
                duration: 2.5, // 2.5 segundos de viaje
                easeLinearity: 0.25
            });
        }

        showToast("🎨 MODO MULTIPLAYER: ¡Haz click para pintar!", '#3b82f6');

        startListeningPixels();

    } else {
        location.reload();
    }
};

let pendingPixel = null;

function onPixelMapClick(e) {
    if (!isPixelWarActive) return;

    if (window.map.getZoom() < 16) {
        showToast("🔍 Acércate más para pintar con precisión");
        return;
    }

    const lat = Math.floor(e.latlng.lat / PIXEL_GRID_SIZE) * PIXEL_GRID_SIZE;
    const lng = Math.floor(e.latlng.lng / PIXEL_GRID_SIZE) * PIXEL_GRID_SIZE;

    if (tempPixelPreviewLayer.getLayers().length > 0) {
        tempPixelPreviewLayer.clearLayers();
        window.map.closePopup();
    }

    pendingPixel = { lat, lng };

    const buffer = PIXEL_GRID_SIZE * 0.1;
    const bounds = [[lat, lng], [lat + PIXEL_GRID_SIZE + buffer, lng + PIXEL_GRID_SIZE + buffer]];

    L.rectangle(bounds, {
        color: '#fff',
        weight: 2,
        fillOpacity: 0.5,
        fillColor: selectedColor,
        dashArray: '5, 5',
        className: 'pixel-preview-rect'
    }).addTo(tempPixelPreviewLayer);

    createPopup(e.latlng);
}

function createPopup(latlng) {
    const popupContent = document.createElement('div');
    popupContent.style.textAlign = 'center';
    popupContent.style.fontFamily = "'Outfit', sans-serif";
    popupContent.style.padding = '8px';
    popupContent.style.minWidth = '200px';

    const title = document.createElement('div');
    title.innerText = 'Elige Color y Pinta';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.color = '#333';
    popupContent.appendChild(title);

    const colorsDiv = document.createElement('div');
    colorsDiv.style.display = 'flex';
    colorsDiv.style.flexWrap = 'wrap';
    colorsDiv.style.gap = '8px';
    colorsDiv.style.justifyContent = 'center';
    colorsDiv.style.marginBottom = '15px';

    PIXEL_COLORS.forEach(color => {
        const btn = document.createElement('div');
        btn.style.width = '30px';
        btn.style.height = '30px';
        btn.style.backgroundColor = color;
        btn.style.borderRadius = '50%';
        btn.style.cursor = 'pointer';
        btn.style.border = '2px solid rgba(0,0,0,0.2)';
        btn.style.boxSizing = 'border-box';
        btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

        if (color === selectedColor) {
            btn.style.border = '3px solid #333';
            btn.style.transform = 'scale(1.1)';
        }

        btn.onclick = () => {
            selectedColor = color;
            Array.from(colorsDiv.children).forEach(b => {
                b.style.border = '2px solid rgba(0,0,0,0.2)';
                b.style.transform = 'scale(1)';
            });
            btn.style.border = '3px solid #333';
            btn.style.transform = 'scale(1.1)';

            tempPixelPreviewLayer.eachLayer(l => {
                l.setStyle({ fillColor: color, color: color });
            });
        };
        colorsDiv.appendChild(btn);
    });
    popupContent.appendChild(colorsDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '10px';
    actionsDiv.style.justifyContent = 'center';

    const btnConfirm = document.createElement('button');
    btnConfirm.innerText = 'PINTAR';
    btnConfirm.style.background = '#22c55e';
    btnConfirm.style.color = 'white';
    btnConfirm.style.border = 'none';
    btnConfirm.style.padding = '8px 20px';
    btnConfirm.style.borderRadius = '8px';
    btnConfirm.style.cursor = 'pointer';
    btnConfirm.style.fontWeight = 'bold';
    btnConfirm.onclick = window.confirmPixel;
    actionsDiv.appendChild(btnConfirm);

    const btnCancel = document.createElement('button');
    btnCancel.innerText = 'Cancelar';
    btnCancel.style.background = '#ef4444';
    btnCancel.style.color = 'white';
    btnCancel.style.border = 'none';
    btnCancel.style.padding = '8px 15px';
    btnCancel.style.borderRadius = '8px';
    btnCancel.style.cursor = 'pointer';
    btnCancel.onclick = window.cancelPixel;
    actionsDiv.appendChild(btnCancel);

    popupContent.appendChild(actionsDiv);

    L.popup({ closeButton: false, offset: [0, -10], maxWidth: 250 })
        .setLatLng(latlng)
        .setContent(popupContent)
        .openOn(window.map);
}

window.confirmPixel = async function () {
    if (!pendingPixel) return;

    // 1. VALIDACIÓN DE SEGURIDAD
    const user = window.auth ? window.auth.currentUser : null;

    // Si no hay usuario o es anónimo (invitado)
    if (!user || (user.isAnonymous && user.providerData.length === 0)) {
        showToast("⛔ Debes iniciar sesión con Google para pintar", '#ef4444');
        window.map.closePopup();
        tempPixelPreviewLayer.clearLayers();
        pendingPixel = null;
        return;
    }

    // 2. CHECK COOLDOWN (Server Side Logic via Firestore)
    let finalAlias = 'Anónimo';
    let lastTime = 0;
    const userDocRef = window.doc(window.db, "users", user.uid);

    try {
        const userSnap = await window.getDoc(userDocRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            finalAlias = userData.alias || 'Anónimo';
            if (userData.lastPixelTime) {
                // lastPixelTime es un Timestamp de Firestore
                lastTime = userData.lastPixelTime.toMillis ? userData.lastPixelTime.toMillis() : 0;
            }
        }
    } catch (err) {
        console.warn("Error fetching user data/cooldown:", err);
    }

    const now = Date.now();
    const diff = now - lastTime;
    const cooldownMs = 300000; // 5 minutos exactos

    if (diff < cooldownMs) {
        const minutesLeft = Math.ceil((cooldownMs - diff) / 60000);
        const secondsLeft = Math.ceil(((cooldownMs - diff) % 60000) / 1000);
        showToast(`⏳ Espera ${minutesLeft}m ${secondsLeft}s para pintar de nuevo`, '#f59e0b');
        return; // Bloqueado por Cooldown
    }

    // 3. PREPARAR DATOS
    const pid = `${pendingPixel.lat.toFixed(5)}_${pendingPixel.lng.toFixed(5)}`.replace(/\./g, '_');

    // 4. LIMPIAR UI
    window.map.closePopup();
    tempPixelPreviewLayer.clearLayers();

    // 5. GUARDAR Y ACTUALIZAR COOLDOWN
    try {
        // A. Guardar Píxel
        const pixelPromise = window.setDoc(window.doc(window.db, "pixels", pid), {
            lat: pendingPixel ? pendingPixel.lat : 0,
            lng: pendingPixel ? pendingPixel.lng : 0,
            color: selectedColor,
            author: user.uid,
            authorAlias: finalAlias,
            updatedAt: window.serverTimestamp()
        });

        // B. Actualizar Usuario con nuevo tiempo
        const userPromise = window.setDoc(userDocRef, {
            lastPixelTime: window.serverTimestamp()
        }, { merge: true });

        await Promise.all([pixelPromise, userPromise]);

        // Guardamos copia local solo como caché visual
        savePixelLocal(pendingPixel ? pendingPixel.lat : 0, pendingPixel ? pendingPixel.lng : 0, selectedColor);
        showToast("🎨 ¡Píxel guardado! (+5 min cooldown)", '#22c55e');

    } catch (e) {
        console.error("Error Saving Pixel:", e);
        let errorMsg = "❌ Error desconocido";
        if (e.code === 'permission-denied') errorMsg = "⛔ Error de permisos";
        else if (e.code === 'unavailable') errorMsg = "📡 Sin conexión a internet";
        else errorMsg = `❌ Error: ${e.code || e.message}`;
        showToast(errorMsg, '#ef4444');
    }

    pendingPixel = null;
    checkLastPixelBtn();
};

window.cancelPixel = function () {
    window.map.closePopup();
    tempPixelPreviewLayer.clearLayers();
    pendingPixel = null;
};

function startListeningPixels() {
    if (unsubscribePixels) unsubscribePixels();

    // Listening via Global Window Logic
    unsubscribePixels = window.onSnapshot(window.collection(window.db, "pixels"), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            if (change.type === "added" || change.type === "modified") {
                placePixelWrapper(data.lat, data.lng, data.color);

                // Actualizar Feed (SOLO SI ES RECIENTE, EVITAR SPAM AL CARGAR)
                // Usamos un pequeño hack: si la fecha del píxel es < 30 seg, lo mostramos.
                // Si cargamos todo el mapa histórico, no queremos llenar el feed.
                const now = Date.now();
                const pixelTime = data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : now) : now; // Fallback

                if (now - pixelTime < 30000) {
                    updatePixelFeed(data.authorAlias || 'Anónimo', data.color, data.lat, data.lng);
                }
            }
        });
    });
}

function updatePixelFeed(alias, color, lat, lng) {
    const list = document.getElementById('pixel-feed-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'pixel-feed-item';

    // Icono Color
    const dot = document.createElement('div');
    dot.className = 'pixel-feed-dot';
    dot.style.backgroundColor = color;

    // Texto con Nick Enmascarado para Privacidad
    const maskedAlias = alias.length > 1 ? alias[0] + '*'.repeat(Math.min(alias.length - 1, 3)) : alias;
    const text = document.createElement('span');
    text.innerHTML = `<b>${maskedAlias}</b> pintó en el mapa`;

    // Botón chiquito para ir (opcional)
    item.onclick = () => {
        if (window.map) window.map.flyTo([lat, lng], 18);
    };
    item.style.cursor = 'pointer';
    item.title = "Ir al píxel";

    item.appendChild(dot);
    item.appendChild(text);

    // Insertar al principio
    list.insertBefore(item, list.firstChild);

    // Limitar a 5 items
    while (list.children.length > 5) {
        list.removeChild(list.lastChild);
    }
}

window.goToLastPixel = function () {
    const pixels = JSON.parse(localStorage.getItem('pixelWarData') || '[]');
    if (pixels.length > 0) {
        const last = pixels[pixels.length - 1];
        if (window.map && last.lat && last.lng) {
            window.map.flyTo([last.lat, last.lng], 18, { animate: true, duration: 1.5 });
            showToast("🚀 Volando a tu último píxel...");
        }
    } else {
        showToast("❌ No has pintado ningún píxel aún");
    }
};

function checkLastPixelBtn() {
    const btn = document.getElementById('btn-last-pixel');
    if (!btn) return;

    // Check Auth
    const user = window.auth ? window.auth.currentUser : null;
    if (!user || user.isAnonymous) {
        btn.style.display = 'none';
        return;
    }

    const pixels = JSON.parse(localStorage.getItem('pixelWarData') || '[]');
    btn.style.display = pixels.length > 0 ? 'block' : 'none';
}

function placePixelWrapper(lat, lng, color) {
    const buffer = PIXEL_GRID_SIZE * 0.1;
    const bounds = [[lat, lng], [lat + PIXEL_GRID_SIZE + buffer, lng + PIXEL_GRID_SIZE + buffer]];

    L.rectangle(bounds, {
        color: color,
        weight: 0,
        stroke: false,
        fillOpacity: 1,
        fillColor: color,
        className: 'pixel-rect',
        interactive: false // EL MAPA DEBE SER CLICKABLE, NO EL PÍXEL
    }).addTo(pixelWarLayer);
}

function savePixelLocal(lat, lng, color) {
    let pixels = JSON.parse(localStorage.getItem('pixelWarData') || '[]');
    pixels.push({ lat, lng, color });
    if (pixels.length > 2000) pixels = pixels.slice(-2000);
    localStorage.setItem('pixelWarData', JSON.stringify(pixels));
}

function showToast(msg, bg) {
    const existing = document.getElementById('pixel-toast');
    if (existing) existing.remove();

    let toast = document.createElement('div');
    toast.id = 'pixel-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '150px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = bg || 'rgba(0,0,0,0.85)';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '30px';
    toast.style.zIndex = '100000';
    toast.style.fontFamily = "'Outfit', sans-serif";
    toast.style.fontSize = '0.9rem';
    toast.style.animation = 'fadeIn 0.3s';
    toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
    toast.style.pointerEvents = 'none';

    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2500);
}

/* ---FIX: MAP UNFREEZER WATCHDOG --- */
/* Monitors the map container and immediately removes the 'map-frozen' class if added by any other script. */
(function () {
    const mapNode = document.getElementById('map');
    if (mapNode) {
        // 1. Initial Cleanup
        mapNode.classList.remove('map-frozen');

        // 2. Continuous Watchdog
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (mapNode.classList.contains('map-frozen')) {
                        console.warn('❄️ Map freeze attempt detected! Unfreezing immediately.');
                        mapNode.classList.remove('map-frozen');
                    }
                }
            });
        });

        observer.observe(mapNode, { attributes: true });
        console.log('🛡️ Map Unfreezer Guard active');
    }
})();
