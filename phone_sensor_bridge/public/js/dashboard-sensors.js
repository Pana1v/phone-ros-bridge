// ========================================
// SENSOR DATA DISPLAY SYSTEM - COMPLETELY FIXED
// ========================================

function updateAllSensorDisplays(data) {
    console.log('📊 Processing sensor data:', data);
    
    updateTimestamp(data.timestamp);
    updateAccelerometer(data.accelerometer);
    updateGyroscope(data.gyroscope);
    updateMagnetometer(data.magnetometer);
    updateGPS(data.gps);
    updateEnvironmental(data);
    updateOrientation(data.orientation);
    updateMotionAnalysis(data.motion);
    updateCalculatedValues(data.calculatedOrientation);
    updateBattery(data.battery);
    updateNetwork(data.network);
    updateDevice(data.device, data.performance);
    updatePerformanceMetrics(data);
    
    // Handle camera status safely
    if (data.camera && data.camera.active) {
        if (typeof updateCameraStatus === 'function') {
            updateCameraStatus('phone', 'Active - Streaming');
        } else {
            console.log('Camera active:', data.camera);
        }
    }
}

function updateOrientationDisplays(calc) {
    if (!calc) return;
    
    console.log('📐 Updating orientation displays:', calc);
    
    // Use direct element updates since window.updateElement might not be available
    updateElementDirect('roll-display', calc.roll?.toFixed(1) + '°');
    updateElementDirect('pitch-display', calc.pitch?.toFixed(1) + '°');
    updateElementDirect('yaw-display', calc.yaw?.toFixed(1) + '°');
}

function updateTimestamp(timestamp) {
    if (!timestamp) return;
    
    const formattedTime = new Date(timestamp).toLocaleString();
    updateElementDirect('timestamp', formattedTime);
    updateElementDirect('server-time', new Date().toLocaleString());
}

function updateAccelerometer(accel) {
    if (!accel) {
        console.warn('❌ No accelerometer data received');
        return;
    }
    
    console.log('🏃 Updating accelerometer:', accel);
    
    // Handle extremely small values (scientific notation close to zero)
    const fixValue = (val) => {
        if (!val || Math.abs(val) < 1e-10) return 0;
        return val;
    };
    
    const x = fixValue(accel.x);
    const y = fixValue(accel.y);
    const z = fixValue(accel.z);
    const mag = fixValue(accel.magnitude);
    
    // Direct element updates with fallback
    updateElementDirect('accel-x', x.toFixed(2));
    updateElementDirect('accel-y', y.toFixed(2));
    updateElementDirect('accel-z', z.toFixed(2));
    updateElementDirect('accel-mag', mag.toFixed(2));
    
    console.log(`✅ Accelerometer updated: X=${x.toFixed(2)}, Y=${y.toFixed(2)}, Z=${z.toFixed(2)}, Mag=${mag.toFixed(2)}`);
}

function updateGyroscope(gyro) {
    if (!gyro) return;
    
    console.log('🌀 Updating gyroscope:', gyro);
    
    updateElementDirect('gyro-x', gyro.x?.toFixed(2) || '--');
    updateElementDirect('gyro-y', gyro.y?.toFixed(2) || '--');
    updateElementDirect('gyro-z', gyro.z?.toFixed(2) || '--');
}

function updateMagnetometer(mag) {
    if (!mag) return;
    
    console.log('🧭 Updating magnetometer:', mag);
    
    updateElementDirect('mag-x', mag.x?.toFixed(2) || '--');
    updateElementDirect('mag-y', mag.y?.toFixed(2) || '--');
    updateElementDirect('mag-z', mag.z?.toFixed(2) || '--');
}

function updateGPS(gps) {
    if (!gps) return;
    
    console.log('🗺️ Updating GPS:', gps);
    
    updateElementDirect('gps-lat', gps.latitude?.toFixed(6) || '--');
    updateElementDirect('gps-lon', gps.longitude?.toFixed(6) || '--');
    updateElementDirect('gps-alt', gps.altitude?.toFixed(2) || '--');
    updateElementDirect('gps-acc', gps.accuracy?.toFixed(2) || '--');
    updateElementDirect('gps-speed', gps.speed?.toFixed(2) || '--');
}

function updateEnvironmental(data) {
    if (!data) return;
    
    if (data.light !== undefined) {
        updateElementDirect('light', data.light.toFixed(1));
    }
    if (data.proximity !== undefined) {
        updateElementDirect('proximity', data.proximity.toFixed(1));
    }
    if (data.pressure !== undefined) {
        updateElementDirect('pressure', data.pressure.toFixed(1));
    }
}

function updateOrientation(orientation) {
    if (!orientation) return;
    
    console.log('📱 Updating orientation:', orientation);
    
    updateElementDirect('orient-alpha', orientation.alpha?.toFixed(1) || '--');
    updateElementDirect('orient-beta', orientation.beta?.toFixed(1) || '--');
    updateElementDirect('orient-gamma', orientation.gamma?.toFixed(1) || '--');
    updateElementDirect('orient-absolute', orientation.absolute ? 'Yes' : 'No');
}

function updateMotionAnalysis(motion) {
    if (!motion) return;
    
    console.log('🚶 Updating motion:', motion);
    
    updateElementDirect('motion-status', motion.isMoving ? 'Moving' : 'Stationary');
    updateElementDirect('motion-intensity', motion.intensity?.toFixed(2) || '--');
    
    const motionTypeElement = document.getElementById('motion-type');
    if (motionTypeElement && motion.type) {
        motionTypeElement.innerHTML = `<span class="motion-indicator motion-${motion.type}"></span>${motion.type}`;
    }
}

function updateCalculatedValues(calc) {
    if (!calc) return;
    
    console.log('🧮 Updating calculated values:', calc);
    
    // Handle extreme values (like -180 roll)
    const fixAngle = (angle) => {
        if (!angle || !isFinite(angle)) return 0;
        if (Math.abs(angle) > 360) return 0;
        return angle;
    };
    
    const roll = fixAngle(calc.roll);
    const pitch = fixAngle(calc.pitch);
    const yaw = fixAngle(calc.yaw);
    
    updateElementDirect('calc-roll', roll.toFixed(1));
    updateElementDirect('calc-pitch', pitch.toFixed(1));
    updateElementDirect('calc-yaw', yaw.toFixed(1));
    
    // Update orientation displays
    updateElementDirect('roll-display', roll.toFixed(1) + '°');
    updateElementDirect('pitch-display', pitch.toFixed(1) + '°');
    updateElementDirect('yaw-display', yaw.toFixed(1) + '°');
}

function updateBattery(battery) {
    if (!battery) return;
    
    console.log('🔋 Updating battery:', battery);
    
    updateElementDirect('battery-level', (battery.level * 100).toFixed(0));
    updateElementDirect('battery-charging', battery.charging ? 'Yes' : 'No');
    
    const time = battery.charging ? battery.chargingTime : battery.dischargingTime;
    updateElementDirect('battery-time', time && time !== Infinity ? Math.round(time / 60) : '--');
}

function updateNetwork(network) {
    if (!network) return;
    
    console.log('📶 Updating network:', network);
    
    updateElementDirect('network-type', network.effectiveType || '--');
    updateElementDirect('network-speed', network.downlink?.toFixed(1) || '--');
    updateElementDirect('network-rtt', network.rtt || '--');
}

function updateDevice(device, performance) {
    if (!device) return;
    
    console.log('📱 Updating device:', device);
    
    updateElementDirect('device-platform', device.platform || '--');
    updateElementDirect('device-cores', device.hardwareConcurrency || '--');
    
    if (performance?.memory) {
        updateElementDirect('device-memory', Math.round(performance.memory.usedJSHeapSize / 1024 / 1024));
    }
}

function updatePerformanceMetrics(data) {
    const latency = data.clientLatency || data.serverLatency;
    if (latency !== undefined) {
        updateElementDirect('perf-latency', latency.toFixed(1));
        updateElementDirect('header-latency', `${latency.toFixed(1)} ms`);
        
        const latencyDisplay = document.getElementById('latency-value');
        if (latencyDisplay) {
            latencyDisplay.textContent = `${latency.toFixed(1)}ms`;
        }
    }
    
    if (data.dataCount) {
        updateElementDirect('perf-packets', data.dataCount);
        
        // Get FPS from window if available
        if (typeof window.fps === 'function') {
            updateElementDirect('header-data-rate', `${window.fps().toFixed(1)} Hz`);
        } else if (typeof window.fps === 'number') {
            updateElementDirect('header-data-rate', `${window.fps.toFixed(1)} Hz`);
        }
    }
}

function updateCameraStatus(cameraType, status) {
    const statusElement = document.getElementById(`${cameraType}-camera-status`);
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `camera-status ${status.toLowerCase().replace(' ', '-')}`;
    }
}

// ========================================
// ENHANCED ELEMENT UPDATE FUNCTION
// ========================================

function updateElementDirect(id, value) {
    try {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || '--';
            console.log(`✅ Updated ${id}: ${value}`);
            return true;
        } else {
            console.warn(`❌ Element not found: ${id}`);
            
            // Try to create missing elements dynamically
            createMissingElement(id, value);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error updating ${id}:`, error);
        return false;
    }
}

function createMissingElement(id, value) {
    // Create missing sensor elements dynamically
    const sensorGrid = document.querySelector('.sensor-grid');
    if (!sensorGrid) return;
    
    const sensorMap = {
        'accel-x': { title: '🏃 Accelerometer', unit: 'm/s²', group: 'accelerometer' },
        'accel-y': { title: '🏃 Accelerometer', unit: 'm/s²', group: 'accelerometer' },
        'accel-z': { title: '🏃 Accelerometer', unit: 'm/s²', group: 'accelerometer' },
        'accel-mag': { title: '🏃 Accelerometer', unit: 'm/s²', group: 'accelerometer' },
        'gyro-x': { title: '🌀 Gyroscope', unit: 'rad/s', group: 'gyroscope' },
        'gyro-y': { title: '🌀 Gyroscope', unit: 'rad/s', group: 'gyroscope' },
        'gyro-z': { title: '🌀 Gyroscope', unit: 'rad/s', group: 'gyroscope' }
    };
    
    const sensor = sensorMap[id];
    if (!sensor) return;
    
    // Check if group card already exists
    let groupCard = document.querySelector(`[data-sensor-group="${sensor.group}"]`);
    
    if (!groupCard) {
        // Create new sensor card
        groupCard = document.createElement('div');
        groupCard.className = 'sensor-card';
        groupCard.setAttribute('data-sensor-group', sensor.group);
        
        groupCard.innerHTML = `
            <div class="sensor-title">${sensor.title}</div>
            <div class="sensor-data" id="${sensor.group}-data">
            </div>
        `;
        
        sensorGrid.appendChild(groupCard);
    }
    
    // Add sensor row to group
    const sensorData = groupCard.querySelector('.sensor-data');
    const axis = id.split('-')[1].toUpperCase();
    
    const sensorRow = document.createElement('div');
    sensorRow.className = 'sensor-row';
    sensorRow.innerHTML = `
        <span class="sensor-label">${axis}:</span>
        <span id="${id}" class="sensor-value">${value || '--'}</span>
        <span class="sensor-unit">${sensor.unit}</span>
    `;
    
    sensorData.appendChild(sensorRow);
    
    console.log(`✅ Created missing element: ${id}`);
}

// ========================================
// DEBUG FUNCTIONS
// ========================================

function debugSensorElements() {
    const requiredElements = [
        'accel-x', 'accel-y', 'accel-z', 'accel-mag',
        'gyro-x', 'gyro-y', 'gyro-z',
        'orient-alpha', 'orient-beta', 'orient-gamma',
        'gps-lat', 'gps-lon', 'gps-alt',
        'battery-level', 'battery-charging'
    ];
    
    console.log('🔍 Checking sensor elements:');
    const missing = [];
    const found = [];
    
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            found.push(id);
        } else {
            missing.push(id);
        }
    });
    
    console.log(`✅ Found elements (${found.length}):`, found);
    console.log(`❌ Missing elements (${missing.length}):`, missing);
    
    return { found, missing };
}

// Test function with realistic data
function testSensorUpdates() {
    console.log('🧪 Testing sensor updates with realistic data...');
    
    const testData = {
        accelerometer: { x: 0.12, y: -0.34, z: 9.78, magnitude: 9.79 },
        gyroscope: { x: 0.01, y: -0.02, z: 0.03 },
        orientation: { alpha: 86, beta: 2.4, gamma: -1.4, absolute: false },
        gps: { latitude: 13.082, longitude: 77.667, accuracy: 100, altitude: 810.1, speed: 0 },
        battery: { level: 0.82, charging: false },
        calculatedOrientation: { roll: -1.4, pitch: 2.4, yaw: 86.0 }
    };
    
    updateAllSensorDisplays(testData);
    console.log('🧪 Test complete');
}

// Auto-run debug on load
setTimeout(() => {
    debugSensorElements();
    setTimeout(testSensorUpdates, 2000);
}, 1000);

console.log('📊 Enhanced Sensor Display module loaded');

// Export functions
window.updateAllSensorDisplays = updateAllSensorDisplays;
window.updateOrientationDisplays = updateOrientationDisplays;
window.updateCameraStatus = updateCameraStatus;
window.updateElementDirect = updateElementDirect;
window.debugSensorElements = debugSensorElements;
window.testSensorUpdates = testSensorUpdates;
