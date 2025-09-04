// public/script.js (Updated with Hybrid View)

document.addEventListener('DOMContentLoaded', () => {
    // --- Map Initialization ---

    // 1. Define the base map layers
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const satelliteImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    
    // --- NEW: Define a layer for labels only ---
    const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
    	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        pane: 'shadowPane' // Ensures labels appear on top
    });

    // --- NEW: Create a layer group for the Hybrid view ---
    const hybridMap = L.layerGroup([satelliteImagery, labelsLayer]);


    // 2. Initialize the map and set the default layer
    const map = L.map('map', {
        layers: [streetMap] // Set the street map as the default
    }).setView([20.5937, 78.9629], 5);


    // 3. Update the base maps object to include the new Hybrid option
    const baseMaps = {
        "Street": streetMap,
        "Satellite": satelliteImagery, // Satellite without labels
        "Hybrid": hybridMap          // Satellite WITH labels
    };

    // 4. Add the layer control to the map
    L.control.layers(baseMaps).addTo(map);


    // --- Global Variables (No changes from here on) ---
    let markers = [];
    let polygon = null;
    const API_URL = 'http://localhost:3000/api';

    // --- DOM Elements ---
    const areaDisplay = document.getElementById('area-display');
    const perimeterDisplay = document.getElementById('perimeter-display');
    const resetButton = document.getElementById('reset-button');
    const historyList = document.getElementById('history-list');
    const markLocationButton = document.getElementById('mark-location-button');

    // --- Functions ---
    const addMarkerAtLocation = (lat, lng) => {
        const newMarker = L.marker([lat, lng]).addTo(map);
        markers.push(newMarker);
        updatePolygon();
        map.setView([lat, lng], 18);
        if (markers.length >= 3) {
            calculateAndDisplay();
        }
    };

    const updatePolygon = () => {
        if (polygon) map.removeLayer(polygon);
        const latLngs = markers.map(marker => marker.getLatLng());
        if (latLngs.length > 1) {
            polygon = L.polygon(latLngs, { color: 'blue' }).addTo(map);
        }
    };

    const calculateAndDisplay = async () => {
        if (markers.length < 3) return;
        const latLngs = markers.map(marker => marker.getLatLng());
        const closedLoopCoords = [...latLngs, latLngs[0]].map(ll => [ll.lng, ll.lat]);
        try {
            const response = await fetch(`${API_URL}/calculate-area`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coordinates: closedLoopCoords }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error');
            }
            const data = await response.json();
            areaDisplay.textContent = data.areaHectares.toFixed(4);
            perimeterDisplay.textContent = data.perimeterMeters.toFixed(2);
            fetchHistory();
        } catch (error) {
            console.error('Error calculating area:', error);
            alert(`Calculation failed: ${error.message}`);
        }
    };

    const resetMap = () => {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        if (polygon) map.removeLayer(polygon);
        polygon = null;
        areaDisplay.textContent = '0.0000';
        perimeterDisplay.textContent = '0.00';
    };
    
    const fetchHistory = async () => {
        try {
            const response = await fetch(`${API_URL}/history`);
            if (!response.ok) throw new Error('Failed to fetch history');
            const historyData = await response.json();
            historyList.innerHTML = '';
            if (historyData.length === 0) {
                historyList.innerHTML = '<li>No history yet.</li>';
                return;
            }
            historyData.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `Area: ${item.areaHectares.toFixed(4)} ha - Perimeter: ${item.perimeterMeters.toFixed(2)} m`;
                historyList.appendChild(li);
            });
        } catch (error) {
            console.error('Error fetching history:', error);
            historyList.innerHTML = '<li>Error loading history.</li>';
        }
    };

    // --- Event Listeners ---
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        addMarkerAtLocation(lat, lng);
    });

    resetButton.addEventListener('click', resetMap);

    markLocationButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            return alert('Geolocation is not supported by your browser.');
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                addMarkerAtLocation(lat, lng);
            },
            () => {
                alert('Unable to retrieve your location. Please grant permission.');
            }
        );
    });

    // --- Initial Load ---
    fetchHistory();
});