const socket = io();
const statusDiv = document.getElementById('status');

// Connection status
socket.on('connect', () => {
    statusDiv.textContent = 'Connected to server';
    statusDiv.className = 'status connected';
});

socket.on('disconnect', () => {
    statusDiv.textContent = 'Disconnected from server';
    statusDiv.className = 'status disconnected';
});

// Handle incoming sensor data
socket.on('sensorData', (data) => {
    console.log('Received sensor data:', data);
    updateSensorDisplay(data);
});

function updateSensorDisplay(data) {
    // Update timestamp
    if (data.timestamp) {
        document.getElementById('timestamp').textContent = 
            new Date(data.timestamp).toLocaleString();
    }
    
    // Update accelerometer
    if (data.accelerometer) {
        document.getElementById('accel-x').textContent = 
            data.accelerometer.x?.toFixed(2) || '--';
        document.getElementById('accel-y').textContent = 
            data.accelerometer.y?.toFixed(2) || '--';
        document.getElementById('accel-z').textContent = 
            data.accelerometer.z?.toFixed(2) || '--';
    }
    
    // Update gyroscope
    if (data.gyroscope) {
        document.getElementById('gyro-x').textContent = 
            data.gyroscope.x?.toFixed(2) || '--';
        document.getElementById('gyro-y').textContent = 
            data.gyroscope.y?.toFixed(2) || '--';
        document.getElementById('gyro-z').textContent = 
            data.gyroscope.z?.toFixed(2) || '--';
    }
    
    // Update magnetometer
    if (data.magnetometer) {
        document.getElementById('mag-x').textContent = 
            data.magnetometer.x?.toFixed(2) || '--';
        document.getElementById('mag-y').textContent = 
            data.magnetometer.y?.toFixed(2) || '--';
        document.getElementById('mag-z').textContent = 
            data.magnetometer.z?.toFixed(2) || '--';
    }
    
    // Update GPS
    if (data.gps) {
        document.getElementById('gps-lat').textContent = 
            data.gps.latitude?.toFixed(6) || '--';
        document.getElementById('gps-lon').textContent = 
            data.gps.longitude?.toFixed(6) || '--';
        document.getElementById('gps-alt').textContent = 
            data.gps.altitude?.toFixed(2) || '--';
    }
    
    // Update environmental sensors
    if (data.light !== undefined) {
        document.getElementById('light').textContent = 
            data.light.toFixed(1) + ' lux';
    }
    if (data.proximity !== undefined) {
        document.getElementById('proximity').textContent = 
            data.proximity.toFixed(1) + ' cm';
    }
    if (data.pressure !== undefined) {
        document.getElementById('pressure').textContent = 
            data.pressure.toFixed(1) + ' hPa';
    }
    
    // Update orientation
    if (data.orientation) {
        document.getElementById('orient-alpha').textContent = 
            data.orientation.alpha?.toFixed(1) || '--';
        document.getElementById('orient-beta').textContent = 
            data.orientation.beta?.toFixed(1) || '--';
        document.getElementById('orient-gamma').textContent = 
            data.orientation.gamma?.toFixed(1) || '--';
    }
}
