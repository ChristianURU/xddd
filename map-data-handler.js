// ============================================
// MAP DATA HANDLER V2 - SOLUCIÓN COMPLETA
// ============================================
// 
// Este archivo maneja:
// 1. Carga de TODOS los datos históricos para el gráfico de tendencias
// 2. Filtrado de datos del año actual para el mapa
// 3. Botones de año funcionales
// 4. Integración con Chart.js
//
// Autor: Claude - Versión Mejorada
// Fecha: 2026-02-15
// ============================================

(function() {
    'use strict';
    
    console.log("🔄 Cargando Map Data Handler V2...");

    // Variables globales para almacenar datos
    window.allTopicsData = []; // TODOS los datos históricos
    window.filteredMapData = []; // Solo datos del año seleccionado para el mapa
    window.currentYearFilter = '2026'; // Año actual por defecto
    window.trendChartInstance = null; // Instancia del gráfico

    /**
     * Función principal que carga TODOS los datos desde Firebase
     */
    window.loadAllTopicsData = async () => {
        try {
            console.log("📊 Cargando TODOS los datos históricos...");
            
            // Verificar que Firebase esté listo
            if (!window.db || !window.collection) {
                console.error("❌ Firebase no está listo");
                setTimeout(() => window.loadAllTopicsData(), 500);
                return;
            }

            const topicsRef = window.collection(window.db, 'topics');
            
            // Query sin filtro de año
            const q = window.query ? 
                window.query(topicsRef, window.orderBy('createdAt', 'desc')) :
                topicsRef;

            // Escuchar cambios en tiempo real
            window.onSnapshot(q, (snapshot) => {
                window.allTopicsData = [];
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const docData = {
                        id: doc.id,
                        ...data,
                        year: extractYear(data.createdAt),
                        timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
                    };
                    
                    window.allTopicsData.push(docData);
                });

                console.log(`✅ Total de casos cargados: ${window.allTopicsData.length}`);
                
                // Actualizar AMBOS componentes
                updateTrendChart();
                updateMapMarkers();
                updateDashboardStats();
            });

        } catch (error) {
            console.error("❌ Error cargando datos:", error);
        }
    };

    /**
     * Extrae el año de un timestamp de Firebase
     */
    function extractYear(timestamp) {
        if (!timestamp) return null;
        
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.getFullYear().toString();
        } catch (e) {
            return null;
        }
    }

    /**
     * Actualiza el gráfico de tendencias con los ÚLTIMOS 365 DÍAS
     */
    function updateTrendChart() {
        const chartCanvas = document.getElementById('trendChart');
        if (!chartCanvas) {
            console.warn("⚠️ Canvas 'trendChart' no encontrado");
            return;
        }

        // Verificar que Chart.js esté cargado
        if (typeof Chart === 'undefined') {
            console.error("❌ Chart.js no está cargado. Agrega el CDN en el HTML.");
            return;
        }

        const today = new Date();
        const oneYearAgo = new Date(today.getTime() - (365 * 24 * 60 * 60 * 1000));
        
        // Filtrar solo últimos 365 días
        const last365DaysData = window.allTopicsData.filter(topic => {
            return topic.timestamp >= oneYearAgo;
        });

        console.log(`📈 Datos para gráfico (últimos 365 días): ${last365DaysData.length} casos`);
        
        // Agrupar por mes
        const monthlyCounts = {};
        last365DaysData.forEach(topic => {
            const monthKey = `${topic.timestamp.getFullYear()}-${String(topic.timestamp.getMonth() + 1).padStart(2, '0')}`;
            monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
        });

        // Convertir a arrays
        const sortedMonths = Object.keys(monthlyCounts).sort();
        const labels = sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return `${monthNames[parseInt(monthNum) - 1]} ${year.slice(2)}`;
        });
        const data = sortedMonths.map(month => monthlyCounts[month]);

        // Destruir gráfico anterior si existe
        if (window.trendChartInstance) {
            window.trendChartInstance.destroy();
        }

        // Crear nuevo gráfico
        const ctx = chartCanvas.getContext('2d');
        window.trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Casos por mes',
                    data: data,
                    borderColor: '#ff4757',
                    backgroundColor: 'rgba(255, 71, 87, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ff4757',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#ff4757',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                return `${context.parsed.y} casos`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 6,
                            color: '#94a3b8',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            precision: 0,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

        console.log("✅ Gráfico de tendencias renderizado");
    }

    /**
     * Actualiza los marcadores del MAPA con el año seleccionado
     */
    function updateMapMarkers() {
        // Filtrar por año seleccionado
        if (window.currentYearFilter === 'all') {
            window.filteredMapData = window.allTopicsData;
        } else {
            window.filteredMapData = window.allTopicsData.filter(topic => {
                return topic.year === window.currentYearFilter;
            });
        }

        console.log(`🗺️ Datos para mapa (año ${window.currentYearFilter}): ${window.filteredMapData.length} casos`);
        
        // Llamar a la función de renderizado del mapa si existe
        if (typeof window.renderMapMarkers === 'function') {
            window.renderMapMarkers(window.filteredMapData);
        } else if (typeof window.updateMapMarkersDisplay === 'function') {
            window.updateMapMarkersDisplay(window.filteredMapData);
        } else {
            console.warn("⚠️ No se encontró función para actualizar marcadores del mapa");
        }
    }

    /**
     * Actualiza las estadísticas del dashboard
     */
    function updateDashboardStats() {
        const data = window.filteredMapData;
        
        // Total de casos
        const totalElement = document.getElementById('total-cases');
        if (totalElement) {
            totalElement.textContent = data.length;
        }

        // Casos este mes
        const thisMonth = new Date();
        const thisMonthCases = data.filter(topic => {
            const topicDate = topic.timestamp;
            return topicDate.getMonth() === thisMonth.getMonth() && 
                   topicDate.getFullYear() === thisMonth.getFullYear();
        }).length;
        
        const monthElement = document.getElementById('cases-this-month');
        if (monthElement) {
            monthElement.textContent = thisMonthCases;
        }

        console.log(`📊 Stats actualizadas: ${data.length} casos totales, ${thisMonthCases} este mes`);
    }

    /**
     * Función llamada cuando el usuario cambia el año en el dashboard
     */
    window.changeYear = function(year) {
        console.log(`📅 Cambiando filtro de año a: ${year}`);
        
        window.currentYearFilter = year;
        
        // Actualizar botones activos
        document.querySelectorAll('.year-option-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(`btn-${year}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // IMPORTANTE: Solo actualizar el MAPA y stats, NO el gráfico
        updateMapMarkers();
        updateDashboardStats();
    };

    /**
     * Inicialización automática
     */
    function init() {
        console.log("🚀 Inicializando Map Data Handler V2...");
        
        // Esperar a que Firebase esté listo
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos máximo
        
        const checkFirebase = setInterval(() => {
            attempts++;
            
            if (window.db && window.collection && window.onSnapshot) {
                clearInterval(checkFirebase);
                console.log("🔥 Firebase detectado, iniciando carga de datos...");
                
                // Cargar datos
                window.loadAllTopicsData();
                
                // Configurar botones de año
                setupYearButtons();
                
            } else if (attempts >= maxAttempts) {
                clearInterval(checkFirebase);
                console.error("❌ Timeout: Firebase no se cargó en 5 segundos");
            }
        }, 100);
    }

    /**
     * Configurar event listeners para botones de año
     */
    function setupYearButtons() {
        const buttons = document.querySelectorAll('.year-option-btn');
        buttons.forEach(btn => {
            const year = btn.id.replace('btn-', '');
            btn.onclick = () => window.changeYear(year);
        });
        console.log(`✅ ${buttons.length} botones de año configurados`);
    }

    /**
     * Verificar si Chart.js está cargado
     */
    function checkChartJS() {
        if (typeof Chart === 'undefined') {
            console.error("❌ Chart.js NO está cargado!");
            console.log("💡 Agrega esto en el <head> de tu HTML:");
            console.log('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>');
            return false;
        } else {
            console.log("✅ Chart.js está cargado correctamente");
            return true;
        }
    }

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Verificar Chart.js después de un segundo
    setTimeout(checkChartJS, 1000);

    // Exportar funciones globales
    window.updateTrendChart = updateTrendChart;
    window.updateMapMarkers = updateMapMarkers;
    window.updateDashboardStats = updateDashboardStats;

    console.log("✅ Map Data Handler V2 cargado correctamente");
})();
