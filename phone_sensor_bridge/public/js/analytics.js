const socket = io();
let dataPoints = 0;
const maxDataPoints = 100;

// Chart configurations
const chartConfig = {
    type: 'line',
    options: {
        responsive: true,
        scales: {
            x: { 
                type: 'linear', 
                position: 'bottom',
                title: { display: true, text: 'Time (data points)' }
            },
            y: { 
                beginAtZero: false,
                title: { display: true, text: 'Value' }
            }
        },
        plugins: { 
            legend: { display: true },
            tooltip: { mode: 'index', intersect: false }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
};

// Initialize charts
const accelChart = new Chart(document.getElementById('accelChart'), {
    ...chartConfig,
    data: {
        datasets: [
            { label: 'X', data: [], borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.1)', fill: false },
            { label: 'Y', data: [], borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', fill: false },
            { label: 'Z', data: [], borderColor: '#007bff', backgroundColor: 'rgba(0, 123, 255, 0.1)', fill: false },
            { label: 'Magnitude', data: [], borderColor: '#6f42c1', backgroundColor: 'rgba(111, 66, 193, 0.1)', fill: false }
        ]
    }
});

const gyroChart = new Chart(document.getElementById('gyroChart'), {
    ...chartConfig,
    data: {
        datasets: [
            { label: 'X', data: [], borderColor: '#fd7e14', backgroundColor: 'rgba(253, 126, 20, 0.1)', fill: false },
            { label: 'Y', data: [], borderColor: '#20c997', backgroundColor: 'rgba(32, 201, 151, 0.1)', fill: false },
            { label: 'Z', data: [], borderColor: '#e83e8c', backgroundColor: 'rgba(232, 62, 140, 0.1)', fill: false }
        ]
    }
});

const orientationChart = new Chart(document.getElementById('orientationChart'), {
    ...chartConfig,
    data: {
        datasets: [
            { label: 'Alpha', data: [], borderColor: '#17a2b8', backgroundColor: 'rgba(23, 162, 184, 0.1)', fill: false },
            { label: 'Beta', data: [], borderColor: '#ffc107', backgroundColor: 'rgba(255, 193, 7, 0.1)', fill: false },
            { label: 'Gamma', data: [], borderColor: '#6c757d', backgroundColor: 'rgba(108, 117, 125, 0.1)', fill: false }
        ]
    }
});

const motionChart = new Chart(document.getElementById('motionChart'), {
    ...chartConfig,
    data: {
        datasets: [
            { label: 'Motion Intensity', data: [], borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.1)', fill: true },
            { label: 'Is Moving', data: [], borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', fill: false, stepped: true }
        ]
    }
});

// Handle incoming sensor data
socket.on('sensorData', (data) => {
    dataPoints++;
    
    // Update accelerometer chart
    if (data.accelerometer) {
        accelChart.data.datasets[0].data.push({x: dataPoints, y: data.accelerometer.x});
        accelChart.data.datasets[1].data.push({x: dataPoints, y: data.accelerometer.y});
        accelChart.data.datasets[2].data.push({x: dataPoints, y: data.accelerometer.z});
        accelChart.data.datasets[3].data.push({x: dataPoints, y: data.accelerometer.magnitude || 0});
    }
    
    // Update gyroscope chart
    if (data.gyroscope) {
        gyroChart.data.datasets[0].data.push({x: dataPoints, y: data.gyroscope.x});
        gyroChart.data.datasets[1].data.push({x: dataPoints, y: data.gyroscope.y});
        gyroChart.data.datasets[2].data.push({x: dataPoints, y: data.gyroscope.z});
    }
    
    // Update orientation chart
    if (data.orientation) {
        orientationChart.data.datasets[0].data.push({x: dataPoints, y: data.orientation.alpha || 0});
        orientationChart.data.datasets[1].data.push({x: dataPoints, y: data.orientation.beta || 0});
        orientationChart.data.datasets[2].data.push({x: dataPoints, y: data.orientation.gamma || 0});
    }
    
    // Update motion chart
    if (data.motion) {
        motionChart.data.datasets[0].data.push({x: dataPoints, y: data.motion.intensity || 0});
        motionChart.data.datasets[1].data.push({x: dataPoints, y: data.motion.isMoving ? 1 : 0});
    }
    
    // Limit data points
    [accelChart, gyroChart, orientationChart, motionChart].forEach(chart => {
        chart.data.datasets.forEach(dataset => {
            if (dataset.data.length > maxDataPoints) {
                dataset.data.shift();
            }
        });
        chart.update('none');
    });
});

// Update statistics
setInterval(() => {
    fetch('/api/stats')
        .then(response => response.json())
        .then(stats => {
            if (stats) {
                document.getElementById('stats-content').innerHTML = `
                    <div><strong>📊 Total Readings:</strong> ${stats.totalReadings}</div>
                    <div><strong>⚡ Data Rate:</strong> ${stats.dataRate} Hz</div>
                    <div><strong>📈 Recent Readings:</strong> ${stats.recentReadings}</div>
                    <div><strong>🎯 Motion Types:</strong> ${Object.entries(stats.motionClassification || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}</div>
                    ${stats.averageAcceleration ? `<div><strong>📊 Avg Acceleration:</strong> X: ${stats.averageAcceleration.x.toFixed(2)}, Y: ${stats.averageAcceleration.y.toFixed(2)}, Z: ${stats.averageAcceleration.z.toFixed(2)}</div>` : ''}
                `;
            }
        })
        .catch(error => console.error('Error fetching stats:', error));
}, 2000);
