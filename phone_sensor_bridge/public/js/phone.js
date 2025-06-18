// ========================================
// PHONE SENSOR STREAMER - COMPLETE CODE WITH CAMERA STREAMING
// ========================================

// Core Variables
let wss = null;
let streaming = true
let sensorData = {};
let dataCount = 0;
let latencyMeasurements = [];
let mediaStream = null;
let consecutiveErrors = 0;
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;

// Sensor State Variables
let sensorDataInitialized = false;
let sensorDataAvailable = false;
let currentFacingMode = 'environment';
let cameraStream = null;

// Camera Streaming Variables (NEW)
let cameraStreamActive = true
let videoElement = null;
let canvas = null;
let ctx = null;
let frameStreamingInterval = null;

// Performance Variables
let lastDataTime = Date.now();
let dataRateCounter = 0;

// Connection Variables
let connectionAttempts = 0;
let maxConnectionAttempts = 5;
let circuitBreakerOpen = false;
let lastConnectionAttempt = 0;

// DOM Elements
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const sensorInfo = document.getElementById('sensorInfo');

// ========================================
// INITIALIZATION AND SETUP
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Phone sensor app loaded');
    testSensorAvailability();
    setupEventListeners();
});

function setupEventListeners() {
    // Start button
    if (startBtn) {
        startBtn.addEventListener('click', handleStartStreaming);
    }
    
    // Stop button
    if (stopBtn) {
        stopBtn.addEventListener('click', handleStopStreaming);
    }
    
    // Camera switch button
    const switchCameraBtn = document.getElementById('switch-camera');
    if (switchCameraBtn) {
        switchCameraBtn.addEventListener('click', switchCamera);
    }
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function testSensorAvailability() {
    console.log('=== Testing Sensor Availability ===');
    
    // Test device motion
    if (typeof DeviceMotionEvent !== 'undefined') {
        console.log('✅ DeviceMotionEvent supported');
    } else {
        console.warn('❌ DeviceMotionEvent not supported');
    }
    
    // Test device orientation
    if (typeof DeviceOrientationEvent !== 'undefined') {
        console.log('✅ DeviceOrientationEvent supported');
    } else {
        console.warn('❌ DeviceOrientationEvent not supported');
    }
    
    // Test geolocation
    if (navigator.geolocation) {
        console.log('✅ Geolocation supported');
    } else {
        console.warn('❌ Geolocation not supported');
    }
    
    // Test getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log('✅ getUserMedia supported');
    } else {
        console.warn('❌ getUserMedia not supported');
    }
    
    console.log('=== End Sensor Test ===');
}

// ========================================
// WEBSOCKET CONNECTION MANAGEMENT
// ========================================

function connectWebSocket() {
    const now = Date.now();
    
    // Circuit breaker logic
    if (circuitBreakerOpen && now - lastConnectionAttempt < 30000) {
        console.log('Circuit breaker open, waiting...');
        return;
    }
    
    if (connectionAttempts >= maxConnectionAttempts) {
        circuitBreakerOpen = true;
        console.log('Circuit breaker activated');
        setTimeout(() => {
            circuitBreakerOpen = false;
            connectionAttempts = 0;
        }, 60000);
        return;
    }
    
    lastConnectionAttempt = now;
    connectionAttempts++;
    
    const wssUrl = `wss://${window.location.host}`;
    console.log(`Connecting to ${wssUrl} (attempt ${connectionAttempts})`);
    
    wss = new WebSocket(wssUrl);
    
    wss.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        updateConnectionStatus(true);
        connectionAttempts = 0;
        circuitBreakerOpen = false;
        
        // Start latency measurement
        setInterval(measureLatency, 15000); // Fixed: 15 seconds instead of 1500ms
    };
    
    wss.onmessage = (event) => {
        try {
            if (typeof event.data !== 'string') {
                console.warn('Received non-string message');
                return;
            }
            
            if (!isValidUTF8String(event.data)) {
                console.warn('Received invalid UTF-8 message');
                return;
            }
            
            const data = JSON.parse(event.data);
            
            if (data.type === 'pong') {
                const latency = performance.now() - data.timestamp;
                latencyMeasurements.push(latency);
                if (latencyMeasurements.length > 3) {
                    latencyMeasurements.shift();
                }
                updateLatencyDisplay();
            } else if (data.type === 'welcome') {
                console.log('Server welcome:', data.message);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    wss.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason || 'No reason'}`);
        updateConnectionStatus(false);
        
        // Auto-reconnect with exponential backoff
        if (streaming && !circuitBreakerOpen) {
            const delay = Math.min(2000 * Math.pow(1.5, connectionAttempts - 1), 30000);
            console.log(`Reconnecting in ${delay}ms...`);
            setTimeout(connectWebSocket, delay);
        }
    };
    
    wss.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

function measureLatency() {
    if (!wss || wss.readyState !== WebSocket.OPEN) return;
    
    const startTime = performance.now();
    try {
        wss.send(JSON.stringify({
            type: 'ping',
            timestamp: startTime
        }));
    } catch (error) {
        console.error('Error sending ping:', error);
    }
}

function updateLatencyDisplay() {
    if (latencyMeasurements.length === 0) return;
    
    const avgLatency = latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length;
    
    // Update latency display
    const latencyValue = document.getElementById('latency-value');
    if (latencyValue) {
        latencyValue.textContent = `${avgLatency.toFixed(1)}ms`;
    }
    
    // Update latency stat
    const latencyStat = document.getElementById('latency-stat');
    if (latencyStat) {
        latencyStat.textContent = avgLatency.toFixed(0);
    }
}

// ========================================
// PERMISSION MANAGEMENT
// ========================================
// Add this to phone.js after requestPermissions
async function requestPermissions() {
    console.log('=== Requesting Permissions ===');
    
    try {
        // Device motion and orientation permissions (iOS 13+)
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            const motionPermission = await DeviceMotionEvent.requestPermission();
            console.log('Motion permission:', motionPermission);
            
            if (motionPermission !== 'granted') {
                alert('Motion permission denied. Please enable in Safari settings.');
                return false;
            }
        }
        
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const orientationPermission = await DeviceOrientationEvent.requestPermission();
            console.log('Orientation permission:', orientationPermission);
            
            if (orientationPermission !== 'granted') {
                alert('Orientation permission denied. Please enable in Safari settings.');
                return false;
            }
        }
        
        // Force sensor wake-up
        console.log('🔄 Forcing sensor wake-up...');
        await forceSensorWakeup();
        
        // Initialize camera streaming
        await initializeCameraStreaming();
        
        console.log('✅ All permissions granted');
        return true;
        
    } catch (error) {
        console.error('Permission request failed:', error);
        return false;
    }
}

// Force sensor wake-up function
async function forceSensorWakeup() {
    return new Promise((resolve) => {
        let motionDetected = false;
        let orientationDetected = false;
        
        const motionHandler = (event) => {
            if (!motionDetected && (event.acceleration || event.accelerationIncludingGravity)) {
                console.log('✅ Motion sensor active');
                motionDetected = true;
                checkComplete();
            }
        };
        
        const orientationHandler = (event) => {
            if (!orientationDetected && (event.alpha !== null || event.beta !== null || event.gamma !== null)) {
                console.log('✅ Orientation sensor active');
                orientationDetected = true;
                checkComplete();
            }
        };
        
        const checkComplete = () => {
            if (motionDetected && orientationDetected) {
                window.removeEventListener('devicemotion', motionHandler);
                window.removeEventListener('deviceorientation', orientationHandler);
                resolve();
            }
        };
        
        window.addEventListener('devicemotion', motionHandler);
        window.addEventListener('deviceorientation', orientationHandler);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            console.log('⚠️ Sensor wake-up timeout');
            window.removeEventListener('devicemotion', motionHandler);
            window.removeEventListener('deviceorientation', orientationHandler);
            resolve();
        }, 5000);
    });
}

// ========================================
// ENHANCED CAMERA STREAMING SYSTEM (NEW)
// ========================================

async function initializeCameraStreaming() {
    try {
        console.log('🎥 Initializing camera streaming...');
        
        // Create video element for camera capture
        videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.style.display = 'none'; // Hidden, used only for capture
        document.body.appendChild(videoElement);
        
        // Create canvas for frame capture
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        
        // Get camera stream
        // Get camera stream with better constraints
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 640, min: 320 },
                height: { ideal: 480, min: 240 },
                frameRate: { ideal: 15, max: 30 }
            },
            audio: false
        });

        
    videoElement.srcObject = cameraStream;
function testCameraStream() {
    console.log('=== Camera Stream Debug ===');
    console.log('Video element:', videoElement);
    console.log('Video ready state:', videoElement?.readyState);
    console.log('Video dimensions:', videoElement?.videoWidth, 'x', videoElement?.videoHeight);
    console.log('Canvas dimensions:', canvas?.width, 'x', canvas?.height);
    console.log('Camera stream active:', cameraStreamActive);
    console.log('Camera stream tracks:', cameraStream?.getVideoTracks());
    
    if (videoElement && canvas && ctx) {
        try {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const dataURL = canvas.toDataURL('image/jpeg', 0.5);
            console.log('Test capture successful, data length:', dataURL.length);
        } catch (error) {
            console.error('Test capture failed:', error);
        }
    }
}

// Wait for video to be fully ready with timeout
await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
    }, 10000);
    
    videoElement.onloadedmetadata = () => {
        clearTimeout(timeout);
        console.log('✅ Video metadata loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        resolve();
    };
    
    // If already loaded
    if (videoElement.readyState >= 1) {
        clearTimeout(timeout);
        resolve();
        }
    });

    // Set canvas dimensions to match video
    canvas.width = videoElement.videoWidth || 320;
    canvas.height = videoElement.videoHeight || 240;

    cameraStreamActive = true;


        
        // Update camera preview if element exists
        const cameraPreview = document.getElementById('camera-preview');
        if (cameraPreview) {
            cameraPreview.srcObject = cameraStream;
        }
        
        // Update camera status
        const cameraStatus = document.getElementById('camera-status');
        if (cameraStatus) {
            cameraStatus.textContent = currentFacingMode === 'environment' ? 'Rear Camera Streaming' : 'Front Camera Streaming';
        }
        
        // Start streaming frames to server
        startFrameStreaming();
        testCameraStream(); // Debugging function to test camera stream
        console.log('✅ Camera streaming initialized successfully');
        
    } catch (error) {
        console.error('❌ Camera streaming initialization failed:', error);
        const cameraStatus = document.getElementById('camera-status');
        if (cameraStatus) {
            cameraStatus.textContent = 'Camera Error';
        }
    }
}

function startFrameStreaming() {
    if (!cameraStreamActive || !videoElement || !wss) return;
    
    console.log('📡 Starting frame streaming to server...');
    
    const streamFrames = () => {
        if (!cameraStreamActive || !wss || wss.readyState !== WebSocket.OPEN) return;
        
        try {
            // Enhanced readiness check
            if (videoElement.readyState < 2 || 
                videoElement.videoWidth === 0 || 
                videoElement.videoHeight === 0) {
                console.log('⚠️ Video not ready, retrying...');
                setTimeout(streamFrames, 200);
                return;
            }
            
            // Ensure canvas matches video dimensions
            if (canvas.width !== videoElement.videoWidth || canvas.height !== videoElement.videoHeight) {
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                console.log('📐 Canvas resized to:', canvas.width, 'x', canvas.height);
            }
            
            // Clear canvas first
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            console.log('Video element check:');
            console.log('- readyState:', videoElement.readyState);
            console.log('- videoWidth:', videoElement.videoWidth);
            console.log('- videoHeight:', videoElement.videoHeight);
            console.log('- currentTime:', videoElement.currentTime);
            console.log('- paused:', videoElement.paused);

            // Force video to play if paused
            if (videoElement.paused) {
                videoElement.play();
            }
            // Draw video frame
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // Test if canvas has actual image data
            const imageData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height));
            const hasPixelData = Array.from(imageData.data).some(pixel => pixel > 0);
            
            if (!hasPixelData) {
                console.log('⚠️ Canvas appears blank, retrying...');
                setTimeout(streamFrames, 200);
                return;
            }
            
            // Convert to base64 with compression
            const frameData = canvas.toDataURL('image/jpeg', 0.15);
            
            // Send frame to server
            wss.send(JSON.stringify({
                type: 'cameraFrame',
                data: frameData,
                timestamp: Date.now(),
                facingMode: currentFacingMode,
                width: canvas.width,
                height: canvas.height
            }));
            
            console.log(`📸 Frame sent: ${canvas.width}x${canvas.height}, data length: ${frameData.length}`);
            
        } catch (error) {
            console.error('Error capturing/sending frame:', error);
        }
    };

    
    // Wait for video metadata to load
    videoElement.addEventListener('loadedmetadata', () => {
        console.log('📹 Video metadata loaded, starting frame streaming');
        
        // Start streaming frames at 1 FPS (every 1000ms) for stability
        frameStreamingInterval = setInterval(streamFrames, 00);
    });
    
    // If metadata is already loaded
    if (videoElement.readyState >= 1) {
        frameStreamingInterval = setInterval(streamFrames, 300);
    }
}

function stopFrameStreaming() {
    if (frameStreamingInterval) {
        clearInterval(frameStreamingInterval);
        frameStreamingInterval = null;
        console.log('⏹️ Frame streaming stopped');
    }
}

async function switchCamera() {
    console.log('🔄 Switching camera...');
    
    // Stop current streaming
    stopFrameStreaming();
    
    // Stop current camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    
    // Switch facing mode
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    
    // Reinitialize camera with new facing mode
    await initializeCameraStreaming();
}

// ========================================
// SENSOR DATA MANAGEMENT
// ========================================

function initializeSensorData() {
    sensorData = {
        accelerometer: { x: 0, y: 0, z: 0 },
        gyroscope: { x: 0, y: 0, z: 0 },
        orientation: { alpha: 0, beta: 0, gamma: 0 },
        timestamp: new Date().toISOString(),
        dataCount: 0
    };
    
    sensorDataInitialized = true;
    console.log('✅ Sensor data initialized');
}

async function startSensors() {
    try {
        console.log('🚀 Starting sensor streaming...');
        
        // Request permissions first
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            const motionPermission = await DeviceMotionEvent.requestPermission();
            if (motionPermission !== 'granted') {
                throw new Error('Device motion permission denied');
            }
            console.log('✅ Device motion permission granted');
        }
        
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const orientationPermission = await DeviceOrientationEvent.requestPermission();
            if (orientationPermission !== 'granted') {
                throw new Error('Device orientation permission denied');
            }
            console.log('✅ Device orientation permission granted');
        }
        
        streaming = true;
        dataCount = 0;
        
        // Initialize sensor data
        initializeSensorData();
        
        // Add event listeners
        window.addEventListener('devicemotion', handleMotion, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
        
        // GPS with immediate callback
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    handleGPS(position);
                    console.log('✅ GPS data captured');
                },
                (error) => console.error('GPS error:', error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 10000,
                    timeout: 5000
                }
            );
            
            // Continue watching position
            navigator.geolocation.watchPosition(handleGPS, null, {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 15000
            });
        }
        
        // Battery API
        if ('getBattery' in navigator) {
            navigator.getBattery().then(handleBattery);
        }
        
        // Network information
        if ('connection' in navigator) {
            handleNetworkInfo();
            navigator.connection.addEventListener('change', handleNetworkInfo);
        }
        
        // Force initial sensor reading
        setTimeout(() => {
            if (!sensorDataAvailable) {
                console.log('⚠️ No sensor data detected, using dummy data');
                sensorData.accelerometer = { x: 0.1, y: 0.1, z: 9.8 };
                sensorData.gyroscope = { x: 0.0, y: 0.0, z: 0.0 };
                sensorData.orientation = { alpha: 0, beta: 0, gamma: 0 };
                sensorDataAvailable = true;
                updateSensorDisplay();
            }
        }, 1000);
        
        // Start sending data immediately
        sendSensorData();
        setInterval(sendSensorData, 200); // Send data every 200ms
        
        console.log('✅ Sensor streaming started');
        
    } catch (error) {
        console.error('❌ Error starting sensors:', error);
        alert('Error starting sensors: ' + error.message);
        stopSensors();
    }
}

function handleMotion(event) {
    if (!streaming) return;
    
    sensorData.accelerometer = {
        x: sanitizeNumber(event.acceleration?.x || 0),
        y: sanitizeNumber(event.acceleration?.y || 0),
        z: sanitizeNumber(event.acceleration?.z || 0)
    };
    
    sensorData.gyroscope = {
        x: sanitizeNumber(event.rotationRate?.alpha || 0),
        y: sanitizeNumber(event.rotationRate?.beta || 0),
        z: sanitizeNumber(event.rotationRate?.gamma || 0)
    };
    
    sensorDataAvailable = true;
    updateSensorDisplay();
}

function handleOrientation(event) {
    if (!streaming) return;
    
    sensorData.orientation = {
        alpha: sanitizeNumber(event.alpha || 0),
        beta: sanitizeNumber(event.beta || 0),
        gamma: sanitizeNumber(event.gamma || 0)
    };
    
    sensorDataAvailable = true;
    updateSensorDisplay();
}

function handleGPS(position) {
    if (!streaming) return;
    
    sensorData.gps = {
        latitude: sanitizeNumber(position.coords.latitude),
        longitude: sanitizeNumber(position.coords.longitude),
        altitude: sanitizeNumber(position.coords.altitude),
        accuracy: sanitizeNumber(position.coords.accuracy),
        speed: sanitizeNumber(position.coords.speed),
        heading: sanitizeNumber(position.coords.heading),
        timestamp: position.timestamp
    };
    
    sensorDataAvailable = true;
    updateSensorDisplay();
}

function handleBattery(battery) {
    if (!streaming) return;
    
    const updateBatteryInfo = () => {
        sensorData.battery = {
            level: sanitizeNumber(battery.level),
            charging: Boolean(battery.charging),
            chargingTime: sanitizeNumber(battery.chargingTime),
            dischargingTime: sanitizeNumber(battery.dischargingTime)
        };
        updateSensorDisplay();
    };
    
    updateBatteryInfo();
    battery.addEventListener('chargingchange', updateBatteryInfo);
    battery.addEventListener('levelchange', updateBatteryInfo);
}

function handleNetworkInfo() {
    if (!streaming || !navigator.connection) return;
    
    sensorData.network = {
        effectiveType: sanitizeString(navigator.connection.effectiveType),
        downlink: sanitizeNumber(navigator.connection.downlink),
        rtt: sanitizeNumber(navigator.connection.rtt),
        saveData: Boolean(navigator.connection.saveData)
    };
    
    updateSensorDisplay();
}

// ========================================
// SENSOR STREAMING CONTROL
// ========================================

function stopSensors() {
    streaming = false;
    sensorDataAvailable = false;
    
    console.log('⏹️ Stopping sensor streaming...');
    
    // Remove event listeners
    window.removeEventListener('devicemotion', handleMotion);
    window.removeEventListener('deviceorientation', handleOrientation);
    
    if (navigator.connection) {
        navigator.connection.removeEventListener('change', handleNetworkInfo);
    }
    
    // Stop camera streaming (ENHANCED)
    stopFrameStreaming();
    cameraStreamActive = false;
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        
        const videoElement = document.getElementById('camera-preview');
        if (videoElement) {
            videoElement.srcObject = null;
        }
        
        const cameraStatus = document.getElementById('camera-status');
        if (cameraStatus) {
            cameraStatus.textContent = 'Camera Off';
        }
    }
    
    console.log('✅ Sensor streaming stopped');
}

// ========================================
// DATA TRANSMISSION (ENHANCED)
// ========================================

function sendSensorData() {
    if (!streaming || !wss || wss.readyState !== WebSocket.OPEN) {
        return;
    }
    
    try {
        // Ensure we have sensor data
        if (!sensorDataAvailable) {
            return;
        }
        
        // Create data packet with current timestamp
        const dataToSend = {
            accelerometer: sensorData.accelerometer || { x: 0, y: 0, z: 0 },
            gyroscope: sensorData.gyroscope || { x: 0, y: 0, z: 0 },
            orientation: sensorData.orientation || { alpha: 0, beta: 0, gamma: 0 },
            timestamp: new Date().toISOString(),
            dataCount: ++dataCount
        };
        
        // Add optional data if available
        if (sensorData.gps && isValidGPSData(sensorData.gps)) {
            dataToSend.gps = sensorData.gps;
        }
        
        if (sensorData.battery && isValidBatteryData(sensorData.battery)) {
            dataToSend.battery = sensorData.battery;
        }
        
        // Add camera streaming status (NEW)
        if (cameraStreamActive) {
            dataToSend.camera = {
                active: true,
                facingMode: currentFacingMode,
                streaming: true,
                width: canvas?.width || 0,
                height: canvas?.height || 0
            };
        }
        
        if (sensorData.network) {
            dataToSend.network = sensorData.network;
        }
        
        // Add device info
        dataToSend.device = {
            userAgent: sanitizeString(navigator.userAgent),
            platform: sanitizeString(navigator.userAgentData?.platform || navigator.platform || ''),
            language: sanitizeString(navigator.language),
            onLine: navigator.onLine,
            hardwareConcurrency: navigator.hardwareConcurrency || 0
        };
        
        // Convert to JSON and validate
        const jsonString = JSON.stringify(dataToSend);
        
        if (!isValidUTF8String(jsonString)) {
            console.warn('⚠️ Invalid UTF-8 detected');
            return;
        }
        
        if (jsonString.length > 16384) { // 16KB limit for stability
            console.warn('⚠️ Message too large');
            return;
        }
        
        // Send data
        wss.send(jsonString);
        consecutiveErrors = 0;
        
        // Update UI
        updatePreviewData(dataToSend);
        updateDataRate();
        
    } catch (error) {
        console.error('❌ Error sending sensor data:', error);
        handleSendError();
    }
}

function handleSendError() {
    consecutiveErrors++;
    
    if (consecutiveErrors > 3) {
        console.log('⚠️ Too many consecutive errors, reconnecting...');
        reconnectWebSocket();
    }
}

function reconnectWebSocket() {
    if (wss) {
        wss.close(1000, 'Reconnecting');
    }
    
    setTimeout(() => {
        consecutiveErrors = 0;
        connectWebSocket();
    }, 2000);
}

// ========================================
// UI UPDATE FUNCTIONS
// ========================================

function updateSensorDisplay() {
    const sensorDetails = document.getElementById('sensor-details');
    if (sensorDetails && sensorDataAvailable) {
        sensorDetails.textContent = JSON.stringify(sensorData, null, 2);
    }
    
    // Update old sensor info for compatibility
    const sensorInfo = document.getElementById('sensorInfo');
    if (sensorInfo && sensorDataAvailable) {
        sensorInfo.innerHTML = `<pre>${JSON.stringify(sensorData, null, 2)}</pre>`;
    }
    
    updatePreviewData(sensorData);
}

function updatePreviewData(data) {
    // Update accelerometer preview
    if (data.accelerometer) {
        const mag = Math.sqrt(
            (data.accelerometer.x || 0) ** 2 + 
            (data.accelerometer.y || 0) ** 2 + 
            (data.accelerometer.z || 0) ** 2
        ).toFixed(1);
        
        const accelMag = document.getElementById('accel-magnitude');
        const accelPreview = document.getElementById('accel-preview');
        
        if (accelMag) accelMag.textContent = mag;
        if (accelPreview) accelPreview.classList.add('active');
    }
    
    // Update gyroscope preview
    if (data.gyroscope) {
        const mag = Math.sqrt(
            (data.gyroscope.x || 0) ** 2 + 
            (data.gyroscope.y || 0) ** 2 + 
            (data.gyroscope.z || 0) ** 2
        ).toFixed(1);
        
        const gyroMag = document.getElementById('gyro-magnitude');
        const gyroPreview = document.getElementById('gyro-preview');
        
        if (gyroMag) gyroMag.textContent = mag;
        if (gyroPreview) gyroPreview.classList.add('active');
    }
    
    // Update orientation preview
    if (data.orientation) {
        const orientAlpha = document.getElementById('orient-alpha');
        const orientPreview = document.getElementById('orient-preview');
        
        if (orientAlpha) {
            orientAlpha.textContent = (data.orientation.alpha || 0).toFixed(0) + '°';
        }
        if (orientPreview) orientPreview.classList.add('active');
    }
    
    // Update GPS preview
    if (data.gps) {
        const gpsAccuracy = document.getElementById('gps-accuracy');
        const gpsPreview = document.getElementById('gps-preview');
        
        if (gpsAccuracy) {
            gpsAccuracy.textContent = (data.gps.accuracy || 0).toFixed(0) + 'm';
        }
        if (gpsPreview) gpsPreview.classList.add('active');
    }
    
    // Update stats
    const packetCount = document.getElementById('packet-count');
    if (packetCount && data.dataCount) {
        packetCount.textContent = data.dataCount;
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    if (connected) {
        if (indicator) indicator.classList.add('connected');
        if (text) text.textContent = 'Connected';
        if (statusDiv) {
            statusDiv.textContent = '🟢 Connected to server';
            statusDiv.className = 'status connected';
        }
        document.body.classList.add('streaming');
    } else {
        if (indicator) indicator.classList.remove('connected');
        if (text) text.textContent = 'Disconnected';
        if (statusDiv) {
            statusDiv.textContent = '🔴 Disconnected from server';
            statusDiv.className = 'status disconnected';
        }
        document.body.classList.remove('streaming');
    }
}

function updateDataRate() {
    const now = Date.now();
    if (now - lastDataTime >= 1000) {
        const dataRateElement = document.getElementById('data-rate');
        if (dataRateElement) {
            dataRateElement.textContent = dataRateCounter;
        }
        dataRateCounter = 0;
        lastDataTime = now;
    }
    dataRateCounter++;
}

// ========================================
// EVENT HANDLERS
// ========================================
async function handleStartStreaming() {
    try {
        console.log('🚀 Starting sensor streaming...');
        
        const permissionsGranted = await requestPermissions();
        console.log('Permissions granted:', permissionsGranted);
        
        if (!permissionsGranted) {
            console.log('❌ Permissions not granted');
            return;
        }
        
        // Update UI
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        
        connectWebSocket();
        
        // Directly start sensors and camera streaming after WebSocket connection
        setTimeout(() => {
            console.log('WebSocket state:', wss?.readyState);
            if (wss && wss.readyState === WebSocket.OPEN) {
                startSensors();
                console.log('✅ Sensors started');
                // No need to call initializeCameraStreaming here, it's already called in requestPermissions
                console.log('✅ Camera initialized (hopefully streaming...)');
            } else {
                alert('Failed to connect to server');
                handleStopStreaming();
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error starting streaming:', error);
        alert('Error: ' + error.message);
        handleStopStreaming();
    }
}


function handleStopStreaming() {
    console.log('⏹️ Stopping streaming...');
    
    stopSensors();
    
    if (wss) {
        wss.close(1000, 'User stopped streaming');
        wss = null;
    }
    
    // Update UI
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    
    updateConnectionStatus(false);
    
    console.log('✅ Streaming stopped');
}

function handleVisibilityChange() {
    if (document.hidden && streaming) {
        console.log('📱 Page hidden, reducing update frequency');
    } else if (!document.hidden && streaming) {
        console.log('📱 Page visible, resuming normal frequency');
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function sanitizeNumber(value) {
    if (typeof value !== 'number' || !isFinite(value)) return 0;
    return Math.round(value * 1000) / 1000; // 3 decimal places
}

function sanitizeString(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '').substring(0, 100);
}

function isValidUTF8String(str) {
    try {
        const encoded = new TextEncoder().encode(str);
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
        return decoded === str && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(str);
    } catch (error) {
        return false;
    }
}

function isValidGPSData(gps) {
    return gps && 
           typeof gps.latitude === 'number' && 
           typeof gps.longitude === 'number' &&
           Math.abs(gps.latitude) <= 90 &&
           Math.abs(gps.longitude) <= 180 &&
           isFinite(gps.latitude) &&
           isFinite(gps.longitude);
}

function isValidBatteryData(battery) {
    return battery && 
           typeof battery.level === 'number' &&
           battery.level >= 0 && battery.level <= 1 &&
           isFinite(battery.level);
}

// ========================================
// CLEANUP AND ERROR HANDLING
// ========================================

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (streaming) {
        stopSensors();
    }
    
    if (wss) {
        wss.close(1000, 'Page unload');
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

console.log('📱 Phone sensor app with camera streaming initialized');
