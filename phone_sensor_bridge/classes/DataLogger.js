const fs = require('fs');
const path = require('path');

class DataLogger {
    constructor() {
        this.logDir = path.join(__dirname, '..', 'sensor_logs');
        this.ensureLogDirectory();
        this.logBuffer = [];
        this.bufferSize = 50;
    }
    
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    
    logSensorData(data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            data: data
        };
        
        this.logBuffer.push(logEntry);
        
        if (this.logBuffer.length >= this.bufferSize) {
            this.flushBuffer();
        }
    }
    
    flushBuffer() {
        if (this.logBuffer.length === 0) return;
        
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `sensors_${today}.jsonl`);
        
        const logLines = this.logBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';
        
        try {
            fs.appendFileSync(logFile, logLines);
            console.log(`Logged ${this.logBuffer.length} sensor readings`);
        } catch (error) {
            console.error('Error writing log file:', error);
        }
        
        this.logBuffer = [];
    }
    
    getLogFiles() {
        try {
            return fs.readdirSync(this.logDir).filter(file => file.endsWith('.jsonl'));
        } catch (error) {
            return [];
        }
    }
    
    readLogFile(filename) {
        try {
            const filePath = path.join(this.logDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
        } catch (error) {
            throw new Error('Log file not found');
        }
    }
}

module.exports = DataLogger;
