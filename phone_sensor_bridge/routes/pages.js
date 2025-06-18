const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
});

router.get('/phone', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'phone.html'));
});

router.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'analytics.html'));
});

router.get('/logs', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'logs.html'));
});

router.get('/test', (req, res) => {
    res.send(`
        <h1>🔧 Test Server</h1>
        <p>✅ Server is working!</p>
        <p>⏰ Time: ${new Date()}</p>
        <p>🌐 Your IP: ${req.ip}</p>
        <a href="/">← Back to Dashboard</a>
    `);
});

module.exports = router;
