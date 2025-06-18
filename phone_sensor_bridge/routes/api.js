const express = require('express');
const router = express.Router();

module.exports = (sensorProcessor, dataLogger) => {
    
    router.get('/stats', (req, res) => {
        const stats = sensorProcessor.getStats();
        res.json(stats);
    });
    
    router.get('/logs/:filename', (req, res) => {
        try {
            const filename = req.params.filename;
            const logData = dataLogger.readLogFile(filename);
            res.json(logData);
        } catch (error) {
            res.status(404).json({ error: 'Log file not found' });
        }
    });
    
    router.post('/sensor-data', (req, res) => {
        const sensorData = {
            ...req.body,
            timestamp: new Date().toISOString()
        };
        
        console.log('Received sensor data via HTTP:', sensorData);
        res.json({ status: 'success', message: 'Data received' });
    });
    
    return router;
};
