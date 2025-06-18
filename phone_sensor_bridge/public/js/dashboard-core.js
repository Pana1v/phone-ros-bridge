// ========================================
// DASHBOARD CORE VARIABLES AND SOCKET CONNECTION
// ========================================

console.log('🔧 Dashboard Core loaded');
console.log('🌐 Current URL:', window.location.href);
console.log('🔌 Socket.IO available:', typeof io !== 'undefined');

// FIXED: Single Socket.IO declaration
const socket = io();

const statusDiv = document.getElementById('status');
const statsDiv = document.getElementById('stats');
const statsContent = document.getElementById('stats-content');

// Performance Variables
let lastUpdateTime = Date.now();
let frameCount = 0;
let fps = 0;

// Orientation tracking with smoothing
let currentOrientation = { alpha: 0, beta: 0, gamma: 0 };
let previousOrientation = { alpha: 0, beta: 0, gamma: 0 };
const orientationThreshold = 30; // Degrees threshold for abrupt changes

// ========================================
// SOCKET CONNECTION HANDLERS
// ========================================

socket.on('connect', () => {
    updateConnectionStatus(true);
    
    // Initialize 3D visualization and map after connection
    setTimeout(() => {
        if (typeof initialize3DVisualization === 'function' && !window.isThreeJSInitialized) {
            initialize3DVisualization();
        }
        if (typeof initializeMap === 'function' && !window.isMapInitialized) {
            initializeMap();
        }
    }, 500);
});

socket.on('disconnect', () => {
    updateConnectionStatus(false);
});

socket.on('sensorData', (data) => {
    console.log('Received data:', data);
    
    if (typeof updateAllSensorDisplays === 'function') {
        updateAllSensorDisplays(data);
    }
    
    // Update 3D visualization with CORRECTED and SMOOTHED orientation data
    if (data.orientation && window.isThreeJSInitialized) {
        const smoothedOrientation = smoothOrientation(data.orientation);
        currentOrientation = smoothedOrientation;
        if (typeof update3DOrientation === 'function') {
            update3DOrientation(smoothedOrientation);
        }
        if (typeof updateCompass === 'function') {
            updateCompass(smoothedOrientation.alpha);
        }
    }
    
    // Update GPS map
    if (data.gps && window.map) {
        if (typeof updateMap === 'function') {
            updateMap(data.gps);
        }
    }
    
    // Update calculated orientation displays
    if (data.calculatedOrientation) {
        if (typeof updateOrientationDisplays === 'function') {
            updateOrientationDisplays(data.calculatedOrientation);
        }
    }
    
    calculateFPS();
});

// Add camera frame listener
socket.on('cameraFrame', (frameData) => {
    if (typeof displayCameraFrame === 'function') {
        displayCameraFrame(frameData);
    }
});

// ========================================
// ORIENTATION SMOOTHING FUNCTION
// ========================================

function smoothOrientation(newOrientation) {
    return newOrientation; // Simplified for now
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || '--';
        console.log(`Updated ${id}: ${value}`);
    } else {
        console.warn(`Element not found: ${id}`);
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');
    
    if (connected) {
        statusDiv.textContent = '🟢 Connected to server';
        statusDiv.className = 'stat-value connected';
        statsDiv.style.display = 'block';
        
        if (indicator) indicator.classList.add('connected');
        if (text) text.textContent = 'Connected';
    } else {
        statusDiv.textContent = '🔴 Disconnected from server';
        statusDiv.className = 'stat-value disconnected';
        statsDiv.style.display = 'none';
        
        if (indicator) indicator.classList.remove('connected');
        if (text) text.textContent = 'Disconnected';
    }
}

function calculateFPS() {
    frameCount++;
    const now = Date.now();
    
    if (now - lastUpdateTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastUpdateTime = now;
    }
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    if (typeof setupCameraControls === 'function') {
        setupCameraControls();
    }
    
    // Set active navigation link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
    
    // Request stats every 5 seconds
    setInterval(() => {
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                if (stats && statsContent) {
                    statsContent.innerHTML = `
                        <div>📊 Total Readings: ${stats.totalReadings || 0}</div>
                        <div>⚡ Data Rate: ${stats.dataRate || 0} Hz</div>
                        <div>🎯 Motion Distribution: ${Object.entries(stats.motionClassification || {}).map(([k,v]) => `${k}: ${v}`).join(', ') || 'None'}</div>
                        <div>📈 FPS: ${fps.toFixed(1)}</div>
                    `;
                }
            })
            .catch(error => console.error('Error fetching stats:', error));
    }, 5000);
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (window.animationId) {
            cancelAnimationFrame(window.animationId);
        }
    } else {
        if (window.isThreeJSInitialized && typeof startAnimationLoop === 'function') {
            startAnimationLoop();
        }
    }
});

console.log('📊 Dashboard Core initialized');

// Export for other modules
window.socket = socket;
window.updateElement = updateElement;
window.calculateFPS = calculateFPS;
window.fps = fps;
window.currentOrientation = currentOrientation;
// window.fps = () => fps;
// window.currentOrientation = currentOrientation;
// window.socket = socket;