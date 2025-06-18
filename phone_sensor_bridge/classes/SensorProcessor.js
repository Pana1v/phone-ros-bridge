class SensorProcessor {
    constructor() {
        this.calibration = {
            accelerometer: { x: 0, y: 0, z: 0 },
            gyroscope: { x: 0, y: 0, z: 0 },
            magnetometer: { x: 0, y: 0, z: 0 }
        };
        this.filters = new Map();
        this.history = [];
        this.maxHistory = 1000;
    }
    
    lowPassFilter(newValue, oldValue, alpha = 0.8) {
        return oldValue + alpha * (newValue - oldValue);
    }
    
    processSensorData(sensorData) {
        const processed = { ...sensorData };
        
        // Apply filtering to accelerometer
        if (processed.accelerometer) {
            const key = 'accel';
            const lastData = this.filters.get(key) || processed.accelerometer;
            
            processed.accelerometer = {
                x: this.lowPassFilter(processed.accelerometer.x, lastData.x),
                y: this.lowPassFilter(processed.accelerometer.y, lastData.y),
                z: this.lowPassFilter(processed.accelerometer.z, lastData.z)
            };
            
            this.filters.set(key, processed.accelerometer);
            
            // Calculate magnitude
            const { x, y, z } = processed.accelerometer;
            processed.accelerometer.magnitude = Math.sqrt(x*x + y*y + z*z);
            
            // Detect motion
            processed.motion = {
                isMoving: processed.accelerometer.magnitude > 1.2,
                intensity: Math.abs(processed.accelerometer.magnitude - 9.81),
                type: this.classifyMotion(processed.accelerometer.magnitude)
            };
        }
        
        // Process gyroscope
        if (processed.gyroscope) {
            const key = 'gyro';
            const lastData = this.filters.get(key) || processed.gyroscope;
            
            processed.gyroscope = {
                x: this.lowPassFilter(processed.gyroscope.x, lastData.x),
                y: this.lowPassFilter(processed.gyroscope.y, lastData.y),
                z: this.lowPassFilter(processed.gyroscope.z, lastData.z)
            };
            
            this.filters.set(key, processed.gyroscope);
        }
        
        // Calculate orientation
        if (processed.accelerometer && processed.gyroscope) {
            processed.calculatedOrientation = this.calculateOrientation(
                processed.accelerometer, 
                processed.gyroscope
            );
        }
        
        this.addToHistory(processed);
        return processed;
    }
    
    classifyMotion(magnitude) {
        if (magnitude < 0.5) return 'stationary';
        if (magnitude < 2.0) return 'walking';
        if (magnitude < 5.0) return 'running';
        return 'vigorous';
    }
    
    calculateOrientation(accel, gyro) {
        const roll = Math.atan2(accel.y, accel.z) * 180 / Math.PI;
        const pitch = Math.atan2(-accel.x, Math.sqrt(accel.y*accel.y + accel.z*accel.z)) * 180 / Math.PI;
        
        return { roll, pitch, yaw: gyro.z };
    }
    
    addToHistory(data) {
        this.history.push({
            timestamp: Date.now(),
            data: data
        });
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    getStats() {
        if (this.history.length === 0) return null;
        
        const recent = this.history.slice(-100);
        
        return {
            totalReadings: this.history.length,
            recentReadings: recent.length,
            averageAcceleration: this.calculateAverage(recent, 'accelerometer'),
            motionClassification: this.getMotionDistribution(recent),
            dataRate: this.calculateDataRate()
        };
    }
    
    calculateAverage(data, sensorType) {
        const values = data.map(d => d.data[sensorType]).filter(Boolean);
        if (values.length === 0) return null;
        
        const sum = values.reduce((acc, val) => ({
            x: acc.x + (val.x || 0),
            y: acc.y + (val.y || 0),
            z: acc.z + (val.z || 0)
        }), { x: 0, y: 0, z: 0 });
        
        return {
            x: sum.x / values.length,
            y: sum.y / values.length,
            z: sum.z / values.length
        };
    }
    
    getMotionDistribution(data) {
        const motionTypes = {};
        data.forEach(d => {
            const type = d.data.motion?.type || 'unknown';
            motionTypes[type] = (motionTypes[type] || 0) + 1;
        });
        return motionTypes;
    }
    
    calculateDataRate() {
        if (this.history.length < 2) return 0;
        
        const timeSpan = this.history[this.history.length - 1].timestamp - this.history[0].timestamp;
        return (this.history.length / (timeSpan / 1000)).toFixed(2);
    }
}

module.exports = SensorProcessor;
