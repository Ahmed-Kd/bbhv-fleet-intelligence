// ==================== ÉTAT GLOBAL ====================
let ws = null;
let map = null;
let markers = {};
let selectedVehicle = null;
let vehicleChart = null;
let fleetData = {};
let initialZoomDone = false;  // Pour zoomer seulement une fois au départ

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard initialisé');
    initMap();
    initWebSocket();
    initEventListeners();
});

// ==================== WEBSOCKET ====================
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('🔌 Connexion WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('✅ WebSocket connecté');
        updateConnectionStatus(true);
    };
    
    ws.onclose = () => {
        console.log('❌ WebSocket déconnecté');
        updateConnectionStatus(false);
        setTimeout(initWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket erreur:', error);
        updateConnectionStatus(false);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.fleet) {
                fleetData = data.fleet;
                console.log('📊 Flotte mise à jour:', Object.keys(fleetData).length, 'véhicule(s)');
                updateUI();
            }
        } catch (err) {
            console.error('❌ Erreur parsing message:', err, event.data);
        }
    };
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('ws-status');
    if (statusEl) {
        if (connected) {
            statusEl.textContent = '🟢 Connecté';
            statusEl.style.color = '#10b981';
        } else {
            statusEl.textContent = '🔴 Déconnecté';
            statusEl.style.color = '#ef4444';
        }
    }
}

// ==================== CARTE LEAFLET ====================
function initMap() {
    // Carte centrée sur Paris avec zoom approprié pour voir plusieurs véhicules
    map = L.map('map').setView([48.8566, 2.3522], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    console.log('🗺️ Carte initialisée');
}

function updateMapMarkers() {
    const vehicleIds = Object.keys(fleetData);
    
    // Supprimer les marqueurs obsolètes
    Object.keys(markers).forEach(vid => {
        if (!vehicleIds.includes(vid)) {
            map.removeLayer(markers[vid]);
            delete markers[vid];
        }
    });
    
    // Mettre à jour/créer les marqueurs
    vehicleIds.forEach(vid => {
        const vehicle = fleetData[vid];
        const lastData = vehicle.last;
        const alerts = vehicle.alerts || [];
        
        if (!lastData || !lastData.lat || !lastData.lon) return;
        
        const hasAlerts = alerts.length > 0;
        const iconColor = hasAlerts ? '#ef4444' : '#10b981';
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background: ${iconColor};
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">🚗</div>`,
            iconSize: [32, 32]
        });
        
        if (!markers[vid]) {
            // Créer un nouveau marqueur
            markers[vid] = L.marker([lastData.lat, lastData.lon], { 
                icon,
                title: vid
            })
                .addTo(map)
                .on('click', () => selectVehicle(vid));
            
            console.log(`🗺️ Marqueur créé pour ${vid}`);
        } else {
            // Mettre à jour la position avec animation fluide
            markers[vid].setLatLng([lastData.lat, lastData.lon]);
            markers[vid].setIcon(icon);
        }
        
        // Popup amélioré
        const popupContent = `
            <div style="font-family: Arial; min-width: 200px;">
                <h4 style="margin: 0 0 10px 0; color: #1f2937;">${vid}</h4>
                <table style="width: 100%; font-size: 13px;">
                    <tr>
                        <td style="padding: 3px 0;"><b>Pression:</b></td>
                        <td style="text-align: right;">${lastData.pressure} bar</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 0;"><b>Température:</b></td>
                        <td style="text-align: right;">${lastData.temperature}°C</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 0;"><b>Hydrogène:</b></td>
                        <td style="text-align: right;">${lastData.hydrogen}%</td>
                    </tr>
                </table>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                    ${hasAlerts ? 
                        `<span style="color: #ef4444; font-weight: bold;">⚠️ ${alerts.length} alerte(s) active(s)</span>` : 
                        '<span style="color: #10b981; font-weight: bold;">✅ Statut nominal</span>'
                    }
                </div>
                <button onclick="window.selectVehicle('${vid}')" style="
                    margin-top: 10px;
                    width: 100%;
                    padding: 8px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                ">Voir les détails</button>
            </div>
        `;
        markers[vid].bindPopup(popupContent);
    });
    
    // Zoom initial SEULEMENT si c'est le premier chargement ET qu'il y a des véhicules
    if (!initialZoomDone && vehicleIds.length > 0) {
        const bounds = L.latLngBounds(
            vehicleIds.map(vid => [fleetData[vid].last.lat, fleetData[vid].last.lon])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
        initialZoomDone = true;
        console.log('🗺️ Zoom initial sur la flotte');
    }
}

// ==================== LISTE FLOTTE ====================
function updateFleetList() {
    const listEl = document.getElementById('fleet-list');
    if (!listEl) return;
    
    const vehicleIds = Object.keys(fleetData).sort();  // Tri alphabétique
    
    if (vehicleIds.length === 0) {
        listEl.innerHTML = '<p class="loading">En attente de données...</p>';
        return;
    }
    
    listEl.innerHTML = vehicleIds.map(vid => {
        const vehicle = fleetData[vid];
        const lastData = vehicle.last;
        const alerts = vehicle.alerts || [];
        const hasAlerts = alerts.length > 0;
        
        return `
            <div class="fleet-item ${selectedVehicle === vid ? 'selected' : ''}" 
                 onclick="window.selectVehicle('${vid}')">
                <div class="fleet-item-header">
                    <b>${vid}</b>
                    ${hasAlerts ? 
                        `<span class="badge-alert">${alerts.length} alerte(s)</span>` : 
                        '<span class="badge-ok">✓ OK</span>'
                    }
                </div>
                <div class="fleet-item-metrics">
                    <span>P: ${lastData.pressure}</span>
                    <span>T: ${lastData.temperature}°C</span>
                    <span>H2: ${lastData.hydrogen}%</span>
                </div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                    ${new Date(lastData.timestamp).toLocaleTimeString()}
                </div>
            </div>
        `;
    }).join('');
}

// ==================== CENTRE D'ALERTES ====================
function updateAlertCenter() {
    const alertListEl = document.getElementById('alert-list');
    const alertCountEl = document.getElementById('alert-count');
    
    if (!alertListEl || !alertCountEl) return;
    
    const alerts = [];
    
    Object.keys(fleetData).forEach(vid => {
        const vehicleAlerts = fleetData[vid].alerts || [];
        vehicleAlerts.forEach(alert => {
            alerts.push({ 
                vehicleId: vid, 
                timestamp: fleetData[vid].last.timestamp,
                ...alert 
            });
        });
    });
    
    // Trier par timestamp (plus récent d'abord)
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    alertCountEl.textContent = alerts.length;
    
    if (alerts.length === 0) {
        alertListEl.innerHTML = '<li class="no-alerts">Aucune alerte active</li>';
        return;
    }
    
    alertListEl.innerHTML = alerts.map(alert => `
        <li class="alert-item" onclick="window.selectVehicle('${alert.vehicleId}')">
            <div>
                <b>${alert.vehicleId}</b> — ${alert.type}
                <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
                    ${new Date(alert.timestamp).toLocaleTimeString()}
                </div>
            </div>
            <span class="alert-value">${alert.value}</span>
        </li>
    `).join('');
}

// ==================== VEHICLE INSPECTOR ====================
function selectVehicle(vehicleId) {
    console.log('🔍 Véhicule sélectionné:', vehicleId);
    selectedVehicle = vehicleId;
    
    const inspector = document.getElementById('vehicle-inspector');
    if (inspector) {
        inspector.style.display = 'block';
    }
    
    // Zoom sur le véhicule sélectionné
    if (fleetData[vehicleId] && fleetData[vehicleId].last) {
        const lat = fleetData[vehicleId].last.lat;
        const lon = fleetData[vehicleId].last.lon;
        map.setView([lat, lon], 15, { animate: true, duration: 0.5 });
        
        // Ouvrir le popup du marqueur
        if (markers[vehicleId]) {
            markers[vehicleId].openPopup();
        }
    }
    
    updateInspector();
    updateFleetList();
}

function updateInspector() {
    if (!selectedVehicle || !fleetData[selectedVehicle]) return;
    
    const vehicle = fleetData[selectedVehicle];
    const lastData = vehicle.last;
    const history = vehicle.history || [];
    const alerts = vehicle.alerts || [];
    
    const titleEl = document.getElementById('inspector-title');
    if (titleEl) {
        titleEl.textContent = `📊 ${selectedVehicle}`;
    }
    
    const detailsEl = document.getElementById('vehicle-details');
    if (detailsEl) {
        detailsEl.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Pression</span>
                    <span class="detail-value">${lastData.pressure} bar</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Température</span>
                    <span class="detail-value">${lastData.temperature}°C</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Hydrogène</span>
                    <span class="detail-value">${lastData.hydrogen}%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">GPS</span>
                    <span class="detail-value">${lastData.lat.toFixed(5)}, ${lastData.lon.toFixed(5)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Dernier update</span>
                    <span class="detail-value">${new Date(lastData.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Statut</span>
                    <span class="detail-value">${alerts.length > 0 ? '⚠️ Alertes actives' : '✅ Nominal'}</span>
                </div>
            </div>
        `;
    }
    
    updateVehicleChart(history);
}

function updateVehicleChart(history) {
    const canvas = document.getElementById('vehicle-chart');
    
    if (!canvas || canvas.offsetParent === null) {
        return;
    }
    
    if (history.length === 0) {
        return;
    }
    
    // Limiter à 50 points pour garder le graphique lisible
    const displayHistory = history.slice(-50);
    
    const labels = displayHistory.map(h => new Date(h.timestamp).toLocaleTimeString());
    const pressureData = displayHistory.map(h => h.pressure);
    const temperatureData = displayHistory.map(h => h.temperature);
    const hydrogenData = displayHistory.map(h => h.hydrogen);
    
    if (vehicleChart) {
        vehicleChart.destroy();
        vehicleChart = null;
    }
    
    try {
        const ctx = canvas.getContext('2d');
        
        vehicleChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Pression (bar)',
                        data: pressureData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Température (°C)',
                        data: temperatureData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Hydrogène (%)',
                        data: hydrogenData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                animation: {
                    duration: 750
                }
            }
        });
        
        console.log('✅ Graphique créé avec', displayHistory.length, 'points');
    } catch (err) {
        console.error('❌ Erreur création graphique:', err);
    }
}

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
    const closeBtn = document.getElementById('close-inspector');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const inspector = document.getElementById('vehicle-inspector');
            if (inspector) {
                inspector.style.display = 'none';
            }
            
            if (vehicleChart) {
                vehicleChart.destroy();
                vehicleChart = null;
            }
            
            selectedVehicle = null;
            
            // Rezoomer sur toute la flotte
            const vehicleIds = Object.keys(fleetData);
            if (vehicleIds.length > 0) {
                const bounds = L.latLngBounds(
                    vehicleIds.map(vid => [fleetData[vid].last.lat, fleetData[vid].last.lon])
                );
                map.fitBounds(bounds, { padding: [50, 50], animate: true });
            }
            
            updateFleetList();
        });
    }
}

// ==================== MISE À JOUR GLOBALE ====================
function updateUI() {
    const vehicleCountEl = document.getElementById('vehicle-count');
    if (vehicleCountEl) {
        const vehicleCount = Object.keys(fleetData).length;
        vehicleCountEl.textContent = vehicleCount;
    }
    
    updateFleetList();
    updateMapMarkers();
    updateAlertCenter();
    
    if (selectedVehicle && fleetData[selectedVehicle]) {
        const inspector = document.getElementById('vehicle-inspector');
        if (inspector && inspector.style.display !== 'none') {
            updateInspector();
        }
    }
}

// Fonction globale pour la sélection
window.selectVehicle = selectVehicle;

console.log('✅ app.js chargé');