/**
 * 🔔 Gestor de Notificaciones Push (FCM)
 */

async function initPush() {
    if (!window.Capacitor) return;
    const { PushNotifications } = window.Capacitor.Plugins;

    try {
        // 1. Pedir permisos
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn("🚫 Permiso de notificaciones denegado.");
            return;
        }

        // 2. Registrar el dispositivo con el servidor de Google (FCM)
        await PushNotifications.register();

        // 3. Obtener el Token (La dirección postal del celular)
        PushNotifications.addListener('registration', async (token) => {
            // (log removido)
            // Guardar en Firestore para que el servidor sepa dónde encontrarnos
            await saveTokenToFirebase(token.value);
        });

        // 4. Qué hacer si falla el registro
        PushNotifications.addListener('registrationError', (error) => {
            console.error('❌ Error en registro de Push:', error);
        });

        // 5. Qué hacer si recibimos una notificación con la APP ABIERTA
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            // (log removido)
            // Aquí puedes mostrar un cartelito interno si quieres
        });

        // 6. Qué hacer cuando el usuario HACE CLIC en la notificación
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            // (log removido)
            const topicId = notification.notification.data.topicId;
            if (topicId) {
                // Abrir el detalle si tenemos el ID
                if (typeof window.openTopicDetail === 'function') {
                    window.openTopicDetail(topicId);
                }
            }
        });

    } catch (e) {
        console.error("Error en initPush:", e);
    }
}

async function saveTokenToFirebase(token) {
    // Esperar a que window.auth esté disponible (máximo 10s)
    let retries = 0;
    while (!window.auth && retries < 20) {
        await new Promise(r => setTimeout(r, 500));
        retries++;
    }

    if (!window.auth || !window.db) {
        console.error("❌ Firebase no disponible para guardar Token.");
        return;
    }

    let user = window.auth.currentUser;

    // Si no hay usuario, forzamos un login anónimo
    if (!user) {
        try {
            const { signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
            const result = await signInAnonymously(window.auth);
            user = result.user;
            // (log removido)
        } catch (e) {
            console.error("❌ Falló el login anónimo:", e);
            localStorage.setItem('pending_fcm_token', token);
            return;
        }
    }

    if (user) {
        try {
            const { doc, setDoc, arrayUnion } = window.FirebaseFirestore;
            const userRef = doc(window.db, "users", user.uid);
            await setDoc(userRef, {
                fcmTokens: arrayUnion(token),
                lastActive: new Date()
            }, { merge: true });
            // (log removido)
            window.lastReportedToken = "Ok";
        } catch (e) {
            console.error("Error guardando token:", e);
        }
    }
}

async function reportUserLocation(lat, lng) {
    if (!window.auth || !window.db) {
        // Guardar para después si no está listo
        window.pendingLoc = { lat, lng };
        return;
    }
    const user = window.auth.currentUser;
    if (!user) return;

    try {
        const { doc, updateDoc } = window.FirebaseFirestore;
        const userRef = doc(window.db, "users", user.uid);
        await updateDoc(userRef, {
            lastLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
            lastLocationDate: new Date()
        });
            // (log removido)
        window.lastReportedLoc = "Ok";
    } catch (e) {
        // A veces falla si el doc no existe, usamos setDoc como fallback
        try {
            const { doc, setDoc } = window.FirebaseFirestore;
            const userRef = doc(window.db, "users", user.uid);
            await setDoc(userRef, {
                lastLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
                lastLocationDate: new Date()
            }, { merge: true });
        } catch (e2) {}
    }
}

// Iniciar cuando el sistema esté listo
// Iniciar se maneja centralizado en index.html
window.initPush = initPush;
window.reportUserLocation = reportUserLocation;
