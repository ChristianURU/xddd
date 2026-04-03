/* ====== LOCATION PICKER LOGIC ====== */

window.startLocationPicker = function () {
    // MOBILE: Switch to MAP view to see where we are picking
    if (typeof window.switchXTab === 'function') {
        window.switchXTab('mapa');
        setTimeout(() => { if (window.map) window.map.invalidateSize(); }, 300);
    }

    // 0. Check and toggle Feed Mode if expanded
    if (window.isFeedExpanded) {
        window.wasFeedExpandedBeforePicker = true;
        window.toggleFeedMode(); // Minimize
    } else {
        window.wasFeedExpandedBeforePicker = false;
    }

    // 1. Hide modal visually
    const modal = document.getElementById('new-topic-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.zIndex = '1000';
    }

    // 2. Show Overlay
    const overlay = document.getElementById('location-picker-ui');
    if (overlay) overlay.style.display = 'block';

    // Hide bottom bar to see confirm button
    const bottomBar = document.getElementById('mobile-bottom-bar');
    if (bottomBar) bottomBar.style.display = 'none';

    // 3. Close community panel to clear view
    const panel = document.getElementById('community-panel');
    if (panel && !panel.classList.contains('closed')) {
        // Obtenemos la función global
        if (typeof window.toggleCommunity === 'function') {
            window.toggleCommunity();
        } else {
            panel.classList.add('closed');
        }
    }

    updatePickerCoords();
    if (window.map) {
        window.map.on('move', updatePickerCoords);
    }
}

window.cancelLocationPicker = function () {
    // Hide Overlay
    const overlay = document.getElementById('location-picker-ui');
    if (overlay) overlay.style.display = 'none';

    // 1. Community Panel should remain CLOSED because we are going back to New Topic Modal
    // (It will only open after publishing)
    const panel = document.getElementById('community-panel');
    if (panel && !panel.classList.contains('closed')) {
        // Ensure it stays closed if somehow it opened
        if (typeof window.toggleCommunity === 'function') {
            window.toggleCommunity(true);
        } else {
            panel.classList.add('closed');
        }
    }

    // 2. Restore modal and bring it to front
    // Importante: Al estar fuera del panel de comunidad en el HTML, 
    // ahora aparecerá independientemente de si el panel terminó de abrirse o no.
    // Restore bottom bar
    const bottomBar = document.getElementById('mobile-bottom-bar');
    if (bottomBar) bottomBar.style.display = '';

    // Restore modal
    const modal = document.getElementById('new-topic-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '9000';
    }

    // 3. Restore Feed Mode if it was expanded
    if (window.wasFeedExpandedBeforePicker) {
        if (!window.isFeedExpanded) {
            window.toggleFeedMode(); // Restore Maximize
        }
        window.wasFeedExpandedBeforePicker = false;
    }

    // Remove listener
    if (window.map) window.map.off('move', updatePickerCoords);
}

window.confirmLocationPicker = function () {
    try {
        if (!window.map) {
            alert('Error: El mapa no está listo.');
            return cancelLocationPicker();
        }

        const center = window.map.getCenter();
        const lat = center.lat;
        const lng = center.lng;

        // Update hidden inputs
        const latInput = document.getElementById('topic-lat');
        const lngInput = document.getElementById('topic-lng');
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lng;

        // Update status text
        const status = document.getElementById('location-status');
        if (status) {
            status.textContent = '📍 Ubicación: ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
            status.style.color = '#4ade80';
        }

        // Fill address
        attemptReverseGeocoding(lat, lng);

        // Return to modal (Cancel logic handles restoring modal and feed)
        cancelLocationPicker();

    } catch (e) {
        console.error(e);
        cancelLocationPicker();
    }
}

function updatePickerCoords() {
    if (!window.map) return;
    const center = window.map.getCenter();
    const el = document.getElementById('picker-coords');
    if (el) el.textContent = center.lat.toFixed(5) + ', ' + center.lng.toFixed(5);
}

async function attemptReverseGeocoding(lat, lng) {
    try {
        const addressInput = document.getElementById('topic-address-input');
        if (addressInput) addressInput.placeholder = 'Buscando dirección...';

        // Usamos Photon (Komoot) que es más permisivo con CORS y gratuito basado en OSM
        // Nota: Photon usa 'lon' en lugar de 'lng'
        const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`);
        const data = await res.json();

        if (data && data.features && data.features.length > 0) {
            const prop = data.features[0].properties;
            // Construimos una dirección legible
            let addr = [];

            // Prioridad a la calle
            if (prop.street) {
                addr.push(prop.street + (prop.housenumber ? " " + prop.housenumber : ""));
            } else if (prop.name) {
                addr.push(prop.name);
            }

            if (prop.district) addr.push(prop.district);
            if (prop.city) addr.push(prop.city);
            if (addr.length === 0 && prop.country) addr.push(prop.country);

            const finalAddr = addr.join(', ');

            if (addressInput && finalAddr) {
                addressInput.value = finalAddr;
            } else if (addressInput) {
                addressInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            }
        } else {
            if (addressInput) addressInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    } catch (e) {
        console.error('Reverse geocoding failed:', e);
        // Fallback a coordenadas si falla la API
        const addressInput = document.getElementById('topic-address-input');
        if (addressInput) addressInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}

// --- GEOCODING SEARCH (Address -> Coords) ---

function initAddressSearch() {
    const input = document.getElementById('topic-address-input');
    if (!input) {
        // Retry a bit later (modal might not be ready)
        setTimeout(initAddressSearch, 1000);
        return;
    }

    // Debounce timer
    let debounceTimer;

    // Listen for input changes (typing)
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchAddress(input.value);
        }, 1000); // Wait 1s after typing stops
    });

    console.log("🔍 Buscador de direcciones activado");
}

async function searchAddress(query) {
    if (!query || query.length < 5) return;

    // Si parece coordenadas (numeros, coma, punto), ignorar búsqueda de calle
    if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(query)) {
        return;
    }

    const status = document.getElementById('location-status');
    if (status) {
        status.textContent = '🔍 Buscando...';
        status.style.color = '#fbbf24';
    }

    try {
        // Bias towards Uruguay/Montevideo (-34.9, -56.1)
        // Photon API is free and fast
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lat=-34.9&lon=-56.1&lang=es`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.features && data.features.length > 0) {
            const coords = data.features[0].geometry.coordinates; // [lon, lat]
            const lon = coords[0];
            const lat = coords[1];

            // Log for debug
            console.log("📍 Lugar encontrado:", data.features[0].properties.name, lat, lon);

            // Update Logic
            const latInput = document.getElementById('topic-lat');
            const lngInput = document.getElementById('topic-lng');

            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lon;

            if (status) {
                status.textContent = '✅ Ubicación encontrada';
                status.style.color = '#4ade80';
            }

            // Move Map if available (visual confirmation)
            if (window.map) {
                window.map.flyTo([lat, lon], 16, { duration: 1.5 });
                // Add temporary marker
                L.marker([lat, lon]).addTo(window.map).bindPopup("📍 " + query).openPopup();
            }

        } else {
            if (status) {
                status.textContent = '❌ Dirección no encontrada';
                status.style.color = '#ef4444';
            }
        }
    } catch (e) {
        console.error("Geocoding error:", e);
        if (status) status.textContent = '⚠️ Error de conexión';
    }
}

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAddressSearch, 1000); // Delay to ensure modal HTML exists
});
