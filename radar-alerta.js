/**
 * 🛰️ Radar de Alertas x Proximidad (VERSIÓN AUTO-DETECT)
 */

let userLocation = null;
const RADAR_RADIUS_KM = 1.2;
const notifiedAlerts = new Set();
// Cargar alertas ya notificadas esta sesión desde localStorage (opcional)
// Pero mejor mantenerlo en memoria para que al reabrir avise de nuevo si sigue ahí.

function getDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function sendAlertNotification(topic, isTest = false) {
    if (!window.Capacitor || !window.Capacitor.Plugins) return;
    const plugins = window.Capacitor.Plugins;
    const Notif = plugins.LocalNotifications;

    if (!Notif) return;

    if (!isTest && (!topic || notifiedAlerts.has(topic.id))) return;
    if (!isTest) notifiedAlerts.add(topic.id);

    try {
        // En Capacitor, para que se vea con la app abierta (Foreground), 
        // a veces hay que usar un canal con importancia ALTA.
        await Notif.schedule({
            notifications: [
                {
                    title: isTest ? '🛰️ Radar Online' : '🚨 PELIGRO CERCA',
                    body: isTest ? 'El sistema de seguridad está vigilando tu zona.' : `${topic ? topic.title : 'Alerta detectada'} - A menos de 1.2km`,
                    id: isTest ? 999 : Math.floor(Math.random() * 1000000),
                    schedule: { at: new Date(Date.now() + 100) },
                    sound: 'default',
                    channelId: 'radar-alerts',
                    actionTypeId: 'OPEN_TOPIC',
                    extra: { topicId: topic ? topic.id : 'test' },
                    importance: 5 // HIGH importance for foreground visibility
                }
            ]
        });
        console.log(`[Radar] Notificación enviada para ${topic ? topic.id : 'Test'}`);
    } catch (e) {
        console.error("Error scheduling notification", e);
    }
}

async function initRadar() {
    if (!window.Capacitor) {
        console.log("Capacitor no disponible.");
        return;
    }

    const plugins = window.Capacitor.Plugins;
    if (!plugins) return;

    try {
        // Verificar qué plugins tenemos (DEBUG)
        const availablePlugins = Object.keys(plugins).join(", ");
        console.log("Plugins disponibles:", availablePlugins);

        const Geo = plugins.Geolocation;
        const Notif = plugins.LocalNotifications;

        if (!Geo || !Notif) {
            console.warn("Plugins Geolocation o LocalNotifications no encontrados.");
            return;
        }

        // 1. Crear CANAL (Android)
        try {
            await Notif.createChannel({
                id: 'radar-alerts',
                name: 'Alertas de Seguridad',
                importance: 5,
                sound: 'default',
                vibration: true
            });
        } catch (e) { }

        // 2. Notificación de prueba TEST (Radar Online)
        // Intentar inmediatamente si ya tenemos permiso
        setTimeout(async () => {
            const perm = await Notif.checkPermissions();
            if (perm.display === 'granted') {
                sendAlertNotification(null, true);
            } else {
                const req = await Notif.requestPermissions();
                if (req.display === 'granted') sendAlertNotification(null, true);
            }
        }, 1000);

        // 3. Permisos GPS
        const geoP = await Geo.requestPermissions();
        if (geoP.location !== 'granted') {
            console.warn("🚫 GPS sin permisos.");
            return;
        }

        // 4. Iniciar Vigilancia
        console.log("🛰️ Vigilancia Radar Activa.");

        // Obtener Posición Inicial
        Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 }).then(pos => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (typeof window.reportUserLocation === 'function') {
                window.reportUserLocation(userLocation.lat, userLocation.lng);
            }
            if (window.alertMarkers) checkAllNearbyAlerts();
        }).catch(() => console.log("⏳ GPS inicial lento o fallido."));

        // Watch continuo
        Geo.watchPosition({ enableHighAccuracy: true, distanceFilter: 30 }, (pos) => {
            if (pos && pos.coords) {
                userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                checkAllNearbyAlerts();
            }
        });

        window.radarEnabled = true;
    } catch (err) {
        console.error("❌ Error en initRadar:", err);
    }
}

// Función manual para probar desde la consola o botones
window.testRadarNotification = () => {
    console.log("🛠️ Lanzando prueba manual de Radar...");
    sendAlertNotification(null, true);
};

function checkAllNearbyAlerts() {
    if (!userLocation || !window.alertMarkers) return;
    Object.keys(window.alertMarkers).forEach(id => {
        const markerObj = window.alertMarkers[id];
        if (markerObj && markerObj.data && markerObj.category === 'alerta') {
            window.checkProximityAndNotify({ ...markerObj.data, id: id });
        }
    });
}

window.initRadar = initRadar;
window.checkProximityAndNotify = (topic) => {
    if (!userLocation || !topic.lat || !topic.lng) return;

    // Normalizar categoría: aceptamos 'alerta', 'homicidio' (para alertar de nuevos casos oficiales también)
    const category = (topic.category || '').toLowerCase();
    const isAlerta = category.includes('alerta');
    const isHomicidio = category.includes('homicidio');

    if (!isAlerta && !isHomicidio) return;

    const tLat = parseFloat(topic.lat);
    const tLng = parseFloat(topic.lng);
    const uLat = parseFloat(userLocation.lat);
    const uLng = parseFloat(userLocation.lng);

    if (isNaN(tLat) || isNaN(tLng) || isNaN(uLat) || isNaN(uLng)) return;

    const dist = getDistanceKM(uLat, uLng, tLat, tLng);
    console.log(`[Radar] Topic ${topic.id} (${category}) dist: ${dist.toFixed(3)}km`);

    if (dist <= RADAR_RADIUS_KM) {
        sendAlertNotification(topic);
    }
};

// Configurar comportamiento en Foreground para Capacitor
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    window.Capacitor.Plugins.LocalNotifications.addListener('localNotificationReceived', (notification) => {
        console.log('Notificación recibida en primer plano:', notification);
    });
}
