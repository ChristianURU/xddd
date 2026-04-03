
// ====== MARKER CATEGORY TOGGLE FILTER ======

// Inicialmente todo visible (INCLUYENDO HOMICIDIOS)
if (!window.visibleCategories) {
    window.visibleCategories = new Set(['homicidios', 'alerta', 'denuncia', 'residuos', 'consulta']);
}

// Inicializar botones al cargar
document.addEventListener('DOMContentLoaded', () => {
    const categories = ['homicidios', 'alerta', 'denuncia', 'residuos', 'consulta'];
    categories.forEach(cat => {
        const btn = document.getElementById(`filter-${cat}`);
        if (btn) {
            if (window.visibleCategories.has(cat)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });

    // Re-sync inicial después de un momento para que Firebase cargue marcadores
    setTimeout(() => {
        if (typeof window.updateMap === 'function') window.updateMap();
    }, 2000);
});

window.filterByCategory = (category) => {
    console.log(`[Filter] Toggling: ${category}`);

    // Asegurar que los botones estén sincronizados al menos una vez
    const categories = ['homicidios', 'alerta', 'denuncia', 'residuos', 'consulta'];
    categories.forEach(cat => {
        const b = document.getElementById(`filter-${cat}`);
        if (b) {
            if (window.visibleCategories.has(cat)) b.classList.add('active');
            else b.classList.remove('active');
        }
    });

    const btn = document.getElementById(`filter-${category}`);
    if (!btn) return;

    if (window.visibleCategories.has(category)) {
        // Estaba visible -> OCULTAR
        window.visibleCategories.delete(category);
        btn.classList.remove('active');
    } else {
        // Estaba oculto -> MOSTRAR
        window.visibleCategories.add(category);
        btn.classList.add('active');
    }

    // Aplicar al mapa
    updateMap();
};

function updateMap() {
    // 1. Manejar Homicidios (Capa aparte)
    if (window.incidentsLayer && window.map) {
        if (window.visibleCategories.has('homicidios')) {
            if (!window.map.hasLayer(window.incidentsLayer)) {
                window.map.addLayer(window.incidentsLayer);
            }
        } else {
            if (window.map.hasLayer(window.incidentsLayer)) {
                window.map.removeLayer(window.incidentsLayer);
            }
        }
    }

    // 2. Manage Community Markers
    if (!window.alertMarkers || !window.map) return;

    const keys = Object.keys(window.alertMarkers);

    keys.forEach(id => {
        try {
            const item = window.alertMarkers[id];
            if (!item || !item.marker) return;

            // TRUST the normalized category
            let markerCat = (item.category || 'alerta').toLowerCase().trim();

            // Safety Aliases (Handle Plurals)
            if (markerCat === 'alertas' || markerCat === 'peligro') markerCat = 'alerta';
            if (markerCat === 'denuncias' || markerCat === 'quejas') markerCat = 'denuncia';
            if (markerCat === 'consultas' || markerCat === 'preguntas') markerCat = 'consulta';
            if (markerCat === 'residuos' || markerCat === 'basura') markerCat = 'residuos';

            const isVisible = window.visibleCategories.has(markerCat);

            if (isVisible) {
                if (!window.map.hasLayer(item.marker)) {
                    window.map.addLayer(item.marker);
                }
            } else {
                if (window.map.hasLayer(item.marker)) {
                    window.map.removeLayer(item.marker);
                }
            }
        } catch (e) {
            console.warn("Error toggling marker " + id, e);
        }
    });
}

// Exponer globalmente
window.updateMap = updateMap;
window.refreshFilters = updateMap;
