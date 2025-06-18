// ========================================
// GPS MAP AND CAMERA SYSTEM - COMPLETE FIXED
// ========================================

// Map Variables
let map, mapMarker;
window.isMapInitialized = false;
window.map = null;

// Camera Variables - Simplified for WebSocket only
let isWebSocketCameraActive = false;

// ========================================
// GPS MAP SYSTEM
// ========================================

function initializeMap() {
    try {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.warn('Map element not found');
            return;
        }

        map = L.map('map').setView([28.6139, 77.2090], 13);
        window.map = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        mapMarker = L.marker([28.6139, 77.2090]).addTo(map)
            .bindPopup('Phone Location')
            .openPopup();

        window.isMapInitialized = true;
        console.log('✅ GPS Map initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing GPS map:', error);
    }
}

function updateMap(gpsData) {
    if (!map || !mapMarker || !gpsData.latitude || !gpsData.longitude) return;
    
    try {
        const lat = gpsData.latitude;
        const lon = gpsData.longitude;
        
        mapMarker.setLatLng([lat, lon]);
        
        if (map.getZoom() === 13) {
            map.setView([lat, lon], 16);
        }
        
        const popupContent = `
            <div style="font-size: 12px;">
                <strong>📍 Phone Location</strong><br>
                Lat: ${lat.toFixed(6)}<br>
                Lon: ${lon.toFixed(6)}<br>
                Alt: ${(gpsData.altitude || 0).toFixed(1)}m<br>
                Accuracy: ±${(gpsData.accuracy || 0).toFixed(1)}m<br>
                Speed: ${(gpsData.speed || 0).toFixed(1)} m/s<br>
                Heading: ${(gpsData.heading || 0).toFixed(1)}°
            </div>
        `;
        mapMarker.bindPopup(popupContent);
        
        // Update map info elements
        updateElementSafe('map-lat', lat.toFixed(6));
        updateElementSafe('map-lon', lon.toFixed(6));
        updateElementSafe('map-accuracy', `±${(gpsData.accuracy || 0).toFixed(1)}m`);
        updateElementSafe('map-altitude', (gpsData.altitude || 0).toFixed(1));
        updateElementSafe('map-speed', (gpsData.speed || 0).toFixed(1));
        updateElementSafe('map-heading', (gpsData.heading || 0).toFixed(1));
        
    } catch (error) {
        console.error('Error updating map:', error);
    }
}

// ========================================
// WEBSOCKET CAMERA STREAM SYSTEM (FIXED)
// ========================================

function setupCameraControls() {
    console.log('🎥 Setting up WebSocket camera controls...');
    
    const phoneToggle = document.getElementById('phone-camera-toggle');
    if (phoneToggle) {
        phoneToggle.addEventListener('click', toggleWebSocketCamera);
    }

    const phoneSnapshot = document.getElementById('phone-camera-snapshot');
    if (phoneSnapshot) {
        phoneSnapshot.addEventListener('click', takeWebSocketSnapshot);
    }
    
    // Initialize camera display
    updatePhoneCameraStatus('Ready - Click Start to receive WebSocket frames');
}

function toggleWebSocketCamera() {
    const img = document.getElementById('phone-camera-stream');
    const toggleButton = document.getElementById('phone-camera-toggle');
    const status = document.getElementById('phone-camera-status');
    
    if (!isWebSocketCameraActive) {
        // Start WebSocket camera display
        isWebSocketCameraActive = true;
        
        if (img) img.style.display = 'block';
        if (toggleButton) toggleButton.textContent = '⏹️ Stop Stream';
        if (status) status.textContent = 'Waiting for WebSocket camera frames...';
        
        // Try MJPEG stream first, fallback to WebSocket frames
        if (img) {
            img.src = 'https://192.168.1.11:/camera/stream.mjpg'; // Replace with your MJPEG stream URL
            img.onerror = () => {
                console.log('MJPEG stream not available, using WebSocket frames');
                if (status) status.textContent = 'Using WebSocket frames (MJPEG unavailable)';
            };
            img.onload = () => {
                console.log('✅ MJPEG stream connected');
                if (status) status.textContent = 'MJPEG stream active';
            };
        }
        
        console.log('📸 WebSocket camera display started');
        
    } else {
        // Stop WebSocket camera display
        isWebSocketCameraActive = false;
        
        if (img) {
            img.style.display = 'none';
            img.src = '';
        }
        if (toggleButton) toggleButton.textContent = '▶️ Start Stream';
        if (status) status.textContent = 'Stream stopped';
        
        console.log('📸 WebSocket camera display stopped');
    }
}

// Main function to display WebSocket camera frames
function displayCameraFrame(frameData) {
    console.log('📸 Displaying WebSocket camera frame:', {
        hasData: !!frameData.data,
        width: frameData.width,
        height: frameData.height,
        facingMode: frameData.facingMode
    });
    
    const img = document.getElementById('phone-camera-stream');
    const status = document.getElementById('phone-camera-status');
    
    if (img && frameData.data && isWebSocketCameraActive) {
        // Display the base64 JPEG from phone WebSocket
        img.src = frameData.data;
        img.style.display = 'block';
        
        if (status) {
            status.textContent = `WebSocket: ${frameData.width}x${frameData.height} - ${frameData.facingMode}`;
        }
        
        console.log('✅ WebSocket camera frame displayed successfully');
    } else {
        if (!isWebSocketCameraActive) {
            console.log('📸 Camera display inactive, frame ignored');
        } else {
            console.warn('❌ No WebSocket camera frame data or missing element');
            if (status) {
                status.textContent = 'No WebSocket camera data received';
            }
        }
    }
}

function takeWebSocketSnapshot() {
    const img = document.getElementById('phone-camera-stream');
    
    if (!img || !img.src || img.style.display === 'none') {
        alert('No camera frame available to capture');
        return;
    }
    
    // Create download link from current frame
    const a = document.createElement('a');
    a.href = img.src;
    a.download = `phone-websocket-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log('📸 WebSocket snapshot taken');
}

function updatePhoneCameraStatus(status) {
    const statusElement = document.getElementById('phone-camera-status');
    if (statusElement) {
        statusElement.textContent = status;
        console.log(`📷 Camera status: ${status}`);
    } else {
        console.warn('❌ Phone camera status element not found');
    }
}

// Test function for camera stream
function testCameraStream() {
    console.log('🧪 Testing WebSocket camera stream display...');
    
    // Create a test image
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    
    // Draw test pattern
    ctx.fillStyle = '#00ff41';
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#000000';
    ctx.font = '20px Arial';
    ctx.fillText('TEST WEBSOCKET', 80, 120);
    ctx.fillText('CAMERA FRAME', 90, 150);
    
    const testFrame = {
        data: canvas.toDataURL('image/jpeg'),
        width: 320,
        height: 240,
        facingMode: 'test'
    };
    
    // Enable camera display and show test frame
    isWebSocketCameraActive = true;
    displayCameraFrame(testFrame);
    updatePhoneCameraStatus('Test frame displayed');
}

// Utility function for safe element updates
function updateElementSafe(id, value) {
    try {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || '--';
            return true;
        } else {
            console.warn(`❌ Element not found: ${id}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error updating ${id}:`, error);
        return false;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (isWebSocketCameraActive) {
        isWebSocketCameraActive = false;
    }
});

console.log('🗺️📷 Maps and Camera module loaded (WebSocket optimized)');

// Export functions
window.initializeMap = initializeMap;
window.updateMap = updateMap;
window.setupCameraControls = setupCameraControls;
window.displayCameraFrame = displayCameraFrame;
window.testCameraStream = testCameraStream;
window.toggleWebSocketCamera = toggleWebSocketCamera;
